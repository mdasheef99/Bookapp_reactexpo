import { z } from 'zod';
import { ownerCandidateReviewSchema } from './ownerUxReviewSchema';
import {
    attentionCodeSchema,
    blockerSchema,
    candidateStateSchema,
    conditionSchema,
    countSchema,
    metadataStateSchema,
    timestampSchema,
    uuidSchema,
    versionSchema,
} from './ownerUxCommonSchemas';
import {
    languageSchema,
    nullableSafeTextSchema,
    safeTextSchema,
} from './ownerUxValidation';

export const candidateSummarySchema = z.object({
    sessionId: uuidSchema,
    sessionStartedAt: timestampSchema,
    sessionExpiresAt: timestampSchema,
    sessionStatus: z.enum(['active', 'closing', 'closed']),
    candidateId: uuidSchema,
    inputId: uuidSchema.nullable(),
    ordinal: z.number().int().min(1).max(15).safe(),
    title: safeTextSchema(1, 512),
    authors: z.array(safeTextSchema(1, 256)).max(20),
    language: languageSchema,
    candidateState: candidateStateSchema,
    candidateVersion: versionSchema,
    metadataState: metadataStateSchema,
    reviewDisposition: z.enum(['reviewed', 'skipped_false_detection']).nullable(),
    attentionCodes: z.array(attentionCodeSchema),
    reviewReady: z.boolean(),
    updatedAt: timestampSchema,
}).strict();

const coverReferenceSchema = z.string().min(1).max(512).superRefine((value, context) => {
    try {
        const parsed = new URL(value);
        if (
            parsed.protocol !== 'https:'
            || parsed.hostname.toLowerCase() !== 'books.google.com'
            || parsed.username
            || parsed.password
        ) throw new Error();
    } catch {
        context.addIssue({ code: 'custom', message: 'cover host is not approved' });
    }
});

const metadataSnapshotSchema = z.object({
    title: safeTextSchema(1, 512),
    authors: z.array(safeTextSchema(1, 256)).min(1).max(20),
    language: languageSchema,
    subtitle: nullableSafeTextSchema(512),
    description: nullableSafeTextSchema(5000),
    isbn10: z.string().min(10).max(32).nullable(),
    isbn13: z.string().min(10).max(32).nullable(),
    publisher: nullableSafeTextSchema(256),
    publishedDate: nullableSafeTextSchema(32),
    script: nullableSafeTextSchema(16),
    editionStatement: nullableSafeTextSchema(256),
    series: nullableSafeTextSchema(256),
    volume: nullableSafeTextSchema(64),
    format: nullableSafeTextSchema(128),
    pageCount: z.number().int().min(1).max(100_000).nullable(),
    categories: z.array(safeTextSchema(1, 128)).max(20),
    coverReference: coverReferenceSchema.nullable(),
}).strict();

const metadataSchema = z.object({
    state: metadataStateSchema,
    revision: versionSchema,
    selectionVersion: versionSchema.nullable(),
    selectionId: uuidSchema.nullable(),
    canonicalEditionId: uuidSchema.nullable(),
    snapshot: metadataSnapshotSchema.nullable(),
}).strict().superRefine((value, context) => {
    const selected = value.state === 'selected';
    const selectionComplete = value.selectionVersion !== null
        && value.selectionId !== null
        && value.snapshot !== null;
    const selectionEmpty = value.selectionVersion === null
        && value.selectionId === null
        && value.canonicalEditionId === null
        && value.snapshot === null;
    if ((selected && !selectionComplete) || (!selected && !selectionEmpty)) {
        context.addIssue({ code: 'custom', message: 'metadata selection is inconsistent' });
    }
});

const duplicateAdviceSchema = z.object({
    state: z.enum(['none', 'possible_match', 'compatible_match', 'changed']),
    version: versionSchema.nullable(),
    targetInventoryId: uuidSchema.nullable(),
    matchReason: z.enum([
        'exact_validated_edition',
        'exact_original_title_author_language',
        'strong_original_match',
        'fuzzy_possible_match',
    ]).nullable(),
    compatibility: z.object({
        sameLanguage: z.boolean(),
        sameFormat: z.boolean(),
        sameCondition: z.boolean(),
        samePrice: z.boolean(),
        noCopySpecificDamageOrNote: z.boolean(),
    }).strict().nullable(),
    display: z.object({
        title: safeTextSchema(1, 512),
        authors: z.array(safeTextSchema(1, 256)).max(20),
        isbn10: z.string().min(10).max(32).nullable(),
        isbn13: z.string().min(10).max(32).nullable(),
        language: languageSchema,
        format: nullableSafeTextSchema(128),
        condition: conditionSchema,
        priceMinor: countSchema,
        availableQuantity: countSchema,
        hasDamage: z.boolean(),
        hasApprovedPublicCopyPhoto: z.boolean(),
        hasCopySpecificNote: z.boolean(),
        location: safeTextSchema(1, 120),
    }).strict().nullable(),
    allowedIntents: z.array(z.enum(['increment_quantity', 'create_separate', 'manual_match'])),
}).strict().superRefine((value, context) => {
    const empty = value.version === null
        && value.targetInventoryId === null
        && value.matchReason === null
        && value.compatibility === null
        && value.display === null
        && value.allowedIntents.length === 0;
    const complete = value.version !== null
        && value.targetInventoryId !== null
        && value.matchReason !== null
        && value.compatibility !== null
        && value.display !== null;
    if ((value.state === 'none' && !empty) || (value.state !== 'none' && !complete)) {
        context.addIssue({ code: 'custom', message: 'duplicate advice is inconsistent' });
    }
});

export const candidateDetailSchema = z.object({
    sessionId: uuidSchema,
    candidateId: uuidSchema,
    inputId: uuidSchema.nullable(),
    ordinal: z.number().int().min(1).max(15).safe(),
    candidateState: candidateStateSchema,
    candidateVersion: versionSchema,
    observed: z.object({
        title: safeTextSchema(1, 512),
        authors: z.array(safeTextSchema(1, 256)).max(20),
        language: languageSchema,
        script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
    }).strict(),
    metadata: metadataSchema,
    review: z.object({
        value: ownerCandidateReviewSchema.nullable(),
        reviewVersion: versionSchema.nullable(),
    }).strict().refine(
        (value) => (value.value === null) === (value.reviewVersion === null),
        'review value and version are inconsistent',
    ),
    duplicateAdvice: duplicateAdviceSchema,
    variantSummary: z.object({
        unresolvedCount: countSchema,
        proposalVersions: z.array(z.object({
            proposalId: uuidSchema,
            version: versionSchema,
            allowedActions: z.array(z.enum(['approve', 'reject', 'replace'])),
        }).strict()),
    }).strict(),
    attentionCodes: z.array(attentionCodeSchema),
    readiness: z.object({
        reviewReady: z.boolean(),
        blockers: z.array(blockerSchema),
        derivedFromCandidateVersion: versionSchema,
        derivedFromMetadataRevision: versionSchema,
        derivedFromDuplicateAdviceVersion: versionSchema.nullable(),
    }).strict(),
    allowedActions: z.array(z.enum([
        'save_review',
        'mark_false',
        'open_variant_review',
        'add_missed',
        'view_readiness',
    ])),
    updatedAt: timestampSchema,
}).strict().superRefine((value, context) => {
    if (
        value.readiness.derivedFromCandidateVersion !== value.candidateVersion
        || value.readiness.derivedFromMetadataRevision !== value.metadata.revision
        || value.readiness.derivedFromDuplicateAdviceVersion !== value.duplicateAdvice.version
    ) {
        context.addIssue({ code: 'custom', message: 'readiness revisions are inconsistent' });
    }
});
