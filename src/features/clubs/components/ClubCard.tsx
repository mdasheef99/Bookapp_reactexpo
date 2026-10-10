import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { bookCovers, colors, radii, typography } from '../theme';
import { type AccessLevel, type ClubPublicDetails, type ClubType, type MeetingType } from '../services/clubsService';

const CLUB_TYPE_LABELS: Record<ClubType, string> = {
    public: 'Public',
    approval: 'Approval',
    invite_only: 'Invite only',
    author_club: 'Author-led',
};

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
    online_only: 'Online',
    venue_based: 'In-person venue',
    hybrid: 'Hybrid',
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
    all: 'All members',
    pro: 'Pro',
    pro_plus: 'Pro+',
};

interface ClubCardProps {
    club: ClubPublicDetails;
    onPress: (club: ClubPublicDetails) => void;
}

export function ClubCard({ club, onPress }: ClubCardProps) {
    const hostName = club.author_display_name?.trim() || club.admin_display_name?.trim() || null;
    const hostAvatarUrl = club.author_avatar_url || club.admin_avatar_url || null;
    const isAuthorClub = club.club_type === 'author_club';
    const bookAuthors = (club.current_book_authors ?? []).filter((author) => author.trim().length > 0);
    const city = club.admin_city || club.author_city || null;
    const memberCountLabel = club.member_count === null
        ? null
        : club.member_count + (club.member_count === 1 ? ' member' : ' members');

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={'Open ' + club.name}
            accessibilityHint="Opens club details"
            onPress={() => onPress(club)}
            style={styles.card}
            testID={'club-card-' + club.id}
        >
            <View style={styles.topMeta}>
                <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{CLUB_TYPE_LABELS[club.club_type]}</Text>
                    </View>
                    {club.meeting_type ? (
                        <View style={styles.formatBadge}>
                            <Ionicons
                                name={club.meeting_type === 'online_only' ? 'globe-outline' : 'location-outline'}
                                size={13}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.formatBadgeText}>{MEETING_TYPE_LABELS[club.meeting_type]}</Text>
                        </View>
                    ) : null}
                </View>
                {memberCountLabel ? (
                    <View style={styles.memberMeta}>
                        <Ionicons name="people-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.memberMetaText}>{memberCountLabel}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.titleRow}>
                {club.cover_url ? (
                    <Image source={{ uri: club.cover_url }} style={styles.clubCover} contentFit="cover" transition={200} />
                ) : (
                    <View style={styles.clubCoverFallback}>
                        <Ionicons name="book-outline" size={22} color={colors.accent} />
                    </View>
                )}
                <View style={styles.titleBlock}>
                    <Text style={styles.clubTitle} numberOfLines={2}>{club.name}</Text>
                    {isAuthorClub && club.author_display_name ? (
                        <Text style={styles.verifiedHost} numberOfLines={1}>
                            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                            {' '}Author-led club
                        </Text>
                    ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>

            {club.description ? (
                <Text style={styles.description} numberOfLines={3}>{club.description}</Text>
            ) : null}

            {hostName ? (
                <View style={styles.hostRow}>
                    {hostAvatarUrl ? (
                        <Image source={{ uri: hostAvatarUrl }} style={styles.hostAvatar} contentFit="cover" transition={200} />
                    ) : (
                        <View style={styles.hostAvatarFallback}>
                            <Ionicons name="person-outline" size={15} color={colors.textMuted} />
                        </View>
                    )}
                    <Text style={styles.hostLabel}>Hosted by</Text>
                    <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
                </View>
            ) : null}

            <View style={styles.currentBook}>
                <View style={styles.currentBookHeader}>
                    <Ionicons name="book-outline" size={14} color={colors.accent} />
                    <Text style={styles.currentBookLabel}>
                        {club.current_book_title ? 'Currently reading' : 'Current book'}
                    </Text>
                </View>
                {club.current_book_title ? (
                    <View style={styles.currentBookRow}>
                        {club.current_book_cover_url ? (
                            <Image
                                source={{ uri: club.current_book_cover_url }}
                                style={styles.bookCover}
                                contentFit="cover"
                                transition={200}
                            />
                        ) : (
                            <View style={styles.bookCoverFallback}>
                                <Ionicons name="book-outline" size={18} color={colors.textMuted} />
                            </View>
                        )}
                        <View style={styles.currentBookBody}>
                            <Text style={styles.currentBookTitle} numberOfLines={2}>{club.current_book_title}</Text>
                            {bookAuthors.length > 0 ? (
                                <Text style={styles.currentBookAuthors} numberOfLines={1}>{bookAuthors.join(', ')}</Text>
                            ) : null}
                        </View>
                    </View>
                ) : (
                    <Text style={styles.noCurrentBook}>No current book set</Text>
                )}
            </View>

            <View style={styles.footerMeta}>
                <View style={styles.accessBadge}>
                    <Text style={styles.accessBadgeText}>{ACCESS_LEVEL_LABELS[club.access_level ?? 'all']}</Text>
                </View>
                {city ? (
                    <View style={styles.cityMeta}>
                        <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.cityText} numberOfLines={1}>{city}</Text>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        gap: 12,
    },
    topMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    badgeRow: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
    },
    typeBadge: {
        minHeight: 28,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.accentSubtle,
        paddingHorizontal: 10,
    },
    typeBadgeText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 0.65,
        textTransform: 'uppercase',
        color: colors.accent,
    },
    formatBadge: {
        minHeight: 28,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        backgroundColor: colors.surfaceSubtle,
        paddingHorizontal: 9,
    },
    formatBadgeText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        lineHeight: 16,
        color: colors.textSecondary,
    },
    memberMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    memberMetaText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        lineHeight: 16,
        color: colors.textMuted,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    clubCover: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surfaceSubtle,
    },
    clubCoverFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.accentSubtle,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBlock: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    clubTitle: {
        fontFamily: 'Newsreader_700Bold',
        fontSize: 22,
        lineHeight: 27,
        color: colors.textPrimary,
    },
    verifiedHost: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        lineHeight: 16,
        color: colors.textSecondary,
    },
    description: {
        fontFamily: 'Inter_400Regular',
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },
    hostRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 32,
    },
    hostAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceSubtle,
    },
    hostAvatarFallback: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hostLabel: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        lineHeight: 16,
        color: colors.textMuted,
    },
    hostName: {
        flexShrink: 1,
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        lineHeight: 18,
        color: colors.textPrimary,
    },
    currentBook: {
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.large,
        backgroundColor: colors.surfaceSubtle,
        padding: 12,
    },
    currentBookHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    currentBookLabel: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        color: colors.accent,
    },
    currentBookRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    currentBookBody: {
        flex: 1,
        gap: 2,
    },
    currentBookTitle: {
        fontFamily: 'Newsreader_600SemiBold',
        fontSize: 18,
        lineHeight: 23,
        color: colors.textPrimary,
    },
    currentBookAuthors: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        lineHeight: 18,
        color: colors.textMuted,
    },
    noCurrentBook: {
        fontFamily: 'Inter_400Regular',
        fontSize: 13,
        lineHeight: 18,
        color: colors.textMuted,
    },
    footerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    accessBadge: {
        minHeight: 28,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 10,
    },
    accessBadgeText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 12,
        lineHeight: 16,
        color: colors.textSecondary,
    },
    cityMeta: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minWidth: 0,
    },
    cityText: {
        flexShrink: 1,
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        lineHeight: 16,
        color: colors.textMuted,
    },
});
