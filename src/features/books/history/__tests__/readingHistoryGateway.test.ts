jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { readingHistoryGateway } from '../readingHistoryGateway';
import { ReadingHistoryError } from '../readingHistoryContract';

const fromMock = supabase.from as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;

// `any` here mirrors src/features/books/notes/__tests__/manualNotesGateway.test.ts:
// the PostgREST builder is only available as a mock in Jest.
function queryBuilder(response: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'single', 'abortSignal']) {
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
    outcome: 'finished',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: '2026-10-20T10:00:00.000Z',
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

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as never, status: 'authenticated' });
});

afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

describe('actor checks', () => {
  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.readsForBook('actor', 'book-1')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.readsForUser('actor')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.openReadBookIds('actor')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.progressForRead('actor', 'read-1')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.goal('actor', 2026)).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.settings('actor')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.startReread('actor', 'book-1')).rejects.toThrow(
      'Sign in again to continue.',
    );
    await expect(readingHistoryGateway.reopenRead('actor', 'read-1')).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('owner filtering', () => {
  it('readsForBook filters by the actor and drops rows for another user', async () => {
    const own = validRead();
    const foreign = validRead({ id: 'read-foreign', user_id: 'someone-else' });
    const builder = queryBuilder({ data: [own, foreign], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.readsForBook('actor', 'book-1');
    expect(rows).toEqual([own]);
    expect(fromMock).toHaveBeenCalledWith('user_book_reads');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('user_book_id', 'book-1');
  });

  it('readsForUser filters by the actor and drops rows for another user', async () => {
    const own = validRead();
    const foreign = validRead({ id: 'read-foreign', user_id: 'someone-else' });
    const builder = queryBuilder({ data: [own, foreign], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.readsForUser('actor');
    expect(rows).toEqual([own]);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
  });

  it('progressForRead filters by the actor and drops rows for another user', async () => {
    const own = validProgress();
    const foreign = validProgress({ id: 'progress-foreign', user_id: 'someone-else' });
    const builder = queryBuilder({ data: [own, foreign], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.progressForRead('actor', 'read-1');
    expect(rows).toEqual([own]);
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('read_id', 'read-1');
  });

  it('rejects a goal row that belongs to another user', async () => {
    const builder = queryBuilder({
      data: { user_id: 'someone-else', year: 2026, target_books: 12, updated_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.goal('actor', 2026)).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });

  it('goal filters by the actor and the year', async () => {
    const builder = queryBuilder({
      data: { user_id: 'actor', year: 2026, target_books: 12, updated_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.goal('actor', 2026)).resolves.toEqual({
      user_id: 'actor',
      year: 2026,
      target_books: 12,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(fromMock).toHaveBeenCalledWith('user_reading_goals');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('year', 2026);
  });

  it('settings filters by the actor', async () => {
    const builder = queryBuilder({
      data: { user_id: 'actor', next_read_user_book_id: null, updated_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.settings('actor')).resolves.toEqual({
      user_id: 'actor',
      next_read_user_book_id: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(fromMock).toHaveBeenCalledWith('user_reading_settings');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
  });

  it('rejects a settings row that belongs to another user', async () => {
    const builder = queryBuilder({
      data: {
        user_id: 'someone-else',
        next_read_user_book_id: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.settings('actor')).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });

  it('rejects a malformed settings row instead of returning it', async () => {
    const builder = queryBuilder({
      data: {
        user_id: 'actor',
        next_read_user_book_id: 123,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.settings('actor')).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });
});

describe('ordering', () => {
  it('orders readsForBook by read_number ascending', async () => {
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    await readingHistoryGateway.readsForBook('actor', 'book-1');
    expect(builder.order).toHaveBeenCalledWith('read_number', { ascending: true });
  });

  it('orders readsForUser by read_number then created_at for a stable order', async () => {
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    await readingHistoryGateway.readsForUser('actor');
    expect(builder.order).toHaveBeenNthCalledWith(1, 'read_number', { ascending: true });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: true });
  });

  it('openReadBookIds selects only the open-read columns and filters to reading', async () => {
    const builder = queryBuilder({
      data: [
        { user_book_id: 'book-1', user_id: 'actor', outcome: 'reading' },
        { user_book_id: 'book-foreign', user_id: 'other', outcome: 'reading' },
        { user_book_id: 'book-finished', user_id: 'actor', outcome: 'finished' },
        { user_book_id: '', user_id: 'actor', outcome: 'reading' },
      ],
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.openReadBookIds('actor')).resolves.toEqual(['book-1']);
    expect(fromMock).toHaveBeenCalledWith('user_book_reads');
    expect(builder.select).toHaveBeenCalledWith('user_book_id,user_id,outcome');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('outcome', 'reading');
  });

  it('openReadBookIds forwards an AbortSignal', async () => {
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    const controller = new AbortController();
    await readingHistoryGateway.openReadBookIds('actor', controller.signal);
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it('orders progressForRead by recorded_at ascending', async () => {
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    await readingHistoryGateway.progressForRead('actor', 'read-1');
    expect(builder.order).toHaveBeenCalledWith('recorded_at', { ascending: true });
  });

  it('forwards an AbortSignal to the query', async () => {
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    const controller = new AbortController();
    await readingHistoryGateway.readsForBook('actor', 'book-1', controller.signal);
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
  });
});

describe('RPC calls', () => {
  it('startReread uses the exact RPC and argument names and returns the new id', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'new-read-id', error: null });
    await expect(readingHistoryGateway.startReread('actor', 'book-1')).resolves.toBe('new-read-id');
    expect(rpcMock).toHaveBeenCalledWith('library_start_reread', { p_user_book_id: 'book-1' });
  });

  it('reopenRead uses the exact RPC and argument names', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await readingHistoryGateway.reopenRead('actor', 'read-1');
    expect(rpcMock).toHaveBeenCalledWith('library_reopen_read', { p_read_id: 'read-1' });
  });

  it('rejects a non-string reread id as an update failure', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    await expect(readingHistoryGateway.startReread('actor', 'book-1')).rejects.toThrow(
      "Couldn't update your reading history.",
    );
  });
});

describe('error mapping', () => {
  it('maps LIBRARY_READ_ALREADY_OPEN to the in-progress message', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'LIBRARY_READ_ALREADY_OPEN: open read exists' },
    });
    const failure = await readingHistoryGateway.startReread('actor', 'book-1').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ReadingHistoryError);
    expect((failure as Error).message).toBe('This book already has a read in progress.');
  });

  it('maps LIBRARY_READ_NOT_LATEST to the latest-read message', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'LIBRARY_READ_NOT_LATEST: not the latest read' },
    });
    await expect(readingHistoryGateway.reopenRead('actor', 'read-1')).rejects.toThrow(
      'Only the latest read can be reopened.',
    );
  });

  it('maps a generic read failure to the load message', async () => {
    const builder = queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.readsForBook('actor', 'book-1')).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });

  it('maps a generic RPC failure to the update message', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'boom' } });
    await expect(readingHistoryGateway.startReread('actor', 'book-1')).rejects.toThrow(
      "Couldn't update your reading history.",
    );
  });
});

describe('row validation', () => {
  it('drops malformed reads but keeps the valid one', async () => {
    const missingId = validRead();
    delete (missingId as Record<string, unknown>).id;
    const badOutcome = validRead({ id: 'read-bad', outcome: 'abandoned' });
    const good = validRead({ id: 'read-good' });
    const builder = queryBuilder({ data: [missingId, badOutcome, good], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.readsForBook('actor', 'book-1');
    expect(rows).toEqual([good]);
  });

  it('drops reads with impossible calendar days and non-ISO instants', async () => {
    const impossibleDay = validRead({ id: 'read-impossible-day', started_on: '2026-02-30' });
    const freeTextDay = validRead({ id: 'read-free-text-day', started_on: 'tomorrow' });
    const impossibleInstant = validRead({
      id: 'read-impossible-instant',
      started_at: '2026-02-30T10:00:00.000Z',
    });
    const freeTextInstant = validRead({
      id: 'read-free-text-instant',
      started_at: 'October 1, 2026',
    });
    const dateOnlyInstant = validRead({ id: 'read-date-only', started_at: '2026-10-01' });
    const good = validRead({ id: 'read-good' });
    const builder = queryBuilder({
      data: [impossibleDay, freeTextDay, impossibleInstant, freeTextInstant, dateOnlyInstant, good],
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.readsForBook('actor', 'book-1');
    expect(rows).toEqual([good]);
  });

  it('drops progress entries with non-ISO recorded_at', async () => {
    const impossible = validProgress({ id: 'progress-impossible', recorded_at: '2026-02-30T10:00:00.000Z' });
    const freeText = validProgress({ id: 'progress-free-text', recorded_at: 'October 1, 2026' });
    const good = validProgress({ id: 'progress-good' });
    const builder = queryBuilder({ data: [impossible, freeText, good], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.progressForRead('actor', 'read-1');
    expect(rows).toEqual([good]);
  });

  it('drops malformed progress entries but keeps the valid one', async () => {
    const noValue = validProgress({ id: 'progress-none', page: null, percent: null });
    const good = validProgress({ id: 'progress-good' });
    const builder = queryBuilder({ data: [noValue, good], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.progressForRead('actor', 'read-1');
    expect(rows).toEqual([good]);
  });

  it('rejects a malformed goal row instead of returning it', async () => {
    const builder = queryBuilder({
      data: { user_id: 'actor', year: 2026, target_books: 0, updated_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.goal('actor', 2026)).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });

  it('rejects goal and settings rows with non-ISO timestamps', async () => {
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: { user_id: 'actor', year: 2026, target_books: 12, updated_at: 'October 1, 2026' },
        error: null,
      }),
    );
    await expect(readingHistoryGateway.goal('actor', 2026)).rejects.toThrow(
      "Couldn't load your reading history.",
    );
    fromMock.mockReturnValueOnce(
      queryBuilder({
        data: {
          user_id: 'actor',
          next_read_user_book_id: null,
          updated_at: '2026-02-30T10:00:00.000Z',
        },
        error: null,
      }),
    );
    await expect(readingHistoryGateway.settings('actor')).rejects.toThrow(
      "Couldn't load your reading history.",
    );
  });

  it('returns null when no goal or settings row exists', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: null }));
    await expect(readingHistoryGateway.goal('actor', 2026)).resolves.toBeNull();
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: null }));
    await expect(readingHistoryGateway.settings('actor')).resolves.toBeNull();
  });
});

describe('abort handling', () => {
  it('rethrows a PostgREST AbortError instead of a load failure', async () => {
    const abort = { code: 'XX000', message: 'AbortError: aborted' };
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: abort }));
    const failure = await readingHistoryGateway.readsForBook('actor', 'book-1').catch((error: unknown) => error);
    expect(failure).toBe(abort);
    expect(failure).not.toBeInstanceOf(ReadingHistoryError);
  });

  it('rethrows an already-aborted signal instead of dispatching or wrapping', async () => {
    const controller = new AbortController();
    controller.abort();
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    const failure = await readingHistoryGateway
      .readsForBook('actor', 'book-1', controller.signal)
      .catch((error: unknown) => error);
    expect(failure).not.toBeInstanceOf(ReadingHistoryError);
    expect((failure as Error).name).toBe('AbortError');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rethrows a PostgREST AbortError from an RPC instead of an update failure', async () => {
    const abort = { code: 'XX000', message: 'AbortError: aborted' };
    rpcMock.mockResolvedValueOnce({ data: null, error: abort });
    const failure = await readingHistoryGateway.startReread('actor', 'book-1').catch((error: unknown) => error);
    expect(failure).toBe(abort);
    expect(failure).not.toBeInstanceOf(ReadingHistoryError);
  });
});
