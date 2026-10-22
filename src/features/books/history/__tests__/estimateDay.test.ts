import { estimateDay, roughEstimateLabel, todayDay } from '../estimateDay';

describe('estimateDay', () => {
  const today = '2026-10-22';

  it.each([
    [7, '2026-10-13'],
    [14, '2026-10-06'],
    [30, '2026-09-20'],
    [90, '2026-07-22'],
  ])('subtracts %i days from 2026-10-20 via Date.UTC (%s)', (days, expected) => {
    expect(estimateDay('2026-10-20', days, 'before', today)).toBe(expected);
  });

  it('adds days for an end after the start', () => {
    expect(estimateDay('2026-10-01', 7, 'after', today)).toBe('2026-10-08');
    expect(estimateDay('2026-10-01', 14, 'after', today)).toBe('2026-10-15');
    // 2026-10-01 + 30 would be 2026-10-31, clamped to today.
    expect(estimateDay('2026-10-01', 30, 'after', today)).toBe(today);
  });

  it('clamps an end after the start to today', () => {
    // 2026-10-20 + 7 would be 2026-10-27, beyond today.
    expect(estimateDay('2026-10-20', 7, 'after', today)).toBe(today);
    expect(estimateDay('2026-10-01', 90, 'after', today)).toBe(today);
  });

  it('computes today minus N for the otherwise case', () => {
    expect(estimateDay(today, 7, 'before', today)).toBe('2026-10-15');
    expect(estimateDay(today, 14, 'before', today)).toBe('2026-10-08');
    expect(estimateDay(today, 30, 'before', today)).toBe('2026-09-22');
    expect(estimateDay(today, 90, 'before', today)).toBe('2026-07-24');
  });

  it('uses Date.UTC across month and leap-year boundaries', () => {
    expect(estimateDay('2026-03-01', 1, 'before', today)).toBe('2026-02-28');
    expect(estimateDay('2024-03-01', 1, 'before', today)).toBe('2024-02-29');
    expect(estimateDay('2026-01-01', 1, 'before', today)).toBe('2025-12-31');
    expect(estimateDay('2025-12-31', 1, 'after', today)).toBe('2026-01-01');
  });

  it('preserves start <= end for start estimates', () => {
    const end = '2026-10-20';
    for (const days of [7, 14, 30, 90]) {
      const start = estimateDay(end, days, 'before', today);
      expect(start <= end).toBe(true);
    }
  });

  it('preserves start <= end and <= today for clamped end estimates', () => {
    const start = '2026-10-20';
    for (const days of [7, 14, 30, 90]) {
      const end = estimateDay(start, days, 'after', today);
      expect(end >= start).toBe(true);
      expect(end <= today).toBe(true);
    }
  });

  it('throws for non-day inputs', () => {
    expect(() => estimateDay('not-a-day', 7, 'before', today)).toThrow();
    expect(() => estimateDay('2026-10-20', 7, 'before', 'nope')).toThrow();
  });
});

describe('roughEstimateLabel', () => {
  it.each([
    [7, 'About a week'],
    [14, 'About 2 weeks'],
    [30, 'About a month'],
    [90, 'About 3 months'],
  ])('labels %i days as %s', (days, expected) => {
    expect(roughEstimateLabel(days)).toBe(expected);
  });
});

describe('todayDay', () => {
  it('returns an explicit time-zone day', () => {
    const noonUtc = new Date(Date.UTC(2026, 9, 22, 12, 0, 0));
    expect(todayDay('UTC', noonUtc)).toBe('2026-10-22');
  });

  it('shifts the day for a far time zone', () => {
    // 2026-10-22 01:00 UTC is still 2026-10-21 in New York.
    const early = new Date(Date.UTC(2026, 9, 22, 1, 0, 0));
    expect(todayDay('UTC', early)).toBe('2026-10-22');
    expect(todayDay('America/New_York', early)).toBe('2026-10-21');
  });
});
