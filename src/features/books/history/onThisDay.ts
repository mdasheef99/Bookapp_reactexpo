import { effectiveReadDates, ReadingRead } from './readingHistoryContract';

/**
 * "On this day" matcher (SDD-10 Unit D §4.4, D10-12).
 * Pure: `today` is YYYY-MM-DD in `zone`; no `new Date()` inside.
 * A read matches when ALL hold: finished, in stats, known finish day with
 * today's month/day, finish year strictly earlier than this year, and its
 * book exists in the lookup. 29 Feb also matches 28 Feb in non-leap years.
 */

export interface OnThisDayMatch {
  readId: string;
  userBookId: string;
  title: string;
  year: number;
  endedDay: string;
}

export type OnThisDayTitles = ReadonlyMap<string, string> | Record<string, string | null | undefined>;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(day: string): { year: number; month: number; day: number } | null {
  const match = DAY_RE.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(date)) return null;
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, date));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    return null;
  }
  return { year, month, day: date };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function titleFor(titles: OnThisDayTitles, userBookId: string): string | null {
  try {
    if (typeof (titles as ReadonlyMap<string, string>).get === 'function') {
      const value = (titles as ReadonlyMap<string, string>).get(userBookId);
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    const value = (titles as Record<string, string | null | undefined>)[userBookId];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

function endedMillis(value: string | null): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/**
 * Ordered, deduplicated matches for `today` (YYYY-MM-DD in `zone`).
 * Order: year newest first, then `ended_at` newest first (null last),
 * then `id` ascending. Dedupe by book + year, keeping the first in order.
 * Tolerant: malformed days, dates or zones never throw — the read is skipped.
 */
export function findOnThisDay(
  reads: readonly ReadingRead[],
  today: string,
  zone: string,
  titles: OnThisDayTitles,
): OnThisDayMatch[] {
  if (!Array.isArray(reads)) return [];
  if (typeof today !== 'string' || typeof zone !== 'string' || !titles || typeof titles !== 'object') return [];
  const current = parseDay(today);
  if (!current) return [];

  interface Candidate extends OnThisDayMatch {
    endedAtMillis: number | null;
    readSortId: string;
  }

  const candidates: Candidate[] = [];
  for (const read of reads) {
    try {
      if (!read || typeof read !== 'object') continue;
      if (read.outcome !== 'finished') continue;
      if (read.counts_in_stats !== true) continue;
      const userBookId = typeof read.user_book_id === 'string' ? read.user_book_id : '';
      if (!userBookId) continue;
      let end: string | null = null;
      try {
        end = effectiveReadDates(read, zone).end;
      } catch {
        continue;
      }
      if (typeof end !== 'string' || end.length === 0) continue;
      const finish = parseDay(end);
      if (!finish) continue;
      if (finish.year >= current.year) continue;
      const sameDay = finish.month === current.month && finish.day === current.day;
      const feb29Fallback =
        current.month === 2 &&
        current.day === 28 &&
        !isLeapYear(current.year) &&
        finish.month === 2 &&
        finish.day === 29;
      if (!sameDay && !feb29Fallback) continue;
      const title = titleFor(titles, userBookId);
      if (!title) continue;
      const readId = typeof read.id === 'string' ? read.id : '';
      if (!readId) continue;
      candidates.push({
        readId,
        userBookId,
        title,
        year: finish.year,
        endedDay: end,
        endedAtMillis: endedMillis(read.ended_at),
        readSortId: readId,
      });
    } catch {
      continue;
    }
  }

  candidates.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const aTime = a.endedAtMillis;
    const bTime = b.endedAtMillis;
    if (aTime !== null || bTime !== null) {
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      if (aTime !== bTime) return bTime - aTime;
    }
    if (a.readSortId === b.readSortId) return 0;
    return a.readSortId < b.readSortId ? -1 : 1;
  });

  const seen = new Set<string>();
  const out: OnThisDayMatch[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.userBookId}|${candidate.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      readId: candidate.readId,
      userBookId: candidate.userBookId,
      title: candidate.title,
      year: candidate.year,
      endedDay: candidate.endedDay,
    });
  }
  return out;
}
