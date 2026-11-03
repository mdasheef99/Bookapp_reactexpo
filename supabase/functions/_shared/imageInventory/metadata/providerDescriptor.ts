import type { CatalogueWriteCompanion } from '../contracts/catalogueWrite';
import type { StoredEditionRow } from '../contracts/ownerEditionPicker';
import type { MetadataQueryIdentity } from './queryIdentity';
import type { MetadataProviderOutcome } from './providerAdapter';
import { createGoogleBooksDescriptor } from './googleBooks/descriptor';
import { createOpenLibraryV1Descriptor } from './openLibrary/descriptor';

export type Purpose = 'automatic' | 'edition_options';
export type RetentionContractId = string;
export type ProviderResultVersion = 'p9-metadata-result-v2';
export const PROVIDER_RESULT_VERSION: ProviderResultVersion = 'p9-metadata-result-v2';

export type ProviderHttpResponse = Readonly<{
  json: unknown;
  headers: Headers;
  receiptId: string;
}>;

export type ProviderHttpPort = Readonly<{
  get(input: Readonly<{
    url: URL;
    stage: string;
    sequence: number;
    signal: AbortSignal;
  }>): Promise<ProviderHttpResponse>;
}>;

export type LookupInput = Readonly<{
  query: MetadataQueryIdentity;
  correlationId: string;
  attemptId: string;
  signal: AbortSignal;
  purpose: Purpose;
  http: ProviderHttpPort;
}>;

export type RetainedList = Readonly<{
  sourceFetchedAt: string;
  permittedDeadlineAt: string;
  policyVersion: number;
  storagePermissionVerified: true;
  retentionContract: RetentionContractId;
}>;

// Trusted output of the installed verifier, bound to the actual response
// headers. It contains no self-asserted permission flag: the result boundary
// requires this evidence before accepting any retained list.
export type VerifiedRetention = Readonly<{
  sourceFetchedAt: string;
  permittedDeadlineAt: string;
  policyVersion: number;
  retentionContract: RetentionContractId;
}>;

export type MetadataResultV2 = Readonly<{
  version: ProviderResultVersion;
  purpose: Purpose;
  outcome: MetadataProviderOutcome;
  rows: readonly StoredEditionRow[] | null;
  catalogueCompanions: readonly CatalogueWriteCompanion[] | null;
  retention: RetainedList | null;
}>;

export type ProviderProtocol =
  | Readonly<{ kind: 'single'; maxGets: 1 }>
  | Readonly<{ kind: 'fanout'; maxGets: 6 }>;

export type ProviderDescriptor = Readonly<{
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  normalizerVersion: string;
  payloadSchemaVersion: string;
  lookupSchemaVersion: string;
  validationContract: string;
  hostPolicyVersion: string;
  retentionContract: RetentionContractId | null;
  protocol: ProviderProtocol;
  purposes: readonly Purpose[];
  credentialsReady(): boolean;
  retentionReady(purpose: Purpose): boolean;
  invoke(input: LookupInput): Promise<MetadataResultV2>;
}>;

export const providerManifestKey = (adapterKey: string, adapterVersion: string): string =>
  `${adapterKey}@${adapterVersion}`;

export const PHASE9_METADATA_INSTALLED_PROVIDERS: ReadonlyMap<string, ProviderDescriptor> =
  new Map<string, ProviderDescriptor>([
    [providerManifestKey('google_books', '1.0.0'), createGoogleBooksDescriptor({ adapter: null })],
    [providerManifestKey('open_library', '1.0.0'), createOpenLibraryV1Descriptor({ adapter: null })],
  ]);

// 02c §5.1 route block (U2). The resolver runs before any network call and
// intersects the database registry snapshot with the installed manifest.
// Google stays the automatic primary in live data; nothing here changes which
// provider serves a job except where the registry says so.
export const PROVIDER_CONFIGURATION_VERSION = 'p9-provider-configuration-v1';
export const P9_PROVIDER_CONFIGURATION_INVALID = 'P9_PROVIDER_CONFIGURATION_INVALID';
export const P9_PROVIDER_ROUTE_INVALID = 'P9_PROVIDER_ROUTE_INVALID';

export type RegistryVersionContracts = Readonly<Record<string, Readonly<Record<string, string>>>>;

export type RegistryProviderRow = Readonly<{
  adapterKey: string;
  // Preserved from the DTO (M01:6 CHECK IN ('vision','metadata','alias'));
  // only 'metadata' rows are routable by this worker.
  providerKind: string;
  adapterVersion: string;
  enabled: boolean;
  matchingAllowed: boolean;
  storageAllowed: boolean;
  automaticLookupAllowed: boolean;
  explicitSearchAllowed: boolean;
  automaticRole: 'primary' | 'secondary' | null;
  explicitRole: 'primary' | 'secondary' | null;
  automaticOrder: 1 | 2 | null;
  explicitOrder: 1 | 2 | null;
  acceptedAdapterVersions: readonly string[];
  versionContracts: RegistryVersionContracts;
  policyVersion: number;
}>;

export type RegistrySnapshot = Readonly<{
  version: typeof PROVIDER_CONFIGURATION_VERSION;
  providers: readonly RegistryProviderRow[];
}>;

// Locked lookup/attempt provider/version/role/sequence/claim/policy identity.
// Never a client object; the worker derives it from context columns only and
// never invents a version or reuses the active registry version as history.
export type Lineage = Readonly<{
  adapterKey: string;
  adapterVersion: string;
  purpose: Purpose;
  role: 'primary' | 'secondary';
  sequence: 1 | 2;
  lookupId: string;
  attemptId: string;
  claimAttempt: number;
  policyVersion: number;
}>;

export type RouteInput = Readonly<{
  purpose: Purpose;
  registry: RegistrySnapshot;
  installed: ReadonlyMap<string, ProviderDescriptor>;
  resumed: Lineage | null;
}>;

export type Route = Readonly<{
  primary: ProviderDescriptor;
  secondary: ProviderDescriptor | null;
  policyVersions: Readonly<Record<string, number>>;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isRole = (value: unknown): value is 'primary' | 'secondary' | null =>
  value === null || value === 'primary' || value === 'secondary';

const isOrder = (value: unknown): value is 1 | 2 | null =>
  value === null || value === 1 || value === 2;

function invalidConfiguration(): never {
  throw new Error(P9_PROVIDER_CONFIGURATION_INVALID);
}

function invalidRoute(): never {
  throw new Error(P9_PROVIDER_ROUTE_INVALID);
}

function assertRegistrySnapshot(registry: unknown): asserts registry is RegistrySnapshot {
  if (!isRecord(registry) || registry.version !== PROVIDER_CONFIGURATION_VERSION
    || !Array.isArray(registry.providers)) invalidConfiguration();
  for (const row of registry.providers as unknown[]) {
    if (!isRecord(row)
      || typeof row.adapterKey !== 'string' || row.adapterKey.length === 0
      || typeof row.adapterVersion !== 'string' || row.adapterVersion.length === 0
      || typeof row.enabled !== 'boolean'
      || typeof row.matchingAllowed !== 'boolean'
      || typeof row.storageAllowed !== 'boolean'
      || typeof row.automaticLookupAllowed !== 'boolean'
      || typeof row.explicitSearchAllowed !== 'boolean'
      || !isRole(row.automaticRole) || !isRole(row.explicitRole)
      || !isOrder(row.automaticOrder) || !isOrder(row.explicitOrder)
      || (row.automaticRole === null) !== (row.automaticOrder === null)
      || (row.explicitRole === null) !== (row.explicitOrder === null)
      || (row.automaticRole === 'primary' && row.automaticOrder !== 1)
      || (row.automaticRole === 'secondary' && row.automaticOrder !== 2)
      || (row.explicitRole === 'primary' && row.explicitOrder !== 1)
      || (row.explicitRole === 'secondary' && row.explicitOrder !== 2)
      || (row.automaticRole !== null && row.automaticLookupAllowed !== true)
      || (row.explicitRole !== null && row.explicitSearchAllowed !== true)
      || !Array.isArray(row.acceptedAdapterVersions)
      || !isRecord(row.versionContracts)
      || typeof row.policyVersion !== 'number'
      || !Number.isSafeInteger(row.policyVersion) || row.policyVersion < 1) {
      invalidConfiguration();
    }
    const accepted = row.acceptedAdapterVersions as unknown[];
    if (accepted.some((version) => typeof version !== 'string')
      || new Set(accepted).size !== accepted.length) invalidConfiguration();
    // X6: the resolver enforces the same accepted-version/contract agreement
    // as the parser (M89:64-94), so a directly supplied snapshot cannot route
    // a version the registry row did not accept. Valid unconfigured rows
    // (empty accepted versions/contracts, permissions false per M89:83-88)
    // are preserved: they pass and simply never route.
    const contracts = row.versionContracts as Record<string, unknown>;
    const contractKeys = Object.keys(contracts);
    if (accepted.length === 0) {
      if (row.automaticLookupAllowed === true || row.explicitSearchAllowed === true
        || (row as Record<string, unknown>).sharedCatalogueAllowed === true
        || row.validationContract !== null && row.validationContract !== undefined
        || row.hostPolicyVersion !== null && row.hostPolicyVersion !== undefined
        || contractKeys.length > 0) {
        invalidConfiguration();
      }
    } else {
      const active = row.adapterVersion as string;
      if (!accepted.includes(active) || !isRecord(contracts[active])) {
        invalidConfiguration();
      }
    }
  }
}

function assertLineage(resumed: unknown, purpose: Purpose): asserts resumed is Lineage {
  if (!isRecord(resumed)
    || typeof resumed.adapterKey !== 'string' || resumed.adapterKey.length === 0
    || typeof resumed.adapterVersion !== 'string' || resumed.adapterVersion.length === 0
    || resumed.purpose !== purpose
    || (resumed.role !== 'primary' && resumed.role !== 'secondary')
    || (resumed.role === 'primary' && resumed.sequence !== 1)
    || (resumed.role === 'secondary' && resumed.sequence !== 2)
    || typeof resumed.lookupId !== 'string' || !UUID_PATTERN.test(resumed.lookupId)
    || typeof resumed.attemptId !== 'string' || !UUID_PATTERN.test(resumed.attemptId)
    || typeof resumed.claimAttempt !== 'number'
    || !Number.isSafeInteger(resumed.claimAttempt) || resumed.claimAttempt < 1
    || typeof resumed.policyVersion !== 'number'
    || !Number.isSafeInteger(resumed.policyVersion) || resumed.policyVersion < 1) {
    invalidRoute();
  }
}

const CONTRACT_TUPLE_KEYS = [
  'validationContract', 'hostPolicyVersion', 'capabilityVersion',
  'normalizerVersion', 'payloadSchemaVersion', 'lookupSchemaVersion',
] as const;

export function tupleMatches(
  descriptor: ProviderDescriptor,
  tuple: unknown,
): boolean {
  if (!isRecord(tuple)) return false;
  return CONTRACT_TUPLE_KEYS.every((key) =>
    typeof tuple[key] === 'string'
    && (descriptor as unknown as Record<string, unknown>)[key] === tuple[key]);
}

// One eligible registry row bound to its exact installed descriptor. Returns
// null when the version is not installed, the descriptor does not serve this
// purpose, its version-contracts tuple diverges, its credentials are not
// ready, or (explicit only) its retention is not ready. Automatic Google
// eligibility never requires a list verifier.
function bindRow(
  row: RegistryProviderRow,
  adapterVersion: string,
  installed: ReadonlyMap<string, ProviderDescriptor>,
  purpose: Purpose,
): ProviderDescriptor | null {
  const descriptor = installed.get(providerManifestKey(row.adapterKey, adapterVersion));
  if (descriptor === undefined) return null;
  // The installed map is keyed key@version; a mis-keyed entry must never route
  // a different provider or version.
  if (descriptor.adapterKey !== row.adapterKey
    || descriptor.adapterVersion !== adapterVersion) {
    return null;
  }
  if (!descriptor.purposes.includes(purpose)) return null;
  if (!tupleMatches(descriptor, row.versionContracts[adapterVersion])) return null;
  if (descriptor.credentialsReady() !== true) return null;
  if (purpose === 'edition_options' && descriptor.retentionReady('edition_options') !== true) {
    return null;
  }
  return descriptor;
}

export function resolveProviderRoute(input: RouteInput): Route | { manual: true } {
  if (!isRecord(input)
    || (input.purpose !== 'automatic' && input.purpose !== 'edition_options')
    || !(input.installed instanceof Map)) {
    invalidConfiguration();
  }
  const purpose = input.purpose as Purpose;
  const installed = input.installed as ReadonlyMap<string, ProviderDescriptor>;
  assertRegistrySnapshot(input.registry);
  const registry = input.registry as RegistrySnapshot;
  if (input.resumed !== null && input.resumed !== undefined) {
    assertLineage(input.resumed, purpose);
  }
  const resumed = (input.resumed ?? null) as Lineage | null;
  const roleKey = purpose === 'automatic' ? 'automaticRole' : 'explicitRole';
  const allowedKey = purpose === 'automatic' ? 'automaticLookupAllowed' : 'explicitSearchAllowed';
  // Only metadata rows are routable by this worker. Duplicate detection
  // stays kind-agnostic to mirror M89:142-148, which counts eligible rows
  // without a provider-kind filter.
  const roleEligible = registry.providers.filter((row) =>
    row.enabled && row.matchingAllowed && row.storageAllowed
    && row[allowedKey] === true && row[roleKey] !== null);
  // Duplicate eligible registry roles refuse before installed/readiness
  // filtering: at most one primary and one secondary per purpose.
  if (roleEligible.filter((row) => row[roleKey] === 'primary').length > 1
    || roleEligible.filter((row) => row[roleKey] === 'secondary').length > 1) {
    invalidRoute();
  }
  const eligible = roleEligible.filter((row) => row.providerKind === 'metadata');
  if (resumed !== null) {
    const row = registry.providers.find((candidate) =>
      candidate.adapterKey === resumed.adapterKey);
    // A resumed version the active registry row has not accepted is rejected.
    // A non-metadata row is never routable by this worker: manual, not a route.
    if (row === undefined || !row.acceptedAdapterVersions.includes(resumed.adapterVersion)) {
      invalidRoute();
    }
    if (row.providerKind !== 'metadata') return { manual: true };
    if (!(row.enabled && row.matchingAllowed && row.storageAllowed
      && row[allowedKey] === true)) {
      return { manual: true };
    }
    // Complete supplied lineage pins the exact installed key@version and its
    // versionContracts entry; the live row version is never substituted.
    const pinned = bindRow(row, resumed.adapterVersion, installed, purpose);
    if (pinned === null) return { manual: true };
    return {
      primary: pinned,
      secondary: null,
      policyVersions: Object.freeze({
        [providerManifestKey(resumed.adapterKey, resumed.adapterVersion)]: resumed.policyVersion,
      }),
    };
  }
  const primaryRow = eligible.find((row) => row[roleKey] === 'primary') ?? null;
  // No primary means manual; a secondary is never promoted.
  if (primaryRow === null) return { manual: true };
  const primary = bindRow(primaryRow, primaryRow.adapterVersion, installed, purpose);
  if (primary === null) return { manual: true };
  const secondaryRow = eligible.find((row) => row[roleKey] === 'secondary'
    && row !== primaryRow) ?? null;
  const secondary = secondaryRow === null
    ? null
    : bindRow(secondaryRow, secondaryRow.adapterVersion, installed, purpose);
  // Returning a secondary never authorizes fallback after a policy, quota,
  // input or auth denial; the call wiring decides fallback separately.
  const policyVersions: Record<string, number> = {
    [providerManifestKey(primaryRow.adapterKey, primaryRow.adapterVersion)]:
      primaryRow.policyVersion,
  };
  if (secondary !== null && secondaryRow !== null) {
    policyVersions[providerManifestKey(secondaryRow.adapterKey, secondaryRow.adapterVersion)] =
      secondaryRow.policyVersion;
  }
  return { primary, secondary, policyVersions: Object.freeze(policyVersions) };
}
