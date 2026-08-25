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
        saveReview: (request) => executeFenced(
            (signal) => ownerUxService.updateCandidateReview(request, signal),
        ),
        readCandidate: (readSessionId, candidateId) => executeFenced(
            (signal) => ownerUxService.readCandidate(readSessionId, candidateId, signal),
        ),
        // Retained Unit 7A/M39 mobile client seam. This sends only IDs,
        // canonical versions, and idempotency identities.
        commitCandidate: (request) => executeFenced(
            (signal) => ownerUxService.addCandidateToInventory(request, signal),
        ),
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
        setBulkResult(null);
        setBulkPending(false);
        return () => {
            activeScope.current = '';
            for (const controller of controllers.current) controller.abort();
            controllers.current.clear();
        };
    }, [scope]);

    const markInFlight = (candidateIds: readonly string[], pending: boolean) => {
        setInFlight((current) => {
            const next = new Set(current);
            candidateIds.forEach((candidateId) => {
                if (pending) next.add(candidateId); else next.delete(candidateId);
            });
            return next;
        });
    };
    const record = (next: readonly CandidateCommitOutcome[]) => {
        setOutcomes((current) => {
            const updated = new Map(current);
            next.forEach((outcome) => updated.set(outcome.candidateId, outcome));
            return updated;
        });
    };

    const addCandidate = async (value: CandidateCommitDraft) => {
        const candidateId = value.card.candidateId;
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
            record([outcome]);
            return outcome;
        } finally {
            markInFlight([candidateId], false);
        }
    };

    const addAll = async (values: readonly CandidateCommitDraft[]) => {
        const command = coordinator.freezeAddAll(values);
        markInFlight(command.candidateIds, true);
        setBulkResult(null);
        setBulkPending(true);
        try {
            const result = await coordinator.runAddAll(command);
            record(result.outcomes);
            setBulkResult(result);
            return { command, result };
        } finally {
            markInFlight(command.candidateIds, false);
            setBulkPending(false);
        }
    };

    const retryAddAll = async (
        command: ReturnType<InventoryCommitCoordinator['freezeAddAll']>,
    ) => {
        const retryIds = command.candidateIds.filter((candidateId) => {
            const status = command.outcomes.get(candidateId)?.status;
            return status === 'failed_retryable' || status === 'still_pending';
        });
        markInFlight(retryIds, true);
        setBulkPending(true);
        try {
            const result = await coordinator.retryAddAll(command);
            record(result.outcomes);
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
