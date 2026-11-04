// 02c §§4.3/5.1/9: production worker over M93 + explicit M94, no external services.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { clean, resetActor, value } from './providerReplacementFixture.mjs';
import { automaticWorkerFixture, createAutomaticWorkerDatabase, TEST_ONLY_POLICY } from './automaticWorkerDatabaseFixture.mjs';
import { setActor } from './providerReplacementFixture.mjs';
import { getWorkerProtectionState } from '../../../.phase9-dist/workers/phase9-metadata-worker/index.js';
import { receivingCard } from './providerAutomaticReviewFixture.mjs';
let db;
before(async () => { db = await createAutomaticWorkerDatabase(); });
beforeEach(async () => { await clean(db); });
after(async () => { await db.close(); });

// Mutation caught: separate logical finalization/selection replaces the atomic completion RPC.
test('Google success submits the exact automatic command and settles one physical round', async () => {
  const f = await automaticWorkerFixture(db);
  assert.deepEqual((await f.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
  const names = f.calls.map(call => call.name);
  assert.ok(names.indexOf('phase9_prepare_automatic_metadata_v1') < names.indexOf('phase9_reserve_metadata_usage'));
  assert.equal(names.includes('phase9_finalize_structural_metadata_attempt'), false);
  assert.equal(names.includes('phase9_select_structural_metadata_snapshot'), false);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
});
// Mutation caught: automatic OL uses the legacy adapter, drops retained rows, or duplicates call accounting.
test('test-only OL v2 route completes a retained winner through three fenced GETs', async () => {
  const f = await automaticWorkerFixture(db, { provider: 'open_library' });
  assert.deepEqual((await f.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.urls.map(url => new URL(url).pathname), ['/search.json', '/works/OL1W/editions.json', '/authors/OL1A.json']);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 3, attempts: 1 });
  const command = f.calls.find(call => call.name === 'phase9_complete_automatic_metadata_v1').parameters.p_command;
  assert.equal(command.result.rows.find(row => row.optionId === command.selectedOptionId).eligibility, 'eligible');
  assert.equal(command.result.catalogueCompanions.filter(row => row.optionId === command.selectedOptionId).length, 1);
});
// Mutation caught: lost completion response falls back to failure/requeue or repeats provider egress.
test('lost committed completion recovers the original fence immediately', async () => {
  const f = await automaticWorkerFixture(db, { after: async (name, _p, result) =>
    name === 'phase9_complete_automatic_metadata_v1' ? { data: null, error: { message: 'lost response' } } : result });
  assert.deepEqual((await f.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(f.errors, []);
  const index = f.calls.findIndex(call => call.name === 'phase9_complete_automatic_metadata_v1');
  assert.equal(f.calls[index + 1].name, 'phase9_recover_automatic_metadata_v1');
  assert.deepEqual(f.calls[index + 1].parameters.p_fence, f.calls[index].parameters.p_command.fence);
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'), false);
});
// Mutation caught: unknown sends receive a retry allowance or stay in_progress forever.
test('unknown send terminalizes manual without a second GET', async () => {
  const f = await automaticWorkerFixture(db, { fetcher: async () => { throw new Error('unknown send'); } });
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
  assert.equal(f.calls.some(call => call.name === 'phase9_complete_automatic_metadata_v1'), false);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'dead_letter');
  await resetActor(db);
  assert.deepEqual((await f.run()).results, []);
  assert.equal(f.urls.length, 1);
});
// Mutation caught: a proven-unsent auth failure becomes an endless recovery-only run.
test('proven-unsent auth failure terminalizes the job', async () => {
  const f = await automaticWorkerFixture(db);
  f.dependencies.primary.configuration.apiKey = '';
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.equal(f.calls.some(call => call.name === 'phase9_complete_automatic_metadata_v1'), false);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
});
// Mutation caught: a fan-out winner without a retained list is submitted as a selected command.
test('OL no-store winner degrades to a terminal policy denial', async () => {
  const fetcher = async (address) => {
    const path = new URL(String(address)).pathname;
    const payload = path === '/search.json' ? { docs: [{ key: '/works/OL1W' }] }
      : path.endsWith('/editions.json') ? { entries: [{ key: '/books/OL100M', title: 'The Fixture Book',
        authors: [{ key: '/authors/OL1A' }], languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'] }] }
        : { key: '/authors/OL1A', name: 'Fixture Author' };
    return new Response(JSON.stringify(payload), { headers: {
      'content-type': 'application/json', 'cache-control': 'no-store' } });
  };
  const f = await automaticWorkerFixture(db, { provider: 'open_library', fetcher });
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 3);
  assert.equal(f.calls.some(call => call.name === 'phase9_complete_automatic_metadata_v1'), false);
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'), true);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
});
// Mutation caught: NULL-policy unknown sends no longer follow HEAD's retryable manual completion.
test('NULL-policy unknown send schedules the legacy retry', async () => {
  const f = await automaticWorkerFixture(db, { fetcher: async () => { throw new Error('unknown send'); } });
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 1);
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'), true);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'retry_scheduled');
});
// Mutation caught: a breaker refusal after begin leaves a running run blocking every later claim.
test('breaker refusal after begin rechecks a no-lookup run', async () => {
  const f = await automaticWorkerFixture(db, { after: async (name, _p, result) => {
    if (name === 'phase9_begin_automatic_provider_run_v1') {
      getWorkerProtectionState('google_books').breakerOpenedAtMs = Date.now();
    }
    return result;
  } });
  await db.query("UPDATE public.phase9_provider_registry SET revalidation_seconds=NULL WHERE adapter_key='google_books'");
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.equal(f.calls.some(call => call.name === 'phase9_schedule_automatic_provider_recheck_v1'), true);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'retry_scheduled');
});
// Mutation caught: a breaker refusal after a coalescing lookup leaves a permanent in-progress job.
test('breaker refusal after begin terminalizes a lookup-bound run', async () => {
  const f = await automaticWorkerFixture(db, { after: async (name, _p, result) => {
    if (name === 'phase9_prepare_automatic_metadata_v1') {
      getWorkerProtectionState('google_books').breakerOpenedAtMs = Date.now();
    }
    return result;
  } });
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.equal(f.calls.some(call => call.name === 'phase9_schedule_automatic_provider_recheck_v1'), true);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
});
// H1: evidence without a run lookup lineage terminalizes on the next reclaim.
test('lost-command lookup evidence terminalizes without another GET', async () => {
  const f = await automaticWorkerFixture(db, { after: async (name, _p, result) =>
    name === 'phase9_prepare_automatic_metadata_v1' ? { data: null, error: { message: 'lost prepare' } } : result });
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 0, calls: 0, attempts: 0 });
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.jobId]);
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'
    && call.parameters.p_failure_kind === 'policy_denied'), true);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
});
// Mutation caught: capacity denial creates a lookup before M93 can safely clear the lease.
test('full store capacity schedules a wait with no external lineage', async () => {
  const f = await automaticWorkerFixture(db);
  await db.query(`INSERT INTO marketplace_sec.phase9_store_admission(store_id,window_started_at,gets_used)
    VALUES($1,clock_timestamp(),$2) ON CONFLICT(store_id) DO UPDATE SET gets_used=excluded.gets_used`, [f.storeId, TEST_ONLY_POLICY.storeMaxGets]);
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.equal(f.urls.length, 0);
  assert.deepEqual(f.errors, []);
  assert.deepEqual(await f.counts(), { runs: 0, lookups: 0, reservations: 0, calls: 0, attempts: 0 });
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'), false);
});
// Mutation caught: retry creates another logical reservation/attempt or bypasses M93's second-round authority.
test('received failure schedules exactly one new-claim retry using the original logical lineage', async () => {
  let gets = 0;
  const f = await automaticWorkerFixture(db, { fetcher: async () => {
    gets += 1;
    return new Response(JSON.stringify({ items: [] }), { status: gets === 1 ? 503 : 200,
      headers: { 'content-type': 'application/json' } });
  } });
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.deepEqual(f.errors, []);
  const before = await f.counts();
  assert.deepEqual(before, { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
  await new Promise(resolve => setTimeout(resolve, TEST_ONLY_POLICY.backoffMaxMs));
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(gets, 2);
  assert.deepEqual(await f.counts(), { ...before, runs: 2, calls: 2 });
  const grants = f.calls.filter(call => call.name === 'phase9_register_metadata_provider_call');
  assert.deepEqual(grants.map(call => call.parameters.p_attempt_count), [1, 2]);
  assert.equal(new Set(grants.map(call => call.parameters.p_attempt_id)).size, 1);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'resolved');
});
// Mutation caught: no-egress breaker recheck inserts external lineage or loops forever instead of completing its second claim.
test('breaker schedules one unsent recheck and SQL proves terminal completion on the second claim', async () => {
  const f = await automaticWorkerFixture(db);
  const state = getWorkerProtectionState('google_books');
  state.breakerOpenedAtMs = Date.now();
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.equal(f.urls.length, 0);
  assert.deepEqual(f.errors, []);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 0, reservations: 0, calls: 0, attempts: 0 });
  // Advance only the disposable SQL due gates; the local breaker remains open.
  await db.query("UPDATE marketplace_sec.phase9_automatic_provider_runs SET due_at=clock_timestamp()-interval '1 second' WHERE job_id=$1", [f.jobId]);
  await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.jobId]);
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.equal(f.calls.filter(call => call.name === 'phase9_schedule_automatic_provider_recheck_v1').length, 2);
  assert.equal(f.calls.filter(call => call.name === 'phase9_complete_automatic_metadata_v1').length, 1);
  await resetActor(db);
  assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1', [f.jobId]), 'dead_letter'); // M93:1401 terminal technical failure.
});
// Mutation caught: converting a real P0001 stale-fence refusal into permission or a generic retry.
test('a bumped generation between read and preparation refuses before all provider lineage', async () => {
  let bumped = false;
  let f;
  f = await automaticWorkerFixture(db, { after: async (name, _p, result) => {
    if (name === 'phase9_automatic_edition_fence_v1' && !bumped) {
      bumped = true;
      await resetActor(db);
      await db.query(`INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity,request_generation)
        SELECT id,session_id,store_id,marketplace_sec.phase9_metadata_candidate_query_identity(c),1
        FROM public.image_extraction_candidates c WHERE id=$1`, [f.candidateId]);
      await setActor(db, f.ownerId, 'service_role');
    }
    return result;
  } });
  assert.deepEqual((await f.run()).results, [{ outcome: 'stale_claim' }]);
  assert.equal(f.urls.length, 0);
  assert.equal(f.errors.length, 1);
  assert.equal(f.errors[0].name, 'phase9_prepare_automatic_metadata_v1');
  assert.equal(f.errors[0].error.code, 'P0001');
  assert.equal(f.errors[0].error.message, 'P9_STATE_CONFLICT');
  assert.deepEqual(await f.counts(), { runs: 0, lookups: 0, reservations: 0, calls: 0, attempts: 0 });
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'), false);
});
// Mutation caught: NULL-policy callers silently opt into protected admission or lose atomic non-retryable completion.
test('NULL-policy legacy election and Google primary remain compatible with atomic completion', async () => {
  const f = await automaticWorkerFixture(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  assert.deepEqual((await f.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(await f.counts(), { runs: 0, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
  assert.equal(f.calls.some(call => call.name === 'phase9_metadata_coalescing_context'), true);
  assert.equal(f.calls.some(call => call.name === 'phase9_prepare_automatic_metadata_v1'), false);
});
// Mutation caught: pending-follower deferral leaves a begun run that blocks the next claim forever.
test('pending follower reclaims and defers without any automatic run or GET', async () => {
  const leader = await automaticWorkerFixture(db, { after: async (name, _p, result) =>
    name === 'phase9_prepare_automatic_metadata_v1' ? { data: null, error: { message: 'lost leader response' } } : result });
  assert.deepEqual((await leader.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(await leader.counts(), { runs: 1, lookups: 1, reservations: 0, calls: 0, attempts: 0 });
  const f = await automaticWorkerFixture(db, { card: await receivingCard(db, leader) });
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.deepEqual(await f.counts(), { runs: 0, lookups: 0, reservations: 0, calls: 0, attempts: 0 });
  await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.jobId]);
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  assert.deepEqual(await f.counts(), { runs: 0, lookups: 0, reservations: 0, calls: 0, attempts: 0 });
  assert.equal(f.calls.filter(call => call.name === 'phase9_prepare_automatic_metadata_v1').length, 2);
});
// Mutation caught: a stale capacity admission marker rejects the next fresh claim after capacity is freed.
test('capacity wait resumes on a fresh token without duplicate lookup or run', async () => {
  const f = await automaticWorkerFixture(db);
  await db.query(`INSERT INTO marketplace_sec.phase9_store_admission(store_id,window_started_at,gets_used)
    VALUES($1,clock_timestamp(),$2) ON CONFLICT(store_id) DO UPDATE SET gets_used=excluded.gets_used`, [f.storeId, TEST_ONLY_POLICY.storeMaxGets]);
  assert.deepEqual((await f.run()).results, [{ outcome: 'retry_scheduled' }]);
  assert.equal(f.urls.length, 0);
  await resetActor(db);
  await db.query('UPDATE marketplace_sec.phase9_store_admission SET gets_used=0 WHERE store_id=$1', [f.storeId]);
  await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [f.jobId]);
  assert.deepEqual((await f.run()).results, [{ outcome: 'accepted_metadata_match' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 1);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
  const prepares = f.calls.filter(call => call.name === 'phase9_prepare_automatic_metadata_v1');
  assert.equal(prepares.length, 2);
  assert.notEqual(prepares[0].parameters.f.leaseToken, prepares[1].parameters.f.leaseToken);
});
// Mutation caught: an uncertain committed physical grant is treated as permission to send or replayed with a new identity.
test('lost physical grant response replays exactly and proves the call unsent without HTTP', async () => {
  let lost = false;
  const f = await automaticWorkerFixture(db, { after: async (name, _p, result) => {
    if (name === 'phase9_register_metadata_provider_call' && !lost) {
      lost = true;
      return { data: null, error: { message: 'lost committed grant' } };
    }
    return result;
  } });
  assert.deepEqual((await f.run()).results, [{ outcome: 'manual_metadata_required' }]);
  assert.deepEqual(f.errors, []);
  assert.equal(f.urls.length, 0);
  const registrations = f.calls.filter(call => call.name === 'phase9_register_metadata_provider_call');
  assert.equal(registrations.length, 2);
  assert.deepEqual(registrations[0].parameters, registrations[1].parameters);
  assert.deepEqual(await f.counts(), { runs: 1, lookups: 1, reservations: 1, calls: 1, attempts: 1 });
  assert.equal(await value(db, 'SELECT status FROM public.phase9_metadata_provider_calls WHERE job_id=$1', [f.jobId]), 'stale_rejected');
  assert.equal(f.calls.some(call => call.name === 'phase9_complete_automatic_metadata_v1'), false);
  assert.equal(f.calls.some(call => call.name === 'phase9_fail_metadata_job'), false);
});
