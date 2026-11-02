// RED for AC8-9a/AC8-11: the installed descriptor/route and the strict
// p9-metadata-result-v2 result port do not exist in the current worker.
// This file is the approved module-absence red for package 8b-4; the
// behavioural reds for the same package live in the route/OL/environment/
// composition suites.
import fs from 'node:fs';
import path from 'node:path';
import {
  GOOGLE_AUTOMATIC_V1,
  GOLDEN_CLOCK,
  GOLDEN_ATTEMPT_ID,
  GOLDEN_LOOKUP_ID,
} from './fixtures/phase9/providerReplacementGoldens';
import { OL_V1_EXPLICIT_V2_RESULT, OL_V2_AUTOMATIC_EXPECTED } from './fixtures/phase9/providerReplacementTargets';
import {
  OPEN_LIBRARY_SHARED_SOURCE_NOTE,
  installedProviderDescriptor,
  installedProviderDescriptors,
  providerConfigurationRow,
  providerConfigurationSnapshot,
} from './fixtures/phase9/providerConfiguration';
import {
  RESULT_V2_VALIDATOR_EXPORT,
  ROUTE_RESOLVER_EXPORT,
  loadProviderDescriptorModule,
  loadProviderResultModule,
  metadataResultValidationContext,
  providerManifestKey,
  testProviderManifest,
} from './support/providerModules';

const descriptorModule = loadProviderDescriptorModule();
const resultModule = loadProviderResultModule();

const registryRow = (
  adapterKey: string,
  adapterVersion: string,
  purpose: 'automatic' | 'explicit',
  role: 'primary' | null,
) => providerConfigurationRow(adapterKey, adapterVersion, {
  automaticLookupAllowed: purpose === 'automatic',
  automaticRole: purpose === 'automatic' ? role : null,
  automaticOrder: purpose === 'automatic' && role === 'primary' ? 1 : null,
  explicitSearchAllowed: purpose === 'explicit',
  explicitRole: purpose === 'explicit' ? role : null,
  explicitOrder: purpose === 'explicit' && role === 'primary' ? 1 : null,
});

const installed = () => installedProviderDescriptors();

describe('Phase 9 installed provider descriptor and purpose route', () => {
  it('installs providerDescriptor.ts and providerResult.ts', () => {
    expect(descriptorModule).not.toBeNull();
    expect(resultModule).not.toBeNull();
  });

  it('resolves the automatic registry primary to OL v2 while Google stays installed', () => {
    const { [ROUTE_RESOLVER_EXPORT]: resolveProviderRoute } = descriptorModule ?? {};
    expect(resolveProviderRoute).toEqual(expect.any(Function));
    const route = resolveProviderRoute({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([
        registryRow('google_books', '1.0.0', 'automatic', null),
        registryRow('open_library', '2.0.0', 'automatic', 'primary'),
      ]),
      installed: installed(),
      resumed: null,
    });
    expect(route.primary.adapterKey).toBe('open_library');
    expect(route.primary.adapterVersion).toBe('2.0.0');
    expect(route.secondary).toBeNull();
  });

  it('uses the explicit registry role even when Google exposes a retention verifier', () => {
    const { [ROUTE_RESOLVER_EXPORT]: resolveProviderRoute } = descriptorModule ?? {};
    expect(resolveProviderRoute).toEqual(expect.any(Function));
    const route = resolveProviderRoute({
      purpose: 'edition_options',
      registry: providerConfigurationSnapshot([
        registryRow('google_books', '1.0.0', 'explicit', null),
        registryRow('open_library', '2.0.0', 'explicit', 'primary'),
      ]),
      installed: installed(),
      resumed: null,
    });
    expect(route.primary.adapterKey).toBe('open_library');
    expect(route.primary.adapterVersion).toBe('2.0.0');
  });

  it('rejects duplicate roles but fails closed to manual for a valid uninstalled version or unready credentials', () => {
    const { [ROUTE_RESOLVER_EXPORT]: resolveProviderRoute } = descriptorModule ?? {};
    expect(resolveProviderRoute).toEqual(expect.any(Function));
    const duplicate = [
      registryRow('google_books', '1.0.0', 'automatic', 'primary'),
      registryRow('open_library', '2.0.0', 'automatic', 'primary'),
    ];
    expect(() => resolveProviderRoute({
      purpose: 'automatic', registry: providerConfigurationSnapshot(duplicate), installed: installed(), resumed: null,
    })).toThrow('P9_PROVIDER_ROUTE_INVALID');
    // A valid registry snapshot may name an accepted version that this artifact
    // does not install; that is a missing primary, not an invalid configuration.
    const baseContract = (providerConfigurationRow('open_library', '2.0.0') as {
      versionContracts: Record<string, unknown>;
    }).versionContracts['2.0.0'];
    const uninstalled = providerConfigurationRow('open_library', '9.9.9', {
      automaticLookupAllowed: true, automaticRole: 'primary', automaticOrder: 1,
      acceptedAdapterVersions: ['9.9.9'],
      versionContracts: {'9.9.9': baseContract},
      validationContract: 'open-library-v2',
      hostPolicyVersion: 'open-library-hosts-v1',
    });
    expect(resolveProviderRoute({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([uninstalled]),
      installed: installed(),
      resumed: null,
    })).toEqual({manual: true});
    const unready = installed();
    unready.set('open_library@2.0.0', installedProviderDescriptor('open_library', '2.0.0', {
      credentialsReady: () => false,
    }));
    expect(resolveProviderRoute({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([registryRow('open_library', '2.0.0', 'automatic', 'primary')]),
      installed: unready,
      resumed: null,
    })).toEqual({manual: true});
  });

  it('refuses an OL v1 automatic route instead of advertising lookup() support', () => {
    const { [ROUTE_RESOLVER_EXPORT]: resolveProviderRoute } = descriptorModule ?? {};
    expect(resolveProviderRoute).toEqual(expect.any(Function));
    expect(resolveProviderRoute({
      purpose: 'automatic',
      registry: providerConfigurationSnapshot([registryRow('open_library', '1.0.0', 'automatic', 'primary')]),
      installed: installed(),
      resumed: null,
    })).toEqual({ manual: true });
  });

  it('pins a complete resumed v1 explicit lineage to the exact installed version while v2 is active', () => {
    const { [ROUTE_RESOLVER_EXPORT]: resolveProviderRoute } = descriptorModule ?? {};
    expect(resolveProviderRoute).toEqual(expect.any(Function));
    const route = resolveProviderRoute({
      purpose: 'edition_options',
      registry: providerConfigurationSnapshot([
        providerConfigurationRow('open_library', '2.0.0', {
          explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
        }),
      ]),
      installed: installed(),
      resumed: {
        adapterKey: 'open_library',
        adapterVersion: '1.0.0',
        purpose: 'edition_options',
        role: 'primary',
        sequence: 1,
        lookupId: GOLDEN_LOOKUP_ID,
        attemptId: GOLDEN_ATTEMPT_ID,
        claimAttempt: 1,
        policyVersion: 1,
      },
    });
    expect(route.primary).toMatchObject({
      adapterKey: 'open_library', adapterVersion: '1.0.0',
    });
    expect(route.primary.adapterVersion).toBe('1.0.0');
    expect(route.policyVersions).toBeDefined();
  });

  it('rejects a resumed version that the active registry row has not accepted', () => {
    const { [ROUTE_RESOLVER_EXPORT]: resolveProviderRoute } = descriptorModule ?? {};
    expect(resolveProviderRoute).toEqual(expect.any(Function));
    expect(() => resolveProviderRoute({
      purpose: 'edition_options',
      registry: providerConfigurationSnapshot([
        providerConfigurationRow('open_library', '1.0.0', {
          explicitSearchAllowed: true, explicitRole: 'primary', explicitOrder: 1,
        }),
      ]),
      installed: installed(),
      resumed: {
        adapterKey: 'open_library',
        adapterVersion: '2.0.0',
        purpose: 'edition_options',
        role: 'primary',
        sequence: 1,
        lookupId: GOLDEN_LOOKUP_ID,
        attemptId: GOLDEN_ATTEMPT_ID,
        claimAttempt: 1,
        policyVersion: 1,
      },
    })).toThrow();
  });
});

describe('Phase 9 provider configuration fixture drift', () => {
  const migrationText = (name: string) => fs.readFileSync(path.join(__dirname, '..', '..',
    'migrations', name), 'utf8').replace(/\r\n/gu, '\n');

  it('keeps the recorded OL shared source note equal to M83', () => {
    expect(migrationText('20261026000083_marketplace_phase9_lean_catalogue_identity.sql'))
      .toContain(`SET shared_source_note=\n '${OPEN_LIBRARY_SHARED_SOURCE_NOTE}'`);
  });

  it('keeps every fixture DTO key in the M89 service read', () => {
    const serviceRead = migrationText(
      '20261031000089_marketplace_phase9_provider_registry_policy.sql',
    );
    for (const key of Object.keys(providerConfigurationRow('open_library', '2.0.0'))) {
      expect(serviceRead).toContain(`'${key}'`);
    }
  });
});

describe('Phase 9 strict p9-metadata-result-v2 envelope', () => {
  const validate = () => resultModule?.[RESULT_V2_VALIDATOR_EXPORT];
  const installed = () => testProviderManifest();
  // Trusted invocation context: UUIDs, installed descriptor and provider-owned
  // validation come from the harness, never from the packet under test.
  const contextFor = (
    purpose: 'automatic' | 'edition_options',
    adapterKey: string,
    adapterVersion: string,
    retentionEvidence: unknown = null,
    overrides: Record<string, unknown> = {},
  ) => {
    const manifest = installed();
    const descriptor = manifest.get(providerManifestKey(adapterKey, adapterVersion));
    expect(descriptor).toBeDefined();
    return metadataResultValidationContext({
    purpose,
    descriptor,
    installed: manifest,
    lookupId: GOLDEN_LOOKUP_ID,
    attemptId: GOLDEN_ATTEMPT_ID,
    now: GOLDEN_CLOCK,
    retentionEvidence: retentionEvidence as never,
    ...overrides,
    });
  };
  // The SDD does not decide whether a validator returns its input, a parsed
  // copy or a boolean. In every shape the accepted packet must survive: no
  // key dropped, and [] never collapsed to null.
  const preserved = (input: unknown, context: Record<string, unknown>) => {
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    const output = (validate() as Function)(input, context);
    expect(input).toEqual(snapshot);
    if (typeof output === 'boolean') expect(output).toBe(true);
    else if (output !== undefined) expect(output).toEqual(snapshot);
  };
  const rejected = (input: unknown, context: Record<string, unknown>,
    code = 'P9_PROVIDER_RESULT_INVALID') => {
    expect(() => (validate() as Function)(input, context)).toThrow(code);
  };

  it('accepts the target OL v2 packet through a test-only installed v2 descriptor', () => {
    expect(validate()).toEqual(expect.any(Function));
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    preserved(OL_V2_AUTOMATIC_EXPECTED, context);
  });

  it('accepts the Google transition packet with all retainable fields null', () => {
    expect(validate()).toEqual(expect.any(Function));
    const packet = {
      version: 'p9-metadata-result-v2',
      purpose: 'automatic',
      outcome: GOOGLE_AUTOMATIC_V1,
      rows: null,
      catalogueCompanions: null,
      retention: null,
    };
    preserved(packet, contextFor('automatic', 'google_books', '1.0.0'));
  });

  it('accepts a verified empty list as [] rather than collapsing it to null', () => {
    expect(validate()).toEqual(expect.any(Function));
    const packet = {
      ...OL_V2_AUTOMATIC_EXPECTED,
      rows: [],
      catalogueCompanions: [],
      outcome: {
        ...OL_V2_AUTOMATIC_EXPECTED.outcome,
        outcome: 'no_acceptable_match',
        candidates: [],
        selected: null,
        evidence: [],
        secondaryEligible: true,
        representativeCover: null,
      },
    };
    preserved(packet, contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention));
  });

  it('accepts the retained v1 explicit wrapper with its original rows and companions', () => {
    expect(validate()).toEqual(expect.any(Function));
    preserved(OL_V1_EXPLICIT_V2_RESULT, contextFor('edition_options', 'open_library', '1.0.0',
      OL_V1_EXPLICIT_V2_RESULT.retention));
  });

  it('rejects a packet whose purpose does not match the invocation', () => {
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    // Positive control differs only in the purpose binding.
    expect(() => (validate() as Function)(OL_V2_AUTOMATIC_EXPECTED, context)).not.toThrow();
    rejected(OL_V2_AUTOMATIC_EXPECTED, contextFor('edition_options', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention));
  });

  it('rejects an unknown version with the version-specific refusal', () => {
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    expect(() => (validate() as Function)(OL_V2_AUTOMATIC_EXPECTED, context)).not.toThrow();
    rejected({ ...OL_V2_AUTOMATIC_EXPECTED, version: 'p9-metadata-result-v1' }, context,
      'P9_PROVIDER_RESULT_VERSION_INVALID');
  });

  it('rejects unknown envelope keys and a crossed retention contract', () => {
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    expect(() => (validate() as Function)(OL_V2_AUTOMATIC_EXPECTED, context)).not.toThrow();
    rejected({ ...OL_V2_AUTOMATIC_EXPECTED, rawProviderPayload: { secret: true } }, context);
    rejected({
      ...OL_V2_AUTOMATIC_EXPECTED,
      retention: {
        ...OL_V2_AUTOMATIC_EXPECTED.retention,
        retentionContract: 'google-books-options-v1',
      },
    }, context);
  });

  it('requires rows, companions and retention to be null together', () => {
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    expect(() => (validate() as Function)(OL_V2_AUTOMATIC_EXPECTED, context)).not.toThrow();
    rejected({ ...OL_V2_AUTOMATIC_EXPECTED, rows: null }, context);
    rejected({ ...OL_V2_AUTOMATIC_EXPECTED, retention: null }, context);
    rejected({ ...OL_V2_AUTOMATIC_EXPECTED, catalogueCompanions: null }, context);
  });

  it('rejects a row and companion that do not belong to the installed provider', () => {
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    expect(() => (validate() as Function)(OL_V2_AUTOMATIC_EXPECTED, context)).not.toThrow();
    rejected({
      ...OL_V2_AUTOMATIC_EXPECTED,
      rows: [{
        ...OL_V2_AUTOMATIC_EXPECTED.rows[0],
        metadata: {
          ...OL_V2_AUTOMATIC_EXPECTED.rows[0].metadata,
          adapterKey: 'google_books',
        },
      }],
      outcome: {
        ...OL_V2_AUTOMATIC_EXPECTED.outcome,
        candidates: [{
          ...OL_V2_AUTOMATIC_EXPECTED.outcome.selected,
          adapterKey: 'google_books',
        }],
        selected: {
          ...OL_V2_AUTOMATIC_EXPECTED.outcome.selected,
          adapterKey: 'google_books',
        },
      },
    }, context);
  });

  it('rejects a packet bound to a different lookup or attempt than the invocation', () => {
    const context = contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention);
    expect(() => (validate() as Function)(OL_V2_AUTOMATIC_EXPECTED, context)).not.toThrow();
    const otherLookup = '33333333-3333-4333-8333-000000000001';
    const otherAttempt = '33333333-3333-4333-8333-000000000002';
    rejected(OL_V2_AUTOMATIC_EXPECTED, contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention, { lookupId: otherLookup }));
    rejected(OL_V2_AUTOMATIC_EXPECTED, contextFor('automatic', 'open_library', '2.0.0',
      OL_V2_AUTOMATIC_EXPECTED.retention, { attemptId: otherAttempt }));
    rejected({
      ...OL_V2_AUTOMATIC_EXPECTED,
      rows: [{
        ...OL_V2_AUTOMATIC_EXPECTED.rows[0],
        metadata: { ...OL_V2_AUTOMATIC_EXPECTED.rows[0].metadata, correlationId: otherLookup },
      }],
    }, context);
  });
});
