// FIX2 L1/L2: 02c §§4.3/5.1/9. Real SQL, recorded HTTP, no external services.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { automaticWorkerFixture } from './automaticWorkerDatabaseFixture.mjs';
import { resetActor, value } from './providerReplacementFixture.mjs';

export function automaticLegacyRetryCases(database) {
  const due = async (db, f) => {
    await resetActor(db);
    await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.jobId]);
  };
  const noNewLineage = (f, offset) => assert.equal(f.calls.slice(offset).some(call => [
    'phase9_metadata_coalescing_context', 'phase9_metadata_cache_reuse_context',
    'phase9_register_structural_metadata_lookup', 'phase9_register_structural_metadata_attempt',
    'phase9_reserve_metadata_usage', 'phase9_prepare_automatic_metadata_v1',
  ].includes(call.name)), false);
  for (const secondStatus of [200, 503]) test(`NULL-policy 503 then ${secondStatus} uses exactly one original-lineage retry`, async () => {
    const db = database();
    let gets = 0;
    const f = await automaticWorkerFixture(db, { fetcher: async () => new Response(JSON.stringify({ items: [] }), {
      status: ++gets === 1 ? 503 : secondStatus, headers: { 'content-type': 'application/json' },
    }) });
    await db.query("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
    assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
    assert.deepEqual(await f.counts(), { runs: 0, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
    assert.equal(await value(db, 'SELECT disposition FROM public.metadata_enrichment_attempts WHERE candidate_id=$1', [f.candidateId]), 'unresolved');
    const offset = f.calls.length;
    await due(db, f);
    assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
    assert.equal(gets, 2);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(await f.counts(), { runs: 0, lookups: 1, reservations: 1, calls: 2, attempts: 1 });
    noNewLineage(f, offset);
    const grants = f.calls.filter(call => call.name === 'phase9_register_metadata_provider_call');
    assert.deepEqual(grants.map(call => call.parameters.p_attempt_count), [1, 2]);
    assert.equal(new Set(grants.map(call => call.parameters.p_attempt_id)).size, 1);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]),
      secondStatus === 200 ? 'resolved' : 'dead_letter');
    await due(db, f);
    assert.deepEqual((await f.run()).results, []);
    assert.equal(gets, 2);
  });
  test('protected lineage with a now-NULL policy terminalizes before a second GET', async () => {
    const db = database();
    const f = await automaticWorkerFixture(db, { fetcher: async () => new Response('{}', { status: 503 }) });
    assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
    assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
    const offset = f.calls.length;
    await db.query("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
    await due(db, f);
    assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
    assert.equal(f.urls.length, 1);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
    noNewLineage(f, offset);
    assert.equal(f.calls.slice(offset).some(call => call.name === 'phase9_fail_metadata_job'
      && call.parameters.p_failure_kind === 'policy_denied' && call.parameters.p_retryable === false), true);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
  });
  test('NULL-policy unknown send never receives a second GET on reclaim', async () => {
    const db = database();
    const f = await automaticWorkerFixture(db, { fetcher: async () => { throw new Error('unknown send'); } });
    await db.query("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
    assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
    assert.equal(f.urls.length, 1);
    await due(db, f);
    assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
    assert.equal(f.urls.length, 1);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(await f.counts(), { runs: 0, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
  });
}
