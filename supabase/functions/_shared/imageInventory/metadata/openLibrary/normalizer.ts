import { parseNormalizedMetadataEdition, MetadataEdition } from '../../contracts/metadata';
import type { StoredEditionRow } from '../../contracts/ownerEditionPicker';
import { normalizeIsbnClue, validateIsbnPair } from '../../domain/isbn';
import { boundedInteger, canonicalBcp47, optionalString, requiredString } from '../../domain/validation';
import { PHASE9_LIMITS } from '../../contracts/registers';
import { PHASE9_CONTRACT_VERSION, PHASE9_METADATA_SCHEMA_VERSION } from '../../contracts/versions';
import { evaluateEditionOption, annotateEditionRows } from '../googleBooks/editionOptions';
import type { MetadataQueryIdentity } from '../queryIdentity';
import { explicitEditionLanguageMatches, explicitEditionTitleMatches } from '../explicitEditionTitle';

export const OPEN_LIBRARY_HOST_POLICY = Object.freeze({
  adapterKey: 'open_library', policyVersion: 'open-library-hosts-v1',
  approvedCoverHosts: Object.freeze(['covers.openlibrary.org']),
});
export const OPEN_LIBRARY_ADAPTER_VERSION = '1.0.0';
export const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
export const authorKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\/authors\/OL[1-9][0-9]*A$/u.test(value);
const languages: Readonly<Record<string,string>> = {
  eng:'en', fre:'fr', fra:'fr', ger:'de', deu:'de', spa:'es', ita:'it', por:'pt',
  dut:'nl', nld:'nl', hin:'hi', urd:'ur', ben:'bn', tam:'ta', tel:'te', mar:'mr',
  mal:'ml', kan:'kn', guj:'gu', pan:'pa', ori:'or', san:'sa', ara:'ar', heb:'he',
  chi:'zh', zho:'zh', jpn:'ja', kor:'ko', rus:'ru', pol:'pl', tur:'tr',
};
function isbn(value: unknown, kind: 'isbn10' | 'isbn13'): string | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > 16) throw new Error('P9_METADATA_SCHEMA_INVALID');
  const normalized = value.map(entry => {
    if (typeof entry !== 'string') throw new Error('P9_METADATA_SCHEMA_INVALID');
    const clue = normalizeIsbnClue(entry);
    if (clue.status !== 'valid' || (kind === 'isbn10' && !clue.isbn10)
      || (kind === 'isbn13' && clue.isbn10)) throw new Error('P9_METADATA_SCHEMA_INVALID');
    return clue[kind];
  });
  const values = new Set(normalized);
  if (values.size > 1) throw new Error('P9_METADATA_SCHEMA_INVALID');
  return normalized[0] ?? null;
}
function editionLanguage(record: Record<string,unknown>): string {
  if (record.languages !== undefined && !Array.isArray(record.languages)) throw new Error('P9_METADATA_SCHEMA_INVALID');
  const rows = (record.languages as unknown[] | undefined) ?? [];
  if (rows.length > 1) throw new Error('P9_METADATA_SCHEMA_INVALID'); // Do not guess multilingual editions.
  if (rows.length === 0) return 'und';
  const key = object(rows[0])?.key;
  if (typeof key !== 'string' || !/^\/languages\/[a-z]{3}$/u.test(key)) {
    throw new Error('P9_METADATA_SCHEMA_INVALID');
  }
  return languages[key.slice(11)] ?? 'und';
}
// Picker §13.14: allocation and final decoding share the factual contract, without invented author names.
// Owner decision 2026-10-17: an edition with no author references uses its work's author references
// (from the same search result); an edition that lists its own authors always uses them.
export type OpenLibraryWorkAuthors = readonly string[];
function ownFacts(value: unknown, workAuthors: OpenLibraryWorkAuthors = []) {
  const record = object(value);
  if (!record || typeof record.key !== 'string' || !/^\/books\/OL[1-9][0-9]*M$/u.test(record.key)) return null;
  const inherited = (record.authors === undefined || (Array.isArray(record.authors) && record.authors.length === 0))
    && workAuthors.length >= 1 && workAuthors.length <= 20 && workAuthors.every(authorKey);
  if (!inherited && (!Array.isArray(record.authors) || record.authors.length < 1 || record.authors.length > 20)) return null;
  try {
    const authorKeys = inherited ? [...workAuthors] : (record.authors as unknown[]).map(reference => {
      const key = object(reference)?.key;
      if (!authorKey(key)) throw new Error('P9_METADATA_SCHEMA_INVALID');
      return key;
    });
    if (record.publishers !== undefined && !Array.isArray(record.publishers)) return null;
    const publishers = (record.publishers as unknown[] | undefined) ?? [];
    if (publishers.length > 16 || publishers.some(value => typeof value !== 'string')) return null;
    const covers = Array.isArray(record.covers) ? record.covers : [];
    const cover = covers.find(value => Number.isSafeInteger(value) && Number(value) > 0);
    return { authorKeys, facts: {
      providerRecordId: requiredString(record.key.slice(7),'provider_record_id',256,{activeContent:false}),
      title: requiredString(record.title,'title',PHASE9_LIMITS.titleChars),
      subtitle: optionalString(record.subtitle,'subtitle',PHASE9_LIMITS.subtitleChars),
      ...validateIsbnPair(isbn(record.isbn_10,'isbn10'),isbn(record.isbn_13,'isbn13')),
      publisher: optionalString(publishers[0],'publisher',256),
      publishedDate: optionalString(record.publish_date,'published_date',32),
      language: canonicalBcp47(editionLanguage(record),'language'),
      editionStatement: optionalString(record.edition_name,'edition_statement',256),
      format: optionalString(record.physical_format,'format',128),
      pageCount: record.number_of_pages === undefined || record.number_of_pages === null ? null
        : boundedInteger(record.number_of_pages,'page_count',1,PHASE9_LIMITS.pageCount),
      coverReference: cover ? 'https://covers.openlibrary.org/b/id/' + cover + '-M.jpg' : null,
    } };
  } catch { return null; }
}
export function hasSafeOpenLibraryFacts(value: unknown, workAuthors: OpenLibraryWorkAuthors = []): boolean {
  return ownFacts(value, workAuthors) !== null;
}
// Author references that establish this row's identity (its own, or its work's when it has none).
export function openLibraryRowAuthorKeys(value: unknown,
  workAuthors: OpenLibraryWorkAuthors = []): readonly string[] | null {
  return ownFacts(value, workAuthors)?.authorKeys ?? null;
}
// Picker §§4.1/13.14: prioritize bounded own-author reads, never establish eligibility here.
export function mayMatchOpenLibraryIdentity(value: unknown, query: MetadataQueryIdentity,
  workAuthors: OpenLibraryWorkAuthors = []): boolean {
  return openLibraryIdentityPriority(value, query, workAuthors) !== null;
}
// 0 = plausible known-language identity, 1 = plausible only via an unknown (und) language.
// Allocation serves 0 before 1 so und rows never starve a known-language row's author budget.
export function openLibraryIdentityPriority(value: unknown, query: MetadataQueryIdentity,
  workAuthors: OpenLibraryWorkAuthors = []): 0 | 1 | null {
  const parsed = ownFacts(value, workAuthors);
  if (!parsed || new Set(parsed.authorKeys).size > 4) return null;
  const facts = parsed.facts;
  const exactIsbn = query.normalizedIsbn13 !== null && facts.isbn13 === query.normalizedIsbn13;
  // Authors resolve later, so an unknown language admits only a title-compatible text query here.
  const titleMatches = explicitEditionTitleMatches(query, facts);
  if (!titleMatches || !explicitEditionLanguageMatches(query, facts.language, exactIsbn, titleMatches)
    || !(exactIsbn || Boolean(query.normalizedTitle && query.normalizedAuthors.length))) return null;
  return explicitEditionLanguageMatches(query, facts.language, exactIsbn, false) ? 0 : 1;
}
function decode(value: unknown, authors: ReadonlyMap<string,string>, context: Readonly<{
  correlationId: string; attemptId: string; fetchedAt: string;
}>, workAuthors: OpenLibraryWorkAuthors): MetadataEdition | null {
  const parsed = ownFacts(value, workAuthors);
  if (!parsed) return null;
  try {
    // Only names resolved from this row's identity references (own, else its work's) establish identity.
    const names = parsed.authorKeys.map(key => {
      if (!authors.has(key)) throw new Error('P9_METADATA_SCHEMA_INVALID');
      return authors.get(key)!;
    });
    return parseNormalizedMetadataEdition({
      contractVersion: PHASE9_CONTRACT_VERSION, schemaVersion: PHASE9_METADATA_SCHEMA_VERSION,
      adapterKey: 'open_library', adapterVersion: OPEN_LIBRARY_ADAPTER_VERSION,
      normalizerVersion: 'p9-bibliographic-normalizer-v1', ...context, ...parsed.facts,
      authors: names, description: null, script: null, series: null, volume: null, categories: [],
      matchRationale: 'confirmation_required_text_evidence', confidence: 0,
    }, OPEN_LIBRARY_HOST_POLICY);
  } catch { return null; }
}
export function normalizeOpenLibraryRows(entries: readonly unknown[], authors: ReadonlyMap<string,string>,
  context: Readonly<{ correlationId:string; attemptId:string; fetchedAt:string }>,
  query: MetadataQueryIdentity, workAuthors: OpenLibraryWorkAuthors = []): readonly StoredEditionRow[] {
  if (entries.length > 10) throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  const rows = entries.map((entry,ordinal): StoredEditionRow => {
    const metadata = decode(entry,authors,context,workAuthors);
    return { optionId: globalThis.crypto.randomUUID(), ordinal,
      googleBooksUrl: metadata ? 'https://openlibrary.org/books/' + metadata.providerRecordId : null,
      eligibility: metadata ? evaluateEditionOption(query,metadata,OPEN_LIBRARY_HOST_POLICY) : 'unavailable', metadata };
  });
  return annotateEditionRows(rows,query);
}
