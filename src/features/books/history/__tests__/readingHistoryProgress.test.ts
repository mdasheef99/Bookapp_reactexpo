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
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'single', 'abortSignal', 'update', 'delete', 'insert']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  return builder;
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

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as never, status: 'authenticated' });
});

afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

describe('addProgress validation (before any request)', () => {
  it('rejects a negative page without dispatching', async () => {
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: -1 })).rejects.toThrow(
      'Enter a whole page number of 0 or more.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a fractional page without dispatching', async () => {
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: 1.5 })).rejects.toThrow(
      'Enter a whole page number of 0 or more.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range percent without dispatching', async () => {
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { percent: 101 })).rejects.toThrow(
      'Enter a whole percent between 0 and 100.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects both values without dispatching', async () => {
    await expect(
      readingHistoryGateway.addProgress('actor', 'read-1', { page: 10, percent: 20 } as never),
    ).rejects.toThrow('Enter either a page or a percent, not both.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects neither value without dispatching', async () => {
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', {} as never)).rejects.toThrow(
      'Enter either a page or a percent, not both.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: 10 })).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('addProgress writes', () => {
  it('inserts the RLS-shaped payload with exactly one value', async () => {
    const saved = validProgress();
    const builder = queryBuilder({ data: saved, error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: 142 })).resolves.toEqual(saved);
    expect(fromMock).toHaveBeenCalledWith('user_book_progress');
    expect(builder.insert).toHaveBeenCalledWith({ read_id: 'read-1', user_id: 'actor', page: 142, percent: null });
  });

  it('inserts a percent payload with page null', async () => {
    const saved = validProgress({ id: 'progress-2', page: null, percent: 44 });
    const builder = queryBuilder({ data: saved, error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { percent: 44 })).resolves.toEqual(saved);
    expect(builder.insert).toHaveBeenCalledWith({ read_id: 'read-1', user_id: 'actor', page: null, percent: 44 });
  });

  it('accepts page 0 and percent boundaries', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: validProgress({ page: 0 }), error: null }));
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: 0 })).resolves.toBeTruthy();
    fromMock.mockReturnValueOnce(queryBuilder({ data: validProgress({ page: null, percent: 0 }), error: null }));
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { percent: 0 })).resolves.toBeTruthy();
    fromMock.mockReturnValueOnce(queryBuilder({ data: validProgress({ page: null, percent: 100 }), error: null }));
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { percent: 100 })).resolves.toBeTruthy();
  });

  it('maps a generic insert failure to the update message', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } }));
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: 10 })).rejects.toThrow(
      "Couldn't update your reading history.",
    );
  });

  it('rejects a row for another read as an update failure', async () => {
    const foreign = validProgress({ read_id: 'read-other' });
    fromMock.mockReturnValueOnce(queryBuilder({ data: foreign, error: null }));
    await expect(readingHistoryGateway.addProgress('actor', 'read-1', { page: 10 })).rejects.toThrow(
      "Couldn't update your reading history.",
    );
  });

  it('rejects a both-values row as an update failure', async () => {
    const both = validProgress({ page: 10, percent: 20 });
    fromMock.mockReturnValueOnce(queryBuilder({ data: both, error: null }));
    const failure = await readingHistoryGateway.addProgress('actor', 'read-1', { page: 10 }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ReadingHistoryError);
  });
});

describe('setTotalPages validation (before any request)', () => {
  it('rejects zero and negatives without dispatching', async () => {
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', 0)).rejects.toThrow(
      'Total pages must be a whole number above 0.',
    );
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', -5)).rejects.toThrow(
      'Total pages must be a whole number above 0.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects fractions without dispatching', async () => {
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', 10.5)).rejects.toThrow(
      'Total pages must be a whole number above 0.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', 320)).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('setTotalPages writes', () => {
  it('updates only total_pages for the owned read', async () => {
    const updated = validRead({ total_pages: 400 });
    const builder = queryBuilder({ data: updated, error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', 400)).resolves.toEqual(updated);
    expect(fromMock).toHaveBeenCalledWith('user_book_reads');
    expect(builder.update).toHaveBeenCalledWith({ total_pages: 400 });
    expect(builder.eq).toHaveBeenCalledWith('id', 'read-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
  });

  it('clears the total with null', async () => {
    const updated = validRead({ total_pages: null });
    const builder = queryBuilder({ data: updated, error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', null)).resolves.toEqual(updated);
    expect(builder.update).toHaveBeenCalledWith({ total_pages: null });
  });

  it('maps a generic failure to the update message', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } }));
    await expect(readingHistoryGateway.setTotalPages('actor', 'read-1', 320)).rejects.toThrow(
      "Couldn't update your reading history.",
    );
  });
});
