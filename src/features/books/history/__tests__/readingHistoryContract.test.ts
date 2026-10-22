import { effectiveReadDates, historyKeys, ReadingRead } from '../readingHistoryContract';

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
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  };
}

function withTokyoTz(run: () => void): void {
  const previous = process.env.TZ;
  process.env.TZ = 'Asia/Tokyo';
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

describe('effectiveReadDates', () => {
  it('lets a picked day win over the instant on both edges', () => {
    const read = baseRead({
      started_at: '2026-10-01T12:00:00.000Z',
      ended_at: '2026-10-20T12:00:00.000Z',
      started_on: '2026-10-05',
      ended_on: '2026-10-21',
    });
    expect(effectiveReadDates(read)).toEqual({ start: '2026-10-05', end: '2026-10-21' });
  });

  it('forces null when the unknown flag is set even if a date is stored', () => {
    const read = baseRead({
      started_at: '2026-10-01T12:00:00.000Z',
      ended_at: '2026-10-20T12:00:00.000Z',
      started_on: '2026-10-05',
      ended_on: '2026-10-21',
      start_unknown: true,
      end_unknown: true,
    });
    expect(effectiveReadDates(read)).toEqual({ start: null, end: null });
  });

  it('converts an instant to the device local day when no picked day exists (pinned Asia/Tokyo)', () => {
    withTokyoTz(() => {
      const read = baseRead({
        started_at: '2026-10-01T21:00:00.000Z',
        ended_at: '2026-10-01T21:00:00.000Z',
      });
      // 21:00 UTC on Oct 1 is 06:00 Oct 2 in UTC+9; a UTC-based toLocalDay would return Oct 1.
      expect(effectiveReadDates(read)).toEqual({ start: '2026-10-02', end: '2026-10-02' });
    });
  });

  it('returns null for edges with nothing recorded', () => {
    expect(effectiveReadDates(baseRead())).toEqual({ start: null, end: null });
  });

  it('leaves the end null for an open read while keeping its local start (pinned Asia/Tokyo)', () => {
    withTokyoTz(() => {
      const read = baseRead({
        outcome: 'reading',
        started_at: '2026-10-01T21:00:00.000Z',
        ended_at: null,
      });
      expect(effectiveReadDates(read)).toEqual({ start: '2026-10-02', end: null });
    });
  });
});

describe('historyKeys', () => {
  it('scopes every key by the actor', () => {
    expect(historyKeys.readsForBook('actor-a', 'book-1')).toEqual([
      'library-history-reads-book',
      'actor-a',
      'book-1',
    ]);
    expect(historyKeys.readsForUser('actor-a')).toEqual(['library-history-reads-user', 'actor-a']);
    expect(historyKeys.progressForRead('actor-a', 'read-1')).toEqual([
      'library-history-progress',
      'actor-a',
      'read-1',
    ]);
    expect(historyKeys.goal('actor-a', 2026)).toEqual(['library-history-goal', 'actor-a', 2026]);
    expect(historyKeys.settings('actor-a')).toEqual(['library-history-settings', 'actor-a']);
  });
});
