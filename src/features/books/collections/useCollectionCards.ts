import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { NoteDeckCard } from '../notes/manualNoteContract';
import { loadDeckCards } from '../notes/noteDeckCache';
import { captureOrganisingActor } from '../organising/organisingGateway';
import { NOTE_SWIPE } from '../notes/noteSwipeConstants';

export function useCollectionCards(actor: string, id: string, ids: readonly string[], enabled: boolean) {
  const client = useQueryClient();
  // The query key stays stable while the membership ids change, so removing a
  // note keeps the loaded pages on screen instead of resetting to a fresh
  // "Loading collection…" query per id-set. The effect below prunes removed
  // ids from the cached pages; the screen also filters by the live ids.
  const key = useMemo(() => ['library-note-deck', actor, 'collection-cards', id] as const, [actor, id]);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  useEffect(() => {
    if (!actor || !id) return;
    const wanted = new Set(ids);
    client.setQueryData<{ pages: NoteDeckCard[][] }>(key, previous => {
      if (!previous) return previous;
      const pages = previous.pages.map(page => page.filter(card => wanted.has(card.note.id)));
      if (pages.every((page, index) => page.length === previous.pages[index].length)) return previous;
      return { ...previous, pages };
    });
  }, [client, key, ids, actor, id]);
  const query = useInfiniteQuery({ queryKey: key, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const guard = captureOrganisingActor(actor); guard();
      const cards = await loadDeckCards(client, actor, idsRef.current.slice(pageParam, pageParam + NOTE_SWIPE.batchSize), signal); guard(); return cards;
    },
    getNextPageParam: (_last, pages) => {
      const loaded = pages.flat().length;
      return loaded < idsRef.current.length ? loaded : undefined;
    },
    enabled: !!actor && enabled && ids.length > 0, retry: false,
  });
  return query;
}
