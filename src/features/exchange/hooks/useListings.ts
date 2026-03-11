import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
    listingsService,
    type ListingFilters,
    type ListingWithBook,
    type CreateListingParams,
} from '../services/listingsService';

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const listingKeys = {
    all: ['listings'] as const,
    browse: (city: string, filters?: ListingFilters) =>
        [...listingKeys.all, 'browse', city, filters ?? {}] as const,
    myListings: (ownerId: string) =>
        [...listingKeys.all, 'my', ownerId] as const,
    detail: (listingId: string) =>
        [...listingKeys.all, 'detail', listingId] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Browse active listings for a given city.
 * Returns `ListingWithBook[]` (lean — no owner profile).
 */
export function useBrowseListings(city: string | null, filters: ListingFilters = {}) {
    return useQuery({
        queryKey: listingKeys.browse(city ?? '', filters),
        queryFn: () => listingsService.browseListings(city!, filters),
        enabled: !!city,
        staleTime: 30_000, // 30 seconds — listings don't change that frequently
    });
}

/**
 * Get all listings owned by the current user.
 */
export function useMyListings(ownerId: string | null) {
    return useQuery({
        queryKey: listingKeys.myListings(ownerId ?? ''),
        queryFn: () => listingsService.getMyListings(ownerId!),
        enabled: !!ownerId,
    });
}

/**
 * Get full details for a single listing (book + owner profile).
 */
export function useListingDetails(listingId: string | null) {
    return useQuery({
        queryKey: listingKeys.detail(listingId ?? ''),
        queryFn: () => listingsService.getListingDetails(listingId!),
        enabled: !!listingId,
    });
}

/**
 * Invalidate browse listings cache (call after creating / deleting a listing).
 */
export function useInvalidateListings() {
    const queryClient = useQueryClient();
    return useCallback(() => {
        queryClient.invalidateQueries({ queryKey: listingKeys.all });
    }, [queryClient]);
}

/**
 * Mutation hook to create a new listing.
 * On success, automatically invalidates all listing queries.
 */
export function useCreateListing() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: CreateListingParams) => listingsService.createListing(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: listingKeys.all });
        },
    });
}

