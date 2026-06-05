import { router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ClubCard } from '@/features/clubs/components/ClubCard';
import { useBrowseClubs } from '@/features/clubs/hooks/useClubs';
import type { ClubPublicDetails } from '@/features/clubs/services/clubsService';

const AUTHOR_CLUB_FILTERS = {
    clubType: 'author_club' as const,
    limit: 50,
    offset: 0,
};

export function ClubAuthorsScreen() {
    const { colors } = useTheme();
    const { data, isLoading, isError, refetch, isRefetching } = useBrowseClubs(AUTHOR_CLUB_FILTERS);
    const clubs = data ?? [];

    const handleClubPress = (club: ClubPublicDetails) => {
        router.push(`/(tabs)/clubs/${club.id}`);
    };

    if (isLoading && clubs.length === 0) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Finding author clubs...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
            <FlatList
                data={clubs}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.contentContainer}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
                ListHeaderComponent={(
                    <View style={styles.headerSection}>
                        <View style={styles.titleRow}>
                            <View style={[styles.iconShell, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                <Ionicons name="mic-outline" size={20} color={colors.accent} />
                            </View>
                            <View style={styles.titleTextBlock}>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>Author clubs</Text>
                                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Verified author communities, AMA sessions, and signed-edition reads.</Text>
                            </View>
                        </View>
                        {isError ? (
                            <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                                <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Could not load author clubs</Text>
                                <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Refresh to fetch verified author communities from Supabase.</Text>
                            </View>
                        ) : null}
                    </View>
                )}
                renderItem={({ item }) => <ClubCard club={item} colors={colors} onPress={handleClubPress} />}
                ListEmptyComponent={isError ? null : (
                    <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>No author clubs yet</Text>
                        <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Verified author communities will appear here when they are available.</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '500' },
    contentContainer: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 120 },
    headerSection: { marginBottom: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    iconShell: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    titleTextBlock: { flex: 1 },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
    subtitle: { fontSize: 15, lineHeight: 21 },
    feedbackCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 6, marginBottom: 12 },
    feedbackTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
    feedbackBody: { fontSize: 13, lineHeight: 19 },
});
