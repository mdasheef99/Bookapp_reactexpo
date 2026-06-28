import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { storeOwnerService } from '../services/storeOwnerService';
import type { StoreSetupChecklist } from '../types';

function titleCase(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sellingLabel(value: string) {
    if (value === 'not_allowed') return 'Not allowed';
    return titleCase(value);
}

export default function StoreSetupChecklistScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState = gateQuery.data;
    const storeId = gateState && 'storeId' in gateState ? gateState.storeId : null;
    const [setup, setSetup] = useState<StoreSetupChecklist | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (!storeId) return;

        storeOwnerService.getSetupChecklist(storeId)
            .then((value) => {
                if (isMounted) setSetup(value);
            })
            .catch(() => {
                if (isMounted) setError('Could not load store setup status.');
            });

        return () => {
            isMounted = false;
        };
    }, [storeId]);

    const isBlocked = useMemo(() => {
        return setup?.storeStatus === 'suspended' || setup?.storeStatus === 'selling_restricted';
    }, [setup?.storeStatus]);

    if (gateQuery.isLoading || (!setup && !error)) {
        return (
            <ScreenBackground>
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.accent} size="large" />
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>Store setup</Text>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {setup?.storeName ?? 'Bookstore'}
                </Text>
                {error ? <Text style={[styles.errorText, { color: colors.error ?? '#B91C1C' }]}>{error}</Text> : null}
                {setup ? (
                    <>
                        <GlassCard padding={20} borderRadius={16}>
                            <View style={styles.statusHeader}>
                                <Ionicons
                                    name={isBlocked ? 'lock-closed-outline' : 'clipboard-outline'}
                                    size={22}
                                    color={isBlocked ? colors.error ?? '#B91C1C' : colors.accent}
                                />
                                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                                    {isBlocked ? 'Store access blocked' : 'Setup required before selling'}
                                </Text>
                            </View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Selling starts only after verification, required setup, and entitlement checks are complete.
                            </Text>
                            <Text style={[styles.meta, { color: colors.textPrimary }]}>
                                Selling status: {sellingLabel(setup.sellingStatus)}
                            </Text>
                            <Text style={[styles.meta, { color: colors.textPrimary }]}>
                                Subscription: {titleCase(setup.subscriptionStatus)}
                            </Text>
                        </GlassCard>

                        <View style={styles.checklist}>
                            {setup.checklist.map((item) => (
                                <View key={item.key} style={[styles.itemRow, { borderColor: colors.border }]}>
                                    <Ionicons
                                        name={item.isComplete ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={20}
                                        color={item.isComplete ? '#15803D' : colors.textSecondary}
                                    />
                                    <Text style={[styles.itemText, { color: colors.textPrimary }]}>{item.label}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                ) : null}
            </ScrollView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: 24,
        paddingBottom: 40,
    },
    eyebrow: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 18,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    sectionTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '800',
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 14,
    },
    meta: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },
    checklist: {
        marginTop: 18,
        gap: 10,
    },
    itemRow: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    itemText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
    },
});
