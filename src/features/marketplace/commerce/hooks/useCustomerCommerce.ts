import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerCommerceService } from '../services/customerCommerceService';
import { useCommerceStore } from '../store/commerceStore';

export const commerceKeys = {
    all: ['marketplace', 'commerce'] as const,
    cart: () => ['marketplace', 'commerce', 'customer', 'cart'] as const,
    customerRequests: () => ['marketplace', 'commerce', 'customer', 'requests'] as const,
    customerRequest: (id: string) => ['marketplace', 'commerce', 'customer', 'request', id] as const,
    customerClarification: (id: string) => ['marketplace', 'commerce', 'customer', 'clarification', id] as const,
    ownerRequests: () => ['marketplace', 'commerce', 'owner', 'requests'] as const,
    ownerRequest: (id: string) => ['marketplace', 'commerce', 'owner', 'request', id] as const,
};

function useCustomerInvalidation(requestId?: string) {
    const client = useQueryClient();
    return () => {
        void client.invalidateQueries({ queryKey: commerceKeys.cart() });
        void client.invalidateQueries({ queryKey: commerceKeys.customerRequests() });
        if (requestId) void client.invalidateQueries({ queryKey: commerceKeys.customerRequest(requestId) });
        void client.invalidateQueries({ queryKey: ['notifications'] });
    };
}

export const useCustomerCart = () => useQuery({
    queryKey: commerceKeys.cart(), queryFn: customerCommerceService.getActiveCart, gcTime: 0,
});
export const useCustomerRequests = () => useQuery({
    queryKey: commerceKeys.customerRequests(), queryFn: customerCommerceService.listRequests, gcTime: 0,
});
export const useCustomerRequest = (id: string) => useQuery({
    queryKey: commerceKeys.customerRequest(id), queryFn: () => customerCommerceService.getRequest(id),
    enabled: Boolean(id), gcTime: 0,
});
export const useCustomerClarification = (id: string) => useQuery({
    queryKey: commerceKeys.customerClarification(id),
    queryFn: () => customerCommerceService.getClarification(id), enabled: Boolean(id), gcTime: 0,
});

export function useAddCartItemMutation() {
    const invalidate = useCustomerInvalidation();
    const setReplacement = useCommerceStore((state) => state.setReplacement);
    return useMutation({ mutationFn: ({ listingId }: { listingId: string }) => customerCommerceService.addCartItem(listingId),
        onSuccess: (result) => { if (result.replacement) setReplacement(result.replacement); invalidate(); } });
}
export function useCartQuantityMutation() {
    const invalidate = useCustomerInvalidation();
    return useMutation({ mutationFn: (v: { itemId: string; quantity: number; version: number }) =>
        customerCommerceService.setCartItemQuantity(v.itemId, v.quantity, v.version), onSettled: invalidate });
}
export function useRemoveCartItemMutation() {
    const invalidate = useCustomerInvalidation();
    return useMutation({ mutationFn: (v: { itemId: string; version: number }) =>
        customerCommerceService.removeCartItem(v.itemId, v.version), onSettled: invalidate });
}
export function useSubmitOrderRequestMutation() {
    const invalidate = useCustomerInvalidation();
    return useMutation({ mutationFn: customerCommerceService.submitOrderRequest, onSettled: invalidate });
}
export function useProvideClarificationMutation(requestId: string) {
    const invalidate = useCustomerInvalidation(requestId);
    return useMutation({ mutationFn: (v: { version: number; response: string }) =>
        customerCommerceService.provideClarification(requestId, v.version, v.response), onSettled: invalidate });
}
export function useAcceptConfirmedChangesMutation(requestId: string) {
    const invalidate = useCustomerInvalidation(requestId);
    return useMutation({ mutationFn: (v: { version: number; fulfillment: 'pickup' | 'delivery' | null }) =>
        customerCommerceService.acceptConfirmedChanges(requestId, v.version, v.fulfillment), onSettled: invalidate });
}
export function useCancelOrderRequestMutation() {
    const invalidate = useCustomerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number }) =>
        customerCommerceService.cancelRequest(v.requestId, v.version, 'customer_requested'), onSettled: invalidate });
}
