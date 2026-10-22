import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  READ_OUTCOMES,
  ReadingGoal,
  ReadingHistoryError,
  ReadingProgressEntry,
  ReadingRead,
  ReadingSettings,
} from './readingHistoryContract';

export { ReadingHistoryError } from './readingHistoryContract';

const LOAD_MESSAGE = "Couldn't load your reading history.";
const UPDATE_MESSAGE = "Couldn't update your reading history.";
const ALREADY_OPEN_MESSAGE = 'This book already has a read in progress.';
const NOT_LATEST_MESSAGE = 'Only the latest read can be reopened.';

function currentActor(actorId: string): void {
  if (useAuthStore.getState().session?.user.id !== actorId) {
    throw new ReadingHistoryError('Sign in again to continue.');
  }
}

interface DatabaseError {
  code?: string;
  message?: string;
}

function specificRpcMessage(error: DatabaseError): string | null {
  if (error.code !== 'P0001') return null;
  const message = error.message ?? '';
  if (message.includes('LIBRARY_READ_ALREADY_OPEN')) return ALREADY_OPEN_MESSAGE;
  if (message.includes('LIBRARY_READ_NOT_LATEST')) return NOT_LATEST_MESSAGE;
  return null;
}

function throwLoadError(error: DatabaseError): never {
  throw new ReadingHistoryError(specificRpcMessage(error) ?? LOAD_MESSAGE);
}

function throwUpdateError(error: DatabaseError): never {
  throw new ReadingHistoryError(specificRpcMessage(error) ?? UPDATE_MESSAGE);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRealCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
  );
}

function isDayString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  return isRealCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.exec(
      value,
    );
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  if (!isRealCalendarDay(year, month, day)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  const tz = match[7];
  if (tz !== 'Z') {
    const tzMatch = /^([+-])(\d{2}):?(\d{2})$/.exec(tz);
    if (!tzMatch) return false;
    if (Number(tzMatch[2]) > 23 || Number(tzMatch[3]) > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function abortFromSignal(signal: AbortSignal | undefined): Error | null {
  if (!signal?.aborted) return null;
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;
  const aborted = new Error('Aborted');
  aborted.name = 'AbortError';
  return aborted;
}

function isAbortLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { name?: unknown; message?: unknown };
  if (candidate.name === 'AbortError') return true;
  return typeof candidate.message === 'string' && candidate.message.startsWith('AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined, error: unknown): void {
  const fromSignal = abortFromSignal(signal);
  if (fromSignal) throw fromSignal;
  if (isAbortLike(error)) throw error;
}

function isReadingRead(value: unknown): value is ReadingRead {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    isNonEmptyString(row.id) &&
    isNonEmptyString(row.user_book_id) &&
    isNonEmptyString(row.user_id) &&
    Number.isInteger(row.read_number) &&
    (row.read_number as number) > 0 &&
    READ_OUTCOMES.includes(row.outcome as (typeof READ_OUTCOMES)[number]) &&
    (row.started_at === null || isTimestamp(row.started_at)) &&
    (row.ended_at === null || isTimestamp(row.ended_at)) &&
    (row.started_on === null || isDayString(row.started_on)) &&
    (row.ended_on === null || isDayString(row.ended_on)) &&
    typeof row.start_unknown === 'boolean' &&
    typeof row.end_unknown === 'boolean' &&
    (row.total_pages === null || (Number.isInteger(row.total_pages) && (row.total_pages as number) > 0)) &&
    typeof row.counts_in_stats === 'boolean' &&
    isTimestamp(row.created_at) &&
    isTimestamp(row.updated_at)
  );
}

function isReadingProgressEntry(value: unknown): value is ReadingProgressEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const pageOk =
    row.page === null || (Number.isInteger(row.page) && (row.page as number) >= 0);
  const percentOk =
    row.percent === null ||
    (Number.isInteger(row.percent) && (row.percent as number) >= 0 && (row.percent as number) <= 100);
  return (
    isNonEmptyString(row.id) &&
    isNonEmptyString(row.read_id) &&
    isNonEmptyString(row.user_id) &&
    pageOk &&
    percentOk &&
    (row.page === null) !== (row.percent === null) &&
    isTimestamp(row.recorded_at)
  );
}

function isReadingGoal(value: unknown): value is ReadingGoal {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    isNonEmptyString(row.user_id) &&
    Number.isInteger(row.year) &&
    (row.year as number) >= 2000 &&
    (row.year as number) <= 2100 &&
    Number.isInteger(row.target_books) &&
    (row.target_books as number) >= 1 &&
    (row.target_books as number) <= 999 &&
    isTimestamp(row.updated_at)
  );
}

function isReadingSettings(value: unknown): value is ReadingSettings {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    isNonEmptyString(row.user_id) &&
    (row.next_read_user_book_id === null || isNonEmptyString(row.next_read_user_book_id)) &&
    isTimestamp(row.updated_at)
  );
}

export const readingHistoryGateway = {
  async readsForBook(actorId: string, userBookId: string, signal?: AbortSignal): Promise<ReadingRead[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('user_book_reads')
      .select('*')
      .eq('user_id', actorId)
      .eq('user_book_id', userBookId)
      .order('read_number', { ascending: true });
    if (signal) query = query.abortSignal(signal);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await query;
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, error);
    currentActor(actorId);
    if (error) throwLoadError(error);
    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows.filter(
      (row): row is ReadingRead =>
        isReadingRead(row) && row.user_id === actorId && row.user_book_id === userBookId,
    );
  },

  async readsForUser(actorId: string, signal?: AbortSignal): Promise<ReadingRead[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('user_book_reads')
      .select('*')
      .eq('user_id', actorId)
      .order('ended_at', { ascending: false, nullsFirst: false });
    if (signal) query = query.abortSignal(signal);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await query;
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, error);
    currentActor(actorId);
    if (error) throwLoadError(error);
    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows.filter((row): row is ReadingRead => isReadingRead(row) && row.user_id === actorId);
  },

  async progressForRead(actorId: string, readId: string, signal?: AbortSignal): Promise<ReadingProgressEntry[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('user_book_progress')
      .select('*')
      .eq('user_id', actorId)
      .eq('read_id', readId)
      .order('recorded_at', { ascending: true });
    if (signal) query = query.abortSignal(signal);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await query;
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, error);
    currentActor(actorId);
    if (error) throwLoadError(error);
    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows.filter(
      (row): row is ReadingProgressEntry =>
        isReadingProgressEntry(row) && row.user_id === actorId && row.read_id === readId,
    );
  },

  async goal(actorId: string, year: number, signal?: AbortSignal): Promise<ReadingGoal | null> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase.from('user_reading_goals').select('*').eq('user_id', actorId).eq('year', year);
    if (signal) query = query.abortSignal(signal);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await query.maybeSingle();
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, error);
    currentActor(actorId);
    if (error) throwLoadError(error);
    if (!data) return null;
    if (!isReadingGoal(data) || data.user_id !== actorId || data.year !== year) {
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    return data;
  },

  async settings(actorId: string, signal?: AbortSignal): Promise<ReadingSettings | null> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase.from('user_reading_settings').select('*').eq('user_id', actorId);
    if (signal) query = query.abortSignal(signal);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await query.maybeSingle();
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, error);
    currentActor(actorId);
    if (error) throwLoadError(error);
    if (!data) return null;
    if (!isReadingSettings(data) || data.user_id !== actorId) {
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    return data;
  },

  async startReread(actorId: string, userBookId: string): Promise<string> {
    currentActor(actorId);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await supabase.rpc('library_start_reread', { p_user_book_id: userBookId });
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
    if (typeof data !== 'string' || data.length === 0) {
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    return data;
  },

  async reopenRead(actorId: string, readId: string): Promise<void> {
    currentActor(actorId);
    let error: DatabaseError | null;
    try {
      const result = await supabase.rpc('library_reopen_read', { p_read_id: readId });
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
  },
};
