import { randomUUID } from 'node:crypto';
import {
  canonicalizeMetadataOutcome,
  MetadataNormalizedOutcome,
  MetadataProviderAdapter,
} from '../metadata/providerAdapter';
import {
  MetadataPolicyDecision,
  MetadataProductionGateway,
  MetadataProductionRequest,
  MetadataReuseCompletion,
  resultForManualCompletion,
} from './metadataProductionComposition';
import {
  loadMetadataJobContext, metadataObject as object, metadataText as text,
  MetadataRpcClient,
} from './metadataJobContext';
import {
  canonicalMetadataJson,
  metadataClaimParameters,
  MetadataGatewayConfiguration,
  metadataGatewayRpc,
  metadataLookupParameters,
} from './metadataGatewayContext';
import { completeMetadataJobManually } from './metadataCompletionGateway';
export { decodeMetadataJobContext, loadMetadataJobContext } from './metadataJobContext';
export type { MetadataJobContext, MetadataRpcClient } from './metadataJobContext';
export { requestFromMetadataContext } from './metadataGatewayContext';
export type { MetadataGatewayConfiguration } from './metadataGatewayContext';

export class SupabaseMetadataProductionGateway implements MetadataProductionGateway {
  readonly providerValidation;
  private readonly providerCalls = new Map<string, string>();
  private reusableLookup: string | null = null;
  private reservedLookup: string | null = null;
  constructor(
    private readonly client: MetadataRpcClient,
    private readonly configuration: MetadataGatewayConfiguration,
  ) {
    this.providerValidation = Object.freeze({
      adapterKey: configuration.adapterKey,
      adapterVersion: configuration.adapterVersion,
      hostPolicy: configuration.primary.normalizedEditionHostPolicy,
    });
  }
  async resolveLocal(request: MetadataProductionRequest) {
    const edition = this.configuration.context.localCanonicalEditionId;
    if (edition === null) return { outcome: 'insufficient' as const };
    await metadataGatewayRpc(this.client, 'phase9_complete_structural_local_metadata_match', {
      ...metadataClaimParameters(request), p_query_identity: request.query.key,
      p_candidate_id: request.candidateId,
      p_candidate_version: this.configuration.context.candidateVersion,
      p_lookup_strategy: request.query.strategy,
      p_lookup_contract_version: this.configuration.lookupContractVersion,
      p_normalizer_version: this.configuration.normalizerVersion,
      p_routing_policy_version: this.configuration.routingPolicyVersion,
      p_privacy_scope: 'store_private', p_schema_version: this.configuration.schemaVersion,
      p_canonical_edition_id: edition,p_snapshot_version: this.configuration.snapshotVersion,
      p_selection_policy_version: this.configuration.selectionPolicyVersion,
      p_match_evidence: request.query.normalizedIsbn13 ? ['validated_isbn']
        : ['exact_original_title_author_language'],
    });
    return { outcome: 'matched' as const, canonicalEditionId: edition };
  }
  async readCache(request: MetadataProductionRequest) {
    const parameters = metadataLookupParameters(request, this.configuration, null);
    const data = object(await metadataGatewayRpc(this.client, 'phase9_metadata_cache_reuse_context', {
      ...metadataClaimParameters(request),
      p_candidate_id: request.candidateId,
      p_candidate_version: this.configuration.context.candidateVersion,
      p_provider_cache_identity: parameters.p_provider_cache_identity,
    }));
    this.reusableLookup = data.leaderLookupId === null ? null : text(data.leaderLookupId);
    return this.reusableLookup === null || data.normalizedOutcome === null
      ? { outcome: 'miss' as const }
      : { outcome: 'hit' as const, normalizedOutcome: text(data.normalizedOutcome) };
  }
  async completeCacheHit(request: MetadataProductionRequest, outcome: string) {
    if (this.reusableLookup === null) {
      return { status: 'policy_denied' as const, normalizedOutcome: outcome };
    }
    const data = object(await metadataGatewayRpc(this.client, 'phase9_complete_metadata_cache_reuse', {
      ...metadataLookupParameters(request, this.configuration, null),
      p_candidate_id: request.candidateId,
      p_candidate_version: this.configuration.context.candidateVersion,
      p_snapshot_version: this.configuration.snapshotVersion,
      p_selection_policy_version: this.configuration.selectionPolicyVersion,
    }));
    return { status: 'completed' as const,
      normalizedOutcome: text(data.normalized_outcome) };
  }
  async decideCoalescing(request: MetadataProductionRequest) {
    const parameters = metadataLookupParameters(request, this.configuration, null);
    const data = object(await metadataGatewayRpc(this.client, 'phase9_metadata_coalescing_context', {
      ...parameters,
    }));
    const mode = text(data.mode);
    if (mode === 'leader') {
      this.reservedLookup = text(data.lookupId);
      return { mode: 'leader' as const, lookupId: this.reservedLookup };
    }
    if (mode === 'follower_pending') return {
      mode: 'follower_pending' as const,leaderLookupId: text(data.leaderLookupId),
    };
    return { mode: 'follower' as const, leaderLookupId: text(data.leaderLookupId) };
  }
  async deferFollower(request: MetadataProductionRequest) {
    return this.completeManual({ outcome: 'provider_unavailable',retryable: true });
  }
  async registerFollower(request: MetadataProductionRequest, leader: string) {
    return this.completeReuse(request, leader, 'coalesced_follower');
  }
  private async completeReuse(request: MetadataProductionRequest, leader: string | null, outcome: string)
    : Promise<MetadataReuseCompletion> {
    if (leader === null) return { status: 'policy_denied', normalizedOutcome: outcome };
    await metadataGatewayRpc(this.client, 'phase9_register_structural_metadata_lookup',
      metadataLookupParameters(request, this.configuration, leader));
    return { status: 'completed', normalizedOutcome: outcome };
  }

  async registerLookup(request: MetadataProductionRequest) {
    if (this.reservedLookup !== null) return { lookupId: this.reservedLookup };
    if (this.configuration.context.currentLookupId !== null) {
      return { lookupId: this.configuration.context.currentLookupId };
    }
    const data = object(await metadataGatewayRpc(this.client, 'phase9_register_structural_metadata_lookup',
      metadataLookupParameters(request, this.configuration, null)));
    return { lookupId: text(data.lookup_id) };
  }
  async reserveUsage(input: MetadataProductionRequest & { lookupId: string }) {
    const data = object(await metadataGatewayRpc(this.client, 'phase9_reserve_metadata_usage', {
      ...metadataClaimParameters(input), p_lookup_id: input.lookupId,
      p_adapter_key: this.configuration.adapterKey,
      p_adapter_version: this.configuration.adapterVersion,
      p_policy_version: Number(metadataLookupParameters(
        input, this.configuration, null,
      ).p_reuse_policy_version),
    }));
    return { reservationId: text(data.reservation_id) };
  }
  async registerAttempt(input: MetadataProductionRequest & { lookupId: string; reservationId: string }) {
    if (this.configuration.context.currentAttemptId !== null) {
      return { attemptId: this.configuration.context.currentAttemptId };
    }
    const p = metadataLookupParameters(input, this.configuration, null);
    const data = object(await metadataGatewayRpc(this.client, 'phase9_register_structural_metadata_attempt', {
      ...metadataClaimParameters(input), p_lookup_id: input.lookupId,p_provider_attempt_identity: randomUUID(),
      p_candidate_id: input.candidateId,
      p_candidate_version: this.configuration.context.candidateVersion,
      p_provider_cache_identity: p.p_provider_cache_identity,p_provider_role: 'primary',
      p_attempt_sequence: 1,p_adapter_key: p.p_adapter_key,p_adapter_version: p.p_adapter_version,
      p_capability_version: p.p_capability_version,p_schema_version: p.p_schema_version,
      p_normalizer_version: p.p_normalizer_version,p_routing_policy_version: p.p_routing_policy_version,
      p_predecessor_outcome: 'local_insufficient',p_usage_reservation_id: input.reservationId,
    }));
    return { attemptId: text(data.attempt_id) };
  }
  async resumeFinalizedAttempt(input: MetadataProductionRequest & {
    lookupId: string; attemptId: string;
  }) {
    const current = this.configuration.context;
    if (current.currentAttemptId !== input.attemptId
      || current.currentAttemptDisposition === null
      ) return null;
    if (current.currentAttemptDisposition === 'unresolved') {
      if (current.currentPhysicalStatus !== 'finalized'
        || current.currentPhysicalOutcome === null
        || current.currentPhysicalRetryable === null) return null;
      if (current.currentPhysicalRetryable
        && current.currentPhysicalClaimAttempt !== current.attempt) return null;
      const normalizedOutcome = current.currentPhysicalOutcome as MetadataNormalizedOutcome;
      const logicalOutcome = current.currentPhysicalLogicalOutcome as MetadataNormalizedOutcome | null;
      const accepted = normalizedOutcome === 'coherent_match'
        && current.currentPhysicalCandidate !== null;
      await this.finalizeAttempt({
        lookupId: input.lookupId,attemptId: input.attemptId,normalizedOutcome,
        logicalOutcome: logicalOutcome ?? undefined,
        disposition: accepted ? 'accepted' : 'rejected',
        providerRequestId: current.currentPhysicalProviderRequestId,
        normalizedCandidate: accepted ? current.currentPhysicalCandidate : null,
        evidence: current.currentPhysicalEvidence ?? [],retryable: current.currentPhysicalRetryable,
      });
      if (current.currentPhysicalRetryable) {
        const completion = await this.completeManual({
          lookupId: input.lookupId,attemptId: input.attemptId,
          outcome: logicalOutcome ?? normalizedOutcome,retryable: true });
        return resultForManualCompletion(completion);
      }
      if (accepted) {
        await this.persistSelection({
          lookupId: input.lookupId,attemptId: input.attemptId,
          selected: current.currentPhysicalCandidate!,
          evidence: current.currentPhysicalEvidence ?? [],
        });
        return { outcome: 'accepted_metadata_match' as const };
      }
      const completion = await this.completeManual({
        lookupId: input.lookupId,attemptId: input.attemptId,
        outcome: logicalOutcome ?? normalizedOutcome,retryable: false });
      return resultForManualCompletion(completion);
    }
    if (current.currentAttemptDisposition === 'stale') return { outcome: 'stale_claim' as const };
    if (current.currentAttemptDisposition === 'accepted') {
      if (current.currentAttemptCandidate === null) {
        throw new Error('P9_METADATA_CONTEXT_INVALID');
      }
      await this.persistSelection({
        lookupId: input.lookupId,attemptId: input.attemptId,
        selected: current.currentAttemptCandidate,evidence: [],
      });
      return { outcome: 'accepted_metadata_match' as const };
    }
    const completion = await this.completeManual({
      lookupId: input.lookupId,attemptId: input.attemptId,
      outcome: current.currentAttemptOutcome ?? 'provider_unavailable',retryable: false,
    });
    return resultForManualCompletion(completion);
  }
  async validateEgress(input: MetadataProductionRequest & { attemptId: string }) {
    const context = await loadMetadataJobContext(this.client, {
      jobId: input.jobId,worker: input.claimWorker,
      leaseToken: input.claimLeaseToken,attempt: input.claimAttempt,
    });
    if (context.candidateId !== input.candidateId) return false;
    const physicalIdentity = randomUUID();
    const registered = object(await metadataGatewayRpc(this.client, 'phase9_register_metadata_provider_call', {
      p_attempt_id: input.attemptId,p_job_id: input.jobId,p_worker: input.claimWorker,
      p_lease_token: input.claimLeaseToken,p_attempt_count: input.claimAttempt,
      p_physical_call_identity: physicalIdentity,
    }));
    this.providerCalls.set(input.attemptId, text(registered.provider_call_id));
    const revalidated = await loadMetadataJobContext(this.client, {
      jobId: input.jobId,worker: input.claimWorker,
      leaseToken: input.claimLeaseToken,attempt: input.claimAttempt,
    });
    return revalidated.candidateId === input.candidateId;
  }
  invokePrimary(input: Parameters<MetadataProviderAdapter['lookup']>[0]) {
    return this.configuration.primary.lookup(input);
  }
  async finalizeAttempt(input: Readonly<{ lookupId: string; attemptId: string;
    normalizedOutcome: MetadataNormalizedOutcome;
    logicalOutcome?: MetadataNormalizedOutcome;
    disposition: 'accepted' | 'rejected' | 'stale_rejected';
    providerRequestId: string | null; normalizedCandidate: unknown | null;
    retryable: boolean; evidence?: readonly string[];
    physicalStatus?: 'finalized' | 'outcome_unknown' }>) {
    const providerCallId = this.providerCalls.get(input.attemptId);
    if (providerCallId !== undefined) {
      const physicalStatus = input.disposition === 'stale_rejected' ? 'stale_rejected'
        : input.physicalStatus ?? 'finalized';
      const physicalFinalization = {
        p_provider_call_id: providerCallId,p_job_id: this.configuration.context.jobId,
        p_worker: this.configuration.worker,p_lease_token: this.configuration.context.claimToken,
        p_attempt_count: this.configuration.context.attempt,
        p_status: physicalStatus,
        p_normalized_outcome: input.normalizedOutcome,
        p_logical_outcome: input.logicalOutcome ?? input.normalizedOutcome,
        p_provider_request_id: input.providerRequestId,
        p_retryable: input.retryable,p_normalized_candidate: input.normalizedCandidate,
        p_match_evidence: input.evidence ?? [],
      };
      try {
        await metadataGatewayRpc(this.client, 'phase9_finalize_metadata_provider_call', physicalFinalization);
      } catch (error) {
        if (physicalStatus === 'stale_rejected') throw error;
        const durable = object(await metadataGatewayRpc(
          this.client,
          'phase9_reconcile_metadata_provider_call',
          {
            p_provider_call_id: providerCallId,
            p_job_id: this.configuration.context.jobId,
            p_worker: this.configuration.worker,
            p_lease_token: this.configuration.context.claimToken,
            p_attempt_count: this.configuration.context.attempt,
          },
        ));
        const durableMatches = durable.status === physicalStatus
          && durable.normalized_outcome === input.normalizedOutcome
          && durable.logical_outcome === (input.logicalOutcome ?? input.normalizedOutcome)
          && durable.provider_request_id === input.providerRequestId
          && durable.retryable === input.retryable
          && canonicalMetadataJson(durable.normalized_candidate)
            === canonicalMetadataJson(input.normalizedCandidate)
          && canonicalMetadataJson(durable.match_evidence)
            === canonicalMetadataJson(input.evidence ?? []);
        if (!durableMatches) {
          throw new Error(durable.status === 'outcome_unknown'
            ? 'P9_METADATA_PHYSICAL_OUTCOME_UNKNOWN'
            : 'P9_METADATA_PHYSICAL_RECONCILIATION_CONFLICT');
        }
      }
    }
    if (input.retryable) return;
    await metadataGatewayRpc(this.client, 'phase9_finalize_structural_metadata_attempt', {
      p_attempt_id: input.attemptId,...metadataClaimParameters({
        jobId: this.configuration.context.jobId,claimWorker: this.configuration.worker,
        claimLeaseToken: this.configuration.context.claimToken,
        claimAttempt: this.configuration.context.attempt,
      } as MetadataProductionRequest),p_disposition: input.disposition === 'stale_rejected' ? 'stale' : input.disposition,
      p_candidate_id: this.configuration.context.candidateId,
      p_candidate_version: this.configuration.context.candidateVersion,
      p_normalized_outcome: canonicalizeMetadataOutcome(
        input.logicalOutcome ?? input.normalizedOutcome,
      ),
      p_provider_request_id: input.providerRequestId,
      p_cache_status: 'miss',p_latency_ms: 0,p_pricing_policy_version: this.configuration.pricingPolicyVersion,
      p_pricing_evidence: { currency: 'USD', input_basis: 'request', pricing_source_version: this.configuration.pricingPolicyVersion },
      p_calculated_cost_units: 0,p_normalized_candidate: input.normalizedCandidate,
    });
  }
  async persistCache(input: Readonly<{ lookupId: string; attemptId: string;
    normalizedOutcome: string; selected: unknown | null }>) {
    const cacheOutcome = input.selected !== null ? 'positive'
      : input.normalizedOutcome === 'ambiguous_match' || input.normalizedOutcome === 'material_conflict'
        ? 'ambiguous' : 'negative';
    await metadataGatewayRpc(this.client, 'phase9_store_metadata_cache', {
      p_lookup_id: input.lookupId,p_worker: this.configuration.worker,
      p_lease_token: this.configuration.context.claimToken,
      p_attempt_count: this.configuration.context.attempt,p_outcome: cacheOutcome,
      p_normalized_snapshot: input.selected,p_provider_record_id: null,
      p_source_fetched_at: new Date().toISOString(),
      p_expires_at: new Date(Date.now()+this.configuration.revalidationSeconds*1000).toISOString(),
    });
  }
  async persistSelection(input: Readonly<{ lookupId: string; attemptId: string;
    selected: unknown; evidence: readonly string[] }>) {
    await metadataGatewayRpc(this.client, 'phase9_select_structural_metadata_snapshot', {
      p_lookup_id: input.lookupId,...metadataClaimParameters({
        jobId: this.configuration.context.jobId,claimWorker: this.configuration.worker,
        claimLeaseToken: this.configuration.context.claimToken,
        claimAttempt: this.configuration.context.attempt,
      } as MetadataProductionRequest),p_selected_attempt_id: input.attemptId,
      p_candidate_id: this.configuration.context.candidateId,
      p_candidate_version: this.configuration.context.candidateVersion,
      p_outcome_source_attempt_id: input.attemptId,
      p_snapshot_version: this.configuration.snapshotVersion,
      p_selection_policy_version: this.configuration.selectionPolicyVersion,
      p_coherent_edition: input.selected,p_match_evidence: input.evidence,
      p_manual_outcome: 'accepted_metadata_match',p_canonical_edition_id: null,
    });
  }
  async completeManual(input: Readonly<{
    lookupId?: string; attemptId?: string; outcome: string; retryable: boolean;
  }>) {
    return completeMetadataJobManually(this.client, this.configuration, input);
  }
}
