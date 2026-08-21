import { z } from 'zod';
import {
  OWNER_BATCH_REVIEW_CONTRACT_VERSION,
  ownerBatchCondition,
  ownerBatchIdempotencyKey,
  ownerBatchLabel,
  ownerBatchUuid,
  ownerBatchVersion,
} from './ownerBatchReviewCommon.ts';
import { ownerUxLanguageSchema, ownerUxSafeTextSchema } from './ownerUxReview.ts';

const contractVersion = z.literal(OWNER_BATCH_REVIEW_CONTRACT_VERSION);
const start = z.object({
  action: z.literal('start_scan_session_v2'), contractVersion,
  languageHint: ownerUxLanguageSchema,
  condition: ownerBatchCondition.nullable(),
  location: ownerUxSafeTextSchema(1, 120),
  priceMinor: z.number().int().min(0).max(2_147_483_647).safe().nullable(),
  publication: z.enum(['private', 'publish']),
  batchLabel: ownerBatchLabel,
  idempotencyKey: ownerBatchIdempotencyKey,
  commandId: ownerBatchUuid,
}).strict();
const readSession = z.object({
  action: z.literal('read_scan_session_v3'), contractVersion, sessionId: ownerBatchUuid,
}).strict();
const readBatch = z.object({
  action: z.literal('read_scan_batch_review'), contractVersion, sessionId: ownerBatchUuid,
}).strict();
const removeCandidate = z.object({
  action: z.literal('remove_candidate_from_scan'), contractVersion,
  sessionId: ownerBatchUuid, candidateId: ownerBatchUuid,
  expectedCandidateVersion: ownerBatchVersion,
  idempotencyKey: ownerBatchIdempotencyKey, commandId: ownerBatchUuid,
}).strict();
const close = z.object({
  action: z.literal('close_scan_session_v3'), contractVersion,
  sessionId: ownerBatchUuid, expectedSessionVersion: ownerBatchVersion,
  idempotencyKey: ownerBatchIdempotencyKey, commandId: ownerBatchUuid,
}).strict();

const schemas = {
  start_scan_session_v2: start,
  read_scan_session_v3: readSession,
  read_scan_batch_review: readBatch,
  remove_candidate_from_scan: removeCandidate,
  close_scan_session_v3: close,
} as const;
export type OwnerBatchReviewAction = keyof typeof schemas;
export type OwnerBatchReviewRequest = z.infer<typeof start> | z.infer<typeof readSession>
  | z.infer<typeof readBatch> | z.infer<typeof removeCandidate> | z.infer<typeof close>;

export function parseOwnerBatchReviewRequest(value: unknown): OwnerBatchReviewRequest {
  const action = value && typeof value === 'object'
    ? (value as { action?: unknown }).action : undefined;
  const schema = typeof action === 'string'
    ? schemas[action as OwnerBatchReviewAction] : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) {
    const unknown = result?.error.issues.some((issue) => issue.code === 'unrecognized_keys');
    throw new Error(unknown ? 'unknown keys in Owner batch review request' : 'invalid Owner batch review request');
  }
  return result.data as OwnerBatchReviewRequest;
}
