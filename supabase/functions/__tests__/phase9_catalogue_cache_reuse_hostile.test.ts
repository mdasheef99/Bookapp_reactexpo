// 02b §§7.1/8.1-8.2/10/11 AC7-7/13/15-17/24/26; M87 is the SQL-port contract.
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { executeEditionOptionsLookup } from '../_shared/imageInventory/runtime/metadataEditionOptions';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { requestFromMetadataContext, SupabaseMetadataProductionGateway }
  from '../_shared/imageInventory/runtime/metadataProductionGateway';
import type { MetadataGatewayConfiguration } from '../_shared/imageInventory/runtime/metadataGatewayContext';
import * as catalogueContract from '../_shared/imageInventory/contracts/catalogueWrite';
import { catalogueCacheWorkerFixture, cacheReuseRpc, cacheVersions } from './fixtures/phase9/catalogueCache';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});
afterEach(() => jest.restoreAllMocks());

type Fixture = ReturnType<typeof catalogueCacheWorkerFixture>;
const recoverRpc = 'phase9_recover_candidate_edition_options_v1';
const lookupRpc = 'phase9_register_structural_metadata_lookup';
const reserveRpc = 'phase9_reserve_metadata_usage';
const completeRpc = 'phase9_complete_candidate_edition_options_v2';
const named = (f: Fixture, name: string) => f.calls.filter(call => call.name === name);
const phases = (f: Fixture) => f.calls.map(call => call.name)
  .filter(name => [recoverRpc, cacheReuseRpc, lookupRpc, reserveRpc].includes(name));
const miss = () => ({ data: { status: 'miss' }, error: null });
const hit = (p: Record<string, any>) => ({ status: 'completed', requestId: p.p_request_id,
  requestGeneration: p.p_request_generation, optionsVersion: 1, optionsExpiresAt: '2099-01-01T00:00:00Z' });

function expectNoProviderWork(f: Fixture) {
  // One comparison reports all forbidden calls and both providers' GET counts together.
  const counts = Object.fromEntries([lookupRpc, reserveRpc, completeRpc,
    'phase9_register_structural_metadata_attempt', 'phase9_register_edition_options_provider_call_v1',
    'phase9_register_metadata_provider_call'].map(name => [name, named(f, name).length]));
  expect({ counts, urls: f.urls, googleGets: f.base.stats().providerRequests }).toEqual({
    counts: Object.fromEntries(Object.keys(counts).map(name => [name, 0])), urls: [], googleGets: 0,
  });
}

function direct(f: Fixture, changes: Partial<MetadataGatewayConfiguration> = {},
  signal = new AbortController().signal) {
  const context = decodeMetadataJobContext(f.base.current());
  const request = { ...requestFromMetadataContext(context), claimWorker: f.dependencies.workerId };
  const configuration: MetadataGatewayConfiguration = {
    worker: f.dependencies.workerId, context, primary: f.adapter,
    adapterKey: cacheVersions.adapterKey, adapterVersion: cacheVersions.adapterVersion,
    capabilityVersion: cacheVersions.capabilityVersion, normalizerVersion: cacheVersions.normalizerVersion,
    schemaVersion: cacheVersions.schemaVersion, routingPolicyVersion: cacheVersions.routingPolicyVersion,
    cachePolicyVersion: cacheVersions.cachePolicyVersion, lookupContractVersion: 'p9-metadata-lookup-v1',
    selectionPolicyVersion: 'p9-metadata-selection-v1', snapshotVersion: 'p9-selected-metadata-v1',
    cacheNamespace: 'metadata-v1', pricingPolicyVersion: 'metadata-zero-cost-v1', revalidationSeconds: 86400,
    editionOptions: { request, boundary: f.dependencies.editionOptionsBoundary }, ...changes,
  };
  const gateway = new SupabaseMetadataProductionGateway({ rpc: f.rpc }, configuration);
  return () => executeEditionOptionsLookup(context, gateway, f.adapter, signal);
}

function expectProviderMiss(f: Fixture) {
  expect(named(f, cacheReuseRpc)).toHaveLength(1);
  expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc, lookupRpc, reserveRpc]);
  expect(named(f, lookupRpc)).toHaveLength(1);
  expect(named(f, reserveRpc)).toHaveLength(1);
  expect(named(f, completeRpc)).toHaveLength(1);
  expect(f.urls).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
  expect(f.base.stats().providerRequests).toBe(0);
}

test.each(['returned', 'thrown'] as const)('#1: %s reuse error without commit recovers missing and stops', async kind => {
  const f = catalogueCacheWorkerFixture('miss', { reuse: () => {
    if (kind === 'thrown') throw new Error('recorded transport rejection before commit');
    return { data: null, error: { message: 'recorded RPC failure before commit' } };
  } });
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc, recoverRpc]);
  expect(f.durableReceipt()).toBeNull();
  expect(named(f, 'phase9_fail_candidate_edition_options_v1')).toHaveLength(0);
  expectNoProviderWork(f);
});

test.each(['returned', 'thrown'] as const)('#1: %s recovery error after uncommitted reuse stays recovery-only', async kind => {
  let recoveries = 0;
  const f = catalogueCacheWorkerFixture('miss', {
    reuse: () => ({ data: null, error: { message: 'recorded reuse failure without commit' } }),
    recover: () => {
      if (++recoveries === 1) return { data: { status: 'missing' }, error: null };
      if (kind === 'thrown') throw new Error('recorded recovery transport rejection');
      return { data: null, error: { message: 'recorded recovery outage' } };
    },
  });
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc, recoverRpc]);
  expect(f.durableReceipt()).toBeNull();
  expect(named(f, 'phase9_fail_candidate_edition_options_v1')).toHaveLength(0);
  expectNoProviderWork(f);
});

const malformed = [
  ['null', () => null], ['string', () => 'miss'], ['unknown status', () => ({ status: 'unknown' })],
  ['miss with extra key', () => ({ status: 'miss', extra: 1 })],
  ['wrong requestId', (p: Record<string, any>) => ({ ...hit(p), requestId: 'another-request' })],
  ['wrong requestGeneration', (p: Record<string, any>) => ({ ...hit(p), requestGeneration: 99 })],
  ['fractional optionsVersion', (p: Record<string, any>) => ({ ...hit(p), optionsVersion: 1.5 })],
  ['unparsable optionsExpiresAt', (p: Record<string, any>) => ({ ...hit(p), optionsExpiresAt: 'not-a-date' })],
] as const;
test.each(malformed)('#2: %s cannot authorize provider egress', async (_label, data) => {
  const f = catalogueCacheWorkerFixture('miss', { reuse: p => ({ data: data(p), error: null }) });
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc, recoverRpc]);
  expect(named(f, 'phase9_fail_candidate_edition_options_v1')).toHaveLength(0);
  expectNoProviderWork(f);
});

test('#3: expired hit returns manual_metadata_required without a provider fallback', async () => {
  // metadataEditionOptions completionResult: Date.parse(completion.optionsExpiresAt) > Date.now()
  // ? { outcome: 'edition_options_available' } : { outcome: 'manual_metadata_required' }.
  const f = catalogueCacheWorkerFixture('miss', { reuse: p => ({
    data: { ...hit(p), optionsExpiresAt: '2000-01-01T00:00:00Z' }, error: null,
  }) });
  expect((await f.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc]);
  expect(named(f, 'phase9_fail_candidate_edition_options_v1')).toHaveLength(0);
  expectNoProviderWork(f);
});

test.each(['lease token', 'request generation'] as const)(
  '#4: M87 miss after lost %s reaches one SQL-rejected lookup and resolves stale_claim', async changed => {
    // 02b §§7.1/8.2: M87 returns miss; the inherited M73/M67/M15 lookup fence raises
    // P9_STATE_CONFLICT. SQL rejection and subsequent stale recovery are modelled, not proven.
    const f = catalogueCacheWorkerFixture('miss', {
      reuse: () => {
        if (changed === 'lease token') f.base.current().claimToken = 'e'.repeat(64);
        else f.base.current().requestGeneration = 1;
        return miss();
      },
      recover: p => ({ data: { status: p.p_lease_token === f.base.current().claimToken
        && p.p_request_generation === f.base.current().requestGeneration ? 'missing' : 'stale_rejected' }, error: null }),
    });
    jest.spyOn(f.dependencies.serviceClient, 'rpc').mockImplementation(async (name, parameters) => {
      if (name !== lookupRpc) return f.rpc(name, parameters);
      f.calls.push({ name, parameters });
      return { data: null, error: { message: 'P9_STATE_CONFLICT' } };
    });
    expect((await f.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(named(f, cacheReuseRpc)).toHaveLength(1);
    expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc, lookupRpc, recoverRpc]);
    expect(named(f, lookupRpc)).toHaveLength(1);
    for (const name of [reserveRpc, completeRpc, 'phase9_register_structural_metadata_attempt',
      'phase9_register_edition_options_provider_call_v1', 'phase9_register_metadata_provider_call',
      'phase9_fail_candidate_edition_options_v1']) expect(named(f, name)).toHaveLength(0);
    expect(f.urls).toEqual([]);
    expect(f.base.stats().providerRequests).toBe(0);
    expect(f.durableReceipt()).toBeNull();
  },
);

const versionDrift = Object.keys(cacheVersions) as Array<keyof typeof cacheVersions>;
test.each(versionDrift)('#5: changed %s reaches the RPC in exactly the nine-key tuple', async field => {
  const value = field === 'adapterKey' ? 'google_books'
    : field === 'reusePolicyVersion' ? '7' : cacheVersions[field] + '-next';
  let restoreCompanion: (() => void) | undefined;
  const f = catalogueCacheWorkerFixture('miss', { reuse: () => {
    // Companion version is a binary contract constant, not a runtime configuration field.
    // Restore it before provider normalization to keep existing v1 companion fixtures unchanged.
    restoreCompanion?.();
    return miss();
  } });
  const changes: Partial<MetadataGatewayConfiguration> = {};
  if (field === 'reusePolicyVersion') {
    const policies = f.base.current().providerPolicies as Array<Record<string, unknown>>;
    policies.find(p => p.adapterKey === 'open_library')!.policyVersion = 7;
  } else if (field === 'companionVersion') {
    restoreCompanion = jest.replaceProperty(catalogueContract, 'CATALOGUE_WRITE_VERSION',
      value as typeof catalogueContract.CATALOGUE_WRITE_VERSION).restore;
  } else Object.assign(changes, { [field]: value });
  try {
    expect(await direct(f, changes)()).toEqual({ outcome: 'edition_options_available' });
    const versions = named(f, cacheReuseRpc)[0].parameters.p_cache_versions;
    expect(Object.keys(versions).sort()).toEqual(Object.keys(cacheVersions).sort());
    expect(versions).toEqual({ ...cacheVersions, [field]: value });
    // Only the fixture's strict {status:'miss'} authorizes this existing provider path.
    expectProviderMiss(f);
  } finally { restoreCompanion?.(); }
});

test.each(['open_library', 'google_books'] as const)(
  '#6: %s primary uses its own registry policyVersion, not the first/other row', async primary => {
    const f = catalogueCacheWorkerFixture('hit');
    const policies = f.base.current().providerPolicies as Array<Record<string, unknown>>;
    f.base.current().providerPolicies = policies.map(policy => ({ ...policy,
      policyVersion: policy.adapterKey === 'google_books' ? 17 : 73,
    }));
    const dependencies = { ...f.dependencies, primary: primary === 'google_books' ? f.base.adapter : null };
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'edition_options_available' }]);
    expect(named(f, cacheReuseRpc)).toHaveLength(1);
    expect(named(f, cacheReuseRpc)[0].parameters.p_cache_versions).toEqual({ ...cacheVersions,
      adapterKey: primary, capabilityVersion: primary === 'google_books'
        ? 'google-books-capability-v1' : cacheVersions.capabilityVersion,
      reusePolicyVersion: primary === 'google_books' ? '17' : '73',
    });
    // M87 L245-247 reads source_policy(p_cache_versions->>'adapterKey') and compares policyVersion.
    expectNoProviderWork(f);
  },
);

test('#7: cancellation inside reuse stops before lookup/reservation and resolves cancelled', async () => {
  const abort = new AbortController();
  const f = catalogueCacheWorkerFixture('miss', { reuse: () => { abort.abort(); return miss(); } });
  expect(await direct(f, {}, abort.signal)()).toEqual({ outcome: 'manual_metadata_required' });
  expect(abort.signal.aborted).toBe(true);
  expect(named(f, cacheReuseRpc)).toHaveLength(1);
  expect(named(f, 'phase9_fail_candidate_edition_options_v1').map(call => call.parameters))
    .toEqual([expect.objectContaining({ p_failure_kind: 'cancelled', p_retryable: false })]);
  expectNoProviderWork(f);
});

test.each(['legacy fake boundary', 'production RPC boundary'] as const)(
  '#8: %s calls reuse exactly once for one claim', async boundary => {
    const f = catalogueCacheWorkerFixture('hit');
    const fake = { ...f.base.boundary, reuseCache: jest.fn(f.dependencies.editionOptionsBoundary.reuseCache) };
    const selected = boundary === 'legacy fake boundary' ? fake : f.dependencies.editionOptionsBoundary;
    expect((await runMetadataWorkerBatch(1, { ...f.dependencies, editionOptionsBoundary: selected })).results)
      .toEqual([{ outcome: 'edition_options_available' }]);
    expect(named(f, 'claim_phase9_metadata_jobs')).toHaveLength(1);
    expect(named(f, cacheReuseRpc)).toHaveLength(1);
    if (selected === fake) expect(fake.reuseCache).toHaveBeenCalledTimes(1);
    else expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc]);
    expectNoProviderWork(f);
  },
);

test('#9: Google primary reuses its tuple once before GETs and Open Library fallback', async () => {
  const f = catalogueCacheWorkerFixture('miss');
  f.base.controls.payload = { kind: 'books#volumes', totalItems: 0, items: [] };
  f.base.controls.beforeFetch = async () => { expect(named(f, cacheReuseRpc)).toHaveLength(1); };
  expect((await runMetadataWorkerBatch(1, { ...f.dependencies, primary: f.base.adapter })).results)
    .toEqual([{ outcome: 'edition_options_available' }]);
  expect(named(f, cacheReuseRpc)).toHaveLength(1);
  expect(named(f, cacheReuseRpc)[0].parameters.p_cache_versions).toEqual({ ...cacheVersions,
    adapterKey: 'google_books', capabilityVersion: 'google-books-capability-v1',
  });
  expect(phases(f)).toEqual([recoverRpc, cacheReuseRpc, lookupRpc, reserveRpc]);
  expect(named(f, 'phase9_register_structural_metadata_attempt').map(call => call.parameters.p_provider_role))
    .toEqual(['primary', 'secondary']);
  expect(named(f, 'phase9_finish_edition_primary_for_fallback_v1')).toHaveLength(1);
  expect(named(f, reserveRpc)).toHaveLength(1);
  expect(named(f, completeRpc)).toHaveLength(1);
  expect(f.base.stats().providerRequests).toBe(1);
  expect(f.urls).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
});
