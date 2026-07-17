export const CART_STATES = ['active', 'submitted', 'replaced', 'abandoned'] as const;

export const ORDER_REQUEST_STATES = [
    'submitted',
    'store_reviewing',
    'awaiting_clarification',
    'awaiting_customer_decision',
    'paused_for_emergency_closure',
    'payment_ready',
    'unavailable',
    'store_rejected',
    'customer_cancelled',
    'platform_cancelled',
    'expired',
    'payment_ready_expired',
] as const;

export const ORDER_REQUEST_ITEM_STATES = [
    'requested',
    'needs_clarification',
    'confirmed_full',
    'confirmed_partial',
    'unavailable',
    'rejected',
] as const;

export const HOLD_TYPES = ['soft', 'firm'] as const;
export const HOLD_STATUSES = ['active', 'released', 'converted_to_sale'] as const;

export const CUSTOMER_COMMANDS = [
    'create_cart',
    'replace_cart_store',
    'set_cart_item_quantity',
    'remove_cart_item',
    'submit_order_request',
    'provide_clarification',
    'accept_confirmed_changes',
    'cancel_order_request',
] as const;

export const STORE_OWNER_COMMANDS = [
    'start_store_review',
    'request_clarification',
    'confirm_full',
    'confirm_partial',
    'mark_items_unavailable',
    'reject_order_request',
    'request_platform_support',
] as const;

export const SYSTEM_COMMANDS = [
    'send_confirmation_reminder',
    'expire_confirmation',
    'expire_clarification',
    'expire_customer_decision',
    'expire_payment_ready',
    'pause_for_emergency_closure',
    'resume_after_emergency_closure',
    'expire_emergency_closure_pause',
    'cancel_for_store_ineligibility',
    'cancel_for_rollout_shutdown',
] as const;

export const SUPPORT_COMMANDS = [
    'support_cancel_request',
    'support_extend_confirmation_deadline',
    'support_extend_customer_decision_deadline',
    'support_resume_emergency_pause',
] as const;

export const COMMERCE_COMMANDS = [
    ...CUSTOMER_COMMANDS,
    ...STORE_OWNER_COMMANDS,
    ...SYSTEM_COMMANDS,
    ...SUPPORT_COMMANDS,
] as const;

export const COMMERCE_EVENT_NAMES = [
    'marketplace_cart.submitted',
    'marketplace_cart.replaced',
    'marketplace_cart.abandoned',
    'order_request.submitted',
    'order_request.review_started',
    'order_request.clarification_requested',
    'order_request.clarification_provided',
    'order_request.confirmed',
    'order_request.partially_confirmed',
    'order_request.unavailable',
    'order_request.rejected',
    'order_request.changes_accepted',
    'order_request.cancelled',
    'order_request.expired',
    'order_request.payment_ready_expired',
    'order_request.emergency_closure_paused',
    'order_request.emergency_closure_resumed',
    'order_request.store_ineligible',
    'order_request.support_requested',
    'order_request.support_intervened',
    'order_request.confirmation_due_soon',
] as const;

export const COMMERCE_NOTIFICATION_NAMES = [
    'commerce.marketplace_cart.replaced.customer',
    'commerce.order_request.submitted.customer',
    'commerce.order_request.submitted.store',
    'commerce.order_request.confirmation_due.store',
    'commerce.order_request.review_started.customer',
    'commerce.order_request.clarification_required.customer',
    'commerce.order_request.clarification_received.store',
    'commerce.order_request.payment_ready.customer',
    'commerce.order_request.confirmed.store',
    'commerce.order_request.partial.customer',
    'commerce.order_request.partial.store',
    'commerce.order_request.unavailable.customer',
    'commerce.order_request.unavailable.store',
    'commerce.order_request.rejected.customer',
    'commerce.order_request.rejected.store',
    'commerce.order_request.changes_accepted.store',
    'commerce.order_request.cancelled.customer',
    'commerce.order_request.cancelled.store',
    'commerce.order_request.expired.customer',
    'commerce.order_request.expired.store',
    'commerce.order_request.payment_ready_expired.customer',
    'commerce.order_request.payment_ready_expired.store',
    'commerce.order_request.closure_paused.customer',
    'commerce.order_request.closure_paused.store',
    'commerce.order_request.closure_paused.ops',
    'commerce.order_request.closure_resumed.customer',
    'commerce.order_request.closure_resumed.store',
    'commerce.order_request.store_ineligible.customer',
    'commerce.order_request.store_ineligible.store',
    'commerce.order_request.store_ineligible.ops',
    'commerce.order_request.support_requested.store',
    'commerce.order_request.support_requested.ops',
    'commerce.order_request.support_intervened.customer',
    'commerce.order_request.support_intervened.store',
    'commerce.order_request.support_intervened.ops',
] as const;

export const COMMERCE_TASK_CATEGORIES = [
    'confirmation_reminder',
    'confirmation_expiry',
    'clarification_expiry',
    'customer_decision_expiry',
    'payment_ready_expiry',
    'emergency_pause_expiry',
    'store_ineligibility_review',
    'notification_delivery',
    'hold_reconciliation',
    'commerce_consistency_reconciliation',
    'platform_support_request',
] as const;

export const COMMERCE_REASON_CODES = [
    'out_of_stock', 'sold_offline', 'damaged', 'misplaced', 'wrong_edition',
    'wrong_condition', 'listing_error', 'store_ineligible',
    'cannot_fulfil_request', 'store_capacity', 'fulfilment_method_unsupported',
    'customer_request_not_serviceable', 'policy_or_compliance_constraint',
    'suspected_abuse', 'edition', 'condition', 'quantity', 'fulfilment',
    'delivery_minimum', 'customer_note', 'price_drift', 'inventory_exception',
    'price_correction_review', 'customer_contact_issue', 'fulfilment_exception',
    'closure_exception', 'policy_exception', 'technical_error', 'other',
    'customer_requested', 'confirmation_sla_elapsed', 'clarification_window_elapsed',
    'customer_decision_window_elapsed', 'payment_ready_window_elapsed',
    'store_rejected', 'request_unavailable', 'emergency_closure_cap_elapsed',
    'feature_disabled', 'support_override',
] as const;

export const COMMERCE_ERROR_CODES = [
    'INVALID_COMMAND', 'INVALID_QUANTITY', 'INVALID_FULFILMENT',
    'AUTHENTICATION_REQUIRED', 'COMMERCE_ENTITY_UNAVAILABLE',
    'STORE_COMMAND_NOT_ENTITLED', 'ENTITLED_OWNER_UNAVAILABLE', 'STALE_VERSION',
    'INVALID_STATE_TRANSITION', 'IDEMPOTENCY_KEY_REUSED', 'COMMAND_IN_PROGRESS',
    'CROSS_STORE_REPLACEMENT_REQUIRED', 'INSUFFICIENT_INVENTORY',
    'PRICE_BOUND_EXCEEDED', 'HOLD_EXPIRED', 'REQUEST_WINDOW_EXPIRED',
    'POLICY_CONFIGURATION_INVALID', 'STORE_SCHEDULE_INVALID',
    'DELIVERY_TARIFF_UNAVAILABLE', 'COMMERCE_ROLLOUT_DISABLED',
    'COMMERCE_COMMAND_FAILED',
] as const;

export const COMMERCE_POLICY_KEYS = [
    'commerce.cart_abandonment_seconds',
    'commerce.confirmation_reminder_open_seconds',
    'commerce.confirmation_expiry_business_days',
    'commerce.clarification_timeout_seconds',
    'commerce.acceptance_window_seconds',
    'commerce.payment_ready_window_seconds',
    'commerce.price_drift_tolerance_minor',
    'commerce.emergency_closure_pause_seconds',
    'commerce.max_emergency_closure_pauses',
    'commerce.command_idempotency_retention_seconds',
    'commerce.delivery_minimum_subtotal_minor',
    'commerce.delivery_fixed_tariff_minor',
    'commerce.delivery_free_threshold_minor',
    'marketplace_enabled',
    'cart_order_request_enabled',
    'pickup_enabled',
    'delivery_enabled',
    'commerce.store_allowlisted',
] as const;

export type CartState = typeof CART_STATES[number];
export type OrderRequestState = typeof ORDER_REQUEST_STATES[number];
export type OrderRequestItemState = typeof ORDER_REQUEST_ITEM_STATES[number];
export type HoldType = typeof HOLD_TYPES[number];
export type HoldStatus = typeof HOLD_STATUSES[number];
export type CommerceCommand = typeof COMMERCE_COMMANDS[number];
export type CommerceEventName = typeof COMMERCE_EVENT_NAMES[number];
export type CommerceNotificationName = typeof COMMERCE_NOTIFICATION_NAMES[number];
export type CommerceTaskCategory = typeof COMMERCE_TASK_CATEGORIES[number];
export type CommerceReasonCode = typeof COMMERCE_REASON_CODES[number];
export type CommerceErrorCode = typeof COMMERCE_ERROR_CODES[number];
export type CommercePolicyKey = typeof COMMERCE_POLICY_KEYS[number];
