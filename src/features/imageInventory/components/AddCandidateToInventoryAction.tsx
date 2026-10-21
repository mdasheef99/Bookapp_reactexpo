import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';

// SDD-1 §6 (4a): the batch card is the single Add entry point.
type CoordinatedAddProps = Readonly<{
    card: OwnerBatchReviewCard;
    disabled: boolean;
    isOffline: boolean;
    pending: boolean;
    outcome?: CandidateCommitOutcome;
    onAdd: () => Promise<unknown>;
}>;

export function AddCandidateToInventoryAction({
    card,
    disabled,
    isOffline,
    pending,
    outcome,
    onAdd,
}: CoordinatedAddProps) {
    const { colors } = useTheme();
    const canShow = card.allowedActions.includes('add_to_inventory')
        || card.allowedActions.includes('save_review');
    if (!canShow) return null;
    if (outcome?.status === 'succeeded' && outcome.result) {
        return (
            <View testID={`add-to-inventory-success-${card.candidateId}`} style={{ gap: 8 }}>
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.accent, fontWeight: '800' }}>
                    Added to Inventory
                </Text>
            </View>
        );
    }
    const retry = outcome?.status === 'failed_retryable' || outcome?.status === 'still_pending';
    return (
        <View style={{ gap: 6 }}>
            {outcome?.status === 'no_longer_eligible' ? (
                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                    {outcome.code === 'review_changed'
                        ? 'This book changed. Check it and press Add again.'
                        : 'This book is no longer eligible. Review the latest saved details.'}
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
