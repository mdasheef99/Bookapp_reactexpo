import { OpenLibraryFailure } from '../metadata/openLibrary/transport';
import { ProviderHttpError } from '../metadata/providerHttp';

// S7: admission pause, policy/auth/quota/configuration denials and breaker
// refusals keep their identity. Thrown denials must terminate without
// secondary egress or technical retry instead of collapsing into retryable
// provider_unavailable.
const EXPLICIT_DENIAL_OUTCOMES: readonly string[] = [
  'policy_denied', 'provider_disabled', 'authentication_configuration_failure',
  'cost_quota_denied', 'legal_launch_denied', 'cancelled', 'insufficient_query',
  'circuit_breaker_open',
];

export function explicitDenialOutcome(error: unknown): string | null {
  const outcome = error instanceof OpenLibraryFailure ? error.outcome
    : error instanceof ProviderHttpError ? error.outcome : null;
  if (outcome !== null && EXPLICIT_DENIAL_OUTCOMES.includes(outcome)) return outcome;
  if (error instanceof Error && EXPLICIT_DENIAL_OUTCOMES.includes(error.message)) return error.message;
  return null;
}

// S7: an admission pause is an operator/policy refusal, not a technical retry
// allowance: no fabricated finalization, no GET, manual fallback.
export function isAdmissionPaused(error: unknown): boolean {
  return error instanceof Error && error.message === 'P9_EXTERNAL_ADMISSION_PAUSED';
}

// U6 fix1 (F7): shared denial mapping for every explicit-path catch. Thrown
// denials and admission pauses keep identity (nonretryable, no secondary,
// no new-claim retry). Unknown P9_-coded errors (configuration/state) also
// terminate without fallback or retry — they are never collapsed into
// retryable provider_unavailable. Non-P9_ unknowns (genuine transport/
// programming failures) keep the existing retryable outcome. Returns null
// when the caller must apply its default (retryable) mapping.
export function denialFail(error: unknown): { outcome: string; retryable: boolean } | null {
  if (isAdmissionPaused(error)) return { outcome: 'provider_unavailable', retryable: false };
  const denial = explicitDenialOutcome(error);
  if (denial !== null) return { outcome: denial, retryable: false };
  if (error instanceof Error && error.message.startsWith('P9_')) {
    return { outcome: 'provider_unavailable', retryable: false };
  }
  return null;
}

// Narrow variant for the OUTER catch: completion/recovery-phase P9_ errors
// (e.g. a mismatched completion receipt, P9_EDITION_COMPLETION_INVALID) keep
// their pinned recovery (retryable) semantics; only pauses, typed denials
// and configuration failures terminate. Lookup-phase catches use the full
// denialFail above.
export function outerDenialFail(error: unknown): { outcome: string; retryable: boolean } | null {
  if (isAdmissionPaused(error)) return { outcome: 'provider_unavailable', retryable: false };
  const denial = explicitDenialOutcome(error);
  if (denial !== null) return { outcome: denial, retryable: false };
  if (error instanceof Error && error.message === 'P9_PROVIDER_CONFIGURATION_INVALID') {
    return { outcome: 'provider_disabled', retryable: false };
  }
  return null;
}

