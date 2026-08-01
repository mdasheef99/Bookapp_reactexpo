import { useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useNavigation } from 'expo-router';
import type { NavigationAction } from '@react-navigation/native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerCorrectionClientError,
    type DecideVariantRequest,
    type ReplaceVariantRequest,
} from '../api/ownerCorrectionService';
import { createSemanticKey } from '../capture/captureIds';
import type { OwnerVariantReview } from '../contracts/ownerCorrectionSchemas';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { isAuthoritativeCandidateRefresh } from '../review/candidateConflict';
import { variantConflictChanges } from '../review/ownerCorrectionWorkflow';
import {
    synchronizeCorrectionCandidate,
    useCorrectionQueryClient,
    useDecideOwnerVariant,
    useOwnerCandidateVariants,
    useReplaceOwnerVariant,
} from '../queries/ownerCorrectionQueries';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';

type CandidateRefetchResult = {
    data?: OwnerCandidateDetail;
    isError: boolean;
    error: unknown;
};
type PendingVariantCommand =
    | { kind: 'decide'; request: DecideVariantRequest; row: OwnerVariantReview }
    | { kind: 'replace'; request: ReplaceVariantRequest; row: OwnerVariantReview };
type LocalAction = 'approve' | 'reject' | 'replace';
type BeforeRemoveEvent = {
    preventDefault: () => void;
    data: { action: NavigationAction };
};

export function VariantDecisionSheet({
    identity,
    detail,
    refetchCandidate,
    onCanonical,
    onClose,
    mutationAuthority = true,
}: {
    identity: ImageInventoryIdentity;
    detail: OwnerCandidateDetail;
    refetchCandidate: () => Promise<CandidateRefetchResult>;
    onCanonical?: (detail: OwnerCandidateDetail) => void;
    onClose: () => void;
    mutationAuthority?: boolean;
}) {
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const navigation = useNavigation();
    const client = useCorrectionQueryClient();
    const expected = detail.variantSummary.proposalVersions.map((row) => ({
        proposalId: row.proposalId,
        version: row.version,
    }));
    const query = useOwnerCandidateVariants(
        identity, detail.sessionId, detail.candidateId, expected, true,
    );
    const decideMutation = useDecideOwnerVariant(identity);
    const replaceMutation = useReplaceOwnerVariant(identity);
    const [selected, setSelected] = useState<OwnerVariantReview | null>(null);
    const [action, setAction] = useState<LocalAction | null>(null);
    const [replacementText, setReplacementText] = useState('');
    const [replacementLanguage, setReplacementLanguage] = useState('en');
    const [replacementType, setReplacementType] = useState<ReplaceVariantRequest['variantType']>('roman_alternative');
    const [pending, setPending] = useState<PendingVariantCommand | null>(null);
    const pendingRef = useRef<PendingVariantCommand | null>(null);
    const [conflict, setConflict] = useState<{ latest: OwnerVariantReview; changes: string[] } | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const scope = `${identity.userId}:${identity.storeId}:${detail.sessionId}:${detail.candidateId}`;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        return () => { activeScope.current = ''; };
    }, [scope]);

    const pendingState = decideMutation.isPending || replaceMutation.isPending;
    const mutationBlocked = isOffline || !mutationAuthority;
    const replacementDirty = action === 'replace' && selected !== null && (
        replacementText !== selected.proposedText
        || replacementLanguage !== selected.variantLanguage
        || replacementType !== selected.variantType
    );
    const closeSafely = () => {
        if (pendingState) return;
        if (!replacementDirty) {
            onClose();
            return;
        }
        Alert.alert(
            'Leave without saving?',
            'Your unsaved replacement wording exists only in this review sheet.',
            [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave unresolved', style: 'destructive', onPress: onClose },
            ],
        );
    };
    useEffect(() => navigation.addListener('beforeRemove', (event: BeforeRemoveEvent) => {
        if (!replacementDirty && !pendingState) return;
        event.preventDefault();
        if (pendingState) {
            Alert.alert('Decision in progress', 'Wait for the decision to be verified before leaving.', [
                { text: 'Stay', style: 'cancel' },
            ]);
            return;
        }
        Alert.alert('Leave without saving?', 'Your unsaved replacement wording exists only in this review sheet.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave unresolved', style: 'destructive', onPress: () => navigation.dispatch?.(event.data.action) },
        ]);
    }), [navigation, pendingState, replacementDirty]);
    const selectAction = (row: OwnerVariantReview, next: LocalAction) => {
        setSelected(row);
        setAction(next);
        setConflict(null);
        setMessage(null);
        if (next === 'replace') {
            setReplacementText(row.proposedText);
            setReplacementLanguage(row.variantLanguage);
            setReplacementType(row.variantType);
        }
    };

    const refreshProposalConflict = async (previous: OwnerVariantReview) => {
        const callScope = activeScope.current;
        const result = await query.refetch();
        if (activeScope.current !== callScope || result.isError || result.error !== null || !result.data) {
            setMessage('Latest proposal details could not be loaded.');
            return;
        }
        const latest = result.data.find((row) => row.proposalId === previous.proposalId);
        if (!latest) {
            setMessage('This proposal is no longer available.');
            return;
        }
        setConflict({ latest, changes: variantConflictChanges(previous, latest) });
    };

    const finishSuccess = async (proposalId: string) => {
        const callScope = activeScope.current;
        const proposalResult = await query.refetch();
        const candidateResult = await refetchCandidate();
        if (
            activeScope.current !== callScope
            || proposalResult.isError
            || proposalResult.error !== null
            || !proposalResult.data?.some((row) => row.proposalId === proposalId)
            || !isAuthoritativeCandidateRefresh(
                candidateResult, detail.sessionId, detail.candidateId,
            )
        ) {
            setMessage('The latest correction state could not be verified. Refresh before continuing.');
            return;
        }
        const synchronized = await synchronizeCorrectionCandidate(
            client, identity, detail.sessionId, detail.candidateId, candidateResult.data,
        );
        if (!synchronized || activeScope.current !== callScope) return;
        onCanonical?.(candidateResult.data);
        pendingRef.current = null;
        setPending(null);
        setSelected(null);
        setAction(null);
        setConflict(null);
        setMessage('Search wording updated for this store.');
    };

    const run = async (command: PendingVariantCommand) => {
        const callScope = activeScope.current;
        setMessage(null);
        try {
            const result = command.kind === 'decide'
                ? await decideMutation.mutateAsync(command.request)
                : await replaceMutation.mutateAsync(command.request);
            if (activeScope.current !== callScope || result.authenticatedUserId !== identity.userId) return;
            await finishSuccess(command.row.proposalId);
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (
                error instanceof OwnerCorrectionClientError
                && (error.code === 'P9_STALE_VERSION' || error.code === 'P9_VARIANT_SOURCE_MISMATCH')
            ) {
                pendingRef.current = null;
                setPending(null);
                await refreshProposalConflict(command.row);
                return;
            }
            if (error instanceof OwnerCorrectionClientError && error.code === 'P9_INTERNAL_ERROR') {
                setMessage('The result is unclear. Retry the exact same decision.');
                return;
            }
            pendingRef.current = null;
            setPending(null);
            setMessage(error instanceof OwnerCorrectionClientError
                ? error.message
                : 'The search wording decision could not be saved.');
        }
    };

    const dispatch = (row: OwnerVariantReview, selectedAction: LocalAction) => {
        if (pendingRef.current || pendingState || !row.allowedActions.includes(selectedAction)) return;
        const command: PendingVariantCommand = selectedAction === 'replace'
            ? {
                kind: 'replace', row,
                request: {
                    storeId: identity.storeId,
                    sourceProposalId: row.proposalId,
                    expectedVersion: row.version,
                    variantText: replacementText,
                    variantLanguage: replacementLanguage,
                    variantScript: 'Latn',
                    variantType: replacementType,
                    reason: 'owner_replaced',
                    note: null,
                    idempotencyKey: createSemanticKey('variant'),
                },
            }
            : {
                kind: 'decide', row,
                request: {
                    storeId: identity.storeId,
                    proposalId: row.proposalId,
                    expectedVersion: row.version,
                    action: selectedAction,
                    reason: selectedAction === 'approve' ? 'owner_approved' : 'owner_rejected',
                    note: null,
                    idempotencyKey: createSemanticKey('variant'),
                },
            };
        pendingRef.current = command;
        setPending(command);
        void run(command);
    };

    if (query.isLoading) return <Text selectable style={{ color: colors.textSecondary }}>Loading search wording…</Text>;
    if (query.error || !query.data) {
        return (
            <GlassCard padding={16} borderRadius={16}>
                <Text selectable style={{ color: colors.error }}>Search wording is unavailable.</Text>
                <Button title="Retry" onPress={() => { void query.refetch(); }} />
                <Button title="Leave unresolved" variant="secondary" onPress={closeSafely} />
            </GlassCard>
        );
    }
    return (
        <GlassCard padding={16} borderRadius={16}>
            <View accessibilityViewIsModal style={{ gap: 12 }}>
                <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>Search wording review</Text>
                {query.data.map((row) => (
                    <View key={row.proposalId} style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                        <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>
                            {row.targetType === 'title' ? 'Title' : `Author ${Number(row.authorPosition) + 1}`}
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary }}>Original: {row.confirmedSourceText}</Text>
                        <Text selectable style={{ color: colors.textPrimary }}>Suggested: {row.proposedText}</Text>
                        {row.allowedActions.includes('approve') ? <Button title="Approve" onPress={() => { selectAction(row, 'approve'); dispatch(row, 'approve'); }} disabled={mutationBlocked || pendingState} /> : null}
                        {row.allowedActions.includes('reject') ? <Button title="Reject" variant="secondary" onPress={() => { selectAction(row, 'reject'); dispatch(row, 'reject'); }} disabled={mutationBlocked || pendingState} /> : null}
                        {row.allowedActions.includes('replace') ? <Button title="Replace" variant="secondary" onPress={() => selectAction(row, 'replace')} disabled={mutationBlocked || pendingState} /> : null}
                    </View>
                ))}
                {selected && action === 'replace' ? (
                    <View style={{ gap: 8 }}>
                        <TextInput testID="variant-replacement-text" accessibilityLabel="Replacement wording" value={replacementText} onChangeText={setReplacementText} editable={!pendingState} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        <TextInput testID="variant-replacement-language" accessibilityLabel="Replacement language" value={replacementLanguage} onChangeText={setReplacementLanguage} autoCapitalize="none" editable={!pendingState} style={{ color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, padding: 12 }} />
                        <Text selectable style={{ color: colors.textSecondary }}>Script is fixed to Latn. Type: {replacementType}</Text>
                        <View style={{ gap: 6 }}>
                            {(['primary_roman', 'roman_alternative', 'translation_candidate'] as const).map((type) => (
                                <Button key={type} title={type} variant="secondary" onPress={() => setReplacementType(type)} disabled={pendingState} />
                            ))}
                        </View>
                        <Button title="Save replacement" onPress={() => dispatch(selected, 'replace')} disabled={mutationBlocked || pendingState || !replacementText.trim()} />
                    </View>
                ) : null}
                {conflict ? (
                    <View style={{ gap: 8 }}>
                        <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '800' }}>Proposal changed</Text>
                        {conflict.changes.map((change) => <Text selectable key={change} style={{ color: colors.textSecondary }}>{change}</Text>)}
                        <Button title="Use latest" variant="secondary" onPress={() => {
                            setSelected(conflict.latest);
                            setAction(null);
                            setConflict(null);
                            setPending(null);
                            pendingRef.current = null;
                        }} />
                        <Button title="Reapply" onPress={() => {
                            const latest = conflict.latest;
                            const savedAction = action;
                            setConflict(null);
                            if (savedAction) dispatch(latest, savedAction);
                        }} disabled={!action || !conflict.latest.allowedActions.includes(action) || mutationBlocked} />
                    </View>
                ) : null}
                {pending && message ? <Button title="Retry same decision" onPress={() => void run(pending)} disabled={pendingState || mutationBlocked} /> : null}
                {message ? <Text selectable accessibilityLiveRegion="polite" style={{ color: message.includes('updated') ? colors.accent : colors.error }}>{message}</Text> : null}
                <Button title="Leave unresolved" variant="secondary" onPress={closeSafely} disabled={pendingState} />
            </View>
        </GlassCard>
    );
}
