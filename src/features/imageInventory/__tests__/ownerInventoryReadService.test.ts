import { supabase } from '@/lib/supabase';
import {
    OWNER_INVENTORY_RPC_NAME,
    OwnerInventoryReadError,
    ownerInventoryReadService,
} from '../api/ownerInventoryReadService';

jest.mock('@/lib/supabase');

const item = {
    id: '10000000-0000-4000-8000-000000000001',
    store_id: '20000000-0000-4000-8000-000000000001',
    title: 'The Bookshop',
    authors: ['Penelope Fitzgerald'],
    isbn_10: null,
    isbn_13: '9780006543541',
    condition: 'good',
    quantity_available: 2,
    selling_price_minor: 35000,
    visibility_status: 'draft',
    listing_quality_status: 'ready',
    public_notes: null,
    shelf_location: 'A3',
    entry_method: 'manual',
    created_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-03T10:00:00.000Z',
    version: 4,
} as const;

const page = {
    contractVersion: 'phase9-owner-inventory-v1',
    items: [item],
    pageInfo: {
        nextCursor: 'opaque.server.cursor.signature',
        hasMore: true,
    },
};

const mappedPage = {
    contractVersion: 'phase9-owner-inventory-v1',
    items: [{
        id: item.id,
        storeId: item.store_id,
        title: item.title,
        authors: item.authors,
        isbn10: item.isbn_10,
        isbn13: item.isbn_13,
        condition: item.condition,
        quantityAvailable: item.quantity_available,
        sellingPriceMinor: item.selling_price_minor,
        visibilityStatus: item.visibility_status,
        listingQualityStatus: item.listing_quality_status,
        publicNotes: item.public_notes,
        shelfLocation: item.shelf_location,
        entryMethod: item.entry_method,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        version: item.version,
    }],
    pageInfo: page.pageInfo,
};

const rpc = supabase.rpc as jest.Mock;

describe('ownerInventoryReadService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        rpc.mockResolvedValue({ data: page, error: null });
    });

    it('calls the exact WU1 RPC with bounded defaults and no client store authority', async () => {
        await expect(ownerInventoryReadService.listPage()).resolves.toEqual(mappedPage);

        expect(rpc).toHaveBeenCalledWith(OWNER_INVENTORY_RPC_NAME, {
            p_page_size: 25,
            p_cursor: null,
            p_query: null,
            p_condition: null,
            p_visibility_status: null,
            p_quantity_state: null,
            p_entry_method: null,
            p_date_added: null,
        });
        expect(rpc.mock.calls[0][1]).not.toHaveProperty('store_id');
        expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_store_id');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('maps every supported filter and forwards the cursor without inspecting it', async () => {
        await ownerInventoryReadService.listPage({
            pageSize: 50,
            cursor: 'opaque/+server==.signature',
            filters: {
                query: '  Bookshop  ',
                condition: 'very_good',
                visibilityStatus: 'needs_review',
                quantityState: 'low_stock',
                entryMethod: 'metadata_import',
                dateAdded: 'last_30_days',
            },
        });

        expect(rpc).toHaveBeenCalledWith(OWNER_INVENTORY_RPC_NAME, {
            p_page_size: 50,
            p_cursor: 'opaque/+server==.signature',
            p_query: 'Bookshop',
            p_condition: 'very_good',
            p_visibility_status: 'needs_review',
            p_quantity_state: 'low_stock',
            p_entry_method: 'metadata_import',
            p_date_added: 'last_30_days',
        });
    });

    it.each([0, -1, 51, 1.5, null])('rejects invalid page size %p before transport', async (pageSize) => {
        await expect(ownerInventoryReadService.listPage({ pageSize } as never)).rejects.toMatchObject({
            category: 'invalid_request',
        });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('rejects unknown response fields instead of silently accepting table drift', async () => {
        rpc.mockResolvedValue({
            data: {
                ...page,
                items: [{ ...item, internal_notes: 'must never reach the client' }],
            },
            error: null,
        });

        await expect(ownerInventoryReadService.listPage()).rejects.toMatchObject({
            category: 'internal',
            code: 'P9_RESPONSE_INVALID',
        });
    });

    it.each([
        ['created_at', '2026-08-01'],
        ['updated_at', 'August 3, 2026 10:00:00'],
        ['version', 0],
    ])('rejects out-of-contract %s value %p', async (field, invalidValue) => {
        rpc.mockResolvedValue({
            data: {
                ...page,
                items: [{ ...item, [field]: invalidValue }],
            },
            error: null,
        });

        await expect(ownerInventoryReadService.listPage()).rejects.toMatchObject({
            category: 'internal',
            code: 'P9_RESPONSE_INVALID',
        });
    });

    it.each([
        ['P9_AUTH_REQUIRED', 'unauthorized', false],
        ['P9_OWNER_NOT_AUTHORIZED', 'unauthorized', false],
        ['P9_REQUEST_INVALID', 'invalid_request', false],
        ['P9_CURSOR_INVALID', 'invalid_cursor', false],
        ['P9_INTERNAL_ERROR', 'internal', true],
    ])('translates %s into the stable %s category', async (code, category, retryable) => {
        rpc.mockResolvedValue({ data: null, error: { message: code } });

        await expect(ownerInventoryReadService.listPage()).rejects.toMatchObject({
            category,
            code,
            retryable,
        });
    });

    it('keeps network failures distinct from successful empty inventory', async () => {
        rpc.mockRejectedValue(new TypeError('Network request failed'));

        await expect(ownerInventoryReadService.listPage()).rejects.toBeInstanceOf(OwnerInventoryReadError);
        await expect(ownerInventoryReadService.listPage()).rejects.toMatchObject({
            category: 'unavailable',
            retryable: true,
        });
    });

    it.each([
        null,
        [],
        { contractVersion: 'wrong', items: [], pageInfo: { nextCursor: null, hasMore: false } },
        { contractVersion: 'phase9-owner-inventory-v1', items: [], pageInfo: { nextCursor: null } },
        { ...page, unexpected: true },
    ])('rejects malformed page response %p', async (data) => {
        rpc.mockResolvedValue({ data, error: null });

        await expect(ownerInventoryReadService.listPage()).rejects.toMatchObject({
            category: 'internal',
            code: 'P9_RESPONSE_INVALID',
        });
    });
});
