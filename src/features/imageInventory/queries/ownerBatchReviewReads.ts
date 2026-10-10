import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ownerBatchReviewService, type OwnerSessionSummaryV3 } from '../api/ownerBatchReviewService';
import type { OwnerBatchReview } from '../contracts/ownerBatchReviewContracts';
import { captureOwnerRequest } from '../identity/ownerRequestFence';
import type { ImageInventoryIdentity } from './ownerUxQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewKeys';
import { assertBatchAuthority } from './ownerCandidateAuthority';
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
    const client = useQueryClient();
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
                .readBatchReview(readSessionId, readSignal).then(batch => assertBatchAuthority(client, identity!, batch)),
        ),
    });
}
