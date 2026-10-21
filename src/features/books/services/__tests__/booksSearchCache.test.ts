import { clearSearchCache, getCachedSearchResults, setCachedSearchResults } from '../booksSearchCache';
import type { GoogleBook } from '../booksService';

const mockBook: GoogleBook = {
    id: 'test-book',
    volumeInfo: {
        title: 'Test Book',
        authors: ['Test Author'],
        publishedDate: '2024',
        description: 'Test description',
        categories: ['Fiction'],
        averageRating: 4.5,
        ratingsCount: 100,
        imageLinks: { thumbnail: 'https://example.com/cover.jpg' },
    },
};

const page = (items: GoogleBook[], metadata: Partial<{ totalItems: number; hasMore: boolean; nextStartIndex: number; totalItemsExact: boolean }> = {}) => ({
    items,
    totalItems: items.length,
    hasMore: false,
    ...metadata,
});

describe('booksSearchCache', () => {
    beforeEach(() => {
        clearSearchCache();
        jest.useRealTimers();
    });

    afterEach(() => {
        clearSearchCache();
        jest.useRealTimers();
    });

    it('returns null when no cache entry exists', () => {
        expect(getCachedSearchResults('nonexistent query')).toBeNull();
    });

    it('returns fresh results when a cache entry is within TTL', () => {
        setCachedSearchResults('test query', page([mockBook]));
        const result = getCachedSearchResults('test query');
        expect(result).not.toBeNull();
        expect(result?.page.items).toHaveLength(1);
        expect(result?.page.items[0].id).toBe('test-book');
        expect(result?.isStale).toBe(false);
    });

    it('keeps provider totals, pagination state, and count confidence with the cached page', () => {
        setCachedSearchResults('metadata query', page([mockBook], {
            totalItems: 42,
            hasMore: true,
            nextStartIndex: 20,
            totalItemsExact: false,
        }));

        expect(getCachedSearchResults('metadata query')?.page).toMatchObject({
            items: [mockBook],
            totalItems: 42,
            hasMore: true,
            nextStartIndex: 20,
            totalItemsExact: false,
        });
    });

    it('returns stale results when a cache entry exceeds TTL but is within stale window', () => {
        jest.useFakeTimers();
        setCachedSearchResults('stale query', page([mockBook]));
        jest.advanceTimersByTime(65_000); // 65 seconds — exceeds 60s TTL
        const result = getCachedSearchResults('stale query');
        expect(result).not.toBeNull();
        expect(result?.page.items).toHaveLength(1);
        expect(result?.isStale).toBe(true);
        jest.useRealTimers();
    });

    it('returns null when a cache entry exceeds the stale window (5 min)', () => {
        jest.useFakeTimers();
        setCachedSearchResults('expired query', page([mockBook]));
        jest.advanceTimersByTime(301_000); // 5 min + 1 sec
        const result = getCachedSearchResults('expired query');
        expect(result).toBeNull();
        jest.useRealTimers();
    });

    it('evicts the oldest entry when cache exceeds max size (20)', () => {
        // Fill cache to capacity
        for (let i = 0; i < 20; i++) {
            setCachedSearchResults(`query-${i}`, page([{ ...mockBook, id: `book-${i}` }]));
        }
        // Add one more — should evict the oldest (query-0)
        setCachedSearchResults('query-new', page([{ ...mockBook, id: 'book-new' }]));

        expect(getCachedSearchResults('query-0')).toBeNull();
        expect(getCachedSearchResults('query-1')).not.toBeNull();
        expect(getCachedSearchResults('query-new')).not.toBeNull();
    });

    it('normalizes whitespace in cache keys', () => {
        setCachedSearchResults('test   query', page([mockBook]));
        const result = getCachedSearchResults('  test query  ');
        expect(result).not.toBeNull();
        expect(result?.page.items).toHaveLength(1);
    });

    it('is case-insensitive in cache keys', () => {
        setCachedSearchResults('Test Query', page([mockBook]));
        const result = getCachedSearchResults('test query');
        expect(result).not.toBeNull();
    });

    it('updates the cache entry on repeated set', () => {
        setCachedSearchResults('update query', page([mockBook]));
        const updatedBook: GoogleBook = { ...mockBook, id: 'updated-book' };
        setCachedSearchResults('update query', page([updatedBook]));

        const result = getCachedSearchResults('update query');
        expect(result?.page.items[0].id).toBe('updated-book');
    });

    it('differentiates cache keys by startIndex (page 0 vs 20)', () => {
        setCachedSearchResults('paged query', page([mockBook]), undefined, 0, 20);
        expect(getCachedSearchResults('paged query', undefined, 0, 20)).not.toBeNull();
        expect(getCachedSearchResults('paged query', undefined, 20, 20)).toBeNull();
        setCachedSearchResults('paged query', page([{ ...mockBook, id: 'page-20-book' }]), undefined, 20, 20);
        expect(getCachedSearchResults('paged query', undefined, 20, 20)?.page.items[0].id).toBe('page-20-book');
    });

    it('differentiates cache keys by filters (language/priceType)', () => {
        setCachedSearchResults('filtered query', page([mockBook]), { language: 'en' } as any, 0, 20);
        expect(getCachedSearchResults('filtered query', { language: 'en' } as any, 0, 20)).not.toBeNull();
        expect(getCachedSearchResults('filtered query', { language: 'hi' } as any, 0, 20)).toBeNull();
        expect(getCachedSearchResults('filtered query', { language: 'en', priceType: 'free' } as any, 0, 20)).toBeNull();
    });
});
