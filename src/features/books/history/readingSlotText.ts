import { effectiveReadDates, ReadingRead } from './readingHistoryContract';

function formatShortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * One-line Book Details slot text (SDD-09 §4.3, Unit 2a: dates and reread count only).
 * Returns null when there is nothing dated to show (no reads, or the latest read's
 * relevant edge is unknown); the caller decides what (if anything) replaces it.
 */
export function readingSlotText(reads: readonly ReadingRead[]): string | null {
  if (reads.length === 0) return null;
  const sorted = [...reads].sort((a, b) => a.read_number - b.read_number);
  const latest = sorted[sorted.length - 1];
  const finishedCount = sorted.filter((read) => read.outcome === 'finished').length;
  const { start, end } = effectiveReadDates(latest);
  if (latest.outcome === 'reading') {
    if (!start) return null;
    return `Started ${formatShortDay(start)}`;
  }
  if (latest.outcome === 'finished') {
    if (!end) return null;
    const base = `Finished ${formatShortDay(end)}`;
    return finishedCount >= 2 ? `${base} · read ${finishedCount} times` : base;
  }
  if (!end) return null;
  return `Stopped ${formatShortDay(end)}`;
}
