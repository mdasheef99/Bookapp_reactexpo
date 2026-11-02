import type { ProviderHostPolicy } from '../../contracts/providerReuse';
import type { ProviderOwnedValidation } from '../providerValidation';
import { OPEN_LIBRARY_HOST_POLICY } from './normalizer';

// 02c §4.2 / M90: Open Library owns its record, work, book-link and cover grammars.
const RECORD = /^OL[1-9][0-9]*M$/u;
const WORK = /^OL[1-9][0-9]*W$/u;
const COVER = /^https:\/\/covers\.openlibrary\.org\/b\/id\/[1-9][0-9]*-M\.jpg$/u;

const httpsUrl = (value: string): URL | null => {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    ? url : null;
};

const validBookUrl = (value: string, providerRecordId: string): boolean => {
  const url = httpsUrl(value);
  return url !== null && url.hostname === 'openlibrary.org'
    && !url.search && !url.hash
    && url.pathname === '/books/' + providerRecordId;
};

export const OPEN_LIBRARY_PROVIDER_VALIDATION: ProviderOwnedValidation = Object.freeze({
  adapterKey: 'open_library',
  adapterVersion: '1.0.0',
  validationContract: 'open-library-v1',
  hostPolicyVersion: OPEN_LIBRARY_HOST_POLICY.policyVersion,
  hostPolicy: OPEN_LIBRARY_HOST_POLICY as ProviderHostPolicy,
  validProviderRecordId: (value: string) => RECORD.test(value),
  validBookUrl,
  validCoverReference: (value: string | null) => value === null || COVER.test(value),
  validCompanionRecord: (providerRecordId: string, workExternalId: string | null) =>
    RECORD.test(providerRecordId)
    && (workExternalId === null || WORK.test(workExternalId)),
});
