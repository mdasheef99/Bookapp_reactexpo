import { supabase } from '@/lib/supabase';
import type { GroupedBookResult, MarketplaceListingOffer, PublicStoreProfile } from '../types';
import {
    cleanText,
    groupOffers,
    looksLikeIsbn,
    normalizeIsbn,
    normalizePage,
    quotedIlikeFilter,
    type MarketplacePageOptions,
} from './discoveryHelpers';
import {
    mapListing,
    mapPublicStoreProfile,
    parseMarketplaceListings,
    parsePublicStoreProfile,
} from './discoverySchemas';

const LISTING_SELECT = [
    'id', 'store_id', 'canonical_edition_id', 'public_title', 'public_authors',
    'public_cover_url', 'isbn_10', 'isbn_13', 'condition', 'public_condition_notes',
    'selling_price_minor', 'availability_status', 'fulfillment_options', 'store_city',
    'store_locality_name', 'pickup_available', 'delivery_available',
].join(', ');

const PUBLIC_STORE_PROFILE_SELECT = [
    'store_id', 'display_name', 'description', 'logo_url', 'cover_url', 'city', 'state',
    'locality_name', 'operating_hours', 'pickup_enabled', 'delivery_enabled',
    'return_policy_type',
].join(', ');

async function batchLoadStoreDisplayNames(storeIds: string[]): Promise<Map<string, string>> {
    if (storeIds.length === 0) return new Map();
    const { data, error } = await supabase
        .from('public_store_profiles')
        .select('store_id, display_name')
        .in('store_id', storeIds);
    if (error) throw error;

    const map = new Map<string, string>();
    (data ?? []).forEach((row: { store_id: string; display_name: string }) => {
        if (row.store_id && row.display_name) map.set(row.store_id, row.display_name);
    });
    return map;
}

async function mapRowsWithStoreNames(data: unknown): Promise<MarketplaceListingOffer[]> {
    const rows = parseMarketplaceListings(data);
    const storeIds = Array.from(new Set(rows.map((row) => row.store_id)));
    const names = await batchLoadStoreDisplayNames(storeIds);
    return rows.map((row) => mapListing(row, names.get(row.store_id) ?? null));
}

async function recordUnavailableSearch(query: string): Promise<void> {
    await supabase.rpc('record_marketplace_unavailable_search', { p_query: query });
}

export const consumerDiscoveryService = {
    async searchMarketplaceBooks(
        query: string,
        options: MarketplacePageOptions = {},
    ): Promise<GroupedBookResult[]> {
        const term = cleanText(query);
        const { from, to } = normalizePage(options);
        const isIsbn = term ? looksLikeIsbn(term) : false;

        if (term && !isIsbn) {
            const { data, error } = await supabase.rpc(
                'phase9_search_marketplace_listings',
                { p_query: term, p_from: from, p_to: to },
            );
            if (error) throw error;
            if (data !== null) {
                const grouped = groupOffers(await mapRowsWithStoreNames(data));
                if (grouped.length === 0) {
                    await recordUnavailableSearch(term).catch(() => undefined);
                }
                return grouped;
            }
        }

        let builder = supabase
            .from('marketplace_book_listings')
            .select(LISTING_SELECT)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .order('updated_at', { ascending: false })
            .range(from, to);

        if (term) {
            if (isIsbn) {
                const isbn = normalizeIsbn(term)!;
                builder = isbn.length === 10
                    ? builder.eq('isbn_10', isbn)
                    : builder.eq('isbn_13', isbn);
            } else {
                const filter = quotedIlikeFilter(term);
                builder = builder.or(`public_title.ilike.${filter},authors_text.ilike.${filter}`);
            }
        }

        const { data, error } = await builder;
        if (error) throw error;
        const grouped = groupOffers(await mapRowsWithStoreNames(data));
        if (term && grouped.length === 0) {
            await recordUnavailableSearch(term).catch(() => undefined);
        }
        return grouped;
    },

    async searchPublicStores(
        query: string,
        options: MarketplacePageOptions = {},
    ): Promise<PublicStoreProfile[]> {
        const term = cleanText(query);
        if (!term) return [];
        const { from, to } = normalizePage(options);
        const escaped = term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
        const { data, error } = await supabase
            .from('public_store_profiles')
            .select(PUBLIC_STORE_PROFILE_SELECT)
            .ilike('display_name', `%${escaped}%`)
            .order('display_name', { ascending: true })
            .range(from, to);
        if (error) throw error;
        return (data ?? []).map((row) => mapPublicStoreProfile(parsePublicStoreProfile(row)));
    },

    async getBookOffers(listingId: string): Promise<GroupedBookResult> {
        const { data: seedData, error: seedError } = await supabase
            .from('marketplace_book_listings')
            .select(LISTING_SELECT)
            .eq('id', listingId)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .maybeSingle();
        if (seedError) throw seedError;
        if (!seedData) throw new Error('Public book listing not found.');
        const seed = parseMarketplaceListings([seedData])[0];

        let builder = supabase
            .from('marketplace_book_listings')
            .select(LISTING_SELECT)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .order('selling_price_minor', { ascending: true })
            .range(0, 49);
        if (seed.canonical_edition_id) {
            builder = builder.eq('canonical_edition_id', seed.canonical_edition_id);
        } else if (seed.isbn_13) {
            builder = builder.eq('isbn_13', seed.isbn_13);
        } else if (seed.isbn_10) {
            builder = builder.eq('isbn_10', seed.isbn_10);
        } else {
            builder = builder.eq('id', seed.id);
        }

        const { data, error } = await builder;
        if (error) throw error;
        const grouped = groupOffers(await mapRowsWithStoreNames(data));
        if (!grouped[0]) throw new Error('Public book offers not found.');
        return grouped[0];
    },

    async getPublicStoreProfile(storeId: string): Promise<PublicStoreProfile> {
        const { data, error } = await supabase
            .from('public_store_profiles')
            .select(PUBLIC_STORE_PROFILE_SELECT)
            .eq('store_id', storeId)
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Public store profile not found.');
        return mapPublicStoreProfile(parsePublicStoreProfile(data));
    },

    async getStoreListings(
        storeId: string,
        options: MarketplacePageOptions = {},
    ): Promise<MarketplaceListingOffer[]> {
        const { from, to } = normalizePage(options);
        const { data, error } = await supabase
            .from('marketplace_book_listings')
            .select(LISTING_SELECT)
            .eq('store_id', storeId)
            .eq('status', 'active')
            .eq('moderation_status', 'approved')
            .order('updated_at', { ascending: false })
            .range(from, to);
        if (error) throw error;
        return parseMarketplaceListings(data).map((row) => mapListing(row, null));
    },
};
