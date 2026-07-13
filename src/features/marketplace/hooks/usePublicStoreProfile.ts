import { useEffect, useState } from 'react';
import type { MarketplaceListingOffer, PublicStoreProfile } from '../types';
import { consumerDiscoveryService } from '../services/consumerDiscoveryService';

/**
 * Hook to fetch a public store profile and its active listings.
 *
 * Reads ONLY from `public_store_profiles` and `marketplace_book_listings`.
 * Never reads `stores` or `store_inventory`.
 */
export function usePublicStoreProfile(storeId: string | null) {
    const [profile, setProfile] = useState<PublicStoreProfile | null>(null);
    const [listings, setListings] = useState<MarketplaceListingOffer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!storeId) {
            setProfile(null);
            setListings([]);
            setError(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        Promise.all([
            consumerDiscoveryService.getPublicStoreProfile(storeId),
            consumerDiscoveryService.getStoreListings(storeId),
        ])
            .then(([fetchedProfile, fetchedListings]) => {
                if (cancelled) return;
                setProfile(fetchedProfile);
                setListings(fetchedListings);
            })
            .catch((err) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : 'Failed to load store.';
                setError(message);
                setProfile(null);
                setListings([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [storeId]);

    return { profile, listings, isLoading, error };
}
