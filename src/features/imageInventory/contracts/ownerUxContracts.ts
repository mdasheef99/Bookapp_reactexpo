import { z } from 'zod';
import {
    blockerCountsSchema,
    closeSummarySchema,
    countSchema,
    pageInfoSchema,
    sessionStatusSchema,
    timestampSchema,
    uuidSchema,
    versionSchema,
} from './ownerUxCommonSchemas';
import {
    candidateDetailSchema,
    candidateSummarySchema,
} from './ownerUxCandidateSchemas';
import {
    languageSchema,
    safeTextSchema,
} from './ownerUxValidation';

export const OWNER_UX_CONTRACT_VERSION = 'phase9-owner-ux-v1' as const;

const closeStateSchema = z.enum(['not_closeable', 'closeable', 'closed', 'expired']);

const sessionSummarySchema = z.object({
    sessionId: uuidSchema,
    status: sessionStatusSchema,
    sessionVersion: versionSchema,
    startedAt: timestampSchema,
    updatedAt: timestampSchema,
    closedAt: timestampSchema.nullable(),
    expiresAt: timestampSchema,
    defaults: z.object({
        language: languageSchema,
        script: z.string().regex(/^[A-Z][a-z]{3}$/u).nullable(),
        condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
        location: safeTextSchema(1, 120),
        quantity: z.number().int().min(1).max(1000).safe(),
        publication: z.enum(['private', 'publish']),
    }).strict(),
    closeSummary: closeSummarySchema,
    allInputsTerminal: z.boolean(),
    closeState: closeStateSchema,
    presentationRevision: versionSchema,
}).strict().superRefine((value, context) => {
    const invalid = (value.status === 'closed') !== (value.closeState === 'closed')
        || (value.status === 'expired') !== (value.closeState === 'expired')
        || (value.closeState === 'closeable' && !value.allInputsTerminal);
    if (invalid) context.addIssue({ code: 'custom', message: 'session close state is inconsistent' });
});

const readinessSchema = z.object({
    sessionId: uuidSchema,
    sessionStatus: sessionStatusSchema,
    sessionVersion: versionSchema,
    allInputsTerminal: z.boolean(),
    closeSummary: closeSummarySchema,
    blockerCounts: blockerCountsSchema,
    nextBlockingCandidateId: uuidSchema.nullable(),
    closeState: closeStateSchema,
    closeAllowed: z.boolean(),
    presentationRevision: versionSchema,
}).strict().superRefine((value, context) => {
    const invalid = (value.sessionStatus === 'closed') !== (value.closeState === 'closed')
        || (value.sessionStatus === 'expired') !== (value.closeState === 'expired')
        || value.closeAllowed !== (
            value.sessionStatus === 'active'
            && value.closeState === 'closeable'
            && value.allInputsTerminal
        );
    if (invalid) context.addIssue({ code: 'custom', message: 'readiness close state is inconsistent' });
});

const inputProgressSchema = z.object({
    inputId: uuidSchema,
    ordinal: z.number().int().min(1).safe(),
    sourceKind: z.enum(['camera', 'gallery']),
    inputState: z.enum(['uploaded', 'validating', 'queued', 'processing', 'ready', 'failed', 'skipped']),
    inputVersion: versionSchema,
    presentationState: z.enum(['checking_image', 'finding_books', 'ready', 'needs_attention']),
    safeCode: z.string().regex(/^P9_[A-Z0-9_]+$/u).nullable(),
    retryState: z.enum(['none', 'server_retrying', 'new_upload_required']),
    terminal: z.boolean(),
    polling: z.boolean(),
    detectedCandidateCount: z.number().int().min(0).max(15).safe().nullable(),
    acceptedCandidateCount: z.number().int().min(0).max(15).safe().nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
}).strict().superRefine((value, context) => {
    if (value.terminal === value.polling) {
        context.addIssue({ code: 'custom', message: 'input terminal and polling flags conflict' });
    }
    if (value.inputState === 'ready' && value.presentationState !== 'ready') {
        context.addIssue({ code: 'custom', message: 'ready input requires ready presentation' });
    }
    if (value.retryState === 'new_upload_required' && !value.terminal) {
        context.addIssue({ code: 'custom', message: 'new upload retry requires terminal input' });
    }
});

const responseSchemas = {
    discover_scan_session: z.object({
        activeSession: z.object({
            sessionId: uuidSchema,
            status: z.enum(['active', 'closing']),
            sessionVersion: versionSchema,
            startedAt: timestampSchema,
            updatedAt: timestampSchema,
            inputCount: countSchema,
            candidateCount: countSchema,
            attentionCount: countSchema,
        }).strict().nullable(),
        needsReviewCount: countSchema,
        reviewScopeVersion: versionSchema,
    }).strict(),
    read_scan_session: sessionSummarySchema,
    list_scan_inputs: z.object({
        items: z.array(inputProgressSchema),
        pageInfo: pageInfoSchema,
        sessionVersion: versionSchema,
        presentationRevision: versionSchema,
    }).strict(),
    list_scan_candidates: z.object({
        items: z.array(candidateSummarySchema),
        pageInfo: pageInfoSchema,
        scopeVersion: versionSchema,
        sessionVersion: versionSchema.nullable(),
    }).strict(),
    read_scan_candidate: candidateDetailSchema,
    update_candidate_review: candidateDetailSchema,
    read_scan_readiness: readinessSchema,
} as const;

export type OwnerUxAction = keyof typeof responseSchemas;
export type OwnerUxQueryAction = Exclude<OwnerUxAction, 'update_candidate_review'>;
export type OwnerDiscovery = z.infer<typeof responseSchemas.discover_scan_session>;
export type OwnerSessionSummary = z.infer<typeof responseSchemas.read_scan_session>;
export type OwnerInputProgress = z.infer<typeof inputProgressSchema>;
export type OwnerInputPage = z.infer<typeof responseSchemas.list_scan_inputs>;
export type OwnerCandidatePage = z.infer<typeof responseSchemas.list_scan_candidates>;
export type OwnerCandidateDetail = z.infer<typeof responseSchemas.read_scan_candidate>;
export type OwnerSessionReadiness = z.infer<typeof responseSchemas.read_scan_readiness>;

export class OwnerUxResponseContractError extends Error {
    constructor() {
        super('The inventory response could not be validated.');
        this.name = 'OwnerUxResponseContractError';
    }
}

const exactForbiddenKeys = new Set([
    'rawpayload',
    'providerpayload',
    'confidence',
    'geometry',
    'scanurl',
    'signedurl',
    'objectpath',
    'sha256',
    'cost',
    'attemptcount',
    'leasetoken',
    'prompt',
    'correlationid',
    'storeid',
    'createdby',
]);
const sensitiveKeys = new Set([
    'authorization',
    'authheader',
    'bearer',
    'capability',
    'capabilities',
    'capabilityid',
    'uploadtoken',
    'accesstoken',
    'refreshtoken',
    'credentials',
    'servicerolekey',
]);

function normalizedKey(key: string): string {
    return key.normalize('NFKC').replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function hasForbiddenKey(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(hasForbiddenKey);
    if (!value || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) => {
        const normalized = normalizedKey(key);
        return exactForbiddenKeys.has(normalized)
            || sensitiveKeys.has(normalized)
            || normalized.startsWith('capabilit')
            || normalized.endsWith('token')
            || normalized.endsWith('secret')
            || normalized.includes('servicerole')
            || hasForbiddenKey(child);
    });
}

export function decodeOwnerUxResponse<Action extends OwnerUxAction>(
    action: Action,
    value: unknown,
): z.infer<(typeof responseSchemas)[Action]> {
    if (hasForbiddenKey(value)) throw new OwnerUxResponseContractError();
    const result = z.object({
        contractVersion: z.literal(OWNER_UX_CONTRACT_VERSION),
        data: responseSchemas[action],
    }).strict().safeParse(value);
    if (!result.success) throw new OwnerUxResponseContractError();
    return (result.data as unknown as {
        data: z.infer<(typeof responseSchemas)[Action]>;
    }).data;
}
