import {
  currentPosition,
  dailyPages,
  estimateRemaining,
  formatDailyPagesSummary,
  formatProgressText,
  percentComplete,
  resolveEntryPages,
  type DailyPagesDay,
} from '../progressMath';
import type { ReadingProgressEntry } from '../readingHistoryContract';

function entry(overrides: Partial<ReadingProgressEntry> = {}): ReadingProgressEntry {
  return {
    id: 'progress-1',
    read_id: 'read-1',
    user_id: 'actor',
    page: 142,
    percent: null,
    recorded_at: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

function toUtcMs(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`bad day: ${day}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function expectConsecutiveDays(dayStrings: string[]): void {
  expect(dayStrings.length).toBeGreaterThan(1);
  for (let index = 1; index < dayStrings.length; index += 1) {
    // Each calendar day is exactly one UTC-midnight step after the previous.
    expect(toUtcMs(dayStrings[index]) - toUtcMs(dayStrings[index - 1])).toBe(24 * 60 * 60 * 1000);
  }
}

describe('resolveEntryPages', () => {
  it('returns page entries directly', () => {
    expect(resolveEntryPages(entry({ page: 42, percent: null }), 320)).toBe(42);
    expect(resolveEntryPages(entry({ page: 0, percent: null }), 320)).toBe(0);
  });

  it('converts % through the total with round', () => {
    // 44% of 320 = 140.8 -> 141
    expect(resolveEntryPages(entry({ page: null, percent: 44 }), 320)).toBe(141);
    expect(resolveEntryPages(entry({ page: null, percent: 50 }), 320)).toBe(160);
  });

  it('returns null for % without a total', () => {
    expect(resolveEntryPages(entry({ page: null, percent: 44 }), null)).toBeNull();
  });
});

describe('currentPosition', () => {
  it('returns null with no entries', () => {
    expect(currentPosition([], 320)).toBeNull();
  });

  it('picks the latest entry by recorded_at', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-01T12:00:00.000Z' }),
      entry({ id: 'b', page: 142, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    expect(currentPosition(rows, 320)?.pages).toBe(142);
  });

  it('converts a % latest entry when the total exists', () => {
    const rows = [entry({ page: null, percent: 44, recorded_at: '2026-10-10T12:00:00.000Z' })];
    const position = currentPosition(rows, 320);
    expect(position?.kind).toBe('page');
    expect(position?.pages).toBe(141);
    expect(position?.percent).toBe(Math.round((141 / 320) * 100));
  });

  it('keeps a % latest entry unconverted when the total is removed', () => {
    const rows = [entry({ page: null, percent: 44, recorded_at: '2026-10-10T12:00:00.000Z' })];
    const position = currentPosition(rows, null);
    expect(position?.kind).toBe('percent');
    expect(position?.pages).toBeNull();
    expect(position?.percent).toBe(44);
  });

  it('shows page entries as pages when the total is removed', () => {
    const rows = [entry({ page: 142, percent: null })];
    const position = currentPosition(rows, null);
    expect(position?.kind).toBe('page');
    expect(position?.pages).toBe(142);
    expect(position?.percent).toBeNull();
  });

  it('% then page switch: a later page entry wins after the total is removed', () => {
    const rows = [
      entry({ id: 'a', page: null, percent: 50, recorded_at: '2026-10-01T12:00:00.000Z' }),
      entry({ id: 'b', page: 100, percent: null, recorded_at: '2026-10-02T12:00:00.000Z' }),
    ];
    expect(currentPosition(rows, null)?.pages).toBe(100);
    expect(currentPosition(rows, 320)?.pages).toBe(100);
  });
});

describe('percentComplete', () => {
  it('rounds pages over total', () => {
    expect(percentComplete(142, 320)).toBe(44);
    expect(percentComplete(160, 320)).toBe(50);
  });

  it('returns null without pages or total', () => {
    expect(percentComplete(null, 320)).toBeNull();
    expect(percentComplete(10, null)).toBeNull();
  });

  it('allows above-total pages', () => {
    expect(percentComplete(400, 320)).toBe(125);
  });
});

describe('formatProgressText', () => {
  it('formats the page-edge line with total', () => {
    const position = currentPosition([entry({ page: 142 })], 320);
    expect(formatProgressText(position)).toBe('142 of 320 pages, 44%');
  });

  it('formats pages-only and percent-only without a total', () => {
    expect(formatProgressText(currentPosition([entry({ page: 142 })], null))).toBe('142 pages');
    expect(
      formatProgressText(currentPosition([entry({ page: null, percent: 44 })], null)),
    ).toBe('44%');
  });

  it('returns null with no position', () => {
    expect(formatProgressText(null)).toBeNull();
  });
});

describe('dailyPages', () => {
  it('attributes gains to the later entry local day and clamps negatives to 0', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 20, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    const result = dailyPages(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    const byDay = new Map(result.days.map((item) => [item.day, item.pages]));
    expect(byDay.get('2026-10-09')).toBe(20);
    expect(byDay.get('2026-10-10')).toBe(0);
    expect(result.hasNegativeGain).toBe(true);
  });

  it('returns 14 days ending today with zeros for quiet days', () => {
    const rows = [entry({ page: 50, recorded_at: '2026-10-10T12:00:00.000Z' })];
    const result = dailyPages(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    expect(result.days).toHaveLength(14);
    expect(result.days[13].day).toBe('2026-10-10');
    expect(result.days[0].day).toBe('2026-09-27');
    expectConsecutiveDays(result.days.map((item) => item.day));
  });

  it('converts % entries through the total for gains', () => {
    const rows = [
      entry({ id: 'a', page: null, percent: 10, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'b', page: null, percent: 20, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    const result = dailyPages(rows, 200, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    const byDay = new Map(result.days.map((item) => [item.day, item.pages]));
    // 10% of 200 = 20, 20% of 200 = 40, gain 20 on Oct 10.
    expect(byDay.get('2026-10-10')).toBe(20);
    expect(result.hasNegativeGain).toBe(false);
  });

  it('ignores unresolvable % steps without a total and does not flag', () => {
    const rows = [
      entry({ id: 'a', page: null, percent: 10, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'b', page: null, percent: 20, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    const result = dailyPages(rows, null, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    expect(result.hasNegativeGain).toBe(false);
    expect(result.days.every((item) => item.pages === 0)).toBe(true);
  });

  it('respects explicit time-zone day boundaries (Asia/Tokyo)', () => {
    // 19:00 UTC Oct 9 is Oct 10 in Tokyo (+9:00) but still Oct 9 in UTC,
    // so a UTC-based grouping would put the gain on Oct 9.
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-09T18:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-10-09T19:00:00.000Z' }),
    ];
    const result = dailyPages(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'Asia/Tokyo');
    const byDay = new Map(result.days.map((item) => [item.day, item.pages]));
    expect(byDay.get('2026-10-10')).toBe(20);
  });

  it('lands 2026-03-08T04:30:00Z on 2026-03-07 in New York and 2026-03-08 in UTC', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-03-07T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-03-08T04:30:00.000Z' }),
    ];
    const now = new Date('2026-03-10T16:00:00.000Z');
    const inNewYork = dailyPages(rows, 320, now, 'America/New_York');
    const inUtc = dailyPages(rows, 320, now, 'UTC');
    const nyByDay = new Map(inNewYork.days.map((item) => [item.day, item.pages]));
    const utcByDay = new Map(inUtc.days.map((item) => [item.day, item.pages]));
    // 04:30Z Mar 8 is 23:30 EST Mar 7 in New York (before the spring-forward).
    expect(nyByDay.get('2026-03-07')).toBe(20);
    expect(nyByDay.get('2026-03-08')).toBe(0);
    expect(utcByDay.get('2026-03-08')).toBe(20);
    expect(utcByDay.get('2026-03-07')).toBe(0);
  });

  it('zero gains draw empty without flagging', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'b', page: 10, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    const result = dailyPages(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    expect(result.hasNegativeGain).toBe(false);
    expect(result.days.every((item) => item.pages === 0)).toBe(true);
  });
});

describe('estimateRemaining', () => {
  function threeEntries(): ReadingProgressEntry[] {
    return [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 50, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
  }

  it('shows the estimate with >= 3 entries on >= 2 days and a known total', () => {
    const estimate = estimateRemaining(
      threeEntries(),
      320,
      new Date('2026-10-10T12:00:00.000Z'),
      'UTC',
    );
    // Gain 40 over 2 calendar days = 20/day; remaining 270 -> ceil 13.5 = 14.
    expect(estimate?.daysRemaining).toBe(14);
    expect(estimate?.text).toBe('About 14 days at your recent pace');
  });

  it('uses the singular day wording', () => {
    const rows = [
      entry({ id: 'a', page: 318, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'b', page: 319, recorded_at: '2026-10-09T18:00:00.000Z' }),
      entry({ id: 'c', page: 319, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    // Gain 1 over 1 day, remaining 1 -> 1 day. Needs 3 entries on 2 days: yes.
    const estimate = estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    expect(estimate?.daysRemaining).toBe(1);
    expect(estimate?.text).toBe('About 1 day at your recent pace');
  });

  it('requires 3 entries', () => {
    const rows = threeEntries().slice(0, 2);
    expect(estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
  });

  it('requires 2 different days', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-10T08:00:00.000Z' }),
      entry({ id: 'b', page: 20, recorded_at: '2026-10-10T12:00:00.000Z' }),
      entry({ id: 'c', page: 30, recorded_at: '2026-10-10T18:00:00.000Z' }),
    ];
    expect(estimateRemaining(rows, 320, new Date('2026-10-10T19:00:00.000Z'), 'UTC')).toBeNull();
  });

  it('requires entries in the last 14 days', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-09-01T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-09-02T12:00:00.000Z' }),
      entry({ id: 'c', page: 50, recorded_at: '2026-09-03T12:00:00.000Z' }),
    ];
    expect(estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
  });

  it('requires a known total', () => {
    expect(
      estimateRemaining(threeEntries(), null, new Date('2026-10-10T12:00:00.000Z'), 'UTC'),
    ).toBeNull();
  });

  it('hides on zero or negative gain', () => {
    const flat = [
      entry({ id: 'a', page: 30, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 30, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    expect(estimateRemaining(flat, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
    const backward = [
      entry({ id: 'a', page: 50, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 20, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    expect(estimateRemaining(backward, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
  });

  it('hides above 365 days', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 11, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 12, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    // Gain 2 over 2 days = 1/day; remaining large -> > 365.
    expect(estimateRemaining(rows, 5000, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
  });

  it('hides when already at or over the total', () => {
    const rows = [
      entry({ id: 'a', page: 300, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 320, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 320, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    expect(estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
  });

  it('converts % entries through the total for the estimate', () => {
    const rows = [
      entry({ id: 'a', page: null, percent: 10, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: null, percent: 20, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: null, percent: 30, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    const estimate = estimateRemaining(rows, 200, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    // 20 -> 40 -> 60: gain 40 over 2 days = 20/day; remaining 140 -> 7 days.
    expect(estimate?.daysRemaining).toBe(7);
  });
});

describe('formatDailyPagesSummary', () => {
  it('summarises the 14-day window for screen readers', () => {
    const days: DailyPagesDay[] = [
      { day: '2026-10-09', pages: 20 },
      { day: '2026-10-10', pages: 0 },
    ];
    const summary = formatDailyPagesSummary(days);
    expect(summary.startsWith('Pages per day, last 14 days:')).toBe(true);
    expect(summary).toContain('20');
  });

  it('lists only days with pages', () => {
    const days: DailyPagesDay[] = [
      { day: '2026-10-09', pages: 20 },
      { day: '2026-10-10', pages: 35 },
      { day: '2026-10-08', pages: 0 },
    ];
    const summary = formatDailyPagesSummary(days);
    expect(summary).toContain('20');
    expect(summary).toContain('35');
    expect(summary).not.toContain('8 Oct');
    expect(summary).not.toContain('2026-10-08');
  });

  it('reports no pages when every day is empty', () => {
    const days: DailyPagesDay[] = [
      { day: '2026-10-09', pages: 0 },
      { day: '2026-10-10', pages: 0 },
    ];
    expect(formatDailyPagesSummary(days)).toBe('No pages recorded in the last 14 days');
  });
});

describe('DST calendar window (America/New_York)', () => {
  it('keeps 14 distinct consecutive calendar days across the spring-forward 2026-03-08', () => {
    const now = new Date('2026-03-10T16:00:00.000Z');
    const result = dailyPages([], 320, now, 'America/New_York');
    const dayStrings = result.days.map((item) => item.day);
    expect(result.days).toHaveLength(14);
    expect(new Set(dayStrings).size).toBe(14);
    expect(dayStrings[13]).toBe('2026-03-10');
    expect(dayStrings[0]).toBe('2026-02-25');
    expect(dayStrings).toContain('2026-03-08');
    expectConsecutiveDays(dayStrings);
  });

  it('keeps 14 distinct consecutive calendar days across the fall-back 2026-11-01', () => {
    const now = new Date('2026-11-03T17:00:00.000Z');
    const result = dailyPages([], 320, now, 'America/New_York');
    const dayStrings = result.days.map((item) => item.day);
    expect(result.days).toHaveLength(14);
    expect(new Set(dayStrings).size).toBe(14);
    expect(dayStrings[13]).toBe('2026-11-03');
    expect(dayStrings[0]).toBe('2026-10-21');
    expect(dayStrings).toContain('2026-11-01');
    expectConsecutiveDays(dayStrings);
  });

  it('measures pace from calendar days across DST', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-03-07T17:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-03-09T16:00:00.000Z' }),
      entry({ id: 'c', page: 50, recorded_at: '2026-03-10T16:00:00.000Z' }),
    ];
    // Gain 40 from Mar 7 to today Mar 10 = 3 calendar days, not 71h / 24h.
    const estimate = estimateRemaining(
      rows,
      320,
      new Date('2026-03-10T16:00:00.000Z'),
      'America/New_York',
    );
    expect(estimate?.pacePagesPerDay).toBeCloseTo(40 / 3, 5);
  });
});

describe('pace guards and definition', () => {
  it('returns null when any in-window step moves back (10 -> 30 -> 20 -> 40)', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-08T12:00:00.000Z' }),
      entry({ id: 'b', page: 30, recorded_at: '2026-10-09T12:00:00.000Z' }),
      entry({ id: 'c', page: 20, recorded_at: '2026-10-10T08:00:00.000Z' }),
      entry({ id: 'd', page: 40, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    expect(estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
    const result = dailyPages(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    expect(result.hasNegativeGain).toBe(true);
    const byDay = new Map(result.days.map((item) => [item.day, item.pages]));
    // Negative step draws empty; the recovery gain lands on the later day.
    expect(byDay.get('2026-10-10')).toBe(20);
  });

  it('paces from the first in-window day to today (Oct 1/2/3, today Oct 10)', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-01T12:00:00.000Z' }),
      entry({ id: 'b', page: 20, recorded_at: '2026-10-02T12:00:00.000Z' }),
      entry({ id: 'c', page: 30, recorded_at: '2026-10-03T12:00:00.000Z' }),
    ];
    const estimate = estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC');
    // Gain 20 over Oct 1 -> Oct 10 = 9 calendar days (minimum 1); slower honest pace.
    expect(estimate?.pacePagesPerDay).toBeCloseTo(20 / 9, 5);
    expect(estimate?.daysRemaining).toBe(Math.ceil(290 / (20 / 9)));
  });

  it('uses a minimum of 1 day when the first entry is today', () => {
    const rows = [
      entry({ id: 'a', page: 10, recorded_at: '2026-10-10T08:00:00.000Z' }),
      entry({ id: 'b', page: 20, recorded_at: '2026-10-10T10:00:00.000Z' }),
      entry({ id: 'c', page: 30, recorded_at: '2026-10-10T12:00:00.000Z' }),
    ];
    // Same-day only is rejected by the distinct-days guard.
    expect(estimateRemaining(rows, 320, new Date('2026-10-10T12:00:00.000Z'), 'UTC')).toBeNull();
  });
});
