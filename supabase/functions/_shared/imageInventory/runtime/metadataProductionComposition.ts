import { MetadataEdition } from '../contracts/metadata';
import { MetadataQueryIdentity } from '../metadata';
import {
  failClosedMetadataProviderOutcome, MetadataNormalizedOutcome, MetadataProviderOutcome,
  MetadataProviderValidationContext,
} from '../metadata/providerAdapter';

export type MetadataProviderPolicy = Readonly<{
  enabled: boolean;
  adapterVersionCompatible: boolean;
  capabilityVersionCompatible: boolean;
  matchingAllowed: boolean;
  storageAllowed: boolean;
  reuseAllowed: boolean;
  pricingPolicyCompatible: boolean;
}>;

export type MetadataProductionRequest = Readonly<{
  candidateId: string;
  storeId: string;
  jobId: string;
  claimAttempt: number;
  claimWorker: string;
  claimLeaseToken: string;
  query: MetadataQueryIdentity;
  providerPolicy: MetadataProviderPolicy;
}>;

type Finalization = Readonly<{
  lookupId: string;
  attemptId: string;
  normalizedOutcome: MetadataNormalizedOutcome;
  logicalOutcome?: MetadataNormalizedOutcome;
  disposition: 'accepted' | 'rejected' | 'stale_rejected';
  providerRequestId: string | null;
  normalizedCandidate: MetadataEdition | null;
  evidence?: readonly string[];
  retryable: boolean;
  physicalStatus?: 'finalized' | 'outcome_unknown';
}>;

export type MetadataPolicyDecision = Readonly<{
  allowCacheRead: boolean;
  allowFollowerReuse: boolean;
  allowFreshProviderCall: boolean;
  allowPositiveRetention: boolean;
  allowCacheWrite: boolean;
  requiredDegradationOutcome: 'policy_denied';
}>;

export type MetadataReuseCompletion =
  | Readonly<{ status: 'completed'; normalizedOutcome: string }>
  | Readonly<{ status: 'manual_degradation'; normalizedOutcome: string }>
  | Readonly<{ status: 'policy_denied'; normalizedOutcome?: string }>
  | Readonly<{ status: 'stale_rejected'; normalizedOutcome?: string }>;

export type MetadataProductionGateway = Readonly<{
  providerValidation?: Omit<MetadataProviderValidationContext, 'correlationId' | 'attemptId'>;
  resolveLocal(request: MetadataProductionRequest): Promise<
    | { outcome: 'matched'; canonicalEditionId: string }
    | { outcome: 'insufficient' }
  >;
  readCache(request: MetadataProductionRequest): Promise<
    | { outcome: 'miss' }
    | { outcome: 'hit'; normalizedOutcome: string }
  >;
  completeCacheHit(
    request: MetadataProductionRequest,
    normalizedOutcome: string,
    decision: MetadataPolicyDecision,
  ): Promise<MetadataReuseCompletion>;
  decideCoalescing(request: MetadataProductionRequest): Promise<
    | { mode: 'leader'; lookupId?: string }
    | { mode: 'follower'; leaderLookupId: string }
    | { mode: 'follower_pending'; leaderLookupId: string }
  >;
  deferFollower(request: MetadataProductionRequest, leaderLookupId: string): Promise<void>;
  registerFollower(
    request: MetadataProductionRequest,
    leaderLookupId: string,
    decision: MetadataPolicyDecision,
  ): Promise<MetadataReuseCompletion>;
  registerLookup(request: MetadataProductionRequest): Promise<{ lookupId: string }>;
  reserveUsage(input: MetadataProductionRequest & { lookupId: string }): Promise<{ reservationId: string }>;
  registerAttempt(input: MetadataProductionRequest & {
    lookupId: string;
    reservationId: string;
    providerRole: 'primary';
  }): Promise<{ attemptId: string }>;
  resumeFinalizedAttempt(input: MetadataProductionRequest & {
    lookupId: string;
    attemptId: string;
  }): Promise<MetadataCompositionResult | null>;
  validateEgress(input: MetadataProductionRequest & { lookupId: string; attemptId: string }): Promise<boolean>;
  invokePrimary(input: Readonly<{
    query: MetadataQueryIdentity;
    correlationId: string;
    attemptId: string;
    signal: AbortSignal;
  }>): Promise<unknown>;
  finalizeAttempt(input: Finalization): Promise<void>;
  persistCache(input: Readonly<{
    lookupId: string;
    attemptId: string;
    normalizedOutcome: string;
    selected: MetadataEdition | null;
  }>): Promise<void>;
  persistSelection(input: Readonly<{
    lookupId: string;
    attemptId: string;
    selected: MetadataEdition;
    evidence: readonly string[];
  }>): Promise<void>;
  completeManual(input: Readonly<{
    lookupId?: string;
    attemptId?: string;
    outcome: string;
    retryable: boolean;
  }>): Promise<void>;
}>;

export type MetadataCompositionResult = Readonly<{
  outcome: 'local_canonical_match' | 'manual_metadata_required'
    | 'coalesced_follower' | 'stale_claim' | 'accepted_metadata_match';
}>;

const isPositiveOutcome = (outcome: string) =>
  outcome === 'coherent_match' || outcome === 'accepted_metadata_match';

const isCacheableOutcome = (outcome: string) => [
  'coherent_match', 'no_acceptable_match', 'ambiguous_match', 'material_conflict',
].includes(outcome);

async function persistCacheAfterTerminal(
  gateway: MetadataProductionGateway,
  input: Parameters<MetadataProductionGateway['persistCache']>[0],
): Promise<void> {
  try {
    await gateway.persistCache(input);
  } catch {
    // Cache is derived reuse state and cannot reverse durable terminalization.
  }
}

export function decideMetadataProductionPolicy(
  policy: MetadataProviderPolicy,
): MetadataPolicyDecision {
  const compatible = policy.enabled
    && policy.adapterVersionCompatible
    && policy.capabilityVersionCompatible
    && policy.pricingPolicyCompatible;
  return {
    allowCacheRead: compatible && policy.reuseAllowed,
    allowFollowerReuse: compatible && policy.reuseAllowed,
    allowFreshProviderCall: compatible && policy.matchingAllowed,
    allowPositiveRetention: compatible && policy.storageAllowed,
    allowCacheWrite: compatible && policy.reuseAllowed,
    requiredDegradationOutcome: 'policy_denied',
  };
}

function resultForReuseCompletion(
  completion: MetadataReuseCompletion,
  decision: MetadataPolicyDecision,
): MetadataCompositionResult {
  if (completion.status === 'stale_rejected') return { outcome: 'stale_claim' };
  if (completion.status !== 'completed') {
    return { outcome: 'manual_metadata_required' };
  }
  if (completion.normalizedOutcome === 'coalesced_follower') {
    return { outcome: 'coalesced_follower' };
  }
  if (isPositiveOutcome(completion.normalizedOutcome)
    && !decision.allowPositiveRetention) {
    return { outcome: 'manual_metadata_required' };
  }
  return {
    outcome: isPositiveOutcome(completion.normalizedOutcome)
      ? 'accepted_metadata_match' : 'manual_metadata_required',
  };
}

export async function runMetadataProductionComposition(
  request: MetadataProductionRequest,
  gateway: MetadataProductionGateway,
  signal: AbortSignal = new AbortController().signal,
): Promise<MetadataCompositionResult> {
  let reservedLookupId: string | null = null;
  const local = await gateway.resolveLocal(request);
  if (local.outcome === 'matched') return { outcome: 'local_canonical_match' };

  const policy = decideMetadataProductionPolicy(request.providerPolicy);
  if (policy.allowCacheRead) {
    const cached = await gateway.readCache(request);
    if (cached.outcome === 'hit') {
      const positive = isPositiveOutcome(cached.normalizedOutcome);
      if (!positive || policy.allowPositiveRetention) {
        const completion = await gateway.completeCacheHit(
          request,
          cached.normalizedOutcome,
          policy,
        );
        return resultForReuseCompletion(completion, policy);
      }
    }
  }

  if (policy.allowFollowerReuse) {
    const coalescing = await gateway.decideCoalescing(request);
    if (coalescing.mode === 'follower') {
      const completion = await gateway.registerFollower(
        request,
        coalescing.leaderLookupId,
        policy,
      );
      return resultForReuseCompletion(completion, policy);
    }
    if (coalescing.mode === 'follower_pending') {
      await gateway.deferFollower(request, coalescing.leaderLookupId);
      return { outcome: 'manual_metadata_required' };
    }
    reservedLookupId = coalescing.lookupId ?? null;
  }

  if (!policy.allowFreshProviderCall) {
    await gateway.completeManual({
      outcome: policy.requiredDegradationOutcome,
      retryable: false,
    });
    return { outcome: 'manual_metadata_required' };
  }

  const lookupId = reservedLookupId ?? (await gateway.registerLookup(request)).lookupId;
  const { reservationId } = await gateway.reserveUsage({ ...request, lookupId });
  const { attemptId } = await gateway.registerAttempt({
    ...request,
    lookupId,
    reservationId,
    providerRole: 'primary',
  });
  const resumed = await gateway.resumeFinalizedAttempt({ ...request, lookupId, attemptId });
  if (resumed !== null) return resumed;
  const active = await gateway.validateEgress({ ...request, lookupId, attemptId });
  if (!active) {
    await gateway.finalizeAttempt({
      lookupId,
      attemptId,
      normalizedOutcome: 'policy_denied',
      disposition: 'stale_rejected',
      providerRequestId: null,
      normalizedCandidate: null,
      retryable: false,
    });
    return { outcome: 'stale_claim' };
  }

  let provider: MetadataProviderOutcome;
  try {
    provider = failClosedMetadataProviderOutcome(await gateway.invokePrimary({
      query: request.query, correlationId: lookupId, attemptId, signal,
    }), {
      correlationId: lookupId,
      attemptId,
      ...gateway.providerValidation,
    });
  } catch {
    await gateway.finalizeAttempt({
      lookupId,attemptId,normalizedOutcome: 'provider_unavailable',
      disposition: 'rejected',providerRequestId: null,normalizedCandidate: null,
      retryable: true,physicalStatus: 'outcome_unknown',
    });
    await gateway.completeManual({
      lookupId,attemptId,outcome: 'provider_unavailable',retryable: true,
    });
    return { outcome: 'manual_metadata_required' };
  }
  const accepted = provider.outcome === 'coherent_match' && provider.selected !== null;
  const retainAccepted = accepted && policy.allowPositiveRetention;
  await gateway.finalizeAttempt({
    lookupId,
    attemptId,
    normalizedOutcome: provider.outcome,
    logicalOutcome: accepted && !policy.allowPositiveRetention
      ? policy.requiredDegradationOutcome : undefined,
    disposition: retainAccepted ? 'accepted' : 'rejected',
    providerRequestId: provider.providerRequestId,
    normalizedCandidate: retainAccepted ? provider.selected : null,
    evidence: retainAccepted ? provider.evidence : [],
    retryable: provider.retryable,
    physicalStatus: 'finalized',
  });
  if (accepted) {
    if (!policy.allowPositiveRetention) {
      await gateway.completeManual({
        lookupId,
        attemptId,
        outcome: policy.requiredDegradationOutcome,
        retryable: false,
      });
      return { outcome: 'manual_metadata_required' };
    }
    await gateway.persistSelection({
      lookupId,
      attemptId,
      selected: provider.selected!,
      evidence: provider.evidence,
    });
    if (policy.allowCacheWrite) {
      await persistCacheAfterTerminal(gateway, {
        lookupId, attemptId, normalizedOutcome: provider.outcome,
        selected: provider.selected,
      });
    }
    return { outcome: 'accepted_metadata_match' };
  }
  await gateway.completeManual({
    lookupId, attemptId, outcome: provider.outcome, retryable: provider.retryable,
  });
  if (!provider.retryable && policy.allowCacheWrite && isCacheableOutcome(provider.outcome)) {
    await persistCacheAfterTerminal(gateway, {
      lookupId, attemptId, normalizedOutcome: provider.outcome, selected: null,
    });
  }
  return { outcome: 'manual_metadata_required' };
}
