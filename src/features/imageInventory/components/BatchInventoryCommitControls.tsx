import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import {
    candidateCanStartBulkCommit,
    type AddAllResult,
    type CandidateCommitDraft,
    type CandidateCommitOutcome,
    type FrozenAddAllCommand,
} from '../commit/inventoryCommitCoordinator';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';

export function BatchInventoryCommitControls({
    candidates,
    disabled,
    pending,
    result,
    remainingReviewCount = 0,
    blockedCandidateIds,
    inFlightCandidateIds,
    outcomes,
    onAddAll,
    onRetry,
}: {
    candidates: readonly CandidateCommitDraft[];
    disabled: boolean;
    pending: boolean;
    result: AddAllResult | null;
    remainingReviewCount?: number;
    blockedCandidateIds?: ReadonlySet<string>;
    inFlightCandidateIds?: ReadonlySet<string>;
    outcomes?: ReadonlyMap<string, CandidateCommitOutcome>;
    onAddAll: (candidates: readonly CandidateCommitDraft[]) => Promise<{
        command: FrozenAddAllCommand;
        result: AddAllResult;
    }>;
    onRetry: (
        command: FrozenAddAllCommand,
        candidates: readonly CandidateCommitDraft[],
    ) => Promise<AddAllResult>;
}) {
    const { colors } = useTheme();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [lastCommand, setLastCommand] = useState<FrozenAddAllCommand | null>(null);
    const eligible = useMemo(
        () => candidates.filter((candidate) => candidateCanStartBulkCommit(
            candidate, blockedCandidateIds, inFlightCandidateIds, outcomes,
        )),
        [blockedCandidateIds, candidates, inFlightCandidateIds, outcomes],
    );
    const retryable = Boolean(result && (
        result.failedRetryable > 0 || result.stillPending > 0 || result.needsAttention > 0
    ));
    const bookCount = (count: number) => `${count} ${count === 1 ? 'book' : 'books'}`;
    const addedLabel = result ? `${bookCount(result.succeeded)} added` : null;
    const remainingLabel = result
        ? `${bookCount(remainingReviewCount)} remain in review.`
        : remainingReviewCount > 0
            ? `${bookCount(remainingReviewCount)} currently in review.`
            : null;
    const outcomeCounts = result ? [
        ['Retryable', result.failedRetryable],
        ['No longer eligible', result.noLongerEligible],
        ['Needs attention', result.needsAttention],
        ['Still pending', result.stillPending],
        ['Busy', result.busy],
    ] as const : [];
    const resultAnnouncement = result && addedLabel ? [
        'Bulk add result',
        addedLabel,
        ...outcomeCounts.map(([label, count]) => `${label} ${count}`),
        `${bookCount(remainingReviewCount)} remain in review`,
    ].join('. ') + '.' : null;

    if (eligible.length === 0 && !result) return null;
    return (
        <View testID="add-all-controls" style={{
            gap: 10, padding: 12, borderTopWidth: 1, borderColor: colors.border,
            borderRadius: 16, backgroundColor: colors.bgSecondary,
        }}>
            {eligible.length > 0 ? (
                <Button
                    title={`Add all ready books (${eligible.length})`}
                    onPress={() => setConfirmOpen(true)}
                    disabled={disabled || pending}
                    loading={pending}
                    accessibilityHint={`Confirms and freezes exactly ${eligible.length} current books before independent private inventory commits.`}
                />
            ) : null}
            <OwnerConfirmationDialog
                visible={confirmOpen}
                title={`Add exactly ${eligible.length} books?`}
                description="Each book is saved and revalidated independently. Mixed outcomes remain separate and nothing is published automatically."
                confirmLabel={`Add all ${eligible.length}`}
                pending={pending}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    // Membership and exact N freeze synchronously inside this
                    // confirmed command before its first network request.
                    void onAddAll(eligible).then(({ command }) => setLastCommand(command));
                }}
            />
            {result && addedLabel && resultAnnouncement ? (
                <View
                    testID="add-all-result"
                    accessible
                    accessibilityLabel={resultAnnouncement}
                    accessibilityLiveRegion="polite"
                    style={{ gap: 8, paddingTop: 2 }}
                >
                    <Text selectable style={{
                        color: result.succeeded ? colors.accent : colors.textPrimary,
                        fontSize: 16,
                        fontWeight: '800',
                    }}>
                        {addedLabel}
                    </Text>
                    <View testID="add-all-result-counts" style={{
                        flexDirection: 'row', flexWrap: 'wrap', gap: 6,
                    }}>
                        {outcomeCounts.map(([label, count]) => (
                            <View key={label} style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                minHeight: 30, paddingHorizontal: 9, borderRadius: 999,
                                borderWidth: 1, borderColor: colors.border,
                                backgroundColor: colors.bgPrimary,
                            }}>
                                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
                                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '800' }}>{count}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}
            {remainingLabel ? (
                <Text testID="remaining-review-count" selectable style={{
                    color: colors.textSecondary, textAlign: 'center', fontSize: 12,
                }}>
                    {remainingLabel}
                </Text>
            ) : null}
            {retryable && lastCommand ? (
                <Button
                    title="Retry unresolved books"
                    variant="secondary"
                    disabled={disabled || pending}
                    onPress={() => { void onRetry(lastCommand, candidates); }}
                    accessibilityHint="Retries only unresolved command identities; succeeded books are never recommitted."
                />
            ) : null}
        </View>
    );
}
