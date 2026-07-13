import { useQuery } from '@tanstack/react-query';
import { venuesService } from '../services/venuesService';
import type { VenueFilters } from '../services/venuesService.types';

export const venueKeys = {
    all: ['venues'] as const,
    approved: (filters: VenueFilters = {}) => [...venueKeys.all, 'approved', filters] as const,
    detail: (venueId: string) => [...venueKeys.all, 'detail', venueId] as const,
};

export function useApprovedVenues(filters: VenueFilters = {}) {
    return useQuery({
        queryKey: venueKeys.approved(filters),
        queryFn: () => venuesService.getApprovedVenues(filters),
        staleTime: 30_000,
        retry: false,
    });
}

export function useVenueDetail(venueId: string | null) {
    return useQuery({
        queryKey: venueKeys.detail(venueId ?? ''),
        queryFn: () => venuesService.getVenueById(venueId!),
        enabled: !!venueId,
        staleTime: 30_000,
        retry: false,
    });
}
