import { Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { storeSubscriptionService } from '../services/storeSubscriptionService';

function formatFeatureKey(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SubscriptionStatusScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const isActiveOwner = gateState?.state === 'active_owner';
    const storeId = isActiveOwner ? gateState.storeId : null;

    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ['storeSubscription', storeId],
        queryFn: () => storeSubscriptionService.getSubscriptionStatus(storeId!),
        enabled: !!storeId,
        gcTime: 0,
    });

    if (gateQuery.isLoading || statusLoading) {
        return (
            <ScreenBackground>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading...</Text>
                </View>
            </ScreenBackground>
        );
    }

    if (!isActiveOwner || !status) {
        return (
            <ScreenBackground>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: colors.textPrimary }}>Access denied</Text>
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <ScrollView style={{ flex: 1, padding: 16 }}>
                <GlassCard padding={16} borderRadius={16}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <Ionicons name="card-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Subscription</Text>
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' }}>
                        {status.planName ?? 'No active plan'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <View
                            style={{
                                backgroundColor: status.status === 'active' ? colors.accent : colors.error,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 4,
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{status.status}</Text>
                        </View>
                    </View>
                    {status.currentPeriodStart && status.currentPeriodEnd ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
                            {new Date(status.currentPeriodStart).toLocaleDateString()} - {new Date(status.currentPeriodEnd).toLocaleDateString()}
                        </Text>
                    ) : null}
                </GlassCard>

                <View style={{ height: 12 }} />

                <GlassCard padding={16} borderRadius={16}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Ionicons name="list-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Entitlements</Text>
                    </View>
                    {status.entitlements.map((ent) => {
                        const pct = ent.limitValue && ent.limitValue > 0
                            ? Math.min(ent.usedValue / ent.limitValue, 1)
                            : 0;
                        const barColor = ent.isEnabled
                            ? (pct >= 0.8 ? colors.error : colors.accent)
                            : colors.textTertiary;

                        return (
                            <View key={ent.featureKey} style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                                        {formatFeatureKey(ent.featureKey)}
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
                                        {ent.limitValue !== null
                                            ? `${ent.usedValue} / ${ent.limitValue}`
                                            : `${ent.usedValue}`}
                                    </Text>
                                </View>
                                <View style={{
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: colors.bgSecondary,
                                    overflow: 'hidden',
                                }}>
                                    <View style={{
                                        height: 8,
                                        borderRadius: 4,
                                        width: `${Math.round(pct * 100)}%`,
                                        backgroundColor: barColor,
                                        opacity: ent.isEnabled ? 1 : 0.4,
                                    }} />
                                </View>
                                {!ent.isEnabled ? (
                                    <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>Disabled</Text>
                                ) : null}
                            </View>
                        );
                    })}
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}
