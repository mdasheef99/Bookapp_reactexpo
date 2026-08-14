import { supabase } from '@/lib/supabase';
import { storeInventoryService } from '../storeInventoryService';
import type { ManualInventoryInput } from '../../types';
import { publicationService } from '@/features/imageInventory/api/publicationService';
import { consumerDiscoveryService } from '@/features/marketplace/services/consumerDiscoveryService';

jest.mock('@/lib/supabase');
jest.mock('@/features/imageInventory/api/publicationService');
jest.mock('@/features/marketplace/services/consumerDiscoveryService');

function createBuilder(response: { data: unknown; error: Error | null }) {
    const builder: any = {
        select: jest.fn(() => builder),
        insert: jest.fn(() => builder),
        update: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        ilike: jest.fn(() => builder),
        or: jest.fn(() => builder),
        order: jest.fn(() => builder),
        limit: jest.fn(() => builder),
        range: jest.fn(() => builder),
        single: jest.fn(() => Promise.resolve(response)),
        maybeSingle: jest.fn(() => Promise.resolve(response)),
        then: jest.fn((resolve: any) => resolve(response)),
    };
    return builder;
}

const manualInput: ManualInventoryInput = {
    storeId: 'store-1',
    title: 'The Bookshop',
    authors: ['Penelope Fitzgerald'],
    isbn13: '9780006543541',
    condition: 'good',
    quantityAvailable: 2,
    sellingPriceMinor: 35000,
    publicNotes: 'Clean copy',
    shelfLocation: 'A3',
    acquisitionCostMinor: 12000,
    internalNotes: 'Bought from estate sale',
    visibilityStatus: 'draft',
};

function safePublication(overrides: Record<string, unknown> = {}) {
    return {
        listingId: '20000000-0000-4000-8000-000000000001',
        storeId: '20000000-0000-4000-8000-000000000002',
        title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
        description: null, editionStatement: null, volume: null, format: null,
        isbn10: null, isbn13: '9780006543541', condition: 'good', hasDamage: false,
        publicDamageNote: null, damageTypes: [], priceMinor: 35000, currency: 'INR',
        availabilityStatus: 'available', coverUrl: 'https://covers.example/bookshop.jpg',
        publicMediaCount: 0, fulfillmentOptions: [], status: 'active',
        moderationStatus: 'approved', qualityStatus: 'ready',
        friendlyInventoryFreshnessSignal: 'recent', ...overrides,
    };
}

describe('storeInventoryService.createManualInventoryItem', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates a manual store inventory row with private fields stored only in store_inventory', async () => {
        const builder = createBuilder({
            data: { id: 'inventory-1', ...manualInput, entry_method: 'manual' },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(storeInventoryService.createManualInventoryItem(manualInput)).resolves.toEqual(
            expect.objectContaining({ id: 'inventory-1' }),
        );

        expect(supabase.from).toHaveBeenCalledWith('store_inventory');
        expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
            store_id: 'store-1',
            title: 'The Bookshop',
            authors: ['Penelope Fitzgerald'],
            isbn_13: '9780006543541',
            condition: 'good',
            quantity_available: 2,
            selling_price_minor: 35000,
            shelf_location: 'A3',
            acquisition_cost_minor: 12000,
            internal_notes: 'Bought from estate sale',
            entry_method: 'manual',
        }));
    });

    it('rejects invalid manual inventory before writing to Supabase', async () => {
        await expect(storeInventoryService.createManualInventoryItem({
            ...manualInput,
            title: '',
        })).rejects.toThrow('Title is required.');

        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe('storeInventoryService.findPotentialDuplicates', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('searches same-store duplicates by ISBN before title-author fallback', async () => {
        const builder = createBuilder({
            data: [{ id: 'inventory-1', title: 'The Bookshop', isbn_13: '9780006543541' }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(storeInventoryService.findPotentialDuplicates({
            storeId: 'store-1',
            isbn13: '9780006543541',
            title: 'The Bookshop',
            authors: ['Penelope Fitzgerald'],
        })).resolves.toHaveLength(1);

        expect(builder.eq).toHaveBeenCalledWith('store_id', 'store-1');
        expect(builder.eq).toHaveBeenCalledWith('isbn_13', '9780006543541');
    });
});

describe('storeInventoryService inventory publishing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (publicationService.readStatus as jest.Mock).mockResolvedValue({
            inventoryId: 'inventory-1', inventoryVersion: 4,
            publicationIntentVersion: 2,
        });
        (publicationService.setState as jest.Mock).mockResolvedValue({ outcome: 'published' });
    });

    it('U7B-RT16 delegates legacy publish to the controlled version-fenced command', async () => {
        await storeInventoryService.publishInventoryItem({ storeId: 'store-1', inventoryId: 'inventory-1' });

        expect(publicationService.readStatus).toHaveBeenCalledWith('inventory-1');
        expect(publicationService.setState).toHaveBeenCalledWith(expect.objectContaining({
            inventoryId: 'inventory-1', expectedInventoryVersion: 4,
            expectedPublicationIntentVersion: 2, intent: 'publish',
        }));
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('surfaces deterministic controlled-boundary publication rejection', async () => {
        (publicationService.setState as jest.Mock).mockRejectedValue(new Error('P9_PUBLICATION_INELIGIBLE:stock'));
        await expect(storeInventoryService.publishInventoryItem({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
        })).rejects.toThrow('P9_PUBLICATION_INELIGIBLE:stock');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('U7B-RT16 delegates legacy pause to the controlled version-fenced command', async () => {
        await storeInventoryService.pauseInventoryItem({ storeId: 'store-1', inventoryId: 'inventory-1' });

        expect(publicationService.setState).toHaveBeenCalledWith(expect.objectContaining({
            inventoryId: 'inventory-1', expectedInventoryVersion: 4,
            expectedPublicationIntentVersion: 2, intent: 'pause',
        }));
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('edits public listing fields without accepting private consumer projection fields', async () => {
        const builder = createBuilder({ data: { id: 'inventory-1' }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await storeInventoryService.updateInventoryItem({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
            sellingPriceMinor: 42500,
            quantityAvailable: 3,
            condition: 'like_new',
            publicNotes: 'Signed first owner copy',
        });

        expect(builder.update).toHaveBeenCalledWith({
            selling_price_minor: 42500,
            quantity_available: 3,
            quantity_total: 3,
            condition: 'like_new',
            public_notes: 'Signed first owner copy',
        });
    });

    it('rejects negative quantity edits before writing to Supabase', async () => {
        await expect(storeInventoryService.updateInventoryItem({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
            quantityAvailable: -1,
        })).rejects.toThrow('Quantity cannot be negative.');

        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe('storeInventoryService.searchPublicListings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reads consumer listings from the public projection only', async () => {
        (consumerDiscoveryService.searchSafePublications as jest.Mock).mockResolvedValue([safePublication()]);

        await expect(storeInventoryService.searchPublicListings('bookshop')).resolves.toEqual([
            expect.not.objectContaining({
                shelf_location: expect.anything(),
                acquisition_cost_minor: expect.anything(),
                internal_notes: expect.anything(),
                metadata_confidence: expect.anything(),
            }),
        ]);

        expect(consumerDiscoveryService.searchSafePublications).toHaveBeenCalledWith('bookshop');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('groups same ISBN public listings across stores without exposing inventory internals', async () => {
        (consumerDiscoveryService.searchSafePublications as jest.Mock).mockResolvedValue([
            safePublication(),
            safePublication({ listingId: '20000000-0000-4000-8000-000000000002',
                storeId: '20000000-0000-4000-8000-000000000003', priceMinor: 42000 }),
        ]);

        await expect(storeInventoryService.searchPublicBookResults('bookshop')).resolves.toEqual([
            {
                groupingKey: 'isbn13:9780006543541',
                title: 'The Bookshop',
                authors: ['Penelope Fitzgerald'],
                isbn13: '9780006543541',
                coverUrl: 'https://covers.example/bookshop.jpg',
                offerCount: 2,
                lowestPriceMinor: 35000,
                offers: [
                    expect.objectContaining({ id: '20000000-0000-4000-8000-000000000001', store_id: '20000000-0000-4000-8000-000000000002' }),
                    expect.not.objectContaining({ internal_notes: expect.anything() }),
                ],
            },
        ]);
    });

    it('passes wildcard text as an RPC value rather than a query-language fragment', async () => {
        (consumerDiscoveryService.searchSafePublications as jest.Mock).mockResolvedValue([]);
        await storeInventoryService.searchPublicListings('100%_book');

        expect(consumerDiscoveryService.searchSafePublications).toHaveBeenCalledWith('100%_book');
    });

    it('returns no grouped results for an empty public listing response', async () => {
        (consumerDiscoveryService.searchSafePublications as jest.Mock).mockResolvedValue([]);

        await expect(storeInventoryService.searchPublicBookResults('missing')).resolves.toEqual([]);
    });
});
