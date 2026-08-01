import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerUxService, type CloseScanSessionRequest } from '../api/ownerUxService';
import type { OwnerSessionReadiness } from '../contracts/ownerUxContracts';
import {
    getResolvedImageInventoryIdentity,
    imageInventoryKeys,
    type ImageInventoryIdentity,
} from './ownerUxQueries';

const sameIdentity = (left: ImageInventoryIdentity | null, right: ImageInventoryIdentity) => (
    left?.userId === right.userId && left.storeId === right.storeId
);

export function useCloseOwnerInventorySession(
    identity: ImageInventoryIdentity,
    sessionId: string,
) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (request: CloseScanSessionRequest) => ownerUxService.closeSession(request),
        retry: false,
        onSuccess: (canonical) => synchronizeCloseSuccess(
            client, identity, sessionId, canonical,
        ),
    });
}

export async function synchronizeCloseSuccess(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    canonical: OwnerSessionReadiness,
): Promise<boolean> {
    if (
        !sameIdentity(getResolvedImageInventoryIdentity(), identity)
        || canonical.sessionId !== sessionId
    ) return false;
    client.setQueryData(imageInventoryKeys.readiness(identity, sessionId), canonical);
    await Promise.all([
        client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.session(identity, sessionId) }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.inputs(identity, sessionId) }),
        client.invalidateQueries({ queryKey: [...imageInventoryKeys.identity(identity), 'candidates'] }),
    ]);
    return true;
}
