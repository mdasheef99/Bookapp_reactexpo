import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStoreOwnerGate } from '../hooks/useStoreOwnerGate';
import { storeOwnerService } from '../services/storeOwnerService';
import type { StoreOwnerGateState } from '../types';

function routeForGateState(gateState: StoreOwnerGateState) {
    switch (gateState.state) {
        case 'application_draft':
        case 'needs_more_info':
            return '/(store-owner)/onboarding';
        case 'pending_verification':
        case 'selling_restricted':
        case 'suspended':
        case 'rejected':
            return '/(store-owner)/status';
        case 'approved_pending_setup':
            return '/(store-owner)/setup';
        case 'active_owner':
            return '/(store-owner)/inventory';
        default:
            return null;
    }
}

export default function StoreOwnerGateScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const gateQuery = useStoreOwnerGate(user?.id ?? null);
    const gateState: StoreOwnerGateState | undefined = user ? gateQuery.data : { state: 'unauthenticated' };
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    useEffect(() => {
        if (!gateState) return;

        if (gateState.state === 'unauthenticated') {
            router.replace({ pathname: '/(auth)/login', params: { intent: 'store_owner' } });
            return;
        }

        const route = routeForGateState(gateState);
        if (route) router.replace(route);
    }, [gateState]);

    if (gateQuery.isLoading && user) {
        return (
            <ScreenBackground>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            </ScreenBackground>
        );
    }

    if (gateState?.state === 'consumer_only') {
        return (
            <ScreenBackground>
                <View style={styles.container}>
                    <GlassCard padding={24} borderRadius={24}>
                        <View style={styles.iconRow}>
                            <Ionicons name="storefront-outline" size={28} color={colors.accent} />
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Apply as a bookstore</Text>
                        <Text style={[styles.body, { color: colors.textSecondary }]}>
                            Start a bookstore application. Approval and selling access are verified by marketplace records.
                        </Text>
                        {startError ? <Text style={[styles.errorText, { color: colors.error ?? '#B91C1C' }]}>{startError}</Text> : null}
                        <TouchableOpacity
                            style={[styles.primaryAction, { backgroundColor: colors.accent }]}
                            disabled={isStarting}
                            onPress={async () => {
                                setIsStarting(true);
                                setStartError(null);
                                try {
                                    await storeOwnerService.startOrResumeApplication();
                                    router.replace('/(store-owner)/onboarding');
                                } catch {
                                    setStartError('Could not start the store application. Please try again.');
                                } finally {
                                    setIsStarting(false);
                                }
                            }}
                            accessibilityLabel="Start application"
                            accessibilityRole="button"
                        >
                            <Text style={styles.primaryActionText}>{isStarting ? 'Starting...' : 'Start application'}</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    iconRow: {
        alignItems: 'center',
        marginBottom: 16,
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
        marginBottom: 20,
    },
    primaryAction: {
        minHeight: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    primaryActionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    errorText: {
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginBottom: 12,
    },
});
