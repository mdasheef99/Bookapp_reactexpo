import {
  STORE_VIEW_CONTRACT_VERSION,
  parseStoreViewRequest,
  parseStoreViewRpcResponse,
} from '../_shared/imageInventory/contracts/storeView';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';

const inventoryId = '00000000-0000-4000-8000-000000000001';

const rawItem = {
  identity: { inventoryId },
  presentation: {
    title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
    publicDescription: 'A public description.', condition: 'good',
    publicConditionNote: 'Light shelf wear.', hasDamage: false,
    damageTypes: [], damageNote: null, isSellable: true, sellingPriceMinor: 35000,
  },
  stockSummary: { quantityAvailable: 2, stockState: 'available' },
  lifecycle: {
    publicationState: 'published', effectiveState: 'live', visibilityStatus: 'published',
  },
  attention: { attentionState: 'none', attentionReasons: [] },
  capabilities: ['edit_details', 'adjust_stock', 'manage_photos', 'pause', 'make_private'],
  versions: { inventoryVersion: 3, publicationIntentVersion: 2 },
  mediaSummary: { approvedCount: 1 },
  publicState: {
    listingId: '00000000-0000-4000-8000-000000000002',
    storeId: '00000000-0000-4000-8000-000000000003',
    title: 'The Bookshop', authors: ['Penelope Fitzgerald'], language: 'en',
    description: 'A public description.', editionStatement: null, volume: null,
    format: null, isbn10: null, isbn13: null, condition: 'good', hasDamage: false,
    publicDamageNote: null, damageTypes: [], priceMinor: 35000, currency: 'INR',
    availabilityStatus: 'available', coverUrl: 'https://example.com/cover.jpg',
    publicMediaCount: 1, fulfillmentOptions: ['pickup'], status: 'active',
    moderationStatus: 'approved', qualityStatus: 'ready',
    friendlyInventoryFreshnessSignal: 'recent',
  },
};

describe('Unit 7C WU2 Store View Edge contracts', () => {
  it('accepts only bounded page/detail requests without caller store authority', () => {
    expect(parseStoreViewRequest({
      action: 'read_store_view_page', contractVersion: STORE_VIEW_CONTRACT_VERSION,
      pageSize: 20, cursor: 'opaque', filter: 'needs_attention',
    })).toMatchObject({ filter: 'needs_attention', cursor: 'opaque' });
    expect(parseStoreViewRequest({
      action: 'read_store_view_detail', contractVersion: STORE_VIEW_CONTRACT_VERSION,
      inventoryId,
    })).toMatchObject({ inventoryId });
    expect(() => parseStoreViewRequest({
      action: 'read_store_view_page', contractVersion: STORE_VIEW_CONTRACT_VERSION,
      filter: 'all', storeId: inventoryId,
    })).toThrow(/unknown|invalid/i);
    expect(() => parseStoreViewRequest({
      action: 'read_store_view_page', contractVersion: 'phase9-store-view-read-v999',
      filter: 'all',
    })).toThrow(/invalid/i);
  });

  it('strictly validates page/detail and exposes only curated public state', () => {
    const page = parseStoreViewRpcResponse('read_store_view_page', {
      items: [rawItem], pageInfo: { hasNextPage: false, nextCursor: null },
    });
    expect(page).toEqual({
      contractVersion: STORE_VIEW_CONTRACT_VERSION,
      data: {
        items: [expect.objectContaining({
          identity: { inventoryId },
          publicState: {
            listingId: rawItem.publicState.listingId,
            coverUrl: rawItem.publicState.coverUrl,
            availabilityStatus: 'available',
          },
        })],
        pageInfo: { hasNextPage: false, nextCursor: null },
      },
    });
    expect(parseStoreViewRpcResponse('read_store_view_detail', {
      ...rawItem,
      privateOperations: { shelfLocation: 'A3', internalNotes: 'Owner only.' },
      stock: {
        quantityTotal: 2, quantityAvailable: 2, quantityReserved: 0,
        quantitySold: 0, quantityRemoved: 0,
      },
      historySummary: { publicRevisionCount: 1, latestPublicRevision: null },
    }).data).toMatchObject({ identity: { inventoryId } });
  });

  it.each([
    ['lifecycle', { lifecycle: { ...rawItem.lifecycle, publicationState: 'invented' } }],
    ['effective state', { lifecycle: { ...rawItem.lifecycle, effectiveState: 'invented' } }],
    ['attention reason', { attention: { attentionState: 'action_required', attentionReasons: ['invented'] } }],
    ['capability', { capabilities: ['edit_details', 'invented'] }],
  ])('rejects an invalid %s', (_label, replacement) => {
    expect(() => parseStoreViewRpcResponse('read_store_view_page', {
      items: [{ ...rawItem, ...replacement }],
      pageInfo: { hasNextPage: false, nextCursor: null },
    })).toThrow(/invalid/i);
  });

  it('maps page/detail actions to the existing Owner RPC router', async () => {
    const rpc = jest.fn(async (name: string) => ({
      data: name === 'phase9_store_view_page_v2'
        ? { items: [], pageInfo: { hasNextPage: false, nextCursor: null } }
        : {
          ...rawItem,
          privateOperations: { shelfLocation: null, internalNotes: null },
          stock: { quantityTotal: 2, quantityAvailable: 2, quantityReserved: 0, quantitySold: 0, quantityRemoved: 0 },
          historySummary: { publicRevisionCount: 0, latestPublicRevision: null },
        },
      error: null,
    }));
    const client = { rpc, storage: { from: jest.fn() } } as any;

    await executeOwnerIngestion({
      action: 'read_store_view_page', contractVersion: STORE_VIEW_CONTRACT_VERSION,
      pageSize: 10, cursor: 'opaque', filter: 'paused',
    }, inventoryId, client, client);
    await executeOwnerIngestion({
      action: 'read_store_view_detail', contractVersion: STORE_VIEW_CONTRACT_VERSION,
      inventoryId,
    }, inventoryId, client, client);

    expect(rpc).toHaveBeenNthCalledWith(1, 'phase9_store_view_page_v2', {
      p_page_size: 10, p_cursor: 'opaque', p_filter: 'paused',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'phase9_store_view_detail_v1', {
      p_inventory_id: inventoryId,
    });
  });
});
