import { supabase } from '@/lib/supabase';
import { getClubsEntitlementErrorMessage } from './clubsEntitlement';
import { getClubById } from './clubsReadService';
import { normalizeOptionalText } from './clubsService.shared';
import type { Club, ClubJoinQuestion, ClubJoinQuestionInput, ClubWithDetails, CreateClubInput, MembershipLimitAction, MembershipLimitResult, UpdateClubInput } from './clubsService.types';

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

    const { data: club, error } = await supabase.from('book_clubs').insert({
        name: input.name.trim(),
        description: normalizeOptionalText(input.description),
        cover_url: normalizeOptionalText(input.cover_url),
        club_type: input.club_type,
        access_level: input.access_level ?? 'all',
        meeting_type: input.meeting_type ?? null,
        admin_id: input.admin_id,
        current_book_id: input.current_book_id ?? null,
        max_members: input.max_members ?? null,
        author_id: input.club_type === 'author_club' ? input.author_id ?? null : null,
    }).select('id').single();
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to create this club right now.'));

    const { error: memberError } = await supabase.from('club_members').insert({ club_id: club.id, user_id: input.admin_id, role: 'admin', status: 'active' });
    if (memberError) throw new Error(getClubsEntitlementErrorMessage(memberError, 'Unable to activate the initial club admin membership right now.'));

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
    }).eq('id', clubId).select('*').single();
    if (error) throw new Error(getClubsEntitlementErrorMessage(error, 'Unable to save club settings right now.'));
    return data as Club;
}

export async function deleteClub(clubId: string): Promise<Club> {
    return updateClub(clubId, { is_archived: true, archived_at: new Date().toISOString() });
}

export async function getJoinQuestions(clubId: string): Promise<ClubJoinQuestion[]> {
    const { data, error } = await supabase.from('club_join_questions').select('*').eq('club_id', clubId).order('order_index', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ClubJoinQuestion[];
}

export async function createJoinQuestion(clubId: string, input: ClubJoinQuestionInput): Promise<ClubJoinQuestion> {
    const { data, error } = await supabase.from('club_join_questions').insert({
        club_id: clubId,
        question: input.question.trim(),
        is_required: input.isRequired ?? true,
        order_index: input.orderIndex,
    }).select('*').single();
    if (error) throw error;
    return data as ClubJoinQuestion;
}

export async function updateJoinQuestion(questionId: string, input: Partial<ClubJoinQuestionInput>): Promise<ClubJoinQuestion> {
    const payload: Record<string, unknown> = {};
    if (typeof input.question === 'string') payload.question = input.question.trim();
    if (typeof input.isRequired === 'boolean') payload.is_required = input.isRequired;
    if (typeof input.orderIndex === 'number') payload.order_index = input.orderIndex;
    const { data, error } = await supabase.from('club_join_questions').update(payload).eq('id', questionId).select('*').single();
    if (error) throw error;
    return data as ClubJoinQuestion;
}

export async function deleteJoinQuestion(questionId: string): Promise<void> {
    const { error } = await supabase.from('club_join_questions').delete().eq('id', questionId);
    if (error) throw error;
}