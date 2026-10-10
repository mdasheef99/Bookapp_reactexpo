import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useInventoryCommitCoordinator } from '../commit/useInventoryCommitCoordinator';
import { CandidateReviewEditionSheet } from '../components/CandidateReviewEditionSheet';
import { applyEditionSelection } from '../review/editionSelectionDraft';
import { useCandidateLeaveGuard } from '../review/useCandidateLeaveGuard';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { OwnerUxClientError, type UpdateCandidateReviewRequest } from '../api/ownerUxService';
import { createSemanticKey, createCaptureUuid } from '../capture/captureIds';
import { ReviewFormFields } from '../components/ReviewFormFields';
import { AddCandidateToInventoryAction } from '../components/AddCandidateToInventoryAction';
import { CandidateReviewState } from '../components/CandidateReviewState';
import { CandidateConflictPanels } from '../components/CandidateConflictPanels';
import { CandidateCorrectionActions } from '../components/CandidateCorrectionActions';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import {
    candidateConflictChanges,
    isAuthoritativeCandidateRefresh,
    type CandidateConflictState,
} from '../review/candidateConflict';
import {
    buildReviewInput,
    createReviewDraft,
    reviewDraftFingerprint,
    rebaseReviewDraft,
    type ReviewDraft,
} from '../review/reviewForm';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryCandidate,
} from '../queries/ownerUxQueries';
import { useOwnerSessionV3 } from '../queries/ownerBatchReviewQueries';
import { useOwnerEditionChoices } from '../queries/ownerEditionPickerQueries';
import { useUpdateOwnerCandidateReview } from '../queries/ownerUxReviewQueries';
import { useOwnerUxOfflineGate } from '../offline/ownerUxOfflineGate';

const inaccessibleCodes = new Set(['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND']);
const conflictCodes = new Set(['P9_CANDIDATE_VERSION_CONFLICT', 'P9_VERSION_CONFLICT']);
export { InventoryReviewsScreen } from './CandidateListScreen';

export function CandidateReview({
    identity,
    sessionId,
    candidateId,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    candidateId: string;
}) {
    const { colors } = useTheme();
    const commandSlot = useInventoryCommitCoordinator(identity, sessionId);
    const [selectionPending, setSelectionPending] = useState(false);
    const [addPending, setAddPending] = useState(false);
    const [editionFence, setEditionFence] = useState(0);
    const { isOffline } = useNetworkStatus();
    const candidateQuery = useOwnerInventoryCandidate(identity, sessionId, candidateId);
    const editionChoices = useOwnerEditionChoices(identity, sessionId, candidateId);
    // Retained candidate detail stays on its valid v2 contract, while every
    // current Unit 6G session/default dependency uses nullable-safe v3.
    const sessionQuery = useOwnerSessionV3(identity, sessionId);
    const mutation = useUpdateOwnerCandidateReview(identity, sessionId, candidateId, commandSlot);
    const [canonicalOverride, setCanonicalOverride] = useState<OwnerCandidateDetail | null>(null);
    const detail = canonicalOverride ?? candidateQuery.data ?? null;
    const [draft, setDraft] = useState<ReviewDraft | null>(null);
    const [baseFingerprint, setBaseFingerprint] = useState<string | null>(null);
    const [conflict, setConflict] = useState<CandidateConflictState | null>(null);
    const [staleRefreshBase, setStaleRefreshBase] = useState<OwnerCandidateDetail | null>(null);
    const [pendingCommand, setPendingCommand] = useState<UpdateCandidateReviewRequest | null>(null);
    const pendingCommandRef = useRef<UpdateCandidateReviewRequest | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const scopeToken = `${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`;
    const activeScope = useRef(scopeToken);
    useEffect(() => {
        activeScope.current = scopeToken;
        return () => { activeScope.current = ''; };
    }, [scopeToken]);
    useEffect(() => {
        if (!draft && detail && sessionQuery.data && !editionChoices.isLoading) {
            const next = createReviewDraft(detail, sessionQuery.data.defaults, editionChoices.data);
            setDraft(next);
            setBaseFingerprint(reviewDraftFingerprint(next));
        }
    }, [detail, draft, sessionQuery.data, editionChoices.data, editionChoices.isLoading]);
    const build = useMemo(() => draft ? buildReviewInput(draft) : null, [draft]);
    const dirty = Boolean(
        draft
        && baseFingerprint
        && reviewDraftFingerprint(draft) !== baseFingerprint,
    );
    const refreshAuthority = useCallback(async () => {
        const callScope = activeScope.current;
        try {
            const [candidateResult, sessionResult] = await Promise.all([
                candidateQuery.refetch(),
                sessionQuery.refetch(),
            ]);
            if (
                activeScope.current !== callScope
                || !isAuthoritativeCandidateRefresh(candidateResult, sessionId, candidateId)
                || sessionResult.isError
                || sessionResult.error !== null
                || sessionResult.data?.sessionId !== sessionId
            ) {
                if (activeScope.current === callScope) {
                    setMessage('Latest candidate details could not be loaded after reconnect.');
                }
                return false;
            }
            if (dirty && detail) {
                setCanonicalOverride(candidateResult.data);
                setConflict({
                    latest: candidateResult.data,
                    changes: candidateConflictChanges(detail, candidateResult.data),
                });
            } else {
                const next = createReviewDraft(candidateResult.data, sessionResult.data.defaults, editionChoices.data);
                setCanonicalOverride(candidateResult.data);
                setDraft(next);
                setBaseFingerprint(reviewDraftFingerprint(next));
            }
            setMessage(null);
            return true;
        } catch {
            if (activeScope.current === callScope) {
                setMessage('Latest candidate details could not be loaded after reconnect.');
            }
            return false;
        }
    }, [
        candidateId,
        candidateQuery.refetch,
        editionChoices.data,
        detail,
        dirty,
        sessionId,
        sessionQuery.refetch,
    ]);
    const mutationGate = useOwnerUxOfflineGate({
        scope: scopeToken,
        isOffline,
        refresh: refreshAuthority,
        hasAuthoritativeData: Boolean(candidateQuery.data && sessionQuery.data && !candidateQuery.error && !sessionQuery.error),
        currentAuthorityVerified: candidateQuery.isFetchedAfterMount && sessionQuery.isFetchedAfterMount,
    });
    useCandidateLeaveGuard(dirty, mutation.isPending || selectionPending);

    const applyCanonical = (canonical: OwnerCandidateDetail) => {
        if (!sessionQuery.data) return;
        const next = createReviewDraft(canonical, sessionQuery.data.defaults, editionChoices.data);
        setCanonicalOverride(canonical);
        setDraft(next);
        setBaseFingerprint(reviewDraftFingerprint(next));
        setConflict(null);
        setStaleRefreshBase(null);
        setPendingCommand(null);
        pendingCommandRef.current = null;
    };
    const refreshStaleConflict = async (previous: OwnerCandidateDetail) => {
        const callScope = activeScope.current;
        try {
            const refreshed = await candidateQuery.refetch();
            if (activeScope.current !== callScope) return;
            if (!isAuthoritativeCandidateRefresh(refreshed, sessionId, candidateId)) {
                setMessage('Latest candidate details could not be loaded. Retry before saving.');
                return;
            }
            setCanonicalOverride(refreshed.data);
            setConflict({
                latest: refreshed.data,
                changes: candidateConflictChanges(previous, refreshed.data),
            });
            setStaleRefreshBase(null);
            setMessage(null);
        } catch {
            if (activeScope.current !== callScope) return;
            setMessage('Latest candidate details could not be loaded. Retry before saving.');
        }
    };
    const runCommand = async (command: UpdateCandidateReviewRequest) => {
        if (!mutationGate.canMutate) return;
        const callScope = activeScope.current;
        setMessage(null);
        try {
            const canonical = await mutation.mutateAsync(command);
            if (activeScope.current !== callScope) return;
            applyCanonical(canonical);
            setMessage('Review saved');
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (error instanceof OwnerUxClientError && conflictCodes.has(error.code)) {
                setPendingCommand(null);
                pendingCommandRef.current = null;
                const previous = detail;
                if (!previous) return;
                setStaleRefreshBase(previous);
                setMessage(null);
                await refreshStaleConflict(previous);
                return;
            }
            if (error instanceof OwnerUxClientError && error.code === 'P9_INTERNAL_ERROR') {
                setMessage('The save result is unclear. Retry the exact same save.');
                return;
            }
            setPendingCommand(null);
            pendingCommandRef.current = null;
            setMessage(error instanceof OwnerUxClientError
                ? error.message
                : 'The review could not be saved.');
        }
    };
    const save = () => {
        if (
            !detail
            || !build?.success
            || mutation.isPending
            || pendingCommandRef.current
            || !mutationGate.canMutate
        ) return;
        const command: UpdateCandidateReviewRequest = {
            sessionId,
            candidateId,
            expectedCandidateVersion: detail.candidateVersion,
            expectedMetadataRevision: detail.metadata.revision,
            review: build.data,
            idempotencyKey: createSemanticKey('review'),
            commandId: createCaptureUuid(),
        };
        pendingCommandRef.current = command;
        setPendingCommand(command);
        void runCommand(command);
    };
    const loading = candidateQuery.isLoading || sessionQuery.isLoading;
    const queryError = candidateQuery.error ?? sessionQuery.error;
    const unavailable = queryError instanceof OwnerUxClientError
        && inaccessibleCodes.has(queryError.code);
    if (loading) return <CandidateReviewState title="Book review" body="Loading private candidate…" loading />;
    if (unavailable) return <CandidateReviewState title="Book unavailable" body="This private candidate is unavailable." />;
    if (queryError) return <CandidateReviewState title="Book review" body="Candidate details could not be loaded." retry={() => { void candidateQuery.refetch(); void sessionQuery.refetch(); }} />;
    if (!detail) return <CandidateReviewState title="Book unavailable" body="This private candidate is unavailable." />;
    if (!draft || !sessionQuery.data || !build) return <CandidateReviewState title="Book review" body="Preparing the review form…" loading />;
    const reviewable = detail.allowedActions.includes('save_review')
        && ['ready', 'needs_review', 'possible_duplicate'].includes(detail.candidateState);
    const disabled = selectionPending || detail.metadata.revision < editionFence || mutation.isPending
        || Boolean(conflict)
        || Boolean(pendingCommand)
        || Boolean(staleRefreshBase)
        || !mutationGate.canMutate;
    const reapplyConflict = (currentConflict: CandidateConflictState) => {
        setDraft((current) => current
            ? rebaseReviewDraft(current, currentConflict.latest)
            : current);
        setConflict(null);
        setPendingCommand(null);
        pendingCommandRef.current = null;
        setBaseFingerprint(reviewDraftFingerprint(
            createReviewDraft(currentConflict.latest, sessionQuery.data.defaults, editionChoices.data),
        ));
    };
    return (
        <ScreenBackground>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, gap: 16 }}
            >
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>
                    Book {detail.ordinal} · Review
                </Text>
                {isOffline ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>May be out of date</Text> : null}
                {!reviewable ? <Text selectable style={{ color: colors.textSecondary }}>This candidate is read-only.</Text> : null}
                {build.success ? null : (
                    <GlassCard padding={16} borderRadius={16}>
                        <Text selectable accessibilityRole="header" style={{ color: colors.error, fontWeight: '800' }}>Check the highlighted fields</Text>
                        <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error, marginTop: 6 }}>
                            {Object.values(build.errors).join(' ')}
                        </Text>
                    </GlassCard>
                )}
                {reviewable ? <CandidateReviewEditionSheet identity={identity} detail={detail}
                    disabled={disabled || addPending || isOffline} commandSlot={commandSlot}
                    onPendingChange={setSelectionPending}
                    onSelection={(canonical, previousRevision) => {
                        setDraft(current => current ? applyEditionSelection(current, canonical, previousRevision) : current);
                        setEditionFence(canonical.metadataRevision);
                        setCanonicalOverride(null);
                    }}
                    onManual={(edits) => setDraft(current => current ? { ...current,
                        metadataMode: 'manual', selectionId: null,
                        originalFieldConfirmation: {
                            title: edits.originalTitle !== undefined ? false : current.originalFieldConfirmation.title,
                            authors: edits.authors !== undefined ? edits.authors.map(() => false) : current.originalFieldConfirmation.authors,
                        },
                        ...(edits.originalTitle !== undefined ? { originalTitle: edits.originalTitle } : {}),
                        ...(edits.authors !== undefined ? { authors: edits.authors } : {}),
                        ...(edits.originalLanguage !== undefined ? { originalLanguage: edits.originalLanguage } : {}),
                        ...(edits.script !== undefined ? { script: edits.script ?? '' } : {}),
                    } : current)} /> : null}
                <ReviewFormFields detail={detail} draft={draft} errors={build.errors} disabled={disabled || addPending || !reviewable || isOffline} onChange={(next) => { setDraft(next); setMessage(null); }} />
                <CandidateCorrectionActions
                    identity={identity}
                    detail={detail}
                    refetchCandidate={candidateQuery.refetch}
                    onCanonical={setCanonicalOverride}
                    mutationAuthority={mutationGate.canMutate}
                />
                <CandidateConflictPanels
                    staleRefreshBase={staleRefreshBase}
                    conflict={conflict}
                    isOffline={isOffline}
                    onRetry={(base) => void refreshStaleConflict(base)}
                    onUseLatest={applyCanonical}
                    onReapply={reapplyConflict}
                />
                {message ? <Text selectable accessibilityLiveRegion="polite" style={{ color: message === 'Review saved' ? colors.accent : colors.error }}>{message}</Text> : null}
                {pendingCommand && message?.includes('unclear') ? (
                    <View style={{ gap: 10 }}>
                        <Button title="Retry same save" onPress={() => void runCommand(pendingCommand)} disabled={mutation.isPending || isOffline} />
                        <Button title="Resume editing" variant="secondary" onPress={() => {
                            setPendingCommand(null);
                            pendingCommandRef.current = null;
                            setMessage(null);
                        }} disabled={mutation.isPending} />
                    </View>
                ) : null}
                <AddCandidateToInventoryAction
                    identity={identity}
                    detail={detail}
                    disabled={disabled}
                    commandSlot={commandSlot} onPendingChange={setAddPending}
                    hasUnsavedReview={dirty}
                    isOffline={isOffline}
                    refetchCandidate={candidateQuery.refetch}
                />
                <Button
                    title="Save review"
                    loading={mutation.isPending}
                    onPress={save}
                    disabled={addPending || !reviewable || isOffline || !build.success || disabled}
                    accessibilityHint="Saves this staged review only. It does not add inventory."
                />
            </ScrollView>
        </ScreenBackground>
    );
}
