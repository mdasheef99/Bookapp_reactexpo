import type {
  MetadataCompositionResult, MetadataProviderPolicy, MetadataPolicyDecision,
  MetadataReuseCompletion, MetadataManualCompletion,
} from './metadataProductionComposition';

// Picker §4.3 preserves the automatic policy/result rules; shared extraction only.
export const isPositiveOutcome = (outcome: string) =>
  outcome === 'coherent_match' || outcome === 'accepted_metadata_match';

export const isCacheableOutcome = (outcome: string) => [
  'coherent_match', 'no_acceptable_match', 'ambiguous_match', 'material_conflict',
].includes(outcome);

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

export function resultForReuseCompletion(
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

export function resultForManualCompletion(
  completion: MetadataManualCompletion,
): MetadataCompositionResult {
  const persistedStatus = completion.status === 'replayed'
    ? completion.jobStatus : completion.status;
  return { outcome: persistedStatus === 'retry_scheduled'
    ? 'retry_scheduled' : 'manual_metadata_required' };
}
