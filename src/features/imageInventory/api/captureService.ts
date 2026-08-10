import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { SelectedScanMedia } from '../capture/captureState';
import { uploadSignedMedia, type UploadHandle } from '../capture/uploadTransport';

export const INGESTION_CONTRACT_VERSION = 'phase9-v1' as const;

const uuid = z.string().uuid();
const safeError = z.object({
    error: z.string().regex(/^P9_[A-Z0-9_]+$/u),
    retryable: z.boolean(),
    message: z.string().min(1).max(240),
}).strict();
const startResponse = z.object({ sessionId: uuid }).strict();
const authorizationResponse = z.object({
    capabilityId: uuid,
    signedUploadUrl: z.string().url(),
    uploadToken: z.string().min(1).max(4096),
    expiresAt: z.string().datetime({ offset: true }),
}).strict();
const completionResponse = z.object({
    inputId: uuid,
    jobId: uuid,
    state: z.literal('uploaded'),
}).strict();

type IngestionOperation = 'start' | 'authorize' | 'register';
const operationErrors: Record<IngestionOperation, ReadonlySet<string>> = {
    start: new Set([
        'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT',
        'P9_QUOTA_EXCEEDED', 'P9_INTERNAL_ERROR',
    ]),
    authorize: new Set([
        'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_STATE_CONFLICT',
        'P9_MEDIA_NOT_APPROVED', 'P9_MEDIA_TOO_LARGE', 'P9_QUOTA_EXCEEDED',
        'P9_SINGLE_IMAGE_LIMIT',
        'P9_INTERNAL_ERROR',
    ]),
    register: new Set([
        'P9_MEDIA_NOT_APPROVED', 'P9_MEDIA_SIGNATURE_INVALID',
        'P9_MEDIA_MIME_MISMATCH', 'P9_MEDIA_TOO_LARGE', 'P9_MEDIA_DECODE_FAILED',
        'P9_MEDIA_DIMENSIONS_EXCEEDED', 'P9_MEDIA_PIXEL_LIMIT',
        'P9_MEDIA_MULTIFRAME_UNSUPPORTED', 'P9_MEDIA_OBJECT_CHANGED',
        'P9_STATE_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH', 'P9_QUOTA_EXCEEDED',
        'P9_SINGLE_IMAGE_LIMIT',
        'P9_INTERNAL_ERROR',
    ]),
};
const localErrors: Record<string, { retryable: boolean; message: string }> = {
    P9_AUTH_REQUIRED: { retryable: false, message: 'Sign in again before continuing.' },
    P9_OWNER_NOT_AUTHORIZED: { retryable: false, message: 'Owner access is required.' },
    P9_STATE_CONFLICT: { retryable: false, message: 'The session changed. Return to the scan and try again.' },
    P9_QUOTA_EXCEEDED: { retryable: false, message: 'The scan allowance is unavailable. Manual entry remains available.' },
    P9_MEDIA_NOT_APPROVED: { retryable: false, message: 'Select the image again.' },
    P9_MEDIA_TOO_LARGE: { retryable: false, message: 'Choose an image smaller than 10 MB.' },
    P9_MEDIA_SIGNATURE_INVALID: { retryable: false, message: 'This image format could not be verified.' },
    P9_MEDIA_MIME_MISMATCH: { retryable: false, message: 'This image does not match its format.' },
    P9_MEDIA_DECODE_FAILED: { retryable: false, message: 'This image could not be read safely.' },
    P9_MEDIA_DIMENSIONS_EXCEEDED: { retryable: false, message: 'This image is too wide or tall.' },
    P9_MEDIA_PIXEL_LIMIT: { retryable: false, message: 'This image has too many pixels.' },
    P9_MEDIA_MULTIFRAME_UNSUPPORTED: { retryable: false, message: 'Animated images are not supported.' },
    P9_MEDIA_OBJECT_CHANGED: { retryable: true, message: 'The image changed. A new upload authorization is required.' },
    P9_SINGLE_IMAGE_LIMIT: { retryable: false, message: 'Remove the current image before choosing a replacement.' },
    P9_IDEMPOTENCY_MISMATCH: { retryable: false, message: 'This retry no longer matches the original upload.' },
    P9_INTERNAL_ERROR: { retryable: true, message: 'The request could not be completed.' },
};

export class CaptureClientError extends Error {
    constructor(
        readonly code: string,
        readonly retryable: boolean,
        message: string,
    ) {
        super(message);
        this.name = 'CaptureClientError';
    }
}

async function responseError(
    operation: IngestionOperation,
    error: unknown,
): Promise<CaptureClientError> {
    if (error && typeof error === 'object' && 'context' in error) {
        const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
        try {
            const parsed = safeError.safeParse(await context?.json?.());
            if (parsed.success && operationErrors[operation].has(parsed.data.error)) {
                const safe = localErrors[parsed.data.error] ?? localErrors.P9_INTERNAL_ERROR;
                return new CaptureClientError(
                    parsed.data.error,
                    safe.retryable,
                    safe.message,
                );
            }
        } catch {
            // Fall through to a privacy-safe generic error.
        }
    }
    return new CaptureClientError('P9_INTERNAL_ERROR', true, 'The request could not be completed.');
}

async function invoke(
    operation: IngestionOperation,
    body: Record<string, unknown>,
): Promise<unknown> {
    const result = await supabase.functions.invoke('phase9-owner-ingestion', { body });
    if (result.error) throw await responseError(operation, result.error);
    return result.data;
}

export type StartSessionDefaults = Readonly<{
    language: string;
    script: string;
    condition: 'new' | 'like_new' | 'very_good' | 'good' | 'acceptable';
}>;

export const captureService = {
    async startSession(
        defaults: StartSessionDefaults,
        idempotencyKey: string,
        commandId: string,
    ): Promise<string> {
        const result = startResponse.safeParse(await invoke('start', {
            action: 'start_session',
            contractVersion: INGESTION_CONTRACT_VERSION,
            ...defaults,
            idempotencyKey,
            commandId,
        }));
        if (!result.success) throw new CaptureClientError(
            'P9_INTERNAL_ERROR',
            true,
            'The session response could not be validated.',
        );
        return result.data.sessionId;
    },

    async prepareUpload(
        sessionId: string,
        media: SelectedScanMedia,
        ordinal: number,
        idempotencyKey: string,
        commandId: string,
    ): Promise<PreparedUpload> {
        const result = authorizationResponse.safeParse(await invoke('authorize', {
            action: 'authorize_scan_upload',
            contractVersion: INGESTION_CONTRACT_VERSION,
            sessionId,
            sourceKind: media.source,
            declaredMime: media.mimeType,
            declaredBytes: media.fileSize,
            ordinal,
            idempotencyKey,
            commandId,
        }));
        if (!result.success) throw new CaptureClientError(
            'P9_INTERNAL_ERROR',
            true,
            'Upload authorization could not be validated.',
        );
        const {
            capabilityId,
            signedUploadUrl,
            expiresAt,
        } = result.data;
        return {
            expiresAt,
            upload(onProgress) {
                return uploadSignedMedia(signedUploadUrl, media, onProgress);
            },
            async register(registerKey, registerCommandId) {
                const completed = completionResponse.safeParse(await invoke('register', {
                    action: 'complete_scan_upload',
                    contractVersion: INGESTION_CONTRACT_VERSION,
                    capabilityId,
                    sourceKind: media.source,
                    idempotencyKey: registerKey,
                    commandId: registerCommandId,
                }));
                if (!completed.success) throw new CaptureClientError(
                    'P9_INTERNAL_ERROR',
                    true,
                    'Upload registration could not be validated.',
                );
                return { inputId: completed.data.inputId, state: completed.data.state };
            },
        };
    },
};

export type PreparedUpload = Readonly<{
    expiresAt: string;
    upload: (onProgress: (percentage: number) => void) => UploadHandle;
    register: (
        idempotencyKey: string,
        commandId: string,
    ) => Promise<{ inputId: string; state: 'uploaded' }>;
}>;
