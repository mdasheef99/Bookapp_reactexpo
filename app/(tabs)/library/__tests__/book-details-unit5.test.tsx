import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
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
  readingHistoryGateway: { userBookTitle: jest.fn(), setCountsInStats: jest.fn() },
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
    setCountsInStats: { mutateAsync: jest.fn().mockResolvedValue([]), isPending: false },
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
    reading_status: 'completed',
    ownership: 'owned',
    condition: 'good',
    available_for_lending: false,
    book: { title: 'Walden', authors: ['Henry David Thoreau'], cover_url: null, page_count: 357 },
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
  (readingHistoryGateway.setCountsInStats as unknown as jest.Mock).mockResolvedValue([]);
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

describe('Unit 5 on Book Details', () => {
  it('shows the leave-out switch and Reading stats link with reads, keeping the D07-23 control order', async () => {
    const reads = [baseRead()];
    mockHistory.mockReturnValue(
      historyState({
        reads: { data: reads, isPending: false, isError: false, isFetching: false, refetch: jest.fn() },
        allReads: { data: reads, isPending: false, isError: false, isSuccess: true, refetch: jest.fn() },
      }),
    );
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(await ui.findByTestId('library-leave-out-stats')).toBeOnTheScreen();
      expect(ui.getByTestId('library-leave-out-stats-switch')).toBeOnTheScreen();
      const link = await ui.findByTestId('library-reading-stats-link');
      expect(link).toBeOnTheScreen();
      fireEvent.press(link);
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/library/stats');
      // D07-23/D07-24: the review button sit before the primary.
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'Edit your rating and review', 'radiogroup', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('hides the leave-out switch and stats link with no reads', async () => {
    mockUserBook = makeBook({ reading_status: 'want_to_read' });
    mockHistory.mockReturnValue(historyState());
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.queryByTestId('library-leave-out-stats')).toBeNull();
      expect(ui.queryByTestId('library-reading-stats-link')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
