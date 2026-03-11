/**
 * Smoke test: src/lib/constants.ts
 *
 * Tests pure data exports with zero dependencies.
 * Validates that the test infrastructure (Jest, moduleNameMapper, preset) works correctly.
 */
import {
  RECENT_SEARCHES_KEY,
  MAX_RECENT_SEARCHES,
  GENRE_COLORS,
  SORT_OPTIONS,
  SortOption,
} from '@/lib/constants';

describe('constants', () => {
  describe('RECENT_SEARCHES_KEY', () => {
    it('should be a non-empty string', () => {
      expect(RECENT_SEARCHES_KEY).toBe('booktalks_recent_searches');
    });
  });

  describe('MAX_RECENT_SEARCHES', () => {
    it('should be a positive integer', () => {
      expect(MAX_RECENT_SEARCHES).toBe(5);
      expect(Number.isInteger(MAX_RECENT_SEARCHES)).toBe(true);
    });
  });

  describe('GENRE_COLORS', () => {
    it('should contain expected genres', () => {
      expect(GENRE_COLORS).toHaveProperty('Fiction');
      expect(GENRE_COLORS).toHaveProperty('Non-Fiction');
      expect(GENRE_COLORS).toHaveProperty('Romance');
      expect(GENRE_COLORS).toHaveProperty('default');
    });

    it('should have valid hex color values', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      Object.values(GENRE_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have a default fallback color', () => {
      expect(GENRE_COLORS['default']).toBeDefined();
    });
  });

  describe('SORT_OPTIONS', () => {
    it('should have exactly 4 options', () => {
      expect(SORT_OPTIONS).toHaveLength(4);
    });

    it('should include relevance, rating, newest, title', () => {
      const values = SORT_OPTIONS.map((opt) => opt.value);
      expect(values).toEqual(['relevance', 'rating', 'newest', 'title']);
    });

    it('each option should have value, label, and icon', () => {
      SORT_OPTIONS.forEach((option) => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('icon');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
        expect(typeof option.icon).toBe('string');
      });
    });
  });
});

