jest.mock('../readingHistoryGateway', () => ({
  readingHistoryGateway: { openReadsWithProgress: jest.fn() },
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useOpenReadsWithProgress } from '../useOpenReadsWithProgress';
import { readingHistoryGateway } from '../readingHistoryGateway';
import { historyKeys } from '../readingHistoryContract';

const gateway = readingHistoryGateway as unknown as { openReadsWithProgress: jest.Mock };

function setup(actorId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useOpenReadsWithProgress(actorId), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.openReadsWithProgress.mockResolvedValue([]);
});

describe('useOpenReadsWithProgress', () => {
  it('loads open reads with titles and latest progress', async () => {
    const rows = [
      { read: { id: 'read-1' }, bookTitle: 'Walden', latestProgress: { id: 'progress-1' } },
    ];
    gateway.openReadsWithProgress.mockResolvedValue(rows);
    const { result, unmount } = setup('actor');
    try {
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(gateway.openReadsWithProgress).toHaveBeenCalledWith('actor', expect.anything());
      expect(result.current.data).toEqual(rows);
    } finally {
      unmount();
    }
  });

  it('uses an open-reads-derived key so history invalidations refresh it', async () => {
    const { client, result, unmount } = setup('actor');
    try {
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
      expect(historyKeys.openReads('actor')).toEqual(['library-history-open-reads', 'actor']);
      const key = result.current.data !== undefined ? client.getQueryCache().findAll().map((entry) => entry.queryKey) : [];
      expect(key.some((queryKey) => Array.isArray(queryKey) && queryKey[0] === 'library-history-open-reads' && queryKey[1] === 'actor')).toBe(true);
      gateway.openReadsWithProgress.mockClear();
      await client.invalidateQueries({ queryKey: historyKeys.openReads('actor') });
      await waitFor(() => expect(gateway.openReadsWithProgress).toHaveBeenCalledTimes(1));
      expect(gateway.openReadsWithProgress).toHaveBeenCalledWith('actor', expect.anything());
    } finally {
      unmount();
    }
  });

  it('does not fetch without an actor', async () => {
    const { result, unmount } = setup('');
    try {
      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(gateway.openReadsWithProgress).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
