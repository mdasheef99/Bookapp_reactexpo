import { QueryClient } from '@tanstack/react-query';
import {
    clearImageInventoryPrivateQueries,
    coordinateImageInventoryIdentity,
    imageInventoryKeys,
    inputPollingInterval,
    resetImageInventoryIdentityForTests,
    synchronizeCandidateReviewSuccess,
} from '../queries/ownerUxQueries';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

const identity = (userId: string, storeId: string) => ({ userId, storeId });

describe('Phase 9 Unit 6B private query identity', () => {
    beforeEach(() => {
        resetImageInventoryIdentityForTests();
    });
    it('isolates users, stores, sessions, candidates, contracts, filters, and cursors', () => {
        const first = identity('user-1', 'store-1');
        const secondUser = identity('user-2', 'store-1');
        const secondStore = identity('user-1', 'store-2');

        const keys = [
            imageInventoryKeys.discovery(first),
            imageInventoryKeys.discovery(secondUser),
            imageInventoryKeys.discovery(secondStore),
            imageInventoryKeys.session(first, 'session-1'),
            imageInventoryKeys.session(first, 'session-2'),
            imageInventoryKeys.inputs(first, 'session-1'),
            imageInventoryKeys.inputs(first, 'session-2'),
            imageInventoryKeys.candidate(first, 'session-1', 'candidate-1'),
            imageInventoryKeys.candidate(first, 'session-1', 'candidate-2'),
            imageInventoryKeys.candidates(first, {
                scope: 'session',
                sessionId: 'session-1',
                attention: 'all',
                pageSize: 20,
                cursor: null,
            }),
            imageInventoryKeys.candidates(first, {
                scope: 'session',
                sessionId: 'session-1',
                attention: 'all',
                pageSize: 20,
                cursor: 'cursor-2',
            }),
            imageInventoryKeys.candidates(first, {
                scope: 'needs_review',
                attention: 'needs_attention',
                pageSize: 20,
                cursor: null,
            }),
        ];

        expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
        for (const key of keys) {
            expect(key).toContain('phase9-owner-ux-v1');
        }
    });

    it('polls only while server-authoritative input work remains active', () => {
        expect(inputPollingInterval(undefined)).toBe(false);
        expect(inputPollingInterval([{ polling: false }])).toBe(false);
        expect(inputPollingInterval([{ polling: false }, { polling: true }])).toBe(3_000);
    });

    it('cancels in-flight private work before removing every Unit 6 cache entry', async () => {
        const client = new QueryClient();
        client.setQueryData(imageInventoryKeys.discovery(identity('user-1', 'store-1')), { private: 1 });
        client.setQueryData(imageInventoryKeys.discovery(identity('user-2', 'store-2')), { private: 2 });
        client.setQueryData(['public', 'marketplace'], { public: true });
        const cancel = jest.spyOn(client, 'cancelQueries');
        const remove = jest.spyOn(client, 'removeQueries');

        await clearImageInventoryPrivateQueries(client);

        expect(cancel).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.all });
        expect(remove).toHaveBeenCalledWith({ queryKey: imageInventoryKeys.all });
        expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
        expect(client.getQueryData(['public', 'marketplace'])).toEqual({ public: true });
        expect(client.getQueriesData({ queryKey: imageInventoryKeys.all })).toEqual([]);
        client.clear();
    });

    it('clears on account, store, logout, or eligibility loss but not first resolution', async () => {
        const client = new QueryClient();
        const clear = jest.spyOn(client, 'removeQueries');
        const first = identity('user-1', 'store-1');

        await coordinateImageInventoryIdentity(first, client);
        expect(clear).not.toHaveBeenCalled();

        await coordinateImageInventoryIdentity(identity('user-2', 'store-1'), client);
        await coordinateImageInventoryIdentity(identity('user-1', 'store-2'), client);
        await coordinateImageInventoryIdentity(null, client);
        expect(clear).toHaveBeenCalledTimes(3);
        client.clear();
    });

    it('retains identity across route unmounts and clears before a remounted store can query', async () => {
        const client = new QueryClient();
        const first = identity('user-1', 'store-1');
        await coordinateImageInventoryIdentity(first, client);
        client.setQueryData(imageInventoryKeys.discovery(first), { private: true });
        const cancel = jest.spyOn(client, 'cancelQueries');

        await coordinateImageInventoryIdentity(identity('user-1', 'store-2'), client);

        expect(cancel).toHaveBeenCalled();
        expect(client.getQueriesData({ queryKey: imageInventoryKeys.all })).toEqual([]);
        client.clear();
    });

    it('retains identity across route unmounts and clears on a revoked remount', async () => {
        const client = new QueryClient();
        const first = identity('user-1', 'store-1');
        await coordinateImageInventoryIdentity(first, client);
        client.setQueryData(imageInventoryKeys.discovery(first), { private: true });

        await coordinateImageInventoryIdentity(null, client);

        expect(client.getQueriesData({ queryKey: imageInventoryKeys.all })).toEqual([]);
        client.clear();
    });

    it('removes private entries even if cancellation fails', async () => {
        const client = new QueryClient();
        client.setQueryData(imageInventoryKeys.discovery(identity('user-1', 'store-1')), { private: true });
        jest.spyOn(client, 'cancelQueries').mockRejectedValueOnce(new Error('cancel failed'));

        await expect(clearImageInventoryPrivateQueries(client)).rejects.toThrow('cancel');
        expect(client.getQueriesData({ queryKey: imageInventoryKeys.all })).toEqual([]);
        client.clear();
    });

    it('applies canonical review detail only to the still-active identity and candidate', async () => {
        const client = new QueryClient();
        const active = identity('user-1', 'store-1');
        const canonical = candidateDetailFixture({
            candidateVersion: 5,
            candidateState: 'ready',
        });
        await coordinateImageInventoryIdentity(active, client);
        const invalidate = jest.spyOn(client, 'invalidateQueries');

        await synchronizeCandidateReviewSuccess(
            client,
            active,
            testUuid(1),
            testUuid(2),
            canonical,
        );
        expect(client.getQueryData(
            imageInventoryKeys.candidate(active, testUuid(1), testUuid(2)),
        )).toEqual(canonical);
        expect(invalidate).toHaveBeenCalled();

        await coordinateImageInventoryIdentity(identity('user-2', 'store-2'), client);
        await synchronizeCandidateReviewSuccess(
            client,
            active,
            testUuid(1),
            testUuid(2),
            candidateDetailFixture({ candidateVersion: 6 }),
        );
        expect(client.getQueryData(
            imageInventoryKeys.candidate(active, testUuid(1), testUuid(2)),
        )).toBeUndefined();
        client.clear();
    });

    it('ignores a late canonical response for a different route candidate', async () => {
        const client = new QueryClient();
        const active = identity('user-1', 'store-1');
        await coordinateImageInventoryIdentity(active, client);

        await synchronizeCandidateReviewSuccess(
            client,
            active,
            testUuid(1),
            testUuid(99),
            candidateDetailFixture(),
        );

        expect(client.getQueriesData({ queryKey: imageInventoryKeys.all })).toEqual([]);
        client.clear();
    });
});
