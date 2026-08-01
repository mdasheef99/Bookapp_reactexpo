import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import {
    OwnerCorrectionClientError,
    type MarkFalseRequest,
} from '../api/ownerCorrectionService';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { isAuthoritativeCandidateRefresh } from '../review/candidateConflict';
import { canMarkCandidateFalse, canOpenVariantReview } from '../review/ownerCorrectionWorkflow';
import {
    synchronizeCorrectionCandidate,
    useCorrectionQueryClient,
    useMarkCandidateFalse,
} from '../queries/ownerCorrectionQueries';
import {
    getResolvedImageInventoryIdentity,
    type ImageInventoryIdentity,
} from '../queries/ownerUxQueries';
import { VariantDecisionSheet } from './VariantDecisionSheet';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';

type CandidateRefetchResult = {
    data?: OwnerCandidateDetail;
    isError: boolean;
    error: unknown;
};

export function CandidateCorrectionActions({
    identity,
    detail,
    refetchCandidate,
    onCanonical,
    mutationAuthority = true,
}: {
    identity: ImageInventoryIdentity;
    detail: OwnerCandidateDetail;
    refetchCandidate: () => Promise<CandidateRefetchResult>;
    onCanonical?: (detail: OwnerCandidateDetail) => void;
    mutationAuthority?: boolean;
}) {
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const client = useCorrectionQueryClient();
    const mutation = useMarkCandidateFalse(identity);
    const pendingRef = useRef<MarkFalseRequest | null>(null);
    const falseTriggerRef = useRef<View>(null);
    const [pending, setPending] = useState<MarkFalseRequest | null>(null);
    const [latest, setLatest] = useState<OwnerCandidateDetail | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [variantOpen, setVariantOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const scope = `${identity.userId}:${identity.storeId}:${detail.sessionId}:${detail.candidateId}`;
    const canMutate = !isOffline && mutationAuthority;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        return () => { activeScope.current = ''; };
    }, [scope]);

    const authoritativeRefresh = useCallback(async () => {
        const callScope = activeScope.current;
        const refreshed = await refetchCandidate();
        if (
            activeScope.current !== callScope
            || !isAuthoritativeCandidateRefresh(refreshed, detail.sessionId, detail.candidateId)
        ) return null;
        return refreshed.data;
    }, [detail.candidateId, detail.sessionId, refetchCandidate]);

    const runFalse = async (command: MarkFalseRequest) => {
        if (!canMutate) return;
        const callScope = activeScope.current;
        setMessage(null);
        try {
            const result = await mutation.mutateAsync(command);
            if (
                activeScope.current !== callScope
                || result.authenticatedUserId !== identity.userId
                || result.candidateId !== detail.candidateId
                || getResolvedImageInventoryIdentity()?.userId !== identity.userId
                || getResolvedImageInventoryIdentity()?.storeId !== identity.storeId
            ) return;
            const canonical = await authoritativeRefresh();
            if (!canonical) {
                setMessage('The latest candidate could not be verified. Retry the exact same action.');
                return;
            }
            const synchronized = await synchronizeCorrectionCandidate(
                client, identity, detail.sessionId, detail.candidateId, canonical,
            );
            if (!synchronized || activeScope.current !== callScope) return;
            onCanonical?.(canonical);
            pendingRef.current = null;
            setPending(null);
            setLatest(null);
            setConfirmOpen(false);
            setMessage('False detection recorded. The candidate remains in this session.');
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (
                error instanceof OwnerCorrectionClientError
                && (error.code === 'P9_CANDIDATE_VERSION_CONFLICT' || error.code === 'P9_STATE_CONFLICT')
            ) {
                pendingRef.current = null;
                setPending(null);
                setConfirmOpen(false);
                const canonical = await authoritativeRefresh();
                if (canonical) setLatest(canonical);
                else setMessage('Latest candidate details could not be loaded.');
                return;
            }
            if (error instanceof OwnerCorrectionClientError && error.code === 'P9_INTERNAL_ERROR') {
                setMessage('The result is unclear. Retry the exact same action.');
                return;
            }
            pendingRef.current = null;
            setPending(null);
            setMessage(error instanceof OwnerCorrectionClientError
                ? error.message
                : 'The false disposition could not be recorded.');
        }
    };

    const confirmFalse = () => {
        if (!canMutate || pendingRef.current || mutation.isPending || !canMarkCandidateFalse(detail)) return;
        setConfirmOpen(true);
    };
    const submitFalse = () => {
        if (!canMutate || pendingRef.current || mutation.isPending) return;
        const command: MarkFalseRequest = {
            candidateId: detail.candidateId,
            expectedCandidateVersion: detail.candidateVersion,
            idempotencyKey: createSemanticKey('false'),
            commandId: createCaptureUuid(),
        };
        pendingRef.current = command;
        setPending(command);
        void runFalse(command);
    };

    return (
        <View style={{ gap: 10 }}>
            <OwnerConfirmationDialog
                visible={confirmOpen}
                title="Mark as false detection?"
                description="This records a false detection and cannot be undone within the current scan workflow. It does not delete the candidate or create inventory."
                confirmLabel={pending && message ? 'Retry same false action' : 'Mark false'}
                pending={mutation.isPending}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={() => pending ? void runFalse(pending) : submitFalse()}
                restoreFocusRef={falseTriggerRef}
            />
            {canMarkCandidateFalse(detail) ? (
                <Pressable
                    ref={falseTriggerRef}
                    accessibilityRole="button"
                    accessibilityLabel="Mark false"
                    accessibilityHint="Records a false detection after confirmation. It does not delete the candidate."
                    accessibilityState={{ disabled: !canMutate || mutation.isPending || Boolean(latest) }}
                    disabled={!canMutate || mutation.isPending || Boolean(latest)}
                    onPress={confirmFalse}
                    style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                >
                    <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Mark false</Text>
                </Pressable>
            ) : null}
            {canOpenVariantReview(detail) ? (
                <Button
                    title="Review search wording"
                    variant="secondary"
                    disabled={!canMutate}
                    onPress={() => setVariantOpen(true)}
                />
            ) : null}
            {latest ? (
                <View style={{ gap: 8 }}>
                    <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontWeight: '800' }}>Candidate changed</Text>
                    <Text selectable style={{ color: colors.textSecondary }}>Review the latest candidate before explicitly reapplying the false disposition.</Text>
                    <Button title="Use latest" variant="secondary" onPress={() => {
                        const selectedLatest = latest;
                        void (async () => {
                            const synchronized = await synchronizeCorrectionCandidate(
                                client, identity, detail.sessionId, detail.candidateId, selectedLatest,
                            );
                            if (!synchronized) return;
                            onCanonical?.(selectedLatest);
                            setLatest(null);
                        })();
                    }} />
                    <Button title="Reapply false disposition" onPress={() => {
                        const command: MarkFalseRequest = {
                            candidateId: latest.candidateId,
                            expectedCandidateVersion: latest.candidateVersion,
                            idempotencyKey: createSemanticKey('false'),
                            commandId: createCaptureUuid(),
                        };
                        setLatest(null);
                        pendingRef.current = command;
                        setPending(command);
                        void runFalse(command);
                    }} disabled={!canMarkCandidateFalse(latest) || !canMutate} />
                </View>
            ) : null}
            {message ? <Text selectable accessibilityLiveRegion="polite" style={{ color: message.includes('recorded') ? colors.accent : colors.error }}>{message}</Text> : null}
            {variantOpen ? (
                <VariantDecisionSheet
                    identity={identity}
                    detail={detail}
                    refetchCandidate={refetchCandidate}
                    onCanonical={onCanonical}
                    onClose={() => setVariantOpen(false)}
                    mutationAuthority={canMutate}
                />
            ) : null}
        </View>
    );
}
