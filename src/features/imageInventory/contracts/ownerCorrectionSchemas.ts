import { z } from 'zod';
import { uuidSchema, versionSchema } from './ownerUxCommonSchemas';
import { languageSchema, safeTextSchema } from './ownerUxValidation';

const idempotencyKeySchema = z.string().min(16).max(128)
    .regex(/^[A-Za-z0-9._:-]+$/u);

export const addManualCandidateRequestSchema = z.object({
    sessionId: uuidSchema,
    title: safeTextSchema(1, 512),
    authors: z.array(safeTextSchema(1, 256)).max(20),
    language: languageSchema,
    idempotencyKey: idempotencyKeySchema,
    commandId: uuidSchema,
}).strict().superRefine((value, context) => {
    const normalized = value.authors.map((author) => author.normalize('NFC'));
    if (new Set(normalized).size !== normalized.length) {
        context.addIssue({ code: 'custom', path: ['authors'], message: 'authors must be unique' });
    }
});

export const markFalseRequestSchema = z.object({
    candidateId: uuidSchema,
    expectedCandidateVersion: versionSchema,
    idempotencyKey: idempotencyKeySchema,
    commandId: uuidSchema,
}).strict();

const allowedActionSchema = z.enum([
    'approve',
    'reject',
    'replace',
    'leave_unresolved',
]);

export const variantReviewRowSchema = z.object({
    proposal_id: uuidSchema,
    concurrency_version: versionSchema,
    target_type: z.enum(['title', 'author']),
    author_position: z.number().int().min(0).max(19).nullable(),
    confirmed_source_text: safeTextSchema(1, 512),
    proposed_text: safeTextSchema(1, 256),
    variant_type: z.enum(['primary_roman', 'roman_alternative', 'translation_candidate']),
    source_language: languageSchema,
    source_script: z.string().regex(/^[A-Z][a-z]{3}$/u),
    variant_language: languageSchema,
    variant_script: z.string().regex(/^[A-Z][a-z]{3}$/u),
    lifecycle_status: z.enum(['proposed', 'active', 'rejected', 'stale']),
    generation_source: z.string(),
    provider_key: z.string(),
    model_key: z.string(),
    model_version: z.string(),
    prompt_version: z.string(),
    schema_version: z.string(),
    automatic_activation_denial_reason: z.string().nullable(),
    stale_conflict_reason: z.string().nullable(),
    created_at: z.iso.datetime({ offset: true }),
    allowed_actions: z.array(allowedActionSchema),
}).strict().superRefine((value, context) => {
    if ((value.target_type === 'title') !== (value.author_position === null)) {
        context.addIssue({ code: 'custom', message: 'author position is inconsistent' });
    }
});

export type OwnerVariantReview = Readonly<{
    proposalId: string;
    version: number;
    targetType: 'title' | 'author';
    authorPosition: number | null;
    confirmedSourceText: string;
    proposedText: string;
    variantType: 'primary_roman' | 'roman_alternative' | 'translation_candidate';
    sourceLanguage: string;
    sourceScript: string;
    variantLanguage: string;
    variantScript: string;
    lifecycleStatus: 'proposed' | 'active' | 'rejected' | 'stale';
    staleConflictReason: string | null;
    createdAt: string;
    allowedActions: Array<'approve' | 'reject' | 'replace' | 'leave_unresolved'>;
}>;

export function toOwnerVariantReview(
    row: z.infer<typeof variantReviewRowSchema>,
): OwnerVariantReview {
    return {
        proposalId: row.proposal_id,
        version: row.concurrency_version,
        targetType: row.target_type,
        authorPosition: row.author_position,
        confirmedSourceText: row.confirmed_source_text,
        proposedText: row.proposed_text,
        variantType: row.variant_type,
        sourceLanguage: row.source_language,
        sourceScript: row.source_script,
        variantLanguage: row.variant_language,
        variantScript: row.variant_script,
        lifecycleStatus: row.lifecycle_status,
        staleConflictReason: row.stale_conflict_reason,
        createdAt: row.created_at,
        allowedActions: row.allowed_actions,
    };
}

const reasonSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/u);
const noteSchema = safeTextSchema(1, 500).nullable();

export const decideVariantRequestSchema = z.object({
    storeId: uuidSchema,
    proposalId: uuidSchema,
    expectedVersion: versionSchema,
    action: z.enum(['approve', 'reject']),
    reason: reasonSchema,
    note: noteSchema,
    idempotencyKey: idempotencyKeySchema,
}).strict();

export const replaceVariantRequestSchema = z.object({
    storeId: uuidSchema,
    sourceProposalId: uuidSchema,
    expectedVersion: versionSchema,
    variantText: safeTextSchema(1, 256),
    variantLanguage: languageSchema,
    variantScript: z.literal('Latn'),
    variantType: z.enum(['primary_roman', 'roman_alternative', 'translation_candidate']),
    reason: reasonSchema,
    note: noteSchema,
    idempotencyKey: idempotencyKeySchema,
}).strict().superRefine((value, context) => {
    if (
        value.variantType === 'translation_candidate'
        && value.variantLanguage.split('-')[0] !== 'en'
    ) context.addIssue({ code: 'custom', path: ['variantLanguage'], message: 'translation must be English' });
});

export const decideVariantResponseSchema = z.object({
    decision_id: uuidSchema,
    proposal_id: uuidSchema,
    status: z.enum(['active', 'rejected']),
    version: versionSchema,
    replayed: z.boolean(),
}).strict();

export const replaceVariantResponseSchema = z.object({
    decision_id: uuidSchema,
    source_proposal_id: uuidSchema,
    replacement_proposal_id: uuidSchema,
    status: z.literal('active'),
    replayed: z.boolean(),
}).strict();

export const candidateUuidSchema = uuidSchema;
