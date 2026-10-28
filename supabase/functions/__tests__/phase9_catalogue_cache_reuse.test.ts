// 02b §§5/8.1-8.2/10/11: real worker composition; RPC responses model the SQL port only.
import { catalogueCacheWorkerFixture, cacheReuseRpc } from './fixtures/phase9/catalogueCache';

beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) Object.defineProperty(globalThis, 'crypto', {
    configurable: true, value: require('node:crypto').webcrypto,
  });
});
const named = (f: ReturnType<typeof catalogueCacheWorkerFixture>, name: string) =>
  f.calls.filter(call => call.name === name);
const phase = (f: ReturnType<typeof catalogueCacheWorkerFixture>) => f.calls.map(call => call.name)
  .filter(name => ['phase9_recover_candidate_edition_options_v1', cacheReuseRpc,
    'phase9_register_structural_metadata_lookup', 'phase9_reserve_metadata_usage'].includes(name));

test('[baseline] fixture sanity: actual external provider path reserves and records three physical GETs', async () => {
  const f = catalogueCacheWorkerFixture('miss');
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(named(f, 'phase9_metadata_job_context').length).toBeGreaterThan(0);
  expect(named(f, 'phase9_reserve_metadata_usage')).toHaveLength(1);
  expect(f.urls).toEqual(['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
  expect(named(f, 'phase9_register_edition_options_provider_call_v1')).toHaveLength(3);
  expect(named(f, 'phase9_finalize_edition_options_provider_call_v1')).toHaveLength(3);
  expect(named(f, 'phase9_complete_candidate_edition_options_v2')).toHaveLength(1);
});

test('AC7-7/16: cache hit completes with zero provider GETs, reservations and physical-call writes', async () => {
  const f = catalogueCacheWorkerFixture('hit');
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(named(f, cacheReuseRpc)).toHaveLength(1);
  expect(f.urls).toEqual([]);
  for (const name of ['phase9_reserve_metadata_usage', 'phase9_register_structural_metadata_lookup',
    'phase9_register_structural_metadata_attempt', 'phase9_register_edition_options_provider_call_v1',
    'phase9_complete_candidate_edition_options_v2']) expect(named(f, name)).toHaveLength(0);
});

test('AC7-16/17: miss follows one recovery then one reuse call before the unchanged provider reservation path', async () => {
  const f = catalogueCacheWorkerFixture('miss');
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(phase(f)).toEqual(['phase9_recover_candidate_edition_options_v1', cacheReuseRpc,
    'phase9_register_structural_metadata_lookup', 'phase9_reserve_metadata_usage']);
  expect(named(f, 'phase9_reserve_metadata_usage')).toHaveLength(1);
  expect(f.urls).toHaveLength(3);
});

test('AC7-13/16/17: a cache transaction response loss recovers before any reservation or provider GET', async () => {
  const f = catalogueCacheWorkerFixture('response_lost');
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(phase(f)).toEqual(['phase9_recover_candidate_edition_options_v1', cacheReuseRpc,
    'phase9_recover_candidate_edition_options_v1']);
  expect(f.durableReceipt()).toMatchObject({ status: 'completed', optionsVersion: 1 });
  expect(f.urls).toEqual([]);
  expect(named(f, 'phase9_reserve_metadata_usage')).toHaveLength(0);
});

test('AC7-13/24: same-request replay recovers its receipt before cache re-keying and never repeats egress', async () => {
  const f = catalogueCacheWorkerFixture('hit');
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(named(f, cacheReuseRpc)).toHaveLength(1);
  const original = JSON.stringify(f.durableReceipt());
  f.base.requeue();
  expect((await f.run()).results).toEqual([{ outcome: 'edition_options_available' }]);
  expect(JSON.stringify(f.durableReceipt())).toBe(original);
  expect(named(f, cacheReuseRpc)).toHaveLength(1);
  expect(named(f, 'phase9_recover_candidate_edition_options_v1')).toHaveLength(2);
  expect(named(f, 'phase9_reserve_metadata_usage')).toHaveLength(0);
  expect(f.urls).toEqual([]);
});
