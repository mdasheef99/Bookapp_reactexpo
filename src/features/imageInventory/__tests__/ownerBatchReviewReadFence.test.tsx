import { QueryClient, QueryClientProvider, type QueryObserverOptions } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { ownerBatchReviewService } from '../api/ownerBatchReviewService';
import {
    ownerBatchReviewKeys,
    useOwnerBatchReview,
    useOwnerSessionV3,
} from '../queries/ownerBatchReviewQueries';
import {
    clearImageInventoryPrivateQueries,
    coordinateImageInventoryIdentity,
    imageInventoryKeys,
    resetImageInventoryIdentityForTests,
} from '../queries/ownerUxQueries';
import { testUuid } from '../testing/ownerUxTestFixtures';

jest.mock('../api/ownerBatchReviewService', () => {
    const actual = jest.requireActual('../api/ownerBatchReviewService');
    return {
        ...actual,
        ownerBatchReviewService: {
            ...actual.ownerBatchReviewService,
            readSessionV3: jest.fn(),
            readBatchReview: jest.fn(),
        },
    };
});

const readSessionV3 = ownerBatchReviewService.readSessionV3 as jest.Mock;
const readBatchReview = ownerBatchReviewService.readBatchReview as jest.Mock;

const identity = { userId: 'owner-a', storeId: 'store-a' };
const nextIdentity = { userId: 'owner-b', storeId: 'store-a' };

describe('Phase 9 NEW 6G-C read-query request fencing', () => {
    let client: QueryClient;
    let clients: QueryClient[];
    let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;
    const sessionId = testUuid(10);

    beforeEach(() => {
        jest.clearAllMocks();
        clients = [];
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        clients.push(client);
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        resetImageInventoryIdentityForTests(identity);
    });

    afterEach(() => {
        clients.forEach((queryClient) => queryClient.clear());
    });

    it('passes an abort signal to session reads and aborts the transport on unmount', async () => {
        readSessionV3.mockImplementation(
            (_sessionId: string, signal?: AbortSignal) => new Promise((_resolve, reject) => {
                signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            }),
        );
        const hook = renderHook(() => useOwnerSessionV3(identity, sessionId), { wrapper });
        await waitFor(() => expect(readSessionV3).toHaveBeenCalledTimes(1));
        const signal = readSessionV3.mock.calls[0][1] as AbortSignal | undefined;
        expect(signal).toBeInstanceOf(AbortSignal);
        hook.unmount();
        expect(signal?.aborted).toBe(true);
    });

    it('rejects a stale batch-review response after the Owner/store authority changed', async () => {
        let resolveRead!: (value: unknown) => void;
        readBatchReview.mockImplementation(
            (_sessionId: string, signal?: AbortSignal) => new Promise((resolve) => {
                signal?.addEventListener('abort', () => resolve(undefined), { once: true });
                resolveRead = resolve;
            }),
        );
        const hook = renderHook(() => useOwnerBatchReview(identity, sessionId, true), { wrapper });
        await waitFor(() => expect(readBatchReview).toHaveBeenCalledTimes(1));
        const signal = readBatchReview.mock.calls[0][1] as AbortSignal | undefined;
        expect(signal).toBeInstanceOf(AbortSignal);
        const staleQuery = client.getQueryCache().find({
            queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
            exact: true,
        });

        await act(async () => {
            await coordinateImageInventoryIdentity(nextIdentity, client);
        });
        expect(signal?.aborted).toBe(true);

        // A late stale payload must never overwrite cleared private state.
        resolveRead({
            contractVersion: 'phase9-owner-batch-review-v1',
            data: {},
        });
        await act(async () => { await Promise.resolve(); });
        expect(client.getQueryData(ownerBatchReviewKeys.batchReview(identity, sessionId)))
            .toBeUndefined();

        // Once the route lifecycle tears down, the prior-identity root is
        // fully removed from the cache.
        hook.unmount();
        staleQuery?.destroy();
        await clearImageInventoryPrivateQueries(client);
        expect(client.getQueryCache().findAll({
            queryKey: imageInventoryKeys.identity(identity),
        })).toHaveLength(0);
    });

    it('polls while a card edition match is pending even when nothing is processing', async () => {
        readBatchReview.mockResolvedValue({
            sessionId, status: 'active', sessionVersion: 4, presentationRevision: 1,
            defaults: {
                languageHint: 'en', condition: null, location: 'Shelf', priceMinor: null,
                quantity: 1, publication: 'private', script: null,
            },
            batchLabel: null,
            counts: {
                detected: 1, processing: 0, needsAttention: 1, reviewReadySaved: 0,
                committed: 0, ownerRemoved: 0, falseDetections: 0,
            },
            items: [{
                sessionId, candidateId: testUuid(11), candidateVersion: 1,
                metadataState: 'pending', metadataRevision: 1,
            }],
            updatedAt: '2026-07-31T00:00:00.000Z',
        });
        renderHook(() => useOwnerBatchReview(identity, sessionId, true), { wrapper });
        await waitFor(() => expect(readBatchReview).toHaveBeenCalledTimes(1));
        const query = client.getQueryCache().find({
            queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
            exact: true,
        });
        const interval = (query?.options as QueryObserverOptions).refetchInterval as unknown as
            (input: { state: { data: unknown } }) => number | false;
        expect(interval({
            state: { data: { counts: { processing: 0 }, items: [{ metadataState: 'pending' }] } },
        })).toBe(3_000);
        expect(interval({
            state: { data: { counts: { processing: 0 }, items: [{ metadataState: 'manual' }] } },
        })).toBe(false);
    });

    it('keeps reads fenced per operation generation across route remounts', async () => {
        readSessionV3.mockResolvedValue({});
        const first = renderHook(() => useOwnerSessionV3(identity, sessionId), { wrapper });
        await waitFor(() => expect(readSessionV3).toHaveBeenCalledTimes(1));
        expect(first.result.current.error).toBeNull();
        first.unmount();
        // A fresh route lifecycle with a fresh cache re-fences from scratch.
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        clients.push(client);
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        const second = renderHook(() => useOwnerSessionV3(identity, sessionId), { wrapper });
        await waitFor(() => expect(readSessionV3).toHaveBeenCalledTimes(2));
        expect(second.result.current.error).toBeNull();
        expect(client.getQueryData(ownerBatchReviewKeys.sessionV3(identity, sessionId)))
            .toEqual({});
        second.unmount();
    });
});
