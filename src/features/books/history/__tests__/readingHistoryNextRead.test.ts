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

function savedRow(next: string | null) {
  return {
    user_id: 'actor',
    next_read_user_book_id: next,
    updated_at: '2026-10-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as never, status: 'authenticated' });
});

afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

describe('setNextRead', () => {
  it('updates the granted column when the row exists', async () => {
    const builder = queryBuilder({ data: [savedRow('book-2')], error: null });
    fromMock.mockReturnValueOnce(builder);
    const saved = await readingHistoryGateway.setNextRead('actor', 'book-2');
    expect(saved.next_read_user_book_id).toBe('book-2');
    expect(fromMock).toHaveBeenCalledWith('user_reading_settings');
    expect(builder.update).toHaveBeenCalledWith({ next_read_user_book_id: 'book-2' });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'actor');
    const updatePayload = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(updatePayload)).toEqual(['next_read_user_book_id']);
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('inserts only the granted columns when no row exists', async () => {
    const updateBuilder = queryBuilder({ data: [], error: null });
    const insertBuilder = queryBuilder({ data: savedRow('book-2'), error: null });
    fromMock.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(insertBuilder);
    const saved = await readingHistoryGateway.setNextRead('actor', 'book-2');
    expect(saved.next_read_user_book_id).toBe('book-2');
    expect(updateBuilder.update).toHaveBeenCalledWith({ next_read_user_book_id: 'book-2' });
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: 'actor',
      next_read_user_book_id: 'book-2',
    });
    const insertPayload = insertBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(insertPayload).sort()).toEqual(['next_read_user_book_id', 'user_id']);
    expect(updateBuilder.upsert).not.toHaveBeenCalled();
    expect(insertBuilder.upsert).not.toHaveBeenCalled();
  });

  it('clears to null through the update path with only the granted column', async () => {
    const builder = queryBuilder({ data: [savedRow(null)], error: null });
    fromMock.mockReturnValueOnce(builder);
    const saved = await readingHistoryGateway.setNextRead('actor', null);
    expect(saved.next_read_user_book_id).toBeNull();
    expect(builder.update).toHaveBeenCalledWith({ next_read_user_book_id: null });
    expect(builder.insert).not.toHaveBeenCalled();
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('retries the update once when the insert races with another device (23505)', async () => {
    const firstUpdate = queryBuilder({ data: [], error: null });
    const insertRace = queryBuilder({ data: null, error: { code: '23505', message: 'duplicate' } });
    const retryUpdate = queryBuilder({ data: [savedRow('book-2')], error: null });
    fromMock
      .mockReturnValueOnce(firstUpdate)
      .mockReturnValueOnce(insertRace)
      .mockReturnValueOnce(retryUpdate);
    const saved = await readingHistoryGateway.setNextRead('actor', 'book-2');
    expect(saved.next_read_user_book_id).toBe('book-2');
    expect(firstUpdate.update).toHaveBeenCalledWith({ next_read_user_book_id: 'book-2' });
    expect(insertRace.insert).toHaveBeenCalledWith({
      user_id: 'actor',
      next_read_user_book_id: 'book-2',
    });
    expect(retryUpdate.update).toHaveBeenCalledWith({ next_read_user_book_id: 'book-2' });
    expect(retryUpdate.eq).toHaveBeenCalledWith('user_id', 'actor');
    expect(firstUpdate.upsert).not.toHaveBeenCalled();
    expect(insertRace.upsert).not.toHaveBeenCalled();
    expect(retryUpdate.upsert).not.toHaveBeenCalled();
  });

  it('throws before any request when the auth user is not the actor', async () => {
    useAuthStore.setState({ session: { user: { id: 'someone-else' } } as never, status: 'authenticated' });
    await expect(readingHistoryGateway.setNextRead('actor', 'book-2')).rejects.toThrow(
      'Sign in again to continue.',
    );
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('maps a generic update failure to the update message', async () => {
    const builder = queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } });
    fromMock.mockReturnValueOnce(builder);
    await expect(readingHistoryGateway.setNextRead('actor', 'book-2')).rejects.toThrow(
      "Couldn't update your reading history.",
    );
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it('maps a non-conflict insert failure to the update message', async () => {
    const updateBuilder = queryBuilder({ data: [], error: null });
    const insertBuilder = queryBuilder({ data: null, error: { code: 'XX000', message: 'boom' } });
    fromMock.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(insertBuilder);
    await expect(readingHistoryGateway.setNextRead('actor', 'book-2')).rejects.toThrow(
      "Couldn't update your reading history.",
    );
    expect(insertBuilder.upsert).not.toHaveBeenCalled();
  });
});
