import { z } from 'zod';
import { assertNoPrivacySensitiveKeys } from './privacy.ts';
import {
  ownerUxLanguageSchema as language,
  ownerUxNullableSafeTextSchema as nullableSafeText,
  ownerUxReviewSchema as review,
  ownerUxSafeTextSchema as safeText,
} from './ownerUxReview.ts';

export const OWNER_UX_CONTRACT_VERSION = 'phase9-owner-ux-v1' as const;
export const OWNER_UX_FORBIDDEN_RESPONSE_KEYS = Object.freeze([
  'raw_payload', 'provider_payload', 'confidence', 'geometry', 'scan_url',
  'signed_url', 'object_path', 'sha256', 'cost', 'attempt_count', 'lease_token',
  'prompt', 'correlation_id', 'store_id', 'created_by',
] as const);

const uuid = z.string().uuid();
const version = z.number().int().positive().safe();
const count = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime({ offset: true });
const contractVersion = z.literal(OWNER_UX_CONTRACT_VERSION);
const ordinal = z.number().int().min(1).max(15).safe();
const candidateCount = z.number().int().min(0).max(15).safe();
const condition = z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']);
const phase9ErrorCode = z.enum([
  'P9_OWNER_NOT_AUTHORIZED', 'P9_SESSION_NOT_ACTIVE',
  'P9_CANDIDATE_VERSION_CONFLICT', 'P9_DUPLICATE_TARGET_CHANGED',
  'P9_MEDIA_NOT_APPROVED', 'P9_MEDIA_SIGNATURE_INVALID',
  'P9_MEDIA_MIME_MISMATCH', 'P9_MEDIA_TOO_LARGE',
  'P9_MEDIA_DECODE_FAILED', 'P9_MEDIA_DIMENSIONS_EXCEEDED',
  'P9_MEDIA_PIXEL_LIMIT', 'P9_MEDIA_MULTIFRAME_UNSUPPORTED',
  'P9_MEDIA_OBJECT_CHANGED', 'P9_MEDIA_PROCESSING_RETRYABLE',
  'P9_VISION_NO_BOOKS', 'P9_VISION_LANGUAGE_MISMATCH',
  'P9_VISION_OVER_LIMIT', 'P9_VISION_QUALITY_REJECTED',
  'P9_VISION_SCHEMA_INVALID', 'P9_VISION_ANALYZER_TIMEOUT',
  'P9_VISION_ANALYZER_UNAVAILABLE', 'P9_VISION_MEDIA_UNAVAILABLE',
  'P9_VISION_DATABASE_RETRYABLE', 'P9_VISION_INTERNAL_PERMANENT',
  'P9_VISION_STALE_ATTEMPT', 'P9_VISION_PERSISTENCE_CONFLICT',
  'P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED',
  'P9_QUANTITY_INVARIANT_FAILED', 'P9_PUBLICATION_FAILED',
  'P9_AUTH_REQUIRED', 'P9_REQUEST_INVALID', 'P9_NOT_FOUND',
  'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
  'P9_LIMIT_EXCEEDED', 'P9_QUOTA_EXCEEDED', 'P9_RATE_LIMITED',
  'P9_CURSOR_INVALID', 'P9_SOFT_HOLD_REQUIRED',
  'P9_INSUFFICIENT_AVAILABLE_QUANTITY', 'P9_POLICY_CONFIGURATION_INVALID',
  'P9_INTERNAL_ERROR',
]);

const closeSummary = z.object({
  imagesSubmitted: count, imagesProcessed: count, imagesFailed: count, imagesSkipped: count,
  candidatesDetected: count, candidatesReviewReady: count, candidatesNeedsReview: count,
  candidatesFailed: count, falseDetections: count, manualMissedCandidates: count,
  committedInventoryItems: count, quantitiesAddedToExisting: count, privateItems: count,
  publishedItems: count, languageSkips: count, candidateCapSkips: count, qualitySkips: count,
}).strict();
const blockerCodes = [
  'input_processing', 'candidate_processing', 'candidate_failed', 'review_missing',
  'title_unconfirmed', 'author_confirmation_incomplete', 'language_missing',
  'metadata_choice_missing', 'quantity_invalid', 'price_invalid', 'condition_missing',
  'damage_answer_missing', 'damage_details_missing', 'location_missing',
  'publication_intent_missing', 'duplicate_intent_missing', 'variant_source_stale',
] as const;
const blockerCounts = z.object(Object.fromEntries(blockerCodes.map((code) => [code, count])) as Record<typeof blockerCodes[number], typeof count>).strict();
const pageInfo = z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }).strict();
const sessionStatus = z.enum(['active', 'closing', 'closed', 'expired']);
const candidateSessionStatus = z.enum(['active', 'closing', 'closed']);
const candidateState = z.enum(['processing', 'needs_review', 'possible_duplicate', 'ready', 'failed', 'commit_in_progress', 'committed']);
const attentionCode = z.enum([
  'input_processing', 'metadata_pending', 'metadata_manual_required',
  'title_confirmation_required', 'author_confirmation_required', 'language_required',
  'duplicate_choice_required', 'damage_details_required', 'field_validation_required',
  'variant_source_stale', 'candidate_failed', 'review_ready',
]);
const candidateSummary = z.object({
  sessionId: uuid, sessionStartedAt: timestamp, sessionExpiresAt: timestamp,
  sessionStatus: candidateSessionStatus, candidateId: uuid, inputId: uuid.nullable(), ordinal,
  title: safeText(1, 512), authors: z.array(safeText(1, 256)).max(20), language,
  candidateState, candidateVersion: version,
  metadataState: z.enum(['pending', 'selected', 'manual', 'no_match', 'ambiguous', 'temporarily_unavailable', 'failed']),
  reviewDisposition: z.enum(['reviewed', 'skipped_false_detection']).nullable(),
  attentionCodes: z.array(attentionCode), reviewReady: z.boolean(), updatedAt: timestamp,
}).strict();
const inputProgress = z.object({
  inputId: uuid, ordinal, sourceKind: z.enum(['camera', 'gallery']),
  inputState: z.enum(['uploaded', 'validating', 'queued', 'processing', 'ready', 'failed', 'skipped']),
  inputVersion: version,
  presentationState: z.enum(['checking_image', 'finding_books', 'ready', 'needs_attention']),
  safeCode: phase9ErrorCode.nullable(),
  retryState: z.enum(['none', 'server_retrying', 'new_upload_required']),
  terminal: z.boolean(), polling: z.boolean(), detectedCandidateCount: candidateCount.nullable(),
  acceptedCandidateCount: candidateCount.nullable(), createdAt: timestamp, updatedAt: timestamp,
}).strict();
const coverReference = z.string().min(1).max(512).superRefine((value, context) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.hostname.toLowerCase() !== 'books.google.com') throw new Error();
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'cover host is not approved' });
  }
});
const metadataSnapshot = z.object({
  title: safeText(1, 512),
  authors: z.array(safeText(1, 256)).min(1).max(20), language,
  subtitle: nullableSafeText(512),
  description: nullableSafeText(5000),
  isbn10: z.string().min(10).max(32).nullable(), isbn13: z.string().min(10).max(32).nullable(),
  publisher: nullableSafeText(256),
  publishedDate: nullableSafeText(32),
  script: nullableSafeText(16),
  editionStatement: nullableSafeText(256),
  series: nullableSafeText(256), volume: nullableSafeText(64),
  format: nullableSafeText(128),
  pageCount: z.number().int().min(1).max(100_000).nullable(),
  categories: z.array(safeText(1, 128)).max(20),
  coverReference: coverReference.nullable(),
}).strict();
const blocker = z.object({
  code: z.enum(blockerCodes), candidateId: uuid.nullable(), inputId: uuid.nullable(),
  field: z.string().nullable(), safeMessage: z.string().min(1).max(240),
}).strict().superRefine((value, context) => {
  if ((value.candidateId === null) === (value.inputId === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'exactly one blocker entity is required' });
  }
});
const candidateDetail = z.object({
  sessionId: uuid, candidateId: uuid, inputId: uuid.nullable(),
  ordinal, candidateState, candidateVersion: version,
  observed: z.object({
    title: safeText(1, 512), authors: z.array(safeText(1, 256)).max(20),
    language, script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
  }).strict(),
  metadata: z.object({
    state: z.enum(['pending', 'selected', 'manual', 'no_match', 'ambiguous', 'temporarily_unavailable', 'failed']),
    revision: version, selectionVersion: version.nullable(), selectionId: uuid.nullable(),
    canonicalEditionId: uuid.nullable(), snapshot: metadataSnapshot.nullable(),
  }).strict(),
  review: z.object({ value: review.nullable(), reviewVersion: version.nullable() }).strict(),
  duplicateAdvice: z.object({
    state: z.enum(['none', 'possible_match', 'compatible_match', 'changed']),
    version: version.nullable(), targetInventoryId: uuid.nullable(),
    matchReason: z.enum([
      'exact_validated_edition', 'exact_original_title_author_language',
      'strong_original_match', 'fuzzy_possible_match',
    ]).nullable(),
    compatibility: z.object({
      sameLanguage: z.boolean(), sameFormat: z.boolean(), sameCondition: z.boolean(),
      samePrice: z.boolean(), noCopySpecificDamageOrNote: z.boolean(),
    }).strict().nullable(),
    display: z.object({
      title: safeText(1, 512), authors: z.array(safeText(1, 256)).max(20),
      isbn10: z.string().min(10).max(32).nullable(),
      isbn13: z.string().min(10).max(32).nullable(), language,
      format: nullableSafeText(128), condition, priceMinor: count, availableQuantity: count,
      hasDamage: z.boolean(), hasApprovedPublicCopyPhoto: z.boolean(),
      hasCopySpecificNote: z.boolean(), location: safeText(1, 120),
    }).strict().nullable(),
    allowedIntents: z.array(z.enum(['increment_quantity', 'create_separate', 'manual_match'])),
  }).strict(),
  variantSummary: z.object({
    unresolvedCount: count, proposalVersions: z.array(z.object({
      proposalId: uuid, version,
      allowedActions: z.array(z.enum(['approve', 'reject', 'replace'])),
    }).strict()),
  }).strict(),
  attentionCodes: z.array(attentionCode),
  readiness: z.object({
    reviewReady: z.boolean(), blockers: z.array(blocker),
    derivedFromCandidateVersion: version, derivedFromMetadataRevision: version,
    derivedFromDuplicateAdviceVersion: version.nullable(),
  }).strict(),
  allowedActions: z.array(z.enum([
    'save_review', 'mark_false', 'open_variant_review', 'add_missed', 'view_readiness',
    'add_to_inventory',
  ])),
  updatedAt: timestamp,
}).strict();
const readiness = z.object({
  sessionId: uuid, sessionStatus, sessionVersion: version, allInputsTerminal: z.boolean(),
  closeSummary, blockerCounts, nextBlockingCandidateId: uuid.nullable(),
  closeState: z.enum(['not_closeable', 'closeable', 'closed', 'expired']),
  closeAllowed: z.boolean(), presentationRevision: version,
}).strict();
const activeSession = z.object({
  sessionId: uuid, status: z.enum(['active', 'closing']), sessionVersion: version,
  startedAt: timestamp, updatedAt: timestamp,
  inputCount: count, candidateCount: count, attentionCount: count,
}).strict();
const responseSchemas = {
  discover_scan_session: z.object({
    activeSession: activeSession.nullable(), needsReviewCount: count, reviewScopeVersion: version,
  }).strict(),
  read_scan_session: z.object({
    sessionId: uuid, status: sessionStatus, sessionVersion: version,
    startedAt: timestamp, updatedAt: timestamp, closedAt: timestamp.nullable(), expiresAt: timestamp,
    defaults: z.object({
      language, script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(), condition,
      location: safeText(1, 120), quantity: z.number().int().min(1).max(1000).safe(),
      publication: z.enum(['private', 'publish']),
    }).strict(),
    closeSummary, allInputsTerminal: z.boolean(),
    closeState: z.enum(['not_closeable', 'closeable', 'closed', 'expired']), presentationRevision: version,
  }).strict(),
  list_scan_inputs: z.object({
    items: z.array(inputProgress), pageInfo, sessionVersion: version, presentationRevision: version,
  }).strict(),
  remove_scan_input: z.object({
    sessionId: uuid, inputId: uuid, inputState: z.literal('skipped'),
    inputVersion: version, sessionVersion: version, presentationRevision: version,
  }).strict(),
  list_scan_candidates: z.object({
    items: z.array(candidateSummary), pageInfo, scopeVersion: version, sessionVersion: version.nullable(),
  }).strict(),
  read_scan_candidate: candidateDetail,
  update_candidate_review: candidateDetail,
  add_candidate_to_inventory: z.object({
    sessionId: uuid, candidateId: uuid, candidateVersion: version,
    inventoryId: uuid, inventoryVersion: version,
    outcome: z.literal('committed_private'),
  }).strict(),
  read_scan_readiness: readiness,
  close_scan_session: readiness,
} as const;
type OwnerUxAction = keyof typeof responseSchemas;

export class OwnerUxResponseContractError extends Error {}

function assertForbiddenResponseKeys(value: unknown): void {
  assertNoPrivacySensitiveKeys(value, 'forbidden private Owner UX field');
  const inspect = (entry: unknown): void => {
    if (Array.isArray(entry)) return entry.forEach(inspect);
    if (!entry || typeof entry !== 'object') return;
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      if ((OWNER_UX_FORBIDDEN_RESPONSE_KEYS as readonly string[]).includes(key.toLowerCase())) {
        throw new OwnerUxResponseContractError(`forbidden Owner UX response field: ${key}`);
      }
      inspect(child);
    }
  };
  inspect(value);
}

export function parseOwnerUxResponse(action: OwnerUxAction, value: unknown): {
  contractVersion: typeof OWNER_UX_CONTRACT_VERSION; data: unknown;
} {
  try {
    assertForbiddenResponseKeys(value);
    const envelope = z.object({
      contractVersion, data: responseSchemas[action],
    }).strict();
    const result = envelope.safeParse(value);
    if (!result.success) {
      const unknown = result.error.issues.some((entry) => entry.code === 'unrecognized_keys');
      throw new OwnerUxResponseContractError(unknown
        ? 'unknown keys in Owner UX response'
        : 'invalid Owner UX response');
    }
    return result.data;
  } catch (error) {
    if (error instanceof OwnerUxResponseContractError) throw error;
    throw new OwnerUxResponseContractError('invalid Owner UX response');
  }
}
