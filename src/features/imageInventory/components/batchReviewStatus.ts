import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CompactReviewValidationIssue } from '../review/compactReviewDraft';

export function metadataStatusLabel(state: OwnerBatchReviewCard['metadataState']): string {
    if (state === 'selected') return 'Provider matched';
    if (state === 'manual') return 'Manual details';
    if (state === 'no_match') return 'No provider match';
    if (state === 'pending') return 'Finding metadata';
    if (state === 'ambiguous') return 'Metadata needs review';
    if (state === 'temporarily_unavailable') return 'Metadata unavailable';
    return 'Metadata failed';
}

// One readiness rule for the card badge, the session header's Ready count and
// Add all ready books: the card can be added now and nothing on it needs attention.
export function cardReadyNow(
    card: OwnerBatchReviewCard,
    canAddNow: boolean,
    attentionCount: number,
): boolean {
    return canAddNow && attentionCount === 0 && card.candidateState !== 'possible_duplicate';
}

export function reviewStatusLabel(
    card: OwnerBatchReviewCard,
    canAddNow: boolean,
    attentionCount: number,
    addOutcome?: CandidateCommitOutcome,
    adding = false,
): string {
    if (addOutcome?.status === 'succeeded') return 'Added';
    if (addOutcome && addOutcome.status !== 'busy') return 'Needs attention';
    if (card.candidateState === 'committed') return 'Added';
    if (card.candidateState === 'commit_in_progress' || adding) return 'Adding';
    if (card.candidateState === 'processing') return 'Processing';
    if (card.candidateState === 'failed') return 'Failed';
    if (card.candidateState === 'possible_duplicate' || attentionCount > 0) return 'Needs attention';
    if (cardReadyNow(card, canAddNow, attentionCount)) return 'Ready';
    if (card.candidateState === 'needs_review') return 'Needs attention';
    return 'Review book';
}

export const draftResolvableBlockerCodes = new Set([
    'review_missing', 'title_unconfirmed', 'author_confirmation_incomplete',
    'language_missing', 'metadata_choice_missing', 'quantity_invalid',
    'price_invalid', 'condition_missing', 'damage_answer_missing',
    'damage_details_missing', 'location_missing', 'publication_intent_missing',
]);

export function cardAttentionItems({
    card,
    hasEdits,
    validationIssues,
    draftSubmittable = false,
}: {
    card: OwnerBatchReviewCard;
    hasEdits: boolean;
    validationIssues: readonly CompactReviewValidationIssue[];
    // The current draft can be saved and added, so Add's canonical Save resolves
    // draft-resolvable server blockers such as review_missing (SDD §13.1).
    draftSubmittable?: boolean;
}) {
    const canExplainMissingReview = !hasEdits
        && card.candidateState === 'needs_review'
        && card.review === null
        && validationIssues.length > 0
        && card.blockers.some((blocker) => blocker.code === 'review_missing');
    const serverItems = card.blockers
        .filter((blocker) => hasEdits || draftSubmittable
            ? !draftResolvableBlockerCodes.has(blocker.code)
            : !canExplainMissingReview || blocker.code !== 'review_missing')
        .map((blocker) => ({ field: blocker.field ?? 'review', safeMessage: blocker.safeMessage }));
    const localItems = hasEdits || canExplainMissingReview || card.blockers.length === 0
        ? validationIssues
        : [];
    return [...localItems, ...serverItems].filter((item, index, items) => (
        items.findIndex((candidate) => candidate.field === item.field
            && candidate.safeMessage === item.safeMessage) === index
    ));
}
