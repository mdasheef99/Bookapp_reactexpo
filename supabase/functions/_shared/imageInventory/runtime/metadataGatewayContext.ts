import {
  buildMetadataQueryIdentity,
  buildProviderCacheIdentity,
  MetadataQueryIdentity,
} from '../metadata';
import type { MetadataProviderAdapter } from '../metadata/providerAdapter';
import type { MetadataJobContext, MetadataRpcClient } from './metadataJobContext';
import type { MetadataProductionRequest } from './metadataProductionComposition';
import { CATALOGUE_WRITE_VERSION } from '../contracts/catalogueWrite';
import type { EditionOptionsCacheVersions } from './metadataEditionOptionsBoundary';

export type ExplicitHttpConfig = Readonly<{
  policy: unknown;
  requestHosts?: readonly string[];
  requestValidator?: (url: URL, stage: string, sequence: number) => void;
  timeoutMs: number;
  maxResponseBytes: number;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  sharedProtection?: object | null;
  // Verified registry row policy version for retention binding, carried
  // from route.policyVersions (worker) or the test row (R1 seam).
  retentionPolicyVersion?: number | null;
  // Row URL validation policy for the port arm (worker supplies the bound
  // adapter's host policy when its key matches the elected descriptor;
  // absent for synthetic/test-only descriptors, whose rows must then carry
  // no cover references).
  rowHostPolicy?: import('../contracts/providerReuse').ProviderHostPolicy | null;
}>;

export type MetadataGatewayConfiguration = Readonly<{
  worker: string;
  context: MetadataJobContext;
  primary: MetadataProviderAdapter;
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  schemaVersion: string;
  lookupContractVersion: string;
  normalizerVersion: string;
  routingPolicyVersion: string;
  selectionPolicyVersion: string;
  snapshotVersion: string;
  cachePolicyVersion: string;
  cacheNamespace: string;
  pricingPolicyVersion: string;
  revalidationSeconds: number;
  // U2: the resolver's selected policy version for the configured key/version,
  // including resumed historical identity. The legacy context policy lookup by
  // key cannot see history, so routed calls carry it explicitly.
  selectedPolicyVersion?: number;
  // U6: descriptor-driven explicit execution binding. Set by the worker (from
  // the verified route) or the R1 test seam; absent for legacy adapter
  // callers, which keep the instanceof path. Not a descriptor schema field.
  explicitDescriptor?: Readonly<{
    descriptor: import('../metadata/providerDescriptor').ProviderDescriptor;
    // Live adapter for adapter-backed descriptors (v1/Google); absent for
    // port-native descriptors (v2/synthetic), which execute via a port.
    adapter?: MetadataProviderAdapter | null;
    fallbackAdapter?: MetadataProviderAdapter | null;
    // Elected secondary route versions for fallback registration (U6); absent
    // for legacy callers, which keep the historical OL versions.
    fallbackRoute?: Readonly<{
      adapterKey: string; adapterVersion: string; capabilityVersion: string;
      // U6 fix2 (G6): secondary attempt identity. schemaVersion uses the
      // secondary LOOKUP schema (never payloadSchemaVersion); the structural
      // attempt RPC has no lookup-contract argument.
      normalizerVersion: string; lookupSchemaVersion: string;
    }> | null;
    // U6 fix1 (F6): the elected secondary descriptor itself.
    fallbackDescriptor?: import('../metadata/providerDescriptor').ProviderDescriptor | null;
    // U6 fix1 (F6): secondary port/validation parameters from the secondary
    // registry row (never the primary's configuration).
    fallbackExplicitHttp?: ExplicitHttpConfig | undefined;
  }>;
  // U6: fenced-port construction parameters for port-native descriptors.
  // Absent (or null policy) selects legacy fencing-only behaviour; no port
  // arm is constructed without a non-null policy.
  explicitHttp?: ExplicitHttpConfig;
  editionOptions?: Readonly<{ request: MetadataProductionRequest;
    boundary: import('./metadataEditionOptionsBoundary').MetadataEditionOptionsBoundary }>;
}>;

export async function metadataGatewayRpc(
  client: MetadataRpcClient,
  name: string,
  parameters: Record<string, unknown>,
) {
  const result = await client.rpc(name, parameters);
  if (result.error !== null) throw new Error(`P9_METADATA_RPC_FAILED:${name}`);
  return result.data;
}

export function canonicalMetadataJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalMetadataJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalMetadataJson(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function metadataClaimParameters(request: MetadataProductionRequest) {
  return {
    p_job_id: request.jobId,
    p_worker: request.claimWorker,
    p_lease_token: request.claimLeaseToken,
    p_attempt_count: request.claimAttempt,
  };
}

export function metadataLookupParameters(
  request: MetadataProductionRequest,
  configuration: MetadataGatewayConfiguration,
  leaderLookupId: string | null,
) {
  const reusePolicyVersion = metadataReusePolicyVersion(configuration);
  const providerCacheIdentity = buildProviderCacheIdentity({
    query: request.query,
    adapterKey: configuration.adapterKey,
    adapterVersion: configuration.adapterVersion,
    capabilityVersion: configuration.capabilityVersion,
    schemaVersion: configuration.schemaVersion,
    cachePolicyVersion: configuration.cachePolicyVersion,
    reusePolicyVersion,
  }).key;
  return {
    ...metadataClaimParameters(request),
    p_query_identity: request.query.key,
    p_candidate_id: request.candidateId,
    p_candidate_version: configuration.context.candidateVersion,
    p_provider_cache_identity: providerCacheIdentity,
    p_adapter_key: configuration.adapterKey,
    p_adapter_version: configuration.adapterVersion,
    p_capability_version: configuration.capabilityVersion,
    p_schema_version: configuration.schemaVersion,
    p_lookup_strategy: request.query.strategy,
    p_lookup_contract_version: configuration.lookupContractVersion,
    p_normalizer_version: configuration.normalizerVersion,
    p_routing_policy_version: configuration.routingPolicyVersion,
    p_privacy_scope: 'store_private',
    p_reuse_policy_version: reusePolicyVersion,
    p_cache_policy_version: configuration.cachePolicyVersion,
    p_cache_namespace: configuration.cacheNamespace,
    p_leader_lookup_id: leaderLookupId,
  };
}

const metadataReusePolicyVersion = (configuration: MetadataGatewayConfiguration): string => {
  const selected = configuration.selectedPolicyVersion;
  if (typeof selected === 'number' && Number.isSafeInteger(selected) && selected > 0) {
    return String(selected);
  }
  return String(configuration.context.providerPolicies
    .find((policy) => policy.adapterKey === configuration.adapterKey)?.policyVersion ?? '');
};

// 02b section 8.1: share lookup version authority; SQL owns scope, key and registry validation.
export function buildEditionOptionsCacheVersions(
  configuration: MetadataGatewayConfiguration,
): EditionOptionsCacheVersions {
  return Object.freeze({
    adapterKey: configuration.adapterKey, adapterVersion: configuration.adapterVersion,
    capabilityVersion: configuration.capabilityVersion, normalizerVersion: configuration.normalizerVersion,
    schemaVersion: configuration.schemaVersion, routingPolicyVersion: configuration.routingPolicyVersion,
    cachePolicyVersion: configuration.cachePolicyVersion, reusePolicyVersion: metadataReusePolicyVersion(configuration),
    companionVersion: CATALOGUE_WRITE_VERSION,
  });
}

export function requestFromMetadataContext(
  context: MetadataJobContext,
  selected?: Readonly<{ adapterKey: string; adapterVersion: string }>,
): MetadataProductionRequest {
  const built = buildMetadataQueryIdentity({
    strategy: 'bibliographic',
    isbnClue: context.isbnClue,
    title: context.title,
    authors: context.authors,
    language: context.language,
    editionClues: context.publisherClue ? [context.publisherClue] : [],
  });
  if (built.key !== context.queryIdentity) {
    throw new Error('P9_METADATA_QUERY_IDENTITY_MISMATCH');
  }
  const query: MetadataQueryIdentity = built;
  // Routed calls supply the resolver's selected key/version so the lookup and
  // cache policy match the selected descriptor, including resumed identity.
  // The one-argument shape preserves the legacy first-row behavior for
  // callers that have not routed yet.
  const provider = selected === undefined
    ? context.providerPolicies[0]
    : context.providerPolicies.find((policy) =>
      policy.adapterKey === selected.adapterKey
      && policy.adapterVersion === selected.adapterVersion);
  return Object.freeze({
    candidateId: context.candidateId,
    storeId: context.storeId,
    jobId: context.jobId,
    claimAttempt: context.attempt,
    claimWorker: '',
    claimLeaseToken: context.claimToken,
    query,
    providerPolicy: {
      enabled: provider?.enabled ?? false,
      adapterVersionCompatible: selected === undefined ? true : provider !== undefined,
      capabilityVersionCompatible: selected === undefined ? true : provider !== undefined,
      matchingAllowed: provider?.matchingAllowed ?? false,
      storageAllowed: provider?.storageAllowed ?? false,
      reuseAllowed: provider?.reuseAllowed ?? false,
      pricingPolicyCompatible: true,
    },
  });
}
