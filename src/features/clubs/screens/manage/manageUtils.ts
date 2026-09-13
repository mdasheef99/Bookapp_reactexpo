import type { AccessLevel, ClubPublicDetails, ClubType, MeetingType } from '@/features/clubs/services/clubsService';

export type FeedbackState = { type: 'success' | 'error'; message: string } | null;

export type SettingsDraft = {
    name: string;
    description: string;
    coverUrl: string;
    maxMembers: string;
    clubType: ClubType;
    accessLevel: AccessLevel;
    meetingType: MeetingType | null;
};

export function createSettingsDraft(club: ClubPublicDetails): SettingsDraft {
    return {
        name: club.name,
        description: club.description ?? '',
        coverUrl: club.cover_url ?? '',
        maxMembers: club.max_members ? String(club.max_members) : '',
        clubType: club.club_type,
        accessLevel: club.access_level ?? 'all',
        meetingType: club.meeting_type ?? null,
    };
}

export function normalizeMaxMembers(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : trimmed;
}

export function formatClubType(value: ClubType) {
    if (value === 'invite_only') return 'Invite only';
    if (value === 'author_club') return 'Author club';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAccessLevel(value: AccessLevel | null) {
    if (value === 'pro_plus') return 'Pro+';
    if (value === 'pro') return 'Pro';
    return 'All members';
}

export function formatMeetingType(value: MeetingType | null) {
    if (value === 'online_only') return 'Online only';
    if (value === 'venue_based') return 'Venue based';
    if (value === 'hybrid') return 'Hybrid';
    return 'Not set';
}

export function isHttpUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export function getSettingsValidationMessage(settings: SettingsDraft, club: ClubPublicDetails) {
    if (!settings.name.trim()) return 'Club name is required.';

    const coverUrl = settings.coverUrl.trim();
    if (coverUrl && !isHttpUrl(coverUrl)) return 'Cover image URL must start with http:// or https://, or be left blank.';

    const normalizedMaxMembers = normalizeMaxMembers(settings.maxMembers);
    if (normalizedMaxMembers && !/^([1-9][0-9]*)$/.test(normalizedMaxMembers)) {
        return 'Member cap must be a whole number greater than zero, or left blank.';
    }

    if (normalizedMaxMembers && club.member_count && Number.parseInt(normalizedMaxMembers, 10) < club.member_count) {
        return `Member cap cannot be below the current member count of ${club.member_count}.`;
    }

    return null;
}

export function isSettingsDirty(settings: SettingsDraft, club: ClubPublicDetails) {
    return settings.name.trim() !== club.name
        || settings.description.trim() !== (club.description ?? '')
        || settings.coverUrl.trim() !== (club.cover_url ?? '')
        || normalizeMaxMembers(settings.maxMembers) !== (club.max_members ? String(club.max_members) : '')
        || settings.accessLevel !== (club.access_level ?? 'all')
        || settings.meetingType !== (club.meeting_type ?? null)
        || (club.club_type !== 'author_club' && settings.clubType !== club.club_type);
}

export function formatStatus(status: string | null | undefined) {
    if (status === 'muted') return 'Muted member';
    if (status === 'banned') return 'Banned member';
    return 'Active member';
}

export function formatNominationStatus(status: string | null | undefined) {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

export function hasNominationVotingClosed(votingEndsAt: string | null) {
    if (!votingEndsAt) return false;
    const votingEndTime = Date.parse(votingEndsAt);
    if (Number.isNaN(votingEndTime)) return false;
    return votingEndTime <= Date.now();
}

// Cover URL resolver — accepts a minimal shape (just imageLinks) so callers
// holding only a thumbnail don't need a full GoogleBook payload.
export function getBookCoverUrl(book: { volumeInfo?: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } } | null): string {
    const imageLinks = book?.volumeInfo?.imageLinks;
    const imageUrl = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail;
    if (!imageUrl) return 'https://via.placeholder.com/120x180?text=No+Cover';
    return imageUrl.replace(/^http:\/\//i, 'https://').replace('zoom=1', 'zoom=0');
}

export function isTooManyRequestsError(error: unknown): boolean {
    if (error && typeof error === 'object') {
        const e = error as Record<string, unknown>;
        const response = e.response;
        const responseStatus = response && typeof response === 'object' ? (response as { status?: unknown }).status : undefined;
        if (e.status === 429 || responseStatus === 429) return true;
        const message = String(e.message ?? e.error ?? error);
        if (message.includes('429') || message.toLowerCase().includes('too many requests')) return true;
    }
    return false;
}
