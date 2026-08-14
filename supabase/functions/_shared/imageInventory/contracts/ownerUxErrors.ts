export type OwnerUxErrorCode =
  | 'P9_AUTH_REQUIRED' | 'P9_OWNER_NOT_AUTHORIZED' | 'P9_REQUEST_INVALID'
  | 'P9_CURSOR_INVALID' | 'P9_NOT_FOUND' | 'P9_STATE_CONFLICT'
  | 'P9_VERSION_CONFLICT' | 'P9_CANDIDATE_VERSION_CONFLICT'
  | 'P9_INPUT_HAS_CANDIDATES' | 'P9_SINGLE_IMAGE_LIMIT'
  | 'P9_IDEMPOTENCY_MISMATCH' | 'P9_MEDIA_NOT_APPROVED'
  | 'P9_PUBLICATION_INELIGIBLE' | 'P9_PUBLICATION_FAILED'
  | 'P9_INTERNAL_ERROR';

const safeErrors: Record<OwnerUxErrorCode, {
  status: number; retryable: boolean; message: string;
}> = {
  P9_AUTH_REQUIRED: { status: 401, retryable: false, message: 'Authentication is required.' },
  P9_OWNER_NOT_AUTHORIZED: { status: 403, retryable: false, message: 'Owner access is required.' },
  P9_REQUEST_INVALID: { status: 400, retryable: false, message: 'The request is invalid.' },
  P9_CURSOR_INVALID: { status: 400, retryable: false, message: 'The page cursor is invalid.' },
  P9_NOT_FOUND: { status: 404, retryable: false, message: 'The requested item was not found.' },
  P9_STATE_CONFLICT: { status: 409, retryable: true, message: 'The item state changed. Refresh and try again.' },
  P9_VERSION_CONFLICT: { status: 409, retryable: true, message: 'The session changed. Refresh and try again.' },
  P9_CANDIDATE_VERSION_CONFLICT: { status: 409, retryable: true, message: 'The candidate changed. Refresh and try again.' },
  P9_INPUT_HAS_CANDIDATES: { status: 409, retryable: false, message: 'This image already has detected books and cannot be removed.' },
  P9_SINGLE_IMAGE_LIMIT: { status: 409, retryable: false, message: 'Remove the current image before choosing a replacement.' },
  P9_IDEMPOTENCY_MISMATCH: { status: 409, retryable: false, message: 'This retry does not match the original request.' },
  P9_MEDIA_NOT_APPROVED: { status: 422, retryable: false, message: 'Add approved public-copy photos before publishing.' },
  P9_PUBLICATION_INELIGIBLE: { status: 422, retryable: false, message: 'Correct the inventory details before publishing.' },
  P9_PUBLICATION_FAILED: { status: 202, retryable: true, message: 'The book is private while publication is retried.' },
  P9_INTERNAL_ERROR: { status: 500, retryable: true, message: 'The request could not be completed.' },
};

export function ownerUxErrorEnvelope(code: OwnerUxErrorCode): {
  status: number;
  body: { error: OwnerUxErrorCode; retryable: boolean; message: string };
} {
  const safeCode = code in safeErrors ? code : 'P9_INTERNAL_ERROR';
  const detail = safeErrors[safeCode];
  return {
    status: detail.status,
    body: { error: safeCode, retryable: detail.retryable, message: detail.message },
  };
}

export function ownerUxErrorFromException(
  error: unknown,
): ReturnType<typeof ownerUxErrorEnvelope> {
  const code = error instanceof Response && error.status === 401
    ? 'P9_AUTH_REQUIRED'
    : error instanceof Response && error.status === 403
      ? 'P9_OWNER_NOT_AUTHORIZED'
      : error instanceof OwnerUxResponseContractError
        ? 'P9_INTERNAL_ERROR'
      : error instanceof Error && /^(P9_[A-Z_]+)/u.test(error.message)
        ? error.message.match(/^(P9_[A-Z_]+)/u)?.[1] ?? 'P9_REQUEST_INVALID'
        : 'P9_REQUEST_INVALID';
  return ownerUxErrorEnvelope(code as OwnerUxErrorCode);
}
import { OwnerUxResponseContractError } from './ownerUxResponses.ts';
