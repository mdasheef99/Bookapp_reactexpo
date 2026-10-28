// 02b §§3.2/5/7.1 AC7-2d/11/13/17/23: real adapter, worker and RPC boundary.
import { createMetadataEditionOptionsBoundary } from '../_shared/imageInventory/runtime/metadataEditionOptionsRpc';
import { runMetadataWorkerBatch } from '../../../workers/phase9-metadata-worker';
import { editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { catalogueWriteWorkerFixture } from './fixtures/phase9/catalogueWrite';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis,'crypto',{
    configurable:true,value:require('node:crypto').webcrypto,
  });
});

test('[baseline] recorded Open Library HTTP, real worker and completion boundary cooperate', async () => {
  const f = catalogueWriteWorkerFixture();
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.urls).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
  expect(f.completions).toHaveLength(1);
  expect(f.completions[0].parameters.p_rows).toHaveLength(6);
  expect(f.fixture.calls.filter(call => call.name === 'phase9_register_edition_options_provider_call_v1'))
    .toHaveLength(3);
});

test('AC7-2d/11/17: adapter to worker to RPC carries companions separately from option rows', async () => {
  const f = catalogueWriteWorkerFixture();
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1);
  const {name,parameters:p} = f.completions[0];
  expect(name).toBe('phase9_complete_candidate_edition_options_v2');
  expect(p.p_catalogue_companions).toEqual(expect.any(Array));
  expect(p.p_rows).toHaveLength(6); expect(p.p_catalogue_companions).toHaveLength(5);
  const first = p.p_catalogue_companions.find((x:any) => x.optionId === p.p_rows[0].optionId);
  expect(first).toMatchObject({version:'psr-catalogue-write-v1',providerRecordId:'OL100M',
    workExternalId:'OL1W',oclc:'001234',lccn:'n 79021164',lookupId:p.p_lookup_id,attemptId:p.p_attempt_id});
  expect(first.fetchedAt).toBe(p.p_source_fetched_at);
  expect(Object.keys(p.p_rows[0]).sort()).toEqual(['eligibility','googleBooksUrl','metadata','optionId','ordinal']);
  expect(p.p_rows[0].metadata).not.toHaveProperty('oclc');
  expect(p.p_rows[0].metadata).not.toHaveProperty('workExternalId');
});

test('AC7-13: a lost v2 response recovers the original receipt without another completion or provider call', async () => {
  const f = catalogueWriteWorkerFixture(true);
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1);
  expect(f.completions[0].name).toBe('phase9_complete_candidate_edition_options_v2');
  expect(f.completions[0].parameters.p_catalogue_companions).toHaveLength(5);
  expect(f.recoveries).toHaveLength(2);
  expect(f.urls).toHaveLength(3);
  f.fixture.requeue();
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1); expect(f.urls).toHaveLength(3);
});

test('AC7-17: a legacy adapter without companions still completes through the new worker v2 boundary', async () => {
  const fixture = editionWorkerFixture(), submissions:Array<{name:string;parameters:any}> = [];
  const rpc = async (name:string,parameters:Record<string,any>) => {
    if (name === 'phase9_recover_candidate_edition_options_v1') return {data:{status:'missing'},error:null};
    if (/^phase9_complete_candidate_edition_options_v[12]$/.test(name)) {
      submissions.push({name,parameters});
      return {data:{status:'completed',requestId:parameters.p_request_id,requestGeneration:parameters.p_request_generation,
        optionsVersion:1,optionsExpiresAt:parameters.p_options_expires_at},error:null};
    }
    return fixture.dependencies.serviceClient.rpc(name,parameters);
  };
  const dependencies = {...fixture.dependencies,serviceClient:{rpc},
    editionOptionsBoundary:createMetadataEditionOptionsBoundary({rpc})};
  expect((await runMetadataWorkerBatch(1,dependencies)).results).toEqual([{outcome:'edition_options_available'}]);
  expect(submissions).toHaveLength(1);
  expect(submissions[0].name).toBe('phase9_complete_candidate_edition_options_v2');
  expect(submissions[0].parameters.p_catalogue_companions).toEqual([]);
});

test.each([
  ['unknown key',(c:any) => {c.forged = true;}],
  ['wrong lookup',(c:any) => {c.lookupId = '00000000-0000-4000-8000-000000000999';}],
  ['wrong fetched instant',(c:any) => {c.fetchedAt = '2000-01-01T00:00:00Z';}],
  ['oversize work ID',(c:any) => {c.workExternalId = 'X'.repeat(257);}],
])('AC7-2d: worker refuses %s before the completion RPC', async (_name,corrupt) => {
  const f = catalogueWriteWorkerFixture(false,corrupt);
  const result = await f.run();
  expect(f.urls).toHaveLength(3);
  expect(f.completions.length).toBe(0);
  expect(result.results[0].outcome).not.toBe('edition_options_available');
});
