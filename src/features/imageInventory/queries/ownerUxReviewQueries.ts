import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
    ownerUxService,
    type AddCandidateToInventoryRequest,
    type UpdateCandidateReviewRequest,
} from '../api/ownerUxService';
import type {
    OwnerCandidateCommitResult,
    OwnerCandidateDetail,
} from '../contracts/ownerUxContracts';
import { captureOwnerRequest } from '../identity/ownerRequestFence';
import {
    getResolvedImageInventoryIdentity,
    imageInventoryKeys,
    type ImageInventoryIdentity,
} from './ownerUxQueries';
import { synchronizeInventoryCommitSuccess } from './ownerInventoryCommitQueries';
import { ownerBatchReviewKeys } from './ownerBatchReviewQueries';

const identityToken = (identity: ImageInventoryIdentity | null) => (
    identity ? `${identity.userId}:${identity.storeId}` : null
);

export function useUpdateOwnerCandidateReview(
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
) {
    const client = useQueryClient();
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`;
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
        mutationFn: async (request: UpdateCandidateReviewRequest) => {
            if (
                activeScope.current !== scope
                || request.sessionId !== sessionId
                || request.candidateId !== candidateId
            ) throw new Error('OWNER_REVIEW_AUTHORITY_CHANGED');
            const lifecycle = new AbortController();
            controllers.current.add(lifecycle);
            const fence = captureOwnerRequest(identity, lifecycle.signal);
            try {
                fence.assertCurrent();
                if (activeScope.current !== scope) throw new Error('OWNER_REVIEW_AUTHORITY_CHANGED');
                const canonical = await ownerUxService.updateCandidateReview(request, fence.signal);
                fence.assertCurrent();
                if (activeScope.current !== scope) throw new Error('OWNER_REVIEW_AUTHORITY_CHANGED');
                return canonical;
            } finally {
                fence.release();
                controllers.current.delete(lifecycle);
            }
        },
        networkMode: 'always',
        retry: false,
        onSuccess: (canonical) => {
            if (activeScope.current !== scope) return;
            return synchronizeCandidateReviewSuccess(
                client, identity, sessionId, candidateId, canonical,
            );
        },
    });
}

export async function synchronizeCandidateReviewSuccess(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
    canonical: OwnerCandidateDetail,
): Promise<void> {
    const resolved = getResolvedImageInventoryIdentity();
    if (
        !resolved
        || identityToken(resolved) !== identityToken(identity)
        || canonical.sessionId !== sessionId
        || canonical.candidateId !== candidateId
    ) return;
    client.setQueryData(
        imageInventoryKeys.candidate(identity, sessionId, candidateId),
        canonical,
    );
    await Promise.all([
        client.invalidateQueries({
            queryKey: [...imageInventoryKeys.identity(identity), 'candidates'],
        }),
        client.invalidateQueries({
            queryKey: imageInventoryKeys.discovery(identity),
        }),
        client.invalidateQueries({
            queryKey: imageInventoryKeys.readiness(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
        }),
        client.invalidateQueries({
            queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId),
        }),
    ]);
}

export function useAddOwnerCandidateToInventory(
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
) {
    const client = useQueryClient();
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`;
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
        mutationFn: async (request: AddCandidateToInventoryRequest) => {
            if (
                activeScope.current !== scope
                || request.sessionId !== sessionId
                || request.candidateId !== candidateId
            ) throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
            const lifecycle = new AbortController();
            controllers.current.add(lifecycle);
            const fence = captureOwnerRequest(identity, lifecycle.signal);
            try {
                fence.assertCurrent();
                const result = await ownerUxService.addCandidateToInventory(request, fence.signal);
                fence.assertCurrent();
                if (activeScope.current !== scope) throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
                return result;
            } finally {
                fence.release();
                controllers.current.delete(lifecycle);
            }
        },
        networkMode: 'always',
        retry: false,
        onSuccess: (result) => {
            if (activeScope.current !== scope) return;
            return synchronizeCandidateCommitSuccess(
                client, identity, sessionId, candidateId, result,
            );
        },
    });
}

export async function synchronizeCandidateCommitSuccess(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateId: string,
    result: OwnerCandidateCommitResult,
): Promise<void> {
    const resolved = getResolvedImageInventoryIdentity();
    if (
        !resolved
        || identityToken(resolved) !== identityToken(identity)
        || result.sessionId !== sessionId
        || result.candidateId !== candidateId
    ) return;
    await synchronizeInventoryCommitSuccess(client, identity, sessionId, [result]);
}
