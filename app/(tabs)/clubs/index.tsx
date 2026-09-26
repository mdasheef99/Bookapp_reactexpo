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
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ClubCard } from '@/features/clubs/components/ClubCard';
import { YourClubsCard } from '@/features/clubs/components/YourClubsCard';
import { ClubFiltersSheet } from '@/features/clubs/components/ClubFiltersSheet';
import { useBrowseClubs, useMyArchivedManagedClubs, useMyBrowseClubs, useMyClubInvitationInbox } from '@/features/clubs/hooks/useClubs';
import { useViewerMembershipTier } from '@/features/clubs/hooks/useViewerMembershipTier';
import { colors, radii, touchTarget, typography } from '@/features/clubs/theme';
import { type AccessLevel, type ClubType, type ClubFilters, type ClubPublicDetails, type MeetingType } from '@/features/clubs/services/clubsService';

type BrowseScope = 'all' | 'mine' | 'archived';

export default function ClubsBrowseScreen() {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [search, setSearch] = useState('');
    const [browseScope, setBrowseScope] = useState<BrowseScope>('all');
    const [selectedClubType, setSelectedClubType] = useState<ClubType | undefined>(undefined);
    const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | undefined>(undefined);
    const [selectedAccessLevel, setSelectedAccessLevel] = useState<AccessLevel | undefined>(undefined);
    const [filtersVisible, setFiltersVisible] = useState(false);

    const filters = useMemo<ClubFilters>(() => ({
        clubType: selectedClubType,
        meetingType: selectedMeetingType,
        accessLevel: selectedAccessLevel,
        search: search.trim() || undefined,
        limit: 20,
        offset: 0,
    }), [search, selectedAccessLevel, selectedClubType, selectedMeetingType]);

    const allBrowseQuery = useBrowseClubs(filters);
    const myBrowseQuery = useMyBrowseClubs(userId, filters, !!userId);
    const archivedBrowseQuery = useMyArchivedManagedClubs(userId, filters, browseScope === 'archived');
    const invitationInboxQuery = useMyClubInvitationInbox(userId);
    const { tier: viewerTier } = useViewerMembershipTier(userId);
    const activeBrowseQuery = browseScope === 'mine' ? myBrowseQuery : browseScope === 'archived' ? archivedBrowseQuery : allBrowseQuery;
    const clubs = activeBrowseQuery.data ?? [];
    const { isLoading, isError, refetch, isRefetching } = activeBrowseQuery;
    const unreadInvitationCount = (invitationInboxQuery.data ?? []).filter((invitation) => !invitation.read_at).length;
    const authorClubCount = clubs.filter((club) => club.club_type === 'author_club').length;
    const showAuthorSpotlight = browseScope === 'all' && !selectedClubType && authorClubCount > 0;
    const canCreateClub = !!userId && (viewerTier === 'pro' || viewerTier === 'pro_plus');
    const isMineScope = browseScope === 'mine';
    const hasActiveSearchOrFilters = search.trim().length > 0
        || selectedClubType !== undefined
        || selectedMeetingType !== undefined
        || selectedAccessLevel !== undefined;
    const activeFilterCount = [selectedClubType, selectedMeetingType, selectedAccessLevel]
        .filter((value) => value !== undefined).length;

    const handleClubPress = (club: ClubPublicDetails) => {
        router.push(browseScope === 'archived' ? `/(tabs)/clubs/${club.id}/manage?tab=lifecycle` : `/(tabs)/clubs/${club.id}`);
    };

    const handleResetFilters = () => {
        setSelectedClubType(undefined);
        setSelectedMeetingType(undefined);
        setSelectedAccessLevel(undefined);
    };

    const handleClearMineSearchAndFilters = () => {
        setSearch('');
        handleResetFilters();
    };

    const sectionTitle = browseScope === 'archived' ? 'Archived clubs' : isMineScope ? 'Your reading circles' : 'Clubs to explore';

    const emptyStateTitle = browseScope === 'archived'
        ? 'No archived clubs'
        : isMineScope
        ? (hasActiveSearchOrFilters
            ? (search.trim().length > 0 ? 'No clubs matched your search' : 'No clubs match these filters')
            : 'You have not joined any clubs yet')
        : 'No clubs matched this search';
    const emptyStateBody = browseScope === 'archived'
        ? 'Archived clubs you administer will appear here for restoration.'
        : isMineScope
        ? (hasActiveSearchOrFilters
            ? 'Try a different search term or adjust your filters to find more of your clubs.'
            : 'Join a public club, apply to an approval club, or accept an invite-only club invitation to build your personal club shelf here.')
        : 'Try a different club type, meeting format, access tier, or search term to discover more communities.';
    const errorBody = browseScope === 'archived'
        ? 'Try refreshing to fetch archived clubs you administer from Supabase.'
        : browseScope === 'mine'
        ? 'Try refreshing to fetch your latest membership-linked club list from Supabase.'
        : 'Try refreshing to fetch the latest public club list from Supabase.';

    if (isLoading && clubs.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={typography.metadata}>Finding active clubs…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={clubs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <View style={styles.headerSection}>
                        <View style={styles.header}>
                            <View style={styles.titleBlock}>
                                <Text style={typography.kicker}>BookConnect</Text>
                                <Text style={styles.pageTitle}>Clubs</Text>
                            </View>
                            <View style={styles.headerActions}>
                                {canCreateClub ? (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => router.push('/(tabs)/clubs/create')}
                                        style={styles.createButton}
                                        testID="clubs-create-club"
                                        accessibilityRole="button"
                                        accessibilityLabel="Create club"
                                    >
                                        <Ionicons name="add" size={18} color={colors.accent} />
                                        <Text style={styles.createButtonText}>Create Club</Text>
                                    </TouchableOpacity>
                                ) : null}
                                {userId ? (
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => router.push('/(tabs)/clubs/invitations')}
                                        style={styles.inboxButton}
                                        testID="clubs-invitations-inbox"
                                        accessibilityRole="button"
                                        accessibilityLabel={unreadInvitationCount > 0 ? `Club invitations, ${unreadInvitationCount} unread` : 'Club invitations'}
                                    >
                                        <Ionicons name="mail-outline" size={20} color={colors.textPrimary} />
                                        {unreadInvitationCount > 0 ? (
                                            <View style={styles.unreadBadge}>
                                                <Text style={styles.unreadBadgeText}>{unreadInvitationCount > 99 ? '99+' : unreadInvitationCount}</Text>
                                            </View>
                                        ) : null}
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.tabs}>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setBrowseScope('all')}
                                style={[styles.tab, browseScope === 'all' && styles.tabActive]}
                                testID="clubs-filter-scope-all"
                                accessibilityRole="tab"
                                accessibilityState={{ selected: browseScope === 'all' }}
                            >
                                <Text style={[styles.tabText, browseScope === 'all' && styles.tabTextActive]}>Discover</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setBrowseScope('mine')}
                                style={[styles.tab, browseScope === 'mine' && styles.tabActive]}
                                testID="clubs-filter-scope-mine"
                                accessibilityRole="tab"
                                accessibilityState={{ selected: browseScope === 'mine' }}
                            >
                                <Text style={[styles.tabText, browseScope === 'mine' && styles.tabTextActive]}>
                                    Your Clubs
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchRow}>
                            <View style={styles.searchShell}>
                                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                                <TextInput
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholder="Search clubs, books, hosts…"
                                    placeholderTextColor={colors.textMuted}
                                    style={styles.searchInput}
                                    testID="clubs-search-input"
                                    accessibilityLabel="Search clubs"
                                />
                            </View>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setFiltersVisible(true)}
                                style={[styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive]}
                                testID="clubs-filters-open"
                                accessibilityRole="button"
                                accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
                            >
                                <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? '#FFFFFF' : colors.accent} />
                                <Text style={[styles.filtersButtonText, activeFilterCount > 0 && styles.filtersButtonTextActive]}>Filters</Text>
                                {activeFilterCount > 0 ? (
                                    <View style={styles.filtersBadge} testID="clubs-filters-active-count">
                                        <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        </View>

                        {(browseScope === 'mine' || browseScope === 'archived') && !userId ? (
                            <View style={styles.feedbackCard}>
                                <Text style={styles.feedbackTitle}>Sign in to view your clubs</Text>
                                <Text style={typography.bodyCompact}>This view is tied to your current club membership and admin state, so it only appears for the signed-in reader account.</Text>
                            </View>
                        ) : null}

                        {showAuthorSpotlight ? (
                            <View style={styles.spotlight} testID="clubs-author-spotlight">
                                <View style={styles.spotlightIcon}>
                                    <Ionicons name="mic-outline" size={18} color={colors.accent} />
                                </View>
                                <View style={styles.spotlightBody}>
                                    <Text style={styles.spotlightTitle}>Author clubs spotlight</Text>
                                    <Text style={typography.metadata}>AMA-style discussions, signed-edition reads, and verified author communities.</Text>
                                    <Text style={styles.spotlightCount}>
                                        {authorClubCount === 1 ? '1 verified author club' : `${authorClubCount} verified author clubs`}
                                    </Text>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => router.push('/(tabs)/clubs/authors')}
                                        style={styles.spotlightLink}
                                        testID="author-clubs-landing-link"
                                        accessibilityRole="button"
                                        accessibilityLabel="View author clubs"
                                    >
                                        <Text style={styles.spotlightLinkText}>View author clubs</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}

                        {!isMineScope ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => router.push('/(tabs)/clubs/venues')}
                            style={styles.venueRow}
                            testID="clubs-venues-discovery-link"
                            accessibilityRole="button"
                            accessibilityLabel="Find club venues"
                        >
                            <View style={styles.venueIcon}>
                                <Ionicons name="location-outline" size={18} color={colors.accent} />
                            </View>
                            <View style={styles.venueBody}>
                                <Text style={styles.venueTitle}>Find club venues</Text>
                                <Text style={typography.metadata}>Explore libraries, bookstores, cafes, and community spaces where clubs can meet.</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        ) : null}

                        <View style={styles.sectionHeader}>
                            <Text style={typography.sectionHeading}>{sectionTitle}</Text>
                            {browseScope === 'archived' ? (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setBrowseScope('all')}
                                    hitSlop={12}
                                    testID="clubs-archived-back"
                                >
                                    <Text style={styles.backLink}>‹ Discover</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {isError ? (
                            <View style={styles.feedbackCard}>
                                <Text style={styles.feedbackTitle}>Couldn’t load clubs</Text>
                                <Text style={typography.bodyCompact}>{errorBody}</Text>
                                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} testID="clubs-retry">
                                    <Text style={styles.retryButtonText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                }
                renderItem={({ item }) => isMineScope
                    ? <YourClubsCard club={item} onPress={handleClubPress} />
                    : <ClubCard club={item} onPress={handleClubPress} />}
                ListEmptyComponent={
                    isError
                        ? null
                        : (isMineScope || browseScope === 'archived') && !userId
                        ? null
                        : (
                        <View style={styles.feedbackCard}>
                            <Text style={styles.feedbackTitle}>{emptyStateTitle}</Text>
                            <Text style={typography.bodyCompact}>{emptyStateBody}</Text>
                            {isMineScope && !hasActiveSearchOrFilters ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => setBrowseScope('all')}
                                    style={styles.emptyActionOutline}
                                    testID="clubs-mine-discover-link"
                                    accessibilityRole="button"
                                    accessibilityLabel="Discover clubs"
                                >
                                    <Text style={styles.emptyActionOutlineText}>Discover clubs</Text>
                                </TouchableOpacity>
                            ) : null}
                            {isMineScope && hasActiveSearchOrFilters ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={handleClearMineSearchAndFilters}
                                    style={styles.emptyAction}
                                    testID="clubs-mine-clear-filters"
                                    accessibilityRole="button"
                                    accessibilityLabel="Clear search and filters"
                                >
                                    <Text style={styles.emptyActionText}>Clear filters</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        )
                }
                ListFooterComponent={
                    browseScope === 'archived' ? null : (
                        <View>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => setBrowseScope('archived')}
                                style={styles.archivedRow}
                                testID="clubs-archived-link"
                                accessibilityRole="button"
                                accessibilityLabel="Archived clubs"
                            >
                                <Ionicons name="archive-outline" size={18} color={colors.textMuted} />
                                <View style={styles.archivedBody}>
                                    <Text style={styles.archivedTitle}>Archived clubs</Text>
                                    <Text style={typography.metadata}>Restore clubs you administer.</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                            {isMineScope ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() => router.push('/(tabs)/clubs/venues')}
                                    style={styles.secondaryRow}
                                    testID="clubs-venues-secondary-link"
                                    accessibilityRole="button"
                                    accessibilityLabel="Find club venues"
                                >
                                    <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                                    <Text style={styles.secondaryRowText}>Find club venues</Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    )
                }
            />

            <ClubFiltersSheet
                visible={filtersVisible}
                onClose={() => setFiltersVisible(false)}
                clubType={selectedClubType}
                meetingType={selectedMeetingType}
                accessLevel={selectedAccessLevel}
                onSelectClubType={setSelectedClubType}
                onSelectMeetingType={setSelectedMeetingType}
                onSelectAccessLevel={setSelectedAccessLevel}
                onReset={handleResetFilters}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    loadingContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', gap: 12 },
    contentContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
    headerSection: { marginBottom: 4 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
    titleBlock: { flex: 1, gap: 6 },
    pageTitle: {
        fontFamily: 'Newsreader_700Bold',
        fontSize: 36,
        lineHeight: 42,
        color: colors.textPrimary,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: touchTarget,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: radii.large,
        backgroundColor: colors.surface,
    },
    createButtonText: {
        color: colors.accent,
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
    },
    inboxButton: {
        width: touchTarget,
        height: touchTarget,
        borderRadius: radii.large,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        backgroundColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_700Bold' },
    tabs: {
        flexDirection: 'row',
        gap: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
        marginBottom: 16,
    },
    tab: {
        minHeight: touchTarget,
        justifyContent: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        marginBottom: -1,
        paddingHorizontal: 2,
    },
    tabActive: { borderBottomColor: colors.accent },
    tabText: {
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
        color: colors.textMuted,
    },
    tabTextActive: { color: colors.textPrimary },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    searchShell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.large,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
    },
    searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.textPrimary },
    filtersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 48,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: radii.large,
        backgroundColor: colors.surface,
    },
    filtersButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    filtersButtonText: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: colors.accent,
    },
    filtersButtonTextActive: { color: '#FFFFFF' },
    filtersBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filtersBadgeText: {
        color: colors.accent,
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
    },
    feedbackCard: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.large,
        backgroundColor: colors.surface,
        padding: 16,
        marginBottom: 14,
        gap: 6,
    },
    feedbackTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 17,
        lineHeight: 23,
        color: colors.textPrimary,
    },
    spotlightTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 16,
        lineHeight: 22,
        color: colors.textPrimary,
    },
    retryButton: {
        alignSelf: 'flex-start',
        marginTop: 8,
        minHeight: touchTarget,
        justifyContent: 'center',
        borderRadius: radii.medium,
        backgroundColor: colors.accent,
        paddingHorizontal: 16,
    },
    retryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
    emptyAction: {
        alignSelf: 'flex-start',
        marginTop: 8,
        minHeight: touchTarget,
        justifyContent: 'center',
        borderRadius: radii.medium,
        backgroundColor: colors.accent,
        paddingHorizontal: 16,
    },
    emptyActionText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    emptyActionOutline: {
        alignSelf: 'flex-start',
        marginTop: 8,
        minHeight: touchTarget,
        justifyContent: 'center',
        borderRadius: radii.medium,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
    },
    emptyActionOutlineText: {
        color: colors.accent,
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    spotlight: {
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.large,
        backgroundColor: colors.surface,
        padding: 16,
        marginBottom: 12,
    },
    spotlightIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.accentSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotlightBody: { flex: 1, gap: 3 },
    spotlightCount: {
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
        color: colors.accent,
        marginTop: 2,
    },
    spotlightLink: {
        alignSelf: 'flex-start',
        marginTop: 8,
        minHeight: touchTarget,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: 999,
        paddingHorizontal: 14,
    },
    spotlightLinkText: {
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
        color: colors.accent,
    },
    venueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radii.large,
        backgroundColor: colors.surface,
        padding: 14,
        marginBottom: 20,
    },
    venueIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.accentSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    venueBody: { flex: 1, gap: 2 },
    venueTitle: {
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
        color: colors.textPrimary,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 10,
    },
    backLink: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: colors.accent,
    },
    archivedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    archivedBody: { flex: 1, gap: 2 },
    archivedTitle: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: colors.textSecondary,
    },
    secondaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minHeight: touchTarget,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
    },
    secondaryRowText: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: colors.textSecondary,
    },
});
