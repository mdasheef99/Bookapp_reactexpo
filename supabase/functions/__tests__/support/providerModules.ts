// Provisional test seams for package 8b-4. The SDD §5.1 names the module
// paths but not every exported symbol (installed manifest, validator). Keep
// every such name here so the builder can rename it in one place later.
// These are not Owner decisions.
type AnyModule = Record<string, any>;

function load(path: string): AnyModule | null {
  let resolved: string;
  try {
    resolved = require.resolve(path);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    // Resolution does not evaluate imports. Only the exact target can be
    // absent here; evaluation/transitive failures below must surface.
    if (code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }
  return require(resolved) as AnyModule;
}

export function loadProviderDescriptorModule(): AnyModule | null {
  return load('../../_shared/imageInventory/metadata/providerDescriptor');
}

export function loadProviderResultModule(): AnyModule | null {
  return load('../../_shared/imageInventory/metadata/providerResult');
}

export function loadProviderHttpModule(): AnyModule | null {
  return load('../../_shared/imageInventory/metadata/providerHttp');
}

export function loadProviderValidationModule(): AnyModule | null {
  return load('../../_shared/imageInventory/metadata/providerValidation');
}

// Trusted invocation context for the result boundary. Every field consumed by
// MetadataResultValidationContext is supplied here from the test harness, never
// inferred from the packet under test.
export function metadataResultValidationContext(input: Readonly<{
  purpose: 'automatic' | 'edition_options';
  descriptor: AnyModule;
  installed: ReadonlyMap<string, AnyModule>;
  providerValidation?: AnyModule;
  lookupId: string;
  attemptId: string;
  now: string;
  retentionEvidence?: AnyModule | null;
}>) {
  return Object.freeze({
    purpose: input.purpose,
    descriptor: input.descriptor,
    installed: input.installed,
    providerValidation: input.providerValidation
      ?? installedProviderValidationFor(input.descriptor.adapterKey, input.descriptor.adapterVersion),
    lookupId: input.lookupId,
    attemptId: input.attemptId,
    now: input.now,
    retentionEvidence: input.retentionEvidence ?? null,
  });
}

// The production manifest installs OL v1; a v2 packet test must use an explicit
// test-only installed descriptor/validation pair rather than pretend v2 shipped.
// Test-only installed manifest. It includes an explicitly synthetic OL 2.0.0
// descriptor so result/route contracts can be exercised before U4 ships it;
// this never claims the production manifest contains v2.
export function testProviderManifest(): ReadonlyMap<string, AnyModule> {
  return require('../fixtures/phase9/providerConfiguration').installedProviderDescriptors();
}

export function installedProviderValidationFor(
  adapterKey: string,
  adapterVersion: string,
): AnyModule | undefined {
  const validations = loadProviderValidationModule()?.PHASE9_PROVIDER_VALIDATIONS ?? [];
  const exact = validations.find((value: AnyModule) =>
    value.adapterKey === adapterKey && value.adapterVersion === adapterVersion);
  if (exact) return exact;
  const predecessor = validations.find((value: AnyModule) =>
    value.adapterKey === adapterKey && value.adapterVersion === '1.0.0');
  if (predecessor && adapterKey === 'open_library' && adapterVersion === '2.0.0') {
    return Object.freeze({ ...predecessor, adapterVersion: '2.0.0',
      validationContract: 'open-library-v2' });
  }
  return undefined;
}

// One observation point for every installed-descriptor request, independent of
// which transport/boot path the worker chose. The wrapped descriptor still
// delegates to the supplied port, so zero-egress cases cannot hide a GET.
export function observedInstalledManifest(
  installed: ReadonlyMap<string, AnyModule>,
  observe: (call: { url?: URL; stage?: string; sequence?: number }) => void,
): ReadonlyMap<string, AnyModule> {
  const observed = new Map<string, AnyModule>();
  for (const [key, descriptor] of installed) {
    observed.set(key, {
      ...descriptor,
      invoke: async (input: AnyModule) => descriptor.invoke({
        ...input,
        http: {
          get: async (call: AnyModule) => {
            observe(call);
            return input.http.get(call);
          },
        },
      }),
    });
  }
  return observed;
}

export const INSTALLED_PROVIDERS_EXPORT = 'PHASE9_METADATA_INSTALLED_PROVIDERS';
export const RESULT_V2_VALIDATOR_EXPORT = 'validateMetadataResultV2';
export const ROUTE_RESOLVER_EXPORT = 'resolveProviderRoute';
export const CREATE_PROVIDER_HTTP_PORT_EXPORT = 'createProviderHttpPort';
export const providerManifestKey = (adapterKey: string, adapterVersion: string) =>
  `${adapterKey}@${adapterVersion}`;

export function installedDescriptor(
  adapterKey: string,
  adapterVersion: string,
): AnyModule | undefined {
  const installed = loadProviderDescriptorModule()?.[INSTALLED_PROVIDERS_EXPORT];
  const key = providerManifestKey(adapterKey, adapterVersion);
  if (installed instanceof Map) return installed.get(key);
  if (Array.isArray(installed)) {
    return installed.find((value) => value?.adapterKey === adapterKey
      && value?.adapterVersion === adapterVersion);
  }
  return installed?.[key];
}

export function installedManifest(): ReadonlyMap<string, unknown> {
  const installed = loadProviderDescriptorModule()?.[INSTALLED_PROVIDERS_EXPORT];
  if (installed instanceof Map) return installed;
  if (Array.isArray(installed)) return new Map(installed.map(d => [
    providerManifestKey(d.adapterKey, d.adapterVersion), d,
  ]));
  return new Map(Object.entries(installed ?? {}));
}

// Provisional dependency/constructor seams, not behaviour. Adapt these names
// when 8b chooses its wiring; all routes, HTTP and completion still execute
// production code. No test-side routing, retry or result conversion lives here.
export function runDescriptorWorker(dependencies: AnyModule, installed: ReadonlyMap<string, unknown>) {
  return require('../../../../workers/phase9-metadata-worker').runMetadataWorkerBatch(
    1, { ...dependencies, installed },
  );
}

export function createTestHttpPort(configuration: AnyModule) {
  const create = loadProviderHttpModule()?.[CREATE_PROVIDER_HTTP_PORT_EXPORT];
  expect(create).toEqual(expect.any(Function));
  const { GOLDEN_LOOKUP_ID, GOLDEN_ATTEMPT_ID } = require('../fixtures/phase9/providerReplacementGoldens');
  return create({
    lookupId: GOLDEN_LOOKUP_ID, attemptId: GOLDEN_ATTEMPT_ID,
    claim: { jobId: '00000000-0000-4000-8000-000000000001',
      worker: 'metadata-worker-fixture-0001', leaseToken: 'a'.repeat(64), claimAttempt: 1 },
    ...configuration,
  });
}

export function executeDescriptorOptions(context: unknown, gateway: unknown, descriptor: unknown) {
  return require('../../_shared/imageInventory/runtime/metadataEditionOptions')
    .executeEditionOptionsLookup(context, gateway, descriptor, new AbortController().signal);
}

export function descriptorOptionsGateway(fixture: AnyModule, descriptor: AnyModule) {
  return fixture.direct({
    adapterKey: descriptor.adapterKey, adapterVersion: descriptor.adapterVersion,
    capabilityVersion: descriptor.capabilityVersion,
    normalizerVersion: descriptor.normalizerVersion,
    schemaVersion: descriptor.lookupSchemaVersion,
    primary: descriptor,
  });
}

// The old pure composition remains a compatibility entry; the new automatic
// transaction is tested via the runnable worker + service RPC, never this port.
export function runLegacyMetadataComposition(...args: unknown[]) {
  const composition = require('../../_shared/imageInventory/runtime/metadataProductionComposition');
  if (typeof composition.runMetadataProductionComposition !== 'function') {
    throw new Error('P9_LEGACY_COMPOSITION_UNAVAILABLE');
  }
  return composition.runMetadataProductionComposition(...args);
}

// A compliant 8b refactor may move the legacy composition behind a different
// internal entry. These old controls are optional compatibility evidence, not a
// mandate that the pre-8b function/gateway shape survive unchanged.
const LEGACY_COMPOSITION_ENTRY = '../../_shared/imageInventory/runtime/metadataProductionComposition';
export type LegacyMetadataCompositionStatus =
  | Readonly<{ available: true }>
  | Readonly<{ available: false; reason: string }>;

// Skip only the exact compatibility entry being absent or lacking its export.
// A missing nested dependency, syntax error or runtime error must surface.
export function legacyMetadataCompositionStatus(): LegacyMetadataCompositionStatus {
  let resolved: string;
  try {
    resolved = require.resolve(LEGACY_COMPOSITION_ENTRY);
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    if (failure.code === 'MODULE_NOT_FOUND'
      && (failure.message ?? '').includes(LEGACY_COMPOSITION_ENTRY)) {
      return { available: false, reason: `legacy entry ${LEGACY_COMPOSITION_ENTRY} is absent` };
    }
    throw error;
  }
  const composition = require(resolved) as AnyModule;
  if (typeof composition.runMetadataProductionComposition !== 'function') {
    return { available: false,
      reason: `legacy entry ${LEGACY_COMPOSITION_ENTRY} lacks runMetadataProductionComposition` };
  }
  return { available: true };
}

export function bootstrapOpenLibraryOnly(environment: Record<string, string | undefined>, fetcher: typeof fetch) {
  const { loadMetadataWorkerEnvironment } = require('../../../../workers/phase9-runtime/environment');
  const { createMetadataProductionDependencies } = require('../../../../workers/phase9-metadata-worker/bootstrap');
  // The environment spelling is provisional and centralised. Parse it through
  // the real loader, including its credential/target validation; never cast a
  // fabricated configuration or implement a bootstrap fallback in this helper.
  const configuration = loadMetadataWorkerEnvironment({
    ...environment, PHASE9_METADATA_PROVIDER_MODE: 'open_library',
  });
  return createMetadataProductionDependencies(configuration, fetcher);
}

export function bootstrapGoogle(environment: Record<string, string | undefined>, fetcher: typeof fetch) {
  const { loadMetadataWorkerEnvironment } = require('../../../../workers/phase9-runtime/environment');
  const { createMetadataProductionDependencies } = require('../../../../workers/phase9-metadata-worker/bootstrap');
  return createMetadataProductionDependencies(loadMetadataWorkerEnvironment({
    ...environment, PHASE9_METADATA_PROVIDER_MODE: 'google_books',
    PHASE9_GOOGLE_BOOKS_API_KEY: 'fixture-only-no-network-key-long-enough-A7z.49',
    PHASE9_GOOGLE_BOOKS_TIMEOUT_MS: '1000',
    PHASE9_GOOGLE_BOOKS_MAX_RESPONSE_BYTES: '64000',
  }), fetcher);
}
