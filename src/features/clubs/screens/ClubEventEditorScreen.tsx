import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { navigateBackOrFallback } from '@/lib/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useViewerMembershipTier } from '@/features/clubs/hooks/useViewerMembershipTier';
import { useClubEvent, useClubEventVenues, useClubMembership, useClubPublicDetail, useCreateClubEvent, useUpdateClubEvent } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';
import { type ClubEventFormat, type MembershipTier } from '@/features/clubs/services/clubsService';
import { useTheme } from '@/hooks/useTheme';
import { canCreateClubEvents, canManageClubEvent, combineDateAndTime, toDateInputValue, toTimeInputValue } from './clubEvents.shared';

type LocationMode = 'linked_venue' | 'manual_location';
type PickerTarget = 'start-date' | 'start-time' | 'end-date' | 'end-time';
type WebPickerFieldColors = {
    bgPrimary: string;
    border: string;
    textPrimary: string;
};
type EventEditorDraft = {
    title: string;
    description: string;
    eventType: ClubEventFormat;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    meetingLink: string;
    manualLocation: string;
    selectedVenueId: string | null;
    locationMode: LocationMode;
};

const IS_NATIVE_PICKER_PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android';

function formatEditorDateLabel(value: string) {
    if (!value) return 'Select date';
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEditorTimeLabel(value: string) {
    if (!value) return 'Select time';
    const normalizedTime = /^\d{2}:\d{2}$/.test(value.trim()) ? `${value.trim()}:00` : value.trim();
    const parsed = new Date(`1970-01-01T${normalizedTime}`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function createPickerSeed(dateInput: string, timeInput: string, mode: 'date' | 'time') {
    const fallbackTime = mode === 'time' ? '09:00' : (timeInput.trim() || '09:00');
    const combined = combineDateAndTime(dateInput.trim() || toDateInputValue(new Date().toISOString()), fallbackTime);
    return combined ? new Date(combined) : new Date();
}

function serializeEventDraft(draft: EventEditorDraft) {
    return JSON.stringify(draft);
}

function parseEventDraft(rawDraft?: string) {
    if (!rawDraft) return null;
    try {
        const parsed = JSON.parse(rawDraft) as Partial<EventEditorDraft>;
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            title: typeof parsed.title === 'string' ? parsed.title : '',
            description: typeof parsed.description === 'string' ? parsed.description : '',
            eventType: parsed.eventType === 'in_person' || parsed.eventType === 'hybrid' ? parsed.eventType : 'virtual',
            startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
            startTime: typeof parsed.startTime === 'string' ? parsed.startTime : '',
            endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
            endTime: typeof parsed.endTime === 'string' ? parsed.endTime : '',
            meetingLink: typeof parsed.meetingLink === 'string' ? parsed.meetingLink : '',
            manualLocation: typeof parsed.manualLocation === 'string' ? parsed.manualLocation : '',
            selectedVenueId: typeof parsed.selectedVenueId === 'string' ? parsed.selectedVenueId : null,
            locationMode: parsed.locationMode === 'linked_venue' ? 'linked_venue' : 'manual_location',
        } satisfies EventEditorDraft;
    } catch {
        return null;
    }
}

function WebPickerField({
    testID,
    label,
    mode,
    value,
    onChange,
    colors,
}: {
    testID: string;
    label: string;
    mode: 'date' | 'time';
    value: string;
    onChange: (nextValue: string) => void;
    colors: WebPickerFieldColors;
}) {
    const webInputStyle: CSSProperties = {
        width: '100%',
        minHeight: 46,
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        color: colors.textPrimary,
        fontSize: 14,
        padding: '12px',
        cursor: 'pointer',
        boxSizing: 'border-box',
    };

    return (
        <View
            style={[styles.input, styles.rowInput, styles.webPickerField, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]}
            testID={`${testID}-wrapper`}
        >
            <input
                aria-label={label}
                data-testid={testID}
                type={mode}
                value={value}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
                onFocus={(event: ChangeEvent<HTMLInputElement>) => {
                    const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
                    input.showPicker?.();
                }}
                style={webInputStyle}
            />
        </View>
    );
}

export default function ClubEventEditorScreen() {
    const { clubId, eventId, preselectedVenueId, returnTo, manageTab, draft } = useLocalSearchParams<{
        clubId: string;
        eventId?: string;
        preselectedVenueId?: string;
        returnTo?: string;
        manageTab?: string;
        draft?: string;
    }>();
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
    // CACHE-02: shared cached hook instead of imperative per-mount fetch
    const { tier: viewerMembershipTier } = useViewerMembershipTier(userId);
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
    const [activePicker, setActivePicker] = useState<PickerTarget | null>(null);
    const [hydratedDraft, setHydratedDraft] = useState<string | null>(null);

    useEffect(() => {
        const parsedDraft = parseEventDraft(draft);
        if (!parsedDraft || hydratedDraft === draft) return;
        setTitle(parsedDraft.title);
        setDescription(parsedDraft.description);
        setEventType(parsedDraft.eventType);
        setStartDate(parsedDraft.startDate);
        setStartTime(parsedDraft.startTime);
        setEndDate(parsedDraft.endDate);
        setEndTime(parsedDraft.endTime);
        setMeetingLink(parsedDraft.meetingLink);
        setManualLocation(parsedDraft.manualLocation);
        setSelectedVenueId(parsedDraft.selectedVenueId);
        setLocationMode(parsedDraft.locationMode);
        setHydratedDraft(draft ?? null);
    }, [draft, hydratedDraft]);

    useEffect(() => {
        if (!isEditing || !event || hydratedEventId === event.id) return;
        if (parseEventDraft(draft)) return;
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
    }, [draft, event, hydratedEventId, isEditing]);

    useEffect(() => {
        if (linkedVenues.length === 0) {
            setLocationMode('manual_location');
            return;
        }
        if (!selectedVenueId && locationMode === 'linked_venue') {
            setSelectedVenueId(linkedVenues[0].venue_id ?? null);
        }
    }, [linkedVenues, locationMode, selectedVenueId]);

    // Auto-select venue when returning from the venue picker
    useEffect(() => {
        if (!preselectedVenueId) return;
        setSelectedVenueId(preselectedVenueId);
        setLocationMode('linked_venue');
    }, [preselectedVenueId]);

    const canCreate = canCreateClubEvents({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier });
    const canManageCurrentEvent = event ? canManageClubEvent({ userId, club, role: membership?.role, status: membership?.status, membershipTier: viewerMembershipTier, event }) : false;
    const canSubmit = isEditing ? canManageCurrentEvent : canCreate;
    const manageDestination = `/clubs/${clubId}/manage${manageTab ? `?tab=${manageTab}` : ''}`;
    const exitDestination = returnTo === 'manage' ? manageDestination : `/clubs/${clubId}/events`;
    const venuePickerReturnQuery = new URLSearchParams({
        returnTo: 'event-editor',
        editorMode: isEditing ? 'edit' : 'create',
        ...(eventId ? { eventId } : {}),
        ...(returnTo ? { editorReturnTo: returnTo } : {}),
        ...(manageTab ? { manageTab } : {}),
        draft: serializeEventDraft({
            title,
            description,
            eventType,
            startDate,
            startTime,
            endDate,
            endTime,
            meetingLink,
            manualLocation,
            selectedVenueId,
            locationMode,
        }),
    }).toString();

    const handleBackPress = () => {
        if (returnTo === 'manage') {
            router.replace(manageDestination);
            return;
        }
        navigateBackOrFallback(router, exitDestination);
    };

    const hasLinkedVenues = linkedVenues.length > 0;
    const requiresPhysicalLocation = eventType === 'in_person' || eventType === 'hybrid';
    const requiresMeetingLink = eventType === 'virtual' || eventType === 'hybrid';

    const applyPickerValue = (target: PickerTarget, selectedDate: Date) => {
        const isoValue = selectedDate.toISOString();
        const nextDate = toDateInputValue(isoValue);
        const nextTime = toTimeInputValue(isoValue);

        if (target === 'start-date') {
            setStartDate(nextDate);
            if (!startTime.trim()) setStartTime(nextTime);
            return;
        }
        if (target === 'start-time') {
            if (!startDate.trim()) setStartDate(nextDate);
            setStartTime(nextTime);
            return;
        }
        if (target === 'end-date') {
            setEndDate(nextDate);
            if (!endTime.trim()) setEndTime(nextTime);
            return;
        }
        if (!endDate.trim()) setEndDate(startDate.trim() || nextDate);
        setEndTime(nextTime);
    };

    const handleNativePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        const pickerTarget = activePicker;
        if (Platform.OS === 'android') setActivePicker(null);
        if (!pickerTarget || event.type === 'dismissed' || !selectedDate) return;
        applyPickerValue(pickerTarget, selectedDate);
    };

    const getPickerValue = (target: PickerTarget) => {
        if (target === 'start-date') return createPickerSeed(startDate, startTime, 'date');
        if (target === 'start-time') return createPickerSeed(startDate, startTime, 'time');
        if (target === 'end-date') return createPickerSeed(endDate || startDate, endTime || startTime, 'date');
        return createPickerSeed(endDate || startDate, endTime || startTime, 'time');
    };

    const renderNativePicker = (target: PickerTarget) => {
        if (!IS_NATIVE_PICKER_PLATFORM || activePicker !== target) return null;
        const mode = target.endsWith('time') ? 'time' : 'date';
        return (
            <View style={[styles.pickerCard, { borderColor: colors.border, backgroundColor: colors.bgSecondary }]}>
                <DateTimePicker
                    testID={`club-event-${target}-picker`}
                    mode={mode}
                    value={getPickerValue(target)}
                    onChange={handleNativePickerChange}
                />
            </View>
        );
    };

    const handleSubmit = async () => {
        if (!clubId) return;
        const normalizedTitle = title.trim();
        const normalizedMeetingLink = meetingLink.trim();
        const normalizedManualLocation = manualLocation.trim();
        const hasEndValue = !!endDate.trim() || !!endTime.trim();

        if (!normalizedTitle) {
            setFeedback({ type: 'error', message: 'Event title is required.' });
            return;
        }
        if (!startDate.trim() || !startTime.trim()) {
            setFeedback({ type: 'error', message: 'Select a start date and time.' });
            return;
        }
        const resolvedStartTime = combineDateAndTime(startDate, startTime);
        const resolvedEndTime = hasEndValue ? combineDateAndTime(endDate.trim() || startDate, endTime) : null;

        if (!resolvedStartTime) {
            setFeedback({ type: 'error', message: 'Enter a valid start date and time.' });
            return;
        }
        if (hasEndValue && !endTime.trim()) {
            setFeedback({ type: 'error', message: 'Choose an end time or clear the optional end fields.' });
            return;
        }
        if (hasEndValue && !resolvedEndTime) {
            setFeedback({ type: 'error', message: 'End time must include a valid date and time.' });
            return;
        }
        if (resolvedEndTime && new Date(resolvedEndTime).getTime() <= new Date(resolvedStartTime).getTime()) {
            setFeedback({ type: 'error', message: 'End time must be after the start time.' });
            return;
        }
        if (requiresMeetingLink && !normalizedMeetingLink) {
            setFeedback({ type: 'error', message: eventType === 'hybrid' ? 'Hybrid events require a meeting link.' : 'Virtual events require a meeting link.' });
            return;
        }
        if (normalizedMeetingLink && !/^https?:\/\//i.test(normalizedMeetingLink)) {
            setFeedback({ type: 'error', message: 'Meeting link must start with http:// or https://.' });
            return;
        }
        if (requiresPhysicalLocation && locationMode === 'linked_venue' && !selectedVenueId) {
            setFeedback({ type: 'error', message: 'Select a linked venue for this event.' });
            return;
        }
        if (requiresPhysicalLocation && locationMode === 'manual_location' && !normalizedManualLocation) {
            setFeedback({ type: 'error', message: eventType === 'hybrid' ? 'Hybrid events require a linked venue or meetup location.' : 'In-person events require a linked venue or meetup location.' });
            return;
        }

        try {
            setFeedback(null);
            const input = {
                title: normalizedTitle,
                description,
                eventType,
                startTime: resolvedStartTime,
                endTime: resolvedEndTime,
                venueId: requiresPhysicalLocation && locationMode === 'linked_venue' ? selectedVenueId : null,
                manualLocation: requiresPhysicalLocation && locationMode === 'manual_location' ? normalizedManualLocation : null,
                meetingLink: requiresMeetingLink ? normalizedMeetingLink : null,
            };

            if (isEditing && eventId) {
                await updateEventMutation.mutateAsync({ eventId, clubId, input });
            } else {
                await createEventMutation.mutateAsync({ clubId, ...input });
            }
            router.replace(exitDestination);
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
                <TouchableOpacity onPress={handleBackPress} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity>
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
                <View style={styles.row}>
                    {IS_NATIVE_PICKER_PLATFORM ? (
                        <>
                            <TouchableOpacity onPress={() => setActivePicker(activePicker === 'start-date' ? null : 'start-date')} style={[styles.input, styles.rowInput, styles.pickerFieldButton, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-start-date">
                                <Text style={{ color: startDate ? colors.textPrimary : colors.textTertiary }}>{formatEditorDateLabel(startDate)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActivePicker(activePicker === 'start-time' ? null : 'start-time')} style={[styles.input, styles.rowInput, styles.pickerFieldButton, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-start-time">
                                <Text style={{ color: startTime ? colors.textPrimary : colors.textTertiary }}>{formatEditorTimeLabel(startTime)}</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <WebPickerField testID="club-event-start-date" label="Start date" mode="date" value={startDate} onChange={setStartDate} colors={colors} />
                            <WebPickerField testID="club-event-start-time" label="Start time" mode="time" value={startTime} onChange={setStartTime} colors={colors} />
                        </>
                    )}
                </View>
                {renderNativePicker('start-date')}
                {renderNativePicker('start-time')}

                <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>End date & time (optional)</Text>
                    {(endDate || endTime) ? (
                        <TouchableOpacity onPress={() => { setEndDate(''); setEndTime(''); setActivePicker(null); }} testID="club-event-clear-end">
                            <Text style={[styles.clearText, { color: colors.accent }]}>Clear</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
                <View style={styles.row}>
                    {IS_NATIVE_PICKER_PLATFORM ? (
                        <>
                            <TouchableOpacity onPress={() => setActivePicker(activePicker === 'end-date' ? null : 'end-date')} style={[styles.input, styles.rowInput, styles.pickerFieldButton, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-end-date">
                                <Text style={{ color: endDate ? colors.textPrimary : colors.textTertiary }}>{formatEditorDateLabel(endDate)}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setActivePicker(activePicker === 'end-time' ? null : 'end-time')} style={[styles.input, styles.rowInput, styles.pickerFieldButton, { borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-end-time">
                                <Text style={{ color: endTime ? colors.textPrimary : colors.textTertiary }}>{formatEditorTimeLabel(endTime)}</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <WebPickerField testID="club-event-end-date" label="End date" mode="date" value={endDate} onChange={setEndDate} colors={colors} />
                            <WebPickerField testID="club-event-end-time" label="End time" mode="time" value={endTime} onChange={setEndTime} colors={colors} />
                        </>
                    )}
                </View>
                {renderNativePicker('end-date')}
                {renderNativePicker('end-time')}

                <Text style={[styles.label, { color: colors.textPrimary }]}>Format</Text>
                <View style={styles.row}>{(['virtual', 'in_person', 'hybrid'] as const).map((option) => <TouchableOpacity key={option} onPress={() => setEventType(option)} style={[styles.choiceButton, { backgroundColor: eventType === option ? colors.accent : colors.bgPrimary, borderColor: eventType === option ? colors.accent : colors.border }]} testID={`club-event-type-${option}`}><Text style={[styles.choiceText, { color: eventType === option ? '#FFFFFF' : colors.textPrimary }]}>{option === 'in_person' ? 'In person' : option === 'hybrid' ? 'Hybrid' : 'Virtual'}</Text></TouchableOpacity>)}</View>

                {requiresPhysicalLocation ? <>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Physical location</Text>
                    {hasLinkedVenues ? <View style={styles.row}><TouchableOpacity onPress={() => setLocationMode('linked_venue')} style={[styles.choiceButton, { backgroundColor: locationMode === 'linked_venue' ? colors.accent : colors.bgPrimary, borderColor: locationMode === 'linked_venue' ? colors.accent : colors.border }]} testID="club-event-location-linked"><Text style={[styles.choiceText, { color: locationMode === 'linked_venue' ? '#FFFFFF' : colors.textPrimary }]}>Use linked venue</Text></TouchableOpacity><TouchableOpacity onPress={() => setLocationMode('manual_location')} style={[styles.choiceButton, { backgroundColor: locationMode === 'manual_location' ? colors.accent : colors.bgPrimary, borderColor: locationMode === 'manual_location' ? colors.accent : colors.border }]} testID="club-event-location-manual"><Text style={[styles.choiceText, { color: locationMode === 'manual_location' ? '#FFFFFF' : colors.textPrimary }]}>Enter meetup place</Text></TouchableOpacity></View> : <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>This club does not have a linked venue yet, so this event will use a meetup-place field.</Text>}
                    {locationMode === 'linked_venue' && hasLinkedVenues ? <>
                        <TouchableOpacity
                            onPress={() => router.push(`/clubs/${clubId}/venues?${venuePickerReturnQuery}`)}
                            style={[styles.secondaryActionButton, { borderColor: colors.accent, marginBottom: 12 }]}
                            testID="event-browse-venues"
                        >
                            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>Browse all venues</Text>
                        </TouchableOpacity>
                        {linkedVenues.map((venueLink) => <TouchableOpacity key={venueLink.venue_id ?? venueLink.venue?.id ?? venueLink.venue?.name} onPress={() => setSelectedVenueId(venueLink.venue_id ?? null)} style={[styles.venueCard, { backgroundColor: colors.bgPrimary, borderColor: selectedVenueId === venueLink.venue_id ? colors.accent : colors.border }]} testID={`club-event-venue-${venueLink.venue_id}`}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{venueLink.venue?.name || 'Unnamed venue'}</Text><Text style={[styles.noticeBody, { color: colors.textSecondary }]}>{[venueLink.venue?.address_line1, venueLink.venue?.city].filter(Boolean).join(', ') || 'Venue details will be shown to members.'}</Text></TouchableOpacity>)}
                    </> : <TextInput value={manualLocation} onChangeText={setManualLocation} placeholder="Library reading room, café upstairs, bookstore front hall…" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.multilineInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="club-event-manual-location" />}
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
    label: { fontSize: 14, fontWeight: '700', marginTop: 14, marginBottom: 8 }, labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, clearText: { fontSize: 13, fontWeight: '700' }, input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 }, multilineInput: { minHeight: 96, textAlignVertical: 'top' }, row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, rowInput: { flex: 1, minWidth: 120 }, pickerFieldButton: { justifyContent: 'center' }, webPickerField: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }, pickerCard: { borderWidth: 1, borderRadius: 14, marginTop: 10, overflow: 'hidden' }, choiceButton: { flex: 1, minWidth: 120, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' }, choiceText: { fontSize: 14, fontWeight: '700' }, venueCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
    primaryActionButton: { marginTop: 18, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, feedbackBanner: { marginTop: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
    secondaryActionButton: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
