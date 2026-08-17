import { useQuery } from '@tanstack/react-query';
import { imageInventoryKeys, type ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { StoreViewMediaClientError, storeViewMediaService } from '../api/storeViewMediaService';
import { STORE_VIEW_MEDIA_CONTRACT_VERSION } from '../contracts/storeViewMediaContracts';

const unresolvedIdentity: ImageInventoryIdentity = {
    userId: 'unresolved',
    storeId: 'unresolved',
};

export const storeViewMediaKeys = {
    all: [...imageInventoryKeys.all, 'storeViewMedia', STORE_VIEW_MEDIA_CONTRACT_VERSION] as const,
    detail: (identity: ImageInventoryIdentity, inventoryId: string) => [
        ...imageInventoryKeys.identity(identity),
        'storeViewMedia',
        STORE_VIEW_MEDIA_CONTRACT_VERSION,
        'detail',
        inventoryId,
    ] as const,
};

function retry(failureCount: number, error: Error): boolean {
    return failureCount < 1
        && error instanceof StoreViewMediaClientError
        && error.retryable;
}

export function useStoreViewMedia(
    identity: ImageInventoryIdentity | null,
    inventoryId: string | null,
) {
    return useQuery({
        queryKey: storeViewMediaKeys.detail(
            identity ?? unresolvedIdentity,
            inventoryId ?? 'unresolved',
        ),
        queryFn: ({ signal }) => storeViewMediaService.read(inventoryId as string, signal),
        enabled: Boolean(identity && inventoryId),
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        retry,
        retryDelay: 0,
    });
}
