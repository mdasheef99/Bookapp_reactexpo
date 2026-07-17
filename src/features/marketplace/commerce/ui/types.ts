import type { OrderRequestState } from '../vocabulary';

export interface CommerceCartItem {
    itemId: string;
    listingId: string;
    quantity: number;
    priceSnapshotMinor: number;
    currentPriceMinor?: number;
    itemSubtotalMinor?: number;
    currencyCode: 'INR';
    listing: { title?: string; authors?: string[]; coverUrl?: string | null; condition?: string };
    version: number;
}

export interface CommerceCart {
    cartId: string;
    storeId: string;
    storeName?: string | null;
    status: 'active' | 'submitted' | 'replaced' | 'abandoned';
    currencyCode: 'INR';
    version: number;
    expiresAt: string;
    updatedAt: string;
    items: CommerceCartItem[];
}

export interface CustomerRequestItem {
    item_id: string;
    title: string;
    authors: string[];
    condition: string;
    image_url?: string | null;
    requested_quantity: number;
    confirmed_quantity: number | null;
    unit_price_bound_minor: number;
    confirmed_unit_price_minor: number | null;
    confirmation_status: string;
    unavailable_reason_code?: string | null;
    pickup_eligible?: boolean;
    delivery_eligible?: boolean;
}

export interface CustomerOrderRequest {
    request_id: string;
    status: OrderRequestState;
    status_reason_code?: string | null;
    store_id: string;
    store_name?: string | null;
    fulfillment_method: 'pickup' | 'delivery';
    final_fulfillment_method?: 'pickup' | 'delivery' | null;
    currency_code: 'INR';
    version: number;
    requested_subtotal_minor: number;
    provisional_delivery_tariff_minor?: number | null;
    final_subtotal_minor: number | null;
    final_delivery_tariff_minor?: number | null;
    final_total_minor: number | null;
    delivery_minimum_minor?: number | null;
    confirmation_due_at: string;
    clarification_expires_at?: string | null;
    acceptance_expires_at: string | null;
    payment_ready_at?: string | null;
    payment_expires_at: string | null;
    closure_pause_expires_at?: string | null;
    updated_at: string;
    items?: CustomerRequestItem[];
}

export interface Clarification {
    clarificationId: string;
    requestId: string;
    reasonCode: string;
    customerPrompt: string;
    customerResponse: string | null;
    status: string;
    version: number;
    expiresAt: string;
    respondedAt: string | null;
}
