import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import type { useRemoveOwnerInventoryCandidate } from '../queries/ownerBatchReviewQueries';

// Unit 6G §11: Remove shares the coordinator slot with Save/Add/edition selection.
export function createScanCandidateRemoval({ sessionId, isOffline, removeCandidate, inventoryCommit, setCandidateMessage }: {
  sessionId: string; isOffline: boolean; removeCandidate: ReturnType<typeof useRemoveOwnerInventoryCandidate>;
  inventoryCommit: OwnerCandidateCommandSlot; setCandidateMessage: (message: string) => void;
}) {
    return (
        candidateId: string,
        expectedCandidateVersion: number,
    ) => {
        if (isOffline || removeCandidate.isPending) return;
        // SDD U6G-AC11: one candidate has one active command slot. Remove
        // claims the same shared slot as Add/Add-all/Save or fails closed
        // busy without sending a request.
        const slotToken = inventoryCommit.claimSlot(candidateId, 'remove');
        if (!slotToken) {
            setCandidateMessage('That book is busy. Wait for its current action to finish.');
            return;
        }
        removeCandidate.mutate({
            sessionId,
            candidateId,
            expectedCandidateVersion,
            idempotencyKey: createSemanticKey('remove-candidate'),
            commandId: createCaptureUuid(),
        }, {
            onSuccess: () => {
                inventoryCommit.releaseSlot(candidateId, slotToken);
                setCandidateMessage('Book removed from this scan.');
            },
            onError: () => {
                inventoryCommit.releaseSlot(candidateId, slotToken);
                setCandidateMessage(
                    'The book could not be removed. Refresh and try again.',
                );
            },
        });
    };

}
