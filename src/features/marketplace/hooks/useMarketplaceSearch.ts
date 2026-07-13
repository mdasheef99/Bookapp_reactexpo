import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupedBookResult } from '../types';
import { consumerDiscoveryService } from '../services/consumerDiscoveryService';

/**
 * Debounced marketplace search hook.
 *
 * - Debounces the query by 400ms before calling the service.
 * - Exposes loading, error, and results state.
 * - Does NOT expose customer identity to stores (read-only public projection).
 */
export function useMarketplaceSearch(query: string, debounceMs = 400) {
    const [results, setResults] = useState<GroupedBookResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);

    const search = useCallback(
        async (searchQuery: string) => {
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;
            setIsLoading(true);
            setError(null);
            try {
                const grouped = await consumerDiscoveryService.searchMarketplaceBooks(searchQuery);
                if (requestId === requestIdRef.current) {
                    setResults(grouped);
                }
            } catch (err) {
                if (requestId === requestIdRef.current) {
                    const message = err instanceof Error ? err.message : 'Search failed.';
                    setError(message);
                    setResults([]);
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setIsLoading(false);
                }
            }
        },
        [],
    );

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        const trimmed = query.trim();
        if (!trimmed) {
            requestIdRef.current += 1;
            setResults([]);
            setError(null);
            setIsLoading(false);
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

    return { results, isLoading, error, search };
}
