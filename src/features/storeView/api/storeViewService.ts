import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import {
    decodeStoreViewResponse,
    STORE_VIEW_CONTRACT_VERSION,
    STORE_VIEW_FILTERS,
    type StoreViewDetail,
    type StoreViewFilter,
    type StoreViewPage,
} from '../contracts/storeViewContracts';
import { httpStatusOf, isAccessLostHttpStatus } from './storeViewHttpStatus';

const uuid = z.string().uuid();
const pageRequest = z.object({
    filter: z.enum(STORE_VIEW_FILTERS).default('all'),
    pageSize: z.number().int().min(1).max(50).safe().default(20),
    cursor: z.string().min(1).max(512).nullable().default(null),
}).strict();

const safeError = z.object({
    error: z.enum([
        'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
        'P9_CURSOR_INVALID', 'P9_NOT_FOUND', 'P9_INTERNAL_ERROR',
    ]),
    retryable: z.boolean(),
    message: z.string(),
}).strict();

export type StoreViewPageRequest = Readonly<{
    filter?: StoreViewFilter;
    pageSize?: number;
    cursor?: string | null;
}>;

export type StoreViewErrorCode = z.infer<typeof safeError>['error'] | 'P9_RESPONSE_INVALID';

export class StoreViewClientError extends Error {
    readonly httpStatus: number | null;
    constructor(
        readonly code: StoreViewErrorCode,
        readonly retryable: boolean,
        message: string,
        httpStatus: number | null = null,
    ) {
        super(message);
        this.name = 'StoreViewClientError';
        this.httpStatus = httpStatus;
    }
}

const messages: Record<StoreViewErrorCode, string> = {
    P9_AUTH_REQUIRED: 'Store View is unavailable.',
    P9_OWNER_NOT_AUTHORIZED: 'Store View is unavailable.',
    P9_REQUEST_INVALID: 'The Store View request is invalid.',
    P9_CURSOR_INVALID: 'This Store View page has expired.',
    P9_NOT_FOUND: 'Store View is unavailable.',
    P9_INTERNAL_ERROR: 'Store View could not be loaded.',
    P9_RESPONSE_INVALID: 'Store View could not be loaded.',
};

function clientError(code: StoreViewErrorCode, retryable = false): StoreViewClientError {
    return new StoreViewClientError(code, retryable, messages[code]);
}

async function errorBody(error: unknown): Promise<unknown> {
    if (!error || typeof error !== 'object' || !('context' in error)) return null;
    const context = (error as { context?: unknown }).context;
    if (!context || typeof context !== 'object' || !('json' in context)) return null;
    const json = (context as { json?: unknown }).json;
    if (typeof json !== 'function') return null;
    try {
        // R7: call json() as a method so the Response receiver is kept;
        // detaching it throws "Illegal invocation" on a native Response.
        return await (context as { json: () => Promise<unknown> }).json();
    } catch {
        return null;
    }
}

async function normalizeError(error: unknown): Promise<StoreViewClientError> {
    // Read the HTTP status first: a 401/403 without the app error body still
    // means access was lost, never a retryable internal error.
    const status = httpStatusOf(error);
    if (isAccessLostHttpStatus(status)) {
        return new StoreViewClientError('P9_AUTH_REQUIRED', false, messages.P9_AUTH_REQUIRED, status);
    }
    const result = safeError.safeParse(await errorBody(error));
    if (!result.success) return clientError('P9_INTERNAL_ERROR', true);
    const code = result.data.error;
    return clientError(
        code,
        code === 'P9_INTERNAL_ERROR',
    );
}

async function invoke(
    action: 'read_store_view_page' | 'read_store_view_detail',
    body: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<unknown> {
    try {
        const result = await supabase.functions.invoke('phase9-owner-ingestion', {
            body: { action, contractVersion: STORE_VIEW_CONTRACT_VERSION, ...body },
            ...(signal ? { signal } : {}),
        });
        if (result.error) throw await normalizeError(result.error);
        return decodeStoreViewResponse(action, result.data);
    } catch (error) {
        if (error instanceof StoreViewClientError) throw error;
        if (error instanceof Error && error.name === 'AbortError') throw error;
        if (error instanceof Error && error.name === 'StoreViewResponseContractError') {
            throw clientError('P9_RESPONSE_INVALID');
        }
        throw clientError('P9_INTERNAL_ERROR', true);
    }
}

export const storeViewService = {
    async page(request: StoreViewPageRequest = {}, signal?: AbortSignal): Promise<StoreViewPage> {
        const parsed = pageRequest.safeParse(request);
        if (!parsed.success) throw clientError('P9_REQUEST_INVALID');
        return invoke('read_store_view_page', parsed.data, signal) as Promise<StoreViewPage>;
    },

    async detail(inventoryId: string, signal?: AbortSignal): Promise<StoreViewDetail> {
        const parsed = uuid.safeParse(inventoryId);
        if (!parsed.success) throw clientError('P9_REQUEST_INVALID');
        return invoke('read_store_view_detail', { inventoryId: parsed.data }, signal) as Promise<StoreViewDetail>;
    },
};
