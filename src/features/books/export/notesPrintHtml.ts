import { bookHeading, normalizeNoteContent, noteHeading, orderedNotesBooks } from './notesMarkdown';
import type { ExportNotesBook, ExportOptions } from './types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function htmlText(text: string): string {
  return escapeHtml(normalizeNoteContent(text)).replace(/\n/g, '<br>');
}

export function buildNotesPrintHtml(books: ExportNotesBook[], options: ExportOptions = {}): string {
  const sections = orderedNotesBooks(books).map(book => {
    const authors = book.authors?.join(', ');
    const notes = book.notes.map(note => {
      const element = note.tag === 'quote' ? 'blockquote' : 'p';
      return `<article class="note"><h2>${htmlText(noteHeading(note, options))}</h2>` +
        `<${element}>${htmlText(note.content)}</${element}></article>`;
    }).join('\n');
    return `<section><h1>${htmlText(bookHeading(book.title))}</h1>` +
      (authors ? `<p>${htmlText(authors)}</p>` : '') + '\n' + notes + '</section>';
  }).join('\n');
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>BookConnect notes</title>
<style>
@page { margin: 18mm; }
body { color: #000; background: #fff; font-family: Georgia, "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
h1 { font-size: 20pt; }
h2 { font-size: 14pt; }
.note { break-inside: avoid; }
blockquote { margin: 1em 2em; }
</style></head>
<body>
${sections}
</body>
</html>`;
}
