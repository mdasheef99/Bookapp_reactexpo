// TARGETS, never captured output. 02c ??5.1/6/9 AC8-16 and runbook ?1.
// Approved deltas from the frozen v1 packet: result-v2 envelope + purpose;
// adapterVersion 2.0.0 on metadata/companions; separate automatic/explicit
// summary; retention field names + installed contract and policy version.
// Schema versions, option UUIDs, lineage UUIDs, facts, ordering, eligibility,
// URLs, rationale/confidence, author allocation and deadlines are preserved.
import { OL_V1_EXPLICIT_V1 } from './providerReplacementGoldens';

const v2Metadata = { ...OL_V1_EXPLICIT_V1.rows[0].metadata, adapterVersion: '2.0.0' } as const;
const v2Companion = { ...OL_V1_EXPLICIT_V1.catalogueCompanions[0], adapterVersion: '2.0.0' } as const;
const v2Row = {
  optionId: '44444444-4444-4444-8333-000000000001',
  ordinal: 0,
  googleBooksUrl: 'https://openlibrary.org/books/OL100M',
  eligibility: 'eligible',
  metadata: v2Metadata,
} as const;

export const OL_V2_AUTOMATIC_EXPECTED = {
  version: 'p9-metadata-result-v2',
  purpose: 'automatic',
  outcome: {
    outcome: 'coherent_match',
    candidates: [v2Metadata],
    selected: v2Metadata,
    evidence: ['exact_validated_isbn'],
    retryable: false,
    secondaryEligible: false,
    providerRequestId: null,
    representativeCover: null,
  },
  rows: [v2Row],
  catalogueCompanions: [v2Companion],
  retention: {
    sourceFetchedAt: '2026-11-02T12:00:00.000Z',
    permittedDeadlineAt: '2026-11-03T12:00:00.000Z',
    policyVersion: 1,
    storagePermissionVerified: true,
    retentionContract: 'open-library-options-v1',
  },
} as const;

// Target v2 wrapper for the captured OL v1 explicit packet. Not a captured
// output; it labels how the v1 task result is wrapped once version 2.0.0 exists.
export const OL_V1_EXPLICIT_V2_RESULT = {
  version: 'p9-metadata-result-v2',
  purpose: 'edition_options',
  outcome: {
    outcome: 'coherent_match',
    candidates: [OL_V1_EXPLICIT_V1.rows[0].metadata],
    selected: OL_V1_EXPLICIT_V1.rows[0].metadata,
    evidence: ['exact_validated_isbn'],
    retryable: false,
    secondaryEligible: false,
    providerRequestId: null,
    representativeCover: null,
  },
  rows: OL_V1_EXPLICIT_V1.rows,
  catalogueCompanions: OL_V1_EXPLICIT_V1.catalogueCompanions,
  retention: {
    sourceFetchedAt: OL_V1_EXPLICIT_V1.fetchedAt,
    permittedDeadlineAt: OL_V1_EXPLICIT_V1.retentionEvidence.permittedDeadlineAt,
    policyVersion: 1,
    storagePermissionVerified: true,
    retentionContract: 'open-library-options-v1',
  },
} as const;

// The runbook freezes ordered rows, companions, facts and deadlines, not the
// separate explicit summary's chosen winner/evidence (§5.1 leaves those open).
export const OL_V2_EXPLICIT_FROZEN = {
  version: 'p9-metadata-result-v2',
  purpose: 'edition_options',
  rows: [v2Row],
  catalogueCompanions: [v2Companion],
  retention: {
    sourceFetchedAt: '2026-11-02T12:00:00.000Z',
    permittedDeadlineAt: '2026-11-03T12:00:00.000Z',
    policyVersion: 1,
    storagePermissionVerified: true,
    retentionContract: 'open-library-options-v1',
  },
} as const;

// Full packet for the strict result validator. The summary below is a valid
// contract instance, never a golden assertion of the explicit winner.
export const OL_V2_EXPLICIT_TARGET = {
  ...OL_V1_EXPLICIT_V2_RESULT,
  outcome: { ...OL_V1_EXPLICIT_V2_RESULT.outcome,
    candidates: [v2Metadata], selected: v2Metadata },
  rows: [v2Row], catalogueCompanions: [v2Companion],
} as const;
