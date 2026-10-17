jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { createManualNoteSaveAdapter } from '../manualNotesGateway';
import { ManualNote, NoteSubmission } from '../manualNoteContract';

const gates = { ownedBookWrites: true, stableCreateReconciliation: true, optionalFiveCategories: true, serverManagedEditVersion: true };
const adapter = createManualNoteSaveAdapter(gates);
const sent: NoteSubmission = { id: 'operation', actorId: 'actor', bookId: 'book', noteId: 'note', sessionId: 'session', mode: 'edit', expectedVersion: 1, origin: 'book', content: 'Body', tag: 'question', page_number: null };
const saved: ManualNote = { id: 'note', user_id: 'actor', user_book_id: 'book', content: 'Body', tag: 'question', page_number: null, created_at: '2026-10-10T12:00:00Z', updated_at: '2026-10-10T12:01:00Z', version: 2, last_operation_id: 'operation' };
function chain(response: unknown) {
  const builder: any = {};
  for (const method of ['select', 'eq', 'insert', 'update', 'single', 'maybeSingle', 'abortSignal']) builder[method] = jest.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve);
  return builder;
}
const book = () => chain({ data: { id: 'book', user_id: 'actor', book: { title: 'Book' } }, error: null });
const row = (data: unknown) => chain({ data, error: null });
beforeEach(() => { jest.clearAllMocks(); useAuthStore.setState({ session: { user: { id: 'actor' } } as any, status: 'authenticated' }); });
afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));
it('recognizes an already-applied edit after zero rows without another write', async () => {
  const update = row(null);
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(update).mockReturnValueOnce(book()).mockReturnValueOnce(row(saved));
  expect(await adapter.write(sent)).toEqual(saved);
  expect(update.update).toHaveBeenCalledTimes(1);
  expect(update.eq).toHaveBeenCalledWith('version', 1);
  expect(update.eq).toHaveBeenCalledWith('user_id', 'actor');
  expect(update.eq).toHaveBeenCalledWith('user_book_id', 'book');
});
it('rejects a newer version even when the old marker and payload match', async () => {
  const latest = { ...saved, version: 3 };
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(row(null)).mockReturnValueOnce(book()).mockReturnValueOnce(row(latest));
  await expect(adapter.write(sent)).rejects.toMatchObject({ kind: 'conflict', latest });
});
it('uses the version actually compared for replacement and surfaces another competing edit', async () => {
  const update = row(null), latest = { ...saved, version: 4, content: 'Newer' };
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(update).mockReturnValueOnce(book()).mockReturnValueOnce(row(latest));
  await expect(adapter.write({ ...sent, id: 'replacement', expectedVersion: 3 })).rejects.toMatchObject({ kind: 'conflict', latest });
  expect(update.eq).toHaveBeenCalledWith('version', 3);
});
it.each([
  { ...saved, content: 'Different' },
  { ...saved, user_id: 'other' },
  { ...saved, version: '2' },
  { ...saved, version: 2.5 },
  { ...saved, created_at: null },
])('does not accept malformed or mismatched mutation evidence %#', async result => {
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(row(result));
  await expect(adapter.write(sent)).rejects.toMatchObject({ kind: 'unknown' });
});
it('validates create metadata and the stable identity instead of accepting any single-row response', async () => {
  const insert = row({ ...saved, id: 'other', version: 1, last_operation_id: null });
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(insert);
  await expect(adapter.write({ ...sent, mode: 'create', expectedVersion: undefined })).rejects.toMatchObject({ kind: 'unknown' });
  expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'note', tag: 'question', user_id: 'actor', user_book_id: 'book' }));
});
it('does not accept a missing-row edit as confirmation or retry it', async () => {
  const update = row(null);
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(update).mockReturnValueOnce(book()).mockReturnValueOnce(row(null));
  await expect(adapter.write(sent)).rejects.toMatchObject({ kind: 'definite' });
  expect(update.update).toHaveBeenCalledTimes(1);
});
it('keeps a duplicate-create response uncertain for read-only reconciliation', async () => {
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(chain({ data: null, error: { code: '23505' } }));
  await expect(adapter.write({ ...sent, mode: 'create' })).rejects.toMatchObject({ kind: 'unknown' });
  expect(supabase.from).toHaveBeenCalledTimes(2);
});
it('discards a delayed write response after the account changes', async () => {
  const update = row(saved);
  update.then = (resolve: (value: unknown) => unknown) => { useAuthStore.setState({ session: null }); return Promise.resolve({ data: saved, error: null }).then(resolve); };
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(update);
  await expect(adapter.write(sent)).rejects.toMatchObject({ kind: 'definite' });
});

it.each([null, 'question'] as const)('confirms a create with category %s and server metadata', async tag => {
  const submission = { ...sent, mode: 'create' as const, tag, expectedVersion: undefined };
  const result = { ...saved, tag, version: 1, last_operation_id: null };
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(row(result));
  expect(await adapter.write(submission)).toEqual(result);
});
it('confirms an ordinary edit only from the exact next server version and operation', async () => {
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(row(saved));
  expect(await adapter.write(sent)).toEqual(saved);
});
it('reconciles committed response loss by reading, without another mutation', async () => {
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(chain({ data: null, error: { code: 'FETCH_FAILED' } }));
  await expect(adapter.write(sent)).rejects.toMatchObject({ kind: 'unknown' });
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(row(saved));
  expect(await adapter.reconcile(sent, new AbortController().signal)).toEqual(saved);
  expect(supabase.from).toHaveBeenCalledTimes(4);
});
it.each([null, { ...saved, version: 3 }, { ...saved, last_operation_id: 'other' }, { ...saved, content: 'Changed' }])('does not confirm missing, intervening or mismatched read evidence %#', async latest => {
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(row(latest));
  expect(await adapter.reconcile(sent, new AbortController().signal)).toBeNull();
});
it('ignores a returned status read after its deadline is aborted', async () => {
  const controller = new AbortController(), read = row(saved);
  read.then = (resolve: (value: unknown) => unknown) => { controller.abort(); return Promise.resolve({ data: saved, error: null }).then(resolve); };
  (supabase.from as jest.Mock).mockReturnValueOnce(book()).mockReturnValueOnce(read);
  expect(await adapter.reconcile(sent, controller.signal)).toBeNull();
  expect(read.abortSignal).toHaveBeenCalledWith(controller.signal);
});

