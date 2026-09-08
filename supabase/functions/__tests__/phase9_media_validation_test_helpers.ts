
import { sha256Hex, storedImageEnvelope } from '../_shared/imageInventory/media/sourceIdentity';

const sourceBytes = new Uint8Array([1, 2, 3]);
const outputBytes = new Uint8Array([4, 5, 6]);
export const claim = { id: 'media-job', attempt_count: 1, lease_token: 'a'.repeat(64) };

export type CompletionError = Readonly<{
  code?: string;
  status?: number;
  message?: string;
  details?: string;
}>;

type HarnessOptions = Readonly<{
  completionData?: Record<string, unknown>;
  completionError?: CompletionError;
  completionStatus?: number;
  targetConflict?: boolean;
  targetState?: 'compatible' | 'missing' | 'incompatible' | 'unauthorized';
  targetStore?: string;
  infoError?: { status: number };
  corruptBytes?: boolean;
  failureError?: CompletionError;
  failureThrows?: boolean;
}>;

export async function makeHarness(options: HarnessOptions = {}) {
  const sourceSha256 = await sha256Hex(sourceBytes);
  const outputSha256 = await sha256Hex(outputBytes);
  const targetStore = options.targetStore ?? 'store-a';
  const targetPath = `${targetStore}/scan_input/session/input/attempt-1.webp`;
  const sourceObject = {
    id: 'source-object-v1',
    updated_at: '2026-08-26T00:00:00Z',
    name: 'source.png',
    metadata: { size: sourceBytes.byteLength, mimetype: 'image/png', eTag: 'source-etag' },
  };
  const targetObject = {
    id: 'target-object-v1',
    updated_at: '2026-08-26T00:00:01Z',
    name: 'attempt-1.webp',
    metadata: {
      size: outputBytes.byteLength,
      mimetype: 'image/webp',
      eTag: 'target-etag',
    },
  };
  // Storage list metadata is system metadata. info() exposes custom metadata
  // separately from its top-level size/contentType (SDD 04 §6/§7).
  const targetInfo = {
    name: targetPath, size: outputBytes.byteLength, contentType: 'image/webp',
    metadata: { sha256: outputSha256, sanitizer: 'magick-wasm-0.0.41' },
  };
  if (options.targetState === 'incompatible') {
    targetInfo.metadata.sha256 = 'f'.repeat(64);
  }
  const sourceIdentity = (await storedImageEnvelope(sourceObject)).objectIdentity;
  const context = {
    source_bucket: 'marketplace-media-staging',
    source_path: 'store-a/scan_input/session/source.png',
    source_object_identity: sourceIdentity,
    source_sha256: sourceSha256,
    source_bytes: sourceBytes.byteLength,
    source_mime: 'image/png',
    snapshot_bucket: 'image-extraction-inputs',
    snapshot_path: `${targetStore}/scan_input/session/input/source-attempt-1.bin`,
    source_snapshot_path: null,
    source_snapshot_sha256: null,
    source_snapshot_bytes: null,
    target_bucket: 'image-extraction-inputs',
    target_path: targetPath,
    output_intent_version: 1,
  };
  const rpc = jest.fn().mockImplementation(async (name: string) => {
    if (name === 'claim_phase9_media_validation_jobs') return { data: [claim], error: null };
    if (name === 'phase9_prepare_media_validation_outputs') return { data: context, error: null };
    if (name === 'phase9_revalidate_media_validation_lease') return { data: true, error: null };
    if (name === 'phase9_bind_media_validation_snapshot') return { data: true, error: null };
    if (name === 'phase9_complete_media_validation') {
      return { data: options.completionData ?? { input_id: 'input', state: 'queued' }, error: options.completionError ?? null, status: options.completionStatus };
    }
    if (name === 'phase9_fail_media_validation') {
      if (options.failureThrows) throw new Error('private transport diagnostic');
      return { data: 'resolved', error: options.failureError ?? null };
    }
    throw new Error(`unexpected rpc ${name}`);
  });
  const list = jest.fn().mockImplementation(async (_prefix: string, listOptions: Record<string, unknown>) => {
    if (listOptions.search === 'attempt-1.webp') {
      if (options.targetState === 'unauthorized') return { data: null, error: { status: 403 } };
      return {
        data: options.targetState === 'missing' ? [] : [targetObject],
        error: null,
      };
    }
    return { data: [sourceObject], error: null };
  });
  const download = jest.fn().mockImplementation(async (path: string) => ({
    data: new Blob([path === targetPath ? (options.corruptBytes ? sourceBytes : outputBytes) : sourceBytes]),
    error: null,
  }));
  const upload = jest.fn().mockImplementation(async (path: string) => ({
    data: path === targetPath ? {} : {},
    error: path === targetPath && options.targetConflict
      ? { status: 409, message: 'object already exists' }
      : null,
  }));
  const remove = jest.fn().mockResolvedValue({ data: [{ name: targetPath }], error: null });
  const info = jest.fn().mockResolvedValue({
    data: options.targetState === 'missing' ? null : targetInfo,
    error: options.infoError ?? (options.targetState === 'unauthorized' ? { status: 403 } : null),
  });
  const client: any = {
    rpc,
    storage: { from: () => ({ list, download, upload, remove, info }) },
  };
  const processor: any = {
    sanitize: jest.fn().mockResolvedValue({
      bytes: outputBytes,
      outputMime: 'image/webp',
      sha256: outputSha256,
      width: 1,
      height: 1,
    }),
  };
  return { client, context, download, list, info, outputSha256, processor, remove, rpc, targetPath, upload };
}
