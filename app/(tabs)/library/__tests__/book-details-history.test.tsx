import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import { useAuthStore } from '@/features/auth/store/authStore';
import { booksService } from '@/features/books/services/booksService';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';

let mockOffline = false;
let mockUserBook: any;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNotify = jest.fn();
const mockHistory = useBookReadingHistory as jest.Mock;

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: mockCanGoBack }),
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
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteOperations: jest.fn() }));
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
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);

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
    reads: { data: [], isPending: false, isError: false, refetch: jest.fn() },
    editDates: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false, variables: undefined },
    removeRead: { mutateAsync: jest.fn().mockResolvedValue(true), isPending: false, variables: undefined },
    startReread: { mutateAsync: jest.fn().mockResolvedValue('read-2'), isPending: false },
    reopenRead: { mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false, variables: undefined },
    ...(overrides as Record<string, unknown>),
  };
}

function makeBook(overrides: any = {}) {
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

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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
  mockCanGoBack.mockReturnValue(true);
  useAuthStore.setState({
    session: { user: { id: 'reader-1' }, access_token: 'token-reader-1' } as any,
    status: 'authenticated',
  });
  mockUserBook = makeBook();
  (booksService.getBookDetails as jest.Mock).mockImplementation(async () => mockUserBook);
  (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
  (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
  (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
  mockHistory.mockReturnValue(historyState());
  jest.spyOn(bookReviewService, 'update').mockImplementation(async (_actor, entryId, patch) => {
    mockUserBook = { ...mockUserBook, ...patch };
    const { rating, review, review_is_public } = mockUserBook;
    return { id: entryId, user_id: 'reader-1', rating, review, review_is_public };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe('Unit 2a history slot on Book Details', () => {
  it('shows the slot text under the status control and opens the named edit dialog', async () => {
    mockHistory.mockReturnValue(
      historyState({ reads: { data: [baseRead()], isPending: false, isError: false, refetch: jest.fn() } }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(await ui.findByTestId('library-reading-dates-text')).toBeOnTheScreen();
      fireEvent.press(await ui.findByTestId('library-reading-dates-edit'));
      const dialog = await waitFor(() =>
        ui.UNSAFE_root.find(
          (node: any) => node.type === 'View' && node.props.accessibilityViewIsModal === true,
        ),
      );
      expect(dialog.props.accessibilityLabel).toBe('Edit reading dates');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows nothing from history while the reads are still loading', async () => {
    mockHistory.mockReturnValue(
      historyState({ reads: { data: undefined, isPending: true, isError: false, refetch: jest.fn() } }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await flush();
      expect(ui.queryByTestId('library-reading-dates-slot')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a status change invalidates the book reads query', async () => {
    mockHistory.mockReturnValue(
      historyState({ reads: { data: [baseRead()], isPending: false, isError: false, refetch: jest.fn() } }),
    );
    mockUserBook = makeBook({ reading_status: 'reading' });
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('library-reading-dates-text');
      const invalidate = jest.spyOn(ui.client, 'invalidateQueries');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      await waitFor(() => expect(ui.client.isMutating()).toBe(0));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['library-history-reads-book', 'reader-1', 'user-book-1'],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['library-history-reads-user', 'reader-1'],
      });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a failed dates save shows Retry which re-runs the same save', async () => {
    const editDates = jest
      .fn()
      .mockRejectedValueOnce(new Error('history down'))
      .mockResolvedValue({ id: 'read-1' });
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: [baseRead()], isPending: false, isError: false, refetch: jest.fn() },
        editDates: { mutateAsync: editDates, isPending: false, variables: undefined },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-reading-dates-edit'));
      fireEvent.press(await ui.findByTestId('library-read-start-unknown-read-1'));
      const save = ui.getByTestId('library-read-save-read-1');
      await waitFor(() => expect(save.props.accessibilityState.disabled).toBe(false));
      fireEvent.press(save);
      await waitFor(() => expect(editDates).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as { kind: string; message: string; action?: { label: string; onPress: () => void } };
      expect(call).toMatchObject({ kind: 'error', message: 'history down' });
      expect(call.action?.label).toBe('Retry');
      expect(editDates).toHaveBeenCalledWith({ readId: 'read-1', patch: expect.objectContaining({ start_unknown: true }) });
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(editDates).toHaveBeenCalledTimes(2));
      expect(editDates).toHaveBeenNthCalledWith(2, { readId: 'read-1', patch: expect.objectContaining({ start_unknown: true }) });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a reads load failure shows a quiet line with Try again', async () => {
    const refetch = jest.fn();
    mockHistory.mockReturnValue(
      historyState({ reads: { data: undefined, isPending: false, isError: true, refetch } }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByText("Couldn't load your reading dates.");
      fireEvent.press(await ui.findByTestId('library-reading-dates-retry'));
      expect(refetch).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('offline disables Edit dates', async () => {
    mockOffline = true;
    mockHistory.mockReturnValue(
      historyState({ reads: { data: [baseRead()], isPending: false, isError: false, refetch: jest.fn() } }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const edit = await ui.findByTestId('library-reading-dates-edit');
      expect(edit.props.accessibilityState.disabled).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('double tap on Read again sends one request', async () => {
    let calls = 0;
    const startReread = jest.fn(() => {
      calls += 1;
      return new Promise<string>((resolve) => setTimeout(() => resolve('read-2'), 20));
    });
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(historyState({ startReread: { mutateAsync: startReread, isPending: false } }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const button = await ui.findByTestId('library-read-again');
      act(() => {
        fireEvent.press(button);
        fireEvent.press(button);
      });
      expect(calls).toBe(1);
      await waitFor(() => expect(calls).toBe(1));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Read again is visible only when finished and calls startReread', async () => {
    const startReread = jest.fn().mockResolvedValue('read-2');
    mockUserBook = makeBook({ reading_status: 'completed' });
    mockHistory.mockReturnValue(historyState({ startReread: { mutateAsync: startReread, isPending: false } }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-read-again'));
      expect(startReread).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }

    mockUserBook = makeBook({ reading_status: 'reading' });
    const readingUi = renderScreen();
    try {
      await readingUi.findByText('Walden');
      await flush();
      expect(readingUi.queryByTestId('library-read-again')).toBeNull();
    } finally {
      readingUi.unmount();
      readingUi.client.clear();
    }

    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    const wishlistUi = renderScreen();
    try {
      await wishlistUi.findByText('Walden');
      await flush();
      expect(wishlistUi.queryByTestId('library-read-again')).toBeNull();
    } finally {
      wishlistUi.unmount();
      wishlistUi.client.clear();
    }
  });

  it('a failed Read again uses the library toast with Retry which re-runs', async () => {
    mockUserBook = makeBook({ reading_status: 'completed' });
    const startReread = jest
      .fn()
      .mockRejectedValueOnce(new Error('reread down'))
      .mockResolvedValue('read-2');
    mockHistory.mockReturnValue(
      historyState({
        startReread: { mutateAsync: startReread, isPending: false },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-read-again'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as { kind: string; message: string; action?: { label: string; onPress: () => void } };
      expect(call).toMatchObject({ kind: 'error', message: 'reread down' });
      expect(call.action?.label).toBe('Retry');
      const before = startReread.mock.calls.length;
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(startReread.mock.calls.length).toBeGreaterThan(before));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Stop reading is visible only when reading and sets Want to read', async () => {
    mockUserBook = makeBook({ reading_status: 'reading' });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-stop-reading'));
      await waitFor(() =>
        expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'want_to_read'),
      );
    } finally {
      ui.unmount();
      ui.client.clear();
    }

    mockUserBook = makeBook({ reading_status: 'completed' });
    const finishedUi = renderScreen();
    try {
      await finishedUi.findByText('Walden');
      await flush();
      expect(finishedUi.queryByTestId('library-stop-reading')).toBeNull();
    } finally {
      finishedUi.unmount();
      finishedUi.client.clear();
    }
  });
});
