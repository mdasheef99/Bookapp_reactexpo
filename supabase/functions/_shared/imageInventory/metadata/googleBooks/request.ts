import { MetadataQueryIdentity } from '../queryIdentity';

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
export const GOOGLE_BOOKS_RESULT_LIMIT = 10;

export type GoogleBooksRequest = Readonly<{
  url: URL;
  safeUrl: string;
}>;

export function buildGoogleBooksRequest(
  query: MetadataQueryIdentity,
  apiKey: string,
): GoogleBooksRequest {
  if (!apiKey) throw new Error('P9_METADATA_CONFIGURATION_UNAVAILABLE');
  const url = new URL(ENDPOINT);
  const bibliographicTerms = [
    query.normalizedTitle && `intitle:${query.normalizedTitle}`,
    query.normalizedAuthors[0] && `inauthor:${query.normalizedAuthors[0]}`,
  ].filter(Boolean).join(' ');
  const terms = bibliographicTerms
    || (query.normalizedIsbn13 ? `isbn:${query.normalizedIsbn13}` : '');
  if (!terms) throw new Error('P9_METADATA_INVALID_QUERY');
  url.searchParams.set('q', terms);
  url.searchParams.set('maxResults', String(GOOGLE_BOOKS_RESULT_LIMIT));
  url.searchParams.set('orderBy', 'relevance');
  url.searchParams.set('printType', 'books');
  url.searchParams.set('projection', 'full');
  url.searchParams.set('startIndex', '0');
  url.searchParams.set('key', apiKey);
  const safe = new URL(url);
  safe.searchParams.delete('key');
  return Object.freeze({ url, safeUrl: safe.toString() });
}
