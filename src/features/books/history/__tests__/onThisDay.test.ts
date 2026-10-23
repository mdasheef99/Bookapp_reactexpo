import { findOnThisDay } from '../onThisDay';
import { ReadingRead } from '../readingHistoryContract';

function baseRead(overrides: Partial<ReadingRead> = {}): ReadingRead {
  return {
    id: 'read-1',
    user_book_id: 'book-1',
    user_id: 'actor',
    read_number: 1,
    outcome: 'finished',
    started_at: null,
    ended_at: null,
    started_on: null,
    ended_on: null,
    start_unknown: false,
    end_unknown: false,
    total_pages: null,
    counts_in_stats: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

const titles = (entries: Record<string, string> = { 'book-1': 'Hooked' }) => new Map(Object.entries(entries));

describe('findOnThisDay (SDD-10 Unit D)', () => {
  it('matches a picked finish day with the same month and day in an earlier year', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23' })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([
      { readId: 'r1', userBookId: 'book-1', title: 'Hooked', year: 2025, endedDay: '2025-10-23' },
    ]);
  });

  it('uses explicit zones: the same instant lands on different calendar days', () => {
    // 2025-10-23T10:00Z is Oct 23 in UTC, Oct 24 in Kiritimati (+14), Oct 22 in Pago Pago (-11).
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_at: '2025-10-23T10:00:00.000Z' })];
    const lookup = titles();
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', lookup)).toHaveLength(1);
    expect(findOnThisDay(reads, '2026-10-24', 'Pacific/Kiritimati', lookup)).toHaveLength(1);
    expect(findOnThisDay(reads, '2026-10-22', 'Pacific/Pago_Pago', lookup)).toHaveLength(1);
    expect(findOnThisDay(reads, '2026-10-23', 'Pacific/Kiritimati', lookup)).toHaveLength(0);
    expect(findOnThisDay(reads, '2026-10-23', 'Pacific/Pago_Pago', lookup)).toHaveLength(0);
  });

  it('lets a picked ended_on win over the instant', () => {
    const reads = [
      baseRead({
        id: 'r1',
        user_book_id: 'book-1',
        ended_at: '2025-01-05T12:00:00.000Z',
        ended_on: '2025-10-23',
      }),
    ];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toHaveLength(1);
    expect(findOnThisDay(reads, '2026-01-05', 'UTC', titles())).toHaveLength(0);
  });

  it('handles the year boundary: Jan 1 matches Jan 1, Dec 31 does not', () => {
    const reads = [
      baseRead({ id: 'jan', user_book_id: 'book-1', ended_on: '2025-01-01' }),
      baseRead({ id: 'dec', user_book_id: 'book-1', ended_on: '2025-12-31' }),
    ];
    const matched = findOnThisDay(reads, '2026-01-01', 'UTC', titles());
    expect(matched.map((m) => m.readId)).toEqual(['jan']);
  });

  it('excludes a finish in the same year', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2026-10-23' })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('excludes a finish in a later year even when month and day match', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2027-10-23' })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('matches 29 Feb finishes on 28 Feb in a non-leap current year', () => {
    const reads = [baseRead({ id: 'leap', user_book_id: 'book-1', ended_on: '2024-02-29' })];
    const matched = findOnThisDay(reads, '2026-02-28', 'UTC', titles());
    expect(matched).toHaveLength(1);
    expect(matched[0]).toMatchObject({ year: 2024, endedDay: '2024-02-29' });
  });

  it('still matches a 28 Feb finish on 28 Feb in a non-leap current year', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-02-28' })];
    expect(findOnThisDay(reads, '2026-02-28', 'UTC', titles())).toHaveLength(1);
  });

  it('in a leap current year, 29 Feb matches only 29 Feb', () => {
    const reads = [baseRead({ id: 'leap', user_book_id: 'book-1', ended_on: '2020-02-29' })];
    expect(findOnThisDay(reads, '2024-02-29', 'UTC', titles())).toHaveLength(1);
    expect(findOnThisDay(reads, '2024-02-28', 'UTC', titles())).toHaveLength(0);
  });

  it('in a leap current year, 28 Feb matches only 28 Feb', () => {
    const feb28 = [baseRead({ id: 'a', user_book_id: 'book-1', ended_on: '2023-02-28' })];
    const feb29 = [baseRead({ id: 'b', user_book_id: 'book-1', ended_on: '2020-02-29' })];
    expect(findOnThisDay(feb28, '2024-02-28', 'UTC', titles())).toHaveLength(1);
    expect(findOnThisDay(feb29, '2024-02-28', 'UTC', titles())).toHaveLength(0);
    expect(findOnThisDay(feb28, '2024-02-29', 'UTC', titles())).toHaveLength(0);
  });

  it('a 28 Feb finish in a leap end year still matches 28 Feb', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2024-02-28' })];
    expect(findOnThisDay(reads, '2025-02-28', 'UTC', titles())).toHaveLength(1);
  });

  it('never matches an unknown end date (flag or null end)', () => {
    const flagged = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23', end_unknown: true })];
    expect(findOnThisDay(flagged, '2026-10-23', 'UTC', titles())).toEqual([]);
    const empty: ReadingRead[] = [baseRead({ id: 'r2', user_book_id: 'book-1' })];
    expect(findOnThisDay(empty, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('never matches reads left out of stats', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23', counts_in_stats: false })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it.each([['reading'], ['did_not_finish']] as const)('never matches outcome %s', (outcome) => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23', outcome })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('skips reads whose book is not in the entries lookup', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'ghost', ended_on: '2025-10-23' })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('dedupes by book and year, keeping the first in sort order', () => {
    const reads = [
      baseRead({ id: 'b-id', user_book_id: 'book-1', ended_on: '2025-10-23', ended_at: '2025-10-23T08:00:00.000Z' }),
      baseRead({ id: 'a-id', user_book_id: 'book-1', ended_on: '2025-10-23', ended_at: '2025-10-23T20:00:00.000Z' }),
    ];
    const matched = findOnThisDay(reads, '2026-10-23', 'UTC', titles());
    expect(matched).toHaveLength(1);
    expect(matched[0].readId).toBe('a-id');
  });

  it('orders by year desc, ended_at desc with null last, then id asc', () => {
    const reads = [
      baseRead({ id: 'old', user_book_id: 'book-a', ended_on: '2020-10-23', ended_at: '2020-10-23T10:00:00.000Z' }),
      baseRead({ id: 'new-null', user_book_id: 'book-b', ended_on: '2025-10-23', ended_at: null }),
      baseRead({ id: 'new-early', user_book_id: 'book-c', ended_on: '2025-10-23', ended_at: '2025-10-23T08:00:00.000Z' }),
      baseRead({ id: 'new-late', user_book_id: 'book-d', ended_on: '2025-10-23', ended_at: '2025-10-23T20:00:00.000Z' }),
      baseRead({ id: 'b-id', user_book_id: 'book-e', ended_on: '2023-10-23', ended_at: null }),
      baseRead({ id: 'a-id', user_book_id: 'book-f', ended_on: '2023-10-23', ended_at: null }),
    ];
    const lookup = titles({
      'book-a': 'A',
      'book-b': 'B',
      'book-c': 'C',
      'book-d': 'D',
      'book-e': 'E',
      'book-f': 'F',
    });
    const matched = findOnThisDay(reads, '2026-10-23', 'UTC', lookup);
    expect(matched.map((m) => m.readId)).toEqual(['new-late', 'new-early', 'new-null', 'a-id', 'b-id', 'old']);
  });

  it('does not throw on malformed read dates', () => {
    const reads = [
      baseRead({ id: 'bad-on', user_book_id: 'book-1', ended_on: 'not-a-day' }),
      baseRead({ id: 'bad-at', user_book_id: 'book-1', ended_at: 'also-bad' }),
    ];
    expect(() => findOnThisDay(reads, '2026-10-23', 'UTC', titles())).not.toThrow();
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('rejects malformed today with an otherwise valid matching read', () => {
    const reads = [baseRead({ ended_at: '2025-03-02T10:00:00.000Z' })];
    expect(findOnThisDay(reads, '2026-03-02', 'UTC', titles())).toHaveLength(1);
    expect(findOnThisDay(reads, '2026-02-30', 'UTC', titles())).toEqual([]);
    expect(findOnThisDay(reads, 'garbage', 'UTC', titles())).toEqual([]);
  });

  it('skips an invalid zone without throwing for a valid matching instant', () => {
    const reads = [baseRead({ ended_at: '2025-03-02T10:00:00.000Z' })];
    expect(findOnThisDay(reads, '2026-03-02', 'UTC', titles())).toHaveLength(1);
    expect(() => findOnThisDay(reads, '2026-03-02', 'Not/AZone', titles())).not.toThrow();
    expect(findOnThisDay(reads, '2026-03-02', 'Not/AZone', titles())).toEqual([]);
  });

  it('returns empty input as empty', () => {
    expect(findOnThisDay([], '2026-10-23', 'UTC', titles())).toEqual([]);
  });

  it('accepts a plain record lookup as well as a Map', () => {
    const reads = [baseRead({ id: 'r1', user_book_id: 'book-1', ended_on: '2025-10-23' })];
    expect(findOnThisDay(reads, '2026-10-23', 'UTC', { 'book-1': 'Hooked' })).toHaveLength(1);
  });
});
