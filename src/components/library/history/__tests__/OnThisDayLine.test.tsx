import React from 'react';
import { AppState, Platform, StyleSheet, Text } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OnThisDayLine } from '../OnThisDayLine';
import { historyKeys, ReadingRead } from '@/features/books/history/readingHistoryContract';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { BookButton } from '../../ui';
import { MIN_TARGET } from '../../LibraryAppearance';
import type { LibraryBookEntry } from '@/features/books/utils/libraryShelf';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { readsForUser: jest.fn() },
}));

const gateway = readingHistoryGateway as unknown as { readsForUser: jest.Mock };
let deviceTimeZone = 'UTC';

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: null,
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function entry(id: string, title: string): LibraryBookEntry {
  return {
    id,
    reading_status: 'completed',
    ownership: 'owned',
    book: { title, authors: ['Author'] },
  } as LibraryBookEntry;
}

function setup(props: Partial<React.ComponentProps<typeof OnThisDayLine>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const onOpenBook = jest.fn();
  const ui = render(
    <QueryClientProvider client={client}>
      <OnThisDayLine
        actorId="actor"
        books={[entry('book-1', 'Hooked')]}
        booksLoaded
        hidden={false}
        onOpenBook={onOpenBook}
        timeZone="UTC"
        today="2026-10-23"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { client, onOpenBook, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  deviceTimeZone = 'UTC';
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => ({
    ...options,
    timeZone: deviceTimeZone,
  }));
  gateway.readsForUser.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('OnThisDayLine', () => {
  it('renders nothing while reads are unloaded', async () => {
    let resolveReads!: (v: ReadingRead[]) => void;
    gateway.readsForUser.mockReturnValue(new Promise<ReadingRead[]>((done) => { resolveReads = done; }));
    const ui = setup();
    try {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      resolveReads([baseRead({ id: 'r1', ended_on: '2025-10-23' })]);
      expect(await ui.findByTestId('library-on-this-day')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('renders nothing while entries are unloaded', async () => {
    gateway.readsForUser.mockResolvedValue([baseRead({ id: 'r1', ended_on: '2025-10-23' })]);
    const ui = setup({ books: [entry('book-1', 'Hooked')], booksLoaded: false });
    try {
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      expect(await ui.queryByTestId('library-on-this-day-open')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('keeps one shared request when hidden is toggled and renders nothing while hidden', async () => {
    const cached = [baseRead({ id: 'r1', ended_on: '2025-10-23' })];
    gateway.readsForUser.mockResolvedValue(cached);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
    });
    function Other() {
      useQuery({
        queryKey: historyKeys.readsForUser('actor'),
        queryFn: ({ signal }) => readingHistoryGateway.readsForUser('actor', signal),
        retry: false,
      });
      return null;
    }
    const content = (hidden: boolean) => (
      <QueryClientProvider client={client}>
        <OnThisDayLine
          actorId="actor"
          books={[entry('book-1', 'Hooked')]}
          booksLoaded
          hidden={hidden}
          onOpenBook={jest.fn()}
          timeZone="UTC"
          today="2026-10-23"
        />
        <Other />
      </QueryClientProvider>
    );
    const ui = render(content(false));
    try {
      await ui.findByTestId('library-on-this-day');
      expect(gateway.readsForUser).toHaveBeenCalledTimes(1);
      ui.rerender(content(true));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      expect(gateway.readsForUser).toHaveBeenCalledTimes(1);
      ui.rerender(content(false));
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(ui.getByTestId('library-on-this-day')).toBeOnTheScreen();
      expect(gateway.readsForUser).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      client.clear();
    }
  });

  it('renders nothing with no match and no error or loading copy', async () => {
    gateway.readsForUser.mockResolvedValue([baseRead({ id: 'r1', ended_on: '2025-06-01' })]);
    const ui = setup();
    try {
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      expect(ui.queryByText(/couldn.t/i)).toBeNull();
      expect(ui.queryByText(/loading/i)).toBeNull();
      expect(ui.queryByText(/empty/i)).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('renders nothing on reads error (no error state)', async () => {
    gateway.readsForUser.mockRejectedValue(new Error('down'));
    const ui = setup();
    try {
      await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      expect(ui.queryByText(/couldn.t/i)).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows the sentence with the title in italics and an accessible link name', async () => {
    gateway.readsForUser.mockResolvedValue([baseRead({ id: 'r1', ended_on: '2025-10-23' })]);
    const ui = setup();
    try {
      const link = await ui.findByTestId('library-on-this-day-open');
      expect(link).toHaveProp('accessibilityRole', 'link');
      expect(link).toHaveProp('accessibilityLabel', 'On this day in 2025 you finished Hooked.');
      const title = ui.getByText('Hooked');
      expect(StyleSheet.flatten(title.props.style)).toMatchObject({ fontStyle: 'italic' });
      expect(ui.getByText(/On this day in 2025 you finished/)).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('tapping the line opens the right book', async () => {
    gateway.readsForUser.mockResolvedValue([baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23' })]);
    const ui = setup();
    try {
      fireEvent.press(await ui.findByTestId('library-on-this-day-open'));
      expect(ui.onOpenBook).toHaveBeenCalledTimes(1);
      expect(ui.onOpenBook).toHaveBeenCalledWith('book-1');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('expands "and 2 more" in place with per-line taps and collapses', async () => {
    gateway.readsForUser.mockResolvedValue([
      baseRead({ id: 'r-new', user_book_id: 'book-1', ended_on: '2025-10-23', ended_at: '2025-10-23T20:00:00.000Z' }),
      baseRead({ id: 'r-mid', user_book_id: 'book-2', ended_on: '2024-10-23', ended_at: '2024-10-23T10:00:00.000Z' }),
      baseRead({ id: 'r-old', user_book_id: 'book-3', ended_on: '2023-10-23', ended_at: null }),
    ]);
    const ui = setup({
      books: [entry('book-1', 'Hooked'), entry('book-2', 'Dune'), entry('book-3', 'Walden')],
    });
    try {
      expect(await ui.findByTestId('library-on-this-day-open')).toBeOnTheScreen();
      const more = await ui.findByTestId('library-on-this-day-more');
      expect(more).toHaveTextContent('and 2 more');
      expect(more.props.accessibilityState).toMatchObject({ expanded: false });
      expect(ui.queryByText(/On this day in 2024 you finished/)).toBeNull();
      fireEvent.press(more);
      expect(await ui.findByText(/On this day in 2024 you finished/)).toBeOnTheScreen();
      expect(ui.getByText(/On this day in 2023 you finished/)).toBeOnTheScreen();
      const fewer = ui.getByTestId('library-on-this-day-fewer');
      expect(fewer.props.accessibilityState).toMatchObject({ expanded: true });
      expect(fewer).toHaveTextContent('Show fewer');
      expect(ui.queryByTestId('library-on-this-day-more')).toBeNull();
      fireEvent.press(ui.getByTestId('library-on-this-day-open-book-2-2024'));
      expect(ui.onOpenBook).toHaveBeenCalledWith('book-2');
      fireEvent.press(ui.getByTestId('library-on-this-day-fewer'));
      expect(ui.queryByText(/On this day in 2024 you finished/)).toBeNull();
      expect(await ui.findByTestId('library-on-this-day-more')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('uses "and 1 more" for a single remaining match', async () => {
    gateway.readsForUser.mockResolvedValue([
      baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23' }),
      baseRead({ id: 'r2', user_book_id: 'book-2', ended_on: '2024-10-23' }),
    ]);
    const ui = setup({ books: [entry('book-1', 'Hooked'), entry('book-2', 'Dune')] });
    try {
      expect(await ui.findByTestId('library-on-this-day-more')).toHaveTextContent('and 1 more');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('wraps at 200% text: no numberOfLines limit and target height', async () => {
    gateway.readsForUser.mockResolvedValue([
      baseRead({ id: 'r1', ended_on: '2025-10-23' }),
      baseRead({ id: 'r2', user_book_id: 'book-2', ended_on: '2024-10-23' }),
    ]);
    const ui = setup({ books: [entry('book-1', 'Hooked'), entry('book-2', 'Dune')] });
    try {
      await ui.findByTestId('library-on-this-day-open');
      const texts = ui.UNSAFE_queryAllByType(Text);
      expect(texts.length).toBeGreaterThan(0);
      for (const node of texts) {
        expect(node.props.numberOfLines).toBeUndefined();
      }
      const line = ui.getByTestId('library-on-this-day-open');
      expect(StyleSheet.flatten(line.props.style).minHeight).toBeGreaterThanOrEqual(MIN_TARGET);
      const visible = ui.UNSAFE_queryAllByType(BookButton);
      expect(visible).toHaveLength(1);
      expect(ui.getAllByRole('button')).toHaveLength(1);
      expect(ui.getByRole('button', { name: 'and 1 more' })).toBeOnTheScreen();
      expect(visible.filter((b) => b.props.variant === 'primary')).toHaveLength(0);
      fireEvent.press(ui.getByRole('button', { name: 'and 1 more' }));
      const expanded = ui.UNSAFE_queryAllByType(BookButton);
      expect(expanded).toHaveLength(1);
      expect(ui.getAllByRole('button')).toHaveLength(1);
      expect(ui.getByRole('button', { name: 'Show fewer' })).toBeOnTheScreen();
      expect(expanded.filter((b) => b.props.variant === 'primary')).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('uses the shared reads query key', async () => {
    gateway.readsForUser.mockResolvedValue([baseRead({ id: 'r1', ended_on: '2025-10-23' })]);
    const ui = setup();
    try {
      await ui.findByTestId('library-on-this-day-open');
      expect(historyKeys.readsForUser('actor')).toEqual(['library-history-reads-user', 'actor']);
      expect(gateway.readsForUser).toHaveBeenCalledWith('actor', expect.anything());
      const state = ui.client.getQueryState(historyKeys.readsForUser('actor'));
      expect(state?.status).toBe('success');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shares one request when two consumers mount the same key', async () => {
    gateway.readsForUser.mockResolvedValue([baseRead({ id: 'r1', ended_on: '2025-10-23' })]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    function Other() {
      useQuery({
        queryKey: historyKeys.readsForUser('actor'),
        queryFn: ({ signal }) => readingHistoryGateway.readsForUser('actor', signal),
        retry: false,
      });
      return null;
    }
    const ui = render(
      <QueryClientProvider client={client}>
        <OnThisDayLine
          actorId="actor"
          books={[entry('book-1', 'Hooked')]}
          booksLoaded
          onOpenBook={jest.fn()}
          timeZone="UTC"
          today="2026-10-23"
        />
        <Other />
      </QueryClientProvider>,
    );
    try {
      await ui.findByTestId('library-on-this-day-open');
      await waitFor(() => expect(gateway.readsForUser).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
      client.clear();
    }
  });

  it('recomputes today on foreground (AppState) with fake timers', async () => {
    jest.useFakeTimers();
    const realAdd = AppState.addEventListener;
    let activeCallback: ((state: string) => void) | null = null;
    const addSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, cb: (s: string) => void) => {
      if (event === 'change') activeCallback = cb as (state: string) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof realAdd>;
    }) as typeof AppState.addEventListener);
    jest.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));
    gateway.readsForUser.mockResolvedValue([
      baseRead({ id: 'r-oct23', user_book_id: 'book-1', ended_on: '2025-10-23' }),
      baseRead({ id: 'r-oct24', user_book_id: 'book-2', ended_on: '2025-10-24' }),
    ]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <OnThisDayLine
          actorId="actor"
          books={[entry('book-1', 'Hooked'), entry('book-2', 'Dune')]}
          booksLoaded
          onOpenBook={jest.fn()}
          timeZone="UTC"
        />
      </QueryClientProvider>,
    );
    try {
      expect(await ui.findByTestId('library-on-this-day-open')).toBeOnTheScreen();
      expect(ui.getByTestId('library-on-this-day-open')).toHaveProp(
        'accessibilityLabel',
        'On this day in 2025 you finished Hooked.',
      );
      jest.setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
      await act(async () => {
        activeCallback?.('active');
      });
      await waitFor(() =>
        expect(ui.getByTestId('library-on-this-day-open')).toHaveProp(
          'accessibilityLabel',
          'On this day in 2025 you finished Dune.',
        ),
      );
    } finally {
      ui.unmount();
      client.clear();
      addSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('refreshes zone on foreground even when today stays the same, in both directions', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));
    let foreground!: (state: 'active') => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
      foreground = callback;
      return { remove: jest.fn() };
    });
    gateway.readsForUser.mockResolvedValue([
      baseRead({ ended_at: '2025-10-23T00:30:00.000Z' }),
    ]);
    const ui = setup({ today: undefined, timeZone: undefined });
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(10); });
      expect(ui.getByTestId('library-on-this-day')).toBeOnTheScreen();
      deviceTimeZone = 'America/New_York';
      await act(async () => { foreground('active'); });
      expect(ui.queryByTestId('library-on-this-day')).toBeNull();
      deviceTimeZone = 'UTC';
      await act(async () => { foreground('active'); });
      expect(ui.getByTestId('library-on-this-day')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('rolls over at midnight and re-arms for the following midnight', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T23:59:59.000Z'));
    gateway.readsForUser.mockResolvedValue([
      baseRead({ id: 'r23', ended_on: '2025-10-23' }),
      baseRead({ id: 'r24', user_book_id: 'book-2', ended_on: '2025-10-24' }),
      baseRead({ id: 'r25', user_book_id: 'book-3', ended_on: '2025-10-25' }),
    ]);
    const ui = setup({
      today: undefined,
      books: [entry('book-1', 'Hooked'), entry('book-2', 'Dune'), entry('book-3', 'Walden')],
    });
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(10); });
      expect(ui.getByRole('link', { name: 'On this day in 2025 you finished Hooked.' })).toBeOnTheScreen();
      await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
      expect(ui.getByRole('link', { name: 'On this day in 2025 you finished Dune.' })).toBeOnTheScreen();
      expect(ui.queryByText('Hooked')).toBeNull();
      await act(async () => { await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000); });
      expect(ui.getByRole('link', { name: 'On this day in 2025 you finished Walden.' })).toBeOnTheScreen();
      expect(ui.queryByText('Dune')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it.each([
    ['23-hour', '2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 23],
    ['25-hour', '2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 25],
  ])('schedules the next local midnight across a %s DST day', async (_, start, midnight, hours) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(start));
    const timerSpy = jest.spyOn(globalThis, 'setTimeout');
    const ui = setup({ today: undefined, timeZone: 'America/New_York' });
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(10); });
      const delays = timerSpy.mock.calls.map(([, delay]) => delay ?? 0).filter((delay) => delay > 1000);
      expect(delays).toHaveLength(1);
      const delay = delays[0];
      expect(delay).toBeGreaterThanOrEqual(Number(hours) * 60 * 60 * 1000);
      expect(delay).toBeLessThan(Number(hours) * 60 * 60 * 1000 + 1000);
      const scheduledAt = new Date(start).getTime() + delay;
      expect(scheduledAt).toBeGreaterThanOrEqual(new Date(midnight).getTime());
      expect(scheduledAt).toBeLessThan(new Date(midnight).getTime() + 1000);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('clears its timer and removes AppState and web focus listeners on unmount', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));
    jest.replaceProperty(Platform, 'OS', 'web');
    const removeAppState = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeAppState });
    const addFocus = jest.fn();
    const removeFocus = jest.fn();
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { addEventListener: addFocus, removeEventListener: removeFocus },
    });
    const timerSpy = jest.spyOn(globalThis, 'setTimeout');
    const ui = setup({ today: undefined, timeZone: undefined });
    try {
      await act(async () => { await jest.advanceTimersByTimeAsync(10); });
      expect(jest.getTimerCount()).toBe(1);
      expect(addFocus).toHaveBeenCalledWith('focus', expect.any(Function));
      const focusCallback = addFocus.mock.calls.find(([event]) => event === 'focus')?.[1];
      ui.unmount();
      ui.client.clear();
      expect(jest.getTimerCount()).toBe(0);
      expect(removeAppState).toHaveBeenCalledTimes(1);
      expect(removeFocus.mock.calls.filter(([event, callback]) => event === 'focus' && callback === focusCallback)).toHaveLength(1);
      expect(removeFocus).toHaveBeenCalledWith('focus', focusCallback);
      const scheduledTimers = timerSpy.mock.calls.length;
      await act(async () => { await jest.advanceTimersByTimeAsync(48 * 60 * 60 * 1000); });
      expect(jest.getTimerCount()).toBe(0);
      expect(timerSpy).toHaveBeenCalledTimes(scheduledTimers);
    } finally {
      ui.unmount();
      ui.client.clear();
      if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('exposes accessible names for the expanded lines', async () => {
    gateway.readsForUser.mockResolvedValue([
      baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23' }),
      baseRead({ id: 'r2', user_book_id: 'book-2', ended_on: '2023-10-23' }),
    ]);
    const ui = setup({ books: [entry('book-1', 'Hooked'), entry('book-2', 'Dune')] });
    try {
      fireEvent.press(await ui.findByTestId('library-on-this-day-more'));
      expect(await ui.findByRole('link', { name: 'On this day in 2025 you finished Hooked.' })).toBeOnTheScreen();
      expect(ui.getByRole('link', { name: 'On this day in 2023 you finished Dune.' })).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
