// U6 step 4: explicit port-hook contract (C-U6-1b/S0), denial identity (S7),
// routed-v1 worker parity (NEW file; no existing test touched).
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { runDescriptorWorker, installedManifest } from './support/providerModules';

const OL_POLICY = {
  adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('Phase 9 explicit port hooks (C-U6-1b/S0)', () => {
  it('returns grantEpoch null for a registration without it and performs the GET', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_POLICY];
    const { gateway } = fixture.direct({
      explicitDescriptor: { descriptor: { adapterKey: 'open_library', adapterVersion: '1.0.0' } },
    });
    const hooks = gateway.editionProviderCalls!.createPortHooks(uuid(101), uuid(201));
    // The fixture SQL shape returns grant_epoch:1; production returns none.
    // The hook reports null either way and never synthesizes an epoch.
    await expect(hooks.beforeRequest({
      sequence: 0, stage: 'search', signal: new AbortController().signal,
    })).resolves.toEqual({ callId: expect.any(String), grantEpoch: null });
    const { createProviderHttpPort } = require('../_shared/imageInventory/metadata/providerHttp');
    const afterRequest = jest.fn(async (callId: string) => hooks.afterRequest(callId, {
      outcome: 'no_acceptable_match', retryable: false,
      physicalStatus: 'finalized', egressStarted: true,
    }));
    const port = createProviderHttpPort({
      adapterKey: 'open_library', adapterVersion: '1.0.0', policy: null, maxGets: 6,
      timeoutMs: 1000, maxResponseBytes: 64000,
      fetcher: async () => new Response(JSON.stringify({ docs: [] }),
        { headers: { 'content-type': 'application/json' } }),
      lookupId: uuid(101), attemptId: uuid(201),
      claim: { jobId: fixture.current().jobId, worker: 'metadata-worker-fixture-0001',
        leaseToken: fixture.current().claimToken, claimAttempt: fixture.current().attempt },
      beforeRequest: async (call: unknown) => hooks.beforeRequest(
        call as { sequence: number; stage: string; signal: AbortSignal }),
      afterRequest,
    });
    await expect(port.get({
      url: new URL('https://openlibrary.org/search.json'), stage: 'search',
      sequence: 0, signal: new AbortController().signal,
    })).resolves.toMatchObject({ json: { docs: [] } });
    // S0: the SQL finalize returns {provider_call_id,status} (no receiptId
    // field); the hook maps identity to the port receipt.
    expect(afterRequest).toHaveBeenCalled();
  });

  it('maps a matching finalize status to receiptId === provider_call_id (T2)', async () => {
    // Mutation caught: discarding or remapping the SQL identity.
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_POLICY];
    const { gateway } = fixture.direct({
      explicitDescriptor: { descriptor: { adapterKey: 'open_library', adapterVersion: '1.0.0' } },
    });
    const hooks = gateway.editionProviderCalls!.createPortHooks(uuid(101), uuid(201));
    const { callId } = await hooks.beforeRequest({
      sequence: 0, stage: 'search', signal: new AbortController().signal,
    });
    await expect(hooks.afterRequest(callId, { outcome: 'no_acceptable_match',
      retryable: false, physicalStatus: 'finalized', egressStarted: true,
    })).resolves.toEqual({ receiptId: callId });
  });

  it('refuses a mismatched finalize status instead of mapping a receipt (F10)', async () => {
    // Mutation caught: accepting any non-empty status (e.g. 'registered')
    // as a finalization receipt, letting the caller continue to another GET.
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_POLICY];
    const { gateway } = fixture.direct({
      explicitDescriptor: { descriptor: { adapterKey: 'open_library', adapterVersion: '1.0.0' } },
    });
    const hooks = gateway.editionProviderCalls!.createPortHooks(uuid(101), uuid(201));
    const { callId } = await hooks.beforeRequest({
      sequence: 0, stage: 'search', signal: new AbortController().signal,
    });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      const result = await baseRpc(name, parameters);
      if (name === 'phase9_finalize_edition_options_provider_call_v1') {
        return { data: { provider_call_id: callId, status: 'registered' }, error: null };
      }
      return result;
    };
    try {
      await expect(hooks.afterRequest(callId, { outcome: 'no_acceptable_match',
        retryable: false, physicalStatus: 'finalized', egressStarted: true,
      })).rejects.toThrow('P9_METADATA_STALE_PHYSICAL_CALL');
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });

  it('refuses a crossed finalization receipt instead of adopting it', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_POLICY];
    const { gateway } = fixture.direct({
      explicitDescriptor: { descriptor: { adapterKey: 'open_library', adapterVersion: '1.0.0' } },
    });
    const hooks = gateway.editionProviderCalls!.createPortHooks(uuid(101), uuid(201));
    const { callId } = await hooks.beforeRequest({
      sequence: 0, stage: 'search', signal: new AbortController().signal,
    });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    fixture.dependencies.serviceClient.rpc = async (name: string, parameters: Record<string, unknown>) => {
      const result = await baseRpc(name, parameters);
      if (name === 'phase9_finalize_edition_options_provider_call_v1') {
        return { data: { ...result.data, provider_call_id: uuid(999) }, error: null };
      }
      return result;
    };
    try {
      await expect(hooks.afterRequest(callId, { outcome: 'no_acceptable_match',
        retryable: false, physicalStatus: 'finalized', egressStarted: true,
      })).rejects.toThrow('P9_METADATA_STALE_PHYSICAL_CALL');
    } finally {
      fixture.dependencies.serviceClient.rpc = baseRpc;
    }
  });
});

describe('Phase 9 explicit denial identity (S7)', () => {
  it('keeps an admission pause manual without GET or finalization (legacy path)', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.controls.denyPhysicalRegistration = true;
    const fetched = jest.fn(async (): Promise<Response> => {
      throw new Error('HTTP must not start after a refused grant');
    });
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetched,
    });
    const execute = require('../_shared/imageInventory/runtime/metadataEditionOptions')
      .executeEditionOptionsLookup;
    const { context, gateway } = fixture.direct();
    try {
      await expect(execute(context, gateway, adapter, new AbortController().signal))
        .resolves.toEqual({ outcome: 'manual_metadata_required' });
      expect(fetched).not.toHaveBeenCalled();
      expect(fixture.physicalCalls).toEqual([]);
    } finally {
      fixture.controls.denyPhysicalRegistration = false;
    }
  });

  it('keeps a thrown denial manual without secondary egress (descriptor path)', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    const { TEST_ONLY_PROTECTION_POLICY } = require('./support/providerProtection');
    const descriptor = {
      adapterKey: 'synthetic_catalogue', adapterVersion: '1.0.0',
      capabilityVersion: 'synthetic-capability-v1',
      normalizerVersion: 'p9-bibliographic-normalizer-v1',
      payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1',
      validationContract: 'synthetic-catalogue-v1', hostPolicyVersion: 'synthetic-hosts-v1',
      protocol: { kind: 'fanout', maxGets: 6 }, retentionContract: 'synthetic-options-v1',
      purposes: ['automatic', 'edition_options'],
      credentialsReady: () => true, retentionReady: () => true,
      invoke: async () => {
        const { OpenLibraryFailure } = require('../_shared/imageInventory/metadata/openLibrary/transport');
        throw new OpenLibraryFailure('policy_denied', false);
      },
    };
    const { descriptorOptionsGateway, executeDescriptorOptions } = require('./support/providerModules');
    const { context, gateway } = descriptorOptionsGateway(fixture, descriptor);
    const fetched = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('HTTP must not start for a denied descriptor');
    });
    try {
      await expect(executeDescriptorOptions(context, gateway, descriptor))
        .resolves.toEqual({ outcome: 'manual_metadata_required' });
      expect(fetched).not.toHaveBeenCalled();
      expect(fixture.physicalCalls).toEqual([]);
    } finally {
      fetched.mockRestore();
    }
    void TEST_ONLY_PROTECTION_POLICY;
  });
});

describe('Phase 9 routed-v1 worker parity', () => {
  it('serves an OL-only registry through the descriptor flow', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ ...OL_POLICY, reuseAllowed: true }];
    const urls: string[] = [];
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000,
      fetcher: async (address) => {
        const url = new URL(String(address)); urls.push(url.pathname);
        const raw = url.pathname === '/search.json' ? { docs: [{ key: '/works/OL1W' }] }
          : url.pathname.endsWith('/editions.json') ? { entries: [{ key: '/books/OL100M',
            title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
            languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'], covers: [123] }] }
          : { key: '/authors/OL1A', name: 'Fixture Author' };
        return new Response(JSON.stringify(raw), { headers: { 'content-type': 'application/json' } });
      },
    });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            enabled: false, matchingAllowed: false, storageAllowed: false,
            automaticLookupAllowed: false, automaticRole: null, automaticOrder: null,
            explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
          }),
          providerConfigurationRow('open_library', '1.0.0'),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const google = fixture.dependencies.primary;
    const result = await runDescriptorWorker(
      { ...fixture.dependencies, serviceClient: { rpc }, editionFallback: adapter, primary: google },
      installedManifest(),
    );
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(urls).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
    expect(fixture.stats().providerRequests).toBe(0);
    expect(fixture.physicalCalls.map((call) => [call.sequence, call.stage])).toEqual(
      [[0, 'search'], [1, 'editions'], [2, 'author:OL1A']]);
    const saved = [...fixture.saved.values()][0];
    expect(saved.rows[0].metadata).toMatchObject({
      adapterKey: 'open_library', adapterVersion: '1.0.0',
    });
  });
});
