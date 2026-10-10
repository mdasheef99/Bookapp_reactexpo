import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { BatchInventoryCommitControls } from './BatchInventoryCommitControls';
import type { useInventoryCommitCoordinator } from '../commit/useInventoryCommitCoordinator';
import type { CandidateCommitDraft } from '../commit/inventoryCommitCoordinator';
import { inventoryRoutes } from '../navigation/inventoryRoutes';

export function PostScanFooter({ sessionId, isOffline, active, inputCount, cardCount, overflow }: {
  sessionId: string; isOffline: boolean; active: boolean; inputCount: number; cardCount: number; overflow: boolean;
}) {
  const router = useRouter(); const { colors } = useTheme();
  return <View style={{ gap: 12, paddingTop: 4 }}>
    {isOffline && inputCount === 0 ? <Text selectable style={{ color: colors.textSecondary }}>Reconnect to choose a replacement image.</Text> : null}
    {inputCount === 0 ? <Button title="Choose replacement image" onPress={() => router.push(inventoryRoutes.scan())}
      disabled={isOffline || !active} /> : null}
    <Button title="View session summary" variant="secondary" onPress={() => router.push(inventoryRoutes.summary(sessionId))} />
    {!overflow ? <Button title="Add missed book" variant="secondary" onPress={() => router.push(inventoryRoutes.missed(sessionId))}
      disabled={isOffline || cardCount >= 15 || !active}
      accessibilityHint="Creates one staged manual candidate without running image analysis" /> : null}
  </View>;
}
export function PostScanBulkAction({ candidates, inventoryCommit, disabled, remainingReviewCount, blockedCandidateIds }: {
  candidates: CandidateCommitDraft[]; inventoryCommit: ReturnType<typeof useInventoryCommitCoordinator>;
  disabled: boolean; remainingReviewCount: number; blockedCandidateIds: ReadonlySet<string>;
}) {
  const { colors } = useTheme();
  return <View testID="post-scan-bulk-action" style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bgPrimary }}>
    <BatchInventoryCommitControls candidates={candidates} disabled={disabled}
      pending={inventoryCommit.bulkPending} result={inventoryCommit.bulkResult}
      remainingReviewCount={remainingReviewCount} blockedCandidateIds={blockedCandidateIds}
      inFlightCandidateIds={inventoryCommit.inFlight} outcomes={inventoryCommit.outcomes}
      onAddAll={inventoryCommit.addAll} onRetry={inventoryCommit.retryAddAll} />
  </View>;
}