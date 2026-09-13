import { MediaProcessingError } from '../media/imageMagickMediaProcessor';

export type RpcError = Readonly<{
  code?: string; status?: number; message?: string; details?: string; hint?: string;
}>;
export type RpcResult = { data: any; error: RpcError | null; status?: number };

export class MediaCompletionStaleLeaseError extends Error {}
export class MediaReconciliationError extends Error {}

export function isStaleLease(error: RpcError): boolean {
  return error.code === 'P9_STATE_CONFLICT' || error.message === 'P9_STATE_CONFLICT';
}

export function unwrap(result: RpcResult): any {
  if (result.error) {
    if (isStaleLease(result.error)) throw new MediaCompletionStaleLeaseError();
    throw new Error('P9_INTERNAL_ERROR');
  }
  return result.data;
}

// Master SDD §8 / SDD 04 §12: an HTTP conflict alone proves neither a
// duplicate nor deletion authority. Diagnostics never become response text.
export function unwrapCompletion(result: RpcResult): any {
  const error = result.error;
  if (!error) return result.data;
  if (isStaleLease(error)) throw new MediaCompletionStaleLeaseError();
  if (error.code === 'P9_MEDIA_OBJECT_CHANGED' || error.message === 'P9_MEDIA_OBJECT_CHANGED') {
    throw new MediaProcessingError('P9_MEDIA_OBJECT_CHANGED');
  }
  if (Number(result.status ?? error.status) === 409 || error.code?.startsWith('23')
    || ['P9_MEDIA_NOT_APPROVED', 'P9_IDEMPOTENCY_MISMATCH', 'P9_OWNER_NOT_AUTHORIZED']
      .some((code) => error.code === code || error.message === code)) {
    throw new MediaReconciliationError();
  }
  throw new Error('P9_INTERNAL_ERROR');
}
