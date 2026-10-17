import type { ProviderHostPolicy } from '../../contracts/providerReuse';
import type { MetadataEdition } from '../../contracts/metadata';
import { parseNormalizedMetadataEdition } from '../../contracts/metadata';
import { normalizeIsbnClue } from '../../domain/isbn';
import { requiredString, requiredIsoTimestamp } from '../../domain/validation';
import { projectStoredEditionRow } from '../../contracts/ownerEditionPicker';
import type { StoredEditionRow, OptionsRetentionEvidence } from '../../contracts/ownerEditionPicker';
import { normalizeBibliographicText, MetadataQueryIdentity } from '../queryIdentity';
import { explicitEditionAuthorsMatch, explicitEditionLanguageMatches,
  explicitEditionTitleMatches } from '../explicitEditionTitle';
import { decodeGoogleBooksItem, GOOGLE_BOOKS_EDITION_HOST_POLICY } from './decoder';
import { PHASE9_LIMITS } from '../../contracts/registers';
import { GOOGLE_BOOKS_RESULT_LIMIT } from './request';

// Picker §§3/4.1/5/13.2: original positions are independent of eligibility.
export type GoogleEditionOptionsContext = Readonly<{
  correlationId: string; attemptId: string; fetchedAt: string; createOptionId: () => string;
}>;
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const providerId = /^[A-Za-z0-9_-]{1,256}$/u;
const imageSizes = ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail'] as const;

function ownUrl(value: unknown, id: string, bookLink: boolean): string | null {
  if (typeof value !== 'string' || value.length > (bookLink ? 2048 : 512)) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.hostname !== 'books.google.com'
      || url.username || url.password || url.port) return null;
    const ids = url.searchParams.getAll('id');
    if ((bookLink && (url.pathname !== '/books' || ids.length !== 1))
      || ids.length > 1 || (ids.length === 1 && ids[0] !== id)) return null;
    return url.toString();
  } catch { return null; }
}

function coherentIdentifiers(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!Array.isArray(value) || value.length > 16) return false;
  const tens = new Set<string>();
  const thirteens = new Set<string>();
  for (const entry of value) {
    const row = record(entry);
    if (row?.type !== 'ISBN_10' && row?.type !== 'ISBN_13') continue;
    if (typeof row.identifier !== 'string') return false;
    const isbn = normalizeIsbnClue(row.identifier);
    if (isbn.status !== 'valid') continue; // Invalid checksums never establish identity.
    if (row.type === 'ISBN_10') {
      if (isbn.isbn10 === null) return false;
      tens.add(isbn.isbn13!);
    } else {
      if (isbn.isbn10 !== null) return false;
      thirteens.add(isbn.isbn13!);
    }
  }
  return tens.size <= 1 && thirteens.size <= 1
    && (tens.size === 0 || thirteens.size === 0 || [...tens][0] === [...thirteens][0]);
}

function decodeOption(value: unknown, context: GoogleEditionOptionsContext): MetadataEdition | null {
  const item = record(value);
  const info = record(item?.volumeInfo);
  const id = item?.id;
  if (typeof id !== 'string' || !providerId.test(id) || !info
    || !coherentIdentifiers(info.industryIdentifiers)
    || (info.infoLink !== undefined && info.infoLink !== null && ownUrl(info.infoLink, id, true) === null)) return null;
  try {
    for (const [field, limit] of [['subtitle', 512], ['publisher', 256], ['publishedDate', 32]] as const) {
      if (info[field] !== undefined && info[field] !== null) requiredString(info[field], field, limit);
    }
    if (info.pageCount !== undefined && info.pageCount !== null && !Number.isSafeInteger(info.pageCount)) return null;
    if (info.categories !== undefined && info.categories !== null
      && (!Array.isArray(info.categories) || info.categories.length > 20
        || info.categories.some(category => typeof category !== 'string'))) return null;
    const images = record(info.imageLinks);
    const ownCover = imageSizes.map(size => ownUrl(images?.[size], id, false)).find(url => url !== null) ?? null;
    const decoded = decodeGoogleBooksItem({ id, volumeInfo: {
      ...info, imageLinks: ownCover === null ? undefined : { thumbnail: ownCover },
    } }, context, PHASE9_LIMITS.authorCount);
    // Google printType describes the resource, not its binding or edition number (§3).
    return decoded ? { ...decoded, format: null } : null;
  } catch { return null; }
}

export function evaluateEditionOption(
  query: MetadataQueryIdentity, metadata: MetadataEdition, hostPolicy: ProviderHostPolicy = GOOGLE_BOOKS_EDITION_HOST_POLICY,
): 'eligible' | 'ineligible' {
  try { metadata = parseNormalizedMetadataEdition(metadata, hostPolicy); }
  catch { return 'ineligible'; }
  const exactIsbn = query.normalizedIsbn13 !== null && metadata.isbn13 === query.normalizedIsbn13;
  const titleMatches = explicitEditionTitleMatches(query, metadata);
  const authorsMatch = explicitEditionAuthorsMatch(query, metadata);
  const languageMatches = explicitEditionLanguageMatches(query, metadata.language, exactIsbn,
    titleMatches && authorsMatch);
  const textIdentity = Boolean(query.normalizedTitle && query.normalizedAuthors.length > 0);
  return titleMatches && authorsMatch && languageMatches && (exactIsbn || textIdentity) ? 'eligible' : 'ineligible';
}

function editionIdentity(metadata: MetadataEdition): string {
  return JSON.stringify([metadata.title, metadata.subtitle, [...metadata.authors].sort(), metadata.language,
    metadata.isbn10, metadata.isbn13, metadata.publisher, metadata.publishedDate,
    metadata.editionStatement, metadata.series, metadata.volume, metadata.format]);
}

export function normalizeGoogleEditionRows(
  raw: unknown, context: GoogleEditionOptionsContext, query: MetadataQueryIdentity,
): readonly StoredEditionRow[] {
  const response = record(raw);
  if (!response) throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  if (response.items === undefined && response.totalItems === 0) return [];
  if (!Array.isArray(response.items) || response.items.length > GOOGLE_BOOKS_RESULT_LIMIT) {
    throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  }
  let rows: StoredEditionRow[] = Array.from(response.items, (item, ordinal) => {
    const optionId = context.createOptionId();
    const unavailable: StoredEditionRow = { optionId, ordinal, googleBooksUrl: null, eligibility: 'unavailable', metadata: null };
    const metadata = decodeOption(item, context);
    if (metadata === null) return unavailable;
    const row: StoredEditionRow = { optionId, ordinal,
      googleBooksUrl: 'https://books.google.com/books?id=' + encodeURIComponent(metadata.providerRecordId),
      eligibility: evaluateEditionOption(query, metadata), metadata };
    try { projectStoredEditionRow(row); return row; }
    catch { return unavailable; }
  });
  return annotateEditionRows(rows, query);
}

export function annotateEditionRows(rows: StoredEditionRow[], query: MetadataQueryIdentity): readonly StoredEditionRow[] {
  // Conflicting observed-ISBN evidence remains relevant even when selection is disabled (§4.1).
  const isbnRows = rows.filter(row => row.metadata !== null && query.normalizedIsbn13 !== null
    && row.metadata.isbn13 === query.normalizedIsbn13);
  const identities = new Set(isbnRows.map(row => editionIdentity(row.metadata!)));
  const strongIsbn = identities.size === 1 && isbnRows.every(row => row.eligibility === 'eligible');
  // Only coherent exact-ISBN evidence supplies a structured reference volume.
  // Publisher/year/free-text edition clues never manufacture volume authority (§4.1).
  const referenceVolume = strongIsbn ? isbnRows[0].metadata?.volume : null;
  rows = rows.map(row => {
    if (row.metadata === null) return row;
    const volumeConflict = referenceVolume && row.metadata.volume
      && normalizeBibliographicText(referenceVolume) !== normalizeBibliographicText(row.metadata.volume);
    const eligibility = volumeConflict ? 'ineligible' : row.eligibility;
    const exactIsbn = isbnRows.includes(row);
    const matchRationale = eligibility !== 'eligible' ? 'identity_conflict_selection_disabled'
      : exactIsbn && strongIsbn ? 'exact_validated_isbn'
      : exactIsbn ? 'confirmation_required_conflicting_isbn_records' : 'confirmation_required_text_evidence';
    return { ...row, eligibility, metadata: { ...row.metadata, matchRationale } };
  });
  if (new Set(rows.map(row => row.optionId)).size !== rows.length) throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  rows.forEach(projectStoredEditionRow);
  return rows;
}

// Picker §§8/13.2: the 24-hour product limit never grants provider permission.
export function resolveOptionsDeadline(fetchedAt: string, evidence: OptionsRetentionEvidence): string | null {
  if (evidence?.storagePermissionVerified !== true || evidence.permittedDeadlineAt === null) return null;
  try {
    const fetched = Date.parse(requiredIsoTimestamp(fetchedAt, 'fetched_at'));
    const permitted = Date.parse(requiredIsoTimestamp(evidence.permittedDeadlineAt, 'permitted_deadline_at'));
    if (permitted <= fetched) return null;
    return new Date(Math.min(permitted, fetched + 24 * 60 * 60 * 1000)).toISOString();
  } catch { return null; }
}

export function boundOptionsRetentionEvidence(
  fetchedAt: string, evidence: OptionsRetentionEvidence | null, headers: Headers,
): OptionsRetentionEvidence {
  const denied: OptionsRetentionEvidence = { storagePermissionVerified: false, permittedDeadlineAt: null };
  const verified = evidence === null ? null : resolveOptionsDeadline(fetchedAt, evidence);
  if (verified === null) return denied;
  let deadline = Date.parse(verified);
  const fetched = Date.parse(fetchedAt);
  const cacheControl = headers.get('cache-control');
  const expires = headers.get('expires');
  const responseDate = headers.get('date');
  const age = headers.get('age');
  if ([cacheControl, expires, responseDate, age].some(value => value !== null && value.length > 2048)) return denied;
  const directives = cacheControl?.split(',').map(value => value.trim().toLowerCase()) ?? [];
  if (directives.some(value => /^(?:no-store|no-cache)(?:\s*=|$)/u.test(value))) return denied;
  const maxAge = directives.filter(value => /^max-age(?:\s*=|$)/u.test(value));
  if (maxAge.length > 1) return denied;
  let dated = fetched;
  let currentAge = 0;
  if (maxAge.length === 1 || expires !== null) {
    const ageSeconds = age === null ? 0 : /^\d+$/u.test(age) ? Number(age) : NaN;
    dated = responseDate === null ? fetched : Date.parse(responseDate);
    if (!Number.isSafeInteger(ageSeconds) || !Number.isFinite(dated)) return denied;
    currentAge = Math.max(0, fetched - dated, ageSeconds * 1000);
  }
  if (maxAge.length === 1) {
    const match = /^max-age\s*=\s*(?:"(\d+)"|(\d+))$/u.exec(maxAge[0]);
    const seconds = match ? Number(match[1] ?? match[2]) : NaN;
    if (!Number.isSafeInteger(seconds)) return denied;
    deadline = Math.min(deadline, fetched + seconds * 1000 - currentAge);
  }
  if (expires !== null) {
    const expiry = Date.parse(expires);
    if (!Number.isFinite(expiry)) return denied;
    // Without max-age, Expires supplies a Date-relative lifetime reduced by Age (§8).
    const expiryDeadline = maxAge.length === 0 ? fetched + (expiry - dated) - currentAge : expiry;
    deadline = Math.min(deadline, expiry, expiryDeadline);
  }
  return deadline > fetched ? { storagePermissionVerified: true, permittedDeadlineAt: new Date(deadline).toISOString() } : denied;
}
