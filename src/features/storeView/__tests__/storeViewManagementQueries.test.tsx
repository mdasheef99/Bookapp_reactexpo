import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createCaptureAttempt } from '@/features/imageInventory/capture/captureIds';
import { ownerInventoryReadKeys } from '@/features/imageInventory/queries/ownerInventoryReadQueries';
import { storeViewManagementService } from '../api/storeViewManagementService';
import { useStoreViewManagementCommands } from '../queries/storeViewManagementQueries';
import { storeViewKeys } from '../queries/storeViewQueries';

jest.mock('@/features/imageInventory/capture/captureIds', () => ({
    createCaptureAttempt: jest.fn(),
}));
jest.mock('../api/storeViewManagementService', () => ({
    storeViewManagementService: { save: jest.fn(), adjustStock: jest.fn() },
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';

function setup() {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, invalidate, wrapper };
}

describe('Unit 7C WU3 Store View management query layer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createCaptureAttempt as jest.Mock).mockReturnValue({
            key: 'store-view-command:attempt-1',
            commandId: '00000000-0000-4000-8000-000000000002',
        });
        (storeViewManagementService.save as jest.Mock).mockResolvedValue({ outcome: 'details_updated' });
        (storeViewManagementService.adjustStock as jest.Mock).mockResolvedValue({ outcome: 'stock_adjusted' });
    });

    it('creates command identity once and forwards the current inventory version for Save', async () => {
        const { client, wrapper } = setup();
        const hook = renderHook(() => useStoreViewManagementCommands(identity), { wrapper });
        await act(async () => hook.result.current.mutateAsync({
            kind: 'save', inventoryId, inventoryVersion: 3,
            changes: { title: 'Updated title' },
        }));
        expect(createCaptureAttempt).toHaveBeenCalledWith('store-view-save');
        expect(storeViewManagementService.save).toHaveBeenCalledWith({
            inventoryId, expectedInventoryVersion: 3,
            changes: { title: 'Updated title' },
            idempotencyKey: 'store-view-command:attempt-1',
            commandId: '00000000-0000-4000-8000-000000000002',
        });
        hook.unmount();
        client.clear();
    });

    it('keeps stock separate and refreshes authoritative Store View/detail/list caches', async () => {
        const { client, invalidate, wrapper } = setup();
        const hook = renderHook(() => useStoreViewManagementCommands(identity), { wrapper });
        await act(async () => hook.result.current.mutateAsync({
            kind: 'stock', inventoryId, inventoryVersion: 4, delta: -1,
        }));
        expect(storeViewManagementService.adjustStock).toHaveBeenCalledWith(expect.objectContaining({
            inventoryId, expectedInventoryVersion: 4, delta: -1,
        }));
        await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: storeViewKeys.all }));
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ownerInventoryReadKeys.all });
        hook.unmount();
        client.clear();
    });
});
