import { useCallback, useEffect, useState } from 'react';
import type { GroupedBookResult } from '../types';
import { consumerDiscoveryService } from '../services/consumerDiscoveryService';

export function usePublicBookOffers(listingId: string | null) {
    const [result, setResult] = useState<GroupedBookResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!listingId) return;
        setIsLoading(true);
        setError(null);
        try {
            setResult(await consumerDiscoveryService.getBookOffers(listingId));
        } catch (caught) {
            setResult(null);
            setError(caught instanceof Error ? caught.message : 'Failed to load book availability.');
        } finally {
            setIsLoading(false);
        }
    }, [listingId]);

    useEffect(() => {
        void load();
    }, [load]);

    return { result, isLoading, error, retry: load };
}
