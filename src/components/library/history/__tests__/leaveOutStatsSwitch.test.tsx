import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { LeaveOutStatsSwitch } from '../LeaveOutStatsSwitch';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { ReadingRead } from '@/features/books/history/readingHistoryContract';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight' }) }));
jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: jest.fn() }),
}));
jest.mock('@/features/books/history/readingHistoryGateway', () => ({
  readingHistoryGateway: { setCountsInStats: jest.fn() },
}));

const mockNotify = jest.fn();
const gateway = readingHistoryGateway as unknown as { setCountsInStats: jest.Mock };

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
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
    ...overrides,
  };
}

function setup(reads: ReadingRead[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const ui = render(
    <QueryClientProvider client={client}>
      <LeaveOutStatsSwitch actorId="reader-1" userBookId="book-1" reads={reads} />
    </QueryClientProvider>,
  );
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.setCountsInStats.mockResolvedValue([]);
});

describe('LeaveOutStatsSwitch (H-17)', () => {
  it('is hidden when the book has no reads', () => {
    const ui = setup([]);
    try {
      expect(ui.queryByTestId('library-leave-out-stats')).toBeNull();
      expect(ui.queryByTestId('library-leave-out-stats-switch')).toBeNull();
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('is off when the reads count in stats, on when all are left out', () => {
    const on = setup([baseRead({ counts_in_stats: true })]);
    try {
      expect(on.getByTestId('library-leave-out-stats-switch').props.value).toBe(false);
    } finally {
      on.unmount();
      on.client.clear();
    }
    const off = setup([
      baseRead({ id: 'r1', counts_in_stats: false }),
      baseRead({ id: 'r2', read_number: 2, counts_in_stats: false }),
    ]);
    try {
      expect(off.getByTestId('library-leave-out-stats-switch').props.value).toBe(true);
    } finally {
      off.unmount();
      off.client.clear();
    }
  });

  it('follows the most recent read (highest read_number) with a mixed list', () => {
    const latestOut = setup([
      baseRead({ id: 'r1', read_number: 1, counts_in_stats: true }),
      baseRead({ id: 'r2', read_number: 2, counts_in_stats: false }),
    ]);
    try {
      expect(latestOut.getByTestId('library-leave-out-stats-switch').props.value).toBe(true);
    } finally {
      latestOut.unmount();
      latestOut.client.clear();
    }
    const latestIn = setup([
      baseRead({ id: 'r1', read_number: 1, counts_in_stats: false }),
      baseRead({ id: 'r2', read_number: 2, counts_in_stats: true }),
    ]);
    try {
      expect(latestIn.getByTestId('library-leave-out-stats-switch').props.value).toBe(false);
    } finally {
      latestIn.unmount();
      latestIn.client.clear();
    }
  });

  it('sends one owner-filtered update for all reads of the book and invalidates', async () => {
    const ui = setup([baseRead({ counts_in_stats: true })]);
    try {
      const invalidate = jest.spyOn(ui.client, 'invalidateQueries');
      gateway.setCountsInStats.mockResolvedValue([baseRead({ counts_in_stats: false })]);
      const toggle = ui.getByTestId('library-leave-out-stats-switch');
      await act(async () => {
        fireEvent(toggle, 'valueChange', true);
      });
      await waitFor(() => expect(gateway.setCountsInStats).toHaveBeenCalledTimes(1));
      expect(gateway.setCountsInStats).toHaveBeenCalledWith('reader-1', 'book-1', false);
      const payload = gateway.setCountsInStats.mock.calls[0];
      expect(payload).toEqual(['reader-1', 'book-1', false]);
      await waitFor(() =>
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ['library-history-reads-user', 'reader-1'],
        }),
      );
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['library-history-reads-book', 'reader-1', 'book-1'],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-goal', 'reader-1'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-quotes', 'reader-1'] });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('shows a Retry toast on failure', async () => {
    const ui = setup([baseRead({ counts_in_stats: true })]);
    try {
      gateway.setCountsInStats.mockRejectedValue(new Error('down'));
      await act(async () => {
        fireEvent(ui.getByTestId('library-leave-out-stats-switch'), 'valueChange', true);
      });
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      const call = mockNotify.mock.calls[0][0] as {
        kind: string;
        action?: { label: string; onPress: () => void };
      };
      expect(call.kind).toBe('error');
      expect(call.action?.label).toBe('Retry');
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });

  it('guards against double taps while in flight', async () => {
    const ui = setup([baseRead({ counts_in_stats: true })]);
    try {
      let resolve!: (value: ReadingRead[]) => void;
      gateway.setCountsInStats.mockReturnValue(
        new Promise<ReadingRead[]>((done) => { resolve = done; }),
      );
      const toggle = ui.getByTestId('library-leave-out-stats-switch');
      fireEvent(toggle, 'valueChange', true);
      fireEvent(toggle, 'valueChange', true);
      await waitFor(() => expect(gateway.setCountsInStats).toHaveBeenCalledTimes(1));
      await act(async () => { resolve([]); });
    } finally {
      ui.unmount();
      ui.client.clear();
    }
  });
});
