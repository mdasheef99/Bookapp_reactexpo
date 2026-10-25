import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNoteDeck } from '../../notes/useNoteDeck';
import { noteKeys, NoteDeckCard, NoteDeckScope } from '../../notes/manualNoteContract';
import { manualNotesGateway } from '../../notes/manualNotesGateway';
import { useCollectionCards } from '../useCollectionCards';
import { useAuthStore } from '@/features/auth/store/authStore';
jest.mock('../../notes/manualNotesGateway', () => ({ manualNotesGateway: { deckCards: jest.fn(), deckIndex: jest.fn() }, noteSaves: { subscribe: () => () => {}, snapshot: () => 1, forBook: () => [] } }));
const group = { id: 'group', user_id: 'actor', name: 'All', created_at: '2026-10-01', updated_at: '2026-10-01' };
const card = (id: string, book = 'book'): NoteDeckCard => ({ note: { id, user_id: 'actor', user_book_id: book, content: id, tag: null, page_number: null, created_at: `2026-10-0${id === 'a' ? 1 : 2}`, updated_at: null }, book: { id: book, title: book, authors: [], cover_url: null } });
const members = ['a', 'b', 'other'].map(id => ({ user_id: 'actor', entity_id: group.id, target_id: id, added_at: '2026-10-03' }));
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  useAuthStore.setState({ session: { user: { id: 'actor' } } as any });
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_actor: string, ids: string[]) => ids.map(id => card(id)));
});
afterEach(() => client.clear());
it('retains loaded collection pages and one query when a membership is removed', async () => {
  const ids = Array.from({ length: 45 }, (_, i) => `note-${i}`);
  const view = renderHook(({ links }: { links: string[] }) => useCollectionCards('actor', 'group', links, true), { wrapper, initialProps: { links: ids } });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  await act(async () => { await view.result.current.fetchNextPage(); });
  // The observer snapshot can lag the settled fetch in this harness, so wait
  // on the query cache (the fetch writes it synchronously on completion).
  const cardsInCache = () => client.getQueryCache()
    .findAll({ queryKey: ['library-note-deck', 'actor', 'collection-cards', 'group'] })
    .flatMap(query => (query.state.data as { pages: NoteDeckCard[][] } | undefined)?.pages.flat() ?? []);
  await waitFor(() => expect(cardsInCache().length).toBeGreaterThan(20));
  view.rerender({ links: ids.slice(1) });
  expect(view.result.current.data!.pages.flat().some(row => row.note.id === 'note-20')).toBe(true);
  await waitFor(() => expect(view.result.current.isFetching).toBe(false));
  expect(view.result.current.data!.pages.flat().some(row => row.note.id === 'note-0')).toBe(false);
  expect(view.result.current.data!.pages.flat().some(row => row.note.id === 'note-20')).toBe(true);
  expect(client.getQueryCache().findAll({ queryKey: ['library-note-deck', 'actor', 'collection-cards', 'group'] })).toHaveLength(1);
  view.unmount();
});
it('keeps a restored collection filter while a cold note index is still loading', async () => {
  let resolve!: (rows: unknown) => void;
  (manualNotesGateway.deckIndex as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const scope = { kind: 'all' as const };
  const view = renderHook(() => useNoteDeck('actor', { scope, category: 'all', collectionId: group.id, order: 'oldest', seed: 's', noteId: '' }, true, true, { entities: [group], members }), { wrapper });
  expect(view.result.current.index.data).toBeUndefined();
  expect(view.result.current.collectionId).toBe(group.id);
  await act(async () => resolve([card('a').note, card('b').note]));
  await waitFor(() => expect(view.result.current.ids).toEqual(['a', 'b']));
  expect(view.result.current.collectionId).toBe(group.id); view.unmount();
});
function seed(scope: NoteDeckScope) { client.setQueryData(noteKeys.deckIndex('actor', scope), [card('a').note, card('b').note]); }
it('remembers a collection position, intersects the book scope and falls back to All when emptied', async () => {
  const scope = { kind: 'book' as const, userBookId: 'book' }; seed(scope);
  // A book note outside the collection and a collection member outside the
  // index: the deck must hold exactly their intersection, not either side.
  client.setQueryData(noteKeys.deckIndex('actor', scope), [card('a').note, card('b').note, card('c').note]);
  const view = renderHook(({ id, links }: any) => useNoteDeck('actor', { scope, category: 'all', collectionId: id, order: 'oldest', seed: 's', noteId: '' }, true, true, { entities: [group], members: links }), { wrapper, initialProps: { id: group.id, links: members } });
  await waitFor(() => expect(view.result.current.ids).toEqual(['a', 'b']));
  act(() => view.result.current.move('next')); expect(view.result.current.noteId).toBe('b');
  view.rerender({ id: undefined, links: members });
  expect(view.result.current.noteId).toBe('a');
  view.rerender({ id: group.id, links: members });
  expect(view.result.current.noteId).toBe('b');
  view.rerender({ id: group.id, links: [] });
  expect(view.result.current.collectionId).toBeUndefined(); expect(view.result.current.ids).toEqual(['a', 'b', 'c']);
  view.unmount();
});
it('an emptied dedicated collection stays empty rather than becoming an all-notes deck', async () => {
  seed({ kind: 'all' });
  const scope = { kind: 'collection' as const, collectionId: group.id };
  const view = renderHook(({ links }: any) => useNoteDeck('actor', { scope, category: 'all', order: 'newest', seed: 's', noteId: '' }, true, true, { entities: [group], members: links }), { wrapper, initialProps: { links: members } });
  await waitFor(() => expect(view.result.current.ids).toEqual(['b', 'a']));
  view.rerender({ links: [] }); expect(view.result.current.ids).toEqual([]); view.unmount();
});
