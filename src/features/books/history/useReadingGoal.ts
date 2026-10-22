import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { readingHistoryGateway } from './readingHistoryGateway';

/**
 * Yearly goal read + write (SDD-09 §4.7 H-16): the single goal source for
 * `GoalSummary` and the stats screen.
 * `setGoal` with `null` deletes the row. Also exposes the user read set the
 * Home summary derives its count from. Invalidates the goal key plus the
 * user read set.
 */
export function useReadingGoal(actorId: string, year: number, enabled = true) {
  const client = useQueryClient();

  const goal = useQuery({
    queryKey: historyKeys.goal(actorId, year),
    queryFn: ({ signal }) => readingHistoryGateway.goal(actorId, year, signal),
    enabled: !!actorId && Number.isInteger(year) && enabled,
    retry: false,
  });

  const reads = useQuery({
    queryKey: historyKeys.readsForUser(actorId),
    queryFn: ({ signal }) => readingHistoryGateway.readsForUser(actorId, signal),
    enabled: !!actorId && enabled,
    retry: false,
  });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: historyKeys.goal(actorId, year) });
    void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
  };

  const setGoal = useMutation({
    mutationFn: (target: number | null) => readingHistoryGateway.setGoal(actorId, year, target),
    onSuccess: invalidate,
  });

  return { goal, reads, setGoal };
}
