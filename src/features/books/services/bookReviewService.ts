import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';

export type ReviewActor = Readonly<{ id: string; revision: number }>;
export type ReviewPatch = { review: string; rating?: never; review_is_public?: never }
  | { rating: number; review?: never; review_is_public?: never }
  | { review_is_public: boolean; review?: never; rating?: never };
export type BookReviewFields = { id: string; user_id: string; rating: number | null; review: string | null; review_is_public: boolean | null };

// Account identity, including A -> logout -> A, changes the lifetime of queued work.
// Refreshing the token for the same authenticated actor does not.
let identityRevision = 0;
useAuthStore.subscribe((state, previous) => {
  if (state.session?.user.id !== previous.session?.user.id ||
      (state.status === 'authenticated') !== (previous.status === 'authenticated')) identityRevision++;
});

export function currentReviewActor(id?: string): ReviewActor | null {
  const state = useAuthStore.getState();
  return id && state.status === 'authenticated' && state.session?.user.id === id
    ? { id, revision: identityRevision } : null;
}
export function isCurrentReviewActor(actor: ReviewActor) {
  const current = currentReviewActor(actor.id);
  return current?.revision === actor.revision;
}
function requireActor(actor: ReviewActor) {
  if (!isCurrentReviewActor(actor)) throw new Error('Sign in again to save review changes.');
  const session = useAuthStore.getState().session!;
  if (!session.access_token) throw new Error('Sign in again to save review changes.');
  return session;
}

export const bookReviewService = {
  async update(actor: ReviewActor, entryId: string, patch: ReviewPatch): Promise<BookReviewFields> {
    const session = requireActor(actor);
    const keys = Object.keys(patch);
    const valid = keys.length === 1 && (
      (keys[0] === 'review' && typeof patch.review === 'string') ||
      (keys[0] === 'rating' && Number.isInteger(patch.rating) && patch.rating! >= 0 && patch.rating! <= 5) ||
      (keys[0] === 'review_is_public' && typeof patch.review_is_public === 'boolean'));
    if (!entryId || !valid) throw new Error('Invalid review change.');

    const controller = new AbortController();
    const unsubscribe = useAuthStore.subscribe(() => {
      if (!isCurrentReviewActor(actor)) controller.abort();
    });
    try {
      const { data, error } = await supabase.from('user_books').update(patch)
        .eq('id', entryId).eq('user_id', actor.id)
        .select('id,user_id,rating,review,review_is_public').abortSignal(controller.signal).single()
        // Do not let a later shared-client session supply this request's credentials.
        .setHeader('Authorization', `Bearer ${session.access_token}`);
      requireActor(actor);
      if (error) throw error;
      if (!data || data.id !== entryId || data.user_id !== actor.id ||
          !(data.rating === null || (Number.isInteger(data.rating) && data.rating >= 0 && data.rating <= 5)) ||
          !(data.review === null || typeof data.review === 'string') ||
          !(data.review_is_public === null || typeof data.review_is_public === 'boolean')) {
        throw new Error('Could not confirm that your review change was saved.');
      }
      return data as BookReviewFields;
    } finally {
      unsubscribe();
    }
  },
};
