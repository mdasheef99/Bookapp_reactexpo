import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import { candidateCanStartCommit } from '../commit/inventoryCommitCoordinator';
import { candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import {
    buildCompactReview, compactReviewDisplay, publicationHasEffectiveOverride,
    validateCompactReview,
    type CompactReviewEdits,
} from '../review/compactReviewDraft';
import {
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';
import { AddCandidateToInventoryAction } from './AddCandidateToInventoryAction';
import { BookCoverThumbnail } from './BookCoverThumbnail';
import { FieldSummary } from './BatchReviewFieldSummary';
import { CandidateMetadataSheet } from './CandidateMetadataSheet';
import { InlineBatchReviewAdditionalFields } from './InlineBatchReviewAdditionalFields';
import { InlineReviewIdentity, InlineReviewValueFields } from './InlineBatchReviewFields';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';
import { draftResolvableBlockerCodes, metadataStatusLabel, reviewStatusLabel } from './batchReviewStatus';

export { applyCompactEdits, type CompactReviewEdits } from '../review/compactReviewDraft';
export { sourceBadgeLabel } from './BatchReviewFieldSummary';
export { metadataStatusLabel } from './batchReviewStatus';

export function BatchReviewCard({
    identity, card, defaults, isOffline, canMutate, removePending, addPending,
    addOutcome, onOpenFullCorrection, onRemove, onAdd, onDraftChange,
    onAuthorityStateChange, onPendingIdentityChange,
}: {
    identity: ImageInventoryIdentity;
    card: OwnerBatchReviewCard;
    defaults: ScanSetupFormState;
    isOffline: boolean;
    canMutate: boolean;
    removePending: boolean;
    addPending: boolean;
    addOutcome?: CandidateCommitOutcome;
    onOpenFullCorrection: () => void;
    onRemove: (candidateId: string) => void;
    onAdd: (card: OwnerBatchReviewCard, edits: CompactReviewEdits,
        review: NonNullable<ReturnType<typeof buildCompactReview>>) => Promise<unknown>;
    onDraftChange: (candidateId: string, edits: CompactReviewEdits) => void;
    onAuthorityStateChange?: (candidateId: string, changed: boolean) => void;
    onPendingIdentityChange?: (candidateId: string, active: boolean,
        acceptedAuthorityKey: string) => void;
}) {
    const { colors } = useTheme();
    const [mountedEdits, setMountedEdits] = useState<CompactReviewEdits>({});
    const [metadataOpen, setMetadataOpen] = useState(false);
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [authorityChanged, setAuthorityChanged] = useState(false);
    const [identityResetKey, setIdentityResetKey] = useState(0);
    const [bufferedIdentity, setBufferedIdentity] = useState<{
        titleActive: boolean;
        authorsActive: boolean;
        originalTitle?: string;
        authors?: string[];
    }>({ titleActive: false, authorsActive: false });
    const bufferedIdentityRef = useRef(bufferedIdentity);
    const authorityKey = candidateCommitAuthorityKey(card);
    const acceptedAuthority = useRef(authorityKey);
    const hasEdits = Object.keys(mountedEdits).length > 0;
    const editable = (card.review !== null && card.reviewVersion !== null)
        || card.allowedActions.includes('save_review');
    const authorityMismatch = acceptedAuthority.current !== authorityKey;
    const hasBufferedIdentity = bufferedIdentity.titleActive || bufferedIdentity.authorsActive;
    const disabled = !canMutate || isOffline || authorityChanged || authorityMismatch || !editable;
    const display = compactReviewDisplay(card, defaults, mountedEdits);
    const publicationOverride = publicationHasEffectiveOverride(card, defaults, mountedEdits);
    const validation = validateCompactReview(card, defaults, mountedEdits);
    const review = validation.review;
    const canStartCommit = candidateCanStartCommit({ card, edits: mountedEdits,
        acceptedAuthorityKey: acceptedAuthority.current,
        ...(review ? { review } : {}) });

    useEffect(() => {
        if (acceptedAuthority.current === authorityKey) return;
        if (hasEdits || bufferedIdentity.titleActive || bufferedIdentity.authorsActive) {
            if (!authorityChanged) {
                setAuthorityChanged(true);
                onAuthorityStateChange?.(card.candidateId, true);
            }
        }
        else {
            acceptedAuthority.current = authorityKey;
            setIdentityResetKey((current) => current + 1);
        }
    }, [authorityChanged, authorityKey, card.candidateId, hasEdits,
        bufferedIdentity.titleActive, bufferedIdentity.authorsActive, onAuthorityStateChange]);

    useEffect(() => () => {
        if (bufferedIdentityRef.current.titleActive || bufferedIdentityRef.current.authorsActive)
            onPendingIdentityChange?.(card.candidateId, false, acceptedAuthority.current);
    }, [card.candidateId, onPendingIdentityChange]);

    const replaceEdits = (next: CompactReviewEdits) => {
        setMountedEdits(next);
        onDraftChange(card.candidateId, next);
    };
    const updateEdits = (patch: CompactReviewEdits) => replaceEdits({ ...mountedEdits, ...patch });
    const clearEdits = () => replaceEdits({});
    const updateBufferedIdentity = (
        field: 'originalTitle' | 'authors', value: string | string[] | undefined, active: boolean,
    ) => {
        const next = {
            ...bufferedIdentityRef.current,
            [field]: value,
            [field === 'originalTitle' ? 'titleActive' : 'authorsActive']: active,
        };
        bufferedIdentityRef.current = next;
        setBufferedIdentity(next);
        onPendingIdentityChange?.(card.candidateId,
            next.titleActive || next.authorsActive, acceptedAuthority.current);
    };
    const resolveAuthorityChange = (keepEdits: boolean) => {
        acceptedAuthority.current = authorityKey;
        if (!keepEdits) clearEdits();
        else if (bufferedIdentity.originalTitle !== undefined
            || bufferedIdentity.authors !== undefined) {
            replaceEdits({
                ...mountedEdits,
                ...(bufferedIdentity.originalTitle !== undefined
                    ? { originalTitle: bufferedIdentity.originalTitle } : {}),
                ...(bufferedIdentity.authors !== undefined
                    ? { authors: bufferedIdentity.authors } : {}),
            });
        }
        setAuthorityChanged(false);
        bufferedIdentityRef.current = { titleActive: false, authorsActive: false };
        setBufferedIdentity(bufferedIdentityRef.current);
        onPendingIdentityChange?.(card.candidateId, false, authorityKey);
        setIdentityResetKey((current) => current + 1);
        onAuthorityStateChange?.(card.candidateId, false);
    };
    const attentionItems = useMemo(() => {
        if (!hasEdits) {
            return card.blockers.length > 0
                ? card.blockers.map((blocker) => ({
                    field: blocker.field ?? 'review', safeMessage: blocker.safeMessage,
                }))
                : [...validation.issues];
        }
        const retainedServerItems = card.blockers
            .filter((blocker) => !draftResolvableBlockerCodes.has(blocker.code))
            .map((blocker) => ({
                field: blocker.field ?? 'review', safeMessage: blocker.safeMessage,
            }));
        return [...validation.issues, ...retainedServerItems].filter((item, index, values) => (
            values.findIndex((candidate) => candidate.field === item.field
                && candidate.safeMessage === item.safeMessage) === index
        ));
    }, [card.blockers, hasEdits, validation.issues]);
    const errorFields = useMemo(() => new Set(attentionItems.map((item) => item.field)),
        [attentionItems]);
    const status = reviewStatusLabel(
        card, review !== null, attentionItems.length, editable, hasEdits, addOutcome,
    );
    const needsAttention = status === 'Needs attention' || status === 'Failed';

    return (
        <GlassCard padding={0} borderRadius={20} style={needsAttention ? { borderLeftWidth: 4, borderLeftColor: colors.error } : undefined}>
            <View testID={`card-${card.candidateId}`} style={{ gap: 14, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                    <BookCoverThumbnail ordinal={card.ordinal} metadataSummary={card.metadataSummary} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
                            <Text selectable style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                BOOK {card.ordinal}
                            </Text>
                            <View testID="card-review-status" style={{
                                borderRadius: 999,
                                 borderWidth: 1,
                                 borderColor: needsAttention ? colors.error : colors.accent,
                                 backgroundColor: colors.bgSecondary,
                                 paddingHorizontal: 8,
                                paddingVertical: 3,
                            }}>
                                <Text selectable style={{
                                    color: needsAttention ? colors.error : colors.accent,
                                    fontSize: 11,
                                    fontWeight: '800',
                                }}>
                                    {status}
                                </Text>
                            </View>
                        </View>
                        <InlineReviewIdentity ordinal={card.ordinal} title={display.title} authors={display.authors}
                            titleSourceCode={card.fieldSources.title} authorsSourceCode={card.fieldSources.authors}
                            titleLocal={mountedEdits.originalTitle !== undefined}
                            authorsLocal={mountedEdits.authors !== undefined}
                            errorFields={errorFields}
                            disabled={disabled} holdBuffered={authorityChanged || authorityMismatch}
                            resetKey={identityResetKey} onBufferedChange={updateBufferedIdentity}
                            onChange={updateEdits} />
                        <Text selectable accessibilityLabel={`Metadata status: ${metadataStatusLabel(card.metadataState)}`}
                            style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                            {metadataStatusLabel(card.metadataState)}
                        </Text>
                        {hasEdits ? (
                            <Text selectable accessibilityLiveRegion="polite"
                                style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                                Edited · saved when added
                            </Text>
                        ) : null}
                    </View>
                </View>

                <InlineReviewValueFields display={display}
                    priceSourceCode={card.fieldSources.price} quantitySourceCode={card.fieldSources.quantity}
                    conditionSourceCode={card.fieldSources.condition}
                    priceLocal={mountedEdits.priceMinor !== undefined}
                    quantityLocal={mountedEdits.quantity !== undefined}
                    conditionLocal={mountedEdits.baseCondition !== undefined}
                    errorFields={errorFields} disabled={disabled} onChange={updateEdits} />

                <View style={{
                    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                    backgroundColor: colors.bgSecondary, gap: 1, paddingHorizontal: 12,
                }} testID="card-additional-details">
                    <Pressable
                        testID="card-additional-details-toggle"
                        accessibilityRole="button"
                        accessibilityLabel={detailsExpanded
                            ? 'Hide location, publication, language, and damage details'
                            : 'Show location, publication, language, and damage details'}
                        onPress={() => setDetailsExpanded((current) => !current)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                    >
                        <Text selectable style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}>
                            Location · Publication · Language · Damage
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {detailsExpanded ? '▲' : '▼'}
                        </Text>
                    </Pressable>
                    {detailsExpanded ? (
                        <InlineBatchReviewAdditionalFields
                            display={display}
                            defaults={defaults}
                            sourceCodes={{
                                language: card.fieldSources.language,
                                location: card.fieldSources.location,
                                publication: card.fieldSources.publication,
                                damage: card.fieldSources.damage,
                            }}
                            localFields={{
                                language: mountedEdits.originalLanguage !== undefined,
                                location: mountedEdits.shelfLocation !== undefined,
                                publication: mountedEdits.publicationIntent !== undefined || publicationOverride,
                                damage: mountedEdits.damageDisclosure !== undefined,
                            }}
                            errorFields={errorFields}
                            disabled={disabled}
                            onChange={updateEdits}
                        />
                    ) : (
                        <View testID="card-additional-details-summary" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
                            <FieldSummary label="Location" value={display.location || 'No location'}
                                sourceCode={card.fieldSources.location}
                                local={mountedEdits.shelfLocation !== undefined}
                                testSuffix="collapsed-location" compact />
                            <FieldSummary label="Publication" value={display.publication === 'publish' ? 'Publish' : 'Private'}
                                sourceCode={card.fieldSources.publication}
                                local={mountedEdits.publicationIntent !== undefined || publicationOverride}
                                testSuffix="collapsed-publication" compact />
                            <FieldSummary label="Language" value={display.language || 'No language'}
                                sourceCode={card.fieldSources.language}
                                local={mountedEdits.originalLanguage !== undefined}
                                testSuffix="collapsed-language" compact />
                            <FieldSummary label="Damage" value={display.damage.hasDamage ? 'Has damage' : 'No damage'}
                                sourceCode={card.fieldSources.damage}
                                local={mountedEdits.damageDisclosure !== undefined}
                                testSuffix="collapsed-damage" compact />
                        </View>
                    )}
                </View>

                {attentionItems.length > 0 ? (
                    <View testID={!review ? 'card-add-validation' : undefined}
                        style={{ borderRadius: 12, backgroundColor: colors.bgSecondary, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.error }}>
                        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error, fontWeight: '800' }}>
                            Complete these details
                        </Text>
                        {attentionItems.map((item, index) => (
                            <Text key={index} selectable style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                                • {item.safeMessage}
                            </Text>
                        ))}
                    </View>
                ) : null}

                {authorityChanged ? (
                    <View style={{ gap: 8 }} testID="compact-authority-changed">
                        <Text selectable style={{ color: colors.error }}>
                            The saved review changed while compact edits were open. Choose which draft to continue with.
                        </Text>
                        <Button title="Use latest saved review" variant="secondary"
                            onPress={() => resolveAuthorityChange(false)} />
                        <Button title="Reapply compact edits" variant="secondary"
                            onPress={() => resolveAuthorityChange(true)} />
                    </View>
                ) : null}

                {!editable ? <Text selectable style={{ color: colors.textSecondary }}>
                    Open full correction to prepare this book before it can be finalized.
                </Text> : null}

                <View style={{ gap: 8 }}>
                    <AddCandidateToInventoryAction card={card}
                        disabled={!canMutate || authorityChanged || authorityMismatch
                            || hasBufferedIdentity || !review || !canStartCommit}
                        isOffline={isOffline} pending={addPending} outcome={addOutcome}
                        onAdd={async () => {
                            if (!review || authorityChanged || acceptedAuthority.current !== authorityKey
                                || hasBufferedIdentity || bufferedIdentityRef.current.titleActive
                                || bufferedIdentityRef.current.authorsActive)
                                return undefined;
                            const result = await onAdd(card, mountedEdits, review);
                            if (result && typeof result === 'object' && 'status' in result
                                && result.status === 'succeeded') clearEdits();
                            return result;
                        }} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {card.allowedActions.includes('view_metadata') ? (
                            <Button title="View metadata" variant="secondary" size="sm"
                                style={{ flexGrow: 1, flexBasis: 150, width: 'auto' }}
                                onPress={() => setMetadataOpen(true)}
                                accessibilityHint="Opens bounded metadata details for this book" />
                        ) : null}
                        <Button title="Open full correction" variant="secondary" size="sm"
                            style={{ flexGrow: 1, flexBasis: 150, width: 'auto' }}
                            onPress={onOpenFullCorrection}
                            accessibilityHint="Opens the existing full review for deep corrections" />
                    </View>
                    {card.allowedActions.includes('remove_from_scan') ? (
                        <>
                            <Button title="Remove from this scan" variant="ghost" size="sm" onPress={() => setConfirmOpen(true)}
                                disabled={!canMutate || isOffline || removePending}
                                accessibilityHint="Removes this detected book from this scan after confirmation. This is not a false detection." />
                            <OwnerConfirmationDialog visible={confirmOpen} title="Remove this book from the scan?"
                                description="The detected book stays in the session history but leaves active review. No photo or existing inventory is deleted. This cannot be undone."
                                confirmLabel="Remove book from scan" pending={removePending}
                                onCancel={() => setConfirmOpen(false)} onConfirm={() => {
                                    setConfirmOpen(false); onRemove(card.candidateId);
                                }} />
                        </>
                    ) : null}
                </View>
            </View>

            {metadataOpen ? <CandidateMetadataSheet identity={identity} card={card} visible
                disabled={disabled} onClose={() => setMetadataOpen(false)}
                onUseDetected={(edits) => { updateEdits(edits); setMetadataOpen(false); }}
                onEditManually={(edits) => {
                    updateEdits(edits); setMetadataOpen(false);
                }} /> : null}
        </GlassCard>
    );
}
