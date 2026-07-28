import { MetadataEdition } from '../contracts/metadata';
import { MetadataQueryIdentity } from '../metadata';
import { GoogleBooksOutcome } from '../metadata/googleBooks';

type Request = Readonly<{
  candidateId: string;
  storeId: string;
  jobId: string;
  claimAttempt: number;
  claimWorker: string;
  claimLeaseToken: string;
  query: MetadataQueryIdentity;
  providerPolicy: Readonly<{
    enabled: boolean;
    adapterVersionCompatible: boolean;
    capabilityVersionCompatible: boolean;
    matchingAllowed: boolean;
    storageAllowed: boolean;
    reuseAllowed: boolean;
    pricingPolicyCompatible: boolean;
  }>;
}>;

type Finalization = Readonly<{
  lookupId: string;
  attemptId: string;
  normalizedOutcome: string;
  disposition: 'accepted' | 'rejected' | 'stale_rejected';
  providerRequestId: string | null;
}>;

export type MetadataProductionGateway = Readonly<{
  resolveLocal(request: Request): Promise<
    | { outcome: 'matched'; canonicalEditionId: string }
    | { outcome: 'insufficient' }
  >;
  readCache(request: Request): Promise<
    | { outcome: 'miss' }
    | { outcome: 'hit'; normalizedOutcome: string }
  >;
  completeCacheHit(request: Request, normalizedOutcome: string): Promise<void>;
  decideCoalescing(request: Request): Promise<
    | { mode: 'leader' }
    | { mode: 'follower'; leaderLookupId: string }
  >;
  registerFollower(request: Request, leaderLookupId: string): Promise<void>;
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

const cacheManual = new Set([
  'no_acceptable_match', 'ambiguous_match', 'material_conflict',
  'technical_failure', 'policy_denied', 'cost_quota_denied',
]);

export async function runMetadataProductionComposition(
  request: Request,
  gateway: MetadataProductionGateway,
  signal: AbortSignal = new AbortController().signal,
): Promise<MetadataCompositionResult> {
  const local = await gateway.resolveLocal(request);
  if (local.outcome === 'matched') return { outcome: 'local_canonical_match' };

  const policy = request.providerPolicy;
  if (!policy.enabled || !policy.adapterVersionCompatible
    || !policy.capabilityVersionCompatible || !policy.matchingAllowed
    || !policy.reuseAllowed || !policy.pricingPolicyCompatible) {
    await gateway.completeManual({ outcome: 'policy_denied' });
    return { outcome: 'manual_metadata_required' };
  }

  const cached = await gateway.readCache(request);
  if (cached.outcome === 'hit') {
    await gateway.completeCacheHit(request, cached.normalizedOutcome);
    return {
      outcome: cacheManual.has(cached.normalizedOutcome)
        ? 'manual_metadata_required' : 'accepted_metadata_match',
    };
  }

  const coalescing = await gateway.decideCoalescing(request);
  if (coalescing.mode === 'follower') {
    await gateway.registerFollower(request, coalescing.leaderLookupId);
    return { outcome: 'coalesced_follower' };
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
  if (policy.reuseAllowed && (!accepted || policy.storageAllowed)) {
    await gateway.persistCache({
      lookupId,
      attemptId,
      normalizedOutcome: provider.outcome,
      selected: provider.selected,
    });
  }
  if (accepted) {
    if (!policy.storageAllowed) {
      await gateway.completeManual({ lookupId, attemptId, outcome: 'policy_denied' });
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
