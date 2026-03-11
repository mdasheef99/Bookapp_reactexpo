import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { type ThemeColors } from '@/hooks/useTheme';
import { type AccessLevel, type ClubPublicDetails, type ClubType, type MeetingType } from '../services/clubsService';

const CLUB_TYPE_LABELS: Record<ClubType, string> = {
    public: 'Public',
    approval: 'Approval',
    invite_only: 'Invite Only',
    author_club: 'Author Club',
};

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
    online_only: 'Online',
    venue_based: 'Venue',
    hybrid: 'Hybrid',
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
    all: 'All members',
    pro: 'Pro',
    pro_plus: 'Pro+',
};

interface ClubCardProps {
    club: ClubPublicDetails;
    colors: ThemeColors;
    onPress: (club: ClubPublicDetails) => void;
}

export function ClubCard({ club, colors, onPress }: ClubCardProps) {
    const coverUrl = club.cover_url || club.current_book_cover_url || 'https://via.placeholder.com/100x140?text=Club';
    const curatorName = club.author_display_name || club.admin_display_name || 'BookTalks Reader';

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => onPress(club)}
            style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            testID={`club-card-${club.id}`}
        >
            <Image source={{ uri: coverUrl }} style={styles.cover} contentFit="cover" transition={200} />

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={[styles.typeChip, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                        <Text style={[styles.typeChipText, { color: colors.accent }]}>{CLUB_TYPE_LABELS[club.club_type]}</Text>
                    </View>
                    <View style={styles.metaRow}>
                        <Ionicons name="people-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{club.member_count ?? 0}</Text>
                    </View>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{club.name}</Text>

                <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                    {club.description || 'A reader space for shared discussion, events, and book discoveries.'}
                </Text>

                <Text style={[styles.bookTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {club.current_book_title || 'No current book set yet'}
                </Text>

                <Text style={[styles.bookSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {club.current_book_authors?.join(', ') || `Hosted by ${curatorName}`}
                </Text>

                <View style={styles.footerRow}>
                    <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                            {club.meeting_type ? MEETING_TYPE_LABELS[club.meeting_type] : 'Flexible'}
                        </Text>
                    </View>

                    <View style={styles.metaRow}>
                        <Ionicons name="sparkles-outline" size={13} color={colors.textTertiary} />
                        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{ACCESS_LEVEL_LABELS[club.access_level ?? 'all']}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        gap: 14,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        marginHorizontal: 4,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    cover: {
        width: 88,
        height: 132,
        borderRadius: 12,
        backgroundColor: '#E2E8F0',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    typeChip: {
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    typeChipText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 6,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    bookTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 3,
    },
    bookSubtitle: {
        fontSize: 12,
        marginBottom: 10,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
});