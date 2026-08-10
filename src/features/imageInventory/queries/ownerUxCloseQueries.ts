import { useEffect, useRef } from 'react';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerUxService, type CloseScanSessionRequest } from '../api/ownerUxService';
import type { OwnerSessionReadiness } from '../contracts/ownerUxContracts';
import { captureOwnerRequest } from '../identity/ownerRequestFence';
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
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const activeScope = useRef(scope);
    const controllers = useRef(new Set<AbortController>());
    useEffect(() => {
        activeScope.current = scope;
        return () => {
            activeScope.current = '';
            for (const controller of controllers.current) controller.abort();
            controllers.current.clear();
        };
    }, [scope]);
    return useMutation({
        mutationFn: async (request: CloseScanSessionRequest) => {
            if (activeScope.current !== scope || request.sessionId !== sessionId) {
                throw new Error('OWNER_CLOSE_AUTHORITY_CHANGED');
            }
            const lifecycle = new AbortController();
            controllers.current.add(lifecycle);
            const fence = captureOwnerRequest(identity, lifecycle.signal);
            try {
                fence.assertCurrent();
                if (activeScope.current !== scope) throw new Error('OWNER_CLOSE_AUTHORITY_CHANGED');
                return await ownerUxService.closeSession(request, fence.signal);
            } finally {
                fence.release();
                controllers.current.delete(lifecycle);
            }
        },
        networkMode: 'always',
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
