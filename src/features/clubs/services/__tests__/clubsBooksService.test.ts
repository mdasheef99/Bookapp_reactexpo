/**
 * WU-TC06 — Clubs book service contract tests (B1–B11).
 *
 * Mock boundary: Supabase client + profile service only. The service modules
 * under test are never mocked. No live Supabase, no RLS/trigger reproduction.
 *
 * Every assertion targets the materially important contract: table/RPC name,
 * payload, filters, ordering, limit, single/maybeSingle, onConflict, return
 * transform, and error behavior.
 */
jest.mock('@/lib/supabase');
jest.mock('@/features/auth/services/profileService', () => ({
    profileService: { getProfileSummaries: jest.fn().mockResolvedValue([]) },
}));

import {
    castClubBookVote,
    finalizeClubBookNomination,
    getClubBookNominations,
    getClubCurrentBookStatusOverview,
    getClubReadingSchedule,
    nominateClubBook,
    removeClubBookVote,
    setClubCurrentBookFromNomination,
    setClubCurrentBookReadingStatus,
    updateClubReadingProgress,
    upsertClubReadingSchedule,
} from '../clubsBooksService';
import { profileService } from '@/features/auth/services/profileService';
import { supabase } from '@/lib/supabase';

const mockedFrom = supabase.from as unknown as jest.Mock;
const mockedRpc = supabase.rpc as unknown as jest.Mock;
const mockedGetProfileSummaries = profileService.getProfileSummaries as unknown as jest.Mock;

const CHAIN_METHODS = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'in',
    'is',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
    'match',
    'or',
    'filter',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChainBuilder = Record<string, jest.Mock> & { then: (resolve: (value: any) => void) => void };

function makeBuilder(response: { data: unknown; error: unknown }): ChainBuilder {
    const builder: Record<string, unknown> = {};
    CHAIN_METHODS.forEach((method) => {
        builder[method] = jest.fn(() => builder);
    });
    builder.then = (resolve: (value: unknown) => void) => resolve(response);
    return builder as unknown as ChainBuilder;
}

function eqCalls(builder: ChainBuilder): Array<[string, unknown]> {
    return builder.eq.mock.calls as Array<[string, unknown]>;
}

function orderCalls(builder: ChainBuilder): Array<[string, { ascending: boolean }]> {
    return builder.order.mock.calls as Array<[string, { ascending: boolean }]>;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetProfileSummaries.mockResolvedValue([]);
});

describe('B1 — getClubBookNominations', () => {
    const nominationRow = {
        id: 'nom-1',
        club_id: 'club-1',
        book_id: 'book-1',
        nominated_by: 'user-1',
        vote_count: 3,
        status: 'active',
        voting_ends_at: null,
        created_at: '2026-03-01T00:00:00.000Z',
        book: { id: 'book-1', google_books_id: null, title: 'Dune', authors: ['Frank Herbert'], cover_url: null },
        votes: [{ nomination_id: 'nom-1', user_id: 'viewer-1', created_at: '2026-03-02T00:00:00.000Z' }],
    };

    it('queries book_nominations scoped to the club with vote-count desc + created-at asc ordering', async () => {
        const builder = makeBuilder({ data: [nominationRow], error: null });
        mockedFrom.mockReturnValueOnce(builder);
        mockedGetProfileSummaries.mockResolvedValueOnce([
            { user_id: 'user-1', username: 'nominator', display_name: 'Nominator', avatar_url: null },
        ]);

        await getClubBookNominations('club-1', 'viewer-1');

        expect(mockedFrom).toHaveBeenCalledWith('book_nominations');
        expect(eqCalls(builder)).toContainEqual(['club_id', 'club-1']);
        expect(orderCalls(builder)).toContainEqual(['vote_count', { ascending: false }]);
        expect(orderCalls(builder)).toContainEqual(['created_at', { ascending: true }]);
    });

    it('fails if the club scoping filter is removed (load-bearing eq assertion)', async () => {
        const builder = makeBuilder({ data: [], error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await getClubBookNominations('club-1');

        const columns = eqCalls(builder).map(([column]) => column);
        expect(columns).toContain('club_id');
        expect(builder.eq).toHaveBeenCalledWith('club_id', 'club-1');
    });

    it('fails if either ordering direction changes', async () => {
        const builder = makeBuilder({ data: [], error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await getClubBookNominations('club-1');

        expect(builder.order).toHaveBeenCalledWith('vote_count', { ascending: false });
        expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('normalizes a related book object and enriches the nominator profile + currentUserVote', async () => {
        const builder = makeBuilder({ data: [nominationRow], error: null });
        mockedFrom.mockReturnValueOnce(builder);
        mockedGetProfileSummaries.mockResolvedValueOnce([
            { user_id: 'user-1', username: 'nominator', display_name: 'Nominator', avatar_url: null },
        ]);

        const [result] = await getClubBookNominations('club-1', 'viewer-1');

        expect(result.book).toEqual(nominationRow.book);
        expect(result.nominatorProfile).toEqual(
            expect.objectContaining({ user_id: 'user-1' }),
        );
        expect(result.currentUserVote).toEqual(nominationRow.votes[0]);
        expect(mockedGetProfileSummaries).toHaveBeenCalledWith(['user-1']);
    });

    it('normalizes a related book array to its first entry', async () => {
        const builder = makeBuilder({
            data: [{ ...nominationRow, book: [nominationRow.book], votes: [] }],
            error: null,
        });
        mockedFrom.mockReturnValueOnce(builder);

        const [result] = await getClubBookNominations('club-1', 'viewer-1');

        expect(result.book).toEqual(nominationRow.book);
    });

    it('returns null currentUserVote for anonymous viewers', async () => {
        const builder = makeBuilder({ data: [nominationRow], error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const [result] = await getClubBookNominations('club-1');

        expect(result.currentUserVote).toBeNull();
    });

    it('returns [] for an empty list', async () => {
        const builder = makeBuilder({ data: [], error: null });
        mockedFrom.mockReturnValueOnce(builder);

        await expect(getClubBookNominations('club-1', 'viewer-1')).resolves.toEqual([]);
        expect(mockedGetProfileSummaries).not.toHaveBeenCalled();
    });

    it('rethrows the raw Supabase error', async () => {
        const rawError = new Error('nominations exploded');
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: rawError }));

        await expect(getClubBookNominations('club-1')).rejects.toBe(rawError);
    });
});

describe('B2 — nominateClubBook', () => {
    it('internal-book path sends exactly the adapter contract', async () => {
        const row = { id: 'nom-9', club_id: 'club-1', book_id: 'book-9' };
        mockedRpc.mockResolvedValueOnce({ data: [row], error: null });

        const result = await nominateClubBook({
            clubId: 'club-1',
            bookId: 'book-9',
            votingEndsAt: '2026-04-01T00:00:00.000Z',
        });

        expect(mockedRpc).toHaveBeenCalledWith('nominate_club_book', {
            p_club_id: 'club-1',
            p_book_id: 'book-9',
            p_google_books_id: null,
            p_title: null,
            p_authors: null,
            p_cover_url: null,
            p_voting_ends_at: '2026-04-01T00:00:00.000Z',
        });
        expect(result).toEqual(row);
    });

    it('google-book path maps id/title/authors/cover through the adapter', async () => {
        const row = { id: 'nom-10', club_id: 'club-1', book_id: null };
        mockedRpc.mockResolvedValueOnce({ data: row, error: null });

        await nominateClubBook({
            clubId: 'club-1',
            googleBook: {
                id: 'google-1',
                volumeInfo: {
                    title: 'Project Hail Mary',
                    authors: ['Andy Weir'],
                    imageLinks: { thumbnail: 'https://example.test/cover.jpg' },
                },
            },
        });

        expect(mockedRpc).toHaveBeenCalledWith('nominate_club_book', {
            p_club_id: 'club-1',
            p_book_id: null,
            p_google_books_id: 'google-1',
            p_title: 'Project Hail Mary',
            p_authors: ['Andy Weir'],
            p_cover_url: 'https://example.test/cover.jpg',
            p_voting_ends_at: null,
        });
    });

    it('requires a selected book before any RPC call', async () => {
        await expect(nominateClubBook({ clubId: 'club-1' })).rejects.toThrow(
            'A selected book is required to create a nomination',
        );
        expect(mockedRpc).not.toHaveBeenCalled();
    });

    it('throws on an empty RPC result', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [], error: null });

        await expect(nominateClubBook({ clubId: 'club-1', bookId: 'book-1' })).rejects.toThrow(
            'Nomination response was empty',
        );
    });

    it('rethrows the raw Supabase error', async () => {
        const rawError = new Error('nominate exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(nominateClubBook({ clubId: 'club-1', bookId: 'book-1' })).rejects.toBe(rawError);
    });
});

describe('B3/B4 — castClubBookVote / removeClubBookVote', () => {
    it('cast uses the cast_club_book_vote RPC with {p_nomination_id} and returns the row', async () => {
        const row = { nomination_id: 'nom-1', user_id: 'viewer-1', created_at: null };
        mockedRpc.mockResolvedValueOnce({ data: row, error: null });

        const result = await castClubBookVote('nom-1');

        expect(mockedRpc).toHaveBeenCalledWith('cast_club_book_vote', { p_nomination_id: 'nom-1' });
        expect(result).toEqual(row);
    });

    it('cast normalizes an array row to its first entry', async () => {
        const row = { nomination_id: 'nom-1', user_id: 'viewer-1', created_at: null };
        mockedRpc.mockResolvedValueOnce({ data: [row], error: null });

        await expect(castClubBookVote('nom-1')).resolves.toEqual(row);
    });

    it('cast throws on an empty result', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [], error: null });

        await expect(castClubBookVote('nom-1')).rejects.toThrow('Vote response was empty');
    });

    it('cast rethrows the raw error', async () => {
        const rawError = new Error('vote exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(castClubBookVote('nom-1')).rejects.toBe(rawError);
    });

    it('remove uses the remove_club_book_vote RPC and resolves void', async () => {
        mockedRpc.mockResolvedValueOnce({ data: null, error: null });

        await expect(removeClubBookVote('nom-1')).resolves.toBeUndefined();
        expect(mockedRpc).toHaveBeenCalledWith('remove_club_book_vote', { p_nomination_id: 'nom-1' });
    });

    it('remove rethrows the raw error', async () => {
        const rawError = new Error('remove vote exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(removeClubBookVote('nom-1')).rejects.toBe(rawError);
    });
});

describe('B5/B6 — finalizeClubBookNomination / setClubCurrentBookFromNomination', () => {
    it('finalize uses finalize_club_book_nomination and returns the club', async () => {
        const club = { id: 'club-1', name: 'Sci-fi' };
        mockedRpc.mockResolvedValueOnce({ data: [club], error: null });

        const result = await finalizeClubBookNomination('nom-1');

        expect(mockedRpc).toHaveBeenCalledWith('finalize_club_book_nomination', {
            p_nomination_id: 'nom-1',
        });
        expect(result).toEqual(club);
    });

    it('finalize throws on an empty result', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [], error: null });

        await expect(finalizeClubBookNomination('nom-1')).rejects.toThrow(
            'Finalize nomination response was empty',
        );
    });

    it('finalize rethrows the raw error', async () => {
        const rawError = new Error('finalize exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(finalizeClubBookNomination('nom-1')).rejects.toBe(rawError);
    });

    it('set-current-book uses set_club_current_book_from_nomination and returns the club', async () => {
        const club = { id: 'club-1', name: 'Sci-fi' };
        mockedRpc.mockResolvedValueOnce({ data: club, error: null });

        const result = await setClubCurrentBookFromNomination('nom-1');

        expect(mockedRpc).toHaveBeenCalledWith('set_club_current_book_from_nomination', {
            p_nomination_id: 'nom-1',
        });
        expect(result).toEqual(club);
    });

    it('set-current-book throws on an empty result', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [], error: null });

        await expect(setClubCurrentBookFromNomination('nom-1')).rejects.toThrow(
            'Set current book response was empty',
        );
    });

    it('set-current-book rethrows the raw error', async () => {
        const rawError = new Error('set current exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(setClubCurrentBookFromNomination('nom-1')).rejects.toBe(rawError);
    });
});

describe('B7/B8 — current book status overview', () => {
    const overview = {
        current_book_id: 'book-1',
        member_reading_status: 'reading',
        to_start_count: 1,
        reading_count: 2,
        completed_count: 3,
        active_member_count: 6,
    };

    it('get uses get_club_current_book_status_overview with {p_club_id} and unwraps the array row', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [overview], error: null });

        const result = await getClubCurrentBookStatusOverview('club-1');

        expect(mockedRpc).toHaveBeenCalledWith('get_club_current_book_status_overview', {
            p_club_id: 'club-1',
        });
        expect(result).toEqual(overview);
    });

    it('get surfaces the raw error', async () => {
        const rawError = new Error('overview exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(getClubCurrentBookStatusOverview('club-1')).rejects.toBe(rawError);
    });

    it('set uses set_club_current_book_reading_status with {p_club_id, p_status}', async () => {
        mockedRpc.mockResolvedValueOnce({ data: [overview], error: null });

        const result = await setClubCurrentBookReadingStatus('club-1', 'completed');

        expect(mockedRpc).toHaveBeenCalledWith('set_club_current_book_reading_status', {
            p_club_id: 'club-1',
            p_status: 'completed',
        });
        expect(result).toEqual(overview);
    });

    it('set surfaces the raw error', async () => {
        const rawError = new Error('set status exploded');
        mockedRpc.mockResolvedValueOnce({ data: null, error: rawError });

        await expect(setClubCurrentBookReadingStatus('club-1', 'reading')).rejects.toBe(rawError);
    });
});

describe('B9 — getClubReadingSchedule', () => {
    const scheduleRow = {
        id: 'schedule-1',
        club_id: 'club-1',
        book_id: 'book-1',
        milestones: [{ id: 'm-1', label: 'Part 1', target: 'Ch 1-5', dueDate: null }],
        created_by: 'user-1',
        created_at: '2026-03-01T00:00:00.000Z',
    };

    it('null bookId returns null with zero table calls', async () => {
        await expect(getClubReadingSchedule('club-1', null, 'viewer-1')).resolves.toBeNull();
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('looks up the latest schedule scoped to club + book', async () => {
        const scheduleBuilder = makeBuilder({ data: scheduleRow, error: null });
        mockedFrom.mockReturnValueOnce(scheduleBuilder);

        const result = await getClubReadingSchedule('club-1', 'book-1');

        expect(mockedFrom).toHaveBeenCalledWith('reading_schedules');
        expect(eqCalls(scheduleBuilder)).toContainEqual(['club_id', 'club-1']);
        expect(eqCalls(scheduleBuilder)).toContainEqual(['book_id', 'book-1']);
        expect(scheduleBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(scheduleBuilder.limit).toHaveBeenCalledWith(1);
        expect(scheduleBuilder.maybeSingle).toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({ id: 'schedule-1' }));
        expect(result?.currentUserProgress).toBeNull();
    });

    it('loads member progress for an explicit viewer', async () => {
        const scheduleBuilder = makeBuilder({ data: scheduleRow, error: null });
        const progressRow = {
            id: 'progress-1',
            schedule_id: 'schedule-1',
            user_id: 'viewer-1',
            chapters_completed: 4,
            last_updated: '2026-03-02T00:00:00.000Z',
        };
        const progressBuilder = makeBuilder({ data: progressRow, error: null });
        mockedFrom.mockReturnValueOnce(scheduleBuilder).mockReturnValueOnce(progressBuilder);

        const result = await getClubReadingSchedule('club-1', 'book-1', 'viewer-1');

        expect(mockedFrom).toHaveBeenNthCalledWith(2, 'member_reading_progress');
        expect(eqCalls(progressBuilder)).toContainEqual(['schedule_id', 'schedule-1']);
        expect(eqCalls(progressBuilder)).toContainEqual(['user_id', 'viewer-1']);
        expect(progressBuilder.maybeSingle).toHaveBeenCalled();
        expect(result?.currentUserProgress).toEqual(progressRow);
    });

    it('skips the progress lookup without a viewer', async () => {
        const scheduleBuilder = makeBuilder({ data: scheduleRow, error: null });
        mockedFrom.mockReturnValueOnce(scheduleBuilder);

        const result = await getClubReadingSchedule('club-1', 'book-1');

        expect(mockedFrom).toHaveBeenCalledTimes(1);
        expect(result?.currentUserProgress).toBeNull();
    });

    it('returns null when no schedule exists', async () => {
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

        await expect(getClubReadingSchedule('club-1', 'book-1', 'viewer-1')).resolves.toBeNull();
    });

    it('normalizes raw milestones', async () => {
        const scheduleBuilder = makeBuilder({
            data: {
                ...scheduleRow,
                milestones: [
                    { label: '  Part 1  ', target: '  Ch 1-5 ', dueDate: ' 2026-04-01 ' },
                    null,
                    {},
                ],
            },
            error: null,
        });
        mockedFrom.mockReturnValueOnce(scheduleBuilder);

        const result = await getClubReadingSchedule('club-1', 'book-1');

        expect(result?.milestones).toEqual([
            { id: 'milestone-1', label: 'Part 1', target: 'Ch 1-5', dueDate: '2026-04-01' },
        ]);
    });

    it('surfaces schedule-query errors', async () => {
        const rawError = new Error('schedule exploded');
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: rawError }));

        await expect(getClubReadingSchedule('club-1', 'book-1')).rejects.toBe(rawError);
    });

    it('surfaces progress-query errors', async () => {
        const rawError = new Error('progress exploded');
        mockedFrom
            .mockReturnValueOnce(makeBuilder({ data: scheduleRow, error: null }))
            .mockReturnValueOnce(makeBuilder({ data: null, error: rawError }));

        await expect(getClubReadingSchedule('club-1', 'book-1', 'viewer-1')).rejects.toBe(rawError);
    });
});

describe('B10 — upsertClubReadingSchedule', () => {
    const milestones = [{ id: 'm-1', label: 'Part 1', target: 'Ch 1-5', dueDate: null }];

    it('throws before any write when no valid milestones remain', async () => {
        await expect(
            upsertClubReadingSchedule({ clubId: 'club-1', bookId: 'book-1', milestones: [] }),
        ).rejects.toThrow('Add at least one reading milestone.');
        expect(mockedFrom).not.toHaveBeenCalled();
    });

    it('updates the existing schedule by its exact id without touching ownership metadata', async () => {
        const lookupBuilder = makeBuilder({ data: { id: 'schedule-1' }, error: null });
        const writeBuilder = makeBuilder({
            data: {
                id: 'schedule-1',
                club_id: 'club-1',
                book_id: 'book-1',
                milestones,
                created_by: 'owner-1',
                created_at: '2026-03-01T00:00:00.000Z',
            },
            error: null,
        });
        mockedFrom.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(writeBuilder);

        const result = await upsertClubReadingSchedule({
            clubId: 'club-1',
            bookId: 'book-1',
            milestones,
        });

        expect(lookupBuilder.maybeSingle).toHaveBeenCalled();
        expect(writeBuilder.update).toHaveBeenCalledWith({
            club_id: 'club-1',
            book_id: 'book-1',
            milestones,
        });
        expect(writeBuilder.update).toHaveBeenCalledTimes(1);
        const updatePayload = writeBuilder.update.mock.calls[0][0] as Record<string, unknown>;
        expect(updatePayload).not.toHaveProperty('created_by');
        expect(writeBuilder.eq).toHaveBeenCalledWith('id', 'schedule-1');
        expect(writeBuilder.single).toHaveBeenCalled();
        expect(result.id).toBe('schedule-1');
    });

    it('inserts a new schedule carrying created_by', async () => {
        const lookupBuilder = makeBuilder({ data: null, error: null });
        const writeBuilder = makeBuilder({
            data: {
                id: 'schedule-2',
                club_id: 'club-1',
                book_id: 'book-1',
                milestones,
                created_by: 'creator-1',
                created_at: '2026-03-01T00:00:00.000Z',
            },
            error: null,
        });
        mockedFrom.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(writeBuilder);

        const result = await upsertClubReadingSchedule({
            clubId: 'club-1',
            bookId: 'book-1',
            milestones,
            createdBy: 'creator-1',
        });

        expect(writeBuilder.insert).toHaveBeenCalledWith({
            club_id: 'club-1',
            book_id: 'book-1',
            milestones,
            created_by: 'creator-1',
        });
        expect(writeBuilder.single).toHaveBeenCalled();
        expect(result.id).toBe('schedule-2');
    });

    it('surfaces lookup and write errors', async () => {
        const lookupError = new Error('lookup exploded');
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: lookupError }));
        await expect(
            upsertClubReadingSchedule({ clubId: 'club-1', bookId: 'book-1', milestones }),
        ).rejects.toBe(lookupError);

        jest.clearAllMocks();
        const writeError = new Error('write exploded');
        mockedFrom
            .mockReturnValueOnce(makeBuilder({ data: null, error: null }))
            .mockReturnValueOnce(makeBuilder({ data: null, error: writeError }));
        await expect(
            upsertClubReadingSchedule({ clubId: 'club-1', bookId: 'book-1', milestones }),
        ).rejects.toBe(writeError);
    });
});

describe('B11 — updateClubReadingProgress', () => {
    it('upserts scoped by schedule+user with onConflict schedule_id,user_id', async () => {
        const row = {
            id: 'progress-1',
            schedule_id: 'schedule-1',
            user_id: 'viewer-1',
            chapters_completed: 3,
            last_updated: '2026-03-02T00:00:00.000Z',
        };
        const builder = makeBuilder({ data: row, error: null });
        mockedFrom.mockReturnValueOnce(builder);

        const result = await updateClubReadingProgress('schedule-1', 'viewer-1', 3);

        expect(mockedFrom).toHaveBeenCalledWith('member_reading_progress');
        expect(builder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                schedule_id: 'schedule-1',
                user_id: 'viewer-1',
                chapters_completed: 3,
            }),
            { onConflict: 'schedule_id,user_id' },
        );
        const payload = builder.upsert.mock.calls[0][0] as Record<string, unknown>;
        expect(typeof payload.last_updated).toBe('string');
        expect(builder.single).toHaveBeenCalled();
        expect(result).toEqual(row);
    });

    it('truncates fractional progress and clamps negatives to zero', async () => {
        const builder = makeBuilder({ data: {}, error: null });
        mockedFrom.mockReturnValueOnce(builder);
        await updateClubReadingProgress('schedule-1', 'viewer-1', 2.9);
        expect((builder.upsert.mock.calls[0][0] as { chapters_completed: number }).chapters_completed).toBe(2);

        jest.clearAllMocks();
        const negativeBuilder = makeBuilder({ data: {}, error: null });
        mockedFrom.mockReturnValueOnce(negativeBuilder);
        await updateClubReadingProgress('schedule-1', 'viewer-1', -4.7);
        expect(
            (negativeBuilder.upsert.mock.calls[0][0] as { chapters_completed: number }).chapters_completed,
        ).toBe(0);
    });

    it('propagates the raw Supabase error', async () => {
        const rawError = new Error('progress exploded');
        mockedFrom.mockReturnValueOnce(makeBuilder({ data: null, error: rawError }));

        await expect(updateClubReadingProgress('schedule-1', 'viewer-1', 1)).rejects.toBe(rawError);
    });
});
