import type { MetadataProviderAdapter, MetadataProviderOutcome } from '../providerAdapter';
import type { EditionOptionsProviderResult } from '../contracts';
import { resolveOptionsDeadline } from '../googleBooks/editionOptions';
import { OPEN_LIBRARY_HOST_POLICY } from './normalizer';
import { getOpenLibraryJson, OpenLibraryFailure } from './transport';
import type { OpenLibraryConfiguration, EditionHttpHooks } from './transport';
import { fetchOpenLibraryBundle, normalizeOpenLibraryBundle } from './fetch';
import type { OpenLibraryRawGet } from './fetch';

// Picker §§4/8/13.2: basic bibliographic facts only; no raw payload/prose/image retention.
export class OpenLibraryEditionOptionsAdapter implements MetadataProviderAdapter {
  readonly normalizedEditionHostPolicy=OPEN_LIBRARY_HOST_POLICY;
  readonly optionsRetentionConfigured=true;
  constructor(private readonly configuration:OpenLibraryConfiguration) {}
  async lookup():Promise<MetadataProviderOutcome> {
    throw new Error('P9_OPEN_LIBRARY_AUTOMATIC_LOOKUP_FORBIDDEN');
  }
  async lookupEditionOptions(input:Parameters<MetadataProviderAdapter['lookup']>[0] & {
    httpHooks?:EditionHttpHooks;
  }):Promise<EditionOptionsProviderResult> {
    const failed=(outcome:EditionOptionsProviderResult['outcome'],retryable=false):EditionOptionsProviderResult=>
      ({outcome,retryable,rows:[],fetchedAt:null,retentionEvidence:null,providerRequestId:null});
    if (input.signal.aborted) return failed('cancelled');
    if (this.configuration.retentionAllowed === false) return failed('policy_denied');
    // Shared allocation engine (fetch.ts); the transport-backed get below
    // preserves the v1 sequence fence, hooks, stages and retention bounding.
    const get:OpenLibraryRawGet=async (url,stage,sequence) => {
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
      if (!(error instanceof OpenLibraryFailure)) throw error; // Persistence/fence failures belong to the worker.
      return failed(error.outcome,error.retryable);
    }
  }
}
