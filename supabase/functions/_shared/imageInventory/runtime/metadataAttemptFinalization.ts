import { canonicalizeMetadataOutcome } from '../metadata/providerAdapter';
import type { MetadataNormalizedOutcome } from '../metadata/providerAdapter';
import { metadataObject as object } from './metadataJobContext';
import type { MetadataRpcClient } from './metadataJobContext';
import { canonicalMetadataJson, metadataGatewayRpc } from './metadataGatewayContext';
import type { MetadataGatewayConfiguration } from './metadataGatewayContext';

export type MetadataAttemptFinalization = Readonly<{
  lookupId: string; attemptId: string; normalizedOutcome: MetadataNormalizedOutcome;
  logicalOutcome?: MetadataNormalizedOutcome; disposition: 'accepted' | 'rejected' | 'stale_rejected';
  providerRequestId: string | null; normalizedCandidate: unknown | null;
  retryable: boolean; evidence?: readonly string[]; physicalStatus?: 'finalized' | 'outcome_unknown';
}>;

// Existing billing/reconciliation extracted cohesively; picker §5 forbids alternative audit payloads.
export async function finalizeMetadataProductionAttempt(
  client: MetadataRpcClient, configuration: MetadataGatewayConfiguration,
  providerCallId: string | undefined, input: MetadataAttemptFinalization,
): Promise<void> {
  if (providerCallId !== undefined) {
    const physicalStatus = input.disposition === 'stale_rejected' ? 'stale_rejected'
      : input.physicalStatus ?? 'finalized';
    const physicalFinalization = {
      p_provider_call_id: providerCallId, p_job_id: configuration.context.jobId,
      p_worker: configuration.worker, p_lease_token: configuration.context.claimToken,
      p_attempt_count: configuration.context.attempt, p_status: physicalStatus,
      p_normalized_outcome: input.normalizedOutcome,
      p_logical_outcome: input.logicalOutcome ?? input.normalizedOutcome,
      p_provider_request_id: input.providerRequestId, p_retryable: input.retryable,
      p_normalized_candidate: input.normalizedCandidate, p_match_evidence: input.evidence ?? [],
    };
    let rejected = false;
    try {
      const result = await metadataGatewayRpc(client, 'phase9_finalize_metadata_provider_call', physicalFinalization);
      rejected = configuration.context.purpose === 'edition_options' && object(result).status === 'stale_rejected';
    } catch (error) {
      if (physicalStatus === 'stale_rejected') throw error;
      const durable = object(await metadataGatewayRpc(client, 'phase9_reconcile_metadata_provider_call', {
        p_provider_call_id: providerCallId, p_job_id: configuration.context.jobId,
        p_worker: configuration.worker, p_lease_token: configuration.context.claimToken,
        p_attempt_count: configuration.context.attempt,
      }));
      rejected = configuration.context.purpose === 'edition_options' && durable.status === 'stale_rejected';
      if (!rejected && !(durable.status === physicalStatus && durable.normalized_outcome === input.normalizedOutcome
        && durable.logical_outcome === (input.logicalOutcome ?? input.normalizedOutcome)
        && durable.provider_request_id === input.providerRequestId && durable.retryable === input.retryable
        && canonicalMetadataJson(durable.normalized_candidate) === canonicalMetadataJson(input.normalizedCandidate)
        && canonicalMetadataJson(durable.match_evidence) === canonicalMetadataJson(input.evidence ?? []))) {
        throw new Error(durable.status === 'outcome_unknown'
          ? 'P9_METADATA_PHYSICAL_OUTCOME_UNKNOWN' : 'P9_METADATA_PHYSICAL_RECONCILIATION_CONFLICT');
      }
    }
    if (rejected && input.disposition !== 'stale_rejected') throw new Error('P9_METADATA_STALE_PHYSICAL_CALL');
  }
  // Explicit logical completion belongs to the options transaction, never automatic selection/failure.
  if (configuration.context.purpose === 'edition_options' || input.retryable) return;
  await metadataGatewayRpc(client, 'phase9_finalize_structural_metadata_attempt', {
    p_attempt_id: input.attemptId, p_job_id: configuration.context.jobId,
    p_worker: configuration.worker, p_lease_token: configuration.context.claimToken,
    p_attempt_count: configuration.context.attempt,
    p_disposition: input.disposition === 'stale_rejected' ? 'stale' : input.disposition,
    p_candidate_id: configuration.context.candidateId, p_candidate_version: configuration.context.candidateVersion,
    p_normalized_outcome: canonicalizeMetadataOutcome(input.logicalOutcome ?? input.normalizedOutcome),
    p_provider_request_id: input.providerRequestId, p_cache_status: 'miss', p_latency_ms: 0,
    p_pricing_policy_version: configuration.pricingPolicyVersion,
    p_pricing_evidence: { currency: 'USD', input_basis: 'request', pricing_source_version: configuration.pricingPolicyVersion },
    p_calculated_cost_units: 0, p_normalized_candidate: input.normalizedCandidate,
  });
}
