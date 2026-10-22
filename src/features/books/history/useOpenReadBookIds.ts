import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { readingHistoryGateway } from './readingHistoryGateway';

/**
 * Open-read set for the shelf reading outline (SDD-09 §4.3 H-06).
 * Dedicated `openReads` query (server filters `outcome = 'reading'`,
 * at most one per book). Invalidated wherever `readsForUser` is invalidated.
 */
export function useOpenReadBookIds(actorId: string): Set<string> {
  const { data } = useQuery({
    queryKey: historyKeys.openReads(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.openReadBookIds(actorId, signal),
    enabled: !!actorId,
    retry: false,
  });
  return React.useMemo(() => new Set<string>(data ?? []), [data]);
}
