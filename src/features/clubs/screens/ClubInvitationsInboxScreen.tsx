import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAcceptClubInvitation, useMarkInvitationRead, useMyClubInvitationInbox } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import type { ClubInvitationInboxItem } from '@/features/clubs/services/clubsService';
import { navigateBackOrFallback } from '@/lib/navigation';

const PAGE_SIZE = 20;

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
    const { colors } = useTheme();
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
        >
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, '/(tabs)/clubs')} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTextBlock}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Club invitations</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Review invite-only club invitations sent to this account.</Text>
                </View>
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
                    <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}>
                        <Text style={styles.primaryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {feedback ? (
                <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : colors.error }]}>
                    <Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text>
                </View>
            ) : null}

            {userId ? (
                <View style={[styles.handoffCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={styles.handoffIcon}>
                        <Ionicons name="notifications-outline" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.handoffTextBlock}>
                        <Text style={[styles.feedbackTitle, { color: colors.textPrimary }]}>Invitation reminders</Text>
                        <Text style={[styles.feedbackBody, { color: colors.textSecondary }]}>Manage notification preferences for new invite-only club invitations.</Text>
                    </View>
                    <TouchableOpacity
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

            {pendingInvitations.length > 0 ? <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Pending invitations</Text> : null}

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
                        <View style={[styles.invitationCard, { backgroundColor: colors.bgCard, borderColor: isUnread ? colors.accent : colors.border }]}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.cardTitleBlock}>
                                    <Text style={[styles.clubName, { color: colors.textPrimary }]}>{getClubName(invitation)}</Text>
                                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>Invited by {getInviterName(invitation)}</Text>
                                </View>
                                {isUnread ? (
                                    <View style={[styles.statusPill, { backgroundColor: colors.accent }]}>
                                        <Text style={styles.statusPillText}>Unread</Text>
                                    </View>
                                ) : null}
                            </View>

                            {invitation.club?.current_book_title ? (
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Current read: {invitation.club.current_book_title}</Text>
                            ) : null}
                            {invitation.note ? (
                                <Text style={[styles.noteText, { color: colors.textPrimary }]}>{invitation.note}</Text>
                            ) : null}

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    onPress={() => handleOpenInvitation(invitation)}
                                    disabled={isOpening}
                                    style={[styles.secondaryButton, { borderColor: colors.accent, opacity: isOpening ? 0.65 : 1 }]}
                                    testID={`club-invitation-open-${invitation.id}`}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>{isOpening ? 'Opening...' : 'View club'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleAcceptInvitation(invitation)}
                                    disabled={isAccepting}
                                    style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: isAccepting ? 0.65 : 1 }]}
                                    testID={`club-invitation-accept-${invitation.id}`}
                                >
                                    <Text style={styles.primaryButtonText}>{isAccepting ? 'Accepting...' : 'Accept'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );
            })}

            {historicalInvitations.length > 0 ? <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>Past invitations</Text> : null}

            {historicalInvitations.map((invitation) => {
                const isOpening = markReadMutation.isPending;
                return (
                    <View key={invitation.id} style={[styles.invitationCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.cardTitleBlock}>
                                <Text style={[styles.clubName, { color: colors.textPrimary }]}>{getClubName(invitation)}</Text>
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Invited by {getInviterName(invitation)}</Text>
                            </View>
                            <View style={[styles.statusPill, { backgroundColor: colors.bgSecondary }]}>
                                <Text style={[styles.statusPillText, { color: colors.textPrimary }]}>{getInvitationStatusLabel(invitation)}</Text>
                            </View>
                        </View>

                        {invitation.club?.current_book_title ? (
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Current read: {invitation.club.current_book_title}</Text>
                        ) : null}
                        {invitation.responded_at ? (
                            <Text style={[styles.metaText, { color: colors.textTertiary }]}>Updated {new Date(invitation.responded_at).toLocaleString()}</Text>
                        ) : null}

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                onPress={() => handleOpenInvitation(invitation)}
                                disabled={isOpening}
                                style={[styles.secondaryButton, { borderColor: colors.accent, opacity: isOpening ? 0.65 : 1 }]}
                                testID={`club-invitation-open-${invitation.id}`}
                            >
                                <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>{isOpening ? 'Opening...' : 'View club'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })}

            {invitations.length >= visibleLimit ? (
                <TouchableOpacity
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
    contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14, fontWeight: '500' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
    iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTextBlock: { flex: 1 },
    title: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
    subtitle: { fontSize: 14, lineHeight: 20 },
    feedbackCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
    feedbackTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
    feedbackBody: { fontSize: 14, lineHeight: 20 },
    feedbackBanner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
    feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    handoffCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    handoffIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    handoffTextBlock: { flex: 1 },
    handoffButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    invitationCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14, gap: 10 },
    cardHeaderRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    cardTitleBlock: { flex: 1 },
    clubName: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    metaText: { fontSize: 13, lineHeight: 18 },
    noteText: { fontSize: 14, lineHeight: 20 },
    groupTitle: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, marginTop: 10 },
    subgroupTitle: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
    statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    statusPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    primaryButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
    secondaryButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    secondaryButtonText: { fontSize: 14, fontWeight: '800' },
    loadMoreButton: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
});
