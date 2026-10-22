import React from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LibraryStatsScreen, { normalizeStatsView } from '../stats';
import { useReadingStats } from '@/features/books/history/useReadingStats';
import { useReadingGoal } from '@/features/books/history/useReadingGoal';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { captureCardPng } from '@/features/books/export/captureCard';
import { deliverImageFile } from '@/features/books/export/deliver';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'reader-1' }, session: { user: { id: 'reader-1' } } }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: mockOffline }) }));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: jest.fn() }),
}));
jest.mock('@/features/books/history/useReadingStats', () => ({ useReadingStats: jest.fn() }));
jest.mock('@/features/books/history/useReadingGoal', () => ({ useReadingGoal: jest.fn() }));
jest.mock('@/features/books/export/captureCard', () => ({
  captureCardPng: jest.fn(),
  releaseCardCapture: jest.fn(),
}));
jest.mock('@/features/books/export/deliver', () => ({
  deliverImageFile: jest.fn(),
  ExportUnavailableError: class ExportUnavailableError extends Error {},
}));
jest.mock('@/components/library/LibraryTypography', () => ({
  ...jest.requireActual('@/components/library/LibraryTypography'),
  useLibraryTypography: () => ({
    serif: 'LibraryGaramondMedium',
    heading: 'LibraryGaramondSemiBold',
    body: 'LibraryManrope',
    label: 'LibraryManropeBold',
  }),
}));

const mockPush = jest.fn();
const mockNotify = jest.fn();
let mockOffline = false;
const statsHook = useReadingStats as jest.Mock;
const goalHook = useReadingGoal as jest.Mock;
const capture = jest.mocked(captureCardPng);
const deliver = jest.mocked(deliverImageFile);

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'reader-1',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: '2026-01-01',
    ended_on: '2026-01-10',
    start_unknown: false,
    end_unknown: false,
    total_pages: 300,
    counts_in_stats: true,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-10T10:00:00.000Z',
    ...overrides,
  };
}

const reads2026: ReadingRead[] = [
  baseRead({ id: 'r1', user_book_id: 'book-a', started_on: '2026-01-01', ended_on: '2026-01-10', total_pages: 300 }),
  baseRead({ id: 'r2', user_book_id: 'book-b', started_on: '2026-02-01', ended_on: '2026-02-05', total_pages: null }),
  baseRead({ id: 'r3', user_book_id: 'book-c', outcome: 'did_not_finish', started_on: '2026-03-01', ended_on: '2026-03-02' }),
];

function statsPart(overrides: Record<string, unknown> = {}) {
  return {
    reads: { data: reads2026, isPending: false, isError: false, refetch: jest.fn() },
    quotes: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    ...(overrides as Record<string, unknown>),
  };
}

function goalPart(overrides: Record<string, unknown> = {}) {
  return {
    goal: {
      data: { user_id: 'reader-1', year: 2026, target_books: 24, updated_at: '2026-01-01T00:00:00.000Z' },
      isPending: false,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    },
    reads: { data: reads2026, isPending: false, isError: false, refetch: jest.fn() },
    setGoal: { mutateAsync: jest.fn().mockResolvedValue(null), isPending: false },
    ...(overrides as Record<string, unknown>),
  };
}

function mockHooks(statsOverrides: Record<string, unknown> = {}, goalOverrides: Record<string, unknown> = {}) {
  statsHook.mockReturnValue(statsPart(statsOverrides));
  goalHook.mockReturnValue(goalPart(goalOverrides));
}

function setup(props: Record<string, unknown> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <LibraryStatsScreen yearOverride={2026} timeZone="UTC" {...props} />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockHooks();
  capture.mockResolvedValue('file:///capture.png');
  deliver.mockResolvedValue('shared');
});

describe('Stats screen (H-17)', () => {
  it('shows the heading and rows, toggle and monthly text equivalent', async () => {
    const ui = setup();
    try {
      expect(await ui.findByTestId('library-stats-heading')).toHaveTextContent('Your 2026');
      expect(ui.queryByTestId('library-stats-summary' as never)).toBeNull();
      expect(ui.getByTestId('library-stats-books')).toHaveTextContent('2 books finished');
      expect(ui.getByTestId('library-stats-pages')).toHaveTextContent('300 pages read');
      expect(ui.getByTestId('library-stats-pages-note')).toHaveTextContent('1 book without a page count');
      expect(ui.getByTestId('library-stats-rate')).toHaveTextContent('Finish rate 67%');
      expect(ui.getByTestId('library-stats-average')).toBeOnTheScreen();
      const chart = ui.getByTestId('library-stats-month-chart', { includeHiddenElements: true });
      expect(chart.props.accessibilityElementsHidden).toBe(true);
      expect(chart.props['aria-hidden']).toBe(true);
      const monthsText = ui.getByTestId('library-stats-months-text');
      expect(monthsText).toHaveTextContent(/Finished reads per month:/);
      expect(monthsText).toHaveTextContent(/A book finished twice appears twice\./);
      fireEvent.press(ui.getByTestId('library-stats-toggle-all'));
      expect(await ui.findByTestId('library-stats-heading')).toHaveTextContent('All time');
      expect(ui.queryByTestId('library-stats-months')).toBeNull();
      fireEvent.press(ui.getByTestId('library-stats-toggle-year'));
      expect(await ui.findByTestId('library-stats-heading')).toHaveTextContent('Your 2026');
      expect(ui.getByTestId('library-stats-months')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it("normalises initialView ('all' stays all, anything else becomes year)", async () => {
    expect(normalizeStatsView('all')).toBe('all');
    expect(normalizeStatsView('year')).toBe('year');
    expect(normalizeStatsView('bogus')).toBe('year');
    expect(normalizeStatsView(undefined)).toBe('year');
    const allUi = setup({ initialView: 'all' });
    try {
      expect(await allUi.findByTestId('library-stats-heading')).toHaveTextContent('All time');
      expect(allUi.queryByTestId('library-stats-months')).toBeNull();
    } finally {
      allUi.unmount();
      allUi.client.clear();
    }
    const bogusUi = setup({ initialView: 'bogus' });
    try {
      expect(await bogusUi.findByTestId('library-stats-heading')).toHaveTextContent('Your 2026');
      expect(bogusUi.getByTestId('library-stats-months')).toBeOnTheScreen();
    } finally {
      bogusUi.unmount();
      bogusUi.client.clear();
    }
  });

  it('saves a valid goal, rejects invalid input without dispatching, and removes', async () => {
    const setGoal = jest.fn().mockResolvedValue({
      user_id: 'reader-1',
      year: 2026,
      target_books: 30,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    mockHooks({}, { setGoal: { mutateAsync: setGoal, isPending: false } });
    const ui = setup();
    try {
      const input = await ui.findByTestId('library-stats-goal-input');
      fireEvent.changeText(input, '30');
      fireEvent.press(ui.getByTestId('library-stats-goal-save'));
      await waitFor(() => expect(setGoal).toHaveBeenCalledWith(30));
      fireEvent.changeText(input, '0');
      fireEvent.press(ui.getByTestId('library-stats-goal-save'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(setGoal).toHaveBeenCalledTimes(1);
      fireEvent.press(ui.getByTestId('library-stats-goal-remove'));
      await waitFor(() => expect(setGoal).toHaveBeenCalledWith(null));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows a Retry toast when saving the goal fails and guards double taps', async () => {
    let resolve!: (value: unknown) => void;
    const setGoal = jest.fn().mockReturnValue(
      new Promise((done) => { resolve = done as (value: unknown) => void; }),
    );
    mockHooks({}, { setGoal: { mutateAsync: setGoal, isPending: false } });
    const ui = setup();
    try {
      const input = await ui.findByTestId('library-stats-goal-input');
      fireEvent.changeText(input, '30');
      fireEvent.press(ui.getByTestId('library-stats-goal-save'));
      fireEvent.press(ui.getByTestId('library-stats-goal-save'));
      await waitFor(() => expect(setGoal).toHaveBeenCalledTimes(1));
      await act(async () => { resolve(null); });
      setGoal.mockRejectedValueOnce(new Error('down'));
      fireEvent.changeText(input, '31');
      fireEvent.press(ui.getByTestId('library-stats-goal-save'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      const call = mockNotify.mock.calls[mockNotify.mock.calls.length - 1][0] as {
        action?: { label: string };
      };
      expect(call.action?.label).toBe('Retry');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows the Year card entry on native This year only and previews before sharing', async () => {
    const ui = setup();
    try {
      expect(await ui.findByTestId('library-stats-year-card')).toBeOnTheScreen();
      fireEvent.press(ui.getByTestId('library-stats-toggle-all'));
      expect(ui.queryByTestId('library-stats-year-card')).toBeNull();
      fireEvent.press(ui.getByTestId('library-stats-toggle-year'));
      fireEvent.press(await ui.findByTestId('library-stats-year-card'));
      expect(await ui.findByText('Share year card as image')).toBeOnTheScreen();
      fireEvent.press(ui.getByRole('button', { name: 'Share image' }));
      await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('hides the Year card entry on web', async () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    try {
      const ui = setup();
      try {
        expect(await ui.findByTestId('library-stats-heading')).toBeOnTheScreen();
        expect(ui.queryByTestId('library-stats-year-card')).toBeNull();
      } finally {
        ui.unmount();
        ui.client.clear();
      }
    } finally {
      Platform.OS = previousOS;
    }
  });
});
