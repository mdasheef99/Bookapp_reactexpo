import { useEffect, useRef } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryCandidates,
    useOwnerInventoryDiscovery,
    useOwnerInventoryInputs,
    useOwnerInventorySession,
} from '../queries/ownerUxQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';

function inputLabel(item: { presentationState: string; retryState: string; safeCode: string | null }) {
    if (item.retryState === 'server_retrying') return 'Trying again';
    if (item.retryState === 'new_upload_required') {
        return item.safeCode === 'P9_VISION_OVER_LIMIT'
            ? 'More than 15 books were visible. Take a new photo or add the book manually.'
            : 'Image needs attention. Select a new image.';
    }
    return {
        checking_image: 'Checking image',
        finding_books: 'Finding books',
        ready: 'Image processed',
        needs_attention: 'Image needs attention',
    }[item.presentationState] ?? 'Image status unavailable';
}

function SessionProgress({ identity, sessionId }: { identity: ImageInventoryIdentity; sessionId: string }) {
    const router = useRouter();
    const session = useOwnerInventorySession(identity, sessionId);
    const inputs = useOwnerInventoryInputs(identity, sessionId);
    const candidates = useOwnerInventoryCandidates(identity, {
        scope: 'session',
        sessionId,
        attention: 'all',
    });
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const unavailable = session.data?.status === 'expired' || [session.error, inputs.error].some(
        (error) => error && 'code' in error
            && ['P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'].includes(String(error.code)),
    );
    const loading = session.isLoading || inputs.isLoading;
    const retryableError = !unavailable && (session.error || inputs.error);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (next) => {
            if (next === 'active') {
                void session.refetch();
                void inputs.refetch();
            }
        });
        return () => subscription.remove();
    }, [inputs.refetch, session.refetch]);
    const wasOffline = useRef(isOffline);
    useEffect(() => {
        if (wasOffline.current && !isOffline) {
            void session.refetch();
            void inputs.refetch();
        }
        wasOffline.current = isOffline;
    }, [inputs.refetch, isOffline, session.refetch]);
    useEffect(() => {
        if (inputs.data?.presentationRevision) void candidates.refetch();
    }, [candidates.refetch, inputs.data?.presentationRevision]);

    return (
        <ScreenBackground>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24 }}>
                <GlassCard padding={20} borderRadius={16}>
                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>Scan session</Text>
                    {loading ? (
                        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 8 }}>Loading saved scan progress…</Text>
                    ) : unavailable ? (
                        <>
                            <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>This scan session is unavailable.</Text>
                            <Button title="Return to Inventory" style={{ marginTop: 16 }} onPress={() => router.replace(inventoryRoutes.root())} />
                        </>
                    ) : retryableError ? (
                        <>
                            <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>Saved scan progress could not be loaded.</Text>
                            <Button title="Retry" style={{ marginTop: 16 }} onPress={() => { void session.refetch(); void inputs.refetch(); }} />
                        </>
                    ) : (
                        <>
                            <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>Saved on server. Processing continues if you leave.</Text>
                            <View style={{ gap: 10, marginTop: 16 }}>
                                {inputs.data?.items.map((item) => (
                                    <View key={item.inputId} accessibilityLabel={`Image ${item.ordinal}. ${inputLabel(item)}`} style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
                                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Image {item.ordinal}</Text>
                                        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 4 }}>{inputLabel(item)}</Text>
                                    </View>
                                ))}
                                {!inputs.isLoading && inputs.data?.items.length === 0
                                    ? <Text selectable style={{ color: colors.textSecondary }}>No registered images yet.</Text>
                                    : null}
                            </View>
                            <Text selectable style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 18 }}>
                                Books found: {candidates.data?.items.length ?? 0}
                            </Text>
                            {candidates.data?.items[0] ? (
                                <Button
                                    title="Continue to book review"
                                    variant="secondary"
                                    style={{ marginTop: 12 }}
                                    onPress={() => router.push(inventoryRoutes.candidate(
                                        sessionId,
                                        candidates.data.items[0].candidateId,
                                    ))}
                                />
                            ) : null}
                            {isOffline ? <Text selectable style={{ color: colors.textSecondary, marginTop: 12 }}>Reconnect to add another image.</Text> : null}
                            <Button title="Add another image" style={{ marginTop: 18 }} onPress={() => router.push(inventoryRoutes.scan())} disabled={isOffline || (inputs.data?.items.length ?? 0) >= 15} />
                        </>
                    )}
                </GlassCard>
            </ScrollView>
        </ScreenBackground>
    );
}

export function InventorySessionProgressScreen({ sessionId }: { sessionId: string }) {
    return <InventoryAccessBoundary>{(identity) => <SessionProgress identity={identity} sessionId={sessionId} />}</InventoryAccessBoundary>;
}

export function InventoryHubRecoveryCard({ identity }: { identity: ImageInventoryIdentity }) {
    const router = useRouter();
    const discovery = useOwnerInventoryDiscovery(identity);
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const active = discovery.data?.activeSession;
    return (
        <GlassCard padding={18} borderRadius={16}>
            <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>Scan book spines</Text>
            {discovery.error ? (
                <>
                    <Text selectable style={{ color: colors.textSecondary, marginTop: 6 }}>Saved scan status could not be loaded.</Text>
                    <Button title="Retry scan status" variant="secondary" style={{ marginTop: 14 }} onPress={() => void discovery.refetch()} disabled={isOffline} />
                </>
            ) : (
                <>
                    <Text selectable style={{ color: colors.textSecondary, marginTop: 6 }}>
                        {active ? `${active.inputCount} images · ${active.attentionCount} need attention` : 'Capture or choose a shelf photo.'}
                    </Text>
                    <Button
                        title={active ? 'Resume scan' : 'Start scan'}
                        style={{ marginTop: 14 }}
                        onPress={() => router.push(active ? inventoryRoutes.session(active.sessionId) : inventoryRoutes.scan())}
                        disabled={discovery.isLoading || isOffline || !discovery.data}
                    />
                </>
            )}
        </GlassCard>
    );
}
