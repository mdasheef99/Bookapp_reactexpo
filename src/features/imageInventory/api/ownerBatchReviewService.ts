import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
    OWNER_BATCH_REVIEW_CONTRACT_VERSION,
    decodeOwnerBatchReviewResponse,
    parseOwnerBatchReviewRequest,
    type OwnerBatchReview,
    type OwnerSessionReadinessV3,
} from '../contracts/ownerBatchReviewContracts';
import { OwnerUxClientError } from './ownerUxService';

const safeErrorEnvelope = z.object({
    error: z.string().regex(/^P9_[A-Z0-9_]+$/u),
    retryable: z.boolean(),
    message: z.string().min(1).max(240),
}).strict();

const commandErrorRegistry: Record<string, { retryable: boolean; message: string }> = {
    P9_AUTH_REQUIRED: { retryable: false, message: 'Authentication is required.' },
    P9_OWNER_NOT_AUTHORIZED: { retryable: false, message: 'Owner access is required.' },
    P9_REQUEST_INVALID: { retryable: false, message: 'The request is invalid.' },
    P9_NOT_FOUND: { retryable: false, message: 'The requested item was not found.' },
    P9_STATE_CONFLICT: { retryable: true, message: 'The item state changed. Refresh and try again.' },
    P9_VERSION_CONFLICT: { retryable: true, message: 'The session changed. Refresh and try again.' },
    P9_CANDIDATE_VERSION_CONFLICT: {
        retryable: true,
        message: 'The book changed while you were editing. Refresh to compare before saving.',
    },
    P9_IDEMPOTENCY_MISMATCH: {
        retryable: false,
        message: 'This retry does not match the original request.',
    },
    P9_INTERNAL_ERROR: { retryable: true, message: 'The request could not be completed.' },
};

async function normalizeCommandError(error: unknown): Promise<OwnerUxClientError> {
    let body: unknown = null;
    if (error && typeof error === 'object' && 'context' in error) {
        const context = (error as { context?: unknown }).context;
        if (context && typeof context === 'object' && typeof (context as {
            json?: unknown }).json === 'function') {
            try {
                body = await ((context as { json: () => Promise<unknown> }).json)();
            } catch {
                body = null;
            }
        }
    }
    const parsed = safeErrorEnvelope.safeParse(body);
    const code = parsed.success
        && parsed.data.error in commandErrorRegistry
        ? parsed.data.error
        : 'P9_INTERNAL_ERROR';
    const entry = commandErrorRegistry[code];
    return new OwnerUxClientError(
        code as never,
        entry.retryable,
        entry.message,
    );
}

async function invoke<Action extends keyof typeof invokeActions>(
    action: Action,
    request: Record<string, unknown>,
    signal?: AbortSignal,
) {
    const parsed = parseOwnerBatchReviewRequest({
        contractVersion: OWNER_BATCH_REVIEW_CONTRACT_VERSION,
        ...request,
    });
    try {
        const result = await supabase.functions.invoke('phase9-owner-ingestion', {
            body: parsed,
            ...(signal ? { signal } : {}),
        });
        if (result.error) throw await normalizeCommandError(result.error);
        return decodeOwnerBatchReviewResponse(action as never, result.data) as never;
    } catch (error) {
        if (error instanceof OwnerUxClientError) throw error;
        throw await normalizeCommandError(error);
    }
}

export type StartScanSessionV2Request = Readonly<{
    languageHint: string;
    condition: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable' | null;
    location: string;
    priceMinor: number | null;
    publication: 'private' | 'publish';
    batchLabel: string | null;
    idempotencyKey: string;
    commandId: string;
}>;

export type StartScanSessionV2Result = Readonly<{
    sessionId: string;
    sessionVersion: number;
    defaults: {
        languageHint: string;
        condition: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable' | null;
        location: string;
        priceMinor: number | null;
        quantity: 1;
        publication: 'private' | 'publish';
        script: string | null;
    };
    batchLabel: string | null;
}>;

export type OwnerSessionSummaryV3 = Readonly<{
    sessionId: string;
    status: string;
    sessionVersion: number;
    startedAt: string;
    updatedAt: string;
    closedAt: string | null;
    expiresAt: string;
    defaults: {
        languageHint: string;
        condition: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable' | null;
        location: string;
        priceMinor: number | null;
        quantity: 1;
        publication: 'private' | 'publish';
        script: string | null;
    };
    batchLabel: string | null;
    closeSummary: Record<string, number>;
    allInputsTerminal: boolean;
    closeState: 'not_closeable' | 'closeable' | 'closed' | 'expired';
    presentationRevision: number;
}>;

export type RemoveCandidateFromScanRequest = Readonly<{
    sessionId: string;
    candidateId: string;
    expectedCandidateVersion: number;
    idempotencyKey: string;
    commandId: string;
}>;

export type RemoveCandidateFromScanResult = Readonly<{
    sessionId: string;
    candidateId: string;
    candidateVersion: number;
    sessionVersion: number;
    presentationRevision: number;
    reviewDisposition: 'owner_removed_from_scan';
    removedAt: string;
}>;

export type CloseScanSessionV3Request = Readonly<{
    sessionId: string;
    expectedSessionVersion: number;
    idempotencyKey: string;
    commandId: string;
}>;

const invokeActions = {
    start_scan_session_v2: true,
    read_scan_session_v3: true,
    read_scan_batch_review: true,
    remove_candidate_from_scan: true,
    close_scan_session_v3: true,
} as const;

export const ownerBatchReviewService = {
    startSessionV2(request: StartScanSessionV2Request): Promise<StartScanSessionV2Result> {
        return invoke('start_scan_session_v2', { action: 'start_scan_session_v2', ...request });
    },
    readSessionV3(sessionId: string, signal?: AbortSignal): Promise<OwnerSessionSummaryV3> {
        return invoke('read_scan_session_v3', {
            action: 'read_scan_session_v3',
            sessionId,
        }, signal) as Promise<OwnerSessionSummaryV3>;
    },
    readBatchReview(sessionId: string, signal?: AbortSignal): Promise<OwnerBatchReview> {
        return invoke('read_scan_batch_review', {
            action: 'read_scan_batch_review',
            sessionId,
        }, signal) as Promise<OwnerBatchReview>;
    },
    removeCandidateFromScan(
        request: RemoveCandidateFromScanRequest,
        signal?: AbortSignal,
    ): Promise<RemoveCandidateFromScanResult> {
        return invoke(
            'remove_candidate_from_scan',
            { action: 'remove_candidate_from_scan', ...request },
            signal,
        ) as Promise<RemoveCandidateFromScanResult>;
    },
    closeSessionV3(
        request: CloseScanSessionV3Request,
        signal?: AbortSignal,
    ): Promise<OwnerSessionReadinessV3> {
        return invoke(
            'close_scan_session_v3',
            { action: 'close_scan_session_v3', ...request },
            signal,
        ) as Promise<OwnerSessionReadinessV3>;
    },
};
