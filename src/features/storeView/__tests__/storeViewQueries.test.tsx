import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { storeViewService } from '../api/storeViewService';
import type { StoreViewItem, StoreViewPage } from '../contracts/storeViewContracts';
import {
    storeViewKeys,
    useStoreViewDetail,
    useStoreViewPage,
} from '../queries/storeViewQueries';

jest.mock('../api/storeViewService', () => ({
    StoreViewClientError: class extends Error {},
    storeViewService: { page: jest.fn(), detail: jest.fn() },
}));

const identity = { userId: 'owner-a', storeId: 'store-a' };
const inventoryId = '00000000-0000-4000-8000-000000000001';
const listingId = '00000000-0000-4000-8000-000000000002';
const item: StoreViewItem = {
    identity: { inventoryId },
    presentation: {
        title: 'Book', authors: ['Author'], language: 'en', publicDescription: null,
        condition: 'good', publicConditionNote: null, hasDamage: false,
        damageTypes: [], damageNote: null, isSellable: true, sellingPriceMinor: 10000,
    },
    stockSummary: { quantityAvailable: 1, stockState: 'low_stock' },
    lifecycle: { publicationState: 'publication_failed', effectiveState: 'publication_failed', visibilityStatus: 'draft' },
    attention: { attentionState: 'action_required', attentionReasons: ['publication_failed'] },
    capabilities: ['edit_details', 'retry_publication'],
    versions: { inventoryVersion: 1, publicationIntentVersion: 1 },
    mediaSummary: { approvedCount: 0 },
    publicState: { listingId, coverUrl: null, availabilityStatus: 'available' },
};

function page(items: StoreViewItem[], nextCursor: string | null): StoreViewPage {
    return { items, pageInfo: { hasNextPage: nextCursor !== null, nextCursor } };
}

function setup() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
}

describe('Unit 7C WU2 Store View query layer', () => {
    beforeEach(() => jest.clearAllMocks());

    it('puts each server filter in a distinct page query identity', () => {
        const filters = ['all', 'private', 'live', 'paused', 'needs_attention', 'out_of_stock'] as const;
        const keys = filters.map((filter) => storeViewKeys.page(identity, filter));
        expect(new Set(keys.map(JSON.stringify)).size).toBe(6);
        filters.forEach((filter, index) => expect(keys[index]).toContain(filter));
    });

    it('forwards filter and opaque cursor without client-side state filtering', async () => {
        (storeViewService.page as jest.Mock)
            .mockResolvedValueOnce(page([item], 'opaque-next'))
            .mockResolvedValueOnce(page([], null));
        const { wrapper, client } = setup();
        const hook = renderHook(() => useStoreViewPage(identity, 'needs_attention'), { wrapper });
        await waitFor(() => expect(hook.result.current.items).toEqual([item]));
        expect(hook.result.current.items[0].lifecycle.effectiveState).toBe('publication_failed');
        await act(async () => hook.result.current.fetchNextPage());
        expect(storeViewService.page).toHaveBeenNthCalledWith(1, {
            filter: 'needs_attention', pageSize: 20, cursor: null,
        }, expect.any(AbortSignal));
        expect(storeViewService.page).toHaveBeenNthCalledWith(2, {
            filter: 'needs_attention', pageSize: 20, cursor: 'opaque-next',
        }, expect.any(AbortSignal));
        hook.unmount();
        client.clear();
    });

    it('uses inventoryId as the detail cache and service identity', async () => {
        (storeViewService.detail as jest.Mock).mockResolvedValue({
            ...item,
            privateOperations: { shelfLocation: null, internalNotes: null },
            stock: { quantityTotal: 1, quantityAvailable: 1, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
            historySummary: { publicRevisionCount: 0, latestPublicRevision: null },
        });
        const { wrapper, client } = setup();
        const hook = renderHook(() => useStoreViewDetail(identity, inventoryId), { wrapper });
        await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
        expect(storeViewService.detail).toHaveBeenCalledWith(inventoryId, expect.any(AbortSignal));
        expect(storeViewKeys.detail(identity, inventoryId)).toContain(inventoryId);
        expect(storeViewKeys.detail(identity, inventoryId)).not.toContain(listingId);
        hook.unmount();
        client.clear();
    });
});
