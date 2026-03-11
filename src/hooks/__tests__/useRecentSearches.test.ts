/**
 * Unit tests for useRecentSearches.ts
 *
 * Tests: loadRecentSearches from AsyncStorage, saveRecentSearch (dedup, limit),
 * removeRecentSearch (haptics), clearRecentSearches, error handling.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useRecentSearches } from '../useRecentSearches';
import { RECENT_SEARCHES_KEY, MAX_RECENT_SEARCHES } from '@/lib/constants';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRecentSearches', () => {
  describe('loadRecentSearches', () => {
    it('loads saved searches from AsyncStorage on mount', async () => {
      const saved = ['React Native', 'TypeScript', 'Expo'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(saved));

      const { result } = renderHook(() => useRecentSearches());

      await waitFor(() => {
        expect(result.current.recentSearches).toEqual(saved);
      });

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(RECENT_SEARCHES_KEY);
    });

    it('starts with empty array when nothing saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useRecentSearches());

      await waitFor(() => {
        expect(AsyncStorage.getItem).toHaveBeenCalled();
      });

      expect(result.current.recentSearches).toEqual([]);
    });

    it('handles AsyncStorage error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage fail'));

      const { result } = renderHook(() => useRecentSearches());

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load recent searches:',
          expect.any(Error),
        );
      });

      expect(result.current.recentSearches).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('saveRecentSearch', () => {
    it('prepends new search, deduplicates, and limits to MAX_RECENT_SEARCHES', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useRecentSearches());
      await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());

      // Add a search
      await act(async () => {
        await result.current.saveRecentSearch('Kotlin');
      });

      expect(result.current.recentSearches).toEqual(['Kotlin']);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        RECENT_SEARCHES_KEY,
        JSON.stringify(['Kotlin']),
      );
    });

    it('moves duplicate to front instead of adding again', async () => {
      const existing = ['A', 'B', 'C'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(existing));

      const { result } = renderHook(() => useRecentSearches());
      await waitFor(() => expect(result.current.recentSearches).toEqual(existing));

      await act(async () => {
        await result.current.saveRecentSearch('B');
      });

      expect(result.current.recentSearches).toEqual(['B', 'A', 'C']);
    });
  });

  describe('removeRecentSearch', () => {
    it('removes search, triggers haptics, and persists', async () => {
      const existing = ['X', 'Y', 'Z'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(existing));

      const { result } = renderHook(() => useRecentSearches());
      await waitFor(() => expect(result.current.recentSearches).toEqual(existing));

      await act(async () => {
        await result.current.removeRecentSearch('Y');
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
      expect(result.current.recentSearches).toEqual(['X', 'Z']);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        RECENT_SEARCHES_KEY,
        JSON.stringify(['X', 'Z']),
      );
    });
  });

  describe('clearRecentSearches', () => {
    it('clears state and removes from AsyncStorage', async () => {
      const existing = ['A', 'B'];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(existing));

      const { result } = renderHook(() => useRecentSearches());
      await waitFor(() => expect(result.current.recentSearches).toEqual(existing));

      await act(async () => {
        await result.current.clearRecentSearches();
      });

      expect(result.current.recentSearches).toEqual([]);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(RECENT_SEARCHES_KEY);
    });
  });
});

