import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
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
}: {
    identity: ImageInventoryIdentity;
    detail: OwnerCandidateDetail;
    refetchCandidate: () => Promise<CandidateRefetchResult>;
    onCanonical?: (detail: OwnerCandidateDetail) => void;
}) {
    const { colors } = useTheme();
    const { isOffline } = useNetworkStatus();
    const client = useCorrectionQueryClient();
    const mutation = useMarkCandidateFalse();
    const pendingRef = useRef<MarkFalseRequest | null>(null);
    const [pending, setPending] = useState<MarkFalseRequest | null>(null);
    const [latest, setLatest] = useState<OwnerCandidateDetail | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [variantOpen, setVariantOpen] = useState(false);
    const scope = `${identity.userId}:${identity.storeId}:${detail.sessionId}:${detail.candidateId}`;
    const activeScope = useRef(scope);
    useEffect(() => {
        activeScope.current = scope;
        return () => { activeScope.current = ''; };
    }, [scope]);

    const authoritativeRefresh = async () => {
        const callScope = activeScope.current;
        const refreshed = await refetchCandidate();
        if (
            activeScope.current !== callScope
            || !isAuthoritativeCandidateRefresh(refreshed, detail.sessionId, detail.candidateId)
        ) return null;
        return refreshed.data;
    };

    const runFalse = async (command: MarkFalseRequest) => {
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
            setMessage('False detection recorded. The candidate remains in this session.');
        } catch (error) {
            if (activeScope.current !== callScope) return;
            if (
                error instanceof OwnerCorrectionClientError
                && (error.code === 'P9_CANDIDATE_VERSION_CONFLICT' || error.code === 'P9_STATE_CONFLICT')
            ) {
                pendingRef.current = null;
                setPending(null);
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
        if (pendingRef.current || mutation.isPending || !canMarkCandidateFalse(detail)) return;
        Alert.alert(
            'Mark as false detection?',
            'This records a false detection and cannot be undone within the current scan workflow. It does not delete the candidate or create inventory.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark false',
                    style: 'destructive',
                    onPress: () => {
                        if (pendingRef.current) return;
                        const command: MarkFalseRequest = {
                            candidateId: detail.candidateId,
                            expectedCandidateVersion: detail.candidateVersion,
                            idempotencyKey: createSemanticKey('false'),
                            commandId: createCaptureUuid(),
                        };
                        pendingRef.current = command;
                        setPending(command);
                        void runFalse(command);
                    },
                },
            ],
        );
    };

    return (
        <View style={{ gap: 10 }}>
            {canMarkCandidateFalse(detail) ? (
                <Button
                    title="Mark false"
                    variant="secondary"
                    disabled={isOffline || mutation.isPending || Boolean(latest)}
                    onPress={confirmFalse}
                    accessibilityHint="Records a false detection after confirmation. It does not delete the candidate."
                />
            ) : null}
            {canOpenVariantReview(detail) ? (
                <Button
                    title="Review search wording"
                    variant="secondary"
                    disabled={isOffline}
                    onPress={() => setVariantOpen(true)}
                />
            ) : null}
            {pending && message ? (
                <Button title="Retry same false action" onPress={() => void runFalse(pending)} disabled={isOffline || mutation.isPending} />
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
                    }} disabled={!canMarkCandidateFalse(latest) || isOffline} />
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
                />
            ) : null}
        </View>
    );
}
