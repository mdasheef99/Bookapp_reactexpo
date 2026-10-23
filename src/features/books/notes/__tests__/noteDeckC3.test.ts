import { acceptsDeckKey, categoryDeck, cycleCategory, noteDeckCategories, noteSwipeOrderKey, parseStoredOrder, reconcilePosition, rememberPosition } from '../noteDeck';
import type { NoteDeckIndexRow } from '../manualNoteContract';
import { swipeDirection } from '../noteSwipeConstants';

const rows: NoteDeckIndexRow[] = [
  { id: 'a', user_id: 'u', user_book_id: 'b', tag: 'quote', created_at: '2026-10-20T00:00:00Z' },
  { id: 'b', user_id: 'u', user_book_id: 'b', tag: 'reflect', created_at: '2026-10-21T00:00:00Z' },
  { id: 'c', user_id: 'u', user_book_id: 'b', tag: null, created_at: '2026-10-22T00:00:00Z' },
];

describe('C3 pure: noteDeckCategories and cycleCategory', () => {
  it('returns all plus non-empty categories in NOTE_CATEGORIES order', () => {
    expect(noteDeckCategories(rows)).toEqual(['all', 'quote', 'reflect']);
    expect(noteDeckCategories([])).toEqual(['all']);
    expect(noteDeckCategories([{ ...rows[2] }])).toEqual(['all']);
  });

  it('cycles wrapping to all and skipping empty categories', () => {
    expect(cycleCategory(rows, 'all')).toBe('quote');
    expect(cycleCategory(rows, 'quote')).toBe('reflect');
    expect(cycleCategory(rows, 'reflect')).toBe('all');
    expect(cycleCategory(rows, 'distill')).toBe('all');
  });

  it('returns all when only all exists', () => {
    expect(cycleCategory([], 'all')).toBe('all');
    expect(cycleCategory([{ ...rows[2] }], 'all')).toBe('all');
  });

  it('follows noteDeckCategories order for every category', () => {
    const expected = noteDeckCategories(rows);
    for (let index = 0; index < expected.length; index += 1) {
      expect(cycleCategory(rows, expected[index])).toBe(expected[(index + 1) % expected.length]);
    }
    expect(cycleCategory(rows, 'distill')).toBe('all');
  });
});

describe('C3 pure: swipeDirection category axis', () => {
  it('maps swipe-up distance past 20% height to category', () => {
    expect(swipeDirection(2, 0, -200, 0, -900, 100, 800)).toBe('category');
  });

  it('maps swipe-up velocity fling to category when signs agree', () => {
    expect(swipeDirection(2, 0, -10, 0, -900, 100, 800)).toBe('category');
  });

  it('requires velocity sign agreement for swipe-up flings', () => {
    expect(swipeDirection(2, 0, -10, 0, 900, 100, 800)).toBe('cancel');
  });

  it('keeps swipe-down as leave and locks diagonal to one axis', () => {
    expect(swipeDirection(2, 0, 200, 0, 900, 100, 800)).toBe('leave');
    expect(swipeDirection(1, 0, -200, 0, -900, 100, 800)).toBe('cancel');
    expect(swipeDirection(1, -40, 0, -900, 0, 100, 800)).not.toBe('category');
  });
});

describe('C3 pure: order persistence helpers', () => {
  it('builds a per-actor storage key', () => {
    expect(noteSwipeOrderKey('actor-1')).toBe('library_noteSwipeOrder:v1:actor-1');
    expect(noteSwipeOrderKey('other')).not.toBe(noteSwipeOrderKey('actor-1'));
  });

  it('parses only the three orders, defaulting to shuffle', () => {
    expect(parseStoredOrder('shuffle')).toBe('shuffle');
    expect(parseStoredOrder('newest')).toBe('newest');
    expect(parseStoredOrder('oldest')).toBe('oldest');
    expect(parseStoredOrder('bogus')).toBe('shuffle');
    expect(parseStoredOrder(null)).toBe('shuffle');
    expect(parseStoredOrder(undefined)).toBe('shuffle');
    expect(parseStoredOrder('')).toBe('shuffle');
  });
});

describe('C3 pure: per-category positions', () => {
  it('stores the current note id (or null end) per category without touching others', () => {
    const start = rememberPosition({ all: 'a' }, 'quote', null);
    expect(start).toEqual({ all: 'a', quote: null });
    expect(rememberPosition(start, 'quote', 'q1')).toEqual({ all: 'a', quote: 'q1' });
  });

  it('restores via successor when the stored note was deleted, else end card', () => {
    expect(reconcilePosition(['a', 'b', 'c'], ['a', 'c'], 'b')).toBe('c');
    expect(reconcilePosition(['a', 'b'], ['a'], 'b')).toBeNull();
    expect(reconcilePosition(['a'], [], 'a')).toBeNull();
  });

  it('accepts ArrowUp with the same guards as other deck keys', () => {
    expect(acceptsDeckKey({ key: 'ArrowUp', target: { closest: () => null } }, false)).toBe(true);
    expect(acceptsDeckKey({ key: 'ArrowUp', target: { closest: () => null } }, true)).toBe(false);
    expect(acceptsDeckKey({ key: 'ArrowUp', target: { closest: (s: string) => (s.includes('button') ? {} : null) } }, false)).toBe(false);
  });

  it('categoryDeck filters per category for position ids', () => {
    expect(categoryDeck(rows, 'quote').map(r => r.id)).toEqual(['a']);
    expect(categoryDeck(rows, 'all').map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores deck keys on radio chips/radiogroup but accepts the card surface', () => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'Enter', 'Escape'];
    // Chip itself: radio ancestor is the target, no deck ancestor.
    const chip: any = { isContentEditable: false };
    chip.closest = (selector: string) => {
      if (selector.includes('data-note-deck-card')) return null;
      if (selector.includes('radio')) return chip;
      return null;
    };
    // Inside a chip: radio ancestor differs from the target, still no deck.
    const deckless = {};
    const inside: any = { isContentEditable: false };
    inside.closest = (selector: string) => {
      if (selector.includes('data-note-deck-card')) return null;
      if (selector.includes('radio')) return deckless;
      return null;
    };
    // Radiogroup container itself.
    const group: any = { isContentEditable: false };
    group.closest = (selector: string) => {
      if (selector.includes('data-note-deck-card')) return null;
      if (selector.includes('radio')) return group;
      return null;
    };
    for (const key of keys) {
      expect(acceptsDeckKey({ key, target: chip }, false)).toBe(false);
      expect(acceptsDeckKey({ key, target: inside }, false)).toBe(false);
      expect(acceptsDeckKey({ key, target: group }, false)).toBe(false);
    }
    // Card surface itself still accepts (deck marker is the target).
    const surface: any = { isContentEditable: false };
    surface.closest = () => surface;
    for (const key of keys) {
      expect(acceptsDeckKey({ key, target: surface }, false)).toBe(true);
    }
  });
});
