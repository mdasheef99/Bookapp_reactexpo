import type { ProviderHostPolicy } from '../../contracts/providerReuse';
import type { ProviderOwnedValidation } from '../providerValidation';
import { GOOGLE_BOOKS_EDITION_HOST_POLICY } from './decoder';

// 02c §4.2 / M90: Google owns its record, book-link and cover grammars.
const RECORD = /^[A-Za-z0-9_-]{1,256}$/u;

const httpsUrl = (value: string): URL | null => {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    ? url : null;
};

const validBookUrl = (value: string, providerRecordId: string): boolean => {
  const url = httpsUrl(value);
  if (url === null || url.hostname !== 'books.google.com'
    || url.pathname !== '/books' || !url.search) return false;
  const ids = url.searchParams.getAll('id');
  return ids.length === 1 && ids[0] === providerRecordId;
};

const validCoverReference = (
  value: string | null,
  providerRecordId: string,
): boolean => {
  if (value === null) return true;
  const url = httpsUrl(value);
  if (url === null || url.hostname !== 'books.google.com') return false;
  const ids = url.searchParams.getAll('id');
  return ids.length <= 1 && (ids.length === 0 || ids[0] === providerRecordId);
};

export const GOOGLE_BOOKS_PROVIDER_VALIDATION: ProviderOwnedValidation = Object.freeze({
  adapterKey: 'google_books',
  adapterVersion: '1.0.0',
  validationContract: 'google-books-v1',
  hostPolicyVersion: GOOGLE_BOOKS_EDITION_HOST_POLICY.policyVersion,
  hostPolicy: GOOGLE_BOOKS_EDITION_HOST_POLICY as ProviderHostPolicy,
  validProviderRecordId: (value: string) => RECORD.test(value),
  validBookUrl,
  validCoverReference,
  validCompanionRecord: (providerRecordId: string, workExternalId: string | null) =>
    RECORD.test(providerRecordId) && workExternalId === null,
});
