import type { MetadataProviderOutcome, MetadataNormalizedOutcome } from '../providerAdapter';
import type {
  LookupInput,
  MetadataResultV2,
  ProviderResultVersion,
  RetainedList,
} from '../providerDescriptor';
import { fetchOpenLibraryBundle, normalizeOpenLibraryBundle } from './fetch';
import { rankAutomaticRows } from './publisher';
import { OpenLibraryFailure } from './transport';

// Open Library v2 invoke core (02c §5.1). Port-only: the ONLY egress is
// input.http.get; no fetcher, transport limiter, global fetch, canned
// packet or fabricated receipt exists on this path. Deliberately
// self-contained (no imports from ./descriptor, which owns the v2 factory
// and imports this module): the small outcome/retention builders below
// mirror openLibrary/descriptor.ts parity points noted inline, and the
// frozen-packet plus REAL-validator tests guard any drift.

// C2: secondaryEligible mirrors EXACTLY the canonical
// secondaryEligibleOutcomes set (providerAdapter.ts:81-85, identical list at
// openLibrary/descriptor.ts:18-23). The eight excluded outcomes
// (coherent_match, authentication_configuration_failure, insufficient_query,
// policy_denied, legal_launch_denied, cost_quota_denied, provider_disabled,
// cancelled) yield false. The canonical parser (providerAdapter.ts:126-127)
// rejects any disagreement, so an every-outcome agreement test pins this.
// U6 fix2 (G8): native v2 port failures carry the same outcome/retryability as
// the v1 transport. Structural detection avoids a value import cycle
// (providerDescriptor -> openLibrary/descriptor -> this module) and never
// matches a P9_ configuration/state error, which has none of these fields.
type ProviderHttpFailureShape = Readonly<{
  outcome: string; retryable: boolean; physicalStatus: string; egressStarted: boolean;
}>;
function isProviderHttpFailure(error: unknown): error is ProviderHttpFailureShape {
  if (!(error instanceof Error)) return false;
  const row = error as unknown as Partial<ProviderHttpFailureShape>;
  return typeof row.outcome === 'string' && typeof row.retryable === 'boolean'
    && typeof row.physicalStatus === 'string' && typeof row.egressStarted === 'boolean';
}

const secondaryEligibleOutcomes = new Set<MetadataNormalizedOutcome>([
  'no_acceptable_match', 'ambiguous_match', 'material_conflict',
  'provider_unavailable', 'timeout', 'network_failure', 'rate_limited',
  'circuit_breaker_open', 'malformed_response', 'schema_invalid',
  'response_too_large', 'unsupported_content_type',
]);

// Exported for the every-outcome agreement test (new file, U4 work).
export const failureOutcome = (
  outcome: MetadataProviderOutcome['outcome'],
  retryable: boolean,
): MetadataProviderOutcome => ({
  outcome,
  candidates: [],
  selected: null,
  evidence: [],
  retryable,
  secondaryEligible: secondaryEligibleOutcomes.has(outcome),
  providerRequestId: null,
  representativeCover: null,
});

// Parity with openLibrary/descriptor.ts explicitOutcome over the reachable
// domain: a coherent summary without row-level exact evidence is malformed
// and never relabels another row. This normalizer emits
// coherent/ambiguous/no_acceptable_match only, so the candidates rule below
// (coherent/ambiguous carry metadata, no-list carries none) mirrors the
// descriptor's candidateOutcomes check without inventing a
// material_conflict branch neither side can reach.
const explicitSummary = (
  result: Readonly<{
    outcome: 'coherent_match' | 'ambiguous_match' | 'no_acceptable_match';
    rows: readonly import('../../contracts/ownerEditionPicker').StoredEditionRow[];
    retryable: boolean;
    providerRequestId: string | null;
  }>,
): MetadataProviderOutcome => {
  const selected = result.outcome === 'coherent_match'
    ? result.rows.find((row) => row.eligibility === 'eligible'
      && row.metadata?.matchRationale === 'exact_validated_isbn')?.metadata ?? null
    : null;
  if (result.outcome === 'coherent_match' && selected === null) {
    return failureOutcome('schema_invalid', false);
  }
  const candidates = result.outcome === 'coherent_match'
    || result.outcome === 'ambiguous_match'
    ? result.rows.flatMap((row) => row.metadata === null ? [] : [row.metadata])
    : [];
  return {
    outcome: result.outcome,
    candidates,
    selected,
    evidence: selected === null ? [] : ['exact_validated_isbn'],
    retryable: result.retryable,
    secondaryEligible: result.outcome !== 'coherent_match',
    providerRequestId: result.providerRequestId,
    representativeCover: null,
  };
};

// Parity with openLibrary/descriptor.ts retainedList: a null policy, a
// missing fetch time, or unverified/expired evidence forbids any retained
// list; the contract ID below is supplied by the v2 factory (never invented
// here) and must equal the installed open-library-options-v1 declaration.
const retainedListEvidence = (
  fetchedAt: string | null,
  evidence: Readonly<{ storagePermissionVerified: boolean; permittedDeadlineAt: string | null }> | null,
  policyVersion: number | null,
  retentionContract: string,
): RetainedList | null => {
  if (policyVersion === null || fetchedAt === null
    || evidence?.storagePermissionVerified !== true
    || evidence.permittedDeadlineAt === null) return null;
  return {
    sourceFetchedAt: fetchedAt,
    permittedDeadlineAt: evidence.permittedDeadlineAt,
    policyVersion,
    storagePermissionVerified: true,
    retentionContract,
  };
};

// No value imports from ../providerDescriptor (or ./descriptor): this
// module must stay load-cycle free, since ./descriptor imports it for the
// v2 factory. The result version and retention contract arrive as explicit
// factory-supplied parameters (single source: the v2 factory).
//
// U6 fix1 (F1): the row policyVersion arrives via the factory closure when
// the worker bound it at route time. Otherwise it arrives ONLY on the typed
// response channel (ProviderHttpResponse.retentionPolicyVersion, populated by
// the port from verified internal configuration and forwarded through the
// bundle); response headers NEVER identify policy, and the port object itself
// is never read for it. Never defaulted, never inferred.
function effectivePolicyVersion(input: Readonly<{
  policyVersion: number | null;
}>): number | null {
  return input.policyVersion;
}
export async function invokeOpenLibraryV2(input: LookupInput & Readonly<{
  version: ProviderResultVersion;
  policyVersion: number | null;
  retentionContract: string;
}>): Promise<MetadataResultV2> {
  const boundPolicy = effectivePolicyVersion(input);
  const get = async (url: URL, stage: string, sequence: number) => {
    const response = await input.http.get({ url, stage, sequence, signal: input.signal });
    // F1: the TYPED policy channel is carried through this response mapping
    // (the observation wrapper preserves the returned response object).
    return { raw: response.json, headers: response.headers,
      retentionPolicyVersion: response.retentionPolicyVersion };
  };
  try {
    const bundle = await fetchOpenLibraryBundle({ query: input.query, signal: input.signal, get });
    // C1: zero GETs were made, so there is nothing to retain: all null.
    if (bundle.kind === 'zero-get') {
      return {
        version: input.version, purpose: input.purpose,
        outcome: failureOutcome('no_acceptable_match', false),
        rows: null,
        catalogueCompanions: null,
        retention: null,
      };
    }
    if (bundle.kind === 'no-list') {
      const retention = retainedListEvidence(
        bundle.fetchedAt, bundle.retention,
        boundPolicy ?? bundle.retentionPolicyVersion ?? null, input.retentionContract);
      return {
        version: input.version, purpose: input.purpose,
        outcome: failureOutcome('no_acceptable_match', false),
        rows: retention === null ? null : [],
        catalogueCompanions: retention === null ? null : [],
        retention,
      };
    }
    const summary = normalizeOpenLibraryBundle(bundle, {
      correlationId: input.correlationId, attemptId: input.attemptId,
      query: input.query, adapterVersion: '2.0.0',
    });
    const retention = retainedListEvidence(
      bundle.fetchedAt, bundle.retention,
      boundPolicy ?? bundle.retentionPolicyVersion ?? null, input.retentionContract);
    if (input.purpose === 'automatic') {
      const ranked = rankAutomaticRows(summary.rows, input.query);
      const selected = ranked.selected;
      const outcome: MetadataProviderOutcome = {
        outcome: ranked.outcome,
        candidates: ranked.outcome === 'no_acceptable_match'
          ? []
          : summary.rows.flatMap((row) => row.metadata === null ? [] : [row.metadata]),
        selected,
        evidence: ranked.evidence,
        retryable: false,
        secondaryEligible: ranked.outcome !== 'coherent_match',
        providerRequestId: null,
        representativeCover: null,
      };
      return {
        version: input.version, purpose: 'automatic',
        outcome,
        rows: retention === null ? null : summary.rows,
        catalogueCompanions: retention === null ? null : summary.companions,
        retention,
      };
    }
    return {
      version: input.version, purpose: 'edition_options',
      outcome: explicitSummary({
        outcome: summary.outcome, rows: summary.rows,
        retryable: false, providerRequestId: null,
      }),
      rows: retention === null ? null : summary.rows,
      catalogueCompanions: retention === null ? null : summary.companions,
      retention,
    };
  } catch (error) {
    if (error instanceof OpenLibraryFailure) {
      return {
        version: input.version, purpose: input.purpose,
        outcome: failureOutcome(error.outcome, error.retryable),
        rows: null,
        catalogueCompanions: null,
        retention: null,
      };
    }
    // G8: a native v2 ProviderHttpError (timeout/rate_limited/network/...)
    // keeps its own outcome and retryability. Physical accounting finalized
    // it already; unknown P9_ errors stay non-authorizing (no shape).
    if (isProviderHttpFailure(error)) {
      return {
        version: input.version, purpose: input.purpose,
        outcome: failureOutcome(
          error.outcome as MetadataProviderOutcome['outcome'], error.retryable),
        rows: null,
        catalogueCompanions: null,
        retention: null,
      };
    }
    throw error;
  }
}
