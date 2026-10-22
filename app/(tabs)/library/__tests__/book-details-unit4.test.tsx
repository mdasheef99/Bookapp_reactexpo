import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import { useAuthStore } from '@/features/auth/store/authStore';
import { booksService } from '@/features/books/services/booksService';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';
import { useReadProgress } from '@/features/books/history/useReadProgress';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';

let mockOffline = false;
let mockUserBook: any;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockNotify = jest.fn();
const mockHistory = useBookReadingHistory as jest.Mock;
const mockProgress = useReadProgress as jest.Mock;

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => {
    const { useAuthStore: store } = require('@/features/auth/store/authStore');
    const session = store((state: any) => state.session);
    return { user: session?.user, session };
  },
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: {
    getBookDetails: jest.fn(),
    getPublicReviewsForBook: jest.fn(),
    updateReadingStatus: jest.fn(),
    updateOwnership: jest.fn(),
    updateCondition: jest.fn(),
    toggleLendingAvailability: jest.fn(),
    removeFromLibrary: jest.fn(),
  },
}));
jest.mock('@/features/books/services/userBookPagesService', () => ({
  userBookPagesService: { getPagesForBook: jest.fn(), deletePage: jest.fn() },
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteOperations: jest.fn(() => []) }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({
  manualNotesGateway: { list: jest.fn() },
  noteSaves: { start: jest.fn() },
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: !mockOffline, isOffline: mockOffline }),
}));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: jest.fn() }),
}));
jest.mock('@/features/books/history/useBookReadingHistory', () => ({
  useBookReadingHistory: jest.fn(),
}));
jest.mock('@/features/books/history/useReadProgress', () => ({
  useReadProgress: jest.fn(),
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { userBookTitle: jest.fn() },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light' },
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-1') }));

function baseRead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'read-1',
    user_book_id: 'user-book-1',
    user_id: 'reader-1',
    read_number: 1,
    outcome: 'finished',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: '2026-10-20T10:00:00.000Z',
    started_on: '2026-10-01',
    ended_on: '2026-10-20',
    start_unknown: false,
    end_unknown: false,
    total_pages: 320,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

function historyState(overrides: Record<string, unknown> = {}) {
  return {
    reads: { data: [], isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
    editDates: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false, variables: undefined },
    removeRead: { mutateAsync: jest.fn().mockResolvedValue(true), isPending: false, variables: undefined },
    startReread: { mutateAsync: jest.fn().mockResolvedValue('read-2'), isPending: false },
    reopenRead: { mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false, variables: undefined },
    settings: { data: null, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
    allReads: { data: [], isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
    setNextRead: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    ...(overrides as Record<string, unknown>),
  };
}

function progressState() {
  return {
    progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    addProgress: { mutateAsync: jest.fn(), isPending: false },
    setTotalPages: { mutateAsync: jest.fn(), isPending: false },
  };
}

function makeBook(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-book-1',
    user_id: 'reader-1',
    book_id: 'book-1',
    rating: null,
    review: null,
    review_is_public: true,
    reading_status: 'want_to_read',
    ownership: 'owned',
    condition: 'good',
    available_for_lending: false,
    book: { title: 'Walden', authors: ['Henry David Thoreau'], cover_url: null, page_count: 357 },
    ...overrides,
  };
}

function makeNote(id: string, created_at: string, content = `Content ${id}`) {
  return { id, user_id: 'reader-1', user_book_id: 'user-book-1', content, tag: 'reflect', page_number: null, created_at, updated_at: null };
}

function controlsUpToPrimary(ui: ReturnType<typeof render>): string[] {
  const hosts = (ui.UNSAFE_root as unknown as { findAll: (pred: (node: never) => boolean) => Array<{ props: Record<string, unknown> }> }).findAll(
    (node: never) =>
      typeof (node as { type?: unknown }).type === 'string' &&
      ['button', 'link', 'radio', 'switch', 'checkbox'].includes(
        (node as { props: { accessibilityRole?: string } }).props.accessibilityRole as string,
      ),
  );
  const names: string[] = [];
  for (const node of hosts) {
    const name =
      node.props.accessibilityRole === 'radio' ? 'radiogroup' : String(node.props.accessibilityLabel);
    if (name === 'radiogroup' && names[names.length - 1] === 'radiogroup') continue;
    names.push(name);
    if (name === 'Add note') return names;
  }
  throw new Error('Add note not found');
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookDetailScreen />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  useAuthStore.setState({
    session: { user: { id: 'reader-1' }, access_token: 'token' } as never,
    status: 'authenticated',
  });
  mockUserBook = makeBook();
  (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
  (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
  (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
  (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
  (readingHistoryGateway.userBookTitle as unknown as jest.Mock).mockResolvedValue('Dune');
  mockHistory.mockReturnValue(historyState());
  mockProgress.mockReturnValue(progressState());
  jest.spyOn(bookReviewService, 'update').mockImplementation(async (_actor, entryId, patch) => {
    mockUserBook = { ...mockUserBook, ...patch };
    return { id: entryId, user_id: 'reader-1', rating: mockUserBook.rating, review: mockUserBook.review, review_is_public: mockUserBook.review_is_public };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe('Unit 4 on Book Details', () => {
  it('shows the timeline newest first with a selector and keeps DP-01', async () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-09-01', ended_on: '2026-09-10' }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-01', ended_on: '2026-10-20' }),
    ];
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(historyState({ reads: { data: reads, isPending: false, isError: false, refetch: jest.fn() }, allReads: { data: reads, isPending: false, isError: false, refetch: jest.fn() } }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([
      makeNote('n1', '2026-09-02T12:00:00.000Z'),
      makeNote('n2', '2026-10-12T12:00:00.000Z'),
    ]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(await ui.findByTestId('library-timeline')).toBeOnTheScreen();
      expect(ui.getByTestId('library-timeline-select-read-2')).toBeOnTheScreen();
      // D07-23: the top rating group and review button sit before the primary.
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Write a review', 'radiogroup', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows Make next read for wishlist, Replaces for another, and Your next read with Remove', async () => {
    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    mockHistory.mockReturnValue(historyState({ settings: { data: null, isPending: false, isError: false, refetch: jest.fn() } }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(await ui.findByTestId('library-next-read-make')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }

    mockHistory.mockReturnValue(
      historyState({
        settings: {
          data: { user_id: 'reader-1', next_read_user_book_id: 'user-book-2', updated_at: '2026-10-01T00:00:00.000Z' },
          isPending: false,
          isError: false,
          refetch: jest.fn(),
        },
      }),
    );
    const replaces = renderScreen();
    try {
      await replaces.findByText('Walden');
      await waitFor(() =>
        expect(replaces.getByTestId('library-next-read-make').props.accessibilityLabel).toMatch(
          /replaces Dune/i,
        ),
      );
      expect(replaces.queryByTestId('library-next-read-replaces')).toBeNull();
    } finally {
      replaces.unmount();
      replaces.client.clear();
    }

    mockHistory.mockReturnValue(
      historyState({
        settings: {
          data: { user_id: 'reader-1', next_read_user_book_id: 'user-book-1', updated_at: '2026-10-01T00:00:00.000Z' },
          isPending: false,
          isError: false,
          refetch: jest.fn(),
        },
      }),
    );
    const current = renderScreen();
    try {
      await current.findByText('Walden');
      expect(await current.findByTestId('library-next-read-current')).toBeOnTheScreen();
      const setNextRead = mockHistory.mock.results[mockHistory.mock.results.length - 1].value.setNextRead;
      fireEvent.press(current.getByTestId('library-next-read-remove'));
      await waitFor(() => expect(setNextRead.mutateAsync).toHaveBeenCalledWith(null));
    } finally {
      current.unmount();
      current.client.clear();
    }
  });

  it('hides next read for reading and finished books', async () => {
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(historyState({ reads: { data: [baseRead({ outcome: 'reading' })], isPending: false, isError: false, refetch: jest.fn() } }));
    const reading = renderScreen();
    try {
      await reading.findByText('Walden');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(reading.queryByTestId('library-next-read')).toBeNull();
    } finally {
      reading.unmount();
      reading.client.clear();
    }

    mockUserBook = makeBook({ reading_status: 'completed' });
    const finished = renderScreen();
    try {
      await finished.findByText('Walden');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(finished.queryByTestId('library-next-read')).toBeNull();
    } finally {
      finished.unmount();
      finished.client.clear();
    }
  });

  it('a failed next-read save shows Retry which re-runs', async () => {
    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    const setNextRead = jest.fn().mockRejectedValueOnce(new Error('next down')).mockResolvedValue({});
    mockHistory.mockReturnValue(historyState({ setNextRead: { mutateAsync: setNextRead, isPending: false } }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-next-read-make'));
      await waitFor(() => expect(setNextRead).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as { action?: { label: string; onPress: () => void } };
      expect(call.action?.label).toBe('Retry');
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(setNextRead).toHaveBeenCalledTimes(2));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows the finish panel only after a finish in this session', async () => {
    const reading = [baseRead({ id: 'read-1', read_number: 1, outcome: 'reading' })];
    const finished = [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished' })];
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: reading, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
        allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(ui.queryByTestId('library-finish-panel')).toBeNull();
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      mockHistory.mockReturnValue(
        historyState({
          reads: { data: finished, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
          allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
        }),
      );
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookDetailScreen />
        </QueryClientProvider>,
      );
      expect(await ui.findByTestId('library-finish-panel')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('reread finish shows read #2, never read #1', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const before = [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished' }), baseRead({ id: 'read-2', read_number: 2, outcome: 'reading' })];
    const after = [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished' }), baseRead({ id: 'read-2', read_number: 2, outcome: 'finished' })];
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: before, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
        allReads: { data: after, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      mockHistory.mockReturnValue(
        historyState({
          reads: { data: after, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
          allReads: { data: after, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
        }),
      );
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookDetailScreen />
        </QueryClientProvider>,
      );
      expect(await ui.findByTestId('library-finish-panel')).toBeOnTheScreen();
      await waitFor(() =>
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.stringContaining('read-2'), '1'),
      );
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls.map((call: unknown[]) => String(call[0]));
      expect(calls.some((key: string) => key.includes('read-2'))).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a status restore shows no finish panel', async () => {
    const finished = [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished' })];
    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: finished, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
        allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      mockHistory.mockReturnValue(
        historyState({
          reads: { data: finished, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
          allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
        }),
      );
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookDetailScreen />
        </QueryClientProvider>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(ui.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('hides the finish panel while reads are refetching', async () => {
    const finished = [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished' })];
    const reading = [baseRead({ id: 'read-1', read_number: 1, outcome: 'reading' })];
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: reading, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
        allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      mockHistory.mockReturnValue(
        historyState({
          reads: { data: finished, isPending: false, isError: false, isFetching: true, refetch: jest.fn() },
          allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
        }),
      );
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookDetailScreen />
        </QueryClientProvider>,
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(ui.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows exactly one Your rating radiogroup with the panel shown (the panel itself has no stars)', async () => {
    const reading = [baseRead({ id: 'read-1', read_number: 1, outcome: 'reading' })];
    const finished = [baseRead({ id: 'read-1', read_number: 1, outcome: 'finished' })];
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: reading, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
        allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      mockHistory.mockReturnValue(
        historyState({
          reads: { data: finished, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
          allReads: { data: finished, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
        }),
      );
      ui.rerender(
        <QueryClientProvider client={ui.client}>
          <BookDetailScreen />
        </QueryClientProvider>,
      );
      await ui.findByTestId('library-finish-panel');
      // The top block always shows its stars; the Finished panel (SDD-09)
      // keeps everything except its own stars, so exactly one radiogroup
      // stays visible (SDD-07 §14.2b).
      expect(ui.getByTestId('book-rating-review')).toBeTruthy();
      expect(ui.queryByTestId('library-review-input')).toBeNull();
      expect(within(ui.getByTestId('library-finish-panel')).queryByLabelText('Your rating')).toBeNull();
      const ratings = ui.queryAllByLabelText('Your rating').filter(
        (node: { props: { accessibilityRole?: string } }) => node.props.accessibilityRole === 'radiogroup',
      );
      expect(ratings).toHaveLength(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
