import type { ManualNote, NoteCategory } from './manualNoteContract';

// SDD-10 Unit A: in-app search over the notes already loaded for one book.
// No new query. Matching is case-insensitive with NFKC normalisation on both
// sides and no accent folding, so "é" does not match "e".
export function normaliseNoteQuery(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().trim();
}

export function noteMatchesQuery(note: Pick<ManualNote, 'content'>, query: string): boolean {
  const normalised = normaliseNoteQuery(query);
  if (!normalised) return true;
  const content = (note.content ?? '').normalize('NFKC').toLocaleLowerCase();
  return content.includes(normalised);
}

export interface NoteSearchFilter {
  category: NoteCategory | null;
  query: string;
}

export function filterNotes(notes: ManualNote[], { category, query }: NoteSearchFilter): ManualNote[] {
  return notes.filter(note => {
    if (category !== null && note.tag !== category) return false;
    return noteMatchesQuery(note, query);
  });
}

// Count line while searching (SDD-10 §4.1, DP-04 plain caption):
// "2 of 4 notes" ("1 of 1 note" when the total is one). The total is the notes
// in the current category (or the whole book when no chip is active).
export function searchCountLabel(shown: number, total: number): string {
  return `${shown} of ${total} ${total === 1 ? 'note' : 'notes'}`;
}
