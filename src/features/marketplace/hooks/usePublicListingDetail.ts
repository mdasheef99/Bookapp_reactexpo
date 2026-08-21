import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicListingDetail } from '../types';
import { consumerDiscoveryService } from '../services/consumerDiscoveryService';

export function usePublicListingDetail(listingId: string) {
    const [detail, setDetail] = useState<PublicListingDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const generationRef = useRef(0);

    const load = useCallback(async () => {
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        setIsLoading(true);
        setError(null);
        try {
            const next = await consumerDiscoveryService.getPublicListingDetail(listingId);
            if (generation === generationRef.current) setDetail(next);
        } catch (caught) {
            if (generation !== generationRef.current) return;
            setDetail(null);
            setError(caught instanceof Error ? caught.message : 'Failed to load book details.');
        } finally {
            if (generation === generationRef.current) setIsLoading(false);
        }
    }, [listingId]);

    useEffect(() => {
        void load();
        return () => { generationRef.current += 1; };
    }, [load]);

    return { detail, isLoading, error, retry: load };
}
