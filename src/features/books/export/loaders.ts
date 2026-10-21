import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { NoteWriteError } from '../notes/manualNoteContract';
import type { ExportLibraryRow, ExportNote, ExportNotesBook } from './types';

const PAGE_SIZE = 500;
const LIBRARY_COLUMNS = 'reading_status,ownership,condition,rating,review,review_is_public,created_at,completed_at,user_id,book:books(title,authors,isbn_13,isbn_10,publisher,published_date,page_count)';
const BOOK_COLUMNS = 'id,user_id,book:books(title,authors)';
const NOTE_COLUMNS = 'id,user_id,user_book_id,content,tag,page_number,created_at,updated_at';
type RelatedBook = Pick<ExportNotesBook, 'title' | 'authors'>;
type BookRow = { id: string; user_id: string; book: RelatedBook | RelatedBook[] | null };
type NoteRow = ExportNote & { id: string; user_id: string; user_book_id: string };
type LibraryRow = Omit<ExportLibraryRow, 'book'> & {
  user_id: string;
  book: ExportLibraryRow['book'] | NonNullable<ExportLibraryRow['book']>[];
};

function checkRequest(actorId: string, signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Export cancelled.');
    error.name = 'AbortError';
    throw error;
  }
  if (!actorId || useAuthStore.getState().session?.user.id !== actorId) {
    throw new Error('Sign in again to continue.');
  }
}

function throwDatabaseError(error: { code?: string; message?: string }): never {
  const definite = ['23502', '23503', '23514', '42501', 'PGRST202'].includes(error.code ?? '');
  throw new NoteWriteError(definite ? 'definite' : 'unknown', "Couldn't load export data.");
}

function relatedBook<T>(book: T | T[] | null): T | null {
  return (Array.isArray(book) ? book[0] : book) ?? null;
}

async function readPages<T extends { user_id: string }>(
  table: 'user_books' | 'reading_notes', columns: string, actorId: string,
  ascending: boolean, signal?: AbortSignal, equalities: Record<string, string> = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    checkRequest(actorId, signal);
    let query = supabase.from(table).select(columns).eq('user_id', actorId);
    for (const [column, value] of Object.entries(equalities)) query = query.eq(column, value);
    query = query.order('created_at', { ascending }).order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    checkRequest(actorId, signal);
    if (error) throwDatabaseError(error);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page.filter(row => row.user_id === actorId));
    // Stop on the database page length, never the client-filtered length.
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function loadLibraryForExport(actorId: string, signal?: AbortSignal): Promise<ExportLibraryRow[]> {
  const rows = await readPages<LibraryRow>('user_books', LIBRARY_COLUMNS, actorId, false, signal);
  return rows.map(({ user_id: _owner, book, ...row }) => ({ ...row, book: relatedBook(book) }));
}

function exportNote(note: ExportNote): ExportNote {
  const { content, tag, page_number, created_at, updated_at } = note;
  return { content, tag, page_number, created_at, updated_at };
}

export async function loadBookNotesForExport(actorId: string, userBookId: string, signal?: AbortSignal): Promise<ExportNotesBook[]> {
  checkRequest(actorId, signal);
  let query = supabase.from('user_books').select(BOOK_COLUMNS).eq('id', userBookId).eq('user_id', actorId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  checkRequest(actorId, signal);
  if (error) throwDatabaseError(error);
  if (!data || data.id !== userBookId || data.user_id !== actorId) throw new Error('This book is unavailable.');
  const book = relatedBook((data as unknown as BookRow).book);
  const notes = await readPages<NoteRow>('reading_notes', NOTE_COLUMNS, actorId, true, signal, { user_book_id: userBookId });
  checkRequest(actorId, signal);
  return [{ title: book?.title ?? null, authors: book?.authors ?? null,
    notes: notes.filter(note => note.user_id === actorId && note.user_book_id === userBookId).map(exportNote) }];
}

export async function loadAllNotesForExport(actorId: string, signal?: AbortSignal): Promise<ExportNotesBook[]> {
  // Do not embed user_books here: reading_notes has two foreign keys to it.
  const notes = await readPages<NoteRow>('reading_notes', NOTE_COLUMNS, actorId, true, signal);
  if (notes.length === 0) return [];
  const books = await readPages<BookRow>('user_books', BOOK_COLUMNS, actorId, false, signal);
  const byId = new Map(books.map(row => [row.id, relatedBook(row.book)]));
  const grouped = new Map<string, ExportNotesBook>();
  for (const note of notes) {
    const book = byId.get(note.user_book_id);
    if (!book) continue;
    let group = grouped.get(note.user_book_id);
    if (!group) {
      group = { title: book.title, authors: book.authors, notes: [] };
      grouped.set(note.user_book_id, group);
    }
    group.notes.push(exportNote(note));
  }
  return [...grouped.values()];
}
