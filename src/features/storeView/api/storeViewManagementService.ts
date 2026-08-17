import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
    decodeStoreViewManagementResponse,
    STORE_VIEW_MANAGEMENT_CONTRACT_VERSION,
    storeViewChangesSchema,
    type StoreViewChanges,
    type StoreViewSaveResult,
    type StoreViewStockResult,
} from '../contracts/storeViewManagementContracts';

const uuid = z.string().uuid();
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
const base = {
    inventoryId: uuid,
    expectedInventoryVersion: z.number().int().positive().safe(),
    idempotencyKey,
    commandId: uuid,
};
const saveRequest = z.object({ ...base, changes: storeViewChangesSchema }).strict();
const stockRequest = z.object({
    ...base,
    delta: z.number().int().min(-10_000).max(10_000).refine((value) => value !== 0),
}).strict();

const safeError = z.object({
    error: z.enum([
        'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
        'P9_NOT_FOUND', 'P9_VERSION_CONFLICT', 'P9_IDEMPOTENCY_MISMATCH',
        'P9_MEDIA_NOT_APPROVED', 'P9_PUBLICATION_INELIGIBLE',
        'P9_NO_CHANGES', 'P9_QUANTITY_INVARIANT_FAILED', 'P9_INTERNAL_ERROR',
    ]),
    retryable: z.boolean(),
    message: z.string().min(1).max(240),
}).strict();

export type StoreViewManagementErrorCode = z.infer<typeof safeError>['error'] | 'P9_RESPONSE_INVALID';

export class StoreViewManagementClientError extends Error {
    constructor(
        readonly code: StoreViewManagementErrorCode,
        readonly retryable: boolean,
        message: string,
    ) {
        super(message);
        this.name = 'StoreViewManagementClientError';
    }
}

const messages: Record<StoreViewManagementErrorCode, string> = {
    P9_AUTH_REQUIRED: 'Store View management is unavailable.',
    P9_OWNER_NOT_AUTHORIZED: 'Store View management is unavailable.',
    P9_REQUEST_INVALID: 'Review the entered changes and try again.',
    P9_NOT_FOUND: 'Store View management is unavailable.',
    P9_VERSION_CONFLICT: 'This book changed. Refresh the latest details and try again.',
    P9_IDEMPOTENCY_MISMATCH: 'This command no longer matches the original request.',
    P9_MEDIA_NOT_APPROVED: 'Changes were not saved because approved damage photos are required.',
    P9_PUBLICATION_INELIGIBLE: 'Changes were not saved because the live listing would become ineligible.',
    P9_NO_CHANGES: 'There are no changes to save.',
    P9_QUANTITY_INVARIANT_FAILED: 'That stock adjustment is not allowed.',
    P9_INTERNAL_ERROR: 'The command could not be completed.',
    P9_RESPONSE_INVALID: 'The command response could not be validated.',
};

function clientError(code: StoreViewManagementErrorCode, retryable = false) {
    return new StoreViewManagementClientError(code, retryable, messages[code]);
}

async function errorBody(error: unknown): Promise<unknown> {
    if (!error || typeof error !== 'object' || !('context' in error)) return null;
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    try { return await context?.json?.(); } catch { return null; }
}

async function invoke<Action extends 'update_store_inventory_details' | 'adjust_inventory_stock'>(
    action: Action,
    body: Record<string, unknown>,
): Promise<Action extends 'update_store_inventory_details' ? StoreViewSaveResult : StoreViewStockResult> {
    try {
        const result = await supabase.functions.invoke('phase9-owner-ingestion', {
            body: { action, contractVersion: STORE_VIEW_MANAGEMENT_CONTRACT_VERSION, ...body },
        });
        if (result.error) {
            const parsed = safeError.safeParse(await errorBody(result.error));
            if (parsed.success) throw new StoreViewManagementClientError(
                parsed.data.error, parsed.data.retryable, messages[parsed.data.error],
            );
            throw clientError('P9_RESPONSE_INVALID');
        }
        return decodeStoreViewManagementResponse(action, result.data) as never;
    } catch (error) {
        if (error instanceof StoreViewManagementClientError) throw error;
        if (error instanceof Error && error.name === 'StoreViewManagementResponseContractError') {
            throw clientError('P9_RESPONSE_INVALID');
        }
        throw clientError('P9_INTERNAL_ERROR', true);
    }
}

export const storeViewManagementService = {
    save(input: {
        inventoryId: string;
        expectedInventoryVersion: number;
        changes: StoreViewChanges;
        idempotencyKey: string;
        commandId: string;
    }): Promise<StoreViewSaveResult> {
        const parsed = saveRequest.safeParse(input);
        if (!parsed.success) return Promise.reject(clientError('P9_REQUEST_INVALID'));
        return invoke('update_store_inventory_details', parsed.data);
    },

    adjustStock(input: {
        inventoryId: string;
        expectedInventoryVersion: number;
        delta: number;
        idempotencyKey: string;
        commandId: string;
    }): Promise<StoreViewStockResult> {
        const parsed = stockRequest.safeParse(input);
        if (!parsed.success) return Promise.reject(clientError('P9_REQUEST_INVALID'));
        return invoke('adjust_inventory_stock', parsed.data);
    },
};
