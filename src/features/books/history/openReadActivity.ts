import type { ReadingProgressEntry, ReadingRead } from './readingHistoryContract';

/** Minimal shape for ranking; avoids importing the gateway type. */
export interface RankableOpenRead {
  read: ReadingRead;
  latestProgress: ReadingProgressEntry | null;
  lastActivityAt: string;
}

/**
 * Latest activity for an open read (SDD-09 follow-up).
 * Max of `read.updated_at`, the latest progress `recorded_at` (when present)
 * and `read.started_at` (when present). No extra queries: callers reuse the
 * already-batched progress row.
 */
export function openReadActivityAt(
  read: ReadingRead,
  latestProgress: ReadingProgressEntry | null,
): string {
  let best = read.updated_at;
  let bestTime = Date.parse(best);
  const consider = (candidate: string | null | undefined) => {
    if (typeof candidate !== 'string' || candidate.length === 0) return;
    const time = Date.parse(candidate);
    if (Number.isNaN(time) || Number.isNaN(bestTime)) return;
    if (time > bestTime) {
      best = candidate;
      bestTime = time;
    }
  };
  consider(latestProgress?.recorded_at);
  consider(read.started_at);
  return best;
}

/** Deterministic rank: newest activity first, then smallest read id. */
export function compareOpenReads(a: RankableOpenRead, b: RankableOpenRead): number {
  const time = Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt);
  if (time !== 0) return time;
  if (a.read.id === b.read.id) return 0;
  return a.read.id < b.read.id ? -1 : 1;
}
