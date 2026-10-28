// 02b §§3.2/7.1/11/12 AC7-13/17: actual worker and RPC boundary; simulated database responses.
import { catalogueWriteRecording, catalogueWriteWorkerFixture } from './fixtures/phase9/catalogueWrite';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis,'crypto',{
    configurable:true,value:require('node:crypto').webcrypto,
  });
});

test('[baseline] recorded provider fixture has six positions, original work and ISBN edition', () => {
  const recorded = JSON.parse(JSON.stringify(catalogueWriteRecording));
  expect(recorded.editions.entries).toHaveLength(6);
  expect(recorded.search.docs[0].key).toBe('/works/OL1W');
  expect(recorded.editions.entries[0]).toMatchObject({key:'/books/OL100M',
    oclc_numbers:['001234'],lccn:['n 79021164'],covers:[123]});
  expect(recorded.editions.entries[4]).toMatchObject({title:'Le Livre',languages:[{key:'/languages/fre'}]});
  expect(recorded.isbnSearch.docs[0].editions.docs[0].isbn).toEqual(['9780306406157']);
  expect(recorded.isbnEdition.works).toEqual([{key:'/works/OL1W'}]);
});

test('[baseline] committed response loss recovers the saved receipt without another provider request', async () => {
  const f = catalogueWriteWorkerFixture(true);
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1); expect(f.recoveries).toHaveLength(2);
  expect(f.urls).toEqual(['/search.json','/works/OL1W/editions.json','/authors/OL1A.json']);
  expect(f.committedReceipt()).toMatchObject({status:'completed',optionsVersion:1});
  f.fixture.requeue();
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1); expect(f.urls).toHaveLength(3);
});

test('AC7-13/17: lost v2 response recovers its original companion-bearing completion once', async () => {
  const f = catalogueWriteWorkerFixture(true);
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1);
  const completed = f.completions[0];
  expect(completed.name).toBe('phase9_complete_candidate_edition_options_v2');
  expect(completed.parameters.p_catalogue_companions).toHaveLength(5);
  const original = JSON.stringify(completed.parameters);
  expect(f.recoveries).toHaveLength(2);
  f.fixture.requeue();
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions).toHaveLength(1); expect(JSON.stringify(completed.parameters)).toBe(original);
  expect(f.urls).toHaveLength(3);
});

test('AC7-13: temporarily unavailable recovery cannot trigger v1 fallback or another provider call', async () => {
  const f = catalogueWriteWorkerFixture(true);
  f.recoveryControls.failRecoveryAfterCommit = true;
  await f.run();
  expect(f.completions).toHaveLength(1);
  expect(f.completions[0].name).toBe('phase9_complete_candidate_edition_options_v2');
  expect(f.urls).toHaveLength(3);
  f.recoveryControls.failRecoveryAfterCommit = false;
  f.fixture.requeue();
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  expect(f.completions.map(call => call.name)).toEqual(['phase9_complete_candidate_edition_options_v2']);
  expect(f.urls).toHaveLength(3);
});

test('AC7-17: unavailable completion never falls back from v2 to v1', async () => {
  const f = catalogueWriteWorkerFixture();
  f.recoveryControls.rejectCompletionBeforeReceipt = true;
  await f.run();
  expect(f.completions.map(call => call.name)).toEqual(['phase9_complete_candidate_edition_options_v2']);
  expect(f.committedReceipt()).toBeNull(); expect(f.urls).toHaveLength(3);
});

test('[baseline] a superseded generation returns stale without another provider request', async () => {
  const f = catalogueWriteWorkerFixture(true);
  expect((await f.run()).results).toEqual([{outcome:'edition_options_available'}]);
  f.fixture.requeue({requestGeneration:1});
  expect((await f.run()).results).toEqual([{outcome:'stale_claim'}]);
  expect(f.completions).toHaveLength(1); expect(f.urls).toHaveLength(3);
});
