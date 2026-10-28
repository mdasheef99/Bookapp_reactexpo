// 02b §§3.1/3.2/11 AC7-2d/2f/11/21. The adapter and normalizer are real.
import fs from 'node:fs';
import path from 'node:path';
import { buildMetadataQueryIdentity } from '../_shared/imageInventory/metadata/queryIdentity';
import { OpenLibraryEditionOptionsAdapter } from '../_shared/imageInventory/metadata/openLibrary/adapter';
import { catalogueWriteRecording, malformedCatalogueFields } from './fixtures/phase9/catalogueWrite';

const contractPath = path.join(process.cwd(), 'supabase/functions/_shared/imageInventory/contracts/catalogueWrite.ts');
function loadModule() {
  expect(fs.existsSync(contractPath) ? null : `companion contract module missing: ${contractPath}`).toBeNull();
  return require(contractPath);
}
const lookupId = '00000000-0000-4000-8000-000000000101';
const attemptId = '00000000-0000-4000-8000-000000000102';
const query = buildMetadataQueryIdentity({ strategy:'bibliographic', title:'The Fixture Book',
  authors:['Fixture Author'], isbnClue:null, language:'en', editionClues:[] });
function subject(entries: unknown[] = catalogueWriteRecording.editions.entries) {
  const requests: string[] = [];
  const adapter = new OpenLibraryEditionOptionsAdapter({ timeoutMs:1000, maxResponseBytes:64000,
    fetcher:async address => {
      const pathname = new URL(String(address)).pathname; requests.push(pathname);
      const value = pathname === '/search.json' ? catalogueWriteRecording.search
        : pathname === '/works/OL1W/editions.json' ? { entries }
        : pathname === '/authors/OL1A.json' ? catalogueWriteRecording.author : null;
      return new Response(JSON.stringify(value), { status:value ? 200 : 404,
        headers:{ 'content-type':'application/json' } });
    } });
  return { requests, run:() => adapter.lookupEditionOptions({ query, correlationId:lookupId,
    attemptId, signal:new AbortController().signal }) };
}
function companions(result: unknown): any[] {
  const value = (result as { catalogueCompanions?: unknown }).catalogueCompanions;
  expect({ catalogueCompanions:value }).toEqual({ catalogueCompanions:expect.any(Array) });
  return value as any[];
}
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable:true, value:require('node:crypto').webcrypto,
  });
});

test('[baseline] recorded six-edition response reaches the existing adapter with four eligible positions', async () => {
  expect(JSON.parse(JSON.stringify(catalogueWriteRecording))).toEqual(catalogueWriteRecording);
  const f = subject(), result = await f.run();
  expect(f.requests).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
  expect(result.rows.map(row => row.eligibility)).toEqual([
    'eligible','eligible','eligible','eligible','ineligible','unavailable',
  ]);
  for (const row of result.rows.filter(row => row.metadata)) {
    expect(row.metadata).toMatchObject({correlationId:lookupId,attemptId});
  }
  expect(new Set(catalogueWriteRecording.editions.entries.map(e => e.oclc_numbers[0])).size).toBe(6);
  expect(new Set(catalogueWriteRecording.editions.entries.map(e => e.lccn[0])).size).toBe(6);
  expect(result.rows[0].metadata?.coverReference).toBe('https://covers.openlibrary.org/b/id/123-M.jpg');
});

test('AC7-2d: the strict companion contract module exists at its specified path', () => {
  expect(loadModule()).toBeDefined();
});

test('AC7-2d/2f: adapter carries each edition binding, original work and own scalar facts', async () => {
  const result = await subject().run(), writes = companions(result);
  expect(writes).toHaveLength(5);
  for (const [index,row] of result.rows.slice(0,5).entries()) {
    const item = writes.find(value => value.optionId === row.optionId);
    const recorded = catalogueWriteRecording.editions.entries[index];
    expect(item).toEqual({ version:'psr-catalogue-write-v1', optionId:row.optionId,
      adapterKey:'open_library', adapterVersion:row.metadata!.adapterVersion,
      normalizerVersion:row.metadata!.normalizerVersion, lookupId, attemptId,
      providerRecordId:row.metadata!.providerRecordId, workExternalId:'OL1W',
      fetchedAt:result.fetchedAt, oclc:recorded.oclc_numbers[0], lccn:recorded.lccn[0] });
  }
  const row = result.rows[0];
  expect(writes.some(value => value.optionId === result.rows[5].optionId)).toBe(false);
  expect(Object.keys(row).sort()).toEqual(['eligibility','googleBooksUrl','metadata','optionId','ordinal']);
  expect(row.metadata).not.toHaveProperty('oclc');
  expect(row.metadata).not.toHaveProperty('workExternalId');
});

test('AC7-2f: repeated identical trimmed scalars survive without losing zeros or case', async () => {
  const entries = [{ ...catalogueWriteRecording.editions.entries[0],
    oclc_numbers:[' 001234 ', '001234'], lccn:[' n 79021164 ', 'n 79021164'] }];
  const result = await subject(entries).run(), item = companions(result)[0];
  expect(result.rows[0].eligibility).toBe('eligible');
  expect(item).toMatchObject({ oclc:'001234', lccn:'n 79021164' });
});

test.each(malformedCatalogueFields)('AC7-2f: $label becomes null without invalidating its option', async variant => {
  const entries = [{ ...catalogueWriteRecording.editions.entries[0], [variant.field]:variant.value }];
  const result = await subject(entries).run(), item = companions(result)[0];
  expect(result.rows[0].eligibility).toBe('eligible');
  expect(item[variant.result]).toBeNull();
  expect(item[variant.result === 'oclc' ? 'lccn' : 'oclc']).toBe(variant.result === 'oclc' ? 'n 79021164' : '001234');
});

test('AC7-21: generic catalogue modules do not import or select the Open Library adapter', () => {
  loadModule();
  const root = path.join(process.cwd(),'supabase/functions/_shared/imageInventory');
  const walk = (directory:string):string[] => fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const file = path.join(directory,entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
  const modules = walk(root).filter(file => /catalogue/i.test(path.basename(file))
    && !/[\\/]openLibrary[\\/]/i.test(file) && file.endsWith('.ts'));
  expect(modules).toContain(contractPath);
  for (const file of modules) {
    const source = fs.readFileSync(file,'utf8');
    expect(source).not.toMatch(/(?:from\s*|import\s*\(|require\s*\()\s*['"][^'"]*openLibrary/i);
    expect(source).not.toMatch(/adapterKey\s*={2,3}\s*['"]open_library['"]/);
  }
});
