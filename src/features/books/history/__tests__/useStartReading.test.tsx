jest.mock('@/features/books/services/booksService', () => ({
  booksService: { updateReadingStatus: jest.fn() },
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStartReading } from '../useStartReading';
import { booksService } from '@/features/books/services/booksService';

const updateMock = booksService.updateReadingStatus as jest.Mock;
const mockNotify = jest.fn();

jest.mock('@/components/library/ui/BookFeedback', () => ({
  ...jest.requireActual('@/components/library/ui/BookFeedback'),
  BookFeedbackSlot: () => null,
  useBookFeedback: () => ({ notify: mockNotify, confirm: jest.fn() }),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useStartReading('actor'), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  updateMock.mockResolvedValue({});
});

describe('useStartReading', () => {
  it('writes reading status and invalidates library, reads, open reads and settings', async () => {
    const { client, result, unmount } = setup();
    try {
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.start('user-book-2');
      });
      expect(updateMock).toHaveBeenCalledWith('user-book-2', 'reading');
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library'] }));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['library-history-reads-book', 'actor', 'user-book-2'],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-reads-user', 'actor'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-open-reads', 'actor'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-settings', 'actor'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['book', 'actor'] });
    } finally {
      unmount();
      client.clear();
    }
  });

  it('guards double taps to one request', async () => {
    updateMock.mockImplementationOnce(() => new Promise(() => {}));
    const { result, unmount } = setup();
    try {
      await act(async () => {
        result.current.start('user-book-2');
        result.current.start('user-book-2');
      });
      expect(updateMock).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it('a failed start shows Retry which re-runs', async () => {
    updateMock.mockRejectedValueOnce(new Error('start down')).mockResolvedValue({});
    const { result, unmount } = setup();
    try {
      await act(async () => {
        await result.current.start('user-book-2');
      });
      expect(updateMock).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
      const call = mockNotify.mock.calls[0][0] as { action?: { label: string; onPress: () => void } };
      expect(call.action?.label).toBe('Retry');
      await act(async () => {
        call.action?.onPress();
      });
      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2));
    } finally {
      unmount();
    }
  });
});
