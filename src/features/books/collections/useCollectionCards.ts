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
  // Each pageParam is the exact id batch requested for that page. The next
  // batch is the live ids excluding every already-requested id (a consumed-id
  // Set), never the loaded-card count, so a short/dropped page, a prune, or a
  // membership shift cannot re-request ids or skip members. A newly added id
  // is fetched and prepended in live (newest-added-first) order without
  // resetting pages. Returned pages are deduped by note id.
  const key = useMemo(() => ['library-note-deck', actor, 'collection-cards', id] as const, [actor, id]);
  // The screen builds a fresh array on every render, so the effect must depend
  // on a stable content signature, not the array identity: depending on `ids`
  // re-ran this effect after every render, and the unconditional cache write
  // below notified the observer (TanStack setQueryData dispatches even when the
  // updater returns the identical data), re-rendering the screen with another
  // fresh array — a render -> effect -> cache-write -> render loop that crashed
  // the phone with "Maximum update depth exceeded".
  const idsKey = JSON.stringify(ids);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const prevIdsRef = useRef<readonly string[]>(ids);
  const initialBatchRef = useRef<readonly string[] | null>(null);
  if (initialBatchRef.current === null) initialBatchRef.current = ids.slice(0, NOTE_SWIPE.batchSize);
  useEffect(() => {
    if (!actor || !id) return;
    const live = idsRef.current;
    const prevSet = new Set(prevIdsRef.current);
    prevIdsRef.current = live;
    const wanted = new Set(live);
    const addedIds = live.filter(noteId => !prevSet.has(noteId));
    // Read-only cache inspection never notifies observers, so this check
    // cannot start a loop. Skip the write entirely when the cached pages
    // already match the live memberships: the old code called setQueryData on
    // every run, and even a no-op updater return still dispatches.
    const cached = client.getQueryData<{ pages: NoteDeckCard[][]; pageParams: readonly string[][] }>(key);
    let needsPrune = false;
    if (cached) {
      const seen = new Set<string>();
      outer: for (const page of cached.pages) {
        for (const card of page) {
          if (!wanted.has(card.note.id) || seen.has(card.note.id)) { needsPrune = true; break outer; }
          seen.add(card.note.id);
        }
      }
    }
    if (!needsPrune && addedIds.length === 0) return;
    if (needsPrune) {
      client.setQueryData<{ pages: NoteDeckCard[][]; pageParams: readonly string[][] }>(key, previous => {
        if (!previous) return previous;
        const seen = new Set<string>();
        let changed = false;
        const pages = previous.pages.map(page => {
          const next = page.filter(card => {
            if (!wanted.has(card.note.id)) { changed = true; return false; }
            if (seen.has(card.note.id)) { changed = true; return false; }
            seen.add(card.note.id);
            return true;
          });
          if (next.length !== page.length) changed = true;
          return next;
        });
        if (!changed) return previous;
        return { ...previous, pages };
      });
    }
    // A newly added membership id (e.g. another device) is not in the loaded
    // pages. Fetch it and prepend in live order with the stable key: cached
    // cards stay on screen while fetching (no "Loading…" reset).
    if (addedIds.length > 0 && enabled) {
      const cached = client.getQueryData<{ pages: NoteDeckCard[][]; pageParams: readonly string[][] }>(key);
      if (cached && cached.pages.length > 0) {
        void (async () => {
          try {
            const guard = captureOrganisingActor(actor);
            guard();
            const controller = new AbortController();
            const cards = await loadDeckCards(client, actor, addedIds.slice(0, NOTE_SWIPE.batchSize * 2), controller.signal);
            guard();
            client.setQueryData<{ pages: NoteDeckCard[][]; pageParams: readonly string[][] }>(key, previous => {
              if (!previous) return previous;
              const liveWanted = new Set(idsRef.current);
              const existing = new Set(previous.pages.flat().map(card => card.note.id));
              const fresh = cards.filter(card => liveWanted.has(card.note.id) && !existing.has(card.note.id));
              const requested = new Set((previous.pageParams ?? []).flat());
              const missingToRecord = addedIds.filter(noteId => !requested.has(noteId) && !existing.has(noteId) && !fresh.some(card => card.note.id === noteId));
              if (fresh.length === 0 && missingToRecord.length === 0) return previous;
              const pages = previous.pages.length === 0 ? (fresh.length ? [fresh] : []) : previous.pages.map((page, index) => (index === 0 ? [...fresh, ...page] : page));
              const nextParams = (previous.pageParams ?? []).length === 0
                ? [addedIds]
                : (previous.pageParams ?? []).map((param, index) => (index === 0
                  ? [...addedIds.filter(noteId => !(param as readonly string[]).includes(noteId)), ...(param as readonly string[])]
                  : param));
              return { ...previous, pages, pageParams: nextParams as readonly string[][] };
            });
          } catch {
            // Transient: the next "Load more" recomputes live excluding
            // requested, so the new id is retried there without a loop.
          }
        })();
      }
    }
  }, [client, key, idsKey, actor, id, enabled]);
  const query = useInfiniteQuery({ queryKey: key, initialPageParam: initialBatchRef.current,
    queryFn: async ({ pageParam, signal }) => {
      const guard = captureOrganisingActor(actor); guard();
      const batch = (pageParam as readonly string[]).length ? (pageParam as readonly string[]) : idsRef.current.slice(0, NOTE_SWIPE.batchSize);
      const cards = await loadDeckCards(client, actor, batch, signal); guard(); return cards;
    },
    getNextPageParam: (_last, _pages, _lastParam, allParams) => {
      const requested = new Set((allParams as unknown as readonly string[][]).flat());
      const next = idsRef.current.filter(noteId => !requested.has(noteId)).slice(0, NOTE_SWIPE.batchSize);
      return next.length ? next : undefined;
    },
    select: data => {
      const seen = new Set<string>();
      let duplicate = false;
      for (const page of data.pages) {
        for (const card of page) {
          if (seen.has(card.note.id)) { duplicate = true; break; }
          seen.add(card.note.id);
        }
        if (duplicate) break;
      }
      if (!duplicate) return data;
      const filtered = new Set<string>();
      return { ...data, pages: data.pages.map(page => page.filter(card => {
        if (filtered.has(card.note.id)) return false;
        filtered.add(card.note.id);
        return true;
      })) };
    },
    enabled: !!actor && enabled && ids.length > 0, retry: false,
  });
  return query;
}
