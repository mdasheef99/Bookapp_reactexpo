import { buildNotesMarkdown } from '../notesMarkdown';
import { buildNotesPrintHtml } from '../notesPrintHtml';
import type { ExportNote, ExportNotesBook } from '../types';

const options = { timeZone: 'UTC' };
const note: ExportNote = { content: 'Body', tag: null, page_number: null, created_at: null, updated_at: null };

describe('buildNotesPrintHtml', () => {
  it.each([
    [null, 'Notes — Untitled book'],
    ['', 'Notes — '],
    ['Book', 'Notes — Book'],
  ])('shares the book heading and null-only fallback with Markdown for %j', (title, expected) => {
    const books = [{ title, authors: null, notes: [note] }];
    const html = buildNotesPrintHtml(books, options);
    expect(html.match(/<h1>(.*?)<\/h1>/g)).toEqual(['<h1>' + expected + '</h1>']);
    expect(buildNotesMarkdown(books, options)).toBe('# ' + expected + '\n\n## Note\nBody\n');
  });

  it('builds a standalone print document with readable black-on-white serif notes', () => {
    const html = buildNotesPrintHtml([{ title: 'Book', authors: null, notes: [note] }], options);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toMatch(/<style>[\s\S]*font-family:[^;]*serif;/);
    expect(html).toContain('font-size: 12pt');
    expect(html).toContain('color: #000');
    expect(html).toContain('background: #fff');
    expect(html).toMatch(/\.note\s*\{[^}]*break-inside: avoid/);
    expect(html).toContain('class="note"');
    expect(html).toContain('<p>Body</p>');
    expect(html).toMatch(/<\/body>\s*<\/html>$/);
  });

  it('escapes every HTML text character in titles, authors and notes, and normalises line breaks', () => {
    const text = '<script>& " \' </script>';
    const html = buildNotesPrintHtml([{
      title: text, authors: [text, 'Two'], notes: [{ ...note, content: text + '\r\nnext\rlast' }],
    }], options);
    const escaped = '&lt;script&gt;&amp; &quot; &#39; &lt;/script&gt;';
    expect(html).toContain('<h1>Notes — ' + escaped + '</h1>');
    expect(html).toContain(escaped + ', Two');
    expect(html).toContain('<p>' + escaped + '<br>next<br>last</p>');
    expect(html).not.toMatch(/<img|<script|http/i);
  });

  it('uses the same book order, note order, labels, page and dates as Markdown', () => {
    const books: ExportNotesBook[] = [
      { title: 'zebra', authors: [], notes: [note] },
      { title: null, authors: null, notes: [note] },
      { title: 'Apple', authors: null, notes: [
        { ...note, tag: 'reflect', content: 'newer', created_at: '2026-10-04T20:00:00Z', updated_at: '2026-10-05T20:00:00Z' },
        { ...note, tag: 'distill', content: 'older', page_number: 42, created_at: '2026-10-03T20:00:00Z' },
        { ...note, content: 'undated', page_number: -1, created_at: 'invalid', updated_at: '2026-10-06T20:00:00Z' },
      ] },
      { title: 'Empty', authors: ['Omit me'], notes: [] },
    ];
    const pinned = { timeZone: 'Asia/Kolkata' };
    const html = buildNotesPrintHtml(books, pinned);
    const markdown = buildNotesMarkdown(books, pinned);
    const htmlHeadings = [...html.matchAll(/<h[12]>(.*?)<\/h[12]>/g)].map(match => match[1]);
    const mdHeadings = [...markdown.matchAll(/^#{1,2} (.*)$/gm)].map(match => match[1]);
    expect(htmlHeadings).toEqual([
      'Notes — Apple', 'Takeaway · p. 42 · 4 Oct 2026', 'Thought · 5 Oct 2026 · Edited 6 Oct 2026',
      'Note', 'Notes — zebra', 'Note', 'Notes — Untitled book', 'Note',
    ]);
    expect(htmlHeadings).toEqual(mdHeadings);
    expect(html.indexOf('<p>older</p>')).toBeLessThan(html.indexOf('<p>newer</p>'));
    expect(html.indexOf('<p>newer</p>')).toBeLessThan(html.indexOf('<p>undated</p>'));
    expect(html).not.toContain('Empty');
    expect(html).not.toContain('Omit me');
    expect(html).not.toMatch(/<img|<script|http/i);
  });

  it('uses a blockquote for quotes with preserved blank lines and plain text controls', () => {
    const html = buildNotesPrintHtml([{
      title: 'Book', authors: [], notes: [{ ...note, tag: 'quote', content: '# first\n\n> last' }],
    }], options);
    expect(html).toContain('<blockquote># first<br><br>&gt; last</blockquote>');
    expect(html).not.toContain('\\#');
  });

  it('returns an empty standalone document without empty book sections', () => {
    const html = buildNotesPrintHtml([{ title: 'Empty', authors: null, notes: [] }], options);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).not.toContain('<h1>');
    expect(buildNotesPrintHtml([], options)).toBe(html);
  });
});
