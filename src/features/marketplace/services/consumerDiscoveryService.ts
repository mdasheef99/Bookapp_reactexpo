import { supabase } from '@/lib/supabase';
import type { GroupedBookResult, MarketplaceListingOffer, PublicStoreProfile } from '../types';
import {
    cleanText,
    groupOffers,
    normalizePage,
    type MarketplacePageOptions,
} from './discoveryHelpers';
import {
    mapPublicStoreProfile,
    parsePublicStoreProfile,
    parseSafePublicationDtos,
    safePublicationDtoSchema,
    type SafePublicationDto,
} from './discoverySchemas';

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

function offerFromSafePublication(
    row: SafePublicationDto,
    storeDisplayName: string | null,
): MarketplaceListingOffer {
    const condition = row.condition === 'very_good'
        ? 'like_new'
        : row.condition === 'acceptable' ? 'fair' : row.condition;
    return {
        id: row.listingId,
        storeId: row.storeId,
        canonicalEditionId: null,
        publicTitle: row.title,
        publicAuthors: row.authors,
        publicCoverUrl: row.coverUrl,
        isbn10: row.isbn10,
        isbn13: row.isbn13,
        condition,
        publicConditionNotes: row.publicDamageNote,
        sellingPriceMinor: row.priceMinor,
        availabilityStatus: row.availabilityStatus,
        fulfillmentOptions: row.fulfillmentOptions,
        storeCity: null,
        storeLocalityName: null,
        pickupAvailable: row.fulfillmentOptions.includes('pickup'),
        deliveryAvailable: row.fulfillmentOptions.includes('delivery'),
        storeDisplayName,
    };
}

async function mapSafeRowsWithStoreNames(
    rows: SafePublicationDto[],
): Promise<MarketplaceListingOffer[]> {
    const storeIds = Array.from(new Set(rows.map((row) => row.storeId)));
    const names = await batchLoadStoreDisplayNames(storeIds);
    return rows.map((row) => offerFromSafePublication(row, names.get(row.storeId) ?? null));
}

async function safeSearch(query: string, storeId: string | null, pageSize: number) {
    const { data, error } = await supabase.rpc('phase9_public_listing_search_v2', {
        p_query: query || null,
        p_store_id: storeId,
        p_page_size: pageSize,
    });
    if (error) throw error;
    return parseSafePublicationDtos(data);
}

async function recordUnavailableSearch(query: string): Promise<void> {
    await supabase.rpc('record_marketplace_unavailable_search', { p_query: query });
}

export const consumerDiscoveryService = {
    async searchMarketplaceBooks(
        query: string,
        options: MarketplacePageOptions = {},
    ): Promise<GroupedBookResult[]> {
        const term = cleanText(query) ?? '';
        const { from, to } = normalizePage(options);
        const rows = await safeSearch(term, null, Math.min(50, to + 1));
        const grouped = groupOffers(await mapSafeRowsWithStoreNames(rows)).slice(from, to + 1);
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
        const { data, error } = await supabase.rpc('phase9_public_listing_detail_v2', {
            p_listing_id: listingId,
        });
        if (error) throw error;
        const parsed = safePublicationDtoSchema.safeParse(data);
        if (!parsed.success) throw new Error('Public book listing not found.');
        const seed = parsed.data;
        const related = await safeSearch(seed.isbn13 ?? seed.isbn10 ?? seed.title, null, 50);
        const matching = related.filter((row) => row.listingId === seed.listingId
            || (seed.isbn13 !== null && row.isbn13 === seed.isbn13)
            || (seed.isbn13 === null && seed.isbn10 !== null && row.isbn10 === seed.isbn10));
        const grouped = groupOffers(await mapSafeRowsWithStoreNames(matching.length ? matching : [seed]));
        const selected = grouped.find((group) => group.offers.some((offer) => offer.id === listingId));
        if (!selected) throw new Error('Public book offers not found.');
        return selected;
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
        const rows = (await safeSearch('', storeId, Math.min(50, to + 1))).slice(from, to + 1);
        return mapSafeRowsWithStoreNames(rows);
    },

    searchSafePublications(query = '', storeId: string | null = null) {
        return safeSearch(query, storeId, 20);
    },
};
