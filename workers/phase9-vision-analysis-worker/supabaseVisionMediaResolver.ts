import { SpineAnalysisRequest } from '../../supabase/functions/_shared/imageInventory/contracts/vision';

type ServiceClient = Readonly<{
  storage: {
    from(bucket: string): {
      download(path: string): Promise<Readonly<{ data: Blob | null; error: unknown }>>;
    };
  };
}>;
export type VisionMediaAuthorization = Readonly<{
  mediaBucket: string;
  mediaPath: string;
  mediaMime: 'image/webp';
}>;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BUCKET = /^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/u;
const PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,511}$/u;

function authorization(value: unknown): VisionMediaAuthorization {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('P9_VISION_MEDIA_UNAVAILABLE');
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 3
    || typeof input.mediaBucket !== 'string' || !BUCKET.test(input.mediaBucket)
    || typeof input.mediaPath !== 'string' || !PATH.test(input.mediaPath)
    || input.mediaPath.includes('..') || input.mediaPath.startsWith('/')
    || input.mediaMime !== 'image/webp') {
    throw new Error('P9_VISION_MEDIA_UNAVAILABLE');
  }
  return input as VisionMediaAuthorization;
}

/**
 * Downloads only the media handle returned by the claim-validating registration
 * RPC. Database paths never enter the provider-neutral vision contract.
 */
export function createSupabaseVisionMediaResolver(client: ServiceClient) {
  return async (_request: SpineAnalysisRequest, value?: unknown) => {
    const authorized = authorization(value);
    const downloaded = await client.storage.from(authorized.mediaBucket)
      .download(authorized.mediaPath);
    if (downloaded.error || !downloaded.data) {
      throw new Error('P9_VISION_MEDIA_UNAVAILABLE');
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('P9_VISION_MEDIA_UNAVAILABLE');
    }
    return { bytes, mimeType: authorized.mediaMime };
  };
}
