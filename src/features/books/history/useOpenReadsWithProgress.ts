import { useQuery } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { readingHistoryGateway } from './readingHistoryGateway';

/**
 * Open reads with their book title and latest progress entry (SDD-09 §4.5 H-12).
 * The key extends the dedicated `openReads` key with a `with-progress` segment,
 * so every existing invalidation of `openReads` (status changes, rereads,
 * progress saves) also refreshes this query via prefix matching.
 */
export function useOpenReadsWithProgress(actorId: string) {
  return useQuery({
    queryKey: [...historyKeys.openReads(actorId), 'with-progress'],
    queryFn: ({ signal }) => readingHistoryGateway.openReadsWithProgress(actorId, signal),
    enabled: !!actorId,
    retry: false,
  });
}
