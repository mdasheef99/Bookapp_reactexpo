jest.mock('../readingHistoryGateway', () => ({
  readingHistoryGateway: {
    progressForRead: jest.fn(),
    addProgress: jest.fn(),
    setTotalPages: jest.fn(),
  },
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useReadProgress } from '../useReadProgress';
import { readingHistoryGateway } from '../readingHistoryGateway';

const gateway = readingHistoryGateway as unknown as {
  progressForRead: jest.Mock;
  addProgress: jest.Mock;
  setTotalPages: jest.Mock;
};

const PROGRESS_KEY = ['library-history-progress', 'actor', 'read-1'];
const READS_BOOK_PREFIX = ['library-history-reads-book', 'actor'];
const READS_USER_KEY = ['library-history-reads-user', 'actor'];

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useReadProgress('actor', 'read-1'), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.progressForRead.mockResolvedValue([]);
  gateway.addProgress.mockResolvedValue({ id: 'progress-1' });
  gateway.setTotalPages.mockResolvedValue({ id: 'read-1' });
});

describe('useReadProgress', () => {
  it('loads progress for the read with the scoped key', async () => {
    const { result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.progress.isSuccess).toBe(true));
      expect(gateway.progressForRead).toHaveBeenCalledWith('actor', 'read-1', expect.anything());
      expect(result.current.progress.data).toEqual([]);
    } finally {
      unmount();
    }
  });

  it('invalidates the progress key and the book reads after addProgress', async () => {
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.progress.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.addProgress.mutateAsync({ page: 142 });
      });
      expect(gateway.addProgress).toHaveBeenCalledWith('actor', 'read-1', { page: 142 });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: PROGRESS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_BOOK_PREFIX });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_USER_KEY });
    } finally {
      unmount();
      client.clear();
    }
  });

  it('invalidates the progress key and the book reads after setTotalPages', async () => {
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.progress.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.setTotalPages.mutateAsync(400);
      });
      expect(gateway.setTotalPages).toHaveBeenCalledWith('actor', 'read-1', 400);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: PROGRESS_KEY });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_BOOK_PREFIX });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: READS_USER_KEY });
    } finally {
      unmount();
      client.clear();
    }
  });
});
