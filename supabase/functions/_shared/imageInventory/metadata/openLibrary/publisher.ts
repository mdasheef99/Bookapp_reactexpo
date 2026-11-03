import type { MetadataEdition } from '../../contracts/metadata';
import type { MetadataQueryIdentity } from '../queryIdentity';
import { normalizeBibliographicText } from '../queryIdentity';
import type { StoredEditionRow } from '../../contracts/ownerEditionPicker';

// Publisher signal and strict automatic rank (02c §5.2, OL v2 only).
// The signal compares the actual edition publisher against the clue
// separately; it only breaks an existing secondary-score tie, never beats
// stronger identity/secondary evidence and never changes the eligible set.

// Bounds from §5.2: inputs above any bound yield an empty set (signal 0);
// bounds apply after first-seen-order deduplication, never by truncating
// into a match.
const MAX_PUBLISHER_CHARS = 256;
const MAX_PUBLISHER_TOKENS = 32;
const MAX_PUBLISHER_TOKEN_CHARS = 64;

export function normalizePublisherTokenSet(value: string | null): readonly string[] {
  if (value === null) return [];
  if (value.length > MAX_PUBLISHER_CHARS) return [];
  // C4: SDD §5.2 admits Unicode letters/numbers only (no \p{M} marks).
  const tokens = value.normalize('NFKC').toLocaleLowerCase('und')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/gu).filter(Boolean);
  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
  }
  if (unique.length > MAX_PUBLISHER_TOKENS
    || unique.some(token => token.length > MAX_PUBLISHER_TOKEN_CHARS)) return [];
  return unique;
}

// signal=1 iff both sets are nonempty, the intersection is nonempty and
// 2*|A∩B| >= min(|A|,|B|), else 0. No fuzzy spelling, synonyms or stop words.
export function publisherSignal(
  clue: string | null,
  actual: string | null | undefined,
): 0 | 1 {
  const first = normalizePublisherTokenSet(clue);
  const second = normalizePublisherTokenSet(actual ?? null);
  if (first.length === 0 || second.length === 0) return 0;
  const inSecond = new Set(second);
  const overlap = first.filter(token => inSecond.has(token)).length;
  return 2 * overlap >= Math.min(first.length, second.length) ? 1 : 0;
}

// C5 + D1 (Owner decision 2026-11-03, "tie-break only"): production
// passes exactly [publisherClue] as editionClues
// (runtime/metadataGatewayContext.ts:135), and the identity sorts/dedupes
// (queryIdentity.ts:54-56). A singleton normalized clue IS the publisher
// clue: it is excluded from edition scoring and acts only through the
// publisher signal, and only on a secondary-score tie. Zero clues: no
// signal. More than one: no clue is identified as the publisher (signal 0)
// and every clue keeps edition scoring. Google's ranker is unchanged.
export function scoringEditionClues(query: MetadataQueryIdentity): readonly string[] {
  return query.normalizedEditionClues.length === 1 ? [] : query.normalizedEditionClues;
}

export function publisherClueOf(query: MetadataQueryIdentity): string | null {
  return query.normalizedEditionClues.length === 1 ? query.normalizedEditionClues[0] : null;
}

// Score components, identical predicates/tokens/order to
// googleBooks/ranking.ts:13-45 (textual evidence, clue overlap) and :62-64
// (secondary sum). The edition-clue list is the caller-supplied (already
// D1/C5-filtered) one; the default is the production scoring path.
function scoreComponents(
  query: MetadataQueryIdentity,
  edition: MetadataEdition,
  editionClues: readonly string[],
): Readonly<{ exactIsbn: boolean; languageCompatible: boolean; editionClueOverlap: boolean }> {
  const exactIsbn = query.normalizedIsbn13 !== null && edition.isbn13 === query.normalizedIsbn13;
  const languageCompatible = edition.language.split('-')[0] === query.normalizedLanguage.split('-')[0];
  const providerClues = [
    edition.editionStatement,
    edition.series,
    edition.volume,
    edition.format,
  ].filter((value): value is string => value !== null).map(normalizeBibliographicText);
  const editionClueOverlap = editionClues.some(clue => providerClues.includes(clue));
  return { exactIsbn, languageCompatible, editionClueOverlap };
}

// Secondary score, identical components to googleBooks/ranking.ts:62-64
// (exact ISBN + language compatibility + edition-clue overlap).
export function secondaryScoreOf(
  query: MetadataQueryIdentity,
  edition: MetadataEdition,
  editionClues: readonly string[] = scoringEditionClues(query),
): number {
  const components = scoreComponents(query, edition, editionClues);
  return Number(components.exactIsbn)
    + Number(components.languageCompatible)
    + Number(components.editionClueOverlap);
}

// C3: truthful automatic evidence from the existing vocabulary, as the
// Google ranker builds it (ranking.ts:54-61): textual evidence, then
// exact_validated_isbn, then edition_clue_overlap. Never new values.
export function automaticEvidence(
  query: MetadataQueryIdentity,
  edition: MetadataEdition,
  editionClues: readonly string[] = scoringEditionClues(query),
): readonly string[] {
  const evidence: string[] = [];
  if (query.normalizedTitle && normalizeBibliographicText(edition.title) === query.normalizedTitle) {
    evidence.push('exact_original_title');
  }
  const editionAuthors = edition.authors.map(normalizeBibliographicText);
  if (query.normalizedAuthors.length > 0
    && query.normalizedAuthors.every((author) => editionAuthors.includes(author))) {
    evidence.push('author_overlap');
  }
  const components = scoreComponents(query, edition, editionClues);
  if (components.languageCompatible) evidence.push('language_compatible');
  if (components.exactIsbn) evidence.push('exact_validated_isbn');
  if (components.editionClueOverlap) evidence.push('edition_clue_overlap');
  return evidence;
}

// Strict automatic rank over already-eligible rows: highest secondary score
// wins; the publisher signal breaks only an existing secondary-score tie
// (equal secondary + equal signal = ambiguous). The eligible set and list
// size are never changed here.
export function rankAutomaticRows(
  rows: readonly StoredEditionRow[],
  query: MetadataQueryIdentity,
): Readonly<{
  outcome: 'coherent_match' | 'ambiguous_match' | 'no_acceptable_match';
  selected: MetadataEdition | null;
  evidence: readonly string[];
}> {
  const eligible = rows.filter((row): row is StoredEditionRow & { metadata: MetadataEdition } =>
    row.eligibility === 'eligible' && row.metadata !== null);
  if (eligible.length === 0) {
    return { outcome: 'no_acceptable_match', selected: null, evidence: [] };
  }
  const scoring = scoringEditionClues(query);
  const clue = publisherClueOf(query);
  const scored = eligible.map(row => ({
    metadata: row.metadata,
    secondary: secondaryScoreOf(query, row.metadata, scoring),
    signal: publisherSignal(clue, row.metadata.publisher),
  })).sort((left, right) => right.secondary - left.secondary
    || right.signal - left.signal
    || left.metadata.providerRecordId.localeCompare(right.metadata.providerRecordId));
  const best = scored[0];
  const tied = scored.filter(entry =>
    entry.secondary === best.secondary && entry.signal === best.signal);
  if (tied.length > 1) {
    return { outcome: 'ambiguous_match', selected: null, evidence: [] };
  }
  // Owner-delegated C3 residual guard: a unique winner with empty truthful
  // evidence (e.g. fuzzy-title/middle-initial match with unknown language)
  // would fail result validation as coherent (providerAdapter.ts:129), so
  // return the existing tie shape instead, with rows/list unchanged. No new
  // evidence values, no eligibility change.
  const evidence = automaticEvidence(query, best.metadata, scoring);
  if (evidence.length === 0) {
    return { outcome: 'ambiguous_match', selected: null, evidence: [] };
  }
  return {
    outcome: 'coherent_match',
    selected: best.metadata,
    evidence,
  };
}
