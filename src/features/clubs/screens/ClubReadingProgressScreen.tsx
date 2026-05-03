import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
    useClubCurrentBookStatusOverview,
    useSetClubCurrentBookReadingStatus,
    useClubPublicDetail,
} from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import type { ClubCurrentBookReadingStatus } from '@/features/clubs/services/clubsService';

const CURRENT_BOOK_STATUS_LABELS: Record<ClubCurrentBookReadingStatus, string> = {
    want_to_read: 'Want to Read',
    reading: 'Reading',
    completed: 'Completed',
};

export default function ClubReadingProgressScreen(): JSX.Element {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;

    const { data: club, isLoading: isClubLoading, isError: isClubError, error: clubError } = useClubPublicDetail(clubId);
    const {
        data: statusOverview,
        isLoading: isStatusLoading,
        isError: isStatusError,
        error: statusError,
    } = useClubCurrentBookStatusOverview(clubId, userId);

    const setStatusMutation = useSetClubCurrentBookReadingStatus();

    const handleStatusChange = async (status: ClubCurrentBookReadingStatus) => {
        if (!clubId) return;
        try {
            await setStatusMutation.mutateAsync({ clubId, status });
        } catch {
            // Error is surfaced via isError on the mutation; optimistic updates are not used here.
        }
    };

    if (isClubLoading || isStatusLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} testID="loading-indicator" />
            </View>
        );
    }

    if (isClubError || !club) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load club</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(clubError, 'Unable to load this club right now.')}</Text>
            </View>
        );
    }

    if (isStatusError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}>
                <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Unable to load reading progress</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(statusError, 'Unable to load reading progress right now.')}</Text>
            </View>
        );
    }

    const hasBook = !!club.current_book_id;
    const currentStatus = statusOverview?.member_reading_status ?? 'want_to_read';

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Reading Progress</Text>
                <View style={styles.headerSpacer} />
            </View>

            {!hasBook ? (
                <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>No current book</Text>
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                        This club does not have a current book selected yet. Check back once an admin sets one.
                    </Text>
                </View>
            ) : (
                <>
                    <View style={[styles.bookCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Image
                            source={{ uri: club.current_book_cover_url || 'https://via.placeholder.com/120x180?text=Book' }}
                            style={styles.bookCover}
                            contentFit="cover"
                            transition={200}
                        />
                        <View style={styles.bookInfo}>
                            <Text style={[styles.bookTitle, { color: colors.textPrimary }]}>{club.current_book_title || 'Untitled'}</Text>
                            <Text style={[styles.bookAuthors, { color: colors.textSecondary }]}>{club.current_book_authors?.join(', ') || 'Author information unavailable'}</Text>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={[styles.statCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.active_member_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active members</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.to_start_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>To start</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.reading_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reading</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.completed_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
                        </View>
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Your reading status</Text>
                        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                            Current: {CURRENT_BOOK_STATUS_LABELS[currentStatus]}
                        </Text>
                        <View style={styles.statusRow}>
                            {(['want_to_read', 'reading', 'completed'] as ClubCurrentBookReadingStatus[]).map((status) => {
                                const isSelected = currentStatus === status;
                                return (
                                    <TouchableOpacity
                                        key={status}
                                        onPress={() => handleStatusChange(status)}
                                        disabled={setStatusMutation.isPending}
                                        style={[
                                            styles.statusButton,
                                            {
                                                backgroundColor: isSelected ? colors.accent : colors.bgCard,
                                                borderColor: colors.accent,
                                                opacity: setStatusMutation.isPending ? 0.7 : 1,
                                            },
                                        ]}
                                        testID={`reading-status-${status}`}
                                    >
                                        <Text
                                            style={[
                                                styles.statusButtonText,
                                                { color: isSelected ? '#FFFFFF' : colors.accent },
                                            ]}
                                        >
                                            {CURRENT_BOOK_STATUS_LABELS[status]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {setStatusMutation.isError ? (
                            <Text style={[styles.feedbackText, { color: colors.error }]}>
                                {getClubsEntitlementErrorMessage(setStatusMutation.error, 'Unable to update status right now.')}
                            </Text>
                        ) : null}
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' },
    headerSpacer: { width: 40 },
    title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
    errorTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
    errorBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    bookCard: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 14 },
    bookCover: { width: 80, height: 120, borderRadius: 8 },
    bookInfo: { flex: 1, justifyContent: 'center' },
    bookTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    bookAuthors: { fontSize: 14, lineHeight: 20 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    statCard: { flex: 1, minWidth: '22%', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 12, textAlign: 'center' },
    statusRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    statusButton: { flex: 1, borderRadius: 12, borderWidth: 1.5, paddingVertical: 10, alignItems: 'center' },
    statusButtonText: { fontSize: 13, fontWeight: '700' },
    feedbackText: { fontSize: 13, marginTop: 10, textAlign: 'center' },
});
