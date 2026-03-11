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
import { useBrowseClubs, useMyBrowseClubs } from '@/features/clubs/hooks/useClubs';
import { type AccessLevel, type ClubType, type ClubFilters, type ClubPublicDetails, type MeetingType } from '@/features/clubs/services/clubsService';

type BrowseScope = 'all' | 'mine';

const BROWSE_SCOPE_FILTERS: Array<{ label: string; value: BrowseScope }> = [
    { label: 'All clubs', value: 'all' },
    { label: 'My clubs', value: 'mine' },
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
    const activeBrowseQuery = browseScope === 'mine' ? myBrowseQuery : allBrowseQuery;
    const clubs = activeBrowseQuery.data ?? [];
    const { isLoading, isError, refetch, isRefetching } = activeBrowseQuery;

    const handleClubPress = (club: ClubPublicDetails) => {
        router.push(`/(tabs)/clubs/${club.id}`);
    };

    const scopeDescription = browseScope === 'mine'
        ? 'See the clubs where you already have an active reader seat.'
        : 'Discover public club details, browse current reads, and find your next reading community.';

    const emptyStateTitle = browseScope === 'mine' ? 'You have not joined any clubs yet' : 'No clubs matched this search';
    const emptyStateBody = browseScope === 'mine'
        ? 'Join a public club, apply to an approval club, or accept an invite-only club invitation to build your personal club shelf here.'
        : 'Try a different club type, meeting format, access tier, or search term to discover more communities.';
    const errorBody = browseScope === 'mine'
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
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Book clubs</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{scopeDescription}</Text>

                        <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Browse</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {BROWSE_SCOPE_FILTERS.map(({ label, value }) => renderFilterChip({
                                label,
                                value,
                                selectedValue: browseScope,
                                onPress: setBrowseScope,
                                testID: `clubs-filter-scope-${value}`,
                            }))}
                        </ScrollView>

                        {browseScope === 'mine' && !userId ? (
                            <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Sign in to view your clubs</Text>
                                <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>The My clubs view is tied to your current membership state, so it only appears for the signed-in reader account.</Text>
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
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Public club details, direct joins, approval applications, moderator/admin tools, and invite acceptance are live. Invitation revoke and read-state flows are still pending backend support.</Text>
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
    title: { fontSize: 30, fontWeight: '800', marginBottom: 8 },
    subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
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