import { OwnerUxClientError } from '../api/ownerUxService';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { ownerCandidateReviewSchema } from '../contracts/ownerUxReviewSchema';
import type {
    AddAllResult,
    CandidateCommitDraft,
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

export function candidateCanStartCommit(value: CandidateCommitDraft): boolean {
    const merged = value.review ?? (value.card.review
        ? { ...value.card.review, ...value.edits }
        : null);
    if (!merged) return false;
    if (!ownerCandidateReviewSchema.safeParse(merged).success) return false;
    const hasEdits = Object.keys(value.edits).length > 0;
    return hasEdits
        ? value.card.allowedActions.includes('save_review')
        : value.card.reviewReady
            && value.card.allowedActions.includes('add_to_inventory');
}

export function canonicalEligible(detail: OwnerCandidateDetail): boolean {
    return detail.candidateState === 'ready'
        && detail.review.value !== null
        && detail.review.reviewVersion !== null
        && detail.readiness.reviewReady
        && detail.allowedActions.includes('add_to_inventory');
}

// Save identity is equivalent only for the same review fingerprint and the
// same candidate/metadata base revisions. A changed value or base authority
// supersedes the frozen command and must never be silently replayed.
export function draftMatchesCommand(
    refreshed: CandidateCommitDraft,
    command: FrozenCandidateCommand,
): boolean {
    const merged = refreshed.review ?? (refreshed.card.review
        ? { ...refreshed.card.review, ...refreshed.edits }
        : null);
    if (!merged) return false;
    return JSON.stringify(merged) === JSON.stringify(command.draft)
        && refreshed.card.candidateVersion === command.candidateVersion
        && refreshed.card.metadataRevision === command.metadataRevision;
}

export function classifyFailure(
    candidateId: string,
    stage: CandidateCommitOutcome['stage'],
    error: unknown,
) {
    const code = error instanceof OwnerUxClientError ? error.code : undefined;
    if (stage === 'commit' && code === 'P9_INTERNAL_ERROR') {
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
