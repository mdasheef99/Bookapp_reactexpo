import { filterNotes, normaliseNoteQuery, noteMatchesQuery, searchCountLabel } from '../noteSearch';
import type { ManualNote } from '../manualNoteContract';

const note = (overrides: Partial<ManualNote> = {}): ManualNote => ({
  id: 'note-1', user_id: 'actor', user_book_id: 'book', content: 'A saved body',
  tag: 'quote', page_number: 42, created_at: '2026-10-14T12:00:00Z', updated_at: null, version: 1, ...overrides,
});

describe('normaliseNoteQuery', () => {
  it('trims outer spaces and lowercases', () => {
    expect(normaliseNoteQuery('  Hooked  ')).toBe('hooked');
  });
  it('treats empty and whitespace as no search', () => {
    expect(normaliseNoteQuery('')).toBe('');
    expect(normaliseNoteQuery('   ')).toBe('');
  });
});

describe('noteMatchesQuery', () => {
  it('matches ignoring upper and lower case', () => {
    expect(noteMatchesQuery(note({ content: 'Hooked on Habits' }), 'hooked')).toBe(true);
    expect(noteMatchesQuery(note({ content: 'Hooked on Habits' }), 'HOOKED')).toBe(true);
  });
  it('matches full-width text through NFKC', () => {
    expect(noteMatchesQuery(note({ content: 'ABC notes' }), 'ＡＢＣ')).toBe(true);
    expect(noteMatchesQuery(note({ content: 'ＡＢＣ notes' }), 'abc')).toBe(true);
  });
  it('matches the ﬁ ligature as fi through NFKC', () => {
    expect(noteMatchesQuery(note({ content: 'ﬁshing notes' }), 'fi')).toBe(true);
    expect(noteMatchesQuery(note({ content: 'fishing notes' }), 'ﬁ')).toBe(true);
  });
  it('matches non-Latin scripts case-insensitively', () => {
    expect(noteMatchesQuery(note({ content: 'Σοφία and notes' }), 'σοφ')).toBe(true);
    expect(noteMatchesQuery(note({ content: 'книга о привычках' }), 'книга')).toBe(true);
    expect(noteMatchesQuery(note({ content: '読書メモ' }), '読書')).toBe(true);
  });
  it('ignores leading and trailing spaces in the query', () => {
    expect(noteMatchesQuery(note({ content: 'Hooked notes' }), '  hooked  ')).toBe(true);
  });
  it('treats an empty or whitespace query as matching everything', () => {
    expect(noteMatchesQuery(note({ content: 'Anything here' }), '')).toBe(true);
    expect(noteMatchesQuery(note({ content: 'Anything here' }), '   ')).toBe(true);
  });
  it('does not fold accents', () => {
    expect(noteMatchesQuery(note({ content: 'café notes' }), 'cafe')).toBe(false);
    expect(noteMatchesQuery(note({ content: 'cafe notes' }), 'café')).toBe(false);
    expect(noteMatchesQuery(note({ content: 'café notes' }), 'café')).toBe(true);
  });
});

describe('filterNotes', () => {
  it('combines the category chip and the query so both must match', () => {
    const notes = [
      note({ id: '1', content: 'Hooked quote', tag: 'quote' }),
      note({ id: '2', content: 'Hooked thought', tag: 'reflect' }),
      note({ id: '3', content: 'Other quote', tag: 'quote' }),
    ];
    expect(filterNotes(notes, { category: 'quote', query: 'hooked' }).map(item => item.id)).toEqual(['1']);
    expect(filterNotes(notes, { category: null, query: 'hooked' }).map(item => item.id)).toEqual(['1', '2']);
    expect(filterNotes(notes, { category: 'quote', query: '' }).map(item => item.id)).toEqual(['1', '3']);
  });
});

describe('searchCountLabel', () => {
  it('uses the singular only when the total is one', () => {
    expect(searchCountLabel(1, 1)).toBe('1 of 1 note');
    expect(searchCountLabel(2, 4)).toBe('2 of 4 notes');
    expect(searchCountLabel(1, 4)).toBe('1 of 4 notes');
    expect(searchCountLabel(0, 4)).toBe('0 of 4 notes');
  });
});
