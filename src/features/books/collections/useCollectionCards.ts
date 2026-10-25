import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { loadDeckCards } from '../notes/noteDeckCache';
import { captureOrganisingActor } from '../organising/organisingGateway';
import { NOTE_SWIPE } from '../notes/noteSwipeConstants';

export function useCollectionCards(actor: string, id: string, ids: readonly string[], enabled: boolean) {
  const client = useQueryClient();
  return useInfiniteQuery({ queryKey: ['library-note-deck', actor, 'collection-cards', id, ids], initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const guard = captureOrganisingActor(actor); guard();
      const cards = await loadDeckCards(client, actor, ids.slice(pageParam, pageParam + NOTE_SWIPE.batchSize), signal); guard(); return cards;
    },
    getNextPageParam: (_last, _pages, offset) => offset + NOTE_SWIPE.batchSize < ids.length ? offset + NOTE_SWIPE.batchSize : undefined,
    enabled: !!actor && enabled && ids.length > 0, retry: false,
  });
}
