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
}>;
export class OpenLibraryFailure extends Error {
  constructor(readonly outcome:MetadataNormalizedOutcome,readonly retryable=false) { super(outcome); }
}
export async function getOpenLibraryJson(url:URL,configuration:OpenLibraryConfiguration,
  call:EditionHttpCall,hooks?:EditionHttpHooks):Promise<{raw:unknown;headers:Headers}> {
  if (url.origin !== 'https://openlibrary.org' || url.username || url.password
    || !/^(?:\/search\.json|\/works\/OL[1-9][0-9]*W\/editions\.json|\/authors\/OL[1-9][0-9]*A\.json)$/u.test(url.pathname)) {
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
  try {
    attempted = true;
    let fetching:Promise<Response>;
    try {
      fetching=configuration.fetcher(url,{signal:controller.signal,redirect:'error',
        headers:{Accept:'application/json','User-Agent':'BookConnect edition lookup'}});
    } finally { release?.(true); }
    response=await fetching;
    if (!response.ok) {
      await response.body?.cancel();
      throw new OpenLibraryFailure(response.status === 429 ? 'rate_limited'
        : response.status >= 500 ? 'provider_unavailable' : response.status === 404 ? 'no_acceptable_match' : 'authentication_configuration_failure',
      response.status === 429 || response.status >= 500);
    }
    if (!/^application\/json(?:\s*;|$)/iu.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel(); throw new OpenLibraryFailure('unsupported_content_type');
    }
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/u.test(length) || Number(length) > configuration.maxResponseBytes)) {
      await response.body?.cancel(); throw new OpenLibraryFailure('response_too_large');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new OpenLibraryFailure('malformed_response');
    const chunks:Uint8Array[]=[]; let size=0;
    try {
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > configuration.maxResponseBytes) throw new OpenLibraryFailure('response_too_large');
        chunks.push(chunk.value);
      }
      const bytes=new Uint8Array(size);let offset=0;
      for (const chunk of chunks) { bytes.set(chunk,offset);offset+=chunk.byteLength; }
      try { raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
      catch { throw new OpenLibraryFailure('malformed_response'); }
    } finally { await reader.cancel().catch(()=>{}); }
  } catch (error) {
    failure = error instanceof OpenLibraryFailure ? error
      : new OpenLibraryFailure(call.signal.aborted ? 'cancelled' : controller.signal.aborted ? 'timeout' : 'network_failure',!call.signal.aborted);
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
