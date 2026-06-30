import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { storeDashboardService } from '../services/storeDashboardService';
import type { StoreDashboardData } from '../types';

function InventoryHealthCard({ data }: { data: StoreDashboardData }) {
    const { colors } = useTheme();
    const counts = data.inventoryCounts;
    return (
        <GlassCard padding={16} borderRadius={16}>
            <View style={styles.cardHeader}>
                <Ionicons name="cube-outline" size={20} color={colors.accent} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Inventory Health</Text>
            </View>
            <View style={styles.statGrid}>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{counts.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.accent }]}>{counts.published}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Published</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textSecondary }]}>{counts.draft}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Draft</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.textSecondary }]}>{counts.paused}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Paused</Text>
                </View>
            </View>
            {counts.lowStock > 0 || counts.outOfStock > 0 ? (
                <View style={styles.warningRow}>
                    {counts.lowStock > 0 ? <Text style={[styles.statLabel, { color: '#D97706' }]}>{counts.lowStock} low stock</Text> : null}
                    {counts.outOfStock > 0 ? <Text style={[styles.statLabel, { color: colors.error ?? '#B91C1C' }]}>{counts.outOfStock} out of stock</Text> : null}
                </View>
            ) : null}
        </GlassCard>
    );
}

function QuotaUsageCard({ data }: { data: StoreDashboardData }) {
    const { colors } = useTheme();
    const quota = data.quotaUsage;
    return (
        <GlassCard padding={16} borderRadius={16}>
            <View style={styles.cardHeader}>
                <Ionicons name="speedometer-outline" size={20} color={colors.accent} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Quota Usage</Text>
            </View>
            <View style={styles.quotaColumn}>
                <QuotaBar label="Inventory" used={quota.inventoryItemUsed} limit={quota.inventoryItemLimit} colors={colors} />
                <QuotaBar label="Image extraction" used={quota.monthlyImageExtractionUsed} limit={quota.monthlyImageExtractionLimit} colors={colors} />
                <QuotaBar label="Active listings" used={quota.activeListingUsed} limit={quota.activeListingLimit} colors={colors} />
            </View>
        </GlassCard>
    );
}

function QuotaBar({ label, used, limit, colors }: { label: string; used: number; limit: number | null; colors: import('@/hooks/useTheme').ThemeColors }) {
    const pct = limit && limit > 0 ? Math.min(used / limit, 1) : 0;
    const barColor = pct >= 0.8 ? (colors.error ?? '#B91C1C') : colors.accent;
    return (
        <View style={styles.quotaRow}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={[styles.quotaBarBg, { backgroundColor: colors.bgSecondary }]}>
                <View style={[styles.quotaBarFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.quotaText, { color: colors.textSecondary }]}>{used}{limit ? `/${limit}` : ''}</Text>
        </View>
    );
}

function SubscriptionCard({ data }: { data: StoreDashboardData }) {
    const { colors } = useTheme();
    const s = data.subscriptionStatus;
    return (
        <GlassCard padding={16} borderRadius={16}>
            <View style={styles.cardHeader}>
                <Ionicons name="card-outline" size={20} color={colors.accent} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Subscription</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.textPrimary }]}>{s.planName ?? 'Trial / plan pending configuration'}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Status: {s.status}</Text>
            {s.currentPeriodEnd ? (
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Renews: {new Date(s.currentPeriodEnd).toLocaleDateString()}</Text>
            ) : null}
        </GlassCard>
    );
}

function ComplianceCard({ data }: { data: StoreDashboardData }) {
    const { colors } = useTheme();
    const blockers = data.complianceBlockers.filter((blocker) => blocker.isBlocked);
    return (
        <GlassCard padding={16} borderRadius={16}>
            <View style={styles.cardHeader}>
                <Ionicons name="shield-checkmark-outline" size={20} color={blockers.length > 0 ? (colors.error ?? '#B91C1C') : colors.accent} />
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Compliance</Text>
            </View>
            {blockers.length > 0 ? (
                <View style={styles.quotaColumn}>
                    {blockers.map((blocker) => (
                        <Text key={blocker.key} style={[styles.statLabel, { color: colors.error ?? '#B91C1C' }]}>
                            {blocker.label}
                        </Text>
                    ))}
                </View>
            ) : (
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>No current blockers</Text>
            )}
        </GlassCard>
    );
}

function PlaceholderCard({ icon, title, description, colors }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; colors: import('@/hooks/useTheme').ThemeColors }) {
    return (
        <GlassCard padding={16} borderRadius={16}>
            <View style={styles.cardHeader}>
                <Ionicons name={icon} size={20} color={colors.textTertiary} />
                <Text style={[styles.cardTitle, { color: colors.textTertiary }]}>{title}</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{description}</Text>
        </GlassCard>
    );
}

export default function StoreDashboardScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const isActiveOwner = gateState?.state === 'active_owner';
    const storeId = isActiveOwner ? gateState.storeId : null;

    const dashboardQuery = useQuery({
        queryKey: ['stores', 'dashboard', storeId],
        queryFn: useCallback(() => storeDashboardService.getDashboardData(storeId!), [storeId]),
        enabled: Boolean(storeId),
        staleTime: 30_000,
        gcTime: 0,
    });

    if (gateQuery.isLoading) {
        return (
            <ScreenBackground>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </ScreenBackground>
        );
    }

    if (!isActiveOwner) {
        return (
            <ScreenBackground>
                <View style={styles.container}>
                    <GlassCard padding={20} borderRadius={16}>
                        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Dashboard</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Complete store setup to access the console.
                        </Text>
                    </GlassCard>
                </View>
            </ScreenBackground>
        );
    }

    const data = dashboardQuery.data;

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Store Owner Console</Text>
                <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>{gateState.storeName}</Text>

                {dashboardQuery.isLoading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                ) : data ? (
                    <View style={styles.cardColumn}>
                        <InventoryHealthCard data={data} />
                        <QuotaUsageCard data={data} />
                        <SubscriptionCard data={data} />
                        <PlaceholderCard icon="receipt-outline" title="Order Requests" description="Coming in a future update" colors={colors} />
                        <ComplianceCard data={data} />
                    </View>
                ) : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { padding: 24, paddingBottom: 40 },
    eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
    screenTitle: { fontSize: 26, fontWeight: '800', marginBottom: 16 },
    cardColumn: { gap: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: '800' },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    statItem: { minWidth: 60 },
    statValue: { fontSize: 24, fontWeight: '800' },
    statLabel: { fontSize: 13, fontWeight: '600' },
    warningRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
    quotaColumn: { gap: 10 },
    quotaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    quotaBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    quotaBarFill: { height: 8, borderRadius: 4 },
    quotaText: { fontSize: 13, fontWeight: '700', minWidth: 50, textAlign: 'right' },
});
