jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { readingHistoryGateway } from '../readingHistoryGateway';
import { ReadingHistoryError } from '../readingHistoryContract';

const fromMock = supabase.from as jest.Mock;

// `any` mirrors the existing gateway tests: the PostgREST builder is only a mock in Jest.
function queryBuilder(response: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'single', 'abortSignal', 'update', 'delete']) {
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

function localDay(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as never, status: 'authenticated' });
});

afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

describe('updateReadDates validation (before any request)', () => {
  it('rejects columns outside the allowed set without dispatching', async () => {
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { outcome: 'finished' } as never),
    ).rejects.toThrow('Only reading dates, page count and stats inclusion can be changed here.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a future day without dispatching', async () => {
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { started_on: localDay(1) }),
    ).rejects.toThrow("Reading dates can't be in the future.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects start after end without dispatching', async () => {
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', {
        started_on: '2026-10-20',
        ended_on: '2026-10-01',
      }),
    ).rejects.toThrow("The start date can't be after the end date.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects an impossible calendar day without dispatching', async () => {
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { started_on: '2026-02-30' }),
    ).rejects.toThrow('Enter a real calendar date (YYYY-MM-DD).');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a non-positive page count without dispatching', async () => {
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { total_pages: 0 }),
    ).rejects.toThrow('Total pages must be a whole number above 0.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects a non-boolean flag without dispatching', async () => {
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { start_unknown: 'yes' as never }),
    ).rejects.toThrow('Unknown flags and stats inclusion must be true or false.');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects an empty patch without dispatching', async () => {
    await expect(readingHistoryGateway.updateReadDates('actor', 'read-1', {})).rejects.toThrow(
      'Nothing to update.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { started_on: '2026-10-01' }),
    ).rejects.toThrow('Sign in again to continue.');
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe('updateReadDates writes', () => {
  it('updates only the allowed columns and returns the validated row', async () => {
    const updated = validRead({ started_on: '2026-10-01', ended_on: '2026-10-20' });
    const builder = queryBuilder({ data: updated, error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', {
        started_on: '2026-10-01',
        ended_on: '2026-10-20',
      }),
    ).resolves.toEqual(updated);
    expect(fromMock).toHaveBeenCalledWith('user_book_reads');
    expect(builder.update).toHaveBeenCalledWith({ started_on: '2026-10-01', ended_on: '2026-10-20' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'read-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
  });

  it('accepts today and unknown flags, mapping a generic failure to the update message', async () => {
    const updated = validRead({ start_unknown: true, end_unknown: true });
    fromMock.mockReturnValueOnce(queryBuilder({ data: updated, error: null }));
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', {
        started_on: localDay(0),
        start_unknown: true,
        end_unknown: true,
      }),
    ).resolves.toEqual(updated);

    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } }));
    await expect(
      readingHistoryGateway.updateReadDates('actor', 'read-1', { started_on: '2026-10-01' }),
    ).rejects.toThrow("Couldn't update your reading history.");
  });
});

describe('removeRead', () => {
  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.removeRead('actor', 'read-1')).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns true when exactly one row is deleted', async () => {
    const builder = queryBuilder({ data: [{ id: 'read-1' }], error: null });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.removeRead('actor', 'read-1')).resolves.toBe(true);
    expect(fromMock).toHaveBeenCalledWith('user_book_reads');
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'read-1');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
  });

  it('throws the kept-read message when no row is deleted', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: [], error: null }));
    const failure = await readingHistoryGateway.removeRead('actor', 'read-1').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ReadingHistoryError);
    expect((failure as Error).message).toBe("This read can't be removed.");
  });

  it('maps a generic delete failure to the update message', async () => {
    fromMock.mockReturnValueOnce(queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } }));
    await expect(readingHistoryGateway.removeRead('actor', 'read-1')).rejects.toThrow(
      "Couldn't update your reading history.",
    );
  });
});
