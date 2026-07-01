import { supabase } from '@/lib/supabase';
import { consumerDiscoveryService } from '../consumerDiscoveryService';

jest.mock('@/lib/supabase');

/**
 * Test builder that records filter calls and returns a configurable response.
 * Mirrors the pattern in storeInventoryService.test.ts but adds `in` support
 * for batch store-profile lookups.
 */
function createBuilder(response: { data: unknown; error: Error | null }) {
    const builder: any = {
        select: jest.fn(() => builder),
        insert: jest.fn(() => builder),
        update: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        neq: jest.fn(() => builder),
        ilike: jest.fn(() => builder),
        or: jest.fn(() => builder),
        in: jest.fn(() => builder),
        order: jest.fn(() => builder),
        limit: jest.fn(() => builder),
        range: jest.fn(() => builder),
        single: jest.fn(() => Promise.resolve(response)),
        maybeSingle: jest.fn(() => Promise.resolve(response)),
        then: jest.fn((resolve: any) => resolve(response)),
    };
    return builder;
}

describe('consumerDiscoveryService.searchMarketplaceBooks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reads from marketplace_book_listings, never store_inventory', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('');

        expect(supabase.from).toHaveBeenCalledWith('marketplace_book_listings');
        expect(supabase.from).not.toHaveBeenCalledWith('store_inventory');
    });

    it('select list excludes private inventory fields', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('');

        const selectArg = listingsBuilder.select.mock.calls[0][0] as string;
        // Public projection fields must be present
        expect(selectArg).toContain('id');
        expect(selectArg).toContain('store_id');
        expect(selectArg).toContain('public_title');
        expect(selectArg).toContain('selling_price_minor');
        expect(selectArg).toContain('fulfillment_options');
        expect(selectArg).toContain('store_city');
        expect(selectArg).toContain('pickup_available');
        expect(selectArg).toContain('delivery_available');
        // Private fields must NOT be present
        expect(selectArg).not.toContain('shelf_location');
        expect(selectArg).not.toContain('acquisition_cost_minor');
        expect(selectArg).not.toContain('internal_notes');
        expect(selectArg).not.toContain('metadata_confidence');
        expect(selectArg).not.toContain('duplicate_resolution_state');
        expect(selectArg).not.toContain('extraction_session_id');
    });

    it('filters by status active and moderation approved', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('');

        expect(listingsBuilder.eq).toHaveBeenCalledWith('status', 'active');
        expect(listingsBuilder.eq).toHaveBeenCalledWith('moderation_status', 'approved');
    });

    it('uses exact eq match for ISBN search, not ilike', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('9780006543541');

        // ISBN should use eq, not ilike
        expect(listingsBuilder.eq).toHaveBeenCalledWith('isbn_13', '9780006543541');
        expect(listingsBuilder.ilike).not.toHaveBeenCalledWith('isbn_13', expect.anything());
    });

    it('uses isbn_10 for 10-character ISBN searches', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('0-8044-2957-X');

        expect(listingsBuilder.eq).toHaveBeenCalledWith('isbn_10', '080442957X');
        expect(listingsBuilder.eq).not.toHaveBeenCalledWith('isbn_13', '080442957X');
        expect(listingsBuilder.ilike).not.toHaveBeenCalled();
    });

    it('uses ilike for title search with escaped wildcards', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('100%_book');

        expect(listingsBuilder.ilike).toHaveBeenCalledWith('public_title', '%100\\%\\_book%');
    });

    it('groups same canonical edition across stores without collapsing offers', async () => {
        const listingsBuilder = createBuilder({
            data: [
                {
                    id: 'listing-1',
                    store_id: 'store-1',
                    canonical_edition_id: 'edition-1',
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    public_cover_url: 'https://covers.example/bookshop.jpg',
                    isbn_13: '9780006543541',
                    condition: 'good',
                    selling_price_minor: 35000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['pickup'],
                    store_city: 'Bengaluru',
                    store_locality_name: 'Indiranagar',
                    pickup_available: true,
                    delivery_available: false,
                },
                {
                    id: 'listing-2',
                    store_id: 'store-2',
                    canonical_edition_id: 'edition-1',
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    isbn_13: '9780006543541',
                    condition: 'like_new',
                    selling_price_minor: 42000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['pickup', 'delivery'],
                    store_city: 'Bengaluru',
                    store_locality_name: 'Koramangala',
                    pickup_available: true,
                    delivery_available: true,
                },
            ],
            error: null,
        });
        const profileBuilder = createBuilder({
            data: [
                { store_id: 'store-1', display_name: 'Bookstore A' },
                { store_id: 'store-2', display_name: 'Bookstore B' },
            ],
            error: null,
        });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(listingsBuilder)
            .mockReturnValueOnce(profileBuilder);

        const results = await consumerDiscoveryService.searchMarketplaceBooks('bookshop');

        expect(results).toHaveLength(1);
        expect(results[0].groupingKey).toBe('edition:edition-1');
        expect(results[0].offerCount).toBe(2);
        expect(results[0].lowestPriceMinor).toBe(35000);
        // Both offers must be present (not collapsed to cheapest)
        expect(results[0].offers).toHaveLength(2);
        expect(results[0].offers[0].storeDisplayName).toBe('Bookstore A');
        expect(results[0].offers[1].storeDisplayName).toBe('Bookstore B');
    });

    it('falls back to ISBN-13 grouping when canonical edition is null', async () => {
        const listingsBuilder = createBuilder({
            data: [
                {
                    id: 'listing-1',
                    store_id: 'store-1',
                    canonical_edition_id: null,
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    isbn_13: '9780006543541',
                    condition: 'good',
                    selling_price_minor: 35000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['pickup'],
                    store_city: 'Bengaluru',
                    store_locality_name: 'Indiranagar',
                    pickup_available: true,
                    delivery_available: false,
                },
                {
                    id: 'listing-2',
                    store_id: 'store-2',
                    canonical_edition_id: null,
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    isbn_13: '9780006543541',
                    condition: 'like_new',
                    selling_price_minor: 42000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['delivery'],
                    store_city: 'Mysuru',
                    store_locality_name: null,
                    pickup_available: false,
                    delivery_available: true,
                },
            ],
            error: null,
        });
        const profileBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(listingsBuilder)
            .mockReturnValueOnce(profileBuilder);

        const results = await consumerDiscoveryService.searchMarketplaceBooks('bookshop');

        expect(results).toHaveLength(1);
        expect(results[0].groupingKey).toBe('isbn13:9780006543541');
        expect(results[0].offerCount).toBe(2);
    });

    it('falls back to normalized title/authors grouping when edition and ISBN are null', async () => {
        const listingsBuilder = createBuilder({
            data: [
                {
                    id: 'listing-1',
                    store_id: 'store-1',
                    canonical_edition_id: null,
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    isbn_13: null,
                    condition: 'good',
                    selling_price_minor: 35000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['pickup'],
                    store_city: 'Bengaluru',
                    store_locality_name: null,
                    pickup_available: true,
                    delivery_available: false,
                },
                {
                    id: 'listing-2',
                    store_id: 'store-2',
                    canonical_edition_id: null,
                    public_title: 'The  Bookshop',
                    public_authors: [' Penelope Fitzgerald '],
                    isbn_13: null,
                    condition: 'like_new',
                    selling_price_minor: 42000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['delivery'],
                    store_city: 'Bengaluru',
                    store_locality_name: null,
                    pickup_available: false,
                    delivery_available: true,
                },
            ],
            error: null,
        });
        const profileBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(listingsBuilder)
            .mockReturnValueOnce(profileBuilder);

        const results = await consumerDiscoveryService.searchMarketplaceBooks('bookshop');

        expect(results).toHaveLength(1);
        expect(results[0].groupingKey).toContain('title:');
        expect(results[0].groupingKey).toBe('title:the bookshop|penelope fitzgerald');
        expect(results[0].offerCount).toBe(2);
    });

    it('returns empty array for empty query without exposing customer identity', async () => {
        const listingsBuilder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        const results = await consumerDiscoveryService.searchMarketplaceBooks('');

        expect(results).toEqual([]);
        // No auth.uid or user-identifying writes
        expect(listingsBuilder.insert).not.toHaveBeenCalled();
        expect(listingsBuilder.update).not.toHaveBeenCalled();
    });

    it('batch-loads public_store_profiles for store display names, not stores table', async () => {
        const listingsBuilder = createBuilder({
            data: [
                {
                    id: 'listing-1',
                    store_id: 'store-1',
                    canonical_edition_id: 'edition-1',
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    isbn_13: '9780006543541',
                    condition: 'good',
                    selling_price_minor: 35000,
                    availability_status: 'confirmation_required',
                    fulfillment_options: ['pickup'],
                    store_city: 'Bengaluru',
                    store_locality_name: 'Indiranagar',
                    pickup_available: true,
                    delivery_available: false,
                },
            ],
            error: null,
        });
        const profileBuilder = createBuilder({
            data: [{ store_id: 'store-1', display_name: 'Bookstore A' }],
            error: null,
        });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(listingsBuilder)
            .mockReturnValueOnce(profileBuilder);

        await consumerDiscoveryService.searchMarketplaceBooks('bookshop');

        // Second call must be public_store_profiles, not stores
        expect(supabase.from).toHaveBeenNthCalledWith(2, 'public_store_profiles');
        expect(supabase.from).not.toHaveBeenCalledWith('stores');
        expect(profileBuilder.in).toHaveBeenCalledWith('store_id', ['store-1']);
    });

    it('throws Supabase listing errors to the caller', async () => {
        const listingsBuilder = createBuilder({ data: null, error: new Error('listing query failed') });
        (supabase.from as jest.Mock).mockReturnValueOnce(listingsBuilder);

        await expect(consumerDiscoveryService.searchMarketplaceBooks('bookshop')).rejects.toThrow('listing query failed');
    });

    it('throws store display name lookup errors to the caller', async () => {
        const listingsBuilder = createBuilder({
            data: [{
                id: 'listing-1',
                store_id: 'store-1',
                public_title: 'The Bookshop',
                condition: 'good',
                selling_price_minor: 35000,
                availability_status: 'confirmation_required',
                fulfillment_options: ['pickup'],
                pickup_available: true,
                delivery_available: false,
            }],
            error: null,
        });
        const profileBuilder = createBuilder({ data: null, error: new Error('profile lookup failed') });
        (supabase.from as jest.Mock)
            .mockReturnValueOnce(listingsBuilder)
            .mockReturnValueOnce(profileBuilder);

        await expect(consumerDiscoveryService.searchMarketplaceBooks('bookshop')).rejects.toThrow('profile lookup failed');
    });
});

describe('consumerDiscoveryService.getPublicStoreProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reads public_store_profiles only, not stores table', async () => {
        const builder = createBuilder({
            data: {
                store_id: 'store-1',
                display_name: 'Bookstore A',
                description: 'A cozy bookstore',
                logo_url: null,
                cover_url: null,
                city: 'Bengaluru',
                state: 'Karnataka',
                locality_name: 'Indiranagar',
                operating_hours: {},
                pickup_enabled: true,
                delivery_enabled: false,
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const profile = await consumerDiscoveryService.getPublicStoreProfile('store-1');

        expect(supabase.from).toHaveBeenCalledWith('public_store_profiles');
        expect(supabase.from).not.toHaveBeenCalledWith('stores');
        expect(profile.storeId).toBe('store-1');
        expect(profile.displayName).toBe('Bookstore A');
        expect(profile.pickupEnabled).toBe(true);
        expect(profile.deliveryEnabled).toBe(false);
    });

    it('select list excludes private store fields', async () => {
        const builder = createBuilder({
            data: { store_id: 'store-1', display_name: 'Bookstore A' },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await consumerDiscoveryService.getPublicStoreProfile('store-1');

        const selectArg = builder.select.mock.calls[0][0] as string;
        expect(selectArg).toContain('store_id');
        expect(selectArg).toContain('display_name');
        expect(selectArg).toContain('pickup_enabled');
        expect(selectArg).toContain('delivery_enabled');
        // Private fields must NOT be present
        expect(selectArg).not.toContain('pincode');
        expect(selectArg).not.toContain('legal_name');
        expect(selectArg).not.toContain('legal_seller_name');
        expect(selectArg).not.toContain('minimum_delivery_order_value_minor');
        expect(selectArg).not.toContain('return_policy_type');
        expect(selectArg).not.toContain('payout_account_status');
        expect(selectArg).not.toContain('suspension_reason');
    });

    it('throws when public store profile is not found', async () => {
        const builder = createBuilder({ data: null, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(consumerDiscoveryService.getPublicStoreProfile('missing-store')).rejects.toThrow();
    });
});

describe('consumerDiscoveryService.getStoreListings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reads marketplace_book_listings filtered by store_id', async () => {
        const builder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await consumerDiscoveryService.getStoreListings('store-1');

        expect(supabase.from).toHaveBeenCalledWith('marketplace_book_listings');
        expect(builder.eq).toHaveBeenCalledWith('store_id', 'store-1');
        expect(builder.eq).toHaveBeenCalledWith('status', 'active');
        expect(builder.eq).toHaveBeenCalledWith('moderation_status', 'approved');
    });

    it('throws Supabase errors when store listings fail to load', async () => {
        const builder = createBuilder({ data: null, error: new Error('store listings failed') });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(consumerDiscoveryService.getStoreListings('store-1')).rejects.toThrow('store listings failed');
    });
});
