import type {
    AddCandidateToInventoryRequest,
    UpdateCandidateReviewRequest,
} from '../api/ownerUxService';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type {
    OwnerCandidateCommitResult,
    OwnerCandidateDetail,
} from '../contracts/ownerUxContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';

export type CandidateCommitDraft = Readonly<{
    card: OwnerBatchReviewCard;
    edits: Partial<OwnerCandidateReview>;
}>;

export type CandidateCommitOutcome = Readonly<{
    candidateId: string;
    status: 'succeeded' | 'failed_retryable' | 'no_longer_eligible' | 'still_pending' | 'busy';
    stage: 'claim' | 'save' | 'revalidate' | 'commit' | 'complete';
    result?: OwnerCandidateCommitResult;
    code?: string;
}>;

export type FrozenCandidateCommand = Readonly<{
    candidateId: string;
    sessionId: string;
    draft: OwnerCandidateReview;
    needsSave: boolean;
    candidateVersion: number;
    metadataRevision: number;
    saveIdempotencyKey: string;
    saveCommandId: string;
    commitIdempotencyKey: string;
    commitCommandId: string;
    claimToken: string;
    claimed: boolean;
}>;

export type FrozenAddAllCommand = Readonly<{
    commandId: string;
    exactN: number;
    candidateIds: readonly string[];
    commands: readonly FrozenCandidateCommand[];
    outcomes: Map<string, CandidateCommitOutcome>;
}>;

export type AddAllResult = Readonly<{
    exactN: number;
    candidateIds: readonly string[];
    outcomes: readonly CandidateCommitOutcome[];
    succeeded: number;
    failedRetryable: number;
    noLongerEligible: number;
    stillPending: number;
    busy: number;
}>;

export type InventoryCommitCoordinatorDependencies = Readonly<{
    saveReview: (request: UpdateCandidateReviewRequest) => Promise<OwnerCandidateDetail>;
    readCandidate: (sessionId: string, candidateId: string) => Promise<OwnerCandidateDetail>;
    commitCandidate: (request: AddCandidateToInventoryRequest) => Promise<OwnerCandidateCommitResult>;
    synchronizeSuccess: (results: readonly OwnerCandidateCommitResult[]) => Promise<void>;
    synchronizeIneligible: (candidateIds: readonly string[]) => Promise<void>;
    createIdempotencyKey: (prefix: string) => string;
    createCommandId: () => string;
}>;

export class CandidateCommandRegistry {
    private readonly claims = new Map<string, string>();

    claim(candidateId: string, token: string): boolean {
        if (this.claims.has(candidateId)) return false;
        this.claims.set(candidateId, token);
        return true;
    }

    release(candidateId: string, token: string): void {
        if (this.claims.get(candidateId) === token) this.claims.delete(candidateId);
    }

    isClaimed(candidateId: string): boolean {
        return this.claims.has(candidateId);
    }
}
