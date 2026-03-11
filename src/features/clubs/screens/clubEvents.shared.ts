import { isActiveEligibleClubManager } from '@/features/clubs/services/clubsEntitlement';
import type { AccessLevel, ClubEventWithDetails, ClubPublicDetails, MemberRole, MemberStatus, MembershipTier } from '@/features/clubs/services/clubsService';

export function canViewClubEvents(status?: MemberStatus | null) {
    return status === 'active' || status === 'muted';
}

export function canRsvpToClubEvents(status?: MemberStatus | null) {
    return status === 'active';
}

export function canCreateClubEvents(input: {
    userId?: string | null;
    club?: Pick<ClubPublicDetails, 'admin_id' | 'access_level'> | null;
    role?: MemberRole | null;
    status?: MemberStatus | null;
    membershipTier?: MembershipTier | null;
}) {
    return isActiveEligibleClubManager({
        userId: input.userId,
        clubAdminId: input.club?.admin_id,
        role: input.role,
        status: input.status,
        membershipTier: input.membershipTier,
        accessLevel: input.club?.access_level as AccessLevel | null | undefined,
    });
}

export function canManageClubEvent(input: {
    userId?: string | null;
    club?: Pick<ClubPublicDetails, 'admin_id' | 'access_level'> | null;
    role?: MemberRole | null;
    status?: MemberStatus | null;
    membershipTier?: MembershipTier | null;
    event: Pick<ClubEventWithDetails, 'created_by'>;
}) {
    if (!canCreateClubEvents(input)) return false;
    if (!input.userId) return false;
    const isAdmin = input.club?.admin_id === input.userId || input.role === 'admin';
    if (isAdmin) return true;
    return input.event.created_by === input.userId;
}

export function formatClubEventType(eventType: ClubEventWithDetails['event_type']) {
    if (eventType === 'in_person') return 'In person';
    if (eventType === 'hybrid') return 'Hybrid';
    return 'Virtual';
}

export function formatClubEventStatus(status: ClubEventWithDetails['status']) {
    return status === 'cancelled' ? 'Cancelled' : 'Scheduled';
}

export function formatClubEventTiming(event: Pick<ClubEventWithDetails, 'start_time' | 'end_time'>) {
    const start = new Date(event.start_time).toLocaleString();
    if (!event.end_time) return start;
    return `${start} – ${new Date(event.end_time).toLocaleString()}`;
}

export function getClubEventLocationLabel(event: Pick<ClubEventWithDetails, 'event_type' | 'venue' | 'manual_location' | 'meeting_link'>) {
    const physicalLocation = event.venue?.name
        ? [event.venue.name, event.venue.city].filter(Boolean).join(' • ')
        : event.manual_location;

    if (event.event_type === 'virtual') return event.meeting_link || 'Meeting link will be shared here.';
    if (event.event_type === 'hybrid') return [physicalLocation || 'Physical location to be announced', 'Virtual access available'].join(' · ');
    return physicalLocation || 'Physical meetup location to be announced';
}

function pad(value: number) {
    return value.toString().padStart(2, '0');
}

export function toDateInputValue(isoValue?: string | null) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInputValue(isoValue?: string | null) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function combineDateAndTime(dateInput: string, timeInput: string) {
    if (!dateInput.trim() || !timeInput.trim()) return null;
    const normalizedTime = /^\d{2}:\d{2}$/.test(timeInput.trim()) ? `${timeInput.trim()}:00` : timeInput.trim();
    const combined = new Date(`${dateInput.trim()}T${normalizedTime}`);
    if (Number.isNaN(combined.getTime())) return null;
    return combined.toISOString();
}