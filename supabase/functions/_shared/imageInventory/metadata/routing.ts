export type MetadataProviderRole = 'primary' | 'secondary';

export type MetadataProviderCapability = Readonly<{
  role: MetadataProviderRole;
  adapterKey: string;
  adapterVersion: string;
  capabilityVersion: string;
  enabled: boolean;
}>;

export type MetadataProviderConfiguration = Readonly<{
  primary: MetadataProviderCapability | null;
  secondary: MetadataProviderCapability | null;
}>;

export function validateMetadataProviderConfiguration(
  configured: MetadataProviderConfiguration,
): Readonly<{
  primary: MetadataProviderCapability;
  secondary: MetadataProviderCapability | null;
}> {
  if (configured.primary === null || configured.primary.role !== 'primary'
    || !configured.primary.enabled) {
    throw new Error('exactly one primary metadata provider must be enabled');
  }
  if (configured.secondary !== null
    && (configured.secondary.role !== 'secondary' || !configured.secondary.enabled)) {
    throw new Error('secondary metadata provider must be selected and enabled explicitly');
  }
  return Object.freeze({
    primary: configured.primary,
    secondary: configured.secondary,
  });
}

export const SECONDARY_ELIGIBLE_METADATA_OUTCOMES = [
  'no_acceptable_match', 'ambiguous_match', 'material_conflict', 'schema_invalid',
  'malformed_response', 'timeout', 'rate_limited', 'provider_unavailable',
  'circuit_breaker_open',
] as const;

export type NormalizedProviderOutcome =
  | 'coherent_match'
  | typeof SECONDARY_ELIGIBLE_METADATA_OUTCOMES[number]
  | 'invalid_query'
  | 'policy_denied'
  | 'cost_quota_denied'
  | 'authentication_configuration_failure';

export function planMetadataRouting(input: Readonly<{
  configured: MetadataProviderConfiguration;
  localOutcome: 'matched' | 'cache_hit' | 'insufficient';
  attempts: readonly Readonly<{
    role: MetadataProviderRole;
    adapterKey: string;
    adapterVersion: string;
    normalizedOutcome: NormalizedProviderOutcome;
  }>[];
}>): Readonly<{ action: 'complete' | 'invoke'; nextRole: MetadataProviderRole | null }> {
  const configured = validateMetadataProviderConfiguration(input.configured);
  const primaryCount = input.attempts.filter(({ role }) => role === 'primary').length;
  const secondaryCount = input.attempts.filter(({ role }) => role === 'secondary').length;
  if (primaryCount > 1 || secondaryCount > 1) {
    throw new Error('one external attempt per configured metadata role is allowed');
  }
  if (input.attempts[0]?.role === 'secondary'
    || input.attempts.some((attempt, index) =>
      attempt.role === 'primary' && index > 0)) {
    throw new Error('metadata provider attempts must be primary then optional secondary');
  }
  const primaryAttempt = input.attempts.find(({ role }) => role === 'primary');
  if (primaryAttempt && (primaryAttempt.adapterKey !== configured.primary.adapterKey
    || primaryAttempt.adapterVersion !== configured.primary.adapterVersion)) {
    throw new Error('primary metadata attempt does not match configured provider');
  }
  const secondaryAttempt = input.attempts.find(({ role }) => role === 'secondary');
  if (secondaryAttempt && (configured.secondary === null
    || secondaryAttempt.adapterKey !== configured.secondary.adapterKey
    || secondaryAttempt.adapterVersion !== configured.secondary.adapterVersion)) {
    throw new Error('secondary metadata attempt does not match configured provider');
  }
  if (input.localOutcome !== 'insufficient') return { action: 'complete', nextRole: null };
  if (input.attempts.length === 0) return { action: 'invoke', nextRole: 'primary' };
  const last = input.attempts[input.attempts.length - 1];
  if (last.normalizedOutcome === 'coherent_match') return { action: 'complete', nextRole: null };
  const secondaryEligible = SECONDARY_ELIGIBLE_METADATA_OUTCOMES
    .includes(last.normalizedOutcome as typeof SECONDARY_ELIGIBLE_METADATA_OUTCOMES[number]);
  if (last.role === 'primary' && secondaryEligible && configured.secondary !== null) {
    return { action: 'invoke', nextRole: 'secondary' };
  }
  return { action: 'complete', nextRole: null };
}
