import {
    type QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import {
    ownerCorrectionService,
    type AddManualCandidateRequest,
    type DecideVariantRequest,
    type ExpectedVariant,
    type MarkFalseRequest,
    type ReplaceVariantRequest,
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

export const ownerCorrectionKeys = {
    variants: (
        identity: ImageInventoryIdentity,
        sessionId: string,
        candidateId: string,
        expected: ReadonlyArray<ExpectedVariant>,
    ) => [
        ...imageInventoryKeys.identity(identity),
        'variants', sessionId, candidateId,
        expected.map((row) => `${row.proposalId}:${row.version}`),
    ] as const,
};

export function useOwnerCandidateVariants(
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
    expected: ReadonlyArray<ExpectedVariant>,
    enabled: boolean,
) {
    return useQuery({
        queryKey: ownerCorrectionKeys.variants(identity, sessionId, candidateId, expected),
        queryFn: ({ signal }) => ownerCorrectionService.resolveExpectedVariants(
            identity.storeId, expected, identity, signal,
        ),
        enabled: enabled && expected.length > 0,
        retry: false,
        staleTime: 0,
        gcTime: 5 * 60_000,
    });
}

export function useAddManualCandidate(identity: ImageInventoryIdentity) {
    return useMutation({
        mutationFn: (request: AddManualCandidateRequest) => (
            ownerCorrectionService.addManualCandidate(request, identity)
        ),
        networkMode: 'always',
        retry: false,
    });
}

export function useMarkCandidateFalse(identity: ImageInventoryIdentity) {
    return useMutation({
        mutationFn: (request: MarkFalseRequest) => ownerCorrectionService.markFalse(request, identity),
        networkMode: 'always',
        retry: false,
    });
}

export function useDecideOwnerVariant(identity: ImageInventoryIdentity) {
    return useMutation({
        mutationFn: (request: DecideVariantRequest) => ownerCorrectionService.decideVariant(request, identity),
        networkMode: 'always',
        retry: false,
    });
}

export function useReplaceOwnerVariant(identity: ImageInventoryIdentity) {
    return useMutation({
        mutationFn: (request: ReplaceVariantRequest) => ownerCorrectionService.replaceVariant(request, identity),
        networkMode: 'always',
        retry: false,
    });
}

export async function synchronizeCorrectionCandidate(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
    canonical: OwnerCandidateDetail,
): Promise<boolean> {
    if (
        !identityMatches(getResolvedImageInventoryIdentity(), identity)
        || canonical.sessionId !== sessionId
        || canonical.candidateId !== candidateId
    ) return false;
    client.setQueryData(imageInventoryKeys.candidate(identity, sessionId, candidateId), canonical);
    await Promise.all([
        client.invalidateQueries({ queryKey: [...imageInventoryKeys.identity(identity), 'candidates'] }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.session(identity, sessionId) }),
        client.invalidateQueries({ queryKey: imageInventoryKeys.readiness(identity, sessionId) }),
    ]);
    return true;
}

export function useCorrectionQueryClient() {
    return useQueryClient();
}
