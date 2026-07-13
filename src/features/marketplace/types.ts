/**
 * Phase 5 Consumer Discovery — Consumer-facing types.
 *
 * These types are intentionally separate from `src/features/stores/types.ts`
 * because the consumer marketplace reads only public projections
 * (`marketplace_book_listings`, `public_store_profiles`) and must never
 * import or reuse owner-scoped inventory/store types.
 */

export type MarketplaceBookCondition = 'new' | 'like_new' | 'good' | 'fair' | 'damaged';

export type ListingAvailabilityStatus =
    | 'available'
    | 'low_stock'
    | 'confirmation_required'
    | 'unavailable';

export type ListingStatus = 'active' | 'paused' | 'out_of_stock' | 'blocked';

export type ModerationStatus = 'approved' | 'pending' | 'blocked' | 'prohibited';

export type StoreReturnPolicyType =
    | 'no_returns'
    | 'no_returns_except_wrong_item'
    | 'returns_within_3_days'
    | 'returns_within_7_days';

/**
 * A single public marketplace listing offer from one bookstore.
 * Maps to a row in `marketplace_book_listings` (public projection only).
 */
export interface MarketplaceListingOffer {
    id: string;
    storeId: string;
    canonicalEditionId: string | null;
    publicTitle: string;
    publicAuthors: string[] | null;
    publicCoverUrl: string | null;
    isbn10: string | null;
    isbn13: string | null;
    condition: MarketplaceBookCondition;
    publicConditionNotes: string | null;
    sellingPriceMinor: number;
    availabilityStatus: ListingAvailabilityStatus;
    fulfillmentOptions: string[];
    storeCity: string | null;
    storeLocalityName: string | null;
    pickupAvailable: boolean;
    deliveryAvailable: boolean;
    /**
     * Store display name resolved from `public_store_profiles`.
     * Not stored on `marketplace_book_listings`; batch-loaded by the service.
     */
    storeDisplayName: string | null;
}

/**
 * A grouped book result containing all eligible store offers for that book.
 * Grouping priority: canonical_edition_id → isbn_13 → normalized title/authors.
 */
export interface GroupedBookResult {
    groupingKey: string;
    title: string;
    authors: string[] | null;
    isbn13: string | null;
    coverUrl: string | null;
    offerCount: number;
    lowestPriceMinor: number;
    offers: MarketplaceListingOffer[];
}

/**
 * Public store profile from `public_store_profiles` projection only.
 * Excludes private fields: pincode, legal_name, legal_seller_name,
 * minimum_delivery_order_value_minor, payout_account_status,
 * suspension_reason, seller docs, etc.
 */
export interface PublicStoreProfile {
    storeId: string;
    displayName: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    city: string | null;
    state: string | null;
    localityName: string | null;
    operatingHours: Record<string, unknown>;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
    returnPolicyType: StoreReturnPolicyType;
}

/**
 * Search input for consumer marketplace discovery.
 */
export interface MarketplaceSearchInput {
    query: string;
}
