jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { readingHistoryGateway } from '../readingHistoryGateway';
import { ReadingHistoryError } from '../readingHistoryContract';

const fromMock = supabase.from as jest.Mock;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function queryBuilder(response: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single', 'abortSignal']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  return builder;
}

function validRead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'reading',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    started_on: null,
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: 320,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

function validProgress(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progress-1',
    read_id: 'read-1',
    user_id: 'actor',
    page: 142,
    percent: null,
    recorded_at: '2026-10-10T10:00:00.000Z',
    ...overrides,
  };
}

function titleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book-1',
    user_id: 'actor',
    book: { title: 'Walden' },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as never, status: 'authenticated' });
});

afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

describe('actor checks', () => {
  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.openReadsWithProgress('actor')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.userBookTitle('actor', 'book-1')).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('openReadsWithProgress', () => {
  it('filters open reads by the actor and orders by updated_at descending', async () => {
    const reads = queryBuilder({ data: [validRead()], error: null });
    const titles = queryBuilder({ data: [titleRow()], error: null });
    const progress = queryBuilder({ data: [validProgress()], error: null });
    fromMock.mockReturnValueOnce(reads);
    fromMock.mockReturnValueOnce(titles);
    fromMock.mockReturnValueOnce(progress);
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows).toHaveLength(1);
    expect(rows[0].bookTitle).toBe('Walden');
    expect(rows[0].latestProgress).toMatchObject({ page: 142 });
    expect(fromMock).toHaveBeenNthCalledWith(1, 'user_book_reads');
    expect(reads.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(reads.eq).toHaveBeenCalledWith('outcome', 'reading');
    expect(reads.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(fromMock).toHaveBeenNthCalledWith(2, 'user_books');
    expect(titles.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(titles.in).toHaveBeenCalledWith('id', ['book-1']);
    expect(fromMock).toHaveBeenNthCalledWith(3, 'user_book_progress');
    expect(progress.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(progress.in).toHaveBeenCalledWith('read_id', ['read-1']);
  });

  it('returns the most recently updated read first', async () => {
    const older = validRead({ id: 'read-old', updated_at: '2026-10-01T10:00:00.000Z', user_book_id: 'book-old', started_at: '2026-10-01T10:00:00.000Z' });
    const newer = validRead({ id: 'read-new', updated_at: '2026-10-20T10:00:00.000Z', user_book_id: 'book-new', started_at: '2026-10-01T10:00:00.000Z' });
    fromMock.mockReturnValueOnce(queryBuilder({ data: [older, newer], error: null }));
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [
          titleRow({ id: 'book-old', book: { title: 'Old' } }),
          titleRow({ id: 'book-new', book: { title: 'New' } }),
        ],
        error: null,
      }),
    );
    fromMock.mockReturnValueOnce(queryBuilder({ data: [], error: null }));
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows.map((row) => row.bookTitle)).toEqual(['New', 'Old']);
  });

  it('ranks by latest activity: older updated_at but newer progress wins', async () => {
    const stale = validRead({
      id: 'read-stale',
      user_book_id: 'book-stale',
      updated_at: '2026-10-20T10:00:00.000Z',
      started_at: '2026-10-01T10:00:00.000Z',
    });
    const fresh = validRead({
      id: 'read-fresh',
      user_book_id: 'book-fresh',
      updated_at: '2026-10-01T10:00:00.000Z',
      started_at: '2026-10-01T10:00:00.000Z',
    });
    fromMock.mockReturnValueOnce(queryBuilder({ data: [stale, fresh], error: null }));
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [
          titleRow({ id: 'book-stale', book: { title: 'Stale' } }),
          titleRow({ id: 'book-fresh', book: { title: 'Fresh' } }),
        ],
        error: null,
      }),
    );
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [
          validProgress({ id: 'p-old', read_id: 'read-stale', recorded_at: '2026-10-05T10:00:00.000Z' }),
          validProgress({ id: 'p-new', read_id: 'read-fresh', recorded_at: '2026-10-21T10:00:00.000Z' }),
        ],
        error: null,
      }),
    );
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows.map((row) => row.bookTitle)).toEqual(['Fresh', 'Stale']);
    expect(rows[0].lastActivityAt).toBe('2026-10-21T10:00:00.000Z');
    expect(rows[1].lastActivityAt).toBe('2026-10-20T10:00:00.000Z');
  });

  it('uses started_at when it is the latest activity', async () => {
    const first = validRead({
      id: 'read-a',
      user_book_id: 'book-a',
      updated_at: '2026-10-05T10:00:00.000Z',
      started_at: '2026-10-06T10:00:00.000Z',
    });
    const second = validRead({
      id: 'read-b',
      user_book_id: 'book-b',
      updated_at: '2026-10-05T10:00:00.000Z',
      started_at: '2026-10-08T10:00:00.000Z',
    });
    fromMock.mockReturnValueOnce(queryBuilder({ data: [first, second], error: null }));
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [
          titleRow({ id: 'book-a', book: { title: 'A' } }),
          titleRow({ id: 'book-b', book: { title: 'B' } }),
        ],
        error: null,
      }),
    );
    fromMock.mockReturnValueOnce(queryBuilder({ data: [], error: null }));
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows.map((row) => row.bookTitle)).toEqual(['B', 'A']);
    expect(rows[0].lastActivityAt).toBe('2026-10-08T10:00:00.000Z');
  });

  it('breaks last-activity ties deterministically by read id', async () => {
    const first = validRead({
      id: 'read-b',
      user_book_id: 'book-b',
      updated_at: '2026-10-10T10:00:00.000Z',
      started_at: '2026-10-01T10:00:00.000Z',
    });
    const second = validRead({
      id: 'read-a',
      user_book_id: 'book-a',
      updated_at: '2026-10-10T10:00:00.000Z',
      started_at: '2026-10-01T10:00:00.000Z',
    });
    fromMock.mockReturnValueOnce(queryBuilder({ data: [first, second], error: null }));
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [
          titleRow({ id: 'book-b', book: { title: 'B' } }),
          titleRow({ id: 'book-a', book: { title: 'A' } }),
        ],
        error: null,
      }),
    );
    fromMock.mockReturnValueOnce(queryBuilder({ data: [], error: null }));
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows.map((row) => row.read.id)).toEqual(['read-a', 'read-b']);
    expect(rows[0].lastActivityAt).toBe(rows[1].lastActivityAt);
  });

  it('batches titles and progress with deterministic latest ordering', async () => {
    const reads = queryBuilder({ data: [validRead()], error: null });
    const titles = queryBuilder({ data: [titleRow()], error: null });
    const progress = queryBuilder({ data: [validProgress()], error: null });
    fromMock.mockReturnValueOnce(reads);
    fromMock.mockReturnValueOnce(titles);
    fromMock.mockReturnValueOnce(progress);
    await readingHistoryGateway.openReadsWithProgress('actor');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'user_books');
    expect(fromMock).toHaveBeenNthCalledWith(3, 'user_book_progress');
    expect(titles.in).toHaveBeenCalledWith('id', ['book-1']);
    expect(progress.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(progress.in).toHaveBeenCalledWith('read_id', ['read-1']);
    expect(progress.order).toHaveBeenCalledWith('recorded_at', { ascending: false });
    expect(progress.order).toHaveBeenCalledWith('id', { ascending: false });
  });

  it('uses a bounded number of queries that does not grow with N', async () => {
    const trio = [1, 2, 3].map((n) =>
      validRead({ id: `read-${n}`, user_book_id: `book-${n}`, updated_at: `2026-10-0${n}T10:00:00.000Z` }),
    );
    fromMock.mockReturnValueOnce(queryBuilder({ data: trio, error: null }));
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: trio.map((read, index) => titleRow({ id: read.user_book_id, book: { title: `Title ${index + 1}` } })),
        error: null,
      }),
    );
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: trio.map((read) => validProgress({ id: `progress-${read.id}`, read_id: read.id })),
        error: null,
      }),
    );
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows).toHaveLength(3);
    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock).toHaveBeenNthCalledWith(1, 'user_book_reads');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'user_books');
    expect(fromMock).toHaveBeenNthCalledWith(3, 'user_book_progress');
  });

  it('picks the latest progress per read when recorded_at ties', async () => {
    const first = validRead({ id: 'read-1', user_book_id: 'book-1' });
    const second = validRead({ id: 'read-2', user_book_id: 'book-2' });
    fromMock.mockReturnValueOnce(queryBuilder({ data: [first, second], error: null }));
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [titleRow({ id: 'book-1', book: { title: 'First' } }), titleRow({ id: 'book-2', book: { title: 'Second' } })],
        error: null,
      }),
    );
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: [
          validProgress({ id: 'a-progress', read_id: 'read-1', page: 10, recorded_at: '2026-10-10T10:00:00.000Z' }),
          validProgress({ id: 'z-progress', read_id: 'read-1', page: 20, recorded_at: '2026-10-10T10:00:00.000Z' }),
          validProgress({ id: 'm-progress', read_id: 'read-2', page: 30, recorded_at: '2026-10-09T10:00:00.000Z' }),
        ],
        error: null,
      }),
    );
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    const byId = new Map(rows.map((row) => [row.read.id, row]));
    expect(byId.get('read-1')?.latestProgress).toMatchObject({ id: 'z-progress', page: 20 });
    expect(byId.get('read-2')?.latestProgress).toMatchObject({ id: 'm-progress', page: 30 });
  });

  it('returns null progress when a read has no entries', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: [validRead()], error: null }));
    fromMock.mockReturnValueOnce(queryBuilder({ data: [titleRow()], error: null }));
    fromMock.mockReturnValueOnce(queryBuilder({ data: [], error: null }));
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows[0].latestProgress).toBeNull();
  });

  it('skips reads whose book is not in the library and drops foreign rows', async () => {
    const own = validRead();
    const foreign = validRead({ id: 'read-foreign', user_id: 'someone-else', user_book_id: 'book-foreign' });
    const finished = validRead({ id: 'read-finished', outcome: 'finished', user_book_id: 'book-finished' });
    const missing = validRead({ id: 'read-missing', user_book_id: 'book-gone' });
    fromMock.mockReturnValueOnce(queryBuilder({ data: [own, foreign, finished, missing], error: null }));
    fromMock.mockReturnValueOnce(queryBuilder({ data: [titleRow()], error: null }));
    fromMock.mockReturnValueOnce(queryBuilder({ data: [validProgress()], error: null }));
    const rows = await readingHistoryGateway.openReadsWithProgress('actor');
    expect(rows.map((row) => row.read.id)).toEqual(['read-1']);
  });

  it('forwards an AbortSignal to every query', async () => {
    const controller = new AbortController();
    const reads = queryBuilder({ data: [validRead()], error: null });
    const title = queryBuilder({ data: [titleRow()], error: null });
    const progress = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(reads).mockReturnValueOnce(title).mockReturnValueOnce(progress);
    await readingHistoryGateway.openReadsWithProgress('actor', controller.signal);
    expect(reads.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(title.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(progress.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it('rethrows an already-aborted signal instead of dispatching', async () => {
    const controller = new AbortController();
    controller.abort();
    const failure = await readingHistoryGateway
      .openReadsWithProgress('actor', controller.signal)
      .catch((error: unknown) => error);
    expect(failure).not.toBeInstanceOf(ReadingHistoryError);
    expect((failure as Error).name).toBe('AbortError');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('maps a generic failure to the load message', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } }));
    await expect(readingHistoryGateway.openReadsWithProgress('actor')).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });

  it('rethrows a PostgREST AbortError instead of a load failure', async () => {
    const abort = { code: 'XX000', message: 'AbortError: aborted' };
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: abort }));
    const failure = await readingHistoryGateway
      .openReadsWithProgress('actor')
      .catch((error: unknown) => error);
    expect(failure).toBe(abort);
    expect(failure).not.toBeInstanceOf(ReadingHistoryError);
  });
});

describe('userBookTitle', () => {
  it('returns the joined book title for the owned book', async () => {
    const builder = queryBuilder({ data: titleRow(), error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.userBookTitle('actor', 'book-1')).resolves.toBe('Walden');
    expect(fromMock).toHaveBeenCalledWith('user_books');
    expect(builder.eq).toHaveBeenCalledWith('id', 'book-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
  });

  it('returns null when the book is not in the library', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: null }));
    await expect(readingHistoryGateway.userBookTitle('actor', 'book-gone')).resolves.toBeNull();
  });

  it('returns null for a row owned by another user', async () => {
    fromMock.mockReturnValueOnce(
      queryBuilder({ data: titleRow({ user_id: 'someone-else' }), error: null }),
    );
    await expect(readingHistoryGateway.userBookTitle('actor', 'book-1')).resolves.toBeNull();
  });

  it('forwards an AbortSignal', async () => {
    const builder = queryBuilder({ data: titleRow(), error: null });
    fromMock.mockReturnValueOnce(builder);
    const controller = new AbortController();
    await readingHistoryGateway.userBookTitle('actor', 'book-1', controller.signal);
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
  });
});
