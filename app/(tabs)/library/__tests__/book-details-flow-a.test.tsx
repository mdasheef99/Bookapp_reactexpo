import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import BookDetailScreen from '../[bookId]';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useAuthStore } from '@/features/auth/store/authStore';
import { booksService } from '@/features/books/services/booksService';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { manualNotesGateway } from '@/features/books/notes/manualNotesGateway';
import { expectSinglePrimary } from '@/test-utils/bookSection';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';

const mockHistory = useBookReadingHistory as jest.Mock;

const PHASES = ['daylight', 'golden', 'midnight'] as const;
let mockPhase: (typeof PHASES)[number] = 'daylight';
let mockOffline = false;
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNotify = jest.fn();

jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ bookId: 'user-book-1' }),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: mockCanGoBack }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: mockPhase, colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }) }));
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
      cover_url: 'https://example.com/cover.jpg',
      page_count: 357,
      publisher: 'Ticknor and Fields',
      isbn_13: null,
    },
    ...overrides,
  };
}

function makeNote(id: string, created_at: string, content = `Content ${id}`, tag: any = 'reflect', page_number: number | null = 31) {
  return { id, user_id: 'reader-1', user_book_id: 'user-book-1', content, tag, page_number, created_at, updated_at: null };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <BookDetailScreen />
    </QueryClientProvider>
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOffline = false;
  mockPhase = 'daylight';
  mockCanGoBack.mockReturnValue(true);
  useAuthStore.setState({ session: { user: { id: 'reader-1' }, access_token: 'token' } as any, status: 'authenticated' });
  (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([]);
  (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([]);
  (booksService.updateOwnership as jest.Mock).mockResolvedValue({});
  (booksService.updateCondition as jest.Mock).mockResolvedValue({});
  (booksService.toggleLendingAvailability as jest.Mock).mockResolvedValue({});
  (booksService.removeFromLibrary as jest.Mock).mockResolvedValue({});
  mockHistory.mockReturnValue(historyState());
});

afterEach(() => {
  useAuthStore.setState({ session: null, status: 'unauthenticated' });
});

describe.each(PHASES)('populated in %s', (phase) => {
  beforeEach(() => { mockPhase = phase; });

  it('renders header, h1, authors, Finished radio, Your notes h2, latest 2 and Add note', async () => {
    const colors = getLibraryAppearance(phase);
    const notes = [
      makeNote('n1', '2026-10-14T12:00:00Z', 'Newest passage', 'quote', 42),
      makeNote('n2', '2026-10-12T12:00:00Z', 'Middle passage', 'reflect', null),
      makeNote('n3', '2026-10-09T12:00:00Z', 'Oldest passage', 'question', 31),
    ];
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue(notes);
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.getByRole('button', { name: 'Back to Library' })).toBeTruthy();
      expect(ui.getByTestId('library-book-back-button')).toBeTruthy();
      const title = ui.getByText('Walden');
      expect(title.props.accessibilityRole).toBe('header');
      expect(ui.getByText('Henry David Thoreau')).toBeTruthy();
      const group = ui.getByLabelText('Reading status');
      expect(group.props.accessibilityRole).toBe('radiogroup');
      const radios = within(group).getAllByRole('radio');
      expect(radios).toHaveLength(3);
      expect(within(group).getByRole('radio', { name: 'Finished' })).toBeTruthy();
      expect(ui.queryByRole('radio', { name: 'Completed' })).toBeNull();
      const notesHeader = ui.getByText('Your notes');
      expect(notesHeader.props.accessibilityRole).toBe('header');
      expect(ui.getByText('3 notes')).toBeTruthy();
      const count = ui.getByText('3 notes');
      expect(StyleSheet.flatten(count.props.style)?.backgroundColor).toBeUndefined();
      let ancestor: any = count.parent;
      while (ancestor && ancestor.props?.testID !== 'book-notes-header') {
        expect(StyleSheet.flatten(ancestor.props?.style)?.backgroundColor).toBeUndefined();
        ancestor = ancestor.parent;
      }
      expect(ui.getByTestId('book-note-n1-meta')).toBeTruthy();
      expect(ui.getByTestId('book-note-n2-meta')).toBeTruthy();
      expect(ui.queryByTestId('book-note-n3-meta')).toBeNull();
      expect(ui.getByTestId('book-note-n1-body').props.children).toBe('“Newest passage”');
      expect(ui.getByRole('button', { name: 'Add note' })).toBeTruthy();
      const page = ui.UNSAFE_getAllByType(View).find((v: any) => {
        const s = StyleSheet.flatten(v.props.style);
        return s?.backgroundColor === colors.bgPrimary && s?.flex === 1;
      });
      expect(page).toBeTruthy();
      expect(ui.UNSAFE_queryAllByType('Image' as any)).toHaveLength(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('covers, counts and titles', () => {
  it('shows placeholder initials with coverPlaceholder and no remote placeholder image', async () => {
    const colors = getLibraryAppearance('daylight');
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook({ book: { title: 'Walden', authors: ['Henry David Thoreau'], cover_url: null } }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const placeholder = ui.getByTestId('book-cover-placeholder', { includeHiddenElements: true });
      expect(StyleSheet.flatten(placeholder.props.style).backgroundColor).toBe(colors.coverPlaceholder);
      expect(String(StyleSheet.flatten(placeholder.props.style).backgroundColor).toLowerCase()).not.toBe('#ffffff');
      expect(String(StyleSheet.flatten(placeholder.props.style).backgroundColor).toLowerCase()).not.toBe('white');
      expect(ui.getByText('W', { includeHiddenElements: true })).toBeTruthy();
      const images = ui.UNSAFE_queryAllByType('Image' as any);
      for (const img of images) {
        const uri = img.props.source?.uri as string | undefined;
        expect(uri == null || !uri.includes('placeholder')).toBe(true);
        expect(uri == null || uri.startsWith('https://example.com')).toBe(true);
      }
      expect(images).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('zero notes shows No notes yet with no count; 12 notes shows only 2 passages and 12 notes', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const zero = renderScreen();
    try {
      await zero.findByText('Walden');
      await zero.findByText('No notes yet.');
      expect(zero.queryByText('0 notes')).toBeNull();
      expect(zero.queryByText('1 note')).toBeNull();
    } finally {
      zero.unmount();
      zero.client.clear();
    }
    const many = Array.from({ length: 12 }, (_, i) => makeNote(`m${i}`, `2026-10-${String(14 - i).padStart(2, '0')}T12:00:00Z`, `Body ${i}`));
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue(many);
    const twelve = renderScreen();
    try {
      await twelve.findByText('Walden');
      await twelve.findByText('12 notes');
      expect(twelve.queryAllByTestId(/book-note-.*-meta/)).toHaveLength(2);
      expect(twelve.getByTestId('book-note-m0-meta')).toBeTruthy();
      expect(twelve.getByTestId('book-note-m1-meta')).toBeTruthy();
      expect(twelve.queryByTestId('book-note-m2-meta')).toBeNull();
    } finally {
      twelve.unmount();
      twelve.client.clear();
    }
  });

  it('long title renders fully with no numberOfLines', async () => {
    const longTitle = 'The Life and Opinions of Tristram Shandy, Gentleman';
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook({ book: { title: longTitle, authors: ['Laurence Sterne'], cover_url: null } }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      const title = await ui.findByText(longTitle);
      expect(title.props.numberOfLines).toBeUndefined();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('notes states', () => {
  it('shows loading notes with polite live region and no spinner for passages', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const loading = await ui.findByText('Loading notes…');
      expect(ui.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      expect(loading.props.accessibilityLiveRegion).toBe('polite');
      expect(ui.queryByText('No notes yet.')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('notes error without data shows Try again which refetches', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockRejectedValueOnce(new Error('notes down')).mockResolvedValue([makeNote('n1', '2026-10-14T12:00:00Z')]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByText("Couldn't load your notes.");
      const before = (manualNotesGateway.list as jest.Mock).mock.calls.length;
      fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect((manualNotesGateway.list as jest.Mock).mock.calls.length).toBeGreaterThan(before));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('notes error with data keeps passages and shows refresh line', async () => {
    const notes = [makeNote('n1', '2026-10-14T12:00:00Z', 'Kept', 'quote', 42)];
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue(notes);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-note-n1-meta');
      (manualNotesGateway.list as jest.Mock).mockRejectedValue(new Error('refresh failed'));
      await ui.client.invalidateQueries({ queryKey: ['notes', 'reader-1', 'user-book-1'] });
      await ui.findByText("Couldn't refresh notes.");
      expect(ui.getByTestId('book-note-n1-meta')).toBeTruthy();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('offline and refresh', () => {
  it('offline with cached book shows offline line, connection notice, disabled Add and radios', async () => {
    mockOffline = true;
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([makeNote('n1', '2026-10-14T12:00:00Z')]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      expect(ui.getByText('Offline · Showing saved content.')).toBeTruthy();
      expect(ui.getByTestId('book-connection-notice')).toBeTruthy();
      expect(ui.getByRole('button', { name: 'Add note' }).props.accessibilityState.disabled).toBe(true);
      const group = ui.getByLabelText('Reading status');
      for (const radio of within(group).getAllByRole('radio')) {
        expect(radio.props.accessibilityState.disabled).toBe(true);
      }
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('refresh failed keeps content with Couldn\u2019t refresh and Try again refetches', async () => {
    const book = makeBook();
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(book);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      (booksService.getBookDetails as jest.Mock).mockRejectedValue(new Error('refresh down'));
      await ui.client.invalidateQueries({ queryKey: ['book', 'reader-1', 'user-book-1'] });
      await ui.findByText("Couldn't refresh.");
      expect(ui.getByText('Walden')).toBeTruthy();
      const before = (booksService.getBookDetails as jest.Mock).mock.calls.length;
      fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect((booksService.getBookDetails as jest.Mock).mock.calls.length).toBeGreaterThan(before));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('first load states', () => {
  it('shows loading skeleton when first loading', async () => {
    (booksService.getBookDetails as jest.Mock).mockImplementation(() => new Promise(() => {}));
    (manualNotesGateway.list as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const ui = renderScreen();
    try {
      await ui.findByLabelText('Loading book');
      expect(ui.getByRole('button', { name: 'Back to Library' })).toBeTruthy();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('offline with no data shows offline BookError', async () => {
    mockOffline = true;
    (booksService.getBookDetails as jest.Mock).mockRejectedValue(new Error('offline down'));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      await ui.findByText("You're offline.");
      expect(ui.getByText('Reconnect to the internet to load this book, then try again.')).toBeTruthy();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('PGRST116 maps to not-found with Back to Library calling fallback', async () => {
    (booksService.getBookDetails as jest.Mock).mockRejectedValue({ code: 'PGRST116', message: 'no row' });
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      await ui.findByText("We can't find this book.");
      const backs = ui.getAllByRole('button', { name: 'Back to Library' });
      expect(backs.length).toBeGreaterThanOrEqual(1);
      fireEvent.press(backs[backs.length - 1]);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/library');
      expect(mockBack).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('generic error maps to server with Try again', async () => {
    (booksService.getBookDetails as jest.Mock).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      await ui.findByText("Couldn't load this book.");
      const before = (booksService.getBookDetails as jest.Mock).mock.calls.length;
      fireEvent.press(ui.getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect((booksService.getBookDetails as jest.Mock).mock.calls.length).toBeGreaterThan(before));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('no user yet shows loading never not-found', async () => {
    useAuthStore.setState({ session: null, status: 'unauthenticated' });
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const ui = renderScreen();
    try {
      await ui.findByLabelText('Loading book');
      expect(ui.queryByText("We can't find this book.")).toBeNull();
      expect(ui.queryByText('Book not found.')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('status writes', () => {
  it('pressing checked sends no request; pressing another sends exactly one', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook({ reading_status: 'reading' }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const group = ui.getByLabelText('Reading status');
      fireEvent.press(within(group).getByRole('radio', { name: 'Reading' }));
      expect(booksService.updateReadingStatus).not.toHaveBeenCalled();
      fireEvent.press(within(group).getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalledTimes(1));
      expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-1', 'completed');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('pending shows new value checked with busy+disabled; rejection restores and notifies once', async () => {
    let reject!: (e: Error) => void;
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook({ reading_status: 'reading' }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    (booksService.updateReadingStatus as jest.Mock).mockImplementation(() => new Promise((_, rej) => { reject = rej; }));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      const group = ui.getByLabelText('Reading status');
      fireEvent.press(within(group).getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(within(ui.getByLabelText('Reading status')).getByRole('radio', { name: 'Finished' }).props.accessibilityState.checked).toBe(true));
      expect(ui.getByLabelText('Reading status').props.accessibilityState.busy).toBe(true);
      expect(ui.getByLabelText('Reading status').props.accessibilityState.disabled).toBe(true);
      reject(new Error('status down'));
      await waitFor(() => expect(within(ui.getByLabelText('Reading status')).getByRole('radio', { name: 'Reading' }).props.accessibilityState.checked).toBe(true));
      expect(mockNotify).toHaveBeenCalledTimes(1);
      expect(mockNotify).toHaveBeenCalledWith({ kind: 'error', message: "Couldn't update reading status." });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('success does not notify', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook({ reading_status: 'reading' }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      fireEvent.press(within(ui.getByLabelText('Reading status')).getByRole('radio', { name: 'Finished' }));
      await waitFor(() => expect(booksService.updateReadingStatus).toHaveBeenCalled());
      await waitFor(() => expect(ui.client.isMutating()).toBe(0));
      expect(mockNotify).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});

describe('DP-03 single primary', () => {
  it.each(['populated', 'zero-notes', 'offline', 'refresh-failed'])('passes on %s', async (kind) => {
    if (kind === 'offline') mockOffline = true;
    const book = makeBook();
    if (kind === 'populated' || kind === 'zero-notes' || kind === 'offline') {
      (booksService.getBookDetails as jest.Mock).mockResolvedValue(book);
      (manualNotesGateway.list as jest.Mock).mockResolvedValue(kind === 'zero-notes' ? [] : [makeNote('n1', '2026-10-14T12:00:00Z')]);
    } else {
      (booksService.getBookDetails as jest.Mock).mockImplementationOnce(() => Promise.resolve(book)).mockRejectedValueOnce(new Error('refresh'));
      (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    }
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      if (kind === 'refresh-failed') {
        await ui.client.invalidateQueries({ queryKey: ['book', 'reader-1', 'user-book-1'] });
        await ui.findByText("Couldn't refresh.");
      }
      expectSinglePrimary(ui);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('whole-screen errors have exactly one primary', async () => {
    (booksService.getBookDetails as jest.Mock).mockRejectedValue(new Error('boom'));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([]);
    const server = renderScreen();
    try {
      await server.findByText("Couldn't load this book.");
      expectSinglePrimary(server);
    } finally {
      server.unmount();
      server.client.clear();
    }
    (booksService.getBookDetails as jest.Mock).mockRejectedValue({ code: 'PGRST116' });
    const missing = renderScreen();
    try {
      await missing.findByText("We can't find this book.");
      expectSinglePrimary(missing);
    } finally {
      missing.unmount();
      missing.client.clear();
    }
  });
});

// Focusable host elements in document order up to and including Add note; a radio group counts once.
function controlsUpToPrimary(ui: ReturnType<typeof renderScreen>) {
  const hosts = ui.UNSAFE_root.findAll((node: any) => typeof node.type === 'string' &&
    ['button', 'link', 'radio', 'switch', 'checkbox'].includes(node.props.accessibilityRole));
  const names: string[] = [];
  for (const node of hosts) {
    const name = node.props.accessibilityRole === 'radio' ? 'radiogroup' : String(node.props.accessibilityLabel);
    if (name === 'radiogroup' && names[names.length - 1] === 'radiogroup') continue;
    names.push(name);
    if (name === 'Add note') return names;
  }
  throw new Error('Add note not found');
}

describe('DP-01 focus order', () => {
  it('T6 keeps at most 4 controls before Add note when book and notes refetches both fail', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([makeNote('n1', '2026-10-14T12:00:00Z')]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-note-n1-meta');
      (booksService.getBookDetails as jest.Mock).mockRejectedValue(new Error('book refresh down'));
      (manualNotesGateway.list as jest.Mock).mockRejectedValue(new Error('notes refresh down'));
      await act(async () => {
        await Promise.all([
          ui.client.refetchQueries({ queryKey: ['book', 'reader-1', 'user-book-1'] }),
          ui.client.refetchQueries({ queryKey: ['notes', 'reader-1', 'user-book-1'] }),
        ]);
      });
      await ui.findByText("Couldn't refresh.");
      await ui.findByText("Couldn't refresh notes.");
      expect(ui.getByTestId('book-note-n1-meta')).toBeTruthy();
      const controls = controlsUpToPrimary(ui);
      expect(controls.length).toBeLessThanOrEqual(4);
      expect(controls).toEqual(['Back to Library', 'radiogroup', 'Try again', 'Add note']);
      expect(ui.getAllByRole('button', { name: 'Try again' })).toHaveLength(2);
    } finally { ui.unmount(); ui.client.clear(); }
  });

  it('populated has 3 focusables up to Add note: Back, status group, Add note', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([makeNote('n1', '2026-10-14T12:00:00Z')]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-note-n1-meta');
      expect(ui.getByText('‹ Library')).toBeTruthy();
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('notes error state has at most 4', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook());
    (manualNotesGateway.list as jest.Mock).mockRejectedValue(new Error('notes down'));
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByText("Couldn't load your notes.");
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Try again', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('keeps single primary and focus order up to Add note with all rows present and expanded', async () => {
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(
      makeBook({ review: 'First line', book: { ...makeBook().book, isbn_13: '9780000000001' } }),
    );
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([makeNote('n1', '2026-10-14T12:00:00Z')]);
    (userBookPagesService.getPagesForBook as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        user_id: 'reader-1',
        user_book_id: 'user-book-1',
        page_number: 10,
        content_excerpt: 'Saved excerpt',
        full_text: 'Saved excerpt',
        word_count: 2,
        created_at: '2026-10-14T12:00:00Z',
        updated_at: '2026-10-14T12:00:00Z',
      },
    ]);
    (booksService.getPublicReviewsForBook as jest.Mock).mockResolvedValue([
      {
        user_book_id: 'cr1',
        book_id: 'book-1',
        rating: 4,
        review: 'Great read',
        created_at: '2026-10-14T12:00:00Z',
        author: { user_id: 'u2', display_name: 'Reader Two', username: 'r2', avatar_url: null },
      },
    ]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('book-row-saved');
      await ui.findByRole('button', { name: 'Community reviews, 1 review' });
      expectSinglePrimary(ui);
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Add note']);

      for (const id of ['review', 'saved', 'info', 'ownership', 'community']) {
        fireEvent.press(ui.getByTestId(`book-row-${id}`));
      }
      expectSinglePrimary(ui);
      expect(controlsUpToPrimary(ui)).toEqual(['Back to Library', 'radiogroup', 'Add note']);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('history controls sit after Add note: slot text under status, buttons after primary, still at most 4', async () => {
    const read = {
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
    };
    mockHistory.mockReturnValue(
      historyState({ reads: { data: [read], isPending: false, isError: false, refetch: jest.fn() } }),
    );
    (booksService.getBookDetails as jest.Mock).mockResolvedValue(makeBook({ reading_status: 'completed' }));
    (manualNotesGateway.list as jest.Mock).mockResolvedValue([makeNote('n1', '2026-10-14T12:00:00Z')]);
    const ui = renderScreen();
    try {
      await ui.findByText('Walden');
      await ui.findByTestId('library-reading-dates-text');
      await ui.findByTestId('book-note-n1-meta');
      const controls = controlsUpToPrimary(ui);
      expect(controls.length).toBeLessThanOrEqual(4);
      expect(controls).toEqual(['Back to Library', 'radiogroup', 'Add note']);
      expect(ui.getByTestId('library-reading-dates-edit')).toBeTruthy();
      expect(ui.getByTestId('library-read-again')).toBeTruthy();
      expectSinglePrimary(ui);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
