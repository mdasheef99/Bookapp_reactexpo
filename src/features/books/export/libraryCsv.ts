import { conditionLabel, ownershipLabel, readingStatusLabel } from '../utils/libraryLabels';
import { formatExportDate } from './dates';
import type { ExportLibraryRow, ExportOptions } from './types';

const HEADERS = [
  'Title', 'Authors', 'ISBN-13', 'ISBN-10', 'Publisher', 'Published date', 'Pages',
  'Status', 'Ownership', 'Condition', 'Rating', 'Review', 'Review visibility', 'Date added', 'Date finished',
];

function guardText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function csvField(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[,"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function isbn(value: string | null): string {
  const text = (value ?? '').trim();
  return text.replace(/\D/g, '') + (/[Xx]$/.test(text) ? 'X' : '');
}

export function buildLibraryCsv(
  rows: ExportLibraryRow[],
  options: ExportOptions = {},
): { text: string; rowCount: number; skipped: number } {
  const records = [HEADERS.join(',')];
  let skipped = 0;
  for (const row of rows) {
    const book = row.book;
    if (book === null) {
      skipped += 1;
      continue;
    }
    const fields = [
      guardText(book.title ?? ''),
      guardText(book.authors?.join('; ') ?? ''),
      isbn(book.isbn_13),
      isbn(book.isbn_10),
      guardText(book.publisher ?? ''),
      guardText(book.published_date ?? ''),
      book.page_count,
      guardText(row.reading_status === null ? '' : readingStatusLabel(row.reading_status)),
      guardText(row.ownership === null ? '' : ownershipLabel(row.ownership)),
      guardText(row.condition === null ? '' : conditionLabel(row.condition)),
      row.rating,
      guardText(row.review ?? ''),
      row.review ? (row.review_is_public ? 'Public' : 'Private') : '',
      formatExportDate(row.created_at, options),
      formatExportDate(row.completed_at, options),
    ];
    records.push(fields.map(csvField).join(','));
  }
  return { text: '\uFEFF' + records.join('\r\n'), rowCount: records.length - 1, skipped };
}
