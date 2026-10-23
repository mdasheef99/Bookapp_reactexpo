import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { NoteDeckCard, NoteDeckCategory, NoteDeckReturnState, NoteDeckScope, noteKeys } from './manualNoteContract';
import { manualNotesGateway } from './manualNotesGateway';
import { categoryDeck, deckOrder, noteDeckCategories, reconcilePosition, rememberPosition, DeckPositions } from './noteDeck';
import { loadDeckCards } from './noteDeckCache';
import { noteWasDeleted, retainDeckCards } from './useManualNotes';
import { NOTE_SWIPE } from './noteSwipeConstants';

export function useNoteDeckIndex(actorId: string, scope: NoteDeckScope, enabled = true) {
  return useQuery({ queryKey: noteKeys.deckIndex(actorId, scope), queryFn: ({ signal }) => manualNotesGateway.deckIndex(actorId, scope, signal),
    enabled: enabled && !!actorId && (scope.kind === 'all' || !!scope.userBookId), retry: false });
}
/** Reads a cached deck card without registering a fetch observer, so the swipe
 * surface never replaces the Home tile's active query function for the same key.
 * Subscribes to the query cache so seeded cards re-render. */
function useDeckCardData(client: QueryClient, actorId: string, id: string): NoteDeckCard | undefined {
  const getSnapshot = useCallback(
    () => (id ? client.getQueryData<NoteDeckCard>(noteKeys.deckCard(actorId, id)) : undefined),
    [client, actorId, id],
  );
  const subscribe = useCallback(
    (notify: () => void) => client.getQueryCache().subscribe(() => { notify(); }),
    [client],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
/** Fresh-mount fallback when the fallback noteId is gone (web reload → delete → return). */
function resolveInitialFallback(ids: readonly string[], initial: NoteDeckReturnState): string | null | undefined {
  if (!ids.length) return undefined;
  if (initial.nextId !== undefined) {
    if (initial.nextId === null) {
      if (typeof initial.at === 'number' && initial.at < ids.length) return ids[initial.at] ?? null;
      return null;
    }
    if (ids.includes(initial.nextId)) return initial.nextId;
  }
  if (typeof initial.at === 'number') {
    if (initial.at >= ids.length) return null;
    return ids[initial.at] ?? null;
  }
  return ids[0] ?? undefined;
}
export function useNoteDeck(actorId: string, initial: NoteDeckReturnState, enabled = true, retainCards = enabled) {
  const client = useQueryClient();
  const index = useNoteDeckIndex(actorId, initial.scope, enabled);
  const allRows = useMemo(() => (index.data ?? []).filter(row => !noteWasDeleted(client, actorId, row.user_book_id, row.id)), [index.data, index.isFetching, actorId, client]);
  const categories = useMemo(() => noteDeckCategories(allRows), [allRows]);
  const effectiveCategory: NoteDeckCategory = index.data === undefined ? initial.category : (categories.includes(initial.category) ? initial.category : 'all');
  const ordered = useMemo(() => deckOrder(categoryDeck(allRows, effectiveCategory), initial.order, initial.seed), [allRows, effectiveCategory, initial.order, initial.seed]);
  const ids = ordered.map(row => row.id);
  const signature = JSON.stringify(ids);
  const orderSeedKey = JSON.stringify([initial.order, initial.seed]);
  const categoryOrderSeedKey = JSON.stringify([effectiveCategory, initial.order, initial.seed]);
  const [positions, setPositions] = useState<DeckPositions>({});
  const idsByCategory = useRef<Record<string, readonly string[]>>({});
  const lastCategoryRef = useRef<NoteDeckCategory | null>(null);
  const lastOrderSeedRef = useRef<string | null>(null);
  const [position, setPosition] = useState<{ ids: string[]; selected: string | null | undefined; initialized: boolean }>({ ids: [], selected: initial.noteId === '' ? undefined : initial.noteId, initialized: false });
  // Synchronous per-category selection so a category/order switch never flashes a
  // wrong card: when the live category/order/seed differs from the last committed
  // baseline, derive the selection from the stored per-category position (or the
  // first card) instead of reconciling the old category's selection.
  const orderChanged = lastOrderSeedRef.current !== null && lastOrderSeedRef.current !== orderSeedKey;
  const categoryChanged = lastCategoryRef.current !== null && lastCategoryRef.current !== effectiveCategory;
  let selected: string | null | undefined;
  if (!position.initialized) {
    selected = initial.noteId === null ? null : initial.noteId === '' ? (ids[0] ?? undefined) : ids.includes(initial.noteId) ? initial.noteId : resolveInitialFallback(ids, initial);
  } else if (orderChanged) {
    selected = ids[0] ?? null;
    if (!ids.length) selected = undefined;
  } else if (categoryChanged) {
    const stored = positions[effectiveCategory];
    if (!ids.length) selected = undefined;
    else if (stored === undefined) selected = ids[0] ?? null;
    else selected = reconcilePosition(idsByCategory.current[effectiveCategory] ?? [], ids, stored);
  } else if (position.selected === undefined) {
    selected = ids[0] ?? undefined;
  } else {
    selected = reconcilePosition(position.ids, ids, position.selected);
  }
  // The empty noteId is the ordinary first-visit start; null represents an explicit end card.
  // undefined is the unset state: no selection recorded while ids is empty, so the first id is chosen once ids appear.
  const selection = !position.initialized && initial.noteId === '' ? (ids[0] ?? undefined) : selected;
  useEffect(() => {
    if (!index.data) return;
    // Order or seed changed: clear all stored per-category positions and restart
    // the current category at its first card.
    if (lastOrderSeedRef.current !== null && lastOrderSeedRef.current !== orderSeedKey) {
      idsByCategory.current = { [effectiveCategory]: ids };
      setPositions({});
      if (!ids.length) {
        setPosition(current => ({ ids: [], selected: undefined, initialized: true }));
      } else {
        setPosition({ ids, selected: ids[0] ?? null, initialized: true });
      }
      lastCategoryRef.current = effectiveCategory;
      lastOrderSeedRef.current = orderSeedKey;
      return;
    }
    // Category changed: store the old position, restore the new one.
    if (lastCategoryRef.current !== null && lastCategoryRef.current !== effectiveCategory) {
      const oldCategory = lastCategoryRef.current;
      const oldExposed: string | null | undefined = position.selected;
      const oldIdsForStore = position.ids;
      idsByCategory.current[oldCategory] = oldIdsForStore;
      const stored = positions[effectiveCategory];
      const prevIdsForNew = idsByCategory.current[effectiveCategory] ?? [];
      let restored: string | null | undefined;
      if (!ids.length) {
        restored = undefined;
      } else if (stored === undefined) {
        restored = ids[0] ?? null;
      } else {
        restored = reconcilePosition(prevIdsForNew, ids, stored);
      }
      setPositions(prev => rememberPosition(prev, oldCategory, oldExposed ?? null));
      idsByCategory.current[effectiveCategory] = ids;
      const nextSel = restored ?? null;
      setPosition(current => {
        if (current.initialized && JSON.stringify(current.ids) === signature && (current.selected ?? null) === (nextSel ?? null)) return current;
        return { ids, selected: ids.length ? nextSel : undefined, initialized: true };
      });
      lastCategoryRef.current = effectiveCategory;
      lastOrderSeedRef.current = orderSeedKey;
      return;
    }
    // First mount: record the category/order/seed baseline.
    if (lastCategoryRef.current === null) {
      lastCategoryRef.current = effectiveCategory;
      lastOrderSeedRef.current = orderSeedKey;
      idsByCategory.current[effectiveCategory] = ids;
    } else {
      idsByCategory.current[effectiveCategory] = ids;
    }
    if (!ids.length) {
      setPosition(current => current.ids.length === 0 && current.selected === undefined ? current : { ids: [], selected: undefined, initialized: current.initialized });
      return;
    }
    const nextSelection = selection ?? null;
    setPosition(current => current.initialized && JSON.stringify(current.ids) === signature && (current.selected ?? null) === (nextSelection ?? null) && current.selected !== undefined ? current : { ids, selected: nextSelection, initialized: true });
  }, [signature, categoryOrderSeedKey, orderSeedKey, index.data, selection, effectiveCategory]); // ids are represented by signature
  const exposed = selection ?? null;
  const at = exposed === null ? ids.length : ids.indexOf(exposed);
  const windowIds = ids.slice(Math.max(0, at), at + NOTE_SWIPE.batchSize);
  const windowKey = JSON.stringify(windowIds);
  const [attempt, retryCards] = useState(0);
  const [detail, setDetail] = useState<{ key: string; error: boolean }>({ key: '', error: false });
  const batch = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!enabled || !actorId || !windowIds.length) return;
    const controller = new AbortController(); batch.current = controller;
    setDetail({ key: windowKey, error: false });
    void loadDeckCards(client, actorId, windowIds, controller.signal).then(cards => {
      if (!controller.signal.aborted && !cards.some(card => card.note.id === windowIds[0])) setDetail({ key: windowKey, error: true });
    }).catch(() => { if (!controller.signal.aborted) setDetail({ key: windowKey, error: true }); });
    return () => controller.abort();
  }, [client, actorId, windowKey, attempt, enabled]);
  // Cache-only reads: no fetch observers are registered for deck-card keys, so the
  // swipe surface can never replace the Home tile's active query function or leave
  // a conflicting placeholder definition behind after a prefix invalidation.
  const cardData = useDeckCardData(client, actorId, exposed ?? '');
  const underOneData = useDeckCardData(client, actorId, ids[at + 1] ?? '');
  const underTwoData = useDeckCardData(client, actorId, ids[at + 2] ?? '');
  // Keep a bounded window (including both undercards) alive without observers.
  // Cleanup releases the previous window on movement, blur, and unmount.
  const retainedKey = JSON.stringify(ids.slice(Math.max(0, at - 5), at + 6));
  const exposedId = exposed ?? '';
  useEffect(() => {
    if (!retainCards || !actorId) return;
    return retainDeckCards(client, actorId, JSON.parse(retainedKey) as string[]);
  }, [client, actorId, retainCards, retainedKey]);
  useEffect(() => {
    if (!enabled || !actorId || !exposedId) return;
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if ((event as { type?: string }).type !== 'removed') return;
      const removedKey = (event as unknown as { query?: { queryKey?: unknown } }).query?.queryKey;
      try {
        if (JSON.stringify(removedKey) === JSON.stringify(noteKeys.deckCard(actorId, exposedId))) {
          if (!client.getQueryData(noteKeys.deckCard(actorId, exposedId))) retryCards(n => n + 1);
        }
      } catch { /* ignore */ }
    });
    return unsubscribe;
  }, [client, actorId, enabled, exposedId]);
  const move = useCallback((direction: 'next' | 'previous') => {
    const target = direction === 'next' ? Math.min(ids.length, at + 1) : Math.max(0, at - 1);
    setPosition({ ids, selected: ids[target] ?? null, initialized: true });
  }, [signature, at]);
  const restart = () => setPosition({ ids, selected: ids[0] ?? null, initialized: true });
  const abort = () => batch.current?.abort();
  return { index, ids, at, noteId: exposed, card: cardData, undercards: [underOneData, underTwoData], move, restart, abort,
    detailError: detail.key === windowKey && detail.error && !index.isFetching, retryCard: () => retryCards(n => n + 1),
    categories, category: effectiveCategory, positions };
}
