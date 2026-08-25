import { QueryClient } from '@tanstack/react-query';
import { storeViewKeys } from '@/features/storeView/queries/storeViewQueries';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewQueries';
import { ownerInventoryReadKeys } from '../queries/ownerInventoryReadQueries';
import {
    imageInventoryKeys,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import { synchronizeInventoryCommitSuccess, synchronizeInventoryCommitIneligibility } from '../queries/ownerInventoryCommitQueries';
import { testUuid } from '../testing/ownerUxTestFixtures';

describe('Phase 9 NEW 6G-D commit cache synchronization', () => {
    it('invalidates only approved inventory/Store View and candidate/session roots after success', async () => {
        const client = new QueryClient();
        const identity = { userId: testUuid(1), storeId: testUuid(2) };
        const sessionId = testUuid(3);
        const candidateId = testUuid(4);
        resetImageInventoryIdentityForTests(identity);
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

        await synchronizeInventoryCommitSuccess(client, identity, sessionId, [{
            sessionId, candidateId, candidateVersion: 6, inventoryId: testUuid(5),
            inventoryVersion: 1, outcome: 'committed_private',
        }]);

        const approved = [
            imageInventoryKeys.candidate(identity, sessionId, candidateId),
            [...imageInventoryKeys.identity(identity), 'candidates'],
            imageInventoryKeys.discovery(identity),
            imageInventoryKeys.readiness(identity, sessionId),
            ownerBatchReviewKeys.sessionV3(identity, sessionId),
            ownerBatchReviewKeys.batchReview(identity, sessionId),
            ownerBatchReviewKeys.readinessV3(identity, sessionId),
            [...imageInventoryKeys.identity(identity), 'ownerRead'],
            ownerInventoryReadKeys.all,
            [...imageInventoryKeys.identity(identity), 'storeView'],
            storeViewKeys.all,
        ];
        expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey)).toEqual(approved);
        expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['listings'] });
        expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['marketplace'] });
        client.clear();
    });

    it('invalidates exactly the targeted candidate/review/readiness roots for no_longer_eligible outcomes', async () => {
        const client = new QueryClient();
        const identity = { userId: testUuid(1), storeId: testUuid(2) };
        const sessionId = testUuid(3);
        const candidateId = testUuid(4);
        resetImageInventoryIdentityForTests(identity);
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

        await synchronizeInventoryCommitIneligibility(
            client, identity, sessionId, [candidateId],
        );

        const approved = [
            imageInventoryKeys.candidate(identity, sessionId, candidateId),
            imageInventoryKeys.readiness(identity, sessionId),
            ownerBatchReviewKeys.sessionV3(identity, sessionId),
            ownerBatchReviewKeys.batchReview(identity, sessionId),
            ownerBatchReviewKeys.readinessV3(identity, sessionId),
        ];
        expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey)).toEqual(approved);
        // No commit occurred, so inventory-facing and discovery/Store View
        // authority must not be broadly invalidated.
        expect(invalidate).not.toHaveBeenCalledWith({ queryKey: imageInventoryKeys.discovery(identity) });
        expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey))
            .not.toContainEqual([...imageInventoryKeys.identity(identity), 'storeView']);
        expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey))
            .not.toContainEqual(storeViewKeys.all);
        client.clear();
    });

    it('keeps per-candidate roots exact and shared session roots single-shot for multiple ineligible candidates', async () => {
        const client = new QueryClient();
        const identity = { userId: testUuid(1), storeId: testUuid(2) };
        const sessionId = testUuid(3);
        const firstCandidate = testUuid(4);
        const secondCandidate = testUuid(5);
        resetImageInventoryIdentityForTests(identity);
        const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

        await synchronizeInventoryCommitIneligibility(
            client, identity, sessionId, [firstCandidate, secondCandidate],
        );

        const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
        expect(keys.filter((key) => key === JSON.stringify(
            imageInventoryKeys.candidate(identity, sessionId, firstCandidate),
        ))).toHaveLength(1);
        expect(keys.filter((key) => key === JSON.stringify(
            imageInventoryKeys.candidate(identity, sessionId, secondCandidate),
        ))).toHaveLength(1);
        expect(keys.filter((key) => key === JSON.stringify(
            imageInventoryKeys.readiness(identity, sessionId),
        ))).toHaveLength(1);
        client.clear();
    });
});
