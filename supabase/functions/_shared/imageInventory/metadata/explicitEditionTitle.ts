import { normalizeBibliographicText, type MetadataQueryIdentity } from './queryIdentity';

// Owner decisions 2026-10-13/16; picker §4.1 / DOC-3 §5.2.1: explicit choices only.
// Comparison keys never rewrite catalogue titles/authors or the query identity, and
// automatic ranking stays exact. Migration M76 enforces these rules in SQL; M76 is deliberately
// a superset here (it still folds marks on any base letter, admits comma-form and joined-initial
// surnames), so every worker-eligible row passes completion until a parity migration narrows it.
type EditionText = Readonly<{ title: string; language: string }>;
const baseLanguage = (language: string) => language.split('-')[0];
// Only accents on Latin letters (a-z then U+0300-U+036F); Cyrillic, Greek and other scripts keep marks.
const foldAccents = (value: string) => value.normalize('NFD').replace(/([a-z])[\u0300-\u036f]+/gu, '$1');
const bothEnglish = (query: MetadataQueryIdentity, edition: EditionText) =>
  baseLanguage(query.normalizedLanguage) === 'en' && baseLanguage(edition.language) === 'en';

export function explicitEditionTitleKey(value: string, english: boolean): string {
  const key = foldAccents(normalizeBibliographicText(value));
  return english ? key.replace(/&/gu, ' and ').replace(/\s+/gu, ' ').trim() : key;
}

export function explicitEditionAuthorKey(value: string): string {
  const words = foldAccents(normalizeBibliographicText(value)).replace(/\./gu, ' ')
    .split(/\s+/u).filter(Boolean);
  const out: string[] = [];
  let initials = '';
  for (const word of words) {
    if ([...word].length === 1) { initials += word; continue; }
    if (initials) { out.push(initials); initials = ''; }
    out.push(word);
  }
  if (initials) out.push(initials);
  return out.join(' ');
}

function sameTitleKey(query: MetadataQueryIdentity, edition: EditionText): boolean {
  const english = bothEnglish(query, edition);
  return explicitEditionTitleKey(query.normalizedTitle, english) === explicitEditionTitleKey(edition.title, english);
}

export function explicitEditionTitleMatches(query: MetadataQueryIdentity, edition: EditionText): boolean {
  if (!query.normalizedTitle || sameTitleKey(query, edition)) return true;
  if (!bothEnglish(query, edition)) return false;
  const observed = explicitEditionTitleKey(query.normalizedTitle, true).replace(/^the /u, '');
  return observed.length > 0 && observed === explicitEditionTitleKey(edition.title, true).replace(/^the /u, '');
}

// A surname is one supplied word of two or more letters, never joined initials ("J. O.").
function isSingleSurname(author: string): boolean {
  const words = foldAccents(normalizeBibliographicText(author)).replace(/\./gu, ' ').split(/\s+/u).filter(Boolean);
  return words.length === 1 && [...words[0]].length >= 2;
}

// Every supplied author must match. A single-word supplied surname needs identical title keys and
// matches only the last word of an uninverted provider name ("Smith, John" never yields "john").
export function explicitEditionAuthorsMatch(query: MetadataQueryIdentity,
  edition: EditionText & Readonly<{ authors: readonly string[] }>): boolean {
  const supplied = edition.authors.map(explicitEditionAuthorKey);
  const surnames = edition.authors.filter(author => !author.includes(',')).map(author => {
    const words = explicitEditionAuthorKey(author).split(' ');
    return words[words.length - 1];
  });
  const surnameAllowed = !!query.normalizedTitle && sameTitleKey(query, edition);
  return query.normalizedAuthors.every(author => {
    const key = explicitEditionAuthorKey(author);
    if (!key) return false;
    if (supplied.includes(key)) return true;
    return surnameAllowed && isSingleSurname(author) && surnames.includes(key);
  });
}

// An unknown result language is compatible only after a complete known-language text match.
export function explicitEditionLanguageMatches(query: MetadataQueryIdentity, language: string,
  exactIsbn: boolean, textMatches: boolean): boolean {
  if (baseLanguage(language) === baseLanguage(query.normalizedLanguage)) return true;
  if (exactIsbn && query.normalizedLanguage === 'und') return true;
  return baseLanguage(language) === 'und' && query.normalizedLanguage !== 'und' && textMatches
    && !!query.normalizedTitle && query.normalizedAuthors.length > 0;
}
