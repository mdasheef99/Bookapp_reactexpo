import { formatExportDate, formatNoteDate } from '../dates';

describe('export dates', () => {
  it.each([
    ['UTC', '2026-10-03', '3 Oct 2026'],
    ['Asia/Kolkata', '2026-10-04', '4 Oct 2026'],
  ])('formats the calendar day in %s', (timeZone, iso, readable) => {
    const timestamp = '2026-10-03T20:00:00Z';
    expect(formatExportDate(timestamp, { timeZone })).toBe(iso);
    expect(formatNoteDate(timestamp, { timeZone })).toBe(readable);
  });

  it('defaults to the device time zone when timeZone is omitted', () => {
    const resolved = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' }).resolvedOptions();
    const resolvedOptions = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ ...resolved, timeZone: 'Asia/Kolkata' });
    try {
      const timestamp = '2026-10-03T20:00:00Z';
      expect(formatExportDate(timestamp)).toBe('2026-10-04');
      expect(formatNoteDate(timestamp)).toBe('4 Oct 2026');
      expect(resolvedOptions).toHaveBeenCalledTimes(2);
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it.each([
    ['2026-03-08T04:59:59Z', '2026-03-07', '7 Mar 2026'],
    ['2026-03-08T05:00:00Z', '2026-03-08', '8 Mar 2026'],
    ['2026-03-08T06:59:59Z', '2026-03-08', '8 Mar 2026'],
    ['2026-03-08T07:00:00Z', '2026-03-08', '8 Mar 2026'],
    ['2026-03-09T03:59:59Z', '2026-03-08', '8 Mar 2026'],
    ['2026-03-09T04:00:00Z', '2026-03-09', '9 Mar 2026'],
    ['2026-11-01T03:59:59Z', '2026-10-31', '31 Oct 2026'],
    ['2026-11-01T04:00:00Z', '2026-11-01', '1 Nov 2026'],
    ['2026-11-01T05:59:59Z', '2026-11-01', '1 Nov 2026'],
    ['2026-11-01T06:00:00Z', '2026-11-01', '1 Nov 2026'],
    ['2026-11-02T04:59:59Z', '2026-11-01', '1 Nov 2026'],
    ['2026-11-02T05:00:00Z', '2026-11-02', '2 Nov 2026'],
  ])('formats %s across New York DST transitions and local midnights', (timestamp, iso, readable) => {
    const options = { timeZone: 'America/New_York' };
    expect(formatExportDate(timestamp, options)).toBe(iso);
    expect(formatNoteDate(timestamp, options)).toBe(readable);
  });

  it.each([null, '', 'invalid', '2026-99-99T00:00:00Z'])('omits invalid or missing date %s', value => {
    expect(formatExportDate(value, { timeZone: 'UTC' })).toBe('');
    expect(formatNoteDate(value, { timeZone: 'UTC' })).toBe('');
  });

  it('pads single-digit months and days', () => {
    expect(formatExportDate('2026-01-02T00:00:00Z', { timeZone: 'UTC' })).toBe('2026-01-02');
    expect(formatNoteDate('2026-01-02T00:00:00Z', { timeZone: 'UTC' })).toBe('2 Jan 2026');
  });
});
