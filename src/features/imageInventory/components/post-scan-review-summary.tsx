import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReview } from '../contracts/ownerBatchReviewContracts';

type ReviewCounts = OwnerBatchReview['counts'];

function reviewStageLabel({
    sessionStatus,
    inputCount,
    visibleCount,
    counts,
}: {
    sessionStatus: OwnerBatchReview['status'];
    inputCount: number;
    visibleCount: number;
    counts: ReviewCounts;
}): string {
    if (sessionStatus === 'closed') return 'Closed · Read only';
    if (sessionStatus === 'expired') return 'Expired · Read only';
    if (sessionStatus === 'closing') return 'Closing session';
    if (counts.processing > 0) return 'Processing scan';
    if (counts.needsAttention > 0) return 'Needs review';
    if (visibleCount > 0) return 'Ready to review';
    if (inputCount === 0) return 'Waiting for image';
    return 'Checking image';
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
    const { colors } = useTheme();
    return (
        <View style={{
            minWidth: 92,
            flexGrow: 1,
            flexBasis: 92,
            gap: 2,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.bgSecondary,
            paddingHorizontal: 12,
            paddingVertical: 10,
        }}>
            <Text selectable style={{
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
            }}>
                {value}
            </Text>
            <Text selectable style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                {label}
            </Text>
        </View>
    );
}

export function PostScanReviewSummary({
    sessionStatus,
    inputCount,
    visibleCount,
    batchLabel,
    counts,
}: {
    sessionStatus: OwnerBatchReview['status'];
    inputCount: number;
    visibleCount: number;
    batchLabel: string | null;
    counts: ReviewCounts;
}) {
    const { colors } = useTheme();
    const stage = reviewStageLabel({ sessionStatus, inputCount, visibleCount, counts });
    return (
        <View testID="post-scan-review-summary" style={{ gap: 14 }}>
            <View style={{ gap: 8 }}>
                <View style={{
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    backgroundColor: counts.needsAttention > 0 ? colors.bgSecondary : colors.accent,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                }}>
                    <Text selectable style={{
                        color: counts.needsAttention > 0 ? colors.textPrimary : '#FFFFFF',
                        fontSize: 12,
                        fontWeight: '800',
                    }}>
                        {stage}
                    </Text>
                </View>
                <Text selectable accessibilityRole="header" style={{
                    color: colors.textPrimary,
                    fontSize: 26,
                    fontWeight: '800',
                    lineHeight: 32,
                }}>
                    Review scanned books
                </Text>
                <Text selectable style={{ color: colors.textSecondary, lineHeight: 21 }}>
                    Confirm each book, correct anything the scan missed, then add the ready books to private inventory.
                </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <SummaryMetric value={counts.detected} label="Detected" />
                <SummaryMetric value={visibleCount} label="In review" />
                <SummaryMetric value={counts.reviewReadySaved} label="Ready" />
                <SummaryMetric value={counts.needsAttention} label="Need review" />
                <SummaryMetric value={counts.committed} label="Added" />
            </View>

            <Text selectable style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
                Detected is the session total. Need review counts individual books; image attention above only describes scan processing. Cards below show active review only; added and removed books are not repeated.
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <View style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                }}>
                    <Text selectable style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        One image · Up to 15 books
                    </Text>
                </View>
                {batchLabel ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>Batch</Text>
                        <Text selectable style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                            {batchLabel}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}
