// U2 supplemental route cases not covered by the package-4 descriptor suite:
// live-like Google-automatic/OL-explicit split, secondary routing without
// promotion, malformed snapshots and resumed purpose mismatch. FIX1 adds
// worker-level evidence/recovery/binding cases plus SQL-exact parser and
// resolver guards (X1/X2/X4/X5/X6); each negative has a positive control
// differing only in the defect. No existing test, fixture or support file is
// edited here: every harness below is local to this file.
import {
  installedProviderDescriptors,
  providerConfigurationRow,
  providerConfigurationSnapshot,
} from './fixtures/phase9/providerConfiguration';
import {
  ROUTE_RESOLVER_EXPORT,
  loadProviderDescriptorModule,
  runDescriptorWorker,
} from './support/providerModules';
import { automaticDependencies } from './support/automaticWorker';
import { hasPersistedEvidence } from '../../../workers/phase9-metadata-worker/editionProviderRoute';
import { parseProviderConfigurationSnapshot } from '../_shared/imageInventory/runtime/providerConfiguration';
import {
  editionWorkerFixture,
  UUID_CANDIDATE_ID,
} from './fixtures/phase9/editionOptionsWorker';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary';
import { createOpenLibraryV1Descriptor } from '../_shared/imageInventory/metadata/openLibrary/descriptor';
import { bindVerifiedRegistryPolicy } from '../../../workers/phase9-metadata-worker';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { editionOptionsFence } from '../_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import {
  OL_V1_EXPLICIT_V1,
  GOLDEN_CLOCK,
  GOLDEN_LOOKUP_ID,
  GOLDEN_ATTEMPT_ID,
} from './fixtures/phase9/providerReplacementGoldens';

const descriptorModule = loadProviderDescriptorModule();
const resolve = () => {
  const fn = descriptorModule?.[ROUTE_RESOLVER_EXPORT];
  expect(fn).toEqual(expect.any(Function));
  return fn as (input: Record<string, unknown>) => Record<string, any>;
};
const installed = () => installedProviderDescriptors();

describe('Phase 9 provider route supplement', () => {
  it('keeps Google automatic primary while OL serves explicit in a live-like registry', () => {
    const registry = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0'),
      providerConfigurationRow('open_library', '1.0.0'),
    ]);
    const automatic = resolve()({ purpose: 'automatic', registry, installed: installed(), resumed: null });
    expect(automatic.primary.adapterKey).toBe('google_books');
    expect(automatic.primary.adapterVersion).toBe('1.0.0');
    expect(automatic.secondary).toBeNull();
    const explicit = resolve()({ purpose: 'edition_options', registry, installed: installed(), resumed: null });
    expect(explicit.primary.adapterKey).toBe('open_library');
    expect(explicit.primary.adapterVersion).toBe('1.0.0');
    expect(explicit.secondary).toBeNull();
  });

  it('returns a secondary without ever promoting it when the primary is uninstalled', () => {
    const routed = resolve()({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([
        providerConfigurationRow('google_books', '1.0.0'),
        providerConfigurationRow('open_library', '2.0.0', {
          automaticRole: 'secondary', automaticOrder: 2,
        }),
      ]),
      installed: installed(),
      resumed: null,
    });
    expect(routed.primary.adapterKey).toBe('google_books');
    expect(routed.secondary?.adapterKey).toBe('open_library');
    expect(routed.secondary?.adapterVersion).toBe('2.0.0');
    expect(routed.policyVersions['google_books@1.0.0']).toBe(1);
    expect(routed.policyVersions['open_library@2.0.0']).toBe(1);
    const baseContract = (providerConfigurationRow('open_library', '2.0.0') as {
      versionContracts: Record<string, unknown>;
    }).versionContracts['2.0.0'];
    const uninstalled = providerConfigurationRow('google_books', '9.9.9', {
      automaticLookupAllowed: true, automaticRole: 'primary', automaticOrder: 1,
      acceptedAdapterVersions: ['9.9.9'],
      versionContracts: { '9.9.9': baseContract },
      validationContract: 'google-books-v1',
      hostPolicyVersion: 'google-books-hosts-v1',
    });
    expect(resolve()({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([uninstalled,
        providerConfigurationRow('open_library', '2.0.0', {
          automaticRole: 'secondary', automaticOrder: 2,
        })]),
      installed: installed(),
      resumed: null,
    })).toEqual({ manual: true });
  });

  it('rejects duplicate secondaries and malformed snapshots before egress', () => {
    expect(() => resolve()({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([
        providerConfigurationRow('google_books', '1.0.0', {
          automaticRole: 'secondary', automaticOrder: 2,
        }),
        providerConfigurationRow('open_library', '2.0.0', {
          automaticRole: 'secondary', automaticOrder: 2,
        }),
      ]),
      installed: installed(),
      resumed: null,
    })).toThrow('P9_PROVIDER_ROUTE_INVALID');
    expect(() => resolve()({
      purpose: 'automatic',
      registry: { version: 'p9-provider-configuration-v1', providers: 'nope' },
      installed: installed(),
      resumed: null,
    })).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    expect(() => resolve()({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([
        providerConfigurationRow('google_books', '1.0.0', {
          automaticRole: 'primary' as never,
          automaticOrder: 2,
        } as never),
      ]),
      installed: installed(),
      resumed: null,
    })).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
  });

  it('rejects resumed lineage whose purpose does not match the request', () => {
    const row = providerConfigurationRow('open_library', '2.0.0', {
      explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
    });
    expect(() => resolve()({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([row]),
      installed: installed(),
      resumed: {
        adapterKey: 'open_library',
        adapterVersion: '2.0.0',
        purpose: 'edition_options',
        role: 'primary',
        sequence: 1,
        lookupId: '11111111-1111-4111-8111-000000000001',
        attemptId: '11111111-1111-4111-8111-000000000002',
        claimAttempt: 1,
        policyVersion: 1,
      },
    })).toThrow('P9_PROVIDER_ROUTE_INVALID');
  });

  it('routes a mis-keyed installed entry to manual instead of the wrong provider', () => {
    const registry = providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0'),
    ]);
    const google = installed().get('google_books@1.0.0');
    expect(google?.adapterKey).toBe('google_books');
    // Negative: the installed key names OL but the descriptor is Google.
    const miskeyed = new Map([[ 'open_library@1.0.0', google ]]);
    expect(resolve()({
      purpose: 'edition_options', registry, installed: miskeyed, resumed: null,
    })).toEqual({ manual: true });
    // Positive control: the correctly keyed OL descriptor routes.
    expect(resolve()({
      purpose: 'edition_options', registry, installed: installed(), resumed: null,
    }).primary).toMatchObject({ adapterKey: 'open_library', adapterVersion: '1.0.0' });
  });
});

describe('Phase 9 provider route SQL-exact parser and resolver guards', () => {
  it('X5 accepts null revalidationSeconds and routes only metadata rows', () => {
    // Positive control first: the same row with a number parses and routes.
    const numbered = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0', { revalidationSeconds: 86400 }),
    ]);
    expect(() => parseProviderConfigurationSnapshot(numbered)).not.toThrow();
    expect(resolve()({
      purpose: 'automatic', registry: numbered, installed: installed(), resumed: null,
    }).primary).toMatchObject({ adapterKey: 'google_books' });
    // Null revalidationSeconds is SQL-valid (M01:14 CHECK ... IS NULL OR > 0).
    const nulled = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0', { revalidationSeconds: null }),
    ]);
    expect(() => parseProviderConfigurationSnapshot(nulled)).not.toThrow();
    // A vision-only registry has no metadata primary: manual, never routed.
    // Positive control differs only in providerKind.
    const vision = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0', { providerKind: 'vision' }),
    ]);
    expect(() => parseProviderConfigurationSnapshot(vision)).not.toThrow();
    expect(resolve()({
      purpose: 'automatic', registry: vision, installed: installed(), resumed: null,
    })).toEqual({ manual: true });
    expect(() => parseProviderConfigurationSnapshot(providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0', { providerKind: 'bogus' }),
    ]))).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
  });

  it('X6 refuses a fresh row whose active version the registry did not accept', () => {
    const contracts = (providerConfigurationRow('open_library', '2.0.0') as {
      versionContracts: Record<string, unknown>;
    }).versionContracts;
    const unaccepted = {
      ...providerConfigurationRow('open_library', '1.0.0'),
      acceptedAdapterVersions: ['2.0.0'],
      versionContracts: { '2.0.0': contracts['2.0.0'] },
    };
    expect(() => resolve()({
      purpose: 'edition_options',
      registry: providerConfigurationSnapshot([unaccepted]),
      installed: installed(),
      resumed: null,
    })).toThrow('P9_PROVIDER_CONFIGURATION_INVALID');
    // Positive control: the accepted active version routes.
    expect(resolve()({
      purpose: 'edition_options',
      registry: providerConfigurationSnapshot([
        providerConfigurationRow('open_library', '1.0.0'),
      ]),
      installed: installed(),
      resumed: null,
    }).primary).toMatchObject({ adapterKey: 'open_library', adapterVersion: '1.0.0' });
  });

  it('X1 detects persisted evidence from context columns only', () => {
    const fresh = {
      currentLookupId: null, currentAttemptId: null,
      currentPhysicalStatus: null, currentAttemptDisposition: null,
    };
    expect(hasPersistedEvidence(fresh as never)).toBe(false);
    expect(hasPersistedEvidence({ ...fresh, currentLookupId: GOLDEN_LOOKUP_ID } as never)).toBe(true);
    expect(hasPersistedEvidence({ ...fresh, currentAttemptId: GOLDEN_ATTEMPT_ID } as never)).toBe(true);
    expect(hasPersistedEvidence({ ...fresh, currentPhysicalStatus: 'outcome_unknown' } as never)).toBe(true);
    expect(hasPersistedEvidence({ ...fresh, currentAttemptDisposition: 'unresolved' } as never)).toBe(true);
  });
});

describe('Phase 9 provider route worker evidence and binding', () => {
  // Local explicit harness: OL v1 adapter with a controlled fetcher, an
  // in-memory boundary from the shared fixture, and a recording config stub.
  // Nothing outside this file is touched.
  const setupExplicit = (registry: ReturnType<typeof providerConfigurationSnapshot>) => {
    const fixture = editionWorkerFixture();
    fixture.useUuidLineage();
    fixture.current().providerPolicies = [...(fixture.current().providerPolicies as unknown[]), {
      adapterKey: 'open_library', adapterVersion: '1.0.0', enabled: true, matchingAllowed: true,
      storageAllowed: true, reuseAllowed: true, policyVersion: 1,
    }];
    const urls: URL[] = [];
    const adapter = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000,
      fetcher: async (address: string | URL | Request) => {
        const url = new URL(address instanceof Request ? address.url : String(address));
        urls.push(url);
        const raw = url.pathname === '/search.json' ? { docs: [{ key: '/works/OL1W' }] }
          : url.pathname.endsWith('/editions.json') ? { entries: [{ key: '/books/OL100M',
            title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
            languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'] }] }
          : { key: '/authors/OL1A', name: 'Fixture Author' };
        return new Response(JSON.stringify(raw), { headers: { 'content-type': 'application/json' } });
      },
    });
    const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      if (name === 'phase9_provider_configuration_v1') {
        calls.push({ name, parameters });
        return { data: registry, error: null };
      }
      return fixture.dependencies.serviceClient.rpc(name, parameters);
    };
    const dependencies = {
      ...fixture.dependencies,
      serviceClient: { rpc },
      primary: null,
      primaryCapability: null,
      editionFallback: adapter,
    };
    return { fixture, dependencies, urls, calls };
  };

  const liveLikeRegistry = () => providerConfigurationSnapshot([
    providerConfigurationRow('google_books', '1.0.0'),
    providerConfigurationRow('open_library', '1.0.0'),
  ]);

  it('X1 routes and executes a genuinely fresh explicit job', async () => {
    const { dependencies, urls, calls } = setupExplicit(liveLikeRegistry());
    const result = await runDescriptorWorker(dependencies, installed());
    expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
    // A fresh job performs real provider GETs through the bound v1 adapter.
    expect(urls.map((url) => url.hostname)).toEqual(
      ['openlibrary.org', 'openlibrary.org', 'openlibrary.org'],
    );
    expect(calls.map((call) => call.name)).toContain('phase9_provider_configuration_v1');
  });

  it('X4 fails closed when the route selects a version the configured adapter does not serve', async () => {
    // Same harness as the fresh positive control; only the registry row
    // version differs: OL 2.0.0 is installed and ready, but the configured
    // adapter is v1, so no v1 execution may be relabelled as v2.
    const registry = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0'),
      providerConfigurationRow('open_library', '2.0.0', {
        explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
      }),
    ]);
    const { dependencies, urls } = setupExplicit(registry);
    const result = await runDescriptorWorker(dependencies, installed());
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(urls).toEqual([]);
  });

  it('X1/X2 refuses fresh routing and recovers first for uncertain-send evidence', async () => {
    // The OL explicit role is removed, so no complete lineage can be derived;
    // Google stays installed. Evidence (unresolved outcome_unknown under a new
    // claim) must be recovery-only: recover runs, then refusal, zero egress.
    const registry = providerConfigurationSnapshot([
      providerConfigurationRow('google_books', '1.0.0', {
        explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
      }),
      providerConfigurationRow('open_library', '1.0.0', {
        explicitSearchAllowed: true, explicitRole: null, explicitOrder: null,
      }),
    ]);
    const { fixture, dependencies, urls, calls } = setupExplicit(registry);
    Object.assign(fixture.current(), {
      attempt: 2, claimToken: 'b'.repeat(64),
      currentLookupId: GOLDEN_LOOKUP_ID, currentLookupAdapterKey: 'open_library',
      currentLookupAdapterVersion: '1.0.0',
      currentAttemptId: GOLDEN_ATTEMPT_ID, currentAttemptAdapterKey: 'open_library',
      currentAttemptDisposition: 'unresolved', currentAttemptOutcome: null,
      currentAttemptCandidate: null, currentAttemptProviderRequestId: null,
      currentPhysicalStatus: 'outcome_unknown', currentPhysicalClaimAttempt: 1,
      currentPhysicalOutcome: 'network_failure', currentPhysicalLogicalOutcome: 'network_failure',
      currentPhysicalRetryable: true, currentPhysicalCandidate: null,
      currentPhysicalEvidence: [], currentPhysicalProviderRequestId: null,
    });
    const recover = jest.spyOn(fixture.boundary, 'recover');
    const result = await runDescriptorWorker(dependencies, installed());
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(recover).toHaveBeenCalled();
    expect(urls).toEqual([]);
    expect(calls.map((call) => call.name)).not.toContain(
      'phase9_register_structural_metadata_attempt',
    );
    expect(fixture.saved.size).toBe(0);
  });

  it('X1/X2 recovers a saved completion although no lineage can be derived', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse(GOLDEN_CLOCK));
    try {
      const registry = providerConfigurationSnapshot([
        providerConfigurationRow('google_books', '1.0.0', {
          explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
        }),
        providerConfigurationRow('open_library', '1.0.0', {
          explicitSearchAllowed: true, explicitRole: null, explicitOrder: null,
        }),
      ]);
      const { fixture, dependencies, urls } = setupExplicit(registry);
      Object.assign(fixture.current(), {
        currentLookupId: GOLDEN_LOOKUP_ID, currentLookupAdapterKey: 'open_library',
        currentLookupAdapterVersion: '1.0.0',
        currentAttemptId: GOLDEN_ATTEMPT_ID, currentAttemptAdapterKey: 'open_library',
        currentAttemptDisposition: 'rejected', currentAttemptOutcome: 'coherent_match',
        currentAttemptCandidate: null, currentAttemptProviderRequestId: null,
        currentPhysicalStatus: 'finalized', currentPhysicalClaimAttempt: 1,
        currentPhysicalOutcome: 'coherent_match', currentPhysicalLogicalOutcome: 'coherent_match',
        currentPhysicalRetryable: false, currentPhysicalCandidate: null,
        currentPhysicalEvidence: [], currentPhysicalProviderRequestId: null,
      });
      const rows = OL_V1_EXPLICIT_V1.rows.map((row) => ({ ...row }));
      const companions = OL_V1_EXPLICIT_V1.catalogueCompanions.map((row) => ({ ...row }));
      const saved = {
        ...editionOptionsFence(decodeMetadataJobContext(fixture.current()), fixture.dependencies.workerId),
        lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
        sourceFetchedAt: OL_V1_EXPLICIT_V1.fetchedAt,
        optionsExpiresAt: OL_V1_EXPLICIT_V1.retentionEvidence.permittedDeadlineAt,
        storagePermissionVerified: true as const, rows, catalogueCompanions: companions,
      };
      fixture.saved.set(UUID_CANDIDATE_ID, saved as never);
      const before = JSON.stringify(saved);
      const recover = jest.spyOn(fixture.boundary, 'recover');
      const result = await runDescriptorWorker(dependencies, installed());
      expect(result.results).toEqual([{ outcome: 'edition_options_available' }]);
      expect(recover).toHaveBeenCalled();
      expect(urls).toEqual([]);
      expect(JSON.stringify(fixture.saved.get(UUID_CANDIDATE_ID))).toBe(before);
    } finally {
      jest.useRealTimers();
    }
  });

  it('X1 M93 next-claim retry preserves identity without new egress (positive execution is U5)', async () => {
    // A finalized retryable round-0 attempt under a new, larger claim: the
    // worker must not register a new attempt or perform GETs. Authorizing and
    // executing the round-1 provider round needs U5's begin/reserve/finish
    // wiring; no M93 allowance interface exists for U2 to read.
    const subject = automaticDependencies({
      fetcher: async () => {
        throw new Error('no provider egress is authorized on the U2 path');
      },
      context: {
        attempt: 2,
        claimToken: 'b'.repeat(64),
        currentLookupId: GOLDEN_LOOKUP_ID,
        currentLookupAdapterKey: 'google_books',
        currentLookupAdapterVersion: '1.0.0',
        currentAttemptId: GOLDEN_ATTEMPT_ID,
        currentAttemptAdapterKey: 'google_books',
        currentAttemptDisposition: 'unresolved',
        currentAttemptOutcome: null,
        currentAttemptCandidate: null,
        currentAttemptProviderRequestId: null,
        currentPhysicalStatus: 'finalized',
        currentPhysicalClaimAttempt: 1,
        currentPhysicalOutcome: 'provider_unavailable',
        currentPhysicalLogicalOutcome: 'provider_unavailable',
        currentPhysicalRetryable: true,
        currentPhysicalCandidate: null,
        currentPhysicalEvidence: [],
        currentPhysicalProviderRequestId: 'test-request-id',
      },
    });
    const result = await runDescriptorWorker(subject.dependencies, installed());
    expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
    const names = subject.fixture.calls.map((call) => call.name);
    expect(names).not.toContain('phase9_register_structural_metadata_attempt');
    expect(subject.gets()).toBe(0);
  });

  // U3 fix pass 1: the per-job OL policy binding confers readiness only from
  // a row the resolver may route. Each negative below carries a positive
  // control differing only in the defect.
  const olFallbackAdapter = () => new OpenLibraryEditionOptionsAdapter({
    fetcher: async () => new Response(JSON.stringify({}), {
      headers: { 'content-type': 'application/json' },
    }),
    timeoutMs: 1000, maxResponseBytes: 64000, retentionAllowed: true,
  });
  const unboundInstalled = () => new Map([
    ['open_library@1.0.0', createOpenLibraryV1Descriptor({ adapter: null, policyVersion: null })],
  ]);
  const bindOl = (snapshot: unknown) => bindVerifiedRegistryPolicy(
    unboundInstalled(),
    parseProviderConfigurationSnapshot(snapshot),
    olFallbackAdapter(),
  );
  const olReadiness = (snapshot: unknown) =>
    bindOl(snapshot).get('open_library@1.0.0')?.retentionReady('edition_options') === true;

  it('binds retention readiness only from the single eligible metadata OL row', () => {
    expect(unboundInstalled().get('open_library@1.0.0')
      ?.retentionReady('edition_options')).toBe(false);
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', { policyVersion: 7 }),
    ]))).toBe(true);
  });

  it('never confers readiness from a non-metadata OL row', () => {
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', { providerKind: 'alias', policyVersion: 7 }),
    ]))).toBe(false);
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', { policyVersion: 7 }),
    ]))).toBe(true);
  });

  it('never confers readiness from a disabled OL row', () => {
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', {
        enabled: false, matchingAllowed: false, storageAllowed: false,
        automaticLookupAllowed: false, explicitSearchAllowed: false,
        automaticRole: null, automaticOrder: null,
        explicitRole: null, explicitOrder: null, policyVersion: 7,
      }),
    ]))).toBe(false);
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', { policyVersion: 7 }),
    ]))).toBe(true);
  });

  it('binds nothing when duplicate OL rows qualify', () => {
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', { policyVersion: 7 }),
      providerConfigurationRow('open_library', '1.0.0', { policyVersion: 9 }),
    ]))).toBe(false);
    expect(olReadiness(providerConfigurationSnapshot([
      providerConfigurationRow('open_library', '1.0.0', { policyVersion: 7 }),
    ]))).toBe(true);
  });
});
