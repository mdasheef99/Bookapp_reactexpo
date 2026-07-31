import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import type { CandidateConflictState } from '../review/candidateConflict';

export function CandidateConflictPanels({
    staleRefreshBase,
    conflict,
    isOffline,
    onRetry,
    onUseLatest,
    onReapply,
}: {
    staleRefreshBase: OwnerCandidateDetail | null;
    conflict: CandidateConflictState | null;
    isOffline: boolean;
    onRetry: (base: OwnerCandidateDetail) => void;
    onUseLatest: (latest: OwnerCandidateDetail) => void;
    onReapply: (conflict: CandidateConflictState) => void;
}) {
    const { colors } = useTheme();
    if (staleRefreshBase && !conflict) {
        return (
            <GlassCard padding={16} borderRadius={16}>
                <Text selectable accessibilityRole="header" style={{ color: colors.error, fontWeight: '800' }}>Review changed on the server</Text>
                <Text selectable style={{ color: colors.textSecondary, marginTop: 6 }}>Latest details are required before your edits can be compared or saved.</Text>
                <Button title="Retry latest details" style={{ marginTop: 12 }} onPress={() => onRetry(staleRefreshBase)} disabled={isOffline} />
            </GlassCard>
        );
    }
    if (!conflict) return null;
    return (
        <GlassCard padding={16} borderRadius={16}>
            <Text selectable accessibilityRole="header" style={{ color: colors.error, fontWeight: '800' }}>Review changed on the server</Text>
            <Text selectable style={{ color: colors.textSecondary, marginTop: 6 }}>Your edits are still here. Use the latest saved values, or recheck and reapply your edits against version {conflict.latest.candidateVersion}.</Text>
            {conflict.changes.map((change) => (
                <Text key={change} selectable style={{ color: colors.textSecondary, marginTop: 4 }}>{change}</Text>
            ))}
            <View style={{ gap: 10, marginTop: 12 }}>
                <Button title="Use latest" variant="secondary" onPress={() => onUseLatest(conflict.latest)} />
                <Button title="Reapply my edits" onPress={() => onReapply(conflict)} />
            </View>
        </GlassCard>
    );
}
