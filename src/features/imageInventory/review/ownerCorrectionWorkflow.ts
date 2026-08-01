import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerVariantReview } from '../contracts/ownerCorrectionSchemas';

const falseStates = new Set(['ready', 'needs_review', 'possible_duplicate']);

export function canMarkCandidateFalse(detail: OwnerCandidateDetail): boolean {
    return detail.allowedActions.includes('mark_false')
        && falseStates.has(detail.candidateState);
}

export function canOpenVariantReview(detail: OwnerCandidateDetail): boolean {
    return detail.allowedActions.includes('open_variant_review')
        && detail.variantSummary.proposalVersions.length > 0;
}

export function variantConflictChanges(
    previous: OwnerVariantReview,
    latest: OwnerVariantReview,
): string[] {
    const changes: string[] = [];
    if (previous.proposalId !== latest.proposalId) changes.push('Proposal identity changed.');
    if (previous.confirmedSourceText !== latest.confirmedSourceText) changes.push('Confirmed source text changed.');
    if (previous.proposedText !== latest.proposedText) changes.push('Proposed text changed.');
    if (previous.targetType !== latest.targetType) changes.push('Target type changed.');
    if (previous.authorPosition !== latest.authorPosition) changes.push('Author position changed.');
    if (previous.version !== latest.version) changes.push('Proposal version changed.');
    if (previous.lifecycleStatus !== latest.lifecycleStatus) changes.push('Lifecycle status changed.');
    if (previous.staleConflictReason !== latest.staleConflictReason) changes.push('Stale-conflict reason changed.');
    if (JSON.stringify(previous.allowedActions) !== JSON.stringify(latest.allowedActions)) {
        changes.push('Allowed actions changed.');
    }
    return changes.length ? changes : ['The proposal changed on the server.'];
}
