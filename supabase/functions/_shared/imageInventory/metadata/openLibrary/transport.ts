import type { MetadataNormalizedOutcome } from '../providerAdapter';
export type EditionHttpCall = Readonly<{ sequence:number; stage:string; signal:AbortSignal }>;
export type EditionHttpHooks = Readonly<{
  beforeRequest: (call: EditionHttpCall) => Promise<void>;
  afterRequest: (call: EditionHttpCall & { outcome:MetadataNormalizedOutcome; retryable:boolean;
    physicalStatus:'finalized'|'outcome_unknown'|'stale_rejected'; egressStarted:boolean }) => Promise<void>;
}>;
export type OpenLibraryConfiguration = Readonly<{
  fetcher:(input:string | URL | Request,init?:RequestInit)=>Promise<Response>;
  timeoutMs:number; maxResponseBytes:number; retentionAllowed?:boolean;
  waitForRequest?: (signal:AbortSignal)=>Promise<OpenLibraryRequestPermit>;
  // U6 fix2 (G4): called immediately before the fetcher invocation, so the
  // owning port can record provider contact and release the start clock only
  // at the actual send (never at a pre-send permit/abort check).
  onFetchStart?: () => void;
  // Unit B: transient server-configuration contact for the identifying
  // User-Agent. Never logged, persisted or returned. NULL/undefined keeps
  // the fixed legacy literal byte-identical.
  providerContact?: string | null;
}>;
export class OpenLibraryFailure extends Error {
  // O1 (U6): actual failed-response headers travel with the failure so shared
  // fetch (fetch.ts) can bound retention BEFORE author-failure isolation.
  // U6 fix1 (F2): fetch-started/response-received flags let the port bridge
  // finalize pre-send cancellation as proven-unsent, post-start/no-response
  // as outcome-unknown, and received responses as finalized — mirroring the
  // transport's own accounting (line ~86). Outcome/retryability mapping is
  // unchanged; headers/flags default to absent where no fetch/response exists,
  // so existing throw sites keep compiling and behaving.
  constructor(readonly outcome:MetadataNormalizedOutcome,readonly retryable=false,readonly headers: Headers | null = null,
    readonly fetchStarted = false, readonly responseReceived = false) { super(outcome); }
}
export async function getOpenLibraryJson(url:URL,configuration:OpenLibraryConfiguration,
  call:EditionHttpCall,hooks?:EditionHttpHooks):Promise<{raw:unknown;headers:Headers}> {
  if (url.origin !== 'https://openlibrary.org' || url.username || url.password
    || !/^(?:\/search\.json|\/works\/OL[1-9][0-9]*W\/editions\.json|\/books\/OL[1-9][0-9]*M\.json|\/authors\/OL[1-9][0-9]*A\.json)$/u.test(url.pathname)) {
    throw new OpenLibraryFailure('insufficient_query');
  }
  const release=await configuration.waitForRequest?.(call.signal);
  try {
  if (call.signal.aborted) throw new OpenLibraryFailure('cancelled');
  await hooks?.beforeRequest(call); // Registration and fresh claim/policy checks precede every GET.
  if (call.signal.aborted) {
    await hooks?.afterRequest({...call,outcome:'cancelled',retryable:false,physicalStatus:'stale_rejected',egressStarted:false});
    throw new OpenLibraryFailure('cancelled');
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  call.signal.addEventListener('abort',abort,{once:true});
  const timer = setTimeout(abort,configuration.timeoutMs);
  let failure:OpenLibraryFailure | null = null;
  let response:Response | null = null;
  let raw:unknown;
  let attempted = false;
  let fetchStarted = false;
  let responseReceived = false;
  try {
    attempted = true;
    let fetching:Promise<Response>;
    // U6 fix2 (G4): the fetch is considered started BEFORE the fetcher is
    // invoked (a synchronously-throwing fetcher has still started the send),
    // and the owner's contact callback fires immediately before invocation.
    fetchStarted = true;
    try {
      configuration.onFetchStart?.();
      // Unit B: the identifying User-Agent carries the resolved server
      // contact when configured; the legacy path keeps the fixed literal
      // byte-identical.
      const userAgent = configuration.providerContact == null ? 'BookConnect edition lookup'
        : `BookConnect edition lookup (${configuration.providerContact})`;
      fetching=configuration.fetcher(url,{signal:controller.signal,redirect:'error',
        headers:{Accept:'application/json','User-Agent':userAgent}});
    } finally { release?.(true); }
    response=await fetching;
    responseReceived = true;
    if (!response.ok) {
      const headers = response.headers;
      await response.body?.cancel();
      throw new OpenLibraryFailure(response.status === 429 ? 'rate_limited'
        : response.status >= 500 ? 'provider_unavailable' : response.status === 404 ? 'no_acceptable_match' : 'authentication_configuration_failure',
      response.status === 429 || response.status >= 500, headers, true, true);
    }
    if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel(); throw new OpenLibraryFailure('unsupported_content_type', false, response.headers, true, true);
    }
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/u.test(length) || Number(length) > configuration.maxResponseBytes)) {
      await response.body?.cancel(); throw new OpenLibraryFailure('response_too_large', false, response.headers, true, true);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new OpenLibraryFailure('malformed_response', false, response.headers, true, true);
    const chunks:Uint8Array[]=[]; let size=0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > configuration.maxResponseBytes) throw new OpenLibraryFailure('response_too_large', false, response.headers, true, true);
        chunks.push(chunk.value);
      }
      const bytes=new Uint8Array(size);let offset=0;
      for (const chunk of chunks) { bytes.set(chunk,offset);offset+=chunk.byteLength; }
      try { raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
      catch { throw new OpenLibraryFailure('malformed_response', false, response.headers, true, true); }
    } finally { await reader.cancel().catch(()=>{}); }
  } catch (error) {
    failure = error instanceof OpenLibraryFailure ? error
      : new OpenLibraryFailure(call.signal.aborted ? 'cancelled' : controller.signal.aborted ? 'timeout' : 'network_failure',!call.signal.aborted,
        null, fetchStarted, responseReceived);
  } finally {
    clearTimeout(timer); call.signal.removeEventListener('abort',abort);
  }
  if (attempted) await hooks?.afterRequest({...call,outcome:failure?.outcome ?? 'no_acceptable_match',
    retryable:failure?.retryable ?? false,physicalStatus:response ? 'finalized' : 'outcome_unknown',egressStarted:true});
  if (failure) throw failure;
  return {raw,headers:response!.headers};
  } finally { release?.(false); }
}
// One existing worker instance, shared across its three concurrent jobs; no burst allowance.
// The permit stays held through fresh database fencing and is released at the actual GET start.
export type OpenLibraryRequestPermit=(egressStarted:boolean)=>void;
export function createOpenLibraryRateLimiter(intervalMs=1000):
 (signal:AbortSignal)=>Promise<OpenLibraryRequestPermit> {
 let tail=Promise.resolve(),lastStarted=Number.NEGATIVE_INFINITY;
 return async signal=>{
  if(signal.aborted)throw new OpenLibraryFailure('cancelled');
  const previous=tail;let unlock!:()=>void;
  tail=new Promise<void>(resolve=>{unlock=resolve;});
  let released=false;
  const release:OpenLibraryRequestPermit=egress=>{
   if(released)return;released=true;
   if(egress)lastStarted=performance.now();
   unlock();
  };
  try {
   await new Promise<void>((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(new OpenLibraryFailure('cancelled'));};
    previous.then(()=>{signal.removeEventListener('abort',abort);resolve();});
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
   });
   while(lastStarted+intervalMs>performance.now()){
    const delay=Math.ceil(lastStarted+intervalMs-performance.now());
    await new Promise<void>((resolve,reject)=>{
     const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new OpenLibraryFailure('cancelled'));};
     const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},delay);
     signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    });
   }
   if(signal.aborted)throw new OpenLibraryFailure('cancelled');
   return release;
  }catch(error){
   // A cancelled queue member must not unlock past a still-active predecessor.
   void previous.then(()=>release(false));throw error;
  }
 };
}
