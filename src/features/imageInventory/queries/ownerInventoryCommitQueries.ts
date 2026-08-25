import type { QueryClient } from '@tanstack/react-query';
import { STORE_VIEW_CONTRACT_VERSION } from '@/features/storeView/contracts/storeViewContracts';
import type { OwnerCandidateCommitResult } from '../contracts/ownerUxContracts';
import { OWNER_INVENTORY_CONTRACT_VERSION } from '../api/ownerInventoryReadService';
import { ownerBatchReviewKeys } from './ownerBatchReviewQueries';
import {
    getResolvedImageInventoryIdentity,
    imageInventoryKeys,
    type ImageInventoryIdentity,
} from './ownerUxQueries';

function sameIdentity(left: ImageInventoryIdentity | null, right: ImageInventoryIdentity) {
    return left?.userId === right.userId && left.storeId === right.storeId;
}

export async function synchronizeInventoryCommitSuccess(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    results: readonly OwnerCandidateCommitResult[],
): Promise<boolean> {
    if (!sameIdentity(getResolvedImageInventoryIdentity(), identity)) return false;
    const accepted = results.filter((result) => (
        result.sessionId === sessionId && result.outcome === 'committed_private'
    ));
    if (accepted.length === 0) return false;

    // Exact candidate roots remain independent; shared session/inventory roots
    // are invalidated once per synchronization call (once for a bulk run).
    for (const result of accepted) {
        await client.invalidateQueries({
            queryKey: imageInventoryKeys.candidate(
                identity, sessionId, result.candidateId,
            ),
        });
    }
    await client.invalidateQueries({
        queryKey: [...imageInventoryKeys.identity(identity), 'candidates'],
    });
    await client.invalidateQueries({ queryKey: imageInventoryKeys.discovery(identity) });
    await client.invalidateQueries({
        queryKey: imageInventoryKeys.readiness(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: [...imageInventoryKeys.identity(identity), 'ownerRead'],
    });
    await client.invalidateQueries({
        queryKey: [
            ...imageInventoryKeys.all,
            'ownerRead',
            OWNER_INVENTORY_CONTRACT_VERSION,
        ],
    });
    await client.invalidateQueries({
        queryKey: [...imageInventoryKeys.identity(identity), 'storeView'],
    });
    await client.invalidateQueries({
        queryKey: [
            ...imageInventoryKeys.all,
            'storeView',
            STORE_VIEW_CONTRACT_VERSION,
        ],
    });
    return true;
}

// No commit occurred, so only the exact candidate/review/readiness authority
// for this session is synchronized. Inventory, discovery, and Store View
// roots are intentionally untouched.
export async function synchronizeInventoryCommitIneligibility(
    client: QueryClient,
    identity: ImageInventoryIdentity,
    sessionId: string,
    candidateIds: readonly string[],
): Promise<boolean> {
    if (!sameIdentity(getResolvedImageInventoryIdentity(), identity)) return false;
    const unique = [...new Set(candidateIds)];
    if (unique.length === 0) return false;
    for (const candidateId of unique) {
        await client.invalidateQueries({
            queryKey: imageInventoryKeys.candidate(identity, sessionId, candidateId),
        });
    }
    await client.invalidateQueries({
        queryKey: imageInventoryKeys.readiness(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: ownerBatchReviewKeys.sessionV3(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId),
    });
    await client.invalidateQueries({
        queryKey: ownerBatchReviewKeys.readinessV3(identity, sessionId),
    });
    return true;
}
