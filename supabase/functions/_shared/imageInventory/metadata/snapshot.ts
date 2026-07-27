import { parseMetadataEdition } from '../contracts/metadata';

export const MANUAL_REVIEW_OUTCOMES = [
  'local_canonical_match', 'accepted_metadata_match', 'ambiguous',
  'material_conflict', 'no_match', 'technical_failure', 'policy_denied',
  'cost_quota_denied', 'manual_metadata_required',
] as const;

export type ManualReviewOutcome = typeof MANUAL_REVIEW_OUTCOMES[number];

export function manualReviewOutcome(outcome: ManualReviewOutcome): Readonly<{
  outcome: ManualReviewOutcome;
  manualCompletionAvailable: true;
  createsInventory: false;
  publishesListing: false;
  approvesAlias: false;
}> {
  if (!MANUAL_REVIEW_OUTCOMES.includes(outcome)) throw new Error('unsupported manual review outcome');
  return Object.freeze({
    outcome,
    manualCompletionAvailable: true,
    createsInventory: false,
    publishesListing: false,
    approvesAlias: false,
  });
}

export type SelectedMetadataSnapshot = Readonly<{
  snapshotVersion: 'p9-selected-metadata-v1';
  title: string;
  subtitle: string | null;
  authors: readonly string[];
  description: string | null;
  isbn10: string | null;
  isbn13: string | null;
  language: string;
  script: string | null;
  publisher: string | null;
  publishedDate: string | null;
  editionStatement: string | null;
  series: string | null;
  volume: string | null;
  format: string | null;
  pageCount: number | null;
  categories: readonly string[];
  coverReference: string | null;
  provenance: Readonly<{
    adapterKey: string;
    adapterVersion: string;
    schemaVersion: string;
    normalizerVersion: string;
    providerRecordId: string;
  }>;
  selectedAttemptId: string;
  selectionPolicyVersion: string;
  matchEvidence: readonly string[];
  state: ManualReviewOutcome;
  canonicalEditionId: string | null;
}>;

export function createSelectedMetadataSnapshot(input: Readonly<{
  edition: unknown;
  selectedAttemptId: string;
  selectionPolicyVersion: string;
  matchEvidence: readonly string[];
  state: ManualReviewOutcome;
  canonicalEditionId: string | null;
}>): SelectedMetadataSnapshot {
  const edition = parseMetadataEdition(input.edition);
  if (edition.attemptId !== input.selectedAttemptId) {
    throw new Error('selected metadata must come from one coherent provider attempt');
  }
  const script = edition.script
    ?? edition.language.split('-').find((part) => /^[A-Z][a-z]{3}$/u.test(part))
    ?? null;
  return Object.freeze({
    snapshotVersion: 'p9-selected-metadata-v1',
    title: edition.title,
    subtitle: edition.subtitle,
    authors: Object.freeze([...edition.authors]),
    description: edition.description,
    isbn10: edition.isbn10,
    isbn13: edition.isbn13,
    language: edition.language,
    script,
    publisher: edition.publisher,
    publishedDate: edition.publishedDate,
    editionStatement: edition.editionStatement,
    series: edition.series,
    volume: edition.volume,
    format: edition.format,
    pageCount: edition.pageCount,
    categories: Object.freeze([...edition.categories]),
    coverReference: edition.coverReference,
    provenance: Object.freeze({
      adapterKey: edition.adapterKey,
      adapterVersion: edition.adapterVersion,
      schemaVersion: edition.schemaVersion,
      normalizerVersion: edition.normalizerVersion,
      providerRecordId: edition.providerRecordId,
    }),
    selectedAttemptId: input.selectedAttemptId,
    selectionPolicyVersion: input.selectionPolicyVersion,
    matchEvidence: Object.freeze([...input.matchEvidence]),
    state: input.state,
    canonicalEditionId: input.canonicalEditionId,
  });
}
