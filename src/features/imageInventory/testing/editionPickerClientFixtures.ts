import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import { candidateDetailFixture, testUuid } from './ownerUxTestFixtures';

export const pickerIdentity = { userId: 'owner-a', storeId: 'store-a' };
export const pickerDefaults = {
  languageHint: 'en', condition: 'good' as const, location: 'A1',
  priceMinor: 0, quantity: 1, publication: 'private' as const,
  script: null, batchLabel: '',
};
export const pickerSnapshot = {
  title: 'Chosen edition', authors: ['Chosen author'], language: 'en', script: 'Latn',
  subtitle: null, description: null, isbn10: null, isbn13: null, publisher: 'Chosen publisher',
  publishedDate: '2002', editionStatement: null, series: null, volume: null, format: null,
  pageCount: null, categories: [], coverReference: null,
};
export function pickerChoices(overrides: Partial<EditionChoices> = {}): EditionChoices {
  return {
    sessionId: testUuid(1), candidateId: testUuid(2), requestGeneration: 1, optionsVersion: 1,
    optionsExpiresAt: '2099-01-01T00:00:00.000Z',
    rows: [{ optionId: testUuid(20), ordinal: 0, googleBooksUrl: 'https://books.google.com/books?id=one',
      eligibility: 'eligible', metadata: pickerSnapshot }],
    selection: null, lookupStatus: 'ready', candidateVersion: 4, metadataRevision: 7,
    reviewVersion: null, ...overrides,
  };
}
export function selectedChoices(overrides: Partial<EditionChoices> = {}): EditionChoices {
  return pickerChoices({
    selection: { selectionId: testUuid(30), source: 'edition_option', optionId: testUuid(20),
      snapshot: pickerSnapshot, confirmedByOwner: true }, candidateVersion: 5, metadataRevision: 8, ...overrides,
  });
}
export const pickerReview: OwnerCandidateReview = {
  originalTitle: pickerSnapshot.title, authors: [...pickerSnapshot.authors], originalLanguage: 'en',
  script: 'Latn', metadataChoice: { mode: 'edition_option', selectionId: testUuid(30) },
  quantity: 3, priceMinor: 0, baseCondition: 'good',
  damageDisclosure: { hasDamage: false, damageTypes: [], damageNote: null,
    isSellable: true, completeReadableSafe: true },
  shelfLocation: 'A1', notes: { publicNote: '', internalNote: null }, publicationIntent: 'private',
  duplicateIntent: null, originalFieldConfirmation: { title: true, authors: [true] },
  candidateDisposition: 'reviewed',
};
export function pickerDetail(choices = selectedChoices(), review: OwnerCandidateReview | null = null) {
  return candidateDetailFixture({
    candidateVersion: choices.candidateVersion,
    metadata: { state: 'selected', revision: choices.metadataRevision, selectionVersion: 1,
      selectionId: choices.selection!.selectionId, canonicalEditionId: null,
      snapshot: choices.selection!.snapshot, representativeCover: null },
    review: { value: review, reviewVersion: choices.reviewVersion },
    candidateState: review ? 'ready' : 'needs_review',
    readiness: { reviewReady: !!review, blockers: [],
      derivedFromCandidateVersion: choices.candidateVersion,
      derivedFromMetadataRevision: choices.metadataRevision, derivedFromDuplicateAdviceVersion: null },
    allowedActions: review ? ['save_review', 'add_to_inventory'] : ['save_review'],
  });
}
export function pickerCard(choices = selectedChoices(), review: OwnerCandidateReview | null = null): OwnerBatchReviewCard {
  return {
    sessionId: choices.sessionId, candidateId: choices.candidateId, inputId: testUuid(3), ordinal: 1,
    candidateState: review ? 'ready' : 'needs_review', candidateVersion: choices.candidateVersion,
    metadataState: 'selected', metadataRevision: choices.metadataRevision,
    reviewVersion: choices.reviewVersion, reviewDisposition: review ? 'reviewed' : null,
    observed: { title: 'Observed', authors: ['Observed author'], language: 'en', script: 'Latn' },
    metadataSummary: { ...pickerSnapshot, selectionId: choices.selection!.selectionId,
      representativeCover: null },
    review, fieldSources: { cover: 'missing', title: 'matched', authors: 'matched', language: 'matched',
      condition: 'default', price: 'default', quantity: 'default', location: 'default',
      publication: 'default', damage: 'default' },
    attentionCodes: [], blockers: [], reviewReady: !!review,
    allowedActions: review ? ['save_review', 'add_to_inventory'] : ['save_review'],
    updatedAt: '2026-10-08T00:00:00.000Z',
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}