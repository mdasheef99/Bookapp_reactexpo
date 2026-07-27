import { createHash, timingSafeEqual } from 'node:crypto';
import { SpineAnalysisRequest } from '../../supabase/functions/_shared/imageInventory/contracts/vision';

type QueryResult = Readonly<{ data: any; error: unknown }>;
type Query = {
  select(columns: string): Query;
  eq(column: string, value: unknown): Query;
  single(): Promise<QueryResult>;
};
type ServiceClient = Readonly<{
  from(table: string): Query;
  storage: {
    from(bucket: string): {
      download(path: string): Promise<Readonly<{ data: Blob | null; error: unknown }>>;
    };
  };
}>;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function sameOpaqueReference(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function opaqueReference(mediaId: string, jobId: string): string {
  return `media_${createHash('sha256').update(`${mediaId}:${jobId}`).digest('hex').slice(0, 48)}`;
}

function invalid(): never {
  throw new Error('P9_VISION_MEDIA_UNAVAILABLE');
}

/**
 * Resolves the opaque analyzer reference inside the server boundary. Bucket and
 * object-path values never cross into the analyzer request, result, or logs.
 */
export function createSupabaseVisionMediaResolver(client: ServiceClient) {
  return async (request: SpineAnalysisRequest) => {
    const job = await client.from('image_extraction_jobs')
      .select('id,entity_id,store_id,job_kind,status,correlation_id')
      .eq('correlation_id', request.correlationId)
      .eq('job_kind', 'vision_extract')
      .single();
    if (job.error || !job.data || job.data.status !== 'in_progress') invalid();

    const input = await client.from('image_extraction_inputs')
      .select('id,media_asset_id,store_id')
      .eq('id', job.data.entity_id)
      .single();
    if (input.error || !input.data || input.data.store_id !== job.data.store_id) invalid();

    const media = await client.from('media_assets')
      .select([
        'id', 'store_id', 'bucket_id', 'object_path', 'detected_mime',
        'purpose', 'privacy_class', 'lifecycle_status', 'validated_at',
      ].join(','))
      .eq('id', input.data.media_asset_id)
      .single();
    if (media.error || !media.data
      || media.data.store_id !== job.data.store_id
      || media.data.purpose !== 'scan_input'
      || media.data.privacy_class !== 'private_scan'
      || media.data.lifecycle_status !== 'linked'
      || media.data.detected_mime !== 'image/webp'
      || !media.data.validated_at
      || !sameOpaqueReference(
        request.sanitizedMediaReference,
        opaqueReference(media.data.id, job.data.id),
      )) invalid();

    const downloaded = await client.storage.from(media.data.bucket_id)
      .download(media.data.object_path);
    if (downloaded.error || !downloaded.data) invalid();
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_IMAGE_BYTES) invalid();
    return { bytes, mimeType: 'image/webp' as const };
  };
}
