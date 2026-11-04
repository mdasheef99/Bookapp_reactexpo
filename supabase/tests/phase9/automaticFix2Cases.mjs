// FIX2 D5/D6 and L2 variants: production worker over disposable SQL only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { automaticWorkerFixture } from './automaticWorkerDatabaseFixture.mjs';
import { resetActor, value, setActor } from './providerReplacementFixture.mjs';
const due = async (db, f) => {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.jobId]);
};
export function automaticFix2Cases(database) {
  test('D5: removing the historical accepted version terminalizes the resumed job', async () => {
    const db = database(), f = await automaticWorkerFixture(db, { fetcher: async () => new Response('{}', {
      status: 503, headers: { 'content-type': 'application/json' } }) });
    assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
    await due(db, f);
    await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='1.0.1',
      accepted_adapter_versions=ARRAY['1.0.1'],version_contracts=jsonb_build_object('1.0.1',version_contracts->'1.0.0')
      WHERE adapter_key='google_books'`);
    assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
    assert.equal(f.urls.length, 1);
    await resetActor(db);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
  });
  for (const scenario of ['unknown', 'no_match']) test(`L2 ${scenario}: lost terminal write then NULL policy never re-GETs`, async () => {
    const db = database(), f = await automaticWorkerFixture(db, { fetcher: async () => {
      if (scenario === 'unknown') throw new Error('unknown send');
      return new Response('{"items":[]}', { headers: { 'content-type': 'application/json' } });
    } });
    const rpc = f.dependencies.serviceClient.rpc;
    let lost = false, suppress = true;
    f.dependencies.serviceClient.rpc = async (name, p) => {
      if (suppress && name === (scenario === 'unknown' ? 'phase9_fail_metadata_job' : 'phase9_complete_automatic_metadata_v1')) {
        lost = true; return { data: null, error: { message: 'not committed' } };
      }
      return rpc(name, p);
    };
    await f.run();
    suppress = false;
    assert.equal(lost, true);
    assert.equal(f.urls.length, 1);
    await due(db, f);
    await db.query("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
    assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
    assert.equal(f.urls.length, 1);
    await resetActor(db);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
  });
  test('D6: an expired automatic session terminalizes on reclaim without another GET', async () => {
    const db = database(), f = await automaticWorkerFixture(db, { fetcher: async () => new Response('{}', {
      status: 503, headers: { 'content-type': 'application/json' } }) });
    assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
    await due(db, f);
    await db.query("UPDATE public.image_extraction_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.sessionId]);
    const result = await f.run();
    assert.deepEqual(result.results, [{ outcome: 'manual_metadata_required' }]);
    assert.equal(f.urls.length, 1);
    await resetActor(db);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
  });
  test('D6 control: a stolen lease refuses the original terminal write without adopting the new claim', async () => {
    const db = database();
    let changed = false, steal = false, f;
    f = await automaticWorkerFixture(db, { fetcher: async () => new Response('{}', { status: 503 }),
      after: async (name, _p, result) => {
      if (steal && name === 'phase9_automatic_edition_fence_v1' && !changed) {
        changed = true;
        await resetActor(db);
        await db.query("UPDATE public.image_extraction_jobs SET lease_owner='metadata-worker-other-0001',lease_token_hash=repeat('f',64) WHERE id=$1", [f.jobId]);
        await setActor(db, f.ownerId, 'service_role');
      }
      return result;
    } });
    assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
    await due(db, f);
    steal = true;
    assert.deepEqual((await f.run()).results, [{ outcome: 'stale_claim' }]);
    assert.equal(f.urls.length, 1);
    const original = f.calls.filter(call => call.name === 'phase9_metadata_job_context').at(-1).parameters;
    const failed = f.calls.find(call => call.name === 'phase9_fail_metadata_job').parameters;
    assert.equal(failed.p_lease_token, original.p_lease_token);
    assert.equal(failed.p_attempt_count, original.p_attempt_count);
    assert.equal(failed.p_retryable, false);
    await resetActor(db);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'in_progress');
    assert.equal(await value(db, 'SELECT lease_owner FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'metadata-worker-other-0001');
  });
}
