import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
    decodeStoreViewMediaResponse,
    STORE_VIEW_MEDIA_CONTRACT_VERSION,
    type StoreViewMedia,
    type StoreViewMediaResult,
} from '../contracts/storeViewMediaContracts';

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
const base = {
    inventoryId: uuid,
    expectedInventoryVersion: z.number().int().positive().safe(),
    idempotencyKey,
    commandId: uuid,
};
const reorderRequest = z.object({ ...base, orderedLinkIds: z.array(uuid).min(1).max(3) }).strict();
const removeRequest = z.object({ ...base, linkId: uuid }).strict();
const replaceRequest = z.object({
    ...base,
    capabilityId: uuid,
    mediaAssetId: uuid,
    targetLinkId: uuid,
}).strict();
const readRequest = z.object({ inventoryId: uuid }).strict();

const safeError = z.object({
    error: z.enum([
        'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
        'P9_NOT_FOUND', 'P9_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
        'P9_MEDIA_NOT_APPROVED', 'P9_MEDIA_CHANGE_UNSAFE', 'P9_MEDIA_LINK_NOT_FOUND',
        'P9_MEDIA_ALREADY_LINKED', 'P9_NO_CHANGES', 'P9_INTERNAL_ERROR',
    ]),
    retryable: z.boolean(),
    message: z.string().min(1).max(240),
}).strict();

export type StoreViewMediaErrorCode = z.infer<typeof safeError>['error'] | 'P9_RESPONSE_INVALID';

export class StoreViewMediaClientError extends Error {
    constructor(
        readonly code: StoreViewMediaErrorCode,
        readonly retryable: boolean,
        message: string,
    ) {
        super(message);
        this.name = 'StoreViewMediaClientError';
    }
}

const messages: Record<StoreViewMediaErrorCode, string> = {
    P9_AUTH_REQUIRED: 'Manage Photos is unavailable.',
    P9_OWNER_NOT_AUTHORIZED: 'Manage Photos is unavailable.',
    P9_REQUEST_INVALID: 'Review the photo selection and try again.',
    P9_NOT_FOUND: 'Manage Photos is unavailable.',
    P9_VERSION_CONFLICT: 'This book changed. Refresh the latest details and try again.',
    P9_IDEMPOTENCY_MISMATCH: 'This command no longer matches the original request.',
    P9_MEDIA_NOT_APPROVED: 'The replacement photo did not pass safety validation.',
    P9_MEDIA_CHANGE_UNSAFE: 'That photo cannot be changed because the live listing needs it.',
    P9_MEDIA_LINK_NOT_FOUND: 'That photo is no longer part of this book.',
    P9_MEDIA_ALREADY_LINKED: 'That photo is already attached to this book.',
    P9_NO_CHANGES: 'The photos are already in that order.',
    P9_INTERNAL_ERROR: 'The command could not be completed.',
    P9_RESPONSE_INVALID: 'The command response could not be validated.',
};

function clientError(code: StoreViewMediaErrorCode, retryable = false) {
    return new StoreViewMediaClientError(code, retryable, messages[code]);
}

async function errorBody(error: unknown): Promise<unknown> {
    if (!error || typeof error !== 'object' || !('context' in error)) return null;
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    try { return await context?.json?.(); } catch { return null; }
}

async function invoke<Action extends 'reorder_store_view_media' | 'remove_store_view_media' | 'replace_store_view_media'>(
    action: Action,
    body: Record<string, unknown>,
): Promise<StoreViewMediaResult<Action>> {
    try {
        const result = await supabase.functions.invoke('phase9-owner-ingestion', {
            body: { action, contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION, ...body },
        });
        if (result.error) {
            const parsed = safeError.safeParse(await errorBody(result.error));
            if (parsed.success) throw new StoreViewMediaClientError(
                parsed.data.error, parsed.data.retryable, messages[parsed.data.error],
            );
            throw clientError('P9_RESPONSE_INVALID');
        }
        return decodeStoreViewMediaResponse(action, result.data) as never;
    } catch (error) {
        if (error instanceof StoreViewMediaClientError) throw error;
        if (error instanceof Error && error.name === 'StoreViewMediaResponseContractError') {
            throw clientError('P9_RESPONSE_INVALID');
        }
        throw clientError('P9_INTERNAL_ERROR', true);
    }
}

export const storeViewMediaService = {
    read(inventoryId: string, signal?: AbortSignal): Promise<StoreViewMedia> {
        const parsed = readRequest.safeParse({ inventoryId });
        if (!parsed.success) return Promise.reject(clientError('P9_REQUEST_INVALID'));
        return (async () => {
            try {
                const result = await supabase.functions.invoke('phase9-owner-ingestion', {
                    body: {
                        action: 'read_store_view_media',
                        contractVersion: STORE_VIEW_MEDIA_CONTRACT_VERSION,
                        inventoryId,
                    },
                    ...(signal ? { signal } : {}),
                });
                if (result.error) {
                    const parsedError = safeError.safeParse(await errorBody(result.error));
                    if (parsedError.success) throw new StoreViewMediaClientError(
                        parsedError.data.error, parsedError.data.retryable, messages[parsedError.data.error],
                    );
                    throw clientError('P9_RESPONSE_INVALID');
                }
                return decodeStoreViewMediaResponse('read_store_view_media', result.data);
            } catch (error) {
                if (error instanceof StoreViewMediaClientError) throw error;
                if (error instanceof Error && error.name === 'StoreViewMediaResponseContractError') {
                    throw clientError('P9_RESPONSE_INVALID');
                }
                throw clientError('P9_INTERNAL_ERROR', true);
            }
        })();
    },

    reorder(input: {
        inventoryId: string;
        expectedInventoryVersion: number;
        orderedLinkIds: string[];
        idempotencyKey: string;
        commandId: string;
    }) {
        const parsed = reorderRequest.safeParse(input);
        if (!parsed.success) return Promise.reject(clientError('P9_REQUEST_INVALID'));
        return invoke('reorder_store_view_media', parsed.data);
    },

    remove(input: {
        inventoryId: string;
        expectedInventoryVersion: number;
        linkId: string;
        idempotencyKey: string;
        commandId: string;
    }) {
        const parsed = removeRequest.safeParse(input);
        if (!parsed.success) return Promise.reject(clientError('P9_REQUEST_INVALID'));
        return invoke('remove_store_view_media', parsed.data);
    },

    replace(input: {
        inventoryId: string;
        expectedInventoryVersion: number;
        capabilityId: string;
        mediaAssetId: string;
        targetLinkId: string;
        idempotencyKey: string;
        commandId: string;
    }) {
        const parsed = replaceRequest.safeParse(input);
        if (!parsed.success) return Promise.reject(clientError('P9_REQUEST_INVALID'));
        return invoke('replace_store_view_media', parsed.data);
    },
};
