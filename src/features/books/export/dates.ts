import type { ExportOptions } from './types';

function validDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function timeZone(options: ExportOptions): string {
  return options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatExportDate(value: string | Date | null, options: ExportOptions = {}): string {
  const date = validDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone(options), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const year = parts.find(part => part.type === 'year')!.value.padStart(4, '0');
  const month = parts.find(part => part.type === 'month')!.value;
  const day = parts.find(part => part.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

export function formatNoteDate(value: string | Date | null, options: ExportOptions = {}): string {
  const date = validDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone(options), year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}
