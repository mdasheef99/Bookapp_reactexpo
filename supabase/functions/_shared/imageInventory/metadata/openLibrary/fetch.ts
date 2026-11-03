import type { CatalogueWriteCompanion } from '../../contracts/catalogueWrite';
import type { StoredEditionRow } from '../../contracts/ownerEditionPicker';
import type { OptionsRetentionEvidence } from '../../contracts/ownerEditionPicker';
import type { MetadataQueryIdentity } from '../queryIdentity';
import {
  hasSafeOpenLibraryFacts, normalizeOpenLibraryRows, object,
  openLibraryIdentityPriority, openLibraryRowAuthorKeys,
} from './normalizer';
import type { OpenLibraryWorkAuthors } from './normalizer';
import { normalizeOpenLibraryCompanions } from './catalogueWrite';
import { OpenLibraryFailure } from './transport';
import { ProviderHttpError } from '../providerHttp';
import { boundOptionsRetentionEvidence } from '../googleBooks/editionOptions';
import { normalizeIsbnClue } from '../../domain/isbn';

// Shared Open Library search/edition/author allocation engine (02c §5.1).
// Used by BOTH the v1 explicit adapter (transport-backed get) and the v2
// descriptor (ProviderHttpPort get). Order, stage names, limits, budgets and
// failure isolation are identical for both callers: search (sequence 0,
// limit 1), editions/edition (sequence 1, limit 10), authors (sequences 2-5,
// at most four unique author GETs, six total GETs, no isbn stage, no retries).
// The raw transport is caller-supplied so this module performs no egress
// itself and imports no fetcher.
export type OpenLibraryRawGet = (
  url: URL,
  stage: string,
  sequence: number,
) => Promise<{ raw: unknown; headers: Headers }>;

export type OpenLibraryFetchedBundle = Readonly<{
  fetchedAt: string;
  retention: OptionsRetentionEvidence;
  entries: readonly unknown[];
  workKey: string;
  workAuthors: OpenLibraryWorkAuthors;
  authorNames: ReadonlyMap<string, string>;
  // U6 fix1 (F1): verified row policy forwarded on the TYPED response
  // channel (ProviderHttpResponse.retentionPolicyVersion, port-populated from
  // verified internal configuration). First value wins; absent without a
  // fencing port. Response headers NEVER identify policy (only bound duration).
  retentionPolicyVersion?: number | null;
}>;

export type OpenLibraryFetched =
  // C1: isbn strategy without a normalized ISBN makes zero GETs, so no
  // fetchedAt is minted and no retention is fabricated for it.
  | Readonly<{ kind: 'zero-get' }>
  | Readonly<{ kind: 'no-list'; fetchedAt: string; retention: OptionsRetentionEvidence; retentionPolicyVersion?: number | null }>
  | (OpenLibraryFetchedBundle & Readonly<{ kind: 'list' }>);

export async function fetchOpenLibraryBundle(input: Readonly<{
  query: MetadataQueryIdentity;
  signal: AbortSignal;
  get: OpenLibraryRawGet;
}>): Promise<OpenLibraryFetched> {
  if (input.signal.aborted) throw new OpenLibraryFailure('cancelled');
  const isbnMode = input.query.strategy === 'isbn';
  if (isbnMode && !input.query.normalizedIsbn13) return { kind: 'zero-get' };
  const fetchedAt = new Date().toISOString();
  let retention: OptionsRetentionEvidence = { storagePermissionVerified: true,
    permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 86_400_000).toISOString() };
  // U6 fix1 (F1): first TYPED policy value wins (constant per claim in
  // practice). Headers are never read for policy identity.
  let retentionPolicyVersion: number | null = null;
  let sequence = 0;
  const get = async (url: URL, stage: string) => {
    if (sequence >= 6) throw new OpenLibraryFailure('schema_invalid');
    const current = sequence++;
    try {
      const envelope = await input.get(url, stage, current);
      const bounded = boundOptionsRetentionEvidence(fetchedAt, retention, envelope.headers);
      retention = bounded;
      if (retentionPolicyVersion === null) {
        const carried: unknown = (envelope as { retentionPolicyVersion?: unknown }).retentionPolicyVersion;
        if (typeof carried === 'number' && Number.isSafeInteger(carried) && carried > 0) {
          retentionPolicyVersion = carried;
        }
      }
      return object(envelope.raw);
    } catch (error) {
      // O1 (U6, R2): bound retention from ACTUAL failed-response headers
      // BEFORE author-failure isolation, for both shared-fetch callers (v1
      // transport failures via OpenLibraryFailure, v2/port failures via
      // ProviderHttpError). A denial is sticky: later permissive responses
      // cannot reopen it (boundOptionsRetentionEvidence re-denies).
      const headers = error instanceof OpenLibraryFailure ? error.headers
        : error instanceof ProviderHttpError ? error.headers : null;
      if (headers !== null) {
        retention = boundOptionsRetentionEvidence(fetchedAt, retention, headers);
      }
      throw error;
    }
  };
  const search = new URL('https://openlibrary.org/search.json');
  search.searchParams.set('limit', '1'); search.searchParams.set('fields', isbnMode
    ? 'key,author_key,editions,editions.key,editions.isbn' : 'key,author_key');
  if (input.query.normalizedTitle) search.searchParams.set('title', input.query.normalizedTitle);
  if (input.query.normalizedAuthors.length) search.searchParams.set('author', input.query.normalizedAuthors.join(' '));
  if (!input.query.normalizedTitle && input.query.normalizedIsbn13) search.searchParams.set('isbn', input.query.normalizedIsbn13);
  const found = await get(search, 'search');
  if (!found || !Array.isArray(found.docs) || found.docs.length > 1) throw new OpenLibraryFailure('malformed_response');
  const key = object(found.docs[0])?.key;
  if (found.docs.length === 0) return { kind: 'no-list', fetchedAt, retention, retentionPolicyVersion };
  if (typeof key !== 'string' || !/^\/works\/OL[1-9][0-9]*W$/u.test(key)) throw new OpenLibraryFailure('malformed_response');
  // The work's author references, used only by editions that list no authors of their own.
  const workKeys = object(found.docs[0])?.author_key;
  const workAuthors = Array.isArray(workKeys) && workKeys.length <= 20
    && workKeys.every(value => typeof value === 'string' && /^OL[1-9][0-9]*A$/u.test(value))
    ? workKeys.map(value => '/authors/' + value) : [];
  let page: Record<string, unknown> | null;
  if (isbnMode) {
    const matches = object(object(found.docs[0])?.editions)?.docs;
    const matching = Array.isArray(matches) ? matches.find(value => {
      const entry = object(value);
      return typeof entry?.key === 'string' && /^\/books\/OL[1-9][0-9]*M$/u.test(entry.key)
        && Array.isArray(entry.isbn) && entry.isbn.some(value => typeof value === 'string'
          && normalizeIsbnClue(value).isbn13 === input.query.normalizedIsbn13);
    }) : null;
    if (!matching) return { kind: 'no-list', fetchedAt, retention, retentionPolicyVersion };
    page = { entries: [await get(new URL('https://openlibrary.org' + matching.key + '.json'), 'edition')] };
  } else {
    const editions = new URL('https://openlibrary.org' + key + '/editions.json');
    editions.searchParams.set('limit', '10');
    page = await get(editions, 'editions');
  }
  if (!page || !Array.isArray(page.entries) || page.entries.length > 10) throw new OpenLibraryFailure('malformed_response');
  const authors = new Map<string, string>();
  const keys = new Set<string>();
  // Resolve plausible identities first; the returned/displayed positions stay untouched.
  const safe = page.entries.filter(entry => hasSafeOpenLibraryFacts(entry, workAuthors));
  // Known-language identities first, then unknown-language ones, each in page order.
  const priority = (entry: unknown) => openLibraryIdentityPriority(entry, input.query, workAuthors);
  const preferred = [...safe.filter(entry => priority(entry) === 0), ...safe.filter(entry => priority(entry) === 1)];
  for (const entry of [...preferred, ...safe]) {
    const references = openLibraryRowAuthorKeys(entry, workAuthors);
    if (!references) continue;
    const needed = new Set(references);
    // Admit the whole row only when all unresolved names fit; never spend a slot on a partial row.
    if ([...needed].filter(key => !keys.has(key)).length > 4 - keys.size) continue;
    for (const key of needed) keys.add(key);
  }
  // Four unique author GETs at most. Rows needing unresolved authors remain unavailable.
  for (const key of keys) {
    try {
      const author = await get(new URL('https://openlibrary.org' + key + '.json'), 'author:' + key.slice(9));
      if (author?.key === key && typeof author.name === 'string' && author.name.length <= 256 && author.name.trim()) {
        authors.set(key, author.name);
      }
    } catch (error) {
      // Known nonretryable author-content failures affect dependent rows; transport/config/fence failures still stop.
      // S2: port failures (ProviderHttpError) isolate exactly like transport
      // failures with the same outcome/retryability, so v2 author handling
      // matches v1 and existing catches keep working.
      const outcome = error instanceof OpenLibraryFailure ? error.outcome
        : error instanceof ProviderHttpError ? error.outcome : null;
      const retryable = error instanceof OpenLibraryFailure ? error.retryable
        : error instanceof ProviderHttpError ? error.retryable : null;
      if ((error instanceof OpenLibraryFailure || error instanceof ProviderHttpError)
        && retryable === false && outcome !== null
        && ['no_acceptable_match', 'malformed_response', 'unsupported_content_type', 'response_too_large'].includes(outcome)) {
        continue;
      }
      throw error;
    }
  }
  return {
    kind: 'list', fetchedAt, retention, retentionPolicyVersion,
    entries: page.entries, workKey: key, workAuthors, authorNames: authors,
  };
}

// Shared list normalization (02c §5.1): identical rows, companions and
// explicit outcome for v1 explicit and v2 callers from the same bundle.
export function normalizeOpenLibraryBundle(
  bundle: OpenLibraryFetchedBundle,
  context: Readonly<{ correlationId: string; attemptId: string; query: MetadataQueryIdentity; adapterVersion?: '1.0.0' | '2.0.0' }>,
): Readonly<{
  rows: readonly StoredEditionRow[];
  companions: readonly CatalogueWriteCompanion[];
  outcome: 'coherent_match' | 'ambiguous_match' | 'no_acceptable_match';
}> {
  const rows = normalizeOpenLibraryRows(bundle.entries, bundle.authorNames, {
    correlationId: context.correlationId, attemptId: context.attemptId, fetchedAt: bundle.fetchedAt,
  }, context.query, bundle.workAuthors, context.adapterVersion ?? '1.0.0');
  const eligible = rows.filter(row => row.eligibility === 'eligible');
  const strong = eligible.some(row => row.metadata?.matchRationale === 'exact_validated_isbn');
  return {
    rows,
    companions: normalizeOpenLibraryCompanions(bundle.entries, rows, bundle.workKey),
    outcome: strong ? 'coherent_match' : eligible.length ? 'ambiguous_match' : 'no_acceptable_match',
  };
}
