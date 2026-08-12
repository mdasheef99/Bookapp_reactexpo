import { supabase } from '@/lib/supabase';
import { consumerDiscoveryService } from '../consumerDiscoveryService';
import { parseSafePublicationDtos } from '../discoverySchemas';

jest.mock('@/lib/supabase');

const listingId = '10000000-0000-4000-8000-000000000001';
const storeId = '20000000-0000-4000-8000-000000000001';

function safePublication(overrides: Record<string, unknown> = {}) {
    return {
        listingId, storeId, title: 'The Bookshop', authors: ['Penelope Fitzgerald'],
        language: 'en', description: 'A public description', editionStatement: null,
        volume: null, format: 'paperback', isbn10: null, isbn13: '9780006543541',
        condition: 'good', hasDamage: false, publicDamageNote: null, damageTypes: [],
        priceMinor: 35000, currency: 'INR', availabilityStatus: 'available',
        coverUrl: 'https://covers.example/bookshop.jpg', publicMediaCount: 0,
        fulfillmentOptions: ['pickup'], status: 'active', moderationStatus: 'approved',
        qualityStatus: 'ready', friendlyInventoryFreshnessSignal: 'recent',
        ...overrides,
    };
}

function publicStore(overrides: Record<string, unknown> = {}) {
    return {
        store_id: storeId, display_name: 'Reader Lane Books', description: null,
        logo_url: null, cover_url: null, city: 'Pune', state: 'MH', locality_name: 'Camp',
        operating_hours: {}, pickup_enabled: true, delivery_enabled: false,
        return_policy_type: 'no_returns', ...overrides,
    };
}

function builder(response: { data: unknown; error: Error | null }) {
    const value: any = {
        select: jest.fn(() => value), in: jest.fn(() => value), ilike: jest.fn(() => value),
        order: jest.fn(() => value), range: jest.fn(() => value), eq: jest.fn(() => value),
        maybeSingle: jest.fn(() => Promise.resolve(response)),
        then: jest.fn((resolve: (next: unknown) => unknown) => resolve(response)),
    };
    return value;
}

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;

describe('consumerDiscoveryService safe Unit 7B boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        rpc.mockImplementation(async (name: string) => {
            if (name === 'phase9_public_listing_search_v2') {
                return { data: [safePublication()], error: null };
            }
            if (name === 'phase9_public_listing_detail_v2') {
                return { data: safePublication(), error: null };
            }
            return { data: null, error: null };
        });
        from.mockReturnValue(builder({
            data: [{ store_id: storeId, display_name: 'Reader Lane Books' }], error: null,
        }));
    });

    it('U7B-RT13 client decoder accepts only the frozen safe publication DTO', () => {
        expect(parseSafePublicationDtos([safePublication()])).toHaveLength(1);
        expect(() => parseSafePublicationDtos([{
            ...safePublication(), quantityAvailable: 2, shelfLocation: 'A3', internalNotes: 'private',
        }])).toThrow('Invalid public publication response');
    });

    it('search reads the safe RPC and never the listing or inventory base table', async () => {
        const results = await consumerDiscoveryService.searchMarketplaceBooks('bookshop');
        expect(results).toHaveLength(1);
        expect(rpc).toHaveBeenCalledWith('phase9_public_listing_search_v2', {
            p_query: 'bookshop', p_store_id: null, p_page_size: 20,
        });
        expect(from).not.toHaveBeenCalledWith('marketplace_book_listings');
        expect(from).not.toHaveBeenCalledWith('store_inventory');
    });

    it('passes wildcard and filter grammar as a bounded RPC value', async () => {
        await consumerDiscoveryService.searchMarketplaceBooks('Dune),status.eq.pending%_');
        expect(rpc).toHaveBeenCalledWith('phase9_public_listing_search_v2', expect.objectContaining({
            p_query: 'Dune),status.eq.pending%_',
        }));
    });

    it('uses bounded RPC pagination and slices the requested page', async () => {
        rpc.mockResolvedValueOnce({ data: Array.from({ length: 40 }, (_, index) => safePublication({
            listingId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        })), error: null });
        const results = await consumerDiscoveryService.searchMarketplaceBooks('', { page: 2, pageSize: 20 });
        expect(rpc).toHaveBeenCalledWith('phase9_public_listing_search_v2', expect.objectContaining({ p_page_size: 40 }));
        expect(results.reduce((total, group) => total + group.offerCount, 0)).toBe(20);
    });

    it('groups safe offers by ISBN without collapsing store offers', async () => {
        rpc.mockResolvedValueOnce({ data: [safePublication(), safePublication({
            listingId: '10000000-0000-4000-8000-000000000002',
            storeId: '20000000-0000-4000-8000-000000000002', priceMinor: 42000,
        })], error: null });
        const results = await consumerDiscoveryService.searchMarketplaceBooks('bookshop');
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            groupingKey: 'isbn13:9780006543541', offerCount: 2, lowestPriceMinor: 35000,
        });
    });

    it('records only a bounded unavailable-search signal after an empty safe result', async () => {
        rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: null, error: null });
        await expect(consumerDiscoveryService.searchMarketplaceBooks('missing')).resolves.toEqual([]);
        expect(rpc).toHaveBeenLastCalledWith('record_marketplace_unavailable_search', { p_query: 'missing' });
    });

    it('propagates safe RPC failures and rejects malformed DTO rows', async () => {
        rpc.mockResolvedValueOnce({ data: null, error: new Error('safe search failed') });
        await expect(consumerDiscoveryService.searchMarketplaceBooks('book')).rejects.toThrow('safe search failed');
        rpc.mockResolvedValueOnce({ data: [{ listingId }], error: null });
        await expect(consumerDiscoveryService.searchMarketplaceBooks('broken')).rejects.toThrow(
            'Invalid public publication response',
        );
    });

    it('loads public display names only from the public store profile boundary', async () => {
        await consumerDiscoveryService.searchMarketplaceBooks('bookshop');
        expect(from).toHaveBeenCalledWith('public_store_profiles');
        expect(from).not.toHaveBeenCalledWith('stores');
    });

    it('gets a safe listing detail then related safe offers', async () => {
        const result = await consumerDiscoveryService.getBookOffers(listingId);
        expect(rpc).toHaveBeenNthCalledWith(1, 'phase9_public_listing_detail_v2', {
            p_listing_id: listingId,
        });
        expect(rpc).toHaveBeenNthCalledWith(2, 'phase9_public_listing_search_v2', expect.objectContaining({
            p_query: '9780006543541',
        }));
        expect(result.offers[0].id).toBe(listingId);
    });

    it('gets store listings through the safe RPC store parameter', async () => {
        await consumerDiscoveryService.getStoreListings(storeId);
        expect(rpc).toHaveBeenCalledWith('phase9_public_listing_search_v2', {
            p_query: null, p_store_id: storeId, p_page_size: 20,
        });
        expect(from).not.toHaveBeenCalledWith('marketplace_book_listings');
    });
});

describe('consumerDiscoveryService public store boundary', () => {
    beforeEach(() => jest.clearAllMocks());

    it('searches and reads only public_store_profiles', async () => {
        const searchBuilder = builder({ data: [publicStore()], error: null });
        from.mockReturnValue(searchBuilder);
        const stores = await consumerDiscoveryService.searchPublicStores('Reader Lane');
        expect(from).toHaveBeenCalledWith('public_store_profiles');
        expect(searchBuilder.ilike).toHaveBeenCalledWith('display_name', '%Reader Lane%');
        expect(stores[0].displayName).toBe('Reader Lane Books');

        const detailBuilder = builder({ data: publicStore(), error: null });
        from.mockReturnValue(detailBuilder);
        await expect(consumerDiscoveryService.getPublicStoreProfile(storeId)).resolves.toMatchObject({
            storeId, displayName: 'Reader Lane Books',
        });
        expect(from).not.toHaveBeenCalledWith('stores');
    });
});
