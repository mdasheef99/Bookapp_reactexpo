import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NoteProgressPrompt, noteProgressPromptStorageKey } from '../NoteProgressPrompt';
import { useBookReadingHistory } from '@/features/books/history/useBookReadingHistory';
import { useReadProgress } from '@/features/books/history/useReadProgress';

const mockHistory = useBookReadingHistory as jest.Mock;
const mockProgress = useReadProgress as jest.Mock;
const mockNotify = jest.fn();

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light' },
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
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

function openRead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'read-1',
    user_book_id: 'user-book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'reading',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    started_on: null,
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
    user_id: 'actor',
    page: 100,
    percent: null,
    recorded_at: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

function setupHistory(reads: unknown[]) {
  mockHistory.mockReturnValue({
    reads: { data: reads, isPending: false, isError: false, refetch: jest.fn() },
  });
}

function setupProgress(entries: unknown[], addProgress?: jest.Mock) {
  mockProgress.mockReturnValue({
    progress: { data: entries, isPending: false, isError: false, refetch: jest.fn() },
    addProgress: {
      mutateAsync: addProgress ?? jest.fn().mockResolvedValue({ id: 'progress-2' }),
      isPending: false,
    },
    setTotalPages: { mutateAsync: jest.fn(), isPending: false },
  });
}

function renderPrompt(pageNumber: number | null = 142, justSaved?: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <NoteProgressPrompt
        actorId="actor"
        userBookId="user-book-1"
        pageNumber={pageNumber}
        {...(justSaved === undefined ? {} : { justSaved })}
      />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('NoteProgressPrompt', () => {
  it('shows only when the note page is beyond the current position', async () => {
    setupHistory([openRead()]);
    setupProgress([progressEntry({ page: 100 })]);
    const ui = renderPrompt(142);
    try {
      expect(await ui.findByTestId('library-note-progress-text')).toHaveTextContent(
        "You're on p. 142?",
      );
      expect(ui.getByTestId('library-note-progress-update')).toBeOnTheScreen();
      expect(ui.getByTestId('library-note-progress-not-now')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it.each([
    { name: 'no open read', reads: [], entries: [progressEntry()], page: 142 },
    { name: 'no page', reads: [openRead()], entries: [progressEntry()], page: null },
    { name: 'page equal to current', reads: [openRead()], entries: [progressEntry({ page: 142 })], page: 142 },
    { name: 'page behind current', reads: [openRead()], entries: [progressEntry({ page: 200 })], page: 142 },
  ])('hides when $name', async ({ reads, entries, page }) => {
    setupHistory(reads);
    setupProgress(entries);
    const ui = renderPrompt(page);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows when the read has no progress yet', async () => {
    setupHistory([openRead()]);
    setupProgress([]);
    const ui = renderPrompt(142);
    try {
      expect(await ui.findByTestId('library-note-progress-prompt')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Update inserts exactly one page entry with the note page and hides', async () => {
    setupHistory([openRead()]);
    const addProgress = jest.fn().mockResolvedValue({ id: 'progress-2' });
    setupProgress([progressEntry({ page: 100 })], addProgress);
    const ui = renderPrompt(142);
    try {
      fireEvent.press(await ui.findByTestId('library-note-progress-update'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      expect(addProgress).toHaveBeenCalledWith({ page: 142 });
      await waitFor(() => expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull());
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Not now persists per user and read and suppresses the prompt', async () => {
    setupHistory([openRead()]);
    setupProgress([progressEntry({ page: 100 })]);
    const ui = renderPrompt(142);
    try {
      fireEvent.press(await ui.findByTestId('library-note-progress-not-now'));
      await waitFor(() =>
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          noteProgressPromptStorageKey('actor', 'read-1'),
          '1',
        ),
      );
      expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a remembered dismissal survives a remount but a new read shows again', async () => {
    setupHistory([openRead()]);
    setupProgress([progressEntry({ page: 100 })]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    const dismissed = renderPrompt(142);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(dismissed.queryByTestId('library-note-progress-prompt')).toBeNull();
    } finally {
      dismissed.unmount();
      dismissed.client.clear();
    }
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    setupHistory([openRead({ id: 'read-2', read_number: 2 })]);
    setupProgress([]);
    const next = renderPrompt(142);
    try {
      expect(await next.findByTestId('library-note-progress-prompt')).toBeOnTheScreen();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        noteProgressPromptStorageKey('actor', 'read-2'),
      );
    } finally {
      next.unmount();
      next.client.clear();
    }
  });

  it('a failed Update shows Retry which re-runs the same page entry', async () => {
    setupHistory([openRead()]);
    const addProgress = jest
      .fn()
      .mockRejectedValueOnce(new Error('progress down'))
      .mockResolvedValue({ id: 'progress-2' });
    setupProgress([progressEntry({ page: 100 })], addProgress);
    const ui = renderPrompt(142);
    try {
      fireEvent.press(await ui.findByTestId('library-note-progress-update'));
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as {
        kind: string;
        action?: { label: string; onPress: () => void };
      };
      expect(call.kind).toBe('error');
      expect(call.action?.label).toBe('Retry');
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(addProgress).toHaveBeenCalledTimes(2));
      expect(addProgress).toHaveBeenNthCalledWith(2, { page: 142 });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not fetch history when the note has no page number', async () => {
    setupHistory([openRead()]);
    setupProgress([progressEntry({ page: 100 })]);
    const ui = renderPrompt(null);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull();
      expect(mockHistory).toHaveBeenCalledWith('actor', 'user-book-1', false);
      expect(mockProgress).toHaveBeenCalledWith('actor', expect.any(String), false);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not fetch history or show when justSaved is false', async () => {
    setupHistory([openRead()]);
    setupProgress([progressEntry({ page: 100 })]);
    const ui = renderPrompt(142, false);
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(ui.queryByTestId('library-note-progress-prompt')).toBeNull();
      expect(mockHistory).toHaveBeenCalledWith('actor', 'user-book-1', false);
      expect(mockProgress).toHaveBeenCalledWith('actor', expect.any(String), false);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('fetches history when justSaved is true and the page is ahead', async () => {
    setupHistory([openRead()]);
    setupProgress([progressEntry({ page: 100 })]);
    const ui = renderPrompt(142, true);
    try {
      expect(await ui.findByTestId('library-note-progress-prompt')).toBeOnTheScreen();
      expect(mockHistory).toHaveBeenCalledWith('actor', 'user-book-1', true);
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
