import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { NoteWriteError } from '../notes/manualNoteContract';
import { formatExportDate } from './dates';
import type { ExportHistorySummary, ExportLibraryRow, ExportNote, ExportNotesBook, ExportOptions } from './types';

const PAGE_SIZE = 500;
const LIBRARY_COLUMNS = 'id,reading_status,ownership,condition,rating,review,review_is_public,created_at,completed_at,user_id,book:books(title,authors,isbn_13,isbn_10,publisher,published_date,page_count)';
const BOOK_COLUMNS = 'id,user_id,book:books(title,authors)';
const NOTE_COLUMNS = 'id,user_id,user_book_id,content,tag,page_number,created_at,updated_at';
const READS_COLUMNS = 'id,user_id,user_book_id,read_number,outcome,started_at,ended_at,started_on,ended_on,start_unknown,end_unknown,created_at';
type RelatedBook = Pick<ExportNotesBook, 'title' | 'authors'>;
type BookRow = { id: string; user_id: string; book: RelatedBook | RelatedBook[] | null };
type NoteRow = ExportNote & { id: string; user_id: string; user_book_id: string };
type LibraryRow = Omit<ExportLibraryRow, 'book' | 'history'> & {
  id: string;
  user_id: string;
  book: ExportLibraryRow['book'] | NonNullable<ExportLibraryRow['book']>[];
};
type HistoryReadRow = {
  id: string;
  user_id: string;
  user_book_id: string;
  read_number: number;
  outcome: string;
  started_at: string | null;
  ended_at: string | null;
  started_on: string | null;
  ended_on: string | null;
  start_unknown: boolean;
  end_unknown: boolean;
  created_at: string | null;
};

function exportEdgeToDay(
  picked: string | null,
  instant: string | null,
  unknownFlag: boolean,
  options?: ExportOptions,
): string | null {
  if (unknownFlag) return null;
  if (typeof picked === 'string' && picked.length > 0) return picked;
  if (typeof instant === 'string' && instant.length > 0) {
    const day = formatExportDate(instant, options ?? {});
    return day === '' ? null : day;
  }
  return null;
}

function historySummaryForBook(reads: HistoryReadRow[], options?: ExportOptions): ExportHistorySummary {
  if (reads.length === 0) return { started: null, finished: null, timesRead: 0, lastOutcome: '' };
  const sorted = [...reads].sort((a, b) => a.read_number - b.read_number);
  const latest = sorted[sorted.length - 1];
  const start = exportEdgeToDay(latest.started_on, latest.started_at, latest.start_unknown, options);
  const rawEnd = exportEdgeToDay(latest.ended_on, latest.ended_at, latest.end_unknown, options);
  // A stopped read's end is a stop date, not a finish (SDD-09 Unit 2b fix).
  const finished = latest.outcome === 'finished' ? rawEnd : null;
  const timesRead = sorted.filter((read) => read.outcome === 'finished').length;
  const lastOutcome = latest.outcome === 'reading' ? 'Reading'
    : latest.outcome === 'finished' ? 'Finished'
    : latest.outcome === 'did_not_finish' ? 'Did not finish' : '';
  return { started: start, finished, timesRead, lastOutcome };
}

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
  table: 'user_books' | 'reading_notes' | 'user_book_reads', columns: string, actorId: string,
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

export async function loadLibraryForExport(
  actorId: string,
  signal?: AbortSignal,
  options?: ExportOptions,
): Promise<ExportLibraryRow[]> {
  const rows = await readPages<LibraryRow>('user_books', LIBRARY_COLUMNS, actorId, false, signal);
  const reads = await readPages<HistoryReadRow>('user_book_reads', READS_COLUMNS, actorId, true, signal);
  const byBook = new Map<string, HistoryReadRow[]>();
  for (const read of reads) {
    if (read.user_id !== actorId) continue;
    const list = byBook.get(read.user_book_id) ?? [];
    list.push(read);
    byBook.set(read.user_book_id, list);
  }
  return rows.map(({ user_id: _owner, id, book, ...row }) => ({
    ...row,
    book: relatedBook(book),
    history: historySummaryForBook(byBook.get(id) ?? [], options),
  }));
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
