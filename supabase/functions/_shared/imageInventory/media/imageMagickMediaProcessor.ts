import {
  ConfigurationFiles,
  ImageMagick,
  MagickFormat,
  initializeImageMagick,
} from '@imagemagick/magick-wasm';

export type MediaLimits = Readonly<{
  maxBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
}>;

export type SanitizeInput = Readonly<{
  bytes: Uint8Array;
  declaredMime: 'image/jpeg' | 'image/png' | 'image/webp';
  limits: MediaLimits;
}>;

export type SanitizedMedia = Readonly<{
  bytes: Uint8Array;
  detectedMime: 'image/jpeg' | 'image/png' | 'image/webp';
  outputMime: 'image/webp';
  width: number;
  height: number;
  sha256: string;
  metadataRemoved: true;
}>;

export interface MediaProcessor {
  sanitize(input: SanitizeInput): Promise<SanitizedMedia>;
}

export const PHASE9_IMAGEMAGICK_RESOURCE_POLICY = Object.freeze({
  area: '64MP',
  purpose: 'internal decode/cache working allowance only',
  sourceImageMaxPixels: 16_000_000,
  sourceCeilingEnforced: 'before decode when headers permit and again after decode',
});

export class MediaProcessingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'MediaProcessingError';
  }
}

let initialized: Promise<void> | undefined;

function detectMime(bytes: Uint8Array): SanitizeInput['declaredMime'] | null {
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, i) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i])) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

function isAnimatedOrMultiframe(bytes: Uint8Array, mime: SanitizeInput['declaredMime']): boolean {
  const decoder = new TextDecoder();
  if (mime === 'image/png') {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
      const length = view.getUint32(0);
      if (length > bytes.length - offset - 12) return false;
      const chunk = decoder.decode(bytes.slice(offset + 4, offset + 8));
      if (chunk === 'acTL') return true;
      offset += 12 + length;
      if (chunk === 'IEND') break;
    }
  }
  if (mime === 'image/webp') {
    if (bytes.length >= 21 && decoder.decode(bytes.slice(12, 16)) === 'VP8X' && (bytes[20] & 0x02) !== 0) return true;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const chunk = decoder.decode(bytes.slice(offset, offset + 4));
      if (chunk === 'ANIM' || chunk === 'ANMF') return true;
      const length = bytes[offset + 4] | (bytes[offset + 5] << 8)
        | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
      if (length < 0 || length > bytes.length - offset - 8) break;
      offset += 8 + length + (length & 1);
    }
  }
  return false;
}

function headerDimensions(bytes: Uint8Array, mime: SanitizeInput['declaredMime']): { width: number; height: number } | null {
  if (mime === 'image/png' && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2 || offset + 2 + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
      }
      offset += 2 + length;
    }
  }
  if (mime === 'image/webp' && bytes.length >= 25) {
    const chunk = new TextDecoder().decode(bytes.slice(12, 16));
    if (chunk === 'VP8X' && bytes.length >= 30) return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
    if (chunk === 'VP8L' && bytes[20] === 0x2f) return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  return null;
}

function enforceDimensions(dimensions: { width: number; height: number }, limits: MediaLimits): void {
  if (dimensions.width < 1 || dimensions.height < 1) throw new MediaProcessingError('P9_MEDIA_DECODE_FAILED');
  if (dimensions.width > limits.maxWidth || dimensions.height > limits.maxHeight) throw new MediaProcessingError('P9_MEDIA_DIMENSIONS_EXCEEDED');
  if (dimensions.width * dimensions.height > limits.maxPixels) throw new MediaProcessingError('P9_MEDIA_PIXEL_LIMIT');
}

async function digest(bytes: Uint8Array): Promise<string> {
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(result)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function createImageMagickMediaProcessor(wasmBytes: Uint8Array): Promise<MediaProcessor> {
  if (!initialized) {
    const configuration = ConfigurationFiles.default;
    configuration.policy.data = `<?xml version="1.0" encoding="UTF-8"?>
<policymap><policy domain="resource" name="width" value="8192"/>
<policy domain="resource" name="height" value="8192"/><policy domain="resource" name="area" value="${PHASE9_IMAGEMAGICK_RESOURCE_POLICY.area}"/>
<policy domain="resource" name="memory" value="1GiB"/><policy domain="resource" name="map" value="2GiB"/>
<policy domain="resource" name="disk" value="0"/><policy domain="resource" name="thread" value="2"/></policymap>`;
    initialized = initializeImageMagick(wasmBytes, configuration);
  }
  await initialized;

  return {
    async sanitize(input: SanitizeInput): Promise<SanitizedMedia> {
      if (input.bytes.byteLength > input.limits.maxBytes) throw new MediaProcessingError('P9_MEDIA_TOO_LARGE');
      const detectedMime = detectMime(input.bytes);
      if (!detectedMime) throw new MediaProcessingError('P9_MEDIA_SIGNATURE_INVALID');
      if (detectedMime !== input.declaredMime) throw new MediaProcessingError('P9_MEDIA_MIME_MISMATCH');
      if (isAnimatedOrMultiframe(input.bytes, detectedMime)) {
        throw new MediaProcessingError('P9_MEDIA_MULTIFRAME_UNSUPPORTED');
      }
      const dimensions = headerDimensions(input.bytes, detectedMime);
      if (dimensions) enforceDimensions(dimensions, input.limits);

      try {
        const result = ImageMagick.read(input.bytes, (image) => {
          enforceDimensions({ width: image.width, height: image.height }, input.limits);
          image.autoOrient();
          image.strip();
          image.quality = 82;
          return image.write(MagickFormat.WebP, (data) => ({ bytes: Uint8Array.from(data), width: image.width, height: image.height }));
        });
        return { ...result, detectedMime, outputMime: 'image/webp', sha256: await digest(result.bytes), metadataRemoved: true };
      } catch (error) {
        if (error instanceof MediaProcessingError) throw error;
        throw new MediaProcessingError('P9_MEDIA_DECODE_FAILED');
      }
    },
  };
}
