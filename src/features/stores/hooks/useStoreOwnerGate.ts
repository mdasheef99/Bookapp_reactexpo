import { useQuery } from '@tanstack/react-query';
import { storeOwnerService } from '../services/storeOwnerService';

export const storeOwnerKeys = {
    gate: (userId?: string | null) => ['stores', 'ownerGate', userId ?? 'anonymous'] as const,
};

export function useStoreOwnerGate(userId?: string | null) {
    return useQuery({
        queryKey: storeOwnerKeys.gate(userId),
        queryFn: () => storeOwnerService.getGateState(userId ?? null),
        enabled: Boolean(userId),
    });
}
