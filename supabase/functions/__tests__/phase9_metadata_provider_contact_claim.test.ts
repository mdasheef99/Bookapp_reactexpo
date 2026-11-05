// Unit B: unresolved contact fails closed before any admission, begin,
// reservation or lookup, reusing the existing route-manual handling (T3).
// NEW file; no existing test touched. Fake values only; never a real email.
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { createInstalledDescriptorManifest } from '../../../workers/phase9-metadata-worker/bootstrap';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { providerConfigurationRow, providerConfigurationSnapshot } from './fixtures/phase9/providerConfiguration';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { automaticDependencies } from './support/automaticWorker';
import { TEST_ONLY_PROTECTION_POLICY } from './support/providerProtection';

const UNMAPPED_ID = 'no-such-contact';
const UNMAPPED = { ...TEST_ONLY_PROTECTION_POLICY, contactId: UNMAPPED_ID };

const LOOKUP_RPCS = [
  'phase9_register_structural_metadata_lookup',
  'phase9_reserve_metadata_usage',
  'phase9_register_structural_metadata_attempt',
  'phase9_prepare_automatic_metadata_v1',
  'phase9_begin_automatic_provider_run_v1',
  'phase9_register_metadata_provider_call',
];

describe('Phase 9 Unit B unresolved contact fails closed (T3)', () => {
  it('automatic purpose: zero fetches plus the existing manual outcome', async () => {
    // Mutation caught: fetching without identity, or mapping the throw to
    // stale_claim via the worker catch-all.
    const subject = automaticDependencies({
      rpc: async (name) => (name === 'phase9_provider_configuration_v1'
        ? { data: providerConfigurationSnapshot([
          providerConfigurationRow('google_books', '1.0.0', { protectionPolicy: UNMAPPED }),
          providerConfigurationRow('open_library', '1.0.0'),
        ]), error: null }
        : undefined),
    });
    const result = await subject.run();
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    const names = subject.fixture.calls.map((call) => call.name);
    for (const rpc of LOOKUP_RPCS) expect(names).not.toContain(rpc);
    // The existing automatic-arm handling fails the job closed.
    const failed = subject.fixture.calls.filter((call) => call.name === 'phase9_fail_metadata_job');
    expect(failed).toHaveLength(1);
    expect(failed[0].parameters.p_failure_kind).toBe('provider_disabled');
    for (const call of subject.fixture.calls) {
      expect(JSON.stringify(call.parameters ?? null)).not.toContain(UNMAPPED_ID);
    }
  });

  it('explicit purpose: zero fetches plus the existing manual outcome', async () => {    // Mutation caught: fetching without identity on the explicit path.
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ docs: [] }), {
      headers: { 'content-type': 'application/json' },
    }));
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetcher as never,
    });
    const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
    const baseRpc = fixture.dependencies.serviceClient.rpc;
    const seen: Array<{ name: string; parameters: Record<string, unknown> }> = [];
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      seen.push({ name, parameters });
      if (name === 'phase9_provider_configuration_v1') {
        return { data: providerConfigurationSnapshot([
          providerConfigurationRow('open_library', '1.0.0', {
            explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
            protectionPolicy: UNMAPPED,
          }),
        ]), error: null };
      }
      return baseRpc(name, parameters);
    };
    const result = await runMetadataWorkerBatch(1, {
      ...fixture.dependencies, serviceClient: { rpc },
      primary: null, primaryCapability: null, editionFallback: library, installed,
    });
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(fetcher).not.toHaveBeenCalled();
    const names = seen.map((call) => call.name);
    for (const entry of LOOKUP_RPCS) expect(names).not.toContain(entry);
    expect(names).not.toContain('phase9_register_edition_options_provider_call_v1');
    for (const call of seen) {
      expect(JSON.stringify(call.parameters ?? null)).not.toContain(UNMAPPED_ID);
    }
  });
});

describe('Phase 9 Unit B inherited contactIds fail closed to manual (F1)', () => {
  // Mutation caught: plain-object lookup letting 'toString'/'constructor'
  // resolve to an inherited property, so the check passes and the resolver
  // throw surfaces as stale_claim via the worker catch-all.
  it.each([['toString'], ['constructor']])(
    'automatic purpose: unmapped contactId %s takes route-manual handling, never stale_claim',
    async (contactId) => {
      const subject = automaticDependencies({
        rpc: async (name) => (name === 'phase9_provider_configuration_v1'
          ? { data: providerConfigurationSnapshot([
            providerConfigurationRow('google_books', '1.0.0', {
              protectionPolicy: { ...TEST_ONLY_PROTECTION_POLICY, contactId },
            }),
            providerConfigurationRow('open_library', '1.0.0'),
          ]), error: null }
          : undefined),
      });
      const result = await subject.run();
      expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
      expect(subject.gets()).toBe(0);
      const names = subject.fixture.calls.map((call) => call.name);
      for (const rpc of LOOKUP_RPCS) expect(names).not.toContain(rpc);
      const failed = subject.fixture.calls.filter((call) => call.name === 'phase9_fail_metadata_job');
      expect(failed).toHaveLength(1);
      expect(failed[0].parameters.p_failure_kind).toBe('provider_disabled');
    },
  );

  it.each([['toString'], ['constructor']])(
    'explicit purpose: unmapped contactId %s takes route-manual handling, never stale_claim',
    async (contactId) => {
      const fixture = editionWorkerFixture();
      fixture.useUuidLineage();
      const fetcher = jest.fn(async () => new Response(JSON.stringify({ docs: [] }), {
        headers: { 'content-type': 'application/json' },
      }));
      const library = new OpenLibraryEditionOptionsAdapter({
        timeoutMs: 1000, maxResponseBytes: 64000, fetcher: fetcher as never,
      });
      const installed = createInstalledDescriptorManifest({ google: null, openLibrary: library });
      const baseRpc = fixture.dependencies.serviceClient.rpc;
      const rpc = async (name: string, parameters: Record<string, unknown>) => {
        if (name === 'phase9_provider_configuration_v1') {
          return { data: providerConfigurationSnapshot([
            providerConfigurationRow('open_library', '1.0.0', {
              explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
              protectionPolicy: { ...TEST_ONLY_PROTECTION_POLICY, contactId },
            }),
          ]), error: null };
        }
        return baseRpc(name, parameters);
      };
      const result = await runMetadataWorkerBatch(1, {
        ...fixture.dependencies, serviceClient: { rpc },
        primary: null, primaryCapability: null, editionFallback: library, installed,
      });
      expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
      expect(fetcher).not.toHaveBeenCalled();
      const names = fixture.calls.map((call) => call.name);
      for (const entry of LOOKUP_RPCS) expect(names).not.toContain(entry);
      expect(names).not.toContain('phase9_register_edition_options_provider_call_v1');
    },
  );

  it('the resolver rejects inherited names on any map shape', async () => {
    // Unit-pinned: even a plain-object map must miss inherited names.
    const { resolveProtectionContact, parseProtectionPolicyOrNull } =
      require('../_shared/imageInventory/runtime/providerProtection');
    for (const contactId of ['toString', 'constructor']) {
      const parsed = parseProtectionPolicyOrNull({ ...TEST_ONLY_PROTECTION_POLICY, contactId });
      expect(() => resolveProtectionContact(parsed, {})).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
      expect(() => resolveProtectionContact(parsed, { 'other-id': 'second@example.invalid' }))
        .toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    }
  });
});
