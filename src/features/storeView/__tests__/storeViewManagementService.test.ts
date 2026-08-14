import { supabase } from '@/lib/supabase';
import { storeViewManagementService } from '../api/storeViewManagementService';
import { STORE_VIEW_MANAGEMENT_CONTRACT_VERSION } from '../contracts/storeViewManagementContracts';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const inventoryId = '00000000-0000-4000-8000-000000000001';
const commandId = '00000000-0000-4000-8000-000000000002';

describe('Unit 7C WU3 Store View management service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('encodes the exact Save identity and allowed change set', async () => {
        invoke.mockResolvedValue({ data: {
            contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
            data: { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, publicRevisionNumber: null, outcome: 'details_updated' },
        }, error: null });
        await storeViewManagementService.save({
            inventoryId, expectedInventoryVersion: 3,
            idempotencyKey: 'store-view-save:attempt-1', commandId,
            changes: { title: 'New title', internalNotes: 'Owner only' },
        });
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', { body: {
            action: 'update_store_inventory_details',
            contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
            inventoryId, expectedInventoryVersion: 3,
            idempotencyKey: 'store-view-save:attempt-1', commandId,
            changes: { title: 'New title', internalNotes: 'Owner only' },
        } });
    });

    it('routes stock through stock-v2 action and forwards delta exactly', async () => {
        invoke.mockResolvedValue({ data: {
            contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
            data: { inventoryId, inventoryVersion: 5, publicationIntentVersion: 2, publicRevisionNumber: 3, stockState: 'out_of_stock', outcome: 'stock_adjusted' },
        }, error: null });
        await storeViewManagementService.adjustStock({
            inventoryId, expectedInventoryVersion: 4, delta: -1,
            idempotencyKey: 'store-view-stock:attempt-1', commandId,
        });
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', { body: {
            action: 'adjust_inventory_stock',
            contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
            inventoryId, expectedInventoryVersion: 4, delta: -1,
            idempotencyKey: 'store-view-stock:attempt-1', commandId,
        } });
    });

    it('rejects forbidden Save fields before transport and strictly decodes responses', async () => {
        await expect(storeViewManagementService.save({
            inventoryId, expectedInventoryVersion: 3,
            idempotencyKey: 'store-view-save:attempt-1', commandId,
            changes: { listingId: inventoryId } as never,
        })).rejects.toMatchObject({ code: 'P9_REQUEST_INVALID' });
        expect(invoke).not.toHaveBeenCalled();
        invoke.mockResolvedValue({ data: {
            contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
            data: { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, publicRevisionNumber: null, outcome: 'details_updated', rawRow: {} },
        }, error: null });
        await expect(storeViewManagementService.save({
            inventoryId, expectedInventoryVersion: 3,
            idempotencyKey: 'store-view-save:attempt-1', commandId,
            changes: { title: 'New title' },
        })).rejects.toMatchObject({ code: 'P9_RESPONSE_INVALID' });
    });
});
