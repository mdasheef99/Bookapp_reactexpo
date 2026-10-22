import { effectiveReadDates, ReadingRead, toLocalDay } from './readingHistoryContract';

/**
 * Compact stats pure functions (SDD-09 §4.7 H-17).
 *
 * Scope rules (follow exactly):
 * - `counts_in_stats = false` is excluded from every number.
 * - Books finished, the goal and "Your Nth book this year" count distinct
 *   books with a counting finished read ending in that year. All-time counts
 *   distinct books ever with a counting finished read (unknown end included).
 * - Pages, finish rate and average days count reads (not distinct books).
 * - Pages = sum of `total_pages` of counting finished reads in scope;
 *   reads with unknown `total_pages` are excluded from the sum; distinct
 *   books with an unknown page count are counted separately for the
 *   "N books without a page count" note.
 * - Finish rate = finished ÷ (finished + did_not_finish), counting reads
 *   only; null when there are no finished + did-not-finish reads in scope.
 *   Open reads (`reading`) are never in the rate.
 * - Average days = mean of (end day − start day + 1) in calendar days via
 *   `Date.UTC`, over counting finished reads in scope with both effective
 *   days known; null when none.
 * - Monthly bars = 12 counts of counting finished reads per end month
 *   (reads, not distinct books). A book finished twice in one year appears
 *   twice, so bars can exceed the yearly book count.
 * - Unknown end day: left out of the yearly numbers and bars, but included
 *   in all-time totals (books, pages, finish rate; average needs both days
 *   so an unknown end never qualifies there).
 * - Did-not-finish reads count only in the finish rate.
 *
 * Every function takes an explicit optional `timeZone` (device zone when
 * omitted) so tests pin it explicitly.
 */

function yearOfDay(day: string): string {
  return day.slice(0, 4);
}

function monthOfDay(day: string): number {
  return Number(day.slice(5, 7)) - 1;
}

/** Counting finished reads: outcome finished and included in stats. */
export function countingFinishedReads(reads: readonly ReadingRead[]): ReadingRead[] {
  return reads.filter((read) => read.outcome === 'finished' && read.counts_in_stats);
}

/** Counting reads for the finish rate: finished + did_not_finish, in stats. */
export function countingRateReads(reads: readonly ReadingRead[]): ReadingRead[] {
  return reads.filter(
    (read) =>
      read.counts_in_stats && (read.outcome === 'finished' || read.outcome === 'did_not_finish'),
  );
}

export interface FinishedEnd {
  read: ReadingRead;
  end: string;
}

/**
 * Shared helper for the yearly counting rule: counting finished reads with
 * a known effective end day in `year`. Used by the yearly book count, pages,
 * average, bars — and by `nthBookCount` (which adds the ≤ target-end filter).
 */
export function countingFinishedEndsInYear(
  reads: readonly ReadingRead[],
  year: number | string,
  timeZone?: string,
): FinishedEnd[] {
  const prefix = String(year);
  const out: FinishedEnd[] = [];
  for (const read of countingFinishedReads(reads)) {
    const end = effectiveReadDates(read, timeZone).end;
    if (!end) continue;
    if (yearOfDay(end) !== prefix) continue;
    out.push({ read, end });
  }
  return out;
}

/** Distinct books with a counting finished read ending in `year`. */
export function distinctFinishedBookIdsInYear(
  reads: readonly ReadingRead[],
  year: number | string,
  timeZone?: string,
): Set<string> {
  const ids = new Set<string>();
  for (const { read } of countingFinishedEndsInYear(reads, year, timeZone)) {
    ids.add(read.user_book_id);
  }
  return ids;
}

/** Yearly goal / Home count: distinct books finished in `year`. */
export function yearBooksFinishedCount(
  reads: readonly ReadingRead[],
  year: number | string,
  timeZone?: string,
): number {
  return distinctFinishedBookIdsInYear(reads, year, timeZone).size;
}

/** Books finished in scope: yearly distinct in year, or all-time distinct ever. */
export function booksFinished(
  reads: readonly ReadingRead[],
  year: number | string | null,
  timeZone?: string,
): number {
  if (year === null || year === undefined) {
    const ids = new Set<string>();
    for (const read of countingFinishedReads(reads)) ids.add(read.user_book_id);
    return ids.size;
  }
  return yearBooksFinishedCount(reads, year, timeZone);
}

export interface PagesRead {
  pages: number;
  /** Distinct books with a counting finished read in scope and unknown `total_pages`. */
  unknownCount: number;
}

/** Pages read in scope (yearly by end year, or all-time). */
export function pagesRead(
  reads: readonly ReadingRead[],
  year: number | string | null,
  timeZone?: string,
): PagesRead {
  const prefix = year === null || year === undefined ? null : String(year);
  let pages = 0;
  const unknownBooks = new Set<string>();
  for (const read of countingFinishedReads(reads)) {
    if (prefix !== null) {
      const end = effectiveReadDates(read, timeZone).end;
      if (!end || yearOfDay(end) !== prefix) continue;
    }
    if (read.total_pages === null || read.total_pages === undefined) {
      unknownBooks.add(read.user_book_id);
    } else {
      pages += read.total_pages;
    }
  }
  return { pages, unknownCount: unknownBooks.size };
}

/**
 * Finish rate in scope (yearly by effective end year, or all-time).
 * Yearly scope excludes reads with an unknown end day; all-time includes
 * every counting finished / did-not-finish read. Null when no denominator.
 */
export function finishRate(
  reads: readonly ReadingRead[],
  year: number | string | null,
  timeZone?: string,
): number | null {
  const prefix = year === null || year === undefined ? null : String(year);
  let finished = 0;
  let stopped = 0;
  for (const read of countingRateReads(reads)) {
    if (prefix !== null) {
      const end = effectiveReadDates(read, timeZone).end;
      if (!end || yearOfDay(end) !== prefix) continue;
    }
    if (read.outcome === 'finished') finished += 1;
    else stopped += 1;
  }
  const total = finished + stopped;
  if (total === 0) return null;
  return finished / total;
}

function calendarDaysInclusive(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const diff = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  return diff + 1;
}

/**
 * Average days per book in scope (yearly by end year, or all-time).
 * Mean of end − start + 1 over counting finished reads with both effective
 * days known. Null when none qualify.
 */
export function averageDaysPerBook(
  reads: readonly ReadingRead[],
  year: number | string | null,
  timeZone?: string,
): number | null {
  const prefix = year === null || year === undefined ? null : String(year);
  let total = 0;
  let count = 0;
  for (const read of countingFinishedReads(reads)) {
    const dates = effectiveReadDates(read, timeZone);
    if (!dates.start || !dates.end) continue;
    if (prefix !== null && yearOfDay(dates.end) !== prefix) continue;
    total += calendarDaysInclusive(dates.start, dates.end);
    count += 1;
  }
  if (count === 0) return null;
  return total / count;
}

/** 12 monthly bars of counting finished reads ending in `year` (index 0 = Jan). */
export function monthlyFinishedReads(
  reads: readonly ReadingRead[],
  year: number | string,
  timeZone?: string,
): number[] {
  const bars = Array(12).fill(0) as number[];
  for (const { end } of countingFinishedEndsInYear(reads, year, timeZone)) {
    bars[monthOfDay(end)] += 1;
  }
  return bars;
}

export interface YearStats {
  books: number;
  pages: number;
  unknownPages: number;
  rate: number | null;
  averageDays: number | null;
  monthly: number[];
}

export interface AllTimeStats {
  books: number;
  pages: number;
  unknownPages: number;
  rate: number | null;
  averageDays: number | null;
}

/** Full yearly summary for the stats screen (This year view). */
export function yearStats(
  reads: readonly ReadingRead[],
  year: number | string,
  timeZone?: string,
): YearStats {
  const pages = pagesRead(reads, year, timeZone);
  return {
    books: yearBooksFinishedCount(reads, year, timeZone),
    pages: pages.pages,
    unknownPages: pages.unknownCount,
    rate: finishRate(reads, year, timeZone),
    averageDays: averageDaysPerBook(reads, year, timeZone),
    monthly: monthlyFinishedReads(reads, year, timeZone),
  };
}

/** Full all-time summary for the stats screen (All time view, no bars). */
export function allTimeStats(
  reads: readonly ReadingRead[],
  timeZone?: string,
): AllTimeStats {
  const pages = pagesRead(reads, null, timeZone);
  return {
    books: booksFinished(reads, null, timeZone),
    pages: pages.pages,
    unknownPages: pages.unknownCount,
    rate: finishRate(reads, null, timeZone),
    averageDays: averageDaysPerBook(reads, null, timeZone),
  };
}

export interface YearQuote {
  id: string;
  content: string;
  created_at: string;
  user_book_id: string;
}

/**
 * Quotes of `year` (by note local day), newest first. The year card defaults
 * to the first entry (the newest `quote` note of that year).
 */
export function quotesOfYear(
  quotes: readonly YearQuote[],
  year: number | string,
  timeZone?: string,
): YearQuote[] {
  const prefix = String(year);
  return quotes
    .filter((quote) => {
      const day = toLocalDay(quote.created_at, timeZone);
      return !!day && yearOfDay(day) === prefix;
    })
    .sort((a, b) => {
      const time = Date.parse(b.created_at) - Date.parse(a.created_at);
      if (time !== 0) return time;
      if (a.id === b.id) return 0;
      return a.id < b.id ? -1 : 1;
    });
}

/** "Your 2026 so far" until the year ends, then "Your 2026". */
export function yearCardTitle(year: number | string, now = new Date()): string {
  const label = String(year);
  const currentYear = now.getFullYear();
  if (Number(label) >= currentYear) return `Your ${label} so far`;
  return `Your ${label}`;
}
