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
import { useReadProgress } from '@/features/books/history/useReadProgress';

let mockOffline = false;
let mockUserBook: any;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
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
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: mockCanGoBack }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => {
    const { useAuthStore: store } = require('@/features/auth/store/authStore');
    const session = store((state: unknown) => (state as { session?: unknown }).session);
    return { user: (session as { user?: unknown } | null)?.user, session };
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
jest.mock('@/features/books/history/useReadProgress', () => ({
  useReadProgress: jest.fn(),
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

function openRead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'read-1',
    user_book_id: 'user-book-1',
    user_id: 'reader-1',
    read_number: 1,
    outcome: 'reading',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    started_on: '2026-10-01',
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: 320,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  };
}

function progressEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progress-1',
    read_id: 'read-1',
    user_id: 'reader-1',
    page: 142,
    percent: null,
    recorded_at: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

function historyState(reads: unknown[] = [openRead()]) {
  return {
    reads: { data: reads, isPending: false, isError: false, refetch: jest.fn() },
    editDates: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false, variables: undefined },
    removeRead: { mutateAsync: jest.fn().mockResolvedValue(true), isPending: false, variables: undefined },
    startReread: { mutateAsync: jest.fn().mockResolvedValue('read-2'), isPending: false },
    reopenRead: { mutateAsync: jest.fn().mockResolvedValue(undefined), isPending: false, variables: undefined },
  };
}

function progressState(entries: unknown[] = [progressEntry()]) {
  return {
    progress: { data: entries, isPending: false, isError: false, refetch: jest.fn() },
    addProgress: { mutateAsync: jest.fn().mockResolvedValue({ id: 'progress-2' }), isPending: false },
    setTotalPages: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
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
  mockCanGoBack.mockReturnValue(true);
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
});

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe('Unit 3a progress on Book Details', () => {
  it('shows the bar text, pace bars and Update button in Your reading after the primary', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(await ui.findByTestId('library-progress-bar-text')).toHaveTextContent('142 of 320 pages, 44%');
      expect(ui.getByTestId('library-progress-edge')).toBeOnTheScreen();
      expect(ui.getByTestId('library-progress-pace')).toBeOnTheScreen();
      expect(ui.getByTestId('library-progress-update')).toBeOnTheScreen();
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('hides progress when there is no open read', async () => {
    const finished = { ...openRead(), outcome: 'finished' };
    mockHistory.mockReturnValue(historyState([finished]));
    mockProgress.mockReturnValue({
      progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: jest.fn(), isPending: false },
      setTotalPages: { mutateAsync: jest.fn(), isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(ui.queryByTestId('library-progress-update')).toBeNull();
      expect(ui.queryByTestId('library-progress-edge')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Update opens the named sheet and a failed save shows Retry which re-runs', async () => {
    const addProgress = jest
      .fn()
      .mockRejectedValueOnce(new Error('progress down'))
      .mockResolvedValue({ id: 'progress-2' });
    mockProgress.mockReturnValue({
      progress: { data: [progressEntry()], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      const dialog = await waitFor(() =>
        ui.UNSAFE_root.find(
          (node: unknown) =>
            typeof node === 'object' &&
            node !== null &&
            (node as { type?: unknown }).type === 'View' &&
            (node as { props?: { accessibilityViewIsModal?: boolean } }).props?.accessibilityViewIsModal === true &&
            (node as { props?: { accessibilityLabel?: string } }).props?.accessibilityLabel === 'Update progress',
        ),
      );
      expect(dialog).toBeTruthy();
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      expect(addProgress).toHaveBeenCalledWith({ page: 142 });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as { kind: string; message: string; action?: { label: string; onPress: () => void } };
      expect(call).toMatchObject({ kind: 'error', message: 'progress down' });
      expect(call.action?.label).toBe('Retry');
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(2));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a progress load failure shows Try again', async () => {
    const refetch = jest.fn();
    mockProgress.mockReturnValue({
      progress: { data: undefined, isPending: false, isError: true, refetch },
      addProgress: { mutateAsync: jest.fn(), isPending: false },
      setTotalPages: { mutateAsync: jest.fn(), isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByText("Couldn't load your progress.");
      fireEvent.press(await ui.findByTestId('library-progress-retry'));
      expect(refetch).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('offline disables Save in the sheet', async () => {
    mockOffline = true;
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      expect((await ui.findByTestId('library-progress-save')).props.accessibilityState.disabled).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('double-tapping the progress Retry sends one request', async () => {
    const addProgress = jest
      .fn()
      .mockRejectedValueOnce(new Error('progress down'))
      .mockImplementation(() => new Promise<unknown>(() => {}));
    mockProgress.mockReturnValue({
      progress: { data: [progressEntry()], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as { action?: { label: string; onPress: () => void } };
      await act(async () => {
        call.action?.onPress();
        call.action?.onPress();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(addProgress).toHaveBeenCalledTimes(2);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('hides the estimate when a step moves back even with net gain', async () => {
    const backward = [
      progressEntry({ id: 'a', page: 10, recorded_at: '2026-10-08T12:00:00.000Z' }),
      progressEntry({ id: 'b', page: 30, recorded_at: '2026-10-09T12:00:00.000Z' }),
      progressEntry({ id: 'c', page: 20, recorded_at: '2026-10-10T08:00:00.000Z' }),
      progressEntry({ id: 'd', page: 40, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    mockProgress.mockReturnValue({
      progress: { data: backward, isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
      setTotalPages: { mutateAsync: jest.fn().mockResolvedValue({}), isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(await ui.findByTestId('library-progress-pace')).toBeOnTheScreen();
      expect(ui.queryByTestId('library-progress-estimate')).toBeNull();
      expect(ui.getByTestId('library-progress-pace-text')).toHaveTextContent(
        /Pages per day, last 14 days:/,
      );
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('uses an earlier total as the default and persists it once on the first progress save', async () => {
    const earlier = openRead({ id: 'read-1', read_number: 1, total_pages: 400, outcome: 'finished' });
    const open = openRead({ id: 'read-2', read_number: 2, total_pages: null });
    mockHistory.mockReturnValue(historyState([earlier, open]));
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    const setTotalPages = jest.fn().mockResolvedValue({ ...open, total_pages: 400 });
    mockProgress.mockReturnValue({
      progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: setTotalPages, isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent('Page 0 of 400');
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(setTotalPages).toHaveBeenCalledTimes(1));
      expect(setTotalPages).toHaveBeenCalledWith(400);
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not persist a fallback when the open read already has a total', async () => {
    const earlier = openRead({ id: 'read-1', read_number: 1, total_pages: 400, outcome: 'finished' });
    const open = openRead({ id: 'read-2', read_number: 2, total_pages: 320 });
    mockHistory.mockReturnValue(historyState([earlier, open]));
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    const setTotalPages = jest.fn().mockResolvedValue({});
    mockProgress.mockReturnValue({
      progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: setTotalPages, isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent('Page 0 of 320');
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      expect(setTotalPages).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not persist when no earlier total exists', async () => {
    const open = openRead({ id: 'read-1', read_number: 1, total_pages: null });
    mockHistory.mockReturnValue(historyState([open]));
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    const setTotalPages = jest.fn().mockResolvedValue({});
    mockProgress.mockReturnValue({
      progress: { data: [], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: setTotalPages, isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      expect(setTotalPages).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not persist a fallback on later saves when progress already exists', async () => {
    const earlier = openRead({ id: 'read-1', read_number: 1, total_pages: 400, outcome: 'finished' });
    const open = openRead({ id: 'read-2', read_number: 2, total_pages: null });
    mockHistory.mockReturnValue(historyState([earlier, open]));
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    const setTotalPages = jest.fn().mockResolvedValue({});
    mockProgress.mockReturnValue({
      progress: { data: [progressEntry({ read_id: 'read-2' })], isPending: false, isError: false, refetch: jest.fn() },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: setTotalPages, isPending: false },
    });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(await ui.findByTestId('library-progress-update'));
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent(/of 400/);
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      expect(setTotalPages).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
