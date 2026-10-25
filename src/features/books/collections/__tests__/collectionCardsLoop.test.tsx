import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NoteDeckCard } from '../../notes/manualNoteContract';
import { manualNotesGateway } from '../../notes/manualNotesGateway';
import { useCollectionCards } from '../useCollectionCards';
import { useAuthStore } from '@/features/auth/store/authStore';

jest.mock('../../notes/manualNotesGateway', () => ({ manualNotesGateway: { deckCards: jest.fn(), deckIndex: jest.fn() }, noteSaves: { subscribe: () => () => {}, snapshot: () => 1, forBook: () => [] } }));

const card = (id: string): NoteDeckCard => ({
  note: { id, user_id: 'actor', user_book_id: 'book', content: `passage ${id}`, tag: null, page_number: null, created_at: '2026-10-01', updated_at: null },
  book: { id: 'book', title: 'Book', authors: [], cover_url: null },
});

const key = ['library-note-deck', 'actor', 'collection-cards', 'group'];
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  useAuthStore.setState({ session: { user: { id: 'actor' } } } as any);
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_actor: string, batch: string[]) => batch.map(id => card(id)));
});
afterEach(() => client.clear());

// Phone finding C4: the collection screen crashed with "Maximum update depth
// exceeded". The hook effect depended on the `ids` array identity, so every
// parent render re-ran it, and every run wrote the query cache (TanStack
// setQueryData notifies observers even when the updater returns the identical
// data reference), which re-rendered the parent with a fresh array. Each loop
// iteration performs exactly one cache write, so the cache write count bounds
// the render loop: it must stay flat when the ids only change identity.
it('does not write the query cache when rerendered with a freshly allocated but equal id array', async () => {
  const view = renderHook(({ links }: { links: string[] }) => useCollectionCards('actor', 'group', links, true), { wrapper, initialProps: { links: ['n1'] } });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  const writesAfterLoad = client.getQueryState(key)?.dataUpdateCount ?? 0;
  expect(writesAfterLoad).toBeGreaterThan(0);
  const fetchesAfterLoad = (manualNotesGateway.deckCards as jest.Mock).mock.calls.length;
  for (let i = 0; i < 15; i++) view.rerender({ links: ['n1'] });
  await waitFor(() => expect(view.result.current.data!.pages.flat().map(row => row.note.id)).toEqual(['n1']));
  expect(client.getQueryState(key)?.dataUpdateCount ?? 0).toBe(writesAfterLoad);
  expect((manualNotesGateway.deckCards as jest.Mock).mock.calls.length).toBe(fetchesAfterLoad);
  view.unmount();
});
