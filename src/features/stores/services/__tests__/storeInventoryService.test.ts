import { supabase } from '@/lib/supabase';
import { storeInventoryService } from '../storeInventoryService';
import type { ManualInventoryInput } from '../../types';

jest.mock('@/lib/supabase');

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
    });

    it('publishes only the owner-scoped inventory row and marks it listing-ready', async () => {
        const fetchBuilder = createBuilder({
            data: {
                id: 'inventory-1',
                title: 'The Bookshop',
                condition: 'good',
                quantity_available: 2,
                selling_price_minor: 35000,
            },
            error: null,
        });
        const updateBuilder = createBuilder({ data: { id: 'inventory-1' }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(fetchBuilder).mockReturnValueOnce(updateBuilder);

        await storeInventoryService.publishInventoryItem({ storeId: 'store-1', inventoryId: 'inventory-1' });

        expect(fetchBuilder.select).toHaveBeenCalledWith('id, title, condition, quantity_available, selling_price_minor');
        expect(fetchBuilder.eq).toHaveBeenCalledWith('store_id', 'store-1');
        expect(fetchBuilder.eq).toHaveBeenCalledWith('id', 'inventory-1');
        expect(updateBuilder.update).toHaveBeenCalledWith({
            visibility_status: 'published',
            listing_quality_status: 'ready',
        });
        expect(updateBuilder.eq).toHaveBeenCalledWith('store_id', 'store-1');
        expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'inventory-1');
    });

    it('rejects publish when required public listing fields are missing', async () => {
        const fetchBuilder = createBuilder({
            data: {
                id: 'inventory-1',
                title: 'The Bookshop',
                condition: 'good',
                quantity_available: 0,
                selling_price_minor: 35000,
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(fetchBuilder);

        await expect(storeInventoryService.publishInventoryItem({
            storeId: 'store-1',
            inventoryId: 'inventory-1',
        })).rejects.toThrow('Available quantity is required before publishing.');

        expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('pauses a published inventory row through store-scoped filters', async () => {
        const builder = createBuilder({ data: { id: 'inventory-1' }, error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await storeInventoryService.pauseInventoryItem({ storeId: 'store-1', inventoryId: 'inventory-1' });

        expect(builder.update).toHaveBeenCalledWith({ visibility_status: 'paused' });
        expect(builder.eq).toHaveBeenCalledWith('store_id', 'store-1');
        expect(builder.eq).toHaveBeenCalledWith('id', 'inventory-1');
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
        const builder = createBuilder({
            data: [{
                id: 'listing-1',
                store_id: 'store-1',
                public_title: 'The Bookshop',
                public_authors: ['Penelope Fitzgerald'],
                selling_price_minor: 35000,
                condition: 'good',
                status: 'active',
            }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(storeInventoryService.searchPublicListings('bookshop')).resolves.toEqual([
            expect.not.objectContaining({
                shelf_location: expect.anything(),
                acquisition_cost_minor: expect.anything(),
                internal_notes: expect.anything(),
                metadata_confidence: expect.anything(),
            }),
        ]);

        expect(supabase.from).toHaveBeenCalledWith('marketplace_book_listings');
        expect(supabase.from).not.toHaveBeenCalledWith('store_inventory');
        expect(builder.eq).toHaveBeenCalledWith('status', 'active');
        expect(builder.eq).toHaveBeenCalledWith('moderation_status', 'approved');
    });

    it('groups same ISBN public listings across stores without exposing inventory internals', async () => {
        const builder = createBuilder({
            data: [
                {
                    id: 'listing-1',
                    store_id: 'store-1',
                    canonical_edition_id: 'edition-1',
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    public_cover_url: 'https://covers.example/bookshop.jpg',
                    isbn_13: '9780006543541',
                    selling_price_minor: 35000,
                    condition: 'good',
                    status: 'active',
                    moderation_status: 'approved',
                },
                {
                    id: 'listing-2',
                    store_id: 'store-2',
                    canonical_edition_id: 'edition-1',
                    public_title: 'The Bookshop',
                    public_authors: ['Penelope Fitzgerald'],
                    isbn_13: '9780006543541',
                    selling_price_minor: 42000,
                    condition: 'like_new',
                    status: 'active',
                    moderation_status: 'approved',
                    internal_notes: 'private',
                },
            ],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(storeInventoryService.searchPublicBookResults('bookshop')).resolves.toEqual([
            {
                groupingKey: 'edition:edition-1',
                title: 'The Bookshop',
                authors: ['Penelope Fitzgerald'],
                isbn13: '9780006543541',
                coverUrl: 'https://covers.example/bookshop.jpg',
                offerCount: 2,
                lowestPriceMinor: 35000,
                offers: [
                    expect.objectContaining({ id: 'listing-1', store_id: 'store-1' }),
                    expect.not.objectContaining({ internal_notes: expect.anything() }),
                ],
            },
        ]);
    });

    it('escapes wildcard characters before applying ilike search', async () => {
        const builder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await storeInventoryService.searchPublicListings('100%_book');

        expect(builder.ilike).toHaveBeenCalledWith('public_title', '%100\\%\\_book%');
    });

    it('returns no grouped results for an empty public listing response', async () => {
        const builder = createBuilder({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await expect(storeInventoryService.searchPublicBookResults('missing')).resolves.toEqual([]);
    });
});
