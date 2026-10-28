import { cardAddRequirementIssues } from '../review/compactReviewDraft';
import { OwnerUxClientError } from '../api/ownerUxService';
import type { OwnerCandidateCommitResult, OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import { ownerCandidateReviewSchema, type OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import type {
    AddAllResult,
    CandidateCommitDraft,
    CandidateCommitAuthority,
    CandidateCommitOutcome,
    FrozenAddAllCommand,
    FrozenCandidateCommand,
} from './inventoryCommitTypes';

const conflictCodes = new Set([
    'P9_CANDIDATE_VERSION_CONFLICT',
    'P9_VERSION_CONFLICT',
    'P9_STATE_CONFLICT',
    'P9_NOT_FOUND',
    'P9_OWNER_NOT_AUTHORIZED',
]);

export function candidateCommitAuthorityKey(card: OwnerBatchReviewCard): string {
    return `${card.candidateVersion}:${card.metadataRevision}:${card.reviewVersion}`;
}

export function candidateCommitPreparation(value: CandidateCommitDraft): {
    draft: OwnerCandidateReview;
    needsSave: boolean;
    resave: 'review_reset' | null;
} | null {
    const merged = value.review ?? (value.card.review
        ? { ...value.card.review, ...value.edits }
        : null);
    if (!merged || cardAddRequirementIssues(merged).length > 0) return null;
    const parsed = ownerCandidateReviewSchema.safeParse(merged);
    if (!parsed.success) return null;
    const needsSave = value.card.review === null
        || JSON.stringify(parsed.data) !== JSON.stringify(value.card.review);
    return {
        draft: parsed.data, needsSave,
        resave: !needsSave && !value.card.reviewReady && value.card.blockers.length === 0
            ? 'review_reset' : null,
    };
}

export function candidateCanStartCommit(value: CandidateCommitDraft): boolean {
    if (value.acceptedAuthorityKey !== candidateCommitAuthorityKey(value.card)) return false;
    const preparation = candidateCommitPreparation(value);
    if (!preparation) return false;
    return preparation.needsSave || preparation.resave
        ? value.card.allowedActions.includes('save_review')
        : value.card.reviewReady
            && value.card.allowedActions.includes('add_to_inventory');
}

const bulkExcludedOutcomeStatuses = new Set<CandidateCommitOutcome['status']>([
    'succeeded', 'failed_retryable', 'no_longer_eligible',
    'needs_attention', 'still_pending',
]);

export function candidateCanStartBulkCommit(
    value: CandidateCommitDraft,
    blockedCandidateIds?: ReadonlySet<string>,
    inFlightCandidateIds?: ReadonlySet<string>,
    outcomes?: ReadonlyMap<string, CandidateCommitOutcome>,
): boolean {
    if (blockedCandidateIds?.has(value.card.candidateId)
        || inFlightCandidateIds?.has(value.card.candidateId)) return false;
    const outcome = outcomes?.get(value.card.candidateId);
    if (outcome && bulkExcludedOutcomeStatuses.has(outcome.status)) return false;
    return candidateCanStartCommit(value);
}

export function canonicalEligible(detail: OwnerCandidateDetail): boolean {
    return detail.candidateState === 'ready'
        && detail.review.value !== null
        && detail.review.reviewVersion !== null
        && detail.readiness.reviewReady
        && detail.allowedActions.includes('add_to_inventory');
}

// SDD-1 §3 / D2-3: only an edition-to-manual reset may change the hidden Save.
export function reviewMatchesReset(
    seen: OwnerCandidateReview, current: OwnerCandidateReview | null,
): boolean {
    if (!current) return false;
    if (JSON.stringify(seen) === JSON.stringify(current)) return true;
    return (seen.metadataChoice.mode === 'selected' || seen.metadataChoice.mode === 'edition_option')
        && current.metadataChoice.mode === 'manual' && current.metadataChoice.selectionId === null
        && JSON.stringify({ ...seen, metadataChoice: current.metadataChoice }) === JSON.stringify(current);
}

// SDD-1 §3 / D2-2: retain the entire request, including the reread's versions.
export function freezeReviewSave(
    command: FrozenCandidateCommand, detail?: OwnerCandidateDetail,
): FrozenCandidateCommand {
    const draft = detail ? ownerCandidateReviewSchema.parse(detail.review.value) : command.draft;
    const request = Object.freeze({
        sessionId: command.sessionId, candidateId: command.candidateId,
        expectedCandidateVersion: detail?.candidateVersion ?? command.candidateVersion,
        expectedMetadataRevision: detail?.metadata.revision ?? command.metadataRevision,
        review: draft,
        idempotencyKey: detail ? command.resaveIdempotencyKey : command.saveIdempotencyKey,
        commandId: detail ? command.resaveCommandId : command.saveCommandId,
    });
    return detail ? { ...command, draft, resaveRequest: request, saveCompleted: false, savedAuthority: undefined }
        : { ...command, saveRequest: request };
}

export function canResaveAfterSave(detail: OwnerCandidateDetail, command: FrozenCandidateCommand): boolean {
    return !command.resaveRequest && Boolean(command.saveRequest)
        && !detail.readiness.reviewReady && detail.readiness.blockers.length === 0
        && detail.metadata.revision > command.saveRequest!.expectedMetadataRevision
        && detail.review.value?.metadataChoice.mode === 'manual'
        && matchesSavedAuthority(detail, command.savedAuthority)
        && reviewMatchesReset(command.draft, detail.review.value);
}

// Ordinary Saves match values and base revisions. Re-saves also match the
// Owner-seen review: the lost response may have advanced server authority
// while the mounted card still carries its pre-reset edition choice.
export function draftMatchesCommand(
    refreshed: CandidateCommitDraft,
    command: FrozenCandidateCommand,
): boolean {
    if (refreshed.acceptedAuthorityKey !== candidateCommitAuthorityKey(refreshed.card))
        return false;
    const merged = refreshed.review ?? (refreshed.card.review
        ? { ...refreshed.card.review, ...refreshed.edits }
        : null);
    if (!merged) return false;
    const matches = JSON.stringify(merged) === JSON.stringify(command.draft)
        || (command.resaveRequest && JSON.stringify(merged) === JSON.stringify(command.ownerSeenDraft));
    // A lost re-save response may already have advanced the card's authority.
    const saved = command.savedAuthority;
    if (saved) return Boolean(matches) && refreshed.card.candidateVersion === saved.candidateVersion
        && refreshed.card.metadataRevision === saved.metadata.revision
        && refreshed.card.reviewVersion === saved.review.reviewVersion;
    return Boolean(matches) && (Boolean(command.resaveRequest)
        || (refreshed.card.candidateVersion === command.candidateVersion
            && refreshed.card.metadataRevision === command.metadataRevision
            && refreshed.card.reviewVersion === command.reviewVersion));
}

export function classifyFailure(
    candidateId: string,
    stage: CandidateCommitOutcome['stage'],
    error: unknown,
) {
    const code = error instanceof OwnerUxClientError ? error.code : undefined;
    if (stage === 'commit' && (!code || code === 'P9_INTERNAL_ERROR')) {
        return { candidateId, status: 'still_pending' as const, stage, code };
    }
    if (code && conflictCodes.has(code)) {
        return { candidateId, status: 'no_longer_eligible' as const, stage, code };
    }
    if (!(error instanceof OwnerUxClientError) || error.retryable) {
        return { candidateId, status: 'failed_retryable' as const, stage, code };
    }
    return { candidateId, status: 'no_longer_eligible' as const, stage, code };
}

export function aggregate(command: FrozenAddAllCommand): AddAllResult {
    const outcomes = command.candidateIds.map((candidateId) => command.outcomes.get(candidateId)
        ?? { candidateId, status: 'still_pending' as const, stage: 'claim' as const });
    const count = (status: CandidateCommitOutcome['status']) => (
        outcomes.filter((outcome) => outcome.status === status).length
    );
    return {
        exactN: command.exactN,
        candidateIds: command.candidateIds,
        outcomes,
        succeeded: count('succeeded'),
        failedRetryable: count('failed_retryable'),
        noLongerEligible: count('no_longer_eligible'),
        needsAttention: count('needs_attention'),
        stillPending: count('still_pending'),
        busy: count('busy'),
    };
}

/** Picker §7 / Unit 6G §12: reread cannot substitute another server-held edition. */
export function canonicalMatchesControlledChoice(
    detail: OwnerCandidateDetail, draft: OwnerCandidateReview,
): boolean {
    if (draft.metadataChoice.mode !== 'edition_option') return true;
    const saved = detail.review.value;
    return saved?.metadataChoice.mode === 'edition_option'
        && saved.metadataChoice.selectionId === draft.metadataChoice.selectionId
        && detail.metadata.selectionId === draft.metadataChoice.selectionId
        && saved.originalTitle === draft.originalTitle
        && JSON.stringify(saved.authors) === JSON.stringify(draft.authors)
        && saved.originalLanguage === draft.originalLanguage
        && saved.script === draft.script;
}

function matchesSavedAuthority(detail: OwnerCandidateDetail, saved?: OwnerCandidateDetail): boolean {
    return !saved || (detail.candidateVersion === saved.candidateVersion
        && detail.metadata.revision === saved.metadata.revision
        && detail.review.reviewVersion === saved.review.reviewVersion);
}

// SDD-1 section 2/D2-3: revalidation cannot substitute any submitted review field.
export function canonicalMatchesSubmittedReview(detail: OwnerCandidateDetail, command: FrozenCandidateCommand): boolean {
    const parsed = ownerCandidateReviewSchema.safeParse(detail.review.value);
    return parsed.success && JSON.stringify(parsed.data) === JSON.stringify(command.draft)
        && matchesSavedAuthority(detail, command.savedAuthority);
}

export function commandOwnsCard(authority: CandidateCommitAuthority, card: OwnerBatchReviewCard): boolean {
    if (authority.kind === 'save') {
        const { detail } = authority;
        return detail.sessionId === card.sessionId && detail.candidateId === card.candidateId
            && detail.candidateVersion === card.candidateVersion && detail.metadata.revision === card.metadataRevision
            && detail.review.reviewVersion === card.reviewVersion
            && JSON.stringify(detail.review.value) === JSON.stringify(card.review);
    }
    const { request, result } = authority;
    return result.sessionId === card.sessionId && result.candidateId === card.candidateId
        && request.sessionId === card.sessionId && request.candidateId === card.candidateId
        && result.candidateVersion === card.candidateVersion
        && request.expectedMetadataRevision === card.metadataRevision && request.expectedReviewVersion === card.reviewVersion;
}

export function commandOwnsReceipt(authority: CandidateCommitAuthority, card: OwnerBatchReviewCard,
    result: OwnerCandidateCommitResult): boolean {
    return authority.kind === 'commit' && authority.result.sessionId === card.sessionId
        && authority.result.candidateId === card.candidateId
        && JSON.stringify(authority.result) === JSON.stringify(result)
        && (commandOwnsCard(authority, card) || candidateCommitAuthorityKey(card)
            === [authority.request.expectedCandidateVersion, authority.request.expectedMetadataRevision,
                authority.request.expectedReviewVersion].join(':'));
}

// SDD-1 section 2/D2-2..3: Save authority belongs to the screen's retained draft.
export function adoptSavedDraftAuthorities(
    drafts: Map<string, Pick<CandidateCommitDraft, 'edits' | 'acceptedAuthorityKey'>>,
    cards: readonly OwnerBatchReviewCard[],
    authorities: ReadonlyMap<string, readonly CandidateCommitAuthority[]>,
    conflicts: ReadonlySet<string>, pendingIdentity: ReadonlyMap<string, string>,
): typeof drafts {
    let updated = drafts;
    for (const card of cards) {
        const draft = drafts.get(card.candidateId), key = candidateCommitAuthorityKey(card);
        if (!draft || draft.acceptedAuthorityKey === key || conflicts.has(card.candidateId)
            || pendingIdentity.has(card.candidateId) || !card.review) continue;
        const ownSave = authorities.get(card.candidateId)?.some(item => item.kind === 'save' && commandOwnsCard(item, card));
        if (!ownSave) continue;
        const seen = ownerCandidateReviewSchema.safeParse({ ...card.review, ...draft.edits });
        if (!seen.success || !reviewMatchesReset(seen.data, card.review)) continue;
        if (updated === drafts) updated = new Map(drafts);
        updated.set(card.candidateId, { ...draft, acceptedAuthorityKey: key });
    }
    return updated;
}
