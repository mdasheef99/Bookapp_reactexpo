/**
 * Approximate-date arithmetic (SDD-09 follow-up).
 * Pure calendar math on YYYY-MM-DD via `Date.UTC`.
 */

export type EstimateDirection = 'before' | 'after';

export const ROUGH_ESTIMATE_DAYS = [7, 14, 30, 90] as const;
export type RoughEstimateDays = (typeof ROUGH_ESTIMATE_DAYS)[number];

export function roughEstimateLabel(days: number): string {
  if (days === 7) return 'About a week';
  if (days === 14) return 'About 2 weeks';
  if (days === 30) return 'About a month';
  if (days === 90) return 'About 3 months';
  return `About ${days} days`;
}

function parseDay(day: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, date));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== date
  ) {
    return null;
  }
  return [year, month, date];
}

function toDayStringFromUtc(millis: number): string {
  const date = new Date(millis);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compute an estimated day from a reference day.
 * - `before`: reference − days.
 * - `after`: reference + days, clamped to `today` (never in the future).
 * All inputs and outputs are YYYY-MM-DD. Arithmetic uses `Date.UTC` so the
 * result is stable across time zones; `today` must already be the
 * time-zone-aware today (see `todayDay`).
 */
export function estimateDay(
  reference: string,
  days: number,
  direction: EstimateDirection,
  today: string,
): string {
  const parsedRef = parseDay(reference);
  const parsedToday = parseDay(today);
  if (!parsedRef) throw new Error('estimateDay needs a real YYYY-MM-DD reference.');
  if (!parsedToday) throw new Error('estimateDay needs a real YYYY-MM-DD today.');
  const [ry, rm, rd] = parsedRef;
  const refMillis = Date.UTC(ry, rm - 1, rd);
  const delta = Math.trunc(days) * 24 * 60 * 60 * 1000;
  const computed = direction === 'before' ? refMillis - delta : refMillis + delta;
  const result = toDayStringFromUtc(computed);
  if (direction === 'after' && result > today) return today;
  return result;
}

/**
 * Time-zone-aware today as YYYY-MM-DD.
 * When `timeZone` is provided it is explicit (e.g. "UTC"); otherwise the
 * device local zone is used. `now` exists for deterministic tests.
 */
export function todayDay(timeZone?: string, now: Date = new Date()): string {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
