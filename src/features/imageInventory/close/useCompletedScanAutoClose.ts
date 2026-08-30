import { useEffect, useRef, useState } from 'react';
import { OwnerUxClientError } from '../api/ownerUxService';
import type {
    CloseScanSessionV3Request,
    OwnerSessionSummaryV3,
} from '../api/ownerBatchReviewService';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import type { OwnerBatchReview } from '../contracts/ownerBatchReviewContracts';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { useCloseOwnerInventorySessionV3 } from '../queries/ownerBatchReviewQueries';
import { canAutoCloseCompletedScan } from './sessionAutoClosePolicy';

export function useCompletedScanAutoClose({
    identity,
    sessionId,
    session,
    batch,
    commandsIdle,
    isOffline,
    isFocused,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    session: OwnerSessionSummaryV3 | undefined;
    batch: OwnerBatchReview | undefined;
    commandsIdle: boolean;
    isOffline: boolean;
    isFocused: boolean;
}) {
    const closeMutation = useCloseOwnerInventorySessionV3(identity, sessionId);
    const [message, setMessage] = useState<string | null>(null);
    const pending = useRef<CloseScanSessionV3Request | null>(null);
    const attempted = useRef<string | null>(null);
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const activeScope = useRef(scope);

    useEffect(() => {
        activeScope.current = scope;
        pending.current = null;
        attempted.current = null;
        setMessage(null);
        return () => { activeScope.current = ''; };
    }, [scope]);

    const eligible = Boolean(session && batch && canAutoCloseCompletedScan({
        sessionId,
        sessionStatus: session.status,
        sessionVersion: session.sessionVersion,
        allInputsTerminal: session.allInputsTerminal,
        closeState: session.closeState,
        batchStatus: batch.status,
        batchSessionId: batch.sessionId,
        detected: batch.counts.detected,
        processing: batch.counts.processing,
        needsAttention: batch.counts.needsAttention,
        reviewReadySaved: batch.counts.reviewReadySaved,
        committed: batch.counts.committed,
        ownerRemoved: batch.counts.ownerRemoved,
        falseDetections: batch.counts.falseDetections,
        visibleCandidates: batch.items.length,
        commandsIdle,
        online: !isOffline,
        focused: isFocused,
    }));

    useEffect(() => {
        if (!eligible || !session || !batch || closeMutation.isPending) return;
        const attemptKey = `${scope}:${session.sessionVersion}:${batch.presentationRevision}`;
        if (attempted.current === attemptKey) return;
        const command = pending.current?.expectedSessionVersion === session.sessionVersion
            ? pending.current
            : {
                sessionId,
                expectedSessionVersion: session.sessionVersion,
                idempotencyKey: createSemanticKey('auto-close-session'),
                commandId: createCaptureUuid(),
            };
        pending.current = command;
        attempted.current = attemptKey;
        const callScope = scope;
        closeMutation.mutate(command, {
            onSuccess: () => {
                if (activeScope.current !== callScope) return;
                pending.current = null;
                setMessage('All detected books were added. Session closed automatically.');
            },
            onError: (error) => {
                if (activeScope.current !== callScope) return;
                const unclear = error instanceof OwnerUxClientError
                    && error.code === 'P9_INTERNAL_ERROR';
                if (!unclear) pending.current = null;
                setMessage(unclear
                    ? 'All books were added, but automatic Close is unclear. Open the session summary to reconcile it.'
                    : 'All books were added, but the session could not close automatically. Open the session summary to retry Close.');
            },
        });
    }, [batch, closeMutation, eligible, scope, session, sessionId]);

    return { message, isPending: closeMutation.isPending };
}
