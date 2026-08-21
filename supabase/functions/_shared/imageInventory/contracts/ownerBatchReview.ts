export {
  OWNER_BATCH_REVIEW_CONTRACT_VERSION,
} from './ownerBatchReviewCommon.ts';
export {
  parseOwnerBatchReviewRequest,
  type OwnerBatchReviewAction,
  type OwnerBatchReviewRequest,
} from './ownerBatchReviewRequests.ts';
export {
  decodeOwnerBatchReviewResponse,
  OwnerBatchReviewContractError,
  type OwnerBatchReviewResponseAction,
} from './ownerBatchReviewResponses.ts';

export const OWNER_BATCH_REVIEW_COMMAND_ERRORS = Object.freeze([
  'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
  'P9_NOT_FOUND', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT',
  'P9_CANDIDATE_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
  'P9_INTERNAL_ERROR',
] as const);
