import { CATALOGUE_WRITE_VERSION, isCatalogueScalar } from '../../contracts/catalogueWrite';
import type { CatalogueWriteCompanion } from '../../contracts/catalogueWrite';
import type { StoredEditionRow } from '../../contracts/ownerEditionPicker';
import { object } from './normalizer';

// 02b section 3.1: only this edition's bounded arrays, preserving zeros and LCCN case.
function singleScalar(value: unknown, kind: 'oclc' | 'lccn'): string | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  const distinct = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || /[\u0000-\u001F\u007F-\u009F]/u.test(item)) return null;
    const scalar = item.trim();
    if (!isCatalogueScalar(scalar,kind)) return null;
    distinct.add(scalar);
  }
  return distinct.size === 1 ? [...distinct][0] : null;
}
function workReference(record: Record<string,unknown>, searchWorkKey: string): string | null {
  const searchId = /^\/works\/OL[1-9][0-9]*W$/u.test(searchWorkKey) ? searchWorkKey.slice(7) : null;
  if (record.works === undefined) return searchId && searchId.length <= 256 ? searchId : null;
  if (!Array.isArray(record.works) || record.works.length !== 1) return null;
  const key = object(record.works[0])?.key;
  if (typeof key !== 'string' || !/^\/works\/OL[1-9][0-9]*W$/u.test(key)) return null;
  const ownId = key.slice(7);
  return ownId.length <= 256 && (!searchId || ownId === searchId) ? ownId : null;
}

// Preserve positions and author allocation; bind companion facts to the normalized edition ID.
export function normalizeOpenLibraryCompanions(entries: readonly unknown[], rows: readonly StoredEditionRow[],
  searchWorkKey: string): readonly CatalogueWriteCompanion[] {
  return rows.flatMap((row,index) => {
    const metadata = row.metadata, record = object(entries[index]);
    if (!metadata || row.eligibility === 'unavailable' || !record
      || record.key !== '/books/'+metadata.providerRecordId) return [];
    return [{
      version: CATALOGUE_WRITE_VERSION, optionId: row.optionId,
      adapterKey: metadata.adapterKey, adapterVersion: metadata.adapterVersion,
      normalizerVersion: metadata.normalizerVersion, lookupId: metadata.correlationId,
      attemptId: metadata.attemptId, providerRecordId: metadata.providerRecordId,
      workExternalId: workReference(record,searchWorkKey), fetchedAt: metadata.fetchedAt,
      oclc: singleScalar(record.oclc_numbers,'oclc'),
      lccn: singleScalar(record.lccn,'lccn'),
    }];
  });
}
