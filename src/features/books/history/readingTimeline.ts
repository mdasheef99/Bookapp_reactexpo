import { effectiveReadDates, ReadingRead, toLocalDay } from './readingHistoryContract';
import { countingFinishedEndsInYear } from './readingStats';
import type { ManualNote } from '../notes/manualNoteContract';

export interface ReadWindow {
  start: string | null;
  end: string | null;
}

function todayString(timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value.padStart(4, '0') ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + delta * 86400000;
  const check = new Date(ms);
  const year = String(check.getUTCFullYear()).padStart(4, '0');
  const month = String(check.getUTCMonth() + 1).padStart(2, '0');
  const date = String(check.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export interface AssignedNotes {
  byReadId: Record<string, ManualNote[]>;
  otherNotes: ManualNote[];
}

function readStartAtOrBeforeNote(read: ReadingRead, noteTime: number): boolean {
  if (Number.isNaN(noteTime)) return true;
  if (read.start_unknown) return true;
  if (read.started_on !== null) return true;
  if (read.started_at === null) return true;
  const startTime = Date.parse(read.started_at);
  if (Number.isNaN(startTime)) return true;
  return startTime <= noteTime;
}

/**
 * Assign notes to reads by effective local days (SDD-09 §4.6 H-13).
 * - Open read window ends today; unknown start begins after the previous
 *   read's end day + 1 or at the beginning.
 * - Unknown end on a closed read ends before the next read's start day − 1
 *   or today.
 * - Day windows decide which reads are candidates. When more than one read
 *   is a candidate, pick the latest candidate whose start is at or before
 *   the note: compare instants (`note.created_at` vs the read's
 *   `started_at`) when the read has no picked start (`started_on` null)
 *   and `started_at` is set; when the start is a picked day or unknown,
 *   treat it as starting at the beginning of that day (so the later read
 *   wins). If no candidate qualifies, use the earliest candidate.
 * - Notes outside every window go to `otherNotes`.
 * Buckets are sorted newest first for display.
 */
export function assignNotesToReads(
  reads: readonly ReadingRead[],
  notes: readonly ManualNote[],
  timeZone?: string,
): AssignedNotes {
  const sorted = [...reads].sort((a, b) => a.read_number - b.read_number);
  const effective = new Map<string, { start: string | null; end: string | null }>();
  for (const read of sorted) {
    effective.set(read.id, effectiveReadDates(read, timeZone));
  }
  const today = todayString(timeZone);
  const windows = new Map<string, ReadWindow>();
  for (let index = 0; index < sorted.length; index += 1) {
    const read = sorted[index];
    const eff = effective.get(read.id) ?? { start: null, end: null };
    let windowStart: string | null;
    if (eff.start) {
      windowStart = eff.start;
    } else {
      const previous = sorted[index - 1];
      if (previous) {
        const previousEnd = effective.get(previous.id)?.end ?? null;
        windowStart = previousEnd ? addDays(previousEnd, 1) : null;
      } else {
        windowStart = null;
      }
    }
    let windowEnd: string | null;
    if (read.outcome === 'reading') {
      windowEnd = today;
    } else if (eff.end) {
      windowEnd = eff.end;
    } else {
      const next = sorted[index + 1];
      if (next) {
        const nextStart = effective.get(next.id)?.start ?? null;
        windowEnd = nextStart ? addDays(nextStart, -1) : today;
      } else {
        windowEnd = today;
      }
    }
    windows.set(read.id, { start: windowStart, end: windowEnd });
  }

  const byReadId: Record<string, ManualNote[]> = {};
  for (const read of sorted) byReadId[read.id] = [];
  const otherNotes: ManualNote[] = [];

  for (const note of notes) {
    const day = toLocalDay(note.created_at, timeZone);
    if (!day) {
      otherNotes.push(note);
      continue;
    }
    const candidates: ReadingRead[] = [];
    for (const read of sorted) {
      const window = windows.get(read.id);
      if (!window) continue;
      if (window.start !== null && window.end !== null && window.start > window.end) continue;
      const afterStart = window.start === null || day >= window.start;
      const beforeEnd = window.end === null || day <= window.end;
      if (afterStart && beforeEnd) candidates.push(read);
    }
    if (candidates.length === 0) {
      otherNotes.push(note);
    } else if (candidates.length === 1) {
      byReadId[candidates[0].id].push(note);
    } else {
      const noteTime = Date.parse(note.created_at);
      let best: ReadingRead | null = null;
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const candidate = candidates[index];
        if (readStartAtOrBeforeNote(candidate, noteTime)) {
          best = candidate;
          break;
        }
      }
      // No candidate started at or before the note: keep the note with the
      // earliest candidate rather than the later read.
      byReadId[(best ?? candidates[0]).id].push(note);
    }
  }

  const newestFirst = (a: ManualNote, b: ManualNote): number => {
    const time = Date.parse(b.created_at) - Date.parse(a.created_at);
    if (time !== 0) return time;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  };
  for (const id of Object.keys(byReadId)) byReadId[id].sort(newestFirst);
  otherNotes.sort(newestFirst);
  return { byReadId, otherNotes };
}

export function ordinal(count: number): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${count}th`;
  const mod10 = count % 10;
  if (mod10 === 1) return `${count}st`;
  if (mod10 === 2) return `${count}nd`;
  if (mod10 === 3) return `${count}rd`;
  return `${count}th`;
}

/**
 * "Your Nth book this year" (SDD-09 §4.7 counting rule).
 * Counts distinct books with a counting finished read whose effective end
 * day falls in the target read's calendar year, on or before the target
 * end day. Returns null when the target end is unknown or the target
 * read is excluded from stats.
 */
export function nthBookCount(
  allReads: readonly ReadingRead[],
  targetReadId: string,
  timeZone?: string,
): number | null {
  const target = allReads.find((read) => read.id === targetReadId) ?? null;
  if (!target) return null;
  if (target.outcome !== 'finished') return null;
  if (!target.counts_in_stats) return null;
  const targetEnd = effectiveReadDates(target, timeZone).end;
  if (!targetEnd) return null;
  const year = targetEnd.slice(0, 4);
  // Shared yearly counting rule with the stats/goal count
  // (readingStats.countingFinishedEndsInYear): distinct books with a counting
  // finished read ending in the year, on or before the target end day.
  const books = new Set<string>();
  for (const { read, end } of countingFinishedEndsInYear(allReads, year, timeZone)) {
    if (end > targetEnd) continue;
    books.add(read.user_book_id);
  }
  return books.size;
}
