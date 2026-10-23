import {
    type QueryClient,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import {
    ownerCorrectionService,
    type AddManualCandidateRequest,
} from '../api/ownerCorrectionService';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import {
    getResolvedImageInventoryIdentity,
    imageInventoryKeys,
    type ImageInventoryIdentity,
} from './ownerUxQueries';

const identityMatches = (
    left: ImageInventoryIdentity | null,
    right: ImageInventoryIdentity,
) => left?.userId === right.userId && left.storeId === right.storeId;

export function useAddManualCandidate(identity: ImageInventoryIdentity) {
    return useMutation({
        mutationFn: (request: AddManualCandidateRequest) => (
            ownerCorrectionService.addManualCandidate(request, identity)
        ),
        networkMode: 'always',
        retry: false,
    });
}

// SDD 01a §15.3: validate and cache the card before the ISBN steps, without waiting for refetches.
export function cacheCorrectionCandidate(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
    canonical: OwnerCandidateDetail,
): boolean {
    if (
        !identityMatches(getResolvedImageInventoryIdentity(), identity)
        || canonical.sessionId !== sessionId
        || canonical.candidateId !== candidateId
    ) return false;
    client.setQueryData(imageInventoryKeys.candidate(identity, sessionId, candidateId), canonical);
    return true;
}

export async function synchronizeCorrectionCandidate(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
    canonical: OwnerCandidateDetail,
): Promise<boolean> {
    if (!cacheCorrectionCandidate(client, identity, sessionId, candidateId, canonical)) return false;
    await Promise.all([
        client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.session(identity, sessionId) }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.readiness(identity, sessionId) }),
    ]);
    return true;
}

export function useCorrectionQueryClient() {
    return useQueryClient();
}
