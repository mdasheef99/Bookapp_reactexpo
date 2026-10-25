import { filterLibraryByLabel, filterLibraryBooks, getLibraryFilterChips, LibraryBookEntry } from '../../utils/libraryShelf';
const books: LibraryBookEntry[] = [
  { id: 'reading', reading_status: 'reading', ownership: 'owned', book: { title: 'Reading' } },
  { id: 'finished', reading_status: 'completed', ownership: 'borrowed', book: { title: 'Finished' } },
  { id: 'wish', reading_status: 'reading', ownership: 'wishlist', book: { title: 'Wish' } },
];
const links = [{ entity_id: 'borrowed', target_id: 'reading' }, { entity_id: 'borrowed', target_id: 'wish' }];
it('combines label and status filters, preserves shelf order, and counts the label subset', () => {
  const subset = filterLibraryByLabel([books[2], books[0], books[1]], links, 'borrowed');
  expect(subset.map(book => book.id)).toEqual(['wish', 'reading']);
  expect(getLibraryFilterChips(subset).map(chip => chip.count)).toEqual([2, 1, 0, 1]);
  expect(filterLibraryBooks(subset, 'reading').map(book => book.id)).toEqual(['reading']);
  expect(filterLibraryByLabel(books, links, '')).toBe(books);
  expect(filterLibraryByLabel(books, links, 'deleted')).toEqual([]);
});
