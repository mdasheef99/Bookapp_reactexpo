import { useEffect, useRef } from 'react';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ownerBatchReviewService,
    type CloseScanSessionV3Request,
    type OwnerSessionSummaryV3,
    type RemoveCandidateFromScanRequest,
    type RemoveCandidateFromScanResult,
    type StartScanSessionV2Request,
} from '../api/ownerBatchReviewService';
import type {
    OwnerBatchReview,
    OwnerSessionReadinessV3,
} from '../contracts/ownerBatchReviewContracts';
import { ownerUxService, type UpdateCandidateReviewRequest } from '../api/ownerUxService';
import { captureOwnerRequest } from '../identity/ownerRequestFence';
import {
    getResolvedImageInventoryIdentity,
    imageInventoryKeys,
    type ImageInventoryIdentity,
} from './ownerUxQueries';

const sameIdentity = (left: ImageInventoryIdentity | null, right: ImageInventoryIdentity) => (
    left?.userId === right.userId && left.storeId === right.storeId
);

export { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
export { useOwnerSessionV3, useOwnerBatchReview } from './ownerBatchReviewReads';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { recordConfirmedCandidateOutcome } from './ownerCandidateAuthority';
import { synchronizeCandidateReviewSuccess } from './ownerUxReviewQueries';

export function useStartScanSessionV2(identity: ImageInventoryIdentity) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (request: StartScanSessionV2Request) => {
            const fence = captureOwnerRequest(identity);
            try {
                fence.assertCurrent();
                const canonical = await ownerBatchReviewService.startSessionV2(request);
                fence.assertCurrent();
                return canonical;
            } finally {
                fence.release();
            }
        },
        networkMode: 'always',
        retry: false,
        onSuccess: async (canonical) => {
            if (!sameIdentity(getResolvedImageInventoryIdentity(), identity)) return;
            await client.invalidateQueries({
                queryKey: imageInventoryKeys.discovery(identity),
            });
            await client.invalidateQueries({
                queryKey: ownerBatchReviewKeys.sessionV3(identity, canonical.sessionId),
            });
        },
    });
}

export function useSaveOwnerCandidateReview(identity: ImageInventoryIdentity) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (request: UpdateCandidateReviewRequest) => {
            const fence = captureOwnerRequest(identity);
            try {
                fence.assertCurrent();
                const canonical = await ownerUxService.updateCandidateReview(request);
                fence.assertCurrent();
                return canonical;
            } finally {
                fence.release();
            }
        },
        networkMode: 'always',
        retry: false,
        onSuccess: (canonical) => synchronizeCandidateReviewSuccess(
            client, identity, canonical.sessionId, canonical.candidateId, canonical,
        ),
    });
}

export function useRemoveOwnerInventoryCandidate(
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
        mutationFn: async (request: RemoveCandidateFromScanRequest) => {
            if (activeScope.current !== scope || request.sessionId !== sessionId) {
                throw new Error('OWNER_CANDIDATE_AUTHORITY_CHANGED');
            }
            const lifecycle = new AbortController();
            controllers.current.add(lifecycle);
            const fence = captureOwnerRequest(identity, lifecycle.signal);
            try {
                fence.assertCurrent();
                const canonical = await ownerBatchReviewService
                    .removeCandidateFromScan(request, fence.signal);
                fence.assertCurrent();
                if (activeScope.current !== scope) {
                    throw new Error('OWNER_CANDIDATE_AUTHORITY_CHANGED');
                }
                return canonical;
            } finally {
                fence.release();
                controllers.current.delete(lifecycle);
            }
        },
        networkMode: 'always',
        retry: false,
        onSuccess: (canonical) => synchronizeRemoveCandidateSuccess(
            client, identity, sessionId, canonical,
        ),
    });
}

export async function synchronizeRemoveCandidateSuccess(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    canonical: RemoveCandidateFromScanResult,
): Promise<boolean> {
    if (
        !sameIdentity(getResolvedImageInventoryIdentity(), identity)
        || canonical.sessionId !== sessionId
        || canonical.reviewDisposition !== 'owner_removed_from_scan'
    ) return false;
    await recordConfirmedCandidateOutcome(client, identity, canonical);
    // Removed candidates leave the active review through authoritative refetch;
    // no optimistic local removal occurs.
    await Promise.all([
        client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: imageInventoryKeys.readiness(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId),
        }),
    ]);
    return true;
}

export function useCloseOwnerInventorySessionV3(
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
        mutationFn: async (request: CloseScanSessionV3Request) => {
            if (activeScope.current !== scope || request.sessionId !== sessionId) {
                throw new Error('OWNER_CLOSE_AUTHORITY_CHANGED');
            }
            const lifecycle = new AbortController();
            controllers.current.add(lifecycle);
            const fence = captureOwnerRequest(identity, lifecycle.signal);
            try {
                fence.assertCurrent();
                if (activeScope.current !== scope) {
                    throw new Error('OWNER_CLOSE_AUTHORITY_CHANGED');
                }
                return await ownerBatchReviewService.closeSessionV3(request, fence.signal);
            } finally {
                fence.release();
                controllers.current.delete(lifecycle);
            }
        },
        networkMode: 'always',
        retry: false,
        onSuccess: (canonical: OwnerSessionReadinessV3) => synchronizeCloseV3Success(
            client, identity, sessionId, canonical,
        ),
    });
}

export async function synchronizeCloseV3Success(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    canonical: OwnerSessionReadinessV3,
): Promise<boolean> {
    if (
        !sameIdentity(getResolvedImageInventoryIdentity(), identity)
        || canonical.sessionId !== sessionId
    ) return false;
    client.setQueryData(ownerBatchReviewKeys.readinessV3(identity, sessionId), canonical);
    await Promise.all([
        client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
        }),
    ]);
    return true;
}
