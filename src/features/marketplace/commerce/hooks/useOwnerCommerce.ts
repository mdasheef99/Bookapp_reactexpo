import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownerCommerceService } from '../services/ownerCommerceService';
import { commerceKeys } from './useCustomerCommerce';
import type { OwnerOutcomeInput } from '../ui/ownerTypes';

function useOwnerInvalidation(requestId?: string) {
    const client = useQueryClient();
    return () => {
        void client.invalidateQueries({ queryKey: commerceKeys.ownerRequests() });
        if (requestId) void client.invalidateQueries({ queryKey: commerceKeys.ownerRequest(requestId) });
        void client.invalidateQueries({ queryKey: ['notifications'] });
    };
}

export const useOwnerRequests = () => useQuery({
    queryKey: commerceKeys.ownerRequests(), queryFn: ownerCommerceService.listRequests, gcTime: 0,
});
export const useOwnerRequest = (id: string) => useQuery({
    queryKey: commerceKeys.ownerRequest(id), queryFn: () => ownerCommerceService.getRequest(id),
    enabled: Boolean(id), gcTime: 0,
});
export const useOwnerClarification = (id: string) => useQuery({
    queryKey: [...commerceKeys.ownerRequest(id), 'clarification'],
    queryFn: () => ownerCommerceService.getClarification(id), enabled: Boolean(id), gcTime: 0,
});

export function useStartStoreReviewMutation(requestId: string) {
    const invalidate = useOwnerInvalidation(requestId);
    return useMutation({ mutationFn: (v: { version: number }) => ownerCommerceService.startReview(requestId, v.version), onSettled: invalidate });
}
export function useConfirmFullMutation() {
    const invalidate = useOwnerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number; items: OwnerOutcomeInput[] }) => ownerCommerceService.confirmFull(v.requestId, v.version, v.items), onSettled: invalidate });
}
export function useConfirmPartialMutation() {
    const invalidate = useOwnerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number; items: OwnerOutcomeInput[] }) => ownerCommerceService.confirmPartial(v.requestId, v.version, v.items), onSettled: invalidate });
}
export function useMarkUnavailableMutation() {
    const invalidate = useOwnerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number; items: Array<{ itemId: string; reason: string }> }) => ownerCommerceService.markUnavailable(v.requestId, v.version, v.items), onSettled: invalidate });
}
export function useRejectRequestMutation() {
    const invalidate = useOwnerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number; reason: string }) => ownerCommerceService.rejectRequest(v.requestId, v.version, v.reason), onSettled: invalidate });
}
export function useRequestClarificationMutation() {
    const invalidate = useOwnerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number; reason: string; prompt: string }) => ownerCommerceService.requestClarification(v.requestId, v.version, v.reason, v.prompt), onSettled: invalidate });
}
export function useRequestSupportMutation() {
    const invalidate = useOwnerInvalidation();
    return useMutation({ mutationFn: (v: { requestId: string; version: number; category: string; description: string }) => ownerCommerceService.requestSupport(v.requestId, v.version, v.category, v.description), onSettled: invalidate });
}
