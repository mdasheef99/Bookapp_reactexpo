import { synchronizeCandidateReviewSuccess } from '../queries/ownerUxReviewQueries';
import { acceptCandidateRead, candidateVersions, knownCandidateVersions, versionsRegress,
    type CandidateVersions } from '../queries/ownerCandidateAuthority';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ownerUxService } from '../api/ownerUxService';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import type { OwnerCandidateCommitResult } from '../contracts/ownerUxContracts';
import { captureOwnerRequest } from '../identity/ownerRequestFence';
import { synchronizeInventoryCommitIneligibility, synchronizeInventoryCommitSuccess } from '../queries/ownerInventoryCommitQueries';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import {
    InventoryCommitCoordinator,
    type AddAllResult,
    type CandidateCommitDraft,
    type CandidateCommitOutcome,
} from './inventoryCommitCoordinator';

type InFlightState = ReadonlySet<string>;

export function useInventoryCommitCoordinator(
    identity: ImageInventoryIdentity,
    sessionId: string,
) {
    const client = useQueryClient();
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const ownerIdentity = useMemo(() => ({
        userId: identity.userId,
        storeId: identity.storeId,
    }), [identity.storeId, identity.userId]);
    const activeScope = useRef(scope);
    const controllers = useRef(new Set<AbortController>());
    const outcomeAuthorities = useRef(new Map<string, CandidateVersions>());
    const checkedAuthorities = useRef(new Map<string, CandidateVersions>());
    const [inFlight, setInFlight] = useState<InFlightState>(new Set());
    const [outcomes, setOutcomes] = useState<Map<string, CandidateCommitOutcome>>(new Map());
    const [bulkResult, setBulkResult] = useState<AddAllResult | null>(null);
    const [bulkPending, setBulkPending] = useState(false);

    const executeFenced = useMemo(() => async <T,>(
        run: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> => {
        if (activeScope.current !== scope) throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
        const controller = new AbortController();
        controllers.current.add(controller);
        const fence = captureOwnerRequest(ownerIdentity, controller.signal);
        try {
            fence.assertCurrent();
            const result = await run(fence.signal);
            fence.assertCurrent();
            if (activeScope.current !== scope) throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
            return result;
        } finally {
            fence.release();
            controllers.current.delete(controller);
        }
    }, [ownerIdentity, scope]);

    const coordinator = useMemo(() => new InventoryCommitCoordinator({
        saveReview: async (request) => {
            const canonical = await executeFenced(
                signal => ownerUxService.updateCandidateReview(request, signal),
            );
            if (activeScope.current !== scope) throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
            const current = acceptCandidateRead(client, ownerIdentity, canonical);
            if (current !== canonical) throw new Error('OWNER_CANDIDATE_AUTHORITY_CHANGED');
            checkedAuthorities.current.set(request.candidateId, candidateVersions(canonical));
            await synchronizeCandidateReviewSuccess(client, ownerIdentity, request.sessionId, request.candidateId, canonical);
            return canonical;
        },
        readCandidate: async (readSessionId, candidateId) => {
            const canonical = await executeFenced(
                signal => ownerUxService.readCandidate(readSessionId, candidateId, signal),
            );
            if (activeScope.current !== scope) throw new Error('OWNER_COMMIT_AUTHORITY_CHANGED');
            const current = acceptCandidateRead(client, ownerIdentity, canonical);
            checkedAuthorities.current.set(candidateId, candidateVersions(current));
            return current;
        },
        // Retained Unit 7A/M39 mobile client seam. This sends only IDs,
        // canonical versions, and idempotency identities.
        commitCandidate: (request) => {
            checkedAuthorities.current.set(request.candidateId, {
                candidateVersion: request.expectedCandidateVersion,
                metadataRevision: request.expectedMetadataRevision,
                reviewVersion: request.expectedReviewVersion,
            });
            return executeFenced(signal => ownerUxService.addCandidateToInventory(request, signal));
        },
        synchronizeSuccess: (results: readonly OwnerCandidateCommitResult[]) => (
            synchronizeInventoryCommitSuccess(client, ownerIdentity, sessionId, results)
                .then(() => undefined)
        ),
        synchronizeIneligible: (candidateIds: readonly string[]) => (
            synchronizeInventoryCommitIneligibility(
                client, ownerIdentity, sessionId, candidateIds,
            ).then(() => undefined)
        ),
        createIdempotencyKey: createSemanticKey,
        createCommandId: createCaptureUuid,
    }), [client, executeFenced, ownerIdentity, sessionId]);

    useEffect(() => {
        activeScope.current = scope;
        setInFlight(new Set());
        setOutcomes(new Map());
        outcomeAuthorities.current.clear();
        checkedAuthorities.current.clear();
        setBulkResult(null);
        setBulkPending(false);
        return () => {
            activeScope.current = '';
            coordinator.dispose();
            for (const controller of controllers.current) controller.abort();
            controllers.current.clear();
        };
    }, [scope, coordinator]);

    useEffect(() => {
        // SDD-1 §2/D2-3: a refusal belongs to the authority that was checked.
        const clearStaleRefusals = () => {
            if (activeScope.current !== scope) return;
            setOutcomes((current) => {
                const stale = [...current].filter(([candidateId, outcome]) => {
                    const authority = outcomeAuthorities.current.get(candidateId);
                    return outcome.status === 'no_longer_eligible' && authority
                        && knownCandidateVersions(client, ownerIdentity, { sessionId, candidateId })
                            .some(latest => versionsRegress(authority, latest));
                });
                if (stale.length === 0) return current;
                const updated = new Map(current);
                stale.forEach(([candidateId]) => updated.delete(candidateId));
                return updated;
            });
        };
        clearStaleRefusals();
        return client.getQueryCache().subscribe((event) => {
            if (event.type === 'updated' && event.action.type === 'success') clearStaleRefusals();
        });
    }, [client, outcomes, ownerIdentity, scope, sessionId]);

    const markInFlight = (candidateIds: readonly string[], pending: boolean) => {
        setInFlight((current) => {
            const next = new Set(current);
            candidateIds.forEach((candidateId) => {
                if (pending) next.add(candidateId); else next.delete(candidateId);
            });
            return next;
        });
    };
    const record = (
        next: readonly CandidateCommitOutcome[],
        authorities: readonly (CandidateVersions & { candidateId: string })[],
    ) => {
        const byId = new Map(authorities.map(authority => [authority.candidateId, authority]));
        next.forEach((outcome) => {
            const authority = checkedAuthorities.current.get(outcome.candidateId)
                ?? byId.get(outcome.candidateId);
            if (outcome.status === 'no_longer_eligible' && authority) {
                outcomeAuthorities.current.set(outcome.candidateId, {
                    candidateVersion: authority.candidateVersion,
                    metadataRevision: authority.metadataRevision,
                    reviewVersion: authority.reviewVersion,
                });
            } else outcomeAuthorities.current.delete(outcome.candidateId);
        });
        setOutcomes((current) => {
            const updated = new Map(current);
            next.forEach((outcome) => updated.set(outcome.candidateId, outcome));
            return updated;
        });
    };

    const addCandidate = async (value: CandidateCommitDraft) => {
        const candidateId = value.card.candidateId;
        checkedAuthorities.current.delete(candidateId);
        markInFlight([candidateId], true);
        try {
            const previous = outcomes.get(candidateId);
            // The current Owner-visible draft is always the source of Save
            // intent. It is forwarded into the retry decision so a superseded
            // frozen command can never silently replay stale Owner edits.
            const outcome = previous?.status === 'failed_retryable'
                || previous?.status === 'still_pending'
                ? await coordinator.retryCandidate(candidateId, value)
                : await coordinator.addCandidate(value);
            record([outcome], [value.card]);
            return outcome;
        } finally {
            markInFlight([candidateId], false);
        }
    };

    const addAll = async (values: readonly CandidateCommitDraft[]) => {
        const command = coordinator.freezeAddAll(values);
        command.candidateIds.forEach(candidateId => checkedAuthorities.current.delete(candidateId));
        markInFlight(command.candidateIds, true);
        setBulkResult(null);
        setBulkPending(true);
        try {
            const result = await coordinator.runAddAll(command);
            record(result.outcomes, command.commands);
            setBulkResult(result);
            return { command, result };
        } finally {
            markInFlight(command.candidateIds, false);
            setBulkPending(false);
        }
    };

    const retryAddAll = async (
        command: ReturnType<InventoryCommitCoordinator['freezeAddAll']>,
        currentDrafts: readonly CandidateCommitDraft[] = [],
    ) => {
        const retryIds = command.candidateIds.filter((candidateId) => {
            const status = command.outcomes.get(candidateId)?.status;
            return status === 'failed_retryable' || status === 'still_pending'
                || status === 'needs_attention';
        });
        retryIds.forEach(candidateId => checkedAuthorities.current.delete(candidateId));
        markInFlight(retryIds, true);
        setBulkPending(true);
        try {
            const result = await coordinator.retryAddAll(command, currentDrafts);
            record(result.outcomes, [...command.commands, ...currentDrafts.map(value => value.card)]);
            setBulkResult(result);
            return result;
        } finally {
            markInFlight(retryIds, false);
            setBulkPending(false);
        }
    };

    return {
        addCandidate,
        addAll,
        retryAddAll,
        // One command slot per candidate, shared by standalone Save/Remove and
        // Add/Add-all. Screens claim before any network request.
        claimSlot: (candidateId: string, prefix: string) => coordinator.tryClaim(candidateId, prefix),
        releaseSlot: (candidateId: string, token: string) => coordinator.releaseSlot(candidateId, token),
        isCommandActive: (candidateId: string) => coordinator.isCommandActive(candidateId),
        inFlight,
        outcomes,
        bulkResult,
        bulkPending,
    };
}
