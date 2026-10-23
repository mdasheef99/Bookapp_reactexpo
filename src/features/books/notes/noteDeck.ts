import { todayDay } from '../history/estimateDay';
import { NOTE_CATEGORIES, NoteDeckCategory, NoteDeckIndexRow, NoteDeckOrder, NoteDeckScope } from './manualNoteContract';

const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function parseDeckScope(params: { scope?: string | string[]; userBookId?: string | string[] }): NoteDeckScope {
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  return first(params.scope) === 'book' ? { kind: 'book', userBookId: first(params.userBookId)?.trim() ?? '' } : { kind: 'all' };
}
function seededHash(seed: string, id: string) {
  let hash = 2166136261;
  for (const char of `${seed}\u0000${id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  // Avalanche the otherwise correlated suffixes of sequential note IDs.
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x85ebca6b); hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35); return (hash ^ (hash >>> 16)) >>> 0;
}
export function deckOrder<T extends NoteDeckIndexRow>(rows: readonly T[], order: NoteDeckOrder, seed: string): T[] {
  return [...rows].sort((a, b) => {
    const difference = order === 'shuffle' ? seededHash(seed, a.id) - seededHash(seed, b.id)
      : (Date.parse(a.created_at) - Date.parse(b.created_at)) * (order === 'newest' ? -1 : 1);
    return difference || compareId(a.id, b.id);
  });
}
export function categoryDeck<T extends NoteDeckIndexRow>(rows: readonly T[], category: NoteDeckCategory): T[] {
  return rows.filter(row => category === 'all' || row.tag === category);
}
export function cycleCategory(rows: readonly NoteDeckIndexRow[], current: NoteDeckCategory): NoteDeckCategory {
  const categories: NoteDeckCategory[] = ['all', ...NOTE_CATEGORIES.filter(c => rows.some(row => row.tag === c.value)).map(c => c.value)];
  return categories[(categories.indexOf(current) + 1) % categories.length];
}
export type DeckPositions = Partial<Record<NoteDeckCategory, string | null>>;
export const rememberPosition = (positions: DeckPositions, category: NoteDeckCategory, noteId: string | null): DeckPositions => ({ ...positions, [category]: noteId });
/** null is the end card. undefined is the unset state (no selection recorded while ids is empty). Missing selection follows the old successor, never an array index. */
export function reconcilePosition(previous: readonly string[], next: readonly string[], selected: string | null | undefined): string | null | undefined {
  if (selected === undefined) return next[0] ?? undefined;
  if (selected === null || next.includes(selected)) return selected;
  const oldIndex = previous.indexOf(selected);
  if (oldIndex < 0) return next[0] ?? null;
  return previous.slice(oldIndex + 1).find(id => next.includes(id)) ?? null;
}
export const dailyNoteSeed = (zone: string, now: Date) => todayDay(zone, now);

const DECK_INTERACTIVE_SELECTOR = 'input,textarea,select,button,a,[href],[role="button"],[role="link"],[role="textbox"],[contenteditable="true"]';
function safeClosest(target: unknown, selector: string): unknown {
  try {
    const closest = (target as { closest?: (selector: string) => unknown } | null)?.closest;
    if (typeof closest !== 'function') return null;
    return closest.call(target, selector);
  } catch { return null; }
}
export function acceptsDeckKey(event: { key: string; target?: unknown; defaultPrevented?: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }, overlayOpen: boolean): boolean {
  if (overlayOpen || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !['ArrowRight', 'ArrowLeft', 'Enter', 'Escape'].includes(event.key)) return false;
  const target = event.target as { closest?: (selector: string) => unknown; isContentEditable?: boolean } | null;
  if (target?.isContentEditable) return false;
  if (target && typeof target.closest === 'function') {
    // Exempt the CARD SURFACE ONLY (the element carrying data-note-deck-card),
    // never its interactive descendants: a real button/link/field inside the deck
    // (e.g. Retry, Start again) must keep the keys ignored even though it sits
    // under the deck marker. The surface itself carries role="button" for its
    // accessible name, so an interactive ancestor that IS the surface does not block.
    const deckAncestor = safeClosest(target, '[data-note-deck-card]');
    if (deckAncestor === target) return true;
    const interactiveAncestor = safeClosest(target, DECK_INTERACTIVE_SELECTOR);
    if (interactiveAncestor) {
      if (interactiveAncestor === deckAncestor) return true;
      return false;
    }
    if (deckAncestor) return true;
    return true;
  }
  return !target?.isContentEditable;
}
