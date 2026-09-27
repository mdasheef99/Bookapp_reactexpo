import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';

export function metadataStatusLabel(state: OwnerBatchReviewCard['metadataState']): string {
    if (state === 'selected') return 'Provider matched';
    if (state === 'manual') return 'Manual details';
    if (state === 'no_match') return 'No provider match';
    if (state === 'pending') return 'Finding metadata';
    if (state === 'ambiguous') return 'Metadata needs review';
    if (state === 'temporarily_unavailable') return 'Metadata unavailable';
    return 'Metadata failed';
}

export function reviewStatusLabel(
    card: OwnerBatchReviewCard,
    draftReady: boolean,
    attentionCount: number,
    editable: boolean,
    hasEdits: boolean,
    addOutcome?: CandidateCommitOutcome,
): string {
    if (addOutcome?.status === 'succeeded') return 'Added';
    if (addOutcome && addOutcome.status !== 'busy') return 'Needs attention';
    if (card.candidateState === 'committed') return 'Added';
    if (card.candidateState === 'commit_in_progress') return 'Adding';
    if (card.candidateState === 'processing') return 'Processing';
    if (card.candidateState === 'failed') return 'Failed';
    if (card.candidateState === 'possible_duplicate' || attentionCount > 0) return 'Needs attention';
    if (draftReady && editable && (hasEdits || card.reviewReady)) return 'Ready';
    if (card.candidateState === 'needs_review') return 'Needs attention';
    if (card.reviewReady) return 'Ready';
    return 'Review book';
}

export const draftResolvableBlockerCodes = new Set([
    'review_missing', 'title_unconfirmed', 'author_confirmation_incomplete',
    'language_missing', 'metadata_choice_missing', 'quantity_invalid',
    'price_invalid', 'condition_missing', 'damage_answer_missing',
    'damage_details_missing', 'location_missing', 'publication_intent_missing',
]);
