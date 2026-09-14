import { useRef, useState } from 'react';
import type { RemoveScanInputRequest } from '../api/ownerUxService';
import { useRemoveOwnerInventoryInput } from '../queries/ownerUxInputQueries';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { createCaptureUuid, createSemanticKey } from './captureIds';

export type InputRemovalTarget = { inputId: string; ordinal: number; inputVersion: number };

export function useInputRemoval({ identity, sessionId, sessionActive, isOffline }: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    sessionActive: boolean;
    isOffline: boolean;
}) {
    const mutation = useRemoveOwnerInventoryInput(identity, sessionId);
    const [target, setTarget] = useState<InputRemovalTarget | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const pending = useRef<RemoveScanInputRequest | null>(null);
    const begin = (next: InputRemovalTarget) => {
        if (mutation.isPending) return;
        if (pending.current?.inputId !== next.inputId
            || pending.current.expectedInputVersion !== next.inputVersion) pending.current = null;
        setMessage(null);
        setTarget(next);
    };
    const confirm = () => {
        if (!target || isOffline || !sessionActive || mutation.isPending) return;
        const request = pending.current ?? { sessionId, inputId: target.inputId,
            expectedInputVersion: target.inputVersion,
            idempotencyKey: createSemanticKey('remove-input'), commandId: createCaptureUuid() };
        pending.current = request;
        mutation.mutate(request, {
            onSuccess: () => {
                pending.current = null;
                setTarget(null);
                setMessage(`Image ${target.ordinal} removed.`);
            },
            onError: () => setMessage('The image could not be removed. Refresh and try again.'),
        });
    };
    return { target, message, setMessage, isPending: mutation.isPending,
        begin, confirm, cancel: () => setTarget(null) };
}
