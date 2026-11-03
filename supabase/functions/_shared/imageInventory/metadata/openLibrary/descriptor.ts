// Early U4 deliverable: row, retention and physical-call parity remain UNPROVEN; verification belongs to U4/U6.
import type { EditionOptionsProviderResult } from '../contracts';
import type { MetadataNormalizedOutcome, MetadataProviderOutcome } from '../providerAdapter';
import type {
  LookupInput,
  MetadataResultV2,
  ProviderDescriptor,
  Purpose,
  RetainedList,
} from '../providerDescriptor';
import { PROVIDER_RESULT_VERSION } from '../providerDescriptor';
import type { OpenLibraryEditionOptionsAdapter } from './adapter';
import { invokeOpenLibraryV2 } from './automatic';
import { OPEN_LIBRARY_ADAPTER_VERSION } from './normalizer';

export const OPEN_LIBRARY_RETENTION_CONTRACT = 'open-library-options-v1';

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
  policyVersion: number | null,
): RetainedList | null => {
  if (policyVersion === null || result.fetchedAt === null
    || result.retentionEvidence?.storagePermissionVerified !== true
    || result.retentionEvidence.permittedDeadlineAt === null) return null;
  return {
    sourceFetchedAt: result.fetchedAt,
    permittedDeadlineAt: result.retentionEvidence.permittedDeadlineAt,
    policyVersion,
    storagePermissionVerified: true,
    retentionContract: OPEN_LIBRARY_RETENTION_CONTRACT,
  };
};

export type OpenLibraryV1DescriptorOptions = Readonly<{
  adapter: OpenLibraryEditionOptionsAdapter | null;
  policyVersion?: number | null;
  credentialsReady?: () => boolean;
}>;

export function createOpenLibraryV1Descriptor(
  options: OpenLibraryV1DescriptorOptions,
): ProviderDescriptor {
  const adapter = options.adapter;
  const policyVersion = options.policyVersion !== undefined
    && options.policyVersion !== null
    && Number.isSafeInteger(options.policyVersion)
    && options.policyVersion > 0 ? options.policyVersion : null;
  const purposes: readonly Purpose[] = ['edition_options'];

  return {
    adapterKey: 'open_library',
    adapterVersion: OPEN_LIBRARY_ADAPTER_VERSION,
    capabilityVersion: 'open-library-capability-v1',
    normalizerVersion: 'p9-bibliographic-normalizer-v1',
    payloadSchemaVersion: 'p9-metadata-v1',
    lookupSchemaVersion: 'p9-metadata-foundation-v1',
    validationContract: 'open-library-v1',
    hostPolicyVersion: 'open-library-hosts-v1',
    retentionContract: OPEN_LIBRARY_RETENTION_CONTRACT,
    protocol: { kind: 'fanout', maxGets: 6 },
    purposes,
    credentialsReady: options.credentialsReady ?? (() => adapter !== null),
    retentionReady: (purpose) => purpose === 'edition_options'
      && adapter !== null && adapter.optionsRetentionConfigured === true
      && policyVersion !== null,
    async invoke(input: LookupInput): Promise<MetadataResultV2> {
      if (adapter === null) throw new Error('P9_PROVIDER_DESCRIPTOR_UNAVAILABLE');
      if (input.purpose !== 'edition_options') {
        throw new Error('P9_PROVIDER_PURPOSE_UNSUPPORTED');
      }
      const result = await adapter.lookupEditionOptions({
        query: input.query, correlationId: input.correlationId,
        attemptId: input.attemptId, signal: input.signal,
      });
      const retention = retainedList(result, policyVersion);
      return {
        version: PROVIDER_RESULT_VERSION, purpose: 'edition_options',
        outcome: explicitOutcome(result),
        rows: retention === null ? null : result.rows,
        catalogueCompanions: retention === null ? null : (result.catalogueCompanions ?? []),
        retention,
      };
    },
  };
}

export type OpenLibraryV2DescriptorOptions = Readonly<{
  // Port-only descriptor (02c §5.1, OQ-B): no adapter instance. The ONLY
  // egress of invoke() is input.http.get. policyVersion is the verified
  // per-job registry policy bound by the caller (worker route time in
  // production, explicit test setup in tests); null leaves the descriptor
  // unbound (retentionReady false), mirroring the v1 boot entry. NEVER
  // default a production policyVersion here.
  policyVersion?: number | null;
}>;

export function createOpenLibraryV2Descriptor(
  options: OpenLibraryV2DescriptorOptions = {},
): ProviderDescriptor {
  const policyVersion = options.policyVersion !== undefined
    && options.policyVersion !== null
    && Number.isSafeInteger(options.policyVersion)
    && options.policyVersion > 0 ? options.policyVersion : null;
  const purposes: readonly Purpose[] = ['automatic', 'edition_options'];

  return {
    adapterKey: 'open_library',
    adapterVersion: '2.0.0',
    capabilityVersion: 'open-library-capability-v2',
    normalizerVersion: 'p9-bibliographic-normalizer-v1',
    payloadSchemaVersion: 'p9-metadata-v1',
    lookupSchemaVersion: 'p9-metadata-foundation-v1',
    validationContract: 'open-library-v2',
    hostPolicyVersion: 'open-library-hosts-v1',
    retentionContract: OPEN_LIBRARY_RETENTION_CONTRACT,
    protocol: { kind: 'fanout', maxGets: 6 },
    purposes,
    // Open Library needs no credential: v2 is always credential-ready.
    credentialsReady: () => true,
    retentionReady: (purpose) => purposes.includes(purpose) && policyVersion !== null,
    async invoke(input: LookupInput): Promise<MetadataResultV2> {
      if (input.purpose !== 'automatic' && input.purpose !== 'edition_options') {
        throw new Error('P9_PROVIDER_PURPOSE_UNSUPPORTED');
      }
      return invokeOpenLibraryV2({
        ...input, version: PROVIDER_RESULT_VERSION,
        policyVersion, retentionContract: OPEN_LIBRARY_RETENTION_CONTRACT,
      });
    },
  };
}
