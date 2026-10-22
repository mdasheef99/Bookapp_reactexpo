import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { GoalSummary } from '../GoalSummary';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { goal: jest.fn(), readsForUser: jest.fn() },
}));

const mockPush = jest.fn();
const gateway = readingHistoryGateway as unknown as { goal: jest.Mock; readsForUser: jest.Mock };

function finishedRead(id: string, book: string): ReadingRead {
  return {
    id,
    user_book_id: book,
    user_id: 'reader-1',
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
  };
}

function setup(onOpenStats?: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <GoalSummary actorId="reader-1" year={2026} timeZone="UTC" onOpenStats={onOpenStats} />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.goal.mockResolvedValue(null);
  gateway.readsForUser.mockResolvedValue([]);
});

describe('GoalSummary (H-16)', () => {
  it('shows exactly "14 of 24 books in 2026" as a link with no extra visuals', async () => {
    gateway.goal.mockResolvedValue({
      user_id: 'reader-1',
      year: 2026,
      target_books: 24,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    gateway.readsForUser.mockResolvedValue(
      Array.from({ length: 14 }, (_, index) => finishedRead(`r${index}`, `book-${index}`)),
    );
    const onOpen = jest.fn();
    const ui = setup(onOpen);
    try {
      // Pending shows the quiet link; wait for the goal count once loaded.
      expect(await ui.findByTestId('library-goal-summary-link')).toBeOnTheScreen();
      expect(await ui.findByText('14 of 24 books in 2026')).toBeOnTheScreen();
      const link = ui.getByTestId('library-goal-summary-link');
      // DP-04: plain text only — no ring/bar/colour wording or behind/ahead copy.
      expect(ui.queryByText(/behind/i)).toBeNull();
      expect(ui.queryByText(/ahead/i)).toBeNull();
      expect(ui.queryByText(/%/)).toBeNull();
      fireEvent.press(link);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('routes to the stats screen by default', async () => {
    gateway.goal.mockResolvedValue({
      user_id: 'reader-1',
      year: 2026,
      target_books: 24,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    gateway.readsForUser.mockResolvedValue([finishedRead('r1', 'book-1')]);
    const ui = setup();
    try {
      const link = await ui.findByTestId('library-goal-summary-link');
      fireEvent.press(link);
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/library/stats');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows a quiet "Reading stats" link with no goal', async () => {
    gateway.goal.mockResolvedValue(null);
    gateway.readsForUser.mockResolvedValue([finishedRead('r1', 'book-1')]);
    const ui = setup();
    try {
      expect(await ui.findByText('Reading stats')).toBeOnTheScreen();
      expect(ui.queryByText(/of \d+ books/)).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('keeps the stats link reachable when the goal query fails', async () => {
    gateway.goal.mockRejectedValue(new Error('down'));
    gateway.readsForUser.mockResolvedValue([]);
    const ui = setup();
    try {
      expect(await ui.findByText('Reading stats')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('keeps the quiet link while pending (never null)', async () => {
    let resolveReads!: (value: ReadingRead[]) => void;
    gateway.goal.mockResolvedValue(null);
    gateway.readsForUser.mockReturnValue(new Promise<ReadingRead[]>((done) => { resolveReads = done; }));
    const ui = setup();
    try {
      // Pending still renders the quiet link so the stats screen stays reachable.
      expect(await ui.findByTestId('library-goal-summary-link')).toBeOnTheScreen();
      expect(await ui.findByText('Reading stats')).toBeOnTheScreen();
      await waitFor(() => expect(gateway.readsForUser).toHaveBeenCalled());
      resolveReads([]);
      expect(await ui.findByText('Reading stats')).toBeOnTheScreen();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
