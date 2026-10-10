import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { bookCovers, colors, radii, typography } from '../theme';
import { type AccessLevel, type ClubPublicDetails, type ClubType, type MeetingType } from '../services/clubsService';

const CLUB_TYPE_LABELS: Record<ClubType, string> = {
    public: 'Public club',
    approval: 'Approval club',
    invite_only: 'Invite-only club',
    author_club: 'Author club',
};

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
    online_only: 'Online',
    venue_based: 'In person',
    hybrid: 'Hybrid',
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
    all: 'All members',
    pro: 'Pro',
    pro_plus: 'Pro+',
};

interface YourClubsCardProps {
    club: ClubPublicDetails;
    onPress: (club: ClubPublicDetails) => void;
}

/**
 * Shelf-like Your Clubs presentation.
 *
 * Scope-specific to `browseScope === 'mine'` so the Discover row composition
 * stays untouched. Whole card is a single tap target into club detail with no
 * per-row actions; only supported membership/current-book fields are shown.
 */
export function YourClubsCard({ club, onPress }: YourClubsCardProps) {
    const hostName = club.author_display_name || club.admin_display_name || 'BookTalks Reader';
    const isAuthorClub = club.club_type === 'author_club';
    const memberCount = club.member_count ?? 0;
    const city = club.admin_city || club.author_city || null;
    const bookCoverUrl = club.current_book_cover_url || null;
    const bookAuthors = (club.current_book_authors ?? []).filter((author) => author.trim().length > 0);

    const metaParts = [
        `${memberCount} ${memberCount === 1 ? 'reader' : 'readers'}`,
        club.meeting_type ? MEETING_TYPE_LABELS[club.meeting_type] : 'Flexible',
        ACCESS_LEVEL_LABELS[club.access_level ?? 'all'],
    ];
    if (city) metaParts.push(city);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={club.name}
            onPress={() => onPress(club)}
            style={styles.card}
            testID={`your-club-card-${club.id}`}
        >
            <Text style={styles.kicker} numberOfLines={1}>
                {CLUB_TYPE_LABELS[club.club_type]}
                {isAuthorClub && club.author_display_name ? ' · Verified author' : ''}
            </Text>

            <Text style={typography.bookTitle} numberOfLines={2}>{club.name}</Text>

            {club.description ? (
                <Text style={styles.description} numberOfLines={2}>{club.description}</Text>
            ) : null}

            {club.current_book_title ? (
                <View style={styles.currentRead}>
                    {bookCoverUrl ? (
                        <Image source={{ uri: bookCoverUrl }} style={styles.bookCover} contentFit="cover" transition={200} />
                    ) : (
                        <View style={styles.bookCoverFallback}>
                            <Ionicons name="book-outline" size={20} color={colors.textMuted} />
                        </View>
                    )}
                    <View style={styles.currentReadBody}>
                        <Text style={styles.currentReadLabel}>Currently reading</Text>
                        <Text style={styles.currentReadTitle} numberOfLines={2}>{club.current_book_title}</Text>
                        <Text style={styles.currentReadMeta} numberOfLines={1}>
                            {bookAuthors.length > 0 ? bookAuthors.join(', ') : `Hosted by ${hostName}`}
                        </Text>
                    </View>
                </View>
            ) : (
                <Text style={styles.noCurrentBook}>No current book set</Text>
            )}

            {isAuthorClub && club.author_display_name && !club.current_book_title ? (
                <Text style={styles.currentReadMeta} numberOfLines={1}>
                    {`Hosted by verified author ${club.author_display_name}`}
                </Text>
            ) : null}

            <Text style={styles.meta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.large,
        padding: 16,
        marginBottom: 12,
        gap: 6,
    },
    kicker: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: colors.accent,
    },
    description: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },
    currentRead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 4,
        borderRadius: radii.medium,
        backgroundColor: colors.surfaceSubtle,
        padding: 12,
    },
    bookCover: {
        width: bookCovers.small.w,
        height: bookCovers.small.h,
        borderRadius: radii.small,
        backgroundColor: colors.surface,
    },
    bookCoverFallback: {
        width: bookCovers.small.w,
        height: bookCovers.small.h,
        borderRadius: radii.small,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    currentReadBody: {
        flex: 1,
        gap: 1,
    },
    currentReadLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: colors.textMuted,
    },
    currentReadTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 15,
        lineHeight: 21,
        color: colors.textPrimary,
    },
    currentReadMeta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        lineHeight: 18,
        color: colors.textMuted,
    },
    noCurrentBook: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        lineHeight: 20,
        color: colors.textMuted,
    },
    meta: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        lineHeight: 18,
        color: colors.textMuted,
        marginTop: 2,
    },
});
