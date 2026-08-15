import { useQuery } from '@tanstack/react-query';
import { imageInventoryKeys, type ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { StoreViewMediaClientError } from '../api/storeViewMediaService';
import { storeViewHistoryService } from '../api/storeViewHistoryService';
import { STORE_VIEW_HISTORY_CONTRACT_VERSION } from '../contracts/storeViewHistoryContracts';

const unresolvedIdentity: ImageInventoryIdentity = {
    userId: 'unresolved',
    storeId: 'unresolved',
};

export const storeViewHistoryKeys = {
    all: [...imageInventoryKeys.all, 'storeViewHistory', STORE_VIEW_HISTORY_CONTRACT_VERSION] as const,
    detail: (identity: ImageInventoryIdentity, inventoryId: string) => [
        ...imageInventoryKeys.identity(identity),
        'storeViewHistory',
        STORE_VIEW_HISTORY_CONTRACT_VERSION,
        'detail',
        inventoryId,
    ] as const,
};

function retry(failureCount: number, error: unknown): boolean {
    return failureCount < 1
        && error instanceof StoreViewMediaClientError
        && error.retryable;
}

export function useStoreViewHistory(
    identity: ImageInventoryIdentity | null,
    inventoryId: string | null,
) {
    return useQuery({
        queryKey: storeViewHistoryKeys.detail(
            identity ?? unresolvedIdentity,
            inventoryId ?? 'unresolved',
        ),
        queryFn: ({ signal }) => storeViewHistoryService(inventoryId as string, signal),
        enabled: Boolean(identity && inventoryId),
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        retry,
        retryDelay: 0,
    });
}
