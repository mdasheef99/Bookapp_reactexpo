import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { NoteDeckCard, NoteDeckReturnState, NoteDeckScope, noteKeys } from './manualNoteContract';
import { manualNotesGateway } from './manualNotesGateway';
import { categoryDeck, deckOrder, reconcilePosition } from './noteDeck';
import { loadDeckCards } from './noteDeckCache';
import { noteWasDeleted } from './useManualNotes';
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
/** Observer-free keep-alive for the displayed + next two entries: the production
 * client uses default gcTime (5 min) and these entries have no observers, so they
 * would be garbage-collected and the card (and an open full-note sheet) would
 * vanish. Setting Infinity defaults + updating the live query keeps them alive
 * without creating a fetch observer for the Home tile's key. */
function keepDeckCardAlive(client: QueryClient, actorId: string, id: string) {
  if (!id) return;
  try {
    client.setQueryDefaults(noteKeys.deckCard(actorId, id), { gcTime: Infinity } as Record<string, unknown>);
  } catch { /* ignore */ }
  try {
    const found = client.getQueryCache().find({ queryKey: noteKeys.deckCard(actorId, id), exact: true }) as unknown as {
      setOptions?: (options: Record<string, unknown>) => void;
      updateGcTime?: (gcTime: number) => void;
      scheduleGc?: () => void;
      options?: Record<string, unknown>;
    } | undefined;
    if (found) {
      try {
        if (typeof found.setOptions === 'function') found.setOptions({ ...(found.options ?? {}), gcTime: Infinity });
        else if (typeof found.updateGcTime === 'function') found.updateGcTime(Infinity);
      } catch { /* ignore */ }
      try { found.scheduleGc?.(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
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
export function useNoteDeck(actorId: string, initial: NoteDeckReturnState, enabled = true) {
  const client = useQueryClient();
  const index = useNoteDeckIndex(actorId, initial.scope, enabled);
  const ordered = useMemo(() => deckOrder(categoryDeck((index.data ?? []).filter(row => !noteWasDeleted(client, actorId, row.user_book_id, row.id)), initial.category), initial.order, initial.seed), [index.data, index.isFetching, initial.category, initial.order, initial.seed, actorId, client]);
  const ids = ordered.map(row => row.id);
  const signature = JSON.stringify(ids);
  const [position, setPosition] = useState<{ ids: string[]; selected: string | null | undefined; initialized: boolean }>({ ids: [], selected: initial.noteId === '' ? undefined : initial.noteId, initialized: false });
  const selected: string | null | undefined = !position.initialized
    ? (initial.noteId === null ? null : initial.noteId === '' ? (ids[0] ?? undefined) : ids.includes(initial.noteId) ? initial.noteId : resolveInitialFallback(ids, initial))
    : position.selected === undefined ? (ids[0] ?? undefined) : reconcilePosition(position.ids, ids, position.selected);
  // The empty noteId is the ordinary first-visit start; null represents an explicit end card.
  // undefined is the unset state: no selection recorded while ids is empty, so the first id is chosen once ids appear.
  const selection = !position.initialized && initial.noteId === '' ? (ids[0] ?? undefined) : selected;
  useEffect(() => {
    if (!index.data) return;
    if (!ids.length) {
      setPosition(current => current.ids.length === 0 && current.selected === undefined ? current : { ids: [], selected: undefined, initialized: current.initialized });
      return;
    }
    const nextSelection = selection ?? null;
    setPosition(current => current.initialized && JSON.stringify(current.ids) === signature && (current.selected ?? null) === (nextSelection ?? null) && current.selected !== undefined ? current : { ids, selected: nextSelection, initialized: true });
  }, [signature, index.data, selection]); // ids are represented by signature
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
  // Keep the displayed + next two entries alive (no observers) and reload if the
  // cache evicts the displayed entry despite the keep-alive.
  const visibleOne = ids[at + 1] ?? '';
  const visibleTwo = ids[at + 2] ?? '';
  const exposedId = exposed ?? '';
  useEffect(() => {
    if (!enabled || !actorId) return;
    if (exposedId) keepDeckCardAlive(client, actorId, exposedId);
    if (visibleOne) keepDeckCardAlive(client, actorId, visibleOne);
    if (visibleTwo) keepDeckCardAlive(client, actorId, visibleTwo);
  }, [client, actorId, enabled, exposedId, visibleOne, visibleTwo]);
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
    detailError: detail.key === windowKey && detail.error && !index.isFetching, retryCard: () => retryCards(n => n + 1) };
}
