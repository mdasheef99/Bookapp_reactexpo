/** SDD-09 Unit 1 read layer contract (no UI). Mirrors migration 20261022160000. */

export type ReadOutcome = 'reading' | 'finished' | 'did_not_finish';

export const READ_OUTCOMES: readonly ReadOutcome[] = ['reading', 'finished', 'did_not_finish'];

/** All columns of `user_book_reads`. Dates: instants are ISO strings, picked days are YYYY-MM-DD. */
export interface ReadingRead {
  id: string;
  user_book_id: string;
  user_id: string;
  read_number: number;
  outcome: ReadOutcome;
  started_at: string | null;
  ended_at: string | null;
  started_on: string | null;
  ended_on: string | null;
  start_unknown: boolean;
  end_unknown: boolean;
  total_pages: number | null;
  counts_in_stats: boolean;
  created_at: string;
  updated_at: string;
}

/** One row of `user_book_progress`. Exactly one of `page` / `percent` is non-null. */
export interface ReadingProgressEntry {
  id: string;
  read_id: string;
  user_id: string;
  page: number | null;
  percent: number | null;
  recorded_at: string;
}

/** One row of `user_reading_goals`. */
export interface ReadingGoal {
  user_id: string;
  year: number;
  target_books: number;
  updated_at: string;
}

/** One row of `user_reading_settings`. */
export interface ReadingSettings {
  user_id: string;
  next_read_user_book_id: string | null;
  updated_at: string;
}

export const historyKeys = {
  readsForBook: (actor: string, book: string) => ['library-history-reads-book', actor, book] as const,
  readsForUser: (actor: string) => ['library-history-reads-user', actor] as const,
  progressForRead: (actor: string, read: string) => ['library-history-progress', actor, read] as const,
  goal: (actor: string, year: number) => ['library-history-goal', actor, year] as const,
  settings: (actor: string) => ['library-history-settings', actor] as const,
};

export class ReadingHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadingHistoryError';
  }
}

function toLocalDay(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type ReadDateEdges = Pick<
  ReadingRead,
  'started_at' | 'ended_at' | 'started_on' | 'ended_on' | 'start_unknown' | 'end_unknown'
>;

/**
 * Effective calendar days (YYYY-MM-DD) for a read.
 * A picked day wins over the instant (converted to the device's local day);
 * `*_unknown = true` forces null.
 */
export function effectiveReadDates(read: ReadDateEdges): { start: string | null; end: string | null } {
  const start = read.start_unknown ? null : (read.started_on ?? toLocalDay(read.started_at));
  const end = read.end_unknown ? null : (read.ended_on ?? toLocalDay(read.ended_at));
  return { start: start ?? null, end: end ?? null };
}
