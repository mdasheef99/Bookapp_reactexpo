import { z } from 'zod';
import { safeTextSchema } from './ownerUxValidation';

export const uuidSchema = z.string().uuid();
export const versionSchema = z.number().int().positive().safe();
export const countSchema = z.number().int().nonnegative().safe();
export const timestampSchema = z.string().datetime({ offset: true });
export const conditionSchema = z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']);
export const sessionStatusSchema = z.enum(['active', 'closing', 'closed', 'expired']);
export const candidateStateSchema = z.enum([
    'processing',
    'ready',
    'needs_review',
    'possible_duplicate',
    'failed',
    'commit_in_progress',
    'committed',
]);
export const metadataStateSchema = z.enum([
    'pending',
    'selected',
    'manual',
    'no_match',
    'ambiguous',
    'temporarily_unavailable',
    'failed',
]);
export const attentionCodeSchema = z.enum([
    'input_processing',
    'metadata_pending',
    'metadata_manual_required',
    'title_confirmation_required',
    'author_confirmation_required',
    'language_required',
    'duplicate_choice_required',
    'damage_details_required',
    'field_validation_required',
    'variant_source_stale',
    'candidate_failed',
    'review_ready',
]);
export const blockerCodes = [
    'input_processing',
    'candidate_processing',
    'candidate_failed',
    'review_missing',
    'title_unconfirmed',
    'author_confirmation_incomplete',
    'language_missing',
    'metadata_choice_missing',
    'quantity_invalid',
    'price_invalid',
    'condition_missing',
    'damage_answer_missing',
    'damage_details_missing',
    'location_missing',
    'publication_intent_missing',
    'duplicate_intent_missing',
    'variant_source_stale',
] as const;

export const closeSummarySchema = z.object({
    imagesSubmitted: countSchema,
    imagesProcessed: countSchema,
    imagesFailed: countSchema,
    imagesSkipped: countSchema,
    candidatesDetected: countSchema,
    candidatesReviewReady: countSchema,
    candidatesNeedsReview: countSchema,
    candidatesFailed: countSchema,
    falseDetections: countSchema,
    manualMissedCandidates: countSchema,
    committedInventoryItems: countSchema,
    quantitiesAddedToExisting: countSchema,
    privateItems: countSchema,
    publishedItems: countSchema,
    languageSkips: countSchema,
    candidateCapSkips: countSchema,
    qualitySkips: countSchema,
}).strict();

export const blockerCountsSchema = z.object(
    Object.fromEntries(blockerCodes.map((code) => [code, countSchema])) as Record<
        typeof blockerCodes[number],
        typeof countSchema
    >,
).strict();

export const blockerSchema = z.object({
    code: z.enum(blockerCodes),
    candidateId: uuidSchema.nullable(),
    inputId: uuidSchema.nullable(),
    field: z.string().nullable(),
    safeMessage: safeTextSchema(1, 240),
}).strict().refine(
    (value) => (value.candidateId === null) !== (value.inputId === null),
    'exactly one blocker entity is required',
);

export const pageInfoSchema = z.object({
    nextCursor: z.string().min(1).max(4096).nullable(),
    hasMore: z.boolean(),
}).strict().refine(
    (value) => value.hasMore === (value.nextCursor !== null),
    'page cursor and hasMore are inconsistent',
);
