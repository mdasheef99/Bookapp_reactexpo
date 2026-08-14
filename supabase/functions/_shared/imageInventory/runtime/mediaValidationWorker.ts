import { PHASE9_MEDIA_ENVELOPE, WorkerIngestionRequest } from '../contracts/ingestion';
import { MediaProcessingError, MediaProcessor } from '../media/imageMagickMediaProcessor';
import {
  sha256Hex,
  StoredImageObject,
  storedImageEnvelope,
} from '../media/sourceIdentity';

type RpcResult = { data: any; error: { message?: string } | null };
type Bucket = {
  list(prefix: string, options: Record<string, unknown>): Promise<{ data: StoredImageObject[] | null; error: unknown }>;
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
  upload(path: string, bytes: Uint8Array, options: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};
type Client = { rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>; storage: { from(bucket: string): Bucket } };
type Claim = Readonly<{ id: string; attempt_count: number; lease_token: string }>;

class StorageTransportError extends Error {}

function unwrap(result: RpcResult): any {
  if (result.error) throw new Error('P9_INTERNAL_ERROR');
  return result.data;
}

function splitPath(path: string) {
  const index = path.lastIndexOf('/');
  if (index < 1) throw new MediaProcessingError('P9_MEDIA_PATH_INVALID');
  return { prefix: path.slice(0, index), name: path.slice(index + 1) };
}

async function exactSource(bucket: Bucket, path: string): Promise<StoredImageObject> {
  const { prefix, name } = splitPath(path);
  const listed = await bucket.list(prefix, { search: name, limit: 2 });
  if (listed.error) throw new StorageTransportError('P9_STORAGE_LIST_FAILED');
  const exact = listed.data?.filter((item) => item.name === name) ?? [];
  if (exact.length !== 1) throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  return exact[0];
}

async function readBytes(bucket: Bucket, path: string): Promise<Uint8Array> {
  const downloaded = await bucket.download(path);
  if (downloaded.error) throw new StorageTransportError('P9_STORAGE_READ_FAILED');
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
  try {
    const context = unwrap(await client.rpc('phase9_media_validation_context', leaseArgs(job, leaseOwner)));
    const sourceBytes = await verifiedSnapshotBytes(client, context, job, leaseOwner);
    const sanitized = await processor.sanitize({
      bytes: sourceBytes,
      declaredMime: context.source_mime,
      limits: PHASE9_MEDIA_ENVELOPE,
    });

    await revalidate(client, context, job, leaseOwner);
    const outputUpload = await client.storage.from(context.target_bucket).upload(
      context.target_path,
      sanitized.bytes,
      {
        contentType: sanitized.outputMime,
        cacheControl: '0',
        upsert: false,
        metadata: { sha256: sanitized.sha256, sanitizer: 'magick-wasm-0.0.41' },
      },
    );
    if (outputUpload.error) throw new StorageTransportError('P9_STORAGE_WRITE_FAILED');
    await revalidate(client, context, job, leaseOwner);
    const completed = unwrap(await client.rpc('phase9_complete_media_validation', {
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
    const permanent = error instanceof MediaProcessingError;
    const code = permanent ? error.code : 'P9_MEDIA_PROCESSING_RETRYABLE';
    const failed = await client.rpc('phase9_fail_media_validation', {
      ...leaseArgs(job, leaseOwner),
      p_retryable: !permanent,
      p_safe_error_code: code,
    });
    if (failed.error) return { jobId: job.id, outcome: 'stale_lease' };
    return { jobId: job.id, outcome: failed.data };
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
