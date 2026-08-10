import { z } from 'zod';
import { ownerUxReviewSchema as review } from './ownerUxReview.ts';
import { OWNER_UX_CONTRACT_VERSION } from './ownerUxResponses.ts';

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const contractVersion = z.literal(OWNER_UX_CONTRACT_VERSION);
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);

const readSession = z.object({
  action: z.literal('read_scan_session'), contractVersion, sessionId: uuid,
}).strict();
const listInputs = z.object({
  action: z.literal('list_scan_inputs'), contractVersion, sessionId: uuid,
  pageSize: z.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(4096).nullable().optional(),
}).strict();
const removeInput = z.object({
  action: z.literal('remove_scan_input'), contractVersion,
  sessionId: uuid, inputId: uuid, expectedInputVersion: version,
  idempotencyKey, commandId: uuid,
}).strict();
const listCandidates = z.object({
  action: z.literal('list_scan_candidates'), contractVersion,
  scope: z.enum(['session', 'needs_review']),
  sessionId: uuid.optional(),
  attention: z.enum(['all', 'needs_attention', 'review_ready']).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(4096).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.scope === 'session' && !value.sessionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'session scope requires sessionId' });
  }
  if (value.scope === 'needs_review' && value.sessionId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'needs-review scope forbids sessionId' });
  }
  if (value.scope === 'needs_review' && value.attention === 'review_ready') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'needs-review scope forbids review-ready filter' });
  }
});
const updateReview = z.object({
  action: z.literal('update_candidate_review'), contractVersion,
  sessionId: uuid, candidateId: uuid,
  expectedCandidateVersion: version, expectedMetadataRevision: version,
  review, idempotencyKey, commandId: uuid,
}).strict();
const closeSession = z.object({
  action: z.literal('close_scan_session'), contractVersion,
  sessionId: uuid, expectedSessionVersion: version, idempotencyKey, commandId: uuid,
}).strict();

const requestSchemas = {
  discover_scan_session: z.object({
    action: z.literal('discover_scan_session'), contractVersion,
  }).strict(),
  read_scan_session: readSession,
  list_scan_inputs: listInputs,
  remove_scan_input: removeInput,
  list_scan_candidates: listCandidates,
  read_scan_candidate: z.object({
    action: z.literal('read_scan_candidate'), contractVersion,
    sessionId: uuid, candidateId: uuid,
  }).strict(),
  update_candidate_review: updateReview,
  read_scan_readiness: z.object({
    action: z.literal('read_scan_readiness'), contractVersion, sessionId: uuid,
  }).strict(),
  close_scan_session: closeSession,
} as const;

const ownerUxRequest = z.discriminatedUnion('action', [
  requestSchemas.discover_scan_session, readSession, listInputs,
  removeInput, listCandidates as any, requestSchemas.read_scan_candidate, updateReview,
  requestSchemas.read_scan_readiness, closeSession,
]);

export type OwnerUxRequest = z.infer<typeof ownerUxRequest>;
export type OwnerUxAction = keyof typeof requestSchemas;

export function parseOwnerUxRequest(value: unknown): OwnerUxRequest {
  const action = value && typeof value === 'object'
    ? (value as { action?: unknown }).action
    : undefined;
  const schema = typeof action === 'string'
    ? requestSchemas[action as OwnerUxAction]
    : undefined;
  const result = schema?.safeParse(value);
  if (!result?.success) {
    const unknown = result?.error.issues.some((entry) =>
      entry.code === 'unrecognized_keys' && entry.path.length === 0);
    throw new Error(unknown
      ? 'unknown keys in Owner UX request'
      : 'invalid Owner UX request');
  }
  return result.data as OwnerUxRequest;
}
