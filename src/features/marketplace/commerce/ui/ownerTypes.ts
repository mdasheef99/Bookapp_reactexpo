import type { OrderRequestState } from '../vocabulary';

export interface OwnerRequestItem {
    item_id: string;
    title: string;
    authors: string[];
    condition: string;
    condition_notes?: string | null;
    requested_quantity: number;
    confirmed_quantity: number | null;
    unit_price_bound_minor: number;
    confirmed_unit_price_minor: number | null;
    confirmation_status: string;
    quantity_available: number;
    pickup_eligible: boolean;
    delivery_eligible: boolean;
}

export interface OwnerOrderRequest {
    request_id: string;
    status: OrderRequestState;
    status_reason_code?: string | null;
    store_id: string;
    customer_label: string;
    fulfillment_method: 'pickup' | 'delivery';
    final_fulfillment_method?: 'pickup' | 'delivery' | null;
    currency_code?: 'INR';
    item_count?: number;
    version: number;
    requested_subtotal_minor?: number;
    final_subtotal_minor?: number | null;
    final_delivery_tariff_minor?: number | null;
    final_total_minor?: number | null;
    confirmation_due_at: string;
    acceptance_expires_at?: string | null;
    payment_expires_at?: string | null;
    closure_pause_expires_at?: string | null;
    updated_at: string;
    items?: OwnerRequestItem[];
}

export interface OwnerOutcomeInput {
    itemId: string;
    quantity: number;
    priceMinor: number;
    boundMinor: number;
    requestedQuantity?: number;
    reason?: string;
    listingId?: string;
}
