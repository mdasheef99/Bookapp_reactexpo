// U6 fix pass 1, worker-level tests (NEW file): F6 fallback, F8 automatic
// guard, F9 contract recheck, F3 batch sharing, F12 routed-Google parity.
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { GoogleBooksAdapter } from '../_shared/imageInventory/metadata/googleBooks/adapter';
import { GOOGLE_BOOKS_CAPABILITY } from '../_shared/imageInventory/metadata/googleBooks';
import { createInstalledDescriptorManifest } from '../../../workers/phase9-metadata-worker/bootstrap';
import { getWorkerProtectionState, runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { editionWorkerFixture, automaticContext } from './fixtures/phase9/editionOptionsWorker';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

const OL_POLICY = {
  adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};
const GOOGLE_POLICY = {
  adapterKey: 'google_books', adapterVersion: '1.0.0', enabled: true,
  matchingAllowed: true, storageAllowed: true, reuseAllowed: true, policyVersion: 1,
};

function olAdapter(urls: string[]) {
  return new OpenLibraryEditionOptionsAdapter({
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
}

describe('Phase 9 fix1 F6: secondary fallback through the worker', () => {
  it('completes a retained Google-primary -> OL-secondary result', async () => {
    // Mutation caught: fallback reusing primary maxGets/hosts/policy/key
    // (Google maxGets 1 / google hosts would refuse or invalidate OL rows).
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [GOOGLE_POLICY, OL_POLICY];
    fixture.controls.status = 503;
    const urls: string[] = [];
    const library = olAdapter(urls);
    const installed = createInstalledDescriptorManifest({
      google: fixture.adapter as unknown as GoogleBooksAdapter, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
          }),
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'secondary', explicitOrder: 2,
            protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
          }),
        ]), error: null };
      }
      if (name === 'phase9_finish_edition_primary_for_fallback_v1') {
        fixture.calls.push({ name, parameters });
        return { data: { status: 'completed' }, error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: fixture.adapter, primaryCapability: GOOGLE_BOOKS_CAPABILITY,
      editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    expect(fixture.stats().providerRequests).toBe(1);
    expect(urls).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
    expect(fixture.calls.filter((call) => call.name === 'phase9_register_edition_options_provider_call_v1'))
      .toHaveLength(3);
    expect(fixture.calls.some((call) => call.name === 'phase9_finish_edition_primary_for_fallback_v1'
      && call.parameters.p_outcome === 'provider_unavailable')).toBe(true);
    const saved = [...fixture.saved.values()][0];
    expect(saved.rows[0].metadata).toMatchObject({
      adapterKey: 'open_library', adapterVersion: '1.0.0',
      authors: ['Fixture Author'],
    });
  });

  it('refuses secondary egress when the secondary row excludes its hosts', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [GOOGLE_POLICY, OL_POLICY];
    fixture.controls.status = 503;
    const urls: string[] = [];
    const library = olAdapter(urls);
    const installed = createInstalledDescriptorManifest({
      google: fixture.adapter as unknown as GoogleBooksAdapter, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          // The primary's host set WOULD permit the secondary URL, so only
          // the secondary's own hosts can refuse (H3).
          providerConfigurationRow('google_books', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            approvedRequestHosts: ['openlibrary.org'],
            approvedBookHosts: ['openlibrary.org'],
            approvedCoverHosts: ['openlibrary.org'],
          }),
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'secondary', explicitOrder: 2,
            protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
            approvedRequestHosts: ['other.example.test'],
            approvedBookHosts: ['other.example.test'],
            approvedCoverHosts: ['other.example.test'],
          }),
        ]), error: null };
      }
      if (name === 'phase9_finish_edition_primary_for_fallback_v1') {
        return { data: { status: 'completed' }, error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: fixture.adapter, primaryCapability: GOOGLE_BOOKS_CAPABILITY,
      editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(urls).toEqual([]);
  });
});

describe('Phase 9 fix1 F8: v2 automatic stays unready', () => {
  it('fails closed on an eligible v2 automatic row with Google off (same as HEAD)', async () => {
    // Mutation caught: executing port-native automatic through composition
    // (v1 adapter lookup() throws) instead of HEAD-identical manual.
    const fixture = editionWorkerFixture();
    Object.keys(fixture.current()).forEach((key) => { delete fixture.current()[key]; });
    Object.assign(fixture.current(), automaticContext, {
      localCanonicalEditionId: null,
      providerPolicies: [{ adapterKey: 'open_library', adapterVersion: '2.0.0',
        enabled: true, matchingAllowed: true, storageAllowed: true,
        reuseAllowed: true, policyVersion: 1 }],
    });
    fixture.useUuidLineage();
    const urls: string[] = [];
    const library = olAdapter(urls);
    const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            enabled: false, matchingAllowed: false, storageAllowed: false,
            automaticLookupAllowed: false, automaticRole: null, automaticOrder: null,
            explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
          }),
          providerConfigurationRow('open_library', '2.0.0', {
            automaticLookupAllowed: true, automaticRole: 'primary', automaticOrder: 1,
            explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
            protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: null, primaryCapability: null,
      editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(urls).toEqual([]);
    expect(fixture.calls.some((call) => call.name === 'phase9_fail_metadata_job'
      && call.parameters.p_failure_kind === 'provider_disabled')).toBe(true);
  });
});

describe('Phase 9 fix1 F9: live-adapter contract recheck', () => {
  it('rejects same key/version with a divergent contract tuple', async () => {
    // Mutation caught: key/version-only binding executing under a relabelled
    // contract. Unit-pinned on the exported check (worker rebinds normalize
    // v1/Google tuples, so this guards future divergence, not current flows).
    const { sameContractTuple } = require('../../../workers/phase9-metadata-worker');
    const { installedManifest } = require('./support/providerModules');
    const installed = installedManifest().get('open_library@1.0.0');
    const tampered = { ...installed, capabilityVersion: 'tampered-capability-v9' };
    // H5: contract divergence only. Version safety is asserted through
    // bindExecution at the public worker (phase9_metadata_fix2_worker.test.ts),
    // never inferred from this helper (it does not compare key/version).
    expect(sameContractTuple(installed, installed)).toBe(true);
    expect(sameContractTuple(tampered, installed)).toBe(false);
  });

  it('refuses a tampered manifest/row combination without egress (control executes)', async () => {
    const { installedManifest } = require('./support/providerModules');
    const tampered = {
      ...installedManifest().get('open_library@1.0.0'),
      capabilityVersion: 'tampered-capability-v9',
    };
    const runWith = async (descriptor: unknown, capabilityVersion: string) => {
      const fixture = editionWorkerFixture();
      fixture.useUuidLineage();
      fixture.current().providerPolicies = [OL_POLICY];
      const urls: string[] = [];
      const library = olAdapter(urls);
      const installed = new Map(installedManifest());
      installed.set('open_library@1.0.0', descriptor);
      const baseRpc = fixture.dependencies.serviceClient.rpc;
      const rpc = async (name: string, parameters: Record<string, unknown>) => {
        if (name === 'phase9_provider_configuration_v1') {
          return { data: providerConfigurationSnapshot([
            providerConfigurationRow('google_books', '1.0.0', {
              enabled: false, matchingAllowed: false, storageAllowed: false,
              automaticLookupAllowed: false, automaticRole: null, automaticOrder: null,
              explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
            }),
            providerConfigurationRow('open_library', '1.0.0', {
              versionContracts: { '1.0.0': {
                validationContract: 'open-library-v1', hostPolicyVersion: 'open-library-hosts-v1',
                capabilityVersion,
                normalizerVersion: 'p9-bibliographic-normalizer-v1',
                payloadSchemaVersion: 'p9-metadata-v1', lookupSchemaVersion: 'p9-metadata-foundation-v1' } },
            }),
          ]), error: null };
        }
        return baseRpc(name, parameters);
      };
      const result = await runMetadataWorkerBatch(1, {
        ...fixture.dependencies, serviceClient: { rpc },
        primary: null, primaryCapability: null,
        editionFallback: library, installed,
      });
      return { result, urls };
    };
    // Tampered installed tuple matches the row (resolver elects), but the
    // live adapter serves the true tuple: refused without egress.
    const denied = await runWith(tampered, 'tampered-capability-v9');
    expect(denied.result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(denied.urls).toEqual([]);
    // Positive control: true tuple executes.
    const { installedManifest: freshManifest } = require('./support/providerModules');
    const allowed = await runWith(
      freshManifest().get('open_library@1.0.0'), 'open-library-capability-v1');
    expect(allowed.result.results).toEqual([{ outcome: 'edition_options_available' }]);
  });
});

describe('Phase 9 fix1 F12: routed Google egress parity', () => {
  it('performs exactly the legacy egress validation and physical accounting', async () => {
    // Mutation caught: routed Google arm skipping validateEgress (no
    // phase9_register_metadata_provider_call, silent finalize skip).
    const { executeEditionOptionsLookup, executeDescriptorEditionOptions } =
      require('../_shared/imageInventory/runtime/metadataEditionOptions');
    const runWith = (routed: boolean) => {
      const fixture = editionWorkerFixture();
      fixture.useUuidLineage();
      const { context, gateway } = fixture.direct();
      const google = fixture.adapter;
      const invoke = routed
        ? () => executeDescriptorEditionOptions(context, gateway, {
          descriptor: { adapterKey: 'google_books', adapterVersion: '1.0.0' },
          adapter: google, fallbackAdapter: null,
        }, new AbortController().signal)
        : () => executeEditionOptionsLookup(
          context, gateway, google, new AbortController().signal);
      return { fixture, invoke };
    };
    const legacy = runWith(false);
    const legacyResult = await legacy.invoke();
    const legacyCalls = legacy.fixture.calls.map((call) => call.name);
    const routed = runWith(true);
    const routedResult = await routed.invoke();
    const routedCalls = routed.fixture.calls.map((call) => call.name);
    expect(routedResult).toEqual(legacyResult);
    expect(routedResult).toEqual({ outcome: 'edition_options_available' });
    expect(routedCalls).toEqual(legacyCalls);
    // Same physical accounting: single-call registration + finalization.
    expect(routedCalls).toContain('phase9_register_metadata_provider_call');
    expect(routed.fixture.physicalCalls).toHaveLength(1);
    expect(routed.fixture.physicalCalls[0]).toMatchObject({ finalized: true });
    // Retained-row positive control (S4/P7): independent verifier rows pass
    // through routing with retention evidence intact.
    const saved = [...routed.fixture.saved.values()][0];
    expect(saved.rows).toHaveLength(10);
  });
});

describe('Phase 9 fix1 F3: worker shares one protection state per provider', () => {
  it('returns one provider-scoped object for both installed versions', () => {
    // Mutation caught: per-call/per-batch state (fresh object each claim) or
    // keying the worker state by key@version (G1). Worker call sites pass the
    // adapterKey only, so open_library v1 and v2 share this object.
    expect(getWorkerProtectionState('open_library'))
      .toBe(getWorkerProtectionState('open_library'));
  });

  it('shares breaker observations across batches for one provider', async () => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [{ adapterKey: 'open_library', adapterVersion: '2.0.0',
      enabled: true, matchingAllowed: true, storageAllowed: true,
      reuseAllowed: true, policyVersion: 1 }];
    let fetches = 0;
    const failing = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000,
      fetcher: async () => { fetches += 1; return new Response('', { status: 503 }); },
    });
    const { installedManifest } = require('./support/providerModules');
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', {
            enabled: false, matchingAllowed: false, storageAllowed: false,
            automaticLookupAllowed: false, automaticRole: null, automaticOrder: null,
            explicitSearchAllowed: false, explicitRole: null, explicitOrder: null,
          }),
          providerConfigurationRow('open_library', '2.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            protectionPolicy: TEST_ONLY_PROTECTION_POLICY,
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const dependencies = { ...fixture.dependencies, serviceClient: { rpc },
      primary: null, primaryCapability: null,
      editionFallback: failing, installed: installedManifest() };
    // TEST_ONLY breakerFailures is 2: two failing claims trip the shared
    // breaker; the third claim is refused with zero additional GETs.
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'retry_scheduled' }]);
    fixture.requeue();
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'retry_scheduled' }]);
    expect(fetches).toBe(2);
    fixture.requeue();
    expect((await runMetadataWorkerBatch(1, dependencies)).results)
      .toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fetches).toBe(2);
  });
});
