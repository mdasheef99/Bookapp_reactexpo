import type { EditionOptionsProviderResult } from '../contracts';
import { failClosedMetadataProviderOutcome } from '../providerAdapter';
import type { MetadataNormalizedOutcome, MetadataProviderOutcome } from '../providerAdapter';
import type {
  LookupInput,
  MetadataResultV2,
  ProviderDescriptor,
  Purpose,
  RetainedList,
} from '../providerDescriptor';
import { PROVIDER_RESULT_VERSION } from '../providerDescriptor';
import type { GoogleBooksAdapter } from './adapter';
import { GOOGLE_BOOKS_EDITION_HOST_POLICY } from './decoder';

export const GOOGLE_BOOKS_ADAPTER_VERSION = '1.0.0';
export const GOOGLE_BOOKS_RETENTION_CONTRACT = 'google-books-options-v1';

const secondaryEligibleOutcomes = new Set<MetadataNormalizedOutcome>([
  'no_acceptable_match', 'ambiguous_match', 'material_conflict',
  'provider_unavailable', 'timeout', 'network_failure', 'rate_limited',
  'circuit_breaker_open', 'malformed_response', 'schema_invalid',
  'response_too_large', 'unsupported_content_type',
]);

const candidateOutcomes = new Set<MetadataNormalizedOutcome>([
  'coherent_match', 'ambiguous_match', 'material_conflict',
]);

const explicitOutcome = (result: EditionOptionsProviderResult): MetadataProviderOutcome => {
  const selected = result.outcome === 'coherent_match'
    ? result.rows.find((row) => row.eligibility === 'eligible'
      && row.metadata?.matchRationale === 'exact_validated_isbn')?.metadata ?? null
    : null;
  if (result.outcome === 'coherent_match' && selected === null) {
    // A coherent summary without the row-level exact evidence is malformed;
    // never relabel another row or invent the rationale.
    return {
      outcome: 'schema_invalid', candidates: [], selected: null, evidence: [],
      retryable: false, secondaryEligible: true,
      providerRequestId: result.providerRequestId, representativeCover: null,
    };
  }
  const candidates = candidateOutcomes.has(result.outcome)
    ? result.rows.flatMap((row) => row.metadata === null ? [] : [row.metadata])
    : [];
  return {
    outcome: result.outcome,
    candidates,
    selected,
    evidence: selected === null ? [] : ['exact_validated_isbn'],
    retryable: result.retryable,
    secondaryEligible: secondaryEligibleOutcomes.has(result.outcome),
    providerRequestId: result.providerRequestId,
    representativeCover: null,
  };
};

const retainedList = (
  result: EditionOptionsProviderResult,
  retentionContract: string | null,
  policyVersion: number | null,
): RetainedList | null => {
  if (retentionContract === null || policyVersion === null || result.fetchedAt === null
    || result.retentionEvidence?.storagePermissionVerified !== true
    || result.retentionEvidence.permittedDeadlineAt === null) return null;
  return {
    sourceFetchedAt: result.fetchedAt,
    permittedDeadlineAt: result.retentionEvidence.permittedDeadlineAt,
    policyVersion,
    storagePermissionVerified: true,
    retentionContract,
  };
};

export type GoogleBooksDescriptorOptions = Readonly<{
  adapter: GoogleBooksAdapter | null;
  credentialsReady?: () => boolean;
  retentionPolicyVersion?: number | null;
}>;

export function createGoogleBooksDescriptor(
  options: GoogleBooksDescriptorOptions,
): ProviderDescriptor {
  const adapter = options.adapter;
  const policyVersion = options.retentionPolicyVersion !== undefined
    && options.retentionPolicyVersion !== null
    && Number.isSafeInteger(options.retentionPolicyVersion)
    && options.retentionPolicyVersion > 0 ? options.retentionPolicyVersion : null;
  const retentionContract = adapter?.optionsRetentionConfigured === true && policyVersion !== null
    ? GOOGLE_BOOKS_RETENTION_CONTRACT : null;
  const purposes: readonly Purpose[] = ['automatic', 'edition_options'];

  return {
    adapterKey: 'google_books',
    adapterVersion: GOOGLE_BOOKS_ADAPTER_VERSION,
    capabilityVersion: 'google-books-capability-v1',
    normalizerVersion: 'p9-bibliographic-normalizer-v1',
    payloadSchemaVersion: 'p9-metadata-v1',
    lookupSchemaVersion: 'p9-metadata-foundation-v1',
    validationContract: 'google-books-v1',
    hostPolicyVersion: 'google-books-hosts-v1',
    retentionContract,
    protocol: { kind: 'single', maxGets: 1 },
    purposes,
    credentialsReady: options.credentialsReady ?? (() => adapter !== null),
    retentionReady: (purpose) => purpose === 'edition_options' && retentionContract !== null,
    async invoke(input: LookupInput): Promise<MetadataResultV2> {
      if (adapter === null) throw new Error('P9_PROVIDER_DESCRIPTOR_UNAVAILABLE');
      if (input.purpose === 'automatic') {
        const raw = await adapter.lookup({
          query: input.query, correlationId: input.correlationId,
          attemptId: input.attemptId, signal: input.signal,
          ...(input.observeAutomaticHttp === undefined ? {} : { observeAutomaticHttp: input.observeAutomaticHttp }),
        });
        const outcome = failClosedMetadataProviderOutcome(raw, {
          correlationId: input.correlationId,
          attemptId: input.attemptId,
          adapterKey: 'google_books',
          adapterVersion: GOOGLE_BOOKS_ADAPTER_VERSION,
          hostPolicy: GOOGLE_BOOKS_EDITION_HOST_POLICY,
        });
        return {
          version: PROVIDER_RESULT_VERSION, purpose: 'automatic', outcome,
          rows: null, catalogueCompanions: null, retention: null,
        };
      }
      if (input.purpose === 'edition_options') {
        const result = await adapter.lookupEditionOptions({
          query: input.query, correlationId: input.correlationId,
          attemptId: input.attemptId, signal: input.signal,
        });
        const retention = retainedList(result, retentionContract, policyVersion);
        return {
          version: PROVIDER_RESULT_VERSION, purpose: 'edition_options',
          outcome: explicitOutcome(result),
          rows: retention === null ? null : result.rows,
          catalogueCompanions: retention === null ? null : (result.catalogueCompanions ?? []),
          retention,
        };
      }
      throw new Error('P9_PROVIDER_PURPOSE_UNSUPPORTED');
    },
  };
}
