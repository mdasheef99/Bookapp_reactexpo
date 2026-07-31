import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';

export function CandidateReviewState({
    title,
    body,
    loading,
    retry,
}: {
    title: string;
    body: string;
    loading?: boolean;
    retry?: () => void;
}) {
    const { colors } = useTheme();
    return (
        <ScreenBackground>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 20 }}
            >
                <GlassCard padding={20} borderRadius={16}>
                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '800' }}>{title}</Text>
                    {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} /> : null}
                    <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 8 }}>{body}</Text>
                    {retry ? <Button title="Retry" style={{ marginTop: 12 }} onPress={retry} /> : null}
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}
