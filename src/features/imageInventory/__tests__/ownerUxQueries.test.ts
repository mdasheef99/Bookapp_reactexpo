import { QueryClient } from '@tanstack/react-query';
import {
    clearImageInventoryPrivateQueries,
    coordinateImageInventoryIdentity,
    imageInventoryKeys,
    inputPollingInterval,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import { synchronizeCandidateReviewSuccess } from '../queries/ownerUxReviewQueries';
import { synchronizeCloseSuccess } from '../queries/ownerUxCloseQueries';
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
        expect(inputPollingInterval([{ polling: true }], false)).toBe(false);
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

    it('applies canonical Close only to the active identity/session and invalidates all related views', async () => {
        const client = new QueryClient();
        const active = identity('user-1', 'store-1');
        await coordinateImageInventoryIdentity(active, client);
        const canonical = {
            sessionId: testUuid(1), sessionStatus: 'closed' as const, sessionVersion: 3,
            allInputsTerminal: true, closeSummary: {
                imagesSubmitted: 0, imagesProcessed: 0, imagesFailed: 0, imagesSkipped: 0,
                candidatesDetected: 0, candidatesReviewReady: 0, candidatesNeedsReview: 0,
                candidatesFailed: 0, falseDetections: 0, manualMissedCandidates: 0,
                committedInventoryItems: 0, quantitiesAddedToExisting: 0, privateItems: 0,
                publishedItems: 0, languageSkips: 0, candidateCapSkips: 0, qualitySkips: 0,
            }, blockerCounts: {
                input_processing: 0, candidate_processing: 0, candidate_failed: 0,
                review_missing: 0, title_unconfirmed: 0, author_confirmation_incomplete: 0,
                language_missing: 0, metadata_choice_missing: 0, quantity_invalid: 0,
                price_invalid: 0, condition_missing: 0, damage_answer_missing: 0,
                damage_details_missing: 0, location_missing: 0, publication_intent_missing: 0,
                duplicate_intent_missing: 0, variant_source_stale: 0,
            }, nextBlockingCandidateId: null, closeState: 'closed' as const,
            closeAllowed: false, presentationRevision: 4,
        };
        const invalidate = jest.spyOn(client, 'invalidateQueries');
        expect(await synchronizeCloseSuccess(client, active, testUuid(1), canonical)).toBe(true);
        expect(client.getQueryData(imageInventoryKeys.readiness(active, testUuid(1)))).toEqual(canonical);
        expect(invalidate).toHaveBeenCalled();

        await coordinateImageInventoryIdentity(identity('user-2', 'store-2'), client);
        expect(await synchronizeCloseSuccess(client, active, testUuid(1), canonical)).toBe(false);
        client.clear();
    });
});
