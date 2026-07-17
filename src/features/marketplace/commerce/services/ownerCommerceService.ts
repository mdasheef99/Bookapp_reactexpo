import { supabase } from '@/lib/supabase';
import { createCommandIdentity } from './commandIdentity';
import { normalizeOwnerOutcomes } from '../ui/ownerPresentation';
import type { Clarification } from '../ui/types';
import type { OwnerOrderRequest, OwnerOutcomeInput } from '../ui/ownerTypes';

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    const result = args ? await supabase.rpc(name, args) : await supabase.rpc(name);
    if (result.error) throw result.error;
    return result.data as T;
}
async function command<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const identity = createCommandIdentity(name);
    const response = await rpc<{ data: T }>(name, { ...args,
        p_idempotency_key: identity.idempotencyKey, p_command_id: identity.commandId });
    return response.data;
}

export const ownerCommerceService = {
    listRequests: () => rpc<OwnerOrderRequest[]>('marketplace_list_owner_order_requests'),
    getRequest: (requestId: string) => rpc<OwnerOrderRequest | null>('marketplace_get_owner_order_request', { p_request_id: requestId }),
    getClarification: (requestId: string) => rpc<Clarification | null>('marketplace_get_owner_order_request_clarification', { p_request_id: requestId }),
    startReview: (requestId: string, version: number) => command<OwnerOrderRequest>('start_store_review', { p_request_id: requestId, p_expected_version: version }),
    confirmFull: async (requestId: string, version: number, items: OwnerOutcomeInput[]) => {
        const normalized = normalizeOwnerOutcomes(items);
        return command<OwnerOrderRequest>('confirm_full', {
            p_request_id: requestId, p_expected_version: version, p_items: normalized,
        });
    },
    confirmPartial: async (requestId: string, version: number, items: OwnerOutcomeInput[]) => {
        const normalized = normalizeOwnerOutcomes(items);
        if (!normalized.some((item) => item.quantity > 0)) throw new Error('Use unavailable or rejection for an all-zero result.');
        return command<OwnerOrderRequest>('confirm_partial', { p_request_id: requestId, p_expected_version: version, p_items: normalized });
    },
    markUnavailable: (requestId: string, version: number, items: Array<{ itemId: string; reason: string }>) => command<OwnerOrderRequest>('mark_items_unavailable', {
        p_request_id: requestId, p_expected_version: version,
        p_items: items.map((item) => ({ item_id: item.itemId, reason_code: item.reason })),
    }),
    rejectRequest: (requestId: string, version: number, reason: string) => command<OwnerOrderRequest>('reject_order_request', {
        p_request_id: requestId, p_expected_version: version, p_reason: reason,
    }),
    requestClarification: (requestId: string, version: number, reason: string, prompt: string) => command<OwnerOrderRequest>('request_clarification', {
        p_request_id: requestId, p_expected_version: version, p_reason: reason, p_customer_prompt: prompt,
    }),
    requestSupport: (requestId: string, version: number, category: string, description: string) => command<OwnerOrderRequest>('request_platform_support', {
        p_request_id: requestId, p_expected_version: version, p_category: category, p_description: description,
    }),
    ownerRequestRoute: (requestId: string) => `/(store-owner)/orders/${requestId}` as const,
};
