import { getWordCount, NOTE_WORD_LIMIT } from '../utils/ocrWordCap';

export const NOTE_CATEGORIES = [
  { value: 'quote', label: 'Quote' },
  { value: 'reflect', label: 'Thought' },
  { value: 'distill', label: 'Takeaway' },
  { value: 'apply', label: 'Action' },
  { value: 'question', label: 'Question' },
] as const;
export type NoteCategory = typeof NOTE_CATEGORIES[number]['value'];
export type NoteOrigin = 'book' | 'list' | 'swipe';
export type NoteDeckScope = { kind: 'all' } | { kind: 'book'; userBookId: string };
export type NoteDeckOrder = 'shuffle' | 'newest' | 'oldest';
export type NoteDeckCategory = NoteCategory | 'all';
export type NoteDeckIndexRow = Pick<ManualNote, 'id' | 'tag' | 'created_at' | 'user_book_id' | 'user_id'>;
export interface NoteDeckBook { id: string; title: string; authors: string[]; cover_url: string | null }
export interface NoteDeckCard { note: ManualNote; book: NoteDeckBook }
export interface NoteDeckReturnState {
  scope: NoteDeckScope;
  category: NoteDeckCategory;
  order: NoteDeckOrder;
  seed: string;
  noteId: string | null;
  /** Deletion cursor: position of noteId when the fallback was built, for reload → delete → return. */
  at?: number;
  /** Successor id after noteId when the fallback was built (null when noteId was last). */
  nextId?: string | null;
}
export interface ManualNote {
  id: string;
  user_id: string;
  user_book_id: string;
  content: string;
  tag: NoteCategory | null;
  page_number: number | null;
  created_at: string;
  updated_at: string | null;
  /** Absent in the current schema. Never substitute a client timestamp. */
  version?: number;
  last_operation_id?: string | null;
}
export interface NoteFields { text: string; category: NoteCategory | null; page: string }
export interface NoteSubmission {
  id: string;
  actorId: string;
  bookId: string;
  noteId: string;
  sessionId: string;
  mode: 'create' | 'edit';
  origin: NoteOrigin;
  content: string;
  tag: NoteCategory | null;
  page_number: number | null;
  expectedVersion?: number;
}
export function categoryLabel(category: NoteCategory | null): string {
  return NOTE_CATEGORIES.find(item => item.value === category)?.label ?? 'No category';
}
export function noteFields(note?: ManualNote): NoteFields {
  return { text: note?.content ?? '', category: note?.tag ?? null, page: note?.page_number?.toString() ?? '' };
}
export function validateNote(fields: NoteFields) {
  const errors: { text?: string; page?: string } = {};
  const content = fields.text.trim();
  if (!content) errors.text = 'Write some text before saving.';
  const excess = getWordCount(content) - NOTE_WORD_LIMIT;
  if (excess > 0) errors.text = `Remove ${excess} word${excess === 1 ? '' : 's'} to save. Your text has been kept.`;
  const page = fields.page.trim();
  const pageNumber = page ? Number(page) : null;
  if (page && (!/^\d+$/.test(page) || !Number.isSafeInteger(pageNumber) || pageNumber! < 1 || pageNumber! > 2147483647)) {
    errors.page = 'Enter a positive whole page number, or leave it blank.';
  }
  return { errors, valid: !errors.text && !errors.page, content, pageNumber };
}
export function fieldsChanged(fields: NoteFields, baseline?: ManualNote): boolean {
  const original = noteFields(baseline);
  return fields.text !== original.text || fields.category !== original.category || fields.page !== original.page;
}
export const noteKeys = {
  deck: (actor: string) => ['library-note-deck', actor] as const,
  deckIndex: (actor: string, scope: NoteDeckScope) => ['library-note-deck', actor, 'index', scope] as const,
  deckCard: (actor: string, note: string) => ['library-note-deck', actor, 'card', note] as const,
  book: (actor: string, book: string) => ['library-note-book', actor, book] as const,
  list: (actor: string, book: string) => ['notes', actor, book] as const,
  record: (actor: string, book: string, note: string) => ['library-note', actor, book, note] as const,
};
export class NoteWriteError extends Error {
  constructor(public kind: 'definite' | 'unknown' | 'conflict', message: string, public latest?: ManualNote) { super(message); }
}
