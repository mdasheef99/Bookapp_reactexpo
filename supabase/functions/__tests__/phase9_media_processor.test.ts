import fs from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';

let createImageMagickMediaProcessor: typeof import('../_shared/imageInventory/media/imageMagickMediaProcessor').createImageMagickMediaProcessor;
let resourcePolicy: typeof import('../_shared/imageInventory/media/imageMagickMediaProcessor').PHASE9_IMAGEMAGICK_RESOURCE_POLICY;
let wasm: Uint8Array;

const onePixelPng = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
));

describe('Phase 9 ImageMagick media processor', () => {
  beforeAll(async () => {
    Object.assign(globalThis, { TextDecoder, TextEncoder });
    ({
      createImageMagickMediaProcessor,
      PHASE9_IMAGEMAGICK_RESOURCE_POLICY: resourcePolicy,
    } = require('../_shared/imageInventory/media/imageMagickMediaProcessor'));
    const wasmPath = path.join(process.cwd(), 'node_modules', '@imagemagick', 'magick-wasm', 'dist', 'magick.wasm');
    wasm = await fs.readFile(wasmPath);
  }, 30_000);

  it('validates, decodes, re-encodes and reports a sanitized image', async () => {
    const processor = await createImageMagickMediaProcessor(wasm);
    const result = await processor.sanitize({
      bytes: onePixelPng,
      declaredMime: 'image/png',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    });
    expect(result.detectedMime).toBe('image/png');
    expect(result.outputMime).toBe('image/webp');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.metadataRemoved).toBe(true);
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it('rejects spoofed, oversized, malformed and undecodable input', async () => {
    const processor = await createImageMagickMediaProcessor(wasm);
    await expect(processor.sanitize({
      bytes: onePixelPng,
      declaredMime: 'image/jpeg',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_MIME_MISMATCH' });
    await expect(processor.sanitize({
      bytes: new Uint8Array(20),
      declaredMime: 'image/png',
      limits: { maxBytes: 10, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_TOO_LARGE' });
    await expect(processor.sanitize({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
      declaredMime: 'image/png',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_DECODE_FAILED' });
    const overLimitPng = onePixelPng.slice(0, 24);
    new DataView(overLimitPng.buffer, overLimitPng.byteOffset).setUint32(16, 4001);
    new DataView(overLimitPng.buffer, overLimitPng.byteOffset).setUint32(20, 4000);
    await expect(processor.sanitize({
      bytes: overLimitPng, declaredMime: 'image/png',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_PIXEL_LIMIT' });
    const overLimitWebp = new Uint8Array(30);
    overLimitWebp.set(new TextEncoder().encode('RIFF'), 0);
    overLimitWebp.set(new TextEncoder().encode('WEBPVP8X'), 8);
    const width = 4000; const height = 4001;
    overLimitWebp.set([width & 255, (width >> 8) & 255, (width >> 16) & 255], 24);
    overLimitWebp.set([height & 255, (height >> 8) & 255, (height >> 16) & 255], 27);
    await expect(processor.sanitize({
      bytes: overLimitWebp, declaredMime: 'image/webp',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_PIXEL_LIMIT' });
  });

  it('rejects animated PNG and WebP inputs with one stable Phase 9 error', async () => {
    const processor = await createImageMagickMediaProcessor(wasm);
    const animatedPng = new Uint8Array(onePixelPng.length + 12);
    animatedPng.set(onePixelPng.slice(0, 33));
    animatedPng.set(new TextEncoder().encode('acTL'), 37);
    animatedPng.set(onePixelPng.slice(33), 45);
    await expect(processor.sanitize({
      bytes: animatedPng,
      declaredMime: 'image/png',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_MULTIFRAME_UNSUPPORTED' });

    const animatedWebp = new Uint8Array(30);
    animatedWebp.set(new TextEncoder().encode('RIFF'), 0);
    animatedWebp.set(new TextEncoder().encode('WEBPVP8X'), 8);
    animatedWebp[20] = 0x02;
    await expect(processor.sanitize({
      bytes: animatedWebp,
      declaredMime: 'image/webp',
      limits: { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 },
    })).rejects.toMatchObject({ code: 'P9_MEDIA_MULTIFRAME_UNSUPPORTED' });
  });

  it('keeps the 64 MP internal working allowance subordinate to the 16 MP source ceiling', () => {
    expect(resourcePolicy).toEqual(expect.objectContaining({
      area: '64MP',
      sourceImageMaxPixels: 16_000_000,
      purpose: 'internal decode/cache working allowance only',
    }));
    expect(resourcePolicy.sourceCeilingEnforced).toContain('before decode');
    expect(resourcePolicy.sourceCeilingEnforced).toContain('after decode');
  });
});
