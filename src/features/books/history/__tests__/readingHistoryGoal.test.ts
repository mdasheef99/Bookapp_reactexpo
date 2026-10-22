jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { readingHistoryGateway } from '../readingHistoryGateway';

const fromMock = supabase.from as jest.Mock;

function queryBuilder(response: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of [
    'select',
    'eq',
    'order',
    'maybeSingle',
    'single',
    'abortSignal',
    'update',
    'insert',
    'delete',
    'upsert',
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  return builder;
}

function goalRow(target = 24) {
  return {
    user_id: 'actor',
    year: 2026,
    target_books: target,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as never, status: 'authenticated' });
});

afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

describe('setGoal', () => {
  it('updates only the granted column when the row exists and never calls upsert', async () => {
    const builder = queryBuilder({ data: [goalRow(24)], error: null });
    fromMock.mockReturnValueOnce(builder);
    const saved = await readingHistoryGateway.setGoal('actor', 2026, 24);
    expect(saved?.target_books).toBe(24);
    expect(fromMock).toHaveBeenCalledWith('user_reading_goals');
    expect(builder.update).toHaveBeenCalledWith({ target_books: 24 });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('year', 2026);
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('inserts only the granted columns when no row exists and never calls upsert', async () => {
    const updateBuilder = queryBuilder({ data: [], error: null });
    const insertBuilder = queryBuilder({ data: goalRow(12), error: null });
    fromMock.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(insertBuilder);
    const saved = await readingHistoryGateway.setGoal('actor', 2026, 12);
    expect(saved?.target_books).toBe(12);
    expect(updateBuilder.update).toHaveBeenCalledWith({ target_books: 12 });
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'actor',
      year: 2026,
      target_books: 12,
    });
    const payload = insertBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['target_books', 'user_id', 'year']);
    expect(updateBuilder.upsert).not.toHaveBeenCalled();
    expect(insertBuilder.upsert).not.toHaveBeenCalled();
  });

  it('retries the update once when the insert races with another device (23505)', async () => {
    const firstUpdate = queryBuilder({ data: [], error: null });
    const insertRace = queryBuilder({ data: null, error: { code: '23505', message: 'duplicate' } });
    const retryUpdate = queryBuilder({ data: [goalRow(20)], error: null });
    fromMock.mockReturnValueOnce(firstUpdate).mockReturnValueOnce(insertRace).mockReturnValueOnce(retryUpdate);
    const saved = await readingHistoryGateway.setGoal('actor', 2026, 20);
    expect(saved?.target_books).toBe(20);
    expect(firstUpdate.update).toHaveBeenCalledWith({ target_books: 20 });
    expect(retryUpdate.update).toHaveBeenCalledWith({ target_books: 20 });
    expect(retryUpdate.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(retryUpdate.eq).toHaveBeenCalledWith('year', 2026);
    expect(firstUpdate.upsert).not.toHaveBeenCalled();
    expect(insertRace.upsert).not.toHaveBeenCalled();
    expect(retryUpdate.upsert).not.toHaveBeenCalled();
  });

  it('deletes the row when the target is null and never calls upsert', async () => {
    const builder = queryBuilder({ data: [], error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.setGoal('actor', 2026, null)).resolves.toBeNull();
    expect(fromMock).toHaveBeenCalledWith('user_reading_goals');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('year', 2026);
    expect(builder.update).not.toHaveBeenCalled();
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('validates the target before any request', async () => {
    await expect(readingHistoryGateway.setGoal('actor', 2026, 0)).rejects.toThrow(
      "Couldn't update your reading history.",
    );
    await expect(readingHistoryGateway.setGoal('actor', 2026, 1000)).rejects.toThrow(
      "Couldn't update your reading history.",
    );
    await expect(readingHistoryGateway.setGoal('actor', 1999, 10)).rejects.toThrow(
      "Couldn't update your reading history.",
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.setGoal('actor', 2026, 10)).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('maps a non-conflict insert failure to the update message without upsert', async () => {
    const updateBuilder = queryBuilder({ data: [], error: null });
    const insertBuilder = queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } });
    fromMock.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(insertBuilder);
    await expect(readingHistoryGateway.setGoal('actor', 2026, 10)).rejects.toThrow(
      "Couldn't update your reading history.",
    );
    expect(insertBuilder.upsert).not.toHaveBeenCalled();
  });
});

describe('setCountsInStats', () => {
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
      counts_in_stats: false,
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-20T10:00:00.000Z',
      ...overrides,
    };
  }

  it('updates only counts_in_stats with both owner filters', async () => {
    const builder = queryBuilder({ data: [validRead()], error: null });
    fromMock.mockReturnValueOnce(builder);
    const saved = await readingHistoryGateway.setCountsInStats('actor', 'book-1', false);
    expect(saved).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledWith('user_book_reads');
    expect(builder.update).toHaveBeenCalledWith({ counts_in_stats: false });
    expect(builder.eq).toHaveBeenCalledWith('user_book_id', 'book-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('validates before any request', async () => {
    await expect(
      readingHistoryGateway.setCountsInStats('actor', '', false),
    ).rejects.toThrow("Couldn't update your reading history.");
    await expect(
      readingHistoryGateway.setCountsInStats('actor', 'book-1', 'yes' as never),
    ).rejects.toThrow("Couldn't update your reading history.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.setCountsInStats('actor', 'book-1', false)).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('quotesForUser', () => {
  function quoteRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'note-1',
      user_book_id: 'book-1',
      user_id: 'actor',
      content: 'A line to remember.',
      tag: 'quote',
      page_number: null,
      created_at: '2026-06-01T10:00:00.000Z',
      updated_at: '2026-06-01T10:00:00.000Z',
      ...overrides,
    };
  }

  it('queries one owner-filtered quote list newest first', async () => {
    const builder = queryBuilder({ data: [quoteRow()], error: null });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.quotesForUser('actor');
    expect(rows).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledWith('reading_notes');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(builder.eq).toHaveBeenCalledWith('tag', 'quote');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('drops rows for another user or another tag', async () => {
    const builder = queryBuilder({
      data: [quoteRow(), quoteRow({ id: 'foreign', user_id: 'someone-else' }), quoteRow({ id: 'thought', tag: 'reflect' })],
      error: null,
    });
    fromMock.mockReturnValueOnce(builder);
    const rows = await readingHistoryGateway.quotesForUser('actor');
    expect(rows.map((row) => row.id)).toEqual(['note-1']);
  });
});
