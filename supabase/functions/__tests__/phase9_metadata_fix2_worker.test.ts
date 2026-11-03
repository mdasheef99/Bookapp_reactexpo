// U6 fix pass 2, worker-level tests (NEW file): G1 provider-scoped state,
// H6 explicit Google retention through the real worker, H5 bindExecution
// version refusal.
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { createInstalledDescriptorManifest } from '../../../workers/phase9-metadata-worker/bootstrap';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { GOOGLE_BOOKS_CAPABILITY } from '../_shared/imageInventory/metadata/googleBooks';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';
import { installedManifest } from './support/providerModules';

const OL_V1 = {
  adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};
const OL_V2 = { ...OL_V1, adapterVersion: '2.0.0' };
const GOOGLE_POLICY = {
  adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};
const DISABLED_GOOGLE = {
  enabled: false, matchingAllowed: false, storageAllowed: false,
  automaticLookupAllowed: false, automaticRole: null, automaticOrder: null,
  explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
};

describe('Phase 9 fix2 G1: worker protection state is provider-scoped', () => {
  it('shares the breaker across a v1 -> v2 version switch for one provider', async () => {
    // Mutation caught: keying worker state by providerManifestKey(key,version)
    // gives v2 a fresh breaker after two v1 failures, so the v2 claim GETs.
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [OL_V1];
    let fetches = 0;
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000,
      fetcher: async () => { fetches += 1; return new Response('', { status: 503 }); },
    });
    const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
    let rows = [
      providerConfigurationRow('google_books', '1.0.0', DISABLED_GOOGLE),
      providerConfigurationRow('open_library', '1.0.0', {
        explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
        protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
      }),
    ];
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot(rows), error: null };
      }
      return baseRpc(name, parameters);
    };
    const dependencies = {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: null, primaryCapability: null,
      editionFallback: library, installed,
    };
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'retry_scheduled' }]);
    fixture.requeue();
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fetches).toBe(2);
    rows = [
      providerConfigurationRow('google_books', '1.0.0', DISABLED_GOOGLE),
      providerConfigurationRow('open_library', '2.0.0', {
        explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
        protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
      }),
    ];
    fixture.requeue({ providerPolicies: [OL_V2] });
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fetches).toBe(2);
  }, 20000);
});

describe('Phase 9 fix2 H6: explicit Google retention through the worker', () => {
  const run = async (permission: boolean) => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [GOOGLE_POLICY];
    fixture.controls.permission = permission;
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000,
      fetcher: async () => new Response('', { status: 500 }),
    });
    const installed = createInstalledDescriptorManifest({
      google: fixture.adapter as never, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: fixture.adapter, primaryCapability: GOOGLE_BOOKS_CAPABILITY,
      editionFallback: library, installed,
    });
    return { result, fixture };
  };

  it('preserves verified retention for an eligible explicit Google row', async () => {
    // Mutation caught: removing bindGoogleRetentionPolicy leaves the installed
    // Google descriptor retention-unready, so the resolver elects manual and
    // no explicit physical call happens.
    const { result, fixture } = await run(true);
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    const saved = [...fixture.saved.values()][0];
    expect(saved.rows).toHaveLength(10);
    expect(saved.retentionEvidence).not.toBeNull();
  });

  it('denies retention when the independent verifier refuses (control)', async () => {
    const { result, fixture } = await run(false);
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fixture.saved.size).toBe(0);
  });
});

describe('Phase 9 fix2 H5: bindExecution refuses a live adapter at a different version', () => {
  it('does not execute a v1 live adapter under an elected v2 Google descriptor', async () => {
    // Mutation caught: dropping the rebound.adapterVersion equality check
    // from bindExecution. The installed Google entry is relabelled 2.0.0
    // (identical tuple) and the primary capability claims 2.0.0 while the
    // live adapter is the 1.0.0 instance; only that check refuses execution.
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ ...GOOGLE_POLICY, adapterVersion: '2.0.0' }];
    const baseGoogle = installedManifest().get('google_books@1.0.0')!;
    const googleV2 = {
      ...baseGoogle,
      adapterVersion: '2.0.0',
      credentialsReady: () => true,
      retentionReady: () => true,
      invoke: async () => { throw new Error('route fixture descriptor does not invoke'); },
    };
    const tuple = {
      validationContract: googleV2.validationContract as string,
      hostPolicyVersion: googleV2.hostPolicyVersion as string,
      capabilityVersion: googleV2.capabilityVersion as string,
      normalizerVersion: googleV2.normalizerVersion as string,
      payloadSchemaVersion: googleV2.payloadSchemaVersion as string,
      lookupSchemaVersion: googleV2.lookupSchemaVersion as string,
    };
    const installed = new Map(installedManifest());
    installed.set('google_books@2.0.0', googleV2 as never);
    // The live adapter reports a different provider key so the Google
    // retention binding stays inert (it would otherwise mis-key its rebound
    // descriptor and refuse at election, hiding bindExecution).
    const baseAdapter = fixture.adapter;
    const live = new Proxy(baseAdapter, {
      get(target, property, receiver) {
        if (property === 'normalizedEditionHostPolicy') {
          return { ...target.normalizedEditionHostPolicy, adapterKey: 'google_relabelled' };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    let fetches = 0;
    fixture.controls.beforeFetch = async () => { fetches += 1; };
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '2.0.0', {
            acceptedAdapterVersions: ['1.0.0', '2.0.0'],
            versionContracts: { '1.0.0': tuple, '2.0.0': tuple },
            validationContract: tuple.validationContract,
            hostPolicyVersion: tuple.hostPolicyVersion,
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: live as never,
      primaryCapability: { ...GOOGLE_BOOKS_CAPABILITY, adapterVersion: '2.0.0' },
      editionFallback: null as never, installed,
    });
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fetches).toBe(0);
    // Neither registration RPC (legacy egress or edition-options port arm).
    expect(fixture.calls.some((call: { name: string }) =>
      call.name === 'phase9_register_metadata_provider_call'
      || call.name === 'phase9_register_edition_options_provider_call_v1')).toBe(false);
  }, 20000);
});
