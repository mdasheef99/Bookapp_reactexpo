import { supabase } from '@/lib/supabase';
import type {
    GroupedBookResult,
    MarketplaceBookCondition,
    MarketplaceListingOffer,
    PublicStoreProfile,
    StoreReturnPolicyType,
} from '../types';

/**
 * Phase 5 Consumer Discovery Service
 *
 * Reads ONLY public projections:
 * - `marketplace_book_listings` (public listing projection)
 * - `public_store_profiles` (public store profile projection)
 *
 * Never reads: `store_inventory`, `stores`, P2P `listings`, P2P `transactions`,
 * seller documents, payout data, internal notes, shelf location, acquisition cost,
 * duplicate state, metadata confidence internals, or raw extraction payloads.
 */

// --- Helpers ---

function cleanText(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed || null;
}

function escapeIlikeTerm(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normalizeIsbn(value?: string | null): string | null {
    return cleanText(value)?.replace(/[-\s]/g, '').toUpperCase() ?? null;
}

/**
 * Detects whether a search query looks like an ISBN (10 or 13 digits, with optional
 * hyphens/spaces). Used to prioritize exact ISBN match over fuzzy title search.
 */
function looksLikeIsbn(query: string): boolean {
    const normalized = normalizeIsbn(query);
    if (!normalized) return false;
    return /^\d{9}[\dX]$/.test(normalized) || /^\d{13}$/.test(normalized);
}

function normalizeSearchKey(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const AVAILABILITY_STATUSES = new Set<MarketplaceListingOffer['availabilityStatus']>([
    'available',
    'low_stock',
    'confirmation_required',
    'unavailable',
]);

const RETURN_POLICY_TYPES = new Set<StoreReturnPolicyType>([
    'no_returns',
    'no_returns_except_wrong_item',
    'returns_within_3_days',
    'returns_within_7_days',
]);

function toAvailabilityStatus(value?: string | null): MarketplaceListingOffer['availabilityStatus'] {
    return value && AVAILABILITY_STATUSES.has(value as MarketplaceListingOffer['availabilityStatus'])
        ? (value as MarketplaceListingOffer['availabilityStatus'])
        : 'confirmation_required';
}

function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function toReturnPolicyType(value?: string | null): StoreReturnPolicyType {
    return value && RETURN_POLICY_TYPES.has(value as StoreReturnPolicyType)
        ? (value as StoreReturnPolicyType)
        : 'no_returns';
}

// --- DB row types (snake_case, match column names) ---

type MarketplaceListingRow = {
    id: string;
    store_id: string;
    canonical_edition_id: string | null;
    public_title: string;
    public_authors: string[] | null;
    public_cover_url: string | null;
    isbn_10: string | null;
    isbn_13: string | null;
    condition: MarketplaceBookCondition;
    public_condition_notes: string | null;
    selling_price_minor: number;
    availability_status: string;
    fulfillment_options: string[] | null;
    store_city: string | null;
    store_locality_name: string | null;
    pickup_available: boolean;
    delivery_available: boolean;
};

type PublicStoreProfileRow = {
    store_id: string;
    display_name: string;
    description: string | null;
    logo_url: string | null;
    cover_url: string | null;
    city: string | null;
    state: string | null;
    locality_name: string | null;
    operating_hours: unknown;
    pickup_enabled: boolean;
    delivery_enabled: boolean;
    return_policy_type: string | null;
};

// --- Select lists (explicit, excludes private fields) ---

const LISTING_SELECT = [
    'id',
    'store_id',
    'canonical_edition_id',
    'public_title',
    'public_authors',
    'public_cover_url',
    'isbn_10',
    'isbn_13',
    'condition',
    'public_condition_notes',
    'selling_price_minor',
    'availability_status',
    'fulfillment_options',
    'store_city',
    'store_locality_name',
    'pickup_available',
    'delivery_available',
].join(', ');

const PUBLIC_STORE_PROFILE_SELECT = [
    'store_id',
    'display_name',
    'description',
    'logo_url',
    'cover_url',
    'city',
    'state',
    'locality_name',
    'operating_hours',
    'pickup_enabled',
    'delivery_enabled',
    'return_policy_type',
].join(', ');

// --- Sanitization / mapping ---

function sanitizeListing(
    row: Partial<MarketplaceListingRow>,
    storeDisplayName: string | null,
): MarketplaceListingOffer {
    return {
        id: row.id ?? '',
        storeId: row.store_id ?? '',
        canonicalEditionId: row.canonical_edition_id ?? null,
        publicTitle: row.public_title ?? '',
        publicAuthors: row.public_authors ?? null,
        publicCoverUrl: row.public_cover_url ?? null,
        isbn10: row.isbn_10 ?? null,
        isbn13: row.isbn_13 ?? null,
        condition: (row.condition ?? 'good') as MarketplaceBookCondition,
        publicConditionNotes: row.public_condition_notes ?? null,
        sellingPriceMinor: row.selling_price_minor ?? 0,
        availabilityStatus: toAvailabilityStatus(row.availability_status),
        fulfillmentOptions: row.fulfillment_options ?? [],
        storeCity: row.store_city ?? null,
        storeLocalityName: row.store_locality_name ?? null,
        pickupAvailable: row.pickup_available ?? false,
        deliveryAvailable: row.delivery_available ?? false,
        storeDisplayName,
    };
}

function mapPublicStoreProfile(row: PublicStoreProfileRow): PublicStoreProfile {
    return {
        storeId: row.store_id,
        displayName: row.display_name,
        description: row.description ?? null,
        logoUrl: row.logo_url ?? null,
        coverUrl: row.cover_url ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        localityName: row.locality_name ?? null,
        operatingHours: toRecord(row.operating_hours),
        pickupEnabled: row.pickup_enabled ?? false,
        deliveryEnabled: row.delivery_enabled ?? false,
        returnPolicyType: toReturnPolicyType(row.return_policy_type),
    };
}

// --- Grouping ---

function groupingKeyForOffer(offer: MarketplaceListingOffer): string {
    if (offer.canonicalEditionId) return `edition:${offer.canonicalEditionId}`;
    if (offer.isbn13) return `isbn13:${offer.isbn13}`;
    const authorKey = offer.publicAuthors?.map(normalizeSearchKey).filter(Boolean).join('|') ?? '';
    return `title:${normalizeSearchKey(offer.publicTitle)}|${authorKey}`;
}

function groupOffers(offers: MarketplaceListingOffer[]): GroupedBookResult[] {
    const groups = new Map<string, MarketplaceListingOffer[]>();

    offers.forEach((offer) => {
        const key = groupingKeyForOffer(offer);
        groups.set(key, [...(groups.get(key) ?? []), offer]);
    });

    return Array.from(groups.entries()).map(([groupingKey, groupOffers]) => {
        const first = groupOffers[0];
        return {
            groupingKey,
            title: first.publicTitle,
            authors: first.publicAuthors,
            isbn13: first.isbn13,
            coverUrl: first.publicCoverUrl,
            offerCount: groupOffers.length,
            lowestPriceMinor:
                groupOffers.length > 0
                    ? Math.min(...groupOffers.map((o) => o.sellingPriceMinor))
                    : 0,
            offers: groupOffers,
        };
    });
}

// --- Batch store display name resolution ---

async function batchLoadStoreDisplayNames(storeIds: string[]): Promise<Map<string, string>> {
    if (storeIds.length === 0) return new Map();

    const { data, error } = await supabase
        .from('public_store_profiles')
        .select('store_id, display_name')
        .in('store_id', storeIds);

    if (error) throw error;

    const map = new Map<string, string>();
    (data ?? []).forEach((row: { store_id: string; display_name: string }) => {
        map.set(row.store_id, row.display_name);
    });
    return map;
}

async function recordUnavailableSearch(query: string, resultCount: number): Promise<void> {
    const { error } = await supabase.rpc('record_marketplace_unavailable_search', {
        p_query: query,
        p_result_count: resultCount,
    });

    if (error) {
        return;
    }
}

// --- Service ---

export const consumerDiscoveryService = {
    /**
     * Search public marketplace book listings and group by book.
     *
     * Search behavior:
     * - If query looks like an ISBN, uses exact `eq` match on `isbn_10` or
     *   `isbn_13` depending on normalized query length.
     * - Otherwise uses escaped partial match across `public_title` and the
     *   indexed `authors_text` public projection.
     *
     * Grouping: canonical_edition_id → isbn_13 → normalized title/authors fallback.
     * Each grouped result contains ALL eligible store offers (not collapsed).
     */
    async searchMarketplaceBooks(query: string): Promise<GroupedBookResult[]> {
        const term = cleanText(query);

        let queryBuilder = supabase
            .from('marketplace_book_listings')
            .select(LISTING_SELECT)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .order('updated_at', { ascending: false })
            .limit(50);

        if (term) {
            if (looksLikeIsbn(term)) {
                const normalized = normalizeIsbn(term)!;
                // Exact ISBN match (high priority)
                queryBuilder = normalized.length === 10
                    ? queryBuilder.eq('isbn_10', normalized)
                    : queryBuilder.eq('isbn_13', normalized);
            } else {
                const escapedTerm = escapeIlikeTerm(term);
                queryBuilder = queryBuilder.or(
                    `public_title.ilike.%${escapedTerm}%,authors_text.ilike.%${escapedTerm}%`,
                );
            }
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;

        const rows = (data ?? []) as Partial<MarketplaceListingRow>[];

        // Batch-load store display names from public_store_profiles
        const storeIds = Array.from(new Set(rows.map((r) => r.store_id).filter(Boolean))) as string[];
        const displayNameMap = await batchLoadStoreDisplayNames(storeIds);

        const offers = rows.map((row) =>
            sanitizeListing(row, row.store_id ? (displayNameMap.get(row.store_id) ?? null) : null),
        );

        const grouped = groupOffers(offers);

        if (term && grouped.length === 0) {
            await recordUnavailableSearch(term, 0);
        }

        return grouped;
    },

    /**
     * Fetch a public store profile from `public_store_profiles` only.
     * Excludes all private store fields.
     */
    async getPublicStoreProfile(storeId: string): Promise<PublicStoreProfile> {
        const { data, error } = await supabase
            .from('public_store_profiles')
            .select(PUBLIC_STORE_PROFILE_SELECT)
            .eq('store_id', storeId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Public store profile not found.');

        return mapPublicStoreProfile(data as unknown as PublicStoreProfileRow);
    },

    /**
     * Fetch all active, approved listings for a specific store.
     * Used on the public store page.
     */
    async getStoreListings(storeId: string): Promise<MarketplaceListingOffer[]> {
        const { data, error } = await supabase
            .from('marketplace_book_listings')
            .select(LISTING_SELECT)
            .eq('store_id', storeId)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .order('updated_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        const rows = (data ?? []) as Partial<MarketplaceListingRow>[];
        // Single store, so display name is known from profile; pass null here
        // (the screen will merge profile + listings)
        return rows.map((row) => sanitizeListing(row, null));
    },
};
