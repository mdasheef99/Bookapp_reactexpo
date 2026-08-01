import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import type { NavigationAction } from '@react-navigation/native';
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
    useOwnerInventorySession,
} from '../queries/ownerUxQueries';
import { InventoryAccessBoundary } from './InventoryAccessBoundary';

type BeforeRemoveEvent = {
    preventDefault: () => void;
    data: { action: NavigationAction };
};

function MissedBookForm({
    identity,
    sessionId,
}: {
    identity: ImageInventoryIdentity;
    sessionId: string;
}) {
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const navigation = useNavigation();
    const router = useRouter();
    const client = useCorrectionQueryClient();
    const sessionQuery = useOwnerInventorySession(identity, sessionId);
    const mutation = useAddManualCandidate(identity);
    const initial = useMemo(() => ({ ...createEmptyMissedBookDraft(), authors: [''] }), []);
    const [draft, setDraft] = useState<MissedBookDraft>(initial);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, setPending] = useState<AddManualCandidateRequest | null>(null);
    const pendingRef = useRef<AddManualCandidateRequest | null>(null);
    const pendingFingerprintRef = useRef<string | null>(null);
    const committedFingerprintRef = useRef<string | null>(null);
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

    useEffect(() => navigation.addListener('beforeRemove', (event: BeforeRemoveEvent) => {
        const committed = committedFingerprintRef.current ?? initialFingerprint;
        if (missedBookFingerprint(draft) === committed) return;
        event.preventDefault();
        if (mutation.isPending) {
            Alert.alert('Submission in progress', 'Wait for the candidate to be verified before leaving.', [
                { text: 'Stay', style: 'cancel' },
            ]);
            return;
        }
        Alert.alert('Leave without adding?', 'These missed-book details exist only on this screen.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave unsaved', style: 'destructive', onPress: () => navigation.dispatch?.(event.data.action) },
        ]);
    }), [draft, initialFingerprint, mutation.isPending, navigation]);

    const run = async (command: AddManualCandidateRequest) => {
        const callScope = activeScope.current;
        setMessage(null);
        try {
            const result = await mutation.mutateAsync(command);
            if (
                activeScope.current !== callScope
                || result.authenticatedUserId !== identity.userId
                || getResolvedImageInventoryIdentity()?.userId !== identity.userId
                || getResolvedImageInventoryIdentity()?.storeId !== identity.storeId
            ) return;
            const canonical = await ownerUxService.readCandidate(sessionId, result.candidateId);
            if (
                activeScope.current !== callScope
                || canonical.sessionId !== sessionId
                || canonical.candidateId !== result.candidateId
            ) return;
            const synchronized = await synchronizeCorrectionCandidate(
                client, identity, sessionId, result.candidateId, canonical,
            );
            if (!synchronized) return;
            const submittedFingerprint = pendingFingerprintRef.current;
            if (submittedFingerprint) {
                committedFingerprintRef.current = submittedFingerprint;
                setCommittedFingerprint(submittedFingerprint);
            }
            pendingRef.current = null;
            pendingFingerprintRef.current = null;
            setPending(null);
            router.push(`/(store-owner)/inventory/scan/${sessionId}/candidate/${result.candidateId}`);
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (error instanceof OwnerCorrectionClientError && error.code === 'P9_INTERNAL_ERROR') {
                setMessage('The result is unclear. Retry the exact same addition.');
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
            if (!(error instanceof OwnerCorrectionClientError)) {
                setMessage('The result is unclear. Retry the exact same addition.');
                return;
            }
            pendingRef.current = null;
            pendingFingerprintRef.current = null;
            setPending(null);
            setMessage(error.message);
        }
    };

    const submit = () => {
        if (!built.success || pendingRef.current || mutation.isPending || successfulDraft) return;
        const command: AddManualCandidateRequest = {
            sessionId,
            ...built.value,
            idempotencyKey: createSemanticKey('missed'),
            commandId: createCaptureUuid(),
        };
        pendingRef.current = command;
        pendingFingerprintRef.current = currentFingerprint;
        setPending(command);
        void run(command);
    };

    const sessionAvailable = sessionQuery.data
        && ['active', 'closed'].includes(sessionQuery.data.status);
    if (sessionQuery.isLoading) return <Text selectable style={{ color: colors.textSecondary }}>Loading scan session…</Text>;
    if (sessionQuery.error || !sessionAvailable) {
        return <Text selectable style={{ color: colors.error }}>This scan session cannot accept a missed book.</Text>;
    }
    return (
        <ScreenBackground>
            <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '800' }}>Add missed book</Text>
                <Text selectable style={{ color: colors.textSecondary }}>Creates one staged candidate for review. It does not run image or metadata providers and does not create inventory.</Text>
                <GlassCard padding={16} borderRadius={16}>
                    <View style={{ gap: 10 }}>
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Title (required)</Text>
                        <TextInput testID="missed-title" accessibilityLabel="Title required" value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} editable={!mutation.isPending} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Authors (optional)</Text>
                        {draft.authors.map((author, index) => (
                            <TextInput key={index} testID={`missed-author-${index}`} accessibilityLabel={`Author ${index + 1}`} value={author} onChangeText={(value) => setDraft((current) => ({ ...current, authors: current.authors.map((item, itemIndex) => itemIndex === index ? value : item) }))} editable={!mutation.isPending} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        ))}
                        {draft.authors.length < 20 ? <Button title="Add another author" variant="secondary" onPress={() => setDraft((current) => ({ ...current, authors: [...current.authors, ''] }))} disabled={mutation.isPending} /> : null}
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Language (required)</Text>
                        <TextInput testID="missed-language" accessibilityLabel="BCP-47 language required" autoCapitalize="none" value={draft.language} onChangeText={(language) => setDraft((current) => ({ ...current, language }))} editable={!mutation.isPending} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                    </View>
                </GlassCard>
                {!built.success && dirty ? <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error }}>{Object.values(built.errors).join(' ')}</Text> : null}
                {message ? <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error }}>{message}</Text> : null}
                {pending && message ? <Button title="Retry same addition" onPress={() => void run(pending)} disabled={isOffline || mutation.isPending} /> : null}
                <Button title="Add candidate" onPress={submit} loading={mutation.isPending} disabled={isOffline || mutation.isPending || !built.success || Boolean(pending) || successfulDraft} />
            </ScrollView>
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
