import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';
import type {
    Club,
    ClubBookNomination,
    ClubBookNominationWithDetails,
    ClubBookVote,
    ClubCurrentBookReadingStatus,
    ClubCurrentBookStatusOverview,
    ClubNominationBookSummary,
    NominateClubBookInput,
} from './clubsService.types';

const CLUB_BOOK_NOMINATION_SELECT = `
    id,
    club_id,
    book_id,
    nominated_by,
    vote_count,
    status,
    voting_ends_at,
    created_at,
    book:books!book_id(
        id,
        google_books_id,
        title,
        authors,
        cover_url
    ),
    votes:book_votes(
        nomination_id,
        user_id,
        created_at
    )
`;

type ClubBookNominationRow = ClubBookNomination & {
    book: ClubNominationBookSummary | null;
    votes?: ClubBookVote[] | null;
};

function getGoogleBookCoverUrl(input: NominateClubBookInput): string | null {
    return input.googleBook?.volumeInfo.imageLinks?.thumbnail
        ?? input.googleBook?.volumeInfo.imageLinks?.smallThumbnail
        ?? null;
}

export async function getClubBookNominations(clubId: string, userId?: string | null): Promise<ClubBookNominationWithDetails[]> {
    const { data, error } = await supabase
        .from('book_nominations')
        .select(CLUB_BOOK_NOMINATION_SELECT)
        .eq('club_id', clubId)
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) throw error;

    const nominations = (data ?? []) as ClubBookNominationRow[];
    const nominatorIds = nominations
        .map((nomination) => nomination.nominated_by)
        .filter((value): value is string => Boolean(value));
    const nominatorProfiles = nominatorIds.length > 0 ? await profileService.getProfileSummaries(nominatorIds) : [];
    const profileByUserId = new Map(nominatorProfiles.map((profile) => [profile.user_id, profile]));

    return nominations.map((nomination) => ({
        id: nomination.id,
        club_id: nomination.club_id,
        book_id: nomination.book_id,
        nominated_by: nomination.nominated_by,
        vote_count: nomination.vote_count,
        status: nomination.status,
        voting_ends_at: nomination.voting_ends_at,
        created_at: nomination.created_at,
        book: nomination.book ?? null,
        nominatorProfile: nomination.nominated_by ? profileByUserId.get(nomination.nominated_by) ?? null : null,
        currentUserVote: userId ? nomination.votes?.find((vote) => vote.user_id === userId) ?? null : null,
    }));
}

export async function nominateClubBook(input: NominateClubBookInput): Promise<ClubBookNomination> {
    if (!input.bookId && !input.googleBook) {
        throw new Error('A selected book is required to create a nomination');
    }

    const { data, error } = await supabase.rpc('nominate_club_book', {
        p_club_id: input.clubId,
        p_book_id: input.bookId ?? null,
        p_google_books_id: input.googleBook?.id ?? null,
        p_title: input.googleBook?.volumeInfo.title ?? null,
        p_authors: input.googleBook?.volumeInfo.authors ?? null,
        p_cover_url: getGoogleBookCoverUrl(input),
        p_voting_ends_at: input.votingEndsAt ?? null,
    });

    if (error) throw error;
    return data as ClubBookNomination;
}

export async function castClubBookVote(nominationId: string): Promise<ClubBookVote> {
    const { data, error } = await supabase.rpc('cast_club_book_vote', { p_nomination_id: nominationId });
    if (error) throw error;
    return data as ClubBookVote;
}

export async function removeClubBookVote(nominationId: string): Promise<void> {
    const { error } = await supabase.rpc('remove_club_book_vote', { p_nomination_id: nominationId });
    if (error) throw error;
}

export async function finalizeClubBookNomination(nominationId: string): Promise<Club> {
    const { data, error } = await supabase.rpc('finalize_club_book_nomination', { p_nomination_id: nominationId });
    if (error) throw error;
    return data as Club;
}

export async function getClubCurrentBookStatusOverview(clubId: string): Promise<ClubCurrentBookStatusOverview> {
    const { data, error } = await supabase.rpc('get_club_current_book_status_overview', { p_club_id: clubId });
    if (error) throw error;

    const overview = Array.isArray(data) ? data[0] : data;
    return overview as ClubCurrentBookStatusOverview;
}

export async function setClubCurrentBookReadingStatus(clubId: string, status: ClubCurrentBookReadingStatus): Promise<ClubCurrentBookStatusOverview> {
    const { data, error } = await supabase.rpc('set_club_current_book_reading_status', {
        p_club_id: clubId,
        p_status: status,
    });
    if (error) throw error;

    const overview = Array.isArray(data) ? data[0] : data;
    return overview as ClubCurrentBookStatusOverview;
}