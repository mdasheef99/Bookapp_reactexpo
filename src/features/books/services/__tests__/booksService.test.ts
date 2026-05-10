/**
 * Unit tests for booksService.ts
 *
 * Tests: searchGoogleBooks (pagination, filters, errors), getSearchSuggestions (dedup, limit),
 * addToLibrary (catalog reuse/insert + 23505 duplicate), getUserLibrary, getBookDetails,
 * updateReadingStatus (completed_at), removeFromLibrary, and private helpers
 * (getHighResCoverUrl, buildSearchQuery) tested indirectly.
 */
jest.mock('@/lib/supabase');

import { booksService, GoogleBook } from '../booksService';
import { supabase } from '@/lib/supabase';

// Helper: create a chainable Supabase query builder mock with custom resolution
function mockQuery(response: Record<string, any>) {
  const builder: any = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq',
    'order', 'limit', 'single', 'maybeSingle', 'range', 'match', 'or', 'filter',
  ];
  methods.forEach((m) => { builder[m] = jest.fn(() => builder); });
  builder.then = jest.fn((resolve: any) => resolve(response));
  return builder;
}

// Minimal GoogleBook fixture
const mockGoogleBook: GoogleBook = {
  id: 'gb-123',
  volumeInfo: {
    title: 'Test Book',
    subtitle: 'A Subtitle',
    authors: ['Author A'],
    description: 'A description',
    imageLinks: { thumbnail: 'http://books.google.com/books?id=123&zoom=1' },
    pageCount: 200,
    categories: ['Fiction'],
    publisher: 'Test Publisher',
    publishedDate: '2024-01-01',
    averageRating: 4.5,
    ratingsCount: 100,
    language: 'en',
    previewLink: 'https://preview',
    infoLink: 'https://info',
    industryIdentifiers: [
      { type: 'ISBN_10', identifier: '1234567890' },
      { type: 'ISBN_13', identifier: '9781234567890' },
    ],
  },
  saleInfo: {
    saleability: 'FOR_SALE',
    retailPrice: { amount: 9.99, currencyCode: 'INR' },
    buyLink: 'https://buy',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  // Reset global.fetch mock
  global.fetch = jest.fn();
  delete process.env.EXPO_PUBLIC_APP_ENV;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('booksService', () => {
  // ──────────────────── searchGoogleBooks ────────────────────
  describe('searchGoogleBooks', () => {
    it('builds URL with query, startIndex, maxResults', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items: [], totalItems: 0 }),
      });

      await booksService.searchGoogleBooks('react native', 10, 15);

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('q=react%20native');
      expect(url).toContain('startIndex=10');
      expect(url).toContain('maxResults=15');
    });

    it('appends genre filter via buildSearchQuery', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items: [], totalItems: 0 }),
      });

      await booksService.searchGoogleBooks('test', 0, 20, { genre: 'Fiction' });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('subject%3AFiction');
    });

    it('skips genre filter when genre is "all"', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items: [], totalItems: 0 }),
      });

      await booksService.searchGoogleBooks('test', 0, 20, { genre: 'all' });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).not.toContain('subject');
    });

    it('appends langRestrict for non-all language', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items: [], totalItems: 0 }),
      });

      await booksService.searchGoogleBooks('test', 0, 20, { language: 'hi' });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('langRestrict=hi');
    });

    it('appends free-ebooks filter for priceType=free', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items: [], totalItems: 0 }),
      });

      await booksService.searchGoogleBooks('test', 0, 20, { priceType: 'free' });

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain('filter=free-ebooks');
    });

    it('calculates hasMore based on pagination', async () => {
      const items = Array(20).fill(mockGoogleBook);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items, totalItems: 100 }),
      });

      const result = await booksService.searchGoogleBooks('test', 0, 20);
      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(20);
      expect(result.totalItems).toBe(100);
    });

    it('returns empty result on fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network fail'));

      const result = await booksService.searchGoogleBooks('test');
      expect(result).toEqual({ items: [], totalItems: 0, hasMore: false });
    });
  });

  // ──────────────────── searchGoogleBooksCached provider fallback ────────────────────
  describe('searchGoogleBooksCached provider fallback', () => {
    it('falls back to Open Library results when Google Books rate-limits the request', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 429,
          ok: false,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            start: 0,
            numFound: 1,
            docs: [{
              key: '/works/OL123W',
              title: 'Fallback Book',
              author_name: ['Fallback Author'],
              first_publish_year: 1998,
              isbn: ['9780141187761'],
              cover_i: 123456,
            }],
          }),
        });

      const result = await booksService.searchGoogleBooksCached('fallback query');

      expect((result as any).fallbackUsed).toBe(true);
      expect((result as any).providerUsed).toBe('openLibrary');
      expect(result.items[0].volumeInfo.title).toBe('Fallback Book');
      expect(result.items[0].volumeInfo.authors).toEqual(['Fallback Author']);
    });

    it('falls back to Open Library results when Google Books throws a network error', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Google unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            start: 0,
            numFound: 1,
            docs: [{
              key: '/works/OL999W',
              title: 'Open Library Rescue',
              author_name: ['Archive Author'],
              isbn: ['9780679783275'],
              cover_i: 98765,
            }],
          }),
        });

      const result = await booksService.searchGoogleBooksCached('rescue query');

      expect((result as any).fallbackUsed).toBe(true);
      expect((result as any).providerUsed).toBe('openLibrary');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].volumeInfo.title).toBe('Open Library Rescue');
    });
  });

  // ──────────────────── getSearchSuggestions ────────────────────
  describe('getSearchSuggestions', () => {
    it('returns empty array for short queries', async () => {
      const result = await booksService.getSearchSuggestions('a');
      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('deduplicates suggestions by lowercase', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [
            { volumeInfo: { title: 'Book One', authors: ['Author A'] } },
            { volumeInfo: { title: 'book one', authors: ['author a'] } },
          ],
        }),
      });

      const result = await booksService.getSearchSuggestions('book');
      // 'Book One' and 'Author A' only — duplicates filtered
      expect(result).toEqual(['Book One', 'Author A']);
    });

    it('limits suggestions to 8', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        volumeInfo: { title: `Title ${i}`, authors: [`Author ${i}`] },
      }));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () => Promise.resolve({ items }),
      });

      const result = await booksService.getSearchSuggestions('test');
      expect(result.length).toBeLessThanOrEqual(8);
    });

    it('returns empty array on fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'));
      const result = await booksService.getSearchSuggestions('test');
      expect(result).toEqual([]);
    });

    it('falls back to Open Library suggestions when Google Books fails', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Google suggestions unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            docs: [
              { title: 'Open Suggestion', author_name: ['Archive Writer'] },
              { title: 'Open Suggestion', author_name: ['archive writer'] },
            ],
          }),
        });

      const result = await booksService.getSearchSuggestions('open');

      expect(result).toEqual(['Open Suggestion', 'Archive Writer']);
    });
  });

  // ──────────────────── addToLibrary ────────────────────
  describe('addToLibrary', () => {
    it('reuses an existing catalog row instead of upserting when the google_books_id already exists', async () => {
      const existingBooksLookupBuilder = mockQuery({
        data: { id: 'existing-book-row' },
        error: null,
      });
      const existingUserBookBuilder = mockQuery({ data: null, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(existingBooksLookupBuilder)
        .mockReturnValueOnce(existingUserBookBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      const result = await booksService.addToLibrary('user-1', mockGoogleBook);

      expect(supabase.from).toHaveBeenNthCalledWith(1, 'books');
      expect(existingBooksLookupBuilder.select).toHaveBeenCalledWith('id');
      expect(existingBooksLookupBuilder.eq).toHaveBeenCalledWith('google_books_id', 'gb-123');
      expect(existingBooksLookupBuilder.maybeSingle).toHaveBeenCalled();
      expect(existingBooksLookupBuilder.upsert).not.toHaveBeenCalled();
      expect(userBooksBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        book_id: 'existing-book-row',
        reading_status: 'want_to_read',
        ownership: 'owned',
        condition: 'new',
        available_for_lending: false,
      });
      expect(result).toEqual({ id: 'existing-book-row' });
    });

    it('creates a catalog row only when the google_books_id is missing', async () => {
      const missingBooksLookupBuilder = mockQuery({ data: null, error: null });
      const booksInsertBuilder = mockQuery({
        data: { id: 'new-book-row', title: 'Test Book' },
        error: null,
      });
      const existingUserBookBuilder = mockQuery({ data: null, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(missingBooksLookupBuilder)
        .mockReturnValueOnce(booksInsertBuilder)
        .mockReturnValueOnce(existingUserBookBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      const result = await booksService.addToLibrary('user-1', mockGoogleBook);

      expect(missingBooksLookupBuilder.select).toHaveBeenCalledWith('id');
      expect(missingBooksLookupBuilder.eq).toHaveBeenCalledWith('google_books_id', 'gb-123');
      expect(missingBooksLookupBuilder.maybeSingle).toHaveBeenCalled();
      expect(booksInsertBuilder.insert).toHaveBeenCalled();
      expect(booksInsertBuilder.upsert).not.toHaveBeenCalled();
      expect(userBooksBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        book_id: 'new-book-row',
        reading_status: 'want_to_read',
        ownership: 'owned',
        condition: 'new',
        available_for_lending: false,
      });
      expect(result).toEqual({ id: 'new-book-row', title: 'Test Book' });
    });

    it('inserts a missing catalog row then inserts user_book, returns book data', async () => {
      const bookLookupBuilder = mockQuery({ data: null, error: null });
      const bookData = { id: 'book-uuid-1', title: 'Test Book' };
      const booksInsertBuilder = mockQuery({ data: bookData, error: null });
      const existingUserBookBuilder = mockQuery({ data: null, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(bookLookupBuilder)
        .mockReturnValueOnce(booksInsertBuilder)
        .mockReturnValueOnce(existingUserBookBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      const result = await booksService.addToLibrary('user-1', mockGoogleBook);

      expect(supabase.from).toHaveBeenCalledWith('books');
      expect(supabase.from).toHaveBeenCalledWith('user_books');
      expect(bookLookupBuilder.select).toHaveBeenCalledWith('id');
      expect(booksInsertBuilder.insert).toHaveBeenCalled();
      expect(userBooksBuilder.insert).toHaveBeenCalled();
      expect(result).toEqual(bookData);
    });

    it('converts HTTP thumbnail to HTTPS and replaces zoom parameter before insert', async () => {
      const bookLookupBuilder = mockQuery({ data: null, error: null });
      const bookData = { id: 'b1' };
      const booksInsertBuilder = mockQuery({ data: bookData, error: null });
      const existingUserBookBuilder = mockQuery({ data: null, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(bookLookupBuilder)
        .mockReturnValueOnce(booksInsertBuilder)
        .mockReturnValueOnce(existingUserBookBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      await booksService.addToLibrary('user-1', mockGoogleBook);

      const insertArg = booksInsertBuilder.insert.mock.calls[0][0];
      expect(insertArg.cover_url).toBe('https://books.google.com/books?id=123&zoom=0');
    });

    it('promotes an existing wishlist row instead of inserting a duplicate', async () => {
      const bookLookupBuilder = mockQuery({ data: { id: 'b1' }, error: null });
      const existingWishlistBuilder = mockQuery({
        data: { id: 'ub-wishlist', ownership: 'wishlist' },
        error: null,
      });
      const updateBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(bookLookupBuilder)
        .mockReturnValueOnce(existingWishlistBuilder)
        .mockReturnValueOnce(updateBuilder);

      await booksService.addToLibrary('user-1', mockGoogleBook);

      expect(updateBuilder.update).toHaveBeenCalledWith({ ownership: 'owned' });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'ub-wishlist');
    });

    it('throws "already in your library" when a non-wishlist row already exists', async () => {
      const bookLookupBuilder = mockQuery({ data: { id: 'b1' }, error: null });
      const existingUserBookBuilder = mockQuery({
        data: { id: 'ub-owned', ownership: 'owned' },
        error: null,
      });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(bookLookupBuilder)
        .mockReturnValueOnce(existingUserBookBuilder);

      await expect(booksService.addToLibrary('user-1', mockGoogleBook))
        .rejects.toThrow('This book is already in your library.');
    });

    it('throws on book insert error when the catalog row is missing', async () => {
      const bookLookupBuilder = mockQuery({ data: null, error: null });
      const booksInsertBuilder = mockQuery({ data: null, error: { message: 'DB error' } });
      (supabase.from as jest.Mock)
        .mockReturnValueOnce(bookLookupBuilder)
        .mockReturnValueOnce(booksInsertBuilder);

      await expect(booksService.addToLibrary('user-1', mockGoogleBook))
        .rejects.toEqual({ message: 'DB error' });
    });
  });

  // ──────────────────── addManualBookToLibrary ────────────────────
  describe('addManualBookToLibrary', () => {
    it('inserts a manual book row, links it into user_books, and returns the book data', async () => {
      const bookData = { id: 'manual-book-1', title: 'Manual Book', authors: ['Manual Author'] };
      const booksBuilder = mockQuery({ data: bookData, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(booksBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      const result = await booksService.addManualBookToLibrary('user-1', {
        title: '  Manual Book  ',
        author: '  Manual Author  ',
      });

      expect(booksBuilder.insert).toHaveBeenCalledWith({
        title: 'Manual Book',
        authors: ['Manual Author'],
      });
      expect(userBooksBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        book_id: 'manual-book-1',
        reading_status: 'want_to_read',
        ownership: 'owned',
        condition: 'new',
        available_for_lending: false,
      });
      expect(result).toEqual(bookData);
    });

    it('stores null authors when the optional author is omitted', async () => {
      const booksBuilder = mockQuery({ data: { id: 'manual-book-2', title: 'Manual Book' }, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(booksBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      await booksService.addManualBookToLibrary('user-1', { title: 'Manual Book' });

      expect(booksBuilder.insert).toHaveBeenCalledWith({
        title: 'Manual Book',
        authors: null,
      });
    });

    it('rejects blank titles before inserting', async () => {
      await expect(booksService.addManualBookToLibrary('user-1', { title: '   ' }))
        .rejects.toThrow('Title is required.');

      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  // ──────────────────── getUserLibrary ────────────────────
  describe('getUserLibrary', () => {
    it('still queries the real library in development mode', async () => {
      process.env.EXPO_PUBLIC_APP_ENV = 'development';

      const libraryData = [{ id: 'ub-dev', book: { title: 'Dev Book' } }];
      const builder = mockQuery({ data: libraryData, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await booksService.getUserLibrary('user-1');

      expect(supabase.from).toHaveBeenCalledWith('user_books');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toEqual(libraryData);
    });

    it('queries user_books with book join, ordered by created_at desc', async () => {
      const libraryData = [{ id: 'ub1', book: { title: 'Book 1' } }];
      const builder = mockQuery({ data: libraryData, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      const result = await booksService.getUserLibrary('user-1');

      expect(supabase.from).toHaveBeenCalledWith('user_books');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(libraryData);
    });

    it('can exclude wishlist rows from the query', async () => {
      const builder = mockQuery({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await booksService.getUserLibrary('user-1', { excludeOwnership: ['wishlist'] });

      expect(builder.neq).toHaveBeenCalledWith('ownership', 'wishlist');
    });
  });

  // ──────────────────── getPublicReviewsForBook ────────────────────
  describe('getPublicReviewsForBook', () => {
    it('reads public reviews through the rpc contract and maps safe author fields', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: [{
          user_book_id: 'ub-public-1',
          book_id: 'book-42',
          rating: 5,
          review: 'A moving review from another reader.',
          created_at: '2026-03-12T09:00:00Z',
          author_user_id: 'reader-2',
          author_display_name: 'Reader Two',
          author_username: 'reader-two',
          author_avatar_url: 'https://example.com/avatar.png',
        }],
        error: null,
      });

      const result = await booksService.getPublicReviewsForBook('book-42');

      expect(supabase.rpc).toHaveBeenCalledWith('get_public_book_reviews', {
        p_book_id: 'book-42',
      });
      expect(result).toEqual([{
        user_book_id: 'ub-public-1',
        book_id: 'book-42',
        rating: 5,
        review: 'A moving review from another reader.',
        created_at: '2026-03-12T09:00:00Z',
        author: {
          user_id: 'reader-2',
          display_name: 'Reader Two',
          username: 'reader-two',
          avatar_url: 'https://example.com/avatar.png',
        },
      }]);
    });
  });

  // ──────────────────── updateReadingStatus ────────────────────
  describe('updateReadingStatus', () => {
    it('sets completed_at when status is "completed"', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await booksService.updateReadingStatus('ub1', 'completed');

      const updateArg = builder.update.mock.calls[0][0];
      expect(updateArg.reading_status).toBe('completed');
      expect(updateArg.completed_at).toBeDefined();
    });

    it('does NOT set completed_at for non-completed status', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await booksService.updateReadingStatus('ub1', 'reading');

      const updateArg = builder.update.mock.calls[0][0];
      expect(updateArg.reading_status).toBe('reading');
      expect(updateArg.completed_at).toBeUndefined();
    });
  });

  // ──────────────────── addRating ────────────────────
  describe('addRating', () => {
    it('updates rating, review, and privacy when rating is provided', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await booksService.addRating('ub1', 4, 'Great read', true);

      expect(supabase.from).toHaveBeenCalledWith('user_books');
      expect(builder.update).toHaveBeenCalledWith({
        rating: 4,
        review: 'Great read',
        review_is_public: true,
      });
      expect(builder.eq).toHaveBeenCalledWith('id', 'ub1');
    });

    it('omits rating from the update payload for review-only saves', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await booksService.addRating('ub1', undefined, 'Private note', false);

      expect(builder.update).toHaveBeenCalledWith({
        review: 'Private note',
        review_is_public: false,
      });
    });
  });

  // ──────────────────── removeFromLibrary ────────────────────
  describe('removeFromLibrary', () => {
    it('deletes from user_books by id', async () => {
      const builder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await booksService.removeFromLibrary('ub1');

      expect(supabase.from).toHaveBeenCalledWith('user_books');
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'ub1');
    });

    it('throws on error', async () => {
      const builder = mockQuery({ data: null, error: { message: 'Not found' } });
      (supabase.from as jest.Mock).mockReturnValueOnce(builder);

      await expect(booksService.removeFromLibrary('ub-bad')).rejects.toEqual({ message: 'Not found' });
    });
  });
});

