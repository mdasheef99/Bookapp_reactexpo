import { formatExportDate } from './dates';
import type { ExportFileKind, ExportOptions, ExportScope } from './types';

function bookSlug(title: string | null): string {
  const slug = (title ?? '').normalize('NFKD').replace(/([A-Za-z])\p{M}+/gu, '$1')
    .normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  let capped = '';
  let length = 0;
  // Keep each base and its following marks together when enforcing the code-point cap.
  for (const group of slug.match(/\P{M}\p{M}*|\p{M}+/gu) ?? []) {
    const groupLength = Array.from(group).length;
    if (length + groupLength > 60) break;
    capped += group;
    length += groupLength;
  }
  return capped.replace(/-+$/, '') || 'book';
}

export function buildFileName(
  kind: ExportFileKind,
  scope: ExportScope,
  date: Date,
  options: ExportOptions = {},
): string {
  const day = formatExportDate(date, options);
  if (kind === 'library-csv') return `bookconnect-library-${day}.csv`;
  const slug = scope.kind === 'all' ? 'all' : bookSlug(scope.title);
  const extension = kind === 'notes-md' ? 'md' : 'pdf';
  return `bookconnect-notes-${slug}-${day}.${extension}`;
}
