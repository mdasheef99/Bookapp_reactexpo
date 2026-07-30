import {
    type QueryClient,
    useQuery,
} from '@tanstack/react-query';
import { appQueryClient } from '@/lib/queryClient';
import {
    OwnerUxClientError,
    ownerUxService,
    type CandidatePageRequest,
} from '../api/ownerUxService';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';

export type ImageInventoryIdentity = Readonly<{
    userId: string;
    storeId: string;
}>;

type CandidatePageKeyContext = CandidatePageRequest & {
    pageSize: number;
    cursor: string | null;
};

const root = ['phase9', 'ownerInventory', OWNER_UX_CONTRACT_VERSION] as const;

export const imageInventoryKeys = {
    all: root,
    identity: (identity: ImageInventoryIdentity) => [
        ...root,
        'identity',
        identity.userId,
        identity.storeId,
    ] as const,
    discovery: (identity: ImageInventoryIdentity) => [
        ...imageInventoryKeys.identity(identity),
        'discovery',
    ] as const,
    session: (identity: ImageInventoryIdentity, sessionId: string) => [
        ...imageInventoryKeys.identity(identity),
        'session',
        sessionId,
    ] as const,
    candidates: (
        identity: ImageInventoryIdentity,
        context: CandidatePageKeyContext,
    ) => [
        ...imageInventoryKeys.identity(identity),
        'candidates',
        context.scope,
        'sessionId' in context ? context.sessionId : null,
        context.attention ?? 'all',
        context.pageSize,
        context.cursor,
    ] as const,
    candidate: (
        identity: ImageInventoryIdentity,
        sessionId: string,
        candidateId: string,
    ) => [
        ...imageInventoryKeys.identity(identity),
        'candidate',
        sessionId,
        candidateId,
    ] as const,
    readiness: (identity: ImageInventoryIdentity, sessionId: string) => [
        ...imageInventoryKeys.identity(identity),
        'readiness',
        sessionId,
    ] as const,
};

export async function clearImageInventoryPrivateQueries(
    client: QueryClient = appQueryClient,
): Promise<void> {
    let cancellationFailure: unknown = null;
    try {
        await client.cancelQueries({ queryKey: imageInventoryKeys.all });
    } catch (error) {
        cancellationFailure = error;
    }
    client.removeQueries({ queryKey: imageInventoryKeys.all });
    if (cancellationFailure) throw cancellationFailure;
}

function identityToken(identity: ImageInventoryIdentity | null): string | null {
    return identity ? `${identity.userId}:${identity.storeId}` : null;
}

let lastResolvedIdentity: ImageInventoryIdentity | null = null;
let identityTransitionQueue: Promise<void> = Promise.resolve();

export function getResolvedImageInventoryIdentity(): ImageInventoryIdentity | null {
    return lastResolvedIdentity;
}

export function coordinateImageInventoryIdentity(
    next: ImageInventoryIdentity | null,
    client: QueryClient = appQueryClient,
): Promise<void> {
    identityTransitionQueue = identityTransitionQueue
        .catch(() => undefined)
        .then(async () => {
            const previous = lastResolvedIdentity;
            if (previous && identityToken(previous) !== identityToken(next)) {
                try {
                    await clearImageInventoryPrivateQueries(client);
                } finally {
                    lastResolvedIdentity = next;
                }
                return;
            }
            lastResolvedIdentity = next;
        });
    return identityTransitionQueue;
}

export function clearImageInventoryIdentityState(
    client: QueryClient = appQueryClient,
): Promise<void> {
    return coordinateImageInventoryIdentity(null, client);
}

export function resetImageInventoryIdentityForTests(
    identity: ImageInventoryIdentity | null = null,
) {
    lastResolvedIdentity = identity;
    identityTransitionQueue = Promise.resolve();
}

const commonQueryOptions = {
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnReconnect: true,
    retry: (failureCount: number, error: Error) => (
        failureCount < 1
        && error instanceof OwnerUxClientError
        && error.retryable
    ),
} as const;

export function useOwnerInventoryDiscovery(identity: ImageInventoryIdentity | null) {
    return useQuery({
        ...commonQueryOptions,
        queryKey: imageInventoryKeys.discovery(identity ?? { userId: 'unresolved', storeId: 'unresolved' }),
        queryFn: ownerUxService.discover,
        enabled: Boolean(identity),
    });
}

export function useOwnerInventorySession(
    identity: ImageInventoryIdentity | null,
    sessionId: string | null,
) {
    return useQuery({
        ...commonQueryOptions,
        queryKey: imageInventoryKeys.session(
            identity ?? { userId: 'unresolved', storeId: 'unresolved' },
            sessionId ?? 'unresolved',
        ),
        queryFn: () => ownerUxService.readSession(sessionId as string),
        enabled: Boolean(identity && sessionId),
    });
}

export function useOwnerInventoryCandidates(
    identity: ImageInventoryIdentity | null,
    request: CandidatePageRequest | null,
) {
    const context = request
        ? { ...request, pageSize: request.pageSize ?? 20, cursor: request.cursor ?? null }
        : {
            scope: 'needs_review' as const,
            attention: 'all' as const,
            pageSize: 20,
            cursor: null,
        };
    return useQuery({
        ...commonQueryOptions,
        queryKey: imageInventoryKeys.candidates(
            identity ?? { userId: 'unresolved', storeId: 'unresolved' },
            context,
        ),
        queryFn: () => ownerUxService.listCandidates(request as CandidatePageRequest),
        enabled: Boolean(identity && request),
    });
}

export function useOwnerInventoryCandidate(
    identity: ImageInventoryIdentity | null,
    sessionId: string | null,
    candidateId: string | null,
) {
    return useQuery({
        ...commonQueryOptions,
        queryKey: imageInventoryKeys.candidate(
            identity ?? { userId: 'unresolved', storeId: 'unresolved' },
            sessionId ?? 'unresolved',
            candidateId ?? 'unresolved',
        ),
        queryFn: () => ownerUxService.readCandidate(sessionId as string, candidateId as string),
        enabled: Boolean(identity && sessionId && candidateId),
    });
}

export function useOwnerInventoryReadiness(
    identity: ImageInventoryIdentity | null,
    sessionId: string | null,
) {
    return useQuery({
        ...commonQueryOptions,
        queryKey: imageInventoryKeys.readiness(
            identity ?? { userId: 'unresolved', storeId: 'unresolved' },
            sessionId ?? 'unresolved',
        ),
        queryFn: () => ownerUxService.readReadiness(sessionId as string),
        enabled: Boolean(identity && sessionId),
    });
}
