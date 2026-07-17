import { supabase } from '@/lib/supabase';
import { createCommandIdentity } from './commandIdentity';
import type { Clarification, CommerceCart, CustomerOrderRequest } from '../ui/types';

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    const result = args ? await supabase.rpc(name, args) : await supabase.rpc(name);
    if (result.error) throw result.error;
    return result.data as T;
}

async function command<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const identity = createCommandIdentity(name);
    const result = await rpc<{ data: T }>(name, {
        ...args, p_idempotency_key: identity.idempotencyKey, p_command_id: identity.commandId,
    });
    return result.data;
}

export const customerCommerceService = {
    getActiveCart: () => rpc<CommerceCart | null>('marketplace_get_active_cart'),
    listRequests: () => rpc<CustomerOrderRequest[]>('marketplace_list_customer_order_requests'),
    getRequest: (requestId: string) => rpc<CustomerOrderRequest | null>(
        'marketplace_get_customer_order_request', { p_request_id: requestId },
    ),
    getClarification: (requestId: string) => rpc<Clarification | null>(
        'marketplace_get_customer_order_request_clarification', { p_request_id: requestId },
    ),
    addCartItem: async (listingId: string, quantity = 1) => {
        let cart = await customerCommerceService.getActiveCart();
        if (!cart) {
            cart = await command<CommerceCart>('marketplace_get_or_create_cart', { p_listing_id: listingId });
        }
        const identity = createCommandIdentity('marketplace_add_cart_item');
        const result = await rpc<{ data?: CommerceCart; errorCode?: string; replacementToken?: string; oldCartVersion?: number }>(
            'marketplace_add_cart_item', {
                p_listing_id: listingId, p_quantity: quantity, p_expected_version: cart.version,
                p_idempotency_key: identity.idempotencyKey, p_command_id: identity.commandId,
            },
        );
        if (result.errorCode === 'CROSS_STORE_REPLACEMENT_REQUIRED') {
            return { replacement: { token: result.replacementToken!, expectedVersion: result.oldCartVersion! } };
        }
        return { cart: result.data! };
    },
    setCartItemQuantity: (itemId: string, quantity: number, version: number) => command<CommerceCart>(
        'marketplace_set_cart_item_quantity', {
            p_cart_item_id: itemId, p_quantity: quantity, p_expected_version: version,
        },
    ),
    removeCartItem: (itemId: string, version: number) => command<CommerceCart>(
        'marketplace_remove_cart_item', { p_cart_item_id: itemId, p_expected_version: version },
    ),
    confirmCartReplacement: (token: string, version: number) => command<CommerceCart>(
        'marketplace_confirm_cart_replacement', {
            p_replacement_token: token, p_expected_version: version,
        },
    ),
    cancelCartReplacement: () => undefined,
    submitOrderRequest: (input: {
        cartId: string; expectedVersion: number; fulfillmentMethod: 'pickup' | 'delivery';
        customerNote: string | null; contactSnapshot: unknown; deliveryAddressSnapshot: unknown;
    }) => command<CustomerOrderRequest>('submit_order_request', {
        p_cart_id: input.cartId, p_expected_version: input.expectedVersion,
        p_fulfillment_method: input.fulfillmentMethod, p_customer_note: input.customerNote,
        p_contact_snapshot: input.contactSnapshot,
        p_delivery_address_snapshot: input.deliveryAddressSnapshot,
    }),
    provideClarification: (requestId: string, version: number, response: string) => command<CustomerOrderRequest>(
        'provide_clarification', {
            p_request_id: requestId, p_expected_version: version, p_customer_response: response,
        },
    ),
    acceptConfirmedChanges: (
        requestId: string, version: number, fulfillment: 'pickup' | 'delivery' | null,
    ) => command<CustomerOrderRequest>('accept_confirmed_changes', {
        p_request_id: requestId, p_expected_version: version,
        p_fulfillment_selection: fulfillment,
    }),
    cancelRequest: (requestId: string, version: number, reason: 'customer_requested' | 'other') => (
        command<CustomerOrderRequest>('cancel_order_request', {
            p_request_id: requestId, p_expected_version: version, p_reason: reason,
        })
    ),
    customerRequestRoute: (requestId: string) => `/(tabs)/marketplace/requests/${requestId}` as const,
};
