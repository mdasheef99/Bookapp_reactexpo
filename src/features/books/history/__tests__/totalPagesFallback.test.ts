import {
  effectiveTotalPages,
  fallbackTotalForRead,
  shouldPersistFallbackTotal,
} from '../totalPagesFallback';
import type { ReadingRead } from '../readingHistoryContract';

function read(overrides: Partial<ReadingRead> & { id: string }): ReadingRead {
  return {
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'reading',
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    started_on: null,
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  } as ReadingRead;
}

describe('totalPagesFallback', () => {
  it('uses the latest earlier read with a total', () => {
    const reads = [
      read({ id: 'read-1', read_number: 1, total_pages: 300 }),
      read({ id: 'read-2', read_number: 2, total_pages: 400 }),
      read({ id: 'read-3', read_number: 3, total_pages: null }),
    ];
    expect(fallbackTotalForRead(reads, 'read-3')).toBe(400);
  });

  it('returns null when the open read already has a total', () => {
    const reads = [
      read({ id: 'read-1', read_number: 1, total_pages: 300 }),
      read({ id: 'read-2', read_number: 2, total_pages: 320 }),
    ];
    expect(fallbackTotalForRead(reads, 'read-2')).toBeNull();
  });

  it('returns null when no earlier read has a total', () => {
    const reads = [
      read({ id: 'read-1', read_number: 1, total_pages: null }),
      read({ id: 'read-2', read_number: 2, total_pages: null }),
    ];
    expect(fallbackTotalForRead(reads, 'read-2')).toBeNull();
  });

  it('ignores other books and the open read itself', () => {
    const reads = [
      read({ id: 'read-1', read_number: 1, user_book_id: 'book-1', total_pages: 350 }),
      read({ id: 'read-other', read_number: 5, user_book_id: 'book-2', total_pages: 999 }),
      read({ id: 'read-2', read_number: 2, user_book_id: 'book-1', total_pages: null }),
    ];
    expect(fallbackTotalForRead(reads, 'read-2')).toBe(350);
  });

  it('effectiveTotalPages prefers the real total, then the fallback', () => {
    expect(effectiveTotalPages(320, 400)).toBe(320);
    expect(effectiveTotalPages(null, 400)).toBe(400);
    expect(effectiveTotalPages(null, null)).toBeNull();
  });

  it('shouldPersistFallbackTotal only on the first save with a fallback', () => {
    expect(shouldPersistFallbackTotal(null, 400, false)).toBe(true);
    expect(shouldPersistFallbackTotal(null, 400, true)).toBe(false);
    expect(shouldPersistFallbackTotal(320, 400, false)).toBe(false);
    expect(shouldPersistFallbackTotal(null, null, false)).toBe(false);
  });
});
