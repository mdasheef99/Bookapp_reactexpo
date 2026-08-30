import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { BatchReviewCard } from '../components/BatchReviewCard';
import { BatchInventoryCommitControls } from '../components/BatchInventoryCommitControls';
import { PostScanSessionHeader } from '../components/post-scan-session-header';
import { candidateCanStartBulkCommit } from '../commit/inventoryCommitCoordinator';
import { useInventoryCommitCoordinator } from '../commit/useInventoryCommitCoordinator';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import {
    type ImageInventoryIdentity,
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
import { useCompletedScanAutoClose } from '../close/useCompletedScanAutoClose';
import { useRemoveOwnerInventoryInput } from '../queries/ownerUxInputQueries';
import type { RemoveScanInputRequest } from '../api/ownerUxService';

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
    const [authorityChangedCandidates, setAuthorityChangedCandidates] = useState<Set<string>>(
        new Set(),
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
    // SDD §8: ONE current input; historical/incomplete projections fail closed.
    const inputCount = inputs.data?.items.length ?? 0;
    const activeReviewCandidates = batchReview.data
        ? batchReview.data.counts.processing
            + batchReview.data.counts.needsAttention
            + batchReview.data.counts.reviewReadySaved
        : 0;
    // SDD §8.1: 16+ is unsupported unless the current input carries the
    // inherited over-limit failure:
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
    useEffect(() => {
        setAuthorityChangedCandidates(new Set());
    }, [identity.storeId, identity.userId, sessionId]);
    const inputAnnouncement = inputs.data?.items.length
        ? `Image processing: ${inputs.data.items.filter((item) => item.presentationState === 'ready').length} ready, ${inputs.data.items.filter((item) => item.presentationState === 'needs_attention').length} need attention, ${inputs.data.items.filter((item) => ['checking_image', 'finding_books'].includes(item.presentationState)).length} processing.`
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
    const handleAuthorityStateChange = useCallback((candidateId: string, changed: boolean) => {
        setAuthorityChangedCandidates((current) => {
            if (current.has(candidateId) === changed) return current;
            const next = new Set(current);
            if (changed) next.add(candidateId);
            else next.delete(candidateId);
            return next;
        });
    }, []);
    const showBulkControls = !loading && !unavailable && !retryableError
        && !aggregateFailed && !unsupportedLegacyOverflow
        && (commitDrafts.some((candidate) => candidateCanStartBulkCommit(
            candidate,
            authorityChangedCandidates,
            inventoryCommit.inFlight,
            inventoryCommit.outcomes,
        )) || inventoryCommit.bulkResult !== null);
    const commandsIdle = inventoryCommit.inFlight.size === 0 && !inventoryCommit.bulkPending
        && !removeCandidate.isPending && !removeMutation.isPending;
    const autoClose = useCompletedScanAutoClose({
        identity,
        sessionId,
        session: session.data,
        batch: batchReview.data,
        commandsIdle,
        isOffline,
        isFocused,
    });

    return (
        <ScreenBackground>
            <View style={{ flex: 1 }}>
            <FlatList
                style={{ flex: 1 }}
                contentInsetAdjustmentBehavior="automatic"
                contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16, flexGrow: 1 }}
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
                        onAuthorityStateChange={handleAuthorityStateChange}
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
                    <PostScanSessionHeader
                        loading={loading}
                        unavailable={unavailable}
                        lifecycleFailed={retryableError}
                        aggregateFailed={aggregateFailed}
                        unsupportedOverflow={unsupportedLegacyOverflow}
                        isOffline={isOffline}
                        sessionActive={session.data?.status === 'active'}
                        batch={batchReview.data}
                        inputItems={inputs.data?.items ?? []}
                        firstCandidateId={cards[0]?.candidateId ?? null}
                        inputAnnouncement={inputAnnouncement}
                        removeMessage={removeMessage}
                        candidateMessage={[candidateMessage, autoClose.message]
                            .filter(Boolean).join(' ') || null}
                        removeTarget={removeTarget}
                        removePending={removeMutation.isPending}
                        onReturnToInventory={() => router.replace(inventoryRoutes.root())}
                        onRetryLifecycle={() => { void refreshAll(); }}
                        onRetryReview={() => { void batchReview.refetch(); }}
                        onOpenFirstCandidate={() => {
                            if (cards[0]) router.push(inventoryRoutes.candidate(sessionId, cards[0].candidateId));
                        }}
                        onBeginRemove={beginRemove}
                        onConfirmRemove={confirmRemove}
                        onCancelRemove={() => setRemoveTarget(null)}
                    />
                )}
                ListFooterComponent={!loading && !unavailable && !retryableError ? (
                    <View style={{ gap: 12, paddingTop: 4 }}>
                        {isOffline && (inputs.data?.items.length ?? 0) === 0 ? <Text selectable style={{ color: colors.textSecondary }}>Reconnect to choose a replacement image.</Text> : null}
                        {(inputs.data?.items.length ?? 0) === 0 ? (
                            <Button title="Choose replacement image" onPress={() => router.push(inventoryRoutes.scan())}
                                disabled={isOffline || session.data?.status !== 'active'} />
                        ) : null}
                        <Button title="View session summary" variant="secondary" onPress={() => router.push(inventoryRoutes.summary(sessionId))} />
                        {!unsupportedLegacyOverflow ? (
                            <Button
                                title="Add missed book"
                                variant="secondary"
                                onPress={() => router.push(inventoryRoutes.missed(sessionId))}
                                disabled={isOffline || cards.length >= 15 || session.data?.status !== 'active'}
                                accessibilityHint="Creates one staged manual candidate without running image analysis"
                            />
                        ) : null}
                    </View>
                ) : null}
            />
            {showBulkControls ? (
                <View testID="post-scan-bulk-action" style={{
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    paddingBottom: 16,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: colors.bgPrimary,
                }}>
                    <BatchInventoryCommitControls
                        candidates={commitDrafts}
                        disabled={isOffline || session.data?.status !== 'active'}
                        pending={inventoryCommit.bulkPending}
                        result={inventoryCommit.bulkResult}
                        blockedCandidateIds={authorityChangedCandidates}
                        inFlightCandidateIds={inventoryCommit.inFlight}
                        outcomes={inventoryCommit.outcomes}
                        onAddAll={inventoryCommit.addAll}
                        onRetry={inventoryCommit.retryAddAll}
                    />
                    {batchReview.data && batchReview.data.counts.needsAttention > 0 ? (
                        <Text selectable style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 12 }}>
                            {batchReview.data.counts.needsAttention} book{batchReview.data.counts.needsAttention === 1 ? '' : 's'} will remain in review.
                        </Text>
                    ) : null}
                </View>
            ) : null}
            </View>
        </ScreenBackground>
    );
}

export function InventorySessionProgressScreen({ sessionId }: { sessionId: string }) {
    return <InventoryAccessBoundary>{(identity) => <SessionProgress identity={identity} sessionId={sessionId} />}</InventoryAccessBoundary>;
}

export { InventoryHubRecoveryCard } from '../components/inventory-hub-recovery-card';
