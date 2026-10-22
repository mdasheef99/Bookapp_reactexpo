import { useMutation, useQueryClient } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { readingHistoryGateway } from './readingHistoryGateway';

/**
 * "Leave out of my stats" write (SDD-09 §4.7 H-17): the single invalidation
 * path for `counts_in_stats`. One owner-filtered update sets the flag on
 * every read of the book; the database trigger copies it to later reads.
 * Invalidates the book reads, the user read set the stats/goal counts derive
 * from, open reads, goal and quote queries plus the library/book caches.
 */
export function useLeaveOutStats(actorId: string, userBookId: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (value: boolean) =>
      readingHistoryGateway.setCountsInStats(actorId, userBookId, value),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: historyKeys.readsForBook(actorId, userBookId) });
      void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
      void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
      void client.invalidateQueries({ queryKey: ['library-history-goal', actorId] });
      void client.invalidateQueries({ queryKey: ['library-history-quotes', actorId] });
      void client.invalidateQueries({ queryKey: ['library'] });
      void client.invalidateQueries({ queryKey: ['book', actorId] });
    },
  });
}
