import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { OwnerCandidatePage } from '../contracts/ownerUxContracts';

type CandidateSummary = OwnerCandidatePage['items'][number];

const metadataLabels: Record<CandidateSummary['metadataState'], string> = {
    pending: 'Preparing book details',
    selected: 'Book details matched',
    manual: 'Manual book details',
    no_match: 'Review details manually',
    ambiguous: 'Choose book details',
    temporarily_unavailable: 'Book details temporarily unavailable',
    failed: 'Review details manually',
};

export function candidateSessionCue(startedAt: string, expiresAt: string): string {
    const format = (value: string) => new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(value));
    return `Session from ${format(startedAt)} · expires ${format(expiresAt)}`;
}

export function CandidateCard({
    candidate,
    onPress,
}: {
    candidate: CandidateSummary;
    onPress: () => void;
}) {
    const { colors } = useTheme();
    const status = candidate.reviewReady
        ? 'Ready for next step'
        : candidate.candidateState === 'failed'
            ? 'Book could not be prepared'
            : 'Needs attention';
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Book ${candidate.ordinal}. ${candidate.title}. ${status}`}
            accessibilityHint="Opens the private candidate review"
            onPress={onPress}
            testID={`candidate-card-${candidate.candidateId}`}
            style={({ pressed }) => ({
                minHeight: 96,
                padding: 16,
                gap: 5,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                backgroundColor: colors.bgCard,
                opacity: pressed ? 0.75 : 1,
            })}
        >
            <Text selectable style={{ color: colors.textSecondary, fontWeight: '700' }}>
                Book {candidate.ordinal}
            </Text>
            <Text selectable style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '800' }}>
                {candidate.title}
            </Text>
            <Text selectable style={{ color: colors.textSecondary }}>
                {candidate.authors.length ? candidate.authors.join(', ') : 'Author not visible'}
            </Text>
            <View accessibilityLabel={`${metadataLabels[candidate.metadataState]}. ${status}`}>
                <Text selectable style={{ color: colors.textSecondary }}>
                    {metadataLabels[candidate.metadataState]} · {status}
                </Text>
            </View>
            <Text selectable style={{ color: colors.textSecondary }}>
                {candidateSessionCue(candidate.sessionStartedAt, candidate.sessionExpiresAt)}
            </Text>
        </Pressable>
    );
}
