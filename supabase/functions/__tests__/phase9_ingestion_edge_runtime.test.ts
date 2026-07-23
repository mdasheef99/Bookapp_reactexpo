import { executeOwnerIngestion } from '../_shared/imageInventory/runtime/ownerIngestion';
import { runMediaValidationWorker } from '../_shared/imageInventory/runtime/mediaValidationWorker';
import fs from 'node:fs';
import path from 'node:path';
import { sha256Hex, storedImageEnvelope } from '../_shared/imageInventory/media/sourceIdentity';

const actor = '92000000-0000-4000-8000-000000000001';
const rpc = jest.fn();
const createSignedUploadUrl = jest.fn();
const list = jest.fn();
const download = jest.fn();
const upload = jest.fn();
const client: any = { rpc, storage: { from: () => ({ createSignedUploadUrl, list, download, upload }) } };

beforeEach(() => jest.resetAllMocks());

const sourceBytes = new Uint8Array([1, 2, 3]);
const storedObject = (id = 'v', etag = 'e') => ({
  id,
  updated_at: '2026-07-23T00:00:00Z',
  name: 'file.png',
  metadata: { size: sourceBytes.byteLength, mimetype: 'image/png', eTag: etag },
});

describe('Phase 9 ingestion Edge orchestration', () => {
  it('keeps Owner JWT auth in Edge and sanitation in a dedicated worker', () => {
    const ownerSource = fs.readFileSync(path.join(process.cwd(), 'supabase/functions/phase9-owner-ingestion/index.ts'), 'utf8');
    const workerSource = fs.readFileSync(path.join(process.cwd(), 'workers/phase9-media-validation-worker/index.ts'), 'utf8');
    const bootstrapSource = fs.readFileSync(path.join(process.cwd(), 'workers/phase9-media-validation-worker/bootstrap.ts'), 'utf8');
    expect(ownerSource).toContain('requireAuthenticatedUser');
    expect(workerSource).toContain('workerAuthToken');
    expect(workerSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(workerSource).not.toContain('requireAuthenticatedUser');
    expect(bootstrapSource).toContain('createImageMagickMediaProcessor(wasmBytes)');
    expect(bootstrapSource).not.toContain('Deno');
  });

  it('never accepts a client path and signs only the server-issued exact path', async () => {
    rpc.mockResolvedValueOnce({ data: { capability_id: 'cap', bucket_id: 'staging', object_path: 'server/exact.jpg', expires_at: 'soon' }, error: null });
    createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'transport', token: 'transport-token' }, error: null });
    const result = await executeOwnerIngestion({
      action: 'authorize_scan_upload', contractVersion: 'phase9-v1', sessionId: actor,
      sourceKind: 'camera', declaredMime: 'image/jpeg', declaredBytes: 10, ordinal: 1,
      idempotencyKey: 'authorize-upload-0001', commandId: actor,
    }, actor, client, client);
    expect(createSignedUploadUrl).toHaveBeenCalledWith('server/exact.jpg');
    expect(result).not.toHaveProperty('objectPath');
  });

  it('registers only exact observed object metadata and returns no path', async () => {
    rpc.mockResolvedValueOnce({ data: { bucket_id: 'staging', object_path: 'store/file.jpg', declared_bytes: 10, declared_mime: 'image/jpeg' }, error: null });
    list.mockResolvedValue({ data: [{
      id: 'version', updated_at: '2026-07-23T00:00:00Z', name: 'file.jpg',
      metadata: { size: 10, mimetype: 'image/jpeg', eTag: 'etag' },
    }], error: null });
    download.mockResolvedValue({ data: new Blob([new Uint8Array(10)]), error: null });
    rpc.mockResolvedValueOnce({ data: { input_id: 'input', job_id: 'job', state: 'uploaded' }, error: null });
    const result = await executeOwnerIngestion({
      action: 'complete_scan_upload', contractVersion: 'phase9-v1', capabilityId: actor,
      sourceKind: 'camera', idempotencyKey: 'complete-upload-0001', commandId: actor,
    }, actor, client, client);
    expect(rpc).toHaveBeenLastCalledWith('phase9_register_scan_upload_completion', expect.objectContaining({
      p_path: 'store/file.jpg',
      p_object_identity: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_source_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(result).toEqual({ inputId: 'input', jobId: 'job', state: 'uploaded' });
  });

  it.each([
    ['missing object', [], null],
    ['wrong path', [{ id: 'v', name: 'other.jpg', metadata: { size: 10, mimetype: 'image/jpeg', eTag: 'e' } }], null],
    ['wrong size', [{ id: 'v', name: 'file.jpg', metadata: { size: 11, mimetype: 'image/jpeg', eTag: 'e' } }], null],
    ['spoofed metadata MIME', [{ id: 'v', name: 'file.jpg', metadata: { size: 10, mimetype: 'image/png', eTag: 'e' } }], null],
  ])('rejects %s before completion registration', async (_label, objects) => {
    rpc.mockResolvedValueOnce({ data: { bucket_id: 'staging', object_path: 'store/file.jpg', declared_bytes: 10, declared_mime: 'image/jpeg' }, error: null });
    list.mockResolvedValue({ data: objects, error: null });
    await expect(executeOwnerIngestion({
      action: 'complete_scan_upload', contractVersion: 'phase9-v1', capabilityId: actor,
      sourceKind: 'camera', idempotencyKey: 'complete-invalid-0001', commandId: actor,
    }, actor, client, client)).rejects.toThrow('P9_MEDIA_NOT_APPROVED');
    expect(rpc).not.toHaveBeenCalledWith('phase9_register_scan_upload_completion', expect.anything());
  });

  it('sanitizes a claimed object and completes the exact lease once', async () => {
    const identity = (await storedImageEnvelope(storedObject())).objectIdentity;
    const sourceSha256 = await sha256Hex(sourceBytes);
    const claim = { id: 'job', attempt_count: 1, lease_token: 'a'.repeat(64) };
    rpc.mockResolvedValueOnce({ data: [claim], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png', source_object_identity: identity,
      source_sha256: sourceSha256, source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'store/source-attempt-1.bin',
      source_snapshot_path: null, source_snapshot_sha256: null, source_snapshot_bytes: null,
      target_bucket: 'private', target_path: 'store/input.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: { input_id: 'input' }, error: null });
    list.mockResolvedValue({ data: [storedObject()], error: null });
    download.mockResolvedValue({ data: new Blob([sourceBytes]), error: null });
    upload.mockResolvedValue({ data: {}, error: null });
    const processor: any = { sanitize: jest.fn().mockResolvedValue({
      bytes: new Uint8Array([4]), outputMime: 'image/webp', sha256: 'a'.repeat(64), width: 1, height: 1,
    }) };
    const result = await runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1 }, client, processor);
    expect(processor.sanitize).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('phase9_revalidate_media_validation_lease', expect.objectContaining({ p_job_id: 'job' }));
    expect(list).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith('store/source-attempt-1.bin', sourceBytes, expect.objectContaining({ upsert: false }));
    expect(upload).toHaveBeenCalledWith('store/input.webp', expect.any(Uint8Array), expect.objectContaining({ upsert: false }));
    expect(rpc).toHaveBeenCalledWith('phase9_bind_media_validation_snapshot', expect.objectContaining({
      p_job_id: 'job', p_snapshot_sha256: sourceSha256, p_lease_token: claim.lease_token,
    }));
    expect(rpc).toHaveBeenLastCalledWith('phase9_complete_media_validation', expect.objectContaining({
      p_job_id: 'job', p_worker: 'worker-0000000001', p_attempt_count: 1, p_lease_token: claim.lease_token,
    }));
    expect(result).toEqual({ claimed: 1, results: [{ jobId: 'job', outcome: 'queued', inputId: 'input' }] });
  });

  it('rejects an object changed during processing before lease revalidation or upload', async () => {
    const identity = (await storedImageEnvelope(storedObject('v1', 'e1'))).objectIdentity;
    const sourceSha256 = await sha256Hex(sourceBytes);
    rpc.mockResolvedValueOnce({ data: [{ id: 'job', attempt_count: 1, lease_token: 'b'.repeat(64) }], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png', source_object_identity: identity,
      source_sha256: sourceSha256, source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'source-attempt-1.bin',
      source_snapshot_path: null, source_snapshot_sha256: null, source_snapshot_bytes: null,
      target_bucket: 'private', target_path: 'attempt-1.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: 'resolved', error: null });
    list.mockResolvedValueOnce({ data: [storedObject('v1', 'e1')], error: null });
    list.mockResolvedValueOnce({ data: [storedObject('v2', 'e2')], error: null });
    download.mockResolvedValue({ data: new Blob([sourceBytes]), error: null });
    const processor: any = { sanitize: jest.fn().mockResolvedValue({
      bytes: new Uint8Array([4]), outputMime: 'image/webp', sha256: 'a'.repeat(64), width: 1, height: 1,
    }) };
    await runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1 }, client, processor);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith('phase9_revalidate_media_validation_lease', expect.anything());
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({ p_safe_error_code: 'P9_MEDIA_OBJECT_CHANGED' }));
  });

  it('rejects stale lease revalidation before attempt-fenced output upload', async () => {
    const sourceSha256 = await sha256Hex(sourceBytes);
    rpc.mockResolvedValueOnce({ data: [{
      id: 'job', attempt_count: 1, lease_token: 'c'.repeat(64),
    }], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png', source_object_identity: 'd'.repeat(64),
      source_sha256: sourceSha256, source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'source-attempt-1.bin',
      source_snapshot_path: 'source-attempt-1.bin', source_snapshot_sha256: sourceSha256, source_snapshot_bytes: 3,
      target_bucket: 'private', target_path: 'attempt-1.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'stale' } });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'stale' } });
    download.mockResolvedValue({ data: new Blob([sourceBytes]), error: null });
    const processor: any = { sanitize: jest.fn().mockResolvedValue({
      bytes: new Uint8Array([4]), outputMime: 'image/webp', sha256: 'a'.repeat(64), width: 1, height: 1,
    }) };
    const result = await runMediaValidationWorker({ contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1 }, client, processor);
    expect(upload).not.toHaveBeenCalled();
    expect(result.results[0].outcome).toBe('stale_lease');
    expect(rpc).toHaveBeenCalledWith('phase9_revalidate_media_validation_lease', expect.objectContaining({
      p_worker: 'worker-0000000001',
      p_attempt_count: 1,
      p_lease_token: 'c'.repeat(64),
    }));
  });

  it('rejects an immutable source snapshot whose bytes no longer match its persisted hash', async () => {
    const expectedSha = await sha256Hex(sourceBytes);
    rpc.mockResolvedValueOnce({ data: [{
      id: 'job', attempt_count: 2, lease_token: 'f'.repeat(64),
    }], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png',
      source_object_identity: 'a'.repeat(64), source_sha256: expectedSha,
      source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'source-attempt-1.bin',
      source_snapshot_path: 'source-attempt-1.bin', source_snapshot_sha256: expectedSha, source_snapshot_bytes: 3,
      target_bucket: 'private', target_path: 'attempt-2.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: 'resolved', error: null });
    download.mockResolvedValue({ data: new Blob([new Uint8Array([9, 9, 9])]), error: null });
    const processor = { sanitize: jest.fn() } as any;
    await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1,
    }, client, processor);
    expect(processor.sanitize).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({
      p_safe_error_code: 'P9_MEDIA_OBJECT_CHANGED',
      p_retryable: false,
      p_attempt_count: 2,
      p_lease_token: 'f'.repeat(64),
    }));
  });

  it.each(['list', 'download'])('keeps temporary Storage %s failures retryable', async (failure) => {
    const identity = (await storedImageEnvelope(storedObject())).objectIdentity;
    const sourceSha256 = await sha256Hex(sourceBytes);
    rpc.mockResolvedValueOnce({ data: [{
      id: 'job', attempt_count: 1, lease_token: 'e'.repeat(64),
    }], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png',
      source_object_identity: identity, source_sha256: sourceSha256,
      source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'source-attempt-1.bin',
      source_snapshot_path: null, source_snapshot_sha256: null, source_snapshot_bytes: null,
      target_bucket: 'private', target_path: 'attempt-1.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: 'retry_scheduled', error: null });
    if (failure === 'list') {
      list.mockResolvedValue({ data: null, error: { status: 503 } });
    } else {
      list.mockResolvedValue({ data: [storedObject()], error: null });
      download.mockResolvedValue({ data: null, error: { status: 429 } });
    }
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1,
    }, client, { sanitize: jest.fn() } as any);
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({
      p_retryable: true,
      p_safe_error_code: 'P9_MEDIA_PROCESSING_RETRYABLE',
      p_attempt_count: 1,
      p_lease_token: 'e'.repeat(64),
    }));
    expect(result.results[0].outcome).toBe('retry_scheduled');
  });

  it('keeps a temporary second Storage metadata read failure retryable', async () => {
    const identity = (await storedImageEnvelope(storedObject())).objectIdentity;
    const sourceSha256 = await sha256Hex(sourceBytes);
    rpc.mockResolvedValueOnce({ data: [{
      id: 'job', attempt_count: 1, lease_token: '1'.repeat(64),
    }], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png',
      source_object_identity: identity, source_sha256: sourceSha256,
      source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'source-attempt-1.bin',
      source_snapshot_path: null, source_snapshot_sha256: null, source_snapshot_bytes: null,
      target_bucket: 'private', target_path: 'attempt-1.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: 'retry_scheduled', error: null });
    list.mockResolvedValueOnce({ data: [storedObject()], error: null });
    list.mockResolvedValueOnce({ data: null, error: { status: 503 } });
    download.mockResolvedValue({ data: new Blob([sourceBytes]), error: null });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1,
    }, client, { sanitize: jest.fn() } as any);
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({
      p_retryable: true, p_safe_error_code: 'P9_MEDIA_PROCESSING_RETRYABLE',
    }));
    expect(result.results[0].outcome).toBe('retry_scheduled');
  });

  it('treats output-upload success followed by database completion failure as retryable', async () => {
    const sourceSha256 = await sha256Hex(sourceBytes);
    rpc.mockResolvedValueOnce({ data: [{
      id: 'job', attempt_count: 2, lease_token: '2'.repeat(64),
    }], error: null });
    rpc.mockResolvedValueOnce({ data: {
      source_bucket: 'staging', source_path: 'store/file.png',
      source_object_identity: 'a'.repeat(64), source_sha256: sourceSha256,
      source_bytes: 3, source_mime: 'image/png',
      snapshot_bucket: 'private', snapshot_path: 'source-attempt-1.bin',
      source_snapshot_path: 'source-attempt-1.bin', source_snapshot_sha256: sourceSha256, source_snapshot_bytes: 3,
      target_bucket: 'private', target_path: 'attempt-2.webp',
    }, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'database unavailable' } });
    rpc.mockResolvedValueOnce({ data: 'retry_scheduled', error: null });
    download.mockResolvedValue({ data: new Blob([sourceBytes]), error: null });
    upload.mockResolvedValue({ data: {}, error: null });
    const result = await runMediaValidationWorker({
      contractVersion: 'phase9-v1', leaseOwner: 'worker-0000000001', batchSize: 1,
    }, client, { sanitize: jest.fn().mockResolvedValue({
      bytes: new Uint8Array([4]), outputMime: 'image/webp', sha256: '3'.repeat(64), width: 1, height: 1,
    }) } as any);
    expect(upload).toHaveBeenCalledWith('attempt-2.webp', expect.any(Uint8Array), expect.objectContaining({ upsert: false }));
    expect(rpc).toHaveBeenCalledWith('phase9_complete_media_validation', expect.objectContaining({
      p_attempt_count: 2, p_lease_token: '2'.repeat(64),
    }));
    expect(rpc).toHaveBeenLastCalledWith('phase9_fail_media_validation', expect.objectContaining({
      p_retryable: true, p_safe_error_code: 'P9_MEDIA_PROCESSING_RETRYABLE',
    }));
    expect(result.results[0].outcome).toBe('retry_scheduled');
  });
});
