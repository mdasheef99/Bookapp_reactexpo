import { acceptsDeckKey, categoryDeck, cycleCategory, dailyNoteSeed, deckOrder, parseDeckScope, reconcilePosition, rememberPosition } from '../noteDeck';
import type { NoteDeckIndexRow } from '../manualNoteContract';

const rows: NoteDeckIndexRow[] = Array.from({ length: 30 }, (_, i) => ({ id: `note-${i}`, user_id: 'actor', user_book_id: 'book', tag: i % 2 ? 'quote' : null, created_at: '2026-10-23T12:00:00Z' }));
it('hash shuffle is seeded, repeatable and preserves relative order across additions and deletes', () => {
  const first = deckOrder(rows, 'shuffle', 'visit-a').map(n => n.id);
  expect(deckOrder(rows, 'shuffle', 'visit-a').map(n => n.id)).toEqual(first);
  expect(deckOrder(rows, 'shuffle', 'visit-b').map(n => n.id)).not.toEqual(first);
  expect(deckOrder(rows.filter(n => n.id !== 'note-3'), 'shuffle', 'visit-a').map(n => n.id)).toEqual(first.filter(id => id !== 'note-3'));
  const added = { ...rows[0], id: 'new' };
  expect(deckOrder([...rows, added], 'shuffle', 'visit-a').filter(n => n.id !== 'new').map(n => n.id)).toEqual(first);
});
it('sorts dates in both directions and ties by id', () => {
  const input = [{ ...rows[0], id: 'b' }, { ...rows[0], id: 'a' }, { ...rows[0], id: 'old', created_at: '2025-01-01T00:00:00Z' }];
  expect(deckOrder(input, 'newest', '').map(n => n.id)).toEqual(['a', 'b', 'old']);
  expect(deckOrder(input, 'oldest', '').map(n => n.id)).toEqual(['old', 'a', 'b']);
});
it('filters categories and cycles past empty categories back to All', () => {
  expect(categoryDeck(rows, 'quote')).toHaveLength(15);
  expect(categoryDeck(rows, 'all')).toHaveLength(30);
  expect(cycleCategory(rows, 'all')).toBe('quote');
  expect(cycleCategory(rows, 'quote')).toBe('all');
  expect(cycleCategory([], 'all')).toBe('all');
});
it('keeps per-category positions by id, including end, without changing other categories', () => {
  const positions = rememberPosition({ all: 'a' }, 'quote', null);
  expect(positions).toEqual({ all: 'a', quote: null });
  expect(reconcilePosition(['a', 'b', 'c'], ['a', 'c'], 'b')).toBe('c');
  expect(reconcilePosition(['a', 'b'], ['a'], 'b')).toBeNull();
  expect(reconcilePosition(['b'], [], 'b')).toBeNull();
  expect(reconcilePosition(['a', 'b'], ['a', 'b', 'new'], 'b')).toBe('b');
  expect(reconcilePosition(['a'], ['a', 'new'], null)).toBeNull();
});
it('never broadens a missing book scope and defaults unknown scopes to all', () => {
  expect(parseDeckScope({ scope: 'unknown', userBookId: 'book' })).toEqual({ kind: 'all' });
  expect(parseDeckScope({ scope: 'book' })).toEqual({ kind: 'book', userBookId: '' });
});
it('keeps an unset selection distinct from the end card so empty-then-populated lands on the first id', () => {
  expect(reconcilePosition([], [], undefined)).toBeUndefined();
  expect(reconcilePosition([], ['a', 'b'], undefined)).toBe('a');
  expect(reconcilePosition([], ['a'], null)).toBeNull();
  expect(reconcilePosition(['a'], [], 'a')).toBeNull();
});
it('uses an explicit IANA zone at day and year boundaries', () => {
  const now = new Date('2026-12-31T23:45:00Z');
  expect(dailyNoteSeed('Asia/Kolkata', now)).toBe('2027-01-01');
  expect(dailyNoteSeed('America/Los_Angeles', now)).toBe('2026-12-31');
});
it('ignores deck keys on interactive descendants of the deck marker but accepts the card surface', () => {
  // Card surface itself: closest(deck) === target, so the role="button" on the surface does not block.
  const surface: any = {};
  surface.closest = (selector: string) => (selector.includes('data-note-deck-card') ? surface : selector.includes('button') ? surface : null);
  surface.isContentEditable = false;
  expect(acceptsDeckKey({ key: 'ArrowRight', target: surface }, false)).toBe(true);
  expect(acceptsDeckKey({ key: 'ArrowLeft', target: surface }, false)).toBe(true);
  expect(acceptsDeckKey({ key: 'Enter', target: surface }, false)).toBe(true);
  // Start again button inside the deck marker: deck ancestor differs from the interactive ancestor.
  const deckEl = {};
  const startAgain: any = { isContentEditable: false };
  startAgain.closest = (selector: string) => {
    if (selector.includes('data-note-deck-card')) return deckEl;
    if (selector.includes('button')) return startAgain;
    return null;
  };
  expect(acceptsDeckKey({ key: 'ArrowRight', target: startAgain }, false)).toBe(false);
  expect(acceptsDeckKey({ key: 'ArrowLeft', target: startAgain }, false)).toBe(false);
  expect(acceptsDeckKey({ key: 'Enter', target: startAgain }, false)).toBe(false);
  // Retry button inside the deck marker: same gating.
  const retry: any = { isContentEditable: false };
  retry.closest = (selector: string) => {
    if (selector.includes('data-note-deck-card')) return deckEl;
    if (selector.includes('button')) return retry;
    return null;
  };
  expect(acceptsDeckKey({ key: 'ArrowRight', target: retry }, false)).toBe(false);
  expect(acceptsDeckKey({ key: 'Enter', target: retry }, false)).toBe(false);
});
