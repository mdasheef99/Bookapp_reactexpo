import { z } from 'zod';
import type { MarketplaceListingOffer, PublicStoreProfile } from '../types';

const conditionSchema = z.enum(['new', 'like_new', 'good', 'fair', 'damaged']);
const availabilitySchema = z.enum([
    'available',
    'low_stock',
    'confirmation_required',
    'unavailable',
]);
const returnPolicySchema = z.enum([
    'no_returns',
    'no_returns_except_wrong_item',
    'returns_within_3_days',
    'returns_within_7_days',
]);

export const marketplaceListingRowSchema = z.object({
    id: z.string().min(1),
    store_id: z.string().min(1),
    canonical_edition_id: z.string().nullable().optional().default(null),
    public_title: z.string().trim().min(1),
    public_authors: z.array(z.string()).nullable().optional().default(null),
    public_cover_url: z.string().nullable().optional().default(null),
    isbn_10: z.string().nullable().optional().default(null),
    isbn_13: z.string().nullable().optional().default(null),
    condition: conditionSchema,
    public_condition_notes: z.string().nullable().optional().default(null),
    selling_price_minor: z.number().int().nonnegative(),
    availability_status: availabilitySchema,
    fulfillment_options: z.array(z.string()).nullable().optional().default([]),
    store_city: z.string().nullable().optional().default(null),
    store_locality_name: z.string().nullable().optional().default(null),
    pickup_available: z.boolean(),
    delivery_available: z.boolean(),
});

export const publicStoreProfileRowSchema = z.object({
    store_id: z.string().min(1),
    display_name: z.string().trim().min(1),
    description: z.string().nullable().optional().default(null),
    logo_url: z.string().nullable().optional().default(null),
    cover_url: z.string().nullable().optional().default(null),
    city: z.string().nullable().optional().default(null),
    state: z.string().nullable().optional().default(null),
    locality_name: z.string().nullable().optional().default(null),
    operating_hours: z.record(z.string(), z.unknown()).nullable().optional().default({}),
    pickup_enabled: z.boolean().optional().default(false),
    delivery_enabled: z.boolean().optional().default(false),
    return_policy_type: returnPolicySchema.optional().default('no_returns'),
});

export type MarketplaceListingRow = z.infer<typeof marketplaceListingRowSchema>;
export type PublicStoreProfileRow = z.infer<typeof publicStoreProfileRowSchema>;

export function parseMarketplaceListings(value: unknown): MarketplaceListingRow[] {
    const parsed = z.array(marketplaceListingRowSchema).safeParse(value ?? []);
    if (!parsed.success) {
        throw new Error('Invalid marketplace listing response.');
    }
    return parsed.data;
}

export function parsePublicStoreProfile(value: unknown): PublicStoreProfileRow {
    const parsed = publicStoreProfileRowSchema.safeParse(value);
    if (!parsed.success) {
        throw new Error('Invalid public store profile response.');
    }
    return parsed.data;
}

export function mapListing(
    row: MarketplaceListingRow,
    storeDisplayName: string | null,
): MarketplaceListingOffer {
    return {
        id: row.id,
        storeId: row.store_id,
        canonicalEditionId: row.canonical_edition_id,
        publicTitle: row.public_title,
        publicAuthors: row.public_authors,
        publicCoverUrl: row.public_cover_url,
        isbn10: row.isbn_10,
        isbn13: row.isbn_13,
        condition: row.condition,
        publicConditionNotes: row.public_condition_notes,
        sellingPriceMinor: row.selling_price_minor,
        availabilityStatus: row.availability_status,
        fulfillmentOptions: row.fulfillment_options ?? [],
        storeCity: row.store_city,
        storeLocalityName: row.store_locality_name,
        pickupAvailable: row.pickup_available,
        deliveryAvailable: row.delivery_available,
        storeDisplayName,
    };
}

export function mapPublicStoreProfile(row: PublicStoreProfileRow): PublicStoreProfile {
    return {
        storeId: row.store_id,
        displayName: row.display_name,
        description: row.description,
        logoUrl: row.logo_url,
        coverUrl: row.cover_url,
        city: row.city,
        state: row.state,
        localityName: row.locality_name,
        operatingHours: row.operating_hours ?? {},
        pickupEnabled: row.pickup_enabled,
        deliveryEnabled: row.delivery_enabled,
        returnPolicyType: row.return_policy_type,
    };
}
