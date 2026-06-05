import { supabase } from '@/lib/supabase';
import { profileService } from '@/features/auth/services/profileService';
import { CLUB_PUBLIC_DETAILS_SELECT, CLUB_WITH_BOOK_SELECT } from './clubsService.shared';
import type { ClubFilters, ClubManageDetails, ClubPublicDetails, ClubWithBook, ClubWithDetails } from './clubsService.types';

type RelatedOne<T> = T | T[] | null;
type ClubWithBookRow = Omit<ClubWithBook, 'current_book'> & { current_book: RelatedOne<ClubWithBook['current_book']>; };

function normalizeRelatedOne<T>(value: RelatedOne<T> | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

function mapClubWithBook(row: ClubWithBookRow): ClubWithBook {
    return {
        ...row,
        current_book: normalizeRelatedOne(row.current_book),
    };
}

function normalizePublicClubSearchTerm(search?: string) {
    return search?.trim()
        .replace(/[%(),.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() ?? '';
}

async function mapClubWithBookToManageDetails(row: ClubWithBookRow): Promise<ClubManageDetails> {
    const club = mapClubWithBook(row);
    const [adminProfile, authorProfile] = await Promise.all([
        club.admin_id ? profileService.getProfileSummary(club.admin_id) : Promise.resolve(null),
        club.author_id
            ? supabase.from('profile_public_summaries').select('id, user_id, display_name, username, avatar_url, trust_score, city, membership_tier').eq('id', club.author_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);

    const resolvedAuthor = 'data' in authorProfile ? authorProfile.data : null;

    return {
        id: club.id,
        name: club.name,
        description: club.description,
        cover_url: club.cover_url,
        club_type: club.club_type,
        access_level: club.access_level,
        meeting_type: club.meeting_type,
        member_count: club.member_count,
        max_members: club.max_members,
        current_book_id: club.current_book_id,
        current_book_google_books_id: null,
        current_book_title: club.current_book?.title ?? null,
        current_book_authors: club.current_book?.authors ?? null,
        current_book_cover_url: club.current_book?.cover_url ?? null,
        current_book_retail_price: null,
        current_book_currency_code: null,
        admin_id: club.admin_id,
        admin_profile_id: adminProfile?.id ?? null,
        admin_display_name: adminProfile?.display_name ?? null,
        admin_avatar_url: adminProfile?.avatar_url ?? null,
        admin_city: adminProfile?.city ?? null,
        author_id: club.author_id,
        author_user_id: resolvedAuthor?.user_id ?? null,
        author_display_name: resolvedAuthor?.display_name ?? null,
        author_avatar_url: resolvedAuthor?.avatar_url ?? null,
        author_city: resolvedAuthor?.city ?? null,
        created_at: club.created_at,
        updated_at: club.updated_at,
        is_archived: club.is_archived,
        archived_at: club.archived_at,
    };
}

function applyPublicClubFilters(query: any, filters: ClubFilters) {
    const { clubType, meetingType, accessLevel, search } = filters;
    if (clubType) query = query.eq('club_type', clubType);
    if (meetingType) query = query.eq('meeting_type', meetingType);
    if (accessLevel) query = query.eq('access_level', accessLevel);
    const term = normalizePublicClubSearchTerm(search);
    if (term) {
        query = query.or(`name.ilike.%${term}%,current_book_title.ilike.%${term}%,admin_display_name.ilike.%${term}%,author_display_name.ilike.%${term}%`);
    }
    return query;
}

export async function getPublicClubs(filters: ClubFilters = {}): Promise<ClubPublicDetails[]> {
    const { limit = 20, offset = 0 } = filters;
    let query = supabase.from('club_public_details').select(CLUB_PUBLIC_DETAILS_SELECT)
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
    let query = supabase.from('club_public_details').select(CLUB_PUBLIC_DETAILS_SELECT)
        .in('id', clubIds)
        .order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    query = applyPublicClubFilters(query, filters);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClubPublicDetails[];
}

export async function getPublicClubById(clubId: string): Promise<ClubPublicDetails> {
    const { data, error } = await supabase.from('club_public_details').select(CLUB_PUBLIC_DETAILS_SELECT).eq('id', clubId).single();
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
    return ((data ?? []) as unknown as ClubWithBookRow[]).map(mapClubWithBook);
}

export async function getClubManageDetail(clubId: string): Promise<ClubManageDetails> {
    const { data, error } = await supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT).eq('id', clubId).single();
    if (error) throw error;
    return mapClubWithBookToManageDetails(data as unknown as ClubWithBookRow);
}

export async function getClubById(clubId: string): Promise<ClubWithDetails> {
    const { data, error } = await supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT).eq('id', clubId).single();
    if (error) throw error;
    const club = mapClubWithBook(data as unknown as ClubWithBookRow);
    const admin = club.admin_id ? await profileService.getProfileSummary(club.admin_id) : null;
    return { ...club, admin };
}

export async function getMyClubs(userId: string): Promise<ClubWithBook[]> {
    const { data: memberships, error: membershipError } = await supabase.from('club_members').select('club_id').eq('user_id', userId).eq('status', 'active');
    if (membershipError) throw membershipError;
    const clubIds = (memberships ?? []).map((membership) => membership.club_id).filter((clubId): clubId is string => clubId !== null);
    if (clubIds.length === 0) return [];
    const { data, error } = await supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT).in('id', clubIds).order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as unknown as ClubWithBookRow[]).map(mapClubWithBook);
}

export async function getMyArchivedManagedClubs(userId: string, filters: ClubFilters = {}): Promise<ClubManageDetails[]> {
    const { clubType, meetingType, accessLevel, limit = 20, offset = 0, search } = filters;
    let query = supabase.from('book_clubs').select(CLUB_WITH_BOOK_SELECT)
        .eq('admin_id', userId)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (clubType) query = query.eq('club_type', clubType);
    if (meetingType) query = query.eq('meeting_type', meetingType);
    if (accessLevel) query = query.eq('access_level', accessLevel);
    if (search) query = query.ilike('name', `%${normalizePublicClubSearchTerm(search)}%`);
    const { data, error } = await query;
    if (error) throw error;
    return Promise.all(((data ?? []) as unknown as ClubWithBookRow[]).map(mapClubWithBookToManageDetails));
}
