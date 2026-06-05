import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { getClubById } from './clubsReadService';
import { CLUB_JOIN_QUESTION_SELECT, CLUB_SELECT, normalizeOptionalText } from './clubsService.shared';
import type { Club, ClubAdminTransferRequest, ClubJoinQuestion, ClubJoinQuestionInput, ClubWithDetails, CreateClubInput, MembershipLimitAction, MembershipLimitResult, UpdateClubInput } from './clubsService.types';

export async function checkMembershipLimits(userId: string, action: MembershipLimitAction = 'create_club'): Promise<MembershipLimitResult> {
    const { data, error } = await supabase.functions.invoke('check-membership-limits', { body: { user_id: userId, action } });
    if (error) throw error;
    if (!data) throw new Error('Membership limit check returned no data');
    return data as MembershipLimitResult;
}

export async function createClub(input: CreateClubInput): Promise<ClubWithDetails> {
    if (input.club_type === 'author_club' && !input.author_id) throw new Error('author_id is required when creating an author club');
    const limitResult = await checkMembershipLimits(input.admin_id, 'create_club');
    if (!limitResult.allowed) throw new Error(limitResult.reason ?? 'Membership tier club creation limit reached');

    const { data: club, error } = await supabase.rpc('create_club', {
        p_name: input.name.trim(),
        p_description: normalizeOptionalText(input.description),
        p_cover_url: normalizeOptionalText(input.cover_url),
        p_club_type: input.club_type,
        p_access_level: input.access_level ?? 'all',
        p_meeting_type: input.meeting_type ?? null,
        p_admin_id: input.admin_id,
        p_current_book_id: input.current_book_id ?? null,
        p_max_members: input.max_members ?? null,
        p_author_id: input.club_type === 'author_club' ? input.author_id ?? null : null,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to create this club right now.'));
    if (!club?.id) throw new Error('Create club response was empty');

    return getClubById(club.id);
}

export async function updateClub(clubId: string, updates: UpdateClubInput): Promise<Club> {
    const { data, error } = await supabase.from('book_clubs').update({
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.description !== undefined ? { description: normalizeOptionalText(updates.description) } : {}),
        ...(updates.cover_url !== undefined ? { cover_url: normalizeOptionalText(updates.cover_url) } : {}),
        ...(updates.current_book_id !== undefined ? { current_book_id: updates.current_book_id } : {}),
        ...(updates.max_members !== undefined ? { max_members: updates.max_members } : {}),
        ...(updates.meeting_type !== undefined ? { meeting_type: updates.meeting_type } : {}),
        ...(updates.access_level !== undefined ? { access_level: updates.access_level } : {}),
        ...(updates.club_type !== undefined ? { club_type: updates.club_type } : {}),
        ...(updates.is_archived !== undefined ? { is_archived: updates.is_archived } : {}),
        ...(updates.archived_at !== undefined ? { archived_at: updates.archived_at } : {}),
        updated_at: new Date().toISOString(),
    }).eq('id', clubId).select(CLUB_SELECT).single();
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to save club settings right now.'));
    return data as Club;
}

export async function deleteClub(clubId: string): Promise<Club> {
    return updateClub(clubId, { is_archived: true, archived_at: new Date().toISOString() });
}

export async function archiveClub(clubId: string): Promise<Club> {
    return deleteClub(clubId);
}

export async function unarchiveClub(clubId: string): Promise<Club> {
    return updateClub(clubId, { is_archived: false, archived_at: null });
}

export async function transferClubAdmin(clubId: string, newAdminUserId: string): Promise<Club> {
    const { data, error } = await supabase.rpc('transfer_club_admin', {
        p_club_id: clubId,
        p_new_admin_user_id: newAdminUserId,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to transfer club admin right now.'));
    return data as Club;
}

export async function getClubAdminTransferRequests(clubId: string): Promise<ClubAdminTransferRequest[]> {
    const { data, error } = await supabase
        .from('club_admin_transfer_requests')
        .select('id, club_id, requested_by, proposed_admin_user_id, status, created_at, responded_at, expires_at')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to load admin transfer requests right now.'));
    return (data ?? []) as ClubAdminTransferRequest[];
}

export async function requestClubAdminTransfer(clubId: string, newAdminUserId: string): Promise<ClubAdminTransferRequest> {
    const { data, error } = await supabase.rpc('request_club_admin_transfer', {
        p_club_id: clubId,
        p_new_admin_user_id: newAdminUserId,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to request admin transfer right now.'));
    return data as ClubAdminTransferRequest;
}

export async function acceptClubAdminTransferRequest(requestId: string): Promise<Club> {
    const { data, error } = await supabase.rpc('accept_club_admin_transfer_request', {
        p_request_id: requestId,
    });
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to accept admin transfer right now.'));
    return data as Club;
}

export async function getJoinQuestions(clubId: string): Promise<ClubJoinQuestion[]> {
    const { data, error } = await supabase.from('club_join_questions').select(CLUB_JOIN_QUESTION_SELECT).eq('club_id', clubId).order('order_index', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ClubJoinQuestion[];
}

export async function createJoinQuestion(clubId: string, input: ClubJoinQuestionInput): Promise<ClubJoinQuestion> {
    const { data, error } = await supabase.from('club_join_questions').insert({
        club_id: clubId,
        question: input.question.trim(),
        is_required: input.isRequired ?? true,
        order_index: input.orderIndex,
    }).select(CLUB_JOIN_QUESTION_SELECT).single();
    if (error) throw error;
    return data as ClubJoinQuestion;
}

export async function updateJoinQuestion(questionId: string, input: Partial<ClubJoinQuestionInput>): Promise<ClubJoinQuestion> {
    const payload: Record<string, unknown> = {};
    if (typeof input.question === 'string') payload.question = input.question.trim();
    if (typeof input.isRequired === 'boolean') payload.is_required = input.isRequired;
    if (typeof input.orderIndex === 'number') payload.order_index = input.orderIndex;
    const { data, error } = await supabase.from('club_join_questions').update(payload).eq('id', questionId).select(CLUB_JOIN_QUESTION_SELECT).single();
    if (error) throw error;
    return data as ClubJoinQuestion;
}

export async function deleteJoinQuestion(questionId: string): Promise<void> {
    const { error } = await supabase.from('club_join_questions').delete().eq('id', questionId);
    if (error) throw error;
}
