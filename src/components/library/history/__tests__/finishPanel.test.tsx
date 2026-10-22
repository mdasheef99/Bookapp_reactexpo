import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { FinishPanel, finishPanelStorageKey } from '../FinishPanel';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { booksService } from '@/features/books/services/booksService';
import { noteSaves } from '@/features/books/notes/manualNotesGateway';
import { useNoteOperations } from '@/features/books/notes/useManualNotes';

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
jest.mock('@react-native-async-storage/async-storage', () => {
  const backing = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => Promise.resolve(backing.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      backing.set(key, value);
      return Promise.resolve();
    }),
    __backing: backing,
  };
});
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { userBookTitle: jest.fn() },
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: { updateReadingStatus: jest.fn() },
}));
jest.mock('@/features/books/notes/manualNotesGateway', () => ({
  noteSaves: { start: jest.fn() },
}));
jest.mock('@/features/books/notes/useManualNotes', () => ({
  useNoteOperations: jest.fn(() => []),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-1') }));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name, ...props }: any) => <Text {...props}>{name}</Text> };
});

const mockNotify = jest.fn();
const mocks = useNoteOperations as unknown as jest.Mock;
const AsyncStorage = require('@react-native-async-storage/async-storage');
const backing: Map<string, string> = AsyncStorage.__backing;

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: '2026-10-01',
    ended_on: '2026-10-20',
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

function renderPanel(props: Partial<React.ComponentProps<typeof FinishPanel>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <FinishPanel
        actorId="actor"
        userBookId="book-1"
        read={baseRead()}
        allReads={[baseRead()]}
        justFinished
        rating={0}
        onRate={jest.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  backing.clear();
  mocks.mockReturnValue([]);
  (readingHistoryGateway.userBookTitle as jest.Mock).mockResolvedValue('Dune');
  (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
  (noteSaves.start as jest.Mock).mockReturnValue('op-1');
});

describe('FinishPanel', () => {
  it('appears only on a finish in this session', async () => {
    const notSession = renderPanel({ justFinished: false });
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(notSession.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      notSession.unmount();
      notSession.client.clear();
    }

    const reading = renderPanel({
      read: baseRead({ id: 'read-reading', outcome: 'reading' }),
      allReads: [baseRead({ id: 'read-reading', outcome: 'reading' })],
      justFinished: true,
    });
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(reading.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      reading.unmount();
      reading.client.clear();
    }

    const finished = renderPanel({});
    try {
      expect(await finished.findByTestId('library-finish-panel')).toBeOnTheScreen();
      expect(finished.getByTestId('library-finish-heading')).toHaveTextContent(/Your 1st book this year/);
    } finally {
      finished.unmount();
      finished.client.clear();
    }
  });

  it('shows plain Finished when the end is unknown or the read is excluded', async () => {
    const unknown = renderPanel({
      read: baseRead({ id: 'read-unknown', ended_on: null, end_unknown: true }),
      allReads: [baseRead({ id: 'read-unknown', ended_on: null, end_unknown: true })],
    });
    try {
      expect(await unknown.findByTestId('library-finish-heading')).toHaveTextContent('Finished.');
      expect(unknown.queryByText(/Your .* book this year/)).toBeNull();
    } finally {
      unknown.unmount();
      unknown.client.clear();
    }

    const excluded = renderPanel({
      read: baseRead({ id: 'read-excluded', counts_in_stats: false }),
      allReads: [baseRead({ id: 'read-excluded', counts_in_stats: false })],
    });
    try {
      expect(await excluded.findByTestId('library-finish-heading')).toHaveTextContent('Finished.');
    } finally {
      excluded.unmount();
      excluded.client.clear();
    }
  });

  it('holds the count until allReads contains the target read', async () => {
    const loading = renderPanel({
      read: baseRead({ id: 'read-1' }),
      allReads: [],
    });
    try {
      expect(await loading.findByTestId('library-finish-heading')).toHaveTextContent('Finished.');
      expect(loading.queryByText(/Your .* book this year/)).toBeNull();
    } finally {
      loading.unmount();
      loading.client.clear();
    }
    backing.clear();

    const ready = renderPanel({});
    try {
      expect(await ready.findByTestId('library-finish-heading')).toHaveTextContent(/Your 1st book this year/);
    } finally {
      ready.unmount();
      ready.client.clear();
    }
  });

  it('dismiss persists once per read across a remount', async () => {
    const ui = renderPanel({});
    try {
      await ui.findByTestId('library-finish-panel');
      fireEvent.press(ui.getByTestId('library-finish-dismiss'));
      await waitFor(() =>
        expect(backing.get(finishPanelStorageKey('actor', 'read-1'))).toBe('1'),
      );
      expect(ui.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }

    const again = renderPanel({ justFinished: true });
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(again.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      again.unmount();
      again.client.clear();
    }
  });

  it('writes the key on first show, so a remount without dismiss still hides', async () => {
    const first = renderPanel({
      read: baseRead({ id: 'read-once' }),
      allReads: [baseRead({ id: 'read-once' })],
    });
    try {
      await first.findByTestId('library-finish-panel');
      await waitFor(() =>
        expect(backing.get(finishPanelStorageKey('actor', 'read-once'))).toBe('1'),
      );
    } finally {
      first.unmount();
      first.client.clear();
    }

    const second = renderPanel({
      read: baseRead({ id: 'read-once' }),
      allReads: [baseRead({ id: 'read-once' })],
    });
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(second.queryByTestId('library-finish-panel')).toBeNull();
    } finally {
      second.unmount();
      second.client.clear();
    }
  });

  it('saves exactly one reflect thought via the existing note path', async () => {
    const ui = renderPanel({});
    try {
      await ui.findByTestId('library-finish-panel');
      fireEvent.changeText(ui.getByTestId('library-finish-thought-input'), 'A quiet ending');
      fireEvent.press(ui.getByTestId('library-finish-thought-save'));
      await waitFor(() => expect(noteSaves.start).toHaveBeenCalledTimes(1));
      expect(noteSaves.start).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'actor', bookId: 'book-1', tag: 'reflect', content: 'A quiet ending' }),
      );
      fireEvent.press(ui.getByTestId('library-finish-thought-save'));
      expect(noteSaves.start).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a pending save keeps the text so a second press still sends once', async () => {
    mocks.mockReturnValue([]);
    const ui = renderPanel({
      read: baseRead({ id: 'read-pending' }),
      allReads: [baseRead({ id: 'read-pending' })],
    });
    try {
      await ui.findByTestId('library-finish-panel');
      fireEvent.changeText(ui.getByTestId('library-finish-thought-input'), 'A quiet ending');
      fireEvent.press(ui.getByTestId('library-finish-thought-save'));
      await waitFor(() => expect(noteSaves.start).toHaveBeenCalledTimes(1));
      // The text is kept until the coordinator confirms, so the second press
      // is blocked by the in-flight guard rather than an empty-input check.
      expect(ui.getByTestId('library-finish-thought-input').props.value).toBe('A quiet ending');
      fireEvent.press(ui.getByTestId('library-finish-thought-save'));
      expect(noteSaves.start).toHaveBeenCalledTimes(1);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a failed save keeps the text and shows Retry', async () => {
    mocks.mockReturnValue([
      {
        submission: { id: 'op-1', sessionId: 'uuid-1', actorId: 'actor', bookId: 'book-1' },
        status: 'failed',
        checking: false,
        message: 'note down',
      },
    ]);
    const ui = renderPanel({
      read: baseRead({ id: 'read-failed' }),
      allReads: [baseRead({ id: 'read-failed' })],
    });
    try {
      await ui.findByTestId('library-finish-panel');
      fireEvent.changeText(ui.getByTestId('library-finish-thought-input'), 'Keep me');
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      expect(ui.getByTestId('library-finish-thought-input').props.value).toBe('Keep me');
      const call = mockNotify.mock.calls[0][0] as { action?: { label: string; onPress: () => void } };
      expect(call.action?.label).toBe('Retry');
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(noteSaves.start).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows Saving until confirmed, then Thought saved', async () => {
    mocks.mockReturnValue([
      {
        submission: { id: 'op-1', sessionId: 'uuid-1', actorId: 'actor', bookId: 'book-1' },
        status: 'saving',
        checking: false,
      },
    ]);
    const ui = renderPanel({
      read: baseRead({ id: 'read-confirm' }),
      allReads: [baseRead({ id: 'read-confirm' })],
    });
    try {
      await ui.findByTestId('library-finish-panel');
      expect(await ui.findByTestId('library-finish-thought-saving')).toBeOnTheScreen();
      expect(ui.queryByTestId('library-finish-thought-saved')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
    backing.clear();

    mocks.mockReturnValue([
      {
        submission: { id: 'op-1', sessionId: 'uuid-1', actorId: 'actor', bookId: 'book-1' },
        status: 'confirmed',
        checking: false,
        record: { id: 'note-1' },
      },
    ]);
    const done = renderPanel({
      read: baseRead({ id: 'read-confirm-done' }),
      allReads: [baseRead({ id: 'read-confirm-done' })],
    });
    try {
      expect(await done.findByTestId('library-finish-thought-saved')).toBeOnTheScreen();
      expect(done.queryByTestId('library-finish-thought-saving')).toBeNull();
    } finally {
      done.unmount();
      done.client.clear();
    }
  });

  it('shows Next up only for a different book and starts it', async () => {
    const same = renderPanel({ nextReadUserBookId: 'book-1' });
    try {
      await same.findByTestId('library-finish-panel');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(same.queryByTestId('library-finish-next-up')).toBeNull();
    } finally {
      same.unmount();
      same.client.clear();
    }
    backing.clear();

    const other = renderPanel({
      read: baseRead({ id: 'read-next' }),
      allReads: [baseRead({ id: 'read-next' })],
      nextReadUserBookId: 'book-2',
    });
    try {
      expect(await other.findByTestId('library-finish-next-up-text')).toHaveTextContent('Next up: Dune');
      fireEvent.press(other.getByTestId('library-finish-next-start'));
      await waitFor(() =>
        expect(booksService.updateReadingStatus).toHaveBeenCalledWith('book-2', 'reading'),
      );
    } finally {
      other.unmount();
      other.client.clear();
    }
  });
});
