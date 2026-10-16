import { normalizeBibliographicText, type MetadataQueryIdentity } from './queryIdentity';

// Owner decisions 2026-10-13/16; picker §4.1 / DOC-3 §5.2.1: explicit choices only.
// Comparison keys never rewrite catalogue titles/authors or the query identity, and
// automatic ranking stays exact. Migration M76 mirrors these rules in SQL.
type EditionText = Readonly<{ title: string; language: string }>;
const baseLanguage = (language: string) => language.split('-')[0];
// Only Latin combining accents (U+0300-U+036F); other scripts keep their marks.
const foldAccents = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/gu, '');
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

// Every supplied author must match. A single-word supplied surname needs identical title keys.
export function explicitEditionAuthorsMatch(query: MetadataQueryIdentity,
  edition: EditionText & Readonly<{ authors: readonly string[] }>): boolean {
  const supplied = edition.authors.map(explicitEditionAuthorKey);
  const surnames = supplied.map(author => { const words = author.split(' '); return words[words.length - 1]; });
  const surnameAllowed = !!query.normalizedTitle && sameTitleKey(query, edition);
  return query.normalizedAuthors.every(author => {
    const key = explicitEditionAuthorKey(author);
    if (!key) return false;
    if (supplied.includes(key)) return true;
    return surnameAllowed && !key.includes(' ') && [...key].length >= 2 && surnames.includes(key);
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
