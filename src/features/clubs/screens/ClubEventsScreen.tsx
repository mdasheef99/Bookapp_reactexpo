import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService } from '@/features/auth/services/profileService';
import { useCancelClubEvent, useClubEvents, useClubMembership, useClubPublicDetail, useDeleteClubEvent, useUpsertClubEventRsvp } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage, type MembershipTier } from '@/features/clubs/services/clubsEntitlement';
import { useTheme } from '@/hooks/useTheme';
import { canCreateClubEvents, canManageClubEvent, canRsvpToClubEvents, canViewClubEvents, formatClubEventStatus, formatClubEventTiming, formatClubEventType, getClubEventLocationLabel } from './clubEvents.shared';

export default function ClubEventsScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const canViewEvents = canViewClubEvents(membership?.status);
    const canRsvp = canRsvpToClubEvents(membership?.status);
    const { data: events = [], isLoading: isEventsLoading, isError: isEventsError, error: eventsError, refetch } = useClubEvents(clubId ?? null, userId, canViewEvents);
    const rsvpMutation = useUpsertClubEventRsvp();
    const cancelMutation = useCancelClubEvent();
    const deleteMutation = useDeleteClubEvent();
    const [viewerMembershipTier, setViewerMembershipTier] = useState<MembershipTier | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    useEffect(() => {
        let active = true;
        if (!userId) {
            setViewerMembershipTier(null);
            return;
        }
        profileService.getProfileSummary(userId)
            .then((profile) => { if (active) setViewerMembershipTier(profile.membership_tier); })
            .catch(() => { if (active) setViewerMembershipTier(null); });
        return () => { active = false; };
    }, [userId]);

    const canCreate = canCreateClubEvents({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier });

    const handleRsvp = async (eventId: string, status: 'going' | 'not_going') => {
        if (!clubId || !userId) return;
        try {
            setFeedback(null);
            await rsvpMutation.mutateAsync({ eventId, clubId, userId, status });
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to update your RSVP right now.') });
        }
    };

    const handleCancel = (eventId: string) => {
        if (!clubId || !userId) return;
        Alert.alert('Cancel this event?', 'The event will stay visible to members in a cancelled state.', [
            { text: 'Keep event', style: 'cancel' },
            { text: 'Cancel event', style: 'destructive', onPress: async () => {
                try {
                    setFeedback(null);
                    await cancelMutation.mutateAsync({ eventId, clubId, cancelledBy: userId });
                    setFeedback({ type: 'success', message: 'Event cancelled. Members can still see it in the cancelled state.' });
                } catch (error) {
                    setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to cancel this club event right now.') });
                }
            } },
        ]);
    };

    const handleDelete = (eventId: string) => {
        if (!clubId) return;
        Alert.alert('Delete permanently?', 'Deleting is more destructive than cancelling and will remove the event record from the club.', [
            { text: 'Keep event', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    setFeedback(null);
                    await deleteMutation.mutateAsync({ eventId, clubId });
                    setFeedback({ type: 'success', message: 'Event deleted.' });
                } catch (error) {
                    setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to delete this club event right now.') });
                }
            } },
        ]);
    };

    if (isClubLoading || isMembershipLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Club events</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Member-only events</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{club?.name ? `${club.name} events stay inside the club. Active members can RSVP, while muted members can still view the schedule.` : 'Club events stay inside the club. Active members can RSVP, while muted members can still view the schedule.'}</Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Sign in to view this club’s private events schedule.</Text></View> : null}
                {userId && !canViewEvents ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Club events are currently visible only to members of this club.</Text></View> : null}
                {canViewEvents && !canRsvp ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Read-only event access</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Only active club members can RSVP. Muted members can still review the event schedule.</Text></View> : null}
                {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
                {canCreate ? <TouchableOpacity onPress={() => router.push(`/clubs/${clubId}/events/create`)} style={[styles.primaryActionButton, { backgroundColor: colors.accent }]} testID="club-create-event"><Text style={styles.primaryActionText}>Create event</Text></TouchableOpacity> : null}
            </View>

            {canViewEvents ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming schedule</Text>
                {isEventsLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading club events…</Text></View> : null}
                {isEventsError ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load events</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(eventsError, 'Unable to load club events right now.')}</Text><TouchableOpacity onPress={() => refetch()} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="club-events-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
                {!isEventsLoading && !isEventsError && events.length === 0 ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No events yet</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Create the first club event to start the schedule. Clubs can mix in-person, virtual, and hybrid meetups over time.</Text></View> : null}
                {!isEventsLoading && !isEventsError ? events.map((event) => {
                    const canManage = canManageClubEvent({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier, event });
                    return <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.bgPrimary, borderColor: colors.border }]} testID={`club-event-${event.id}`}>
                        <View style={styles.eventHeader}>
                            <View style={styles.eventTitleWrap}>
                                <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                                <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>{formatClubEventTiming(event)}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.badgeText, { color: event.status === 'cancelled' ? '#DC2626' : colors.accent }]}>{formatClubEventStatus(event.status)}</Text></View>
                        </View>
                        <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>{`${formatClubEventType(event.event_type)} · ${getClubEventLocationLabel(event)}`}</Text>
                        {event.description ? <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{event.description}</Text> : null}
                        <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>{`Hosted by ${event.creatorProfile?.display_name || event.creatorProfile?.username || 'a club manager'}`}</Text>
                        <Text style={[styles.eventMeta, { color: event.currentUserRsvp?.status === 'going' ? colors.accent : colors.textSecondary }]}>{event.currentUserRsvp?.status === 'going' ? 'You are currently going.' : event.currentUserRsvp?.status === 'not_going' ? 'You have marked not going.' : event.currentUserRsvp?.status === 'maybe' ? 'You marked maybe.' : 'No RSVP yet.'}</Text>
                        {event.status === 'scheduled' && canRsvp ? <View style={styles.actionRow}>
                            <TouchableOpacity onPress={() => handleRsvp(event.id, 'going')} disabled={rsvpMutation.isPending} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: colors.accent, opacity: rsvpMutation.isPending ? 0.65 : 1 }]} testID={`club-event-rsvp-going-${event.id}`}><Text style={[styles.secondaryActionText, { color: colors.accent }]}>{event.currentUserRsvp?.status === 'going' ? 'Going' : 'RSVP going'}</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => handleRsvp(event.id, 'not_going')} disabled={rsvpMutation.isPending} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: colors.border, opacity: rsvpMutation.isPending ? 0.65 : 1 }]} testID={`club-event-rsvp-not-going-${event.id}`}><Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>{event.currentUserRsvp?.status === 'not_going' ? 'Not going' : 'Not going'}</Text></TouchableOpacity>
                        </View> : null}
                        {canManage ? <View style={styles.actionRow}>
                            <TouchableOpacity onPress={() => router.push(`/clubs/${clubId}/events/${event.id}/edit`)} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: colors.accent }]} testID={`club-event-edit-${event.id}`}><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Edit</Text></TouchableOpacity>
                            {event.status === 'scheduled' ? <TouchableOpacity onPress={() => handleCancel(event.id)} disabled={cancelMutation.isPending} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: '#DC2626', opacity: cancelMutation.isPending ? 0.65 : 1 }]} testID={`club-event-cancel-${event.id}`}><Text style={[styles.secondaryActionText, { color: '#DC2626' }]}>Cancel</Text></TouchableOpacity> : <TouchableOpacity onPress={() => handleDelete(event.id)} disabled={deleteMutation.isPending} style={[styles.secondaryActionButton, { flex: 1, marginTop: 0, borderColor: '#DC2626', opacity: deleteMutation.isPending ? 0.65 : 1 }]} testID={`club-event-delete-${event.id}`}><Text style={[styles.secondaryActionText, { color: '#DC2626' }]}>Delete</Text></TouchableOpacity>}
                        </View> : null}
                    </View>;
                }) : null}
            </View> : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' }, headerSpacer: { width: 40 },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, sectionBody: { fontSize: 14, lineHeight: 20 }, noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 }, noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 }, noticeBody: { fontSize: 14, lineHeight: 20 },
    primaryActionButton: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, secondaryActionButton: { marginTop: 16, borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', paddingHorizontal: 12 }, secondaryActionText: { fontSize: 15, fontWeight: '800' },
    inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }, feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    eventCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12, gap: 8 }, eventHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, eventTitleWrap: { flex: 1, gap: 4 }, eventTitle: { fontSize: 16, fontWeight: '700' }, eventMeta: { fontSize: 13, lineHeight: 18 }, badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }, actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
});