import { readingSlotText } from '../readingSlotText';
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
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
    ...overrides,
  };
}

function shortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

describe('readingSlotText', () => {
  it('returns null when there are no reads', () => {
    expect(readingSlotText([])).toBeNull();
  });

  it('shows the start for an open read', () => {
    const reads = [baseRead({ id: 'r1', outcome: 'reading', started_on: '2026-10-02' })];
    expect(readingSlotText(reads)).toBe(`Started ${shortDay('2026-10-02')}`);
  });

  it('prefers the picked day over the instant in the device locale', () => {
    const reads = [
      baseRead({
        id: 'r1',
        outcome: 'reading',
        started_at: '2026-10-01T12:00:00.000Z',
        started_on: '2026-10-05',
      }),
    ];
    expect(readingSlotText(reads)).toBe(`Started ${shortDay('2026-10-05')}`);
  });

  it('shows the finish without a count when finished once', () => {
    const reads = [baseRead({ id: 'r1', outcome: 'finished', ended_on: '2026-10-20' })];
    expect(readingSlotText(reads)).toBe(`Finished ${shortDay('2026-10-20')}`);
  });

  it('appends the finished count only when two or more reads are finished', () => {
    const twice = [
      baseRead({ id: 'r1', read_number: 1, outcome: 'finished', ended_on: '2026-09-01' }),
      baseRead({ id: 'r2', read_number: 2, outcome: 'finished', ended_on: '2026-10-20' }),
    ];
    expect(readingSlotText(twice)).toBe(`Finished ${shortDay('2026-10-20')} · read 2 times`);

    const stoppedThenFinished = [
      baseRead({ id: 'r1', read_number: 1, outcome: 'did_not_finish', ended_on: '2026-09-01' }),
      baseRead({ id: 'r2', read_number: 2, outcome: 'finished', ended_on: '2026-10-20' }),
    ];
    expect(readingSlotText(stoppedThenFinished)).toBe(`Finished ${shortDay('2026-10-20')}`);
  });

  it('shows the stop for a did-not-finish read', () => {
    const reads = [baseRead({ id: 'r1', outcome: 'did_not_finish', ended_on: '2026-10-12' })];
    expect(readingSlotText(reads)).toBe(`Stopped ${shortDay('2026-10-12')}`);
  });

  it('returns null when the relevant edge is unknown', () => {
    expect(readingSlotText([baseRead({ outcome: 'reading', start_unknown: true })])).toBeNull();
    expect(
      readingSlotText([baseRead({ outcome: 'finished', ended_on: '2026-10-20', end_unknown: true })]),
    ).toBeNull();
    expect(readingSlotText([baseRead({ outcome: 'finished' })])).toBeNull();
    expect(readingSlotText([baseRead({ outcome: 'did_not_finish' })])).toBeNull();
  });
});
