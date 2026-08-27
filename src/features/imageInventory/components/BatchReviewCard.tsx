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
    buildCompactReview, compactReviewDisplay, type CompactReviewEdits,
} from '../review/compactReviewDraft';
import type { ScanSetupFormState } from '../scanSetup/scanSetupForm';
import { AddCandidateToInventoryAction } from './AddCandidateToInventoryAction';
import { CandidateMetadataSheet } from './CandidateMetadataSheet';
import { CompactReviewEditors } from './CompactReviewEditors';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';

export { applyCompactEdits, type CompactReviewEdits } from '../review/compactReviewDraft';

export function sourceBadgeLabel(code: string): string {
    if (code === 'matched' || code === 'detected') return 'Detected';
    if (code === 'default') return 'Default';
    if (code === 'custom') return 'Custom';
    return 'Missing';
}

export function metadataStatusLabel(state: OwnerBatchReviewCard['metadataState']): string {
    if (state === 'selected') return 'Matched';
    if (state === 'manual') return 'Manual';
    if (state === 'no_match') return 'No match';
    if (state === 'pending') return 'Pending';
    return 'Needs attention';
}

function Badge({ code }: { code: string }) {
    const { colors } = useTheme();
    return <Text selectable accessibilityLabel={`Source ${sourceBadgeLabel(code)}`} style={{
        color: colors.textSecondary, fontSize: 12, fontWeight: '700',
        borderWidth: 1, borderColor: colors.border, borderRadius: 8,
        paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
    }}>{sourceBadgeLabel(code)}</Text>;
}

function FieldRow({ label, value, sourceCode, local, testSuffix }: {
    label: string; value: string; sourceCode: string | null;
    local?: boolean; testSuffix: string;
}) {
    const { colors } = useTheme();
    return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <Text selectable style={{ color: colors.textPrimary, flexShrink: 1 }}>{label}: {value}</Text>
        {local ? <Text selectable testID={`card-${testSuffix}-overlay`}
            accessibilityLabel="Unsaved Custom edit" style={{
                color: colors.textSecondary, fontSize: 12, fontWeight: '700',
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
            }}>Custom</Text> : sourceCode ? <Badge code={sourceCode} /> : null}
    </View>;
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
    const review = buildCompactReview(card, defaults, mountedEdits);
    const title = display.title;
    const authors = display.authors.join(', ') || 'Author unknown';
    const price = display.priceMinor === null ? 'Not set' : `\u20B9${display.priceMinor / 100}`;

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

    return <GlassCard padding={16} borderRadius={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {card.metadataSummary?.coverReference ? <Image
                source={{ uri: card.metadataSummary.coverReference }} contentFit="cover"
                accessibilityLabel={`Book ${card.ordinal} cover`}
                style={{ width: 56, height: 72, borderRadius: 8 }}
            /> : <View accessibilityLabel={`Book ${card.ordinal} cover placeholder`} style={{
                width: 56, height: 72, borderRadius: 8, borderWidth: 1,
                borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
            }}><Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>No cover</Text></View>}
            <View style={{ flexShrink: 1 }}>
                <Badge code={card.fieldSources.cover} />
                <Text selectable accessibilityRole="header"
                    accessibilityLabel={`Book ${card.ordinal}. ${title}`}
                    style={{ color: colors.textPrimary, fontWeight: '800', marginTop: 4 }}>
                    {card.ordinal}. {title}
                </Text>
                <Text selectable style={{ color: colors.textSecondary, marginTop: 2 }}>{authors}</Text>
            </View>
        </View>
        <View testID={`card-${card.candidateId}`} style={{ marginTop: 6 }}>
            <FieldRow label="Metadata" value={metadataStatusLabel(card.metadataState)} sourceCode={null} testSuffix="metadata-status" />
            <FieldRow label="Title" value={title} sourceCode={card.fieldSources.title} local={mountedEdits.originalTitle !== undefined} testSuffix="title" />
            <FieldRow label="Authors" value={authors} sourceCode={card.fieldSources.authors} local={mountedEdits.authors !== undefined} testSuffix="authors" />
            <FieldRow label="Condition" value={display.condition ?? 'Not set'} sourceCode={card.fieldSources.condition} local={mountedEdits.baseCondition !== undefined} testSuffix="condition" />
            <FieldRow label="Price" value={price} sourceCode={card.fieldSources.price} local={mountedEdits.priceMinor !== undefined} testSuffix="price" />
            <FieldRow label="Quantity" value={String(display.quantity)} sourceCode={card.fieldSources.quantity} local={mountedEdits.quantity !== undefined} testSuffix="quantity" />
            <View testID="card-location-sources">
                <FieldRow label="Location" value={display.location || 'Not set'} sourceCode={card.fieldSources.location} local={mountedEdits.shelfLocation !== undefined} testSuffix="location" />
                <FieldRow label="Publication" value={display.publication} sourceCode={card.fieldSources.publication} local={mountedEdits.publicationIntent !== undefined} testSuffix="publication" />
            </View>
            <FieldRow label="Language" value={display.language} sourceCode={card.fieldSources.language} local={mountedEdits.originalLanguage !== undefined} testSuffix="language" />
            <FieldRow label="Damage" value={display.damage.hasDamage ? 'Has damage' : 'No damage'} sourceCode={card.fieldSources.damage} local={mountedEdits.damageDisclosure !== undefined} testSuffix="damage" />
        </View>
        {attention ? <Text selectable accessibilityLiveRegion="polite"
            style={{ color: colors.error, marginTop: 8 }}>{attention}</Text> : null}
        {authorityChanged ? <View style={{ gap: 6, marginTop: 10 }} testID="compact-authority-changed">
            <Text selectable style={{ color: colors.error }}>The saved review changed while compact edits were open. Choose which draft to continue with.</Text>
            <Button title="Use latest saved review" variant="secondary" onPress={() => {
                clearEdits(); acceptedAuthority.current = authorityKey; setAuthorityChanged(false);
            }} />
            <Button title="Reapply compact edits" variant="secondary" onPress={() => {
                acceptedAuthority.current = authorityKey; setAuthorityChanged(false);
            }} />
        </View> : null}
        {!editable ? <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>
            Open full correction to prepare this book before it can be finalized.
        </Text> : null}
        {editable ? <CompactReviewEditors values={display} defaults={defaults} disabled={disabled}
            forceIdentityOpen={identityRequested} onIdentityOpened={() => setIdentityRequested(false)}
            onChange={updateEdits} /> : null}
        <View style={{ gap: 8, marginTop: 12 }}>
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
            {card.allowedActions.includes('view_metadata') ? <Button title="View metadata"
                variant="secondary" onPress={() => setMetadataOpen(true)}
                accessibilityHint="Opens bounded metadata details for this book" /> : null}
            <Button title="Open full correction" variant="secondary" onPress={onOpenFullCorrection}
                accessibilityHint="Opens the existing full review for deep corrections" />
            {card.allowedActions.includes('remove_from_scan') ? <>
                <Button title="Remove from this scan" variant="ghost" onPress={() => setConfirmOpen(true)}
                    disabled={!canMutate || isOffline || removePending}
                    accessibilityHint="Removes this detected book from this scan after confirmation. This is not a false detection." />
                <OwnerConfirmationDialog visible={confirmOpen} title="Remove this book from the scan?"
                    description="The detected book stays in the session history but leaves active review. No photo or existing inventory is deleted. This cannot be undone."
                    confirmLabel="Remove book from scan" pending={removePending}
                    onCancel={() => setConfirmOpen(false)} onConfirm={() => {
                        setConfirmOpen(false); onRemove(card.candidateId);
                    }} />
            </> : null}
        </View>
        {metadataOpen ? <CandidateMetadataSheet identity={identity} card={card} visible
            disabled={disabled} onClose={() => setMetadataOpen(false)}
            onUseDetected={(edits) => { updateEdits(edits); setMetadataOpen(false); }}
            onEditManually={(edits) => {
                updateEdits(edits); setMetadataOpen(false); setIdentityRequested(true);
            }} /> : null}
    </GlassCard>;
}
