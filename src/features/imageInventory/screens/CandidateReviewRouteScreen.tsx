import { CandidateReview } from './CandidateReviewScreens';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';

export function InventoryCandidateReviewScreen({
    sessionId,
    candidateId,
}: {
    sessionId: string;
    candidateId: string;
}) {
    return (
        <InventoryAccessBoundary>
            {(identity) => (
                <CandidateReview
                    key={`${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`}
                    identity={identity}
                    sessionId={sessionId}
                    candidateId={candidateId}
                />
            )}
        </InventoryAccessBoundary>
    );
}
