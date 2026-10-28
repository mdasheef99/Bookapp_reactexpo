// 02b §§8.1-8.2/11 AC7-7/15/21/26: fixed contracts; SQL owns immutable scan-origin proof.
import fs from 'node:fs';
import path from 'node:path';
import { createMetadataCacheEntry, evaluateMetadataCache } from '../_shared/imageInventory/metadata/cache';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { projectStoredEditionRow } from '../_shared/imageInventory/contracts/ownerEditionPicker';
import { parseNormalizedMetadataEdition } from '../_shared/imageInventory/contracts/metadata';
import { OPEN_LIBRARY_HOST_POLICY } from '../_shared/imageInventory/metadata/openLibrary/normalizer';
import { cacheRecording, scopeOrigins, catalogueCacheWorkerFixture, cacheReuseRpc, cacheVersions }
  from './fixtures/phase9/catalogueCache';
import { automaticContext, editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';

test('[baseline] fixture sanity: typed bibliographic recording has ordered nullable rows and no private envelope', () => {
  const payload = JSON.parse(JSON.stringify(cacheRecording));
  expect(Object.keys(payload).sort()).toEqual(['rows', 'sourceFetchedAt', 'version']);
  expect(payload.version).toBe('psr-edition-cache-v1');
  expect(payload.rows.map((row: any) => row.ordinal)).toEqual([0, 1]);
  expect(Object.keys(payload.rows[0]).sort()).toEqual(['ordinal', 'eligibility', 'googleBooksUrl',
    'providerRecordId', 'metadata', 'companion'].sort());
  expect(Object.keys(payload.rows[0].companion).sort()).toEqual(['version', 'workExternalId', 'oclc', 'lccn'].sort());
  expect(payload.rows[1]).toEqual({ ordinal: 1, eligibility: 'unavailable', googleBooksUrl: null,
    providerRecordId: null, metadata: null, companion: null });
  expect(JSON.stringify(payload)).not.toMatch(/correlationId|attemptId|optionId|canonicalId|storeId|candidateId|lookupId|requestId|owner|rawResponse|matchRationale|confidence/u);
  expect(parseNormalizedMetadataEdition({ ...payload.rows[0].metadata,
    correlationId: 'receiving-lookup', attemptId: 'receiving-attempt',
    matchRationale: 'confirmation_required_text_evidence', confidence: 0 }, OPEN_LIBRARY_HOST_POLICY))
    .toMatchObject({ providerRecordId: 'OL100M', title: 'The Fixture Book' });
  expect(scopeOrigins.map(row => row.origin)).toEqual(['scan', 'provider-facts-only', 'typed',
    'edited', 'confirmed', 'equal-looking-confirmed', 'unknown']);
  const identities = scopeOrigins.map(row => buildMetadataQueryIdentity({ ...row,
    strategy: 'bibliographic', isbnClue: null, language: 'en', editionClues: [] }).key);
  expect(new Set(identities).size).toBe(1);
});

test('AC7-15/24/26: scope authority stays server-side and reuse carries exactly the current nine-version tuple', async () => {
  const f = catalogueCacheWorkerFixture('hit');
  await f.run();
  const reuse = f.calls.filter(call => call.name === cacheReuseRpc);
  expect(reuse).toHaveLength(1);
  expect(Object.keys(reuse[0].parameters).sort()).toEqual(['p_job_id', 'p_worker', 'p_lease_token',
    'p_attempt_count', 'p_candidate_id', 'p_store_id', 'p_session_id', 'p_request_id',
    'p_request_generation', 'p_query_identity', 'p_cache_versions'].sort());
  expect(reuse[0].parameters).toMatchObject({ p_job_id: 'job-1', p_candidate_id: 'candidate-1',
    p_store_id: 'store-1', p_session_id: 'session-1', p_attempt_count: 1,
    p_request_generation: 0, p_query_identity: f.base.current().queryIdentity });
  expect(reuse[0].parameters.p_cache_versions).toEqual(cacheVersions);
  expect(JSON.stringify(reuse[0].parameters.p_cache_versions)).not.toMatch(/owner|scope|raw|candidate|store|attempt|request/iu);
});

test('[baseline] legacy cache reader and writer preserve positive, negative and ambiguous selected-snapshot rules', () => {
  const base = { key: 'legacy-key', queryKey: 'legacy-query', adapterKey: 'google_books',
    adapterVersion: '1.0.0', capabilityVersion: 'cap-v1', normalizerVersion: 'normalizer-v1',
    schemaVersion: 'schema-v1', cachePolicyVersion: 'cache-v1', reusePolicyVersion: '1',
    privacyScope: 'store_private' as const, storeId: 'store-A', provenance: { attemptId: 'attempt-A' },
    createdAt: '2026-10-28T10:00:00Z', expiresAt: '2026-10-28T11:00:00Z', invalidatedAt: null };
  for (const outcome of ['positive', 'negative', 'ambiguous'] as const) {
    const entry = createMetadataCacheEntry({ ...base, outcome,
      normalizedSnapshot: outcome === 'positive' ? { title: 'legacy selected winner' } : null });
    expect(evaluateMetadataCache(entry, '2026-10-28T10:30:00Z', entry)).toEqual({ status: 'hit', outcome, entry });
    expect(evaluateMetadataCache(entry, '2026-10-28T10:30:00Z', { ...entry, storeId: 'store-B' }).status)
      .toBe('incompatible');
  }
  expect(() => createMetadataCacheEntry({ ...base, outcome: 'positive', normalizedSnapshot: null })).toThrow();
  expect(() => createMetadataCacheEntry({ ...base, outcome: 'negative', normalizedSnapshot: { title: 'forbidden' } })).toThrow();
});

test('[baseline] query identity preserves original author order rather than catalogue sorting', () => {
  const input = { strategy: 'bibliographic' as const, title: 'The Fixture Book', isbnClue: null,
    language: 'en', editionClues: [], authors: ['Zulu Writer', 'Alpha Writer'] };
  const first = buildMetadataQueryIdentity(input);
  const reversed = buildMetadataQueryIdentity({ ...input, authors: [...input.authors].reverse() });
  expect(first.normalizedAuthors).toEqual(['zulu writer', 'alpha writer']);
  expect(first.key).not.toBe(reversed.key);
});

test('[baseline] generic cache and query modules are visible and contain no provider-specific imports or branches', () => {
  const directory = path.resolve(__dirname, '../_shared/imageInventory/metadata');
  const cache = fs.readFileSync(path.join(directory, 'cache.ts'), 'utf8');
  const identity = fs.readFileSync(path.join(directory, 'queryIdentity.ts'), 'utf8');
  expect(cache).toContain('evaluateMetadataCache');
  expect(identity).toContain('buildProviderCacheIdentity');
  expect(cache + identity).not.toMatch(/open_library|openLibrary/u);
});

test('[baseline] automatic local Google route remains independent of explicit shared-cache reuse', async () => {
  const f = editionWorkerFixture();
  Object.keys(f.current()).forEach(key => { delete f.current()[key]; });
  Object.assign(f.current(), automaticContext, { localCanonicalEditionId: 'local-winner' });
  expect((await f.run()).results).toEqual([{ outcome: 'local_canonical_match' }]);
  expect(f.stats().providerRequests).toBe(0);
  expect(f.calls.some(call => call.name === 'phase9_reuse_candidate_edition_cache_v1')).toBe(false);
});

test('[baseline] cache envelope fields never enter the existing app edition DTO', () => {
  const row = cacheRecording.rows[0];
  const projected = projectStoredEditionRow({ ...row,
    optionId: '00000000-0000-4000-8000-000000000001',
    metadata: { ...row.metadata!, correlationId: 'receiving-lookup', attemptId: 'receiving-attempt',
      matchRationale: 'confirmation_required_text_evidence', confidence: 0 },
  } as any);
  expect(Object.keys(projected).sort()).toEqual(['eligibility', 'googleBooksUrl', 'metadata', 'optionId', 'ordinal']);
  expect(projected.metadata).toMatchObject({ title: 'The Fixture Book', authors: ['Fixture Author'] });
  expect(JSON.stringify(projected)).not.toMatch(/companion|correlationId|attemptId|workExternalId|cacheScope|payloadKind|payloadDigest/u);
});
