import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';

// SDD-1 §6 (4a): the batch card is the single Add entry point.
type CoordinatedAddProps = Readonly<{
    card: OwnerBatchReviewCard;
    disabled: boolean;
    isOffline: boolean;
    pending: boolean;
    outcome?: CandidateCommitOutcome;
    editionChoices?: EditionChoices;
    onAdd: () => Promise<unknown>;
}>;

export function AddCandidateToInventoryAction({
    card,
    disabled,
    isOffline,
    pending,
    outcome,
    editionChoices,
    onAdd,
}: CoordinatedAddProps) {
    const { colors } = useTheme();
    if (outcome?.status === 'succeeded' && outcome.candidateId === card.candidateId
        && outcome.result?.candidateId === card.candidateId && outcome.result.sessionId === card.sessionId) {
        return (
            <View testID={`add-to-inventory-success-${card.candidateId}`} style={{ gap: 8 }}>
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.accent, fontWeight: '800' }}>
                    Added to Inventory
                </Text>
            </View>
        );
    }
    const canShow = card.allowedActions.includes('add_to_inventory')
        || card.allowedActions.includes('save_review');
    if (!canShow) return null;
    const retry = outcome?.status === 'failed_retryable' || outcome?.status === 'still_pending';
    const unconfirmedSuggestion = outcome?.stage === 'save' && outcome.code === 'P9_STATE_CONFLICT'
        && editionChoices?.sessionId === card.sessionId && editionChoices.candidateId === card.candidateId
        && editionChoices.candidateVersion === card.candidateVersion
        && editionChoices.metadataRevision === card.metadataRevision && editionChoices.reviewVersion === card.reviewVersion
        && editionChoices.selection?.source === 'current_suggestion' && !editionChoices.selection.confirmedByOwner;
    const ineligibleMessage = outcome?.code === 'review_changed'
        ? 'This book changed. Check it and press Add again.'
        : unconfirmedSuggestion
            ? 'Check the latest details. If this is the suggested edition, open Find or change edition and tap Confirm current suggestion.'
            : outcome?.stage === 'claim'
                ? 'This book changed after your edits. Check the latest details and press Add again.'
                : 'This book is no longer eligible. Review the latest saved details.';
    return (
        <View style={{ gap: 6 }}>
            {outcome?.status === 'no_longer_eligible' ? (
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                    {ineligibleMessage}
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
                disabled={disabled || isOffline || pending
                    || (outcome?.status === 'no_longer_eligible' && outcome.code !== 'review_changed')}
                accessibilityHint="Saves displayed review changes, revalidates authority, then creates one private inventory item."
            />
        </View>
    );
}
