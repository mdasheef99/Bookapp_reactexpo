import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { listingKeys } from '../useListings';
import {
    transactionKeys,
    useCompleteTransaction,
    useRequestTransaction,
} from '../useTransactions';
import { transactionsService } from '../../services/transactionsService';

jest.mock('../../services/transactionsService', () => ({
    transactionsService: {
        requestTransaction: jest.fn(),
        approveTransaction: jest.fn(),
        declineTransaction: jest.fn(),
        cancelTransaction: jest.fn(),
        completeTransaction: jest.fn(),
        transitionStatus: jest.fn(),
        fileDispute: jest.fn(),
    },
}));

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });
}

function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

describe('useTransactions cache invalidation', () => {
    beforeAll(() => {
        notifyManager.setNotifyFunction((callback) => {
            act(callback);
        });
    });

    afterAll(() => {
        notifyManager.setNotifyFunction((callback) => {
            callback();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('invalidates transaction, listing, and credit queries after requesting an exchange', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (transactionsService.requestTransaction as jest.Mock).mockResolvedValue({ id: 'txn-1' });

        const { result } = renderHook(() => useRequestTransaction(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                listingId: 'listing-1',
                borrowerId: 'borrower-1',
                deliveryType: 'meetup',
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: transactionKeys.all });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: listingKeys.all });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['creditBalance'] });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['creditHistory'] });
    });

    it('invalidates dependent listing and credit queries after completing an exchange', async () => {
        const queryClient = createQueryClient();
        const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
        (transactionsService.completeTransaction as jest.Mock).mockResolvedValue({ id: 'txn-2' });

        const { result } = renderHook(() => useCompleteTransaction(), { wrapper: createWrapper(queryClient) });

        await act(async () => {
            await result.current.mutateAsync({
                transactionId: 'txn-2',
                actorId: 'reader-2',
            });
        });

        await waitFor(() => {
            expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: transactionKeys.detail('txn-2') });
        });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: transactionKeys.all });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: listingKeys.all });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['creditBalance'] });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['creditHistory'] });
    });
});
