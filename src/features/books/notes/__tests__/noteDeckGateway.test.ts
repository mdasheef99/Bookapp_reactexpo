jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { manualNotesGateway } from '../manualNotesGateway';

const builders: any[] = [];
function builder(reply: (query: any) => unknown) {
  const b: any = { columns: '', filters: {}, ids: [], rangeValue: [0, 999] };
  b.select = jest.fn((columns: string) => { b.columns = columns; return b; });
  b.eq = jest.fn((key: string, value: string) => { b.filters[key] = value; return b; });
  b.in = jest.fn((_key: string, ids: string[]) => { b.ids = ids; return b; });
  b.order = jest.fn(() => b);
  b.range = jest.fn((from: number, to: number) => { b.rangeValue = [from, to]; return b; });
  b.abortSignal = jest.fn(() => b);
  b.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(reply(b)).then(resolve, reject);
  builders.push(b); return b;
}
beforeEach(() => {
  builders.length = 0; jest.clearAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any, status: 'authenticated' });
});
afterEach(() => useAuthStore.setState({ session: null, status: 'unauthenticated' }));
const row = (id: string, user_id = 'actor') => ({ id, tag: 'quote', created_at: '2026-10-23T00:00:00Z', user_id, user_book_id: 'book', content: id, page_number: 7, updated_at: null, version: 3, last_operation_id: 'save' });

it('pages past 1000 on RAW page length, orders both columns and checks owner/book', async () => {
  const database = Array.from({ length: 2005 }, (_, i) => row(String(i), i === 1 ? 'foreign' : 'actor'));
  (supabase.from as jest.Mock).mockImplementation(() => builder(b => ({ data: database.slice(b.rangeValue[0], b.rangeValue[1] + 1), error: null })));
  const notes = await manualNotesGateway.deckIndex('actor', { kind: 'book', userBookId: 'book' }, new AbortController().signal);
  expect(notes.map(n => n.id)).toEqual(database.filter(n => n.user_id === 'actor').map(n => n.id));
  expect(new Set(notes.map(n => n.id)).size).toBe(2004);
  expect(builders.map(b => b.range.mock.calls[0])).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  for (const b of builders) {
    expect(b.columns).toBe('id,tag,created_at,user_book_id,user_id');
    expect(b.order.mock.calls).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]]);
    expect(b.filters).toEqual({ user_id: 'actor', user_book_id: 'book' });
    expect(b.abortSignal).toHaveBeenCalled();
  }
});
it('reads an empty final page for an exact multiple, and never broadens an invalid book scope', async () => {
  (supabase.from as jest.Mock).mockImplementation(() => builder(b => ({ data: b.rangeValue[0] === 0 ? Array.from({ length: 1000 }, (_, i) => row(String(i))) : [], error: null })));
  expect(await manualNotesGateway.deckIndex('actor', { kind: 'all' })).toHaveLength(1000);
  expect(builders).toHaveLength(2);
  expect(builders[0].filters).toEqual({ user_id: 'actor' });
  jest.clearAllMocks();
  await expect(manualNotesGateway.deckIndex('actor', { kind: 'book', userBookId: '' })).rejects.toThrow('unavailable');
  expect(supabase.from).not.toHaveBeenCalled();
});
it('uses two owner-filtered queries per batch of 20, never a notes embed, keeping full fields', async () => {
  (supabase.from as jest.Mock).mockImplementation(table => builder(b => ({ data: table === 'reading_notes'
    ? [...b.ids.map((id: string) => row(id)), row('unrequested'), row(b.ids[0], 'foreign')]
    : [{ id: 'book', user_id: 'actor', book: { title: 'Book', authors: [' Author '], cover_url: 'cover' } }, { id: 'foreign-book', user_id: 'foreign', book: { title: 'Private' } }], error: null })));
  const ids = Array.from({ length: 45 }, (_, i) => String(i));
  const cards = await manualNotesGateway.deckCards('actor', [...ids, '0'], new AbortController().signal);
  expect(cards.map(c => c.note.id)).toEqual(ids);
  expect(cards[0]).toMatchObject({ note: { version: 3, last_operation_id: 'save' }, book: { title: 'Book', authors: ['Author'], cover_url: 'cover' } });
  expect(builders).toHaveLength(6);
  expect(builders.filter(b => b.columns === '*').map(b => b.ids.length)).toEqual([20, 20, 5]);
  for (const b of builders) {
    expect(b.filters).toEqual({ user_id: 'actor' });
    expect(b.columns).toBe(b.columns === '*' ? '*' : 'id,user_id,book:books(title,authors,cover_url)');
    expect(b.abortSignal).toHaveBeenCalled();
  }
});
it('does not expose note content when the corresponding book is owned by another actor', async () => {
  (supabase.from as jest.Mock).mockImplementation(table => builder(() => ({ data: table === 'reading_notes' ? [row('note')] : [{ id: 'book', user_id: 'foreign', book: { title: 'Private' } }], error: null })));
  expect(await manualNotesGateway.deckCards('actor', ['note'])).toEqual([]);
});
it('aborts before a read and rejects an account switch after a read', async () => {
  const abort = new AbortController(); abort.abort();
  await expect(manualNotesGateway.deckCards('actor', ['note'], abort.signal)).rejects.toThrow('cancelled');
  expect(supabase.from).not.toHaveBeenCalled();
  (supabase.from as jest.Mock).mockImplementation(() => builder(() => { useAuthStore.setState({ session: null }); return { data: [row('note')], error: null }; }));
  await expect(manualNotesGateway.deckIndex('actor', { kind: 'all' })).rejects.toThrow('Sign in again');
});
