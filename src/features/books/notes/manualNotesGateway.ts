import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import { ManualNote, NoteSubmission, NoteWriteError, NOTE_CATEGORIES } from './manualNoteContract';
import { matchesSubmission, NoteSaveAdapter, NoteSaveCoordinator } from './noteSaveCoordinator';

/** Enabled after reviewed schema correction and connected acceptance on 2026-10-18.
 * These are application capability gates; database policies enforce authorization. */
export const MANUAL_NOTE_WRITE_GATES = Object.freeze({
  ownedBookWrites: true,
  stableCreateReconciliation: true,
  optionalFiveCategories: true,
  serverManagedEditVersion: true,
});

function currentActor(actorId: string) {
  if (useAuthStore.getState().session?.user.id !== actorId) throw new NoteWriteError('definite', 'Sign in again to continue.');
}
function throwDatabaseError(error: { code?: string; message?: string }) {
  const definite = ['23502', '23503', '23514', '42501', 'PGRST202'].includes(error.code ?? '');
  throw new NoteWriteError(definite ? 'definite' : 'unknown', definite
    ? "This note wasn't saved. Your text is still here." : "We couldn't confirm whether your note was saved.");
}
function hasServerMetadata(value: unknown): value is ManualNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as ManualNote;
  const timestamp = (date: unknown) => typeof date === 'string' && Number.isFinite(Date.parse(date));
  return typeof note.id === 'string' && typeof note.user_id === 'string' && typeof note.user_book_id === 'string' &&
    typeof note.content === 'string' && (note.tag === null || NOTE_CATEGORIES.some(category => category.value === note.tag)) &&
    (note.page_number === null || (Number.isInteger(note.page_number) && note.page_number > 0 && note.page_number <= 2147483647)) &&
    Number.isInteger(note.version) && note.version! > 0 && note.version! <= 2147483647 &&
    timestamp(note.created_at) && timestamp(note.updated_at) &&
    (note.last_operation_id === null || (typeof note.last_operation_id === 'string' && !!note.last_operation_id));
}
function confirmsEdit(note: unknown, submission: Readonly<NoteSubmission>): note is ManualNote {
  return hasServerMetadata(note) && matchesSubmission(note, submission) &&
    note.version === submission.expectedVersion! + 1 && note.last_operation_id === submission.id;
}
export const manualNotesGateway = {
  async book(actorId: string, bookId: string, signal?: AbortSignal): Promise<{ id: string; title: string; authors: string[] }> {
    currentActor(actorId);
    let query = supabase.from('user_books').select('id,user_id,book:books(title,authors)').eq('id', bookId).eq('user_id', actorId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle(); currentActor(actorId);
    if (error) throwDatabaseError(error);
    if (!data || data.user_id !== actorId || data.id !== bookId) throw new Error('This book is unavailable.');
    const related = data.book as unknown as { title: string; authors?: unknown } | { title: string; authors?: unknown }[] | null;
    const book = Array.isArray(related) ? related[0] : related;
    const authors = Array.isArray(book?.authors)
      ? book.authors.filter((author): author is string => typeof author === 'string').map(author => author.trim()).filter(Boolean) : [];
    return { id: data.id, title: book?.title ?? 'Selected book', authors };
  },
  async list(actorId: string, bookId: string, signal?: AbortSignal): Promise<ManualNote[]> {
    await this.book(actorId, bookId, signal);
    let query = supabase.from('reading_notes').select('*').eq('user_id', actorId).eq('user_book_id', bookId).order('created_at', { ascending: false });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query; currentActor(actorId);
    if (error) throwDatabaseError(error);
    return (data ?? []).filter(note => note.user_id === actorId && note.user_book_id === bookId) as ManualNote[];
  },
  async record(actorId: string, bookId: string, noteId: string, signal?: AbortSignal): Promise<ManualNote | null> {
    await this.book(actorId, bookId, signal);
    let query = supabase.from('reading_notes').select('*').eq('id', noteId).eq('user_id', actorId).eq('user_book_id', bookId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle(); currentActor(actorId);
    if (error) throwDatabaseError(error);
    if (!data) return null;
    if (data.user_id !== actorId || data.user_book_id !== bookId || data.id !== noteId) throw new Error('This note is unavailable.');
    return data as ManualNote;
  },
  async remove(actorId: string, bookId: string, noteId: string) {
    await this.book(actorId, bookId); currentActor(actorId);
    const { data, error } = await supabase.from('reading_notes').delete().eq('id', noteId).eq('user_id', actorId).eq('user_book_id', bookId).select('id');
    currentActor(actorId); if (error) throwDatabaseError(error);
    if (data?.length !== 1) throw new Error('This note could not be deleted. Refresh and try again.');
  },
};
export interface ManualNoteWriteGates {
  ownedBookWrites: boolean;
  stableCreateReconciliation: boolean;
  optionalFiveCategories: boolean;
  serverManagedEditVersion: boolean;
}
/** Explicit capabilities let tests exercise held/enabled paths independently. */
export function createManualNoteSaveAdapter(gates: Readonly<ManualNoteWriteGates>): NoteSaveAdapter { return {
  async write(submission) {
    // Closed capabilities fail before dispatch, including isolated hold-path tests.
    if (!gates.ownedBookWrites ||
      (submission.mode === 'create' && !gates.stableCreateReconciliation) ||
      ((submission.tag === null || submission.tag === 'question') && !gates.optionalFiveCategories) ||
      (submission.mode === 'edit' && !gates.serverManagedEditVersion)) {
      throw new NoteWriteError('definite', "Saving isn't available yet. Your text is still here.");
    }
    await manualNotesGateway.book(submission.actorId, submission.bookId); currentActor(submission.actorId);
    const values = { content: submission.content, tag: submission.tag, page_number: submission.page_number };
    if (submission.mode === 'create') {
      const { data, error } = await supabase.from('reading_notes').insert({ ...values, id: submission.noteId, user_id: submission.actorId, user_book_id: submission.bookId }).select('*').single();
      currentActor(submission.actorId);
      if (error) throwDatabaseError(error);
      if (!hasServerMetadata(data) || !matchesSubmission(data, submission) || data.version !== 1 || data.last_operation_id !== null) {
        throw new NoteWriteError('unknown', "We couldn't confirm this saved result.");
      }
      return data;
    }
    if (!Number.isInteger(submission.expectedVersion) || submission.expectedVersion! < 1 || submission.expectedVersion! >= 2147483647) throw new NoteWriteError('definite', 'This saved note is not ready for editing. Your changes are still here.');
    // Compare the version in the actual update; no ID-only fallback.
    const { data, error } = await supabase.from('reading_notes').update({ ...values, last_operation_id: submission.id })
      .eq('id', submission.noteId).eq('user_id', submission.actorId).eq('user_book_id', submission.bookId)
      .eq('version', submission.expectedVersion!).select('*').maybeSingle();
    currentActor(submission.actorId);
    if (error) throwDatabaseError(error);
    if (!data) {
      const latest = await manualNotesGateway.record(submission.actorId, submission.bookId, submission.noteId);
      if (!latest) throw new NoteWriteError('definite', 'This saved note is unavailable. Your changes are still here.');
      if (confirmsEdit(latest, submission)) return latest;
      if (!hasServerMetadata(latest)) throw new NoteWriteError('unknown', "We couldn't confirm this saved result.");
      throw new NoteWriteError('conflict', 'This note changed. Compare the saved version with your changes.', latest);
    }
    if (!confirmsEdit(data, submission)) throw new NoteWriteError('unknown', "We couldn't confirm this saved result.");
    return data;
  },
  async reconcile(submission: Readonly<NoteSubmission>, signal) {
    const note = await manualNotesGateway.record(submission.actorId, submission.bookId, submission.noteId, signal);
    if (signal.aborted || !hasServerMetadata(note) || !matchesSubmission(note, submission)) return null;
    if (submission.mode === 'edit' && !confirmsEdit(note, submission)) return null;
    return note;
  },
}; }
export const manualNoteSaveAdapter = createManualNoteSaveAdapter(MANUAL_NOTE_WRITE_GATES);
export interface ManualNoteDeleteAdapter {
  remove(actorId: string, bookId: string, noteId: string): Promise<void>;
}
/** Gated delete path mirroring createManualNoteSaveAdapter: fail before any dispatch while ownedBookWrites is false. */
export function createManualNoteDeleteAdapter(gates: Readonly<ManualNoteWriteGates>): ManualNoteDeleteAdapter { return {
  async remove(actorId: string, bookId: string, noteId: string) {
    if (!gates.ownedBookWrites) {
      throw new NoteWriteError('definite', "Deleting isn't available yet.");
    }
    await manualNotesGateway.remove(actorId, bookId, noteId);
  },
}; }
export const manualNoteDeleteAdapter = createManualNoteDeleteAdapter(MANUAL_NOTE_WRITE_GATES);
export function isManualNoteDeleteAuthorized(gates: Readonly<ManualNoteWriteGates> = MANUAL_NOTE_WRITE_GATES): boolean {
  return gates.ownedBookWrites;
}
export const noteSaves = new NoteSaveCoordinator(manualNoteSaveAdapter);
noteSaves.setActor(useAuthStore.getState().session?.user.id ?? null);
useAuthStore.subscribe((state, previous) => {
  if (state.session?.user.id !== previous.session?.user.id) noteSaves.setActor(state.session?.user.id ?? null);
});
