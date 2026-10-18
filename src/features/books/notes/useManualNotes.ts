import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthStore } from '@/features/auth/store/authStore';
import { manualNotesGateway, noteSaves } from './manualNotesGateway';
import { ManualNote, noteKeys, NoteSubmission } from './manualNoteContract';

// Shared by retained screens, scoped to their QueryClient and current account lifetime.
// Receipts remain discoverable, but their cache effects are applied only once.
interface NoteCacheMemory { applied: WeakSet<Readonly<NoteSubmission>>; deleted: Set<string> }
let cacheMemories = new WeakMap<QueryClient, NoteCacheMemory>();
useAuthStore.subscribe((state, previous) => {
  if (state.session?.user.id !== previous.session?.user.id) cacheMemories = new WeakMap();
});
function cacheMemory(client: QueryClient): NoteCacheMemory {
  let memory = cacheMemories.get(client);
  if (!memory) { memory = { applied: new WeakSet(), deleted: new Set() }; cacheMemories.set(client, memory); }
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
      void client.invalidateQueries({ queryKey: noteKeys.collection(actorId, bookId) });
    }
  }, [revision, client, actorId, bookId]);
  return noteSaves.forBook(actorId, bookId);
}
export function useNoteRefresh(actorId: string, bookId: string) {
  const client = useQueryClient();
  return useCallback((record?: ManualNote) => {
    if (record) seedRecord(client, actorId, bookId, record);
    void client.invalidateQueries({ queryKey: noteKeys.collection(actorId, bookId) });
    if (record) void client.invalidateQueries({ queryKey: noteKeys.record(actorId, bookId, record.id) });
  }, [client, actorId, bookId]);
}

/** Only called after the gateway confirms deletion; null updates all retained readers. */
export function useNoteRemovalRefresh(actorId: string, bookId: string) {
  const client = useQueryClient();
  return useCallback(async (noteId: string) => {
    const memory = cacheMemory(client);
    memory.deleted.add(recordIdentity(actorId, bookId, noteId));
    const key = noteKeys.record(actorId, bookId, noteId);
    await client.cancelQueries({ queryKey: key, exact: true });
    if (memory !== cacheMemory(client)) return; // Account changed during cancellation.
    client.setQueryData(key, null);
    for (const operation of noteSaves.forBook(actorId, bookId)) {
      if (operation.submission.noteId === noteId && operation.status === 'confirmed') noteSaves.forget(operation.submission.id);
    }
    void client.invalidateQueries({ queryKey: noteKeys.collection(actorId, bookId) });
  }, [client, actorId, bookId]);
}
