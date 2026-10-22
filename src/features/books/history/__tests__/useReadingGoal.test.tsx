jest.mock('../readingHistoryGateway', () => ({
  readingHistoryGateway: { goal: jest.fn(), setGoal: jest.fn(), readsForUser: jest.fn() },
}));

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useReadingGoal } from '../useReadingGoal';
import { readingHistoryGateway } from '../readingHistoryGateway';

const gateway = readingHistoryGateway as unknown as {
  goal: jest.Mock;
  setGoal: jest.Mock;
  readsForUser: jest.Mock;
};

function setup(year = 2026) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useReadingGoal('actor', year), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  gateway.goal.mockResolvedValue(null);
  gateway.setGoal.mockResolvedValue(null);
  gateway.readsForUser.mockResolvedValue([]);
});

describe('useReadingGoal', () => {
  it('loads the goal for the actor and year', async () => {
    const { result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.goal.isSuccess).toBe(true));
      expect(gateway.goal).toHaveBeenCalledWith('actor', 2026, expect.anything());
    } finally {
      unmount();
    }
  });

  it('writes through setGoal and invalidates the goal and user reads', async () => {
    gateway.setGoal.mockResolvedValue({
      user_id: 'actor',
      year: 2026,
      target_books: 24,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    const { client, result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.goal.isSuccess).toBe(true));
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      await act(async () => {
        await result.current.setGoal.mutateAsync(24);
      });
      expect(gateway.setGoal).toHaveBeenCalledWith('actor', 2026, 24);
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['library-history-goal', 'actor', 2026],
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library-history-reads-user', 'actor'] });
    } finally {
      unmount();
    }
  });

  it('deletes through setGoal(null)', async () => {
    const { result, unmount } = setup();
    try {
      await waitFor(() => expect(result.current.goal.isSuccess).toBe(true));
      await act(async () => {
        await result.current.setGoal.mutateAsync(null);
      });
      expect(gateway.setGoal).toHaveBeenCalledWith('actor', 2026, null);
    } finally {
      unmount();
    }
  });
});
