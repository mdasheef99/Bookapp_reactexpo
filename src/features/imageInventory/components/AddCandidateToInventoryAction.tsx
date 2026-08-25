import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerUxClientError,
    type AddCandidateToInventoryRequest,
} from '../api/ownerUxService';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { useAddOwnerCandidateToInventory } from '../queries/ownerUxReviewQueries';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { storeViewRoutes } from '@/features/storeView/navigation/storeViewRoutes';

const conflictCodes = new Set(['P9_CANDIDATE_VERSION_CONFLICT', 'P9_VERSION_CONFLICT', 'P9_STATE_CONFLICT']);

type LegacyAddProps = Readonly<{
    identity: ImageInventoryIdentity;
    detail: OwnerCandidateDetail;
    disabled: boolean;
    hasUnsavedReview: boolean;
    isOffline: boolean;
    refetchCandidate: () => Promise<unknown>;
}>;

type CoordinatedAddProps = Readonly<{
    card: OwnerBatchReviewCard;
    hasUnsavedReview: boolean;
    disabled: boolean;
    isOffline: boolean;
    pending: boolean;
    outcome?: CandidateCommitOutcome;
    onAdd: () => Promise<unknown>;
}>;

function CoordinatedAddCandidateAction({
    card,
    hasUnsavedReview,
    disabled,
    isOffline,
    pending,
    outcome,
    onAdd,
}: CoordinatedAddProps) {
    const { colors } = useTheme();
    const router = useRouter();
    const authorized = card.review !== null && (
        (card.reviewReady && card.allowedActions.includes('add_to_inventory'))
        || (hasUnsavedReview && card.allowedActions.includes('save_review'))
    );
    if (!authorized) return null;
    if (outcome?.status === 'succeeded' && outcome.result) {
        return (
            <View testID={`add-to-inventory-success-${card.candidateId}`} style={{ gap: 8 }}>
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.accent, fontWeight: '800' }}>
                    Added to Inventory
                </Text>
                <Button
                    title="View in Store View"
                    onPress={() => router.push(storeViewRoutes.detail(outcome.result!.inventoryId))}
                />
            </View>
        );
    }
    const retry = outcome?.status === 'failed_retryable' || outcome?.status === 'still_pending';
    return (
        <View style={{ gap: 6 }}>
            {outcome?.status === 'no_longer_eligible' ? (
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                    This book is no longer eligible. Review the latest saved details.
                </Text>
            ) : outcome?.status === 'still_pending' ? (
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                    The add result is unclear. Retry reconciles the same command.
                </Text>
            ) : outcome?.status === 'failed_retryable' ? (
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                    This book was not added. It can be retried safely.
                </Text>
            ) : null}
            <Button
                title={retry ? 'Retry add to inventory' : 'Add to inventory'}
                onPress={() => { void onAdd(); }}
                loading={pending}
                disabled={disabled || isOffline || pending || outcome?.status === 'no_longer_eligible'}
                accessibilityHint="Saves displayed review changes, revalidates authority, then creates one private inventory item."
            />
        </View>
    );
}

function LegacyAddCandidateToInventoryAction({
    identity,
    detail,
    disabled,
    hasUnsavedReview,
    isOffline,
    refetchCandidate,
}: LegacyAddProps) {
    const { colors } = useTheme();
    const router = useRouter();
    const mutation = useAddOwnerCandidateToInventory(
        identity, detail.sessionId, detail.candidateId,
    );
    const [pending, setPending] = useState<AddCandidateToInventoryRequest | null>(null);
    const pendingRef = useRef<AddCandidateToInventoryRequest | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [committedInventoryId, setCommittedInventoryId] = useState<string | null>(null);
    const scope = `${identity.userId}:${identity.storeId}:${detail.sessionId}:${detail.candidateId}`;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        pendingRef.current = null;
        setPending(null);
        setMessage(null);
        setCommittedInventoryId(null);
        return () => { activeScope.current = ''; };
    }, [scope]);

    if (!detail.allowedActions.includes('add_to_inventory')) return null;

    const run = async (command: AddCandidateToInventoryRequest) => {
        if (disabled || isOffline || mutation.isPending) return;
        const callScope = activeScope.current;
        setMessage(null);
        try {
            const result = await mutation.mutateAsync(command);
            if (activeScope.current !== callScope) return;
            pendingRef.current = null;
            setPending(null);
            setCommittedInventoryId(result.inventoryId);
            setMessage(null);
            try {
                await refetchCandidate();
            } catch {
                // The commit response is authoritative; a post-commit refresh is best effort.
            }
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
    const continueReviewing = () => {
        router.replace(inventoryRoutes.reviews());
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
            {committedInventoryId ? (
                <View testID="add-to-inventory-success" style={{ gap: 8 }}>
                    <Text
                        selectable
                        accessibilityLiveRegion="polite"
                        style={{ color: colors.accent, fontWeight: '800' }}
                    >
                        ✓ Added to Inventory
                    </Text>
                    <Button
                        title="Continue Reviewing"
                        variant="secondary"
                        testID="continue-reviewing"
                        onPress={continueReviewing}
                    />
                    <Button
                        title="View in Store View"
                        testID="view-in-store-view"
                        onPress={() => router.push(storeViewRoutes.detail(committedInventoryId))}
                    />
                </View>
            ) : null}
            {message ? (
                <Text
                    selectable
                    accessibilityLiveRegion="polite"
                    style={{ color: colors.error }}
                >
                    {message}
                </Text>
            ) : null}
            {!committedInventoryId ? (
                <Button
                    title={pending && message?.includes('unclear')
                        ? 'Retry same add'
                        : 'Add to inventory'}
                    onPress={submit}
                    loading={mutation.isPending}
                    disabled={disabled || isOffline || mutation.isPending
                        || detail.review.reviewVersion === null
                        || (!pending && hasUnsavedReview)}
                    accessibilityHint="Creates one new private inventory item from the saved review."
                />
            ) : null}
        </View>
    );
}

export function AddCandidateToInventoryAction(props: LegacyAddProps | CoordinatedAddProps) {
    return 'card' in props
        ? <CoordinatedAddCandidateAction {...props} />
        : <LegacyAddCandidateToInventoryAction {...props} />;
}
