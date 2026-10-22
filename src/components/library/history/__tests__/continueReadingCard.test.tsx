import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ContinueReadingCard } from '../ContinueReadingCard';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { booksService } from '@/features/books/services/booksService';

const gateway = readingHistoryGateway as unknown as {
  openReadsWithProgress: jest.Mock;
  settings: jest.Mock;
  userBookTitle: jest.Mock;
  addProgress: jest.Mock;
  setTotalPages: jest.Mock;
  readsForBook: jest.Mock;
};
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
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: jest.fn() }),
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: {
    openReadsWithProgress: jest.fn(),
    settings: jest.fn(),
    userBookTitle: jest.fn(),
    addProgress: jest.fn(),
    setTotalPages: jest.fn(),
    readsForBook: jest.fn(),
  },
}));
jest.mock('@/features/books/services/booksService', () => ({
  booksService: { updateReadingStatus: jest.fn() },
}));

function validRead(overrides: Record<string, unknown> = {}) {
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
    updated_at: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}

function progressEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'progress-1',
    read_id: 'read-1',
    user_id: 'actor',
    page: 142,
    percent: null,
    recorded_at: '2026-10-10T10:00:00.000Z',
    ...overrides,
  };
}

function renderCard(onOpenBook: jest.Mock = jest.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <ContinueReadingCard actorId="actor" onOpenBook={onOpenBook} />
    </QueryClientProvider>,
  );
  return { client, onOpenBook, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.openReadsWithProgress.mockResolvedValue([]);
  gateway.settings.mockResolvedValue(null);
  gateway.userBookTitle.mockResolvedValue(null);
  gateway.addProgress.mockResolvedValue({ id: 'progress-2' });
  gateway.setTotalPages.mockResolvedValue(validRead());
  gateway.readsForBook.mockResolvedValue([]);
  (booksService.updateReadingStatus as jest.Mock).mockResolvedValue({});
});

describe('ContinueReadingCard', () => {
  it('shows the most recently updated open read with short text and the bar', async () => {
    const older = {
      read: validRead({ id: 'read-old', user_book_id: 'book-old', updated_at: '2026-10-01T10:00:00.000Z' }),
      bookTitle: 'Old Book',
      latestProgress: progressEntry({ read_id: 'read-old', page: 10 }),
    };
    const newer = {
      read: validRead({ id: 'read-1', user_book_id: 'user-book-1', updated_at: '2026-10-20T10:00:00.000Z' }),
      bookTitle: 'Walden',
      latestProgress: progressEntry(),
    };
    gateway.openReadsWithProgress.mockResolvedValue([older, newer]);
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-card')).toBeOnTheScreen();
      expect(ui.getByTestId('library-continue-reading-progress')).toHaveTextContent('p. 142 of 320');
      expect(ui.getByTestId('library-progress-bar-text')).toHaveTextContent('142 of 320 pages, 44%');
      expect(ui.getByTestId('library-continue-reading-update')).toBeOnTheScreen();
      expect(ui.queryByTestId('library-continue-reading-next-up')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows percent text without a total', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([
      {
        read: validRead({ total_pages: null }),
        bookTitle: 'Walden',
        latestProgress: progressEntry({ page: null, percent: 44 }),
      },
    ]);
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-progress')).toHaveTextContent('44%');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Update opens the named sheet and Save inserts one page entry', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([
      { read: validRead(), bookTitle: 'Walden', latestProgress: progressEntry() },
    ]);
    const ui = renderCard();
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-update'));
      await ui.findByTestId('library-progress-save');
      fireEvent.press(ui.getByTestId('library-progress-save'));
      await waitFor(() => expect(gateway.addProgress).toHaveBeenCalledTimes(1));
      expect(gateway.addProgress).toHaveBeenCalledWith('actor', 'read-1', { page: 142 });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('opens the book when the title is pressed', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([
      { read: validRead(), bookTitle: 'Walden', latestProgress: progressEntry() },
    ]);
    const ui = renderCard();
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-open'));
      expect(ui.onOpenBook).toHaveBeenCalledWith('user-book-1');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows Next up only with no open read and a next read in the library', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([]);
    gateway.settings.mockResolvedValue({
      user_id: 'actor',
      next_read_user_book_id: 'user-book-2',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    gateway.userBookTitle.mockResolvedValue('Dune');
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-next-up')).toHaveTextContent(
        'Next up: Dune',
      );
      expect(ui.getByTestId('library-continue-reading-start')).toBeOnTheScreen();
      expect(gateway.userBookTitle).toHaveBeenCalledWith('actor', 'user-book-2', expect.anything());
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it.each([
    { name: 'open reads present', open: true, settings: { user_id: 'actor', next_read_user_book_id: 'user-book-2', updated_at: '2026-10-01T00:00:00.000Z' }, title: 'Dune' },
    { name: 'no next read set', open: false, settings: null, title: null },
    { name: 'next read not in the library', open: false, settings: { user_id: 'actor', next_read_user_book_id: 'gone', updated_at: '2026-10-01T00:00:00.000Z' }, title: null },
  ])('hides Next up when $name', async ({ open, settings, title }) => {
    gateway.openReadsWithProgress.mockResolvedValue(
      open ? [{ read: validRead(), bookTitle: 'Walden', latestProgress: progressEntry() }] : [],
    );
    gateway.settings.mockResolvedValue(settings);
    gateway.userBookTitle.mockResolvedValue(title);
    const ui = renderCard();
    try {
      if (open) {
        await ui.findByTestId('library-continue-reading-update');
      } else {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
      }
      expect(ui.queryByTestId('library-continue-reading-next-up')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('renders nothing with no open read and no next read', async () => {
    const ui = renderCard();
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(ui.queryByTestId('library-continue-reading-card')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('Start reading writes status and invalidates library, reads, open reads and settings', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([]);
    gateway.settings.mockResolvedValue({
      user_id: 'actor',
      next_read_user_book_id: 'user-book-2',
      updated_at: '2026-10-01T00:00:00.000Z',
    });
    gateway.userBookTitle.mockResolvedValue('Dune');
    const ui = renderCard();
    const invalidate = jest.spyOn(ui.client, 'invalidateQueries');
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-start'));
      await waitFor(() =>
        expect(booksService.updateReadingStatus).toHaveBeenCalledWith('user-book-2', 'reading'),
      );
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library'] }));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-reads-user', 'actor'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-open-reads', 'actor'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-settings', 'actor'] });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a load failure shows Try again which refetches', async () => {
    gateway.openReadsWithProgress
      .mockRejectedValueOnce(new Error('reading down'))
      .mockResolvedValue([]);
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-retry')).toBeOnTheScreen();
      fireEvent.press(ui.getByTestId('library-continue-reading-retry'));
      await waitFor(() => expect(gateway.openReadsWithProgress).toHaveBeenCalledTimes(2));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('a failed progress save shows Retry which re-runs', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([
      { read: validRead(), bookTitle: 'Walden', latestProgress: progressEntry() },
    ]);
    gateway.addProgress
      .mockRejectedValueOnce(new Error('progress down'))
      .mockResolvedValue({ id: 'progress-2' });
    const ui = renderCard();
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(gateway.addProgress).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as {
        kind: string;
        action?: { label: string; onPress: () => void };
      };
      expect(call.action?.label).toBe('Retry');
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(gateway.addProgress).toHaveBeenCalledTimes(2));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not fetch settings when an open read exists', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([
      { read: validRead(), bookTitle: 'Walden', latestProgress: progressEntry() },
    ]);
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-update')).toBeOnTheScreen();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(gateway.settings).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('fetches settings only after open reads succeed with none', async () => {
    gateway.openReadsWithProgress.mockResolvedValue([]);
    gateway.settings.mockResolvedValue(null);
    const ui = renderCard();
    try {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      await waitFor(() => expect(gateway.openReadsWithProgress).toHaveBeenCalled());
      await waitFor(() => expect(gateway.settings).toHaveBeenCalledWith('actor', expect.anything()));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('picks the read with older updated_at but newer progress activity', async () => {
    const stale = {
      read: validRead({
        id: 'read-stale',
        user_book_id: 'book-stale',
        updated_at: '2026-10-20T10:00:00.000Z',
        started_at: '2026-10-01T10:00:00.000Z',
        total_pages: 320,
      }),
      bookTitle: 'Stale Book',
      latestProgress: progressEntry({
        read_id: 'read-stale',
        page: 10,
        recorded_at: '2026-10-05T10:00:00.000Z',
      }),
      lastActivityAt: '2026-10-20T10:00:00.000Z',
    };
    const fresh = {
      read: validRead({
        id: 'read-fresh',
        user_book_id: 'book-fresh',
        updated_at: '2026-10-01T10:00:00.000Z',
        started_at: '2026-10-01T10:00:00.000Z',
        total_pages: 320,
      }),
      bookTitle: 'Fresh Book',
      latestProgress: progressEntry({
        read_id: 'read-fresh',
        page: 20,
        recorded_at: '2026-10-21T10:00:00.000Z',
      }),
      lastActivityAt: '2026-10-21T10:00:00.000Z',
    };
    gateway.openReadsWithProgress.mockResolvedValue([stale, fresh]);
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-card')).toBeOnTheScreen();
      expect(ui.getByTestId('library-continue-reading-progress')).toHaveTextContent('p. 20 of 320');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('breaks activity ties deterministically by read id', async () => {
    const first = {
      read: validRead({ id: 'read-b', user_book_id: 'book-b', updated_at: '2026-10-10T10:00:00.000Z' }),
      bookTitle: 'B Book',
      latestProgress: null,
      lastActivityAt: '2026-10-10T10:00:00.000Z',
    };
    const second = {
      read: validRead({ id: 'read-a', user_book_id: 'book-a', updated_at: '2026-10-10T10:00:00.000Z' }),
      bookTitle: 'A Book',
      latestProgress: null,
      lastActivityAt: '2026-10-10T10:00:00.000Z',
    };
    gateway.openReadsWithProgress.mockResolvedValue([first, second]);
    const ui = renderCard();
    try {
      expect(await ui.findByTestId('library-continue-reading-card')).toBeOnTheScreen();
      expect(ui.getByTestId('library-continue-reading-open')).toHaveProp('accessibilityLabel', 'Continue reading A Book');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('uses an earlier total as the default and persists it once on the first progress save', async () => {
    const open = validRead({ id: 'read-2', user_book_id: 'user-book-1', read_number: 2, total_pages: null });
    const earlier = validRead({ id: 'read-1', user_book_id: 'user-book-1', read_number: 1, total_pages: 400 });
    gateway.openReadsWithProgress.mockResolvedValue([
      { read: open, bookTitle: 'Walden', latestProgress: null, lastActivityAt: '2026-10-20T10:00:00.000Z' },
    ]);
    gateway.readsForBook.mockResolvedValue([earlier, open]);
    const ui = renderCard();
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-update'));
      expect(await ui.findByTestId('library-progress-header')).toHaveTextContent('Page 0 of 400');
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(gateway.setTotalPages).toHaveBeenCalledTimes(1));
      expect(gateway.setTotalPages).toHaveBeenCalledWith('actor', 'read-2', 400);
      await waitFor(() => expect(gateway.addProgress).toHaveBeenCalledTimes(1));
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('does not persist a fallback when the open read already has a total', async () => {
    const open = validRead({ total_pages: 320 });
    gateway.openReadsWithProgress.mockResolvedValue([
      { read: open, bookTitle: 'Walden', latestProgress: null, lastActivityAt: '2026-10-20T10:00:00.000Z' },
    ]);
    const ui = renderCard();
    try {
      fireEvent.press(await ui.findByTestId('library-continue-reading-update'));
      fireEvent.press(await ui.findByTestId('library-progress-save'));
      await waitFor(() => expect(gateway.addProgress).toHaveBeenCalledTimes(1));
      expect(gateway.setTotalPages).not.toHaveBeenCalled();
      expect(gateway.readsForBook).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
