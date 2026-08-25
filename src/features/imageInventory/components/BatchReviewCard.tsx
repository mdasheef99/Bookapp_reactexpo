import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import { OwnerConfirmationDialog } from './OwnerConfirmationDialog';
import { AddCandidateToInventoryAction } from './AddCandidateToInventoryAction';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CandidateCommitOutcome } from '../commit/inventoryCommitCoordinator';
import type {
    ScanCondition,
    ScanSetupFormState,
} from '../scanSetup/scanSetupForm';

// Compact edits merge onto the complete saved strict review so hidden notes
// round-trip unchanged through the retained Save seam.
export function applyCompactEdits(
    savedReview: Record<string, unknown>,
    edits: CompactReviewEdits,
): Record<string, unknown> {
    return { ...savedReview, ...edits };
}

export function sourceBadgeLabel(code: string): string {
    switch (code) {
        case 'matched':
        case 'detected':
            return 'Detected';
        case 'default':
            return 'Default';
        case 'custom':
            return 'Custom';
        default:
            return 'Missing';
    }
}

const CONDITION_EDIT_CHOICES: ReadonlyArray<Readonly<{
    value: Exclude<ScanCondition, null>;
    label: string;
}>> = [
    { value: 'new', label: 'New' },
    { value: 'like_new', label: 'Like New' },
    { value: 'very_good', label: 'Very Good' },
    { value: 'good', label: 'Good' },
    { value: 'acceptable', label: 'Acceptable' },
];

export type CompactReviewEdits = Readonly<{
    baseCondition?: Exclude<ScanCondition, null>;
    quantity?: number;
    shelfLocation?: string;
}>;

// Canonical metadata-status presentation for every retained metadataState.
export function metadataStatusLabel(state: OwnerBatchReviewCard['metadataState']): string {
    switch (state) {
        case 'selected': return 'Matched';
        case 'manual': return 'Manual';
        case 'no_match': return 'No match';
        case 'pending': return 'Pending';
        default: return 'Needs attention';
    }
}

function Badge({ code }: { code: string }) {
    const { colors } = useTheme();
    return (
        <Text
            selectable
            accessibilityLabel={`Source ${sourceBadgeLabel(code)}`}
            style={{
                color: colors.textSecondary, fontSize: 12, fontWeight: '700',
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1,
                overflow: 'hidden',
            }}
        >
            {sourceBadgeLabel(code)}
        </Text>
    );
}

function FieldRow({
    label,
    value,
    sourceCode,
    localOverride = false,
    testSuffix,
}: {
    label: string;
    value: string;
    sourceCode: string | null;
    localOverride?: boolean;
    testSuffix: string;
}) {
    const { colors } = useTheme();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text selectable style={{ color: colors.textPrimary, flexShrink: 1 }}>
                {label}: {value}
            </Text>
            {localOverride && sourceCode !== 'custom' ? (
                <Text
                    selectable
                    testID={`card-${testSuffix}-overlay`}
                    accessibilityLabel="Unsaved Custom edit"
                    style={{
                        color: colors.textSecondary, fontSize: 12, fontWeight: '700',
                        borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                        paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden',
                    }}
                >
                    Custom
                </Text>
            ) : sourceCode !== null ? (
                <Badge code={sourceCode} />
            ) : null}
        </View>
    );
}

export function BatchReviewCard({
    card,
    defaults,
    isOffline,
    canMutate,
    removePending,
    addPending,
    addOutcome,
    onOpenFullCorrection,
    onRemove,
    onSaveEdits,
    onAdd,
    onDraftChange,
}: {
    card: OwnerBatchReviewCard;
    defaults: ScanSetupFormState;
    isOffline: boolean;
    canMutate: boolean;
    removePending: boolean;
    addPending: boolean;
    addOutcome?: CandidateCommitOutcome;
    onOpenFullCorrection: () => void;
    onRemove: (candidateId: string) => void;
    onSaveEdits: (
        candidateId: string,
        edits: CompactReviewEdits,
        expectedCandidateVersion: number,
        expectedMetadataRevision: number,
    ) => void;
    onAdd: (
        card: OwnerBatchReviewCard,
        edits: CompactReviewEdits,
    ) => Promise<unknown>;
    onDraftChange: (candidateId: string, edits: CompactReviewEdits) => void;
}) {
    const { colors } = useTheme();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [conditionPickerOpen, setConditionPickerOpen] = useState(false);
    // Mounted draft overrides are presentation-only; they never manufacture a
    // persisted server source, readiness, or commit eligibility.
    const [mountedEdits, setMountedEdits] = useState<CompactReviewEdits>({});
    const replaceMountedEdits = (next: CompactReviewEdits) => {
        setMountedEdits(next);
        onDraftChange(card.candidateId, next);
    };
    const editable = card.review !== null && card.reviewVersion !== null;
    // Identity precedence follows the approved contract order: saved custom ->
    // selected/accepted metadata -> observed detection. Raw observed values
    // must never override accepted selected metadata.
    const title = card.fieldSources.title === 'custom' && card.review
        ? card.review.originalTitle
        : card.metadataSummary?.title ?? card.observed.title;
    const authors = (
        card.fieldSources.authors === 'custom' && card.review
            ? card.review.authors
            : card.metadataSummary?.authors ?? card.observed.authors
    ).join(', ') || 'Author unknown';
    const conditionValue = mountedEdits.baseCondition
        ?? card.review?.baseCondition ?? null;
    const quantityValue = mountedEdits.quantity ?? card.review?.quantity ?? null;
    const locationValue = card.review?.shelfLocation ?? defaults.location ?? 'Not set';
    const priceMinor = card.review?.priceMinor ?? defaults.priceMinor ?? null;
    const priceLabel = priceMinor === null ? 'Not set' : `\u20B9${priceMinor / 100}`;

    const saveEdits = () => {
        if (!editable) return;
        onSaveEdits(
            card.candidateId,
            mountedEdits,
            card.candidateVersion,
            card.metadataRevision,
        );
        replaceMountedEdits({});
    };

    const attentionSummary = useMemo(() => {
        if (card.blockers.length === 0) return null;
        return `${card.blockers.length} item${card.blockers.length === 1 ? '' : 's'} need attention`;
    }, [card.blockers.length]);

    return (
        <GlassCard padding={16} borderRadius={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {card.metadataSummary?.coverReference ? (
                    <Image
                        source={{ uri: card.metadataSummary.coverReference }}
                        contentFit="cover"
                        accessibilityLabel={`Book ${card.ordinal} cover`}
                        style={{ width: 56, height: 72, borderRadius: 8 }}
                    />
                ) : (
                    <View
                        accessibilityLabel={`Book ${card.ordinal} cover placeholder`}
                        style={{
                            width: 56, height: 72, borderRadius: 8, borderWidth: 1,
                            borderColor: colors.border, alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>
                            No cover
                        </Text>
                    </View>
                )}
                <View style={{ flexShrink: 1 }}>
                    <Badge code={card.fieldSources.cover} />
                    <Text
                        selectable
                        accessibilityRole="header"
                        accessibilityLabel={`Book ${card.ordinal}. ${title}`}
                        style={{ color: colors.textPrimary, fontWeight: '800', marginTop: 4 }}
                    >
                        {card.ordinal}. {title}
                    </Text>
                    <Text selectable style={{ color: colors.textSecondary, marginTop: 2 }}>
                        {authors}
                    </Text>
                </View>
            </View>
            <View testID={`card-${card.candidateId}`} style={{ marginTop: 6 }}>
                <FieldRow
                    label="Metadata"
                    value={metadataStatusLabel(card.metadataState)}
                    sourceCode={null}
                    testSuffix="metadata-status"
                />
                <FieldRow
                    label="Title"
                    value={title}
                    sourceCode={card.fieldSources.title}
                    testSuffix="title"
                />
                <FieldRow
                    label="Authors"
                    value={authors}
                    sourceCode={card.fieldSources.authors}
                    testSuffix="authors"
                />
                <FieldRow
                    label="Condition"
                    value={conditionValue ?? 'Not set'}
                    sourceCode={card.fieldSources.condition}
                    localOverride={mountedEdits.baseCondition !== undefined}
                    testSuffix="condition"
                />
                <FieldRow
                    label="Price"
                    value={priceLabel}
                    sourceCode={card.fieldSources.price}
                    testSuffix="price"
                />
                <FieldRow
                    label="Quantity"
                    value={quantityValue === null ? 'Not set' : String(quantityValue)}
                    sourceCode={card.fieldSources.quantity}
                    localOverride={mountedEdits.quantity !== undefined}
                    testSuffix="quantity"
                />
                <FieldRow
                    label="Location"
                    value={locationValue}
                    sourceCode={card.fieldSources.location}
                    testSuffix="location"
                />
                <View testID="card-location-sources">
                    <FieldRow
                        label="Publication"
                        value={card.review?.publicationIntent
                            ?? defaults.publication ?? 'Not set'}
                        sourceCode={card.fieldSources.publication}
                        testSuffix="publication"
                    />
                </View>
                <FieldRow
                    label="Language"
                    value={card.observed.language}
                    sourceCode={card.fieldSources.language}
                    testSuffix="language"
                />
                <FieldRow
                    label="Damage"
                    value={card.review?.damageDisclosure
                        ? (card.review.damageDisclosure.hasDamage ? 'Has damage' : 'No damage')
                        : 'Not answered'}
                    sourceCode={card.fieldSources.damage}
                    testSuffix="damage"
                />
            </View>
            {attentionSummary ? (
                <Text
                    selectable
                    accessibilityLiveRegion="polite"
                    style={{ color: colors.error, marginTop: 8 }}
                >
                    {attentionSummary}
                </Text>
            ) : null}
            {!editable ? (
                <Text selectable style={{ color: colors.textSecondary, marginTop: 8 }}>
                    Open full correction to prepare this book before it can be finalized.
                </Text>
            ) : null}
            {editable && conditionPickerOpen ? (
                <View style={{ gap: 6, marginTop: 10 }}>
                    {CONDITION_EDIT_CHOICES.map((choice) => (
                        <Button
                            key={choice.value}
                            title={choice.label}
                            variant="secondary"
                            onPress={() => {
                                const next = { ...mountedEdits, baseCondition: choice.value };
                                replaceMountedEdits(next);
                                setConditionPickerOpen(false);
                            }}
                            disabled={!canMutate || isOffline}
                        />
                    ))}
                    <Button title="Cancel" onPress={() => setConditionPickerOpen(false)} />
                </View>
            ) : null}
            <View style={{ gap: 8, marginTop: 12 }}>
                {editable ? (
                    <>
                        <Button
                            title="Edit condition"
                            variant="secondary"
                            testID="card-condition-open"
                            onPress={() => setConditionPickerOpen(true)}
                            disabled={!canMutate || isOffline}
                        />
                        {Object.keys(mountedEdits).length > 0 ? (
                            <Button title="Save changes" onPress={saveEdits} disabled={isOffline} />
                        ) : null}
                    </>
                ) : null}
                <AddCandidateToInventoryAction
                    card={card}
                    hasUnsavedReview={Object.keys(mountedEdits).length > 0}
                    disabled={!canMutate}
                    isOffline={isOffline}
                    pending={addPending}
                    outcome={addOutcome}
                    onAdd={async () => {
                        const result = await onAdd(card, mountedEdits);
                        if (
                            result && typeof result === 'object'
                            && 'status' in result && result.status === 'succeeded'
                        ) replaceMountedEdits({});
                        return result;
                    }}
                />
                {card.allowedActions.includes('view_metadata') ? (
                    <Button
                        title="View metadata"
                        variant="secondary"
                        onPress={onOpenFullCorrection}
                        accessibilityHint="Opens the existing full review metadata entry"
                    />
                ) : null}
                <Button
                    title="Open full correction"
                    variant="secondary"
                    onPress={onOpenFullCorrection}
                    accessibilityHint="Opens the existing full review for deep corrections"
                />
                {card.allowedActions.includes('remove_from_scan') ? (
                    <>
                        <Button
                            title="Remove from this scan"
                            variant="ghost"
                            onPress={() => setConfirmOpen(true)}
                            disabled={!canMutate || isOffline || removePending}
                            accessibilityHint="Removes this detected book from this scan after confirmation. This is not a false detection."
                        />
                        <OwnerConfirmationDialog
                            visible={confirmOpen}
                            title="Remove this book from the scan?"
                            description="The detected book stays in the session history but leaves active review. No photo or existing inventory is deleted. This cannot be undone."
                            confirmLabel="Remove book from scan"
                            pending={removePending}
                            onCancel={() => setConfirmOpen(false)}
                            onConfirm={() => {
                                setConfirmOpen(false);
                                onRemove(card.candidateId);
                            }}
                        />
                    </>
                ) : null}
            </View>
        </GlassCard>
    );
}
