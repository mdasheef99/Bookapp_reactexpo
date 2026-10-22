import { assignNotesToReads, nthBookCount } from '../readingTimeline';
import { ReadingRead } from '../readingHistoryContract';
import { ManualNote } from '../../notes/manualNoteContract';

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

function baseNote(overrides: Partial<ManualNote> = {}): ManualNote {
  return {
    id: 'note-1',
    user_id: 'actor',
    user_book_id: 'book-1',
    content: 'First line\nSecond line',
    tag: 'reflect',
    page_number: null,
    created_at: '2026-10-02T12:00:00.000Z',
    updated_at: null,
    ...overrides,
  };
}

describe('assignNotesToReads', () => {
  it('assigns notes in each read span', () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: '2026-10-05' }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-10', ended_on: '2026-10-20' }),
    ];
    const notes = [
      baseNote({ id: 'n1', created_at: '2026-10-02T12:00:00.000Z' }),
      baseNote({ id: 'n2', created_at: '2026-10-12T12:00:00.000Z' }),
    ];
    const assigned = assignNotesToReads(reads, notes, 'UTC');
    expect(assigned.byReadId['read-1'].map((note) => note.id)).toEqual(['n1']);
    expect(assigned.byReadId['read-2'].map((note) => note.id)).toEqual(['n2']);
    expect(assigned.otherNotes).toEqual([]);
  });

  it('sends a note on a shared boundary day to the later read', () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: '2026-10-10' }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-10', ended_on: '2026-10-20' }),
    ];
    const notes = [baseNote({ id: 'shared', created_at: '2026-10-10T12:00:00.000Z' })];
    const assigned = assignNotesToReads(reads, notes, 'UTC');
    expect(assigned.byReadId['read-1']).toEqual([]);
    expect(assigned.byReadId['read-2'].map((note) => note.id)).toEqual(['shared']);
  });

  it('sends a finishing thought before the next read start to the earlier read', () => {
    const reads = [
      baseRead({
        id: 'read-1',
        read_number: 1,
        outcome: 'finished',
        started_at: '2026-10-22T11:02:50.000Z',
        ended_at: '2026-10-22T11:03:12.000Z',
        started_on: null,
        ended_on: null,
      }),
      baseRead({
        id: 'read-2',
        read_number: 2,
        outcome: 'reading',
        started_at: '2026-10-22T11:03:41.000Z',
        ended_at: null,
        started_on: null,
        ended_on: null,
      }),
    ];
    const notes = [baseNote({ id: 'finishing', tag: 'reflect', created_at: '2026-10-22T11:03:26.000Z' })];
    const assigned = assignNotesToReads(reads, notes, 'UTC');
    expect(assigned.byReadId['read-1'].map((note) => note.id)).toEqual(['finishing']);
    expect(assigned.byReadId['read-2']).toEqual([]);
  });

  it('sends a note after the next read start to the later read', () => {
    const reads = [
      baseRead({
        id: 'read-1',
        read_number: 1,
        outcome: 'finished',
        started_at: '2026-10-22T11:02:50.000Z',
        ended_at: '2026-10-22T11:03:12.000Z',
        started_on: null,
        ended_on: null,
      }),
      baseRead({
        id: 'read-2',
        read_number: 2,
        outcome: 'reading',
        started_at: '2026-10-22T11:03:41.000Z',
        ended_at: null,
        started_on: null,
        ended_on: null,
      }),
    ];
    const notes = [baseNote({ id: 'after-start', created_at: '2026-10-22T11:03:45.000Z' })];
    const assigned = assignNotesToReads(reads, notes, 'UTC');
    expect(assigned.byReadId['read-1']).toEqual([]);
    expect(assigned.byReadId['read-2'].map((note) => note.id)).toEqual(['after-start']);
  });

  it('sends a shared-day note to the later read when it has a picked start', () => {
    const reads = [
      baseRead({
        id: 'read-1',
        read_number: 1,
        outcome: 'finished',
        started_at: '2026-10-22T11:02:50.000Z',
        ended_at: '2026-10-22T11:03:12.000Z',
        started_on: null,
        ended_on: null,
      }),
      baseRead({
        id: 'read-2',
        read_number: 2,
        outcome: 'reading',
        started_at: '2026-10-22T11:03:41.000Z',
        ended_at: null,
        started_on: '2026-10-22',
        ended_on: null,
      }),
    ];
    const notes = [baseNote({ id: 'picked-later', created_at: '2026-10-22T11:03:26.000Z' })];
    const assigned = assignNotesToReads(reads, notes, 'UTC');
    expect(assigned.byReadId['read-1']).toEqual([]);
    expect(assigned.byReadId['read-2'].map((note) => note.id)).toEqual(['picked-later']);
  });

  it('handles an unknown start from the previous end day plus one', () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: '2026-10-05' }),
      baseRead({
        id: 'read-2',
        read_number: 2,
        started_on: null,
        started_at: null,
        start_unknown: true,
        ended_on: '2026-10-20',
      }),
    ];
    const inSecond = baseNote({ id: 'in-second', created_at: '2026-10-06T12:00:00.000Z' });
    const inFirst = baseNote({ id: 'in-first', created_at: '2026-10-04T12:00:00.000Z' });
    const assigned = assignNotesToReads(reads, [inSecond, inFirst], 'UTC');
    expect(assigned.byReadId['read-2'].map((note) => note.id)).toEqual(['in-second']);
    expect(assigned.byReadId['read-1'].map((note) => note.id)).toEqual(['in-first']);
  });

  it('handles an unknown end up to the next start day minus one', () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: null, ended_at: null }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-10', ended_on: '2026-10-20' }),
    ];
    const inFirst = baseNote({ id: 'in-first', created_at: '2026-10-08T12:00:00.000Z' });
    const inSecond = baseNote({ id: 'in-second', created_at: '2026-10-10T12:00:00.000Z' });
    const assigned = assignNotesToReads(reads, [inFirst, inSecond], 'UTC');
    expect(assigned.byReadId['read-1'].map((note) => note.id)).toEqual(['in-first']);
    expect(assigned.byReadId['read-2'].map((note) => note.id)).toEqual(['in-second']);
  });

  it('sends notes outside every read to Other notes', () => {
    const reads = [
      baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: '2026-10-05' }),
      baseRead({ id: 'read-2', read_number: 2, started_on: '2026-10-10', ended_on: '2026-10-20' }),
    ];
    const gap = baseNote({ id: 'gap', created_at: '2026-10-07T12:00:00.000Z' });
    const before = baseNote({ id: 'before', created_at: '2026-09-20T12:00:00.000Z' });
    const assigned = assignNotesToReads(reads, [gap, before], 'UTC');
    expect(assigned.byReadId['read-1']).toEqual([]);
    expect(assigned.byReadId['read-2']).toEqual([]);
    expect(assigned.otherNotes.map((note) => note.id).sort()).toEqual(['before', 'gap']);
  });

  it('respects an explicit timeZone without process.env.TZ', () => {
    // 15:00 UTC Oct 1 is Oct 2 in Asia/Tokyo.
    const reads = [
      baseRead({
        id: 'read-1',
        read_number: 1,
        started_at: '2026-10-01T15:00:00.000Z',
        started_on: null,
        ended_on: '2026-10-02',
      }),
    ];
    const note = baseNote({ id: 'n1', created_at: '2026-10-01T10:00:00.000Z' });
    const tokyo = assignNotesToReads(reads, [note], 'Asia/Tokyo');
    expect(tokyo.otherNotes.map((n) => n.id)).toEqual(['n1']);
    expect(tokyo.byReadId['read-1']).toEqual([]);
    const utc = assignNotesToReads(reads, [note], 'UTC');
    expect(utc.byReadId['read-1'].map((n) => n.id)).toEqual(['n1']);
    expect(utc.otherNotes).toEqual([]);
  });

  it('sorts each bucket newest first', () => {
    const reads = [baseRead({ id: 'read-1', read_number: 1, started_on: '2026-10-01', ended_on: '2026-10-20' })];
    const notes = [
      baseNote({ id: 'old', created_at: '2026-10-02T12:00:00.000Z' }),
      baseNote({ id: 'new', created_at: '2026-10-05T12:00:00.000Z' }),
    ];
    const assigned = assignNotesToReads(reads, notes, 'UTC');
    expect(assigned.byReadId['read-1'].map((n) => n.id)).toEqual(['new', 'old']);
  });
});

describe('nthBookCount', () => {
  it('counts distinct books up to and including the target', () => {
    const all = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: '2026-02-10' }),
      baseRead({ id: 'r3', user_book_id: 'book-c', ended_on: '2026-12-10' }),
    ];
    expect(nthBookCount(all, 'r2', 'UTC')).toBe(2);
    expect(nthBookCount(all, 'r1', 'UTC')).toBe(1);
  });

  it('counts a same-year reread once', () => {
    const all = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r2', user_book_id: 'book-b', ended_on: '2026-02-10' }),
      baseRead({ id: 'r3', user_book_id: 'book-a', ended_on: '2026-03-10' }),
    ];
    expect(nthBookCount(all, 'r3', 'UTC')).toBe(2);
  });

  it('returns null for an excluded read', () => {
    const all = [
      baseRead({ id: 'r1', user_book_id: 'book-a', ended_on: '2026-01-10', counts_in_stats: false }),
    ];
    expect(nthBookCount(all, 'r1', 'UTC')).toBeNull();
  });

  it('returns null for an unknown end', () => {
    const all = [
      baseRead({ id: 'r1', user_book_id: 'book-a', started_on: '2026-01-10', ended_on: null, end_unknown: true }),
    ];
    expect(nthBookCount(all, 'r1', 'UTC')).toBeNull();
  });

  it('returns null unless the target read is finished', () => {
    const reading = [baseRead({ id: 'r1', user_book_id: 'book-a', outcome: 'reading', ended_on: null })];
    expect(nthBookCount(reading, 'r1', 'UTC')).toBeNull();
    const stopped = [
      baseRead({ id: 'r1', user_book_id: 'book-a', outcome: 'did_not_finish', ended_on: '2026-02-10' }),
    ];
    expect(nthBookCount(stopped, 'r1', 'UTC')).toBeNull();
  });

  it('ignores other years and later ends in the same year', () => {
    const all = [
      baseRead({ id: 'r25', user_book_id: 'book-old', ended_on: '2025-12-20' }),
      baseRead({ id: 'r26a', user_book_id: 'book-a', ended_on: '2026-01-10' }),
      baseRead({ id: 'r26b', user_book_id: 'book-b', ended_on: '2026-11-10' }),
    ];
    expect(nthBookCount(all, 'r26a', 'UTC')).toBe(1);
    expect(nthBookCount(all, 'r26b', 'UTC')).toBe(2);
  });
});
