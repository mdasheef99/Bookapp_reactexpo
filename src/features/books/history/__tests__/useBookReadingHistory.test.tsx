jest.mock('../readingHistoryGateway', () => ({
  readingHistoryGateway: {
    readsForBook: jest.fn(),
    updateReadDates: jest.fn(),
    removeRead: jest.fn(),
    startReread: jest.fn(),
    reopenRead: jest.fn(),
    settings: jest.fn(),
    readsForUser: jest.fn(),
    setNextRead: jest.fn(),
  },
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useBookReadingHistory } from '../useBookReadingHistory';
import { readingHistoryGateway } from '../readingHistoryGateway';

const gateway = readingHistoryGateway as unknown as {
  readsForBook: jest.Mock;
  updateReadDates: jest.Mock;
  removeRead: jest.Mock;
  startReread: jest.Mock;
  reopenRead: jest.Mock;
  settings: jest.Mock;
  readsForUser: jest.Mock;
  setNextRead: jest.Mock;
};

const READS_KEY = ['library-history-reads-book', 'actor', 'book-1'];
const READS_USER_KEY = ['library-history-reads-user', 'actor'];
const OPEN_READS_KEY = ['library-history-open-reads', 'actor'];
const LIBRARY_KEY = ['library'];
const BOOK_KEY = ['book', 'actor', 'book-1'];

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useBookReadingHistory('actor', 'book-1'), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.readsForBook.mockResolvedValue([]);
  gateway.updateReadDates.mockResolvedValue({ id: 'read-1' });
  gateway.removeRead.mockResolvedValue(true);
  gateway.startReread.mockResolvedValue('read-2');
  gateway.reopenRead.mockResolvedValue(undefined);
  gateway.settings.mockResolvedValue(null);
  gateway.readsForUser.mockResolvedValue([]);
  gateway.setNextRead.mockResolvedValue({ user_id: 'actor', next_read_user_book_id: null });
});

describe('useBookReadingHistory', () => {
  it('loads the reads for this book', async () => {
    const { result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.reads.isSuccess).toBe(true));
      expect(gateway.readsForBook).toHaveBeenCalledWith('actor', 'book-1', expect.anything());
      expect(result.current.reads.data).toEqual([]);
    } finally {
      unmount();
    }
  });

  it('invalidates reads, library list and book detail after editDates', async () => {
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.reads.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.editDates.mutateAsync({ readId: 'read-1', patch: { started_on: '2026-10-01' } });
      });
      expect(gateway.updateReadDates).toHaveBeenCalledWith('actor', 'read-1', { started_on: '2026-10-01' });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_USER_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: OPEN_READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: LIBRARY_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BOOK_KEY });
    } finally {
      unmount();
      client.clear();
    }
  });

  it('invalidates reads, library list and book detail after removeRead', async () => {
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.reads.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.removeRead.mutateAsync('read-1');
      });
      expect(gateway.removeRead).toHaveBeenCalledWith('actor', 'read-1');
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_USER_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: OPEN_READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: LIBRARY_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BOOK_KEY });
    } finally {
      unmount();
      client.clear();
    }
  });

  it('invalidates reads, library list and book detail after startReread', async () => {
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.reads.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.startReread.mutateAsync();
      });
      expect(gateway.startReread).toHaveBeenCalledWith('actor', 'book-1');
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_USER_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: OPEN_READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: LIBRARY_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BOOK_KEY });
    } finally {
      unmount();
      client.clear();
    }
  });

  it('invalidates reads, library list and book detail after reopenRead', async () => {
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.reads.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.reopenRead.mutateAsync('read-1');
      });
      expect(gateway.reopenRead).toHaveBeenCalledWith('actor', 'read-1');
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_USER_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: OPEN_READS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: LIBRARY_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: BOOK_KEY });
    } finally {
      unmount();
      client.clear();
    }
  });
});
