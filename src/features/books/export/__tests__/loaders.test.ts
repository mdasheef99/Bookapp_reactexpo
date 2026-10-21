jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { manualNotesGateway } from '../../notes/manualNotesGateway';
import { buildLibraryCsv } from '../libraryCsv';
import { loadAllNotesForExport, loadBookNotesForExport, loadLibraryForExport } from '../loaders';

const libraryRow = (index: number, extra = {}) => ({
  user_id: 'actor', reading_status: 'reading', ownership: 'owned', condition: null,
  rating: null, review: 'Private review', review_is_public: false,
  created_at: '2026-10-21T12:00:00Z', completed_at: null,
  book: { title: `Book ${index}`, authors: ['लेखक'], isbn_13: null, isbn_10: null,
    publisher: null, published_date: null, page_count: null }, ...extra,
});
const noteRow = (index: number, extra = {}) => ({
  id: `note-${index}`, user_id: 'actor', user_book_id: `book-${index}`,
  content: `Saved note ${index}`, tag: null, page_number: null, created_at: null, updated_at: null, ...extra,
});
function chain(response: unknown) {
  const query: any = {};
  for (const method of ['select', 'eq', 'order', 'range', 'abortSignal', 'maybeSingle']) query[method] = jest.fn(() => query);
  query.then = (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(typeof response === 'function' ? response() : response).then(resolve, reject);
  return query;
}
function responses(...data: unknown[]) {
  const queries = data.map(rows => chain({ data: rows, error: null }));
  queries.forEach(query => (supabase.from as jest.Mock).mockReturnValueOnce(query));
  return queries;
}
beforeEach(() => {
  jest.resetAllMocks();
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any });
});
afterEach(() => useAuthStore.setState({ session: null }));

it('exports 1,200 library rows across stable 500-row pages with no duplicates', async () => {
  const fixture = Array.from({ length: 1200 }, (_, i) => libraryRow(i));
  const queries = responses(fixture.slice(0, 500), fixture.slice(500, 1000), fixture.slice(1000));
  const rows = await loadLibraryForExport('actor');
  expect(rows.map(row => row.book?.title)).toEqual(fixture.map(row => row.book.title));
  expect(new Set(rows.map(row => row.book?.title)).size).toBe(1200);
  const csv = buildLibraryCsv(rows);
  expect(csv.rowCount).toBe(1200);
  expect(csv.text.split('\r\n')).toHaveLength(1201);
  queries.forEach((query, i) => {
    expect(query.select).toHaveBeenCalledWith('reading_status,ownership,condition,rating,review,review_is_public,created_at,completed_at,user_id,book:books(title,authors,isbn_13,isbn_10,publisher,published_date,page_count)');
    expect(query.eq.mock.calls).toEqual([['user_id', 'actor']]);
    expect(query.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: true }]]);
    expect(query.range.mock.calls).toEqual([[i * 500, i * 500 + 499]]);
  });
});

it('re-filters ownership without mistaking a filtered page for the final page', async () => {
  const first = Array.from({ length: 500 }, (_, i) => libraryRow(i));
  first[0] = libraryRow(0, { user_id: 'other' });
  responses(first, [libraryRow(500)]);
  const result = await loadLibraryForExport('actor');
  expect(result).toHaveLength(500);
  expect(result[0].book?.title).toBe('Book 1');
  expect(result.at(-1)?.book?.title).toBe('Book 500');
  expect(result.some(row => 'user_id' in row)).toBe(false);
});

it('normalizes object, array, empty array and null book relationships', async () => {
  const row = libraryRow(1);
  responses([row, { ...row, book: [row.book] }, { ...row, book: [] }, { ...row, book: null }]);
  expect((await loadLibraryForExport('actor')).map(row => row.book)).toEqual([row.book, row.book, null, null]);
});

it('requests the empty trailing page for an exact page multiple', async () => {
  const queries = responses(Array.from({ length: 500 }, (_, i) => libraryRow(i)), []);
  expect(await loadLibraryForExport('actor')).toHaveLength(500);
  expect(queries[1].range).toHaveBeenCalledWith(500, 999);
});

it.each([false, true])('loads a book with authors from a relationship (array=%s), and only saved owned notes', async array => {
  const book = { title: 'Walden', authors: ['Thoreau'] };
  const saved = noteRow(1, { user_book_id: 'book', tag: 'question', page_number: 3 });
  const [query, notesQuery] = responses({ id: 'book', user_id: 'actor', book: array ? [book] : book }, [
    saved, noteRow(2, { user_id: 'other', user_book_id: 'book' }), noteRow(3),
  ]);
  const signal = new AbortController().signal;
  expect(await loadBookNotesForExport('actor', 'book', signal)).toEqual([{
    ...book, notes: [{ content: saved.content, tag: 'question', page_number: 3, created_at: null, updated_at: null }],
  }]);
  expect(query.select).toHaveBeenCalledWith('id,user_id,book:books(title,authors)');
  expect(query.eq.mock.calls).toEqual([['id', 'book'], ['user_id', 'actor']]);
  expect(query.abortSignal).toHaveBeenCalledWith(signal);
  expect(manualNotesGateway.list).not.toHaveBeenCalled();
  expect(notesQuery.eq.mock.calls).toEqual([['user_id', 'actor'], ['user_book_id', 'book']]);
  expect(notesQuery.abortSignal).toHaveBeenCalledWith(signal);
});

it('exports all 1,200 notes of one book using stable created_at/id pages', async () => {
  const fixture = Array.from({ length: 1200 }, (_, i) => noteRow(i, {
    id: `note-${String(i).padStart(4, '0')}`, user_book_id: 'book', created_at: '2026-10-21T12:00:00Z',
  }));
  const [, ...pages] = responses({ id: 'book', user_id: 'actor', book: { title: 'Walden', authors: ['Thoreau'] } },
    fixture.slice(0, 500), fixture.slice(500, 1000), fixture.slice(1000));
  const signal = new AbortController().signal;
  const result = await loadBookNotesForExport('actor', 'book', signal);
  expect(result).toHaveLength(1);
  expect(result[0].notes).toHaveLength(1200);
  expect(result[0].notes.map(note => note.content)).toEqual(fixture.map(note => note.content));
  expect(new Set(result[0].notes.map(note => note.content)).size).toBe(1200);
  expect((supabase.from as jest.Mock).mock.calls).toEqual([
    ['user_books'], ['reading_notes'], ['reading_notes'], ['reading_notes'],
  ]);
  pages.forEach((query, index) => {
    expect(query.select).toHaveBeenCalledWith('id,user_id,user_book_id,content,tag,page_number,created_at,updated_at');
    expect(query.eq.mock.calls).toEqual([['user_id', 'actor'], ['user_book_id', 'book']]);
    expect(query.order.mock.calls).toEqual([['created_at', { ascending: true }], ['id', { ascending: true }]]);
    expect(query.range).toHaveBeenCalledWith(index * 500, index * 500 + 499);
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
  });
  expect(manualNotesGateway.list).not.toHaveBeenCalled();
});

it.each([null, { id: 'book', user_id: 'other' }, { id: 'different', user_id: 'actor' }])('rejects an unavailable/foreign book before listing notes (%j)', async book => {
  responses(book);
  await expect(loadBookNotesForExport('actor', 'book')).rejects.toThrow('unavailable');
  expect(manualNotesGateway.list).not.toHaveBeenCalled();
});

it('pages all saved notes and book titles separately, never using the ambiguous embed', async () => {
  const notes = Array.from({ length: 1200 }, (_, i) => noteRow(i));
  const books = Array.from({ length: 1200 }, (_, i) => ({
    id: `book-${i}`, user_id: 'actor', book: i % 2 ? [{ title: `Title ${i}`, authors: null }] : { title: `Title ${i}`, authors: ['A'] },
  }));
  const queries = responses(notes.slice(0, 500), notes.slice(500, 1000), notes.slice(1000),
    books.slice(0, 500), books.slice(500, 1000), books.slice(1000));
  const signal = new AbortController().signal;
  const result = await loadAllNotesForExport('actor', signal);
  expect(result).toHaveLength(1200);
  expect(result.map(book => book.title)).toEqual(books.map((_, i) => `Title ${i}`));
  expect(result.flatMap(book => book.notes).map(note => note.content)).toEqual(notes.map(note => note.content));
  expect(supabase.from).toHaveBeenCalledTimes(6);
  queries.forEach((query, i) => {
    expect(query.eq.mock.calls).toEqual([['user_id', 'actor']]);
    expect(query.order.mock.calls).toEqual([['created_at', { ascending: i < 3 }], ['id', { ascending: true }]]);
    expect(query.range).toHaveBeenCalledWith((i % 3) * 500, (i % 3) * 500 + 499);
    expect(query.abortSignal).toHaveBeenCalledWith(signal);
    expect(query.select).toHaveBeenCalledWith(i < 3
      ? 'id,user_id,user_book_id,content,tag,page_number,created_at,updated_at'
      : 'id,user_id,book:books(title,authors)');
  });
  expect(result[0].notes[0]).not.toHaveProperty('id');
});

it('groups owned notes and skips foreign notes, foreign books, missing books and null joins', async () => {
  responses([
    noteRow(1), noteRow(2, { user_book_id: 'book-1' }), noteRow(3, { user_id: 'other', user_book_id: 'book-1' }),
    noteRow(4), noteRow(5), noteRow(6),
  ], [
    { id: 'book-1', user_id: 'actor', book: { title: 'Saved book', authors: [] } },
    { id: 'book-4', user_id: 'other', book: { title: 'Private', authors: [] } },
    { id: 'book-5', user_id: 'actor', book: [] },
  ]);
  const result = await loadAllNotesForExport('actor');
  expect(result).toHaveLength(1);
  expect(result[0].notes.map(note => note.content)).toEqual(['Saved note 1', 'Saved note 2']);
  expect(manualNotesGateway.list).not.toHaveBeenCalled();
});

it('returns empty when no saved rows exist, without reading pending-submission memory', async () => {
  responses([]);
  expect(await loadAllNotesForExport('actor')).toEqual([]);
  expect(supabase.from).toHaveBeenCalledTimes(1);
});

it.each(['library', 'all', 'book'])('honors an already aborted %s request before dispatch', async kind => {
  const controller = new AbortController(); controller.abort();
  const promise = kind === 'library' ? loadLibraryForExport('actor', controller.signal)
    : kind === 'all' ? loadAllNotesForExport('actor', controller.signal) : loadBookNotesForExport('actor', 'book', controller.signal);
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  expect(supabase.from).not.toHaveBeenCalled();
});

it('checks cancellation after a page resolves and stops before the next page', async () => {
  const controller = new AbortController();
  const query = chain(() => { controller.abort(); return { data: Array.from({ length: 500 }, (_, i) => libraryRow(i)), error: null }; });
  (supabase.from as jest.Mock).mockReturnValueOnce(query);
  await expect(loadLibraryForExport('actor', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(supabase.from).toHaveBeenCalledTimes(1);
  expect(query.abortSignal).toHaveBeenCalledWith(controller.signal);
});

it('rejects a late response after the signed-in actor changes', async () => {
  const query = chain(() => {
    useAuthStore.setState({ session: { user: { id: 'other' } } as any });
    return { data: [libraryRow(1)], error: null };
  });
  (supabase.from as jest.Mock).mockReturnValueOnce(query);
  await expect(loadLibraryForExport('actor')).rejects.toThrow('Sign in again');
});

it.each(['42501', 'PGRST200'])('throws sanitized database errors (%s)', async code => {
  (supabase.from as jest.Mock).mockReturnValueOnce(chain({ data: null, error: { code, message: 'secret database details' } }));
  await expect(loadLibraryForExport('actor')).rejects.toThrow("Couldn't load export data.");
});
