import type { OrderRequestState } from '../vocabulary';
import type { OwnerOutcomeInput } from './ownerTypes';

export const ownerStatusCopy: Record<OrderRequestState, string> = {
    submitted: 'New request', store_reviewing: 'In review',
    awaiting_clarification: 'Waiting for customer clarification',
    awaiting_customer_decision: 'Waiting for customer decision',
    paused_for_emergency_closure: 'Emergency pause active', payment_ready: 'Payment ready — firm hold remains active',
    unavailable: 'Unavailable', store_rejected: 'Request rejected', customer_cancelled: 'Customer cancelled',
    platform_cancelled: 'Cancelled by BookConnect', expired: 'Request expired', payment_ready_expired: 'Payment window expired',
};

const sources: Record<string, OrderRequestState[]> = {
    start_store_review: ['submitted'],
    confirm_full: ['store_reviewing'], confirm_partial: ['store_reviewing'],
    mark_items_unavailable: ['store_reviewing'],
    reject_order_request: ['submitted', 'store_reviewing', 'awaiting_clarification'],
    request_clarification: ['submitted', 'store_reviewing'],
    request_platform_support: ['submitted', 'store_reviewing', 'awaiting_clarification',
        'awaiting_customer_decision', 'paused_for_emergency_closure', 'payment_ready'],
};

export function canOwnerAct(command: string, status: OrderRequestState) {
    return sources[command]?.includes(status) ?? false;
}

export function normalizeOwnerOutcomes(items: OwnerOutcomeInput[]) {
    return items.map((item) => {
        if (item.quantity < 0 || (item.requestedQuantity !== undefined && item.quantity > item.requestedQuantity)) {
            throw new Error('Quantity must be within the requested range.');
        }
        if (item.priceMinor > item.boundMinor) throw new Error('Price bound exceeded.');
        return { item_id: item.itemId, quantity: item.quantity, unit_price_minor: item.priceMinor,
            reason_code: item.quantity === 0 ? item.reason : null };
    });
}
