import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
    addManualCandidateRequestSchema,
    candidateUuidSchema,
    decideVariantRequestSchema,
    decideVariantResponseSchema,
    markFalseRequestSchema,
    replaceVariantRequestSchema,
    replaceVariantResponseSchema,
    toOwnerVariantReview,
    variantReviewRowSchema,
    type OwnerVariantReview,
} from '../contracts/ownerCorrectionSchemas';
import {
    captureOwnerRequest,
    type OwnerRequestIdentity,
} from '../identity/ownerRequestFence';

const candidateErrorCodeSchema = z.enum([
    'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT',
    'P9_LIMIT_EXCEEDED', 'P9_REQUEST_INVALID', 'P9_CANDIDATE_VERSION_CONFLICT',
    'P9_IDEMPOTENCY_MISMATCH', 'P9_INTERNAL_ERROR',
]);
const variantErrorCodeSchema = z.enum([
    'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID', 'P9_IDEMPOTENCY_CONFLICT',
    'P9_CROSS_TENANT_DENIED', 'P9_VARIANT_SOURCE_MISMATCH', 'P9_STALE_VERSION',
    'P9_STATE_CONFLICT', 'P9_VARIANT_DUPLICATE', 'P9_INTERNAL_ERROR',
]);
type CandidateErrorCode = z.infer<typeof candidateErrorCodeSchema>;
type VariantErrorCode = z.infer<typeof variantErrorCodeSchema>;
export type OwnerCorrectionErrorCode = CandidateErrorCode | VariantErrorCode;

const messages: Record<OwnerCorrectionErrorCode, string> = {
    P9_AUTH_REQUIRED: 'Authentication is required.',
    P9_OWNER_NOT_AUTHORIZED: 'This operation is unavailable.',
    P9_STATE_CONFLICT: 'The item state changed. Refresh before trying again.',
    P9_LIMIT_EXCEEDED: 'This scan session cannot accept another candidate.',
    P9_REQUEST_INVALID: 'Check the entered information and try again.',
    P9_CANDIDATE_VERSION_CONFLICT: 'The candidate changed. Refresh before trying again.',
    P9_IDEMPOTENCY_MISMATCH: 'This retry no longer matches the original request.',
    P9_IDEMPOTENCY_CONFLICT: 'This retry no longer matches the original decision.',
    P9_CROSS_TENANT_DENIED: 'This variant is unavailable.',
    P9_VARIANT_SOURCE_MISMATCH: 'The variant source changed. Review the latest version.',
    P9_STALE_VERSION: 'The variant changed. Review the latest version.',
    P9_VARIANT_DUPLICATE: 'That replacement already exists.',
    P9_INTERNAL_ERROR: 'The operation could not be completed.',
};

export class OwnerCorrectionClientError extends Error {
    constructor(readonly code: OwnerCorrectionErrorCode) {
        super(messages[code]);
        this.name = 'OwnerCorrectionClientError';
    }
}

type RpcResult = Readonly<{ data: unknown; error: unknown }>;
type CandidateOperation = 'add' | 'false';
type VariantOperation = 'review' | 'decide' | 'replace';

function requestInvalid(): OwnerCorrectionClientError {
    return new OwnerCorrectionClientError('P9_REQUEST_INVALID');
}

function errorToken(error: unknown): string | null {
    if (!error || typeof error !== 'object' || !('message' in error)) return null;
    const message = (error as { message?: unknown }).message;
    if (typeof message !== 'string') return null;
    return message.match(/(?:^|\s)(P9_[A-Z0-9_]+)(?:\s|$)/u)?.[1] ?? null;
}

function normalizeRpcError(
    operation: CandidateOperation | VariantOperation,
    error: unknown,
): OwnerCorrectionClientError {
    const token = errorToken(error);
    const parsed = operation === 'add' || operation === 'false'
        ? candidateErrorCodeSchema.safeParse(token)
        : variantErrorCodeSchema.safeParse(token);
    return new OwnerCorrectionClientError(parsed.success ? parsed.data : 'P9_INTERNAL_ERROR');
}

async function authenticatedRpc(
    operation: CandidateOperation | VariantOperation,
    name: string,
    args: Record<string, unknown>,
    identity: OwnerRequestIdentity,
    externalSignal?: AbortSignal,
): Promise<{ result: RpcResult; userId: string }> {
    let fence;
    try {
        fence = captureOwnerRequest(identity, externalSignal);
        const auth = await supabase.auth.getUser();
        fence.assertCurrent();
        if (auth.error || auth.data.user?.id !== identity.userId) {
            throw new OwnerCorrectionClientError('P9_AUTH_REQUIRED');
        }
        const result = await supabase.rpc(name, args).abortSignal(fence.signal);
        fence.assertCurrent();
        if (result.error) throw normalizeRpcError(operation, result.error);
        return { result, userId: auth.data.user.id };
    } catch (error) {
        if (error instanceof OwnerCorrectionClientError) throw error;
        if (error instanceof Error && error.message === 'OWNER_IDENTITY_CHANGED') {
            throw new OwnerCorrectionClientError('P9_AUTH_REQUIRED');
        }
        throw new OwnerCorrectionClientError('P9_INTERNAL_ERROR');
    } finally {
        fence?.release();
    }
}

export type AddManualCandidateRequest = z.input<typeof addManualCandidateRequestSchema>;
export type MarkFalseRequest = z.input<typeof markFalseRequestSchema>;
export type DecideVariantRequest = z.input<typeof decideVariantRequestSchema>;
export type ReplaceVariantRequest = z.input<typeof replaceVariantRequestSchema>;
export type ExpectedVariant = Readonly<{ proposalId: string; version: number }>;

const parseOrThrow = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw requestInvalid();
    return parsed.data;
};

const decodeOrInternal = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new OwnerCorrectionClientError('P9_INTERNAL_ERROR');
    return parsed.data;
};

const MAX_VARIANT_PAGES = 3;
const VARIANT_PAGE_SIZE = 100;

export const ownerCorrectionService = {
    async addManualCandidate(input: AddManualCandidateRequest, identity: OwnerRequestIdentity) {
        const request = parseOrThrow(addManualCandidateRequestSchema, input);
        const { result, userId } = await authenticatedRpc('add', 'phase9_add_manual_candidate', {
            p_session_id: request.sessionId,
            p_title: request.title,
            p_authors: request.authors,
            p_language: request.language,
            p_idempotency_key: request.idempotencyKey,
            p_command_id: request.commandId,
        }, identity);
        return {
            candidateId: decodeOrInternal(candidateUuidSchema, result.data),
            authenticatedUserId: userId,
        };
    },

    async markFalse(input: MarkFalseRequest, identity: OwnerRequestIdentity) {
        const request = parseOrThrow(markFalseRequestSchema, input);
        const { result, userId } = await authenticatedRpc('false', 'phase9_skip_candidate', {
            p_candidate_id: request.candidateId,
            p_expected_version: request.expectedCandidateVersion,
            p_reason: 'false_detection',
            p_idempotency_key: request.idempotencyKey,
            p_command_id: request.commandId,
        }, identity);
        return {
            candidateId: decodeOrInternal(candidateUuidSchema, result.data),
            authenticatedUserId: userId,
        };
    },

    async resolveExpectedVariants(
        storeId: string,
        expected: ReadonlyArray<ExpectedVariant>,
        identity: OwnerRequestIdentity,
        signal?: AbortSignal,
    ): Promise<OwnerVariantReview[]> {
        const store = parseOrThrow(z.string().uuid(), storeId);
        const expectedRows = parseOrThrow(z.array(z.object({
            proposalId: z.string().uuid(), version: z.number().int().positive().safe(),
        }).strict()).max(60), expected);
        if (!expectedRows.length) return [];
        const expectedIds = new Set(expectedRows.map((row) => row.proposalId));
        const found = new Map<string, OwnerVariantReview>();
        let cursorCreatedAt: string | null = null;
        let cursorProposalId: string | null = null;
        for (let page = 0; page < MAX_VARIANT_PAGES && found.size < expectedIds.size; page += 1) {
            const { result } = await authenticatedRpc('review', 'phase9_owner_search_variant_review', {
                p_store_id: store,
                p_status: null,
                p_target_type: null,
                p_cursor_created_at: cursorCreatedAt,
                p_cursor_proposal_id: cursorProposalId,
                p_limit: VARIANT_PAGE_SIZE,
            }, identity, signal);
            const rows = decodeOrInternal(z.array(variantReviewRowSchema).max(VARIANT_PAGE_SIZE), result.data);
            for (const row of rows) {
                if (expectedIds.has(row.proposal_id)) found.set(row.proposal_id, toOwnerVariantReview(row));
            }
            if (rows.length < VARIANT_PAGE_SIZE) break;
            const last = rows[rows.length - 1];
            cursorCreatedAt = last.created_at;
            cursorProposalId = last.proposal_id;
        }
        if (found.size !== expectedIds.size) throw new OwnerCorrectionClientError('P9_INTERNAL_ERROR');
        return expectedRows.map((row) => found.get(row.proposalId)).filter(
            (row): row is OwnerVariantReview => Boolean(row),
        );
    },

    async decideVariant(input: DecideVariantRequest, identity: OwnerRequestIdentity) {
        const request = parseOrThrow(decideVariantRequestSchema, input);
        const { result, userId } = await authenticatedRpc('decide', 'phase9_owner_decide_search_variant', {
            p_store_id: request.storeId,
            p_proposal_id: request.proposalId,
            p_expected_version: request.expectedVersion,
            p_action: request.action,
            p_reason: request.reason,
            p_note: request.note,
            p_idempotency_key: request.idempotencyKey,
        }, identity);
        return { ...decodeOrInternal(decideVariantResponseSchema, result.data), authenticatedUserId: userId };
    },

    async replaceVariant(input: ReplaceVariantRequest, identity: OwnerRequestIdentity) {
        const request = parseOrThrow(replaceVariantRequestSchema, input);
        const { result, userId } = await authenticatedRpc('replace', 'phase9_owner_replace_search_variant', {
            p_store_id: request.storeId,
            p_source_proposal_id: request.sourceProposalId,
            p_expected_version: request.expectedVersion,
            p_variant_text: request.variantText,
            p_variant_language: request.variantLanguage,
            p_variant_script: request.variantScript,
            p_variant_type: request.variantType,
            p_reason: request.reason,
            p_note: request.note,
            p_idempotency_key: request.idempotencyKey,
        }, identity);
        return { ...decodeOrInternal(replaceVariantResponseSchema, result.data), authenticatedUserId: userId };
    },
};
