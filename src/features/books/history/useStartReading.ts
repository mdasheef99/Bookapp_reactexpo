import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { historyKeys } from './readingHistoryContract';
import { booksService } from '@/features/books/services/booksService';
import { useBookFeedback } from '@/components/library/ui';
import { notifySaveSuccess } from './saveConfirmation';

/**
 * One start-reading path (SDD-09 §4.6 H-14/H-15, H-12).
 * Status write via `booksService.updateReadingStatus(..., 'reading')`
 * with the shared invalidation list, an in-flight guard and a Retry toast.
 */
export function useStartReading(actorId: string) {
  const client = useQueryClient();
  const { notify } = useBookFeedback();
  const guard = useRef(false);

  const mutation = useMutation({
    mutationFn: (userBookId: string) => booksService.updateReadingStatus(userBookId, 'reading'),
    onSuccess: (_data, userBookId) => {
      void client.invalidateQueries({ queryKey: ['library'] });
      void client.invalidateQueries({ queryKey: historyKeys.readsForBook(actorId, userBookId) });
      void client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
      void client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
      void client.invalidateQueries({ queryKey: historyKeys.settings(actorId) });
      void client.invalidateQueries({ queryKey: ['book', actorId] });
    },
  });

  const start = useCallback(
    (userBookId: string) => {
      if (!userBookId || guard.current || mutation.isPending) return Promise.resolve(null);
      guard.current = true;
      const attempt = () =>
        mutation.mutateAsync(userBookId).then(
          (saved) => {
            guard.current = false;
            notifySaveSuccess(notify, 'Started reading');
            return saved;
          },
          (error: unknown) => {
            guard.current = false;
            const retryId = userBookId;
            notify({
              kind: 'error',
              message: error instanceof Error ? error.message : "Couldn't update your reading.",
              action: {
                label: 'Retry',
                onPress: () => {
                  if (guard.current || mutation.isPending) return;
                  void start(retryId);
                },
              },
            });
            throw error;
          },
        );
      return attempt().catch(() => {
        guard.current = false;
        return null;
      });
    },
    [mutation, notify],
  );

  return { start, isPending: mutation.isPending };
}
