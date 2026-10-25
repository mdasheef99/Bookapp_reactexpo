import { collectionFilters, collectionIds, filterCollectionNotes, filterKey } from '../collectionsContract';
import { parseDeckScope, deckOrder } from '../../notes/noteDeck';
const group = (id: string, created_at: string) => ({ id, user_id: 'actor', name: 'Quote', created_at, updated_at: created_at });
const rows = [
  { id: 'a', user_id: 'actor', user_book_id: 'book-a', tag: 'quote' as const, created_at: '2026-10-01' },
  { id: 'b', user_id: 'actor', user_book_id: 'book-b', tag: null, created_at: '2026-10-02' },
];
const members = [
  { user_id: 'actor', target_id: 'a', entity_id: 'old', added_at: '2026-10-04' },
  { user_id: 'actor', target_id: 'b', entity_id: 'old', added_at: '2026-10-03' },
  { user_id: 'actor', target_id: 'b', entity_id: 'new', added_at: '2026-10-05' },
];
it('uses tagged filter identities, newest groups first and book intersections', () => {
  const groups = [group('old', '2026-10-01'), group('new', '2026-10-02'), group('empty', '2026-10-03')];
  const all = collectionFilters(rows, groups, members);
  expect(all.map(filterKey)).toEqual(['["all"]', '["category","quote"]', '["collection","new"]', '["collection","old"]']);
  const book = rows.filter(row => row.user_book_id === 'book-a');
  expect(collectionFilters(book, groups, members).map(filterKey)).toEqual(['["all"]', '["category","quote"]', '["collection","old"]']);
  expect(filterCollectionNotes(book, members, { kind: 'collection', collectionId: 'old' }).map(row => row.id)).toEqual(['a']);
});
it('keeps newest-added list order separate from saved deck order', () => {
  expect(collectionIds(members, 'old')).toEqual(['a', 'b']);
  expect(deckOrder(filterCollectionNotes(rows, members, { kind: 'collection', collectionId: 'old' }), 'newest', 's').map(row => row.id)).toEqual(['b', 'a']);
});
it('never broadens a dedicated empty or invalid collection route to all notes', () => {
  expect(parseDeckScope({ scope: 'collection', collectionId: 'old' })).toEqual({ kind: 'collection', collectionId: 'old' });
  expect(parseDeckScope({ scope: 'collection' })).toEqual({ kind: 'collection', collectionId: '' });
  expect(filterCollectionNotes(rows, [], { kind: 'collection', collectionId: 'old' })).toEqual([]);
});
