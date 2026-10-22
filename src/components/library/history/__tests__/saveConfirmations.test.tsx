import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react-native';
import { LeaveOutStatsSwitch } from '../LeaveOutStatsSwitch';
import { NoteProgressPrompt } from '../NoteProgressPrompt';
import { ContinueReadingCard } from '../ContinueReadingCard';
import { LibraryBookQuickLook } from '../../LibraryBookQuickLook';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { booksService } from '@/features/books/services/booksService';
import { useStartReading } from '@/features/books/history/useStartReading';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';
import { useReadProgress } from '@/features/books/history/useReadProgress';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';

jest.setTimeout(20000);

const mockNotify = jest.fn();

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: jest.fn() }),
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: {
    setCountsInStats: jest.fn(),
    openReadsWithProgress: jest.fn(),
    settings: jest.fn(),
    userBookTitle: jest.fn(),
    addProgress: jest.fn(),
    setTotalPages: jest.fn(),
    startReread: jest.fn(),
    readsForBook: jest.fn(),
  },
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: { updateReadingStatus: jest.fn() },
}));
jest.mock('@/features/books/history/useBookReadingHistory', () => ({
  useBookReadingHistory: jest.fn(),
}));
jest.mock('@/features/books/history/useReadProgress', () => ({
  useReadProgress: jest.fn(),
}));
jest.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'actor' } } }),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

const gateway = readingHistoryGateway as unknown as {
  setCountsInStats: jest.Mock;
  openReadsWithProgress: jest.Mock;
  settings: jest.Mock;
  userBookTitle: jest.Mock;
  addProgress: jest.Mock;
  setTotalPages: jest.Mock;
  startReread: jest.Mock;
};
const updateStatus = booksService.updateReadingStatus as jest.Mock;
const mockHistory = useBookReadingHistory as jest.Mock;
const mockProgress = useReadProgress as jest.Mock;

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: '2026-03-10',
    ended_on: '2026-03-12',
    start_unknown: false,
    end_unknown: false,
    total_pages: 300,
    counts_in_stats: true,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-12T10:00:00.000Z',
    ...overrides,
  };
}

function clientAndRender(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return { client, ...ui };
}

function successCalls() {
  return mockNotify.mock.calls.filter(([input]) => input?.kind === 'success');
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.setCountsInStats.mockResolvedValue([]);
  gateway.openReadsWithProgress.mockResolvedValue([]);
  gateway.settings.mockResolvedValue(null);
  gateway.userBookTitle.mockResolvedValue(null);
  gateway.addProgress.mockResolvedValue({ id: 'progress-2' });
  gateway.setTotalPages.mockResolvedValue(baseRead());
  gateway.startReread.mockResolvedValue('read-2');
  (gateway as unknown as { readsForBook: jest.Mock }).readsForBook.mockResolvedValue([]);
  updateStatus.mockResolvedValue({});
});

describe('save confirmations show exact messages once', () => {
  it('LeaveOutStatsSwitch shows Left out / Back in once', async () => {
    const off = clientAndRender(
      <LeaveOutStatsSwitch actorId="actor" userBookId="book-1" reads={[baseRead({ counts_in_stats: true })]} />,
    );
    try {
      await act(async () => {
        fireEvent(off.getByTestId('library-leave-out-stats-switch'), 'valueChange', true);
      });
      await waitFor(() => expect(gateway.setCountsInStats).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Left out of your stats' });
    } finally {
      off.unmount();
      off.client.clear();
    }
    jest.clearAllMocks();
    gateway.setCountsInStats.mockResolvedValue([]);

    const on = clientAndRender(
      <LeaveOutStatsSwitch
        actorId="actor"
        userBookId="book-1"
        reads={[baseRead({ counts_in_stats: false })]}
      />,
    );
    try {
      await act(async () => {
        fireEvent(on.getByTestId('library-leave-out-stats-switch'), 'valueChange', false);
      });
      await waitFor(() => expect(gateway.setCountsInStats).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Back in your stats' });
    } finally {
      on.unmount();
      on.client.clear();
    }
  });

  it('LeaveOutStatsSwitch shows no success toast on failure', async () => {
    gateway.setCountsInStats.mockRejectedValue(new Error('down'));
    const ui = clientAndRender(
      <LeaveOutStatsSwitch actorId="actor" userBookId="book-1" reads={[baseRead()]} />,
    );
    try {
      await act(async () => {
        fireEvent(ui.getByTestId('library-leave-out-stats-switch'), 'valueChange', true);
      });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('NoteProgressPrompt Update shows Progress updated to p. 70 once', async () => {
    mockHistory.mockReturnValue({
      reads: { data: [baseRead({ outcome: 'reading', started_on: '2026-10-01' })], isPending: false, isError: false },
    });
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    mockProgress.mockReturnValue({
      progress: {
        data: [{ id: 'p1', read_id: 'read-1', user_id: 'actor', page: 10, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' }],
        isPending: false,
        isError: false,
      },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: jest.fn(), isPending: false },
    });
    const ui = clientAndRender(<NoteProgressPrompt actorId="actor" userBookId="book-1" pageNumber={70} />);
    try {
      fireEvent.press(await ui.findByTestId('library-note-progress-update'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledWith({ page: 70 }));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Progress updated to p. 70' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('NoteProgressPrompt shows no success toast on failure', async () => {
    mockHistory.mockReturnValue({
      reads: { data: [baseRead({ outcome: 'reading' })], isPending: false, isError: false },
    });
    const addProgress = jest.fn().mockRejectedValue(new Error('progress down'));
    mockProgress.mockReturnValue({
      progress: {
        data: [{ id: 'p1', read_id: 'read-1', user_id: 'actor', page: 10, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' }],
        isPending: false,
        isError: false,
      },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: jest.fn(), isPending: false },
    });
    const ui = clientAndRender(<NoteProgressPrompt actorId="actor" userBookId="book-1" pageNumber={70} />);
    try {
      fireEvent.press(await ui.findByTestId('library-note-progress-update'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('useStartReading shows Started reading once and nothing on failure success', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useStartReading('actor'), { wrapper });
    try {
      await act(async () => {
        await result.current.start('user-book-2');
      });
      expect(updateStatus).toHaveBeenCalledWith('user-book-2', 'reading');
      expect(successCalls()).toHaveLength(1);
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Started reading' });
    } finally {
      unmount();
      client.clear();
    }
    jest.clearAllMocks();
    updateStatus.mockRejectedValueOnce(new Error('start down'));
    const client2 = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
    });
    const wrapper2 = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client2}>{children}</QueryClientProvider>
    );
    const failed = renderHook(() => useStartReading('actor'), { wrapper: wrapper2 });
    try {
      await act(async () => {
        await failed.result.current.start('user-book-2');
      });
      expect(failed.result).toBeTruthy();
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      failed.unmount();
      client2.clear();
    }
  });

  it('Quick Look Start reading shows Started reading and Read again shows Reading again', async () => {
    const book = {
      id: 'user-book-1',
      ownership: 'owned',
      reading_status: 'want_to_read',
      rating: null,
      review: null,
      condition: null,
      book: { title: 'Walden', authors: ['Thoreau'], page_count: 100 },
    } as never;
    const ui = clientAndRender(
      <LibraryBookQuickLook book={book} onClose={jest.fn()} onDetails={jest.fn()} />,
    );
    try {
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('user-book-1', 'reading'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Started reading' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    updateStatus.mockResolvedValue({});
    gateway.startReread.mockResolvedValue('read-2');
    const finished = {
      id: 'user-book-1',
      ownership: 'owned',
      reading_status: 'completed',
      rating: null,
      review: null,
      condition: null,
      book: { title: 'Walden', authors: ['Thoreau'], page_count: 100 },
    } as never;
    const ui2 = clientAndRender(
      <LibraryBookQuickLook book={finished} onClose={jest.fn()} onDetails={jest.fn()} />,
    );
    try {
      fireEvent.press(await ui2.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(gateway.startReread).toHaveBeenCalledWith('actor', 'user-book-1'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Reading again' });
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('Quick Look shows no success toast on failure', async () => {
    updateStatus.mockRejectedValueOnce(new Error('start down'));
    const book = {
      id: 'user-book-1',
      ownership: 'owned',
      reading_status: 'want_to_read',
      rating: null,
      review: null,
      condition: null,
      book: { title: 'Walden', authors: ['Thoreau'], page_count: 100 },
    } as never;
    const ui = clientAndRender(
      <LibraryBookQuickLook book={book} onClose={jest.fn()} onDetails={jest.fn()} />,
    );
    try {
      fireEvent.press(await ui.findByTestId('library-quick-look-start-reading'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('ContinueReadingCard progress and total saves show exact messages once', async () => {
    const read = baseRead({ outcome: 'reading', total_pages: 320, updated_at: '2026-10-20T10:00:00.000Z' });
    gateway.openReadsWithProgress.mockResolvedValue([
      {
        read,
        bookTitle: 'Walden',
        latestProgress: { id: 'p1', read_id: 'read-1', user_id: 'actor', page: 142, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' },
      },
    ]);
    const ui = clientAndRender(<ContinueReadingCard actorId="actor" />);
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(gateway.addProgress).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Progress saved' });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    jest.clearAllMocks();
    gateway.openReadsWithProgress.mockResolvedValue([
      {
        read,
        bookTitle: 'Walden',
        latestProgress: { id: 'p1', read_id: 'read-1', user_id: 'actor', page: 142, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' },
      },
    ]);
    gateway.addProgress.mockResolvedValue({ id: 'progress-2' });
    gateway.setTotalPages.mockResolvedValue(read);
    const ui2 = clientAndRender(<ContinueReadingCard actorId="actor" />);
    try {
      fireEvent.press(await ui2.findByTestId('library-continue-reading-update'));
      fireEvent.press(await ui2.findByTestId('library-progress-total-toggle'));
      fireEvent.changeText(await ui2.findByTestId('library-progress-total-input'), '400');
      fireEvent.press(ui2.getByTestId('library-progress-total-save'));
      await waitFor(() => expect(gateway.setTotalPages).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Total pages saved' });
    } finally {
      ui2.unmount();
      ui2.client.clear();
    }
  });

  it('ContinueReadingCard shows no success toast on a failed progress save', async () => {
    const read = baseRead({ outcome: 'reading', total_pages: 320 });
    gateway.openReadsWithProgress.mockResolvedValue([
      {
        read,
        bookTitle: 'Walden',
        latestProgress: { id: 'p1', read_id: 'read-1', user_id: 'actor', page: 142, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' },
      },
    ]);
    gateway.addProgress.mockRejectedValueOnce(new Error('progress down'));
    const ui = clientAndRender(<ContinueReadingCard actorId="actor" />);
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(mockNotify.mock.calls[0][0].kind).toBe('error');
      expect(successCalls()).toHaveLength(0);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('success toasts do not double-announce on android (polite live region owns it)', async () => {
    const priorOS = Platform.OS;
    Platform.OS = 'android';
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    mockHistory.mockReturnValue({
      reads: { data: [baseRead({ outcome: 'reading' })], isPending: false, isError: false },
    });
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    mockProgress.mockReturnValue({
      progress: {
        data: [{ id: 'p1', read_id: 'read-1', user_id: 'actor', page: 10, percent: null, recorded_at: '2026-10-10T12:00:00.000Z' }],
        isPending: false,
        isError: false,
      },
      addProgress: { mutateAsync: addProgress, isPending: false },
      setTotalPages: { mutateAsync: jest.fn(), isPending: false },
    });
    const ui = clientAndRender(<NoteProgressPrompt actorId="actor" userBookId="book-1" pageNumber={70} />);
    try {
      fireEvent.press(await ui.findByTestId('library-note-progress-update'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(successCalls()[0][0]).toMatchObject({ kind: 'success', message: 'Progress updated to p. 70' });
      // The shared helper never calls announceForAccessibility; Android
      // TalkBack reads the polite live region, iOS is announced by the provider.
      expect(announce).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
      announce.mockRestore();
      Platform.OS = priorOS;
    }
  });
});
