/**
 * Unit tests for useWishlist.ts
 *
 * Tests: fetchWishlist, addToWishlist (optimistic + 23505), removeFromWishlist,
 * toggleWishlist, isInWishlist, unauthenticated guard, error states.
 */
jest.mock('@/lib/supabase');

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useWishlist } from '../useWishlist';
import { GoogleBook } from '@/features/books/services/booksService';

// Helper: chainable query builder
function mockQuery(response: Record<string, any>) {
  const builder: any = {};
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq',
    'order', 'limit', 'single', 'maybeSingle',
  ];
  methods.forEach((m) => { builder[m] = jest.fn(() => builder); });
  builder.then = jest.fn((resolve: any) => resolve(response));
  return builder;
}

const mockBook: GoogleBook = {
  id: 'gb-1',
  volumeInfo: { title: 'Test Book', authors: ['Author A'] },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useWishlist', () => {
  describe('without userId', () => {
    it('does not fetch wishlist and returns empty state', () => {
      // Mock from() for the initial useEffect fetch
      (supabase.from as jest.Mock).mockReturnValue(mockQuery({ data: [], error: null }));

      const { result } = renderHook(() => useWishlist(undefined));

      expect(result.current.wishlist).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('fetchWishlist', () => {
    it('fetches wishlist and builds bookIds Set', async () => {
      const wishlistData = [
        { id: 'w1', google_books_id: 'gb-1', user_id: 'u1', book_data: mockBook, created_at: '2024-01-01' },
      ];
      (supabase.from as jest.Mock).mockReturnValue(mockQuery({ data: wishlistData, error: null }));

      const { result } = renderHook(() => useWishlist('u1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.wishlist).toEqual(wishlistData);
      expect(result.current.isInWishlist('gb-1')).toBe(true);
      expect(result.current.isInWishlist('gb-2')).toBe(false);
    });

    it('sets error on fetch failure', async () => {
      (supabase.from as jest.Mock).mockReturnValue(
        mockQuery({ data: null, error: { message: 'Network error' } }),
      );

      const { result } = renderHook(() => useWishlist('u1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('addToWishlist', () => {
    it('returns false and sets error when not authenticated', async () => {
      (supabase.from as jest.Mock).mockReturnValue(mockQuery({ data: [], error: null }));
      const { result } = renderHook(() => useWishlist(undefined));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.addToWishlist(mockBook);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('User not authenticated');
    });

    it('handles 23505 duplicate gracefully', async () => {
      // Initial fetch
      (supabase.from as jest.Mock).mockReturnValue(mockQuery({ data: [], error: null }));
      const { result } = renderHook(() => useWishlist('u1'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Attempt to add — returns 23505
      (supabase.from as jest.Mock).mockReturnValue(
        mockQuery({ data: null, error: { code: '23505', message: 'duplicate' } }),
      );

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.addToWishlist(mockBook);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Book already in wishlist');
    });
  });

  describe('removeFromWishlist', () => {
    it('returns false when not authenticated', async () => {
      (supabase.from as jest.Mock).mockReturnValue(mockQuery({ data: [], error: null }));
      const { result } = renderHook(() => useWishlist(undefined));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.removeFromWishlist('gb-1');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('User not authenticated');
    });
  });

  describe('toggleWishlist', () => {
    it('adds when book is not in wishlist', async () => {
      // Initial fetch returns empty
      const fetchBuilder = mockQuery({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValue(fetchBuilder);

      const { result } = renderHook(() => useWishlist('u1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Toggle should call addToWishlist (insert)
      const insertBuilder = mockQuery({ data: null, error: null });
      (supabase.from as jest.Mock).mockReturnValue(insertBuilder);

      await act(async () => {
        await result.current.toggleWishlist(mockBook);
      });

      // Verify insert was called (not delete)
      expect(insertBuilder.insert).toHaveBeenCalled();
    });
  });
});

