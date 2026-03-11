import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { profileService } from '@/features/auth/services/profileService';
import { useClubEvent, useClubEventVenues, useClubMembership, useClubPublicDetail, useCreateClubEvent, useUpdateClubEvent } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage, type MembershipTier } from '@/features/clubs/services/clubsEntitlement';
import { type ClubEventFormat } from '@/features/clubs/services/clubsService';
import { useTheme } from '@/hooks/useTheme';
import { canCreateClubEvents, canManageClubEvent, combineDateAndTime, toDateInputValue, toTimeInputValue } from './clubEvents.shared';

type LocationMode = 'linked_venue' | 'manual_location';

export default function ClubEventEditorScreen() {
    const { clubId, eventId } = useLocalSearchParams<{ clubId: string; eventId?: string }>();
    const isEditing = !!eventId;
    const { colors } = useTheme();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading: isClubLoading } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const { data: event, isLoading: isEventLoading } = useClubEvent(eventId ?? null, userId, isEditing);
    const { data: linkedVenues = [], isLoading: isVenuesLoading } = useClubEventVenues(clubId ?? null, !!clubId);
    const createEventMutation = useCreateClubEvent();
    const updateEventMutation = useUpdateClubEvent();
    const [viewerMembershipTier, setViewerMembershipTier] = useState<MembershipTier | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventType, setEventType] = useState<ClubEventFormat>('virtual');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [manualLocation, setManualLocation] = useState('');
    const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
    const [locationMode, setLocationMode] = useState<LocationMode>('manual_location');
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [hydratedEventId, setHydratedEventId] = useState<string | null>(null);

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

    useEffect(() => {
        if (!isEditing || !event || hydratedEventId === event.id) return;
        setTitle(event.title);
        setDescription(event.description ?? '');
        setEventType(event.event_type);
        setStartDate(toDateInputValue(event.start_time));
        setStartTime(toTimeInputValue(event.start_time));
        setEndDate(toDateInputValue(event.end_time));
        setEndTime(toTimeInputValue(event.end_time));
        setMeetingLink(event.meeting_link ?? '');
        setManualLocation(event.manual_location ?? '');
        setSelectedVenueId(event.venue_id ?? null);
        setLocationMode(event.venue_id ? 'linked_venue' : 'manual_location');
        setHydratedEventId(event.id);
    }, [event, hydratedEventId, isEditing]);

    useEffect(() => {
        if (linkedVenues.length === 0) {
            setLocationMode('manual_location');
            return;
        }
        if (!selectedVenueId && locationMode === 'linked_venue') {
            setSelectedVenueId(linkedVenues[0].venue_id ?? null);
        }
    }, [linkedVenues, locationMode, selectedVenueId]);

    const canCreate = canCreateClubEvents({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier });
    const canManageCurrentEvent = event ? canManageClubEvent({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier, event }) : false;
    const canSubmit = isEditing ? canManageCurrentEvent : canCreate;

    const hasLinkedVenues = linkedVenues.length > 0;
    const requiresPhysicalLocation = eventType === 'in_person' || eventType === 'hybrid';
    const requiresMeetingLink = eventType === 'virtual' || eventType === 'hybrid';

    const handleSubmit = async () => {
        if (!clubId) return;
        const resolvedStartTime = combineDateAndTime(startDate, startTime);
        const resolvedEndTime = endDate.trim() || endTime.trim() ? combineDateAndTime(endDate.trim() || startDate, endTime) : null;

        if (!resolvedStartTime) {
            setFeedback({ type: 'error', message: 'Enter a valid start date and time.' });
            return;
        }
        if ((endDate.trim() || endTime.trim()) && !resolvedEndTime) {
            setFeedback({ type: 'error', message: 'End time must include a valid date and time.' });
            return;
        }

        try {
            setFeedback(null);
            const input = {
                title,
                description,
                eventType,
                startTime: resolvedStartTime,
                endTime: resolvedEndTime,
                venueId: requiresPhysicalLocation && locationMode === 'linked_venue' ? selectedVenueId : null,
                manualLocation: requiresPhysicalLocation && locationMode === 'manual_location' ? manualLocation : null,
                meetingLink: requiresMeetingLink ? meetingLink : null,
            };

            if (isEditing && eventId) {
                await updateEventMutation.mutateAsync({ eventId, clubId, input });
            } else {
                await createEventMutation.mutateAsync({ clubId, ...input });
            }
            router.replace(`/clubs/${clubId}/events`);
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, isEditing ? 'Unable to save this club event right now.' : 'Unable to create this club event right now.') });
        }
    };

    if (isClubLoading || isMembershipLoading || (isEditing && isEventLoading) || isVenuesLoading) {
        return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{isEditing ? 'Edit club event' : 'Create club event'}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Simple event setup</Text>
                <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>Create one club event at a time. Choose the format first, then only the fields that format needs.</Text>
                {!userId ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Sign in required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>You must be signed in before you can manage club events.</Text></View> : null}
                {userId && !canSubmit ? <View style={[styles.noticeCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}><Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Manager access required</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>Only the club admin or an eligible moderator can create events. Eligible moderators can edit or cancel only the events they created.</Text></View> : null}
                {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
            </View>

            {canSubmit ? <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Title</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="March discussion meetup" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-title" />

                <Text style={[styles.label, { color: colors.textPrimary }]}>Start date</Text>
                <View style={styles.row}><TextInput value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} style={[styles.input, styles.rowInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-start-date" /><TextInput value={startTime} onChangeText={setStartTime} placeholder="HH:MM" placeholderTextColor={colors.textTertiary} style={[styles.input, styles.rowInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-start-time" /></View>

                <Text style={[styles.label, { color: colors.textPrimary }]}>End date & time (optional)</Text>
                <View style={styles.row}><TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} style={[styles.input, styles.rowInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-end-date" /><TextInput value={endTime} onChangeText={setEndTime} placeholder="HH:MM" placeholderTextColor={colors.textTertiary} style={[styles.input, styles.rowInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-end-time" /></View>

                <Text style={[styles.label, { color: colors.textPrimary }]}>Format</Text>
                <View style={styles.row}>{(['virtual', 'in_person', 'hybrid'] as const).map((option) => <TouchableOpacity key={option} onPress={() => setEventType(option)} style={[styles.choiceButton, { backgroundColor: eventType === option ? colors.accent : colors.bgPrimary, borderColor: eventType === option ? colors.accent : colors.border }]} testID={`club-event-type-${option}`}><Text style={[styles.choiceText, { color: eventType === option ? '#FFFFFF' : colors.textPrimary }]}>{option === 'in_person' ? 'In person' : option === 'hybrid' ? 'Hybrid' : 'Virtual'}</Text></TouchableOpacity>)}</View>

                {requiresPhysicalLocation ? <>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Physical location</Text>
                    {hasLinkedVenues ? <View style={styles.row}><TouchableOpacity onPress={() => setLocationMode('linked_venue')} style={[styles.choiceButton, { backgroundColor: locationMode === 'linked_venue' ? colors.accent : colors.bgPrimary, borderColor: locationMode === 'linked_venue' ? colors.accent : colors.border }]} testID="club-event-location-linked"><Text style={[styles.choiceText, { color: locationMode === 'linked_venue' ? '#FFFFFF' : colors.textPrimary }]}>Use linked venue</Text></TouchableOpacity><TouchableOpacity onPress={() => setLocationMode('manual_location')} style={[styles.choiceButton, { backgroundColor: locationMode === 'manual_location' ? colors.accent : colors.bgPrimary, borderColor: locationMode === 'manual_location' ? colors.accent : colors.border }]} testID="club-event-location-manual"><Text style={[styles.choiceText, { color: locationMode === 'manual_location' ? '#FFFFFF' : colors.textPrimary }]}>Enter meetup place</Text></TouchableOpacity></View> : <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>This club does not have a linked venue yet, so this event will use a meetup-place field.</Text>}
                    {locationMode === 'linked_venue' && hasLinkedVenues ? linkedVenues.map((venueLink) => <TouchableOpacity key={venueLink.venue_id ?? venueLink.venue?.id ?? venueLink.venue?.name} onPress={() => setSelectedVenueId(venueLink.venue_id ?? null)} style={[styles.venueCard, { backgroundColor: colors.bgPrimary, borderColor: selectedVenueId === venueLink.venue_id ? colors.accent : colors.border }]} testID={`club-event-venue-${venueLink.venue_id}`}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{venueLink.venue?.name || 'Unnamed venue'}</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{[venueLink.venue?.address_line1, venueLink.venue?.city].filter(Boolean).join(', ') || 'Venue details will be shown to members.'}</Text></TouchableOpacity>) : <TextInput value={manualLocation} onChangeText={setManualLocation} placeholder="Library reading room, café upstairs, bookstore front hall…" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.multilineInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-manual-location" />}
                </> : null}

                {requiresMeetingLink ? <><Text style={[styles.label, { color: colors.textPrimary }]}>Meeting link</Text><TextInput value={meetingLink} onChangeText={setMeetingLink} placeholder="https://meet.example.com/club-room" placeholderTextColor={colors.textTertiary} autoCapitalize="none" autoCorrect={false} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-meeting-link" /></> : null}

                <Text style={[styles.label, { color: colors.textPrimary }]}>Description (optional)</Text>
                <TextInput value={description} onChangeText={setDescription} placeholder="What should members expect at this event?" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.multilineInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-description" />

                <TouchableOpacity onPress={handleSubmit} disabled={createEventMutation.isPending || updateEventMutation.isPending} style={[styles.primaryActionButton, { backgroundColor: colors.accent, opacity: createEventMutation.isPending || updateEventMutation.isPending ? 0.65 : 1 }]} testID="club-event-submit"><Text style={styles.primaryActionText}>{createEventMutation.isPending || updateEventMutation.isPending ? 'Saving…' : isEditing ? 'Save event' : 'Create event'}</Text></TouchableOpacity>
            </View> : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' }, headerSpacer: { width: 40 },
    sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 }, sectionBody: { fontSize: 14, lineHeight: 20 }, noticeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 }, noticeTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 }, noticeBody: { fontSize: 14, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 8 }, input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 }, multilineInput: { minHeight: 96, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, rowInput: { flex: 1, minWidth: 120 }, choiceButton: { flex: 1, minWidth: 120, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' }, choiceText: { fontSize: 14, fontWeight: '700' }, venueCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
    primaryActionButton: { marginTop: 18, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});