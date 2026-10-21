import { NOTE_CATEGORIES } from '../notes/manualNoteContract';
import { formatNoteDate } from './dates';
import type { ExportNote, ExportNotesBook, ExportOptions } from './types';

// Shared with the print builder so both formats retain the same reading order.
export function orderedNotesBooks(books: ExportNotesBook[]): ExportNotesBook[] {
  return books.filter(book => book.notes.length > 0).sort((left, right) => {
    if (left.title === null) return right.title === null ? 0 : 1;
    if (right.title === null) return -1;
    return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
  }).map(book => ({
    ...book,
    notes: [...book.notes].sort((left, right) => {
      const leftTime = Date.parse(left.created_at ?? '');
      const rightTime = Date.parse(right.created_at ?? '');
      const leftOrder = Number.isFinite(leftTime) ? leftTime : Infinity;
      const rightOrder = Number.isFinite(rightTime) ? rightTime : Infinity;
      return leftOrder === rightOrder ? 0 : leftOrder - rightOrder;
    }),
  }));
}

export function bookHeading(title: string | null): string {
  return 'Notes — ' + (title ?? 'Untitled book');
}

export function noteHeading(note: ExportNote, options: ExportOptions): string {
  const parts: string[] = [NOTE_CATEGORIES.find(category => category.value === note.tag)?.label ?? 'Note'];
  if (note.page_number !== null && Number.isInteger(note.page_number) && note.page_number > 0) {
    parts.push(`p. ${note.page_number}`);
  }
  const createdDate = formatNoteDate(note.created_at, options);
  if (createdDate) parts.push(createdDate);
  const createdTime = Date.parse(note.created_at ?? '');
  const updatedTime = Date.parse(note.updated_at ?? '');
  if (Number.isFinite(createdTime) && Number.isFinite(updatedTime) && updatedTime > createdTime) {
    parts.push(`Edited ${formatNoteDate(note.updated_at, options)}`);
  }
  return parts.join(' · ');
}

export function normalizeNoteContent(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

function escapeHeading(text: string): string {
  return text.replace(/[\\*_#[\]`]/g, '\\$&');
}

function markdownBody(note: ExportNote): string {
  const escaped = normalizeNoteContent(note.content)
    .replace(/^( *)([#>*+-]|`{3})/gm, '$1\\$2')
    .replace(/^( *\d+)([.)])(?=\s|$)/gm, '$1\\$2');
  if (note.tag !== 'quote') return escaped;
  return escaped.split('\n').map(line => line ? '> ' + line : '>').join('\n');
}

export function buildNotesMarkdown(books: ExportNotesBook[], options: ExportOptions = {}): string {
  const sections = orderedNotesBooks(books).map(book => {
    const heading = '# ' + escapeHeading(bookHeading(book.title));
    const authors = book.authors?.join(', ');
    const header = authors ? heading + '\n' + escapeHeading(authors) : heading;
    const notes = book.notes.map(note =>
      ('## ' + noteHeading(note, options) + '\n' + markdownBody(note)).replace(/\n+$/, ''));
    return [header, ...notes].join('\n\n');
  });
  return sections.length ? sections.join('\n\n').replace(/\n+$/, '') + '\n' : '';
}
