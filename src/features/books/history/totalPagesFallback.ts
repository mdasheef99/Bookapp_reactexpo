import type { ReadingRead } from './readingHistoryContract';

/**
 * Total-pages fallback for a new read (SDD-09 D09-09 follow-up).
 * A new read starts with no total when the book has no page count; when an
 * earlier read of the same book has a total, the progress UI uses that total
 * as the default ("of 400") and persists it on the first progress save.
 */

function validTotal(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Latest earlier total for `openReadId` among reads of the same book.
 * Excludes the open read itself and picks the highest `read_number` with a
 * positive integer total. Null when the open read is missing, already has a
 * total, or no earlier read has one.
 */
export function fallbackTotalForRead(
  reads: readonly ReadingRead[],
  openReadId: string,
): number | null {
  const open = reads.find((read) => read.id === openReadId) ?? null;
  if (!open) return null;
  if (validTotal(open.total_pages)) return null;
  let best: ReadingRead | null = null;
  for (const read of reads) {
    if (read.id === openReadId) continue;
    if (read.user_book_id !== open.user_book_id) continue;
    if (!validTotal(read.total_pages)) continue;
    if (!best || read.read_number > best.read_number) best = read;
  }
  return best && validTotal(best.total_pages) ? (best.total_pages as number) : null;
}

/** Effective total shown in the progress UI: the real total, else the fallback. */
export function effectiveTotalPages(
  openTotal: number | null,
  fallbackTotal: number | null,
): number | null {
  if (validTotal(openTotal)) return openTotal as number;
  if (validTotal(fallbackTotal)) return fallbackTotal as number;
  return null;
}

/**
 * Whether the first progress save in the read should also persist the
 * fallback total with `setTotalPages` (one extra write, only then).
 */
export function shouldPersistFallbackTotal(
  openTotal: number | null,
  fallbackTotal: number | null,
  hasProgress: boolean,
): boolean {
  return openTotal === null && validTotal(fallbackTotal) && !hasProgress;
}
