jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { manualNoteSaveAdapter, manualNotesGateway, MANUAL_NOTE_WRITE_GATES } from '../manualNotesGateway';

function chain(response: unknown) {
  const builder: any = {};
  for (const method of ['select', 'eq', 'order', 'maybeSingle', 'abortSignal']) builder[method] = jest.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  return builder;
}
beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any, status: 'authenticated' });
});
afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));
it.each([null, 'question', 'reflect'])('gates unverified writes before any dispatch, category %s', async tag => {
  await expect(manualNoteSaveAdapter.write({ id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'create', origin: 'book', content: 'Body', tag: tag as any, page_number: null })).rejects.toMatchObject({ kind: 'definite' });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(MANUAL_NOTE_WRITE_GATES.ownedBookWrites).toBe(false);
});
it('gates editing rather than falling back to an unconditional update', async () => {
  await expect(manualNoteSaveAdapter.write({ id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'edit', expectedVersion: 1, origin: 'book', content: 'Body', tag: 'reflect', page_number: null })).rejects.toMatchObject({ kind: 'definite' });
  expect(supabase.from).not.toHaveBeenCalled();
});
it('validates the book owner before loading notes', async () => {
  const owner = chain({ data: { id: 'book', user_id: 'other', book: { title: 'Private' } }, error: null });
  (supabase.from as jest.Mock).mockReturnValue(owner);
  await expect(manualNotesGateway.list('actor', 'book')).rejects.toThrow('unavailable');
  expect(supabase.from).toHaveBeenCalledTimes(1);
});
it('uses actor/book/record filters and rejects a returned wrong-book note', async () => {
  const owner = chain({ data: { id: 'book', user_id: 'actor', book: { title: 'Book' } }, error: null });
  const note = chain({ data: { id: 'note', user_id: 'actor', user_book_id: 'other' }, error: null });
  (supabase.from as jest.Mock).mockReturnValueOnce(owner).mockReturnValueOnce(note);
  await expect(manualNotesGateway.record('actor', 'book', 'note')).rejects.toThrow('unavailable');
  expect(note.eq).toHaveBeenCalledWith('id', 'note'); expect(note.eq).toHaveBeenCalledWith('user_id', 'actor'); expect(note.eq).toHaveBeenCalledWith('user_book_id', 'book');
});
it('does not reconstruct an edit outcome just from matching text and ID', async () => {
  const owner = chain({ data: { id: 'book', user_id: 'actor', book: { title: 'Book' } }, error: null });
  const note = chain({ data: { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Body', tag: 'reflect', page_number: null, version: 2, last_operation_id: null, created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-10T12:01:00Z' }, error: null });
  (supabase.from as jest.Mock).mockReturnValueOnce(owner).mockReturnValueOnce(note);
  expect(await manualNoteSaveAdapter.reconcile({ id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'edit', expectedVersion: 1, origin: 'book', content: 'Body', tag: 'reflect', page_number: null }, new AbortController().signal)).toBeNull();
});
it('does not confirm a preserved old operation marker on a newer edit version', async () => {
  const owner = chain({ data: { id: 'book', user_id: 'actor', book: { title: 'Book' } }, error: null });
  const note = chain({ data: { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Body', tag: 'reflect', page_number: null, version: 3, last_operation_id: 'op', created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-10T12:01:00Z' }, error: null });
  (supabase.from as jest.Mock).mockReturnValueOnce(owner).mockReturnValueOnce(note);
  expect(await manualNoteSaveAdapter.reconcile({ id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'edit', expectedVersion: 1, origin: 'book', content: 'Body', tag: 'reflect', page_number: null }, new AbortController().signal)).toBeNull();
});
it.each(['create', 'edit'] as const)('accepts the candidate %s reconciliation only with matching identity/payload and edit evidence', async mode => {
  const sent = { id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode, expectedVersion: mode === 'edit' ? 1 : undefined, origin: 'book' as const, content: 'Body', tag: null, page_number: null };
  const saved = { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Body', tag: null, page_number: null, version: 2, last_operation_id: 'op', created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-10T12:01:00Z' };
  const owner = chain({ data: { id: 'book', user_id: 'actor', book: { title: 'Book' } }, error: null });
  const result = chain({ data: saved, error: null }); (supabase.from as jest.Mock).mockReturnValueOnce(owner).mockReturnValueOnce(result);
  expect(await manualNoteSaveAdapter.reconcile(sent, new AbortController().signal)).toEqual(saved);
});
