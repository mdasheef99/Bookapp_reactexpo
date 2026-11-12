// 02d Unit 1b: Search Books while a saved list is fresh (ACP-3 SQL, ACP-9 control, ACP-11).
// Disposable PGlite/native databases only; recorded provider evidence; no provider HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { clean, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import {
  beginAutomatic, olAutomaticRoute, retainedOlResult, singleReceipt,
} from './providerAutomaticReviewFixture.mjs';
import { lookupSql, readSql, seedCard, selectSql } from './editionPickerFixture.mjs';
import {
  M101, claimViaCommand, completeCommand, completeRequest, createPrefillDatabase, failViaCommand,
  ownerChoices, savedFixture, stateRow,
} from './automaticPrefillFixture.mjs';
import { migrationPath } from './databaseHarness.mjs';
import { nativeConnection } from './providerDatabaseHarness.mjs';

let db;
before(async () => { db = await createPrefillDatabase({ searchWhileFresh: true }); });
beforeEach(async () => { await clean(db); });
after(async () => { await db?.close(); });

const saved = (count = 1) => savedFixture(db,
  { olAutomaticRoute, retainedOlResult, beginAutomatic }, count);

async function asOwner(f, sql) {
  await setActor(db, f.ownerId);
  return value(db, sql);
}
async function search(f, generation = 0, key = randomUUID(), command = randomUUID()) {
  return asOwner(f, lookupSql(f, generation, key, command));
}
async function read(f) {
  return asOwner(f, readSql(f));
}
async function choose(f, choices, optionId, overrides = {}) {
  return asOwner(f, selectSql(f, choices, optionId, overrides));
}
function assertSelectionUnchanged(after, before) {
  assert.equal(after.selection_id, before.selection_id);
  assert.equal(after.selected_source, before.selected_source);
  assert.equal(after.selected_source_id, before.selected_source_id);
  assert.deepEqual(after.selected_option_snapshot, before.selected_option_snapshot);
  assert.equal(after.selected_at, before.selected_at);
  assert.equal(after.selected_by, before.selected_by);
}
async function ownerJobs(f) {
  await resetActor(db);
  return value(db, "SELECT count(*)::int FROM public.image_extraction_jobs"
    + " WHERE entity_id=$1 AND operation_version='p9-owner-edition-options-v1'", [f.candidateId]);
}
async function allJobs(f) {
  await resetActor(db);
  return value(db, "SELECT count(*)::int FROM public.image_extraction_jobs"
    + " WHERE entity_id=$1 AND job_kind='metadata_enrich'", [f.candidateId]);
}
async function jobRow(id) {
  await resetActor(db);
  return value(db, 'SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE j.id=$1', [id]);
}
async function moveRetryClock(jobId) {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs"
    + " SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [jobId]);
}
async function expireLease(jobId) {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs"
    + " SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [jobId]);
}
// Real claim/fail cycles reach the exhausted state; only the retry clock and
// lease expiry are moved, never status/attempt_count.
async function exhaustViaCommands(f, jobId, { expire = true } = {}) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const claim = await claimViaCommand(db, f, jobId);
    await failViaCommand(db, f, claim, 'provider_unavailable', true);
    await moveRetryClock(jobId);
  }
  const claim = await claimViaCommand(db, f, jobId);
  if (expire) await expireLease(jobId);
  return claim;
}

// Real selection before an exhausted/dead-lettered request: a Google automatic
// winner supplies the current suggestion (no saved list), then the real select
// command records the full selection on the state row.
async function selectedNoListCard() {
  const fixture = await beginAutomatic(db);
  await singleReceipt(db, fixture);
  const automatic = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(automatic.prefill.status, 'skipped');
  assert.equal(automatic.prefill.reason, 'no_retention');
  const choices = await ownerChoices(db, fixture.f);
  assert.ok(choices.selection, 'automatic winner supplies the current suggestion');
  const selected = await choose(fixture.f, choices, choices.selection.selectionId,
    { source: 'current_suggestion' });
  assert.ok(selected.selection);
  return { fixture, selected };
}

// T1: ACP-3 SQL — a fresh automatic list no longer suppresses Search Books.
test('T1 fresh automatic list: one request, rows/source cleared, selection kept', async () => {
  const fixture = await saved();
  const automatic = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(automatic.prefill.status, 'saved');
  const choices = await ownerChoices(db, fixture.f);
  assert.equal(choices.lookupStatus, 'ready');
  assert.equal(choices.optionsVersion, 1);
  const selected = await choose(fixture.f, choices, choices.rows[0].optionId);
  assert.ok(selected.selection);
  const before = await stateRow(db, fixture.f.candidateId);

  const receipt = await search(fixture.f, choices.requestGeneration);
  assert.notEqual(receipt.operationId, fixture.f.jobId, 'Search Books must create a new explicit request');
  assert.equal(receipt.status, 'pending');
  const after = await stateRow(db, fixture.f.candidateId);
  assert.equal(after.request_id, receipt.operationId);
  assert.deepEqual(after.options, []);
  assert.equal(after.source_lookup_id, null);
  assert.equal(after.source_attempt_id, null);
  assert.equal(after.source_fetched_at, null);
  assert.equal(after.options_expires_at, null);
  assert.equal(after.options_version, before.options_version + 1);
  assert.equal(after.request_generation, before.request_generation);
  assert.equal(after.selection_id, before.selection_id);
  assert.equal(after.selected_source, before.selected_source);
  assert.equal(after.selected_source_id, before.selected_source_id);
  assert.deepEqual(after.selected_option_snapshot, before.selected_option_snapshot);
  assert.equal(after.selected_at, before.selected_at);
  assert.equal(after.selected_by, before.selected_by);
  const current = await ownerChoices(db, fixture.f);
  assert.equal(current.lookupStatus, 'pending');
  assert.deepEqual(current.rows, []);
  assert.deepEqual(current.selection, selected.selection);
  assert.equal(await allJobs(fixture.f), 2);
});

// T2: ACP-3 SQL — a fresh explicit list behaves the same way.
test('T2 fresh explicit list: one request, selection kept', async () => {
  const f = await seedCard(db);
  const first = await search(f);
  assert.equal(first.status, 'pending');
  const claim = await claimViaCommand(db, f, first.operationId);
  const completion = await completeRequest(db, f, claim);
  assert.equal(completion.response.status, 'completed');
  const choices = await ownerChoices(db, f);
  assert.equal(choices.lookupStatus, 'ready');
  const selected = await choose(f, choices, choices.rows[0].optionId);
  assert.ok(selected.selection);
  const before = await stateRow(db, f.candidateId);

  const receipt = await search(f, choices.requestGeneration);
  assert.notEqual(receipt.operationId, first.operationId);
  assert.equal(receipt.status, 'pending');
  const after = await stateRow(db, f.candidateId);
  assert.equal(after.request_id, receipt.operationId);
  assert.deepEqual(after.options, []);
  assert.equal(after.options_expires_at, null);
  assert.equal(after.options_version, before.options_version + 1);
  assert.equal(after.selection_id, before.selection_id);
  assert.equal(after.selected_source, before.selected_source);
  assert.equal(after.selected_source_id, before.selected_source_id);
  assert.deepEqual(after.selected_option_snapshot, before.selected_option_snapshot);
  assert.equal(after.selected_at, before.selected_at);
  assert.equal(after.selected_by, before.selected_by);
  const current = await ownerChoices(db, f);
  assert.deepEqual(current.selection, selected.selection);
  assert.equal(await ownerJobs(f), 2);
});

// T3: pending request (open/in_progress/retry_scheduled) — control.
test('T3 control pending open, in_progress and retry_scheduled: same request, zero increments', async () => {
  for (const status of ['open', 'in_progress', 'retry_scheduled']) {
    await clean(db);
    const f = await seedCard(db);
    const first = await search(f);
    assert.equal(first.status, 'pending');
    if (status !== 'open') {
      const claim = await claimViaCommand(db, f, first.operationId);
      if (status === 'retry_scheduled') {
        await failViaCommand(db, f, claim, 'provider_unavailable', true);
      }
    }
    const before = await stateRow(db, f.candidateId);
    const second = await search(f);
    assert.equal(second.operationId, first.operationId, status + ': no replacement');
    assert.equal(second.status, 'pending');
    const after = await stateRow(db, f.candidateId);
    assert.equal(after.options_version, before.options_version, status + ': no increment');
    assert.equal(await ownerJobs(f), 1, status + ': one job');
  }
});

// T4: the single creation advance lives here only.
test('T4 no list: new request advances options_version once', async () => {
  const f = await seedCard(db);
  const receipt = await search(f);
  assert.equal(receipt.status, 'pending');
  const state = await stateRow(db, f.candidateId);
  assert.equal(state.request_id, receipt.operationId);
  assert.equal(state.options_version, 1);
  assert.deepEqual(state.options, []);
  assert.equal(state.source_lookup_id, null);
  assert.equal(state.options_expires_at, null);
  assert.equal(await ownerJobs(f), 1);
});

// T4b: expired saved list is the same no-fresh-list path. The only elapsed-time
// write is moving options_expires_at past (Owner-approved, like next_attempt_at /
// lease_expires_at); the saved list itself is built normally and reads ready first.
test('T4b expired saved list: new request advances options_version once', async () => {
  const fixture = await saved();
  const automatic = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(automatic.prefill.status, 'saved');
  const ready = await ownerChoices(db, fixture.f);
  assert.equal(ready.lookupStatus, 'ready');
  await resetActor(db);
  await db.query("UPDATE public.phase9_candidate_edition_state SET options_expires_at="
    + "greatest(source_fetched_at, transaction_timestamp()-interval '1 second')"
    + " WHERE candidate_id=$1", [fixture.f.candidateId]);
  const expired = await ownerChoices(db, fixture.f);
  assert.equal(expired.lookupStatus, 'idle');
  const before = await stateRow(db, fixture.f.candidateId);
  const receipt = await search(fixture.f, expired.requestGeneration);
  assert.notEqual(receipt.operationId, fixture.f.jobId);
  assert.equal(receipt.status, 'pending');
  const after = await stateRow(db, fixture.f.candidateId);
  assert.equal(after.options_version, before.options_version + 1);
  assert.deepEqual(after.options, []);
  assert.equal(await allJobs(fixture.f), 2);
});

// T5: exhausted current request with a free job lock.
test('T5 exhausted job, lock free: dead-letter, one replacement, selection kept', async () => {
  const { fixture } = await selectedNoListCard();
  const f = fixture.f;
  const first = await search(f);
  const before = await stateRow(db, f.candidateId);
  await exhaustViaCommands(f, first.operationId);
  const failed = await read(f);
  assert.equal(failed.lookupStatus, 'failed');
  const receipt = await search(f);
  assert.notEqual(receipt.operationId, first.operationId);
  assert.equal(receipt.status, 'pending');
  assert.equal((await jobRow(first.operationId)).status, 'dead_letter');
  const after = await stateRow(db, f.candidateId);
  assert.equal(after.request_id, receipt.operationId);
  assert.equal(after.options_version, before.options_version + 1);
  assertSelectionUnchanged(after, before);
  assert.equal(await ownerJobs(f), 2);
});

// T5b: already dead-lettered request via the real terminal failure command.
test('T5b already dead-lettered request: one replacement, selection kept', async () => {
  const { fixture } = await selectedNoListCard();
  const f = fixture.f;
  const first = await search(f);
  const before = await stateRow(db, f.candidateId);
  const claim = await claimViaCommand(db, f, first.operationId);
  const failed = await failViaCommand(db, f, claim, 'provider_unavailable', false);
  assert.equal(failed.status, 'dead_letter');
  assert.equal((await jobRow(first.operationId)).status, 'dead_letter');
  const receipt = await search(f);
  assert.notEqual(receipt.operationId, first.operationId);
  assert.equal(receipt.status, 'pending');
  const after = await stateRow(db, f.candidateId);
  assert.equal(after.options_version, before.options_version + 1);
  assertSelectionUnchanged(after, before);
  assert.equal(await ownerJobs(f), 2);
});

// T6: exact retry while the request is current.
test('T6 exact retry current: same operationId, ready after completion, no second job', async () => {
  const fixture = await saved();
  await completeCommand(db, fixture.f, fixture.command);
  const choices = await ownerChoices(db, fixture.f);
  const key = randomUUID(), command = randomUUID();
  const first = await search(fixture.f, choices.requestGeneration, key, command);
  assert.notEqual(first.operationId, fixture.f.jobId);
  assert.equal(first.status, 'pending');
  const replay = await search(fixture.f, choices.requestGeneration, key, command);
  assert.equal(replay.operationId, first.operationId);
  assert.equal(replay.status, 'pending');
  assert.equal(await allJobs(fixture.f), 2);

  const claim = await claimViaCommand(db, fixture.f, first.operationId);
  const completion = await completeRequest(db, fixture.f, claim);
  assert.equal(completion.response.status, 'completed');
  const current = await ownerChoices(db, fixture.f);
  assert.equal(current.lookupStatus, 'ready');
  assert.equal(current.optionsVersion, first.optionsVersion + 1);
  assert.deepEqual(current.rows.map(option => option.optionId),
    completion.rows.map(option => option.optionId));
  const after = await search(fixture.f, choices.requestGeneration, key, command);
  assert.equal(after.operationId, first.operationId);
  assert.equal(after.status, 'ready');
  assert.equal(after.optionsVersion, current.optionsVersion);
  assert.equal(await allJobs(fixture.f), 2);
});

// T7: exact retry after supersession keeps the stored generation/version.
test('T7 exact retry superseded: stored generation/version, no job', async () => {
  const fixture = await saved();
  await completeCommand(db, fixture.f, fixture.command);
  const choices = await ownerChoices(db, fixture.f);
  const k1 = randomUUID(), c1 = randomUUID(), k2 = randomUUID(), c2 = randomUUID();
  const first = await search(fixture.f, choices.requestGeneration, k1, c1);
  assert.notEqual(first.operationId, fixture.f.jobId);
  assert.equal(first.status, 'pending');
  // The first request must finish before it can be superseded; a second Search
  // while it is pending correctly returns the same job and proves nothing here.
  const claim = await claimViaCommand(db, fixture.f, first.operationId);
  const completion = await completeRequest(db, fixture.f, claim);
  assert.equal(completion.response.status, 'completed');
  assert.equal((await ownerChoices(db, fixture.f)).lookupStatus, 'ready');
  const second = await search(fixture.f, choices.requestGeneration, k2, c2);
  assert.notEqual(second.operationId, first.operationId);
  const replay = await search(fixture.f, choices.requestGeneration, k1, c1);
  assert.equal(replay.operationId, first.operationId);
  assert.equal(replay.requestGeneration, first.requestGeneration);
  assert.equal(replay.optionsVersion, first.optionsVersion);
  assert.equal((await stateRow(db, fixture.f.candidateId)).request_id, second.operationId);
  assert.equal(await allJobs(fixture.f), 3);
});

// T8: a delayed pending receipt never replaces the V+2 SQL choices.
test('T8 delayed pending receipt never replaces the ready SQL choices', async () => {
  const fixture = await saved();
  await completeCommand(db, fixture.f, fixture.command);
  const choices = await ownerChoices(db, fixture.f);
  const key = randomUUID(), command = randomUUID();
  const pending = await search(fixture.f, choices.requestGeneration, key, command);
  assert.notEqual(pending.operationId, fixture.f.jobId);
  assert.equal(pending.status, 'pending');
  const claim = await claimViaCommand(db, fixture.f, pending.operationId);
  const completion = await completeRequest(db, fixture.f, claim);
  assert.equal(completion.response.status, 'completed');
  const current = await ownerChoices(db, fixture.f);
  assert.equal(current.lookupStatus, 'ready');
  assert.equal(current.optionsVersion, pending.optionsVersion + 1);
  assert.deepEqual(current.rows.map(option => option.optionId),
    completion.rows.map(option => option.optionId));
  const after = await search(fixture.f, choices.requestGeneration, key, command);
  assert.equal(after.operationId, pending.operationId);
  assert.equal(after.status, 'ready');
  assert.equal(after.optionsVersion, current.optionsVersion);
  assert.equal(await allJobs(fixture.f), 2);
});

// T9: ACP-9 control — must be green before and after M101.
test('T9 control ACP-9: OL automatic off, explicit on, real completion readable', async () => {
  const f = await seedCard(db);
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,
    automatic_role=NULL,automatic_order=NULL;
    UPDATE public.phase9_provider_registry SET enabled=true,matching_allowed=true,storage_allowed=true,
    explicit_search_allowed=true,explicit_role='primary',explicit_order=1,
    adapter_version='1.0.0',accepted_adapter_versions=ARRAY['1.0.0'],
    validation_contract='open-library-v1',policy_version=1
    WHERE adapter_key='open_library';
    UPDATE public.phase9_provider_registry SET explicit_search_allowed=false,explicit_role=NULL,
    explicit_order=NULL WHERE adapter_key='google_books';`);
  const pending = await search(f);
  assert.equal(pending.status, 'pending');
  const claim = await claimViaCommand(db, f, pending.operationId);
  const completion = await completeRequest(db, f, claim, { adapter: 'open_library' });
  assert.equal(completion.response.status, 'completed');
  const current = await ownerChoices(db, f);
  assert.equal(current.lookupStatus, 'ready');
  assert.deepEqual(current.rows.map(option => option.optionId),
    completion.rows.map(option => option.optionId));
  assert.equal(completion.response.optionsVersion, pending.optionsVersion + 1);
  await resetActor(db);
  const registry = await value(db, "SELECT jsonb_build_object('automatic',automatic_lookup_allowed,"
    + "'explicit',explicit_search_allowed) FROM public.phase9_provider_registry"
    + " WHERE adapter_key='open_library'");
  assert.deepEqual(registry, { automatic: false, explicit: true });
});

// T10: same key, different fingerprint — control.
test('T10 control same key different fingerprint', async () => {
  const f = await seedCard(db);
  const key = randomUUID();
  const first = await search(f, 0, key, randomUUID());
  assert.equal(first.status, 'pending');
  const before = await stateRow(db, f.candidateId);
  await assert.rejects(search(f, 0, key, randomUUID()), /P9_IDEMPOTENCY_MISMATCH/);
  assert.deepEqual(await stateRow(db, f.candidateId), before);
  assert.equal(await ownerJobs(f), 1);
  await resetActor(db);
  assert.equal(await value(db, "SELECT count(*)::int FROM public.phase9_idempotency_keys"
    + " WHERE actor_or_service=$1 AND operation='EP_LOOKUP_V1' AND idempotency_key=$2",
  [f.ownerId, key]), 1);
});

// T11: expected generation differs — control.
test('T11 control stale generation', async () => {
  const fixture = await saved();
  await completeCommand(db, fixture.f, fixture.command);
  await ownerChoices(db, fixture.f);
  const before = await stateRow(db, fixture.f.candidateId);
  const key = randomUUID();
  await assert.rejects(search(fixture.f, 7, key, randomUUID()), /P9_VERSION_CONFLICT/);
  assert.deepEqual(await stateRow(db, fixture.f.candidateId), before);
  assert.equal(await allJobs(fixture.f), 1);
  await resetActor(db);
  assert.equal(await value(db, "SELECT count(*)::int FROM public.phase9_idempotency_keys"
    + " WHERE actor_or_service=$1 AND operation='EP_LOOKUP_V1' AND idempotency_key=$2",
  [fixture.f.ownerId, key]), 0);
});

// T12: pending boundary — live final lease and expired earlier lease.
test('T12 control pending boundary: live final lease and expired earlier lease', async () => {
  const live = await seedCard(db);
  const liveFirst = await search(live);
  await exhaustViaCommands(live, liveFirst.operationId, { expire: false });
  assert.equal((await read(live)).lookupStatus, 'pending');
  const liveBefore = await stateRow(db, live.candidateId);
  const liveSecond = await search(live);
  assert.equal(liveSecond.operationId, liveFirst.operationId);
  assert.equal(liveSecond.status, 'pending');
  assert.equal((await stateRow(db, live.candidateId)).options_version, liveBefore.options_version);
  assert.equal(await ownerJobs(live), 1);

  const earlier = await seedCard(db);
  const earlierFirst = await search(earlier);
  const earlierClaim = await claimViaCommand(db, earlier, earlierFirst.operationId);
  await failViaCommand(db, earlier, earlierClaim, 'provider_unavailable', true);
  await moveRetryClock(earlierFirst.operationId);
  await claimViaCommand(db, earlier, earlierFirst.operationId);
  await expireLease(earlierFirst.operationId);
  assert.equal((await read(earlier)).lookupStatus, 'pending');
  const earlierBefore = await stateRow(db, earlier.candidateId);
  const earlierSecond = await search(earlier);
  assert.equal(earlierSecond.operationId, earlierFirst.operationId);
  assert.equal(earlierSecond.status, 'pending');
  assert.equal((await stateRow(db, earlier.candidateId)).options_version, earlierBefore.options_version);
  assert.equal(await ownerJobs(earlier), 1);
});

// T13: structural lock contract. Expected red before M101 exists (missing file).
test('T13 structural M101 uses FOR UPDATE NOWAIT and no lock/statement timeout', () => {
  const text = fs.readFileSync(migrationPath(M101), 'utf8');
  assert.match(text, /FOR\s+UPDATE\s+NOWAIT/i);
  assert.match(text, /lock_not_available[\s\S]*?RAISE\s+EXCEPTION\s+'P9_STATE_CONFLICT'/i);
  assert.doesNotMatch(text, /lock_timeout/i);
  assert.doesNotMatch(text, /statement_timeout/i);
});

// Native ACP-11 proofs: both exhausted-job-lock orders and Search vs Select.
const nativeOnly = { skip: !process.env.PHASE9_PROVIDER_NATIVE_PORT
  ? 'native two-connection proof only' : false };

async function nativeAs(client, { role, sub = '', app }) {
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,false),"
    + " set_config('request.jwt.claim.role',$2,false)", [sub, role]);
  await client.query(`SET ROLE ${role}`);
  await client.query(`SET application_name='${app}'`);
}

async function waitForBlock(observer, app, blockerPid) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const row = (await observer.query(`SELECT pid,wait_event_type,pg_blocking_pids(pid) blockers
      FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1
      AND wait_event_type='Lock'`, [app])).rows[0];
    if (row && row.blockers.includes(blockerPid)) return row;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('bounded barrier timed out: ' + app);
}

test('N1 native Search holds, Select arrives: Select conflicts, selection kept', nativeOnly, async () => {
  const fixture = await saved(2);
  await completeCommand(db, fixture.f, fixture.command);
  const choices = await ownerChoices(db, fixture.f);
  assert.equal(choices.rows.length, 2);
  const selected = await choose(fixture.f, choices, choices.rows[0].optionId);
  const before = await stateRow(db, fixture.f.candidateId);
  const connections = [];
  try {
    connections.push(await nativeConnection(db.database));
    connections.push(await nativeConnection(db.database));
    const [a, b] = connections;
    await resetActor(db);
    await nativeAs(a, { role: 'authenticated', sub: fixture.f.ownerId, app: 'fresh-search-holder' });
    await a.query('BEGIN');
    const pid = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await a.query(lookupSql(fixture.f, selected.requestGeneration, randomUUID(), randomUUID())
      + ' AS receipt');
    await nativeAs(b, { role: 'authenticated', sub: fixture.f.ownerId, app: 'fresh-select-contender' });
    const pending = b.query(selectSql(fixture.f, selected, choices.rows[1].optionId) + ' AS receipt')
      .then(result => ({ ok: true, receipt: result.rows[0].receipt }),
        error => ({ ok: false, error }));
    await waitForBlock(db, 'fresh-select-contender', pid);
    await a.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.ok, false, 'the second Select must lose to the Search fence');
    assert.match(String(outcome.error?.message ?? ''), /P9_VERSION_CONFLICT/);
    const current = await ownerChoices(db, fixture.f);
    assert.equal(current.lookupStatus, 'pending');
    assert.deepEqual(current.selection, selected.selection);
    assertSelectionUnchanged(await stateRow(db, fixture.f.candidateId), before);
    assert.deepEqual(current.rows, []);
    assert.equal(await allJobs(fixture.f), 2);
  } finally {
    await Promise.allSettled(connections.map(client => client.query('ROLLBACK')));
    await Promise.allSettled(connections.map(client => client.end()));
  }
});

test('N2 native Select holds, Search arrives: Search pending, selection kept', nativeOnly, async () => {
  const fixture = await saved();
  await completeCommand(db, fixture.f, fixture.command);
  const choices = await ownerChoices(db, fixture.f);
  const connections = [];
  try {
    connections.push(await nativeConnection(db.database));
    connections.push(await nativeConnection(db.database));
    const [a, b] = connections;
    await resetActor(db);
    await nativeAs(a, { role: 'authenticated', sub: fixture.f.ownerId, app: 'fresh-select-holder' });
    await a.query('BEGIN');
    const pid = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const selected = (await a.query(selectSql(fixture.f, choices, choices.rows[0].optionId)
      + ' AS receipt')).rows[0].receipt;
    assert.ok(selected.selection);
    await nativeAs(b, { role: 'authenticated', sub: fixture.f.ownerId, app: 'fresh-search-contender' });
    const pending = b.query(lookupSql(fixture.f, choices.requestGeneration, randomUUID(), randomUUID())
      + ' AS receipt').then(result => ({ ok: true, receipt: result.rows[0].receipt }),
      error => ({ ok: false, error }));
    await waitForBlock(db, 'fresh-search-contender', pid);
    await a.query('COMMIT');
    const before = await stateRow(db, fixture.f.candidateId);
    const outcome = await pending;
    assert.equal(outcome.ok, true);
    assert.equal(outcome.receipt.status, 'pending');
    const current = await ownerChoices(db, fixture.f);
    assert.equal(current.lookupStatus, 'pending');
    assert.deepEqual(current.selection, selected.selection);
    assertSelectionUnchanged(await stateRow(db, fixture.f.candidateId), before);
    assert.equal(await allJobs(fixture.f), 2);
  } finally {
    await Promise.allSettled(connections.map(client => client.query('ROLLBACK')));
    await Promise.allSettled(connections.map(client => client.end()));
  }
});

test('N3 native real sweep holds the exhausted job: immediate conflict, same key retries',
  nativeOnly, async () => {
    const f = await seedCard(db);
    const first = await search(f);
    await exhaustViaCommands(f, first.operationId);
    const before = await stateRow(db, f.candidateId);
    const connections = [];
    try {
      connections.push(await nativeConnection(db.database));
      connections.push(await nativeConnection(db.database));
      const [a, b] = connections;
      await resetActor(db);
      await nativeAs(a, { role: 'service_role', app: 'fresh-sweep-holder' });
      await a.query('BEGIN');
      const sweep = (await a.query('SELECT public.phase9_sweep_exhausted_metadata_jobs_v1(50) AS body'))
        .rows[0].body;
      assert.ok(sweep.jobIds.includes(first.operationId), 'real sweep must hold the tested job');
      await nativeAs(b, { role: 'authenticated', sub: f.ownerId, app: 'fresh-search-contender' });
      const key = randomUUID(), command = randomUUID();
      const pending = b.query(lookupSql(f, before.request_generation, key, command) + ' AS receipt')
        .then(result => ({ ok: true, receipt: result.rows[0].receipt }),
          error => ({ ok: false, error }));
      let timer;
      const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({ timeout: true }), 1500); });
      const outcome = await Promise.race([pending, timeout]);
      clearTimeout(timer);
      if (outcome.timeout) {
        await a.query('COMMIT');
        await pending;
        assert.fail('Search Books waited on the exhausted job lock');
      }
      assert.equal(outcome.ok, false);
      assert.match(String(outcome.error?.message ?? ''), /P9_STATE_CONFLICT/);
      await resetActor(db);
      assert.equal(await value(db, "SELECT count(*)::int FROM public.phase9_idempotency_keys"
        + " WHERE actor_or_service=$1 AND operation='EP_LOOKUP_V1' AND idempotency_key=$2",
      [f.ownerId, key]), 0);
      assert.equal((await jobRow(first.operationId)).status, 'in_progress');
      assert.deepEqual(await stateRow(db, f.candidateId), before);
      await a.query('COMMIT');
      const retry = await search(f, before.request_generation, key, command);
      assert.equal(retry.status, 'pending');
      assert.notEqual(retry.operationId, first.operationId);
      assert.equal((await jobRow(first.operationId)).status, 'dead_letter');
      assert.equal((await stateRow(db, f.candidateId)).options_version, before.options_version + 1);
    } finally {
      await Promise.allSettled(connections.map(client => client.query('ROLLBACK')));
      await Promise.allSettled(connections.map(client => client.end()));
    }
  });

test('N4 native Search holds first: real sweep skips the locked job, one replacement',
  nativeOnly, async () => {
    const f = await seedCard(db);
    const first = await search(f);
    const firstClaim = await claimViaCommand(db, f, first.operationId);
    await completeRequest(db, f, firstClaim);
    const choices = await ownerChoices(db, f);
    const selected = await choose(f, choices, choices.rows[0].optionId);
    const second = await search(f, choices.requestGeneration);
    assert.notEqual(second.operationId, first.operationId);
    await exhaustViaCommands(f, second.operationId);
    const before = await stateRow(db, f.candidateId);
    const connections = [];
    try {
      connections.push(await nativeConnection(db.database));
      connections.push(await nativeConnection(db.database));
      const [a, b] = connections;
      await resetActor(db);
      await nativeAs(a, { role: 'authenticated', sub: f.ownerId, app: 'fresh-recovery-holder' });
      await a.query('BEGIN');
      const recovery = (await a.query(lookupSql(f, choices.requestGeneration,
        randomUUID(), randomUUID()) + ' AS receipt')).rows[0].receipt;
      assert.equal(recovery.status, 'pending');
      await nativeAs(b, { role: 'service_role', app: 'fresh-sweep-contender' });
      const sweep = (await b.query('SELECT public.phase9_sweep_exhausted_metadata_jobs_v1(50) AS body'))
        .rows[0].body;
      assert.equal(sweep.jobIds.includes(second.operationId), false,
        'the real sweep must skip the Owner-locked job');
      await a.query('COMMIT');
      const current = await ownerChoices(db, f);
      assert.equal(current.lookupStatus, 'pending');
      assert.deepEqual(current.selection, selected.selection);
      const after = await stateRow(db, f.candidateId);
      assert.equal(after.request_id, recovery.operationId);
      assert.equal((await jobRow(second.operationId)).status, 'dead_letter');
      assert.equal(await ownerJobs(f), 3);
      assert.equal(after.options_version, before.options_version + 1);
      assertSelectionUnchanged(after, before);
    } finally {
      await Promise.allSettled(connections.map(client => client.query('ROLLBACK')));
      await Promise.allSettled(connections.map(client => client.end()));
    }
  });
