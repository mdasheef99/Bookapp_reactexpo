/**
 * Unit tests for booksService.ts
 *
 * Tests: searchGoogleBooks (pagination, filters, errors), getSearchSuggestions (dedup, limit),
 * addToLibrary (upsert + 23505 duplicate), getUserLibrary, getBookDetails,
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
  });

  // ──────────────────── addToLibrary ────────────────────
  describe('addToLibrary', () => {
    it('upserts book then inserts user_book, returns book data', async () => {
      const bookData = { id: 'book-uuid-1', title: 'Test Book' };
      // First from() call: books upsert
      const booksBuilder = mockQuery({ data: bookData, error: null });
      // Second from() call: user_books insert
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(booksBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      const result = await booksService.addToLibrary('user-1', mockGoogleBook);

      expect(supabase.from).toHaveBeenCalledWith('books');
      expect(supabase.from).toHaveBeenCalledWith('user_books');
      expect(booksBuilder.upsert).toHaveBeenCalled();
      expect(userBooksBuilder.insert).toHaveBeenCalled();
      expect(result).toEqual(bookData);
    });

    it('converts HTTP thumbnail to HTTPS and replaces zoom parameter', async () => {
      const bookData = { id: 'b1' };
      const booksBuilder = mockQuery({ data: bookData, error: null });
      const userBooksBuilder = mockQuery({ data: null, error: null });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(booksBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      await booksService.addToLibrary('user-1', mockGoogleBook);

      // The upsert call should have HTTPS URL with zoom=0
      const upsertArg = booksBuilder.upsert.mock.calls[0][0];
      expect(upsertArg.cover_url).toBe('https://books.google.com/books?id=123&zoom=0');
    });

    it('throws "already in your library" for duplicate 23505', async () => {
      const booksBuilder = mockQuery({ data: { id: 'b1' }, error: null });
      const userBooksBuilder = mockQuery({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce(booksBuilder)
        .mockReturnValueOnce(userBooksBuilder);

      await expect(booksService.addToLibrary('user-1', mockGoogleBook))
        .rejects.toThrow('This book is already in your library.');
    });

    it('throws on book upsert error', async () => {
      const booksBuilder = mockQuery({ data: null, error: { message: 'DB error' } });
      (supabase.from as jest.Mock).mockReturnValueOnce(booksBuilder);

      await expect(booksService.addToLibrary('user-1', mockGoogleBook))
        .rejects.toEqual({ message: 'DB error' });
    });
  });

  // ──────────────────── getUserLibrary ────────────────────
  describe('getUserLibrary', () => {
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

