import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { imageInventoryKeys, type ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { StoreViewClientError, storeViewService } from '../api/storeViewService';
import {
    STORE_VIEW_CONTRACT_VERSION,
    type StoreViewFilter,
    type StoreViewItem,
    type StoreViewPage,
} from '../contracts/storeViewContracts';

const unresolvedIdentity: ImageInventoryIdentity = {
    userId: 'unresolved',
    storeId: 'unresolved',
};

export const storeViewKeys = {
    all: [...imageInventoryKeys.all, 'storeView', STORE_VIEW_CONTRACT_VERSION] as const,
    page: (identity: ImageInventoryIdentity, filter: StoreViewFilter) => [
        ...imageInventoryKeys.identity(identity),
        'storeView',
        STORE_VIEW_CONTRACT_VERSION,
        'page',
        filter,
    ] as const,
    detail: (identity: ImageInventoryIdentity, inventoryId: string) => [
        ...imageInventoryKeys.identity(identity),
        'storeView',
        STORE_VIEW_CONTRACT_VERSION,
        'detail',
        inventoryId,
    ] as const,
};

export function accumulateStoreViewPages(
    pages: readonly StoreViewPage[] | undefined,
): StoreViewItem[] {
    const seen = new Set<string>();
    const items: StoreViewItem[] = [];
    for (const page of pages ?? []) {
        for (const item of page.items) {
            const id = item.identity.inventoryId;
            if (seen.has(id)) continue;
            seen.add(id);
            items.push(item);
        }
    }
    return items;
}

function retry(failureCount: number, error: Error): boolean {
    return failureCount < 1
        && error instanceof StoreViewClientError
        && error.retryable;
}

const options = {
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnReconnect: true,
    retry,
    retryDelay: 0,
} as const;

export function useStoreViewPage(
    identity: ImageInventoryIdentity | null,
    filter: StoreViewFilter,
) {
    const query = useInfiniteQuery({
        ...options,
        queryKey: storeViewKeys.page(identity ?? unresolvedIdentity, filter),
        queryFn: ({ pageParam, signal }) => storeViewService.page({
            filter,
            pageSize: 20,
            cursor: pageParam,
        }, signal),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.pageInfo.hasNextPage
            ? lastPage.pageInfo.nextCursor
            : undefined,
        enabled: Boolean(identity),
    });
    const items = useMemo(
        () => accumulateStoreViewPages(query.data?.pages),
        [query.data?.pages],
    );
    return { ...query, items };
}

export function useStoreViewDetail(
    identity: ImageInventoryIdentity | null,
    inventoryId: string | null,
) {
    return useQuery({
        ...options,
        queryKey: storeViewKeys.detail(
            identity ?? unresolvedIdentity,
            inventoryId ?? 'unresolved',
        ),
        queryFn: ({ signal }) => storeViewService.detail(inventoryId as string, signal),
        enabled: Boolean(identity && inventoryId),
    });
}
