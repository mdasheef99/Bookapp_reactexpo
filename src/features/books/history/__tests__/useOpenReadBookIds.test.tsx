jest.mock('../readingHistoryGateway', () => ({
  readingHistoryGateway: { openReadBookIds: jest.fn() },
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useOpenReadBookIds } from '../useOpenReadBookIds';
import { readingHistoryGateway } from '../readingHistoryGateway';
import { historyKeys } from '../readingHistoryContract';

const gateway = readingHistoryGateway as unknown as { openReadBookIds: jest.Mock };

function setup(actorId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useOpenReadBookIds(actorId), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.openReadBookIds.mockResolvedValue([]);
});

describe('useOpenReadBookIds', () => {
  it('returns the open-read book ids from the dedicated gateway query', async () => {
    gateway.openReadBookIds.mockResolvedValue(['book-1', 'book-4']);
    const { result, unmount } = setup('actor');
    try {
      await waitFor(() => expect(gateway.openReadBookIds).toHaveBeenCalledWith('actor', expect.anything()));
      await waitFor(() => expect(result.current.size).toBe(2));
      expect(result.current.has('book-1')).toBe(true);
      expect(result.current.has('book-4')).toBe(true);
      expect(result.current.has('book-2')).toBe(false);
    } finally {
      unmount();
    }
  });

  it('returns an empty set when there are no open reads', async () => {
    gateway.openReadBookIds.mockResolvedValue([]);
    const { result, unmount } = setup('actor');
    try {
      await waitFor(() => expect(gateway.openReadBookIds).toHaveBeenCalled());
      await waitFor(() => expect(result.current.size).toBe(0));
    } finally {
      unmount();
    }
  });

  it('queries the dedicated openReads key so shelf outlines refresh with history', async () => {
    const { result, unmount } = setup('actor');
    try {
      await waitFor(() => expect(gateway.openReadBookIds).toHaveBeenCalled());
      expect(historyKeys.openReads('actor')).toEqual(['library-history-open-reads', 'actor']);
      expect(result.current.size).toBe(0);
    } finally {
      unmount();
    }
  });

  it('does not fetch without an actor', async () => {
    const { result, unmount } = setup('');
    try {
      await waitFor(() => expect(result.current.size).toBe(0));
      expect(gateway.openReadBookIds).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
