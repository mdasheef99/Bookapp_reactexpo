// 02c §§4.3/5.1; M94:129–222. Admission and election form ONE decision.
import { z } from 'zod';
import { metadataLookupParameters } from './metadataGatewayContext';
import type { MetadataGatewayConfiguration } from './metadataGatewayContext';
import type { MetadataProductionRequest } from './metadataProductionComposition';
import type { MetadataRpcClient } from './metadataJobContext';
import { automaticRpc, MetadataAutomaticRpcError, snapshotAutomaticValue, validateAutomaticFence } from './metadataAutomaticEditionFence';

const specSchema = z.object({ provider_cache_identity: z.string(), adapter_key: z.string(),
  adapter_version: z.string(), capability_version: z.string(), schema_version: z.string(),
  lookup_strategy: z.string(), lookup_contract_version: z.string(), normalizer_version: z.string(),
  routing_policy_version: z.string(), privacy_scope: z.string(), reuse_policy_version: z.string(),
  cache_policy_version: z.string(), cache_namespace: z.string() }).strict();
const round = z.union([z.literal(0), z.literal(1)]);
const admissionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('started'), round }).strict(),
  z.object({ status: z.literal('replayed'), round,
    runStatus: z.enum(['running', 'finalized', 'unknown']) }).strict(),
  z.object({ status: z.literal('capacity_wait'), dueAt: z.string().datetime({ offset: true }) }).strict(),
  z.object({ status: z.literal('recovery_only') }).strict(),
  z.object({ status: z.literal('configuration_required') }).strict(),
  z.object({ status: z.literal('drain_required') }).strict(),
]);
const uuid = z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu);
const electionSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('leader'), lookupId: uuid }).strict(),
  z.object({ mode: z.literal('follower'), leaderLookupId: uuid }).strict(),
  z.object({ mode: z.literal('follower_pending'), leaderLookupId: uuid }).strict(),
]);
const preparationSchema = z.object({ admission: admissionSchema.nullable(), coalescing: electionSchema.nullable() }).strict();
export type AutomaticLookupSpec = Readonly<z.infer<typeof specSchema>>;
export type AutomaticAdmission = Readonly<z.infer<typeof admissionSchema>>;
export type AutomaticPreparation =
  | Readonly<{ admission: AutomaticAdmission; coalescing: null }>
  | Readonly<{ admission: Readonly<{ status: 'started'; round: 0 }>;
    coalescing: Readonly<{ mode: 'leader'; lookupId: string }> }>
  | Readonly<{ admission: null; coalescing: Readonly<{ mode: 'follower' | 'follower_pending'; leaderLookupId: string }> }>;
const invalid = (): never => { throw new Error('P9_AUTOMATIC_PREPARATION_INVALID'); };
export function decodeAutomaticPreparation(value: unknown): AutomaticPreparation {
  const parsed = preparationSchema.safeParse(value);
  if (!parsed.success) return invalid();
  const { admission, coalescing } = parsed.data;
  if (coalescing === null) {
    if (admission === null) return invalid();
    return snapshotAutomaticValue({ admission, coalescing });
  }
  if (coalescing.mode === 'leader') {
    if (admission?.status !== 'started' || admission.round !== 0) return invalid();
    return snapshotAutomaticValue({ admission: { status: 'started', round: 0 }, coalescing });
  }
  if (admission !== null) return invalid();
  return snapshotAutomaticValue({ admission, coalescing });
}
export function buildAutomaticLookupSpec(
  request: MetadataProductionRequest, configuration: MetadataGatewayConfiguration,
): AutomaticLookupSpec {
  const p = metadataLookupParameters(request, configuration, null);
  const value = { provider_cache_identity: p.p_provider_cache_identity, adapter_key: p.p_adapter_key,
    adapter_version: p.p_adapter_version, capability_version: p.p_capability_version,
    schema_version: p.p_schema_version, lookup_strategy: p.p_lookup_strategy,
    lookup_contract_version: p.p_lookup_contract_version, normalizer_version: p.p_normalizer_version,
    routing_policy_version: p.p_routing_policy_version, privacy_scope: p.p_privacy_scope,
    reuse_policy_version: p.p_reuse_policy_version, cache_policy_version: p.p_cache_policy_version,
    cache_namespace: p.p_cache_namespace };
  const parsed = specSchema.safeParse(value);
  return parsed.success ? snapshotAutomaticValue(parsed.data) : invalid();
}
export async function prepareAutomaticMetadata(
  client: MetadataRpcClient, fence: unknown, lookup: unknown, recheck: boolean = false,
): Promise<AutomaticPreparation> {
  const f = validateAutomaticFence(fence), parsed = specSchema.safeParse(lookup);
  if (!parsed.success || typeof recheck !== 'boolean') return invalid();
  const name = 'phase9_prepare_automatic_metadata_v1';
  const result = await automaticRpc(client, name, {
    f, p_lookup: snapshotAutomaticValue(parsed.data), p_recheck: recheck,
  });
  // Admission may have committed even when its response is malformed. Never call this a safe retry.
  try { return decodeAutomaticPreparation(result); }
  catch (error) { throw new MetadataAutomaticRpcError(name, error); }
}
