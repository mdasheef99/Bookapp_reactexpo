import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shelfOrderStorageKey, useShelfArrangement } from '../useShelfArrangement';
import { LibraryBookEntry } from '../../utils/libraryShelf';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
const books = (ids: string[]): LibraryBookEntry[] => ids.map((id) => ({ id, reading_status: 'reading', ownership: 'owned', book: { title: 'Same title' } }));
const source = books(['a', 'b', 'c']);
const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => { getItem.mockReset().mockResolvedValue(null); setItem.mockReset().mockResolvedValue(undefined); });

it('keeps moves/Undo/Cancel local to a draft and writes only on Save', async () => {
    const { result } = renderHook(() => useShelfArrangement('reader', source));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.enter());
    act(() => result.current.move('c', 'a'));
    expect(result.current.order).toEqual(['c', 'a', 'b']);
    expect(setItem).not.toHaveBeenCalled();
    act(() => result.current.undo());
    expect(result.current.order).toEqual(['a', 'b', 'c']);
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.move('b', 'a'));
    act(() => result.current.cancel());
    expect(result.current.order).toEqual(['a', 'b', 'c']);
    expect(setItem).not.toHaveBeenCalled();
    act(() => result.current.enter());
    act(() => result.current.move('c', 'a'));
    await act(() => result.current.save());
    expect(setItem).toHaveBeenCalledWith(shelfOrderStorageKey('reader'), '{"version":1,"ids":["c","a","b"]}');
    expect(result.current.active).toBe(false);
    expect(result.current.order).toEqual(['c', 'a', 'b']);
});

it('loads a saved arrangement and keeps new entries after its surviving IDs', async () => {
    getItem.mockResolvedValue('{"version":1,"ids":["b","removed","a"]}');
    const { result } = renderHook(() => useShelfArrangement('reader', source));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.order).toEqual(['b', 'a', 'c']);
    expect(setItem).not.toHaveBeenCalled();
});

it('retains the draft and its undo snapshot when saving fails, then permits retry', async () => {
    setItem.mockRejectedValueOnce(new Error('Storage full'));
    const { result } = renderHook(() => useShelfArrangement('reader', source));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.enter());
    act(() => result.current.move('a', null));
    await act(() => result.current.save());
    expect(result.current.active).toBe(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.order).toEqual(['b', 'c', 'a']);
    expect(result.current.message).toContain('Your moves are still here');
    await act(() => result.current.save());
    expect(result.current.active).toBe(false);
    expect(setItem).toHaveBeenCalledTimes(2);
});

it('cancels a draft when membership changes without losing newly added entries', async () => {
    getItem.mockResolvedValue('{"version":1,"ids":["c","b","a"]}');
    const { result, rerender } = renderHook(({ entries }: { entries: LibraryBookEntry[] }) => useShelfArrangement('reader', entries), { initialProps: { entries: source } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.enter());
    act(() => result.current.move('a', 'c'));
    rerender({ entries: books(['d', 'a', 'c']) });
    expect(result.current.active).toBe(false);
    expect(result.current.order).toEqual(['c', 'a', 'd']);
    expect(result.current.message).toContain('Your library changed');
    expect(setItem).not.toHaveBeenCalled();
});

it('reports membership cancellation truthfully when an in-flight save fails and allows a fresh draft', async () => {
    let rejectWrite!: (error: Error) => void;
    setItem.mockImplementationOnce(() => new Promise((_, reject) => { rejectWrite = reject; }));
    const { result, rerender } = renderHook(({ entries }: { entries: LibraryBookEntry[] }) => useShelfArrangement('reader', entries),
        { initialProps: { entries: source } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.enter());
    act(() => result.current.move('a', null));
    let pending!: Promise<void>;
    act(() => { pending = result.current.save(); });
    expect(result.current.saving).toBe(true);
    rerender({ entries: books(['new', 'a', 'c']) });
    expect(result.current.active).toBe(false);
    await act(async () => { rejectWrite(new Error('Storage full')); await pending; });
    expect(result.current.saving).toBe(false);
    expect(result.current.active).toBe(false);
    expect(result.current.order).toEqual(['new', 'a', 'c']);
    expect(result.current.message).toContain('Your library changed');
    expect(result.current.message).not.toContain('Your moves are still here');
    act(() => result.current.enter());
    act(() => result.current.move('c', 'new'));
    await act(() => result.current.save());
    expect(result.current.order).toEqual(['c', 'new', 'a']);
    expect(result.current.active).toBe(false);
    expect(setItem).toHaveBeenLastCalledWith(shelfOrderStorageKey('reader'), '{"version":1,"ids":["c","new","a"]}');
});

it('isolates users even when a previous account read finishes late', async () => {
    let finishFirst!: (raw: string) => void;
    getItem.mockImplementation((key) => key === shelfOrderStorageKey('first')
        ? new Promise((resolve) => { finishFirst = resolve; }) : Promise.resolve('{"version":1,"ids":["y","x"]}'));
    const { result, rerender } = renderHook(({ user, entries }: { user: string; entries: LibraryBookEntry[] }) => useShelfArrangement(user, entries), {
        initialProps: { user: 'first', entries: source },
    });
    rerender({ user: 'second', entries: books(['x', 'y']) });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => finishFirst('{"version":1,"ids":["c","b","a"]}'));
    expect(result.current.order).toEqual(['y', 'x']);
    act(() => result.current.enter());
    await act(() => result.current.save());
    expect(setItem).toHaveBeenCalledWith(shelfOrderStorageKey('second'), expect.any(String));
});

it('blocks arranging after a corrupt read and allows retry without silently overwriting it', async () => {
    getItem.mockResolvedValueOnce('corrupt').mockResolvedValueOnce(null);
    const { result } = renderHook(() => useShelfArrangement('reader', source));
    await waitFor(() => expect(result.current.readError).toBe(true));
    act(() => result.current.enter());
    expect(result.current.active).toBe(false);
    act(() => result.current.retryRead());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(setItem).not.toHaveBeenCalled();
});
