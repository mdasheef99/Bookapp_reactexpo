import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { storeOwnerKeys, useStoreOwnerGate } from '../useStoreOwnerGate';
import { storeOwnerService } from '../../services/storeOwnerService';

jest.mock('../../services/storeOwnerService', () => ({
    storeOwnerService: {
        getGateState: jest.fn(),
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
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

describe('useStoreOwnerGate', () => {
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

    it('uses the stable Store Owner gate query key and fetches by user id', async () => {
        const queryClient = createQueryClient();
        const gateState = { state: 'consumer_only' };
        (storeOwnerService.getGateState as jest.Mock).mockResolvedValue(gateState);

        const { result } = renderHook(() => useStoreOwnerGate('user-1'), {
            wrapper: createWrapper(queryClient),
        });

        await waitFor(() => expect(result.current.data).toEqual(gateState));
        expect(storeOwnerKeys.gate('user-1')).toEqual(['stores', 'ownerGate', 'user-1']);
        expect(storeOwnerService.getGateState).toHaveBeenCalledWith('user-1');
    });

    it('does not fetch without a user id', () => {
        const queryClient = createQueryClient();

        renderHook(() => useStoreOwnerGate(null), {
            wrapper: createWrapper(queryClient),
        });

        expect(storeOwnerService.getGateState).not.toHaveBeenCalled();
        expect(storeOwnerKeys.gate(null)).toEqual(['stores', 'ownerGate', 'anonymous']);
    });
});
