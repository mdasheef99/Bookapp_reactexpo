import { invalidateOrganising } from '../organising/useOrganising';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/features/auth/store/authStore';
import { manualNotesGateway, noteSaves } from './manualNotesGateway';
import { ManualNote, NoteDeckCard, NoteDeckIndexRow, noteKeys, NoteSubmission } from './manualNoteContract';

// Shared by retained screens, scoped to their QueryClient and current account lifetime.
// Receipts remain discoverable, but their cache effects are applied only once.
interface NoteCacheMemory { applied: WeakSet<Readonly<NoteSubmission>>; deleted: Set<string>; retained: Map<string, number> }
let cacheMemories = new WeakMap<QueryClient, NoteCacheMemory>();
useAuthStore.subscribe((state, previous) => {
  if (state.session?.user.id !== previous.session?.user.id) cacheMemories = new WeakMap();
});
function cacheMemory(client: QueryClient): NoteCacheMemory {
  let memory = cacheMemories.get(client);
  if (!memory) { memory = { applied: new WeakSet(), deleted: new Set(), retained: new Map() }; cacheMemories.set(client, memory); }
  return memory;
}
function recordIdentity(actorId: string, bookId: string, noteId: string) {
  return JSON.stringify(noteKeys.record(actorId, bookId, noteId));
}
function seedRecord(client: QueryClient, actorId: string, bookId: string, record: ManualNote) {
  if (cacheMemory(client).deleted.has(recordIdentity(actorId, bookId, record.id))) return;
  client.setQueryData<ManualNote | null>(noteKeys.record(actorId, bookId, record.id), current => {
    // A late confirmation must not replace a version already observed from a fresh read.
    if (current?.version !== undefined && (record.version === undefined || current.version >= record.version)) return current;
    return record;
  });
}
export function noteWasDeleted(client: QueryClient, actorId: string, bookId: string, noteId: string) {
  return cacheMemory(client).deleted.has(recordIdentity(actorId, bookId, noteId));
}
/** Pin cache-only readers without adding query observers or permanent key defaults. */
function updateDeckCardRetention(client: QueryClient, actorId: string, id: string, pinned: boolean) {
  const key = noteKeys.deckCard(actorId, id);
  const query = client.getQueryCache().find({ queryKey: key, exact: true });
  if (!query) return;
  const configured = client.getQueryDefaults(key).gcTime ?? client.getDefaultOptions().queries?.gcTime;
  const finite = typeof configured === 'number' && Number.isFinite(configured) ? configured : 5 * 60_000;
  const gcTime = pinned ? Infinity : finite;
  query.setOptions({ ...query.options, gcTime });
  // Query's updateGcTime only increases its lifetime. Explicitly restore the
  // finite lifetime and reschedule collection when the last deck releases it.
  query.gcTime = gcTime;
  (query as unknown as { scheduleGc: () => void }).scheduleGc();
}
export function retainDeckCards(client: QueryClient, actorId: string, ids: readonly string[]) {
  const memory = cacheMemory(client);
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const key = JSON.stringify(noteKeys.deckCard(actorId, id));
    memory.retained.set(key, (memory.retained.get(key) ?? 0) + 1);
    updateDeckCardRetention(client, actorId, id, true);
  }
  return () => {
    for (const id of unique) {
      const key = JSON.stringify(noteKeys.deckCard(actorId, id));
      const remaining = (memory.retained.get(key) ?? 1) - 1;
      if (remaining > 0) memory.retained.set(key, remaining);
      else {
        memory.retained.delete(key);
        updateDeckCardRetention(client, actorId, id, false);
      }
    }
  };
}
/** Shared by batch reads and saves. Tombstones and server versions also protect late detail reads. */
export function seedDeckCard(client: QueryClient, actorId: string, card: NoteDeckCard) {
  const record = card.note;
  if (record.user_id !== actorId || noteWasDeleted(client, actorId, record.user_book_id, record.id)) return;
  const saved = client.getQueryData<ManualNote | null>(noteKeys.record(actorId, record.user_book_id, record.id));
  const latest = saved?.version !== undefined && (record.version === undefined || saved.version > record.version) ? saved : record;
  client.setQueryData<NoteDeckCard>(noteKeys.deckCard(actorId, record.id), current => {
    if (current?.note.version !== undefined && (latest.version === undefined || current.note.version >= latest.version)) return current;
    return { ...card, note: latest };
  });
  updateDeckCardRetention(client, actorId, record.id, cacheMemory(client).retained.has(JSON.stringify(noteKeys.deckCard(actorId, record.id))));
}
function refreshDeck(client: QueryClient, actorId: string, record?: ManualNote) {
  // Cancel Query observers before updating so their eventual return cannot replace a newer save.
  void client.cancelQueries({ queryKey: noteKeys.deck(actorId) });
  if (record) {
    const key = noteKeys.deckCard(actorId, record.id);
    const card = client.getQueryData<NoteDeckCard>(key);
    if (card) seedDeckCard(client, actorId, { ...card, note: record });
  }
  void client.invalidateQueries({ queryKey: noteKeys.deck(actorId) });
}

export function useNoteContext(bookId: string) {
  const { user } = useAuth(); const actorId = user?.id ?? '';
  const book = useQuery({ queryKey: noteKeys.book(actorId, bookId), queryFn: ({ signal }) => manualNotesGateway.book(actorId, bookId, signal), enabled: !!actorId && !!bookId });
  return { actorId, book };
}
export function useNoteOperations(actorId: string, bookId: string) {
  const revision = useSyncExternalStore(noteSaves.subscribe, noteSaves.snapshot, noteSaves.snapshot);
  const client = useQueryClient();
  useEffect(() => {
    const memory = cacheMemory(client);
    for (const operation of noteSaves.forBook(actorId, bookId)) {
      if (operation.status !== 'confirmed' || !operation.record || memory.applied.has(operation.submission)) continue;
      memory.applied.add(operation.submission);
      if (memory.deleted.has(recordIdentity(actorId, bookId, operation.record.id))) continue;
      seedRecord(client, actorId, bookId, operation.record);
      refreshDeck(client, actorId, operation.record);
      void client.invalidateQueries({ queryKey: noteKeys.list(actorId, bookId) });
    }
  }, [revision, client, actorId, bookId]);
  return noteSaves.forBook(actorId, bookId);
}
export function useNoteRefresh(actorId: string, bookId: string) {
  const client = useQueryClient();
  return useCallback((record?: ManualNote) => {
    if (record) seedRecord(client, actorId, bookId, record);
    refreshDeck(client, actorId, record);
    void client.invalidateQueries({ queryKey: noteKeys.list(actorId, bookId) });
    if (record) void client.invalidateQueries({ queryKey: noteKeys.record(actorId, bookId, record.id) });
  }, [client, actorId, bookId]);
}

/** Only called after the gateway confirms deletion; null updates all retained readers. */
export function useNoteRemovalRefresh(actorId: string, bookId: string) {
  const client = useQueryClient();
  return useCallback(async (noteId: string) => {
    const memory = cacheMemory(client);
    memory.deleted.add(recordIdentity(actorId, bookId, noteId));
    await client.cancelQueries({ queryKey: noteKeys.deck(actorId) });
    client.removeQueries({ queryKey: noteKeys.deckCard(actorId, noteId), exact: true });
    const key = noteKeys.record(actorId, bookId, noteId);
    await client.cancelQueries({ queryKey: key, exact: true });
    if (memory !== cacheMemory(client)) return; // Account changed during cancellation.
    client.setQueryData(key, null);
    // Retained decks must reconcile immediately, even while an index refetch is paused offline.
    client.setQueriesData<NoteDeckIndexRow[]>({ queryKey: [...noteKeys.deck(actorId), 'index'] }, rows =>
      rows?.filter(row => row.id !== noteId || row.user_book_id !== bookId));
    for (const operation of noteSaves.forBook(actorId, bookId)) {
      if (operation.submission.noteId === noteId && operation.status === 'confirmed') noteSaves.forget(operation.submission.id);
    }
    invalidateOrganising(client, actorId);
    void client.invalidateQueries({ queryKey: noteKeys.list(actorId, bookId) });
    void client.invalidateQueries({ queryKey: noteKeys.deck(actorId) });
  }, [client, actorId, bookId]);
}
