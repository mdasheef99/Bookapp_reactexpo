import { profileService } from '@/features/auth/services/profileService';
import type { ClubInvitation, ClubInvitationWithProfiles, ClubJoinApplication, ClubJoinApplicationWithProfile, ClubMember, ClubMemberWithProfile } from './clubsService.types';

export const CLUB_SELECT = 'id, name, description, cover_url, club_type, access_level, current_book_id, admin_id, member_count, max_members, is_archived, created_at, updated_at, meeting_type, archived_at, author_id';

export const CLUB_WITH_BOOK_SELECT = `
    ${CLUB_SELECT},
    current_book:books!current_book_id(
        id, title, authors, cover_url
    )
`;

export const CLUB_PUBLIC_DETAILS_SELECT = 'id, name, description, cover_url, club_type, access_level, meeting_type, member_count, max_members, current_book_id, current_book_google_books_id, current_book_title, current_book_authors, current_book_cover_url, current_book_retail_price, current_book_currency_code, admin_id, admin_profile_id, admin_display_name, admin_avatar_url, admin_city, author_id, author_user_id, author_display_name, author_avatar_url, author_city, created_at, updated_at';

export const CLUB_MEMBER_SELECT = 'id, club_id, user_id, role, status, joined_at';

export const CLUB_JOIN_APPLICATION_SELECT = 'id, club_id, user_id, status, answers, reviewed_by, reviewed_at, decline_reason, created_at';

export const CLUB_INVITATION_SELECT = 'id, club_id, inviter_user_id, invitee_user_id, status, note, created_at, responded_at, read_at';

export const CLUB_JOIN_QUESTION_SELECT = 'id, club_id, question, is_required, order_index';

export function normalizeOptionalText(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function uniqueTruthyStrings(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export async function mapInvitationsWithProfiles(invitations: ClubInvitation[]): Promise<ClubInvitationWithProfiles[]> {
    const profileIds = uniqueTruthyStrings(invitations.flatMap((invitation) => [invitation.inviter_user_id, invitation.invitee_user_id]));
    const profiles = profileIds.length > 0 ? await profileService.getProfileSummaries(profileIds) : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return invitations.map((invitation) => ({
        ...invitation,
        inviterProfile: profileByUserId.get(invitation.inviter_user_id) ?? null,
        inviteeProfile: profileByUserId.get(invitation.invitee_user_id) ?? null,
    }));
}

export async function mapMembersWithProfiles(members: ClubMember[]): Promise<ClubMemberWithProfile[]> {
    const userIds = uniqueTruthyStrings(members.map((member) => member.user_id));
    const profiles = userIds.length > 0 ? await profileService.getProfileSummaries(userIds) : [];
    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return members.map((member) => ({
        ...member,
        profile: member.user_id ? profileMap.get(member.user_id) ?? null : null,
    }));
}

export async function mapApplicationsWithProfiles(applications: ClubJoinApplication[]): Promise<ClubJoinApplicationWithProfile[]> {
    const applicantIds = uniqueTruthyStrings(applications.map((application) => application.user_id));
    const profiles = applicantIds.length > 0 ? await profileService.getProfileSummaries(applicantIds) : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return applications.map((application) => ({
        ...application,
        applicantProfile: application.user_id ? profileByUserId.get(application.user_id) ?? null : null,
    }));
}
