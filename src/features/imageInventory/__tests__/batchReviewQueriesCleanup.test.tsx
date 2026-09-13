import { QueryClient } from '@tanstack/react-query';
import {
    clearImageInventoryPrivateQueries,
    coordinateImageInventoryIdentity,
    imageInventoryKeys,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import {
    ownerBatchReviewKeys,
    synchronizeRemoveCandidateSuccess,
} from '../queries/ownerBatchReviewQueries';

const identity = { userId: 'owner-1', storeId: 'store-1' };
const nextIdentity = { userId: 'owner-2', storeId: 'store-1' };
const sessionId = '00000000-0000-4000-8000-000000000010';

function seed(client: QueryClient, key: readonly unknown[], data: unknown) {
    client.setQueryData(key as never, data as never);
    return key;
}

describe('Phase 9 NEW 6G-C private query roots join Unit 6 identity cleanup', () => {
    beforeEach(() => {
        resetImageInventoryIdentityForTests(identity);
    });

    it('registers every new 6G root beneath the Unit 6 private identity boundary', () => {
        const sessionKey = ownerBatchReviewKeys.sessionV3(identity, sessionId);
        const reviewKey = ownerBatchReviewKeys.batchReview(identity, sessionId);
        for (const key of [sessionKey, reviewKey]) {
            expect(key.slice(0, imageInventoryKeys.identity(identity).length))
                .toEqual(imageInventoryKeys.identity(identity));
        }
    });

    it('removes new 6G roots during logout/account/store identity transitions', async () => {
        const client = new QueryClient();
        const sessionKey = seed(
            client,
            ownerBatchReviewKeys.sessionV3(identity, sessionId),
            { sessionId },
        );
        const reviewKey = seed(
            client,
            ownerBatchReviewKeys.batchReview(identity, sessionId),
            { items: [{ candidateId: 'x' }] },
        );
        await clearImageInventoryPrivateQueries(client);
        expect(client.getQueryData(sessionKey)).toBeUndefined();
        expect(client.getQueryData(reviewKey)).toBeUndefined();
    });

    it('clears prior-identity 6G state before the next owner/store can query', async () => {
        const client = new QueryClient();
        const reviewKey = seed(
            client,
            ownerBatchReviewKeys.batchReview(identity, sessionId),
            { items: [{ candidateId: 'stale-owner-one' }] },
        );
        await coordinateImageInventoryIdentity(nextIdentity, client);
        expect(client.getQueryData(reviewKey)).toBeUndefined();
        resetImageInventoryIdentityForTests(identity);
    });

    it('keeps no cross-session stale review leakage through the shared root', async () => {
        const client = new QueryClient();
        seed(client, ownerBatchReviewKeys.batchReview(identity, sessionId), { stale: true });
        await coordinateImageInventoryIdentity({ userId: 'owner-1', storeId: 'store-2' }, client);
        expect(client.getQueryData(ownerBatchReviewKeys.batchReview(
            { userId: 'owner-1', storeId: 'store-2' },
            sessionId,
        ))).toBeUndefined();
        resetImageInventoryIdentityForTests(identity);
    });

    it('synchronizes only an authoritative removal so removed candidates leave active review', async () => {
        const client = new QueryClient();
        const invalidateSpy = jest.spyOn(client, 'invalidateQueries')
            .mockReturnValue(Promise.resolve() as never);
        await coordinateImageInventoryIdentity(identity, client);
        const canonical = {
            sessionId,
            candidateId: '00000000-0000-4000-8000-000000000020',
            candidateVersion: 4,
            sessionVersion: 5,
            presentationRevision: 6,
            reviewDisposition: 'owner_removed_from_scan' as const,
            removedAt: '2026-08-24T01:00:00.000Z',
        };
        expect(await synchronizeRemoveCandidateSuccess(
            client, identity, sessionId, canonical,
        )).toBe(true);
        const invalidatedKeys = invalidateSpy.mock.calls
            .map((call) => JSON.stringify(call[0]?.queryKey ?? []));
        expect(invalidatedKeys.some((key) => key.includes('batchReview'))).toBe(true);
        expect(invalidatedKeys.some((key) => key.includes('discovery'))).toBe(true);
        // The v3 readiness root must be synchronized, not only the legacy
        // readiness key, so review state and Close authority cannot disagree.
        expect(invalidatedKeys.some(
            (key) => key === JSON.stringify(ownerBatchReviewKeys.readinessV3(identity, sessionId)),
        )).toBe(true);

        // A foreign-session or non-removal result never synchronizes.
        expect(await synchronizeRemoveCandidateSuccess(client, identity, sessionId, {
            ...canonical,
            sessionId: '00000000-0000-4000-8000-000000000099',
        })).toBe(false);
        expect(await synchronizeRemoveCandidateSuccess(client, identity, sessionId, {
            ...canonical,
            reviewDisposition: null,
        } as never)).toBe(false);
        resetImageInventoryIdentityForTests(null);
        expect(await synchronizeRemoveCandidateSuccess(
            client, identity, sessionId, canonical,
        )).toBe(false);
    });
});
