import { noteRouteContext, readerHref, registerNoteContext, returnFromNote, swipeHref } from '../noteNavigation';
import type { NoteDeckReturnState } from '../manualNoteContract';

jest.mock('expo-crypto', () => {
  let id = 0;
  return { randomUUID: () => `context-${++id}` };
});

function mockRouter() {
  return { back: jest.fn(), dismiss: jest.fn(), replace: jest.fn(), canGoBack: () => true };
}

function deckState(over: Partial<NoteDeckReturnState> = {}): NoteDeckReturnState {
  return {
    scope: { kind: 'all' },
    category: 'all',
    order: 'shuffle',
    seed: 'seed-1',
    noteId: 'note-1',
    ...over,
  };
}

describe('swipe deck return state', () => {
  it('builds a fallback href that retains scope, seed and card for a web reload', () => {
    const href = swipeHref(deckState({ scope: { kind: 'book', userBookId: 'book-9' }, noteId: null })) as {
      pathname: string;
      params: Record<string, string>;
    };
    expect(href.pathname).toBe('/(tabs)/library/notes-swipe');
    expect(href.params).toMatchObject({ scope: 'book', userBookId: 'book-9', seed: 'seed-1', noteId: '__end__' });
  });

  it('parses swipe params from a reloaded reader URL and defaults unknown values', () => {
    const context = noteRouteContext(undefined, 'actor', 'book', {
      origin: 'swipe',
      swipeKey: 'route-key',
      swipeScope: 'book',
      swipeUserBookId: 'book-9',
      swipeCategory: 'bogus',
      swipeOrder: 'bogus',
      swipeSeed: 'seed-9',
      swipeNoteId: '__end__',
    });
    expect(context.origin).toBe('swipe');
    expect(context.swipeKey).toBe('route-key');
    expect(context.swipe?.scope).toEqual({ kind: 'book', userBookId: 'book-9' });
    expect(context.swipe?.category).toBe('all');
    expect(context.swipe?.order).toBe('shuffle');
    expect(context.swipe?.seed).toBe('seed-9');
    expect(context.swipe?.noteId).toBeNull();
  });

  it('never broadens a book scope with a missing userBookId when parsing swipe params', () => {
    const context = noteRouteContext(undefined, 'actor', 'book', {
      origin: 'swipe',
      swipeScope: 'book',
    });
    expect(context.swipe?.scope).toEqual({ kind: 'book', userBookId: '' });
  });

  it('carries the swipe fallback fields through the reader href', () => {
    const contextId = registerNoteContext({
      actorId: 'actor',
      bookId: 'book-9',
      origin: 'swipe',
      canBack: true,
      swipeKey: 'route-key',
      swipe: deckState({ scope: { kind: 'book', userBookId: 'book-9' } }),
    });
    const href = readerHref('book-9', 'note-1', contextId) as { params: Record<string, string> };
    expect(href.params.origin).toBe('swipe');
    expect(href.params.swipeKey).toBe('route-key');
    expect(href.params.swipeScope).toBe('book');
    expect(href.params.swipeUserBookId).toBe('book-9');
    expect(href.params.swipeSeed).toBe('seed-1');
    expect(href.params.swipeNoteId).toBe('note-1');
  });

  it('carries the deletion cursor (at/next) through fallback and reader hrefs for reload delete return', () => {
    const middle = swipeHref(deckState({ noteId: 'b', at: 1, nextId: 'c' })) as { params: Record<string, string> };
    expect(middle.params.noteId).toBe('b');
    expect(middle.params.swipeAt).toBe('1');
    expect(middle.params.swipeNext).toBe('c');
    const last = swipeHref(deckState({ noteId: 'b', at: 1, nextId: null })) as { params: Record<string, string> };
    expect(last.params.swipeNext).toBe('__end__');
    const contextId = registerNoteContext({
      actorId: 'actor', bookId: 'book-9', origin: 'swipe', canBack: true, swipeKey: 'route-key',
      swipe: deckState({ noteId: 'b', at: 1, nextId: 'c' }),
    });
    const href = readerHref('book-9', 'b', contextId) as { params: Record<string, string> };
    expect(href.params.swipeAt).toBe('1');
    expect(href.params.swipeNext).toBe('c');
    const parsed = noteRouteContext(undefined, 'actor', 'book-9', {
      origin: 'swipe', swipeKey: 'route-key', swipeScope: 'all', swipeSeed: 'seed-1',
      swipeNoteId: 'b', swipeAt: '1', swipeNext: 'c',
    });
    expect(parsed.swipe?.at).toBe(1);
    expect(parsed.swipe?.nextId).toBe('c');
    const parsedLast = noteRouteContext(undefined, 'actor', 'book-9', {
      origin: 'swipe', swipeKey: 'route-key', swipeScope: 'all', swipeSeed: 'seed-1',
      swipeNoteId: 'b', swipeAt: '1', swipeNext: '__end__',
    });
    expect(parsedLast.swipe?.nextId).toBeNull();
  });
});

describe('returnFromNote swipe branch (route-key match)', () => {
  function navigationWith(routes: Array<{ name: string; key: string; params?: Record<string, unknown> }>, index: number) {
    return { getState: () => ({ index, routes }) };
  }

  it('returns to the live notes-swipe entry when name, params and key all match', () => {
    const router = mockRouter();
    const state = deckState();
    const contextId = registerNoteContext({
      actorId: 'actor',
      bookId: 'book-9',
      origin: 'swipe',
      canBack: true,
      swipeKey: 'swipe-route-key',
      swipe: state,
    });
    const context = noteRouteContext(contextId, 'actor', 'book-9');
    const navigation = navigationWith(
      [
        { name: 'index', key: 'root' },
        { name: 'notes-swipe', key: 'swipe-route-key', params: {} },
        { name: 'note', key: 'reader', params: { bookId: 'book-9', noteId: 'note-1' } },
      ],
      2,
    );
    returnFromNote(router as never, context, navigation as never);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('replaces with the deck fallback when the swipe key no longer matches (web reload)', () => {
    const router = mockRouter();
    const state = deckState({ scope: { kind: 'book', userBookId: 'book-9' }, noteId: null });
    const contextId = registerNoteContext({
      actorId: 'actor',
      bookId: 'book-9',
      origin: 'swipe',
      canBack: true,
      swipeKey: 'stale-key',
      swipe: state,
    });
    const context = noteRouteContext(contextId, 'actor', 'book-9');
    const navigation = navigationWith(
      [
        { name: 'index', key: 'root' },
        { name: 'notes-swipe', key: 'different-key', params: {} },
        { name: 'note', key: 'reader', params: { bookId: 'book-9', noteId: 'note-1' } },
      ],
      2,
    );
    returnFromNote(router as never, context, navigation as never);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    const fallback = router.replace.mock.calls[0][0] as { pathname: string; params: Record<string, string> };
    expect(fallback.pathname).toBe('/(tabs)/library/notes-swipe');
    expect(fallback.params.scope).toBe('book');
    expect(fallback.params.userBookId).toBe('book-9');
  });

  it('replaces with the deck fallback when there is no earlier notes-swipe entry', () => {
    const router = mockRouter();
    const state = deckState();
    const contextId = registerNoteContext({
      actorId: 'actor',
      bookId: 'book-9',
      origin: 'swipe',
      canBack: true,
      swipeKey: 'swipe-route-key',
      swipe: state,
    });
    const context = noteRouteContext(contextId, 'actor', 'book-9');
    const navigation = navigationWith([{ name: 'note', key: 'reader', params: {} }], 0);
    returnFromNote(router as never, context, navigation as never);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
  });
});
