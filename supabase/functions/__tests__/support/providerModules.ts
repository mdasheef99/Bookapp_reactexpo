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

export function descriptorOptionsGateway(
  fixture: AnyModule,
  descriptor: AnyModule,
  // U6 fix1 (F14): optional registry request hosts from the test's registry
  // row. The frozen two-argument callers keep working (documented default
  // below); new tests pass the row's hosts explicitly for intersection and
  // negative controls.
  options: AnyModule = {},
) {
  // R1 (U6, Owner-approved narrowly): the synthetic descriptor's
  // request-host/path/stage validator is INJECTED here as an explicit test
  // dependency, bound to the descriptor's EXACT approved tuple plus the
  // registry row hosts. No global mutable validator registry; production
  // never contains or recognises `synthetic_catalogue`. Identifiers and
  // registry hosts alone never define compiled trust: this validator
  // independently declares the exact trusted tuple (HTTPS, path /discover,
  // stage discover, sequence 0, no credentials/port/fragment) for THIS
  // descriptor instance, and the port intersects registry hosts afterwards.
  // F14: exact values verified against the synthetic descriptor
  // (phase9_metadata_edition_options_worker.test.ts:216-221).
  const hostPolicyVersion = descriptor.hostPolicyVersion;
  const validationContract = descriptor.validationContract;
  if (hostPolicyVersion !== 'synthetic-hosts-v1'
    || validationContract !== 'synthetic-catalogue-v1') {
    throw new Error('P9_PROVIDER_CONFIGURATION_INVALID');
  }
  // The frozen two-argument callers declare catalogue.example.test in their
  // registry rows (phase9_metadata_edition_options_worker.test.ts:243-244);
  // that documented default is preserved for them. Callers proving
  // intersection pass the row's hosts explicitly.
  const declaredHosts: readonly string[] = Array.isArray(options?.registryRequestHosts)
    && (options.registryRequestHosts as unknown[]).every((host) => typeof host === 'string')
    ? [...(options.registryRequestHosts as string[])]
    : ['catalogue.example.test'];
  const requestValidator = (url: URL, stage: string, sequence: number) => {
    if (url.protocol !== 'https:' || url.username !== '' || url.password !== ''
      || url.port !== '' || url.hash !== '') {
      throw new Error('insufficient_query');
    }
    if (!declaredHosts.includes(url.hostname) || url.pathname !== '/discover'
      || stage !== 'discover' || sequence !== 0) {
      throw new Error('insufficient_query');
    }
  };
  return fixture.direct({
    adapterKey: descriptor.adapterKey, adapterVersion: descriptor.adapterVersion,
    capabilityVersion: descriptor.capabilityVersion,
    normalizerVersion: descriptor.normalizerVersion,
    schemaVersion: descriptor.lookupSchemaVersion,
    primary: descriptor,
    explicitDescriptor: { descriptor, adapter: null, fallbackAdapter: null },
    explicitHttp: {
      policy: require('./providerProtection').TEST_ONLY_PROTECTION_POLICY,
      requestValidator, requestHosts: [...declaredHosts],
      timeoutMs: 1000, maxResponseBytes: 64000,
      retentionPolicyVersion: 1,
    },
  });
}

export function bootstrapOpenLibraryOnly(environment: Record<string, string | undefined>, fetcher: typeof fetch) {
  const { loadMetadataWorkerEnvironment } = require('../../../../workers/phase9-runtime/environment');
  const { createMetadataProductionDependencies } = require('../../../../workers/phase9-metadata-worker/bootstrap');
  // The environment spelling is provisional and centralised. Parse it through
  // the real loader, including its credential/target validation; never cast a
  // fabricated configuration or implement a bootstrap fallback in this helper.
  const configuration = loadMetadataWorkerEnvironment({
    ...environment, PHASE9_METADATA_PROVIDER_MODE: 'real',
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
