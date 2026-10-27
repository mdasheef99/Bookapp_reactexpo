import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import { candidateCanStartCommit } from '../commit/inventoryCommitCoordinator';
import { candidateCommitAuthorityKey } from '../commit/inventoryCommitPolicy';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import {
    buildCompactReview, compactReviewDisplay, compactIdentityMatches, compactReviewScript,
    validateCompactReview,
    type CompactReviewEdits,
} from '../review/compactReviewDraft';
import {
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';
import { AddCandidateToInventoryAction } from './AddCandidateToInventoryAction';
import { BookCoverThumbnail } from './BookCoverThumbnail';
import { BatchReviewDetails } from './BatchReviewDetails';
import { CandidateMetadataSheet } from './CandidateMetadataSheet';
import { EditionChoicesReader } from './EditionChoicesReader';
import { MetadataSheetTrigger } from './MetadataSheetTrigger';
import type { OwnerCandidateCommandSlot } from '../identity/useOwnerCardCommand';
import type { EditionChoices } from '../contracts/ownerEditionPicker';
import type { OwnerCandidateDetail } from '../contracts/ownerUxContracts';
import { EditionLine } from './EditionLine';
import { applyCompactEditionSelection } from '../review/editionSelectionDraft';
import { InlineReviewIdentity, InlineReviewValueFields } from './InlineBatchReviewFields';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';
import { cardAttentionItems, reviewStatusLabel } from './batchReviewStatus';

export { applyCompactEdits, type CompactReviewEdits } from '../review/compactReviewDraft';

export function BatchReviewCard({
    identity, card, defaults, isOffline, canMutate, removePending, addPending,
    addOutcome, onRemove, onAdd, onDraftChange,
    onAuthorityStateChange, onPendingIdentityChange, onUnsavedEditsChange, commandSlot, onEditionSelection, onEditionPendingChange, onEditionChoices,
}: {
    identity: ImageInventoryIdentity;
    card: OwnerBatchReviewCard;
    defaults: ScanSetupFormState;
    isOffline: boolean;
    canMutate: boolean;
    removePending: boolean;
    addPending: boolean;
    addOutcome?: CandidateCommitOutcome;
    onRemove: (candidateId: string) => void;
    onAdd: (card: OwnerBatchReviewCard, edits: CompactReviewEdits,
        review: NonNullable<ReturnType<typeof buildCompactReview>>) => Promise<unknown>;
    onDraftChange: (candidateId: string, edits: CompactReviewEdits, acceptedAuthorityKey?: string) => void;
    onUnsavedEditsChange?: (candidateId: string, dirty: boolean) => void;
    commandSlot?: OwnerCandidateCommandSlot;
    onEditionSelection?: (choices: EditionChoices) => void;
    onEditionChoices?: (choices: EditionChoices) => void;
    onEditionPendingChange?: (candidateId: string, pending: boolean) => void;
    onAuthorityStateChange?: (candidateId: string, changed: boolean) => void;
    onPendingIdentityChange?: (candidateId: string, active: boolean,
        acceptedAuthorityKey: string) => void;
}) {
    const { colors } = useTheme();
    const [mountedEdits, setMountedEdits] = useState<CompactReviewEdits>({});
    const [metadataOpen, setMetadataOpen] = useState(false);
    const [selectionPending, setSelectionPending] = useState(false);
    const [selectedEdition, setSelectedEdition] = useState<EditionChoices | null>(null);
    const [editionChoices, setEditionChoices] = useState<EditionChoices>();
    // Metadata revision of an identity save still awaiting the parent card read.
    const [savedIdentityRevision, setSavedIdentityRevision] = useState<number | null>(null);
    const acceptChoices = useCallback((choices: EditionChoices) => {
        setEditionChoices(choices); onEditionChoices?.(choices);
    }, [onEditionChoices]);
    const latestEdits = useRef(mountedEdits);
    const metadataTriggerRef = useRef<View>(null);
    const editionTriggerRef = useRef<View>(null);
    const openMetadata = (trigger: { current: View | null }) => {
        metadataTriggerRef.current = trigger.current; setMetadataOpen(true);
    };
    const handleSelectionPending = useCallback((pending: boolean) => {
        setSelectionPending(pending); onEditionPendingChange?.(card.candidateId, pending);
    }, [card.candidateId, onEditionPendingChange]);
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
    const disabled = !canMutate || isOffline || authorityChanged || authorityMismatch || selectionPending || !editable;
    const display = compactReviewDisplay(card, defaults, mountedEdits);
    const validation = validateCompactReview(card, defaults, mountedEdits, editionChoices);
    const review = validation.review;
    const canStartCommit = candidateCanStartCommit({ card, edits: mountedEdits,
        acceptedAuthorityKey: acceptedAuthority.current,
        ...(review ? { review } : {}) });

    useEffect(() => {
        if (acceptedAuthority.current === authorityKey) return;
        // Our accepted command is awaiting the parent read; keep the latest draft.
        if (selectedEdition && card.metadataRevision < selectedEdition.metadataRevision) return;
        if (savedIdentityRevision !== null && card.metadataRevision < savedIdentityRevision) return;
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
        bufferedIdentity.titleActive, bufferedIdentity.authorsActive, onAuthorityStateChange, selectedEdition, savedIdentityRevision]);

    useEffect(() => () => {
        if (bufferedIdentityRef.current.titleActive || bufferedIdentityRef.current.authorsActive)
            onPendingIdentityChange?.(card.candidateId, false, acceptedAuthority.current);
    }, [card.candidateId, onPendingIdentityChange]);

    const replaceEdits = (next: CompactReviewEdits) => {
        latestEdits.current = next;
        setMountedEdits(next);
        onDraftChange(card.candidateId, next);
    };
    const updateEdits = (patch: CompactReviewEdits) => replaceEdits({ ...mountedEdits, ...patch });
    const clearEdits = () => replaceEdits({});
    const adoptEdition = (canonical: EditionChoices, previousRevision: number) => {
        const next = applyCompactEditionSelection(latestEdits.current, canonical, previousRevision);
        if (next === latestEdits.current) return;
        acceptedAuthority.current = `${canonical.candidateVersion}:${canonical.metadataRevision}:${canonical.reviewVersion}`;
        latestEdits.current = next;
        setMountedEdits(next);
        setSelectedEdition(canonical);
        acceptChoices(canonical);
        onDraftChange(card.candidateId, next, acceptedAuthority.current);
        onEditionSelection?.(canonical);
    };
    // SDD-1 §4 / AC2-10: only the active choice's scoped snapshot is verifiable.
    const baseChoice = mountedEdits.metadataChoice ?? card.review?.metadataChoice
        ?? (card.metadataState === 'selected' && card.metadataSummary?.selectionId
            ? { mode: 'selected', selectionId: card.metadataSummary.selectionId } : undefined);
    const trustedChoices = editionChoices && editionChoices.sessionId === card.sessionId
        && editionChoices.candidateId === card.candidateId
        && baseChoice?.mode !== 'manual' && !!baseChoice?.selectionId
        && editionChoices.selection?.selectionId === baseChoice.selectionId
        ? editionChoices : undefined;
    const currentIdentity = { ...display, script: compactReviewScript(card, mountedEdits, trustedChoices) };
    const savedIdentity = card.review ? { title: card.review.originalTitle, authors: card.review.authors,
        language: card.review.originalLanguage, script: card.review.script }
        : { ...compactReviewDisplay(card, defaults, {}), script: compactReviewScript(card, {}, trustedChoices) };
    const identityChanged = hasEdits && !compactIdentityMatches(currentIdentity, savedIdentity);
    const chosen = trustedChoices?.selection?.snapshot ?? (!trustedChoices && baseChoice?.mode !== 'manual' && card.metadataSummary
        ? { ...card.metadataSummary, script: card.review ? card.review.script : card.observed.script } : null);
    const chosenIdentityChanged = !!chosen && !compactIdentityMatches(currentIdentity, chosen);
    const lookupPending = editionChoices?.lookupStatus === 'pending' || card.metadataState === 'pending';
    const bufferedDirty = (bufferedIdentity.originalTitle !== undefined && bufferedIdentity.originalTitle !== display.title)
        || (bufferedIdentity.authors !== undefined && JSON.stringify(bufferedIdentity.authors) !== JSON.stringify(display.authors));
    useEffect(() => {
        onUnsavedEditsChange?.(card.candidateId, hasEdits || bufferedDirty);
    }, [card.candidateId, hasEdits, bufferedDirty, onUnsavedEditsChange]);
    useEffect(() => () => onUnsavedEditsChange?.(card.candidateId, false), [card.candidateId, onUnsavedEditsChange]);
    // The save carried every card edit, so the draft is now server authority.
    const adoptSavedIdentity = (detail: OwnerCandidateDetail) => {
        acceptedAuthority.current = `${detail.candidateVersion}:${detail.metadata.revision}:${detail.review.reviewVersion}`;
        latestEdits.current = {};
        setMountedEdits({});
        setSelectedEdition(null);
        setSavedIdentityRevision(detail.metadata.revision);
        onDraftChange(card.candidateId, {}, acceptedAuthority.current);
    };
    const selectedSummary = selectedEdition?.selection && card.metadataRevision <= selectedEdition.metadataRevision
        ? { ...selectedEdition.selection.snapshot, selectionId: selectedEdition.selection.selectionId,
            representativeCover: selectedEdition.selection.source === 'edition_option'
                ? null : card.metadataSummary?.representativeCover ?? null }
        : card.metadataSummary;
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
    const attentionItems = useMemo(() => cardAttentionItems({
        card, hasEdits, validationIssues: validation.issues, draftSubmittable: canStartCommit,
    }), [card, hasEdits, validation.issues, canStartCommit]);
    const errorFields = useMemo(() => new Set(attentionItems.map((item) => item.field)),
        [attentionItems]);
    // Mirrors the screen's bulk eligibility: blocked, pending and in-flight cards are not Ready.
    const canAddNow = canStartCommit && !authorityChanged && !hasBufferedIdentity
        && !selectionPending && !addPending;
    const status = reviewStatusLabel(card, canAddNow, attentionItems.length, addOutcome, addPending);
    const needsAttention = status === 'Needs attention' || status === 'Failed';

    return (
        <GlassCard padding={0} borderRadius={20} style={needsAttention ? { borderLeftWidth: 4, borderLeftColor: colors.error } : undefined}>
            {commandSlot ? <EditionChoicesReader identity={identity} sessionId={card.sessionId}
                candidateId={card.candidateId} onChoices={acceptChoices} /> : null}
            <View testID={`card-${card.candidateId}`} style={{ gap: 14, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                    <BookCoverThumbnail ordinal={card.ordinal} metadataSummary={selectedSummary} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
                            <Text selectable style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                BOOK {card.ordinal}
                            </Text>
                            <View testID="card-review-status" accessibilityLiveRegion="polite" accessibilityLabel={status} style={{
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
                            errorFields={errorFields}
                            disabled={disabled} holdBuffered={authorityChanged || authorityMismatch}
                            resetKey={identityResetKey} onBufferedChange={updateBufferedIdentity}
                            onChange={updateEdits}>
                            <EditionLine choices={trustedChoices} identityChanged={chosenIdentityChanged}
                                pending={lookupPending}
                                selected={card.metadataState === 'selected' && !!card.metadataSummary} />
                        </InlineReviewIdentity>
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

                <BatchReviewDetails card={card} defaults={defaults} mountedEdits={mountedEdits}
                    display={display} errorFields={errorFields} disabled={disabled} updateEdits={updateEdits} />
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
                    This book can't be changed now.
                </Text> : null}

                <View style={{ gap: 8 }}>
                    <AddCandidateToInventoryAction card={card}
                        disabled={!canMutate || authorityChanged || authorityMismatch
                            || selectionPending || hasBufferedIdentity || !review || !canStartCommit}
                        isOffline={isOffline} pending={addPending} outcome={addOutcome} editionChoices={trustedChoices}
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
                        {((commandSlot && editable) || card.allowedActions.includes('view_metadata')) ? <MetadataSheetTrigger title="Find or change edition" focusRef={editionTriggerRef} style={{ flexGrow: 1, flexBasis: 150 }}
                            onPress={() => openMetadata(editionTriggerRef)} /> : null}
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
                disabled={disabled || hasBufferedIdentity} onClose={() => setMetadataOpen(false)}
                disabledReason={hasBufferedIdentity ? 'Finish editing the title or author on this card before choosing an edition.' : null}
                commandSlot={commandSlot} onSelection={adoptEdition} onPendingChange={handleSelectionPending}
                cardDraft={{ identityChanged, pending: lookupPending, request: review ? { review,
                    expectedCandidateVersion: card.candidateVersion, expectedMetadataRevision: card.metadataRevision } : null }}
                onIdentitySaved={adoptSavedIdentity}
                restoreFocusRef={metadataTriggerRef} /> : null}
        </GlassCard>
    );
}
