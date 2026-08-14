import { parseOwnerIngestionRequest } from '../_shared/imageInventory/contracts/ingestion';
import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';

const uuid = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, '0')}`;
const request = {
  action: 'set_publication_state', contractVersion: 'phase9-publication-v1',
  inventoryId: uuid(1), expectedInventoryVersion: 1, expectedPublicationIntentVersion: 1,
  intent: 'publish', idempotencyKey: 'publication-command-0001', commandId: uuid(2),
};

describe('Unit 7B Owner Edge publication', () => {
  it('U7B-RT04 Edge forwards ordinary Owner auth and never accepts caller store authority', async () => {
    expect(() => parseOwnerIngestionRequest({ ...request, storeId: uuid(3) })).toThrow('unknown keys');
    const userClient = { rpc: jest.fn(async () => ({ data: {
      inventoryId: uuid(1), inventoryVersion: 1, publicationIntentVersion: 2,
      publicationStatus: 'published', visibilityStatus: 'published', publicationRetryable: false,
      publicationFailureReason: null, outcome: 'published', listingId: uuid(4),
    }, error: null })), storage: { from: jest.fn() } };
    const result = await executeOwnerIngestion(parseOwnerIngestionRequest(request), uuid(9), userClient as any, {} as any);
    expect(userClient.rpc).toHaveBeenCalledWith('phase9_set_publication_state_v2', expect.not.objectContaining({ p_store_id: expect.anything() }));
    expect(result).toMatchObject({ contractVersion: 'phase9-publication-v1', data: { outcome: 'published' } });
  });

  it('strictly rejects unknown action fields', () => {
    expect(() => parseOwnerIngestionRequest({ ...request, quantity: 3 })).toThrow('unknown keys');
  });

  it('routes public-copy authorization and submission through controlled C20/C21 boundaries', async () => {
    const userClient = { rpc: jest.fn(async (name: string) => name.includes('authorize')
      ? { data: { capabilityId: uuid(4), bucket: 'marketplace-media-staging',
        path: `${uuid(9)}/public_copy/${uuid(1)}/photo`, expiresAt: '2026-08-12T12:15:00.000Z' }, error: null }
      : { data: uuid(6), error: null }), storage: { from: jest.fn() } };
    const serviceClient = { storage: { from: jest.fn(() => ({
      createSignedUploadUrl: jest.fn(async () => ({ data: {
        signedUrl: 'https://storage.example/upload', token: 'upload-token',
      }, error: null })),
    })) } };
    const authorized = await executeOwnerIngestion(parseOwnerIngestionRequest({
      action: 'authorize_public_copy', contractVersion: 'phase9-publication-v1',
      inventoryId: uuid(1), role: 'damage', ordinal: 1,
      declaredMime: 'image/png', declaredBytes: 128, envelopeSha256: 'a'.repeat(64),
      idempotencyKey: 'public-copy-authorize-0001', commandId: uuid(2),
    }), uuid(9), userClient as any, serviceClient as any);
    expect(authorized).toMatchObject({ data: { capabilityId: uuid(4), uploadToken: 'upload-token' } });
    expect(userClient.rpc).toHaveBeenCalledWith('phase9_authorize_public_copy_upload_v2',
      expect.objectContaining({ p_declared_mime: 'image/png', p_declared_bytes: 128 }));

    const submitted = await executeOwnerIngestion(parseOwnerIngestionRequest({
      action: 'submit_public_copy_media', contractVersion: 'phase9-publication-v1',
      inventoryId: uuid(1), capabilityId: uuid(4), mediaAssetId: uuid(5),
      role: 'damage', publicOrder: 1, idempotencyKey: 'public-copy-submit-00001',
      commandId: uuid(3),
    }), uuid(9), userClient as any, serviceClient as any);
    expect(userClient.rpc).toHaveBeenLastCalledWith('phase9_submit_public_copy_media_v2',
      expect.not.objectContaining({ p_store_id: expect.anything() }));
    expect(submitted).toMatchObject({ data: { mediaLinkId: uuid(6) } });
  });

  it('U7B-RT17 registers only the exact observed private staging object and queues sanitation', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const list = jest.fn(async () => ({ data: [{
      id: 'object-version-1', name: 'photo.png',
      updated_at: '2026-08-12T12:00:00.000Z',
      metadata: { size: bytes.byteLength, mimetype: 'image/png', eTag: 'etag-1' },
    }], error: null }));
    const download = jest.fn(async () => ({ data: new Blob([bytes]), error: null }));
    const rpc = jest.fn(async (name: string) => name === 'phase9_public_copy_upload_context_v1'
      ? { data: { bucket_id: 'marketplace-media-staging',
        object_path: `${uuid(9)}/public_copy/${uuid(1)}/photo.png`,
        declared_mime: 'image/png', declared_bytes: bytes.byteLength }, error: null }
      : { data: { media_asset_id: uuid(5), job_id: uuid(6), state: 'processing' }, error: null });
    const serviceClient = { rpc, storage: { from: jest.fn(() => ({ list, download })) } };
    const completed = await executeOwnerIngestion(parseOwnerIngestionRequest({
      action: 'complete_public_copy_upload', contractVersion: 'phase9-publication-v1',
      capabilityId: uuid(4), idempotencyKey: 'public-copy-complete-0001', commandId: uuid(2),
    }), uuid(9), {} as any, serviceClient as any);
    expect(list).toHaveBeenCalledWith(`${uuid(9)}/public_copy/${uuid(1)}`, {
      search: 'photo.png', limit: 2,
    });
    expect(download).toHaveBeenCalledWith(`${uuid(9)}/public_copy/${uuid(1)}/photo.png`);
    expect(rpc).toHaveBeenLastCalledWith('phase9_register_public_copy_upload_v1',
      expect.objectContaining({
        p_actor: uuid(9), p_capability_id: uuid(4), p_observed_mime: 'image/png',
        p_observed_bytes: bytes.byteLength, p_source_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        p_object_identity: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }));
    expect(completed).toMatchObject({ data: { mediaAssetId: uuid(5), state: 'processing' } });
  });
});
