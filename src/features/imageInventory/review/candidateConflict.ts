import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';

export type CandidateConflictState = {
    latest: OwnerCandidateDetail;
    changes: string[];
};

export function candidateConflictChanges(
    previous: OwnerCandidateDetail,
    latest: OwnerCandidateDetail,
): string[] {
    const changes: string[] = [];
    if (previous.candidateVersion !== latest.candidateVersion) {
        changes.push('Candidate version changed.');
    }
    if (
        previous.metadata.revision !== latest.metadata.revision
        || previous.metadata.state !== latest.metadata.state
        || previous.metadata.selectionId !== latest.metadata.selectionId
    ) changes.push('Matched book details changed.');
    if (previous.duplicateAdvice.version !== latest.duplicateAdvice.version) {
        changes.push('Possible-match advice changed.');
    }
    if (JSON.stringify(previous.observed) !== JSON.stringify(latest.observed)) {
        changes.push('Observed title, author, language, or script changed.');
    }
    return changes.length ? changes : ['The saved review context changed.'];
}

export function isAuthoritativeCandidateRefresh(
    result: {
        data?: OwnerCandidateDetail;
        isError: boolean;
        error: unknown;
    },
    sessionId: string,
    candidateId: string,
): result is typeof result & { data: OwnerCandidateDetail } {
    return !result.isError
        && result.error === null
        && result.data?.sessionId === sessionId
        && result.data.candidateId === candidateId;
}
