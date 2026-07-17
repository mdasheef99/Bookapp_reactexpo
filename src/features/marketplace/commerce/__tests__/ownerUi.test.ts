import { supabase } from '@/lib/supabase';
import { ownerCommerceService } from '../services/ownerCommerceService';
import { canOwnerAct, normalizeOwnerOutcomes, ownerStatusCopy } from '../ui/ownerPresentation';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));
const rpc = supabase.rpc as jest.Mock;

describe('Phase 6 Unit 14 Store Owner UI boundary', () => {
    beforeEach(() => rpc.mockReset());

    it('lists only through the capability-scoped Owner projection', async () => {
        rpc.mockResolvedValue({ data: [], error: null });
        await ownerCommerceService.listRequests();
        expect(rpc).toHaveBeenCalledWith('marketplace_list_owner_order_requests');
    });
    it('loads detail through the capability-scoped Owner projection', async () => {
        rpc.mockResolvedValue({ data: null, error: null });
        await ownerCommerceService.getRequest('request-1');
        expect(rpc).toHaveBeenCalledWith('marketplace_get_owner_order_request', { p_request_id: 'request-1' });
    });
    it('begins review with expected version', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await ownerCommerceService.startReview('request-1', 2);
        expect(rpc).toHaveBeenCalledWith('start_store_review', expect.objectContaining({ p_expected_version: 2 }));
    });
    it('uses idempotency identity for duplicate begin review', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await ownerCommerceService.startReview('request-1', 2);
        expect(rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ p_idempotency_key: expect.any(String), p_command_id: expect.any(String) }));
    });
    it('rejects a full-confirm price above the server bound before RPC', async () => {
        await expect(ownerCommerceService.confirmFull('request-1', 2, [{ itemId: 'item-1', quantity: 1, priceMinor: 501, boundMinor: 500 }])).rejects.toThrow(/price bound/i);
        expect(rpc).not.toHaveBeenCalled();
    });
    it('does not accept substitute listing identity', () => {
        expect(normalizeOwnerOutcomes([{ itemId: 'item-1', quantity: 1, priceMinor: 500, boundMinor: 500, listingId: 'other' }])).not.toHaveProperty('listingId');
    });
    it('bounds partial quantity to requested quantity', () => {
        expect(() => normalizeOwnerOutcomes([{ itemId: 'item-1', quantity: 3, requestedQuantity: 2, priceMinor: 500, boundMinor: 500 }])).toThrow(/quantity/i);
    });
    it('rejects an all-zero partial result', async () => {
        await expect(ownerCommerceService.confirmPartial('request-1', 2, [{ itemId: 'item-1', quantity: 0, requestedQuantity: 2, priceMinor: 500, boundMinor: 500 }])).rejects.toThrow(/unavailable/i);
    });
    it('uses a separate unavailable command', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await ownerCommerceService.markUnavailable('request-1', 2, [{ itemId: 'item-1', reason: 'out_of_stock' }]);
        expect(rpc).toHaveBeenCalledWith('mark_items_unavailable', expect.any(Object));
    });
    it('uses a separate rejection command and catalogue', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await ownerCommerceService.rejectRequest('request-1', 2, 'store_capacity');
        expect(rpc).toHaveBeenCalledWith('reject_order_request', expect.objectContaining({ p_reason: 'store_capacity' }));
    });
    it('requests clarification with customer-safe prompt', async () => {
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await ownerCommerceService.requestClarification('request-1', 2, 'condition', 'Please confirm the condition preference.');
        expect(rpc).toHaveBeenCalledWith('request_clarification', expect.objectContaining({ p_customer_prompt: expect.any(String) }));
    });
    it('does not log clarification prompt text', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation();
        rpc.mockResolvedValue({ data: { data: {} }, error: null });
        await ownerCommerceService.requestClarification('request-1', 2, 'condition', 'Private prompt');
        expect(log).not.toHaveBeenCalled(); log.mockRestore();
    });
    it('requests support without a status update method', async () => {
        rpc.mockResolvedValue({ data: { data: {}, supportVersion: 1 }, error: null });
        await ownerCommerceService.requestSupport('request-1', 2, 'technical_error', 'Private details');
        expect(rpc).toHaveBeenCalledWith('request_platform_support', expect.any(Object));
        expect(ownerCommerceService).not.toHaveProperty('updateStatus');
    });
    it('renders emergency pause distinctly', () => {
        expect(ownerStatusCopy.paused_for_emergency_closure).toMatch(/emergency pause/i);
    });
    it('does not imply payment-ready holds release during closure', () => {
        expect(ownerStatusCopy.payment_ready).not.toMatch(/released/i);
    });
    it('permits Owner actions only in exact source states', () => {
        expect(canOwnerAct('start_store_review', 'submitted')).toBe(true);
        expect(canOwnerAct('confirm_full', 'store_reviewing')).toBe(true);
        expect(canOwnerAct('confirm_full', 'payment_ready')).toBe(false);
    });
    it('uses an opaque Owner route', () => {
        expect(ownerCommerceService.ownerRequestRoute('request-1')).toBe('/(store-owner)/orders/request-1');
    });
    it('contains no direct table, hold, inventory, or event writes', () => {
        expect(ownerCommerceService).not.toHaveProperty('writeInventory');
        expect(ownerCommerceService).not.toHaveProperty('writeHold');
        expect(ownerCommerceService).not.toHaveProperty('writeEvent');
    });
    it('loads bounded clarification through the Owner safe RPC', async () => {
        rpc.mockResolvedValue({ data: null, error: null });
        await ownerCommerceService.getClarification('request-1');
        expect(rpc).toHaveBeenCalledWith('marketplace_get_owner_order_request_clarification', { p_request_id: 'request-1' });
    });
    it('never defines manager or staff command overrides', () => {
        expect(ownerCommerceService).not.toHaveProperty('actAsManager');
        expect(ownerCommerceService).not.toHaveProperty('actAsStaff');
    });
});
