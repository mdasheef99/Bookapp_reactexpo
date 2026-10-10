import { router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { ClubCard } from '@/features/clubs/components/ClubCard';
import { useBrowseClubs } from '@/features/clubs/hooks/useClubs';
import type { ClubPublicDetails } from '@/features/clubs/services/clubsService';

const colors = {
    bgPrimary: '#FAF6EE',
    bgCard: '#FFFEFC',
    bgSecondary: '#F8EBE7',
    border: '#E7DCD1',
    accent: '#8B322C',
    textPrimary: '#1A1412',
    textSecondary: '#6E645F',
} as const;

const AUTHOR_CLUB_FILTERS = {
    clubType: 'author_club' as const,
    limit: 50,
    offset: 0,
};

export function ClubAuthorsScreen() {
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
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Clubs" onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="back-button">
                                <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                            </TouchableOpacity>
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
                renderItem={({ item }) => <ClubCard club={item} onPress={handleClubPress} />}
                ListEmptyComponent={isError ? null : (
                    <View style={[styles.emptyState, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.bgSecondary }]}>
                            <Ionicons name="book-outline" size={24} color={colors.accent} />
                        </View>
                        <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>No author clubs yet</Text>
                        <Text style={[styles.feedbackBody, { color: colors.textSecondary, textAlign: 'center' }]}>Verified author communities will appear here when they are available.</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: colors.bgPrimary },
    loadingText: { color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
    contentContainer: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 112 },
    headerSection: { marginBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    iconShell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    titleTextBlock: { flex: 1 },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 30, lineHeight: 36, marginBottom: 3, color: colors.textPrimary },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: colors.textSecondary },
    feedbackCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 4, marginBottom: 14 },
    feedbackTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 20, lineHeight: 26, marginBottom: 6 },
    feedbackBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    emptyState: { alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 20, marginTop: 4, marginBottom: 14 },
    emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
});
