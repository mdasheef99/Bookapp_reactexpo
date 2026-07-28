import { MetadataEdition } from '../contracts/metadata';
import { MetadataQueryIdentity } from '../metadata';
import { GoogleBooksOutcome } from '../metadata/googleBooks';

export type MetadataProviderPolicy = Readonly<{
  enabled: boolean;
  adapterVersionCompatible: boolean;
  capabilityVersionCompatible: boolean;
  matchingAllowed: boolean;
  storageAllowed: boolean;
  reuseAllowed: boolean;
  pricingPolicyCompatible: boolean;
}>;

type Request = Readonly<{
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
  normalizedOutcome: string;
  disposition: 'accepted' | 'rejected' | 'stale_rejected';
  providerRequestId: string | null;
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
  resolveLocal(request: Request): Promise<
    | { outcome: 'matched'; canonicalEditionId: string }
    | { outcome: 'insufficient' }
  >;
  readCache(request: Request): Promise<
    | { outcome: 'miss' }
    | { outcome: 'hit'; normalizedOutcome: string }
  >;
  completeCacheHit(
    request: Request,
    normalizedOutcome: string,
    decision: MetadataPolicyDecision,
  ): Promise<MetadataReuseCompletion>;
  decideCoalescing(request: Request): Promise<
    | { mode: 'leader' }
    | { mode: 'follower'; leaderLookupId: string }
  >;
  registerFollower(
    request: Request,
    leaderLookupId: string,
    decision: MetadataPolicyDecision,
  ): Promise<MetadataReuseCompletion>;
  registerLookup(request: Request): Promise<{ lookupId: string }>;
  reserveUsage(input: Request & { lookupId: string }): Promise<{ reservationId: string }>;
  registerAttempt(input: Request & {
    lookupId: string;
    reservationId: string;
    providerRole: 'primary';
  }): Promise<{ attemptId: string }>;
  validateEgress(input: Request & { lookupId: string; attemptId: string }): Promise<boolean>;
  invokePrimary(input: Readonly<{
    query: MetadataQueryIdentity;
    correlationId: string;
    attemptId: string;
    signal: AbortSignal;
  }>): Promise<GoogleBooksOutcome>;
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
  }>): Promise<void>;
}>;

export type MetadataCompositionResult = Readonly<{
  outcome: 'local_canonical_match' | 'manual_metadata_required'
    | 'coalesced_follower' | 'stale_claim' | 'accepted_metadata_match';
}>;

const isPositiveOutcome = (outcome: string) => outcome === 'coherent_match';

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
  request: Request,
  gateway: MetadataProductionGateway,
  signal: AbortSignal = new AbortController().signal,
): Promise<MetadataCompositionResult> {
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
  }

  if (!policy.allowFreshProviderCall) {
    await gateway.completeManual({
      outcome: policy.requiredDegradationOutcome,
    });
    return { outcome: 'manual_metadata_required' };
  }

  const { lookupId } = await gateway.registerLookup(request);
  const { reservationId } = await gateway.reserveUsage({ ...request, lookupId });
  const { attemptId } = await gateway.registerAttempt({
    ...request,
    lookupId,
    reservationId,
    providerRole: 'primary',
  });
  const active = await gateway.validateEgress({ ...request, lookupId, attemptId });
  if (!active) {
    await gateway.finalizeAttempt({
      lookupId,
      attemptId,
      normalizedOutcome: 'policy_denied',
      disposition: 'stale_rejected',
      providerRequestId: null,
    });
    return { outcome: 'stale_claim' };
  }

  const provider = await gateway.invokePrimary({
    query: request.query,
    correlationId: lookupId,
    attemptId,
    signal,
  });
  const accepted = provider.outcome === 'coherent_match' && provider.selected !== null;
  await gateway.finalizeAttempt({
    lookupId,
    attemptId,
    normalizedOutcome: provider.outcome,
    disposition: accepted ? 'accepted' : 'rejected',
    providerRequestId: provider.providerRequestId,
  });
  if (policy.allowCacheWrite && (!accepted || policy.allowPositiveRetention)) {
    await gateway.persistCache({
      lookupId,
      attemptId,
      normalizedOutcome: provider.outcome,
      selected: provider.selected,
    });
  }
  if (accepted) {
    if (!policy.allowPositiveRetention) {
      await gateway.completeManual({
        lookupId,
        attemptId,
        outcome: policy.requiredDegradationOutcome,
      });
      return { outcome: 'manual_metadata_required' };
    }
    await gateway.persistSelection({
      lookupId,
      attemptId,
      selected: provider.selected!,
      evidence: provider.evidence,
    });
    return { outcome: 'accepted_metadata_match' };
  }
  await gateway.completeManual({ lookupId, attemptId, outcome: provider.outcome });
  return { outcome: 'manual_metadata_required' };
}
