import { z } from 'zod';
import { ownerCandidateReviewSchema } from './ownerUxReviewSchema';
import {
    attentionCodeSchema,
    blockerCodes,
    candidateStateSchema,
    conditionSchema,
    metadataStateSchema,
    sessionStatusSchema,
    timestampSchema,
    uuidSchema,
    versionSchema,
} from './ownerUxCommonSchemas';
import { languageSchema, nullableSafeTextSchema, safeTextSchema } from './ownerUxValidation';

export const OWNER_BATCH_REVIEW_CONTRACT_VERSION = 'phase9-owner-batch-review-v1' as const;
const boundedCount = z.number().int().min(0).safe();
const unique = <Schema extends z.ZodTypeAny>(schema: Schema, maximum: number) => z.array(schema)
    .max(maximum).refine((items) => new Set(items.map((item) => JSON.stringify(item))).size === items.length,
        'array values must be unique');
const label = nullableSafeTextSchema(80);
const defaults = z.object({
    languageHint: languageSchema,
    condition: conditionSchema.nullable(),
    location: safeTextSchema(1, 120),
    priceMinor: z.number().int().min(0).max(2_147_483_647).safe().nullable(),
    quantity: z.literal(1),
    publication: z.enum(['private', 'publish']),
    script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
}).strict();
const closeSummary = z.object({
    imagesSubmitted: boundedCount, imagesProcessed: boundedCount,
    imagesFailed: boundedCount, imagesSkipped: boundedCount,
    candidatesDetected: boundedCount, candidatesReviewReady: boundedCount,
    candidatesNeedsReview: boundedCount, candidatesFailed: boundedCount,
    falseDetections: boundedCount, ownerRemovedCandidates: boundedCount,
    manualMissedCandidates: boundedCount, committedInventoryItems: boundedCount,
    quantitiesAddedToExisting: boundedCount, privateItems: boundedCount,
    publishedItems: boundedCount, languageSkips: boundedCount,
    candidateCapSkips: boundedCount, qualitySkips: boundedCount,
}).strict();
const blockerField = z.enum([
    'originalTitle', 'authors', 'originalLanguage', 'metadataChoice', 'quantity',
    'priceMinor', 'baseCondition', 'damageDisclosure', 'shelfLocation',
    'publicationIntent', 'duplicateIntent', 'variantSource',
]);
const blocker = z.object({
    code: z.enum(blockerCodes), candidateId: uuidSchema.nullable(),
    inputId: uuidSchema.nullable(), field: blockerField.nullable(),
    safeMessage: safeTextSchema(1, 240),
}).strict().refine((value) => (value.candidateId === null) !== (value.inputId === null),
    'exactly one blocker entity is required');
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
const cover = z.string().min(1).max(512).superRefine((value, context) => {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'books.google.com'
            || url.username || url.password) throw new Error();
    } catch {
        context.addIssue({ code: 'custom', message: 'cover host is not approved' });
    }
});
const observed = z.object({
    title: safeTextSchema(1, 512),
    authors: unique(safeTextSchema(1, 256), 20),
    language: languageSchema,
    script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
}).strict();
const metadataSummary = z.object({
    title: safeTextSchema(1, 512).nullable(),
    authors: unique(safeTextSchema(1, 256), 20)
        .refine((items) => items.length > 0).nullable(),
    language: languageSchema.nullable(), coverReference: cover.nullable(),
    selectionId: uuidSchema.nullable().optional(),
}).strict();
const card = z.object({
    sessionId: uuidSchema, candidateId: uuidSchema, inputId: uuidSchema.nullable(),
    ordinal: z.number().int().min(1).max(15).safe(), candidateState: candidateStateSchema,
    candidateVersion: versionSchema, metadataState: metadataStateSchema,
    metadataRevision: versionSchema, reviewVersion: versionSchema.nullable(),
    reviewDisposition: z.enum([
        'reviewed', 'skipped_false_detection', 'owner_removed_from_scan',
    ]).nullable(),
    observed, metadataSummary: metadataSummary.nullable(), review: ownerCandidateReviewSchema.nullable(),
    fieldSources: sources, attentionCodes: unique(attentionCodeSchema, 12),
    blockers: unique(blocker, 17), reviewReady: z.boolean(),
    allowedActions: unique(z.enum([
        'save_review', 'view_metadata', 'remove_from_scan', 'add_to_inventory',
        'add_missed', 'view_readiness',
    ]), 6),
    updatedAt: timestampSchema,
}).strict().superRefine((value, context) => {
    if ((value.review === null) !== (value.reviewVersion === null)) {
        context.addIssue({ code: 'custom', message: 'review value and version are inconsistent' });
    }
    if ((value.metadataState === 'selected') !== (value.metadataSummary !== null)) {
        context.addIssue({ code: 'custom', message: 'metadata summary is inconsistent' });
    }
    if (value.review !== null && value.reviewDisposition !== 'reviewed') {
        context.addIssue({ code: 'custom', message: 'review disposition is inconsistent' });
    }
});
type BatchCard = z.infer<typeof card>;
type BatchDefaults = z.infer<typeof defaults>;
const equalStrings = (left: string[], right: string[]) => (
    left.length === right.length && left.every((entry, index) => entry === right[index])
);
function validateFieldAuthority(
    value: BatchCard,
    rootDefaults: BatchDefaults,
    context: z.RefinementCtx,
    index: number,
): void {
    const review = value.review;
    const selected = value.metadataState === 'selected' ? value.metadataSummary : null;
    const issue = (field: keyof BatchCard['fieldSources'], valid: boolean) => {
        if (!valid) context.addIssue({
            code: 'custom',
            message: `${field} source has no coherent backing value`,
            path: ['items', index, 'fieldSources', field],
        });
    };
    const title = value.fieldSources.title;
    issue('title', title === 'custom' ? Boolean(review
        && review.originalTitle !== selected?.title
        && review.originalTitle !== value.observed.title)
        : title === 'matched' ? Boolean(selected
            && (!review || review.originalTitle === selected.title))
            : title === 'detected' ? Boolean(value.observed.title
                && (!review || (review.originalTitle === value.observed.title
                    && review.originalTitle !== selected?.title)))
                : false);
    const authors = value.fieldSources.authors;
    issue('authors', authors === 'custom' ? Boolean(review?.authors.length
        && (!selected?.authors || !equalStrings(review.authors, selected.authors))
        && !equalStrings(review.authors, value.observed.authors))
        : authors === 'matched' ? Boolean(selected?.authors
            && (!review || equalStrings(review.authors, selected.authors)))
        : authors === 'detected' ? Boolean(value.observed.authors.length
            && (!review || (equalStrings(review.authors, value.observed.authors)
                && (!selected?.authors || !equalStrings(review.authors, selected.authors)))))
        : authors === 'missing' ? Boolean(review?.authors.length === 0
            || (!review && !selected?.authors && value.observed.authors.length === 0))
                    : false);
    const language = value.fieldSources.language;
    issue('language', language === 'custom' ? Boolean(review
        && review.originalLanguage !== selected?.language
        && review.originalLanguage !== value.observed.language
        && review.originalLanguage !== rootDefaults.languageHint)
        : language === 'matched' ? Boolean(selected
            && (!review || review.originalLanguage === selected.language))
            : language === 'detected' ? Boolean(value.observed.language
                && (!review || review.originalLanguage === value.observed.language))
                : language === 'default' ? Boolean(rootDefaults.languageHint
                    && (!review || review.originalLanguage === rootDefaults.languageHint))
                    : false);
    issue('cover', value.fieldSources.cover === 'matched'
        ? Boolean(selected?.coverReference)
        : value.fieldSources.cover === 'missing' ? !selected?.coverReference : false);
    issue('condition', value.fieldSources.condition === 'custom'
        ? Boolean(review && review.baseCondition !== rootDefaults.condition)
        : value.fieldSources.condition === 'default'
            ? Boolean(rootDefaults.condition && (!review || review.baseCondition === rootDefaults.condition))
            : !review && rootDefaults.condition === null);
    issue('price', value.fieldSources.price === 'custom'
        ? Boolean(review && review.priceMinor !== rootDefaults.priceMinor)
        : value.fieldSources.price === 'default'
            ? rootDefaults.priceMinor !== null && (!review || review.priceMinor === rootDefaults.priceMinor)
            : !review && rootDefaults.priceMinor === null);
    issue('quantity', value.fieldSources.quantity === 'custom'
        ? Boolean(review && review.quantity !== 1) : !review || review.quantity === 1);
    issue('location', value.fieldSources.location === 'custom'
        ? Boolean(review && review.shelfLocation !== rootDefaults.location)
        : value.fieldSources.location === 'default'
            ? Boolean(rootDefaults.location && (!review || review.shelfLocation === rootDefaults.location))
            : !review && !rootDefaults.location);
    issue('publication', value.fieldSources.publication === 'custom'
        ? Boolean(review && review.publicationIntent !== rootDefaults.publication)
        : value.fieldSources.publication === 'default'
            ? !review || review.publicationIntent === rootDefaults.publication
            : false);
    issue('damage', value.fieldSources.damage === 'custom'
        ? Boolean(review?.damageDisclosure.hasDamage)
        : value.fieldSources.damage === 'default'
            ? !review || !review.damageDisclosure.hasDamage
            : false);
}
const blockerCounts = z.object(Object.fromEntries(
    blockerCodes.map((code) => [code, boundedCount]),
) as Record<typeof blockerCodes[number], typeof boundedCount>).strict();
const readiness = z.object({
    sessionId: uuidSchema, sessionStatus: sessionStatusSchema,
    sessionVersion: versionSchema, allInputsTerminal: z.boolean(), closeSummary,
    blockerCounts, nextBlockingCandidateId: uuidSchema.nullable(),
    closeState: z.enum(['not_closeable', 'closeable', 'closed', 'expired']),
    closeAllowed: z.boolean(), presentationRevision: versionSchema,
}).strict();
const schemas = {
    start_scan_session_v2: z.object({
        sessionId: uuidSchema, sessionVersion: versionSchema, defaults, batchLabel: label,
    }).strict(),
    read_scan_session_v3: z.object({
        sessionId: uuidSchema, status: sessionStatusSchema, sessionVersion: versionSchema,
        startedAt: timestampSchema, updatedAt: timestampSchema,
        closedAt: timestampSchema.nullable(), expiresAt: timestampSchema,
        defaults, batchLabel: label, closeSummary, allInputsTerminal: z.boolean(),
        closeState: z.enum(['not_closeable', 'closeable', 'closed', 'expired']),
        presentationRevision: versionSchema,
    }).strict(),
    read_scan_batch_review: z.object({
        sessionId: uuidSchema, status: sessionStatusSchema, sessionVersion: versionSchema,
        presentationRevision: versionSchema, defaults, batchLabel: label,
        counts: z.object({
            detected: boundedCount, processing: boundedCount, needsAttention: boundedCount,
            reviewReadySaved: boundedCount, committed: boundedCount,
            ownerRemoved: boundedCount, falseDetections: boundedCount,
        }).strict(),
        items: z.array(card).max(15), updatedAt: timestampSchema,
    }).strict().superRefine((value, context) => {
        value.items.forEach((item, index) => validateFieldAuthority(
            item, value.defaults, context, index,
        ));
    }),
    remove_candidate_from_scan: z.object({
        sessionId: uuidSchema, candidateId: uuidSchema, candidateVersion: versionSchema,
        sessionVersion: versionSchema, presentationRevision: versionSchema,
        reviewDisposition: z.literal('owner_removed_from_scan'), removedAt: timestampSchema,
    }).strict(),
    close_scan_session_v3: readiness,
} as const;

export type OwnerBatchReviewAction = keyof typeof schemas;
export type OwnerBatchReview = z.infer<typeof schemas.read_scan_batch_review>;
export type OwnerSessionReadinessV3 = z.infer<typeof readiness>;
export type OwnerBatchReviewCard = z.infer<typeof card>;
export class OwnerBatchReviewContractError extends Error {}

const requestVersion = z.literal(OWNER_BATCH_REVIEW_CONTRACT_VERSION);
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
const requestSchemas = {
    start_scan_session_v2: z.object({
        action: z.literal('start_scan_session_v2'), contractVersion: requestVersion,
        languageHint: languageSchema, condition: conditionSchema.nullable(),
        location: safeTextSchema(1, 120),
        priceMinor: z.number().int().min(0).max(2_147_483_647).safe().nullable(),
        publication: z.enum(['private', 'publish']), batchLabel: label,
        idempotencyKey, commandId: uuidSchema,
    }).strict(),
    read_scan_session_v3: z.object({
        action: z.literal('read_scan_session_v3'), contractVersion: requestVersion,
        sessionId: uuidSchema,
    }).strict(),
    read_scan_batch_review: z.object({
        action: z.literal('read_scan_batch_review'), contractVersion: requestVersion,
        sessionId: uuidSchema,
    }).strict(),
    remove_candidate_from_scan: z.object({
        action: z.literal('remove_candidate_from_scan'), contractVersion: requestVersion,
        sessionId: uuidSchema, candidateId: uuidSchema,
        expectedCandidateVersion: versionSchema, idempotencyKey, commandId: uuidSchema,
    }).strict(),
    close_scan_session_v3: z.object({
        action: z.literal('close_scan_session_v3'), contractVersion: requestVersion,
        sessionId: uuidSchema, expectedSessionVersion: versionSchema,
        idempotencyKey, commandId: uuidSchema,
    }).strict(),
} as const;
export type OwnerBatchReviewRequest = z.infer<(typeof requestSchemas)[OwnerBatchReviewAction]>;
export const OWNER_BATCH_REVIEW_COMMAND_ERRORS = Object.freeze([
    'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
    'P9_NOT_FOUND', 'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT',
    'P9_CANDIDATE_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
    'P9_INTERNAL_ERROR',
] as const);

export function parseOwnerBatchReviewRequest(value: unknown): OwnerBatchReviewRequest {
    const action = value && typeof value === 'object'
        ? (value as { action?: unknown }).action : undefined;
    const schema = typeof action === 'string'
        ? requestSchemas[action as OwnerBatchReviewAction] : undefined;
    const result = schema?.safeParse(value);
    if (!result?.success) throw new OwnerBatchReviewContractError();
    return result.data as OwnerBatchReviewRequest;
}

const forbidden = /^(?:raw_?payload|provider_?payload|confidence|geometry|scan_?url|signed_?url|object_?path|sha256|cost|attempt_?count|lease_?token|prompt|correlation_?id|store_?id|created_?by)$/iu;
function hasForbidden(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(hasForbidden);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) => forbidden.test(key) || hasForbidden(child));
}

export function decodeOwnerBatchReviewResponse<Action extends OwnerBatchReviewAction>(
    action: Action, value: unknown,
): z.infer<(typeof schemas)[Action]> {
    if (hasForbidden(value)) throw new OwnerBatchReviewContractError();
    const result = z.object({
        contractVersion: z.literal(OWNER_BATCH_REVIEW_CONTRACT_VERSION), data: schemas[action],
    }).strict().safeParse(value);
    if (!result.success) throw new OwnerBatchReviewContractError();
    return (result.data as unknown as {
        data: z.infer<(typeof schemas)[Action]>;
    }).data;
}
