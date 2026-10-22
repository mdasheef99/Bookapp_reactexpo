import type { ReadingProgressEntry } from './readingHistoryContract';

/**
 * SDD-09 Unit 3a progress maths (SDD §4.5).
 * Day boundaries are calendar days in `timeZone` (or the device zone when
 * omitted), so production callers keep device behaviour while tests can pin
 * an IANA zone explicitly.
 */

export type ProgressKind = 'page' | 'percent';

export interface ProgressPosition {
  entry: ReadingProgressEntry;
  kind: ProgressKind;
  /** Resolved pages, or null when a % entry has no total to convert through. */
  pages: number | null;
  /** Percent: raw % in % mode, otherwise rounded from pages/total. Null without a total for page entries. */
  percent: number | null;
  totalPages: number | null;
}

export interface DailyPagesDay {
  /** Local calendar day YYYY-MM-DD. */
  day: string;
  /** Clamped pages gained on that day (>= 0). Negative step gains count as 0. */
  pages: number;
}

export interface DailyPagesResult {
  /** 14 local days ending today (oldest first). */
  days: DailyPagesDay[];
  /** True when any step gain inside the window was negative (drawn as 0). */
  hasNegativeGain: boolean;
}

export interface ProgressEstimate {
  pacePagesPerDay: number;
  daysRemaining: number;
  text: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ESTIMATE_WINDOW_DAYS = 14;
const ESTIMATE_MAX_DAYS = 365;

function toLocalDayString(value: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value.padStart(4, '0') ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

function localDayPartsInZone(
  value: Date,
  timeZone?: string,
): { year: number; month: number; day: number } | null {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

function parseDayToLocalDate(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

function localDayOfTimestamp(recordedAt: string, timeZone?: string): string | null {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return null;
  return toLocalDayString(date, timeZone);
}

function sortedByRecordedAt(entries: readonly ReadingProgressEntry[]): ReadingProgressEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = Date.parse(a.recorded_at);
    const bTime = Date.parse(b.recorded_at);
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return aTime - bTime;
  });
}

function windowDayStrings(now: Date, timeZone?: string, size = ESTIMATE_WINDOW_DAYS): string[] {
  const days: string[] = [];
  const parts = localDayPartsInZone(now, timeZone);
  if (!parts) return days;
  for (let delta = size - 1; delta >= 0; delta -= 1) {
    // Pure calendar arithmetic on Y/M/D integers: subtracting days via
    // Date.UTC never touches local ms/day lengths, so DST transitions
    // can't duplicate or skip a calendar day.
    const cursor = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - delta));
    const year = String(cursor.getUTCFullYear()).padStart(4, '0');
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cursor.getUTCDate()).padStart(2, '0');
    days.push(`${year}-${month}-${day}`);
  }
  return days;
}

function parseDayParts(day: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const dayNum = Number(match[3]);
  if (!isRealCalendarDay(year, month, dayNum)) return null;
  return { year, month, day: dayNum };
}

function isRealCalendarDay(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

function calendarDayDiff(fromDay: string, toDay: string, _timeZone?: string): number | null {
  const from = parseDayParts(fromDay);
  const to = parseDayParts(toDay);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / DAY_MS);
}

/** Pages for one entry, converting % through the total when one is known. */
export function resolveEntryPages(
  entry: Pick<ReadingProgressEntry, 'page' | 'percent'>,
  totalPages: number | null,
): number | null {
  if (entry.page !== null && entry.page !== undefined) return entry.page;
  if (entry.percent === null || entry.percent === undefined) return null;
  if (totalPages === null || totalPages === undefined || totalPages <= 0) return null;
  return Math.round((entry.percent * totalPages) / 100);
}

/** Latest entry wins; % entries convert to pages when a total exists. */
export function currentPosition(
  entries: readonly ReadingProgressEntry[],
  totalPages: number | null,
): ProgressPosition | null {
  if (entries.length === 0) return null;
  const sorted = sortedByRecordedAt(entries);
  const entry = sorted[sorted.length - 1];
  const total = totalPages ?? null;
  if (entry.page !== null && entry.page !== undefined) {
    return {
      entry,
      kind: 'page',
      pages: entry.page,
      percent: total && total > 0 ? Math.round((entry.page / total) * 100) : null,
      totalPages: total,
    };
  }
  if (entry.percent !== null && entry.percent !== undefined) {
    if (total && total > 0) {
      const pages = Math.round((entry.percent * total) / 100);
      return {
        entry,
        kind: 'page',
        pages,
        percent: Math.round((pages / total) * 100),
        totalPages: total,
      };
    }
    return { entry, kind: 'percent', pages: null, percent: entry.percent, totalPages: total };
  }
  return null;
}

/** Rounded percent, or null without pages and a known positive total. */
export function percentComplete(pages: number | null, totalPages: number | null): number | null {
  if (pages === null || pages === undefined) return null;
  if (totalPages === null || totalPages === undefined || totalPages <= 0) return null;
  return Math.round((pages / totalPages) * 100);
}

/**
 * Lead decision (Unit 3a fix): pace = net pages gained in the 14-day window
 * divided by calendar days from the first in-window entry's day to today
 * (minimum 1). A stalled reader therefore sees a slower, honest pace instead
 * of a pace that only spans active days.
 */

/** Visible PageEdgeBar line. Null when there is nothing to show. */
export function formatProgressText(position: ProgressPosition | null): string | null {
  if (!position) return null;
  if (position.pages !== null && position.totalPages !== null && position.totalPages > 0) {
    const percent = percentComplete(position.pages, position.totalPages) ?? 0;
    return `${position.pages} of ${position.totalPages} pages, ${percent}%`;
  }
  if (position.pages !== null) return `${position.pages} pages`;
  if (position.percent !== null) return `${position.percent}%`;
  return null;
}

function formatShortDay(day: string): string {
  const parsed = parseDayToLocalDate(day);
  if (!parsed) return day;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Text equivalent for the pace bars (screen-reader line). */
export function formatDailyPagesSummary(days: readonly DailyPagesDay[]): string {
  const active = days.filter((item) => item.pages > 0);
  if (active.length === 0) return 'No pages recorded in the last 14 days';
  const parts = active.map(
    (item) => `${item.pages} ${item.pages === 1 ? 'page' : 'pages'} on ${formatShortDay(item.day)}`,
  );
  return `Pages per day, last 14 days: ${parts.join(', ')}`;
}

/**
 * Pages gained per local day over the last 14 days ending today.
 * Gains are steps between consecutive resolved entries; the gain of a step is
 * attributed to the later entry's local day. Negative step gains draw as 0
 * and set `hasNegativeGain`. Unresolvable steps (% with no total, bad dates)
 * contribute 0 and are not flagged.
 */
export function dailyPages(
  entries: readonly ReadingProgressEntry[],
  totalPages: number | null,
  now: Date = new Date(),
  timeZone?: string,
): DailyPagesResult {
  const windowDays = windowDayStrings(now, timeZone);
  const daySet = new Set(windowDays);
  const totals = new Map<string, number>(windowDays.map((day) => [day, 0]));
  const sorted = sortedByRecordedAt(entries);
  let previous: number | null = null;
  let hasNegativeGain = false;
  for (const entry of sorted) {
    const pages = resolveEntryPages(entry, totalPages);
    const day = localDayOfTimestamp(entry.recorded_at, timeZone);
    if (pages === null || day === null) {
      if (pages !== null) previous = pages;
      continue;
    }
    if (previous !== null) {
      const gain = pages - previous;
      if (gain < 0) {
        hasNegativeGain = true;
      } else if (gain > 0 && daySet.has(day)) {
        totals.set(day, (totals.get(day) ?? 0) + gain);
      }
    }
    previous = pages;
  }
  return { days: windowDays.map((day) => ({ day, pages: totals.get(day) ?? 0 })), hasNegativeGain };
}

/**
 * Calm estimate (§4.5): only with >= 3 entries on >= 2 different local days in
 * the last 14 days and a known total. Pace is net pages gained in the window
 * divided by calendar days from the first in-window entry's day to today
 * (minimum 1); see lead-decision note above. Null when any in-window step
 * moves back (negative gain), when the net gain is <= 0, when already at/over
 * the total, or above 365 days.
 */
export function estimateRemaining(
  entries: readonly ReadingProgressEntry[],
  totalPages: number | null,
  now: Date = new Date(),
  timeZone?: string,
): ProgressEstimate | null {
  if (totalPages === null || totalPages === undefined || totalPages <= 0) return null;
  const windowDays = windowDayStrings(now, timeZone);
  const daySet = new Set(windowDays);
  const inWindow = sortedByRecordedAt(entries).filter((entry) => {
    const day = localDayOfTimestamp(entry.recorded_at, timeZone);
    return day !== null && daySet.has(day);
  });
  if (inWindow.length < 3) return null;
  const distinctDays = new Set<string>();
  const resolved: { day: string; pages: number }[] = [];
  for (const entry of inWindow) {
    const day = localDayOfTimestamp(entry.recorded_at, timeZone);
    const pages = resolveEntryPages(entry, totalPages);
    if (day === null || pages === null) return null;
    distinctDays.add(day);
    resolved.push({ day, pages });
  }
  if (distinctDays.size < 2) return null;
  for (let index = 1; index < resolved.length; index += 1) {
    if (resolved[index].pages - resolved[index - 1].pages < 0) return null;
  }
  const first = resolved[0];
  const last = resolved[resolved.length - 1];
  const todayDay = toLocalDayString(now, timeZone);
  const daysElapsedRaw = calendarDayDiff(first.day, todayDay, timeZone);
  if (daysElapsedRaw === null) return null;
  const daysElapsed = Math.max(1, daysElapsedRaw);
  const gain = last.pages - first.pages;
  if (gain <= 0) return null;
  const pacePagesPerDay = gain / daysElapsed;
  if (!(pacePagesPerDay > 0)) return null;
  const remaining = totalPages - last.pages;
  if (remaining <= 0) return null;
  const daysRemaining = Math.ceil(remaining / pacePagesPerDay);
  if (daysRemaining > ESTIMATE_MAX_DAYS) return null;
  return {
    pacePagesPerDay,
    daysRemaining,
    text:
      daysRemaining === 1
        ? 'About 1 day at your recent pace'
        : `About ${daysRemaining} days at your recent pace`,
  };
}
