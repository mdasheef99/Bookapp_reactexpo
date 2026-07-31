import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { OwnerUxClientError, type UpdateCandidateReviewRequest } from '../api/ownerUxService';
import { createSemanticKey, createCaptureUuid } from '../capture/captureIds';
import { ReviewFormFields } from '../components/ReviewFormFields';
import { CandidateReviewState } from '../components/CandidateReviewState';
import { CandidateConflictPanels } from '../components/CandidateConflictPanels';
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
    useOwnerInventorySession,
    useUpdateOwnerCandidateReview,
} from '../queries/ownerUxQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';

const inaccessibleCodes = new Set(['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND']);
const conflictCodes = new Set(['P9_CANDIDATE_VERSION_CONFLICT', 'P9_VERSION_CONFLICT']);
export { InventoryReviewsScreen } from './CandidateListScreen';

function CandidateReview({
    identity,
    sessionId,
    candidateId,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    candidateId: string;
}) {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const { isOffline } = useNetworkStatus();
    const candidateQuery = useOwnerInventoryCandidate(identity, sessionId, candidateId);
    const sessionQuery = useOwnerInventorySession(identity, sessionId);
    const mutation = useUpdateOwnerCandidateReview(identity, sessionId, candidateId);
    const [canonicalOverride, setCanonicalOverride] = useState<OwnerCandidateDetail | null>(null);
    const detail = canonicalOverride ?? candidateQuery.data ?? null;
    const [draft, setDraft] = useState<ReviewDraft | null>(null);
    const [baseFingerprint, setBaseFingerprint] = useState<string | null>(null);
    const [conflict, setConflict] = useState<CandidateConflictState | null>(null);
    const [staleRefreshBase, setStaleRefreshBase] = useState<OwnerCandidateDetail | null>(null);
    const [reconnectPending, setReconnectPending] = useState(isOffline);
    const [pendingCommand, setPendingCommand] = useState<UpdateCandidateReviewRequest | null>(null);
    const pendingCommandRef = useRef<UpdateCandidateReviewRequest | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const scopeToken = `${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`;
    const activeScope = useRef(scopeToken);
    useEffect(() => {
        activeScope.current = scopeToken;
        return () => {
            activeScope.current = '';
        };
    }, [scopeToken]);
    useEffect(() => {
        if (!draft && detail && sessionQuery.data) {
            const next = createReviewDraft(detail, sessionQuery.data.defaults);
            setDraft(next);
            setBaseFingerprint(reviewDraftFingerprint(next));
        }
    }, [detail, draft, sessionQuery.data]);
    const build = useMemo(
        () => draft ? buildReviewInput(draft) : null,
        [draft],
    );
    const dirty = Boolean(
        draft
        && baseFingerprint
        && reviewDraftFingerprint(draft) !== baseFingerprint,
    );
    useEffect(() => navigation.addListener('beforeRemove', (event: any) => {
        if (!dirty) return;
        event.preventDefault();
        if (mutation.isPending) {
            Alert.alert(
                'Save in progress',
                'Wait for the review save to finish before leaving.',
                [{ text: 'Stay', style: 'cancel' }],
            );
            return;
        }
        Alert.alert(
            'Leave without saving?',
            'Your unsaved review edits exist only on this screen.',
            [
                { text: 'Stay', style: 'cancel' },
                {
                    text: 'Leave unsaved',
                    style: 'destructive',
                    onPress: () => navigation.dispatch?.(event.data.action),
                },
            ],
        );
    }), [dirty, mutation.isPending, navigation]);

    const applyCanonical = (canonical: OwnerCandidateDetail) => {
        if (!sessionQuery.data) return;
        const next = createReviewDraft(canonical, sessionQuery.data.defaults);
        setCanonicalOverride(canonical);
        setDraft(next);
        setBaseFingerprint(reviewDraftFingerprint(next));
        setConflict(null);
        setStaleRefreshBase(null);
        setReconnectPending(false);
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
    const offlineWas = useRef(isOffline);
    useEffect(() => {
        if (isOffline) {
            setReconnectPending(true);
        } else if (offlineWas.current) {
            const callScope = activeScope.current;
            void (async () => {
                try {
                    const [candidateResult, sessionResult] = await Promise.all([
                        candidateQuery.refetch(),
                        sessionQuery.refetch(),
                    ]);
                    if (activeScope.current !== callScope) return;
                    if (
                        !isAuthoritativeCandidateRefresh(
                            candidateResult,
                            sessionId,
                            candidateId,
                        )
                        || sessionResult.isError
                        || sessionResult.error !== null
                        || sessionResult.data?.sessionId !== sessionId
                    ) {
                        setMessage('Latest candidate details could not be loaded after reconnect.');
                        return;
                    }
                    if (dirty && detail) {
                        setCanonicalOverride(candidateResult.data);
                        setConflict({
                            latest: candidateResult.data,
                            changes: candidateConflictChanges(detail, candidateResult.data),
                        });
                        setReconnectPending(false);
                        setMessage(null);
                        return;
                    }
                    const next = createReviewDraft(
                        candidateResult.data,
                        sessionResult.data.defaults,
                    );
                    setCanonicalOverride(candidateResult.data);
                    setDraft(next);
                    setBaseFingerprint(reviewDraftFingerprint(next));
                    setReconnectPending(false);
                    setMessage(null);
                } catch {
                    if (activeScope.current !== callScope) return;
                    setMessage('Latest candidate details could not be loaded after reconnect.');
                }
            })();
        }
        offlineWas.current = isOffline;
    }, [isOffline]);
    const runCommand = async (command: UpdateCandidateReviewRequest) => {
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
    const disabled = mutation.isPending
        || Boolean(conflict)
        || Boolean(pendingCommand)
        || Boolean(staleRefreshBase)
        || reconnectPending;
    const reapplyConflict = (currentConflict: CandidateConflictState) => {
        setDraft((current) => current
            ? rebaseReviewDraft(current, currentConflict.latest)
            : current);
        setConflict(null);
        setPendingCommand(null);
        pendingCommandRef.current = null;
        setBaseFingerprint(reviewDraftFingerprint(
            createReviewDraft(currentConflict.latest, sessionQuery.data.defaults),
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
                <ReviewFormFields detail={detail} draft={draft} errors={build.errors} disabled={disabled || !reviewable || isOffline} onChange={(next) => { setDraft(next); setMessage(null); }} />
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
                <Button
                    title="Save review"
                    loading={mutation.isPending}
                    onPress={save}
                    disabled={!reviewable || isOffline || !build.success || disabled}
                    accessibilityHint="Saves this staged review only. It does not add inventory."
                />
            </ScrollView>
        </ScreenBackground>
    );
}

export function InventoryCandidateReviewScreen({
    sessionId,
    candidateId,
}: {
    sessionId: string;
    candidateId: string;
}) {
    return (
        <InventoryAccessBoundary>
            {(identity) => (
                <CandidateReview
                    key={`${identity.userId}:${identity.storeId}:${sessionId}:${candidateId}`}
                    identity={identity}
                    sessionId={sessionId}
                    candidateId={candidateId}
                />
            )}
        </InventoryAccessBoundary>
    );
}
