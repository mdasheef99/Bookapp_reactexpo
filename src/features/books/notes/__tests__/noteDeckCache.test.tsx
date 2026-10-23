import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadDeckCards, cachedDeckCard } from '../noteDeckCache';
import { seedDeckCard, useNoteRefresh, useNoteRemovalRefresh, useNoteOperations } from '../useManualNotes';
import { NoteDeckCard, noteKeys } from '../manualNoteContract';
import { manualNotesGateway, noteSaves } from '../manualNotesGateway';
import { useNoteDeck } from '../useNoteDeck';
jest.mock('../manualNotesGateway', () => ({ manualNotesGateway: { deckCards: jest.fn(), deckIndex: jest.fn() }, noteSaves: { subscribe: jest.fn(() => () => {}), snapshot: () => 1, forBook: jest.fn(() => []), forget: jest.fn() } }));

const card = (id: string, version = 1): NoteDeckCard => ({ note: { id, user_id: 'actor', user_book_id: 'book', content: `body-${version}`, tag: 'quote', page_number: 42, created_at: '2026-10-23T00:00:00Z', updated_at: null, version }, book: { id: 'book', title: 'Book', authors: ['Writer'], cover_url: null } });
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => { jest.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_actor, ids: string[]) => ids.map(id => card(id))); (noteSaves.forBook as jest.Mock).mockReturnValue([]); });
afterEach(() => client.clear());
it('pins only the nearby window, releases earlier batches, and releases every card on unmount', async () => {
  jest.useFakeTimers();
  client.setDefaultOptions({ queries: { retry: false, gcTime: 5 * 60_000, staleTime: Infinity } });
  const scope = { kind: 'all' } as const;
  const ids = Array.from({ length: 50 }, (_, i) => `note-${String(i).padStart(2, '0')}`);
  client.setQueryData(noteKeys.deckIndex('actor', scope), ids.map(id => card(id).note));
  const hook = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: '' }), { wrapper });
  const query = (id: string) => client.getQueryCache().find({ queryKey: noteKeys.deckCard('actor', id), exact: true });
  try {
    await waitFor(() => expect(hook.result.current.card?.note.id).toBe(ids[0]));
    expect(query(ids[0])?.gcTime).toBe(Infinity);
    // Loading a 20-card batch must not pin all 20 cards.
    expect(query(ids[19])?.gcTime).toBe(5 * 60_000);
    for (let step = 0; step < 30; step++) await act(async () => { hook.result.current.move('next'); });
    await waitFor(() => expect(hook.result.current.card?.note.id).toBe(ids[30]));
    expect(query(ids[0])?.gcTime).toBe(5 * 60_000);
    expect(query(ids[0])?.options.gcTime).toBe(5 * 60_000);
    for (const id of ids.slice(25, 36)) expect(query(id)?.gcTime).toBe(Infinity);
    await act(async () => { jest.advanceTimersByTime(6 * 60_000); });
    expect(query(ids[0])).toBeUndefined();
    for (const id of ids.slice(25, 36)) expect(client.getQueryData(noteKeys.deckCard('actor', id))).toBeTruthy();
    hook.unmount();
    for (const id of ids.slice(25, 36)) {
      expect(query(id)?.gcTime).toBe(5 * 60_000);
      expect(query(id)?.options.gcTime).toBe(5 * 60_000);
    }
    await act(async () => { jest.advanceTimersByTime(6 * 60_000); });
    for (const id of ids) expect(query(id)).toBeUndefined();
  } finally { hook.unmount(); client.clear(); jest.useRealTimers(); }
});
it('skips only existing non-invalidated entries and batches 20 at a time', async () => {
  const ids = Array.from({ length: 43 }, (_, i) => String(i));
  client.setQueryData(noteKeys.deckCard('actor', '0'), card('0'));
  client.setQueryData(noteKeys.deckCard('actor', '1'), card('1'));
  await client.invalidateQueries({ queryKey: noteKeys.deckCard('actor', '1') });
  expect(cachedDeckCard(client, 'actor', '1')).toBeUndefined();
  const result = await loadDeckCards(client, 'actor', ids, new AbortController().signal);
  expect(result).toHaveLength(43);
  const batches = (manualNotesGateway.deckCards as jest.Mock).mock.calls.map(c => c[1]);
  expect(batches.map(c => c.length)).toEqual([20, 20, 2]);
  expect(batches.flat()).toEqual(ids.slice(1));
});
it('dedupes in-flight IDs and rejects callers that aborted, still seeding version-protected data', async () => {
  let resolve!: (cards: NoteDeckCard[]) => void;
  (manualNotesGateway.deckCards as jest.Mock).mockReturnValue(new Promise(r => { resolve = r; }));
  const controller = new AbortController();
  const first = loadDeckCards(client, 'actor', ['one'], controller.signal);
  const second = loadDeckCards(client, 'actor', ['one'], controller.signal);
  expect(manualNotesGateway.deckCards).toHaveBeenCalledTimes(1);
  controller.abort(); resolve([card('one')]);
  expect((await Promise.allSettled([first, second])).every(r => r.status === 'rejected')).toBe(true);
  expect(client.getQueryData<NoteDeckCard>(noteKeys.deckCard('actor', 'one'))?.note.id).toBe('one');
});
it('a second caller joining a foreign flight still gets its cards after the owner aborts', async () => {
  // The foreign flight stays pending until the owner aborts mid-flight while the
  // second caller is awaiting it; the joiner must then re-request the still-uncached
  // ids via the retry loop (noteDeckCache.ts retry). Fails if that loop is removed.
  let calls = 0;
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation((_actor: string, ids: string[], signal?: AbortSignal) => {
    calls += 1;
    if (calls === 1) {
      return new Promise<NoteDeckCard[]>((_resolve, reject) => {
        if (signal?.aborted) { reject(new Error('Note request cancelled.')); return; }
        signal?.addEventListener('abort', () => reject(new Error('Note request cancelled.')), { once: true });
      });
    }
    if (signal?.aborted) return Promise.reject(new Error('Note request cancelled.'));
    return Promise.resolve(ids.map(id => card(id)));
  });
  const owner = new AbortController();
  const joiner = new AbortController();
  const first = loadDeckCards(client, 'actor', ['a', 'b'], owner.signal);
  const second = loadDeckCards(client, 'actor', ['a', 'b'], joiner.signal);
  expect(manualNotesGateway.deckCards).toHaveBeenCalledTimes(1);
  owner.abort();
  await expect(first).rejects.toThrow('cancelled');
  await expect(second).resolves.toHaveLength(2);
  expect(manualNotesGateway.deckCards).toHaveBeenCalledTimes(2);
  expect((manualNotesGateway.deckCards as jest.Mock).mock.calls[1][1]).toEqual(['a', 'b']);
  expect(client.getQueryData<NoteDeckCard>(noteKeys.deckCard('actor', 'a'))?.note.id).toBe('a');
});
it('empty index then populated lands on the first id, not the end card', async () => {
  const scope = { kind: 'all' } as const;
  client.setQueryData(noteKeys.deckIndex('actor', scope), []);
  const hook = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: '' }), { wrapper });
  await waitFor(() => expect(hook.result.current.ids).toHaveLength(0));
  expect(hook.result.current.noteId).toBeNull();
  act(() => { client.setQueryData(noteKeys.deckIndex('actor', scope), [card('first').note, card('second').note]); });
  await waitFor(() => expect(hook.result.current.ids).toEqual(['first', 'second']));
  expect(hook.result.current.noteId).toBe('first');
});
it('suppresses the detail error while the index refetches (tombstone path)', async () => {
  const scope = { kind: 'all' } as const;
  (manualNotesGateway.deckIndex as jest.Mock)
    .mockImplementationOnce(async () => [card('a').note])
    .mockImplementation(() => new Promise(() => {}));
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async () => []);
  const hook = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: 'a' }, true), { wrapper });
  await waitFor(() => expect(hook.result.current.detailError).toBe(true));
  act(() => { void client.invalidateQueries({ queryKey: noteKeys.deckIndex('actor', scope) }); });
  await waitFor(() => expect(hook.result.current.index.isFetching).toBe(true));
  expect(hook.result.current.detailError).toBe(false);
});
it('late batches cannot overwrite a newer saved version or resurrect a confirmed deletion', async () => {
  const refresh = renderHook(() => ({ refresh: useNoteRefresh('actor', 'book'), remove: useNoteRemovalRefresh('actor', 'book') }), { wrapper });
  seedDeckCard(client, 'actor', card('saved'));
  act(() => refresh.result.current.refresh(card('saved', 3).note));
  seedDeckCard(client, 'actor', card('saved', 1));
  expect(client.getQueryData<NoteDeckCard>(noteKeys.deckCard('actor', 'saved'))?.note.version).toBe(3);
  await act(async () => { await refresh.result.current.remove('saved'); });
  seedDeckCard(client, 'actor', card('saved', 5));
  expect(client.getQueryData(noteKeys.deckCard('actor', 'saved'))).toBeUndefined();
  expect(client.getQueryData(noteKeys.record('actor', 'book', 'saved'))).toBeNull();
});
it('all three mutation-refresh paths invalidate the actor deck prefix', async () => {
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const submission = { id: 'save', noteId: 'one', actorId: 'actor', bookId: 'book', mode: 'edit', sessionId: 'session', origin: 'swipe', content: 'body-2', tag: 'quote', page_number: 42 };
  (noteSaves.forBook as jest.Mock).mockReturnValue([{ status: 'confirmed', submission, record: card('one', 2).note }]);
  const hook = renderHook(() => ({ operations: useNoteOperations('actor', 'book'), refresh: useNoteRefresh('actor', 'book'), remove: useNoteRemovalRefresh('actor', 'book') }), { wrapper });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: noteKeys.deck('actor') });
  invalidate.mockClear(); act(() => hook.result.current.refresh(card('one', 3).note));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: noteKeys.deck('actor') });
  invalidate.mockClear(); await act(async () => { await hook.result.current.remove('one'); });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: noteKeys.deck('actor') });
});
it.each([['middle', ['a', 'b', 'c'], 'b', 'c'], ['last', ['a', 'b'], 'b', null], ['only', ['b'], 'b', null]] as const)('after deleting %s lands on successor/end/empty', async (_label, before, selected, expected) => {
  const scope = { kind: 'all' } as const;
  client.setQueryData(noteKeys.deckIndex('actor', scope), before.map(id => card(id).note));
  const hook = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: selected }), { wrapper });
  await waitFor(() => expect(hook.result.current.noteId).toBe(selected));
  act(() => { client.setQueryData(noteKeys.deckIndex('actor', scope), before.filter(id => id !== selected).map(id => card(id).note)); });
  await waitFor(() => expect(hook.result.current.noteId).toBe(expected));
  expect(hook.result.current.ids).toHaveLength(before.length - 1);
});
it.each([['middle', ['a', 'b', 'c'], 'b', 'c'], ['last', ['a', 'b'], 'b', null], ['only', ['b'], 'b', null]] as const)('confirmed %s deletion updates retained all/book decks while offline without a fresh index', async (_label, before, selected, expected) => {
  const allScope = { kind: 'all' } as const;
  const bookScope = { kind: 'book', userBookId: 'book' } as const;
  const rows = before.map(id => card(id).note);
  for (const scope of [allScope, bookScope]) {
    client.setQueryDefaults(noteKeys.deckIndex('actor', scope), { staleTime: Infinity });
    client.setQueryData(noteKeys.deckIndex('actor', scope), rows);
  }
  client.setQueryData(noteKeys.deckIndex('other-actor', allScope), rows);
  for (const id of before) seedDeckCard(client, 'actor', card(id));
  (manualNotesGateway.deckCards as jest.Mock).mockRejectedValue(new Error('offline'));
  onlineManager.setOnline(false);
  const deck = renderHook(() => ({
    all: useNoteDeck('actor', { scope: allScope, category: 'all', order: 'oldest', seed: 'seed', noteId: selected }),
    book: useNoteDeck('actor', { scope: bookScope, category: 'all', order: 'oldest', seed: 'seed', noteId: selected }),
  }), { wrapper });
  const removal = renderHook(() => useNoteRemovalRefresh('actor', 'book'), { wrapper });
  try {
    await waitFor(() => expect(deck.result.current.all.card?.note.id).toBe(selected));
    expect(deck.result.current.book.noteId).toBe(selected);
    expect(deck.result.current.all.index.isFetching).toBe(false);
    await act(async () => { await removal.result.current(selected); });
    await waitFor(() => {
      for (const retained of [deck.result.current.all, deck.result.current.book]) {
        expect(retained.ids).toEqual(before.filter(id => id !== selected));
        expect(retained.noteId).toBe(expected);
        expect(retained.card?.note.id ?? null).toBe(expected);
        expect(retained.index.isFetching).toBe(false);
      }
    });
    expect(manualNotesGateway.deckIndex).not.toHaveBeenCalled();
    expect(client.getQueryData(noteKeys.deckIndex('other-actor', allScope))).toBe(rows);
  } finally {
    deck.unmount(); removal.unmount();
    onlineManager.setOnline(true);
  }
});
it('renders the disabled deck observers with zero console.error calls (skipToken)', async () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const scope = { kind: 'all' } as const;
    client.setQueryData(noteKeys.deckIndex('actor', scope), [card('a').note]);
    const hook = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: 'a' }), { wrapper });
    await waitFor(() => expect(hook.result.current.ids).toEqual(['a']));
    expect(err).not.toHaveBeenCalled();
    hook.unmount();
  } finally {
    (err as jest.Mock).mockRestore();
  }
});
it.each([
  ['middle reload delete return', ['a', 'c'], 'b', 1, 'c', 'c'],
  ['last reload delete return', ['a'], 'b', 1, null, null],
] as const)('fresh mount %s lands on successor/end via deletion cursor', async (_label, remaining, deletedId, at, nextId, expected) => {
  const scope = { kind: 'all' } as const;
  client.setQueryData(noteKeys.deckIndex('actor', scope), remaining.map(id => card(id).note));
  const hook = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: deletedId, at, nextId }), { wrapper });
  await waitFor(() => expect(hook.result.current.ids).toEqual([...remaining]));
  expect(hook.result.current.noteId).toBe(expected);
  hook.unmount();
});
