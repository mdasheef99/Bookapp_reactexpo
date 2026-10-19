import { filterLibraryBooks, getLibraryFilterChips, getLibraryFilterLabel, LibraryBookEntry } from '../libraryShelf';

const entry = (id: string, status: string | null, ownership: string | null): LibraryBookEntry => ({
    id, reading_status: status, ownership, book: { title: id },
});

describe('Library filter count parity (review R3)', () => {
    it('labels the completed key Finished in the chip and active-filter lookup', () => {
        const chips = getLibraryFilterChips([]);
        expect(chips.find(chip => chip.key === 'completed')).toEqual({ key: 'completed', label: 'Finished', count: 0 });
        expect(getLibraryFilterLabel(chips, 'completed')).toBe('Finished');
    });
    it('excludes wishlist reading/completed entries from the corresponding chip counts', () => {
        const books = [entry('owned-reading', 'reading', 'owned'), entry('wanted-reading', 'reading', 'wishlist'),
            entry('owned-completed', 'completed', 'owned'), entry('wanted-completed', 'completed', 'wishlist')];
        expect(getLibraryFilterChips(books).map(({ count }) => count)).toEqual([4, 1, 1, 2]);
    });

    it('keeps every count equal to its filtered set through ownership transitions', () => {
        const books = [entry('reading', 'reading', 'owned'), entry('completed', 'completed', 'borrowed'),
            entry('missing', null, null), entry('unknown-owner', 'reading', null)];
        for (const ownership of ['owned', 'wishlist', null]) {
            const changed = books.map((book) => book.id === 'reading' ? { ...book, ownership } : book);
            for (const chip of getLibraryFilterChips(changed)) {
                expect(chip.count).toBe(filterLibraryBooks(changed, chip.key).length);
            }
        }
        expect(getLibraryFilterChips([]).map(({ count }) => count)).toEqual([0, 0, 0, 0]);
    });
});
