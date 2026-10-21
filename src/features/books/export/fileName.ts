import { formatExportDate } from './dates';
import type { ExportFileKind, ExportOptions, ExportScope } from './types';

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    bytes += codePoint <= 0x7F ? 1 : codePoint <= 0x7FF ? 2 : codePoint <= 0xFFFF ? 3 : 4;
  }
  return bytes;
}

function bookSlug(title: string | null): string {
  const slug = (title ?? '').normalize('NFKD').replace(/([A-Za-z])\p{M}+/gu, '$1')
    .normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  let capped = '';
  let length = 0;
  let bytes = 0;
  // Keep each base and its following marks together under both caps.
  for (const group of slug.match(/\P{M}\p{M}*|\p{M}+/gu) ?? []) {
    const groupLength = Array.from(group).length;
    const groupBytes = utf8ByteLength(group);
    if (length + groupLength > 60 || bytes + groupBytes > 200) break;
    capped += group;
    length += groupLength;
    bytes += groupBytes;
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
