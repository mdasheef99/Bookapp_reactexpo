import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { ReadDatesPatch, readingHistoryGateway } from './readingHistoryGateway';

/**
 * Reads for one book plus the Unit 2a mutations (SDD-09 §4.3),
 * the Unit 4 next-read settings (H-15) and the full user read set
 * used for the finish-year count (H-14).
 * After every successful mutation the book's reads and the library book
 * list/detail queries the Book Details screen already uses are invalidated.
 */
export function useBookReadingHistory(actorId: string, userBookId: string, enabled = true) {
  const client = useQueryClient();

  const reads = useQuery({
    queryKey: historyKeys.readsForBook(actorId, userBookId),
    queryFn: ({ signal }) => readingHistoryGateway.readsForBook(actorId, userBookId, signal),
    enabled: !!actorId && !!userBookId && enabled,
  });

  const settings = useQuery({
    queryKey: historyKeys.settings(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.settings(actorId, signal),
    enabled: !!actorId && enabled,
    retry: false,
  });

  const allReads = useQuery({
    queryKey: historyKeys.readsForUser(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.readsForUser(actorId, signal),
    enabled: !!actorId && enabled,
    retry: false,
  });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: historyKeys.readsForBook(actorId, userBookId) });
    void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
    void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
    void client.invalidateQueries({ queryKey: historyKeys.settings(actorId) });
    void client.invalidateQueries({ queryKey: ['library-history-goal', actorId] });
    void client.invalidateQueries({ queryKey: ['library-history-quotes', actorId] });
    void client.invalidateQueries({ queryKey: ['library'] });
    void client.invalidateQueries({ queryKey: ['book', actorId, userBookId] });
    void client.invalidateQueries({ queryKey: ['book', actorId] });
  };

  const editDates = useMutation({
    mutationFn: ({ readId, patch }: { readId: string; patch: ReadDatesPatch }) =>
      readingHistoryGateway.updateReadDates(actorId, readId, patch),
    onSuccess: invalidate,
  });

  const removeRead = useMutation({
    mutationFn: (readId: string) => readingHistoryGateway.removeRead(actorId, readId),
    onSuccess: invalidate,
  });

  const startReread = useMutation({
    mutationFn: () => readingHistoryGateway.startReread(actorId, userBookId),
    onSuccess: invalidate,
  });

  const reopenRead = useMutation({
    mutationFn: (readId: string) => readingHistoryGateway.reopenRead(actorId, readId),
    onSuccess: invalidate,
  });

  const setNextRead = useMutation({
    mutationFn: (nextBookId: string | null) => readingHistoryGateway.setNextRead(actorId, nextBookId),
    onSuccess: invalidate,
  });

  return { reads, editDates, removeRead, startReread, reopenRead, settings, allReads, setNextRead };
}
