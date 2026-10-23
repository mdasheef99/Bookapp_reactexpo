import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import { buildMissedBookRequest, createEmptyMissedBookDraft, missedBookFingerprint, type MissedBookDraft } from '../review/missedBookForm';
import { ISBN_CHECK_ERROR_TEXT } from '../review/isbn';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import { useOwnerSessionV3 } from '../queries/ownerBatchReviewQueries';
import { missedBookLimitText, useOwnerMissedBookIsbnFlow } from '../queries/ownerMissedBookIsbnFlow';
import { LanguageChooserPanel } from '../components/LanguageChooserPanel';
import { LANGUAGE_OPTIONS } from '../scanSetup/scanSetupForm';
import { OwnerConfirmationDialog } from '../components/OwnerConfirmationDialog';
import { useUnsavedEditsLeaveGuard } from '../review/useUnsavedEditsLeaveGuard';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';
import { useOwnerUxOfflineGate } from '../offline/ownerUxOfflineGate';

// SDD-1 §6 (4a), AC4-2/3/6/9: initialize the form only from loaded session authority.
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

function LoadedMissedBookForm({ identity, sessionId, sessionQuery }: {
    identity: ImageInventoryIdentity; sessionId: string; sessionQuery: ReturnType<typeof useOwnerSessionV3>;
}) {
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const router = useRouter();
    const [initial] = useState(() => ({ ...createEmptyMissedBookDraft(sessionQuery.data!.defaults.languageHint), authors: [''] }));
    const [languageOpen, setLanguageOpen] = useState(false);
    const [languageSearch, setLanguageSearch] = useState('');
    const [draft, setDraft] = useState<MissedBookDraft>(initial);
    const [leaving, setLeaving] = useState(false);
    const [leaveFingerprint, setLeaveFingerprint] = useState<string | null>(null);
    const scope = `${identity.userId}:${identity.storeId}:${sessionId}`;
    const isbnVisible = sessionQuery.data?.status === 'active';
    const semanticDraft = useMemo(() => ({
        ...draft, isbn: isbnVisible ? draft.isbn : '',
        authors: draft.authors.filter((author) => author.trim().length > 0),
    }), [draft, isbnVisible]);
    const built = useMemo(() => buildMissedBookRequest(semanticDraft), [semanticDraft]);
    const formError = !built.success
        ? Object.entries(built.errors).filter(([field]) => field !== 'isbn').map(([, text]) => text).join(' ') : '';
    const refreshAuthority = useCallback(async () => {
        const refreshed = await sessionQuery.refetch();
        return !refreshed.isError && refreshed.error === null && refreshed.data?.sessionId === sessionId
            && ['active', 'closed'].includes(refreshed.data.status);
    }, [sessionId, sessionQuery.refetch]);
    const gate = useOwnerUxOfflineGate({ scope, isOffline, refresh: refreshAuthority,
        hasAuthoritativeData: Boolean(sessionQuery.data && !sessionQuery.error),
        currentAuthorityVerified: sessionQuery.isFetchedAfterMount });
    const flow = useOwnerMissedBookIsbnFlow({ identity, sessionId, canMutate: gate.canMutate, refetchSession: sessionQuery.refetch });
    const { pending, busy, message, addSucceeded, isbnSaved, isbnPressDone, holdOnScreen } = flow;
    const committedFingerprint = leaveFingerprint ?? flow.completedFingerprint;
    const currentFingerprint = missedBookFingerprint(draft);
    const dirty = currentFingerprint !== (committedFingerprint ?? missedBookFingerprint(initial));
    const successfulDraft = committedFingerprint === currentFingerprint;
    const locked = Boolean(pending) || isbnPressDone;
    const languageLabel = LANGUAGE_OPTIONS.find((option) => option.value === draft.language)?.label ?? draft.language;
    const leaveGuard = useUnsavedEditsLeaveGuard(dirty, busy, {
        title: addSucceeded ? 'Leave this screen?' : 'Leave without adding?',
        description: addSucceeded ? isbnSaved
            ? "This book is added and its ISBN is saved, but the search didn't start."
            : "This book is added, but its ISBN isn't saved."
            : pending ? 'The book may already have been added. Check the review list before adding it again.'
                : "This book's details exist only on this screen.",
        discardLabel: 'Leave', busyTitle: 'Adding this book', busyDescription: 'Wait until the book is added before leaving.',
    });
    const navigated = useRef(false);
    useEffect(() => {
        // SDD 01a §15 Owner note / AC5b-7: ISBN outcomes stay until an explicit leave.
        if (committedFingerprint !== null && !dirty && !busy && (!holdOnScreen || leaving) && !navigated.current) {
            navigated.current = true;
            router.replace(inventoryRoutes.session(sessionId));
        }
    }, [committedFingerprint, dirty, busy, holdOnScreen, leaving, router, sessionId]);
    const leaveToReview = () => {
        if (busy) return;
        setLeaving(true); setLeaveFingerprint(currentFingerprint);
    };
    const submit = () => {
        if (!gate.canMutate || !built.success || flow.pendingRef.current || flow.mutationPending || successfulDraft || locked) return;
        flow.start({ sessionId, ...built.value, idempotencyKey: createSemanticKey('missed'), commandId: createCaptureUuid() },
            built.isbn13, currentFingerprint);
        setLanguageOpen(false);
    };

    if ((sessionQuery.error && !holdOnScreen) || !['active', 'closed'].includes(sessionQuery.data!.status)) {
        return <>
            <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>This scan cannot accept another book.</Text>
            {message ? <Text selectable accessibilityLabel={message} accessibilityLiveRegion="polite" style={{ color: colors.error }}>{message}</Text> : null}
            {addSucceeded && message ? <Button title="Leave" onPress={leaveToReview} disabled={busy} /> : null}
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
                        <TextInput testID="missed-title" accessibilityLabel="Title required" value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} editable={!locked} accessibilityState={{ disabled: locked }} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Authors (optional)</Text>
                        {draft.authors.map((author, index) => (
                            <TextInput key={index} testID={`missed-author-${index}`} accessibilityLabel={`Author ${index + 1}`} value={author} onChangeText={(value) => setDraft((current) => ({ ...current, authors: current.authors.map((item, itemIndex) => itemIndex === index ? value : item) }))} editable={!locked} accessibilityState={{ disabled: locked }} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        ))}
                        {draft.authors.length < 20 ? <Button title="Add another author" variant="secondary" onPress={() => setDraft((current) => ({ ...current, authors: [...current.authors, ''] }))} disabled={locked} /> : null}
                        {isbnVisible ? <>
                            <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>ISBN (optional)</Text>
                            <TextInput accessibilityLabel="ISBN" value={draft.isbn} maxLength={17}
                                autoCapitalize="characters" autoCorrect={false}
                                keyboardType={Platform.select({ ios: 'numbers-and-punctuation', default: 'default' })}
                                editable={!locked} accessibilityState={{ disabled: locked }}
                                onChangeText={isbn => setDraft(current => ({ ...current, isbn }))}
                                style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                            <Text selectable style={{ color: colors.textSecondary }}>On the back cover, above or below the barcode</Text>
                            {!built.success && built.errors.isbn ? <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error }}>{ISBN_CHECK_ERROR_TEXT}</Text> : null}
                        </> : null}
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Language (required)</Text>
                        <Text selectable accessibilityLabel={`Current language: ${languageLabel}`} style={{ color: colors.textPrimary }}>{languageLabel}</Text>
                        <Button title="Choose language" variant="secondary" disabled={locked} accessibilityState={{ expanded: languageOpen }}
                            onPress={() => { setLanguageSearch(''); setLanguageOpen((open) => !open); }} />
                        {languageOpen ? <LanguageChooserPanel search={languageSearch} onSearchChange={setLanguageSearch} disabled={locked}
                            onSelect={(language) => { setDraft((current) => ({ ...current, language })); setLanguageOpen(false); }} /> : null}
                    </View>
                </GlassCard>
                {formError && dirty ? <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error }}>{formError}</Text> : null}
                {message ? <Text selectable accessibilityLabel={message} accessibilityLiveRegion="polite" style={{ color: flow.completedFingerprint ? colors.textSecondary : colors.error }}>{message}</Text> : null}
                {pending && message && !addSucceeded ? <Button title="Retry same addition" onPress={flow.retry} disabled={!gate.canMutate || busy} /> : null}
                {pending && message && addSucceeded && flow.retryLabel ? <Button title={flow.retryLabel} onPress={flow.retry} disabled={!gate.canMutate || busy} /> : null}
                {holdOnScreen && message ? <Button title={flow.completedFingerprint ? 'Back to review' : 'Leave'} onPress={leaveToReview} disabled={busy} /> : null}
                <Button title="Add book" onPress={submit} loading={flow.mutationPending} disabled={!gate.canMutate || flow.mutationPending || !built.success || locked || successfulDraft || message === missedBookLimitText} />
            </ScrollView>
            <OwnerConfirmationDialog {...leaveGuard} />
        </ScreenBackground>
    );
}

export function InventoryMissedBookScreen({ sessionId }: { sessionId: string }) {
    return <InventoryAccessBoundary>
        {(identity) => <MissedBookForm key={`${identity.userId}:${identity.storeId}:${sessionId}`} identity={identity} sessionId={sessionId} />}
    </InventoryAccessBoundary>;
}
