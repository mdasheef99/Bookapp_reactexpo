import { z } from 'zod';
import {
  ownerUxLanguageSchema,
  ownerUxNullableSafeTextSchema,
  ownerUxSafeTextSchema,
} from './ownerUxReview.ts';

export const OWNER_BATCH_REVIEW_CONTRACT_VERSION = 'phase9-owner-batch-review-v1' as const;
export const ownerBatchUuid = z.string().uuid();
export const ownerBatchVersion = z.number().int().positive().safe();
export const ownerBatchTimestamp = z.string().datetime({ offset: true });
export const ownerBatchCount = z.number().int().min(0).max(15).safe();
export const ownerBatchCondition = z.enum([
  'new', 'like_new', 'very_good', 'good', 'acceptable',
]);
export const ownerBatchCandidateState = z.enum([
  'processing', 'ready', 'needs_review', 'possible_duplicate', 'failed',
  'commit_in_progress', 'committed',
]);
export const ownerBatchMetadataState = z.enum([
  'pending', 'selected', 'manual', 'no_match', 'ambiguous',
  'temporarily_unavailable', 'failed',
]);
export const ownerBatchAttentionCode = z.enum([
  'input_processing', 'metadata_pending', 'metadata_manual_required',
  'title_confirmation_required', 'author_confirmation_required', 'language_required',
  'duplicate_choice_required', 'damage_details_required', 'field_validation_required',
  'variant_source_stale', 'candidate_failed', 'review_ready',
]);
export const ownerBatchBlockerCodes = [
  'input_processing', 'candidate_processing', 'candidate_failed', 'review_missing',
  'title_unconfirmed', 'author_confirmation_incomplete', 'language_missing',
  'metadata_choice_missing', 'quantity_invalid', 'price_invalid', 'condition_missing',
  'damage_answer_missing', 'damage_details_missing', 'location_missing',
  'publication_intent_missing', 'duplicate_intent_missing', 'variant_source_stale',
] as const;

export const ownerBatchSessionDefaults = z.object({
  languageHint: ownerUxLanguageSchema,
  condition: ownerBatchCondition.nullable(),
  location: ownerUxSafeTextSchema(1, 120),
  priceMinor: z.number().int().min(0).max(2_147_483_647).safe().nullable(),
  quantity: z.literal(1),
  publication: z.enum(['private', 'publish']),
  script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
}).strict();

export const ownerBatchLabel = ownerUxNullableSafeTextSchema(80);
export const ownerBatchIdempotencyKey = z.string().min(16).max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export const ownerBatchCloseSummary = z.object({
  imagesSubmitted: ownerBatchCount, imagesProcessed: ownerBatchCount,
  imagesFailed: ownerBatchCount, imagesSkipped: ownerBatchCount,
  candidatesDetected: ownerBatchCount, candidatesReviewReady: ownerBatchCount,
  candidatesNeedsReview: ownerBatchCount, candidatesFailed: ownerBatchCount,
  falseDetections: ownerBatchCount, ownerRemovedCandidates: ownerBatchCount,
  manualMissedCandidates: ownerBatchCount, committedInventoryItems: ownerBatchCount,
  quantitiesAddedToExisting: ownerBatchCount, privateItems: ownerBatchCount,
  publishedItems: ownerBatchCount, languageSkips: ownerBatchCount,
  candidateCapSkips: ownerBatchCount, qualitySkips: ownerBatchCount,
}).strict();

export const ownerBatchBlockerCounts = z.object(Object.fromEntries(
  ownerBatchBlockerCodes.map((code) => [code, ownerBatchCount]),
) as Record<typeof ownerBatchBlockerCodes[number], typeof ownerBatchCount>).strict();

export function uniqueBoundedArray<Schema extends z.ZodTypeAny>(schema: Schema, maximum: number) {
  return z.array(schema).max(maximum).superRefine((values, context) => {
    const identities = values.map((value) => JSON.stringify(value));
    if (new Set(identities).size !== identities.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'array values must be unique' });
    }
  });
}
