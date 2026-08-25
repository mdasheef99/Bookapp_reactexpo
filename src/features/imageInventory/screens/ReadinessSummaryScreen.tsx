import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { OwnerUxClientError } from '../api/ownerUxService';
import type {
    CloseScanSessionV3Request,
    OwnerSessionSummaryV3,
} from '../api/ownerBatchReviewService';
import type { OwnerSessionReadinessV3 } from '../contracts/ownerBatchReviewContracts';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import { OwnerConfirmationDialog } from '../components/OwnerConfirmationDialog';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { useOwnerUxOfflineGate } from '../offline/ownerUxOfflineGate';
import {
    type ImageInventoryIdentity,
} from '../queries/ownerUxQueries';
import {
    useOwnerBatchReview,
    useOwnerSessionV3,
    useCloseOwnerInventorySessionV3,
} from '../queries/ownerBatchReviewQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';

const summaryLabels: ReadonlyArray<[keyof OwnerSessionReadinessV3['closeSummary'], string]> = [
    ['imagesSubmitted', 'Images submitted'],
    ['imagesProcessed', 'Images processed'],
    ['imagesFailed', 'Images failed'],
    ['imagesSkipped', 'Images skipped'],
    ['candidatesDetected', 'Books detected'],
    ['candidatesReviewReady', 'Books ready'],
    ['candidatesNeedsReview', 'Books needing review'],
    ['candidatesFailed', 'Books failed'],
    ['falseDetections', 'False detections'],
    ['ownerRemovedCandidates', 'Removed from scan'],
    ['manualMissedCandidates', 'Missed books added'],
    ['languageSkips', 'Language skips'],
    ['candidateCapSkips', 'Candidate limit skips'],
    ['qualitySkips', 'Image quality skips'],
    ['committedInventoryItems', 'Committed inventory items'],
    ['quantitiesAddedToExisting', 'Quantities added to existing'],
    ['privateItems', 'Private items'],
    ['publishedItems', 'Published items'],
];

const blockerLabels: Record<keyof OwnerSessionReadinessV3['blockerCounts'], string> = {
    input_processing: 'Image processing', candidate_processing: 'Book processing',
    candidate_failed: 'Book failed', review_missing: 'Review missing',
    title_unconfirmed: 'Title confirmation missing',
    author_confirmation_incomplete: 'Author confirmation incomplete',
    language_missing: 'Language missing', metadata_choice_missing: 'Metadata choice missing',
    quantity_invalid: 'Quantity needs correction', price_invalid: 'Price needs correction',
    condition_missing: 'Condition missing', damage_answer_missing: 'Damage answer missing',
    damage_details_missing: 'Damage details missing', location_missing: 'Shelf location missing',
    publication_intent_missing: 'Publication choice missing',
    duplicate_intent_missing: 'Duplicate choice missing', variant_source_stale: 'Search wording source changed',
};

function Summary({ identity, sessionId }: { identity: ImageInventoryIdentity; sessionId: string }) {
    const { colors } = useTheme();
    const router = useRouter();
    const isFocused = useIsFocused();
    const { isOffline } = useNetworkStatus();
    // NEW 6G-C runtime uses the v3 family exclusively for session/readiness/Close.
    // The batch aggregate is supplemental review presentation only; it can never
    // grant or deny Close, which stays server-authoritative v3 readiness.
    const query = useOwnerSessionV3(identity, sessionId);
    const batchReview = useOwnerBatchReview(identity, sessionId, isFocused);
    const closeMutation = useCloseOwnerInventorySessionV3(identity, sessionId);
    const [canonical, setCanonical] = useState<OwnerSessionReadinessV3 | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const pending = useRef<CloseScanSessionV3Request | null>(null);
    const inFlight = useRef(false);
    const closeTriggerRef = useRef<View>(null);
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        setCanonical(null);
        setConfirmOpen(false);
        pending.current = null;
        inFlight.current = false;
        return () => { activeScope.current = ''; };
    }, [scope]);
    const session = query.data as OwnerSessionSummaryV3 | undefined;
    const refresh = useCallback(async () => {
        const expectedScope = activeScope.current;
        const result = await query.refetch();
        return activeScope.current === expectedScope
            && !result.isError
            && result.error === null
            && result.data?.sessionId === sessionId;
    }, [query.refetch, sessionId]);
    const gate = useOwnerUxOfflineGate({
        scope,
        isOffline,
        refresh,
        hasAuthoritativeData: Boolean(session && !query.error && session.sessionId === sessionId),
        currentAuthorityVerified: query.isFetchedAfterMount,
    });

    const runClose = async (command: CloseScanSessionV3Request) => {
        if (inFlight.current || !gate.canMutate || command.sessionId !== sessionId) return;
        inFlight.current = true;
        const callScope = activeScope.current;
        setMessage(null);
        try {
            const result = await closeMutation.mutateAsync(command);
            if (activeScope.current !== callScope || result.sessionId !== sessionId) return;
            pending.current = null;
            setCanonical(result);
            setConfirmOpen(false);
            setMessage('Session closed. Staged candidates were kept and no inventory was committed.');
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (error instanceof OwnerUxClientError && error.code === 'P9_INTERNAL_ERROR') {
                setMessage('The Close result is unclear. Retry the exact same Close action.');
                return;
            }
            pending.current = null;
            if (error instanceof OwnerUxClientError && ['P9_VERSION_CONFLICT', 'P9_STATE_CONFLICT'].includes(error.code)) {
                setConfirmOpen(false);
                const valid = await refresh();
                setCanonical(null);
                setMessage(valid
                    ? 'The session changed. Review the latest readiness before closing.'
                    : 'Latest readiness could not be verified. Close remains disabled.');
                return;
            }
            setMessage(error instanceof OwnerUxClientError ? error.message : 'The session could not be closed.');
        } finally {
            inFlight.current = false;
        }
    };
    // Pre-close availability derives from server-authoritative v3 closeState;
    // post-close canonical readiness carries the exact closeAllowed verdict.
    const sessionAllowsClose = Boolean(
        session
        && session.status === 'active'
        && session.allInputsTerminal
        && session.closeState === 'closeable',
    );
    const closeAvailable = canonical
        ? canonical.closeAllowed
        : sessionAllowsClose;

    const confirmClose = () => {
        if (!closeAvailable || !gate.canMutate || closeMutation.isPending) return;
        const command = pending.current && pending.current.expectedSessionVersion === session?.sessionVersion
            ? pending.current
            : {
                sessionId,
                expectedSessionVersion: session?.sessionVersion ?? 0,
                idempotencyKey: createSemanticKey('close-session'),
                commandId: createCaptureUuid(),
            };
        pending.current = command;
        void runClose(command);
    };

    const unavailable = query.error instanceof OwnerUxClientError
        && ['P9_AUTH_REQUIRED', 'P9_OWNER_NOT_AUTHORIZED', 'P9_NOT_FOUND'].includes(query.error.code);
    const authoritativeError = Boolean(query.error);
    const closeSummary = canonical?.closeSummary ?? session?.closeSummary ?? null;
    const allZero = closeSummary
        ? summaryLabels.every(([key]) => closeSummary[key] === 0)
        : false;
    const blockers = Object.entries(canonical?.blockerCounts ?? {})
        .filter(([, count]) => count > 0);
    // Pre-close review blockers are presentation composed from the
    // supplemental aggregate; they never substitute for v3 readiness.
    const preCloseCards = canonical || batchReview.error || !batchReview.data
        ? []
        : batchReview.data.items;
    const preCloseBlockers = useMemo(() => {
        const counts = new Map<string, { count: number; candidateId: string }>();
        for (const card of preCloseCards) {
            for (const blocker of card.blockers) {
                const existing = counts.get(blocker.code);
                counts.set(blocker.code, {
                    count: (existing?.count ?? 0) + 1,
                    candidateId: existing?.candidateId ?? blocker.candidateId ?? card.candidateId,
                });
            }
        }
        return [...counts.entries()];
    }, [preCloseCards]);
    const aggregateDegraded = Boolean(batchReview.error) && !canonical;

    return (
        <ScreenBackground>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 14 }}>
                <GlassCard padding={20} borderRadius={16}>
                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>
                        Session summary
                    </Text>
                    {query.isLoading && !session ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
                    {unavailable ? <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error, marginTop: 10 }}>This private scan session is unavailable.</Text> : null}
                    {authoritativeError && !unavailable ? (
                        <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error, marginTop: 10 }}>
                            Current readiness could not be verified. Close remains disabled.
                        </Text>
                    ) : null}
                    {session ? (
                        <>
                            <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 10 }}>
                                Session state: {canonical?.sessionStatus ?? session.status}
                            </Text>
                            {allZero ? <Text selectable style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 12 }}>No images or books yet</Text> : null}
                            <View accessibilityRole="summary" style={{ gap: 7, marginTop: 14 }}>
                                {summaryLabels.map(([key, label]) => (
                                    <Text selectable key={key} style={{ color: colors.textSecondary }}>{label}: {closeSummary ? closeSummary[key] : 0}</Text>
                                ))}
                            </View>
                            {blockers.length ? (
                                <View style={{ gap: 7, marginTop: 16 }}>
                                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '800' }}>Attention needed</Text>
                                    {blockers.map(([key, count]) => <Text selectable key={key} style={{ color: colors.textSecondary }}>{blockerLabels[key as keyof typeof blockerLabels]}: {count}</Text>)}
                                </View>
                            ) : null}
                            {!canonical && (session.status === 'active' || session.status === 'closing') ? (
                                aggregateDegraded ? (
                                    <View style={{ gap: 8, marginTop: 16 }}>
                                        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>
                                            Book review status could not be loaded.
                                        </Text>
                                        <Button
                                            title="Retry book review"
                                            variant="secondary"
                                            onPress={() => { void batchReview.refetch(); }}
                                            disabled={isOffline}
                                        />
                                    </View>
                                ) : preCloseBlockers.length ? (
                                    <View testID="pre-close-review-blockers" style={{ gap: 7, marginTop: 16 }}>
                                        <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '800' }}>Needs attention before Close</Text>
                                        {preCloseBlockers.map(([code, entry]) => (
                                            <Text selectable key={code} style={{ color: colors.textSecondary }}>
                                                {blockerLabels[code as keyof typeof blockerLabels] ?? code}: {entry.count}
                                            </Text>
                                        ))}
                                        <Button
                                            title="Review next blocker"
                                            variant="secondary"
                                            style={{ marginTop: 4 }}
                                            onPress={() => router.push(inventoryRoutes.candidate(
                                                sessionId,
                                                preCloseBlockers[0][1].candidateId,
                                            ))}
                                        />
                                    </View>
                                ) : null
                            ) : null}
                            {!(canonical?.allInputsTerminal ?? session.allInputsTerminal) ? (
                                <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 16 }}>
                                    Some images are still processing
                                </Text>
                            ) : null}
                            {canonical?.nextBlockingCandidateId ? (
                                <Button title="Review next blocker" variant="secondary" style={{ marginTop: 14 }} onPress={() => router.push(inventoryRoutes.candidate(sessionId, canonical.nextBlockingCandidateId!))} />
                            ) : null}
                            {!closeAvailable ? (
                                <Button title="Refresh processing status" variant="secondary" style={{ marginTop: 12 }} onPress={() => { void refresh(); }} disabled={isOffline || query.isFetching} />
                            ) : null}
                            {closeAvailable ? (
                                <Pressable
                                    ref={closeTriggerRef}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close session"
                                    accessibilityHint="Ends capture and review activity. Does not commit inventory or discard candidates."
                                    accessibilityState={{ disabled: !gate.canMutate || closeMutation.isPending || authoritativeError }}
                                    disabled={!gate.canMutate || closeMutation.isPending || authoritativeError}
                                    onPress={() => setConfirmOpen(true)}
                                    style={{ minHeight: 52, marginTop: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: colors.error }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '800' }}>Close session</Text>
                                </Pressable>
                            ) : null}
                            {(canonical?.sessionStatus ?? session.status) === 'closed' ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textPrimary, fontWeight: '700', marginTop: 14 }}>Session closed</Text> : null}
                        </>
                    ) : null}
                    {gate.isOffline ? <Text selectable style={{ color: colors.error, marginTop: 12 }}>Offline · summary is read-only and may be out of date.</Text> : null}
                    {gate.isRefreshingAuthority ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 12 }}>Refreshing current readiness before actions are enabled.</Text> : null}
                    {message ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, marginTop: 12 }}>{message}</Text> : null}
                </GlassCard>
                <OwnerConfirmationDialog
                    visible={confirmOpen}
                    title="Close this scan session?"
                    description="Close ends capture and review activity. It does not commit inventory, publish books, delete candidates, or discard staged work."
                    confirmLabel={pending.current && message?.includes('unclear') ? 'Retry exact Close' : 'Close session'}
                    pending={closeMutation.isPending}
                    onCancel={() => setConfirmOpen(false)}
                    onConfirm={confirmClose}
                    restoreFocusRef={closeTriggerRef}
                />
            </ScrollView>
        </ScreenBackground>
    );
}

export function InventoryReadinessSummaryScreen({ sessionId }: { sessionId: string }) {
    return <InventoryAccessBoundary>{(identity) => <Summary identity={identity} sessionId={sessionId} />}</InventoryAccessBoundary>;
}
