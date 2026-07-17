import { supabase } from '@/lib/supabase';
import { customerCommerceService } from '../services/customerCommerceService';
import {
    canCustomerCancel,
    customerStatusCopy,
    formatInrMinor,
    getCustomerDecision,
    mapCommerceError,
} from '../ui/presentation';

jest.mock('@/lib/supabase', () => ({
    supabase: { rpc: jest.fn() },
}));

const rpc = supabase.rpc as jest.Mock;

describe('Phase 6 Unit 13 customer UI boundary', () => {
    beforeEach(() => rpc.mockReset());

    it('renders integer-paise server values as INR', () => {
        expect(formatInrMinor(12345)).toBe('₹123.45');
    });

    it('loads the active cart through the named safe RPC', async () => {
        rpc.mockResolvedValue({ data: null, error: null });
        await customerCommerceService.getActiveCart();
        expect(rpc).toHaveBeenCalledWith('marketplace_get_active_cart');
    });

    it('updates quantity through the named command with expected version', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.setCartItemQuantity('item-1', 2, 7);
        expect(rpc).toHaveBeenCalledWith('marketplace_set_cart_item_quantity', expect.objectContaining({
            p_cart_item_id: 'item-1', p_quantity: 2, p_expected_version: 7,
        }));
    });

    it('removes an item through the named command', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.removeCartItem('item-1', 3);
        expect(rpc).toHaveBeenCalledWith('marketplace_remove_cart_item', expect.objectContaining({
            p_cart_item_id: 'item-1', p_expected_version: 3,
        }));
    });

    it('requires an explicit replacement token confirmation', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.confirmCartReplacement('opaque-token', 4);
        expect(rpc).toHaveBeenCalledWith('marketplace_confirm_cart_replacement', expect.objectContaining({
            p_replacement_token: 'opaque-token', p_expected_version: 4,
        }));
    });

    it('does not mutate the existing cart when replacement is cancelled', () => {
        expect(customerCommerceService.cancelCartReplacement()).toBeUndefined();
        expect(rpc).not.toHaveBeenCalled();
    });

    it('submits with the named command and no client total', async () => {
        rpc.mockResolvedValue({ data: { data: { request_id: 'request-1' } }, error: null });
        await customerCommerceService.submitOrderRequest({
            cartId: 'cart-1', expectedVersion: 2, fulfillmentMethod: 'pickup',
            customerNote: null, contactSnapshot: null, deliveryAddressSnapshot: null,
        });
        const payload = rpc.mock.calls[0][1];
        expect(rpc.mock.calls[0][0]).toBe('submit_order_request');
        expect(payload).not.toHaveProperty('p_total_minor');
        expect(payload).not.toHaveProperty('p_tariff_minor');
    });

    it('lists requests using only the customer safe projection', async () => {
        rpc.mockResolvedValue({ data: [], error: null });
        await customerCommerceService.listRequests();
        expect(rpc).toHaveBeenCalledWith('marketplace_list_customer_order_requests');
    });

    it('loads detail using the ownership-enforcing customer RPC', async () => {
        rpc.mockResolvedValue({ data: null, error: null });
        await customerCommerceService.getRequest('request-1');
        expect(rpc).toHaveBeenCalledWith('marketplace_get_customer_order_request', { p_request_id: 'request-1' });
    });

    it('sends clarification only to the named command', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.provideClarification('request-1', 2, 'Private response');
        expect(rpc).toHaveBeenCalledWith('provide_clarification', expect.objectContaining({
            p_customer_response: 'Private response', p_expected_version: 2,
        }));
    });

    it('does not log clarification text', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation();
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.provideClarification('request-1', 2, 'Private response');
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });

    it('recognizes an immutable partial proposal', () => {
        expect(getCustomerDecision({ status: 'awaiting_customer_decision', fulfillment_method: 'delivery',
            final_subtotal_minor: 5000, delivery_minimum_minor: 6000 })).toEqual({
            canAccept: false, requiresPickup: true,
        });
    });

    it('offers pickup when the delivery minimum fails', () => {
        expect(getCustomerDecision({ status: 'awaiting_customer_decision', fulfillment_method: 'delivery',
            final_subtotal_minor: 5000, delivery_minimum_minor: 6000 }).requiresPickup).toBe(true);
    });

    it('accepts through the named server command', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.acceptConfirmedChanges('request-1', 8, 'pickup');
        expect(rpc).toHaveBeenCalledWith('accept_confirmed_changes', expect.objectContaining({
            p_request_id: 'request-1', p_expected_version: 8, p_fulfillment_selection: 'pickup',
        }));
    });

    it('shows customer cancellation only in allowed states', () => {
        expect(canCustomerCancel('submitted')).toBe(true);
        expect(canCustomerCancel('payment_ready')).toBe(true);
        expect(canCustomerCancel('expired')).toBe(false);
    });

    it('cancels through the named command', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await customerCommerceService.cancelRequest('request-1', 4, 'customer_requested');
        expect(rpc).toHaveBeenCalledWith('cancel_order_request', expect.objectContaining({
            p_request_id: 'request-1', p_expected_version: 4,
        }));
    });

    it('uses approved customer status language', () => {
        expect(customerStatusCopy.payment_ready).toBe('Payment ready');
        expect(customerStatusCopy.store_rejected).not.toMatch(/stock/i);
        expect(customerStatusCopy.paused_for_emergency_closure).toMatch(/pause/i);
    });

    it('maps stale versions to a safe refetch message', () => {
        expect(mapCommerceError({ message: 'STALE_VERSION' })).toEqual(expect.objectContaining({
            code: 'STALE_VERSION', shouldRefetch: true,
        }));
    });

    it('maps no-entitled-owner without leaking private details', () => {
        expect(mapCommerceError({ message: 'ENTITLED_OWNER_UNAVAILABLE' }).message)
            .toMatch(/store.*unavailable/i);
    });

    it('contains no provider payment command', () => {
        expect(customerCommerceService).not.toHaveProperty('createPayment');
        expect(customerCommerceService).not.toHaveProperty('setPaymentPending');
    });

    it('uses opaque deep-link identity only', () => {
        expect(customerCommerceService.customerRequestRoute('request-1'))
            .toBe('/(tabs)/marketplace/requests/request-1');
    });

    it('never writes a request table or status directly', () => {
        expect(customerCommerceService).not.toHaveProperty('updateStatus');
        expect(customerCommerceService).not.toHaveProperty('writeHold');
        expect(customerCommerceService).not.toHaveProperty('writeInventory');
    });
});
