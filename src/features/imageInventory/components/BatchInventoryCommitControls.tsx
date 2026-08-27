import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import {
    candidateCanStartCommit,
    type AddAllResult,
    type CandidateCommitDraft,
    type FrozenAddAllCommand,
} from '../commit/inventoryCommitCoordinator';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';

export function BatchInventoryCommitControls({
    candidates,
    disabled,
    pending,
    result,
    onAddAll,
    onRetry,
}: {
    candidates: readonly CandidateCommitDraft[];
    disabled: boolean;
    pending: boolean;
    result: AddAllResult | null;
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
        () => candidates.filter(candidateCanStartCommit),
        [candidates],
    );
    const retryable = Boolean(result && (
        result.failedRetryable > 0 || result.stillPending > 0 || result.needsAttention > 0
    ));
    const summary = result ? [
        `Added ${result.succeeded}`,
        `Retryable ${result.failedRetryable}`,
        `No longer eligible ${result.noLongerEligible}`,
        `Needs attention ${result.needsAttention}`,
        `Still pending ${result.stillPending}`,
        `Busy ${result.busy}`,
    ].join(' · ') : null;

    if (eligible.length === 0 && !result) return null;
    return (
        <View style={{ gap: 8 }} testID="add-all-controls">
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
            {summary ? (
                <Text
                    selectable
                    testID="add-all-result"
                    accessibilityLiveRegion="polite"
                    style={{ color: result?.succeeded ? colors.accent : colors.textSecondary }}
                >
                    {summary}
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
