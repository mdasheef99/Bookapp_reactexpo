export type StoredImageObject = Readonly<{
  id?: string;
  name: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}>;

export type StoredImageEnvelope = Readonly<{
  size: number;
  mime: string;
  etag: string;
  objectIdentity: string;
}>;

export async function sha256Hex(bytes: Uint8Array | string): Promise<string> {
  const input = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const stableBuffer = Uint8Array.from(input).buffer;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', stableBuffer));
  return Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function storedImageEnvelope(object: StoredImageObject | undefined): Promise<StoredImageEnvelope> {
  const size = Number(object?.metadata?.size ?? object?.metadata?.contentLength);
  const mime = object?.metadata?.mimetype;
  const etag = object?.metadata?.eTag ?? object?.metadata?.etag;
  const objectId = object?.id;
  const updatedAt = object?.updated_at;
  if (!object || !Number.isSafeInteger(size) || size < 1 || typeof mime !== 'string'
    || typeof etag !== 'string' || typeof objectId !== 'string' || typeof updatedAt !== 'string') {
    throw new Error('P9_MEDIA_NOT_APPROVED');
  }
  const objectIdentity = await sha256Hex(JSON.stringify({
    objectId,
    updatedAt,
    etag,
    size,
    mime,
  }));
  return { size, mime, etag, objectIdentity };
}
