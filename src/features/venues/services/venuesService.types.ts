export type VenueVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Venue {
    id: string;
    venue_code: string | null;
    name: string;
    description: string | null;
    venue_type: string;
    cover_url: string | null;
    photos: string[] | null;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    pincode: string;
    operating_hours: Record<string, unknown> | null;
    amenities: string[] | null;
    max_capacity: number | null;
    booking_required: boolean | null;
    owner_user_id: string | null;
    verification_status: VenueVerificationStatus | string | null;
    is_exchange_partner: boolean | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface VenueFilters {
    search?: string;
    city?: string;
    venueType?: string;
    isExchangePartner?: boolean;
    limit?: number;
    offset?: number;
}
