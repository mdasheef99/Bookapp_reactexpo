import { parseMetadataEdition, MetadataEdition } from '../../contracts/metadata';
import { ProviderHostPolicy } from '../../contracts/providerReuse';
import { normalizeIsbnClue } from '../../domain/isbn';

const MAX_ITEMS = 10;
const MAX_AUTHORS = 16;
const MAX_CATEGORIES = 32;
const MAX_TEXT = 8_000;

export const GOOGLE_BOOKS_EDITION_HOST_POLICY: ProviderHostPolicy = Object.freeze({
  adapterKey: 'google_books',
  policyVersion: 'google-books-hosts-v1',
  approvedCoverHosts: Object.freeze(['books.google.com']),
});

type Context = Readonly<{
  correlationId: string;
  attemptId: string;
  fetchedAt: string;
}>;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  return normalized && normalized.length <= max ? normalized : null;
}

function strings(value: unknown, max: number, each = 512): string[] {
  if (!Array.isArray(value) || value.length > max) return [];
  const output = value.map((entry) => text(entry, each));
  return output.every((entry): entry is string => entry !== null) ? output : [];
}

function plainDescription(value: unknown): string | null {
  const source = text(value);
  if (source === null) return null;
  const withoutTags = source.replace(/<[^>]{0,256}>/gu, ' ');
  return withoutTags
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\s+/gu, ' ')
    .trim() || null;
}

function isbnPair(value: unknown): { isbn10: string | null; isbn13: string | null } {
  if (!Array.isArray(value) || value.length > 16) return { isbn10: null, isbn13: null };
  let isbn10: string | null = null;
  let isbn13: string | null = null;
  for (const entry of value) {
    const item = record(entry);
    const type = text(item?.type, 32);
    const identifier = text(item?.identifier, 32);
    if (!identifier) continue;
    const normalized = normalizeIsbnClue(identifier);
    if (normalized.status !== 'valid') continue;
    if (type === 'ISBN_10' && normalized.isbn10) isbn10 = normalized.isbn10;
    if (type === 'ISBN_13' && normalized.isbn13) isbn13 = normalized.isbn13;
  }
  if (isbn10 && !isbn13) isbn13 = normalizeIsbnClue(isbn10).isbn13;
  if (isbn10 && isbn13 && normalizeIsbnClue(isbn10).isbn13 !== isbn13) {
    return { isbn10: null, isbn13: null };
  }
  return { isbn10, isbn13 };
}

function cover(value: unknown): string | null {
  const links = record(value);
  const sizeOrder = [
    'extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail',
  ] as const;
  for (const size of sizeOrder) {
    const candidate = text(links?.[size], 512);
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'http:') parsed.protocol = 'https:';
      if (parsed.protocol !== 'https:'
        || parsed.hostname !== 'books.google.com'
        || parsed.username
        || parsed.password) continue;
      return parsed.toString();
    } catch {
      // A malformed larger image must not suppress a safe smaller provider image.
    }
  }
  return null;
}

function decodeItem(value: unknown, context: Context): MetadataEdition | null {
  const item = record(value);
  const info = record(item?.volumeInfo);
  const id = text(item?.id, 256);
  const title = text(info?.title, 512);
  const authors = strings(info?.authors, MAX_AUTHORS, 256);
  const language = text(info?.language, 35);
  if (!id || !title || authors.length === 0 || !language) return null;
  const pair = isbnPair(info?.industryIdentifiers);
  try {
    return parseMetadataEdition({
      contract_version: 'p9-contract-v1',
      schema_version: 'p9-metadata-v1',
      adapter_key: 'google_books',
      adapter_version: '1.0.0',
      normalizer_version: 'p9-google-books-normalizer-v1',
      correlation_id: context.correlationId,
      attempt_id: context.attemptId,
      provider_record_id: id,
      fetched_at: context.fetchedAt,
      title,
      subtitle: text(info?.subtitle, 512),
      authors,
      description: plainDescription(info?.description),
      isbn10: pair.isbn10,
      isbn13: pair.isbn13,
      publisher: text(info?.publisher, 256),
      published_date: text(info?.publishedDate, 32),
      language,
      script: null,
      edition_statement: null,
      series: null,
      volume: null,
      format: text(info?.printType, 128)?.toLowerCase() ?? null,
      page_count: Number.isSafeInteger(info?.pageCount) ? info?.pageCount : null,
      categories: strings(info?.categories, MAX_CATEGORIES, 128),
      cover_reference: cover(info?.imageLinks),
      match_rationale: 'Provider result; deterministic application ranking required.',
      confidence: 0,
    }, GOOGLE_BOOKS_EDITION_HOST_POLICY);
  } catch {
    return null;
  }
}

export function decodeGoogleBooksResponse(value: unknown, context: Context): MetadataEdition[] {
  const response = record(value);
  if (!response) throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  if (response.items === undefined && response.totalItems === 0) return [];
  if (!Array.isArray(response.items) || response.items.length > MAX_ITEMS) {
    throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  }
  return response.items.map((item) => decodeItem(item, context))
    .filter((item): item is MetadataEdition => item !== null);
}
