import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { PostScanFooter, PostScanBulkAction } from '../components/PostScanInventoryActions';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { BatchReviewCard } from '../components/BatchReviewCard';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import { PostScanSessionHeader } from '../components/post-scan-session-header';
import { DuplicateInputConfirmationDialog } from '../components/DuplicateInputConfirmationDialog';
import { candidateCanStartBulkCommit } from '../commit/inventoryCommitCoordinator';
import { candidateCanStartCommit, candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import { cardAttentionItems, cardReadyNow } from '../components/batchReviewStatus';
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
    validateCompactReview,
    type CompactReviewEdits,
} from '../review/compactReviewDraft';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import { coalesceOwnerUxRefresh } from '../offline/ownerUxOfflineGate';
import { createScanCandidateRemoval } from '../review/scanCandidateRemoval';
import { useCompletedScanAutoClose } from '../close/useCompletedScanAutoClose';
import { useDuplicateInputConfirmation } from '../capture/useDuplicateInputConfirmation';
import { useUnsavedEditsLeaveGuard } from '../review/useUnsavedEditsLeaveGuard';
import { OwnerConfirmationDialog } from '../components/OwnerConfirmationDialog';
import { useInputRemoval } from '../capture/useInputRemoval';
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
    const removal = useInputRemoval({ identity, sessionId,
        sessionActive: session.data?.status === 'active', isOffline });
    const [candidateMessage, setCandidateMessage] = useState<string | null>(null);
    const [editionPending, setEditionPending] = useState<Set<string>>(new Set());
    const editionScope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const [editionChoices, setEditionChoices] = useState<{ scope: string; values: Map<string, EditionChoices> }>({
        scope: editionScope, values: new Map(),
    });
    const handleEditionChoices = useCallback((choices: EditionChoices) => {
        setEditionChoices(current => {
            const values = current.scope === editionScope ? current.values : new Map<string, EditionChoices>();
            if (values.get(choices.candidateId) === choices) return current;
            const next = new Map(values); next.set(choices.candidateId, choices);
            return { scope: editionScope, values: next };
        });
    }, [editionScope]);
    const handleEditionPending = useCallback((id: string, pending: boolean) => {
        setEditionPending(current => {
            const next = new Set(current); if (pending) next.add(id); else next.delete(id); return next;
        });
    }, []);
    const [candidateDrafts, setCandidateDrafts] = useState<Map<string, {
        edits: CompactReviewEdits; acceptedAuthorityKey: string;
    }>>(
        new Map(),
    );
    const [pendingIdentityAuthorities, setPendingIdentityAuthorities] = useState<Map<string, string>>(
        new Map(),
    );
    const [authorityChangedCandidates, setAuthorityChangedCandidates] = useState<Set<string>>(
        new Set(),
    );
    const [dirtyCandidates, setDirtyCandidates] = useState<Set<string>>(new Set());
    const handleUnsavedEditsChange = useCallback((id: string, dirty: boolean) => {
        setDirtyCandidates(current => {
            if (current.has(id) === dirty) return current;
            const next = new Set(current); if (dirty) next.add(id); else next.delete(id); return next;
        });
    }, []);
    const cards = batchReview.data?.items ?? [];
    // SDD-1 §4: only active review cards contribute unsaved edits.
    const dirty = cards.some((card) => card.candidateState !== 'committed'
        && inventoryCommit.outcomes.get(card.candidateId)?.status !== 'succeeded'
        && (candidateDrafts.has(card.candidateId) || dirtyCandidates.has(card.candidateId)));
    const leaveGuard = useUnsavedEditsLeaveGuard(dirty, inventoryCommit.inFlight.size > 0 || editionPending.size > 0, {
        title: 'Leave without saving?', description: 'Your card edits are not saved and will be discarded.',
        discardLabel: 'Leave and discard', busyTitle: 'Add in progress',
        busyDescription: 'Wait for Add to finish before leaving.',
    });
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
    const duplicateConfirmation = useDuplicateInputConfirmation({
        identity, sessionId, inputs: currentInputs,
        sessionActive: session.data?.status === 'active', isOffline,
        onMessage: removal.setMessage,
    });
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
        setEditionPending(new Set());
        setAuthorityChangedCandidates(new Set());
        setPendingIdentityAuthorities(new Map());
    }, [identity.storeId, identity.userId, sessionId]);
    const inputAnnouncement = inputs.data?.items.length
        ? `Image processing: ${inputs.data.items.filter((item) => item.presentationState === 'ready').length} ready, ${inputs.data.items.filter((item) => item.presentationState === 'needs_attention').length} need attention, ${inputs.data.items.filter((item) => ['checking_image', 'finding_books'].includes(item.presentationState)).length} processing.`
        : null;
    const handleCandidateRemove = createScanCandidateRemoval({ sessionId, isOffline,
        removeCandidate, inventoryCommit, setCandidateMessage });
    const setupDefaults = {
        languageHint: batchReview.data?.defaults.languageHint ?? 'en',
        condition: batchReview.data?.defaults.condition ?? null,
        location: batchReview.data?.defaults.location ?? '',
        priceMinor: batchReview.data?.defaults.priceMinor ?? null,
        publication: batchReview.data?.defaults.publication ?? 'private',
        batchLabel: batchReview.data?.batchLabel ?? '',
    };
    const attentionCandidateIds = new Set<string>();
    const commitDrafts = cards.map((card) => {
        const savedDraft = candidateDrafts.get(card.candidateId);
        const edits = savedDraft?.edits ?? {};
        const validation = validateCompactReview(card, setupDefaults, edits,
            editionChoices.scope === editionScope ? editionChoices.values.get(card.candidateId) : undefined);
        const draft = { card, edits, ...(validation.review ? { review: validation.review } : {}),
            acceptedAuthorityKey: pendingIdentityAuthorities.get(card.candidateId)
                ?? savedDraft?.acceptedAuthorityKey ?? candidateCommitAuthorityKey(card) };
        // Same attention rule as the card badge (cardReadyNow): such cards are neither Ready nor in Add all.
        const attentionCount = cardAttentionItems({
            card, hasEdits: Object.keys(edits).length > 0, validationIssues: validation.issues,
            draftSubmittable: candidateCanStartCommit(draft),
        }).length;
        if (!cardReadyNow(card, true, attentionCount)) attentionCandidateIds.add(card.candidateId);
        return draft;
    });
    const blockedCandidateIds = new Set([
        ...authorityChangedCandidates, ...pendingIdentityAuthorities.keys(), ...editionPending,
        ...attentionCandidateIds,
    ]);
    const succeededCandidateIds = new Set(inventoryCommit.bulkResult?.outcomes
        .filter((outcome) => outcome.status === 'succeeded')
        .map((outcome) => outcome.candidateId) ?? []);
    const successesStillInReview = cards.filter((card) => succeededCandidateIds.has(card.candidateId)
        && card.candidateState !== 'committed').length;
    const remainingReviewCount = Math.max(0, activeReviewCandidates - successesStillInReview);
    const handleAuthorityStateChange = useCallback((candidateId: string, changed: boolean) => {
        setAuthorityChangedCandidates((current) => {
            if (current.has(candidateId) === changed) return current;
            const next = new Set(current);
            if (changed) next.add(candidateId);
            else next.delete(candidateId);
            return next;
        });
    }, []);
    const handlePendingIdentityChange = useCallback((candidateId: string, active: boolean,
        acceptedAuthorityKey: string) => {
        setPendingIdentityAuthorities((current) => {
            const next = new Map(current);
            if (active) next.set(candidateId, acceptedAuthorityKey);
            else next.delete(candidateId);
            return next;
        });
    }, []);
    // One readiness rule for the header's Ready count, the card badges and Add all ready books.
    const readyCandidateIds = new Set(commitDrafts.filter((candidate) => candidateCanStartBulkCommit(
        candidate,
        blockedCandidateIds,
        inventoryCommit.inFlight,
        inventoryCommit.outcomes,
    )).map((candidate) => candidate.card.candidateId));
    // Counted per card so an in-flight or just-added book is in neither bucket.
    const reviewCounts = {
        ready: readyCandidateIds.size,
        needReview: cards.filter((card) => !['processing', 'commit_in_progress', 'committed'].includes(card.candidateState)
            && !readyCandidateIds.has(card.candidateId)
            && !inventoryCommit.inFlight.has(card.candidateId)
            && inventoryCommit.outcomes.get(card.candidateId)?.status !== 'succeeded').length,
    };
    const showBulkControls = !loading && !unavailable && !retryableError
        && !aggregateFailed && !unsupportedLegacyOverflow
        && (reviewCounts.ready > 0 || inventoryCommit.bulkPending || inventoryCommit.bulkResult !== null);
    const commandsIdle = editionPending.size === 0 && inventoryCommit.inFlight.size === 0 && !inventoryCommit.bulkPending
        && !removeCandidate.isPending && !removal.isPending && !duplicateConfirmation.isPending;
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
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: showBulkControls ? 36 : 24,
                    gap: 16,
                    flexGrow: 1,
                }}
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
                        commandSlot={inventoryCommit}
                        onEditionPendingChange={handleEditionPending}
                        onEditionChoices={handleEditionChoices}
                        onEditionSelection={() => { void batchReview.refetch(); }}
                        onAuthorityStateChange={handleAuthorityStateChange}
                        onPendingIdentityChange={handlePendingIdentityChange}
                        onUnsavedEditsChange={handleUnsavedEditsChange}
                        onOpenFullCorrection={() => router.push(inventoryRoutes.candidate(
                            sessionId,
                            item.candidateId,
                        ))}
                        onRemove={(candidateId) => handleCandidateRemove(
                            candidateId, item.candidateVersion,
                        )}
                        onAdd={(card, edits, review) => inventoryCommit.addCandidate({
                            card, edits, review,
                            acceptedAuthorityKey: candidateCommitAuthorityKey(card),
                        })}
                        onDraftChange={(candidateId, edits, acceptedAuthorityKey) => {
                            setCandidateDrafts((current) => {
                                const next = new Map(current);
                                if (Object.keys(edits).length === 0) next.delete(candidateId);
                                else next.set(candidateId, {
                                    edits, acceptedAuthorityKey: acceptedAuthorityKey ?? candidateCommitAuthorityKey(item),
                                });
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
                        reviewCounts={session.data?.status === 'active' ? reviewCounts : undefined}
                        inputItems={inputs.data?.items ?? []}
                        inputAnnouncement={inputAnnouncement}
                        removeMessage={removal.message}
                        candidateMessage={[candidateMessage, autoClose.message]
                            .filter(Boolean).join(' ') || null}
                        removeTarget={removal.target}
                        removePending={removal.isPending}
                        onReturnToInventory={() => router.replace(inventoryRoutes.root())}
                        onRetryLifecycle={() => { void refreshAll(); }}
                        onRetryReview={() => { void batchReview.refetch(); }}
                        onBeginRemove={removal.begin}
                        onConfirmRemove={removal.confirm}
                        onCancelRemove={removal.cancel}
                        onReviewDuplicate={duplicateConfirmation.review}
                    />
                )}
                ListFooterComponent={!loading && !unavailable && !retryableError ? (
                    <PostScanFooter sessionId={sessionId} isOffline={isOffline}
                        active={session.data?.status === 'active'} inputCount={inputs.data?.items.length ?? 0}
                        cardCount={cards.length} overflow={unsupportedLegacyOverflow} />
                ) : null}
            />
            {showBulkControls ? (
                <PostScanBulkAction candidates={commitDrafts} inventoryCommit={inventoryCommit}
                    disabled={isOffline || session.data?.status !== 'active'}
                    remainingReviewCount={remainingReviewCount} blockedCandidateIds={blockedCandidateIds} />
            ) : null}
            <DuplicateInputConfirmationDialog
                visible={duplicateConfirmation.visible}
                pending={duplicateConfirmation.isPending}
                onDismiss={duplicateConfirmation.dismiss}
                onCancelUpload={duplicateConfirmation.cancel}
                onProceed={duplicateConfirmation.proceed}
            />
            <OwnerConfirmationDialog {...leaveGuard} />
            </View>
        </ScreenBackground>
    );
}
export function InventorySessionProgressScreen({ sessionId }: { sessionId: string }) {
    return <InventoryAccessBoundary>{(identity) => <SessionProgress identity={identity} sessionId={sessionId} />}</InventoryAccessBoundary>;
}

export { InventoryHubRecoveryCard } from '../components/inventory-hub-recovery-card';
