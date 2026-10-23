jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { createManualNoteSaveAdapter, manualNoteSaveAdapter, manualNotesGateway, MANUAL_NOTE_WRITE_GATES } from '../manualNotesGateway';

const closedGates = { ownedBookWrites: false, stableCreateReconciliation: false, optionalFiveCategories: false, serverManagedEditVersion: false };
const heldAdapter = createManualNoteSaveAdapter(closedGates);

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

it.each([
  [{ title: 'Book', authors: [' Author One ', 'Author Two'] }, 'Book', ['Author One', 'Author Two']],
  [{ title: 'Book', authors: null }, 'Book', []],
  [{ title: 'Book' }, 'Book', []],
  [{ title: 'Book', authors: 'Author' }, 'Book', []],
  [{ title: 'Book', authors: ['', '   ', null, 3, ' Author '] }, 'Book', ['Author']],
  [[{ title: 'Joined', authors: [' First ', 'Second'] }], 'Joined', ['First', 'Second']],
  [null, 'Selected book', []], [[], 'Selected book', []],
])('maps joined book authors from %j', async (related, title, authors) => {
  const owner = chain({ data: { id: 'book', user_id: 'actor', book: related }, error: null });
  (supabase.from as jest.Mock).mockReturnValueOnce(owner);
  await expect(manualNotesGateway.book('actor', 'book')).resolves.toEqual({ id: 'book', title, authors, cover_url: null });
  expect(owner.select).toHaveBeenCalledWith('id,user_id,book:books(title,authors,cover_url)');
  expect(owner.eq.mock.calls).toEqual([['id', 'book'], ['user_id', 'actor']]);
});
it('enables the reviewed manual-note capabilities for the application', () => {
  expect(Object.isFrozen(MANUAL_NOTE_WRITE_GATES)).toBe(true);
  expect(MANUAL_NOTE_WRITE_GATES).toEqual({ ownedBookWrites: true, stableCreateReconciliation: true, optionalFiveCategories: true, serverManagedEditVersion: true });
});
it.each([null, 'question', 'reflect'])('gates unverified writes before any dispatch, category %s', async tag => {
  await expect(heldAdapter.write({ id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'create', origin: 'book', content: 'Body', tag: tag as any, page_number: null })).rejects.toMatchObject({ kind: 'definite' });
  expect(supabase.from).not.toHaveBeenCalled();
  expect(closedGates.ownedBookWrites).toBe(false);
});
it('gates editing rather than falling back to an unconditional update', async () => {
  await expect(heldAdapter.write({ id: 'op', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'edit', expectedVersion: 1, origin: 'book', content: 'Body', tag: 'reflect', page_number: null })).rejects.toMatchObject({ kind: 'definite' });
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
