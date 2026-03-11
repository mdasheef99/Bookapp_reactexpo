/**
 * Smoke test: src/hooks/useDebounce.ts
 *
 * Tests the useDebounce hook using renderHook from RNTL.
 * Validates that React hooks and RNTL's renderHook work in the test environment.
 */
import { renderHook, act } from '@testing-library/react-native';
import { useDebounce } from '@/hooks/useDebounce';

type DebounceHookProps<T> = {
  value: T;
  delay: number;
};

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('should not update the value before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: DebounceHookProps<string>) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 500 } }
    );

    rerender({ value: 'world', delay: 500 });

    // Advance time but not enough
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('hello');
  });

  it('should update the value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: DebounceHookProps<string>) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 500 } }
    );

    rerender({ value: 'world', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('world');
  });

  it('should reset the timer when value changes rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: DebounceHookProps<string>) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } }
    );

    // Rapid changes
    rerender({ value: 'ab', delay: 500 });
    act(() => { jest.advanceTimersByTime(200); });

    rerender({ value: 'abc', delay: 500 });
    act(() => { jest.advanceTimersByTime(200); });

    rerender({ value: 'abcd', delay: 500 });
    act(() => { jest.advanceTimersByTime(200); });

    // Not enough total time for any update
    expect(result.current).toBe('a');

    // Now wait for the full delay after last change
    act(() => { jest.advanceTimersByTime(300); });

    // Should have the final value
    expect(result.current).toBe('abcd');
  });

  it('should work with numeric values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: DebounceHookProps<number>) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 300 } }
    );

    rerender({ value: 42, delay: 300 });

    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current).toBe(42);
  });
});

