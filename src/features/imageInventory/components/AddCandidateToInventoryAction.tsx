import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerUxClientError,
    type AddCandidateToInventoryRequest,
} from '../api/ownerUxService';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { useAddOwnerCandidateToInventory } from '../queries/ownerUxReviewQueries';

const conflictCodes = new Set(['P9_CANDIDATE_VERSION_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_STATE_CONFLICT']);

export function AddCandidateToInventoryAction({
    identity,
    detail,
    disabled,
    hasUnsavedReview,
    isOffline,
    refetchCandidate,
}: {
    identity: ImageInventoryIdentity;
    detail: OwnerCandidateDetail;
    disabled: boolean;
    hasUnsavedReview: boolean;
    isOffline: boolean;
    refetchCandidate: () => Promise<unknown>;
}) {
    const { colors } = useTheme();
    const mutation = useAddOwnerCandidateToInventory(
        identity, detail.sessionId, detail.candidateId,
    );
    const [pending, setPending] = useState<AddCandidateToInventoryRequest | null>(null);
    const pendingRef = useRef<AddCandidateToInventoryRequest | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const scope = `${identity.userId}:${identity.storeId}:${detail.sessionId}:${detail.candidateId}`;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        pendingRef.current = null;
        setPending(null);
        setMessage(null);
        return () => { activeScope.current = ''; };
    }, [scope]);

    if (!detail.allowedActions.includes('add_to_inventory')) return null;

    const run = async (command: AddCandidateToInventoryRequest) => {
        if (disabled || isOffline || mutation.isPending) return;
        const callScope = activeScope.current;
        setMessage(null);
        try {
            await mutation.mutateAsync(command);
            if (activeScope.current !== callScope) return;
            pendingRef.current = null;
            setPending(null);
            setMessage('Added to inventory');
            await refetchCandidate();
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (error instanceof OwnerUxClientError && error.code === 'P9_INTERNAL_ERROR') {
                setMessage('The add result is unclear. Retry the exact same command.');
                return;
            }
            pendingRef.current = null;
            setPending(null);
            if (error instanceof OwnerUxClientError && conflictCodes.has(error.code)) {
                setMessage('The candidate changed. Refresh and try again.');
                await refetchCandidate();
                return;
            }
            setMessage(error instanceof OwnerUxClientError
                ? error.message
                : 'The candidate could not be added to inventory.');
        }
    };
    const submit = () => {
        if (pendingRef.current) {
            void run(pendingRef.current);
            return;
        }
        if (detail.review.reviewVersion === null) return;
        const command: AddCandidateToInventoryRequest = {
            sessionId: detail.sessionId,
            candidateId: detail.candidateId,
            expectedCandidateVersion: detail.candidateVersion,
            expectedReviewVersion: detail.review.reviewVersion,
            expectedMetadataRevision: detail.metadata.revision,
            idempotencyKey: createSemanticKey('commit'),
            commandId: createCaptureUuid(),
        };
        pendingRef.current = command;
        setPending(command);
        void run(command);
    };

    return (
        <View style={{ gap: 8 }}>
            {message ? (
                <Text
                    selectable
                    accessibilityLiveRegion="polite"
                    style={{ color: message === 'Added to inventory' ? colors.accent : colors.error }}
                >
                    {message}
                </Text>
            ) : null}
            <Button
                title={pending && message?.includes('unclear')
                    ? 'Retry same add'
                    : 'Add to inventory'}
                onPress={submit}
                loading={mutation.isPending}
                disabled={disabled || isOffline || mutation.isPending
                    || detail.review.reviewVersion === null
                    || (!pending && hasUnsavedReview)
                    || message === 'Added to inventory'}
                accessibilityHint="Creates one new private inventory item from the saved review."
            />
        </View>
    );
}
