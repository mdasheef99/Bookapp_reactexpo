import { PHASE9_MEDIA_ENVELOPE, WorkerIngestionRequest } from '../contracts/ingestion';
import { MediaProcessingError, MediaProcessor } from '../media/imageMagickMediaProcessor';
import {
  sha256Hex,
  StoredImageObject,
  storedImageEnvelope,
} from '../media/sourceIdentity';

import { RpcResult, MediaCompletionStaleLeaseError,
  MediaReconciliationError, isStaleLease, unwrap, unwrapCompletion } from './mediaValidationErrors';
type Bucket = {
  info(path: string): Promise<{ data: { name: string; size?: number; contentType?: string; metadata?: Record<string, unknown> } | null; error: unknown }>;
  list(prefix: string, options: Record<string, unknown>): Promise<{ data: StoredImageObject[] | null; error: unknown }>;
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
  upload(path: string, bytes: Uint8Array, options: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};
type Client = { rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>; storage: { from(bucket: string): Bucket } };
type Claim = Readonly<{ id: string; attempt_count: number; lease_token: string }>;

class StorageTransportError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super(code);
    this.name = 'StorageTransportError';
  }
}

function storageObjectConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const status = Number(record.status);
  const text = [record.message, record.error].filter((value) => value !== undefined).join(' ').toLowerCase();
  return status === 409 || /already exists|duplicate object|object exists/u.test(text);
}

function storageStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = Number((error as Record<string, unknown>).status);
  return Number.isFinite(status) ? status : undefined;
}

function splitPath(path: string) {
  const index = path.lastIndexOf('/');
  if (index < 1) throw new MediaProcessingError('P9_MEDIA_PATH_INVALID');
  return { prefix: path.slice(0, index), name: path.slice(index + 1) };
}

async function exactSource(bucket: Bucket, path: string): Promise<StoredImageObject> {
  const { prefix, name } = splitPath(path);
  const listed = await bucket.list(prefix, { search: name, limit: 2 });
  if (listed.error) {
    if ([403, 404].includes(storageStatus(listed.error) ?? 0)) {
      throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
    }
    throw new StorageTransportError('P9_STORAGE_LIST_FAILED', storageStatus(listed.error));
  }
  const exact = listed.data?.filter((item) => item.name === name) ?? [];
  if (exact.length !== 1) throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  return exact[0];
}

async function readBytes(bucket: Bucket, path: string): Promise<Uint8Array> {
  const downloaded = await bucket.download(path);
  if (downloaded.error) {
    if ([403, 404].includes(storageStatus(downloaded.error) ?? 0)) {
      throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
    }
    throw new StorageTransportError('P9_STORAGE_READ_FAILED', storageStatus(downloaded.error));
  }
  if (!downloaded.data) throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  return new Uint8Array(await downloaded.data.arrayBuffer());
}

function leaseArgs(job: Claim, leaseOwner: string) {
  return {
    p_job_id: job.id,
    p_worker: leaseOwner,
    p_lease_token: job.lease_token,
    p_attempt_count: job.attempt_count,
  };
}

async function revalidate(client: Client, context: any, job: Claim, leaseOwner: string): Promise<void> {
  unwrap(await client.rpc('phase9_revalidate_media_validation_lease', {
    ...leaseArgs(job, leaseOwner),
    p_source_identity: context.source_object_identity,
    p_source_sha256: context.source_sha256,
  }));
}

async function verifyExistingSanitizedOutput(
  bucket: Bucket,
  path: string,
  sanitized: Awaited<ReturnType<MediaProcessor['sanitize']>>,
): Promise<void> {
  // SDD 04 §6/§7: list() has system metadata only; info() supplies custom
  // metadata and the actual object size/content type as separate fields.
  const result = await bucket.info(path);
  if (result.error) {
    if ([403, 404].includes(storageStatus(result.error) ?? 0)) {
      throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
    }
    throw new StorageTransportError('P9_STORAGE_INFO_FAILED', storageStatus(result.error));
  }
  const existing = result.data;
  if (!existing || existing.name !== path) throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  const metadata = existing.metadata ?? {};
  if (metadata.sha256 !== sanitized.sha256
    || metadata.sanitizer !== 'magick-wasm-0.0.41'
    || existing.contentType !== sanitized.outputMime
    || existing.size !== sanitized.bytes.byteLength) {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }
  const bytes = await readBytes(bucket, path);
  if (bytes.byteLength !== sanitized.bytes.byteLength
    || await sha256Hex(bytes) !== sanitized.sha256) {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }
}

async function uploadSanitizedOutput(
  client: Client,
  context: any,
  sanitized: Awaited<ReturnType<MediaProcessor['sanitize']>>,
): Promise<boolean> {
  const bucket = client.storage.from(context.target_bucket);
  const outputUpload = await bucket.upload(
    context.target_path,
    sanitized.bytes,
    {
      contentType: sanitized.outputMime,
      cacheControl: '0',
      upsert: false,
      metadata: { sha256: sanitized.sha256, sanitizer: 'magick-wasm-0.0.41' },
    },
  );
  if (!outputUpload.error) return true;
  if (!storageObjectConflict(outputUpload.error)) throw new StorageTransportError('P9_STORAGE_WRITE_FAILED');
  await verifyExistingSanitizedOutput(bucket, context.target_path, sanitized);
  return false;
}

async function verifiedSnapshotBytes(
  client: Client,
  context: any,
  job: Claim,
  leaseOwner: string,
): Promise<Uint8Array> {
  const snapshotBucket = client.storage.from(context.snapshot_bucket);
  if (context.source_snapshot_path && context.source_snapshot_sha256) {
    const bytes = await readBytes(snapshotBucket, context.source_snapshot_path);
    if (bytes.byteLength !== context.source_snapshot_bytes
      || await sha256Hex(bytes) !== context.source_snapshot_sha256) {
      throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
    }
    return bytes;
  }

  const stagingBucket = client.storage.from(context.source_bucket);
  const before = await storedImageEnvelope(await exactSource(stagingBucket, context.source_path))
    .catch((error) => {
      if (error instanceof MediaProcessingError || error instanceof StorageTransportError) throw error;
      throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
    });
  if (before.objectIdentity !== context.source_object_identity
    || before.size !== context.source_bytes || before.mime !== context.source_mime) {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }
  const sourceBytes = await readBytes(stagingBucket, context.source_path);
  if (sourceBytes.byteLength !== context.source_bytes
    || await sha256Hex(sourceBytes) !== context.source_sha256) {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }
  const after = await storedImageEnvelope(await exactSource(stagingBucket, context.source_path))
    .catch((error) => {
      if (error instanceof MediaProcessingError || error instanceof StorageTransportError) throw error;
      throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
    });
  if (after.objectIdentity !== context.source_object_identity) {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }

  await revalidate(client, context, job, leaseOwner);
  const snapshotUpload = await snapshotBucket.upload(context.snapshot_path, sourceBytes, {
    contentType: context.source_mime,
    cacheControl: '0',
    upsert: false,
    metadata: { sourceSha256: context.source_sha256, snapshotVersion: 'phase9-source-v1' },
  });
  if (snapshotUpload.error) throw new StorageTransportError('P9_STORAGE_WRITE_FAILED');
  const snapshotBytes = await readBytes(snapshotBucket, context.snapshot_path);
  const snapshotSha256 = await sha256Hex(snapshotBytes);
  if (snapshotBytes.byteLength !== context.source_bytes || snapshotSha256 !== context.source_sha256) {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }
  unwrap(await client.rpc('phase9_bind_media_validation_snapshot', {
    ...leaseArgs(job, leaseOwner),
    p_snapshot_path: context.snapshot_path,
    p_snapshot_sha256: snapshotSha256,
    p_snapshot_bytes: snapshotBytes.byteLength,
    p_snapshot_mime: context.source_mime,
  }));
  return snapshotBytes;
}

async function processClaim(client: Client, processor: MediaProcessor, job: Claim, leaseOwner: string) {
  let outputMayExist = false;
  try {
    const context = unwrap(await client.rpc('phase9_prepare_media_validation_outputs', leaseArgs(job, leaseOwner)));
    if (context?.output_intent_version !== 1) throw new MediaReconciliationError();
    const sourceBytes = await verifiedSnapshotBytes(client, context, job, leaseOwner);
    const sanitized = await processor.sanitize({
      bytes: sourceBytes,
      declaredMime: context.source_mime,
      limits: PHASE9_MEDIA_ENVELOPE,
    });

    await revalidate(client, context, job, leaseOwner);
    outputMayExist = true;
    await uploadSanitizedOutput(client, context, sanitized);
    await revalidate(client, context, job, leaseOwner);
    const completed = unwrapCompletion(await client.rpc('phase9_complete_media_validation', {
      ...leaseArgs(job, leaseOwner),
      p_source_identity: context.source_object_identity,
      p_source_sha256: context.source_sha256,
      p_snapshot_path: context.source_snapshot_path ?? context.snapshot_path,
      p_target_path: context.target_path,
      p_sha256: sanitized.sha256,
      p_bytes: sanitized.bytes.byteLength,
      p_width: sanitized.width,
      p_height: sanitized.height,
    }));
    return {
      jobId: job.id,
      outcome: completed.state ?? 'queued',
      ...(completed.input_id ? { inputId: completed.input_id } : {}),
      ...(completed.media_asset_id ? { mediaAssetId: completed.media_asset_id } : {}),
    };
  } catch (error) {
    // SDD 04 §12: retain potentially referenced objects until an authoritative
    // lifecycle consumer can fence deletion. This flag is evidence, not a queue.
    const cleanup = outputMayExist ? { cleanupRequired: true } : {};
    if (error instanceof MediaCompletionStaleLeaseError) return { jobId: job.id, outcome: 'stale_lease', ...cleanup };
    if (error instanceof MediaReconciliationError) return {
      jobId: job.id, outcome: 'reconciliation_required', reason: 'completion_conflict', ...cleanup,
    };
    const permanent = error instanceof MediaProcessingError;
    const code = permanent ? error.code : 'P9_MEDIA_PROCESSING_RETRYABLE';
    let failed: RpcResult;
    try {
      failed = await client.rpc('phase9_fail_media_validation', {
        ...leaseArgs(job, leaseOwner), p_retryable: !permanent, p_safe_error_code: code,
      });
    } catch {
      return { jobId: job.id, outcome: 'reconciliation_required', reason: 'failure_persistence_unknown', ...cleanup };
    }
    if (failed.error) return isStaleLease(failed.error)
      ? { jobId: job.id, outcome: 'stale_lease', ...cleanup }
      : { jobId: job.id, outcome: 'reconciliation_required', reason: 'failure_persistence_unknown', ...cleanup };
    return { jobId: job.id, outcome: failed.data, ...cleanup };
  }
}

export async function runMediaValidationWorker(
  request: WorkerIngestionRequest,
  client: Client,
  processor: MediaProcessor,
) {
  const claimed = unwrap(await client.rpc('claim_phase9_media_validation_jobs', {
    p_batch_size: request.batchSize,
    p_worker: request.leaseOwner,
  })) as Claim[];
  const results = [];
  for (const job of claimed) results.push(await processClaim(client, processor, job, request.leaseOwner));
  return { claimed: claimed.length, results };
}
