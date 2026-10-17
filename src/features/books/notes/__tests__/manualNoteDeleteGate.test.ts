jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  createManualNoteDeleteAdapter,
  isManualNoteDeleteAuthorized,
  manualNoteDeleteAdapter,
  MANUAL_NOTE_WRITE_GATES,
} from '../manualNotesGateway';

function response(data: unknown) {
  const builder: any = {};
  for (const method of ['select', 'eq', 'delete', 'maybeSingle']) builder[method] = jest.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}
const ownedBook = () => response({ id: 'book', user_id: 'actor', book: { title: 'Book' } });
const authorizedAdapter = () => createManualNoteDeleteAdapter({ ...MANUAL_NOTE_WRITE_GATES, ownedBookWrites: true });

beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any, status: 'authenticated' });
});
afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));

it('gates delete before any dispatch while ownedBookWrites is false', async () => {
  const adapter = createManualNoteDeleteAdapter(MANUAL_NOTE_WRITE_GATES);
  await expect(adapter.remove('actor', 'book', 'note')).rejects.toMatchObject({ kind: 'definite' });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(MANUAL_NOTE_WRITE_GATES.ownedBookWrites).toBe(false);
});

it('gates the default delete adapter without dispatching', async () => {
  await expect(manualNoteDeleteAdapter.remove('actor', 'book', 'note')).rejects.toMatchObject({
    kind: 'definite',
    message: "Deleting isn't available yet.",
  });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(isManualNoteDeleteAuthorized()).toBe(false);
});

it('dispatches one owned deletion through the real adapter with isolated authorization', async () => {
  const deletion = response([{ id: 'note' }]);
  (supabase.from as jest.Mock).mockReturnValueOnce(ownedBook()).mockReturnValueOnce(deletion);
  await expect(authorizedAdapter().remove('actor', 'book', 'note')).resolves.toBeUndefined();
  expect((supabase.from as jest.Mock).mock.calls).toEqual([['user_books'], ['reading_notes']]);
  expect(deletion.delete).toHaveBeenCalledTimes(1);
  expect(deletion.eq.mock.calls).toEqual([['id', 'note'], ['user_id', 'actor'], ['user_book_id', 'book']]);
  expect(deletion.select).toHaveBeenCalledWith('id');
  expect(Object.values(MANUAL_NOTE_WRITE_GATES)).toEqual([false, false, false, false]);
  expect(isManualNoteDeleteAuthorized()).toBe(false);
});

it.each([{ rows: [] }, { rows: [{ id: 'note' }, { id: 'other' }] }])('does not confirm a deletion with an unexpected returned row count: $rows', async ({ rows }) => {
  const deletion = response(rows);
  (supabase.from as jest.Mock).mockReturnValueOnce(ownedBook()).mockReturnValueOnce(deletion);
  await expect(authorizedAdapter().remove('actor', 'book', 'note')).rejects.toThrow('This note could not be deleted.');
  expect(deletion.delete).toHaveBeenCalledTimes(1);
});

it('rejects a foreign account before lookup or deletion even with test authorization', async () => {
  await expect(authorizedAdapter().remove('other-actor', 'book', 'note')).rejects.toMatchObject({ kind: 'definite' });
  expect(supabase.from).not.toHaveBeenCalled();
});

it('does not dispatch deletion when the owned-book lookup is unavailable', async () => {
  (supabase.from as jest.Mock).mockReturnValueOnce(response(null));
  await expect(authorizedAdapter().remove('actor', 'book', 'note')).rejects.toThrow('This book is unavailable.');
  expect((supabase.from as jest.Mock).mock.calls).toEqual([['user_books']]);
});
