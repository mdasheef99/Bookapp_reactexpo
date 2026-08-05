import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
    type InfiniteData,
} from '@tanstack/react-query';
import {
    OWNER_INVENTORY_CONTRACT_VERSION,
    OWNER_INVENTORY_DEFAULT_PAGE_SIZE,
    OwnerInventoryReadError,
    ownerInventoryReadService,
    type OwnerInventoryFilters,
    type OwnerInventoryListItem,
    type OwnerInventoryPage,
} from '../api/ownerInventoryReadService';
import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';

type NormalizedFilters = Required<OwnerInventoryFilters>;

function normalizeFilters(filters: OwnerInventoryFilters = {}): NormalizedFilters {
    return {
        query: filters.query?.trim() ?? '',
        condition: filters.condition ?? 'all',
        visibilityStatus: filters.visibilityStatus ?? 'all',
        quantityState: filters.quantityState ?? 'all',
        entryMethod: filters.entryMethod ?? 'all',
        dateAdded: filters.dateAdded ?? 'all',
    };
}

function keyFilters(filters: OwnerInventoryFilters = {}) {
    const normalized = normalizeFilters(filters);
    return {
        ...normalized,
        query: normalized.query.toLocaleLowerCase(),
    };
}

export const ownerInventoryReadKeys = {
    all: [...imageInventoryKeys.all, 'ownerRead', OWNER_INVENTORY_CONTRACT_VERSION] as const,
    list: (identity: ImageInventoryIdentity, filters: OwnerInventoryFilters = {}) => {
        const normalized = keyFilters(filters);
        return [
            ...imageInventoryKeys.identity(identity),
            'ownerRead',
            OWNER_INVENTORY_CONTRACT_VERSION,
            normalized.query,
            normalized.condition,
            normalized.visibilityStatus,
            normalized.quantityState,
            normalized.entryMethod,
            normalized.dateAdded,
        ] as const;
    },
};

export function accumulateOwnerInventoryPages(
    pages: readonly OwnerInventoryPage[] | undefined,
): OwnerInventoryListItem[] {
    const seen = new Set<string>();
    const items: OwnerInventoryListItem[] = [];
    for (const page of pages ?? []) {
        for (const item of page.items) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            items.push(item);
        }
    }
    return items;
}

const unresolvedIdentity: ImageInventoryIdentity = {
    userId: 'unresolved',
    storeId: 'unresolved',
};

function retryOwnerRead(failureCount: number, error: Error): boolean {
    return failureCount < 1
        && error instanceof OwnerInventoryReadError
        && error.retryable;
}

export function useOwnerInventoryRead(
    identity: ImageInventoryIdentity | null,
    filters: OwnerInventoryFilters = {},
) {
    const queryClient = useQueryClient();
    const normalizedFilters = normalizeFilters(filters);
    const queryKey = ownerInventoryReadKeys.list(identity ?? unresolvedIdentity, normalizedFilters);
    const scopeToken = JSON.stringify(queryKey);
    const activeScope = useRef(scopeToken);
    const refreshGeneration = useRef(0);
    useEffect(() => {
        activeScope.current = scopeToken;
        refreshGeneration.current += 1;
        return () => {
            refreshGeneration.current += 1;
        };
    }, [scopeToken]);
    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => ownerInventoryReadService.listPage({
            pageSize: OWNER_INVENTORY_DEFAULT_PAGE_SIZE,
            cursor: pageParam,
            filters: normalizedFilters,
        }, signal),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.pageInfo.hasMore
            ? lastPage.pageInfo.nextCursor
            : undefined,
        enabled: Boolean(identity),
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        retry: retryOwnerRead,
        retryDelay: 0,
    });
    const refreshQuery = useQuery({
        queryKey: [...queryKey, 'firstPageRefresh'],
        queryFn: ({ signal }) => ownerInventoryReadService.listPage({
            pageSize: OWNER_INVENTORY_DEFAULT_PAGE_SIZE,
            cursor: null,
            filters: normalizedFilters,
        }, signal),
        enabled: false,
        staleTime: 0,
        gcTime: 0,
        retry: retryOwnerRead,
        retryDelay: 0,
    });

    const items = useMemo(
        () => accumulateOwnerInventoryPages(query.data?.pages),
        [query.data?.pages],
    );
    const lastPage = query.data?.pages.at(-1);
    const loadNextPage = useCallback(async () => {
        await query.fetchNextPage();
    }, [query.fetchNextPage]);
    const resetPagination = useCallback(async () => {
        await queryClient.resetQueries({ queryKey, exact: true });
    }, [queryClient, queryKey]);
    const refresh = useCallback(async () => {
        const generation = ++refreshGeneration.current;
        const result = await refreshQuery.refetch({ cancelRefetch: true });
        if (
            !result.isSuccess
            || !result.data
            || generation !== refreshGeneration.current
            || scopeToken !== activeScope.current
        ) return;
        queryClient.setQueryData<InfiniteData<OwnerInventoryPage, string | null>>(queryKey, {
            pages: [result.data],
            pageParams: [null],
        });
    }, [queryClient, queryKey, refreshQuery.refetch, scopeToken]);

    return {
        ...query,
        error: refreshQuery.error ?? query.error,
        isError: query.isError || refreshQuery.isError,
        isFetching: query.isFetching || refreshQuery.isFetching,
        items,
        hasMore: Boolean(query.hasNextPage),
        nextCursor: lastPage?.pageInfo.nextCursor ?? null,
        isNextPageError: query.isFetchNextPageError,
        isRefreshing: refreshQuery.isFetching,
        isRefreshError: refreshQuery.isError,
        loadNextPage,
        refresh,
        resetPagination,
    };
}
