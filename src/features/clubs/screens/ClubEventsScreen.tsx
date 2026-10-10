import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useViewerMembershipTier } from '@/features/clubs/hooks/useViewerMembershipTier';
import { useCancelClubEvent, useClubEvents, useClubMembership, useClubPublicDetail, useDeleteClubEvent, useUpsertClubEventRsvp } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import type { ClubEventWithDetails } from '@/features/clubs/services/clubsService';
import { canCreateClubEvents, canManageClubEvent, canRsvpToClubEvents, canViewClubEvents, formatClubEventStatus, formatClubEventTiming, formatClubEventType, getClubEventLocationLabel } from './clubEvents.shared';

const colors = {
    bgPrimary: '#FAF6EE', bgCard: '#FFFEFC', bgSecondary: '#F8EBE7',
    border: '#E7DCD1', accent: '#8B322C', textPrimary: '#1A1412', textSecondary: '#6E645F',
} as const;

function formatEventSchedule(event: Pick<ClubEventWithDetails, 'start_time' | 'end_time'>) {
    const start = new Date(event.start_time);
    const end = event.end_time ? new Date(event.end_time) : null;
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) return formatClubEventTiming(event);
    const dateOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const;
    const timeOptions = { hour: 'numeric', minute: '2-digit' } as const;
    const startLabel = `${start.toLocaleDateString(undefined, dateOptions)} · ${start.toLocaleTimeString(undefined, timeOptions)}`;
    if (!end) return startLabel;
    const endDate = start.toDateString() === end.toDateString() ? '' : `${end.toLocaleDateString(undefined, dateOptions)} · `;
    return `${startLabel} – ${endDate}${end.toLocaleTimeString(undefined, timeOptions)}`;
}

export default function ClubEventsScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
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
    // CACHE-02: shared cached hook instead of imperative per-mount fetch
    const { tier: viewerMembershipTier } = useViewerMembershipTier(userId);
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

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
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to club" onPress={() => navigateBackOrFallback(router, `/clubs/${clubId}`)} style={styles.iconButton}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
                <Text style={[styles.clubContext, { color: colors.textSecondary }]}>{club?.name || 'Book club'}</Text>
            </View>

            <View style={styles.pageIntro}>
                <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.textPrimary }]}>Events</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Gatherings, chapter discussions, and readings for members.</Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Sign in to view this club’s private events schedule.</Text></View> : null}
                {userId && !canViewEvents ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Members only</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Club events are currently visible only to members of this club.</Text></View> : null}
                {canViewEvents && !canRsvp ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Read-only event access</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Only active club members can RSVP. Muted members can still review the event schedule.</Text></View> : null}
                {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
                {canCreate ? <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/clubs/${clubId}/events/create`)} style={[styles.primaryActionButton, { backgroundColor: colors.accent }]} testID="club-create-event"><Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.primaryActionText}>Create event</Text></TouchableOpacity> : null}
            </View>

            {canViewEvents ? <View style={styles.schedule}>
                {isEventsLoading ? <View style={styles.inlineLoadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Loading club events…</Text></View> : null}
                {isEventsError ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Unable to load events</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(eventsError, 'Unable to load club events right now.')}</Text><TouchableOpacity onPress={() => refetch()} style={[styles.secondaryActionButton, { borderColor: colors.accent }]} testID="club-events-retry"><Text style={[styles.secondaryActionText, { color: colors.accent }]}>Retry</Text></TouchableOpacity></View> : null}
                {!isEventsLoading && !isEventsError && events.length === 0 ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>No events yet</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Create the first club event to start the schedule. Clubs can mix in-person, virtual, and hybrid meetups over time.</Text></View> : null}
                {!isEventsLoading && !isEventsError ? events.map((event) => {
                    const canManage = canManageClubEvent({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier, event });
                    return <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID={`club-event-${event.id}`}>
                        <View style={styles.eventHeader}>
                            <View style={[styles.badge, { backgroundColor: colors.bgSecondary }]}><Text style={[styles.badgeText, { color: colors.accent }]}>{formatClubEventStatus(event.status)}</Text></View>
                            <Text style={[styles.eventTiming, { color: colors.textSecondary }]}>{formatEventSchedule(event)}</Text>
                        </View>
                        <Text accessibilityRole="header" style={[styles.eventTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                        <View style={styles.locationRow}><Ionicons name={event.event_type === 'virtual' ? 'videocam-outline' : 'location-outline'} size={15} color={colors.textSecondary} /><Text style={[styles.locationText, { color: colors.textSecondary }]}>{`${formatClubEventType(event.event_type)} · ${getClubEventLocationLabel(event)}`}</Text></View>
                        {event.description ? <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>{event.description}</Text> : null}
                        <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>{`Hosted by ${event.creatorProfile?.display_name || event.creatorProfile?.username || 'a club manager'}`}</Text>
                        <Text style={[styles.eventMeta, { color: event.currentUserRsvp?.status === 'going' ? colors.accent : colors.textSecondary }]}>{event.currentUserRsvp?.status === 'going' ? 'You are currently going.' : event.currentUserRsvp?.status === 'not_going' ? 'You have marked not going.' : event.currentUserRsvp?.status === 'maybe' ? 'You marked maybe.' : 'No RSVP yet.'}</Text>
                        {event.status === 'scheduled' && canRsvp ? <View style={styles.actionRow}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Going to ${event.title}`} accessibilityState={{ selected: event.currentUserRsvp?.status === 'going', disabled: rsvpMutation.isPending }} onPress={() => handleRsvp(event.id, 'going')} disabled={rsvpMutation.isPending} style={[styles.rsvpButton, { borderColor: colors.accent, backgroundColor: event.currentUserRsvp?.status === 'going' ? colors.accent : colors.bgCard, opacity: rsvpMutation.isPending ? 0.65 : 1 }]} testID={`club-event-rsvp-going-${event.id}`}>
                                {event.currentUserRsvp?.status === 'going' ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
                                <Text style={[styles.secondaryActionText, { color: event.currentUserRsvp?.status === 'going' ? '#FFFFFF' : colors.accent }]}>Going</Text>
                            </TouchableOpacity>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Not going to ${event.title}`} accessibilityState={{ selected: event.currentUserRsvp?.status === 'not_going', disabled: rsvpMutation.isPending }} onPress={() => handleRsvp(event.id, 'not_going')} disabled={rsvpMutation.isPending} style={[styles.rsvpButton, { borderColor: event.currentUserRsvp?.status === 'not_going' ? colors.accent : colors.border, backgroundColor: event.currentUserRsvp?.status === 'not_going' ? colors.bgSecondary : colors.bgCard, opacity: rsvpMutation.isPending ? 0.65 : 1 }]} testID={`club-event-rsvp-not-going-${event.id}`}><Text style={[styles.secondaryActionText, { color: event.currentUserRsvp?.status === 'not_going' ? colors.accent : colors.textSecondary }]}>Not going</Text></TouchableOpacity>
                        </View> : null}
                        {canManage ? <View style={styles.managerRow}>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit ${event.title}`} onPress={() => router.push(`/clubs/${clubId}/events/${event.id}/edit`)} style={styles.managerButton} testID={`club-event-edit-${event.id}`}><Ionicons name="create-outline" size={14} color={colors.textSecondary} /><Text style={styles.managerText}>Edit event</Text></TouchableOpacity>
                            <Text style={styles.managerSeparator}>·</Text>
                            {event.status === 'scheduled' ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Cancel ${event.title}`} onPress={() => handleCancel(event.id)} disabled={cancelMutation.isPending} style={[styles.managerButton, { opacity: cancelMutation.isPending ? 0.65 : 1 }]} testID={`club-event-cancel-${event.id}`}><Text style={styles.managerText}>Cancel</Text></TouchableOpacity> : <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete ${event.title}`} onPress={() => handleDelete(event.id)} disabled={deleteMutation.isPending} style={[styles.managerButton, { opacity: deleteMutation.isPending ? 0.65 : 1 }]} testID={`club-event-delete-${event.id}`}><Text style={[styles.managerText, { color: colors.accent }]}>Delete</Text></TouchableOpacity>}
                        </View> : null}
                    </View>;
                }) : null}
            </View> : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
    iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -10 },
    clubContext: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
    pageIntro: { marginBottom: 22, gap: 6 },
    pageTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 30, lineHeight: 36 },
    sectionBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    schedule: { gap: 14 },
    noticeCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 8 },
    noticeTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 21, marginBottom: 6 },
    noticeBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    primaryActionButton: { marginTop: 10, borderRadius: 8, minHeight: 44, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' },
    primaryActionText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    secondaryActionButton: { marginTop: 12, borderWidth: 1, borderRadius: 8, minHeight: 44, paddingVertical: 10, alignItems: 'center', paddingHorizontal: 12 },
    secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 },
    inlineLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    feedbackBanner: { marginTop: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
    eventCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
    eventHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    eventTiming: { flexGrow: 1, flexShrink: 1, flexBasis: 180, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    eventTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28 },
    eventMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
    locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    locationText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
    badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    rsvpButton: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
    managerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' },
    managerButton: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    managerText: { color: colors.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    managerSeparator: { color: colors.textSecondary, fontSize: 12 },
});
