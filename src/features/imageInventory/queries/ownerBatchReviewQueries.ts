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

// Every NEW 6G-C root nests beneath the Unit 6 private identity boundary so
// clearImageInventoryPrivateQueries covers it in the same work unit.
export const ownerBatchReviewKeys = {
    sessionV3: (identity: ImageInventoryIdentity, sessionId: string) => [
        ...imageInventoryKeys.identity(identity),
        'sessionV3',
        sessionId,
    ] as const,
    batchReview: (identity: ImageInventoryIdentity, sessionId: string) => [
        ...imageInventoryKeys.identity(identity),
        'batchReview',
        sessionId,
    ] as const,
    readinessV3: (identity: ImageInventoryIdentity, sessionId: string) => [
        ...imageInventoryKeys.identity(identity),
        'readinessV3',
        sessionId,
    ] as const,
};

const commonQueryOptions = {
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnReconnect: false,
    retry: false,
} as const;

function batchReviewProcessing(data:
    { counts: { processing: number } } | undefined): boolean {
    return (data?.counts.processing ?? 0) > 0;
}

type ReadFenceState = {
    activeScopeRef: { current: string };
    controllers: Set<AbortController>;
};

// Approved operation-generation/identity fencing for NEW 6G-C reads, mirroring
// the mutation pattern: requests are aborted and stale results rejected across
// session change, account/store change, reconnect cleanup, route lifecycle
// teardown, and newer generations. No parallel lifecycle is introduced.
function useOwnerReadFence(
    identity: ImageInventoryIdentity | null,
    sessionId: string | null,
): ReadFenceState {
    const scope = `${identity?.userId ?? ''}:${identity?.storeId ?? ''}:${sessionId ?? ''}`;
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
    return { activeScopeRef: activeScope, controllers: controllers.current };
}

async function executeFencedRead<T>(
    identity: ImageInventoryIdentity,
    sessionId: string,
    fenceState: ReadFenceState,
    requestSignal: AbortSignal | undefined,
    run: (sessionId: string, signal: AbortSignal) => Promise<T>,
): Promise<T> {
    const expectedScope = fenceState.activeScopeRef.current;
    const lifecycle = new AbortController();
    fenceState.controllers.add(lifecycle);
    const forwardCancellation = () => lifecycle.abort();
    requestSignal?.addEventListener('abort', forwardCancellation, { once: true });
    const fence = captureOwnerRequest(identity, lifecycle.signal);
    try {
        fence.assertCurrent();
        if (fenceState.activeScopeRef.current !== expectedScope) {
            throw new Error('OWNER_READ_AUTHORITY_CHANGED');
        }
        const result = await run(sessionId, fence.signal);
        fence.assertCurrent();
        if (fenceState.activeScopeRef.current !== expectedScope) {
            throw new Error('OWNER_READ_AUTHORITY_CHANGED');
        }
        return result;
    } finally {
        fence.release();
        requestSignal?.removeEventListener('abort', forwardCancellation);
        fenceState.controllers.delete(lifecycle);
    }
}

export function useOwnerSessionV3(
    identity: ImageInventoryIdentity | null,
    sessionId: string | null,
) {
    const fenceState = useOwnerReadFence(identity, sessionId);
    return useQuery<OwnerSessionSummaryV3>({
        ...commonQueryOptions,
        queryKey: ownerBatchReviewKeys.sessionV3(
            identity ?? { userId: 'unresolved', storeId: 'unresolved' },
            sessionId ?? 'unresolved',
        ),
        enabled: Boolean(identity && sessionId),
        queryFn: ({ signal }) => executeFencedRead<OwnerSessionSummaryV3>(
            identity as ImageInventoryIdentity,
            sessionId as string,
            fenceState,
            signal,
            (readSessionId, readSignal) => ownerBatchReviewService
                .readSessionV3(readSessionId, readSignal),
        ),
    });
}

export function useOwnerBatchReview(
    identity: ImageInventoryIdentity | null,
    sessionId: string | null,
    visible = true,
) {
    const fenceState = useOwnerReadFence(identity, sessionId);
    return useQuery<OwnerBatchReview>({
        ...commonQueryOptions,
        queryKey: ownerBatchReviewKeys.batchReview(
            identity ?? { userId: 'unresolved', storeId: 'unresolved' },
            sessionId ?? 'unresolved',
        ),
        enabled: Boolean(identity && sessionId),
        refetchInterval: (query) => (
            visible && batchReviewProcessing(query.state.data as never) ? 3_000 : false
        ),
        refetchIntervalInBackground: false,
        queryFn: ({ signal }) => executeFencedRead<OwnerBatchReview>(
            identity as ImageInventoryIdentity,
            sessionId as string,
            fenceState,
            signal,
            (readSessionId, readSignal) => ownerBatchReviewService
                .readBatchReview(readSessionId, readSignal),
        ),
    });
}

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
        onSuccess: async (canonical) => {
            if (!sameIdentity(getResolvedImageInventoryIdentity(), identity)) return;
            if (canonical.sessionId !== undefined) {
                await Promise.all([
                    client.invalidateQueries({
                        queryKey: ownerBatchReviewKeys.batchReview(
                            identity, canonical.sessionId as never as string,
                        ),
                    }),
                    client.invalidateQueries({
                        queryKey: imageInventoryKeys.candidate(
                            identity,
                            canonical.sessionId as never as string,
                            canonical.candidateId,
                        ),
                    }),
                ]);
            }
        },
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
        client.invalidateQueries({
            queryKey: [...imageInventoryKeys.identity(identity), 'candidates'],
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
        client.invalidateQueries({
            queryKey: [...imageInventoryKeys.identity(identity), 'candidates'],
        }),
    ]);
    return true;
}
