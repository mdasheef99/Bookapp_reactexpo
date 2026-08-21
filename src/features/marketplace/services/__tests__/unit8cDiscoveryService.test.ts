import { supabase } from '@/lib/supabase';
import { consumerDiscoveryService } from '../consumerDiscoveryService';

jest.mock('@/lib/supabase');

const storeId = '20000000-0000-4000-8000-000000000001';
const listingId = '10000000-0000-4000-8000-000000000001';

const store = {
    publicStoreId: storeId,
    displayName: 'Reader Lane Books',
    logo: null,
    locality: 'Camp',
    city: 'Pune',
    state: 'MH',
    pickup: true,
    delivery: false,
    returnPolicy: 'no_returns',
};

const titleGroup = {
    safeTitlePresentation: {
        originalTitle: 'The Bookshop',
        authors: ['Penelope Fitzgerald'],
        language: 'en',
        publicIsbn: '9780306406157',
        cover: '/placeholder.png',
    },
    offers: [{
        listingId,
        priceMinor: 35000,
        currency: 'INR',
        condition: 'good',
        hasDamage: false,
        publicDamageNote: null,
        damageTypes: [],
        availabilityStatus: 'available',
        fulfillmentOptions: ['pickup'],
        confirmationBeforePayment: true,
    }],
};

const q08 = {
    contractVersion: 'phase9-q08-v1',
    rankingVersion: 'phase9-q08-ranking-v1',
    bookstoreCount: 1,
    items: [{
        store,
        matchedBook: {
            matchContext: 'opaque-match-context',
            originalTitle: 'The Bookshop',
            authors: ['Penelope Fitzgerald'],
            language: 'en',
            publicIsbn: '9780306406157',
            cover: '/placeholder.png',
            boundedMatchKind: 'original_title_exact',
        },
        offerSummary: {
            offerCount: 1,
            lowestPriceMinor: 35000,
            currency: 'INR',
            conditionSummary: { best: 'good', worst: 'good', distinct: ['good'] },
            damageSummary: { hasUndamagedOffers: true, hasDamagedOffers: false },
            fulfillmentSummary: { pickupOfferCount: 1, deliveryOfferCount: 0 },
            availabilityBand: 'available',
            confirmationBeforePayment: true,
        },
    }],
    pageInfo: { nextCursor: null, hasNextPage: false },
};

const q09 = {
    contractVersion: 'q09-v1',
    storeProfile: {
        ...store,
        description: 'Independent bookseller',
        cover: null,
        operatingHours: {},
    },
    titleCount: 1,
    matchContextState: 'active',
    highlightedTitleGroup: titleGroup,
    titleGroups: [],
    pageInfo: { nextCursor: null, hasNextPage: false },
};

const q10 = {
    contractVersion: 'q10-v1', listingId,
    store: { ...store, description: 'Independent bookseller', cover: null },
    title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
    description: 'A public description', editionStatement: null, volume: null,
    format: 'paperback', isbn10: null, isbn13: '9780306406157',
    cover: '/placeholder.png', priceMinor: 35000, currency: 'INR', condition: 'good',
    hasDamage: false, publicDamageNote: null, damageTypes: [],
    availabilityStatus: 'available', fulfillmentOptions: ['pickup'],
    confirmationBeforePayment: true, gallery: [],
};

const completeOperatingHours = {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '17:00', closed: false },
    sunday: { open: null, close: null, closed: true },
    temporary_closure: false,
};

const rpc = supabase.rpc as jest.Mock;

describe('Unit 8C consumer discovery service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        rpc.mockImplementation(async (name: string) => ({
            data: name === 'phase9_bookstore_search_v1' ? q08
                : name === 'phase9_storefront_catalogue_v1' ? q09 : q10,
            error: null,
        }));
    });

    it('uses Q08 bookstore groups without client-side listing grouping', async () => {
        const page = await consumerDiscoveryService.searchBookstores('The Bookshop');
        expect(page.items[0].store.displayName).toBe('Reader Lane Books');
        expect(rpc).toHaveBeenCalledWith('phase9_bookstore_search_v1', {
            p_query: 'The Bookshop', p_page_size: 20, p_cursor: null,
            p_filters: null, p_locality: null,
        });
    });

    it('loads Q09 with the exact store/context/cursor binding', async () => {
        await expect(consumerDiscoveryService.getStorefrontCatalogue({
            storeId, matchContext: 'opaque-match-context', cursor: 'opaque-cursor', pageSize: 12,
        })).resolves.toMatchObject({ titleCount: 1, highlightedTitleGroup: titleGroup });
        expect(rpc).toHaveBeenCalledWith('phase9_storefront_catalogue_v1', {
            p_store_id: storeId, p_page_size: 12,
            p_cursor: 'opaque-cursor', p_match_context: 'opaque-match-context',
        });
    });

    it('loads Q10 and rejects recursive private/unknown fields', async () => {
        await expect(consumerDiscoveryService.getPublicListingDetail(listingId))
            .resolves.toMatchObject({ listingId, gallery: [] });
        rpc.mockResolvedValueOnce({ data: { ...q10, inventoryId: 'private' }, error: null });
        await expect(consumerDiscoveryService.getPublicListingDetail(listingId))
            .rejects.toThrow('Invalid public listing detail response');
    });

    it('accepts at most three ordered Q10 gallery entries and rejects order four', async () => {
        const gallery = [1, 2, 3].map((order) => ({
            url: `/approved-${order}.jpg`, role: 'actual_copy', order,
            width: 800, height: 1000,
        }));
        rpc.mockResolvedValueOnce({ data: { ...q10, gallery }, error: null });

        await expect(consumerDiscoveryService.getPublicListingDetail(listingId))
            .resolves.toMatchObject({ gallery });

        rpc.mockResolvedValueOnce({
            data: {
                ...q10,
                gallery: [...gallery, {
                    url: '/approved-4.jpg', role: 'actual_copy', order: 4,
                    width: 800, height: 1000,
                }],
            },
            error: null,
        });
        await expect(consumerDiscoveryService.getPublicListingDetail(listingId))
            .rejects.toThrow('Invalid public listing detail response');
    });

    it('accepts the frozen weekly operating-hours shape and rejects nested extras', async () => {
        rpc.mockResolvedValueOnce({
            data: {
                ...q09,
                storeProfile: { ...q09.storeProfile, operatingHours: completeOperatingHours },
            },
            error: null,
        });
        await expect(consumerDiscoveryService.getStorefrontCatalogue({ storeId }))
            .resolves.toMatchObject({ storeProfile: { operatingHours: completeOperatingHours } });

        rpc.mockResolvedValueOnce({
            data: {
                ...q09,
                storeProfile: {
                    ...q09.storeProfile,
                    operatingHours: {
                        ...completeOperatingHours,
                        monday: { ...completeOperatingHours.monday, internalNote: 'private' },
                    },
                },
            },
            error: null,
        });
        await expect(consumerDiscoveryService.getStorefrontCatalogue({ storeId }))
            .rejects.toThrow('Invalid public storefront response');
    });
});
