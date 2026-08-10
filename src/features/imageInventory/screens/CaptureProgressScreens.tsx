import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { CandidateCard } from '../components/CandidateCard';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryCandidates,
    useOwnerInventoryDiscovery,
    useOwnerInventoryInputs,
    useOwnerInventorySession,
} from '../queries/ownerUxQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import { coalesceOwnerUxRefresh } from '../offline/ownerUxOfflineGate';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import { useRemoveOwnerInventoryInput } from '../queries/ownerUxInputQueries';
import type { RemoveScanInputRequest } from '../api/ownerUxService';

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
    const isFocused = useIsFocused();
    const session = useOwnerInventorySession(identity, sessionId);
    const inputs = useOwnerInventoryInputs(identity, sessionId, isFocused);
    const candidates = useOwnerInventoryCandidates(identity, {
        scope: 'session',
        sessionId,
        attention: 'all',
    });
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const removeMutation = useRemoveOwnerInventoryInput(identity, sessionId);
    const [removeTarget, setRemoveTarget] = useState<{
        inputId: string; ordinal: number; inputVersion: number;
    } | null>(null);
    const [removeMessage, setRemoveMessage] = useState<string | null>(null);
    const pendingRemoval = useRef<RemoveScanInputRequest | null>(null);
    const unavailable = session.data?.status === 'expired' || [session.error, inputs.error].some(
        (error) => error && 'code' in error
            && ['P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'].includes(String(error.code)),
    );
    const loading = session.isLoading || inputs.isLoading;
    const retryableError = !unavailable && (session.error || inputs.error || candidates.error);
    const refreshScope = `${identity.userId}:${identity.storeId}:${sessionId}:progress`;
    const refreshAll = useCallback(() => coalesceOwnerUxRefresh(refreshScope, async () => {
        if (!isFocused) return false;
        const results = await Promise.all([session.refetch(), inputs.refetch(), candidates.refetch()]);
        return results.every((result) => !result.isError && result.error === null);
    }), [candidates.refetch, inputs.refetch, isFocused, refreshScope, session.refetch]);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (next) => {
            if (next === 'active' && isFocused) {
                void refreshAll();
            }
        });
        return () => subscription.remove();
    }, [isFocused, refreshAll]);
    const wasOffline = useRef(isOffline);
    useEffect(() => {
        if (wasOffline.current && !isOffline && isFocused) {
            void refreshAll();
        }
        wasOffline.current = isOffline;
    }, [isFocused, isOffline, refreshAll]);
    useEffect(() => {
        if (isFocused && inputs.data?.presentationRevision) void refreshAll();
    }, [inputs.data?.presentationRevision, isFocused, refreshAll]);
    const inputAnnouncement = inputs.data?.items.length
        ? `${inputs.data.items.filter((item) => item.presentationState === 'ready').length} images processed. ${inputs.data.items.filter((item) => item.presentationState === 'needs_attention').length} need attention. ${inputs.data.items.filter((item) => ['checking_image', 'finding_books'].includes(item.presentationState)).length} processing.`
        : null;
    const beginRemove = (target: { inputId: string; ordinal: number; inputVersion: number }) => {
        if (removeMutation.isPending) return;
        if (pendingRemoval.current?.inputId !== target.inputId
            || pendingRemoval.current.expectedInputVersion !== target.inputVersion) {
            pendingRemoval.current = null;
        }
        setRemoveMessage(null);
        setRemoveTarget(target);
    };
    const confirmRemove = () => {
        if (!removeTarget || isOffline || session.data?.status !== 'active' || removeMutation.isPending) return;
        const request = pendingRemoval.current ?? {
            sessionId,
            inputId: removeTarget.inputId,
            expectedInputVersion: removeTarget.inputVersion,
            idempotencyKey: createSemanticKey('remove-input'),
            commandId: createCaptureUuid(),
        };
        pendingRemoval.current = request;
        removeMutation.mutate(request, {
            onSuccess: () => {
                pendingRemoval.current = null;
                setRemoveTarget(null);
                setRemoveMessage(`Image ${removeTarget.ordinal} removed.`);
            },
            onError: () => {
                setRemoveMessage('The image could not be removed. Refresh and try again.');
            },
        });
    };

    return (
        <ScreenBackground>
            <FlatList
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 24, gap: 12, flexGrow: 1 }}
                data={!loading && !unavailable && !retryableError
                    ? candidates.data?.items ?? []
                    : []}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
                keyExtractor={(item) => item.candidateId}
                renderItem={({ item }) => (
                    <CandidateCard
                        candidate={item}
                        onPress={() => router.push(inventoryRoutes.candidate(
                            sessionId,
                            item.candidateId,
                        ))}
                    />
                )}
                ListHeaderComponent={(
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
                            <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.textSecondary, marginTop: 8 }}>Saved scan progress could not be loaded.</Text>
                            <Button title="Retry" style={{ marginTop: 16 }} onPress={() => { void refreshAll(); }} />
                        </>
                    ) : (
                        <>
                            <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>Saved on server. Processing continues if you leave.</Text>
                            <View style={{ gap: 10, marginTop: 16 }}>
                                {inputAnnouncement ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{inputAnnouncement}</Text> : null}
                                {removeMessage ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{removeMessage}</Text> : null}
                                {inputs.data?.items.map((item) => (
                                    <View key={item.inputId} accessibilityLabel={`Image ${item.ordinal}. ${inputLabel(item)}`} style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
                                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Image {item.ordinal}</Text>
                                        <Text selectable style={{ color: colors.textSecondary, marginTop: 4 }}>{inputLabel(item)}</Text>
                                        {removeTarget?.inputId === item.inputId ? (
                                            <View style={{ gap: 8, marginTop: 12 }}>
                                                <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Remove Image {item.ordinal}?</Text>
                                                <Text selectable style={{ color: colors.textSecondary }}>This removes the image from this scan, cancels its processing, and schedules private media cleanup.</Text>
                                                <Button title="Remove image now" onPress={confirmRemove} disabled={isOffline || removeMutation.isPending || session.data?.status !== 'active'} />
                                                <Button title="Cancel" variant="secondary" onPress={() => setRemoveTarget(null)} disabled={removeMutation.isPending} />
                                            </View>
                                        ) : item.acceptedCandidateCount === 0 ? (
                                            <Button
                                                title="Remove image"
                                                variant="secondary"
                                                style={{ marginTop: 10 }}
                                                onPress={() => beginRemove(item)}
                                                disabled={isOffline || removeMutation.isPending || session.data?.status !== 'active'}
                                                accessibilityHint="Removes this uploaded image after confirmation"
                                            />
                                        ) : (
                                            <Text selectable style={{ color: colors.textSecondary, marginTop: 10 }}>Review the books found from this image instead of removing it.</Text>
                                        )}
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
                        </>
                    )}
                    </GlassCard>
                )}
                ListFooterComponent={!loading && !unavailable && !retryableError ? (
                    <View style={{ gap: 12, paddingTop: 4 }}>
                        {isOffline && (inputs.data?.items.length ?? 0) === 0 ? <Text selectable style={{ color: colors.textSecondary }}>Reconnect to choose a replacement image.</Text> : null}
                        {(inputs.data?.items.length ?? 0) === 0 ? (
                            <Button title="Choose replacement image" onPress={() => router.push(inventoryRoutes.scan())} disabled={isOffline} />
                        ) : null}
                        <Button title="View session summary" variant="secondary" onPress={() => router.push(inventoryRoutes.summary(sessionId))} />
                        <Button
                            title="Add missed book"
                            variant="secondary"
                            onPress={() => router.push(inventoryRoutes.missed(sessionId))}
                            disabled={isOffline || (candidates.data?.items.length ?? 0) >= 15}
                            accessibilityHint="Creates one staged manual candidate without running image analysis"
                        />
                    </View>
                ) : null}
            />
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
                    <Button
                        title={`Review books (${discovery.data?.needsReviewCount ?? 0})`}
                        variant="secondary"
                        style={{ marginTop: 10 }}
                        onPress={() => router.push(inventoryRoutes.reviews())}
                        disabled={discovery.isLoading || !discovery.data}
                        accessibilityHint="Opens the bounded needs-review queue"
                    />
                </>
            )}
        </GlassCard>
    );
}
