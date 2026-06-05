import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ClubCard } from '@/features/clubs/components/ClubCard';
import { useBrowseClubs, useMyArchivedManagedClubs, useMyBrowseClubs, useMyClubInvitationInbox } from '@/features/clubs/hooks/useClubs';
import { type AccessLevel, type ClubType, type ClubFilters, type ClubPublicDetails, type MeetingType } from '@/features/clubs/services/clubsService';

type BrowseScope = 'all' | 'mine' | 'archived';

const BROWSE_SCOPE_FILTERS: Array<{ label: string; value: BrowseScope }> = [
    { label: 'All clubs', value: 'all' },
    { label: 'My clubs', value: 'mine' },
    { label: 'Archived', value: 'archived' },
];

const CLUB_TYPE_FILTERS: Array<{ label: string; value?: ClubType }> = [
    { label: 'All clubs' },
    { label: 'Public', value: 'public' },
    { label: 'Approval', value: 'approval' },
    { label: 'Invite only', value: 'invite_only' },
    { label: 'Author clubs', value: 'author_club' },
];

const MEETING_TYPE_FILTERS: Array<{ label: string; value?: MeetingType }> = [
    { label: 'Any format' },
    { label: 'Online', value: 'online_only' },
    { label: 'Venue', value: 'venue_based' },
    { label: 'Hybrid', value: 'hybrid' },
];

const ACCESS_LEVEL_FILTERS: Array<{ label: string; value?: AccessLevel }> = [
    { label: 'All access' },
    { label: 'All members', value: 'all' },
    { label: 'Pro', value: 'pro' },
    { label: 'Pro+', value: 'pro_plus' },
];

export default function ClubsBrowseScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [search, setSearch] = useState('');
    const [browseScope, setBrowseScope] = useState<BrowseScope>('all');
    const [selectedClubType, setSelectedClubType] = useState<ClubType | undefined>(undefined);
    const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | undefined>(undefined);
    const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel | undefined>(undefined);

    const filters = useMemo<ClubFilters>(() => ({
        clubType: selectedClubType,
        meetingType: selectedMeetingType,
        accessLevel: selectedAccessLevel,
        search: search.trim() || undefined,
        limit: 20,
        offset: 0,
    }), [search, selectedAccessLevel, selectedClubType, selectedMeetingType]);

    const allBrowseQuery = useBrowseClubs(filters);
    const myBrowseQuery = useMyBrowseClubs(userId, filters, browseScope === 'mine');
    const archivedBrowseQuery = useMyArchivedManagedClubs(userId, filters, browseScope === 'archived');
    const invitationInboxQuery = useMyClubInvitationInbox(userId);
    const activeBrowseQuery = browseScope === 'mine' ? myBrowseQuery : browseScope === 'archived' ? archivedBrowseQuery : allBrowseQuery;
    const clubs = activeBrowseQuery.data ?? [];
    const { isLoading, isError, refetch, isRefetching } = activeBrowseQuery;
    const unreadInvitationCount = (invitationInboxQuery.data ?? []).filter((invitation) => !invitation.read_at).length;
    const authorClubCount = clubs.filter((club) => club.club_type === 'author_club').length;
    const showAuthorSpotlight = browseScope === 'all' && !selectedClubType && authorClubCount > 0;

    const handleClubPress = (club: ClubPublicDetails) => {
        router.push(browseScope === 'archived' ? `/(tabs)/clubs/${club.id}/manage?tab=lifecycle` : `/(tabs)/clubs/${club.id}`);
    };

    const scopeDescription = browseScope === 'archived'
        ? 'Restore clubs you administer after they have been archived.'
        : browseScope === 'mine'
        ? 'See the clubs where you already have an active reader seat.'
        : 'Discover public club details, browse current reads, and find your next reading community.';

    const emptyStateTitle = browseScope === 'archived' ? 'No archived clubs' : browseScope === 'mine' ? 'You have not joined any clubs yet' : 'No clubs matched this search';
    const emptyStateBody = browseScope === 'archived'
        ? 'Archived clubs you administer will appear here for restoration.'
        : browseScope === 'mine'
        ? 'Join a public club, apply to an approval club, or accept an invite-only club invitation to build your personal club shelf here.'
        : 'Try a different club type, meeting format, access tier, or search term to discover more communities.';
    const errorBody = browseScope === 'archived'
        ? 'Try refreshing to fetch archived clubs you administer from Supabase.'
        : browseScope === 'mine'
        ? 'Try refreshing to fetch your latest membership-linked club list from Supabase.'
        : 'Try refreshing to fetch the latest public club list from Supabase.';

    const renderFilterChip = <T extends string,>({
        label,
        value,
        selectedValue,
        onPress,
        testID,
    }: {
        label: string;
        value?: T;
        selectedValue?: T;
        onPress: (nextValue?: T) => void;
        testID: string;
    }) => {
        const selected = value === selectedValue || (!value && !selectedValue);
        return (
            <TouchableOpacity
                key={label}
                activeOpacity={0.85}
                onPress={() => onPress(value)}
                style={[
                    styles.filterChip,
                    {
                        backgroundColor: selected ? colors.accent : colors.bgCard,
                        borderColor: selected ? colors.accent : colors.border,
                    },
                ]}
                testID={testID}
            >
                <Text style={[styles.filterChipText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    if (isLoading && clubs.length === 0) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}> 
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding active clubs…</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}> 
            <FlatList
                data={clubs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <View style={styles.headerSection}>
                        <View style={styles.titleRow}>
                            <View style={styles.titleTextBlock}>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>Book clubs</Text>
                            </View>
                            {userId ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => router.push('/(tabs)/clubs/invitations')}
                                    style={[styles.inboxButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                                    testID="clubs-invitations-inbox"
                                >
                                    <Ionicons name="mail-outline" size={20} color={colors.textPrimary} />
                                    {unreadInvitationCount > 0 ? (
                                        <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
                                            <Text style={styles.unreadBadgeText}>{unreadInvitationCount > 99 ? '99+' : unreadInvitationCount}</Text>
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{scopeDescription}</Text>

                        {showAuthorSpotlight ? (
                            <View style={[styles.authorSpotlight, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="clubs-author-spotlight">
                                <View style={styles.authorSpotlightIcon}>
                                    <Ionicons name="mic-outline" size={18} color={colors.accent} />
                                </View>
                                <View style={styles.authorSpotlightBody}>
                                    <Text style={[styles.authorSpotlightTitle, { color: colors.textPrimary }]}>Author clubs spotlight</Text>
                                    <Text style={[styles.authorSpotlightText, { color: colors.textSecondary }]}>AMA-style discussions, signed-edition reads, and verified author communities.</Text>
                                    <Text style={[styles.authorSpotlightCount, { color: colors.accent }]}>
                                        {authorClubCount === 1 ? '1 verified author club' : `${authorClubCount} verified author clubs`}
                                    </Text>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => router.push('/(tabs)/clubs/authors')}
                                        style={[styles.authorSpotlightLink, { borderColor: colors.accent }]}
                                        testID="author-clubs-landing-link"
                                    >
                                        <Text style={[styles.authorSpotlightLinkText, { color: colors.accent }]}>View author clubs</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}

                        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Browse</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {BROWSE_SCOPE_FILTERS.map(({ label, value }) => renderFilterChip({
                                label,
                                value,
                                selectedValue: browseScope,
                                onPress: (nextValue) => {
                                    if (nextValue) setBrowseScope(nextValue);
                                },
                                testID: `clubs-filter-scope-${value}`,
                            }))}
                        </ScrollView>

                        {(browseScope === 'mine' || browseScope === 'archived') && !userId ? (
                            <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Sign in to view your clubs</Text>
                                <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>This view is tied to your current club membership and admin state, so it only appears for the signed-in reader account.</Text>
                            </View>
                        ) : null}

                        <View style={[styles.searchShell, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                            <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search club, host, author, or current book"
                                placeholderTextColor={colors.textTertiary}
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                testID="clubs-search-input"
                            />
                        </View>

                        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Club type</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {CLUB_TYPE_FILTERS.map(({ label, value }) => renderFilterChip({
                                label,
                                value,
                                selectedValue: selectedClubType,
                                onPress: setSelectedClubType,
                                testID: `clubs-filter-type-${value ?? 'all'}`,
                            }))}
                        </ScrollView>

                        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Meeting format</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {MEETING_TYPE_FILTERS.map(({ label, value }) => renderFilterChip({
                                label,
                                value,
                                selectedValue: selectedMeetingType,
                                onPress: setSelectedMeetingType,
                                testID: `clubs-filter-meeting-${value ?? 'all'}`,
                            }))}
                        </ScrollView>

                        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Access</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {ACCESS_LEVEL_FILTERS.map(({ label, value }) => renderFilterChip({
                                label,
                                value,
                                selectedValue: selectedAccessLevel,
                                onPress: setSelectedAccessLevel,
                                testID: `clubs-filter-access-${value ?? 'all'}`,
                            }))}
                        </ScrollView>

                        <View style={[styles.infoBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Public club details, direct joins, approval applications, moderator/admin tools, invite acceptance, invitation revocation, read-state support, and archived-club recovery are live.</Text>
                        </View>

                        {isError ? (
                            <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                                <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Couldn’t load clubs</Text>
                                <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>{errorBody}</Text>
                                <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}>
                                    <Text style={styles.retryButtonText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                }
                renderItem={({ item }) => <ClubCard club={item} colors={colors} onPress={handleClubPress} />}
                ListEmptyComponent={
                    isError ? null : (
                        <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}> 
                            <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>{emptyStateTitle}</Text>
                            <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>{emptyStateBody}</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '500' },
    contentContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },
    headerSection: { marginBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    titleTextBlock: { flex: 1 },
    title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
    authorSpotlight: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        flexDirection: 'row',
        gap: 12,
    },
    authorSpotlightIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    authorSpotlightBody: { flex: 1, gap: 3 },
    authorSpotlightTitle: { fontSize: 15, fontWeight: '800' },
    authorSpotlightText: { fontSize: 13, lineHeight: 18 },
    authorSpotlightCount: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    authorSpotlightLink: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginTop: 6,
    },
    authorSpotlightLinkText: { fontSize: 12, fontWeight: '800' },
    inboxButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    searchShell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 14,
    },
    searchInput: { flex: 1, fontSize: 15 },
    filterLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 2 },
    filterRow: { gap: 10, paddingBottom: 8 },
    filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    filterChipText: { fontSize: 13, fontWeight: '600' },
    infoBanner: {
        marginTop: 14,
        marginBottom: 14,
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        flexDirection: 'row',
        gap: 10,
    },
    infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
    feedbackCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    feedbackTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    feedbackBody: { fontSize: 14, lineHeight: 20 },
    retryButton: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    retryButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
