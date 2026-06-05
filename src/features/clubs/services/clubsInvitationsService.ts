import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { CLUB_INVITATION_SELECT, CLUB_PUBLIC_DETAILS_SELECT, mapInvitationsWithProfiles, normalizeOptionalText } from './clubsService.shared';
import type { ClubInvitation, ClubInvitationInboxItem, ClubInvitationInboxOptions, ClubInvitationWithProfiles, ClubMember, ClubPublicDetails } from './clubsService.types';

const INVITATION_INBOX_STATUSES = ['pending', 'accepted', 'expired', 'revoked'] as const;

export async function getClubInvitations(clubId: string): Promise<ClubInvitationWithProfiles[]> {
    const { data, error } = await supabase.from('club_invitations').select(CLUB_INVITATION_SELECT).eq('club_id', clubId).order('created_at', { ascending: false });
    if (error) throw error;
    return mapInvitationsWithProfiles((data ?? []) as ClubInvitation[]);
}

export async function getMyPendingInvitation(clubId: string, userId: string): Promise<ClubInvitationWithProfiles | null> {
    const { data, error } = await supabase.from('club_invitations').select(CLUB_INVITATION_SELECT)
        .eq('club_id', clubId)
        .eq('invitee_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [invitationWithProfiles] = await mapInvitationsWithProfiles([data as ClubInvitation]);
    return invitationWithProfiles ?? null;
}

export async function getMyPendingInvitations(userId: string, options: ClubInvitationInboxOptions = {}): Promise<ClubInvitationInboxItem[]> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const { data, error } = await supabase.from('club_invitations').select(CLUB_INVITATION_SELECT)
        .eq('invitee_user_id', userId)
        .in('status', [...INVITATION_INBOX_STATUSES])
        .order('read_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) throw error;

    const invitationsWithProfiles = await mapInvitationsWithProfiles((data ?? []) as ClubInvitation[]);
    const clubIds = Array.from(new Set(invitationsWithProfiles.map((invitation) => invitation.club_id).filter(Boolean)));
    if (clubIds.length === 0) {
        return invitationsWithProfiles.map((invitation) => ({ ...invitation, club: null }));
    }

    const { data: clubsData, error: clubsError } = await supabase.from('club_public_details')
        .select(CLUB_PUBLIC_DETAILS_SELECT)
        .in('id', clubIds);
    if (clubsError) throw clubsError;

    const clubById = new Map(((clubsData ?? []) as ClubPublicDetails[]).map((club) => [club.id, club]));
    return invitationsWithProfiles.map((invitation) => ({
        ...invitation,
        club: clubById.get(invitation.club_id) ?? null,
    }));
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

export async function revokeClubInvitation(invitationId: string): Promise<ClubInvitation> {
    const { data, error } = await supabase.rpc('revoke_club_invitation', {
        p_invitation_id: invitationId,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to revoke this invitation right now.'));
    return data as ClubInvitation;
}

export async function markInvitationRead(invitationId: string): Promise<ClubInvitation> {
    const { data, error } = await supabase.rpc('mark_invitation_read', {
        p_invitation_id: invitationId,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to mark this invitation as read right now.'));
    return data as ClubInvitation;
}
