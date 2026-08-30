import { Modal, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerBatchReviewCard } from '../contracts/ownerBatchReviewContracts';
import type { CompactReviewEdits } from '../review/compactReviewDraft';
import {
    type ImageInventoryIdentity,
    useOwnerInventoryCandidate,
} from '../queries/ownerUxQueries';

const stateLabels = {
    selected: 'Provider metadata selected',
    manual: 'Manual metadata',
    no_match: 'No provider match',
    ambiguous: 'Multiple possible matches',
    pending: 'Metadata processing',
    temporarily_unavailable: 'Metadata temporarily unavailable',
    failed: 'Metadata failed',
} as const;

function MetadataValue({ label, value }: { label: string; value: string | number | null }) {
    const { colors } = useTheme();
    if (value === null || value === '') return null;
    return (
        <Text selectable style={{ color: colors.textPrimary }}>
            {label}: {String(value)}
        </Text>
    );
}

export function CandidateMetadataSheet({
    identity,
    card,
    visible,
    disabled,
    onClose,
    onUseDetected,
    onEditManually,
}: {
    identity: ImageInventoryIdentity;
    card: OwnerBatchReviewCard;
    visible: boolean;
    disabled: boolean;
    onClose: () => void;
    onUseDetected: (edits: CompactReviewEdits) => void;
    onEditManually: (edits: CompactReviewEdits) => void;
}) {
    const { colors } = useTheme();
    const query = useOwnerInventoryCandidate(
        identity,
        card.sessionId,
        card.candidateId,
        visible,
    );
    const detail = query.data;
    const snapshot = detail?.metadata.snapshot ?? null;
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            accessibilityViewIsModal
        >
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }}>
                <GlassCard padding={20} borderRadius={18}>
                    <ScrollView contentContainerStyle={{ gap: 8 }}>
                        <Text selectable accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800' }}>
                            Book metadata
                        </Text>
                        <Text selectable style={{ color: colors.textSecondary }}>
                            Status: {stateLabels[card.metadataState]}
                        </Text>
                        {query.isLoading ? (
                            <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>
                                Loading metadata…
                            </Text>
                        ) : query.error || !detail ? (
                            <>
                                <Text selectable accessibilityLiveRegion="assertive" style={{ color: colors.error }}>
                                    Metadata details are unavailable right now.
                                </Text>
                                <Button title="Retry metadata" variant="secondary" onPress={() => { void query.refetch(); }} />
                            </>
                        ) : (
                            <>
                                {snapshot ? (
                                    <View style={{ gap: 4 }} testID="selected-metadata-details">
                                        {snapshot.coverReference ? (
                                            <Image
                                                source={{ uri: snapshot.coverReference }}
                                                contentFit="contain"
                                                accessible
                                                accessibilityRole="image"
                                                accessibilityLabel={`Cover for ${snapshot.title}`}
                                                style={{ width: 120, height: 180, alignSelf: 'center', borderRadius: 8 }}
                                            />
                                        ) : null}
                                        <MetadataValue label="Title" value={snapshot.title} />
                                        <MetadataValue label="Subtitle" value={snapshot.subtitle} />
                                        <MetadataValue label="Authors" value={snapshot.authors.join(', ')} />
                                        <MetadataValue label="Description" value={snapshot.description} />
                                        <MetadataValue label="Language" value={snapshot.language} />
                                        <MetadataValue label="ISBN-10" value={snapshot.isbn10} />
                                        <MetadataValue label="ISBN-13" value={snapshot.isbn13} />
                                        <MetadataValue label="Publisher" value={snapshot.publisher} />
                                        <MetadataValue label="Published" value={snapshot.publishedDate} />
                                        <MetadataValue label="Edition" value={snapshot.editionStatement} />
                                        <MetadataValue label="Volume" value={snapshot.volume} />
                                        <MetadataValue label="Format" value={snapshot.format} />
                                        <MetadataValue label="Page count" value={snapshot.pageCount} />
                                        <MetadataValue label="Categories / genre" value={snapshot.categories.join(', ')} />
                                        <MetadataValue label="Source" value="Selected metadata" />
                                    </View>
                                ) : (
                                    <Text selectable testID="metadata-no-selected-details" style={{ color: colors.textSecondary }}>
                                        No selected metadata details are available. Detected identity remains available for manual review.
                                    </Text>
                                )}
                                <View style={{ gap: 4 }}>
                                    <Text selectable style={{ color: colors.textPrimary, fontWeight: '700' }}>Detected details</Text>
                                    <MetadataValue label="Detected title" value={detail.observed.title} />
                                    <MetadataValue label="Detected authors" value={detail.observed.authors.join(', ') || 'Author unknown'} />
                                    <MetadataValue label="Detected language" value={detail.observed.language} />
                                </View>
                                <Button
                                    title="Use detected details"
                                    onPress={() => onUseDetected({
                                        originalTitle: detail.observed.title,
                                        authors: [...detail.observed.authors],
                                        originalLanguage: detail.observed.language,
                                        script: detail.observed.script,
                                        metadataChoice: { mode: 'manual', selectionId: null },
                                    })}
                                    disabled={disabled}
                                />
                                <Button
                                    title="Edit manually"
                                    variant="secondary"
                                    onPress={() => onEditManually({
                                        metadataChoice: { mode: 'manual', selectionId: null },
                                    })}
                                    disabled={disabled}
                                />
                            </>
                        )}
                        <Button title="Close metadata" variant="secondary" onPress={onClose} />
                    </ScrollView>
                </GlassCard>
            </View>
        </Modal>
    );
}
