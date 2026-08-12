import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import type { SelectedScanMedia } from '../capture/captureState';
import { uploadSignedMedia, type UploadHandle } from '../capture/uploadTransport';

export const PUBLICATION_CONTRACT_VERSION = 'phase9-publication-v1' as const;
export type PublicationIntent = 'publish' | 'pause' | 'private';
export type PublicMediaRole = 'damage' | 'actual_copy' | 'primary_fallback';

const uuid = z.string().uuid();
export const publicationResultSchema = z.object({
    inventoryId: uuid,
    inventoryVersion: z.number().int().positive(),
    publicationIntentVersion: z.number().int().positive(),
    publicationStatus: z.enum(['private', 'publication_pending', 'published', 'publication_failed']),
    visibilityStatus: z.enum(['draft', 'published', 'paused', 'blocked', 'needs_review', 'out_of_stock']),
    publicationRetryable: z.boolean(),
    publicationFailureReason: z.enum([
        'projection_temporarily_unavailable', 'price', 'stock', 'sellability',
        'condition', 'metadata', 'damage_media', 'store_policy',
    ]).nullable(),
    outcome: z.enum([
        'published', 'pause', 'paused', 'private', 'committed_publication_failed',
        'owner_correction_required',
    ]),
    listingId: uuid.nullable(),
}).strict();

export type PublicationResult = z.infer<typeof publicationResultSchema>;
const envelope = z.object({
    contractVersion: z.literal(PUBLICATION_CONTRACT_VERSION),
    data: publicationResultSchema,
}).strict();
const errorEnvelope = z.object({
    error: z.enum([
        'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
        'P9_STATE_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
        'P9_MEDIA_NOT_APPROVED', 'P9_PUBLICATION_INELIGIBLE', 'P9_INTERNAL_ERROR',
    ]),
    retryable: z.boolean(), message: z.string().min(1).max(240),
}).strict();
const mediaAuthorizationEnvelope = z.object({
    contractVersion: z.literal(PUBLICATION_CONTRACT_VERSION),
    data: z.object({
        capabilityId: uuid, signedUploadUrl: z.string().url(),
        uploadToken: z.string().min(1), expiresAt: z.string().datetime({ offset: true }),
    }).strict(),
}).strict();
const mediaLinkEnvelope = z.object({
    contractVersion: z.literal(PUBLICATION_CONTRACT_VERSION),
    data: z.object({ mediaLinkId: uuid }).strict(),
}).strict();
const mediaCompletionEnvelope = z.object({
    contractVersion: z.literal(PUBLICATION_CONTRACT_VERSION),
    data: z.object({ mediaAssetId: uuid, state: z.enum(['processing', 'approved', 'failed']) }).strict(),
}).strict();

export class PublicationClientError extends Error {
    constructor(
        readonly code: z.infer<typeof errorEnvelope>['error'] | 'P9_RESPONSE_INVALID',
        readonly retryable: boolean,
        message: string,
    ) { super(message); this.name = 'PublicationClientError'; }
}

async function errorJson(error: unknown): Promise<unknown> {
    if (!error || typeof error !== 'object' || !('context' in error)) return null;
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    try { return await context?.json?.(); } catch { return null; }
}

async function invoke(action: string, body: Record<string, unknown>): Promise<PublicationResult> {
    const result = await supabase.functions.invoke('phase9-owner-ingestion', {
        body: { action, contractVersion: PUBLICATION_CONTRACT_VERSION, ...body },
    });
    if (result.error) {
        const parsed = errorEnvelope.safeParse(await errorJson(result.error));
        if (parsed.success) throw new PublicationClientError(
            parsed.data.error, parsed.data.retryable, parsed.data.message,
        );
        throw new PublicationClientError('P9_RESPONSE_INVALID', false, 'Publication response was invalid.');
    }
    const parsed = envelope.safeParse(result.data);
    if (!parsed.success) throw new PublicationClientError(
        'P9_RESPONSE_INVALID', false, 'Publication response was invalid.',
    );
    return parsed.data.data;
}

async function invokeMedia<T>(
    action: string,
    body: Record<string, unknown>,
    schema: z.ZodType<{ contractVersion: typeof PUBLICATION_CONTRACT_VERSION; data: T }>,
): Promise<T> {
    const result = await supabase.functions.invoke('phase9-owner-ingestion', {
        body: { action, contractVersion: PUBLICATION_CONTRACT_VERSION, ...body },
    });
    if (result.error) {
        const parsed = errorEnvelope.safeParse(await errorJson(result.error));
        if (parsed.success) throw new PublicationClientError(
            parsed.data.error, parsed.data.retryable, parsed.data.message,
        );
        throw new PublicationClientError('P9_RESPONSE_INVALID', false, 'Publication response was invalid.');
    }
    const parsed = schema.safeParse(result.data);
    if (!parsed.success) throw new PublicationClientError(
        'P9_RESPONSE_INVALID', false, 'Publication response was invalid.',
    );
    return parsed.data.data;
}

export const publicationService = {
    setState(input: {
        inventoryId: string; expectedInventoryVersion: number;
        expectedPublicationIntentVersion: number; intent: PublicationIntent;
        idempotencyKey: string; commandId: string;
    }) {
        return invoke('set_publication_state', input);
    },
    retry(input: {
        inventoryId: string; expectedPublicationIntentVersion: number;
        idempotencyKey: string; commandId: string;
    }) {
        return invoke('retry_publication', input);
    },
    readStatus(inventoryId: string) {
        return invoke('read_publication_status', { inventoryId });
    },
    async preparePublicCopyUpload(input: {
        inventoryId: string; role: PublicMediaRole; ordinal: number;
        media: SelectedScanMedia; envelopeSha256: string;
        idempotencyKey: string; commandId: string;
    }) {
        const authorization = await invokeMedia('authorize_public_copy', {
            inventoryId: input.inventoryId, role: input.role, ordinal: input.ordinal,
            declaredMime: input.media.mimeType, declaredBytes: input.media.fileSize,
            envelopeSha256: input.envelopeSha256,
            idempotencyKey: input.idempotencyKey, commandId: input.commandId,
        }, mediaAuthorizationEnvelope);
        return {
            capabilityId: authorization.capabilityId,
            expiresAt: authorization.expiresAt,
            upload(onProgress: (percentage: number) => void): UploadHandle {
                return uploadSignedMedia(authorization.signedUploadUrl, input.media, onProgress);
            },
            complete(idempotencyKey: string, commandId: string) {
                return invokeMedia('complete_public_copy_upload', {
                    capabilityId: authorization.capabilityId, idempotencyKey, commandId,
                }, mediaCompletionEnvelope);
            },
        };
    },
    readPublicCopyStatus(mediaAssetId: string) {
        return invokeMedia('read_public_copy_status', { mediaAssetId }, mediaCompletionEnvelope);
    },
    submitPublicCopyMedia(input: {
        inventoryId: string; capabilityId: string; mediaAssetId: string;
        role: PublicMediaRole; publicOrder: number;
        idempotencyKey: string; commandId: string;
    }) {
        return invokeMedia('submit_public_copy_media', input, mediaLinkEnvelope);
    },
};
