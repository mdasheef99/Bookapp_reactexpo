import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { clubHomeHref } from '@/features/clubs/navigation';
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

const colors = {
    bgPrimary: '#FAF6EE',
    bgCard: '#FFFEFC',
    bgSecondary: '#F8EBE7',
    border: '#E7DCD1',
    accent: '#8B322C',
    textPrimary: '#1A1412',
    textSecondary: '#6E645F',
    textTertiary: '#746860',
    error: '#A12D28',
} as const;

const CURRENT_BOOK_STATUS_LABELS: Record<ClubCurrentBookReadingStatus, string> = {
    want_to_read: 'Want to Read',
    reading: 'Reading',
    completed: 'Completed',
};

export default function ClubReadingProgressScreen() {
    const { clubId, returnView, returnTo } = useLocalSearchParams<{ clubId: string; returnView?: string; returnTo?: string }>();
    const { width: viewportWidth } = useWindowDimensions();
    const isCompactLayout = viewportWidth < 600;
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
    const backHref = clubHomeHref(clubId, returnTo, returnView === 'books' ? 'tab=nominations' : '');

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
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to club" onPress={() => navigateBackOrFallback(router, backHref)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
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
                        <View testID="reading-stat-active-members" style={[styles.statCard, isCompactLayout && styles.statCardCompact, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.active_member_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active members</Text>
                        </View>
                        <View testID="reading-stat-to-start" style={[styles.statCard, isCompactLayout && styles.statCardCompact, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.to_start_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>To start</Text>
                        </View>
                        <View testID="reading-stat-reading" style={[styles.statCard, isCompactLayout && styles.statCardCompact, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{statusOverview?.reading_count ?? 0}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reading</Text>
                        </View>
                        <View testID="reading-stat-completed" style={[styles.statCard, isCompactLayout && styles.statCardCompact, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
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
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected, disabled: setStatusMutation.isPending }}
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
                                                    accessibilityRole="button"
                                                    accessibilityState={{ disabled: updateProgressMutation.isPending || !userId }}
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
    content: { padding: 24, paddingBottom: 96 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    iconButton: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, marginHorizontal: 12, fontFamily: 'Newsreader_600SemiBold', fontSize: 25, lineHeight: 31 },
    headerSpacer: { width: 44 },
    errorTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28, marginBottom: 8, textAlign: 'center' },
    errorBody: { fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', lineHeight: 21 },
    card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
    cardTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 18, lineHeight: 24, marginBottom: 6 },
    cardBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 12 },
    bookCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12, gap: 12 },
    bookCover: { width: 64, height: 88, borderRadius: 6 },
    bookInfo: { flex: 1, justifyContent: 'center' },
    bookTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 18, lineHeight: 23, marginBottom: 3 },
    bookAuthors: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    statCard: { flexGrow: 1, flexBasis: '23%', minWidth: '22%', borderRadius: 8, borderWidth: 1, padding: 10, alignItems: 'flex-start' },
    statCardCompact: { flexBasis: '48%', minWidth: '46%' },
    statValue: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 25, marginBottom: 1 },
    statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
    statusRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    statusButton: { flex: 1, minHeight: 44, borderRadius: 7, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
    statusButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, textAlign: 'center' },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, marginTop: 10, textAlign: 'center' },
    timelineRow: { borderLeftWidth: 2, marginLeft: 10, paddingLeft: 18, paddingBottom: 12, position: 'relative' },
    timelineDot: { position: 'absolute', left: -12, top: 0, width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    timelineDotText: { fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16 },
    timelineContent: { gap: 3 },
    timelineTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    timelineBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    timelineDate: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
    timelineButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 5, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
    timelineButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 },
});
