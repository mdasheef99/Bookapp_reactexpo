import { z } from 'zod';
import { OWNER_UX_CONTRACT_VERSION, type OwnerUxQueryAction } from './ownerUxContracts';
import { uuidSchema } from './ownerUxCommonSchemas';

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
    read_scan_readiness: z.object({
        action: z.literal('read_scan_readiness'),
        contractVersion,
        sessionId: uuidSchema,
    }).strict(),
} as const;

export function decodeOwnerUxRequest<Action extends OwnerUxQueryAction>(
    action: Action,
    value: unknown,
): z.infer<(typeof requestSchemas)[Action]> | null {
    const result = requestSchemas[action].safeParse(value);
    return result.success
        ? result.data as unknown as z.infer<(typeof requestSchemas)[Action]>
        : null;
}
