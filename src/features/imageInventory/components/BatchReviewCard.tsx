import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { ImageInventoryIdentity } from '../queries/ownerUxQueries';
import {
    buildCompactReview, compactReviewDisplay, publicationHasEffectiveOverride,
    type CompactReviewEdits,
} from '../review/compactReviewDraft';
import {
    CONDITION_CHOICES,
    formatInrFromMinor,
    type ScanSetupFormState,
} from '../scanSetup/scanSetupForm';
import { AddCandidateToInventoryAction } from './AddCandidateToInventoryAction';
import { CandidateMetadataSheet } from './CandidateMetadataSheet';
import { CompactReviewEditors } from './CompactReviewEditors';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';

export { applyCompactEdits, type CompactReviewEdits } from '../review/compactReviewDraft';

export function sourceBadgeLabel(code: string): string {
    if (code === 'matched') return 'Provider matched';
    if (code === 'detected') return 'Vision detected';
    if (code === 'default') return 'Batch default';
    if (code === 'custom') return 'Custom';
    return 'Missing';
}

export function metadataStatusLabel(state: OwnerBatchReviewCard['metadataState']): string {
    if (state === 'selected') return 'Provider matched';
    if (state === 'manual') return 'Manual details';
    if (state === 'no_match') return 'No provider match';
    if (state === 'pending') return 'Finding metadata';
    if (state === 'ambiguous') return 'Metadata needs review';
    if (state === 'temporarily_unavailable') return 'Metadata unavailable';
    return 'Metadata failed';
}

function reviewStatusLabel(card: OwnerBatchReviewCard): string {
    if (card.candidateState === 'committed') return 'Added';
    if (card.candidateState === 'commit_in_progress') return 'Adding';
    if (card.candidateState === 'processing') return 'Processing';
    if (card.candidateState === 'failed') return 'Failed';
    if (card.blockers.length > 0 || card.candidateState === 'needs_review'
        || card.candidateState === 'possible_duplicate') return 'Needs attention';
    if (card.reviewReady) return 'Ready';
    return 'Review book';
}

function SourceBadge({ code, local = false, testID }: {
    code: string;
    local?: boolean;
    testID?: string;
}) {
    const { colors } = useTheme();
    const label = local ? 'Custom' : sourceBadgeLabel(code);
    return (
        <Text selectable testID={testID} accessibilityLabel={`Source ${label}`} style={{
            color: local ? colors.accent : colors.textSecondary,
            fontSize: 11,
            fontWeight: '700',
            borderWidth: 1,
            borderColor: local ? colors.accent : colors.border,
            borderRadius: 999,
            paddingHorizontal: 7,
            paddingVertical: 2,
            overflow: 'hidden',
        }}>
            {label}
        </Text>
    );
}

function FieldSummary({ label, value, sourceCode, local, testSuffix, compact = false }: {
    label: string;
    value: string;
    sourceCode: string | null;
    local?: boolean;
    testSuffix: string;
    compact?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <View style={{
            flexGrow: compact ? 1 : 0,
            flexBasis: compact ? 104 : 'auto',
            gap: 5,
            paddingVertical: compact ? 10 : 7,
        }}>
            <Text selectable style={{ color: colors.textPrimary, fontWeight: compact ? '700' : '600' }}>
                {label}: {value}
            </Text>
            {local ? (
                <View style={{ alignSelf: 'flex-start' }}>
                    <SourceBadge code="custom" local testID={`card-${testSuffix}-overlay`} />
                </View>
            ) : sourceCode ? <View style={{ alignSelf: 'flex-start' }}><SourceBadge code={sourceCode} /></View> : null}
        </View>
    );
}

export function BatchReviewCard({
    identity, card, defaults, isOffline, canMutate, removePending, addPending,
    addOutcome, onOpenFullCorrection, onRemove, onAdd, onDraftChange,
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
}) {
    const { colors } = useTheme();
    const [mountedEdits, setMountedEdits] = useState<CompactReviewEdits>({});
    const [metadataOpen, setMetadataOpen] = useState(false);
    const [editingOpen, setEditingOpen] = useState(false);
    const [identityRequested, setIdentityRequested] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [authorityChanged, setAuthorityChanged] = useState(false);
    const authorityKey = `${card.candidateVersion}:${card.metadataRevision}:${card.reviewVersion}`;
    const acceptedAuthority = useRef(authorityKey);
    const hasEdits = Object.keys(mountedEdits).length > 0;
    const editable = (card.review !== null && card.reviewVersion !== null)
        || card.allowedActions.includes('save_review');
    const disabled = !canMutate || isOffline || authorityChanged;
    const display = compactReviewDisplay(card, defaults, mountedEdits);
    const publicationOverride = publicationHasEffectiveOverride(card, defaults, mountedEdits);
    const review = buildCompactReview(card, defaults, mountedEdits);
    const title = display.title;
    const authors = display.authors.join(', ') || 'Author unknown';
    const price = formatInrFromMinor(display.priceMinor);
    const condition = CONDITION_CHOICES.find((choice) => choice.value === display.condition)?.label
        ?? 'Not set';

    useEffect(() => {
        if (acceptedAuthority.current === authorityKey) return;
        if (hasEdits) setAuthorityChanged(true);
        else acceptedAuthority.current = authorityKey;
    }, [authorityKey, hasEdits]);

    const replaceEdits = (next: CompactReviewEdits) => {
        setMountedEdits(next);
        onDraftChange(card.candidateId, next);
    };
    const updateEdits = (patch: CompactReviewEdits) => replaceEdits({ ...mountedEdits, ...patch });
    const clearEdits = () => replaceEdits({});
    const attention = useMemo(() => card.blockers.length === 0 ? null
        : `${card.blockers.length} item${card.blockers.length === 1 ? '' : 's'} need attention`,
    [card.blockers.length]);
    const status = reviewStatusLabel(card);
    const needsAttention = status === 'Needs attention' || status === 'Failed';

    return (
        <GlassCard padding={0} borderRadius={16} style={needsAttention ? { borderLeftWidth: 4, borderLeftColor: colors.error } : undefined}>
            <View testID={`card-${card.candidateId}`} style={{ gap: 14, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                    {card.metadataSummary?.coverReference ? (
                        <Image
                            source={{ uri: card.metadataSummary.coverReference }}
                            contentFit="cover"
                            accessibilityLabel={`Book ${card.ordinal} cover`}
                            style={{ width: 72, height: 104, borderRadius: 9 }}
                        />
                    ) : (
                        <View accessibilityLabel={`Book ${card.ordinal} cover placeholder`} style={{
                            width: 72,
                            height: 104,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.bgSecondary,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>No cover</Text>
                        </View>
                    )}
                    <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6 }}>
                            <Text selectable style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                BOOK {card.ordinal}
                            </Text>
                            <View testID="card-review-status" style={{
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: needsAttention ? colors.error : colors.accent,
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
                        <Text selectable accessibilityRole="header"
                            accessibilityLabel={`Book ${card.ordinal}. ${title}`}
                            style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800', lineHeight: 23 }}>
                            {title}
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary, lineHeight: 20 }}>{authors}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            <SourceBadge code={card.fieldSources.title} local={mountedEdits.originalTitle !== undefined} />
                            <SourceBadge code={card.fieldSources.authors} local={mountedEdits.authors !== undefined} />
                        </View>
                        <Text selectable style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>
                            {metadataStatusLabel(card.metadataState)}
                        </Text>
                        {hasEdits ? <Text selectable style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>Unsaved changes</Text> : null}
                    </View>
                </View>

                <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.bgSecondary,
                }}>
                    <FieldSummary label="Price" value={price} sourceCode={card.fieldSources.price}
                        local={mountedEdits.priceMinor !== undefined} testSuffix="price" compact />
                    <FieldSummary label="Quantity" value={String(display.quantity)} sourceCode={card.fieldSources.quantity}
                        local={mountedEdits.quantity !== undefined} testSuffix="quantity" compact />
                    <FieldSummary label="Condition" value={condition} sourceCode={card.fieldSources.condition}
                        local={mountedEdits.baseCondition !== undefined} testSuffix="condition" compact />
                </View>

                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, gap: 1 }}>
                    <View testID="card-location-sources">
                        <FieldSummary label="Location" value={display.location || 'Not set'} sourceCode={card.fieldSources.location}
                            local={mountedEdits.shelfLocation !== undefined} testSuffix="location" />
                        <FieldSummary label="Publication" value={display.publication === 'publish' ? 'Prepare to publish' : 'Private'}
                            sourceCode={card.fieldSources.publication}
                            local={mountedEdits.publicationIntent !== undefined || publicationOverride}
                            testSuffix="publication" />
                    </View>
                    <FieldSummary label="Language" value={display.language} sourceCode={card.fieldSources.language}
                        local={mountedEdits.originalLanguage !== undefined} testSuffix="language" />
                    <FieldSummary label="Damage" value={display.damage.hasDamage ? 'Has damage' : 'No damage'}
                        sourceCode={card.fieldSources.damage}
                        local={mountedEdits.damageDisclosure !== undefined} testSuffix="damage" />
                </View>

                {attention ? (
                    <View style={{ borderRadius: 12, backgroundColor: colors.bgSecondary, padding: 12, gap: 4 }}>
                        <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.error, fontWeight: '800' }}>
                            Needs attention · {attention}
                        </Text>
                        {card.blockers[0] ? <Text selectable style={{ color: colors.textSecondary }}>{card.blockers[0].safeMessage}</Text> : null}
                    </View>
                ) : null}

                {authorityChanged ? (
                    <View style={{ gap: 8 }} testID="compact-authority-changed">
                        <Text selectable style={{ color: colors.error }}>
                            The saved review changed while compact edits were open. Choose which draft to continue with.
                        </Text>
                        <Button title="Use latest saved review" variant="secondary" onPress={() => {
                            clearEdits(); acceptedAuthority.current = authorityKey; setAuthorityChanged(false);
                        }} />
                        <Button title="Reapply compact edits" variant="secondary" onPress={() => {
                            acceptedAuthority.current = authorityKey; setAuthorityChanged(false);
                        }} />
                    </View>
                ) : null}

                {!editable ? <Text selectable style={{ color: colors.textSecondary }}>
                    Open full correction to prepare this book before it can be finalized.
                </Text> : null}

                {editable ? (
                    <Button
                        title={editingOpen ? 'Done editing' : 'Edit book details'}
                        variant="secondary"
                        onPress={() => setEditingOpen((current) => !current)}
                        disabled={disabled}
                        accessibilityHint="Shows compact editing controls for this book"
                    />
                ) : null}
                {editable && editingOpen ? (
                    <CompactReviewEditors values={display} defaults={defaults} disabled={disabled}
                        forceIdentityOpen={identityRequested} onIdentityOpened={() => setIdentityRequested(false)}
                        onChange={updateEdits} />
                ) : null}

                <View style={{ gap: 8 }}>
                    <AddCandidateToInventoryAction card={card} hasUnsavedReview={hasEdits}
                        draftReady={review !== null} disabled={!canMutate || authorityChanged}
                        isOffline={isOffline} pending={addPending} outcome={addOutcome}
                        onAdd={async () => {
                            if (!review) return undefined;
                            const result = await onAdd(card, mountedEdits, review);
                            if (result && typeof result === 'object' && 'status' in result
                                && result.status === 'succeeded') clearEdits();
                            return result;
                        }} />
                    {card.allowedActions.includes('view_metadata') ? (
                        <Button title="View metadata" variant="secondary" onPress={() => setMetadataOpen(true)}
                            accessibilityHint="Opens bounded metadata details for this book" />
                    ) : null}
                    <Button title="Open full correction" variant="secondary" onPress={onOpenFullCorrection}
                        accessibilityHint="Opens the existing full review for deep corrections" />
                    {card.allowedActions.includes('remove_from_scan') ? (
                        <>
                            <Button title="Remove from this scan" variant="ghost" onPress={() => setConfirmOpen(true)}
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
                    updateEdits(edits); setMetadataOpen(false); setEditingOpen(true); setIdentityRequested(true);
                }} /> : null}
        </GlassCard>
    );
}
