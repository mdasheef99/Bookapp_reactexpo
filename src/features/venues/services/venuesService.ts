import { supabase } from '@/lib/supabase';
import type { Venue, VenueFilters } from './venuesService.types';

const VENUE_SELECT = `
    id,
    venue_code,
    name,
    description,
    venue_type,
    cover_url,
    photos,
    address_line1,
    address_line2,
    city,
    state,
    pincode,
    operating_hours,
    amenities,
    max_capacity,
    booking_required,
    owner_user_id,
    verification_status,
    is_exchange_partner,
    created_at,
    updated_at
`;

function normalizeVenueSearchTerm(search?: string) {
    return search?.trim()
        .replace(/[%(),.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() ?? '';
}

function applyVenueFilters(query: any, filters: VenueFilters) {
    if (filters.city?.trim()) query = query.eq('city', filters.city.trim());
    if (filters.venueType?.trim()) query = query.eq('venue_type', filters.venueType.trim());
    if (typeof filters.isExchangePartner === 'boolean') query = query.eq('is_exchange_partner', filters.isExchangePartner);
    const term = normalizeVenueSearchTerm(filters.search);
    if (term) {
        query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,address_line1.ilike.%${term}%,address_line2.ilike.%${term}%,city.ilike.%${term}%`);
    }
    return query;
}

export const venuesService = {
    async getApprovedVenues(filters: VenueFilters = {}): Promise<Venue[]> {
        const { limit = 20, offset = 0 } = filters;
        let query = supabase.from('venues').select(VENUE_SELECT)
            .eq('verification_status', 'approved')
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1);

        query = applyVenueFilters(query, filters);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as Venue[];
    },

    async getVenueById(venueId: string): Promise<Venue> {
        const { data, error } = await supabase.from('venues')
            .select(VENUE_SELECT)
            .eq('id', venueId)
            .eq('verification_status', 'approved')
            .single();

        if (error) throw error;
        return data as Venue;
    },
};

export type { Venue, VenueFilters } from './venuesService.types';
