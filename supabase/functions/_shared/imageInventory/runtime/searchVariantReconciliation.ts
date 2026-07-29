import {
  AutomaticVariantActivationPolicy,
  denyAutomaticVariantActivationPolicy,
  planSearchVariantLifecycle,
  SearchVariantLifecycleProposal,
} from '../searchVariants/activationPolicy';
import {
  SearchVariantReconciliation,
} from '../searchVariants/reconciliation';

type RpcResult = Readonly<{
  data: unknown;
  error: Readonly<{ message?: string }> | null;
}>;
type Client = Readonly<{
  rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
}>;

export type CandidateVariantReconciliationInput = Readonly<{
  storeId: string;
  candidateId: string;
  proposals: readonly Readonly<{
    proposal: SearchVariantLifecycleProposal;
    reconciliation: SearchVariantReconciliation;
  }>[];
}>;

export async function reconcileCandidateSearchVariants(
  client: Client,
  input: CandidateVariantReconciliationInput,
  policy: AutomaticVariantActivationPolicy =
    denyAutomaticVariantActivationPolicy,
): Promise<Record<string, unknown>> {
  const plans = await Promise.all(input.proposals.map(async (entry) => ({
    id: entry.proposal.id,
    plan: await planSearchVariantLifecycle(
      entry.proposal,
      entry.reconciliation,
      policy,
    ),
  })));
  const allowed = plans
    .filter(({ plan }) => plan.action === 'activate')
    .map(({ id }) => id);
  const result = await client.rpc('phase9_reconcile_search_variants', {
    p_store_id: input.storeId,
    p_candidate_id: input.candidateId,
    p_allowed_proposal_ids: allowed,
    p_policy_key: policy.key,
  });
  if (result.error) throw new Error(result.error.message ?? 'P9_DATABASE_ERROR');
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new Error('P9_DATABASE_ERROR');
  }
  return result.data as Record<string, unknown>;
}
