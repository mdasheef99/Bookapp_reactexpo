import { supabase } from '@/lib/supabase';
import { storeViewMediaService, StoreViewMediaClientError } from '../api/storeViewMediaService';
import { STORE_VIEW_MEDIA_CONTRACT_VERSION } from '../contracts/storeViewMediaContracts';
import { storeViewHistoryService } from '../api/storeViewHistoryService';
import { STORE_VIEW_HISTORY_CONTRACT_VERSION } from '../contracts/storeViewHistoryContracts';

jest.mock('@/lib/supabase', () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

const invoke = supabase.functions.invoke as jest.Mock;
const inventoryId = '00000000-0000-4000-8000-000000000001';
const linkId = '00000000-0000-4000-8000-000000000002';
const assetId = '00000000-0000-4000-8000-000000000003';
const capabilityId = '00000000-0000-4000-8000-000000000004';
const commandId = '00000000-0000-4000-8000-000000000005';
const createdAt = '2026-08-15T04:00:00.000+05:30';

const mediaRecord = {
    linkId, mediaAssetId: assetId, role: 'primary_fallback', publicOrder: 1,
    approvalStatus: 'approved', approvedAt: createdAt,
    url: '/storage/v1/object/public/inventory-photos/path.webp',
    width: 1200, height: 900,
};

describe('Unit 7C WU4 Store View media service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reads owner-safe media through the Owner Edge action', async () => {
        invoke.mockResolvedValue({
            data: {
                contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
                data: { inventoryId, media: [mediaRecord], pendingReplacements: [] },
            },
            error: null,
        });
        const media = await storeViewMediaService.read(inventoryId);
        expect(media.media).toEqual([mediaRecord]);
        expect(invoke).toHaveBeenCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'read_store_view_media',
                contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
                inventoryId,
            },
        });
    });

    it('dispatches reorder, remove, and replace with exact version fencing and idempotency identity', async () => {
        invoke.mockImplementation(async (_name: string, options: { body: { action: string } }) => {
            const action = options.body.action;
            return {
                data: {
                    contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
                    data: action === 'reorder_store_view_media'
                        ? {
                            inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
                            mediaLinkIds: [linkId], publicRevisionNumber: null,
                            outcome: 'media_reordered',
                        }
                        : action === 'remove_store_view_media'
                            ? {
                                inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
                                removedMediaAssetId: assetId, publicRevisionNumber: 2,
                                outcome: 'media_removed',
                            }
                            : {
                                inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
                                mediaLinkId: linkId, mediaAssetId: assetId,
                                removedMediaAssetId: assetId, publicRevisionNumber: 2,
                                outcome: 'media_replaced',
                            },
                },
                error: null,
            };
        });
        await storeViewMediaService.reorder({
            inventoryId, expectedInventoryVersion: 3, orderedLinkIds: [linkId],
            idempotencyKey: 'store-view-media:reorder:attempt-1', commandId,
        });
        expect(invoke).toHaveBeenLastCalledWith('phase9-owner-ingestion', {
            body: {
                action: 'reorder_store_view_media',
                contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
                inventoryId, expectedInventoryVersion: 3, orderedLinkIds: [linkId],
                idempotencyKey: 'store-view-media:reorder:attempt-1', commandId,
            },
        });
        await storeViewMediaService.remove({
            inventoryId, expectedInventoryVersion: 3, linkId,
            idempotencyKey: 'store-view-media:remove:attempt-1', commandId,
        });
        await storeViewMediaService.replace({
            inventoryId, expectedInventoryVersion: 3, capabilityId, mediaAssetId: assetId,
            targetLinkId: linkId, idempotencyKey: 'store-view-media:replace:attempt-1', commandId,
        });
        expect(invoke).toHaveBeenNthCalledWith(2, 'phase9-owner-ingestion', expect.objectContaining({
            body: expect.objectContaining({ action: 'remove_store_view_media' }),
        }));
        expect(invoke).toHaveBeenNthCalledWith(3, 'phase9-owner-ingestion', expect.objectContaining({
            body: expect.objectContaining({ action: 'replace_store_view_media' }),
        }));
    });

    it('rejects caller-authoritative and unsafe shapes before dispatch', async () => {
        await expect(storeViewMediaService.reorder({
            inventoryId, expectedInventoryVersion: 3, orderedLinkIds: [],
            idempotencyKey: 'store-view-media:reorder:attempt-2', commandId,
        })).rejects.toBeInstanceOf(StoreViewMediaClientError);
        expect(invoke).not.toHaveBeenCalled();
    });

    it('surfaces the bounded media safety codes as typed client errors', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: { context: { json: async () => ({
                error: 'P9_MEDIA_CHANGE_UNSAFE', retryable: false,
                message: 'That photo cannot be changed.',
            }) } },
        });
        await expect(storeViewMediaService.remove({
            inventoryId, expectedInventoryVersion: 3, linkId,
            idempotencyKey: 'store-view-media:remove:attempt-3', commandId,
        })).rejects.toMatchObject({ code: 'P9_MEDIA_CHANGE_UNSAFE' });
    });
});

describe('Unit 7C WU4 Store View history service', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reads the bounded activity and public revision history', async () => {
        invoke.mockResolvedValue({
            data: {
                contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
                data: {
                    inventoryId,
                    activity: [{
                        kind: 'audit', action: 'phase9.inventory.media_reordered',
                        createdAt, details: { commandId },
                    }],
                    publicRevisions: [{
                        revisionNumber: 2, sourceAction: 'media_change', createdAt,
                        listingId: linkId, publicSnapshot: { title: 'Safe title' },
                    }],
                },
            },
            error: null,
        });
        const history = await storeViewHistoryService(inventoryId);
        expect(history.publicRevisions[0].sourceAction).toBe('media_change');
        expect(history.activity[0].kind).toBe('audit');
    });

    it('rejects invalid revision records instead of accepting drifted data', async () => {
        invoke.mockResolvedValue({
            data: {
                contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
                data: {
                    inventoryId,
                    activity: [],
                    publicRevisions: [{
                        revisionNumber: 0, sourceAction: 'initial_publish', createdAt,
                        listingId: null, publicSnapshot: {},
                    }],
                },
            },
            error: null,
        });
        await expect(storeViewHistoryService(inventoryId))
            .rejects.toMatchObject({ code: 'P9_RESPONSE_INVALID' });
    });
});
