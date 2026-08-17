import {
  STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
  parseStoreViewManagementRequest,
  parseStoreViewManagementRpcResponse,
} from '../_shared/imageInventory/contracts/storeViewManagement';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';

const inventoryId = '00000000-0000-4000-8000-000000000001';
const commandId = '00000000-0000-4000-8000-000000000002';

describe('Unit 7C WU3 Store View management Edge contracts', () => {
  it('accepts only the frozen Save fields and never caller store/listing authority', () => {
    const request = parseStoreViewManagementRequest({
      action: 'update_store_inventory_details',
      contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
      inventoryId,
      expectedInventoryVersion: 3,
      idempotencyKey: 'store-view-save:attempt-1',
      commandId,
      changes: {
        title: 'Updated title', authors: ['Owner Author'], language: 'en',
        publicDescription: 'Updated public copy.', sellingPriceMinor: 45000,
        condition: 'very_good', publicConditionNote: 'Clean copy.',
        hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
        shelfLocation: 'A4', internalNotes: 'Owner only.',
      },
    });
    expect(request).toMatchObject({ inventoryId, expectedInventoryVersion: 3 });
    for (const forbidden of ['storeId', 'listingId', 'quantityAvailable', 'coverUrl']) {
      expect(() => parseStoreViewManagementRequest({
        ...request,
        [forbidden]: forbidden === 'storeId' || forbidden === 'listingId' ? inventoryId : 1,
      })).toThrow(/unknown|invalid/i);
    }
    for (const forbidden of ['quantityTotal', 'quantityReserved', 'quantitySold', 'quantityRemoved', 'publicationState', 'mediaIds']) {
      expect(() => parseStoreViewManagementRequest({
        ...request,
        changes: { ...request.changes, [forbidden]: 1 },
      })).toThrow(/unknown|invalid/i);
    }
  });

  it('keeps stock-v2 separate from Save and requires a nonzero bounded delta', () => {
    expect(parseStoreViewManagementRequest({
      action: 'adjust_inventory_stock',
      contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
      inventoryId,
      expectedInventoryVersion: 4,
      delta: -1,
      idempotencyKey: 'store-view-stock:attempt-1',
      commandId,
    })).toMatchObject({ delta: -1 });
    expect(() => parseStoreViewManagementRequest({
      action: 'adjust_inventory_stock',
      contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
      inventoryId,
      expectedInventoryVersion: 4,
      delta: 0,
      idempotencyKey: 'store-view-stock:attempt-1',
      commandId,
    })).toThrow(/invalid/i);
  });

  it('strictly decodes the exact Save and stock RPC results', () => {
    const save = {
      inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
      publicRevisionNumber: null, outcome: 'details_updated',
    };
    const stock = {
      inventoryId, inventoryVersion: 5, publicationIntentVersion: 2,
      publicRevisionNumber: 3, stockState: 'out_of_stock', outcome: 'stock_adjusted',
    };
    expect(parseStoreViewManagementRpcResponse('update_store_inventory_details', save).data).toEqual(save);
    expect(parseStoreViewManagementRpcResponse('adjust_inventory_stock', stock).data).toEqual(stock);
    expect(() => parseStoreViewManagementRpcResponse('adjust_inventory_stock', {
      ...stock, effectiveState: 'out_of_stock',
    })).toThrow(/invalid/i);
  });

  it('maps Save and stock to the exact M43 RPCs without merging authorities', async () => {
    const rpc = jest.fn(async (name: string) => ({
      data: name === 'phase9_update_store_inventory_details_v1'
        ? { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, publicRevisionNumber: null, outcome: 'details_updated' }
        : { inventoryId, inventoryVersion: 5, publicationIntentVersion: 2, publicRevisionNumber: 3, stockState: 'out_of_stock', outcome: 'stock_adjusted' },
      error: null,
    }));
    const client = { rpc, storage: { from: jest.fn() } } as any;
    await executeOwnerIngestion({
      action: 'update_store_inventory_details', contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
      inventoryId, expectedInventoryVersion: 3, changes: { title: 'Updated title' },
      idempotencyKey: 'store-view-save:attempt-1', commandId,
    }, inventoryId, client, client);
    await executeOwnerIngestion({
      action: 'adjust_inventory_stock', contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
      inventoryId, expectedInventoryVersion: 4, delta: -1,
      idempotencyKey: 'store-view-stock:attempt-1', commandId,
    }, inventoryId, client, client);
    expect(rpc).toHaveBeenNthCalledWith(1, 'phase9_update_store_inventory_details_v1', {
      p_inventory_id: inventoryId, p_expected_inventory_version: 3,
      p_changes: { title: 'Updated title' },
      p_idempotency_key: 'store-view-save:attempt-1', p_command_id: commandId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'phase9_adjust_inventory_stock_v2', {
      p_inventory_id: inventoryId, p_expected_inventory_version: 4, p_delta: -1,
      p_idempotency_key: 'store-view-stock:attempt-1', p_command_id: commandId,
    });
  });
});
