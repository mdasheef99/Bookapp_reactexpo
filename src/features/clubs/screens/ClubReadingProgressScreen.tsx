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
    useClubReadingSchedule,
    useUpdateClubReadingProgress,
} from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import type { ClubCurrentBookReadingStatus } from '@/features/clubs/services/clubsService';

const CURRENT_BOOK_STATUS_LABELS: Record<ClubCurrentBookReadingStatus, string> = {
    want_to_read: 'Want to Read',
    reading: 'Reading',
    completed: 'Completed',
};

export default function ClubReadingProgressScreen() {
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
    const {
        data: readingSchedule,
        isLoading: isScheduleLoading,
        isError: isScheduleError,
        error: scheduleError,
    } = useClubReadingSchedule(clubId, club?.current_book_id ?? null, userId, !!club?.current_book_id);

    const setStatusMutation = useSetClubCurrentBookReadingStatus();
    const updateProgressMutation = useUpdateClubReadingProgress();

    const handleStatusChange = async (status: ClubCurrentBookReadingStatus) => {
        if (!clubId) return;
        try {
            await setStatusMutation.mutateAsync({ clubId, status });
        } catch {
            // Error is surfaced via isError on the mutation; optimistic updates are not used here.
        }
    };

    const handleMilestoneProgress = async (completedCount: number) => {
        if (!clubId || !userId || !club?.current_book_id || !readingSchedule?.id) return;
        try {
            await updateProgressMutation.mutateAsync({
                clubId,
                bookId: club.current_book_id,
                scheduleId: readingSchedule.id,
                userId,
                chaptersCompleted: completedCount,
            });
        } catch {
            // Error is rendered below.
        }
    };

    if (isClubLoading || isStatusLoading || isScheduleLoading) {
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
    const completedMilestones = readingSchedule?.currentUserProgress?.chapters_completed ?? 0;

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

                    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Reading schedule</Text>
                        {isScheduleError ? (
                            <Text style={[styles.feedbackText, { color: colors.error }]}>
                                {getClubsEntitlementErrorMessage(scheduleError, 'Unable to load the reading schedule right now.')}
                            </Text>
                        ) : readingSchedule?.milestones.length ? (
                            <>
                                {readingSchedule.milestones.map((milestone, index) => {
                                    const milestoneNumber = index + 1;
                                    const isComplete = completedMilestones >= milestoneNumber;
                                    return (
                                        <View key={milestone.id} style={[styles.timelineRow, { borderLeftColor: isComplete ? colors.accent : colors.border }]} testID={`reading-schedule-milestone-${index}`}>
                                            <View style={[styles.timelineDot, { backgroundColor: isComplete ? colors.accent : colors.bgSecondary, borderColor: isComplete ? colors.accent : colors.border }]}>
                                                <Text style={[styles.timelineDotText, { color: isComplete ? '#FFFFFF' : colors.textSecondary }]}>{milestoneNumber}</Text>
                                            </View>
                                            <View style={styles.timelineContent}>
                                                <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>{milestone.label}</Text>
                                                {milestone.target ? <Text style={[styles.timelineBody, { color: colors.textSecondary }]}>{milestone.target}</Text> : null}
                                                {milestone.dueDate ? <Text style={[styles.timelineDate, { color: colors.textTertiary }]}>Due {milestone.dueDate}</Text> : null}
                                                <TouchableOpacity
                                                    onPress={() => handleMilestoneProgress(isComplete ? milestoneNumber - 1 : milestoneNumber)}
                                                    disabled={updateProgressMutation.isPending || !userId}
                                                    style={[styles.timelineButton, { borderColor: colors.accent, opacity: updateProgressMutation.isPending || !userId ? 0.6 : 1 }]}
                                                    testID={`reading-schedule-toggle-${index}`}
                                                >
                                                    <Text style={[styles.timelineButtonText, { color: colors.accent }]}>{isComplete ? 'Mark incomplete' : 'Mark complete'}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                                {updateProgressMutation.isError ? (
                                    <Text style={[styles.feedbackText, { color: colors.error }]}>
                                        {getClubsEntitlementErrorMessage(updateProgressMutation.error, 'Unable to update milestone progress right now.')}
                                    </Text>
                                ) : null}
                            </>
                        ) : (
                            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>No reading schedule has been set for this book yet.</Text>
                        )}
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
    timelineRow: { borderLeftWidth: 2, marginLeft: 10, paddingLeft: 18, paddingBottom: 16, position: 'relative' },
    timelineDot: { position: 'absolute', left: -12, top: 0, width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    timelineDotText: { fontSize: 12, fontWeight: '800' },
    timelineContent: { gap: 4 },
    timelineTitle: { fontSize: 15, fontWeight: '700' },
    timelineBody: { fontSize: 14, lineHeight: 20 },
    timelineDate: { fontSize: 12 },
    timelineButton: { alignSelf: 'flex-start', marginTop: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    timelineButtonText: { fontSize: 13, fontWeight: '800' },
});
