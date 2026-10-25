import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import LibraryStatsScreen from '../stats';
import { useAuthStore } from '@/features/auth/store/authStore';
import { booksService } from '@/features/books/services/booksService';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';
import { useReadProgress } from '@/features/books/history/useReadProgress';
import { useReadingStats } from '@/features/books/history/useReadingStats';
import { useReadingGoal } from '@/features/books/history/useReadingGoal';

jest.setTimeout(20000);

const mockNotify = jest.fn();
const mockHistory = useBookReadingHistory as jest.Mock;
const mockProgress = useReadProgress as jest.Mock;
const statsHook = useReadingStats as jest.Mock;
const goalHook = useReadingGoal as jest.Mock;
let mockOffline = false;
let mockUserBook: any;
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});
jest.mock('expo-router', () => ({
  useFocusEffect: jest.fn(),
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
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
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
jest.mock('@/features/books/history/useReadingStats', () => ({ useReadingStats: jest.fn() }));
jest.mock('@/features/books/history/useReadingGoal', () => ({ useReadingGoal: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

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

function openRead(overrides: Record<string, unknown> = {}) {
  return baseRead({ outcome: 'reading', ended_on: null, ...overrides });
}

function historyState(overrides: Record<string, unknown> = {}) {
  return {
    reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    editDates: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false, variables: undefined },
    removeRead: { mutateAsync: jest.fn().mockResolvedValue(true), isPending: false, variables: undefined },
    startReread: { mutateAsync: jest.fn().mockResolvedValue('read-2'), isPending: false },
    reopenRead: { mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false, variables: undefined },
    setNextRead: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    settings: { data: null, isError: false, refetch: jest.fn() },
    allReads: { data: [], isSuccess: true },
    ...(overrides as Record<string, unknown>),
  };
}

function progressState(overrides: Record<string, unknown> = {}) {
  return {
    progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    addProgress: { mutateAsync: jest.fn().mockResolvedValue({ id: 'progress-2' }), isPending: false },
    setTotalPages: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    ...(overrides as Record<string, unknown>),
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
    reading_status: 'reading',
    ownership: 'owned',
    condition: 'good',
    available_for_lending: false,
    book: {
      title: 'Walden',
      authors: ['Henry David Thoreau'],
      cover_url: null,
      page_count: 357,
      publisher: 'Ticknor and Fields',
      published_date: '1854-08-09',
      isbn_13: '9780140390445',
      description: 'Life in the woods.',
    },
    ...overrides,
  };
}

function renderDetail() {
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

function successCalls() {
  return mockNotify.mock.calls.filter(([input]) => input?.kind === 'success');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  useAuthStore.setState({
    session: { user: { id: 'reader-1' }, access_token: 'token-reader-1' } as never,
    status: 'authenticated',
  });
  mockUserBook = makeBook();
  (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
  (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
  (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
  (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
  mockHistory.mockReturnValue(historyState());
  mockProgress.mockReturnValue(progressState());
  jest.spyOn(bookReviewService, 'update').mockImplementation(async (_actor, entryId, patch) => {
    mockUserBook = { ...mockUserBook, ...patch };
    const { rating, review, review_is_public } = mockUserBook;
    return { id: entryId, user_id: 'reader-1', rating, review, review_is_public };
  });
  statsHook.mockReturnValue({
    reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    quotes: { data: [], isPending: false, isError: false, refetch: jest.fn() },
  });
  goalHook.mockReturnValue({
    goal: { data: null, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
    reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    setGoal: { mutateAsync: jest.fn().mockResolvedValue(null), isPending: false },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe('Book Details save confirmations', () => {
  it('Dates saved shows once after an edit-dates save', async () => {
    const editDates = jest.fn().mockResolvedValue({ id: 'read-1' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: [baseRead()], isPending: false, isError: false, refetch: jest.fn() },
        editDates: { mutateAsync: editDates, isPending: false, variables: undefined },
      }),
    );
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-reading-dates-edit'));
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      await waitFor(() => expect(editDates).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Dates saved' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('no success toast when the dates save fails', async () => {
    const editDates = jest.fn().mockRejectedValue(new Error('history down'));
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: [baseRead()], isPending: false, isError: false, refetch: jest.fn() },
        editDates: { mutateAsync: editDates, isPending: false, variables: undefined },
      }),
    );
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-reading-dates-edit'));
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Read removed shows once', async () => {
    const removeRead = jest.fn().mockResolvedValue(true);
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(
      historyState({
        reads: {
          data: [
            baseRead({ id: 'old', read_number: 1, outcome: 'finished' }),
            baseRead({ id: 'read-1', read_number: 2, outcome: 'finished' }),
          ],
          isPending: false,
          isError: false,
          refetch: jest.fn(),
        },
        removeRead: { mutateAsync: removeRead, isPending: false, variables: undefined },
      }),
    );
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-reading-dates-edit'));
      fireEvent.press(await ui.findByTestId('library-read-remove-old'));
      await waitFor(() => expect(removeRead).toHaveBeenCalledWith('old'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Read removed' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Read reopened shows once', async () => {
    const reopenRead = jest.fn().mockResolvedValue(undefined);
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: [baseRead({ outcome: 'finished' })], isPending: false, isError: false, refetch: jest.fn() },
        reopenRead: { mutateAsync: reopenRead, isPending: false, variables: undefined },
      }),
    );
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-reading-dates-edit'));
      fireEvent.press(await ui.findByTestId('library-read-reopen-read-1'));
      await waitFor(() => expect(reopenRead).toHaveBeenCalledWith('read-1'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Read reopened' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Reading again shows once and no success on failure', async () => {
    const startReread = jest.fn().mockResolvedValue('read-2');
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(historyState({ startReread: { mutateAsync: startReread, isPending: false } }));
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-read-again'));
      await waitFor(() => expect(startReread).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Reading again' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
    const failing = jest.fn().mockRejectedValue(new Error('reread down'));
    mockHistory.mockReturnValue(historyState({ startReread: { mutateAsync: failing, isPending: false } }));
    const ui2 = renderDetail();
    try {
      await ui2.findByText('Walden');
      fireEvent.press(await ui2.findByTestId('library-read-again'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('Next read set and removed show once', async () => {
    const setNextRead = jest.fn().mockResolvedValue({});
    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    mockHistory.mockReturnValue(
      historyState({
        setNextRead: { mutateAsync: setNextRead, isPending: false },
        settings: { data: null, isError: false, refetch: jest.fn() },
      }),
    );
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-next-read-make'));
      await waitFor(() => expect(setNextRead).toHaveBeenCalledWith('user-book-1'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Next read set' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
    const remove = jest.fn().mockResolvedValue({});
    mockHistory.mockReturnValue(
      historyState({
        setNextRead: { mutateAsync: remove, isPending: false },
        settings: {
          data: { user_id: 'reader-1', next_read_user_book_id: 'user-book-1', updated_at: '2026-10-01T00:00:00.000Z' },
          isError: false,
          refetch: jest.fn(),
        },
      }),
    );
    const ui2 = renderDetail();
    try {
      await ui2.findByText('Walden');
      fireEvent.press(await ui2.findByTestId('library-next-read-remove'));
      await waitFor(() => expect(remove).toHaveBeenCalledWith(null));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Next read removed' });
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('Progress saved and Total pages saved show once', async () => {
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    mockHistory.mockReturnValue(historyState({ reads: { data: [openRead()], isPending: false, isError: false, refetch: jest.fn() } }));
    mockProgress.mockReturnValue({
      progress: {
        data: [{ id: 'p1', read_id: 'read-1', user_id: 'reader-1', page: 142, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' }],
        isPending: false,
        isError: false,
        refetch: jest.fn(),
      },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    });
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Progress saved' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
    const setTotal = jest.fn().mockResolvedValue({});
    mockHistory.mockReturnValue(historyState({ reads: { data: [openRead()], isPending: false, isError: false, refetch: jest.fn() } }));
    mockProgress.mockReturnValue({
      progress: {
        data: [{ id: 'p1', read_id: 'read-1', user_id: 'reader-1', page: 142, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' }],
        isPending: false,
        isError: false,
        refetch: jest.fn(),
      },
      addProgress: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
      setTotalPages: { mutateAsync: setTotal, isPending: false },
    });
    const ui2 = renderDetail();
    try {
      await ui2.findByText('Walden');
      fireEvent.press(await ui2.findByTestId('library-progress-update'));
      fireEvent.press(await ui2.findByTestId('library-progress-total-toggle'));
      fireEvent.changeText(await ui2.findByTestId('library-progress-total-input'), '400');
      fireEvent.press(ui2.getByTestId('library-progress-total-save'));
      await waitFor(() => expect(setTotal).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Total pages saved' });
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('status changes show Marked as Finished, Started reading and Stopped reading', async () => {
    mockUserBook = makeBook({ reading_status: 'reading' });
    mockHistory.mockReturnValue(historyState({ reads: { data: [openRead()], isPending: false, isError: false, refetch: jest.fn() } }));
    mockProgress.mockReturnValue(progressState({
      progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    }));
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'completed'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Marked as Finished' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
    mockHistory.mockReturnValue(historyState());
    mockProgress.mockReturnValue(progressState());
    const ui2 = renderDetail();
    try {
      await ui2.findByText('Walden');
      await act(async () => {});
      const radios = ui2.getAllByRole('radio');
      const reading = radios.find((r) => r.props.accessibilityLabel === 'Reading');
      expect(reading).toBeTruthy();
      fireEvent.press(reading!);
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'reading'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Started reading' });
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
    jest.clearAllMocks();
    mockUserBook = makeBook({ reading_status: 'reading' });
    (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
    mockHistory.mockReturnValue(historyState({ reads: { data: [openRead()], isPending: false, isError: false, refetch: jest.fn() } }));
    mockProgress.mockReturnValue(progressState());
    const ui3 = renderDetail();
    try {
      await ui3.findByText('Walden');
      fireEvent.press(await ui3.findByTestId('library-stop-reading'));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'want_to_read'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Stopped reading' });
    } finally {
      ui3.unmount();
      ui3.client.clear();
    }
  });

  it('completed to Want to read shows Moved to Want to read', async () => {
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(historyState());
    mockProgress.mockReturnValue(progressState());
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      const radios = ui.getAllByRole('radio');
      const want = radios.find((r) => r.props.accessibilityLabel === 'Want to read');
      expect(want).toBeTruthy();
      fireEvent.press(want!);
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'want_to_read'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Moved to Want to read' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('completed to Reading via the status control shows Started reading (not Reading again)', async () => {
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(historyState());
    mockProgress.mockReturnValue(progressState());
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      const radios = ui.getAllByRole('radio');
      const reading = radios.find((r) => r.props.accessibilityLabel === 'Reading');
      expect(reading).toBeTruthy();
      fireEvent.press(reading!);
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'reading'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Started reading' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('the Not sure quick action shows Dates marked unknown', async () => {
    const editDates = jest.fn().mockResolvedValue({ id: 'read-1' });
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(
      historyState({
        reads: {
          data: [
            baseRead({
              outcome: 'finished',
              started_at: null,
              started_on: null,
              ended_at: null,
              ended_on: null,
              start_unknown: false,
              end_unknown: false,
            }),
          ],
          isPending: false,
          isError: false,
          refetch: jest.fn(),
        },
        editDates: { mutateAsync: editDates, isPending: false, variables: undefined },
      }),
    );
    mockProgress.mockReturnValue(progressState());
    const ui = renderDetail();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-reading-dates-notsure'));
      await waitFor(() => expect(editDates).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Dates marked unknown' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('Stats goal confirmations', () => {
  function renderStats() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
    });
    const ui = render(
      <QueryClientProvider client={client}>
        <LibraryStatsScreen yearOverride={2026} timeZone="UTC" />
      </QueryClientProvider>,
    );
    return { client, ...ui };
  }

  it('Goal saved and Goal removed show once, failures show no success', async () => {
    const setGoal = jest.fn().mockResolvedValue({
      user_id: 'reader-1',
      year: 2026,
      target_books: 30,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    statsHook.mockReturnValue({
      reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      quotes: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    });
    goalHook.mockReturnValue({
      goal: { data: { user_id: 'reader-1', year: 2026, target_books: 24, updated_at: '2026-01-01T00:00:00.000Z' }, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      setGoal: { mutateAsync: setGoal, isPending: false },
    });
    const ui = renderStats();
    try {
      const input = await ui.findByTestId('library-stats-goal-input');
      fireEvent.changeText(input, '30');
      fireEvent.press(ui.getByTestId('library-stats-goal-save'));
      await waitFor(() => expect(setGoal).toHaveBeenCalledWith(30));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Goal saved' });
      fireEvent.press(ui.getByTestId('library-stats-goal-remove'));
      await waitFor(() => expect(setGoal).toHaveBeenCalledWith(null));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(2));
      expect(successCalls()[1][0]).toMatchObject({ kind: 'success', message: 'Goal removed' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    const failing = jest.fn().mockRejectedValue(new Error('down'));
    statsHook.mockReturnValue({
      reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      quotes: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    });
    goalHook.mockReturnValue({
      goal: { data: null, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      setGoal: { mutateAsync: failing, isPending: false },
    });
    const ui2 = renderStats();
    try {
      const input = await ui2.findByTestId('library-stats-goal-input');
      fireEvent.changeText(input, '30');
      fireEvent.press(ui2.getByTestId('library-stats-goal-save'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });
});
