import { useEffect, useRef, useState } from 'react';
import type { OwnerInputProgress } from '../contracts/ownerUxContracts';
import type { ResolveDuplicateScanInputRequest } from '../api/ownerUxService';
import { useResolveDuplicateOwnerInventoryInput } from '../queries/ownerUxInputQueries';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { createCaptureUuid, createSemanticKey } from './captureIds';

export function useDuplicateInputConfirmation({
    identity, sessionId, inputs, sessionActive, isOffline, onMessage,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    inputs: OwnerInputProgress[] | undefined;
    sessionActive: boolean;
    isOffline: boolean;
    onMessage: (message: string) => void;
}) {
    const mutation = useResolveDuplicateOwnerInventoryInput(identity, sessionId);
    const pending = inputs?.find((item) => (
        item.presentationState === 'duplicate_confirmation_required'
    )) ?? null;
    const key = pending ? `${pending.inputId}:${pending.duplicateConfirmationVersion}` : null;
    const command = useRef<ResolveDuplicateScanInputRequest | null>(null);
    const dismissed = useRef<string | null>(null);
    const [visibleInputId, setVisibleInputId] = useState<string | null>(null);
    useEffect(() => {
        if (key && dismissed.current !== key) setVisibleInputId(pending?.inputId ?? null);
        else if (!key) {
            setVisibleInputId(null);
            dismissed.current = null;
        }
    }, [key, pending?.inputId]);

    const resolve = (decision: 'cancel' | 'proceed') => {
        if (!pending || isOffline || !sessionActive || mutation.isPending
            || !pending.duplicateConfirmationVersion) return;
        const prior = command.current;
        const request = prior?.decision === decision && prior.inputId === pending.inputId
            && prior.expectedInputVersion === pending.inputVersion
            && prior.expectedConfirmationVersion === pending.duplicateConfirmationVersion
            ? prior : { sessionId, inputId: pending.inputId, decision,
                expectedInputVersion: pending.inputVersion,
                expectedConfirmationVersion: pending.duplicateConfirmationVersion,
                idempotencyKey: createSemanticKey(`duplicate-${decision}`), commandId: createCaptureUuid() };
        command.current = request;
        mutation.mutate(request, {
            onSuccess: () => {
                command.current = null;
                setVisibleInputId(null);
                onMessage(decision === 'cancel'
                    ? 'Duplicate upload cancelled.' : 'Duplicate accepted. Image analysis started.');
            },
            onError: () => onMessage('The duplicate choice could not be saved. Refresh and try again.'),
        });
    };
    return {
        pending,
        visible: Boolean(pending && visibleInputId === pending.inputId),
        isPending: mutation.isPending,
        review: (item: OwnerInputProgress) => setVisibleInputId(item.inputId),
        dismiss: () => { dismissed.current = key; setVisibleInputId(null); },
        cancel: () => resolve('cancel'),
        proceed: () => resolve('proceed'),
    };
}
