import { MetadataEdition, parseNormalizedMetadataEdition } from '../contracts/metadata';
import { ProviderHostPolicy } from '../contracts/providerReuse';
import { asRecord, assertKnownKeys } from '../domain/validation';
import { MetadataQueryIdentity } from './queryIdentity';

export type MetadataNormalizedOutcome =
  | 'coherent_match'
  | 'no_acceptable_match'
  | 'ambiguous_match'
  | 'material_conflict'
  | 'provider_unavailable'
  | 'timeout'
  | 'network_failure'
  | 'rate_limited'
  | 'circuit_breaker_open'
  | 'malformed_response'
  | 'schema_invalid'
  | 'response_too_large'
  | 'unsupported_content_type'
  | 'authentication_configuration_failure'
  | 'insufficient_query'
  | 'policy_denied'
  | 'legal_launch_denied'
  | 'cost_quota_denied'
  | 'provider_disabled'
  | 'cancelled';

export type MetadataCanonicalOutcome =
  | 'accepted_metadata_match'
  | 'ambiguous'
  | 'material_conflict'
  | 'no_match'
  | 'technical_failure'
  | 'policy_denied'
  | 'cost_quota_denied'
  | 'manual_metadata_required';

export function canonicalizeMetadataOutcome(
  outcome: MetadataNormalizedOutcome,
): MetadataCanonicalOutcome {
  if (outcome === 'coherent_match') return 'accepted_metadata_match';
  if (outcome === 'no_acceptable_match') return 'no_match';
  if (outcome === 'ambiguous_match') return 'ambiguous';
  if (outcome === 'material_conflict') return 'material_conflict';
  if (outcome === 'cost_quota_denied') return 'cost_quota_denied';
  if (outcome === 'insufficient_query') return 'manual_metadata_required';
  if (['authentication_configuration_failure', 'policy_denied',
    'legal_launch_denied', 'provider_disabled', 'cancelled'].includes(outcome)) {
    return 'policy_denied';
  }
  return 'technical_failure';
}

export type MetadataProviderOutcome = Readonly<{
  outcome: MetadataNormalizedOutcome;
  candidates: readonly MetadataEdition[];
  selected: MetadataEdition | null;
  evidence: readonly string[];
  retryable: boolean;
  secondaryEligible: boolean;
  providerRequestId: string | null;
}>;

const normalizedOutcomes = new Set<MetadataNormalizedOutcome>([
  'coherent_match','no_acceptable_match','ambiguous_match','material_conflict',
  'provider_unavailable','timeout','network_failure','rate_limited','circuit_breaker_open',
  'malformed_response','schema_invalid','response_too_large','unsupported_content_type',
  'authentication_configuration_failure','insufficient_query','policy_denied',
  'legal_launch_denied','cost_quota_denied','provider_disabled','cancelled',
]);

const retryableOutcomes = new Set<MetadataNormalizedOutcome>([
  'provider_unavailable','timeout','network_failure','rate_limited','circuit_breaker_open',
]);

const secondaryEligibleOutcomes = new Set<MetadataNormalizedOutcome>([
  'no_acceptable_match','ambiguous_match','material_conflict','provider_unavailable',
  'timeout','network_failure','rate_limited','circuit_breaker_open','malformed_response',
  'schema_invalid','response_too_large','unsupported_content_type',
]);

const candidateOutcomes = new Set<MetadataNormalizedOutcome>([
  'coherent_match','no_acceptable_match','ambiguous_match','material_conflict',
]);

const PROVIDER_OUTCOME_KEYS = [
  'outcome','candidates','selected','evidence','retryable','secondaryEligible','providerRequestId',
] as const;

const EVIDENCE_TOKEN = /^[a-z][a-z0-9_]{0,63}$/u;
const PROVIDER_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export type MetadataProviderValidationContext = Readonly<{
  correlationId: string;
  attemptId: string;
  adapterKey?: string;
  adapterVersion?: string;
  hostPolicy?: ProviderHostPolicy;
}>;

export function failClosedMetadataProviderOutcome(
  value: unknown,
  context: MetadataProviderValidationContext,
): MetadataProviderOutcome {
  try {
    const row = asRecord(value, 'metadata_provider_outcome');
    assertKnownKeys(row, PROVIDER_OUTCOME_KEYS, 'metadata_provider_outcome');
    if (typeof row.outcome !== 'string'
      || !normalizedOutcomes.has(row.outcome as MetadataNormalizedOutcome)
      || !Array.isArray(row.candidates) || row.candidates.length > 10
      || !Array.isArray(row.evidence) || row.evidence.length > 32
      || row.evidence.some((item) => typeof item !== 'string' || !EVIDENCE_TOKEN.test(item))
      || typeof row.retryable !== 'boolean'
      || typeof row.secondaryEligible !== 'boolean'
      || !(row.providerRequestId === null || (typeof row.providerRequestId === 'string'
        && PROVIDER_REQUEST_ID.test(row.providerRequestId)))) {
      return invalidProviderOutcome();
    }
    const outcome = row.outcome as MetadataNormalizedOutcome;
    if (row.retryable !== retryableOutcomes.has(outcome)
      || row.secondaryEligible !== secondaryEligibleOutcomes.has(outcome)
      || (!candidateOutcomes.has(outcome) && row.candidates.length > 0)
      || (outcome === 'coherent_match' && row.evidence.length === 0)) {
      return invalidProviderOutcome();
    }
    const candidates = row.candidates.map((candidate) =>
      parseNormalizedMetadataEdition(candidate, context.hostPolicy));
    for (const candidate of candidates) {
      if (candidate.correlationId !== context.correlationId
        || candidate.attemptId !== context.attemptId
        || (context.adapterKey !== undefined && candidate.adapterKey !== context.adapterKey)
        || (context.adapterVersion !== undefined && candidate.adapterVersion !== context.adapterVersion)) {
        return invalidProviderOutcome();
      }
    }
    let selected: MetadataEdition | null = null;
    if (outcome === 'coherent_match') {
      selected = parseNormalizedMetadataEdition(row.selected, context.hostPolicy);
      const selectedKey = JSON.stringify(selected);
      if (!candidates.some((candidate) => JSON.stringify(candidate) === selectedKey)) {
        return invalidProviderOutcome();
      }
    } else if (row.selected !== null) {
      return invalidProviderOutcome();
    }
    return Object.freeze({
      outcome,
      candidates: Object.freeze(candidates),
      selected,
      evidence: Object.freeze([...row.evidence] as string[]),
      retryable: row.retryable,
      secondaryEligible: row.secondaryEligible,
      providerRequestId: row.providerRequestId,
    });
  } catch {
    return invalidProviderOutcome();
  }
}

function invalidProviderOutcome(): MetadataProviderOutcome {
  return Object.freeze({
    outcome: 'schema_invalid', candidates: Object.freeze([]), selected: null,
    evidence: Object.freeze([]), retryable: false,
    secondaryEligible: true, providerRequestId: null,
  });
}

export type MetadataProviderLookup = Readonly<{
  query: MetadataQueryIdentity;
  correlationId: string;
  attemptId: string;
  signal: AbortSignal;
}>;

export interface MetadataProviderAdapter {
  readonly normalizedEditionHostPolicy?: ProviderHostPolicy;
  lookup(input: MetadataProviderLookup): Promise<unknown>;
}
