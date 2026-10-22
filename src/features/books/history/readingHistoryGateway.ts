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
const REMOVE_MESSAGE = "This read can't be removed.";
const ALLOWED_DATE_COLUMNS_MESSAGE = 'Only reading dates, page count and stats inclusion can be changed here.';
const REAL_DATE_MESSAGE = 'Enter a real calendar date (YYYY-MM-DD).';
const FUTURE_DATE_MESSAGE = "Reading dates can't be in the future.";
const DATE_ORDER_MESSAGE = "The start date can't be after the end date.";
const TOTAL_PAGES_MESSAGE = 'Total pages must be a whole number above 0.';
const FLAG_MESSAGE = 'Unknown flags and stats inclusion must be true or false.';
const NOTHING_TO_UPDATE_MESSAGE = 'Nothing to update.';
const PAGE_VALUE_MESSAGE = 'Enter a whole page number of 0 or more.';
const PERCENT_VALUE_MESSAGE = 'Enter a whole percent between 0 and 100.';
const ONE_VALUE_MESSAGE = 'Enter either a page or a percent, not both.';
const PROGRESS_VALUE_MESSAGE = 'Enter a page or a percent to save.';

export type ProgressValue = { page: number } | { percent: number };

export interface OpenReadWithProgress {
  read: ReadingRead;
  bookTitle: string;
  latestProgress: ReadingProgressEntry | null;
}

export interface ReadDatesPatch {
  started_on?: string | null;
  ended_on?: string | null;
  start_unknown?: boolean;
  end_unknown?: boolean;
  total_pages?: number | null;
  counts_in_stats?: boolean;
}

const ALLOWED_DATE_COLUMNS: readonly (keyof ReadDatesPatch)[] = [
  'started_on',
  'ended_on',
  'start_unknown',
  'end_unknown',
  'total_pages',
  'counts_in_stats',
];

function toLocalDayString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validateReadDatesPatch(patch: ReadDatesPatch): void {
  if (!patch || typeof patch !== 'object') throw new ReadingHistoryError(NOTHING_TO_UPDATE_MESSAGE);
  const keys = Object.keys(patch);
  if (keys.length === 0) throw new ReadingHistoryError(NOTHING_TO_UPDATE_MESSAGE);
  for (const key of keys) {
    if (!(ALLOWED_DATE_COLUMNS as readonly string[]).includes(key)) {
      throw new ReadingHistoryError(ALLOWED_DATE_COLUMNS_MESSAGE);
    }
  }
  const today = toLocalDayString(new Date());
  for (const edge of ['started_on', 'ended_on'] as const) {
    if (!(edge in patch)) continue;
    const day = patch[edge];
    if (day === null || day === undefined) continue;
    if (!isDayString(day)) throw new ReadingHistoryError(REAL_DATE_MESSAGE);
    if (day > today) throw new ReadingHistoryError(FUTURE_DATE_MESSAGE);
  }
  for (const flag of ['start_unknown', 'end_unknown', 'counts_in_stats'] as const) {
    if (!(flag in patch)) continue;
    if (typeof patch[flag] !== 'boolean') throw new ReadingHistoryError(FLAG_MESSAGE);
  }
  if ('total_pages' in patch) {
    const total = patch.total_pages;
    if (total !== null && total !== undefined && (!Number.isInteger(total) || (total as number) <= 0)) {
      throw new ReadingHistoryError(TOTAL_PAGES_MESSAGE);
    }
  }
  // The gateway only sees the patch, not the stored row, so order is checked when
  // both edges are known inside the patch itself; the sheet validates effective days.
  const startKnown = patch.start_unknown !== true && typeof patch.started_on === 'string';
  const endKnown = patch.end_unknown !== true && typeof patch.ended_on === 'string';
  if (startKnown && endKnown && (patch.started_on as string) > (patch.ended_on as string)) {
    throw new ReadingHistoryError(DATE_ORDER_MESSAGE);
  }
}

function currentActor(actorId: string): void {
  if (useAuthStore.getState().session?.user.id !== actorId) {
    throw new ReadingHistoryError('Sign in again to continue.');
  }
}

function validateProgressValue(value: ProgressValue): void {
  if (!value || typeof value !== 'object') throw new ReadingHistoryError(PROGRESS_VALUE_MESSAGE);
  const hasPage = 'page' in value;
  const hasPercent = 'percent' in value;
  if (hasPage === hasPercent) throw new ReadingHistoryError(ONE_VALUE_MESSAGE);
  if (hasPage) {
    const page = (value as { page: unknown }).page;
    if (!Number.isInteger(page) || (page as number) < 0) {
      throw new ReadingHistoryError(PAGE_VALUE_MESSAGE);
    }
  } else {
    const percent = (value as { percent: unknown }).percent;
    if (!Number.isInteger(percent) || (percent as number) < 0 || (percent as number) > 100) {
      throw new ReadingHistoryError(PERCENT_VALUE_MESSAGE);
    }
  }
}

function validateTotalPages(totalPages: number | null): void {
  if (totalPages === null) return;
  if (!Number.isInteger(totalPages) || (totalPages as number) <= 0) {
    throw new ReadingHistoryError(TOTAL_PAGES_MESSAGE);
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

function extractJoinedBookTitle(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const related = row.book as unknown;
  const book = Array.isArray(related) ? related[0] : related;
  if (!book || typeof book !== 'object') return null;
  const title = (book as Record<string, unknown>).title;
  if (typeof title !== 'string') return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export interface YearQuoteRow {
  id: string;
  user_book_id: string;
  user_id: string;
  content: string;
  tag: string | null;
  created_at: string;
}

function isYearQuoteRow(value: unknown): value is YearQuoteRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    isNonEmptyString(row.id) &&
    isNonEmptyString(row.user_book_id) &&
    isNonEmptyString(row.user_id) &&
    typeof row.content === 'string' &&
    row.content.length > 0 &&
    row.tag === 'quote' &&
    isTimestamp(row.created_at)
  );
}

function validateGoalYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new ReadingHistoryError(UPDATE_MESSAGE);
  }
}

function validateGoalTarget(target: number): void {
  if (!Number.isInteger(target) || target < 1 || target > 999) {
    throw new ReadingHistoryError(UPDATE_MESSAGE);
  }
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

  async openReadBookIds(actorId: string, signal?: AbortSignal): Promise<string[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('user_book_reads')
      .select('user_book_id,user_id,outcome')
      .eq('user_id', actorId)
      .eq('outcome', 'reading');
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
    const ids: string[] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const candidate = row as Record<string, unknown>;
      if (
        isNonEmptyString(candidate.user_book_id) &&
        candidate.user_id === actorId &&
        candidate.outcome === 'reading'
      ) {
        ids.push(candidate.user_book_id);
      }
    }
    return ids;
  },

  async readsForUser(actorId: string, signal?: AbortSignal): Promise<ReadingRead[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('user_book_reads')
      .select('*')
      .eq('user_id', actorId)
      .order('read_number', { ascending: true })
      .order('created_at', { ascending: true });
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

  /**
   * Yearly goal write (SDD-09 §4.7 H-16). Never uses `upsert`: a PostgREST
   * upsert sets every payload column on conflict and needs UPDATE on
   * `user_id`/`year`, which is refused live. Update first (owner-filtered),
   * insert when no row exists, retry the update once on 23505.
   * `target = null` deletes the row.
   */
  async setGoal(actorId: string, year: number, target: number | null): Promise<ReadingGoal | null> {
    currentActor(actorId);
    validateGoalYear(year);
    if (target !== null) validateGoalTarget(target);
    if (target === null) {
      let error: DatabaseError | null;
      try {
        const result = await supabase
          .from('user_reading_goals')
          .delete()
          .eq('user_id', actorId)
          .eq('year', year);
        error = result.error;
      } catch (caught) {
        throwIfAborted(undefined, caught);
        throw new ReadingHistoryError(UPDATE_MESSAGE);
      }
      throwIfAborted(undefined, error);
      currentActor(actorId);
      if (error) throwUpdateError(error);
      return null;
    }
    const runUpdate = async (): Promise<{ data: unknown; error: DatabaseError | null }> => {
      try {
        const result = await supabase
          .from('user_reading_goals')
          .update({ target_books: target })
          .eq('user_id', actorId)
          .eq('year', year)
          .select('*');
        return { data: result.data, error: result.error };
      } catch (caught) {
        throwIfAborted(undefined, caught);
        throw new ReadingHistoryError(UPDATE_MESSAGE);
      }
    };
    const first = await runUpdate();
    throwIfAborted(undefined, first.error);
    currentActor(actorId);
    if (first.error) throwUpdateError(first.error);
    const updatedRows: unknown[] = Array.isArray(first.data) ? first.data : [];
    const matched = updatedRows.filter(
      (row): row is ReadingGoal => isReadingGoal(row) && row.user_id === actorId && row.year === year,
    );
    if (matched.length === 1) return matched[0];
    if (matched.length > 1) throw new ReadingHistoryError(UPDATE_MESSAGE);
    let insertData: unknown;
    let insertError: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_reading_goals')
        .insert({ user_id: actorId, year, target_books: target })
        .select('*')
        .single();
      insertData = result.data;
      insertError = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, insertError);
    currentActor(actorId);
    if (!insertError) {
      if (!isReadingGoal(insertData) || insertData.user_id !== actorId || insertData.year !== year) {
        throw new ReadingHistoryError(UPDATE_MESSAGE);
      }
      return insertData;
    }
    if (insertError.code !== '23505') throwUpdateError(insertError);
    const retried = await runUpdate();
    throwIfAborted(undefined, retried.error);
    currentActor(actorId);
    if (retried.error) throwUpdateError(retried.error);
    const retriedRows: unknown[] = Array.isArray(retried.data) ? retried.data : [];
    const retriedMatch = retriedRows.filter(
      (row): row is ReadingGoal => isReadingGoal(row) && row.user_id === actorId && row.year === year,
    );
    if (retriedMatch.length !== 1) throw new ReadingHistoryError(UPDATE_MESSAGE);
    return retriedMatch[0];
  },

  /**
   * "Leave out of my stats" (SDD-09 §4.7 H-17): one owner-filtered update
   * setting `counts_in_stats` on every read of the book. Later reads copy
   * the flag in the database trigger.
   */
  async setCountsInStats(
    actorId: string,
    userBookId: string,
    value: boolean,
  ): Promise<ReadingRead[]> {
    currentActor(actorId);
    if (!isNonEmptyString(userBookId)) throw new ReadingHistoryError(UPDATE_MESSAGE);
    if (typeof value !== 'boolean') throw new ReadingHistoryError(UPDATE_MESSAGE);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_book_reads')
        .update({ counts_in_stats: value })
        .eq('user_book_id', userBookId)
        .eq('user_id', actorId)
        .select('*');
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
    const rows: unknown[] = Array.isArray(data) ? data : [];
    const valid = rows.filter(
      (row): row is ReadingRead =>
        isReadingRead(row) && row.user_id === actorId && row.user_book_id === userBookId,
    );
    if (valid.length !== rows.length) throw new ReadingHistoryError(UPDATE_MESSAGE);
    return valid;
  },

  /**
   * All of the user's `quote` notes, newest first — one owner-filtered query
   * for the year-card picker (no per-book N+1).
   */
  async quotesForUser(actorId: string, signal?: AbortSignal): Promise<YearQuoteRow[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('reading_notes')
      .select('*')
      .eq('user_id', actorId)
      .eq('tag', 'quote')
      .order('created_at', { ascending: false });
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
      (row): row is YearQuoteRow => isYearQuoteRow(row) && row.user_id === actorId,
    );
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

  async setNextRead(actorId: string, userBookId: string | null): Promise<ReadingSettings> {
    currentActor(actorId);
    if (userBookId !== null && !isNonEmptyString(userBookId)) {
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    // The conflict write needs UPDATE on user_id (not granted), so update first,
    // then insert when no row exists.
    const runUpdate = async (): Promise<{ data: unknown; error: DatabaseError | null }> => {
      try {
        const result = await supabase
          .from('user_reading_settings')
          .update({ next_read_user_book_id: userBookId })
          .eq('user_id', actorId)
          .select('*');
        return { data: result.data, error: result.error };
      } catch (caught) {
        throwIfAborted(undefined, caught);
        throw new ReadingHistoryError(UPDATE_MESSAGE);
      }
    };
    let first: { data: unknown; error: DatabaseError | null };
    try {
      first = await runUpdate();
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw caught;
    }
    throwIfAborted(undefined, first.error);
    currentActor(actorId);
    if (first.error) throwUpdateError(first.error);
    const updatedRows: unknown[] = Array.isArray(first.data) ? first.data : [];
    const matched = updatedRows.filter(
      (row): row is ReadingSettings => isReadingSettings(row) && row.user_id === actorId,
    );
    if (matched.length === 1) return matched[0];
    if (matched.length > 1) throw new ReadingHistoryError(UPDATE_MESSAGE);
    let insertData: unknown;
    let insertError: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_reading_settings')
        .insert({ user_id: actorId, next_read_user_book_id: userBookId })
        .select('*')
        .single();
      insertData = result.data;
      insertError = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, insertError);
    currentActor(actorId);
    if (!insertError) {
      if (!isReadingSettings(insertData) || insertData.user_id !== actorId) {
        throw new ReadingHistoryError(UPDATE_MESSAGE);
      }
      return insertData;
    }
    if (insertError.code !== '23505') throwUpdateError(insertError);
    const retried = await runUpdate();
    throwIfAborted(undefined, retried.error);
    currentActor(actorId);
    if (retried.error) throwUpdateError(retried.error);
    const retriedRows: unknown[] = Array.isArray(retried.data) ? retried.data : [];
    const retriedMatch = retriedRows.filter(
      (row): row is ReadingSettings => isReadingSettings(row) && row.user_id === actorId,
    );
    if (retriedMatch.length !== 1) throw new ReadingHistoryError(UPDATE_MESSAGE);
    return retriedMatch[0];
  },

  async updateReadDates(actorId: string, readId: string, patch: ReadDatesPatch): Promise<ReadingRead> {
    currentActor(actorId);
    validateReadDatesPatch(patch);
    const values: Record<string, string | boolean | number | null> = {};
    for (const key of ALLOWED_DATE_COLUMNS) {
      if (key in patch) values[key] = patch[key] as string | boolean | number | null;
    }
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_book_reads')
        .update(values)
        .eq('id', readId)
        .eq('user_id', actorId)
        .select('*')
        .single();
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
    if (!isReadingRead(data) || data.user_id !== actorId || data.id !== readId) {
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    return data;
  },

  async removeRead(actorId: string, readId: string): Promise<boolean> {
    currentActor(actorId);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_book_reads')
        .delete()
        .eq('id', readId)
        .eq('user_id', actorId)
        .select('id');
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
    const rows: unknown[] = Array.isArray(data) ? data : [];
    if (rows.length !== 1) throw new ReadingHistoryError(REMOVE_MESSAGE);
    return true;
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

  async addProgress(
    actorId: string,
    readId: string,
    value: ProgressValue,
  ): Promise<ReadingProgressEntry> {
    currentActor(actorId);
    validateProgressValue(value);
    const insertPayload: Record<string, string | number | null> = {
      read_id: readId,
      user_id: actorId,
      page: null,
      percent: null,
    };
    if ('page' in value) insertPayload.page = value.page;
    else insertPayload.percent = (value as { percent: number }).percent;
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_book_progress')
        .insert(insertPayload)
        .select('*')
        .single();
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
    if (
      !isReadingProgressEntry(data) ||
      data.user_id !== actorId ||
      data.read_id !== readId
    ) {
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    return data;
  },

  async userBookTitle(
    actorId: string,
    userBookId: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let query = supabase
      .from('user_books')
      .select('id,user_id,book:books(title)')
      .eq('id', userBookId)
      .eq('user_id', actorId);
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
    if (!data || typeof data !== 'object') throw new ReadingHistoryError(LOAD_MESSAGE);
    const row = data as Record<string, unknown>;
    if (row.user_id !== actorId || row.id !== userBookId) return null;
    return extractJoinedBookTitle(data);
  },

  async openReadsWithProgress(
    actorId: string,
    signal?: AbortSignal,
  ): Promise<OpenReadWithProgress[]> {
    currentActor(actorId);
    throwIfAborted(signal, undefined);
    let readsQuery = supabase
      .from('user_book_reads')
      .select(
        'id,user_book_id,user_id,read_number,outcome,started_at,ended_at,started_on,ended_on,start_unknown,end_unknown,total_pages,counts_in_stats,created_at,updated_at',
      )
      .eq('user_id', actorId)
      .eq('outcome', 'reading')
      .order('updated_at', { ascending: false });
    if (signal) readsQuery = readsQuery.abortSignal(signal);
    let readsData: unknown;
    let readsError: DatabaseError | null;
    try {
      const result = await readsQuery;
      readsData = result.data;
      readsError = result.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, readsError);
    currentActor(actorId);
    if (readsError) throwLoadError(readsError);
    const rows: unknown[] = Array.isArray(readsData) ? readsData : [];
    const openReads = rows.filter(
      (row): row is ReadingRead =>
        isReadingRead(row) && row.user_id === actorId && row.outcome === 'reading',
    );
    if (openReads.length === 0) return [];
    const bookIds = [...new Set(openReads.map((read) => read.user_book_id))];
    const readIds = openReads.map((read) => read.id);
    throwIfAborted(signal, undefined);
    currentActor(actorId);
    let titlesData: unknown;
    let titlesError: DatabaseError | null;
    try {
      let titlesQuery = supabase
        .from('user_books')
        .select('id,user_id,book:books(title)')
        .eq('user_id', actorId)
        .in('id', bookIds);
      if (signal) titlesQuery = titlesQuery.abortSignal(signal);
      const titlesResult = await titlesQuery;
      titlesData = titlesResult.data;
      titlesError = titlesResult.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, titlesError);
    currentActor(actorId);
    if (titlesError) throwLoadError(titlesError);
    const titleRows: unknown[] = Array.isArray(titlesData) ? titlesData : [];
    const titleByBookId = new Map<string, string>();
    for (const row of titleRows) {
      if (!row || typeof row !== 'object') continue;
      const candidate = row as Record<string, unknown>;
      if (candidate.user_id !== actorId || typeof candidate.id !== 'string') continue;
      const bookTitle = extractJoinedBookTitle(row);
      if (!bookTitle) continue;
      if (!titleByBookId.has(candidate.id)) titleByBookId.set(candidate.id, bookTitle);
    }
    throwIfAborted(signal, undefined);
    currentActor(actorId);
    let progData: unknown;
    let progError: DatabaseError | null;
    try {
      let progQuery = supabase
        .from('user_book_progress')
        .select('id,read_id,user_id,page,percent,recorded_at')
        .eq('user_id', actorId)
        .in('read_id', readIds)
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false });
      if (signal) progQuery = progQuery.abortSignal(signal);
      const progResult = await progQuery;
      progData = progResult.data;
      progError = progResult.error;
    } catch (caught) {
      throwIfAborted(signal, caught);
      throw new ReadingHistoryError(LOAD_MESSAGE);
    }
    throwIfAborted(signal, progError);
    currentActor(actorId);
    if (progError) throwLoadError(progError);
    const progRows: unknown[] = Array.isArray(progData) ? progData : [];
    const validProgress = progRows.filter(
      (row): row is ReadingProgressEntry =>
        isReadingProgressEntry(row) && row.user_id === actorId && readIds.includes(row.read_id),
    );
    validProgress.sort((a, b) => {
      const time = Date.parse(b.recorded_at) - Date.parse(a.recorded_at);
      if (time !== 0) return time;
      if (a.id === b.id) return 0;
      return a.id < b.id ? 1 : -1;
    });
    const latestByReadId = new Map<string, ReadingProgressEntry>();
    for (const row of validProgress) {
      if (!latestByReadId.has(row.read_id)) latestByReadId.set(row.read_id, row);
    }
    const out: OpenReadWithProgress[] = [];
    for (const read of openReads) {
      const bookTitle = titleByBookId.get(read.user_book_id);
      if (!bookTitle) continue;
      out.push({ read, bookTitle, latestProgress: latestByReadId.get(read.id) ?? null });
    }
    out.sort((a, b) => Date.parse(b.read.updated_at) - Date.parse(a.read.updated_at));
    return out;
  },

  async setTotalPages(
    actorId: string,
    readId: string,
    totalPages: number | null,
  ): Promise<ReadingRead> {
    currentActor(actorId);
    validateTotalPages(totalPages);
    let data: unknown;
    let error: DatabaseError | null;
    try {
      const result = await supabase
        .from('user_book_reads')
        .update({ total_pages: totalPages })
        .eq('id', readId)
        .eq('user_id', actorId)
        .select('*')
        .single();
      data = result.data;
      error = result.error;
    } catch (caught) {
      throwIfAborted(undefined, caught);
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    throwIfAborted(undefined, error);
    currentActor(actorId);
    if (error) throwUpdateError(error);
    if (!isReadingRead(data) || data.user_id !== actorId || data.id !== readId) {
      throw new ReadingHistoryError(UPDATE_MESSAGE);
    }
    return data;
  },
};
