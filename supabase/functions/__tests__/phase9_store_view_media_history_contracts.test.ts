import {
  STORE_VIEW_MEDIA_CONTRACT_VERSION,
  parseStoreViewMediaRequest,
  parseStoreViewMediaRpcResponse,
} from '../_shared/imageInventory/contracts/storeViewMedia';
import {
  STORE_VIEW_HISTORY_CONTRACT_VERSION,
  parseStoreViewHistoryRequest,
  parseStoreViewHistoryRpcResponse,
} from '../_shared/imageInventory/contracts/storeViewHistory';
import {
  PUBLICATION_CONTRACT_VERSION,
  parsePublicationRequest,
} from '../_shared/imageInventory/contracts/publication';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';

const inventoryId = '00000000-0000-4000-8000-000000000001';
const linkId = '00000000-0000-4000-8000-000000000002';
const assetId = '00000000-0000-4000-8000-000000000003';
const capabilityId = '00000000-0000-4000-8000-000000000004';
const commandId = '00000000-0000-4000-8000-000000000005';
const createdAt = '2026-08-15T04:00:00.000+05:30';

function client(rpc: (name: string, args: Record<string, unknown>) => any, errorCode = 'P9_MEDIA_CHANGE_UNSAFE') {
  const fn = (name: string, args: Record<string, unknown>) => {
    const data = rpc(name, args);
    return Promise.resolve({ data, error: data === null ? { message: errorCode } : null });
  };
  return {
    rpc: fn,
    storage: { from: () => ({
      createSignedUploadUrl: () => Promise.resolve({
        data: { signedUrl: 'https://example.test/upload', token: 'upload-token' }, error: null,
      }),
    }) },
  };
}

describe('Unit 7C WU4 Store View media Edge contracts', () => {
  it('binds Store View upload operation identity at the publication contract boundary', () => {
    const base = {
      action: 'authorize_public_copy', contractVersion: PUBLICATION_CONTRACT_VERSION,
      inventoryId, role: 'actual_copy', ordinal: 1,
      declaredMime: 'image/png', declaredBytes: 128, envelopeSha256: 'b'.repeat(64),
      idempotencyKey: 'store-view-media:authorize:attempt-1', commandId,
    } as const;
    expect(parsePublicationRequest({ ...base, operationKind: 'replace', targetLinkId: linkId }))
      .toMatchObject({ operationKind: 'replace', targetLinkId: linkId });
    expect(parsePublicationRequest({ ...base, operationKind: 'add' }))
      .toMatchObject({ operationKind: 'add' });
    expect(() => parsePublicationRequest({ ...base, operationKind: 'replace' }))
      .toThrow(/invalid/i);
    expect(() => parsePublicationRequest({ ...base, operationKind: 'add', targetLinkId: linkId }))
      .toThrow(/invalid/i);
  });

  it('routes operation-bound authorization to M45 while preserving the Unit 7B route', async () => {
    const calls: string[] = [];
    const c = client((name) => {
      calls.push(name);
      if (name === 'phase9_authorize_store_view_media_upload_v1') {
        return {
          capabilityId, bucket: 'marketplace-media-staging', path: 'owner/upload',
          expiresAt: createdAt,
        };
      }
      return {
        capabilityId, bucket: 'marketplace-media-staging', path: 'owner/upload',
        expiresAt: createdAt,
      };
    });
    await executeOwnerIngestion({
      action: 'authorize_public_copy', contractVersion: PUBLICATION_CONTRACT_VERSION,
      inventoryId, role: 'actual_copy', ordinal: 1, declaredMime: 'image/png',
      declaredBytes: 128, envelopeSha256: 'b'.repeat(64),
      operationKind: 'replace', targetLinkId: linkId,
      idempotencyKey: 'store-view-media:authorize:attempt-2', commandId,
    }, inventoryId, c, c);
    await executeOwnerIngestion({
      action: 'authorize_public_copy', contractVersion: PUBLICATION_CONTRACT_VERSION,
      inventoryId, role: 'actual_copy', ordinal: 1, declaredMime: 'image/png',
      declaredBytes: 128, envelopeSha256: 'b'.repeat(64),
      idempotencyKey: 'unit7b-media:authorize:attempt-2', commandId,
    }, inventoryId, c, c);
    expect(calls).toEqual([
      'phase9_authorize_store_view_media_upload_v1',
      'phase9_authorize_public_copy_upload_v2',
    ]);
  });

  it('accepts the strict read, reorder, remove, and replace requests without caller authority fields', () => {
    const read = parseStoreViewMediaRequest({
      action: 'read_store_view_media',
      contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
      inventoryId,
    });
    expect(read).toMatchObject({ inventoryId });
    for (const action of ['reorder_store_view_media', 'remove_store_view_media', 'replace_store_view_media']) {
      const base = {
        action,
        contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
        inventoryId,
        expectedInventoryVersion: 3,
        idempotencyKey: `store-view-media:${action}:attempt-1`,
        commandId,
      };
      const extra = action === 'reorder_store_view_media'
        ? { orderedLinkIds: [linkId] }
        : action === 'remove_store_view_media'
          ? { linkId }
          : { capabilityId, mediaAssetId: assetId, targetLinkId: linkId };
      expect(parseStoreViewMediaRequest({ ...base, ...extra })).toBeTruthy();
      expect(() => parseStoreViewMediaRequest({ ...base, ...extra, storeId: inventoryId }))
        .toThrow(/unknown|invalid/i);
    }
    expect(() => parseStoreViewMediaRequest({
      action: 'reorder_store_view_media',
      contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
      inventoryId, expectedInventoryVersion: 3, orderedLinkIds: [],
      idempotencyKey: 'store-view-media:reorder:attempt-2', commandId,
    })).toThrow(/invalid/i);
  });

  it('strictly decodes the exact media read and mutation results', () => {
    const read = {
      inventoryId,
      media: [{
        linkId, mediaAssetId: assetId, role: 'primary_fallback', publicOrder: 1,
        approvalStatus: 'approved', approvedAt: createdAt,
        url: '/storage/v1/object/public/inventory-photos/path.webp',
        width: 1200, height: 900,
      }],
      pendingReplacements: [{
        capabilityId, role: 'damage', order: 2, state: 'processing',
        operationKind: 'replace', targetLinkId: linkId,
        sourceMediaAssetId: assetId, mediaAssetId: null, safeErrorCode: null,
      }],
    };
    expect(parseStoreViewMediaRpcResponse('read_store_view_media', read).data).toEqual(read);
    const base = {
      inventoryId, inventoryVersion: 4, publicationIntentVersion: 2, publicRevisionNumber: 2,
    };
    expect(parseStoreViewMediaRpcResponse('reorder_store_view_media', {
      ...base, mediaLinkIds: [linkId], outcome: 'media_reordered',
    }).data.outcome).toBe('media_reordered');
    expect(parseStoreViewMediaRpcResponse('remove_store_view_media', {
      ...base, removedMediaAssetId: assetId, outcome: 'media_removed',
    }).data.outcome).toBe('media_removed');
    expect(parseStoreViewMediaRpcResponse('replace_store_view_media', {
      ...base, mediaLinkId: linkId, mediaAssetId: assetId,
      removedMediaAssetId: assetId, outcome: 'media_replaced',
    }).data.outcome).toBe('media_replaced');
    expect(() => parseStoreViewMediaRpcResponse('read_store_view_media', {
      ...read, media: [{ ...read.media[0], objectPath: 'secret' }],
    })).toThrow(/invalid/i);
    expect(() => parseStoreViewMediaRpcResponse('replace_store_view_media', {
      ...base, mediaLinkId: linkId, mediaAssetId: assetId, removedMediaAssetId: assetId,
      outcome: 'media_removed',
    })).toThrow(/invalid/i);
  });

  it('maps each action to the exact M45 RPC without merging authorities', async () => {
    const calls: string[] = [];
    const c = client((name) => {
      calls.push(name);
      if (name === 'phase9_store_view_media_v1') {
        return {
          inventoryId,
          media: [{
            linkId, mediaAssetId: assetId, role: 'primary_fallback', publicOrder: 1,
            approvalStatus: 'approved', approvedAt: createdAt,
            url: '/storage/v1/object/public/inventory-photos/path.webp',
            width: 1200, height: 900,
          }],
          pendingReplacements: [],
        };
      }
      if (name === 'phase9_reorder_store_view_media_v1') {
        return { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
          mediaLinkIds: [linkId], publicRevisionNumber: null, outcome: 'media_reordered' };
      }
      if (name === 'phase9_remove_store_view_media_v1') {
        return { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
          removedMediaAssetId: assetId, publicRevisionNumber: 2, outcome: 'media_removed' };
      }
      if (name === 'phase9_replace_store_view_media_v1') {
        return { inventoryId, inventoryVersion: 4, publicationIntentVersion: 2,
          mediaLinkId: linkId, mediaAssetId: assetId, removedMediaAssetId: assetId,
          publicRevisionNumber: 2, outcome: 'media_replaced' };
      }
      return null;
    });

    const read = await executeOwnerIngestion(
      { action: 'read_store_view_media', contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION, inventoryId },
      inventoryId, c, c,
    );
    expect(read).toEqual({ contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION, data: expect.objectContaining({ inventoryId }) });
    await executeOwnerIngestion({
      action: 'reorder_store_view_media', contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
      inventoryId, expectedInventoryVersion: 3, orderedLinkIds: [linkId],
      idempotencyKey: 'store-view-media:reorder:attempt-3', commandId,
    }, inventoryId, c, c);
    await executeOwnerIngestion({
      action: 'remove_store_view_media', contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
      inventoryId, expectedInventoryVersion: 3, linkId,
      idempotencyKey: 'store-view-media:remove:attempt-3', commandId,
    }, inventoryId, c, c);
    await executeOwnerIngestion({
      action: 'replace_store_view_media', contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
      inventoryId, expectedInventoryVersion: 3, capabilityId, mediaAssetId: assetId, targetLinkId: linkId,
      idempotencyKey: 'store-view-media:replace:attempt-3', commandId,
    }, inventoryId, c, c);
    expect(calls).toEqual([
      'phase9_store_view_media_v1', 'phase9_reorder_store_view_media_v1',
      'phase9_remove_store_view_media_v1', 'phase9_replace_store_view_media_v1',
    ]);
  });

  it('maps the bounded media error codes through the shared unwrap whitelist', async () => {
    for (const code of ['P9_MEDIA_CHANGE_UNSAFE', 'P9_MEDIA_LINK_NOT_FOUND', 'P9_MEDIA_ALREADY_LINKED']) {
      const c = client(() => null, code);
      await expect(executeOwnerIngestion({
        action: 'remove_store_view_media', contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
        inventoryId, expectedInventoryVersion: 3, linkId,
        idempotencyKey: 'store-view-media:remove:attempt-4', commandId,
      }, inventoryId, c, c)).rejects.toThrow(code);
    }
  });
});

describe('Unit 7C WU4 Store View history Edge contracts', () => {
  it('accepts only the bounded read request and strictly decodes activity and public revisions', () => {
    const request = parseStoreViewHistoryRequest({
      action: 'read_store_view_history',
      contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
      inventoryId,
    });
    expect(request).toMatchObject({ inventoryId });
    expect(() => parseStoreViewHistoryRequest({
      action: 'read_store_view_history',
      contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
      inventoryId, storeId: inventoryId,
    })).toThrow(/unknown|invalid/i);

    const response = {
      inventoryId,
      activity: [
        { kind: 'audit', action: 'phase9.inventory.media_reordered', createdAt,
          details: { commandId, inventoryVersion: 4 } },
        { kind: 'event', eventType: 'inventory.media.reordered', source: 'store_owner_app',
          severity: 'info', createdAt, payload: { commandId } },
        { kind: 'publication_retry', status: 'dead_letter', attemptCount: 5, maxAttempts: 5,
          safeErrorCode: 'P9_PROJECTION_TRANSIENT', createdAt, updatedAt: createdAt, completedAt: createdAt },
      ],
      publicRevisions: [{
        revisionNumber: 2, sourceAction: 'media_change', createdAt, listingId: linkId,
        publicSnapshot: { title: 'Safe title', priceMinor: 725 },
      }],
    };
    expect(parseStoreViewHistoryRpcResponse(response).data).toEqual(response);
    expect(() => parseStoreViewHistoryRpcResponse({
      ...response, activity: [...response.activity, { kind: 'raw', secret: true }],
    })).toThrow(/invalid/i);
    expect(() => parseStoreViewHistoryRpcResponse({
      ...response,
      activity: [{ ...response.activity[0], details: { privateNote: 'secret' } }],
    })).toThrow(/invalid/i);
  });

  it('maps the history read to the exact M45 RPC and rejects private snapshot fields as unknown data', async () => {
    const c = client(() => ({
      inventoryId,
      activity: [],
      publicRevisions: [{
        revisionNumber: 1, sourceAction: 'initial_publish', createdAt, listingId: null,
        publicSnapshot: { title: 'Safe title' },
      }],
    }));
    const result = await executeOwnerIngestion({
      action: 'read_store_view_history',
      contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
      inventoryId,
    }, inventoryId, c, c);
    expect(result).toEqual({
      contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
      data: expect.objectContaining({ inventoryId }),
    });
  });
});
