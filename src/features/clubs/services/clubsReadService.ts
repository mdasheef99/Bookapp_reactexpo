import { supabase } from '@/lib/supabase';
import { profileService } from '@/features/auth/services/profileService';
import { CLUB_WITH_BOOK_SELECT } from './clubsService.shared';
import type { ClubFilters, ClubPublicDetails, ClubWithBook, ClubWithDetails } from './clubsService.types';

function applyPublicClubFilters(query: any, filters: ClubFilters) {
    const { clubType, meetingType, accessLevel, search } = filters;
    if (clubType) query = query.eq('club_type', clubType);
    if (meetingType) query = query.eq('meeting_type', meetingType);
    if (accessLevel) query = query.eq('access_level', accessLevel);
    if (search?.trim()) {
        const term = search.trim();
        query = query.or(`name.ilike.%${term}%,current_book_title.ilike.%${term}%,admin_display_name.ilike.%${term}%,author_display_name.ilike.%${term}%`);
    }
    return query;
}

export async function getPublicClubs(filters: ClubFilters = {}): Promise<ClubPublicDetails[]> {
    const { limit = 20, offset = 0 } = filters;
    let query = supabase.from('club_public_details').select('*')
        .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    query = applyPublicClubFilters(query, filters);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClubPublicDetails[];
}

export async function getMyPublicClubs(userId: string, filters: ClubFilters = {}): Promise<ClubPublicDetails[]> {
    const { data: memberships, error: membershipError } = await supabase.from('club_members').select('club_id')
        .eq('user_id', userId)
        .in('status', ['active', 'muted']);
    if (membershipError) throw membershipError;

    const clubIds = (memberships ?? []).map((membership) => membership.club_id).filter((clubId): clubId is string => !!clubId);
    if (clubIds.length === 0) return [];

    const { limit = 20, offset = 0 } = filters;
    let query = supabase.from('club_public_details').select('*')
        .in('id', clubIds)
        .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    query = applyPublicClubFilters(query, filters);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClubPublicDetails[];
}

export async function getPublicClubById(clubId: string): Promise<ClubPublicDetails> {
    const { data, error } = await supabase.from('club_public_details').select('*').eq('id', clubId).single();
    if (error) throw error;
    return data as ClubPublicDetails;
}

export async function getClubs(filters: ClubFilters = {}): Promise<ClubWithBook[]> {
    const { clubType, search, limit = 20, offset = 0 } = filters;
    let query = supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT).eq('is_archived', false)
        .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (clubType) query = query.eq('club_type', clubType);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClubWithBook[];
}

export async function getClubById(clubId: string): Promise<ClubWithDetails> {
    const { data, error } = await supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT).eq('id', clubId).single();
    if (error) throw error;
    const admin = data.admin_id ? await profileService.getProfileSummary(data.admin_id) : null;
    return { ...data, admin } as ClubWithDetails;
}

export async function getMyClubs(userId: string): Promise<ClubWithBook[]> {
    const { data: memberships, error: membershipError } = await supabase.from('club_members').select('club_id').eq('user_id', userId).eq('status', 'active');
    if (membershipError) throw membershipError;
    const clubIds = (memberships ?? []).map((membership) => membership.club_id).filter((clubId): clubId is string => clubId !== null);
    if (clubIds.length === 0) return [];
    const { data, error } = await supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT).in('id', clubIds).order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ClubWithBook[];
}