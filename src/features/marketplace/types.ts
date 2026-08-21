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

export type PublicBookCondition = 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable';

export interface PublicBookstoreSummary {
    publicStoreId: string;
    displayName: string;
    logo: string | null;
    locality: string | null;
    city: string | null;
    state: string | null;
    pickup: boolean;
    delivery: boolean;
    returnPolicy: StoreReturnPolicyType;
}

export interface BookstoreSearchResult {
    store: PublicBookstoreSummary;
    matchedBook: {
        matchContext: string;
        originalTitle: string;
        authors: string[];
        language: string | null;
        publicIsbn: string | null;
        cover: string;
        boundedMatchKind: string;
    };
    offerSummary: {
        offerCount: number;
        lowestPriceMinor: number;
        currency: 'INR';
        conditionSummary: {
            best: PublicBookCondition;
            worst: PublicBookCondition;
            distinct: PublicBookCondition[];
        };
        damageSummary: {
            hasUndamagedOffers: boolean;
            hasDamagedOffers: boolean;
        };
        fulfillmentSummary: {
            pickupOfferCount: number;
            deliveryOfferCount: number;
        };
        availabilityBand: Exclude<ListingAvailabilityStatus, 'unavailable'>;
        confirmationBeforePayment: true;
    };
}

export interface BookstoreSearchPage {
    contractVersion: string;
    rankingVersion: string;
    bookstoreCount: number;
    items: BookstoreSearchResult[];
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}

export interface StorefrontProfile extends PublicBookstoreSummary {
    description: string | null;
    cover: string | null;
    operatingHours: Record<string, unknown>;
}

export interface StorefrontOffer {
    listingId: string;
    priceMinor: number;
    currency: 'INR';
    condition: PublicBookCondition;
    hasDamage: boolean;
    publicDamageNote: string | null;
    damageTypes: string[];
    availabilityStatus: Exclude<ListingAvailabilityStatus, 'unavailable'>;
    fulfillmentOptions: string[];
    confirmationBeforePayment: true;
}

export interface StorefrontTitleGroup {
    safeTitlePresentation: {
        originalTitle: string;
        authors: string[];
        language: string | null;
        publicIsbn: string | null;
        cover: string;
    };
    offers: StorefrontOffer[];
}

export interface StorefrontCataloguePage {
    contractVersion: 'q09-v1';
    storeProfile: StorefrontProfile;
    titleCount: number;
    matchContextState: 'none' | 'active' | 'unavailable';
    highlightedTitleGroup: StorefrontTitleGroup | null;
    titleGroups: StorefrontTitleGroup[];
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}

export interface PublicGalleryItem {
    url: string;
    role: 'damage' | 'actual_copy' | 'primary_fallback';
    order: number;
    width: number | null;
    height: number | null;
}

export interface PublicListingDetail {
    contractVersion: 'q10-v1';
    listingId: string;
    store: PublicBookstoreSummary & { description: string | null; cover: string | null };
    title: string;
    authors: string[];
    language: string | null;
    description: string | null;
    editionStatement: string | null;
    volume: string | null;
    format: string | null;
    isbn10: string | null;
    isbn13: string | null;
    cover: string;
    priceMinor: number;
    currency: 'INR';
    condition: PublicBookCondition;
    hasDamage: boolean;
    publicDamageNote: string | null;
    damageTypes: string[];
    availabilityStatus: Exclude<ListingAvailabilityStatus, 'unavailable'>;
    fulfillmentOptions: string[];
    confirmationBeforePayment: true;
    gallery: PublicGalleryItem[];
}
