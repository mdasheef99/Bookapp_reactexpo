import { useId, useRef } from 'react';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';

import {
  bookReviewService,
  currentReviewActor,
  isCurrentReviewActor,
  type BookReviewFields,
  type ReviewActor,
  type ReviewPatch,
} from '@/features/books/services/bookReviewService';
import { useBookFeedback } from '@/components/library/ui';
import {
  notifySaveSuccess,
  ratingSavedMessage,
  reviewSaveFailedMessage,
  reviewSavedMessage,
} from '@/features/books/history/saveConfirmation';
import { historyKeys } from '@/features/books/history/readingHistoryContract';

export interface ReviewWriteOptions {
  /** Skip the success toast (used when one Save writes several fields). */
  silent?: boolean;
  /** Rebuild the patch at retry time so Try again uses the current draft. */
  getRetryPatch?: () => ReviewPatch;
}

export type ReviewSubmission = {
  actor: ReviewActor;
  entryId: string;
  patch: ReviewPatch;
  editorId: string;
  requestId: string;
  textRevision: number;
  silent?: boolean;
  getRetryPatch?: () => ReviewPatch;
};

export interface UseReviewWriteInput {
  userId?: string;
  bookId?: string;
}

/**
 * Shared review mutation (SDD-07 §14).
 * Both Book Details (rating) and the review page (text + visibility) use the
 * same mutation key so caches stay consistent.
 *
 * Guarantees (moved from Book Details draft logic):
 * - a save from a previous user/session is never applied to the current one;
 * - a late save never overwrites newer local work (callers keep dirty local
 *   state; success only writes the confirmed server row into the cache).
 */
export function useReviewWrite({ userId, bookId }: UseReviewWriteInput) {
  const { notify } = useBookFeedback();
  const queryClient = useQueryClient();
  const editorId = useId();
  const requestSequence = useRef(0);
  const textRevision = useRef(0);

  const reviewActor = currentReviewActor(userId);
  const reviewMutationKey = ['book-review', userId, bookId, reviewActor?.revision];

  const observed = useMutationState({
    filters: { mutationKey: ['book-review'] },
    select: (mutation) => ({
      submission: mutation.state.variables as ReviewSubmission | undefined,
      status: mutation.state.status,
    }),
  });
  const reviewWrites = observed.filter(
    ({ submission }) =>
      !!submission &&
      submission.actor.id === reviewActor?.id &&
      submission.actor.revision === reviewActor?.revision &&
      submission.entryId === bookId,
  );
  const reviewBusy = reviewWrites.some((write) => write.status === 'pending');

  const mutation = useMutation<BookReviewFields, unknown, ReviewSubmission>({
    mutationKey: reviewMutationKey,
    scope: { id: `book-review:${userId}:${bookId}:${reviewActor?.revision}` },
    mutationFn: ({ actor, entryId, patch }: ReviewSubmission) =>
      bookReviewService.update(actor, entryId, patch),
    onSuccess: async (confirmed, submission) => {
      if (!isCurrentReviewActor(submission.actor)) return;
      const key = ['book', submission.actor.id, submission.entryId];
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!isCurrentReviewActor(submission.actor)) return;
      queryClient.setQueryData<typeof confirmed>(key, (previous) =>
        previous ? { ...previous, ...confirmed } : previous,
      );
      if (!isCurrentReviewActor(submission.actor)) return;
      if (submission.silent) return;
      if (typeof submission.patch.rating === 'number') {
        notifySaveSuccess(notify, ratingSavedMessage());
      } else if (typeof submission.patch.review === 'string') {
        notifySaveSuccess(notify, reviewSavedMessage(submission.patch.review === ''));
      } else {
        notifySaveSuccess(notify, reviewSavedMessage(false));
      }
    },
    onError: (error: unknown, submission) => {
      if (!isCurrentReviewActor(submission.actor)) return;
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : reviewSaveFailedMessage();
      notify({
        kind: 'error',
        message,
        action: {
          label: 'Try again',
          onPress: () => {
            if (!isCurrentReviewActor(submission.actor)) return;
            mutation.mutate({
              ...submission,
              patch: submission.getRetryPatch?.() ?? submission.patch,
              requestId: `${submission.editorId}:${++requestSequence.current}`,
            });
          },
        },
      });
    },
    onSettled: (_data, _error, submission) => {
      if (!isCurrentReviewActor(submission.actor)) return;
      const key = ['book', submission.actor.id, submission.entryId];
      if (
        queryClient.isMutating({
          mutationKey: ['book-review', submission.actor.id, submission.entryId, submission.actor.revision],
          exact: true,
        }) === 1
      ) {
        queryClient.invalidateQueries({ queryKey: ['library'] });
        queryClient.invalidateQueries({ queryKey: key, exact: true });
        queryClient.invalidateQueries({ queryKey: historyKeys.readsForBook(submission.actor.id, submission.entryId) });
        queryClient.invalidateQueries({ queryKey: historyKeys.readsForUser(submission.actor.id) });
        queryClient.invalidateQueries({ queryKey: historyKeys.openReads(submission.actor.id) });
        queryClient.invalidateQueries({ queryKey: historyKeys.settings(submission.actor.id) });
        const catalogueId = queryClient.getQueryData<BookReviewFields & { book_id?: string }>(key)?.book_id;
        if (catalogueId) queryClient.invalidateQueries({ queryKey: ['book-public-reviews', catalogueId] });
      }
    },
  });

  const submitReview = (patch: ReviewPatch, opts?: ReviewWriteOptions) => {
    if (!bookId || !reviewActor || !isCurrentReviewActor(reviewActor)) return;
    if (typeof patch.review === 'string') textRevision.current += 1;
    const submission: ReviewSubmission = {
      actor: reviewActor,
      entryId: bookId,
      patch,
      editorId,
      requestId: `${editorId}:${++requestSequence.current}`,
      textRevision: textRevision.current,
      silent: opts?.silent,
      getRetryPatch: opts?.getRetryPatch,
    };
    mutation.mutate(submission);
  };

  const submitReviewAsync = async (patch: ReviewPatch, opts?: ReviewWriteOptions) => {
    if (!bookId || !reviewActor || !isCurrentReviewActor(reviewActor)) {
      throw new Error('Sign in again to save review changes.');
    }
    if (typeof patch.review === 'string') textRevision.current += 1;
    const submission: ReviewSubmission = {
      actor: reviewActor,
      entryId: bookId,
      patch,
      editorId,
      requestId: `${editorId}:${++requestSequence.current}`,
      textRevision: textRevision.current,
      silent: opts?.silent,
      getRetryPatch: opts?.getRetryPatch,
    };
    return mutation.mutateAsync(submission);
  };

  return { actor: reviewActor, reviewMutationKey, reviewBusy, mutation, submitReview, submitReviewAsync };
}
