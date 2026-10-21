import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerCorrectionClientError,
    type AddManualCandidateRequest,
} from '../api/ownerCorrectionService';
import { ownerUxService } from '../api/ownerUxService';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import {
    buildMissedBookRequest,
    createEmptyMissedBookDraft,
    missedBookFingerprint,
    type MissedBookDraft,
} from '../review/missedBookForm';
import {
    synchronizeCorrectionCandidate,
    useAddManualCandidate,
    useCorrectionQueryClient,
} from '../queries/ownerCorrectionQueries';
import {
    getResolvedImageInventoryIdentity,
    type ImageInventoryIdentity,
} from '../queries/ownerUxQueries';
import { ownerBatchReviewKeys, useOwnerSessionV3 } from '../queries/ownerBatchReviewQueries';
import { LanguageChooserPanel } from '../components/LanguageChooserPanel';
import { LANGUAGE_OPTIONS } from '../scanSetup/scanSetupForm';
import { OwnerConfirmationDialog } from '../components/OwnerConfirmationDialog';
import { useUnsavedEditsLeaveGuard } from '../review/useUnsavedEditsLeaveGuard';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import { useOwnerUxOfflineGate } from '../offline/ownerUxOfflineGate';

// SDD-1 §6 (4a), AC4-2/3/6/9: initialize the form only from loaded session authority.
const limitText = 'This scan already has 15 books — scan the rest separately.';
function MissedBookForm({ identity, sessionId }: { identity: ImageInventoryIdentity; sessionId: string }) {
    const sessionQuery = useOwnerSessionV3(identity, sessionId);
    const { colors } = useTheme();
    if (sessionQuery.isLoading || (!sessionQuery.data && !sessionQuery.error)) {
        return <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Loading scan session…</Text>;
    }
    if (!sessionQuery.data) {
        return <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>This scan cannot accept another book.</Text>;
    }
    return <LoadedMissedBookForm identity={identity} sessionId={sessionId} sessionQuery={sessionQuery} />;
}

function LoadedMissedBookForm({
    identity,
    sessionId, sessionQuery,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
    sessionQuery: ReturnType<typeof useOwnerSessionV3>;
}) {
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const router = useRouter();
    const client = useCorrectionQueryClient();
    const mutation = useAddManualCandidate(identity);
    const [initial] = useState(() => ({ ...createEmptyMissedBookDraft(sessionQuery.data!.defaults.languageHint), authors: [''] }));
    const [languageOpen, setLanguageOpen] = useState(false);
    const [languageSearch, setLanguageSearch] = useState('');
    const [draft, setDraft] = useState<MissedBookDraft>(initial);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, setPending] = useState<AddManualCandidateRequest | null>(null);
    const pendingRef = useRef<AddManualCandidateRequest | null>(null);
    const [inFlight, setInFlight] = useState(false);
    const inFlightRef = useRef(false);
    const pendingFingerprintRef = useRef<string | null>(null);
    const [committedFingerprint, setCommittedFingerprint] = useState<string | null>(null);
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        return () => { activeScope.current = ''; };
    }, [scope]);
    const semanticDraft = useMemo(() => ({
        ...draft,
        authors: draft.authors.filter((author) => author.trim().length > 0),
    }), [draft]);
    const built = useMemo(() => buildMissedBookRequest(semanticDraft), [semanticDraft]);
    const initialFingerprint = missedBookFingerprint(initial);
    const currentFingerprint = missedBookFingerprint(draft);
    const dirty = currentFingerprint !== (committedFingerprint ?? initialFingerprint);
    const successfulDraft = committedFingerprint === currentFingerprint;
    const refreshAuthority = useCallback(async () => {
        const refreshed = await sessionQuery.refetch();
        return !refreshed.isError
            && refreshed.error === null
            && refreshed.data?.sessionId === sessionId
            && ['active', 'closed'].includes(refreshed.data.status);
    }, [sessionId, sessionQuery.refetch]);
    const gate = useOwnerUxOfflineGate({
        scope,
        isOffline,
        refresh: refreshAuthority,
        hasAuthoritativeData: Boolean(sessionQuery.data && !sessionQuery.error),
        currentAuthorityVerified: sessionQuery.isFetchedAfterMount,
    });

    const busy = inFlight;
    const languageLabel = LANGUAGE_OPTIONS.find((option) => option.value === draft.language)?.label ?? draft.language;
    const leaveGuard = useUnsavedEditsLeaveGuard(dirty, busy, {
        title: 'Leave without adding?', description: pending
            ? 'The book may already have been added. Check the review list before adding it again.'
            : "This book's details exist only on this screen.",
        discardLabel: 'Leave', busyTitle: 'Adding this book',
        busyDescription: 'Wait until the book is added before leaving.',
    });
    const navigated = useRef(false);
    useEffect(() => {
        if (committedFingerprint !== null && !dirty && !busy && !navigated.current) {
            navigated.current = true;
            router.replace(inventoryRoutes.session(sessionId));
        }
    }, [committedFingerprint, dirty, busy, router, sessionId]);

    const run = async (command: AddManualCandidateRequest) => {
        if (!gate.canMutate || inFlightRef.current) return;
        const callScope = activeScope.current;
        const isCurrent = () => activeScope.current === callScope
            && getResolvedImageInventoryIdentity()?.userId === identity.userId
            && getResolvedImageInventoryIdentity()?.storeId === identity.storeId;
        const reportUnclear = async () => {
            if (!isCurrent()) return;
            await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
            if (isCurrent()) setMessage('The result is unclear. Retry the exact same addition.');
        };
        let addSucceeded = false;
        let successfulFingerprint: string | null = null;
        inFlightRef.current = true;
        setInFlight(true);
        setMessage(null);
        try {
            const result = await mutation.mutateAsync(command);
            addSucceeded = true;
            if (!isCurrent()) return;
            if (result.authenticatedUserId !== identity.userId) {
                await reportUnclear();
                return;
            }
            const canonical = await ownerUxService.readCandidate(sessionId, result.candidateId);
            if (activeScope.current !== callScope) return;
            if (
                canonical.sessionId !== sessionId
                || canonical.candidateId !== result.candidateId
            ) {
                await reportUnclear();
                return;
            }
            const synchronized = await synchronizeCorrectionCandidate(
                client, identity, sessionId, result.candidateId, canonical,
            );
            if (!synchronized) {
                await reportUnclear();
                return;
            }
            await client.invalidateQueries({ queryKey: ownerBatchReviewKeys.batchReview(identity, sessionId) });
            if (activeScope.current !== callScope
                || getResolvedImageInventoryIdentity()?.userId !== identity.userId
                || getResolvedImageInventoryIdentity()?.storeId !== identity.storeId) return;
            successfulFingerprint = pendingFingerprintRef.current;
        } catch (error) {
            if (!isCurrent()) return;
            if (addSucceeded || !(error instanceof OwnerCorrectionClientError) || error.code === 'P9_INTERNAL_ERROR') {
                await reportUnclear();
                return;
            }
            if (error instanceof OwnerCorrectionClientError && error.code === 'P9_STATE_CONFLICT') {
                const refreshed = await sessionQuery.refetch();
                if (
                    activeScope.current !== callScope
                    || refreshed.isError
                    || refreshed.error !== null
                    || refreshed.data?.sessionId !== sessionId
                ) setMessage('The latest scan-session state could not be verified.');
                else setMessage(error.message);
                pendingRef.current = null;
                pendingFingerprintRef.current = null;
                setPending(null);
                return;
            }
            pendingRef.current = null;
            pendingFingerprintRef.current = null;
            setPending(null);
            setMessage(error.code === 'P9_LIMIT_EXCEEDED' ? limitText : error.message);
        } finally {
            // SDD-1 §6 / AC4-9: publish success and release the guard in one synchronous block.
            if (successfulFingerprint !== null) {
                setCommittedFingerprint(successfulFingerprint);
                pendingRef.current = null;
                pendingFingerprintRef.current = null;
                setPending(null);
            }
            inFlightRef.current = false;
            setInFlight(false);
        }
    };

    const submit = () => {
        if (!gate.canMutate || !built.success || pendingRef.current || mutation.isPending || successfulDraft) return;
        const command: AddManualCandidateRequest = {
            sessionId,
            ...built.value,
            idempotencyKey: createSemanticKey('missed'),
            commandId: createCaptureUuid(),
        };
        pendingRef.current = command;
        pendingFingerprintRef.current = currentFingerprint;
        setPending(command);
        setLanguageOpen(false);
        void run(command);
    };

    if (sessionQuery.error || !['active', 'closed'].includes(sessionQuery.data!.status)) {
        return <>
            <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>This scan cannot accept another book.</Text>
            {message ? <Text selectable accessibilityLabel={message} accessibilityLiveRegion="polite" style={{ color: colors.error }}>{message}</Text> : null}
            <OwnerConfirmationDialog {...leaveGuard} />
        </>;
    }
    return (
        <ScreenBackground>
            <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>Add a book</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Adds one book to this scan for you to check.</Text>
                <GlassCard padding={16} borderRadius={16}>
                    <View style={{ gap: 10 }}>
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Title (required)</Text>
                        <TextInput testID="missed-title" accessibilityLabel="Title required" value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} editable={!pending} accessibilityState={{ disabled: Boolean(pending) }} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Authors (optional)</Text>
                        {draft.authors.map((author, index) => (
                            <TextInput key={index} testID={`missed-author-${index}`} accessibilityLabel={`Author ${index + 1}`} value={author} onChangeText={(value) => setDraft((current) => ({ ...current, authors: current.authors.map((item, itemIndex) => itemIndex === index ? value : item) }))} editable={!pending} accessibilityState={{ disabled: Boolean(pending) }} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        ))}
                        {draft.authors.length < 20 ? <Button title="Add another author" variant="secondary" onPress={() => setDraft((current) => ({ ...current, authors: [...current.authors, ''] }))} disabled={Boolean(pending)} /> : null}
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Language (required)</Text>
                        <Text selectable accessibilityLabel={`Current language: ${languageLabel}`}
                            style={{ color: colors.textPrimary }}>{languageLabel}</Text>
                        <Button title="Choose language" variant="secondary" disabled={Boolean(pending)}
                            accessibilityState={{ expanded: languageOpen }}
                            onPress={() => { setLanguageSearch(''); setLanguageOpen((open) => !open); }} />
                        {languageOpen ? <LanguageChooserPanel search={languageSearch} onSearchChange={setLanguageSearch}
                            disabled={Boolean(pending)} onSelect={(language) => {
                                setDraft((current) => ({ ...current, language })); setLanguageOpen(false);
                            }} /> : null}
                    </View>
                </GlassCard>
                {!built.success && dirty ? <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error }}>{Object.values(built.errors).join(' ')}</Text> : null}
                {message ? <Text selectable accessibilityLabel={message} accessibilityLiveRegion="polite" style={{ color: colors.error }}>{message}</Text> : null}
                {pending && message ? <Button title="Retry same addition" onPress={() => void run(pending)} disabled={!gate.canMutate || busy} /> : null}
                <Button title="Add book" onPress={submit} loading={mutation.isPending} disabled={!gate.canMutate || mutation.isPending || !built.success || Boolean(pending) || successfulDraft || message === limitText} />
            </ScrollView>
            <OwnerConfirmationDialog {...leaveGuard} />
        </ScreenBackground>
    );
}

export function InventoryMissedBookScreen({ sessionId }: { sessionId: string }) {
    return (
        <InventoryAccessBoundary>
            {(identity) => <MissedBookForm key={`${identity.userId}:${identity.storeId}:${sessionId}`} identity={identity} sessionId={sessionId} />}
        </InventoryAccessBoundary>
    );
}
