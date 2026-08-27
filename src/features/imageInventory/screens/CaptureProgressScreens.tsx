import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { BatchReviewCard } from '../components/BatchReviewCard';
import { BatchInventoryCommitControls } from '../components/BatchInventoryCommitControls';
import { useInventoryCommitCoordinator } from '../commit/useInventoryCommitCoordinator';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryDiscovery,
    useOwnerInventoryInputs,
} from '../queries/ownerUxQueries';
import {
    useOwnerBatchReview,
    useOwnerSessionV3,
    useRemoveOwnerInventoryCandidate,
} from '../queries/ownerBatchReviewQueries';
import {
    buildCompactReview,
    type CompactReviewEdits,
} from '../review/compactReviewDraft';
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

function countSummaryLine(counts: {
    reviewReadySaved: number;
    processing: number;
    needsAttention: number;
    committed: number;
}): string {
    return [
        `Ready: ${counts.reviewReadySaved}`,
        `Processing: ${counts.processing}`,
        `Needs attention: ${counts.needsAttention}`,
        `Added: ${counts.committed}`,
    ].join(' · ');
}

function SessionProgress({ identity, sessionId }: { identity: ImageInventoryIdentity; sessionId: string }) {
    const router = useRouter();
    const isFocused = useIsFocused();
    // Unit 6 session/input lifecycle authority (read through the retained v3
    // session contract; never the legacy nullable-v2 surface for this runtime).
    const session = useOwnerSessionV3(identity, sessionId);
    const inputs = useOwnerInventoryInputs(identity, sessionId, isFocused);
    // Supplemental 6G candidate/review aggregate authority.
    const batchReview = useOwnerBatchReview(identity, sessionId, isFocused);
    const removeCandidate = useRemoveOwnerInventoryCandidate(identity, sessionId);
    const inventoryCommit = useInventoryCommitCoordinator(identity, sessionId);
    const { isOffline } = useNetworkStatus();
    const { colors } = useTheme();
    const removeMutation = useRemoveOwnerInventoryInput(identity, sessionId);
    const [removeTarget, setRemoveTarget] = useState<{
        inputId: string; ordinal: number; inputVersion: number;
    } | null>(null);
    const [removeMessage, setRemoveMessage] = useState<string | null>(null);
    const [candidateMessage, setCandidateMessage] = useState<string | null>(null);
    const [candidateDrafts, setCandidateDrafts] = useState<Map<string, CompactReviewEdits>>(
        new Map(),
    );
    const pendingRemoval = useRef<RemoveScanInputRequest | null>(null);
    const unavailable = session.data?.status === 'expired' || [session.error, inputs.error].some(
        (error) => error && 'code' in error
            && ['P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'].includes(String(error.code)),
    );
    const loading = session.isLoading || inputs.isLoading;
    // Unit 6 lifecycle errors stay authoritative for the whole-screen error
    // branch; a supplemental batch-review aggregate failure may never suppress
    // or replace Unit 6 and only degrades the compact-review subsection.
    const lifecycleError = session.error || inputs.error;
    const retryableError = !unavailable && Boolean(lifecycleError);
    const aggregateFailed = !unavailable && !loading && !retryableError
        && Boolean(batchReview.error);
    // NEW 6G-C supports ONE current image/input only. Historical multi-input
    // sessions and aggregates whose active-review counts exceed the returned
    // compact projection are unsupported compatibility data: they must fail
    // closed rather than ever present the compact set as complete. No
    // pagination, no multi-image recreation, no hidden-candidate handling.
    const inputCount = inputs.data?.items.length ?? 0;
    const activeReviewCandidates = batchReview.data
        ? batchReview.data.counts.processing
            + batchReview.data.counts.needsAttention
            + batchReview.data.counts.reviewReadySaved
        : 0;
    // counts.detected is the lifetime detected-candidate count. NEW 6G-C
    // support is ONE image with 1..15 books, so a detected count of 16 or
    // more can only come from unsupported historical data UNLESS it has a
    // legitimate current explanation:
    // - detected >= 16 AND no valid current over-limit explanation =>
    //   unsupported historical session => fail closed.
    // - detected >= 16 AND the session's ONE current input is a terminal
    //   failure whose safeCode is P9_VISION_OVER_LIMIT => NOT legacy
    //   overflow: Unit 6 intentionally produced zero candidates and its
    //   existing failure/guidance/replacement path stays authoritative;
    //   this compatibility fence must never mask that lifecycle state.
    // - When an over-limit input is removed/replaced, this predicate
    //   re-evaluates each render: with no live explanation left and
    //   detected still >= 16, the count is unsupportable and fails closed.
    const currentInputs = inputs.data?.items;
    const currentOverLimitFailure = currentInputs?.length === 1
        && currentInputs[0].terminal
        && currentInputs[0].retryState === 'new_upload_required'
        && currentInputs[0].safeCode === 'P9_VISION_OVER_LIMIT';
    const unsupportedLegacyOverflow = !loading && !unavailable && !retryableError
        && (inputCount > 1
            || (batchReview.data !== undefined
                && (activeReviewCandidates > (batchReview.data.items.length ?? 0)
                    || (batchReview.data.counts.detected > 15 && !currentOverLimitFailure))));;
    const refreshScope = `${identity.userId}:${identity.storeId}:${sessionId}:progress`;
    const refreshAll = useCallback(() => coalesceOwnerUxRefresh(refreshScope, async () => {
        if (!isFocused) return false;
        const results = await Promise.all([
            session.refetch(), inputs.refetch(), batchReview.refetch(),
        ]);
        return results.every((result) => !result.isError && result.error === null);
    }), [batchReview.refetch, inputs.refetch, isFocused, refreshScope, session.refetch]);
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
    const handleCandidateRemove = (
        candidateId: string,
        expectedCandidateVersion: number,
    ) => {
        if (isOffline || removeCandidate.isPending) return;
        // SDD U6G-AC11: one candidate has one active command slot. Remove
        // claims the same shared slot as Add/Add-all/Save or fails closed
        // busy without sending a request.
        const slotToken = inventoryCommit.claimSlot(candidateId, 'remove');
        if (!slotToken) {
            setCandidateMessage('That book is busy. Wait for its current action to finish.');
            return;
        }
        removeCandidate.mutate({
            sessionId,
            candidateId,
            expectedCandidateVersion,
            idempotencyKey: createSemanticKey('remove-candidate'),
            commandId: createCaptureUuid(),
        }, {
            onSuccess: () => {
                inventoryCommit.releaseSlot(candidateId, slotToken);
                setCandidateMessage('Book removed from this scan.');
            },
            onError: () => {
                inventoryCommit.releaseSlot(candidateId, slotToken);
                setCandidateMessage(
                    'The book could not be removed. Refresh and try again.',
                );
            },
        });
    };
    const cards = batchReview.data?.items ?? [];
    const setupDefaults = {
        languageHint: batchReview.data?.defaults.languageHint ?? 'en',
        condition: batchReview.data?.defaults.condition ?? null,
        location: batchReview.data?.defaults.location ?? '',
        priceMinor: batchReview.data?.defaults.priceMinor ?? null,
        publication: batchReview.data?.defaults.publication ?? 'private',
        batchLabel: batchReview.data?.batchLabel ?? '',
    };
    const commitDrafts = cards.map((card) => {
        const edits = candidateDrafts.get(card.candidateId) ?? {};
        const review = buildCompactReview(card, setupDefaults, edits);
        return { card, edits, ...(review ? { review } : {}) };
    });

    return (
        <ScreenBackground>
            <FlatList
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 24, gap: 12, flexGrow: 1 }}
                data={!loading && !unavailable && !retryableError && !aggregateFailed
                    && !unsupportedLegacyOverflow ? cards : []}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={5}
                removeClippedSubviews
                keyExtractor={(item) => item.candidateId}
                renderItem={({ item }) => (
                    <BatchReviewCard
                        identity={identity}
                        card={item}
                        defaults={setupDefaults}
                        isOffline={isOffline}
                        canMutate={session.data?.status === 'active' && !isOffline
                            && !inventoryCommit.inFlight.has(item.candidateId)
                            && !inventoryCommit.isCommandActive(item.candidateId)}
                        removePending={removeCandidate.isPending}
                        addPending={inventoryCommit.inFlight.has(item.candidateId)}
                        addOutcome={inventoryCommit.outcomes.get(item.candidateId)}
                        onOpenFullCorrection={() => router.push(inventoryRoutes.candidate(
                            sessionId,
                            item.candidateId,
                        ))}
                        onRemove={(candidateId) => handleCandidateRemove(
                            candidateId, item.candidateVersion,
                        )}
                        onAdd={(card, edits, review) => inventoryCommit.addCandidate({
                            card, edits, review,
                        })}
                        onDraftChange={(candidateId, edits) => {
                            setCandidateDrafts((current) => {
                                const next = new Map(current);
                                if (Object.keys(edits).length === 0) next.delete(candidateId);
                                else next.set(candidateId, edits);
                                return next;
                            });
                        }}
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
                                {aggregateFailed ? (
                                    <View testID="batch-review-degraded" style={{ gap: 8 }}>
                                        <Text
                                            selectable
                                            accessibilityLiveRegion="polite"
                                            style={{ color: colors.error }}
                                        >
                                            Book review could not be loaded right now.
                                        </Text>
                                        <Button
                                            title="Retry book review"
                                            variant="secondary"
                                            onPress={() => { void batchReview.refetch(); }}
                                            disabled={isOffline}
                                        />
                                    </View>
                                ) : unsupportedLegacyOverflow ? (
                                    <View testID="batch-review-unsupported" style={{ gap: 6 }}>
                                        <Text
                                            selectable
                                            accessibilityLiveRegion="polite"
                                            style={{ color: colors.error }}
                                        >
                                            This scan contains more saved books than single-image review supports.
                                        </Text>
                                        <Text selectable style={{ color: colors.textSecondary }}>
                                            Nothing was deleted. The session summary keeps the authoritative status.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {batchReview.data ? (
                                            <>
                                                <Text
                                                    selectable
                                                    accessibilityLiveRegion="polite"
                                                    accessibilityLabel="Book count summary"
                                                    style={{ color: colors.textPrimary, fontWeight: '700' }}
                                                >
                                                    {countSummaryLine(batchReview.data.counts)}
                                                </Text>
                                                <BatchInventoryCommitControls
                                                    candidates={commitDrafts}
                                                    disabled={isOffline || session.data?.status !== 'active'}
                                                    pending={inventoryCommit.bulkPending}
                                                    result={inventoryCommit.bulkResult}
                                                    onAddAll={inventoryCommit.addAll}
                                                    onRetry={inventoryCommit.retryAddAll}
                                                />
                                            </>
                                        ) : null}
                                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>
                                            Books found: {cards.length}
                                        </Text>
                                        {cards[0] ? (
                                            <Button
                                                title="Continue to book review"
                                                variant="secondary"
                                                onPress={() => router.push(inventoryRoutes.candidate(
                                                    sessionId,
                                                    cards[0].candidateId,
                                                ))}
                                            />
                                        ) : null}
                                    </>
                                )}
                                {inputAnnouncement ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{inputAnnouncement}</Text> : null}
                                {removeMessage ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{removeMessage}</Text> : null}
                                {candidateMessage ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>{candidateMessage}</Text> : null}
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
                        {!unsupportedLegacyOverflow ? (
                            <Button
                                title="Add missed book"
                                variant="secondary"
                                onPress={() => router.push(inventoryRoutes.missed(sessionId))}
                                disabled={isOffline || cards.length >= 15}
                                accessibilityHint="Creates one staged manual candidate without running image analysis"
                            />
                        ) : null}
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
