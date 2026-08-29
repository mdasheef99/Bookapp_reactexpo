import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReview } from '../contracts/ownerBatchReviewContracts';
import type { OwnerInputProgress } from '../contracts/ownerUxContracts';
import { PostScanInputList } from './post-scan-input-list';
import { PostScanReviewSummary } from './post-scan-review-summary';

type RemoveTarget = { inputId: string; ordinal: number; inputVersion: number };

export function PostScanSessionHeader({
    loading,
    unavailable,
    lifecycleFailed,
    aggregateFailed,
    unsupportedOverflow,
    isOffline,
    sessionActive,
    batch,
    inputItems,
    firstCandidateId,
    inputAnnouncement,
    removeMessage,
    candidateMessage,
    removeTarget,
    removePending,
    onReturnToInventory,
    onRetryLifecycle,
    onRetryReview,
    onOpenFirstCandidate,
    onBeginRemove,
    onConfirmRemove,
    onCancelRemove,
}: {
    loading: boolean;
    unavailable: boolean;
    lifecycleFailed: boolean;
    aggregateFailed: boolean;
    unsupportedOverflow: boolean;
    isOffline: boolean;
    sessionActive: boolean;
    batch: OwnerBatchReview | undefined;
    inputItems: OwnerInputProgress[];
    firstCandidateId: string | null;
    inputAnnouncement: string | null;
    removeMessage: string | null;
    candidateMessage: string | null;
    removeTarget: RemoveTarget | null;
    removePending: boolean;
    onReturnToInventory: () => void;
    onRetryLifecycle: () => void;
    onRetryReview: () => void;
    onOpenFirstCandidate: () => void;
    onBeginRemove: (target: RemoveTarget) => void;
    onConfirmRemove: () => void;
    onCancelRemove: () => void;
}) {
    const { colors } = useTheme();
    const title = (
        <Text selectable accessibilityRole="header" style={{
            color: colors.textPrimary,
            fontSize: 26,
            fontWeight: '800',
        }}>
            Review scanned books
        </Text>
    );
    return (
        <GlassCard padding={20} borderRadius={16}>
            {loading ? (
                <View style={{ gap: 8 }}>
                    {title}
                    <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
                        Loading saved scan progress…
                    </Text>
                </View>
            ) : unavailable ? (
                <View style={{ gap: 12 }}>
                    {title}
                    <Text selectable style={{ color: colors.textSecondary }}>This scan session is unavailable.</Text>
                    <Button title="Return to Inventory" onPress={onReturnToInventory} />
                </View>
            ) : lifecycleFailed ? (
                <View style={{ gap: 12 }}>
                    {title}
                    <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.textSecondary }}>
                        Saved scan progress could not be loaded.
                    </Text>
                    <Text selectable style={{ color: colors.textSecondary }}>
                        Your saved scan has not been changed. Retry when the connection is available.
                    </Text>
                    <Button title="Retry" onPress={onRetryLifecycle} />
                </View>
            ) : (
                <View style={{ gap: 14 }}>
                    {batch && !aggregateFailed && !unsupportedOverflow ? (
                        <PostScanReviewSummary
                            sessionStatus={batch.status}
                            inputCount={inputItems.length}
                            visibleCount={batch.items.length}
                            batchLabel={batch.batchLabel}
                            counts={batch.counts}
                        />
                    ) : title}
                    <Text selectable style={{ color: colors.textSecondary }}>
                        Saved on server. Processing continues if you leave.
                    </Text>
                    <View style={{ gap: 12 }}>
                        {aggregateFailed ? (
                            <View testID="batch-review-degraded" style={{ gap: 8 }}>
                                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error, fontWeight: '800' }}>
                                    Book review is temporarily unavailable.
                                </Text>
                                <Text selectable style={{ color: colors.textSecondary }}>
                                    Your image progress is still available below. Retry to load the saved book cards.
                                </Text>
                                <Button title="Retry book review" variant="secondary" onPress={onRetryReview} disabled={isOffline} />
                            </View>
                        ) : unsupportedOverflow ? (
                            <View testID="batch-review-unsupported" style={{ gap: 6 }}>
                                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                                    This scan contains more saved books than single-image review supports.
                                </Text>
                                <Text selectable style={{ color: colors.textSecondary }}>
                                    Nothing was deleted. The session summary keeps the authoritative status.
                                </Text>
                            </View>
                        ) : !batch ? (
                            <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
                                Preparing the saved book review…
                            </Text>
                        ) : firstCandidateId ? (
                            <Button title="Open first book in full review" variant="secondary" onPress={onOpenFirstCandidate} />
                        ) : null}
                        {inputAnnouncement ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{inputAnnouncement}</Text> : null}
                        {removeMessage ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{removeMessage}</Text> : null}
                        {candidateMessage ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{candidateMessage}</Text> : null}
                        <PostScanInputList
                            items={inputItems}
                            removeTarget={removeTarget}
                            isOffline={isOffline}
                            sessionActive={sessionActive}
                            removePending={removePending}
                            onBeginRemove={onBeginRemove}
                            onConfirmRemove={onConfirmRemove}
                            onCancelRemove={onCancelRemove}
                        />
                    </View>
                </View>
            )}
        </GlassCard>
    );
}
