import {
  buildMetadataQueryIdentity,
  buildProviderCacheIdentity,
  MetadataQueryIdentity,
} from '../metadata';
import type { MetadataProviderAdapter } from '../metadata/providerAdapter';
import type { MetadataJobContext, MetadataRpcClient } from './metadataJobContext';
import type { MetadataProductionRequest } from './metadataProductionComposition';

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
  const reusePolicyVersion = String(configuration.context.providerPolicies
    .find((policy) => policy.adapterKey === configuration.adapterKey)?.policyVersion ?? '');
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

export function requestFromMetadataContext(
  context: MetadataJobContext,
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
  const provider = context.providerPolicies[0];
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
      adapterVersionCompatible: true,
      capabilityVersionCompatible: true,
      matchingAllowed: provider?.matchingAllowed ?? false,
      storageAllowed: provider?.storageAllowed ?? false,
      reuseAllowed: provider?.reuseAllowed ?? false,
      pricingPolicyCompatible: true,
    },
  });
}
