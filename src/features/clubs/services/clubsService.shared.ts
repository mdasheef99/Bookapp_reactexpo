import { profileService } from '@/features/auth/services/profileService';
import type { ClubInvitation, ClubInvitationWithProfiles, ClubJoinApplication, ClubJoinApplicationWithProfile, ClubMember, ClubMemberWithProfile } from './clubsService.types';

export const CLUB_WITH_BOOK_SELECT = `
    *,
    current_book:books!current_book_id(
        id, title, authors, cover_url
    )
`;

export const CLUB_MEMBER_SELECT = 'id, club_id, user_id, role, status, joined_at';

export function normalizeOptionalText(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

export async function mapInvitationsWithProfiles(invitations: ClubInvitation[]): Promise<ClubInvitationWithProfiles[]> {
    const profileIds = Array.from(new Set(
        invitations.flatMap((invitation) => [invitation.inviter_user_id, invitation.invitee_user_id]).filter(Boolean),
    )) as string[];
    const profiles = profileIds.length > 0 ? await profileService.getProfileSummaries(profileIds) : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return invitations.map((invitation) => ({
        ...invitation,
        inviterProfile: profileByUserId.get(invitation.inviter_user_id) ?? null,
        inviteeProfile: profileByUserId.get(invitation.invitee_user_id) ?? null,
    }));
}

export async function mapMembersWithProfiles(members: ClubMember[]): Promise<ClubMemberWithProfile[]> {
    const userIds = members.map((member) => member.user_id).filter((userId): userId is string => Boolean(userId));
    const profiles = userIds.length > 0 ? await profileService.getProfileSummaries(userIds) : [];
    const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return members.map((member) => ({
        ...member,
        profile: member.user_id ? profileMap.get(member.user_id) ?? null : null,
    }));
}

export async function mapApplicationsWithProfiles(applications: ClubJoinApplication[]): Promise<ClubJoinApplicationWithProfile[]> {
    const applicantIds = applications.map((application) => application.user_id).filter(Boolean) as string[];
    const profiles = applicantIds.length > 0 ? await profileService.getProfileSummaries(applicantIds) : [];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));

    return applications.map((application) => ({
        ...application,
        applicantProfile: application.user_id ? profileByUserId.get(application.user_id) ?? null : null,
    }));
}