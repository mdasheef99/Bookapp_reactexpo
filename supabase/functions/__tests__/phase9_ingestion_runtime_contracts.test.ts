import {
  assertSafeIngestionResponse,
  parseOwnerIngestionRequest,
  parseDedicatedWorkerRequest,
  parseDedicatedMetadataWorkerRequest,
  parseWorkerIngestionRequest,
} from '../_shared/imageInventory/contracts/ingestion';

describe('Phase 9 ingestion-runtime transport contracts', () => {
  it('accepts bounded Owner commands without accepting an object path or authority fields', () => {
    expect(parseOwnerIngestionRequest({
      action: 'authorize_scan_upload',
      contractVersion: 'phase9-v1',
      sessionId: '92000000-0000-4000-8000-000000000001',
      sourceKind: 'camera',
      declaredMime: 'image/jpeg',
      declaredBytes: 1024,
      ordinal: 1,
      idempotencyKey: 'authorize-upload-0001',
      commandId: '92000000-0000-4000-8000-000000000002',
    })).toMatchObject({ action: 'authorize_scan_upload', ordinal: 1 });

    expect(() => parseOwnerIngestionRequest({
      action: 'authorize_scan_upload',
      contractVersion: 'phase9-v1',
      sessionId: '92000000-0000-4000-8000-000000000001',
      sourceKind: 'camera',
      declaredMime: 'image/jpeg',
      declaredBytes: 1024,
      ordinal: 1,
      objectPath: 'forged/path.jpg',
      idempotencyKey: 'authorize-upload-0001',
      commandId: '92000000-0000-4000-8000-000000000002',
    })).toThrow(/unknown keys/i);
  });

  it('accepts only the bounded remove-image Owner command', () => {
    const request = {
      action: 'remove_scan_input',
      contractVersion: 'phase9-owner-ux-v1',
      sessionId: '92000000-0000-4000-8000-000000000001',
      inputId: '92000000-0000-4000-8000-000000000002',
      expectedInputVersion: 1,
      idempotencyKey: 'remove-input-command-0001',
      commandId: '92000000-0000-4000-8000-000000000003',
    };
    expect(parseOwnerIngestionRequest(request)).toEqual(request);
    expect(() => parseOwnerIngestionRequest({ ...request, objectPath: 'forged/path.jpg' }))
      .toThrow(/unknown keys/i);
  });

  it('requires a bounded service worker request and rejects user authority injection', () => {
    expect(parseWorkerIngestionRequest({
      contractVersion: 'phase9-v1',
      leaseOwner: 'worker-92000000-0000-4000-8000-000000000003',
      batchSize: 5,
    })).toEqual({
      contractVersion: 'phase9-v1',
      leaseOwner: 'worker-92000000-0000-4000-8000-000000000003',
      batchSize: 5,
    });
    expect(() => parseWorkerIngestionRequest({
      contractVersion: 'phase9-v1',
      leaseOwner: 'worker-92000000-0000-4000-8000-000000000003',
      batchSize: 5,
      actorId: 'forged',
    })).toThrow(/unknown keys/i);
    expect(parseDedicatedWorkerRequest({ contractVersion: 'phase9-v1', batchSize: 2 })).toEqual({ contractVersion: 'phase9-v1', batchSize: 2 });
    expect(() => parseDedicatedWorkerRequest({ contractVersion: 'phase9-v1', batchSize: 2, leaseOwner: 'forged-worker-id' })).toThrow(/unknown keys/i);
  });

  it('widens only the metadata run budget to fifteen', () => {
    expect(parseDedicatedMetadataWorkerRequest({
      contractVersion: 'phase9-v1', batchSize: 15,
    })).toEqual({ contractVersion: 'phase9-v1', batchSize: 15 });
    expect(() => parseDedicatedMetadataWorkerRequest({
      contractVersion: 'phase9-v1', batchSize: 16,
    })).toThrow(/invalid dedicated metadata worker request/i);
    expect(() => parseDedicatedWorkerRequest({
      contractVersion: 'phase9-v1', batchSize: 11,
    })).toThrow(/invalid dedicated worker request/i);
  });

  it('recursively rejects capabilities and private media fields from ordinary responses', () => {
    expect(() => assertSafeIngestionResponse({ ok: true, nested: { object_path: 'private' } })).toThrow(/forbidden/i);
    expect(() => assertSafeIngestionResponse({ ok: true, signedUrl: 'secret' })).toThrow(/forbidden/i);
    expect(() => assertSafeIngestionResponse({ ok: true, exif: { gps: 'private' } })).toThrow(/forbidden/i);
    expect(() => assertSafeIngestionResponse({ ok: true, capabilityId: 'private' })).toThrow(/forbidden/i);
    expect(() => assertSafeIngestionResponse({ ok: true, nested: { capability_id: 'private' } })).toThrow(/forbidden/i);
    expect(() => assertSafeIngestionResponse({ ok: true, nested: [{ uploadToken: 'private' }] })).toThrow(/forbidden/i);
    for (const key of [
      'accessToken', 'access_token', 'refreshToken', 'refresh_token',
      'providerSecret', 'provider_secret', 'serviceRoleKey', 'service_role_key',
      'supabaseServiceRoleKey', 'supabase_service_role_key', 'Authorization',
      'signedUploadUrl', 'signed_upload_url', 'capabilities',
    ]) {
      expect(() => assertSafeIngestionResponse({ ok: true, [key]: 'private' })).toThrow(/forbidden/i);
    }
    expect(() => assertSafeIngestionResponse({ ok: true, inputId: 'safe', state: 'uploaded' })).not.toThrow();
  });
});
