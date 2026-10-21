import type { NoteCategory } from '../notes/manualNoteContract';

export interface ExportOptions {
  timeZone?: string;
}

export interface ExportLibraryRow {
  reading_status: string | null;
  ownership: string | null;
  condition: string | null;
  rating: number | null;
  review: string | null;
  review_is_public: boolean | null;
  created_at: string | null;
  completed_at: string | null;
  book: {
    title: string | null;
    authors: string[] | null;
    isbn_13: string | null;
    isbn_10: string | null;
    publisher: string | null;
    published_date: string | null;
    page_count: number | null;
  } | null;
}

export interface ExportNote {
  content: string;
  tag: NoteCategory | null;
  page_number: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ExportNotesBook {
  title: string | null;
  authors: string[] | null;
  notes: ExportNote[];
}

export type ExportFileKind = 'library-csv' | 'notes-md' | 'notes-pdf' | 'quote-png';
export type ExportScope = { kind: 'all' } | { kind: 'book'; title: string | null };
