import { useQuery } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { readingHistoryGateway } from './readingHistoryGateway';

/**
 * Stats-screen data (SDD-09 §4.7 H-17): one owner-filtered query for all of
 * the user's reads (page totals ride on the reads; no N+1), plus the user's
 * quote notes for the year-card picker. The yearly goal comes from
 * `useReadingGoal` (the single goal source); leave-out writes go through
 * `useLeaveOutStats` (the single invalidation path).
 */
export function useReadingStats(actorId: string, _year: number, enabled = true) {
  const reads = useQuery({
    queryKey: historyKeys.readsForUser(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.readsForUser(actorId, signal),
    enabled: !!actorId && enabled,
    retry: false,
  });

  const quotes = useQuery({
    queryKey: ['library-history-quotes', actorId] as const,
    queryFn: ({ signal }) => readingHistoryGateway.quotesForUser(actorId, signal),
    enabled: !!actorId && enabled,
    retry: false,
  });

  return { reads, quotes };
}
