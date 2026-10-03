import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAcceptClubInvitation, useMarkInvitationRead, useMyClubInvitationInbox } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import type { ClubInvitationInboxItem } from '@/features/clubs/services/clubsService';
import { navigateBackOrFallback } from '@/lib/navigation';

const PAGE_SIZE = 20;
const colors = {
    bgPrimary: '#FAF6EE', bgCard: '#FFFEFC', bgSecondary: '#F8EBE7',
    border: '#E7DCD1', accent: '#8B322C', textPrimary: '#1A1412',
    textSecondary: '#6E645F', textTertiary: '#746860', error: '#A12D28',
} as const;

function getInviterName(invitation: ClubInvitationInboxItem) {
    return invitation.inviterProfile?.display_name || invitation.inviterProfile?.username || invitation.club?.admin_display_name || 'A club manager';
}

function getClubName(invitation: ClubInvitationInboxItem) {
    return invitation.club?.name || 'Invite-only club';
}

function getInvitationStatusLabel(invitation: ClubInvitationInboxItem) {
    const status = invitation.status === 'accepted' || invitation.status === 'expired' || invitation.status === 'revoked'
        ? invitation.status
        : 'pending';
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
}

export default function ClubInvitationsInboxScreen() {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
    const { data: invitations = [], isLoading, isError, refetch, isRefetching } = useMyClubInvitationInbox(userId, { limit: visibleLimit });
    const markReadMutation = useMarkInvitationRead();
    const acceptInvitationMutation = useAcceptClubInvitation();
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');
    const unreadPendingInvitations = pendingInvitations.filter((invitation) => !invitation.read_at);
    const readPendingInvitations = pendingInvitations.filter((invitation) => invitation.read_at);
    const historicalInvitations = invitations.filter((invitation) => invitation.status !== 'pending');

    const handleOpenInvitation = async (invitation: ClubInvitationInboxItem) => {
        if (!userId) {
            setFeedback({ type: 'error', message: 'Sign in to open club invitations.' });
            return;
        }

        try {
            setFeedback(null);
            if (!invitation.read_at) {
                await markReadMutation.mutateAsync({ invitationId: invitation.id, clubId: invitation.club_id, userId });
            }
            router.push(`/(tabs)/clubs/${invitation.club_id}`);
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to open this invitation right now.') });
        }
    };

    const handleAcceptInvitation = async (invitation: ClubInvitationInboxItem) => {
        if (!userId) {
            setFeedback({ type: 'error', message: 'Sign in to accept club invitations.' });
            return;
        }

        try {
            setFeedback(null);
            await acceptInvitationMutation.mutateAsync({ invitationId: invitation.id, clubId: invitation.club_id, userId });
            setFeedback({ type: 'success', message: `Invitation accepted. You are now an active member of ${getClubName(invitation)}.` });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to accept this invitation right now.') });
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading invitations...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.bgPrimary }]}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
            testID="club-invitations-scroll"
        >
            <View style={styles.headerRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to clubs" onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTextBlock}>
                    <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Club invitations</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Review invite-only club invitations sent to this account.</Text>
                </View>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Refresh invitations"
                    accessibilityState={{ disabled: !userId || isRefetching }}
                    disabled={!userId || isRefetching}
                    onPress={() => refetch()}
                    style={[styles.refreshButton, { opacity: userId ? 1 : 0.5 }]}
                    testID="club-invitations-refresh"
                >
                    {isRefetching ? <ActivityIndicator size="small" color={colors.accent} /> : <Ionicons name="refresh-outline" size={20} color={colors.accent} />}
                </TouchableOpacity>
            </View>

            {!userId ? (
                <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Sign in to view invitations</Text>
                    <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Club invitations are tied to your reader account.</Text>
                </View>
            ) : null}

            {isError ? (
                <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Could not load invitations</Text>
                    <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Try refreshing to fetch your pending club invitations.</Text>
                    <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, styles.retryButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}>
                        <Text style={styles.primaryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {feedback ? (
                <View accessibilityRole="alert" style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#EAF3EB' : '#FCEDEA', borderColor: feedback.type === 'success' ? '#BED4C0' : '#E7B6AF' }]}>
                    <Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#24623B' : colors.error }]}>{feedback.message}</Text>
                </View>
            ) : null}

            {userId ? (
                <View style={[styles.handoffCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <View style={styles.handoffIcon}>
                        <Ionicons name="notifications-outline" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.handoffTextBlock}>
                        <Text style={[styles.handoffTitle, { color: colors.textPrimary }]}>Invitation reminders</Text>
                        <Text style={[styles.handoffBody, { color: colors.textSecondary }]}>Choose how you hear about new club invitations.</Text>
                    </View>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => router.push('/(tabs)/profile/settings')}
                        style={[styles.handoffButton, { borderColor: colors.accent }]}
                        testID="club-invitations-notification-settings"
                    >
                        <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Settings</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {!isError && invitations.length === 0 ? (
                <View style={[styles.feedbackCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>No invitations</Text>
                    <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Invite-only club invitations and recent invitation history will appear here.</Text>
                </View>
            ) : null}

            {pendingInvitations.length > 0 ? (
                <View style={styles.groupHeadingRow}>
                    <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.textPrimary }]}>Pending invitations</Text>
                    <View style={styles.countBadge} accessibilityLabel={`${pendingInvitations.length} pending invitations shown`}><Text style={styles.countText}>{pendingInvitations.length}</Text></View>
                </View>
            ) : null}

            {unreadPendingInvitations.length > 0 ? (
                <Text style={[styles.subgroupTitle, { color: colors.textSecondary }]}>Unread</Text>
            ) : null}

            {[...unreadPendingInvitations, ...readPendingInvitations].map((invitation, index) => {
                const isUnread = !invitation.read_at;
                const isAccepting = acceptInvitationMutation.isPending;
                const isOpening = markReadMutation.isPending;
                const showReadHeader = !isUnread && index === unreadPendingInvitations.length;
                return (
                    <View key={invitation.id}>
                        {showReadHeader ? <Text style={[styles.subgroupTitle, { color: colors.textSecondary }]}>Read</Text> : null}
                        <View style={[styles.invitationCard, { backgroundColor: colors.bgCard, borderColor: isUnread ? '#C9A194' : colors.border }]}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.cardTitleBlock}>
                                    <Text style={[styles.clubName, { color: colors.textPrimary }]}>{getClubName(invitation)}</Text>
                                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>Invited by {getInviterName(invitation)}</Text>
                                </View>
                                {isUnread ? (
                                    <View style={[styles.statusPill, { backgroundColor: colors.bgSecondary }]}>
                                        <View style={styles.unreadDot} />
                                        <Text style={[styles.statusPillText, { color: colors.accent }]}>Unread</Text>
                                    </View>
                                ) : null}
                            </View>

                            {invitation.club?.current_book_title ? (
                                <View style={styles.readingContext}>
                                    <Ionicons name="book-outline" size={16} color={colors.accent} />
                                    <Text style={[styles.readingText, { color: colors.textSecondary }]}>Current read: {invitation.club.current_book_title}</Text>
                                </View>
                            ) : null}
                            {invitation.note ? (
                                <View style={styles.noteBox}><Text style={[styles.noteText, { color: colors.textPrimary }]}>{invitation.note}</Text></View>
                            ) : null}

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => handleOpenInvitation(invitation)}
                                    disabled={isOpening}
                                    style={[styles.secondaryButton, styles.actionButton, { borderColor: colors.accent, opacity: isOpening ? 0.65 : 1 }]}
                                    testID={`club-invitation-open-${invitation.id}`}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>{isOpening ? 'Opening...' : 'View club'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    onPress={() => handleAcceptInvitation(invitation)}
                                    disabled={isAccepting}
                                    style={[styles.primaryButton, styles.actionButton, { backgroundColor: colors.accent, opacity: isAccepting ? 0.65 : 1 }]}
                                    testID={`club-invitation-accept-${invitation.id}`}
                                >
                                    <Text style={styles.primaryButtonText}>{isAccepting ? 'Accepting...' : 'Accept'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );
            })}

            {historicalInvitations.length > 0 ? <Text accessibilityRole="header" style={[styles.groupTitle, styles.historyHeading, { color: colors.textPrimary }]}>Past invitations</Text> : null}

            {historicalInvitations.map((invitation) => {
                const isOpening = markReadMutation.isPending;
                return (
                    <View key={invitation.id} style={[styles.historyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={styles.historyTextBlock}>
                            <Text style={[styles.historyClubName, { color: colors.textPrimary }]}>{getClubName(invitation)}</Text>
                            <View style={styles.historyMetaRow}>
                                <View style={[styles.historyStatusPill, { backgroundColor: invitation.status === 'accepted' ? '#EAF3EB' : '#F1EDE7' }]}>
                                    <Text style={[styles.statusPillText, { color: invitation.status === 'accepted' ? '#24623B' : colors.textSecondary }]}>{getInvitationStatusLabel(invitation)}</Text>
                                </View>
                            </View>
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Invited by {getInviterName(invitation)}</Text>
                            {invitation.club?.current_book_title ? (
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Current read: {invitation.club.current_book_title}</Text>
                            ) : null}
                            {invitation.responded_at ? (
                                <Text style={[styles.metaText, { color: colors.textTertiary }]}>Updated {new Date(invitation.responded_at).toLocaleString()}</Text>
                            ) : null}
                        </View>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`View ${getClubName(invitation)}`}
                            onPress={() => handleOpenInvitation(invitation)}
                            disabled={isOpening}
                            style={[styles.secondaryButton, styles.historyButton, { borderColor: colors.accent, opacity: isOpening ? 0.65 : 1 }]}
                            testID={`club-invitation-open-${invitation.id}`}
                        >
                            <Text style={[styles.historyButtonText, { color: colors.accent }]}>{isOpening ? 'Opening...' : 'View club'}</Text>
                        </TouchableOpacity>
                    </View>
                );
            })}

            {invitations.length >= visibleLimit ? (
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setVisibleLimit((current) => current + PAGE_SIZE)}
                    style={[styles.loadMoreButton, { borderColor: colors.accent }]}
                    testID="club-invitations-load-more"
                >
                    <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Load more</Text>
                </TouchableOpacity>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 32 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    refreshButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    headerTextBlock: { flex: 1 },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 28, lineHeight: 34, marginBottom: 4 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    feedbackCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    feedbackTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, marginBottom: 6 },
    feedbackBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    feedbackBanner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
    handoffCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
    handoffIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    handoffTextBlock: { flex: 1 },
    handoffTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, marginBottom: 2 },
    handoffBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
    handoffButton: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.bgCard },
    invitationCard: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 12, gap: 11 },
    cardHeaderRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    cardTitleBlock: { flex: 1, minWidth: 0 },
    clubName: { fontFamily: 'Newsreader_600SemiBold', fontSize: 21, lineHeight: 26, marginBottom: 4 },
    metaText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    readingContext: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F6F1E9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9 },
    readingText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
    noteBox: { borderLeftWidth: 2, borderLeftColor: '#D4B6A8', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FBF7F1', borderRadius: 4 },
    noteText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    groupHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
    groupTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28 },
    historyHeading: { marginBottom: 10, marginTop: 8 },
    countBadge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgSecondary },
    countText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.accent },
    subgroupTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
    unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
    statusPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
    actionButton: { flex: 1 },
    primaryButton: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    retryButton: { alignSelf: 'flex-start', marginTop: 12 },
    historyCard: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
    historyTextBlock: { flex: 1, minWidth: 0, gap: 3 },
    historyClubName: { fontFamily: 'Newsreader_600SemiBold', fontSize: 18, lineHeight: 23 },
    historyMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
    historyStatusPill: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
    historyButton: { width: 94, paddingHorizontal: 7 },
    historyButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 },
    loadMoreButton: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4, backgroundColor: colors.bgCard },
});
