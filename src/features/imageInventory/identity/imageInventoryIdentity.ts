import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useStoreOwnerGate } from '@/features/stores/hooks/useStoreOwnerGate';
import type { StoreOwnerGateState } from '@/features/stores/types';
import {
    coordinateImageInventoryIdentity,
    getResolvedImageInventoryIdentity,
    type ImageInventoryIdentity,
} from '../queries/ownerUxQueries';

type ImageInventoryAccess =
    | { status: 'loading'; identity: null }
    | { status: 'unauthorized'; identity: null }
    | {
        status: 'ready';
        identity: ImageInventoryIdentity;
        storeName: string;
    };

export function resolveImageInventoryAccess(
    userId: string | null,
    gate: StoreOwnerGateState | undefined,
    loading: boolean,
): ImageInventoryAccess {
    if (loading) return { status: 'loading', identity: null };
    if (!userId || gate?.state !== 'active_owner') {
        return { status: 'unauthorized', identity: null };
    }
    return {
        status: 'ready',
        identity: { userId, storeId: gate.storeId },
        storeName: gate.storeName,
    };
}

export function useImageInventoryIdentity(): ImageInventoryAccess {
    const { user, isLoading: isAuthLoading } = useAuth();
    const gate = useStoreOwnerGate(user?.id ?? null);
    const access = resolveImageInventoryAccess(
        user?.id ?? null,
        gate.data,
        isAuthLoading || gate.isLoading,
    );
    const accessToken = access.identity
        ? `${access.identity.userId}:${access.identity.storeId}`
        : null;
    const resolved = getResolvedImageInventoryIdentity();
    const initialToken = resolved ? `${resolved.userId}:${resolved.storeId}` : null;
    const [authorizedToken, setAuthorizedToken] = useState<string | null>(initialToken);
    const [transitionFailed, setTransitionFailed] = useState(false);

    useEffect(() => {
        const next = access.identity;
        setTransitionFailed(false);
        if (next) setAuthorizedToken(null);
        void coordinateImageInventoryIdentity(next)
            .then(() => setAuthorizedToken(next ? `${next.userId}:${next.storeId}` : null))
            .catch(() => setTransitionFailed(true));
    }, [accessToken]);

    if (access.status !== 'ready') return access;
    if (transitionFailed) return { status: 'unauthorized', identity: null };
    if (authorizedToken !== accessToken) return { status: 'loading', identity: null };
    return access;
}
