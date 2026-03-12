/**
 * Unit tests for useWishlist.ts
 *
 * Tests: fetchWishlist, addToWishlist (canonical user_books flow), removeFromWishlist,
 * toggleWishlist, isInWishlist, unauthenticated guard, error states.
 */
jest.mock('@/features/books/services/booksService', () => ({
  booksService: {
    getUserLibrary: jest.fn(),
    getUserBookByGoogleBookId: jest.fn(),
    addToLibrary: jest.fn(),
    removeFromLibrary: jest.fn(),
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { booksService } from '@/features/books/services/booksService';
import { useWishlist } from '../useWishlist';
import { GoogleBook } from '@/features/books/services/booksService';

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
      const { result } = renderHook(() => useWishlist(undefined));

      expect(result.current.wishlist).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(booksService.getUserLibrary).not.toHaveBeenCalled();
    });
  });

  describe('fetchWishlist', () => {
    it('fetches wishlist and builds bookIds Set', async () => {
      const libraryData = [
        { id: 'w1', ownership: 'wishlist', user_id: 'u1', book: { google_books_id: 'gb-1' }, created_at: '2024-01-01' },
        { id: 'l1', ownership: 'owned', user_id: 'u1', book: { google_books_id: 'gb-2' }, created_at: '2024-01-02' },
      ];
      (booksService.getUserLibrary as jest.Mock).mockResolvedValue(libraryData);

      const { result } = renderHook(() => useWishlist('u1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.wishlist).toEqual([libraryData[0]]);
      expect(result.current.isInWishlist('gb-1')).toBe(true);
      expect(result.current.isInWishlist('gb-2')).toBe(false);
    });

    it('sets error on fetch failure', async () => {
      (booksService.getUserLibrary as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useWishlist('u1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('addToWishlist', () => {
    it('returns false and sets error when not authenticated', async () => {
      const { result } = renderHook(() => useWishlist(undefined));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.addToWishlist(mockBook);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('User not authenticated');
    });

    it('adds a canonical wishlist row through booksService', async () => {
      (booksService.getUserLibrary as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'ub1', ownership: 'wishlist', user_id: 'u1', book: { google_books_id: 'gb-1' }, created_at: '2024-01-01' }]);
      (booksService.getUserBookByGoogleBookId as jest.Mock).mockResolvedValue(null);
      (booksService.addToLibrary as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWishlist('u1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.addToWishlist(mockBook);
      });

      expect(success).toBe(true);
      expect(booksService.addToLibrary).toHaveBeenCalledWith('u1', mockBook, 'want_to_read', 'wishlist');
      expect(result.current.isInWishlist('gb-1')).toBe(true);
    });

    it('returns false when the book is already wishlisted', async () => {
      (booksService.getUserLibrary as jest.Mock).mockResolvedValue([]);
      (booksService.getUserBookByGoogleBookId as jest.Mock).mockResolvedValue({ id: 'ub1', ownership: 'wishlist' });

      const { result } = renderHook(() => useWishlist('u1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.addToWishlist(mockBook);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Book already in wishlist');
    });

    it('returns false when the book is already in the main library', async () => {
      (booksService.getUserLibrary as jest.Mock).mockResolvedValue([]);
      (booksService.getUserBookByGoogleBookId as jest.Mock).mockResolvedValue({ id: 'ub1', ownership: 'owned' });

      const { result } = renderHook(() => useWishlist('u1'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.addToWishlist(mockBook);
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Book already in your library');
    });
  });

  describe('removeFromWishlist', () => {
    it('returns false when not authenticated', async () => {
      const { result } = renderHook(() => useWishlist(undefined));

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.removeFromWishlist('gb-1');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('User not authenticated');
    });

    it('removes the canonical wishlist row from user_books', async () => {
      (booksService.getUserLibrary as jest.Mock)
        .mockResolvedValueOnce([{ id: 'ub1', ownership: 'wishlist', user_id: 'u1', book: { google_books_id: 'gb-1' }, created_at: '2024-01-01' }])
        .mockResolvedValueOnce([]);
      (booksService.getUserBookByGoogleBookId as jest.Mock).mockResolvedValue({ id: 'ub1', ownership: 'wishlist' });
      (booksService.removeFromLibrary as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWishlist('u1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.removeFromWishlist('gb-1');
      });

      expect(booksService.removeFromLibrary).toHaveBeenCalledWith('ub1');
    });
  });

  describe('toggleWishlist', () => {
    it('adds when book is not in wishlist', async () => {
      (booksService.getUserLibrary as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'ub1', ownership: 'wishlist', user_id: 'u1', book: { google_books_id: 'gb-1' }, created_at: '2024-01-01' }]);
      (booksService.getUserBookByGoogleBookId as jest.Mock).mockResolvedValue(null);
      (booksService.addToLibrary as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useWishlist('u1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.toggleWishlist(mockBook);
      });

      expect(booksService.addToLibrary).toHaveBeenCalledWith('u1', mockBook, 'want_to_read', 'wishlist');
    });
  });
});

