import { OpenLibraryEditionOptionsAdapter } from '../../../_shared/imageInventory/metadata/openLibrary';
import { createMetadataEditionOptionsBoundary } from '../../../_shared/imageInventory/runtime/metadataEditionOptionsRpc';
import { runMetadataWorkerBatch } from '../../../../../workers/phase9-metadata-worker';
import { editionWorkerFixture } from './editionOptionsWorker';
import { catalogueWriteRecording } from './catalogueWrite';

// 02b §§5/8: deterministic SQL-port receipts and recorded HTTP, never a cache implementation.
export const cacheReuseRpc = 'phase9_reuse_candidate_edition_cache_v1';
export const cacheVersions = {
  adapterKey: 'open_library', adapterVersion: '1.0.0',
  capabilityVersion: 'open-library-capability-v1',
  normalizerVersion: 'p9-bibliographic-normalizer-v1', schemaVersion: 'p9-metadata-foundation-v1',
  routingPolicyVersion: 'p9-metadata-routing-v1', cachePolicyVersion: 'p9-metadata-cache-v1',
  reusePolicyVersion: '1', companionVersion: 'psr-catalogue-write-v1',
};
export const scopeOrigins = [
  'scan', 'provider-facts-only', 'typed', 'edited', 'confirmed', 'equal-looking-confirmed', 'unknown',
].map(origin => ({ origin, title: 'The Fixture Book', authors: ['Fixture Author'] }));
export const cacheRecording = {
  version: 'psr-edition-cache-v1', sourceFetchedAt: '2026-10-28T10:00:00.000Z',
  rows: [{ ordinal: 0, eligibility: 'eligible', googleBooksUrl: 'https://openlibrary.org/books/OL100M',
    providerRecordId: 'OL100M', metadata: {
      contractVersion: 'p9-contract-v1', schemaVersion: 'p9-metadata-v1',
      adapterKey: 'open_library', adapterVersion: '1.0.0', normalizerVersion: 'p9-bibliographic-normalizer-v1',
      providerRecordId: 'OL100M', fetchedAt: '2026-10-28T10:00:00.000Z', title: 'The Fixture Book',
      subtitle: null, authors: ['Fixture Author'], description: null, isbn10: null, isbn13: null,
      publisher: 'Fixture Press', publishedDate: '2024', language: 'en', script: null,
      editionStatement: null, series: null, volume: null, format: null, pageCount: null,
      categories: [], coverReference: 'https://covers.openlibrary.org/b/id/123-M.jpg',
    }, companion: { version: 'psr-catalogue-write-v1', workExternalId: 'OL1W', oclc: '001234', lccn: 'n 79021164' } },
  { ordinal: 1, eligibility: 'unavailable', googleBooksUrl: null, providerRecordId: null,
    metadata: null, companion: null }],
};

type Call = { name: string; parameters: Record<string, any> };
type Receipt = { status: string; requestId: unknown; requestGeneration: unknown;
  optionsVersion: number; optionsExpiresAt: string };
type Reply = { data: unknown; error: unknown };
type Responses = {
  reuse?: (parameters: Record<string, any>) => Reply | Promise<Reply>;
  recover?: (parameters: Record<string, any>) => Reply | Promise<Reply>;
};
export function catalogueCacheWorkerFixture(
  mode: 'miss' | 'hit' | 'response_lost' = 'miss', responses: Responses = {},
) {
  const base = editionWorkerFixture();
  base.current().providerPolicies = [...base.current().providerPolicies as unknown[], {
    adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
    matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
  }];
  const calls: Call[] = [], urls: string[] = [];
  let durable: Receipt | null = null, physicalId = 0, loseResponse = mode === 'response_lost';
  const receipt = (parameters: Record<string, any>): Receipt => ({
    status: 'completed', requestId: parameters.p_request_id,
    requestGeneration: parameters.p_request_generation,
    optionsVersion: 1, optionsExpiresAt: '2099-01-01T00:00:00.000Z',
  });
  const rpc = async (name: string, parameters: Record<string, any>) => {
    calls.push({ name, parameters });
    if (name === 'phase9_recover_candidate_edition_options_v1') {
      if (responses.recover) return responses.recover(parameters);
      return { data: durable ? { ...durable, status: 'replayed' } : { status: 'missing' }, error: null };
    }
    if (name === cacheReuseRpc) {
      if (responses.reuse) return responses.reuse(parameters);
      if (mode === 'miss') return { data: { status: 'miss' }, error: null };
      durable = receipt(parameters);
      if (loseResponse) {
        loseResponse = false;
        return { data: null, error: { message: 'recorded response lost after cache transaction commit' } };
      }
      return { data: durable, error: null };
    }
    if (name === 'phase9_register_structural_metadata_lookup')
      return { data: { lookup_id: '00000000-0000-4000-8000-000000000101' }, error: null };
    if (name === 'phase9_register_structural_metadata_attempt')
      return { data: { attempt_id: '00000000-0000-4000-8000-000000000102' }, error: null };
    if (name === 'phase9_register_edition_options_provider_call_v1')
      return { data: { provider_call_id: 'recorded-' + ++physicalId, status: 'registered' }, error: null };
    if (name === 'phase9_finalize_edition_options_provider_call_v1')
      return { data: { status: 'finalized' }, error: null };
    if (name === 'phase9_finish_edition_primary_for_fallback_v1')
      return { data: { status: 'finished' }, error: null };
    if (name === 'phase9_complete_candidate_edition_options_v2') {
      durable = receipt(parameters);
      return { data: durable, error: null };
    }
    if (name === 'phase9_fail_candidate_edition_options_v1')
      return { data: { status: 'resolved' }, error: null };
    return base.dependencies.serviceClient.rpc(name, parameters);
  };
  const adapter = new OpenLibraryEditionOptionsAdapter({ timeoutMs: 1000, maxResponseBytes: 64000,
    fetcher: async address => {
      const path = new URL(String(address)).pathname;
      urls.push(path);
      const body = path === '/search.json' ? catalogueWriteRecording.search
        : path === '/works/OL1W/editions.json' ? catalogueWriteRecording.editions
        : path === '/authors/OL1A.json' ? catalogueWriteRecording.author : null;
      return new Response(JSON.stringify(body), { status: body ? 200 : 404,
        headers: { 'content-type': 'application/json' } });
    } });
  const dependencies = { ...base.dependencies, primary: null, serviceClient: { rpc }, editionFallback: adapter,
    editionOptionsBoundary: createMetadataEditionOptionsBoundary({ rpc }) };
  return { base, calls, urls, rpc, adapter, dependencies, durableReceipt: () => durable,
    run: () => runMetadataWorkerBatch(1, dependencies) };
}
