import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import {
    ownerUxService,
    type AddCandidateToInventoryRequest,
    type UpdateCandidateReviewRequest,
} from '../api/ownerUxService';
import {
    coordinateImageInventoryIdentity,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import {
    useAddOwnerCandidateToInventory,
    useUpdateOwnerCandidateReview,
} from '../queries/ownerUxReviewQueries';
import { ownerInventoryReadKeys } from '../queries/ownerInventoryReadQueries';
import { ownerBatchReviewKeys } from '../queries/ownerBatchReviewQueries';
import { candidateDetailFixture, testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('../api/ownerUxService', () => {
    const actual = jest.requireActual('../api/ownerUxService');
    return { ...actual, ownerUxService: {
        ...actual.ownerUxService,
        updateCandidateReview: jest.fn(),
        addCandidateToInventory: jest.fn(),
    } };
});

const updateCandidateReview = ownerUxService.updateCandidateReview as jest.Mock;
const addCandidateToInventory = ownerUxService.addCandidateToInventory as jest.Mock;
const identity = { userId: 'owner-a', storeId: 'store-a' };
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
const request: UpdateCandidateReviewRequest = {
    sessionId: testUuid(1), candidateId: testUuid(2), expectedCandidateVersion: 4,
    expectedMetadataRevision: 7, review, idempotencyKey: 'review:fixed-command-0001',
    commandId: testUuid(9),
};
const commitRequest: AddCandidateToInventoryRequest = {
    sessionId: testUuid(1), candidateId: testUuid(2), expectedCandidateVersion: 5,
    expectedReviewVersion: 1, expectedMetadataRevision: 7,
    idempotencyKey: 'commit:fixed-command-0001', commandId: testUuid(8),
};

describe('Phase 9 Unit 6F Review Save request authority fence', () => {
    let client: QueryClient;
    let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
        wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        resetImageInventoryIdentityForTests(identity);
    });

    afterEach(() => client.clear());

    it('uses always-online execution with retry disabled and succeeds in the exact same scope', async () => {
        const canonical = candidateDetailFixture({ candidateVersion: 5 });
        updateCandidateReview.mockResolvedValue(canonical);
        const hook = renderHook(
            () => useUpdateOwnerCandidateReview(identity, request.sessionId, request.candidateId),
            { wrapper },
        );

        await act(async () => expect(hook.result.current.mutateAsync(request)).resolves.toEqual(canonical));
        expect(updateCandidateReview).toHaveBeenCalledWith(request, expect.any(AbortSignal));
        expect(client.getMutationCache().getAll()[0].options).toMatchObject({
            networkMode: 'always', retry: false,
        });
        expect(client.getMutationCache().getAll()[0].state.isPaused).toBe(false);
        hook.unmount();
    });

    it('reconciles every current 6G v3 root after retained full/manual Save', async () => {
        const canonical = candidateDetailFixture({ candidateVersion: 5 });
        updateCandidateReview.mockResolvedValue(canonical);
        const v3Keys = [
            ownerBatchReviewKeys.sessionV3(identity, request.sessionId),
            ownerBatchReviewKeys.batchReview(identity, request.sessionId),
            ownerBatchReviewKeys.readinessV3(identity, request.sessionId),
        ];
        v3Keys.forEach((key) => client.setQueryData(key, { staleCanonical: true }));
        const hook = renderHook(
            () => useUpdateOwnerCandidateReview(identity, request.sessionId, request.candidateId),
            { wrapper },
        );

        await act(async () => expect(hook.result.current.mutateAsync(request)).resolves.toEqual(canonical));
        v3Keys.forEach((key) => {
            expect(client.getQueryState(key)?.isInvalidated).toBe(true);
        });
        hook.unmount();
    });

    it.each([
        ['logout', null],
        ['account change', { userId: 'owner-b', storeId: 'store-a' }],
        ['store change', { userId: 'owner-a', storeId: 'store-b' }],
    ] as const)('aborts an in-flight save on %s and cannot synchronize its late result', async (
        _label,
        nextIdentity,
    ) => {
        let resolveTransport: (value: ReturnType<typeof candidateDetailFixture>) => void = () => {
            throw new Error('transport resolver was not installed');
        };
        updateCandidateReview.mockImplementation((_command: UpdateCandidateReviewRequest, signal: AbortSignal) => (
            new Promise((resolve) => {
                resolveTransport = resolve;
                signal.addEventListener('abort', () => undefined, { once: true });
            })
        ));
        const hook = renderHook(
            () => useUpdateOwnerCandidateReview(identity, request.sessionId, request.candidateId),
            { wrapper },
        );
        let pending!: Promise<unknown>;
        act(() => { pending = hook.result.current.mutateAsync(request); });
        const rejection = expect(pending).rejects.toThrow('OWNER_IDENTITY_CHANGED');
        await waitFor(() => expect(updateCandidateReview).toHaveBeenCalledTimes(1));
        const signal = updateCandidateReview.mock.calls[0][1] as AbortSignal;

        await act(async () => coordinateImageInventoryIdentity(nextIdentity, client));
        expect(signal.aborted).toBe(true);
        await act(async () => resolveTransport(candidateDetailFixture({ candidateVersion: 6 })));
        await rejection;
        expect(client.getQueriesData({ queryKey: ['phase9', 'ownerInventory'] })).toEqual([]);
        hook.unmount();
    });

    it.each([
        ['session change', testUuid(3), testUuid(2)],
        ['candidate change', testUuid(1), testUuid(3)],
    ] as const)('aborts an in-flight save on %s', async (_label, nextSessionId, nextCandidateId) => {
        updateCandidateReview.mockImplementation((_command: UpdateCandidateReviewRequest, signal: AbortSignal) => (
            new Promise((_resolve, reject) => signal.addEventListener(
                'abort', () => reject(new Error('aborted')), { once: true },
            ))
        ));
        const { result, rerender, unmount } = renderHook<
            ReturnType<typeof useUpdateOwnerCandidateReview>,
            { sessionId: string; candidateId: string }
        >(
            ({ sessionId, candidateId }: { sessionId: string; candidateId: string }) => (
                useUpdateOwnerCandidateReview(identity, sessionId, candidateId)
            ),
            { initialProps: { sessionId: request.sessionId, candidateId: request.candidateId }, wrapper },
        );
        let pending!: Promise<unknown>;
        act(() => { pending = result.current.mutateAsync(request); });
        const rejection = expect(pending).rejects.toThrow('aborted');
        await waitFor(() => expect(updateCandidateReview).toHaveBeenCalledTimes(1));
        const signal = updateCandidateReview.mock.calls[0][1] as AbortSignal;
        rerender({ sessionId: nextSessionId, candidateId: nextCandidateId });
        expect(signal.aborted).toBe(true);
        await rejection;
        unmount();
    });

    it('aborts on route unmount and refuses a mismatched command before service transport', async () => {
        updateCandidateReview.mockImplementation((_command: UpdateCandidateReviewRequest, signal: AbortSignal) => (
            new Promise((_resolve, reject) => signal.addEventListener(
                'abort', () => reject(new Error('aborted')), { once: true },
            ))
        ));
        const hook = renderHook(
            () => useUpdateOwnerCandidateReview(identity, request.sessionId, request.candidateId),
            { wrapper },
        );
        let pending!: Promise<unknown>;
        act(() => { pending = hook.result.current.mutateAsync(request); });
        const rejection = expect(pending).rejects.toThrow('aborted');
        await waitFor(() => expect(updateCandidateReview).toHaveBeenCalledTimes(1));
        const signal = updateCandidateReview.mock.calls[0][1] as AbortSignal;
        hook.unmount();
        expect(signal.aborted).toBe(true);
        await rejection;

        updateCandidateReview.mockClear();
        const next = renderHook(
            () => useUpdateOwnerCandidateReview(identity, request.sessionId, request.candidateId),
            { wrapper },
        );
        await expect(next.result.current.mutateAsync({ ...request, candidateId: testUuid(3) }))
            .rejects.toThrow('OWNER_REVIEW_AUTHORITY_CHANGED');
        expect(updateCandidateReview).not.toHaveBeenCalled();
        next.unmount();
    });

    it('refuses an obsolete identity before service transport starts', async () => {
        await coordinateImageInventoryIdentity({ userId: 'owner-b', storeId: 'store-b' }, client);
        const hook = renderHook(
            () => useUpdateOwnerCandidateReview(identity, request.sessionId, request.candidateId),
            { wrapper },
        );
        await expect(hook.result.current.mutateAsync(request)).rejects.toThrow('OWNER_IDENTITY_CHANGED');
        expect(updateCandidateReview).not.toHaveBeenCalled();
        hook.unmount();
    });

    it('commits online without optimism and invalidates candidate, queues, readiness and inventory', async () => {
        const canonical = {
            sessionId: commitRequest.sessionId,
            candidateId: commitRequest.candidateId,
            candidateVersion: 6,
            inventoryId: testUuid(7),
            inventoryVersion: 1,
            outcome: 'committed_private' as const,
        };
        addCandidateToInventory.mockResolvedValue(canonical);
        const keys = [
            ['phase9', 'ownerInventory', identity.userId, identity.storeId, 'candidate'],
            ownerInventoryReadKeys.list(identity),
        ];
        keys.forEach((key) => client.setQueryData(key, { retained: true }));
        const hook = renderHook(
            () => useAddOwnerCandidateToInventory(
                identity, commitRequest.sessionId, commitRequest.candidateId,
            ),
            { wrapper },
        );

        await act(async () => expect(hook.result.current.mutateAsync(commitRequest))
            .resolves.toEqual(canonical));
        expect(addCandidateToInventory).toHaveBeenCalledWith(
            commitRequest, expect.any(AbortSignal),
        );
        expect(client.getMutationCache().getAll().at(-1)?.options).toMatchObject({
            networkMode: 'always', retry: false,
        });
        expect(client.getQueryState(ownerInventoryReadKeys.list(identity))?.isInvalidated).toBe(true);
        expect(client.getQueriesData({ queryKey: ['phase9', 'ownerInventory'] }))
            .toEqual(expect.arrayContaining([[keys[0], { retained: true }]]));
        hook.unmount();
    });

    it('refuses a commit command from a different candidate before transport', async () => {
        const hook = renderHook(
            () => useAddOwnerCandidateToInventory(
                identity, commitRequest.sessionId, commitRequest.candidateId,
            ),
            { wrapper },
        );
        await expect(hook.result.current.mutateAsync({
            ...commitRequest, candidateId: testUuid(3),
        })).rejects.toThrow('OWNER_COMMIT_AUTHORITY_CHANGED');
        expect(addCandidateToInventory).not.toHaveBeenCalled();
        hook.unmount();
    });
});
