import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
    decodeOwnerUxResponse,
    OWNER_UX_CONTRACT_VERSION,
    type OwnerCandidateDetail,
    type OwnerCandidatePage,
    type OwnerDiscovery,
    type OwnerInputPage,
    type OwnerSessionReadiness,
    type OwnerSessionSummary,
    type OwnerUxAction,
} from '../contracts/ownerUxContracts';
import type { OwnerCandidateReview } from '../contracts/ownerUxReviewSchema';
import { decodeOwnerUxRequest } from '../contracts/ownerUxRequestContracts';

const errorCodes = z.enum([
    'P9_AUTH_REQUIRED',
    'P9_OWNER_NOT_AUTHORIZED',
    'P9_REQUEST_INVALID',
    'P9_CURSOR_INVALID',
    'P9_NOT_FOUND',
    'P9_STATE_CONFLICT',
    'P9_VERSION_CONFLICT',
    'P9_CANDIDATE_VERSION_CONFLICT',
    'P9_IDEMPOTENCY_MISMATCH',
    'P9_INTERNAL_ERROR',
]);
export type OwnerUxErrorCode = z.infer<typeof errorCodes>;

const safeErrorEnvelope = z.object({
    error: errorCodes,
    retryable: z.boolean(),
    message: z.string().min(1).max(240),
}).strict();

export class OwnerUxClientError extends Error {
    constructor(
        readonly code: OwnerUxErrorCode,
        readonly retryable: boolean,
        message: string,
    ) {
        super(message);
        this.name = 'OwnerUxClientError';
    }
}

const errorRegistry: Record<OwnerUxErrorCode, { retryable: boolean; message: string }> = {
    P9_AUTH_REQUIRED: { retryable: false, message: 'Authentication is required.' },
    P9_OWNER_NOT_AUTHORIZED: { retryable: false, message: 'Owner access is required.' },
    P9_REQUEST_INVALID: { retryable: false, message: 'The request is invalid.' },
    P9_CURSOR_INVALID: { retryable: false, message: 'The page cursor is invalid.' },
    P9_NOT_FOUND: { retryable: false, message: 'The requested item was not found.' },
    P9_STATE_CONFLICT: { retryable: true, message: 'The item state changed. Refresh and try again.' },
    P9_VERSION_CONFLICT: { retryable: true, message: 'The session changed. Refresh and try again.' },
    P9_CANDIDATE_VERSION_CONFLICT: { retryable: true, message: 'The candidate changed. Refresh and try again.' },
    P9_IDEMPOTENCY_MISMATCH: { retryable: false, message: 'This retry does not match the original request.' },
    P9_INTERNAL_ERROR: { retryable: true, message: 'The request could not be completed.' },
};
const operationErrors: Record<OwnerUxAction, ReadonlySet<OwnerUxErrorCode>> = {
    discover_scan_session: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_INTERNAL_ERROR',
    ]),
    read_scan_session: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_INTERNAL_ERROR',
    ]),
    list_scan_inputs: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_CURSOR_INVALID',
        'P9_INTERNAL_ERROR',
    ]),
    list_scan_candidates: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_CURSOR_INVALID',
        'P9_INTERNAL_ERROR',
    ]),
    read_scan_candidate: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_NOT_FOUND',
        'P9_INTERNAL_ERROR',
    ]),
    update_candidate_review: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_STATE_CONFLICT',
        'P9_CANDIDATE_VERSION_CONFLICT',
        'P9_VERSION_CONFLICT',
        'P9_IDEMPOTENCY_MISMATCH',
        'P9_INTERNAL_ERROR',
    ]),
    read_scan_readiness: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_INTERNAL_ERROR',
    ]),
    close_scan_session: new Set([
        'P9_AUTH_REQUIRED',
        'P9_OWNER_NOT_AUTHORIZED',
        'P9_REQUEST_INVALID',
        'P9_STATE_CONFLICT',
        'P9_VERSION_CONFLICT',
        'P9_IDEMPOTENCY_MISMATCH',
        'P9_INTERNAL_ERROR',
    ]),
};

function registeredError(code: OwnerUxErrorCode): OwnerUxClientError {
    const entry = errorRegistry[code];
    return new OwnerUxClientError(code, entry.retryable, entry.message);
}

const internalError = () => registeredError('P9_INTERNAL_ERROR');

async function errorBody(error: unknown): Promise<unknown> {
    if (!error || typeof error !== 'object' || !('context' in error)) return null;
    const context = (error as { context?: unknown }).context;
    if (!context || typeof context !== 'object' || !('json' in context)) return null;
    const json = (context as { json?: unknown }).json;
    if (typeof json !== 'function') return null;
    try {
        return await (json as () => Promise<unknown>)();
    } catch {
        return null;
    }
}

async function normalizeError(
    action: OwnerUxAction,
    error: unknown,
): Promise<OwnerUxClientError> {
    const parsed = safeErrorEnvelope.safeParse(await errorBody(error));
    if (!parsed.success || !operationErrors[action].has(parsed.data.error)) {
        return internalError();
    }
    return registeredError(parsed.data.error);
}

async function invoke<Action extends OwnerUxAction>(
    action: Action,
    body: Record<string, unknown>,
) {
    const request = decodeOwnerUxRequest(action, {
        action,
        contractVersion: OWNER_UX_CONTRACT_VERSION,
        ...body,
    });
    if (!request) throw registeredError('P9_REQUEST_INVALID');
    try {
        const result = await supabase.functions.invoke('phase9-owner-ingestion', {
            body: request,
        });
        if (result.error) throw await normalizeError(action, result.error);
        const data = decodeOwnerUxResponse(action, result.data);
        if (
            action === 'list_scan_candidates'
            && 'scope' in request
            && ((request.scope === 'session') !== (
                (data as OwnerCandidatePage).sessionVersion !== null
            ))
        ) throw internalError();
        return data;
    } catch (error) {
        if (error instanceof OwnerUxClientError) throw error;
        throw internalError();
    }
}

export type CandidatePageRequest =
    | {
        scope: 'session';
        sessionId: string;
        attention?: 'all' | 'needs_attention' | 'review_ready';
        pageSize?: number;
        cursor?: string | null;
    }
    | {
        scope: 'needs_review';
        attention?: 'all' | 'needs_attention';
        pageSize?: number;
        cursor?: string | null;
    };

export type UpdateCandidateReviewRequest = Readonly<{
    sessionId: string;
    candidateId: string;
    expectedCandidateVersion: number;
    expectedMetadataRevision: number;
    review: OwnerCandidateReview;
    idempotencyKey: string;
    commandId: string;
}>;

export type CloseScanSessionRequest = Readonly<{
    sessionId: string;
    expectedSessionVersion: number;
    idempotencyKey: string;
    commandId: string;
}>;

export const ownerUxService = {
    discover(): Promise<OwnerDiscovery> {
        return invoke('discover_scan_session', {});
    },
    readSession(sessionId: string): Promise<OwnerSessionSummary> {
        return invoke('read_scan_session', { sessionId });
    },
    listInputs(
        sessionId: string,
        pageSize = 20,
        cursor: string | null = null,
    ): Promise<OwnerInputPage> {
        return invoke('list_scan_inputs', { sessionId, pageSize, cursor });
    },
    listCandidates(request: CandidatePageRequest): Promise<OwnerCandidatePage> {
        return invoke('list_scan_candidates', {
            ...request,
            pageSize: request.pageSize ?? 20,
            cursor: request.cursor ?? null,
        });
    },
    readCandidate(sessionId: string, candidateId: string): Promise<OwnerCandidateDetail> {
        return invoke('read_scan_candidate', { sessionId, candidateId });
    },
    updateCandidateReview(request: UpdateCandidateReviewRequest): Promise<OwnerCandidateDetail> {
        return invoke('update_candidate_review', request);
    },
    readReadiness(sessionId: string): Promise<OwnerSessionReadiness> {
        return invoke('read_scan_readiness', { sessionId });
    },
    closeSession(request: CloseScanSessionRequest): Promise<OwnerSessionReadiness> {
        return invoke('close_scan_session', request);
    },
};
