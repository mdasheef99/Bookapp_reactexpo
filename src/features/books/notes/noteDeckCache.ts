import { QueryClient } from '@tanstack/react-query';
import { NoteDeckCard, noteKeys } from './manualNoteContract';
import { manualNotesGateway } from './manualNotesGateway';
import { noteWasDeleted, seedDeckCard } from './useManualNotes';
import { NOTE_SWIPE } from './noteSwipeConstants';

interface Flight { promise: Promise<void>; signal: AbortSignal }
const flights = new WeakMap<QueryClient, Map<string, Flight>>();
export function cachedDeckCard(client: QueryClient, actorId: string, id: string) {
  const key = noteKeys.deckCard(actorId, id);
  return client.getQueryState(key)?.isInvalidated === false ? client.getQueryData<NoteDeckCard>(key) : undefined;
}
/** One request per uncached ID, shared by observers, with full rows cached individually. */
export async function loadDeckCards(client: QueryClient, actorId: string, ids: readonly string[], signal: AbortSignal) {
  let pool = flights.get(client);
  if (!pool) { pool = new Map(); flights.set(client, pool); }
  const unique = [...new Set(ids)];
  const missing = unique.filter(id => !cachedDeckCard(client, actorId, id) && (!pool!.has(`${actorId}:${id}`) || pool!.get(`${actorId}:${id}`)!.signal.aborted));
  for (let offset = 0; offset < missing.length; offset += NOTE_SWIPE.batchSize) {
    const batch = missing.slice(offset, offset + NOTE_SWIPE.batchSize);
    const flight: Flight = { signal, promise: Promise.resolve() };
    flight.promise = manualNotesGateway.deckCards(actorId, batch, signal).then(cards => {
      for (const card of cards) seedDeckCard(client, actorId, card);
    }).finally(() => {
      for (const id of batch) if (pool!.get(`${actorId}:${id}`) === flight) pool!.delete(`${actorId}:${id}`);
    });
    for (const id of batch) pool.set(`${actorId}:${id}`, flight);
  }
  await Promise.all([...new Set(unique.map(id => pool!.get(`${actorId}:${id}`)?.promise).filter(Boolean))].map(promise => (promise as Promise<void>).catch(() => {})));
  if (signal.aborted) throw new Error('Note request cancelled.');
  const stillMissing = unique.filter(id => !cachedDeckCard(client, actorId, id));
  for (let offset = 0; offset < stillMissing.length; offset += NOTE_SWIPE.batchSize) {
    if (signal.aborted) throw new Error('Note request cancelled.');
    const batch = stillMissing.slice(offset, offset + NOTE_SWIPE.batchSize);
    const cards = await manualNotesGateway.deckCards(actorId, batch, signal);
    for (const card of cards) seedDeckCard(client, actorId, card);
  }
  return unique.flatMap(id => {
    const card = client.getQueryData<NoteDeckCard>(noteKeys.deckCard(actorId, id));
    return card && !noteWasDeleted(client, actorId, card.note.user_book_id, id) ? [card] : [];
  });
}
