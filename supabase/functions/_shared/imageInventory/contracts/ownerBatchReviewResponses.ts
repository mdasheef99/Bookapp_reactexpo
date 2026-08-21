import { z } from 'zod';
import { assertNoPrivacySensitiveKeys } from './privacy.ts';
import { ownerUxReviewSchema } from './ownerUxReview.ts';
import {
  OWNER_BATCH_REVIEW_CONTRACT_VERSION,
  ownerBatchAttentionCode,
  ownerBatchBlockerCodes,
  ownerBatchBlockerCounts,
  ownerBatchCandidateState,
  ownerBatchCloseSummary,
  ownerBatchCondition,
  ownerBatchCount,
  ownerBatchLabel,
  ownerBatchMetadataState,
  ownerBatchSessionDefaults,
  ownerBatchTimestamp,
  ownerBatchUuid,
  ownerBatchVersion,
  uniqueBoundedArray,
} from './ownerBatchReviewCommon.ts';
import {
  ownerUxLanguageSchema,
  ownerUxSafeTextSchema,
} from './ownerUxReview.ts';

const cover = z.string().min(1).max(512).superRefine((value, context) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'books.google.com'
      || url.username || url.password) throw new Error();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'cover host is not approved' });
  }
});
const observed = z.object({
  title: ownerUxSafeTextSchema(1, 512),
  authors: uniqueBoundedArray(ownerUxSafeTextSchema(1, 256), 20),
  language: ownerUxLanguageSchema,
  script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
}).strict();
const metadataSummary = z.object({
  title: ownerUxSafeTextSchema(1, 512),
  authors: uniqueBoundedArray(ownerUxSafeTextSchema(1, 256), 20).refine((value) => value.length > 0),
  language: ownerUxLanguageSchema,
  coverReference: cover.nullable(),
}).strict();
const blockerField = z.enum([
  'originalTitle', 'authors', 'originalLanguage', 'metadataChoice', 'quantity',
  'priceMinor', 'baseCondition', 'damageDisclosure', 'shelfLocation',
  'publicationIntent', 'duplicateIntent', 'variantSource',
]);
const blocker = z.object({
  code: z.enum(ownerBatchBlockerCodes), candidateId: ownerBatchUuid.nullable(),
  inputId: ownerBatchUuid.nullable(), field: blockerField.nullable(),
  safeMessage: ownerUxSafeTextSchema(1, 240),
}).strict().superRefine((value, context) => {
  if ((value.candidateId === null) === (value.inputId === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'exactly one blocker entity is required' });
  }
});
const sources = z.object({
  cover: z.enum(['detected', 'matched', 'missing']),
  title: z.enum(['detected', 'matched', 'custom', 'missing']),
  authors: z.enum(['detected', 'matched', 'custom', 'missing']),
  language: z.enum(['detected', 'matched', 'default', 'custom', 'missing']),
  condition: z.enum(['default', 'custom', 'missing']),
  price: z.enum(['default', 'custom', 'missing']),
  quantity: z.enum(['default', 'custom']),
  location: z.enum(['default', 'custom', 'missing']),
  publication: z.enum(['default', 'custom', 'missing']),
  damage: z.enum(['default', 'custom', 'missing']),
}).strict();
const allowedAction = z.enum([
  'save_review', 'view_metadata', 'remove_from_scan', 'add_to_inventory',
  'add_missed', 'view_readiness',
]);
const card = z.object({
  sessionId: ownerBatchUuid, candidateId: ownerBatchUuid, inputId: ownerBatchUuid.nullable(),
  ordinal: z.number().int().min(1).max(15).safe(), candidateState: ownerBatchCandidateState,
  candidateVersion: ownerBatchVersion, metadataState: ownerBatchMetadataState,
  metadataRevision: ownerBatchVersion, reviewVersion: ownerBatchVersion.nullable(),
  reviewDisposition: z.enum([
    'reviewed', 'skipped_false_detection', 'owner_removed_from_scan',
  ]).nullable(),
  observed, metadataSummary: metadataSummary.nullable(), review: ownerUxReviewSchema.nullable(),
  fieldSources: sources,
  attentionCodes: uniqueBoundedArray(ownerBatchAttentionCode, 12),
  blockers: uniqueBoundedArray(blocker, 17), reviewReady: z.boolean(),
  allowedActions: uniqueBoundedArray(allowedAction, 6), updatedAt: ownerBatchTimestamp,
}).strict().superRefine((value, context) => {
  if ((value.review === null) !== (value.reviewVersion === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'review value and version are inconsistent' });
  }
  if ((value.metadataState === 'selected') !== (value.metadataSummary !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'metadata summary is inconsistent' });
  }
});
const readiness = z.object({
  sessionId: ownerBatchUuid,
  sessionStatus: z.enum(['active', 'closing', 'closed', 'expired']),
  sessionVersion: ownerBatchVersion, allInputsTerminal: z.boolean(),
  closeSummary: ownerBatchCloseSummary, blockerCounts: ownerBatchBlockerCounts,
  nextBlockingCandidateId: ownerBatchUuid.nullable(),
  closeState: z.enum(['not_closeable', 'closeable', 'closed', 'expired']),
  closeAllowed: z.boolean(), presentationRevision: ownerBatchVersion,
}).strict();
const session = z.object({
  sessionId: ownerBatchUuid, status: z.enum(['active', 'closing', 'closed', 'expired']),
  sessionVersion: ownerBatchVersion, startedAt: ownerBatchTimestamp,
  updatedAt: ownerBatchTimestamp, closedAt: ownerBatchTimestamp.nullable(),
  expiresAt: ownerBatchTimestamp, defaults: ownerBatchSessionDefaults,
  batchLabel: ownerBatchLabel, closeSummary: ownerBatchCloseSummary,
  allInputsTerminal: z.boolean(),
  closeState: z.enum(['not_closeable', 'closeable', 'closed', 'expired']),
  presentationRevision: ownerBatchVersion,
}).strict();
const schemas = {
  start_scan_session_v2: z.object({
    sessionId: ownerBatchUuid, sessionVersion: ownerBatchVersion,
    defaults: ownerBatchSessionDefaults, batchLabel: ownerBatchLabel,
  }).strict(),
  read_scan_session_v3: session,
  read_scan_batch_review: z.object({
    sessionId: ownerBatchUuid, status: z.enum(['active', 'closing', 'closed', 'expired']),
    sessionVersion: ownerBatchVersion, presentationRevision: ownerBatchVersion,
    defaults: ownerBatchSessionDefaults, batchLabel: ownerBatchLabel,
    counts: z.object({
      detected: ownerBatchCount, processing: ownerBatchCount,
      needsAttention: ownerBatchCount, reviewReadySaved: ownerBatchCount,
      committed: ownerBatchCount, ownerRemoved: ownerBatchCount,
      falseDetections: ownerBatchCount,
    }).strict(),
    items: z.array(card).max(15), updatedAt: ownerBatchTimestamp,
  }).strict(),
  remove_candidate_from_scan: z.object({
    sessionId: ownerBatchUuid, candidateId: ownerBatchUuid,
    candidateVersion: ownerBatchVersion, sessionVersion: ownerBatchVersion,
    presentationRevision: ownerBatchVersion,
    reviewDisposition: z.literal('owner_removed_from_scan'),
    removedAt: ownerBatchTimestamp,
  }).strict(),
  close_scan_session_v3: readiness,
} as const;
export type OwnerBatchReviewResponseAction = keyof typeof schemas;
export class OwnerBatchReviewContractError extends Error {}
const forbidden = new Set([
  'rawpayload', 'providerpayload', 'confidence', 'geometry', 'scanurl', 'signedurl',
  'objectpath', 'sha256', 'cost', 'attemptcount', 'leasetoken', 'prompt',
  'correlationid', 'storeid', 'createdby',
]);
function assertSafeResponse(value: unknown): void {
  assertNoPrivacySensitiveKeys(value, 'forbidden Owner batch review field');
  const inspect = (entry: unknown): void => {
    if (Array.isArray(entry)) return entry.forEach(inspect);
    if (!entry || typeof entry !== 'object') return;
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      const normalized = key.normalize('NFKC').replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
      if (forbidden.has(normalized)) throw new OwnerBatchReviewContractError();
      inspect(child);
    }
  };
  inspect(value);
}
export function decodeOwnerBatchReviewResponse<Action extends OwnerBatchReviewResponseAction>(
  action: Action, value: unknown,
): z.infer<(typeof schemas)[Action]> {
  try {
    assertSafeResponse(value);
    const result = z.object({
      contractVersion: z.literal(OWNER_BATCH_REVIEW_CONTRACT_VERSION), data: schemas[action],
    }).strict().safeParse(value);
    if (!result.success) throw new OwnerBatchReviewContractError();
    return (result.data as unknown as {
      data: z.infer<(typeof schemas)[Action]>;
    }).data;
  } catch (error) {
    if (error instanceof OwnerBatchReviewContractError) throw error;
    throw new OwnerBatchReviewContractError();
  }
}
