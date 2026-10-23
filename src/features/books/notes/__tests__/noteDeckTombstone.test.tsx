import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { seedDeckCard, useNoteRemovalRefresh } from '../useManualNotes';
import { NoteDeckCard, noteKeys } from '../manualNoteContract';
import { manualNotesGateway, noteSaves } from '../manualNotesGateway';
import { useNoteDeck } from '../useNoteDeck';

jest.mock('../manualNotesGateway', () => ({ manualNotesGateway: { deckCards: jest.fn(), deckIndex: jest.fn() }, noteSaves: { subscribe: jest.fn(() => () => {}), snapshot: () => 1, forBook: jest.fn(() => []), forget: jest.fn() } }));

const card = (id: string, version = 1): NoteDeckCard => ({ note: { id, user_id: 'actor', user_book_id: 'book', content: `body-${version}`, tag: 'quote', page_number: 42, created_at: '2026-10-23T00:00:00Z', updated_at: null, version }, book: { id: 'book', title: 'Book', authors: ['Writer'], cover_url: null } });
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => { jest.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }); (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_actor: string, ids: string[]) => ids.map(id => card(id))); (noteSaves.forBook as jest.Mock).mockReturnValue([]); });
afterEach(() => { client.clear(); });

it.each([
  ['middle', ['a', 'b', 'c'], 'b', ['a', 'c'], 'c'],
  ['last', ['a', 'b'], 'b', ['a'], null],
  ['only', ['b'], 'b', [], null],
] as const)('retained stale index still drops confirmed %s deletion via tombstone', async (_label, before, selected, expectedIds, expectedNoteId) => {
  const scope = { kind: 'all' } as const;
  client.setQueryDefaults(noteKeys.deckIndex('actor', scope), { staleTime: Infinity });
  const rows = before.map(id => card(id).note);
  client.setQueryData(noteKeys.deckIndex('actor', scope), rows);
  for (const id of before) seedDeckCard(client, 'actor', card(id));
  onlineManager.setOnline(false);
  const deck = renderHook(() => useNoteDeck('actor', { scope, category: 'all', order: 'oldest', seed: 'seed', noteId: selected }), { wrapper });
  const removal = renderHook(() => useNoteRemovalRefresh('actor', 'book'), { wrapper });
  try {
    await waitFor(() => expect(deck.result.current.ids).toEqual([...before]));
    expect(deck.result.current.noteId).toBe(selected);
    await act(async () => { await removal.result.current(selected); });
    // Retained deck whose cached index still lists the deleted id (offline / before refetch).
    act(() => { client.setQueryData(noteKeys.deckIndex('actor', scope), before.map(id => card(id).note)); });
    await waitFor(() => expect(deck.result.current.index.data).toHaveLength(before.length));
    expect(deck.result.current.index.data?.map(r => r.id)).toEqual([...before]);
    expect(deck.result.current.ids).toEqual([...expectedIds]);
    expect(deck.result.current.noteId).toBe(expectedNoteId);
    expect(manualNotesGateway.deckIndex).not.toHaveBeenCalled();
  } finally {
    deck.unmount();
    removal.unmount();
    onlineManager.setOnline(true);
  }
});
