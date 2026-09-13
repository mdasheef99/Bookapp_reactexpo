import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    let wrapper: ({ children }: PropsWithChildren) => React.JSX.Element;
    const sessionId = testUuid(10);

    beforeEach(() => {
        jest.clearAllMocks();
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        wrapper = ({ children }) => (
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
        resetImageInventoryIdentityForTests(identity);
    });

    afterEach(() => { client.clear(); });

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
        await clearImageInventoryPrivateQueries(client);
        expect(client.getQueryCache().findAll({
            queryKey: imageInventoryKeys.identity(identity),
        })).toHaveLength(0);
    });

    it('keeps reads fenced per operation generation across route remounts', async () => {
        readSessionV3.mockResolvedValue({});
        const first = renderHook(() => useOwnerSessionV3(identity, sessionId), { wrapper });
        await waitFor(() => expect(readSessionV3).toHaveBeenCalledTimes(1));
        expect(first.result.current.error).toBeNull();
        first.unmount();
        // A fresh route lifecycle with a fresh cache re-fences from scratch.
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
