import { z } from 'zod';
import {
    OWNER_UX_CONTRACT_VERSION,
    type OwnerUxAction,
} from './ownerUxContracts';
import { uuidSchema } from './ownerUxCommonSchemas';
import { ownerCandidateReviewSchema } from './ownerUxReviewSchema';

const contractVersion = z.literal(OWNER_UX_CONTRACT_VERSION);
const pageSize = z.number().int().min(1).max(50).safe().optional();
const cursor = z.string().min(1).max(4096).nullable().optional();

const requestSchemas = {
    discover_scan_session: z.object({
        action: z.literal('discover_scan_session'),
        contractVersion,
    }).strict(),
    read_scan_session: z.object({
        action: z.literal('read_scan_session'),
        contractVersion,
        sessionId: uuidSchema,
    }).strict(),
    list_scan_inputs: z.object({
        action: z.literal('list_scan_inputs'),
        contractVersion,
        sessionId: uuidSchema,
        pageSize,
        cursor,
    }).strict(),
    list_scan_candidates: z.object({
        action: z.literal('list_scan_candidates'),
        contractVersion,
        scope: z.enum(['session', 'needs_review']),
        sessionId: uuidSchema.optional(),
        attention: z.enum(['all', 'needs_attention', 'review_ready']).optional(),
        pageSize,
        cursor,
    }).strict().superRefine((value, context) => {
        if (value.scope === 'session' && !value.sessionId) {
            context.addIssue({ code: 'custom', message: 'session scope requires sessionId' });
        }
        if (value.scope === 'needs_review' && value.sessionId) {
            context.addIssue({ code: 'custom', message: 'needs-review scope forbids sessionId' });
        }
        if (value.scope === 'needs_review' && value.attention === 'review_ready') {
            context.addIssue({ code: 'custom', message: 'needs-review scope forbids review-ready filter' });
        }
    }),
    read_scan_candidate: z.object({
        action: z.literal('read_scan_candidate'),
        contractVersion,
        sessionId: uuidSchema,
        candidateId: uuidSchema,
    }).strict(),
    update_candidate_review: z.object({
        action: z.literal('update_candidate_review'),
        contractVersion,
        sessionId: uuidSchema,
        candidateId: uuidSchema,
        expectedCandidateVersion: z.number().int().positive().safe(),
        expectedMetadataRevision: z.number().int().positive().safe(),
        review: ownerCandidateReviewSchema,
        idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u),
        commandId: uuidSchema,
    }).strict(),
    read_scan_readiness: z.object({
        action: z.literal('read_scan_readiness'),
        contractVersion,
        sessionId: uuidSchema,
    }).strict(),
    remove_scan_input: z.object({
        action: z.literal('remove_scan_input'),
        contractVersion: z.literal(OWNER_UX_CONTRACT_VERSION),
        sessionId: uuidSchema,
        inputId: uuidSchema,
        expectedInputVersion: z.number().int().positive().safe(),
        idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u),
        commandId: uuidSchema,
    }).strict(),
    add_candidate_to_inventory: z.object({
        action: z.literal('add_candidate_to_inventory'),
        contractVersion,
        sessionId: uuidSchema,
        candidateId: uuidSchema,
        expectedCandidateVersion: z.number().int().positive().safe(),
        expectedReviewVersion: z.number().int().positive().safe(),
        expectedMetadataRevision: z.number().int().positive().safe(),
        idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u),
        commandId: uuidSchema,
    }).strict(),
    close_scan_session: z.object({
        action: z.literal('close_scan_session'),
        contractVersion,
        sessionId: uuidSchema,
        expectedSessionVersion: z.number().int().positive().safe(),
        idempotencyKey: z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u),
        commandId: uuidSchema,
    }).strict(),
} as const;

export function decodeOwnerUxRequest<Action extends OwnerUxAction>(
    action: Action,
    value: unknown,
): z.infer<(typeof requestSchemas)[Action]> | null {
    const result = requestSchemas[action].safeParse(value);
    return result.success
        ? result.data as unknown as z.infer<(typeof requestSchemas)[Action]>
        : null;
}
