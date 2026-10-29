// 02b sections 3.1/3.2/9, AC7-2d: real worker and RPC boundary; no partial publication.
import { catalogueWriteWorkerFixture } from './fixtures/phase9/catalogueWrite';
import { parseCatalogueCompanions, parseCatalogueWriteCompanion } from '../_shared/imageInventory/contracts/catalogueWrite';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});

const cases: Array<[string, (r: any) => void]> = [
  ['11 options', r => {
    const row = r.rows[0], companion = r.catalogueCompanions[0];
    r.rows = Array.from({ length: 11 }, (_, ordinal) => ({ ...row, ordinal, optionId: crypto.randomUUID() }));
    r.catalogueCompanions = r.rows.map((x: any) => ({ ...companion, optionId: x.optionId }));
  }],
  ['over 32 KiB', r => { r.catalogueCompanions[0].workExternalId = '界'.repeat(12000); }],
  ['duplicate optionId', r => { r.catalogueCompanions.push({ ...r.catalogueCompanions[0] }); }],
  ['null metadata row', r => { r.catalogueCompanions[0].optionId = r.rows.find((x: any) => x.metadata === null).optionId; }],
  ['wrong attemptId', r => { r.catalogueCompanions[0].attemptId = '00000000-0000-4000-8000-000000000999'; }],
  ['wrong version', r => { r.catalogueCompanions[0].version = 'psr-catalogue-write-v2'; }],
  ['wrong recordId', r => { r.catalogueCompanions[0].providerRecordId = 'OL999M'; }],
];

test.each(cases)('refuses %s before completion, preserving prior saved state', async (_label, mutate) => {
  const f = catalogueWriteWorkerFixture();
  const lookup = f.adapter.lookupEditionOptions.bind(f.adapter);
  f.adapter.lookupEditionOptions = async input => {
    const result: any = structuredClone(await lookup(input));
    mutate(result);
    return result;
  };
  const priorSelection = structuredClone([...f.fixture.selections]);
  const result = await f.run();
  expect(result.results).toEqual([{ outcome: 'manual_metadata_required' }]);
  expect(f.urls).toHaveLength(3);
  expect(f.completions).toEqual([]);
  expect(f.committedReceipt()).toBeNull();
  expect([...f.fixture.selections]).toEqual(priorSelection);
});

// 02b section 3.1: bounded Unicode input is valid before an oversized field pushes the envelope over 32 KiB.
test('refuses a >32 KiB Unicode envelope with an overflowing field', () => {
  const version = String.fromCharCode(0x754c).repeat(128), id = String.fromCharCode(0x754c).repeat(256);
  const lookupId = '10000000-0000-4000-8000-000000000001', attemptId = '10000000-0000-4000-8000-000000000002';
  const companions = Array.from({ length: 10 }, () => ({ version:'psr-catalogue-write-v1', optionId:crypto.randomUUID(),
    adapterKey:'open_library', adapterVersion:version, normalizerVersion:version, lookupId, attemptId,
    providerRecordId:id, workExternalId:id, fetchedAt:'2026-10-28T00:00:00Z', oclc:'001234', lccn:'n 79021164' }));
  for (const companion of companions) expect(parseCatalogueWriteCompanion(companion)).toMatchObject(companion);
  const oversized = companions.map(c => ({ ...c, workExternalId: id.repeat(2) }));
  expect(Buffer.byteLength(JSON.stringify(oversized),'utf8')).toBeGreaterThan(32 * 1024);
  const rows = companions.map(c => ({ optionId:c.optionId, eligibility:'eligible', metadata:{
    adapterKey:c.adapterKey, adapterVersion:c.adapterVersion, normalizerVersion:c.normalizerVersion,
    correlationId:lookupId, attemptId, providerRecordId:id, fetchedAt:c.fetchedAt } }));
  const scope = { rows, lookupId, attemptId, sourceFetchedAt:'2026-10-28T00:00:00Z' } as any;
  expect(parseCatalogueCompanions(companions,scope)).toHaveLength(10);
  expect(() => parseCatalogueCompanions(oversized,scope)).toThrow('P9_CATALOGUE_COMPANIONS_INVALID');
});
