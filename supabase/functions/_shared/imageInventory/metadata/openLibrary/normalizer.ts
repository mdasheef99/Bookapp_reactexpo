import { parseNormalizedMetadataEdition, MetadataEdition } from '../../contracts/metadata';
import type { StoredEditionRow } from '../../contracts/ownerEditionPicker';
import { normalizeIsbnClue, validateIsbnPair } from '../../domain/isbn';
import { boundedInteger, canonicalBcp47, optionalString, requiredString } from '../../domain/validation';
import { PHASE9_LIMITS } from '../../contracts/registers';
import { PHASE9_CONTRACT_VERSION, PHASE9_METADATA_SCHEMA_VERSION } from '../../contracts/versions';
import { evaluateEditionOption, annotateEditionRows } from '../googleBooks/editionOptions';
import { normalizeBibliographicText, MetadataQueryIdentity } from '../queryIdentity';

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
function ownFacts(value: unknown) {
  const record = object(value);
  if (!record || typeof record.key !== 'string' || !/^\/books\/OL[1-9][0-9]*M$/u.test(record.key)
    || !Array.isArray(record.authors) || record.authors.length < 1 || record.authors.length > 20) return null;
  try {
    const authorKeys = record.authors.map(reference => {
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
export function hasSafeOpenLibraryFacts(value: unknown): boolean {
  return ownFacts(value) !== null;
}
// Picker §§4.1/13.14: prioritize bounded own-author reads, never establish eligibility here.
export function mayMatchOpenLibraryIdentity(value: unknown, query: MetadataQueryIdentity): boolean {
  const parsed = ownFacts(value);
  if (!parsed || new Set(parsed.authorKeys).size > 4) return false;
  const facts = parsed.facts;
  const exactIsbn = query.normalizedIsbn13 !== null && facts.isbn13 === query.normalizedIsbn13;
  return (!query.normalizedTitle || normalizeBibliographicText(facts.title) === query.normalizedTitle)
    && (facts.language === query.normalizedLanguage.split('-')[0]
      || (exactIsbn && query.normalizedLanguage === 'und'))
    && (exactIsbn || Boolean(query.normalizedTitle && query.normalizedAuthors.length));
}
function decode(value: unknown, authors: ReadonlyMap<string,string>, context: Readonly<{
  correlationId: string; attemptId: string; fetchedAt: string;
}>): MetadataEdition | null {
  const parsed = ownFacts(value);
  if (!parsed) return null;
  try {
    // Only names resolved from this edition's own author references may establish identity.
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
  query: MetadataQueryIdentity): readonly StoredEditionRow[] {
  if (entries.length > 10) throw new Error('P9_METADATA_MALFORMED_RESPONSE');
  const rows = entries.map((entry,ordinal): StoredEditionRow => {
    const metadata = decode(entry,authors,context);
    return { optionId: globalThis.crypto.randomUUID(), ordinal,
      googleBooksUrl: metadata ? 'https://openlibrary.org/books/' + metadata.providerRecordId : null,
      eligibility: metadata ? evaluateEditionOption(query,metadata,OPEN_LIBRARY_HOST_POLICY) : 'unavailable', metadata };
  });
  return annotateEditionRows(rows,query);
}
