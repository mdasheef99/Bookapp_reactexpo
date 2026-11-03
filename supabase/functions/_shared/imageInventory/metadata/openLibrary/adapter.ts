import type { MetadataProviderAdapter, MetadataProviderOutcome } from '../providerAdapter';
import type { EditionOptionsProviderResult } from '../contracts';
import { resolveOptionsDeadline } from '../googleBooks/editionOptions';
import { OPEN_LIBRARY_HOST_POLICY } from './normalizer';
import { getOpenLibraryJson, OpenLibraryFailure } from './transport';
import type { OpenLibraryConfiguration, EditionHttpHooks, OpenLibraryRequestPermit } from './transport';
import { ProviderHttpError } from '../providerHttp';
import { fetchOpenLibraryBundle, normalizeOpenLibraryBundle } from './fetch';
import type { OpenLibraryRawGet } from './fetch';
import type { ProviderHttpPort } from '../providerDescriptor';

// Picker §§4/8/13.2: basic bibliographic facts only; no raw payload/prose/image retention.
export class OpenLibraryEditionOptionsAdapter implements MetadataProviderAdapter {
  readonly normalizedEditionHostPolicy=OPEN_LIBRARY_HOST_POLICY;
  readonly optionsRetentionConfigured=true;
  constructor(private readonly configuration:OpenLibraryConfiguration) {}
  // S3 bridge: exposes the constructor-supplied transport (fetcher, timeout,
  // size bound, shared limiter) so a ProviderHttpPort can pace/fence around
  // the SAME primitives. No copy of bootstrap defaults, no global fetch.
  // A getter (not a field): parameter properties initialize after fields.
  get transportBinding(): {
    fetcher: OpenLibraryConfiguration['fetcher'];
    timeoutMs: number;
    maxResponseBytes: number;
    acquireLimiter: (signal: AbortSignal) => Promise<OpenLibraryRequestPermit>;
  } {
    return {
      fetcher: this.configuration.fetcher,
      timeoutMs: this.configuration.timeoutMs,
      maxResponseBytes: this.configuration.maxResponseBytes,
      acquireLimiter: this.configuration.waitForRequest
        ?? (async () => () => {}),
    };
  }
  async lookup():Promise<MetadataProviderOutcome> {
    throw new Error('P9_OPEN_LIBRARY_AUTOMATIC_LOOKUP_FORBIDDEN');
  }
  async lookupEditionOptions(input:Parameters<MetadataProviderAdapter['lookup']>[0] & {
    httpHooks?:EditionHttpHooks;
    // S3 bridge: when a fenced ProviderHttpPort is supplied, every GET goes
    // through it (bounds/trust/limiter-acquire/registration/fence/send/
    // finalization); the legacy transport+hooks path is untouched otherwise.
    // Supplying both is a wiring bug, never silently resolved.
    httpPort?:ProviderHttpPort;
  }):Promise<EditionOptionsProviderResult> {
    const failed=(outcome:EditionOptionsProviderResult['outcome'],retryable=false):EditionOptionsProviderResult=>
      ({outcome,retryable,rows:[],fetchedAt:null,retentionEvidence:null,providerRequestId:null});
    if (input.signal.aborted) return failed('cancelled');
    if (this.configuration.retentionAllowed === false) return failed('policy_denied');
    // Shared allocation engine (fetch.ts); the transport-backed get below
    // preserves the v1 sequence fence, hooks, stages and retention bounding.
    if (input.httpPort !== undefined && input.httpHooks !== undefined) {
      throw new Error('P9_METADATA_PORT_HOOK_CONFLICT');
    }
    const get:OpenLibraryRawGet=async (url,stage,sequence) => {
      if (input.httpPort !== undefined) {
        const response=await input.httpPort.get({url,stage,sequence,signal:input.signal});
        return {raw:response.json,headers:response.headers};
      }
      const envelope=await getOpenLibraryJson(url,this.configuration,
        {sequence,stage,signal:input.signal},input.httpHooks);
      return {raw:envelope.raw,headers:envelope.headers};
    };
    try {
      const bundle=await fetchOpenLibraryBundle({query:input.query,signal:input.signal,get});
      // C1: zero-GET path returns exactly HEAD's failed('no_acceptable_match')
      // packet (fetchedAt null, retentionEvidence null, no catalogueCompanions key).
      if (bundle.kind === 'zero-get') return failed('no_acceptable_match');
      if (bundle.kind === 'no-list') return {outcome:'no_acceptable_match',retryable:false,rows:[],fetchedAt:bundle.fetchedAt,
        retentionEvidence:bundle.retention,providerRequestId:null};
      const summary=normalizeOpenLibraryBundle(bundle,{
        correlationId:input.correlationId,attemptId:input.attemptId,query:input.query});
      return {outcome:summary.outcome,
        rows:summary.rows,catalogueCompanions:summary.companions,fetchedAt:bundle.fetchedAt,
        retentionEvidence:resolveOptionsDeadline(bundle.fetchedAt,bundle.retention)?bundle.retention:null,
        retryable:false,providerRequestId:null};
    } catch(error) {
      if (error instanceof OpenLibraryFailure) return failed(error.outcome,error.retryable);
      // U6 fix1 (F2): port failures escaping the bridge carry the same
      // outcome/retryability as transport failures, so the adapter returns the
      // identical failed packet the direct path would (parity). Persistence/
      // fence failures still belong to the worker.
      if (error instanceof ProviderHttpError) {
        return failed(error.outcome as EditionOptionsProviderResult['outcome'], error.retryable);
      }
      throw error;
    }
  }
}
