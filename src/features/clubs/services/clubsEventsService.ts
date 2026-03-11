import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { normalizeOptionalText } from './clubsService.shared';
import type { ClubEvent, ClubEventInput, ClubEventRsvp, ClubEventStatus, ClubEventWithDetails, ClubVenueLink, ClubVenueSummary, CreateClubEventInput, UpdateClubEventInput } from './clubsService.types';

const CLUB_EVENT_SELECT = `
    id,
    club_id,
    title,
    description,
    event_type,
    start_time,
    end_time,
    venue_id,
    manual_location,
    meeting_link,
    max_attendees,
    created_by,
    created_at,
    updated_at,
    status,
    cancelled_at,
    cancelled_by,
    venue:venues!club_events_venue_id_fkey(
        id,
        name,
        city,
        address_line1,
        address_line2,
        verification_status
    ),
    rsvps:event_rsvps(
        event_id,
        user_id,
        status,
        created_at
    )
`;

const CLUB_VENUE_SELECT = `
    club_id,
    venue_id,
    is_primary,
    venue:venues!club_venues_venue_id_fkey(
        id,
        name,
        city,
        address_line1,
        address_line2,
        verification_status
    )
`;

type ClubEventRow = ClubEvent & { venue: ClubVenueSummary | null; rsvps?: ClubEventRsvp[] | null; };

function isHttpUrl(value: string | null | undefined) {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function validateClubEventInput(input: ClubEventInput) {
    if (!input.title.trim()) throw new Error('Event title is required.');
    if (!input.startTime || Number.isNaN(new Date(input.startTime).getTime())) throw new Error('A valid start date and time are required.');
    if (input.endTime && Number.isNaN(new Date(input.endTime).getTime())) throw new Error('End time must be a valid date and time, or left blank.');
    if (input.endTime && new Date(input.endTime).getTime() <= new Date(input.startTime).getTime()) throw new Error('End time must be after the start time.');

    const meetingLink = normalizeOptionalText(input.meetingLink);
    const manualLocation = normalizeOptionalText(input.manualLocation);
    const hasPhysicalLocation = !!input.venueId || !!manualLocation;

    if ((input.eventType === 'virtual' || input.eventType === 'hybrid') && !meetingLink) {
        throw new Error(input.eventType === 'hybrid' ? 'Hybrid events require a meeting link.' : 'Virtual events require a meeting link.');
    }
    if (meetingLink && !isHttpUrl(meetingLink)) throw new Error('Meeting link must start with http:// or https://.');
    if ((input.eventType === 'in_person' || input.eventType === 'hybrid') && !hasPhysicalLocation) {
        throw new Error(input.eventType === 'hybrid' ? 'Hybrid events require a linked venue or meetup location.' : 'In-person events require a linked venue or meetup location.');
    }
}

function buildClubEventPayload(input: ClubEventInput) {
    validateClubEventInput(input);

    return {
        title: input.title.trim(),
        description: normalizeOptionalText(input.description),
        event_type: input.eventType,
        start_time: input.startTime,
        end_time: input.endTime ?? null,
        venue_id: input.venueId ?? null,
        manual_location: normalizeOptionalText(input.manualLocation),
        meeting_link: normalizeOptionalText(input.meetingLink),
        max_attendees: input.maxAttendees ?? null,
    };
}

function sortClubEvents(events: ClubEventWithDetails[]) {
    return [...events].sort((left, right) => {
        if (left.status !== right.status) return left.status === 'scheduled' ? -1 : 1;
        return new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
    });
}

async function mapClubEvents(rows: ClubEventRow[], userId?: string | null): Promise<ClubEventWithDetails[]> {
    const creatorIds = Array.from(new Set(rows.map((row) => row.created_by).filter((value): value is string => Boolean(value))));
    const creatorProfiles = creatorIds.length > 0 ? await profileService.getProfileSummaries(creatorIds) : [];
    const creatorProfileMap = new Map(creatorProfiles.map((profile) => [profile.user_id, profile]));

    return sortClubEvents(rows.map((row) => ({
        ...row,
        creatorProfile: row.created_by ? creatorProfileMap.get(row.created_by) ?? null : null,
        currentUserRsvp: userId ? row.rsvps?.find((rsvp) => rsvp.user_id === userId) ?? null : null,
    })));
}

export async function getClubEventVenues(clubId: string): Promise<ClubVenueLink[]> {
    const { data, error } = await supabase
        .from('club_venues')
        .select(CLUB_VENUE_SELECT)
        .eq('club_id', clubId)
        .order('is_primary', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ClubVenueLink[];
}

export async function getClubEvents(clubId: string, userId?: string | null): Promise<ClubEventWithDetails[]> {
    const { data, error } = await supabase
        .from('club_events')
        .select(CLUB_EVENT_SELECT)
        .eq('club_id', clubId)
        .order('start_time', { ascending: true });

    if (error) throw error;
    return mapClubEvents((data ?? []) as ClubEventRow[], userId);
}

export async function getClubEventById(eventId: string, userId?: string | null): Promise<ClubEventWithDetails> {
    const { data, error } = await supabase
        .from('club_events')
        .select(CLUB_EVENT_SELECT)
        .eq('id', eventId)
        .single();

    if (error) throw error;
    const [event] = await mapClubEvents([data as ClubEventRow], userId);
    return event;
}

export async function createClubEvent(input: CreateClubEventInput): Promise<ClubEvent> {
    const { data, error } = await supabase
        .from('club_events')
        .insert({ club_id: input.clubId, created_by: (await supabase.auth.getUser()).data.user?.id ?? null, ...buildClubEventPayload(input) })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to create this club event right now.'));
    return data as ClubEvent;
}

export async function updateClubEvent(eventId: string, input: UpdateClubEventInput): Promise<ClubEvent> {
    const { data, error } = await supabase
        .from('club_events')
        .update(buildClubEventPayload(input))
        .eq('id', eventId)
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to save this club event right now.'));
    return data as ClubEvent;
}

export async function cancelClubEvent(eventId: string, cancelledBy: string): Promise<ClubEvent> {
    const { data, error } = await supabase
        .from('club_events')
        .update({ status: 'cancelled' satisfies ClubEventStatus, cancelled_at: new Date().toISOString(), cancelled_by: cancelledBy })
        .eq('id', eventId)
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to cancel this club event right now.'));
    return data as ClubEvent;
}

export async function deleteClubEvent(eventId: string): Promise<void> {
    const { error } = await supabase.from('club_events').delete().eq('id', eventId);
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to delete this club event right now.'));
}

export async function upsertClubEventRsvp(eventId: string, userId: string, status: ClubEventRsvp['status']): Promise<ClubEventRsvp> {
    const { data, error } = await supabase
        .from('event_rsvps')
        .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' })
        .select('*')
        .single();

    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to update your RSVP right now.'));
    return data as ClubEventRsvp;
}