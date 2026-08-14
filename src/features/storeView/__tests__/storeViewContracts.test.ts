import {
    STORE_VIEW_CONTRACT_VERSION,
    decodeStoreViewResponse,
} from '../contracts/storeViewContracts';

export const inventoryId = '00000000-0000-4000-8000-000000000001';
export const item = {
    identity: { inventoryId },
    presentation: {
        title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
        publicDescription: 'A public description.', condition: 'good',
        publicConditionNote: 'Light shelf wear.', hasDamage: false,
        damageTypes: [], damageNote: null, isSellable: true, sellingPriceMinor: 35000,
    },
    stockSummary: { quantityAvailable: 2, stockState: 'available' },
    lifecycle: { publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published' },
    attention: { attentionState: 'none', attentionReasons: [] },
    capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'],
    versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
    mediaSummary: { approvedCount: 1 },
    publicState: {
        listingId: '00000000-0000-4000-8000-000000000002',
        coverUrl: 'https://example.com/cover.jpg', availabilityStatus: 'available',
    },
} as const;

describe('Unit 7C WU2 client Store View contracts', () => {
    it('decodes valid page and detail envelopes', () => {
        expect(decodeStoreViewResponse('read_store_view_page', {
            contractVersion: STORE_VIEW_CONTRACT_VERSION,
            data: { items: [item], pageInfo: { hasNextPage: false, nextCursor: null } },
        }).items[0].identity.inventoryId).toBe(inventoryId);
        expect(decodeStoreViewResponse('read_store_view_detail', {
            contractVersion: STORE_VIEW_CONTRACT_VERSION,
            data: {
                ...item,
                privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner only.' },
                stock: { quantityTotal: 2, quantityAvailable: 2, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
                historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
            },
        }).privateOperations.internalNotes).toBe('Owner only.');
    });

    it.each([
        ['version', { contractVersion: 'phase9-store-view-read-v999' }],
        ['lifecycle', { data: { items: [{ ...item, lifecycle: { ...item.lifecycle, publicationState: 'invented' } }], pageInfo: { hasNextPage: false, nextCursor: null } } }],
        ['effective state', { data: { items: [{ ...item, lifecycle: { ...item.lifecycle, effectiveState: 'invented' } }], pageInfo: { hasNextPage: false, nextCursor: null } } }],
        ['attention reason', { data: { items: [{ ...item, attention: { attentionState: 'action_required', attentionReasons: ['invented'] } }], pageInfo: { hasNextPage: false, nextCursor: null } } }],
        ['capability', { data: { items: [{ ...item, capabilities: ['invented'] }], pageInfo: { hasNextPage: false, nextCursor: null } } }],
    ])('rejects invalid %s', (_label, replacement) => {
        const valid = {
            contractVersion: STORE_VIEW_CONTRACT_VERSION,
            data: { items: [item], pageInfo: { hasNextPage: false, nextCursor: null } },
        };
        expect(() => decodeStoreViewResponse('read_store_view_page', {
            ...valid, ...replacement,
        })).toThrow(/validated/i);
    });
});
