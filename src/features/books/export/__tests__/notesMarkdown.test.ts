import { bookHeading, buildNotesMarkdown } from '../notesMarkdown';
import type { ExportNote, ExportNotesBook } from '../types';

const options = { timeZone: 'UTC' };
const note: ExportNote = { content: 'Body', tag: null, page_number: null, created_at: null, updated_at: null };
const book: ExportNotesBook = { title: 'Book', authors: null, notes: [note] };

describe('buildNotesMarkdown', () => {
  it.each([
    [null, 'Notes — Untitled book'],
    ['', 'Notes — '],
    ['*Book* & <title>', 'Notes — *Book* & <title>'],
  ])('builds shared book heading text before format-specific escaping for %j', (title, expected) => {
    expect(bookHeading(title)).toBe(expected);
  });

  it('orders books by title with base sensitivity and null titles last, without changing input', () => {
    const books = [
      { ...book, title: null }, { ...book, title: 'zebra' }, { ...book, title: 'ápple' },
      { ...book, title: 'Banana' }, { ...book, title: 'APPLE' },
    ];
    expect(buildNotesMarkdown(books, options).match(/^# Notes — .*$/gm)).toEqual([
      '# Notes — ápple', '# Notes — APPLE', '# Notes — Banana', '# Notes — zebra', '# Notes — Untitled book',
    ]);
    expect(books.map(item => item.title)).toEqual([null, 'zebra', 'ápple', 'Banana', 'APPLE']);
  });

  it('orders notes oldest first, keeps ties stable and puts null and invalid dates last', () => {
    const notes = [
      { ...note, content: 'null first' },
      { ...note, content: 'newer', created_at: '2026-10-04T00:00:00Z' },
      { ...note, content: 'older first', created_at: '2026-10-03T00:00:00Z' },
      { ...note, content: 'older second', created_at: '2026-10-03T00:00:00Z' },
      { ...note, content: 'invalid last', created_at: 'invalid' },
      { ...note, content: 'null last' },
    ];
    const text = buildNotesMarkdown([{ ...book, notes }], options);
    expect(text).toBe('# Notes — Book\n\n' +
      '## Note · 3 Oct 2026\nolder first\n\n## Note · 3 Oct 2026\nolder second\n\n' +
      '## Note · 4 Oct 2026\nnewer\n\n## Note\nnull first\n\n## Note\ninvalid last\n\n## Note\nnull last\n');
    expect(notes[0].content).toBe('null first');
  });

  it.each([
    ['quote', 'Quote'], ['reflect', 'Thought'], ['distill', 'Takeaway'],
    ['apply', 'Action'], ['question', 'Question'], [null, 'Note'],
  ] as const)('uses the category label for %s', (tag, label) => {
    expect(buildNotesMarkdown([{ ...book, notes: [{ ...note, tag }] }], options)).toContain('## ' + label + '\n');
  });

  it.each([
    [null, '## Note'], [0, '## Note'], [-1, '## Note'], [1.5, '## Note'],
    [NaN, '## Note'], [Infinity, '## Note'], [1, '## Note · p. 1'], [42, '## Note · p. 42'],
  ])('includes only a positive integer page: %s', (page_number, heading) => {
    expect(buildNotesMarkdown([{ ...book, notes: [{ ...note, page_number }] }], options)).toBe(
      '# Notes — Book\n\n' + heading + '\nBody\n',
    );
  });

  it.each([
    ['UTC', '3 Oct 2026'], ['Asia/Kolkata', '4 Oct 2026'],
  ])('formats dates in %s with separators between present parts only', (timeZone, date) => {
    const dated = { ...note, created_at: '2026-10-03T20:00:00Z' };
    expect(buildNotesMarkdown([{ ...book, notes: [dated] }], { timeZone })).toBe(
      '# Notes — Book\n\n## Note · ' + date + '\nBody\n',
    );
    expect(buildNotesMarkdown([{ ...book, notes: [{ ...dated, page_number: 42 }] }], { timeZone })).toBe(
      '# Notes — Book\n\n## Note · p. 42 · ' + date + '\nBody\n',
    );
  });

  it.each([
    [null, '2026-10-04T00:00:00Z', '## Note'],
    ['invalid', '2026-10-04T00:00:00Z', '## Note'],
    ['2026-10-03T00:00:00Z', null, '## Note · 3 Oct 2026'],
    ['2026-10-03T00:00:00Z', 'invalid', '## Note · 3 Oct 2026'],
    ['2026-10-03T00:00:00Z', '2026-10-03T00:00:00Z', '## Note · 3 Oct 2026'],
    ['2026-10-03T00:00:00Z', '2026-10-02T00:00:00Z', '## Note · 3 Oct 2026'],
    ['2026-10-03T00:00:00Z', '2026-10-04T00:00:00Z', '## Note · 3 Oct 2026 · Edited 4 Oct 2026'],
    ['2026-10-03T00:00:00Z', '2026-10-03T01:00:00Z', '## Note · 3 Oct 2026 · Edited 3 Oct 2026'],
  ])('applies the Edited rule for %s / %s', (created_at, updated_at, heading) => {
    expect(buildNotesMarkdown([{ ...book, notes: [{ ...note, created_at, updated_at }] }], options)).toBe(
      '# Notes — Book\n\n' + heading + '\nBody\n',
    );
  });

  it('quotes every line including blank lines after normalising CRLF and CR', () => {
    const quoted = { ...note, tag: 'quote' as const, content: 'first\r\n\r\n# heading\rlast' };
    expect(buildNotesMarkdown([{ ...book, notes: [quoted] }], options)).toBe(
      '# Notes — Book\n\n## Quote\n> first\n>\n> \\# heading\n> last\n',
    );
  });

  it.each([
    ['# heading', '\\# heading'], ['> quote', '\\> quote'], ['- item', '\\- item'],
    ['* item', '\\* item'], ['+ item', '\\+ item'], ['1. item', '\\1. item'],
    ['23) item', '\\23) item'], ['```ts', '\\```ts'],
    ['  # heading', '  \\# heading'], ['   12. item', '   \\12. item'],
    ['  ```', '  \\```'],
  ])('escapes leading Markdown structure in %j', (content, expected) => {
    expect(buildNotesMarkdown([{ ...book, notes: [{ ...note, content }] }], options)).toBe(
      '# Notes — Book\n\n## Note\n' + expected + '\n',
    );
  });

  it('normalises plain-note line endings, leaves inline Markdown and has exactly one final LF', () => {
    const content = 'text *bold* _em_ [link](here) `code`\r\nnext\rfinal\n\n';
    const text = buildNotesMarkdown([{ ...book, notes: [{ ...note, content }] }], options);
    expect(text).toBe('# Notes — Book\n\n## Note\ntext *bold* _em_ [link](here) `code`\nnext\nfinal\n');
    expect(text).not.toContain('\r');
    expect(text.startsWith('\uFEFF')).toBe(false);
  });

  it('escapes all title and author control characters and joins authors', () => {
    const title = '\\ * _ # [ ] `';
    expect(buildNotesMarkdown([{ ...book, title, authors: [title, 'Second'] }], options)).toBe(
      '# Notes — \\\\ \\* \\_ \\# \\[ \\] \\`\n' +
      '\\\\ \\* \\_ \\# \\[ \\] \\`, Second\n\n## Note\nBody\n',
    );
  });

  it.each([null, []])('omits empty authors %j', authors => {
    expect(buildNotesMarkdown([{ ...book, authors }], options)).toBe('# Notes — Book\n\n## Note\nBody\n');
  });

  it('leaves one blank line between notes and books and omits books without notes', () => {
    expect(buildNotesMarkdown([
      { ...book, title: 'Empty', notes: [] },
      { ...book, title: 'B' }, { ...book, title: 'A', authors: ['Writer'], notes: [note, note] },
    ], options)).toBe('# Notes — A\nWriter\n\n## Note\nBody\n\n## Note\nBody\n\n# Notes — B\n\n## Note\nBody\n');
    expect(buildNotesMarkdown([], options)).toBe('');
    expect(buildNotesMarkdown([{ ...book, notes: [] }], options)).toBe('');
  });

  it('leaves one blank separator when a plain note already ends with blank lines', () => {
    expect(buildNotesMarkdown([{ ...book, notes: [{ ...note, content: 'First\n\n' }, note] }], options)).toBe(
      '# Notes — Book\n\n## Note\nFirst\n\n## Note\nBody\n',
    );
  });
});
