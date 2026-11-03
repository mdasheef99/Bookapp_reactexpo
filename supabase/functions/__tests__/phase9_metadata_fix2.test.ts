// U6 fix pass 2 (NEW file): G5 (verbatim secondary config), G8 (native v2
// transport outcome identity), and H3/H6 worker-level proofs.
import { executeDescriptorEditionOptions } from '../_shared/imageInventory/runtime/metadataEditionOptions';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { invokeOpenLibraryV2 } from '../_shared/imageInventory/metadata/openLibrary/automatic';
import { createBridgedPort } from '../_shared/imageInventory/runtime/metadataEditionOptions';
import { createProviderHttpPort, ProviderHttpError } from '../_shared/imageInventory/metadata/providerHttp';
import { createProtectionState } from '../_shared/imageInventory/runtime/providerProtection';
import { buildMetadataQueryIdentity, buildProviderCacheIdentity }
  from '../_shared/imageInventory/metadata/queryIdentity';
import { TEST_ONLY_PROTECTION_POLICY as policy } from './support/providerProtection';
import { installedManifest } from './support/providerModules';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { createInstalledDescriptorManifest } from '../../../workers/phase9-metadata-worker/bootstrap';
import { GOOGLE_BOOKS_CAPABILITY } from '../_shared/imageInventory/metadata/googleBooks';

const query = buildMetadataQueryIdentity({
  strategy: 'bibliographic', title: 'The Fixture Book', authors: ['Fixture Author'],
  isbnClue: null, language: 'en', editionClues: [],
});
const OL_POLICY = {
  adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};
const GOOGLE_POLICY = {
  adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};
const editionEntry = {
  key: '/books/OL100M', title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
  languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'], covers: [123],
};
function olAdapter(urls: string[]) {
  return new OpenLibraryEditionOptionsAdapter({
    timeoutMs: 1000, maxResponseBytes: 64000,
    fetcher: async (address) => {
      const url = new URL(String(address)); urls.push(url.pathname);
      const raw = url.pathname === '/search.json' ? { docs: [{ key: '/works/OL1W' }] }
        : url.pathname.endsWith('/editions.json') ? { entries: [editionEntry] }
        : { key: '/authors/OL1A', name: 'Fixture Author' };
      return new Response(JSON.stringify(raw), {
        headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } });
    },
  });
}

describe('Phase 9 fix2 G5: secondary protection config is used verbatim', () => {
  const runFallback = async (secondaryPolicy: unknown) => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [GOOGLE_POLICY, OL_POLICY];
    fixture.controls.status = 503;
    const urls: string[] = [];
    const library = olAdapter(urls);
    const olDescriptor = installedManifest().get('open_library@1.0.0') as {
      capabilityVersion: string; normalizerVersion: string; lookupSchemaVersion: string;
    };
    const googleDescriptor = {
      adapterKey: 'google_books', adapterVersion: '1.0.0',
      capabilityVersion: 'google-books-capability-v1',
      protocol: { kind: 'single' as const, maxGets: 1 as const },
    };
    const secondaryState = createProtectionState();
    secondaryState.breakerOpenedAtMs = Date.now();
    const { context, gateway } = fixture.direct({
      explicitDescriptor: {
        descriptor: googleDescriptor,
        adapter: fixture.adapter,
        fallbackAdapter: library,
        fallbackRoute: {
          adapterKey: 'open_library', adapterVersion: '1.0.0',
          capabilityVersion: olDescriptor.capabilityVersion,
          normalizerVersion: olDescriptor.normalizerVersion,
          lookupSchemaVersion: olDescriptor.lookupSchemaVersion,
        },
        fallbackDescriptor: olDescriptor,
        fallbackExplicitHttp: {
          policy: secondaryPolicy,
          requestHosts: ['openlibrary.org'],
          sharedProtection: secondaryState,
          timeoutMs: 1000, maxResponseBytes: 64000,
          fetcher: library.transportBinding.fetcher,
          retentionPolicyVersion: 1,
          rowHostPolicy: library.normalizedEditionHostPolicy,
        },
      },
      explicitHttp: {
        policy, requestHosts: ['www.googleapis.com'],
        timeoutMs: 1000, maxResponseBytes: 64000, retentionPolicyVersion: 1,
      },
    });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_finish_edition_primary_for_fallback_v1') {
        return { data: { status: 'completed' }, error: null };
      }
      return baseRpc(name, parameters);
    };
    try {
      const result = await executeDescriptorEditionOptions(context, gateway, {
        descriptor: googleDescriptor as never,
        adapter: fixture.adapter,
        fallbackAdapter: library,
      }, new AbortController().signal);
      return { result, urls, fixture };
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  };

  it('proceeds when the secondary policy is explicitly null even with an open secondary state', async () => {
    // Mutation caught: secondaryHttp.policy ?? http.policy inheriting the
    // primary policy and consulting the already-open secondary breaker.
    const { result, urls } = await runFallback(null);
    expect(result).toEqual({ outcome: 'edition_options_available' });
    expect(urls).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
  });

  it('refuses with the same open secondary state when its policy is non-null (control)', async () => {
    const { result, urls } = await runFallback(policy);
    expect(result).toEqual({ outcome: 'manual_metadata_required' });
    expect(urls).toEqual([]);
  });
});

describe('Phase 9 fix2 G8: native v2 transport outcomes keep identity', () => {
  it('maps a v2 timeout ProviderHttpError to timeout/retryable', async () => {
    // Mutation caught: only OpenLibraryFailure is caught; ProviderHttpError
    // escapes to the executor and becomes retryable provider_unavailable.
    const result = await invokeOpenLibraryV2({
      query, correlationId: 'g8-lookup', attemptId: 'g8-attempt',
      signal: new AbortController().signal, purpose: 'edition_options',
      http: { get: async () => {
        throw new ProviderHttpError('timeout', true, 'outcome_unknown', true, null, null);
      } } as never,
      version: 'p9-metadata-result-v2', policyVersion: 1,
      retentionContract: 'open-library-options-v1',
    });
    expect(result.outcome).toMatchObject({
      outcome: 'timeout', retryable: true, secondaryEligible: true,
    });
    expect(result.rows).toBeNull();
    expect(result.retention).toBeNull();
  });

  it('preserves a v2 429 Retry-After observation and rate_limited identity', async () => {
    const observed: Array<number | null> = [];
    const port = createProviderHttpPort({
      adapterKey: 'open_library', adapterVersion: '2.0.0', policy: null, maxGets: 6,
      timeoutMs: 1000, maxResponseBytes: 64000, now: () => 0,
      fetcher: async () => new Response('', { status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '120' } }),
      lookupId: 'g8-lookup', attemptId: 'g8-attempt',
      claim: { jobId: '00000000-0000-4000-8000-000000000001', worker: 'w',
        leaseToken: 'a'.repeat(64), claimAttempt: 1 },
      beforeRequest: async () => ({ callId: '00000000-0000-4000-8000-000000000002', grantEpoch: null }),
      afterRequest: async (callId: string) => ({ receiptId: callId }),
    });
    const wrapped = { get: async (input: Parameters<typeof port.get>[0]) => {
      try { return await port.get(input); } catch (error) {
        if (error instanceof ProviderHttpError) observed.push(error.retryAfterMs);
        throw error;
      }
    } };
    const result = await invokeOpenLibraryV2({
      query, correlationId: 'g8-lookup', attemptId: 'g8-attempt',
      signal: new AbortController().signal, purpose: 'edition_options',
      http: wrapped as never, version: 'p9-metadata-result-v2', policyVersion: 1,
      retentionContract: 'open-library-options-v1',
    });
    expect(observed).toEqual([120000]);
    expect(result.outcome).toMatchObject({
      outcome: 'rate_limited', retryable: true, secondaryEligible: true,
    });
  });

  it('v1 bridge gives the same outcome/retryability for 429 and timeout (control)', async () => {
    const bridge = (fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
      createBridgedPort({
        adapterKey: 'open_library', adapterVersion: '1.0.0',
        binding: { fetcher, timeoutMs: 20, maxResponseBytes: 64000,
          acquireLimiter: async () => () => {} },
        maxGets: 6, policy: null, lookupId: 'g8-lookup', attemptId: 'g8-attempt',
        claim: { jobId: '00000000-0000-4000-8000-000000000001', worker: 'w',
          leaseToken: 'a'.repeat(64), claimAttempt: 1 },
        hooks: {
          beforeRequest: async (call: { sequence: number }) => ({
            callId: `g8-${call.sequence}`, grantEpoch: null }),
          afterRequest: async (callId: string) => ({ receiptId: callId }),
        },
      });
    const unusedFetcher = async () => new Response('', { status: 500 });
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 20, maxResponseBytes: 64000, fetcher: unusedFetcher });
    const look = (fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) =>
      adapter.lookupEditionOptions({ query, correlationId: 'g8-lookup', attemptId: 'g8-attempt',
        signal: new AbortController().signal,
        httpPort: bridge(fetcher) });
    const rate = await look(async () => new Response('', { status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '120' } }));
    expect(rate).toMatchObject({ outcome: 'rate_limited', retryable: true });
    const timed = await look((_input, init) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    expect(timed).toMatchObject({ outcome: 'timeout', retryable: true });
  });
});

describe('Phase 9 fix2 G6: secondary attempt identity', () => {
  it('registers the secondary lookup schema/normalizer and secondary cache identity', async () => {
    // Mutation caught: overriding only key/version/capability, leaving the
    // primary schema/normalizer in the secondary structural attempt; and
    // substituting payloadSchemaVersion or lookupContractVersion.
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [GOOGLE_POLICY, OL_POLICY];
    const googleDescriptor = { adapterKey: 'google_books', adapterVersion: '1.0.0' };
    const { gateway } = fixture.direct({
      explicitDescriptor: {
        descriptor: googleDescriptor, adapter: null, fallbackAdapter: null,
        fallbackRoute: {
          adapterKey: 'open_library', adapterVersion: '1.0.0',
          capabilityVersion: 'open-library-capability-v1',
          normalizerVersion: 'p9-bibliographic-normalizer-v2',
          lookupSchemaVersion: 'p9-metadata-foundation-v2',
        },
      },
    });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_finish_edition_primary_for_fallback_v1') {
        return { data: { status: 'completed' }, error: null };
      }
      return baseRpc(name, parameters);
    };
    try {
      const request = gateway.editionOptions!.request;
      await gateway.editionProviderCalls.registerFallback(request,
        '00000000-0000-4000-8000-000000000101',
        '00000000-0000-4000-8000-000000000301',
        '00000000-0000-4000-8000-000000000201', 'provider_unavailable');
      const call = fixture.calls.find((entry: { name: string }) =>
        entry.name === 'phase9_register_structural_metadata_attempt');
      expect(call).toBeDefined();
      const parameters = call!.parameters;
      expect(parameters).toMatchObject({
        p_provider_role: 'secondary', p_adapter_key: 'open_library',
        p_adapter_version: '1.0.0', p_capability_version: 'open-library-capability-v1',
        p_schema_version: 'p9-metadata-foundation-v2',
        p_normalizer_version: 'p9-bibliographic-normalizer-v2',
      });
      expect('p_lookup_contract_version' in parameters).toBe(false);
      const expected = buildProviderCacheIdentity({
        query: request.query, adapterKey: 'open_library', adapterVersion: '1.0.0',
        capabilityVersion: 'open-library-capability-v1',
        schemaVersion: 'p9-metadata-foundation-v2',
        cachePolicyVersion: 'p9-metadata-cache-v1', reusePolicyVersion: '1',
      }).key;
      expect(parameters.p_provider_cache_identity).toBe(expected);
      const primary = buildProviderCacheIdentity({
        query: request.query, adapterKey: 'google_books', adapterVersion: '1.0.0',
        capabilityVersion: 'cap-v1', schemaVersion: 'p9-metadata-foundation-v1',
        cachePolicyVersion: 'p9-metadata-cache-v1', reusePolicyVersion: '1',
      }).key;
      expect(parameters.p_provider_cache_identity).not.toBe(primary);
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });
});

describe('Phase 9 fix2 H3: denial identity with a real secondary configured', () => {
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const setup = (lookupEditionOptions: () => Promise<unknown>) => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [GOOGLE_POLICY, OL_POLICY];
    const urls: string[] = [];
    const library = olAdapter(urls);
    const olDescriptor = installedManifest().get('open_library@1.0.0') as {
      capabilityVersion: string; normalizerVersion: string; lookupSchemaVersion: string;
    };
    const googleDescriptor = {
      adapterKey: 'google_books', adapterVersion: '1.0.0',
      capabilityVersion: 'google-books-capability-v1',
      protocol: { kind: 'single' as const, maxGets: 1 as const },
    };
    const primary = {
      ...fixture.adapter,
      lookupEditionOptions,
    };
    const { context, gateway } = fixture.direct({
      explicitDescriptor: {
        descriptor: googleDescriptor,
        adapter: primary as never,
        fallbackAdapter: library,
        fallbackRoute: {
          adapterKey: 'open_library', adapterVersion: '1.0.0',
          capabilityVersion: olDescriptor.capabilityVersion,
          normalizerVersion: olDescriptor.normalizerVersion,
          lookupSchemaVersion: olDescriptor.lookupSchemaVersion,
        },
        fallbackDescriptor: olDescriptor,
        fallbackExplicitHttp: {
          policy: null, requestHosts: ['openlibrary.org'],
          timeoutMs: 1000, maxResponseBytes: 64000,
          fetcher: library.transportBinding.fetcher,
          retentionPolicyVersion: 1,
          rowHostPolicy: library.normalizedEditionHostPolicy,
        },
      },
    });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_finish_edition_primary_for_fallback_v1') {
        return { data: { status: 'completed' }, error: null };
      }
      return baseRpc(name, parameters);
    };
    const run = () => executeDescriptorEditionOptions(context, gateway, {
      descriptor: googleDescriptor as never,
      adapter: primary as never,
      fallbackAdapter: library,
    }, new AbortController().signal);
    const secondaryRegistrations = () => fixture.calls.filter((call: {
      name: string; parameters: Record<string, unknown>;
    }) => call.name === 'phase9_register_structural_metadata_attempt'
      && call.parameters.p_provider_role === 'secondary').length;
    return { fixture, run, urls, secondaryRegistrations,
      restore: () => { fixture.dependencies.serviceClient.rpc = baseRpc; } };
  };

  it('keeps an unknown P9_ denial manual without a secondary attempt', async () => {
    // Mutation caught: continuing to fallback after a P9_ configuration/state
    // denial. The secondary here is real and reachable (control), so a zero
    // secondary registration/egress is meaningful.
    const setupRun = setup(async () => { throw new Error('P9_UNKNOWN_STATE'); });
    try {
      await expect(setupRun.run()).resolves.toEqual({ outcome: 'manual_metadata_required' });
      expect(setupRun.secondaryRegistrations()).toBe(0);
      expect(setupRun.urls).toEqual([]);
    } finally {
      setupRun.restore();
    }
  });

  it('control: the same wiring does invoke the real secondary after an eligible primary outcome', async () => {
    const setupRun = setup(async () => ({
      outcome: 'no_acceptable_match', retryable: false, rows: [],
      fetchedAt: null, retentionEvidence: null, providerRequestId: null,
    }));
    try {
      await expect(setupRun.run()).resolves.toEqual({ outcome: 'edition_options_available' });
      expect(setupRun.secondaryRegistrations()).toBe(1);
      expect(setupRun.urls).toEqual([
        '/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
    } finally {
      setupRun.restore();
    }
  });
});
