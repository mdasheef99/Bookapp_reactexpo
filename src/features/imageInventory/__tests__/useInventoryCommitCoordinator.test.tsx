import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { OwnerUxClientError, ownerUxService } from '../api/ownerUxService';
import {
    useInventoryCommitCoordinator,
} from '../commit/useInventoryCommitCoordinator';
import type {
    CandidateCommitDraft,
    CandidateCommitOutcome,
} from '../commit/inventoryCommitCoordinator';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import { resetOwnerRequestFence } from '../identity/ownerRequestFence';
import { resetImageInventoryIdentityForTests } from '../queries/ownerUxQueries';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

const sessionId = testUuid(1);
const inventoryId = testUuid(90);
const identity = { userId: testUuid(50), storeId: testUuid(51) };

const review: OwnerCandidateReview = {
    originalTitle: 'Review title', authors: ['Review author'], originalLanguage: 'en', script: 'Latn',
    metadataChoice: { mode: 'manual', selectionId: null }, quantity: 1, priceMinor: 100,
    baseCondition: 'good', damageDisclosure: {
        hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
        completeReadableSafe: true,
    },
    shelfLocation: 'A1', notes: { publicNote: null, internalNote: null },
    publicationIntent: 'private', duplicateIntent: null,
    originalFieldConfirmation: { title: true, authors: [true] },
    candidateDisposition: 'reviewed',
};

function draft(edits: Partial<OwnerCandidateReview>): CandidateCommitDraft {
    const card: OwnerBatchReviewCard = {
        sessionId, candidateId: testUuid(11), inputId: testUuid(2), ordinal: 1,
        candidateState: 'ready', candidateVersion: 4, metadataState: 'manual',
        metadataRevision: 7, reviewVersion: 2, reviewDisposition: 'reviewed',
        observed: { title: 'Book 1', authors: ['Author'], language: 'en', script: 'Latn' },
        metadataSummary: null, review, fieldSources: {
            cover: 'missing', title: 'custom', authors: 'custom', language: 'custom',
            condition: 'custom', price: 'custom', quantity: 'default', location: 'custom',
            publication: 'default', damage: 'default',
        },
        attentionCodes: [], blockers: [], reviewReady: true,
        allowedActions: ['save_review', 'add_to_inventory'],
        updatedAt: '2026-08-25T00:00:00.000Z',
    };
    return { card, edits };
}

function readyDetail(candidateId: string): OwnerCandidateDetail {
    return candidateDetailFixture({
        sessionId, candidateId, candidateState: 'ready', candidateVersion: 5,
        allowedActions: ['save_review', 'add_to_inventory'],
        review: { value: review, reviewVersion: 3 },
        readiness: {
            reviewReady: true, blockers: [], derivedFromCandidateVersion: 5,
            derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
        },
        metadata: { ...candidateDetailFixture().metadata, revision: 7 },
    });
}

function committedDetail(candidateId: string): OwnerCandidateDetail {
    return candidateDetailFixture({
        sessionId, candidateId, candidateState: 'committed', candidateVersion: 6,
        allowedActions: [],
        review: { value: review, reviewVersion: 3 },
        readiness: {
            reviewReady: false, blockers: [], derivedFromCandidateVersion: 6,
            derivedFromMetadataRevision: 7, derivedFromDuplicateAdviceVersion: null,
        },
    });
}

describe('Phase 9 NEW 6G-D commit hook retry routing (F01)', () => {
    let updateReview: jest.SpyInstance;
    let readCandidateSpy: jest.SpyInstance;
    let addToInventory: jest.SpyInstance;
    const client = new QueryClient();

    beforeEach(() => {
        jest.restoreAllMocks();
        resetOwnerRequestFence(identity);
        resetImageInventoryIdentityForTests(identity);
        updateReview = jest.spyOn(ownerUxService, 'updateCandidateReview')
            .mockImplementation(async () => readyDetail(testUuid(11)));
        readCandidateSpy = jest.spyOn(ownerUxService, 'readCandidate')
            .mockImplementation(async () => readyDetail(testUuid(11)));
        addToInventory = jest.spyOn(ownerUxService, 'addCandidateToInventory')
            .mockImplementation(async (request) => ({
                sessionId: request.sessionId, candidateId: request.candidateId,
                candidateVersion: 6, inventoryId, inventoryVersion: 1,
                outcome: 'committed_private' as const,
            }));
    });

    afterEach(() => {
        client.clear();
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    it('retries with the latest mounted Owner draft instead of replaying the stale frozen draft', async () => {
        updateReview.mockRejectedValueOnce(
            new Error('network hiccup'),
        );
        const draftA = draft({ baseCondition: 'acceptable' });
        const { result } = renderHook(
            () => useInventoryCommitCoordinator(identity, sessionId),
            { wrapper },
        );
        let firstOutcome!: CandidateCommitOutcome;
        await act(async () => {
            firstOutcome = await result.current.addCandidate(draftA);
        });
        expect(firstOutcome).toMatchObject({ status: 'failed_retryable', stage: 'save' });

        // The Owner changes the mounted review before pressing Add again.
        const draftB = draft({ baseCondition: 'acceptable', quantity: 3 });
        let secondOutcome!: CandidateCommitOutcome;
        await act(async () => {
            secondOutcome = await result.current.addCandidate(draftB);
        });
        expect(secondOutcome).toMatchObject({ status: 'succeeded' });

        expect(updateReview).toHaveBeenCalledTimes(2);
        const retriedSave = updateReview.mock.calls[1][0];
        // The CURRENT Owner draft B — never the frozen stale draft A.
        expect(retriedSave.review.quantity).toBe(3);
        expect(retriedSave.review.baseCondition).toBe('acceptable');
        expect(addToInventory).toHaveBeenCalledTimes(1);
    });

    it('never resends an ambiguous M39 request once the Owner changed the draft and cannot duplicate a landed commit', async () => {
        addToInventory.mockRejectedValueOnce(
            new OwnerUxClientError('P9_INTERNAL_ERROR', true, 'unclear'),
        );
        const draftA = draft({});
        const { result } = renderHook(
            () => useInventoryCommitCoordinator(identity, sessionId),
            { wrapper },
        );
        let firstOutcome!: CandidateCommitOutcome;
        await act(async () => {
            firstOutcome = await result.current.addCandidate(draftA);
        });
        expect(firstOutcome).toMatchObject({ status: 'still_pending' });

        // The prior ambiguous commit actually landed server-side; fresh
        // authority must prove it before anything else may run.
        readCandidateSpy.mockResolvedValue(committedDetail(testUuid(11)));
        const draftB = draft({ quantity: 3 });
        let secondOutcome!: CandidateCommitOutcome;
        await act(async () => {
            secondOutcome = await result.current.addCandidate(draftB);
        });
        expect(secondOutcome).toMatchObject({ status: 'no_longer_eligible' });
        // M39 ran exactly once: the ambiguous attempt. Never duplicated.
        expect(addToInventory).toHaveBeenCalledTimes(1);
    });

    it('keeps idempotent identity when retrying an unchanged draft', async () => {
        updateReview.mockRejectedValueOnce(
            new Error('network hiccup'),
        );
        const unchanged = draft({ baseCondition: 'acceptable' });
        const { result } = renderHook(
            () => useInventoryCommitCoordinator(identity, sessionId),
            { wrapper },
        );
        let firstOutcome!: CandidateCommitOutcome;
        await act(async () => {
            firstOutcome = await result.current.addCandidate(unchanged);
        });
        expect(firstOutcome).toMatchObject({ status: 'failed_retryable' });
        let secondOutcome!: CandidateCommitOutcome;
        await act(async () => {
            secondOutcome = await result.current.addCandidate(unchanged);
        });
        expect(secondOutcome).toMatchObject({ status: 'succeeded' });
        const [firstSave, retrySave] = updateReview.mock.calls.map(([request]) => request);
        expect(retrySave.idempotencyKey).toBe(firstSave.idempotencyKey);
        expect(retrySave.commandId).toBe(firstSave.commandId);
        expect(retrySave.review).toEqual(firstSave.review);
    });

    it('marks a repaired needs-attention bulk retry in flight', async () => {
        updateReview.mockRejectedValueOnce(new Error('network hiccup'))
            .mockImplementation(async (request) => readyDetail(request.candidateId));
        const first = draft({ baseCondition: 'acceptable' });
        const { result } = renderHook(
            () => useInventoryCommitCoordinator(identity, sessionId),
            { wrapper },
        );

        let bulk!: Awaited<ReturnType<typeof result.current.addAll>>;
        await act(async () => {
            bulk = await result.current.addAll([first]);
        });
        expect(bulk.result).toMatchObject({ failedRetryable: 1 });

        const invalidCurrent = { ...draft({}), edits: { quantity: 0 } };
        await act(async () => {
            await result.current.retryAddAll(bulk.command, [invalidCurrent]);
        });
        expect(bulk.command.outcomes.get(first.card.candidateId)).toMatchObject({
            status: 'needs_attention',
        });

        let releaseCommit!: (value: {
            sessionId: string; candidateId: string; candidateVersion: number;
            inventoryId: string; inventoryVersion: number; outcome: 'committed_private';
        }) => void;
        const commitGate = new Promise<{
            sessionId: string; candidateId: string; candidateVersion: number;
            inventoryId: string; inventoryVersion: number; outcome: 'committed_private';
        }>((resolve) => { releaseCommit = resolve; });
        addToInventory.mockImplementation(async () => commitGate);
        const repaired = draft({ quantity: 3 });
        let retryPromise!: Promise<unknown>;
        await act(async () => {
            retryPromise = result.current.retryAddAll(bulk.command, [repaired]);
        });
        await waitFor(() => expect(addToInventory).toHaveBeenCalledTimes(1));
        expect(result.current.inFlight.has(first.card.candidateId)).toBe(true);

        releaseCommit({
            sessionId, candidateId: first.card.candidateId, candidateVersion: 6,
            inventoryId, inventoryVersion: 1, outcome: 'committed_private',
        });
        await act(async () => { await retryPromise; });
        expect(result.current.inFlight.has(first.card.candidateId)).toBe(false);
    });
});
