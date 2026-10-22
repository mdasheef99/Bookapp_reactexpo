import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { ProgressValue, readingHistoryGateway } from './readingHistoryGateway';

/**
 * Progress entries for one read (SDD-09 §4.5, Unit 3a).
 * Mutations invalidate the read's progress plus the actor's read sets and the
 * library/book caches the Book Details screen already uses, so totals and bars
 * refresh together. The book key is unknown here, so book-scoped keys are
 * invalidated by actor prefix.
 */
export function useReadProgress(actorId: string, readId: string, enabled = true) {
  const client = useQueryClient();

  const progress = useQuery({
    queryKey: historyKeys.progressForRead(actorId, readId),
    queryFn: ({ signal }) => readingHistoryGateway.progressForRead(actorId, readId, signal),
    enabled: !!actorId && !!readId && enabled,
  });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: historyKeys.progressForRead(actorId, readId) });
    void client.invalidateQueries({ queryKey: ['library-history-reads-book', actorId] });
    void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
    void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
    void client.invalidateQueries({ queryKey: ['library'] });
    void client.invalidateQueries({ queryKey: ['book', actorId] });
  };

  const addProgress = useMutation({
    mutationFn: (value: ProgressValue) => readingHistoryGateway.addProgress(actorId, readId, value),
    onSuccess: invalidate,
  });

  const setTotalPages = useMutation({
    mutationFn: (totalPages: number | null) =>
      readingHistoryGateway.setTotalPages(actorId, readId, totalPages),
    onSuccess: invalidate,
  });

  return { progress, addProgress, setTotalPages };
}
