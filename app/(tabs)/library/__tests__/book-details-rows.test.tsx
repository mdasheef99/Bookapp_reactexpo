import React from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  isHiddenFromAccessibility,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import { BookButton } from '@/components/library/ui';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import { DetailRow } from '@/components/library/bookDetails/DetailRow';
import { useAuthStore } from '@/features/auth/store/authStore';
import { booksService } from '@/features/books/services/booksService';
import { bookReviewService } from '@/features/books/services/bookReviewService';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { expectSinglePrimary } from '@/test-utils/bookSection';

let mockOffline = false;
let mockUserBook: any;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNotify = jest.fn();
const mockConfirm = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
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
  userBookPagesService: {
    getPagesForBook: jest.fn(),
    deletePage: jest.fn(),
  },
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({ useNoteOperations: jest.fn() }));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({ manualNotesGateway: { list: jest.fn() } }));
jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: !mockOffline, isOffline: mockOffline }),
}));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: mockConfirm }),
}));
jest.mock('@/features/books/history/useBookReadingHistory', () => ({
  useBookReadingHistory: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock('@react-native-community/datetimepicker', () => () => null);

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
  const baseBook = {
    title: 'Walden',
    authors: ['Henry David Thoreau'],
    cover_url: 'https://example.com/cover.jpg',
    page_count: 357,
    publisher: 'Ticknor and Fields',
    published_date: '1854-08-09',
    isbn_13: '9780140390445',
    description: 'Life in the woods.',
  };
  return {
    id: 'user-book-1',
    user_id: 'reader-1',
    book_id: 'book-1',
    rating: 3,
    review: 'First line of review\nSecond line of review',
    review_is_public: true,
    reading_status: 'reading',
    ownership: 'owned',
    condition: 'good',
    available_for_lending: false,
    ...overrides,
    book: overrides.book ? { ...baseBook, ...overrides.book } : baseBook,
  };
}

function makeNote(id: string, created_at = '2026-10-14T12:00:00Z') {
  return {
    id,
    user_id: 'reader-1',
    user_book_id: 'user-book-1',
    content: `Note ${id}`,
    tag: 'reflect' as const,
    page_number: 12,
    created_at,
    updated_at: null,
  };
}

function makePage(id: string, page_number: number, content_excerpt = `Excerpt ${page_number}`) {
  return {
    id,
    user_id: 'reader-1',
    user_book_id: 'user-book-1',
    page_number,
    content_excerpt,
    full_text: content_excerpt,
    word_count: 4,
    created_at: '2026-10-14T12:00:00Z',
    updated_at: '2026-10-14T12:00:00Z',
  };
}

// Mutations call their mutationFn after a tick; flush before asserting a write did NOT happen.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookDetailScreen />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

function controlsUpToPrimary(ui: ReturnType<typeof renderScreen>) {
  const hosts = ui.UNSAFE_root.findAll(
    (node: any) =>
      typeof node.type === 'string' &&
      ['button', 'link', 'radio', 'switch', 'checkbox'].includes(node.props.accessibilityRole),
  );
  const names: string[] = [];
  for (const node of hosts) {
    const name = node.props.accessibilityRole === 'radio' ? 'radiogroup' : String(node.props.accessibilityLabel);
    if (name === 'radiogroup' && names[names.length - 1] === 'radiogroup') continue;
    names.push(name);
    if (name === 'Add note') return names;
  }
  throw new Error('Add note not found');
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
  (manualNotesGateway.list as jest.Mock).mockResolvedValue([makeNote('n1')]);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([makePage('p1', 42, 'Saved line 1\nSaved line 2')]);
  (booksService.updateOwnership as jest.Mock).mockResolvedValue({});
  (booksService.updateCondition as jest.Mock).mockResolvedValue({});
  (booksService.removeFromLibrary as jest.Mock).mockResolvedValue({});
  const { useBookReadingHistory } = require('@/features/books/history/useBookReadingHistory');
  (useBookReadingHistory as jest.Mock).mockReturnValue(historyState());
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

describe('1. Rating block position and row order', () => {
  it('renders the rating block after the cover and before the status selector', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-rating-review');
      const seen: string[] = [];
      ui.UNSAFE_root.findAll((node: any) => {
        if (typeof node.type !== 'string') return false;
        if (node.props.testID === 'book-cover-row') seen.push('cover');
        else if (node.props.testID === 'book-rating-review') seen.push('block');
        else if (node.props.accessibilityLabel === 'Reading status') seen.push('status');
        return false;
      });
      expect(seen).toEqual(['cover', 'block', 'status']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('has no lower review row', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.queryByTestId('book-row-review')).toBeNull();
      expect(ui.getByTestId('book-rating-review')).toBeTruthy();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('renders rows in exact order after Add note, then Remove from library', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-row-saved');
      const orderIds: string[] = [];
      for (const node of ui.UNSAFE_root.findAll((n: any) => typeof n.type === 'string')) {
        if (node.props.accessibilityLabel === 'Add note' && node.props.accessibilityRole === 'button') {
          orderIds.push('add-note');
        } else if (typeof node.props.testID === 'string' && node.props.testID.startsWith('book-row-')) {
          orderIds.push(node.props.testID);
        } else if (node.props.accessibilityLabel === 'Remove from library' && node.props.accessibilityRole === 'button') {
          orderIds.push('remove');
        }
      }
      expect(orderIds).toEqual([
        'add-note',
        'book-row-notes',
        'book-row-saved',
        'book-row-info',
        'book-row-ownership',
        'book-row-community',
        'remove',
      ]);

      const notesLink = ui.getByRole('link', { name: 'All notes' });
      fireEvent.press(notesLink);
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/library/notes',
        params: { userBookId: 'user-book-1' },
      });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('hides All notes at 0 notes and while loading; hides Saved pages at 0 pages and while loading; shows 1 page / 3 pages collapsed', async () => {
    (manualNotesGateway.list as jest.Mock).mockImplementation(() => new Promise(() => {}));
    (userBookPagesService.getPagesForBook as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const loadingUi = renderScreen();
    try {
      await loadingUi.findByText('Walden');
      expect(loadingUi.queryByTestId('book-row-notes')).toBeNull();
      expect(loadingUi.queryByTestId('book-row-saved')).toBeNull();
    } finally {
      loadingUi.unmount();
      loadingUi.client.clear();
    }

    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
    const emptyUi = renderScreen();
    try {
      await emptyUi.findByText('Walden');
      await emptyUi.findByText('No notes yet.');
      expect(emptyUi.queryByTestId('book-row-notes')).toBeNull();
      expect(emptyUi.queryByTestId('book-row-saved')).toBeNull();
    } finally {
      emptyUi.unmount();
      emptyUi.client.clear();
    }

    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([makePage('p1', 10)]);
    const onePageUi = renderScreen();
    try {
      await onePageUi.findByText('Walden');
      const savedRow = await onePageUi.findByRole('button', { name: 'Saved pages, 1 page' });
      expect(savedRow.props.accessibilityState.expanded).toBe(false);
    } finally {
      onePageUi.unmount();
      onePageUi.client.clear();
    }

    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([
      makePage('p1', 10),
      makePage('p2', 20),
      makePage('p3', 30),
    ]);
    const threePagesUi = renderScreen();
    try {
      await threePagesUi.findByText('Walden');
      const savedRow = await threePagesUi.findByRole('button', { name: 'Saved pages, 3 pages' });
      expect(savedRow.props.accessibilityState.expanded).toBe(false);
    } finally {
      threePagesUi.unmount();
      threePagesUi.client.clear();
    }
  });
});

describe('2. Plain rows', () => {
  it('has no backgroundColor on any book-row-*, minHeight >= 56, and saved/info/ownership disclose independently', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-row-saved');
      const rows = ui.getAllByTestId(/^book-row-/);
      expect(rows.length).toBe(5);

      for (const row of rows) {
        const flat = StyleSheet.flatten(row.props.style);
        expect(flat.backgroundColor).toBeUndefined();
        expect(flat.minHeight).toBeGreaterThanOrEqual(56);
      }
      // DetailRow containers stay plain as well.
      for (const row of rows) {
        let ancestor = row.parent;
        let depth = 0;
        while (ancestor && ancestor.type !== DetailRow && depth < 2) {
          expect(StyleSheet.flatten(ancestor.props?.style)?.backgroundColor).toBeUndefined();
          ancestor = ancestor.parent;
          depth += 1;
        }
      }

      // The lower review row is gone (SDD-07 §14.2b); the top block owns the review entry.
      expect(ui.queryByTestId('book-row-review')).toBeNull();
      expect(ui.getByTestId('book-rating-review')).toBeTruthy();

      for (const id of ['saved', 'info', 'ownership'] as const) {
        expect(ui.getByTestId(`book-row-${id}`).props.accessibilityState.expanded).toBe(false);
        fireEvent.press(ui.getByTestId(`book-row-${id}`));
        expect(ui.getByTestId(`book-row-${id}`).props.accessibilityState.expanded).toBe(true);
      }
      for (const id of ['saved', 'info', 'ownership'] as const) {
        expect(ui.getByTestId(`book-row-${id}`).props.accessibilityState.expanded).toBe(true);
      }
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('3. Rating + review block at the top (SDD-07 §14.2b)', () => {
  const colors = getLibraryAppearance('daylight');

  it('always shows stars and the quote plus Private with no inline editor', async () => {
    mockUserBook = makeBook({ review_is_public: false });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.queryByTestId('library-review-input')).toBeNull();
      expect(ui.queryByTestId('book-row-review')).toBeNull();
      expect(ui.queryByText(/unsaved/i)).toBeNull();
      expect(ui.queryByText(/Saving review changes/)).toBeNull();
      const block = ui.getByTestId('book-rating-review');
      expect(block).toBeTruthy();
      expect(ui.getByLabelText('Your rating')).toBeTruthy();
      expect(ui.getByRole('button', { name: 'Edit review' })).toBeTruthy();
      const quote = ui.getByTestId('library-review-quote');
      expect(quote.props.accessibilityLabel).toBe('Open your review, First line of review');
      expect(within(quote).getByText('First line of review')).toBeOnTheScreen();
      expect(within(quote).getByText('Private')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows "Write a review" with no quote when empty, and "Private" only when private', async () => {
    mockUserBook = makeBook({ review: null, review_is_public: true });
    const emptyUi = renderScreen();
    try {
      await emptyUi.findByText('Walden');
      expect(emptyUi.queryByTestId('library-review-quote')).toBeNull();
      expect(emptyUi.getByRole('button', { name: 'Write a review' })).toBeTruthy();
      expect(emptyUi.queryByText(/Private/)).toBeNull();
    } finally {
      emptyUi.unmount();
      emptyUi.client.clear();
    }

    mockUserBook = makeBook({ review: 'Solo line', review_is_public: true });
    const publicUi = renderScreen();
    try {
      await publicUi.findByText('Walden');
      expect(within(publicUi.getByTestId('library-review-quote')).getByText('Solo line')).toBeOnTheScreen();
      expect(publicUi.queryByText(/Private/)).toBeNull();
    } finally {
      publicUi.unmount();
      publicUi.client.clear();
    }
  });

  it('never shows a blank first line: whitespace-only review shows no quote', async () => {
    mockUserBook = makeBook({ review: '   \n  ', review_is_public: true });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.queryByTestId('library-review-quote')).toBeNull();
      expect(ui.getByRole('button', { name: 'Write a review' })).toBeTruthy();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows the first non-blank line when the review starts with blank lines', async () => {
    mockUserBook = makeBook({ review: '   \nSecond line here', review_is_public: false });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const quote = ui.getByTestId('library-review-quote');
      expect(within(quote).getByText('Second line here')).toBeOnTheScreen();
      expect(within(quote).getByText('Private')).toBeOnTheScreen();
      expect(ui.getByRole('button', { name: 'Edit review' })).toBeTruthy();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('tapping a star saves at once with "Rating saved" and leaves the text untouched', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const group = ui.getByLabelText('Your rating');
      const four = within(group).getByRole('radio', { name: '4 stars' });
      fireEvent.press(four);
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(1));
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ rating: 4 });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'success', message: 'Rating saved' }),
      );
      expect(mockUserBook.review).toBe('First line of review\nSecond line of review');
      expect(mockUserBook.review_is_public).toBe(true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('"Write a review" opens the review page with the bookId', async () => {
    mockUserBook = makeBook({ review: null });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('button', { name: 'Write a review' }));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/library/review',
        params: { bookId: 'user-book-1' },
      });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('"Edit review" opens the review page with the bookId', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('button', { name: 'Edit review' }));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/library/review',
        params: { bookId: 'user-book-1' },
      });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('4. No inline editing on Book Details (moved to the review page, SDD-07 §14.3)', () => {
  it('shows the top block with quote and button; quote press also opens the review page', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.queryByTestId('library-review-input')).toBeNull();
      expect(ui.queryByTestId('book-row-review')).toBeNull();
      expect(ui.queryByText(/unsaved/i)).toBeNull();
      expect(ui.queryByText(/Saving review changes/)).toBeNull();
      expect(bookReviewService.update).not.toHaveBeenCalled();
      fireEvent.press(ui.getByRole('button', { name: 'Edit review' }));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/library/review',
        params: { bookId: 'user-book-1' },
      });
      mockPush.mockClear();
      fireEvent.press(ui.getByTestId('library-review-quote'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(tabs)/library/review',
        params: { bookId: 'user-book-1' },
      });
      expect(bookReviewService.update).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('5. Ownership & condition', () => {
  it.each([
    ['owned', 'good', 'Owned · Good', true],
    ['lent_out', 'good', 'Lent out · Good', true],
    ['borrowed', 'good', 'Borrowed', false],
    ['wishlist', 'good', 'Wishlist', false],
  ] as const)(
    'shows "%s" + "%s" as "%s" and conditionPickerVisible=%s with no lending controls',
    async (ownership, condition, expectedSecondary, showConditionPicker) => {
      mockUserBook = makeBook({ ownership, condition, available_for_lending: true });
      const ui = renderScreen();
      try {
        await ui.findByText('Walden');
        const row = ui.getByRole('button', { name: `Ownership & condition, ${expectedSecondary}` });
        expect(row).toBeTruthy();
        fireEvent.press(row);
        expect(ui.getByText('Ownership')).toBeOnTheScreen();
        if (showConditionPicker) {
          expect(ui.getByText('Condition')).toBeOnTheScreen();
        } else {
          expect(ui.queryByText('Condition')).toBeNull();
        }
        expect(ui.queryByText(/lending|\blend\b/i)).toBeNull();
        expect(ui.queryByLabelText(/lending|\blend\b/i)).toBeNull();
      } finally {
        ui.unmount();
        ui.client.clear();
      }
    },
  );

  it('guards against same-value ownership/condition writes and notifies on error', async () => {
    mockUserBook = makeBook({ ownership: 'owned', condition: 'good' });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByTestId('book-row-ownership'));

      fireEvent.press(ui.getByText('Owned'));
      await flush();
      expect(booksService.updateOwnership).not.toHaveBeenCalled();

      fireEvent.press(ui.getByText('Good'));
      await flush();
      expect(booksService.updateCondition).not.toHaveBeenCalled();

      (booksService.updateOwnership as jest.Mock).mockRejectedValueOnce(new Error('db fail'));
      fireEvent.press(ui.getByText('Borrowed'));
      await waitFor(() => expect(booksService.updateOwnership).toHaveBeenCalledTimes(1));
      expect(booksService.updateOwnership).toHaveBeenCalledWith('user-book-1', 'borrowed');
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'error', message: "Couldn't update ownership." }),
      );
      expect(mockNotify).toHaveBeenCalledTimes(1);

      mockNotify.mockClear();
      (booksService.updateCondition as jest.Mock).mockRejectedValueOnce(new Error('cond fail'));
      fireEvent.press(ui.getByText('New'));
      await waitFor(() => expect(booksService.updateCondition).toHaveBeenCalledTimes(1));
      expect(booksService.updateCondition).toHaveBeenCalledWith('user-book-1', 'new');
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith({ kind: 'error', message: "Couldn't update condition." }),
      );
      expect(mockNotify).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('6. Community reviews', () => {
  it('renders loading, error, and empty community rows as non-interactive Views', async () => {
    (booksService.getPublicReviewsForBook as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const loadingUi = renderScreen();
    try {
      await loadingUi.findByText('Walden');
      const row = loadingUi.getByTestId('book-row-community');
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(row.props.onPress).toBeUndefined();
      expect(within(row).getByText('Loading…')).toBeOnTheScreen();
    } finally {
      loadingUi.unmount();
      loadingUi.client.clear();
    }

    (booksService.getPublicReviewsForBook as jest.Mock).mockRejectedValueOnce(new Error('failed'));
    const errorUi = renderScreen();
    try {
      await errorUi.findByText('Walden');
      await waitFor(() =>
        expect(within(errorUi.getByTestId('book-row-community')).getByText('Unavailable right now.')).toBeOnTheScreen(),
      );
      const row = errorUi.getByTestId('book-row-community');
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(row.props.onPress).toBeUndefined();
    } finally {
      errorUi.unmount();
      errorUi.client.clear();
    }

    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
    const emptyUi = renderScreen();
    try {
      await emptyUi.findByText('Walden');
      const row = emptyUi.getByTestId('book-row-community');
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(row.props.onPress).toBeUndefined();
      expect(within(row).getByText('None yet')).toBeOnTheScreen();
    } finally {
      emptyUi.unmount();
      emptyUi.client.clear();
    }
  });

  it('expands populated "2 reviews" row with names, @handles, dates, review text, "Rated 4 of 5" and zero ★ glyphs', async () => {
    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([
      {
        user_book_id: 'cr-1',
        book_id: 'book-1',
        rating: 4,
        review: 'Thoughtful reflection on solitude.',
        created_at: '2026-03-12T09:00:00Z',
        author: { user_id: 'u-2', display_name: 'Alice Walker', username: 'awalker', avatar_url: null },
      },
      {
        user_book_id: 'cr-2',
        book_id: 'book-1',
        rating: null,
        review: 'Quiet and observant.',
        created_at: '2026-03-10T09:00:00Z',
        author: { user_id: 'u-3', display_name: 'Ralph Emerson', username: null, avatar_url: null },
      },
    ]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const row = await ui.findByRole('button', { name: 'Community reviews, 2 reviews' });
      fireEvent.press(row);

      const expanded = within(ui.getByTestId('book-expanded-community'));
      expect(expanded.getByText('Alice Walker')).toBeOnTheScreen();
      expect(expanded.getByText('@awalker')).toBeOnTheScreen();
      expect(expanded.getByText('Thoughtful reflection on solitude.')).toBeOnTheScreen();
      expect(expanded.getByText('Ralph Emerson')).toBeOnTheScreen();
      expect(expanded.getByText('Quiet and observant.')).toBeOnTheScreen();
      expect(expanded.getByLabelText('Rated 4 of 5')).toBeOnTheScreen();
      for (const [id, stamp] of [['cr-1', '2026-03-12T09:00:00Z'], ['cr-2', '2026-03-10T09:00:00Z']]) {
        const date = new Date(stamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        expect(within(ui.getByTestId(`community-review-${id}`)).getByText(date)).toBeOnTheScreen();
      }

      for (const textNode of ui.UNSAFE_getAllByType(Text)) {
        const textContent = Array.isArray(textNode.props.children)
          ? textNode.props.children.join('')
          : String(textNode.props.children ?? '');
        expect(textContent).not.toContain('★');
      }
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('7. Book information', () => {
  it('renders only present fields and makes "No details" non-interactive when all fields are absent', async () => {
    mockUserBook = makeBook({
      book: {
        title: 'Walden',
        authors: ['Henry David Thoreau'],
        cover_url: null,
        page_count: 357,
        publisher: null,
        published_date: '1854-08-09',
        isbn_13: null,
        description: 'A classic work.',
      },
    });
    const partialUi = renderScreen();
    try {
      await partialUi.findByText('Walden');
      fireEvent.press(partialUi.getByTestId('book-row-info'));
      const info = within(partialUi.getByTestId('book-expanded-info'));
      expect(info.getByText('Pages · 357')).toBeOnTheScreen();
      expect(info.getByText('Published · 1854')).toBeOnTheScreen();
      expect(info.getByText('A classic work.')).toBeOnTheScreen();
      expect(info.queryByText(/Publisher ·/)).toBeNull();
      expect(info.queryByText(/ISBN-13 ·/)).toBeNull();
    } finally {
      partialUi.unmount();
      partialUi.client.clear();
    }

    mockUserBook = makeBook({
      book: {
        title: 'Walden',
        authors: ['Henry David Thoreau'],
        cover_url: null,
        page_count: null,
        publisher: null,
        published_date: null,
        isbn_13: null,
        description: null,
      },
    });
    const emptyInfoUi = renderScreen();
    try {
      await emptyInfoUi.findByText('Walden');
      const row = emptyInfoUi.getByTestId('book-row-info');
      expect(row.props.accessibilityRole).toBeUndefined();
      expect(row.props.onPress).toBeUndefined();
      expect(within(row).getByText('No details')).toBeOnTheScreen();
    } finally {
      emptyInfoUi.unmount();
      emptyInfoUi.client.clear();
    }
  });
});

describe('8. Remove from library', () => {
  it.each(['ios', 'web'] as const)('T3 returns focus to Remove from library on %s after Cancel', async os => {
    const previousOS = Platform.OS;
    Platform.OS = os;
    const nativeFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
    const findHandle = jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(42);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const trigger = ui.UNSAFE_getAllByType(View).find(node => node.props.accessibilityLabel === 'Remove from library')!.instance;
      const focus = jest.spyOn(trigger, 'focus');
      focus.mockClear();
      fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));
      nativeFocus.mockClear();
      findHandle.mockClear();
      fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
      if (os === 'ios') {
        expect(findHandle).toHaveBeenCalledWith(trigger);
        expect(nativeFocus).toHaveBeenCalledWith(42);
        expect(focus).not.toHaveBeenCalled();
      } else {
        expect(focus).toHaveBeenCalledTimes(1);
        expect(nativeFocus).not.toHaveBeenCalled();
        expect(findHandle).not.toHaveBeenCalled();
      }
      expect(ui.getByTestId('book-page').props.importantForAccessibility).toBe('auto');
    } finally { ui.unmount(); ui.client.clear(); Platform.OS = previousOS; }
  });

  it('opens D07-14 dialog, hides page behind, cancels without deleting, confirms once, and disables offline', async () => {
    const previousOS = Platform.OS;
    Platform.OS = 'web';
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));

      expect(ui.getByRole('header', { name: 'Remove “Walden” from your library?' })).toBeOnTheScreen();
      expect(
        ui.getByText(
          "Your notes, review, saved pages and reading history for this book will be deleted too. You can't undo this.",
        ),
      ).toBeOnTheScreen();

      const page = ui.getByTestId('book-page', { includeHiddenElements: true });
      expect(page.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(page.props['aria-hidden']).toBe(true);
      const pageInstance = ui
        .UNSAFE_getAllByType(View)
        .find((node) => node.props.testID === 'book-page')!.instance;
      expect(pageInstance.inert).toBe(true);

      const visibleButtons = ui
        .UNSAFE_queryAllByType(BookButton)
        .filter((instance) => !isHiddenFromAccessibility(instance));
      expect(visibleButtons.filter((b) => b.props.variant === 'destructive')).toHaveLength(1);
      expect(visibleButtons.filter((b) => b.props.variant === 'primary')).toHaveLength(0);

      fireEvent.press(ui.getByRole('button', { name: 'Cancel' }));
      expect(booksService.removeFromLibrary).not.toHaveBeenCalled();
      expect(ui.getByTestId('book-page').props['aria-hidden']).toBe(false);

      fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));
      expect(booksService.removeFromLibrary).not.toHaveBeenCalled();
      fireEvent.press(ui.getByRole('button', { name: 'Remove book' }));
      await waitFor(() => expect(booksService.removeFromLibrary).toHaveBeenCalledTimes(1));
      expect(booksService.removeFromLibrary).toHaveBeenCalledWith('user-book-1');
    } finally {
      Platform.OS = previousOS;
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('9. Offline disables all row writes while keeping rows expandable', () => {
  it('disables rating, review navigation, ownership, condition, saved-page delete, and Remove when offline', async () => {
    mockOffline = true;
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const savedRow = await ui.findByTestId('book-row-saved');

      const removeBtn = ui.getByRole('button', { name: 'Remove from library' });
      expect(removeBtn.props.accessibilityState.disabled).toBe(true);

      fireEvent.press(savedRow);
      fireEvent.press(ui.getByTestId('book-row-ownership'));

      // Rating block (SDD-07 §14.2b): stars and the text button are disabled offline with the existing caption.
      const openReview = ui.getByRole('button', { name: 'Edit review' });
      expect(openReview.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(openReview);
      expect(mockPush).not.toHaveBeenCalled();
      expect(bookReviewService.update).not.toHaveBeenCalled();

      const stars = within(ui.getByLabelText('Your rating')).getAllByRole('radio');
      expect(stars.length).toBe(5);
      fireEvent.press(stars[3]);
      expect(bookReviewService.update).not.toHaveBeenCalled();

      const deletePageBtn = ui.getByRole('button', { name: 'Delete page 42' });
      expect(deletePageBtn.props.accessibilityState.disabled).toBe(true);

      const touchables = ['Your rating', 'Ownership', 'Condition'].flatMap(label =>
        within(ui.getByLabelText(label)).getAllByRole('radio'),
      );
      expect(touchables.length).toBeGreaterThanOrEqual(14);
      for (const touchable of touchables) {
        expect(touchable.props.accessibilityState.disabled).toBe(true);
      }
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('10. DP-03 and DP-01 invariants with rows', () => {
  it('maintains single primary and focus order with rows collapsed and all rows expanded', async () => {
    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([
      {
        user_book_id: 'cr-1',
        book_id: 'book-1',
        rating: 4,
        review: 'Great book',
        created_at: '2026-03-12T09:00:00Z',
        author: { user_id: 'u-2', display_name: 'Reader Two', username: 'r2', avatar_url: null },
      },
    ]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-row-saved');
      await ui.findByRole('button', { name: 'Community reviews, 1 review' });

      expectSinglePrimary(ui);
      // D07-23: the top rating group, review button and quote sit before the
      // primary and may push the count past 4.
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Edit review', 'Open your review, First line of review', 'radiogroup', 'Add note']);

      for (const id of ['saved', 'info', 'ownership', 'community']) {
        fireEvent.press(ui.getByTestId(`book-row-${id}`));
      }
      expectSinglePrimary(ui);
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Edit review', 'Open your review, First line of review', 'radiogroup', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('history data present keeps the D07-23 control order up to Add note', async () => {
    const { useBookReadingHistory } = require('@/features/books/history/useBookReadingHistory');
    (useBookReadingHistory as jest.Mock).mockReturnValue(
      historyState({
        reads: {
          data: [
            {
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
            },
          ],
          isPending: false,
          isError: false,
          refetch: jest.fn(),
        },
      }),
    );
    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('library-reading-dates-text');
      await ui.findByTestId('book-row-saved');
      const controls = controlsUpToPrimary(ui);
      expect(controls).toEqual(['Back to Library', 'radiogroup', 'Edit review', 'Open your review, First line of review', 'radiogroup', 'Add note']);
      expect(ui.getByTestId('library-reading-dates-edit')).toBeTruthy();
      expectSinglePrimary(ui);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('11. Flow A choice radio integration (review rating always visible, §14.1)', () => {
  it.each([false, true])('shows rating inline and expands ownership and condition radio groups (offline=%s)', async offline => {
    mockOffline = offline;
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.getByLabelText('Your rating')).toBeTruthy();
      expect(ui.queryByLabelText('Ownership')).toBeNull();
      expect(ui.queryByLabelText('Condition')).toBeNull();
      fireEvent.press(ui.getByTestId('book-row-ownership'));
      for (const [name, count] of [['Your rating', 5], ['Ownership', 4], ['Condition', 5]] as const) {
        const group = ui.getByLabelText(name);
        expect(group.props.accessibilityRole).toBe('radiogroup');
        expect(group.props.accessibilityState.disabled).toBe(offline);
        const radios = within(group).getAllByRole('radio');
        expect(radios).toHaveLength(count);
        for (const radio of radios) {
          expect(radio.props.accessibilityState.disabled).toBe(offline);
        }
      }
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
// Fix-round regressions are separate from the brief A/B/C assertions above.
describe('Flow A fix round 2', () => {
  it('T1 settles a status write into its originating book after navigation', async () => {
    const params = jest.spyOn(require('expo-router'), 'useLocalSearchParams');
    params.mockReturnValue({ bookId: 'user-book-1' });
    let finish!: () => void;
    (booksService.updateReadingStatus as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      (booksService.getBookDetails as jest.Mock).mockImplementation(() => new Promise(() => {}));
      act(() => { void ui.client.refetchQueries({ queryKey: ['book', 'reader-1', 'user-book-1'] }); });
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'completed'));
      act(() => { ui.client.setQueryData(['book', 'reader-1', 'user-book-2'], makeBook({ id: 'user-book-2', book: { title: 'Dune' } })); });
      params.mockReturnValue({ bookId: 'user-book-2' });
      ui.rerender(<QueryClientProvider client={ui.client}><BookDetailScreen /></QueryClientProvider>);
      await ui.findByText('Dune');
      await act(async () => { finish(); });
      await waitFor(() => expect(ui.client.isMutating()).toBe(0));
      expect(ui.client.getQueryData<any>(['book', 'reader-1', 'user-book-1']).reading_status).toBe('completed');
      expect(ui.client.getQueryData<any>(['book', 'reader-1', 'user-book-2']).reading_status).toBe('reading');
      expect(ui.getByRole('radio', { name: 'Reading' }).props.accessibilityState.checked).toBe(true);
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it.each(['user', 'book'])('T1 ignores a late status error after the %s changes', async identity => {
    const params = jest.spyOn(require('expo-router'), 'useLocalSearchParams');
    params.mockReturnValue({ bookId: 'user-book-1' });
    let reject!: (error: Error) => void;
    (booksService.updateReadingStatus as jest.Mock).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      (booksService.getBookDetails as jest.Mock).mockImplementation(() => new Promise(() => {}));
      if (identity === 'user') {
        act(() => {
          ui.client.setQueryData(['book', 'reader-2', 'user-book-1'], makeBook({ user_id: 'reader-2' }));
          useAuthStore.setState({ session: { user: { id: 'reader-2' }, access_token: 'token-2' } as any });
        });
      } else {
        act(() => { ui.client.setQueryData(['book', 'reader-1', 'user-book-2'], makeBook({ id: 'user-book-2' })); });
        params.mockReturnValue({ bookId: 'user-book-2' });
        ui.rerender(<QueryClientProvider client={ui.client}><BookDetailScreen /></QueryClientProvider>);
      }
      await act(async () => { reject(new Error('old status write failed')); });
      await waitFor(() => expect(ui.client.isMutating()).toBe(0));
      expect(mockNotify).not.toHaveBeenCalled();
      expect(ui.getByRole('radio', { name: 'Reading' }).props.accessibilityState.checked).toBe(true);
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('T2 retries a rejected rating save on the next tap (text lives on the review page)', async () => {
    (bookReviewService.update as jest.Mock).mockRejectedValueOnce(new Error('review down'));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const four = within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' });
      fireEvent.press(four);
      await flush();
      await waitFor(() => expect(ui.client.isMutating()).toBe(0));
      expect(bookReviewService.update).toHaveBeenCalledTimes(1);
      expect((bookReviewService.update as jest.Mock).mock.calls[0][2]).toEqual({ rating: 4 });
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', message: 'review down' }),
      );
      fireEvent.press(four);
      await flush();
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalledTimes(2));
      expect(bookReviewService.update).toHaveBeenNthCalledWith(2, expect.anything(), 'user-book-1', { rating: 4 });
    } finally { ui.unmount(); ui.client.clear(); }
  });
});

describe('Flow A fix round 1', () => {
  function busyControl(host: ReturnType<ReturnType<typeof renderScreen>['getByRole']>) {
    // Native Pressable consumes aria-*; like radioControl, inspect the ancestor carrying the web prop.
    for (let node: typeof host | null = host; node; node = node.parent) {
      if (node.props['aria-busy'] !== undefined) return node;
    }
    throw new Error('Expected a control carrying aria-busy');
  }

  function rerenderScreen(ui: ReturnType<typeof renderScreen>) {
    ui.rerender(<QueryClientProvider client={ui.client}><BookDetailScreen /></QueryClientProvider>);
  }

  it.each(['pending', 'rejected'])('R1 keeps Finished checked after success with a %s refetch', async (refetch) => {
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue(undefined);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      (booksService.getBookDetails as jest.Mock).mockImplementation(() => refetch === 'pending'
        ? new Promise(() => {}) : Promise.reject(new Error('refresh down')));
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'completed'));
      await waitFor(() => expect(ui.client.isMutating()).toBe(0));
      expect(ui.getByRole('radio', { name: 'Finished' }).props.accessibilityState.checked).toBe(true);
      expect(ui.getByRole('radio', { name: 'Reading' }).props.accessibilityState.checked).toBe(false);
      expect(ui.client.getQueryData<any>(['book', 'reader-1', 'user-book-1']).reading_status).toBe('completed');
      if (refetch === 'rejected') await ui.findByText("Couldn't refresh.");
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it.each(['user', 'book'])('R1 resets pending optimistic status when the %s changes', async (identity) => {
    const params = jest.spyOn(require('expo-router'), 'useLocalSearchParams');
    params.mockReturnValue({ bookId: 'user-book-1' });
    (booksService.updateReadingStatus as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(ui.getByRole('radio', { name: 'Finished' }).props.accessibilityState.checked).toBe(true));
      if (identity === 'user') {
        ui.client.setQueryData(['book', 'reader-2', 'user-book-1'], makeBook({ user_id: 'reader-2' }));
        act(() => useAuthStore.setState({ session: { user: { id: 'reader-2' }, access_token: 'token-2' } as any }));
      } else {
        ui.client.setQueryData(['book', 'reader-1', 'user-book-2'], makeBook({ id: 'user-book-2' }));
        params.mockReturnValue({ bookId: 'user-book-2' });
        rerenderScreen(ui);
      }
      await waitFor(() => expect(ui.getByRole('radio', { name: 'Reading' }).props.accessibilityState.checked).toBe(true));
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('R2 offline rating tap sends no write; text drafts live on the review page', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.queryByTestId('library-review-input')).toBeNull();
      mockOffline = true;
      rerenderScreen(ui);
      // Review text has no inline editor; the offline text guarantee is asserted in review-page.test.tsx.
      expect(ui.queryByTestId('library-review-input')).toBeNull();
      const four = within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' });
      fireEvent.press(four);
      await flush();
      expect(bookReviewService.update).not.toHaveBeenCalled();
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('R3 preserves the populated community disclosure after a refetch error', async () => {
    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([
      { user_book_id: 'cr1', review: 'Keep this review', created_at: '2026-10-14', rating: 4,
        author: { display_name: 'Reader Two', username: 'r2' } },
      { user_book_id: 'cr2', review: 'Keep this too', created_at: '2026-10-14', rating: 3,
        author: { display_name: 'Reader Three', username: 'r3' } },
    ]);
    const ui = renderScreen();
    try {
      fireEvent.press(await ui.findByRole('button', { name: 'Community reviews, 2 reviews' }));
      (booksService.getPublicReviewsForBook as jest.Mock).mockRejectedValue(new Error('refresh down'));
      await act(async () => { await ui.client.refetchQueries({ queryKey: ['book-public-reviews', 'book-1'] }); });
      await flush();
      expect(ui.client.getQueryState(['book-public-reviews', 'book-1'])?.status).toBe('error');
      expect(ui.getByRole('button', { name: 'Community reviews, 2 reviews' })).toBeTruthy();
      expect(ui.getByText('Keep this review')).toBeTruthy();
      expect(ui.getByText('Keep this too')).toBeTruthy();
      expect(ui.queryByText('Unavailable right now.')).toBeNull();
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it.each(['offline', 'paused'])('R3 shows Unavailable offline for %s pending reviews without data', async (kind) => {
    const { onlineManager } = require('@tanstack/react-query');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(['book', 'reader-1', 'user-book-1'], makeBook());
    (booksService.getPublicReviewsForBook as jest.Mock).mockImplementation(() => new Promise(() => {}));
    mockOffline = kind === 'offline';
    if (kind === 'paused') onlineManager.setOnline(false);
    const ui = render(<QueryClientProvider client={client}><BookDetailScreen /></QueryClientProvider>);
    try {
      await ui.findByText('Unavailable offline.');
      expect(ui.queryByText('None yet')).toBeNull();
      expect(ui.queryByText('Loading…')).toBeNull();
      expect(ui.getByTestId('book-row-community').props.accessibilityRole).toBeUndefined();
      expect(StyleSheet.flatten(ui.getByText('Unavailable offline.').props.style).color).toBe(getLibraryAppearance('daylight').textSecondary);
      if (kind === 'paused') expect(client.getQueryState(['book-public-reviews', 'book-1'])?.fetchStatus).toBe('paused');
    } finally { ui.unmount(); client.clear(); onlineManager.setOnline(true); }
  });

  it('R4 disables an open Remove dialog offline and guards its screen callback', async () => {
    const { DeleteBookModal } = require('@/components/library/DeleteBookModal');
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('button', { name: 'Remove from library' }));
      mockOffline = true;
      rerenderScreen(ui);
      const remove = ui.getByRole('button', { name: 'Remove book' });
      expect(remove.props.accessibilityState.disabled).toBe(true);
      expect(ui.getByRole('button', { name: 'Cancel' }).props.accessibilityState.disabled).toBe(false);
      fireEvent.press(remove);
      await flush();
      expect(booksService.removeFromLibrary).not.toHaveBeenCalled();
      act(() => ui.UNSAFE_getByType(DeleteBookModal).props.onConfirm());
      await flush();
      expect(booksService.removeFromLibrary).not.toHaveBeenCalled();
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it.each([true, false])('R5 quote uses the serif passage style with a Private caption (public=%s)', async (isPublic) => {
    const { LIBRARY_TEXT } = require('@/components/library/LibraryTypography');
    mockUserBook = makeBook({ review_is_public: isPublic });
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const quote = ui.getByTestId('library-review-quote');
      expect(quote.props.accessibilityLabel).toBe('Open your review, First line of review');
      const passage = within(quote).getByText('First line of review');
      expect(passage.props.numberOfLines).toBe(2);
      expect(StyleSheet.flatten(passage.props.style)).toMatchObject({ ...LIBRARY_TEXT.bodySerif, color: getLibraryAppearance('daylight').textPrimary });
      if (isPublic) {
        expect(within(quote).queryByText('Private')).toBeNull();
      } else {
        const flag = within(quote).getByText('Private');
        expect(StyleSheet.flatten(flag.props.style)).toMatchObject({ ...LIBRARY_TEXT.caption });
      }
      const open = ui.getByRole('button', { name: 'Edit review' });
      expect(open.props.testID).toBe('library-review-open');
      expect(open.props.accessibilityState.disabled).toBe(false);
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('R6 exposes aria-busy on the status host during a pending write', async () => {
    (booksService.updateReadingStatus as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(ui.getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      const host = busyControl(ui.getByLabelText('Reading status'));
      expect(host.props['aria-busy']).toBe(true);
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('R6 has no inline busy caption on Book Details; saving state lives on the review page', async () => {
    (bookReviewService.update as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const four = within(ui.getByLabelText('Your rating')).getByRole('radio', { name: '4 stars' });
      fireEvent.press(four);
      await waitFor(() => expect(bookReviewService.update).toHaveBeenCalled());
      expect(ui.queryByText(/Saving review changes/)).toBeNull();
      expect(ui.queryByText(/unsaved/i)).toBeNull();
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('R10 announces the inline book refresh error politely', async () => {
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      (booksService.getBookDetails as jest.Mock).mockRejectedValue(new Error('refresh down'));
      await act(async () => { await ui.client.refetchQueries({ queryKey: ['book', 'reader-1', 'user-book-1'] }); });
      expect((await ui.findByText("Couldn't refresh.")).props.accessibilityLiveRegion).toBe('polite');
    } finally { ui.unmount(); ui.client.clear(); }
  });
});
