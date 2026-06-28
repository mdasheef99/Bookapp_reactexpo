import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';

function statusCopy(state?: string) {
    if (state === 'needs_more_info') return ['More information needed', 'Update your application with the requested details and resubmit it for review.'];
    if (state === 'rejected') return ['Application rejected', 'Review the reason below and contact BookConnect support if you need help.'];
    if (state === 'suspended') return ['Store suspended', 'Selling is blocked while BookConnect support reviews this store.'];
    if (state === 'selling_restricted') return ['Selling restricted', 'New selling actions are blocked. Existing paid order resolution remains a platform-supported path.'];
    return ['Application under review', 'BookConnect is reviewing your bookstore details and verification documents.'];
}

export default function StoreReviewStatusScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const [title, body] = statusCopy(gateState?.state);
    const reason = gateState && 'reason' in gateState ? gateState.reason : null;

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.content}>
                <GlassCard padding={22} borderRadius={16}>
                    <View style={styles.iconRow}>
                        <Ionicons name="shield-checkmark-outline" size={28} color={colors.accent} />
                    </View>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
                    {reason ? (
                        <Text style={[styles.reason, { color: colors.textPrimary }]}>Reason: {reason}</Text>
                    ) : null}
                    <Text style={[styles.support, { color: colors.textSecondary }]}>
                        Contact BookConnect support for application help.
                    </Text>
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    iconRow: {
        alignItems: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 12,
    },
    body: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 16,
    },
    reason: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 14,
    },
    support: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
});
