import type { OrderRequestState } from '../vocabulary';

export const customerStatusCopy: Record<OrderRequestState, string> = {
    submitted: 'Submitted',
    store_reviewing: 'Store reviewing',
    awaiting_clarification: 'Awaiting your clarification',
    awaiting_customer_decision: 'Your decision needed',
    paused_for_emergency_closure: 'Temporarily paused by the store',
    payment_ready: 'Payment ready',
    unavailable: 'Unavailable',
    store_rejected: 'Store could not accept this request',
    customer_cancelled: 'Cancelled by you',
    platform_cancelled: 'Cancelled by BookConnect',
    expired: 'Request expired',
    payment_ready_expired: 'Payment window expired',
};

const cancellableStates = new Set<OrderRequestState>([
    'submitted', 'store_reviewing', 'awaiting_clarification',
    'awaiting_customer_decision', 'paused_for_emergency_closure', 'payment_ready',
]);

export function canCustomerCancel(status: OrderRequestState) {
    return cancellableStates.has(status);
}

export function formatInrMinor(value: number | null | undefined) {
    const amount = Number.isFinite(value) ? Number(value) : 0;
    return `₹${(amount / 100).toFixed(2)}`;
}

export function getCustomerDecision(input: {
    status: OrderRequestState;
    fulfillment_method: 'pickup' | 'delivery';
    final_subtotal_minor: number | null;
    delivery_minimum_minor?: number | null;
}) {
    const requiresPickup = input.status === 'awaiting_customer_decision'
        && input.fulfillment_method === 'delivery'
        && (input.final_subtotal_minor ?? 0) < (input.delivery_minimum_minor ?? 0);
    return { canAccept: input.status === 'awaiting_customer_decision' && !requiresPickup, requiresPickup };
}

const safeMessages: Record<string, string> = {
    AUTHENTICATION_REQUIRED: 'Please sign in again to continue.',
    COMMERCE_ENTITY_UNAVAILABLE: 'This request is unavailable.',
    STORE_COMMAND_NOT_ENTITLED: 'You do not have permission for this action.',
    ENTITLED_OWNER_UNAVAILABLE: 'This store is temporarily unavailable for new requests.',
    STALE_VERSION: 'This request changed. We refreshed it so you can review the latest details.',
    INVALID_STATE_TRANSITION: 'This action is no longer available.',
    CROSS_STORE_REPLACEMENT_REQUIRED: 'Confirm before replacing items from your current store.',
    INSUFFICIENT_INVENTORY: 'The requested quantity is no longer available.',
    REQUEST_WINDOW_EXPIRED: 'The response window has expired.',
    COMMERCE_ROLLOUT_DISABLED: 'This feature is temporarily unavailable.',
};

export function mapCommerceError(error: unknown) {
    const raw = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message) : String(error ?? '');
    const code = Object.keys(safeMessages).find((candidate) => raw.includes(candidate))
        ?? 'COMMERCE_COMMAND_FAILED';
    return {
        code,
        message: safeMessages[code] ?? 'We could not complete that action. Please try again.',
        shouldRefetch: code === 'STALE_VERSION' || code === 'INVALID_STATE_TRANSITION',
    };
}
