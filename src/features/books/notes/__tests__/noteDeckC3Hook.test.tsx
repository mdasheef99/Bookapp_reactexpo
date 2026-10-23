import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNoteDeck } from '../useNoteDeck';
import { NoteDeckCard, noteKeys } from '../manualNoteContract';
import { manualNotesGateway, noteSaves } from '../manualNotesGateway';

jest.mock('../manualNotesGateway', () => ({ manualNotesGateway: { deckCards: jest.fn(), deckIndex: jest.fn() }, noteSaves: { subscribe: jest.fn(() => () => {}), snapshot: () => 1, forBook: jest.fn(() => []), forget: jest.fn() } }));

const card = (id: string, tag: any = null): NoteDeckCard => ({ note: { id, user_id: 'actor', user_book_id: 'book', content: `body-${id}`, tag, page_number: null, created_at: '2026-10-20T00:00:00Z', updated_at: null }, book: { id: 'book', title: 'T', authors: ['A'], cover_url: null } });

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  (manualNotesGateway.deckCards as jest.Mock).mockImplementation(async (_a: string, ids: string[]) => ids.map(id => card(id)));
  (manualNotesGateway.deckIndex as jest.Mock).mockResolvedValue([]);
  (noteSaves.forBook as jest.Mock).mockReturnValue([]);
});
afterEach(() => { client.clear(); });

function rows() {
  return [
    { ...card('a', 'quote').note, created_at: '2026-10-20T00:00:00Z' },
    { ...card('b', 'quote').note, created_at: '2026-10-21T00:00:00Z' },
    { ...card('c', 'reflect').note, created_at: '2026-10-22T00:00:00Z' },
  ];
}

describe('C3 hook: per-category positions', () => {
  it('switching away and back restores the same card per category', async () => {
    const scope = { kind: 'all' } as const;
    client.setQueryDefaults(noteKeys.deckIndex('actor', scope), { staleTime: Infinity });
    client.setQueryData(noteKeys.deckIndex('actor', scope), rows());
    const hook = renderHook(({ category, order, seed }: any) => useNoteDeck('actor', { scope, category, order, seed, noteId: '' }, true), {
      wrapper, initialProps: { category: 'all', order: 'oldest', seed: 's' } as any,
    });
    await waitFor(() => expect(hook.result.current.ids.length).toBeGreaterThan(0));
    // All oldest: c created last? oldest sorts by created_at asc: a,b,c? Our rows created same? Use oldest: order by created_at then id. a,b,c same? Actually a quote, b quote, c reflect with different dates? card() all same date, so tie by id: a,b,c. So All ids [a,b,c], at 0 (a).
    expect(hook.result.current.category).toBe('all');
    const firstAll = hook.result.current.noteId;
    // Move to b in All.
    await act(async () => { hook.result.current.move('next'); });
    expect(hook.result.current.noteId).not.toBe(firstAll);
    const allAtB = hook.result.current.noteId;
    // Switch to quote: never visited starts at its first card.
    hook.rerender({ category: 'quote', order: 'oldest', seed: 's' } as any);
    await waitFor(() => expect(hook.result.current.category).toBe('quote'));
    expect(hook.result.current.ids).toEqual(['a', 'b']);
    expect(hook.result.current.noteId).toBe('a');
    // Move quote to b.
    await act(async () => { hook.result.current.move('next'); });
    expect(hook.result.current.noteId).toBe('b');
    // Switch back to All restores b (not first).
    hook.rerender({ category: 'all', order: 'oldest', seed: 's' } as any);
    await waitFor(() => expect(hook.result.current.category).toBe('all'));
    expect(hook.result.current.noteId).toBe(allAtB);
    hook.unmount();
  });

  it('restores the successor when the stored note was deleted, else the end card', async () => {
    const scope = { kind: 'all' } as const;
    client.setQueryDefaults(noteKeys.deckIndex('actor', scope), { staleTime: Infinity });
    client.setQueryData(noteKeys.deckIndex('actor', scope), rows());
    const hook = renderHook(({ category }: any) => useNoteDeck('actor', { scope, category, order: 'oldest', seed: 's', noteId: '' }, true), {
      wrapper, initialProps: { category: 'all' } as any,
    });
    await waitFor(() => expect(hook.result.current.ids).toEqual(['a', 'b', 'c']));
    // Move All to b.
    await act(async () => { hook.result.current.move('next'); });
    expect(hook.result.current.noteId).toBe('b');
    // Switch to reflect (c only).
    hook.rerender({ category: 'reflect' } as any);
    await waitFor(() => expect(hook.result.current.noteId).toBe('c'));
    // Delete b from the index while away in reflect.
    act(() => {
      client.setQueryData(noteKeys.deckIndex('actor', scope), [{ ...card('a', 'quote').note }, { ...card('c', 'reflect').note }]);
    });
    await waitFor(() => expect(hook.result.current.ids).toEqual(['c']));
    // Switch back to All: stored b is gone, successor is c.
    hook.rerender({ category: 'all' } as any);
    await waitFor(() => expect(hook.result.current.category).toBe('all'));
    expect(hook.result.current.noteId).toBe('c');
    hook.unmount();
  });

  it('falls back to all when the current category becomes empty', async () => {
    const scope = { kind: 'all' } as const;
    client.setQueryDefaults(noteKeys.deckIndex('actor', scope), { staleTime: Infinity });
    client.setQueryData(noteKeys.deckIndex('actor', scope), rows());
    const hook = renderHook(({ category }: any) => useNoteDeck('actor', { scope, category, order: 'oldest', seed: 's', noteId: '' }, true), {
      wrapper, initialProps: { category: 'reflect' } as any,
    });
    await waitFor(() => expect(hook.result.current.category).toBe('reflect'));
    expect(hook.result.current.ids).toEqual(['c']);
    // Delete the only reflect note.
    act(() => {
      client.setQueryData(noteKeys.deckIndex('actor', scope), [{ ...card('a', 'quote').note }, { ...card('b', 'quote').note }]);
    });
    await waitFor(() => expect(hook.result.current.category).toBe('all'));
    expect(hook.result.current.ids).toEqual(['a', 'b']);
    hook.unmount();
  });

  it('changing the order clears all stored positions and starts at the first card', async () => {
    const scope = { kind: 'all' } as const;
    client.setQueryDefaults(noteKeys.deckIndex('actor', scope), { staleTime: Infinity });
    client.setQueryData(noteKeys.deckIndex('actor', scope), rows());
    const hook = renderHook(({ category, order, seed }: any) => useNoteDeck('actor', { scope, category, order, seed, noteId: '' }, true), {
      wrapper, initialProps: { category: 'all', order: 'oldest', seed: 's' } as any,
    });
    await waitFor(() => expect(hook.result.current.ids).toEqual(['a', 'b', 'c']));
    await act(async () => { hook.result.current.move('next'); });
    expect(hook.result.current.noteId).toBe('b');
    // Visit quote to store a position there.
    hook.rerender({ category: 'quote', order: 'oldest', seed: 's' } as any);
    await waitFor(() => expect(hook.result.current.noteId).toBe('a'));
    await act(async () => { hook.result.current.move('next'); });
    expect(hook.result.current.noteId).toBe('b');
    // Change order to newest: clears positions, starts current (quote) at first newest.
    hook.rerender({ category: 'quote', order: 'newest', seed: 's' } as any);
    await waitFor(() => expect(hook.result.current.ids).toEqual(['b', 'a']));
    expect(hook.result.current.noteId).toBe('b');
    expect(hook.result.current.positions).toEqual({});
    // Switch back to All: never-visited after clear starts at first newest (c).
    hook.rerender({ category: 'all', order: 'newest', seed: 's' } as any);
    await waitFor(() => expect(hook.result.current.category).toBe('all'));
    expect(hook.result.current.noteId).toBe('c');
    hook.unmount();
  });

  it('keeps the initial distill category while the index loads, then restores its remembered note (G2)', async () => {
    const scope = { kind: 'all' } as const;
    let resolveIndex: (value: unknown[]) => void = () => {};
    const pending = new Promise<unknown[]>(resolve => {
      resolveIndex = resolve;
    });
    (manualNotesGateway.deckIndex as jest.Mock).mockReturnValue(pending);
    const distillRow = { ...card('d1', 'distill').note, created_at: '2026-10-23T00:00:00Z' };
    const quoteRow = { ...card('a', 'quote').note, created_at: '2026-10-20T00:00:00Z' };
    const hook = renderHook(
      ({ category }: any) => useNoteDeck('actor', { scope, category, order: 'oldest', seed: 's', noteId: 'd1' }, true),
      { wrapper, initialProps: { category: 'distill' } as any },
    );
    expect(hook.result.current.category).toBe('distill');
    await act(async () => {
      resolveIndex([distillRow, quoteRow]);
    });
    await waitFor(() => expect(hook.result.current.ids).toEqual(['d1']));
    expect(hook.result.current.category).toBe('distill');
    expect(hook.result.current.noteId).toBe('d1');
    hook.unmount();
  });

  it('falls back to All only after the index loads without that category (G2)', async () => {
    const scope = { kind: 'all' } as const;
    let resolveIndex: (value: unknown[]) => void = () => {};
    const pending = new Promise<unknown[]>(resolve => {
      resolveIndex = resolve;
    });
    (manualNotesGateway.deckIndex as jest.Mock).mockReturnValue(pending);
    const quoteRow = { ...card('a', 'quote').note, created_at: '2026-10-20T00:00:00Z' };
    const hook = renderHook(
      ({ category }: any) => useNoteDeck('actor', { scope, category, order: 'oldest', seed: 's', noteId: '' }, true),
      { wrapper, initialProps: { category: 'distill' } as any },
    );
    expect(hook.result.current.category).toBe('distill');
    await act(async () => {
      resolveIndex([quoteRow]);
    });
    await waitFor(() => expect(hook.result.current.category).toBe('all'));
    expect(hook.result.current.ids).toEqual(['a']);
    hook.unmount();
  });
});
