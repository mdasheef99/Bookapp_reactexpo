import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { mapInvitationsWithProfiles, normalizeOptionalText } from './clubsService.shared';
import type { ClubInvitation, ClubInvitationWithProfiles, ClubMember } from './clubsService.types';

export async function getClubInvitations(clubId: string): Promise<ClubInvitationWithProfiles[]> {
    const { data, error } = await supabase.from('club_invitations').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
    if (error) throw error;
    return mapInvitationsWithProfiles((data ?? []) as ClubInvitation[]);
}

export async function getMyPendingInvitation(clubId: string, userId: string): Promise<ClubInvitationWithProfiles | null> {
    const { data, error } = await supabase.from('club_invitations').select('*')
        .eq('club_id', clubId)
        .eq('invitee_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [invitationWithProfiles] = await mapInvitationsWithProfiles([data as ClubInvitation]);
    return invitationWithProfiles ?? null;
}

export async function createClubInvitation(clubId: string, inviteeUsername: string, note?: string | null): Promise<ClubInvitation> {
    const { data, error } = await supabase.rpc('create_club_invitation', {
        p_club_id: clubId,
        p_invitee_username: inviteeUsername.trim(),
        p_note: normalizeOptionalText(note),
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to send this invitation right now.'));
    return data as ClubInvitation;
}

export async function acceptClubInvitation(invitationId: string): Promise<ClubMember> {
    const { data, error } = await supabase.rpc('accept_club_invitation', {
        p_invitation_id: invitationId,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to accept this invitation right now.'));
    return data as ClubMember;
}