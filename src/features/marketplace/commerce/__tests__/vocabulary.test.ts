import {
    CART_STATES,
    COMMERCE_COMMANDS,
    COMMERCE_ERROR_CODES,
    COMMERCE_EVENT_NAMES,
    COMMERCE_NOTIFICATION_NAMES,
    COMMERCE_POLICY_KEYS,
    COMMERCE_REASON_CODES,
    COMMERCE_TASK_CATEGORIES,
    HOLD_STATUSES,
    HOLD_TYPES,
    ORDER_REQUEST_ITEM_STATES,
    ORDER_REQUEST_STATES,
} from '../vocabulary';
import {
    cartStateSchema,
    commerceCommandSchema,
    commerceErrorCodeSchema,
    commerceEventNameSchema,
    commerceNotificationNameSchema,
    commercePolicyKeySchema,
    commerceReasonCodeSchema,
    commerceTaskCategorySchema,
    holdStatusSchema,
    holdTypeSchema,
    orderRequestItemStateSchema,
    orderRequestStateSchema,
} from '../schemas';

describe('Phase 6 canonical commerce vocabulary', () => {
    it('defines the approved state tokens without invented request states', () => {
        expect(CART_STATES).toEqual(['active', 'submitted', 'replaced', 'abandoned']);
        expect(ORDER_REQUEST_STATES).toContain('payment_ready');
        expect(ORDER_REQUEST_STATES).toContain('store_rejected');
        expect(ORDER_REQUEST_STATES).not.toContain('draft_cart');
        expect(ORDER_REQUEST_ITEM_STATES).toContain('needs_clarification');
        expect(HOLD_TYPES).toEqual(['soft', 'firm']);
        expect(HOLD_STATUSES).toEqual(['active', 'released', 'converted_to_sale']);
    });

    it('defines commands, separate cart/request events, notifications, and tasks', () => {
        expect(COMMERCE_COMMANDS).toContain('submit_order_request');
        expect(COMMERCE_COMMANDS).toContain('request_platform_support');
        expect(COMMERCE_COMMANDS).toContain('cancel_for_rollout_shutdown');
        expect(COMMERCE_EVENT_NAMES).toContain('order_request.submitted');
        expect(COMMERCE_EVENT_NAMES).toContain('marketplace_cart.submitted');
        expect(COMMERCE_NOTIFICATION_NAMES).toContain('commerce.order_request.payment_ready.customer');
        expect(COMMERCE_TASK_CATEGORIES).toContain('hold_reconciliation');
    });

    it('defines stable reason, error, and normative policy catalogues', () => {
        expect(COMMERCE_REASON_CODES).toContain('out_of_stock');
        expect(COMMERCE_REASON_CODES).toContain('support_override');
        expect(COMMERCE_ERROR_CODES).toContain('ENTITLED_OWNER_UNAVAILABLE');
        expect(COMMERCE_ERROR_CODES).toContain('DELIVERY_TARIFF_UNAVAILABLE');
        expect(COMMERCE_POLICY_KEYS).toContain('commerce.delivery_fixed_tariff_minor');
        expect(COMMERCE_POLICY_KEYS).toContain('cart_order_request_enabled');
    });

    it.each([
        [cartStateSchema, 'active'],
        [orderRequestStateSchema, 'payment_ready'],
        [orderRequestItemStateSchema, 'confirmed_partial'],
        [holdTypeSchema, 'firm'],
        [holdStatusSchema, 'released'],
        [commerceCommandSchema, 'confirm_partial'],
        [commerceEventNameSchema, 'marketplace_cart.submitted'],
        [commerceNotificationNameSchema, 'commerce.order_request.partial.customer'],
        [commerceTaskCategorySchema, 'confirmation_expiry'],
        [commerceReasonCodeSchema, 'price_drift'],
        [commerceErrorCodeSchema, 'STALE_VERSION'],
        [commercePolicyKeySchema, 'commerce.payment_ready_window_seconds'],
    ])('accepts canonical runtime value %#', (schema, value) => {
        expect(schema.parse(value)).toBe(value);
        expect(schema.safeParse('__invalid__').success).toBe(false);
    });
});
