import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookstoreSearchResult } from '../types';
import { consumerDiscoveryService } from '../services/consumerDiscoveryService';

/**
 * Debounced marketplace search hook.
 *
 * - Debounces the query by 400ms before calling the service.
 * - Exposes loading, error, and results state.
 * - Does NOT expose customer identity to stores (read-only public projection).
 */
export function useMarketplaceSearch(query: string, debounceMs = 400) {
    const [results, setResults] = useState<BookstoreSearchResult[]>([]);
    const [bookstoreCount, setBookstoreCount] = useState(0);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);
    const loadingMoreRef = useRef(false);

    const search = useCallback(
        async (searchQuery: string) => {
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;
            loadingMoreRef.current = false;
            setIsLoadingMore(false);
            setIsLoading(true);
            setError(null);
            try {
                const page = await consumerDiscoveryService.searchBookstores(searchQuery);
                if (requestId === requestIdRef.current) {
                    setResults(page.items);
                    setBookstoreCount(page.bookstoreCount);
                    setNextCursor(page.pageInfo.nextCursor);
                    if (page.bookstoreCount === 0) {
                        await consumerDiscoveryService.recordUnavailableSearch(searchQuery)
                            .catch(() => undefined);
                    }
                }
            } catch (err) {
                if (requestId === requestIdRef.current) {
                    const message = err instanceof Error ? err.message : 'Search failed.';
                    setError(message);
                    setResults([]);
                    setBookstoreCount(0);
                    setNextCursor(null);
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [],
    );

    const searchNow = useCallback(
        async (searchQuery: string) => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            await search(searchQuery.trim());
        },
        [search],
    );

    const retry = useCallback(async () => {
        const trimmed = query.trim();
        if (trimmed) await searchNow(trimmed);
    }, [query, searchNow]);

    useEffect(() => {
        // A new user intention fences the prior request immediately, before this
        // query's debounce is allowed to start its own network request.
        requestIdRef.current += 1;
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            setBookstoreCount(0);
            setNextCursor(null);
            setError(null);
            setIsLoading(false);
            setIsLoadingMore(false);
            loadingMoreRef.current = false;
            return;
        }

        debounceRef.current = setTimeout(() => {
            search(trimmed);
        }, debounceMs);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, debounceMs, search]);

    const loadMore = useCallback(async () => {
        const trimmed = query.trim();
        const cursor = nextCursor;
        if (!trimmed || !cursor || loadingMoreRef.current) return;
        const requestId = requestIdRef.current;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
            const page = await consumerDiscoveryService.searchBookstores(trimmed, { cursor });
            if (requestId !== requestIdRef.current) return;
            setResults((current) => {
                const seen = new Set(current.map((item) => item.store.publicStoreId));
                return [...current, ...page.items.filter((item) => !seen.has(item.store.publicStoreId))];
            });
            setBookstoreCount(page.bookstoreCount);
            setNextCursor(page.pageInfo.nextCursor);
        } catch (caught) {
            if (requestId === requestIdRef.current) {
                setError(caught instanceof Error ? caught.message : 'Failed to load more bookstores.');
            }
        } finally {
            if (requestId === requestIdRef.current) {
                loadingMoreRef.current = false;
                setIsLoadingMore(false);
            }
        }
    }, [nextCursor, query]);

    return {
        results, bookstoreCount, nextCursor, isLoading, isLoadingMore,
        error, searchNow, retry, loadMore,
    };
}
