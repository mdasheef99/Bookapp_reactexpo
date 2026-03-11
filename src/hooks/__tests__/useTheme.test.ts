/**
 * Unit tests for useTheme.ts
 *
 * Tests: getCurrentPhase (daylight, golden, midnight),
 * THEME_COLORS completeness, useTheme hook output, 5-minute interval.
 *
 * KEY: No jest.resetModules() — that causes React dual-copy issues with renderHook.
 * Instead, use jest.setSystemTime() before each renderHook() call. Since getCurrentPhase()
 * calls `new Date().getHours()` at render time, each fresh renderHook picks up the fake time.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useTheme, type ThemeColors } from '../useTheme';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useTheme', () => {
  describe('getCurrentPhase via useTheme', () => {
    it('returns daylight phase between 5:00 and 16:59', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 12, 0, 0)); // noon
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('daylight');
      expect(result.current.colors).toBeDefined();
      expect(result.current.colors.bgPrimary).toBe('#F8FAFC');
    });

    it('returns golden phase between 17:00 and 19:59', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 18, 0, 0)); // 6 PM
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('golden');
      expect(result.current.colors.bgPrimary).toBe('#FFF7ED');
    });

    it('returns midnight phase between 20:00 and 4:59', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 23, 0, 0)); // 11 PM
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('midnight');
      expect(result.current.colors.bgPrimary).toBe('#020617');
    });

    it('returns midnight at hour 0 (midnight)', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 0, 0, 0));
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('midnight');
    });

    it('returns daylight at hour 5 (boundary)', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 5, 0, 0));
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('daylight');
    });

    it('returns golden at hour 17 (boundary)', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 17, 0, 0));
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('golden');
    });

    it('returns midnight at hour 20 (boundary)', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 20, 0, 0));
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('midnight');
    });
  });

  describe('THEME_COLORS completeness', () => {
    const expectedKeys: Array<keyof ThemeColors> = [
      'bgPrimary', 'bgSecondary', 'bgCard',
      'textPrimary', 'textSecondary', 'textTertiary',
      'accent', 'accentLight', 'border', 'shadow',
    ];

    it.each([
      { hour: 12, phase: 'daylight' },
      { hour: 18, phase: 'golden' },
      { hour: 23, phase: 'midnight' },
    ])('$phase phase has all 10 color properties', ({ hour, phase }) => {
      jest.setSystemTime(new Date(2026, 1, 17, hour, 0, 0));
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe(phase);
      expectedKeys.forEach((key) => {
        expect(result.current.colors).toHaveProperty(key);
        expect(typeof result.current.colors[key]).toBe('string');
      });
    });
  });

  describe('5-minute interval update', () => {
    it('updates phase when time crosses boundary', () => {
      // Start at 16:58 (daylight)
      jest.setSystemTime(new Date(2026, 1, 17, 16, 58, 0));
      const { result } = renderHook(() => useTheme());

      expect(result.current.phase).toBe('daylight');

      // Advance system time to 17:03 then trigger interval
      jest.setSystemTime(new Date(2026, 1, 17, 17, 3, 0));
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      });

      expect(result.current.phase).toBe('golden');
    });

    it('cleans up interval on unmount', () => {
      jest.setSystemTime(new Date(2026, 1, 17, 12, 0, 0));
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { unmount } = renderHook(() => useTheme());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
