import { supabase } from '@/lib/supabase';
import { profileService } from '@/features/auth/services/profileService';
import { getMyJoinApplication } from './clubsApplicationsService';
import { CLUB_MEMBER_SELECT, mapMembersWithProfiles } from './clubsService.shared';
import { getClubAccessRequirementMessage, getClubsEntitlementErrorMessage, getModeratorEligibilityMessage, membershipTierSatisfiesAccessLevel, canHoldPrivilegedClubRole } from './clubsEntitlement';
import type { ClubJoinApplication, ClubMember, ClubMemberWithProfile, JoinClubResult, MemberRole } from './clubsService.types';

export async function getMyMembership(clubId: string, userId: string): Promise<ClubMember | null> {
    const { data, error } = await supabase.from('club_members').select(CLUB_MEMBER_SELECT).eq('club_id', clubId).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data as ClubMember | null;
}

export async function getClubMembers(clubId: string): Promise<ClubMemberWithProfile[]> {
    const { data, error } = await supabase.from('club_members').select(CLUB_MEMBER_SELECT).eq('club_id', clubId).order('joined_at', { ascending: true });
    if (error) throw error;
    return mapMembersWithProfiles((data ?? []) as ClubMember[]);
}

function getApprovedApplicationError(existing: ClubJoinApplication): Error {
    if (existing.status === 'pending') return new Error('Pending application already exists');
    if (existing.status === 'declined') return new Error('Your previous application was declined. Reapply is not available yet.');
    return new Error('Your application has already been approved. Refresh your club status.');
}

export async function joinClub(clubId: string, userId: string, answers: Record<string, string> = {}): Promise<JoinClubResult> {
    const { data: club, error: clubError } = await supabase.from('book_clubs').select('id, club_type, access_level').eq('id', clubId).single();
    if (clubError) throw clubError;

    if (club.club_type === 'public') {
        const currentUserProfile = await profileService.getProfileSummary(userId);
        const membershipTier = currentUserProfile?.membership_tier ?? 'free';

        if (!membershipTierSatisfiesAccessLevel(membershipTier, club.access_level ?? 'all')) {
            throw new Error(getClubAccessRequirementMessage(club.access_level ?? 'all', membershipTier, 'join this club'));
        }

        const { error } = await supabase.from('club_members').insert({ club_id: clubId, user_id: userId, role: 'member', status: 'active' });
        if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to join this club right now.'));

        const membership = await getMyMembership(clubId, userId);
        if (!membership) throw new Error('Membership was created but could not be loaded. Please refresh the club and try again.');
        return { status: 'joined', membership };
    }

    if (club.club_type === 'approval' || club.club_type === 'author_club') {
        const { data, error } = await supabase.from('club_join_applications').insert({ club_id: clubId, user_id: userId, status: 'pending', answers }).select('*').single();
        if (error) {
            if ((error as { code?: string }).code === '23505') {
                const existing = await getMyJoinApplication(clubId, userId);
                if (existing?.status === 'pending') return { status: 'applied', application: existing };
                if (existing) throw getApprovedApplicationError(existing);
            }
            throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to submit this club application right now.'));
        }
        return { status: 'applied', application: data as ClubJoinApplication };
    }

    throw new Error('This club requires an invite-only or author-managed join flow.');
}

export async function leaveClub(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
    if (error) throw error;
}

export async function removeMember(clubId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', userId);
    if (error) throw error;
}

export async function updateMemberRole(clubId: string, userId: string, role: Exclude<MemberRole, 'admin'>): Promise<ClubMember> {
    if (role === 'moderator') {
        const [memberProfile, clubResult] = await Promise.all([
            profileService.getProfileSummary(userId),
            supabase.from('book_clubs').select('id, access_level').eq('id', clubId).single(),
        ]);

        if (clubResult.error) throw clubResult.error;

        const membershipTier = memberProfile?.membership_tier ?? 'free';
        if (!canHoldPrivilegedClubRole(membershipTier) || !membershipTierSatisfiesAccessLevel(membershipTier, clubResult.data.access_level ?? 'all')) {
            throw new Error(getModeratorEligibilityMessage(clubResult.data.access_level ?? 'all', membershipTier));
        }
    }

    const { data, error } = await supabase.from('club_members').update({ role }).eq('club_id', clubId).eq('user_id', userId).select(CLUB_MEMBER_SELECT).single();
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to update this club role right now.'));
    return data as ClubMember;
}