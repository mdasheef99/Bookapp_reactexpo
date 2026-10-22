import {
  allTimeStats,
  averageDaysPerBook,
  booksFinished,
  countingFinishedEndsInYear,
  finishRate,
  monthlyFinishedReads,
  pagesRead,
  quotesOfYear,
  yearBooksFinishedCount,
  yearCardTitle,
  yearStats,
} from '../readingStats';
import { nthBookCount } from '../readingTimeline';
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
    total_pages: 300,
    counts_in_stats: true,
    created_at: '2026-01-01T10:00:00.000Z',
    updated_at: '2026-01-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('yearBooksFinishedCount (distinct books, rereads once)', () => {
  it('counts distinct books, a same-year reread once', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: '2026-02-10' }),
      baseRead({ id: 'r3', user_book_id: 'book-a', read_number: 2, ended_on: '2026-03-10' }),
    ];
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(2);
  });

  it('counts a reread in a later year in that year', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2025-06-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-a', read_number: 2, ended_on: '2026-06-10' }),
    ];
    expect(yearBooksFinishedCount(reads, 2025, 'UTC')).toBe(1);
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(1);
  });

  it('ignores open and did-not-finish reads', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', outcome: 'reading', ended_on: null }),
      baseRead({ id: 'r2', user_book_id: 'book-b', outcome: 'did_not_finish', ended_on: '2026-04-10' }),
    ];
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(0);
  });

  it('leaves unknown ends out of the yearly count', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: null, ended_at: null, end_unknown: true }),
    ];
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(0);
  });

  it('excludes counts_in_stats = false', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10', counts_in_stats: false }),
    ];
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(0);
  });

  it('shares the counting rule with nthBookCount', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: '2026-02-10' }),
      baseRead({ id: 'r3', user_book_id: 'book-a', read_number: 2, ended_on: '2026-03-10' }),
    ];
    // nthBookCount is the distinct year count up to the target end.
    expect(nthBookCount(reads, 'r3', 'UTC')).toBe(yearBooksFinishedCount(reads, 2026, 'UTC'));
    expect(nthBookCount(reads, 'r2', 'UTC')).toBe(2);
    // Both draw on the same shared helper.
    expect(countingFinishedEndsInYear(reads, 2026, 'UTC')).toHaveLength(3);
  });
});

describe('booksFinished all-time', () => {
  it('counts distinct books ever, including unknown ends', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2025-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: null, ended_at: null, end_unknown: true }),
      baseRead({ id: 'r3', user_book_id: 'book-a', read_number: 2, ended_on: '2026-01-10' }),
    ];
    expect(booksFinished(reads, null, 'UTC')).toBe(2);
    expect(booksFinished(reads, 2026, 'UTC')).toBe(1);
  });
});

describe('pagesRead', () => {
  it('sums total_pages of counting finished reads with an unknown note', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10', total_pages: 300 }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: '2026-02-10', total_pages: null }),
      baseRead({ id: 'r3', user_book_id: 'book-c', ended_on: '2026-03-10', total_pages: 200 }),
    ];
    expect(pagesRead(reads, 2026, 'UTC')).toEqual({ pages: 500, unknownCount: 1 });
  });

  it('excludes did-not-finish, open and left-out reads from pages', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', outcome: 'did_not_finish', ended_on: '2026-01-10', total_pages: 300 }),
      baseRead({ id: 'r2', user_book_id: 'book-b', outcome: 'reading', total_pages: 300 }),
      baseRead({ id: 'r3', user_book_id: 'book-c', ended_on: '2026-01-10', total_pages: 300, counts_in_stats: false }),
    ];
    expect(pagesRead(reads, 2026, 'UTC')).toEqual({ pages: 0, unknownCount: 0 });
  });

  it('counts a same-year reread twice for pages (reads, not books)', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10', total_pages: 300 }),
      baseRead({ id: 'r2', user_book_id: 'book-a', read_number: 2, ended_on: '2026-06-10', total_pages: 300 }),
    ];
    expect(pagesRead(reads, 2026, 'UTC')).toEqual({ pages: 600, unknownCount: 0 });
  });

  it('includes unknown ends in all-time pages', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: null, ended_at: null, end_unknown: true, total_pages: 150 }),
    ];
    expect(pagesRead(reads, 2026, 'UTC')).toEqual({ pages: 0, unknownCount: 0 });
    expect(pagesRead(reads, null, 'UTC')).toEqual({ pages: 150, unknownCount: 0 });
  });
});

describe('finishRate', () => {
  it('counts finished ÷ (finished + did-not-finish), counting reads only', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: '2026-02-10' }),
      baseRead({ id: 'r3', user_book_id: 'book-c', outcome: 'did_not_finish', ended_on: '2026-03-10' }),
      baseRead({ id: 'r4', user_book_id: 'book-d', outcome: 'reading' }),
    ];
    expect(finishRate(reads, 2026, 'UTC')).toBeCloseTo(2 / 3);
  });

  it('counts did-not-finish only in the finish rate (not books/pages/bars)', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', outcome: 'did_not_finish', ended_on: '2026-01-10', total_pages: 400 }),
    ];
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(0);
    expect(pagesRead(reads, 2026, 'UTC')).toEqual({ pages: 0, unknownCount: 0 });
    expect(monthlyFinishedReads(reads, 2026, 'UTC')).toEqual(Array(12).fill(0));
    expect(finishRate(reads, 2026, 'UTC')).toBe(0);
  });

  it('returns null when there are no finished + did-not-finish reads', () => {
    expect(finishRate([], 2026, 'UTC')).toBeNull();
    expect(
      finishRate([baseRead({ id: 'r1', outcome: 'reading' })], 2026, 'UTC'),
    ).toBeNull();
  });

  it('excludes left-out reads from both sides of the rate', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', outcome: 'did_not_finish', ended_on: '2026-02-10', counts_in_stats: false }),
    ];
    expect(finishRate(reads, 2026, 'UTC')).toBe(1);
  });
});

describe('averageDaysPerBook', () => {
  it('averages end − start + 1 in calendar days via Date.UTC', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', started_on: '2026-01-01', ended_on: '2026-01-01' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', started_on: '2026-01-01', ended_on: '2026-01-10' }),
    ];
    expect(averageDaysPerBook(reads, 2026, 'UTC')).toBeCloseTo(5.5);
  });

  it('skips reads missing either effective day', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', started_on: null, started_at: null, start_unknown: true, ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', started_on: '2026-01-01', ended_on: '2026-01-05' }),
    ];
    expect(averageDaysPerBook(reads, 2026, 'UTC')).toBe(5);
  });

  it('returns null when nothing qualifies', () => {
    expect(averageDaysPerBook([], 2026, 'UTC')).toBeNull();
  });

  it('excludes left-out reads', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', started_on: '2026-01-01', ended_on: '2026-01-10', counts_in_stats: false }),
    ];
    expect(averageDaysPerBook(reads, 2026, 'UTC')).toBeNull();
  });
});

describe('monthlyFinishedReads', () => {
  it('counts finished reads per month (a reread appears twice)', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-05' }),
      baseRead({ id: 'r2', user_book_id: 'book-a', read_number: 2, ended_on: '2026-01-20' }),
      baseRead({ id: 'r3', user_book_id: 'book-b', ended_on: '2026-12-01' }),
    ];
    const bars = monthlyFinishedReads(reads, 2026, 'UTC');
    expect(bars[0]).toBe(2);
    expect(bars[11]).toBe(1);
    expect(bars.slice(1, 11).every((count) => count === 0)).toBe(true);
    // Bars (3) exceed the distinct book count (2).
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(2);
  });

  it('leaves unknown ends out of the bars', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: null, ended_at: null, end_unknown: true }),
    ];
    expect(monthlyFinishedReads(reads, 2026, 'UTC')).toEqual(Array(12).fill(0));
  });
});

describe('time zones', () => {
  it('places 31 Dec 23:30 local in the local year (non-UTC zone)', () => {
    // 31 Dec 23:30 in America/New_York is 1 Jan 04:30 UTC.
    const reads = [
      baseRead({
        id: 'r1',
        user_book_id: 'book-a',
        started_on: null,
        ended_on: null,
        ended_at: '2026-01-01T04:30:00.000Z',
      }),
    ];
    expect(yearBooksFinishedCount(reads, 2025, 'America/New_York')).toBe(1);
    expect(yearBooksFinishedCount(reads, 2026, 'America/New_York')).toBe(0);
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(1);
    expect(monthlyFinishedReads(reads, 2025, 'America/New_York')[11]).toBe(1);
  });

  it('lets a picked date win over the instant in every stat', () => {
    const reads = [
      baseRead({
        id: 'r1',
        user_book_id: 'book-a',
        ended_at: '2026-01-01T04:30:00.000Z',
        ended_on: '2026-06-15',
      }),
    ];
    expect(yearBooksFinishedCount(reads, 2026, 'UTC')).toBe(1);
    expect(monthlyFinishedReads(reads, 2026, 'UTC')[5]).toBe(1);
  });
});

describe('yearStats / allTimeStats', () => {
  it('summarises a year and all-time consistently', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', started_on: '2026-01-01', ended_on: '2026-01-10', total_pages: 300 }),
      baseRead({ id: 'r2', user_book_id: 'book-b', outcome: 'did_not_finish', ended_on: '2026-02-10' }),
      baseRead({ id: 'r3', user_book_id: 'book-c', ended_on: null, ended_at: null, end_unknown: true, total_pages: 100 }),
    ];
    const year = yearStats(reads, 2026, 'UTC');
    expect(year.books).toBe(1);
    expect(year.pages).toBe(300);
    expect(year.monthly[0]).toBe(1);
    expect(year.rate).toBeCloseTo(1 / 2);
    const all = allTimeStats(reads, 'UTC');
    expect(all.books).toBe(2);
    expect(all.pages).toBe(400);
  });

  it('leaves a counts_in_stats=false read out of every yearly number', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-03-10', total_pages: 250, counts_in_stats: false }),
    ];
    expect(monthlyFinishedReads(reads, 2026, 'UTC')).toEqual(Array(12).fill(0));
    const year = yearStats(reads, 2026, 'UTC');
    expect(year.books).toBe(0);
    expect(year.pages).toBe(0);
    expect(year.monthly).toEqual(Array(12).fill(0));
  });

  it('counts distinct books for the unknown page note (one book read twice)', () => {
    const reads = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10', total_pages: null }),
      baseRead({ id: 'r2', user_book_id: 'book-a', read_number: 2, ended_on: '2026-06-10', total_pages: null }),
    ];
    expect(pagesRead(reads, 2026, 'UTC')).toEqual({ pages: 0, unknownCount: 1 });
    const year = yearStats(reads, 2026, 'UTC');
    expect(year.unknownPages).toBe(1);
    const all = allTimeStats(reads, 'UTC');
    expect(all.unknownPages).toBe(1);
  });
});

describe('quotesOfYear / yearCardTitle', () => {
  const quotes = [
    { id: 'q1', content: 'Old', created_at: '2026-01-01T10:00:00.000Z', user_book_id: 'book-a' },
    { id: 'q2', content: 'New', created_at: '2026-06-01T10:00:00.000Z', user_book_id: 'book-b' },
    { id: 'q3', content: 'Last year', created_at: '2025-06-01T10:00:00.000Z', user_book_id: 'book-c' },
  ];

  it('keeps only this year, newest first (default = newest quote)', () => {
    const filtered = quotesOfYear(quotes, 2026, 'UTC');
    expect(filtered.map((quote) => quote.id)).toEqual(['q2', 'q1']);
  });

  it('titles the card "so far" until the year ends', () => {
    expect(yearCardTitle(2026, new Date('2026-06-01T00:00:00Z'))).toBe('Your 2026 so far');
    expect(yearCardTitle(2026, new Date('2027-01-01T00:00:00Z'))).toBe('Your 2026');
  });
});
