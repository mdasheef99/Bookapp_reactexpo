import { supabase } from '@/lib/supabase';
import {
    decodeStoreViewHistoryResponse,
    STORE_VIEW_HISTORY_CONTRACT_VERSION,
    type StoreViewHistory,
} from '../contracts/storeViewHistoryContracts';
import { StoreViewMediaClientError } from './storeViewMediaService';
import { httpStatusOf, isAccessLostHttpStatus } from './storeViewHttpStatus';

export async function storeViewHistoryService(
    inventoryId: string,
    signal?: AbortSignal,
): Promise<StoreViewHistory> {
    try {
        const result = await supabase.functions.invoke('phase9-owner-ingestion', {
            body: {
                action: 'read_store_view_history',
                contractVersion: STORE_VIEW_HISTORY_CONTRACT_VERSION,
                inventoryId,
            },
            ...(signal ? { signal } : {}),
        });
        if (result.error) {
            const accessStatus = httpStatusOf(result.error);
            if (isAccessLostHttpStatus(accessStatus)) {
                throw new StoreViewMediaClientError(
                    'P9_AUTH_REQUIRED', false, 'Activity history is unavailable.', accessStatus,
                );
            }
            const context = (result.error as { context?: { json?: () => Promise<unknown> } }).context;
            const body = await context?.json?.().catch(() => null);
            const code = body && typeof body === 'object' && 'error' in body
                && typeof (body as { error?: unknown }).error === 'string'
                ? (body as { error: string }).error
                : 'P9_INTERNAL_ERROR';
            const known = new Set([
                'P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_REQUEST_INVALID',
                'P9_NOT_FOUND', 'P9_INTERNAL_ERROR',
            ]);
            const retryable = body && typeof body === 'object' && 'retryable' in body
                && typeof (body as { retryable?: unknown }).retryable === 'boolean'
                ? (body as { retryable: boolean }).retryable
                : false;
            throw new StoreViewMediaClientError(
                known.has(code) ? code as never : 'P9_INTERNAL_ERROR',
                retryable,
                'Activity history is unavailable.',
            );
        }
        return decodeStoreViewHistoryResponse(result.data);
    } catch (error) {
        if (error instanceof StoreViewMediaClientError) throw error;
        if (error instanceof Error && error.name === 'StoreViewHistoryResponseContractError') {
            throw new StoreViewMediaClientError('P9_RESPONSE_INVALID', false, 'Activity history is unavailable.');
        }
        throw new StoreViewMediaClientError('P9_INTERNAL_ERROR', true, 'Activity history is unavailable.');
    }
}
