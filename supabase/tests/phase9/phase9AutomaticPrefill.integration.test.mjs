// 02d Unit 1a: save/read the automatic edition list (ACP-1/2/4/5/6/7/10/12/13).
// Disposable databases only; recorded provider evidence; no provider HTTP.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { clean, denied, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { beginAutomatic, olAutomaticRoute, retainedOlResult, singleReceipt }
  from './providerAutomaticReviewFixture.mjs';
import { lookupSql, readSql, row, scalar, seedCard, selectSql }
  from './editionPickerFixture.mjs';
import { nativeConnection } from './providerDatabaseHarness.mjs';
import {
  applyM100, completeCommand, createPrefillDatabase, helperExists, m100Present, ownerChoices,
  prefillHelper, recoverCommand, savedFixture, seedExplicitOptions, setCardIsbn, stateCount, stateRow,
} from './automaticPrefillFixture.mjs';
import { seedAutomaticLineage, claimJob } from './editionPickerFixture.mjs';

let db;
before(async () => { db = await createPrefillDatabase(); });
beforeEach(async () => { await clean(db); });
after(async () => { await db?.close(); });

async function completionCounts() {
  await resetActor(db);
  return {
    state: await value(db, 'SELECT count(*)::int FROM public.phase9_candidate_edition_state'),
    effects: await value(db, 'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects'),
    cache: await value(db, 'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'),
  };
}

// T1: ACP-1 reachable path — retained Open Library winner, no prior state row.
test('T1 ACP-1 retained OL winner saves rows and the Owner read is ready', async () => {
  const fixture = await savedFixture(db, { beginAutomatic, retainedOlResult, olAutomaticRoute });
  await resetActor(db);
  const before = await value(db, 'SELECT count(*)::int FROM public.image_extraction_jobs');
  const versionBefore = await value(db, 'SELECT version FROM public.image_extraction_candidates WHERE id=$1',
    [fixture.f.candidateId]);
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.prefill.status, 'saved');
  assert.equal(receipt.prefill.requestId, fixture.f.jobId);
  assert.equal(receipt.prefill.requestGeneration, 0);
  assert.equal(receipt.prefill.optionsVersion, 1);
  assert.equal(await value(db, 'SELECT version FROM public.image_extraction_candidates WHERE id=$1',
    [fixture.f.candidateId]), versionBefore, 'completion does not bump the candidate version');
  const saved = await stateRow(db, fixture.f.candidateId);
  assert.ok(saved, 'the saved edition-state row exists');
  assert.deepEqual(saved.options, fixture.command.result.rows);
  assert.equal(saved.request_id, fixture.f.jobId);
  assert.equal(saved.request_generation, 0);
  assert.equal(saved.options_version, 1);
  assert.equal(saved.selection_id, null);
  assert.equal(saved.source_lookup_id, fixture.f.lookupId);
  assert.equal(saved.source_attempt_id, fixture.f.attemptId);
  // The supplied one-hour deadline is the minimum and must survive exactly.
  assert.equal(Date.parse(saved.source_fetched_at),
    Date.parse(fixture.command.result.retention.sourceFetchedAt));
  assert.equal(Date.parse(saved.options_expires_at),
    Date.parse(fixture.command.result.retention.permittedDeadlineAt));
  assert.equal(Date.parse(receipt.prefill.optionsExpiresAt), Date.parse(saved.options_expires_at));
  assert.ok(Date.parse(saved.options_expires_at) <= Date.parse(saved.source_fetched_at) + 24 * 60 * 60 * 1000);
  const choices = await ownerChoices(db, fixture.f);
  assert.equal(choices.lookupStatus, 'ready');
  assert.equal(choices.requestGeneration, 0);
  assert.equal(choices.optionsVersion, 1);
  assert.equal(choices.queryLanguage, 'en');
  assert.deepEqual(choices.rows.map(r => r.optionId), fixture.command.result.rows.map(r => r.optionId));
  assert.deepEqual(choices.rows.map(r => r.ordinal), [0]);
  await resetActor(db);
  assert.equal(await value(db, 'SELECT count(*)::int FROM public.image_extraction_jobs'), before);
});

// T2: defensive — no valid command leaves a state row on a processing card.
test('T2 defensive existing untouched row updates in place without a generation bump', async () => {
  const f = await seedCard(db);
  await setCardIsbn(db, f, '9780306406157');
  await setCardIsbn(db, f, null);
  const prior = await stateRow(db, f.candidateId);
  assert.ok(prior, 'ISBN set-then-clear created an untouched state row via valid commands');
  assert.equal(prior.request_id, null);
  assert.equal(prior.options_version, 0);
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0', card: f });
  await retainedOlResult(db, fixture, 1);
  const result = await prefillHelper(db, {
    candidateId: f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
    attemptId: fixture.f.attemptId, rows: fixture.command.result.rows,
    fetched: fixture.command.result.retention.sourceFetchedAt,
    deadline: fixture.command.result.retention.permittedDeadlineAt,
    generation: prior.request_generation,
  });
  assert.equal(result.status, 'saved');
  assert.equal(result.requestGeneration, prior.request_generation);
  assert.equal(result.optionsVersion, prior.options_version + 1);
  const saved = await stateRow(db, f.candidateId);
  assert.equal(saved.request_generation, prior.request_generation);
  assert.equal(saved.request_id, fixture.f.jobId);
  assert.deepEqual(saved.options, fixture.command.result.rows);
  assert.deepEqual(saved.options.map(r => r.optionId), fixture.command.result.rows.map(r => r.optionId));
});

// T3: original positions, UUIDs, eligibility and an unavailable row survive.
test('T3 exact rows keep positions UUIDs eligibility and the unavailable slot', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, 3);
  const rows = fixture.command.result.rows;
  rows[1].eligibility = 'unavailable';
  rows[1].metadata = null;
  rows[1].googleBooksUrl = null;
  fixture.command.result.catalogueCompanions = null;
  fixture.command.result.outcome.candidates = [rows[0].metadata, rows[2].metadata];
  fixture.command.result.outcome.selected = null;
  fixture.command.result.outcome.outcome = 'ambiguous_match';
  fixture.command.result.outcome.evidence = [];
  fixture.command.result.outcome.secondaryEligible = true;
  fixture.command.selectedOptionId = null;
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.status, 'completed');
  const saved = await stateRow(db, fixture.f.candidateId);
  assert.ok(saved, 'the saved edition-state row exists');
  assert.deepEqual(saved.options, rows);
  assert.deepEqual(saved.options.map(r => r.optionId), rows.map(r => r.optionId));
  assert.deepEqual(saved.options.map(r => r.ordinal), [0, 1, 2]);
  assert.deepEqual(saved.options.map(r => r.eligibility), ['eligible', 'unavailable', 'eligible']);
  const choices = await ownerChoices(db, fixture.f);
  assert.deepEqual(choices.rows.map(r => r.optionId), rows.map(r => r.optionId));
});

// T4: control — the existing entry validator rejects every malformed list shape.
test('T4 control malformed duplicate bad-ordinal and over-10 lists stay P9_AUTO_COMMAND_INVALID', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, 1);
  const original = JSON.parse(JSON.stringify(fixture.command.result.rows[0]));
  const reject = async rows => {
    fixture.command.result.rows = rows;
    await assert.rejects(completeCommand(db, fixture.f, fixture.command), /P9_AUTO_COMMAND_INVALID/);
    assert.deepEqual(await completionCounts(), { state: 0, effects: 0, cache: 0 });
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1',
      [fixture.f.jobId]), 'in_progress');
  };
  // Duplicate only the UUID: ordinal 1 keeps the positional rule satisfied.
  await reject([original, { ...original, ordinal: 1 }]);
  // Shape mutation: one extra key is not the exact five-key row.
  await reject([{ ...original, rejectingReason: 'invented' }]);
  // Isolated bad ordinal: a single row must be ordinal 0.
  await reject([{ ...original, optionId: randomUUID(), ordinal: 5 }]);
  // Over the ten-row bound with otherwise valid rows.
  await reject(Array.from({ length: 11 }, (_, ordinal) => ({ ...original, optionId: randomUUID(), ordinal })));
  // Bad link scheme is not an allowed Google Books URL.
  await reject([{ ...original, googleBooksUrl: 'https://example.com/books?id=x' }]);
});

// T5: defensive — a crossed job/lookup binding never writes.
test('T5 defensive crossed lookup and job binding raises P9_AUTO_SOURCE_INVALID', async () => {
  await olAutomaticRoute(db);
  const first = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  const second = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await assert.rejects(prefillHelper(db, {
    candidateId: first.f.candidateId, jobId: first.f.jobId, lookupId: second.f.lookupId,
    attemptId: second.f.attemptId, rows: null, generation: 0,
  }), /P9_AUTO_SOURCE_INVALID/);
});

// T6: control — a stored before-install receipt survives the upgrade unchanged.
test('T6 control old not_installed receipt replays unchanged after the M95-M100 upgrade', async () => {
  const pre = await createPrefillDatabase({ preInstall: true });
  try {
    assert.equal(await helperExists(pre), false, 'pre-install baseline must not contain M100');
    const fixture = await beginAutomatic(pre);
    await singleReceipt(pre, fixture);
    const receipt = await completeCommand(pre, fixture.f, fixture.command);
    assert.deepEqual(receipt.prefill, { status: 'skipped', reason: 'not_installed' });
    await applyM100(pre);
    assert.equal(await helperExists(pre), m100Present(),
      'helper presence after the upgrade matches M100 availability');
    const replayed = await recoverCommand(pre, fixture.command.fence);
    assert.deepEqual(replayed, { ...receipt, status: 'replayed' });
    assert.deepEqual(replayed.prefill, { status: 'skipped', reason: 'not_installed' });
  } finally { await pre.close(); }
});

// T6b: new behavior — after installation a retainable completion saves.
test('T6b post-upgrade retainable completion saves on the upgraded database', async () => {
  const pre = await createPrefillDatabase({ preInstall: true });
  try {
    assert.equal(await helperExists(pre), false, 'pre-install baseline must not contain M100');
    const old = await beginAutomatic(pre);
    await singleReceipt(pre, old);
    const before = await completeCommand(pre, old.f, old.command);
    assert.deepEqual(before.prefill, { status: 'skipped', reason: 'not_installed' });
    await applyM100(pre);
    assert.equal(await helperExists(pre), m100Present(),
      'helper presence after the upgrade matches M100 availability');
    await olAutomaticRoute(pre);
    const next = await beginAutomatic(pre, { key: 'open_library', version: '2.0.0' });
    await retainedOlResult(pre, next, 1);
    const saved = await completeCommand(pre, next.f, next.command);
    assert.equal(saved.prefill.status, 'saved');
    const read = await ownerChoices(pre, next.f);
    assert.equal(read.lookupStatus, 'ready');
    assert.deepEqual(read.rows.map(r => r.optionId), next.command.result.rows.map(r => r.optionId));
  } finally { await pre.close(); }
});

// T7: replay keeps one version and the same UUIDs; only status is normalised.
test('T7 replay keeps one version and the same saved UUIDs', async () => {
  const fixture = await savedFixture(db, { beginAutomatic, retainedOlResult, olAutomaticRoute });
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.prefill.status, 'saved');
  const first = await stateRow(db, fixture.f.candidateId);
  const replayed = await recoverCommand(db, fixture.command.fence);
  assert.deepEqual(replayed, { ...receipt, status: 'replayed' });
  const afterReplay = await stateRow(db, fixture.f.candidateId);
  assert.deepEqual(afterReplay.options, first.options);
  assert.equal(afterReplay.options_version, first.options_version);
  assert.equal(afterReplay.request_generation, first.request_generation);
  assert.equal(await value(db, 'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects'), 1);
});

// T8: ACP-7 — a no-list Google completion still commits and skips no_retention.
test('T8 no-list Google completion commits and records no_retention', async () => {
  const fixture = await beginAutomatic(db);
  await singleReceipt(db, fixture);
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.deepEqual(receipt.prefill, { status: 'skipped', reason: 'no_retention' });
  assert.equal(await value(db, 'SELECT state FROM public.image_extraction_candidates WHERE id=$1',
    [fixture.f.candidateId]), 'ready');
  assert.equal(await stateCount(db, fixture.f.candidateId), 0);
  assert.ok(receipt.snapshotId);
});

// T9-T15: defensive skip table (helper-level; no valid completion reaches these states).
// Each skip must leave the entire state row byte-identical.
async function skipPreserved(candidateId, call, reason) {
  const before = await stateRow(db, candidateId);
  assert.deepEqual(await prefillHelper(db, call), { status: 'skipped', reason });
  assert.deepEqual(await stateRow(db, candidateId), before, reason + ' must not change the state row');
}

test('T9 defensive an Owner selection is never overwritten', async () => {
  const f = await seedCard(db);
  const seeded = await seedExplicitOptions(db, f, [row(), row(1)]);
  const selected = await scalar(db, selectSql(f, seeded.choices, seeded.choices.rows[0].optionId));
  assert.ok(selected.selection);
  await skipPreserved(f.candidateId, {
    candidateId: f.candidateId, jobId: seeded.receipt.operationId, lookupId: seeded.lookupId,
    attemptId: seeded.attemptId, rows: null, generation: 0,
  }, 'selected');
  const state = await stateRow(db, f.candidateId);
  assert.equal(state.selection_id, selected.selection.selectionId);
});

test('T10 defensive any non-null state request makes the save superseded', async () => {
  const f = await seedCard(db);
  const seeded = await seedExplicitOptions(db, f, [row()]);
  const state = await stateRow(db, f.candidateId);
  assert.equal(state.request_id, seeded.receipt.operationId);
  // Same-job control: the state's own request still matches the non-null rule.
  await skipPreserved(f.candidateId, {
    candidateId: f.candidateId, jobId: seeded.receipt.operationId, lookupId: seeded.lookupId,
    attemptId: seeded.attemptId, rows: null, generation: state.request_generation,
  }, 'superseded');
});

test('T10b defensive a distinct automatic request on the state is superseded', async () => {
  const f = await seedCard(db);
  const seeded = await seedExplicitOptions(db, f, [row()]);
  const state = await stateRow(db, f.candidateId);
  await olAutomaticRoute(db);
  const other = await beginAutomatic(db, { key: 'open_library', version: '2.0.0', card: f });
  assert.notEqual(other.f.jobId, state.request_id, 'the contender is a different request');
  await skipPreserved(f.candidateId, {
    candidateId: f.candidateId, jobId: other.f.jobId, lookupId: other.f.lookupId,
    attemptId: other.f.attemptId, rows: null, generation: state.request_generation,
  }, 'superseded');
});

test('T11 defensive removed skipped and committed cards are never written', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, 1);
  for (const candidatePatch of [{ review_disposition: 'owner_removed_from_scan' },
    { review_disposition: 'skipped_false_detection' }, { committed_inventory_id: randomUUID() }]) {
    await skipPreserved(fixture.f.candidateId, {
      candidateId: fixture.f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
      attemptId: fixture.f.attemptId, rows: fixture.command.result.rows,
      fetched: fixture.command.result.retention.sourceFetchedAt,
      deadline: fixture.command.result.retention.permittedDeadlineAt,
      generation: 0, candidatePatch,
    }, 'not_reviewable');
  }
  assert.equal(await stateCount(db, fixture.f.candidateId), 0);
});

test('T12 defensive a stale fetched identity is never saved', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await skipPreserved(fixture.f.candidateId, {
    candidateId: fixture.f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
    attemptId: fixture.f.attemptId, rows: null, generation: 0,
    lookupPatch: { query_identity: 'stale-identity' },
  }, 'identity_mismatch');
});

test('T13 defensive a Google list is never saved', async () => {
  const fixture = await beginAutomatic(db);
  const metadata = fixture.command.result.outcome.selected;
  const rows = [{ optionId: randomUUID(), ordinal: 0, eligibility: 'eligible',
    googleBooksUrl: 'https://books.google.com/books?id=same-record', metadata: { ...metadata } }];
  await skipPreserved(fixture.f.candidateId, {
    candidateId: fixture.f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
    attemptId: fixture.f.attemptId, rows,
    fetched: metadata.fetchedAt,
    deadline: new Date(Date.parse(metadata.fetchedAt) + 3600000).toISOString(), generation: 0,
  }, 'source_not_allowed');
});

// First-match rule 5: an empty list without any fetched/deadline proof is no_retention,
// not empty_unproven. The latter only applies to an empty list that carries proof fields.
test('T14 defensive an empty list without retention proof skips no_retention', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await skipPreserved(fixture.f.candidateId, {
    candidateId: fixture.f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
    attemptId: fixture.f.attemptId, rows: [], generation: 0,
  }, 'no_retention');
});

test('T14b defensive an empty list with untruthful proof skips empty_unproven', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  // Proof fields are present but the fetched time is in the future, so the pair
  // cannot be truthful. Rule 5 is about absent proof; rule 7 about unproven empties.
  const fetched = new Date(Date.now() + 3600000).toISOString();
  await skipPreserved(fixture.f.candidateId, {
    candidateId: fixture.f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
    attemptId: fixture.f.attemptId, rows: [], generation: 0,
    fetched, deadline: new Date(Date.parse(fetched) + 3600000).toISOString(),
  }, 'empty_unproven');
});

test('T15 defensive skip precedence follows the table order', async () => {
  const selectedCard = await seedCard(db);
  const seeded = await seedExplicitOptions(db, selectedCard, [row(), row(1)]);
  const selected = await scalar(db, selectSql(selectedCard, seeded.choices, seeded.choices.rows[0].optionId));
  assert.ok(selected.selection);
  await skipPreserved(selectedCard.candidateId, {
    candidateId: selectedCard.candidateId, jobId: seeded.receipt.operationId,
    lookupId: seeded.lookupId, attemptId: seeded.attemptId, rows: null, generation: 0,
  }, 'selected');
  // Rule 5 before rule 6: an empty Google list without proof is no_retention.
  const googleNoProof = await beginAutomatic(db);
  await skipPreserved(googleNoProof.f.candidateId, {
    candidateId: googleNoProof.f.candidateId, jobId: googleNoProof.f.jobId,
    lookupId: googleNoProof.f.lookupId, attemptId: googleNoProof.f.attemptId,
    rows: [], generation: 0,
  }, 'no_retention');
  // Rule 6 before rule 7: with truthful retention proof the Google source is refused.
  const googleProven = await beginAutomatic(db);
  const evidence = googleProven.command.result.outcome.selected;
  await skipPreserved(googleProven.f.candidateId, {
    candidateId: googleProven.f.candidateId, jobId: googleProven.f.jobId,
    lookupId: googleProven.f.lookupId, attemptId: googleProven.f.attemptId,
    rows: [], fetched: evidence.fetchedAt,
    deadline: new Date(Date.parse(evidence.fetchedAt) + 3600000).toISOString(), generation: 0,
  }, 'source_not_allowed');
  const explicitCard = await seedCard(db);
  const explicit = await seedExplicitOptions(db, explicitCard, [row()]);
  await skipPreserved(explicitCard.candidateId, {
    candidateId: explicitCard.candidateId, jobId: explicit.receipt.operationId,
    lookupId: explicit.lookupId, attemptId: explicit.attemptId, rows: null, generation: 0,
  }, 'superseded');
  const removed = await beginAutomatic(db);
  await skipPreserved(removed.f.candidateId, {
    candidateId: removed.f.candidateId, jobId: removed.f.jobId, lookupId: removed.f.lookupId,
    attemptId: null, rows: null, generation: 0,
    candidatePatch: { review_disposition: 'owner_removed_from_scan' },
  }, 'not_reviewable');
});

// T16: ACP-12/7 — saved list is ready, expiry and provider disable are idle.
test('T16 read is ready then idle after expiry and after provider disable', async () => {
  const fixture = await savedFixture(db, { beginAutomatic, retainedOlResult, olAutomaticRoute });
  // Historical fetch with a short, initially valid deadline: the table CHECK
  // (options_expires_at >= source_fetched_at) stays satisfied and the read goes
  // idle only after real time passes.
  const fetched = new Date(Date.now() - 5000).toISOString();
  const deadline = new Date(Date.now() + 1500).toISOString();
  fixture.command.result.retention = { ...fixture.command.result.retention,
    sourceFetchedAt: fetched, permittedDeadlineAt: deadline };
  for (const option of fixture.command.result.rows) {
    // In-place: outcome.selected/candidates share these metadata objects.
    option.metadata.fetchedAt = fetched;
  }
  for (const companion of fixture.command.result.catalogueCompanions) {
    companion.fetchedAt = fixture.command.result.rows
      .find(option => option.optionId === companion.optionId).metadata.fetchedAt;
  }
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.prefill.status, 'saved');
  assert.equal(Date.parse(receipt.prefill.optionsExpiresAt), Date.parse(deadline));
  assert.equal((await ownerChoices(db, fixture.f)).lookupStatus, 'ready');
  const savedState = await stateRow(db, fixture.f.candidateId);
  await new Promise(resolve => setTimeout(resolve, 1800));
  const expired = await ownerChoices(db, fixture.f);
  assert.equal(expired.lookupStatus, 'idle');
  assert.deepEqual(expired.rows, []);
  // ACP-5: replaying after expiry restores no rows and preserves the stored state.
  const replayed = await recoverCommand(db, fixture.command.fence);
  assert.deepEqual(replayed, { ...receipt, status: 'replayed' });
  assert.deepEqual(await stateRow(db, fixture.f.candidateId), savedState);
  const stillIdle = await ownerChoices(db, fixture.f);
  assert.equal(stillIdle.lookupStatus, 'idle');
  assert.deepEqual(stillIdle.rows, []);
  const second = await beginAutomatic(db, { key: 'open_library', version: '2.0.0', card: await seedCard(db) });
  await retainedOlResult(db, second, 1);
  const saved = await completeCommand(db, second.f, second.command);
  assert.equal(saved.prefill.status, 'saved');
  assert.equal((await ownerChoices(db, second.f)).lookupStatus, 'ready');
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='open_library'");
  const disabled = await ownerChoices(db, second.f);
  assert.equal(disabled.lookupStatus, 'idle');
  assert.deepEqual(disabled.rows, []);
});

// T18a: control — the edition-state table ACL is already closed before M100 exists.
test('T18a control edition-state table ACL stays closed', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      assert.equal(await value(db, 'SELECT has_table_privilege($1,$2,$3)',
        [role, 'public.phase9_candidate_edition_state', privilege]), false, role + ':' + privilege);
    }
  }
});

// T18: helper existence is installation evidence; ACL is checked only after install.
test('T18 helper exists and post-install effective privileges are closed', async () => {
  const signature = 'marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer)';
  const oid = await value(db, 'SELECT to_regprocedure($1)::oid', [signature]);
  assert.ok(oid, 'M100 helper must exist before ACL assertions (installation evidence)');
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await value(db, "SELECT has_function_privilege($1,$2::oid,'EXECUTE')", [role, oid]), false, role);
  }
  const call = 'SELECT marketplace_sec.phase9_prefill_automatic_editions_v1(NULL::public.image_extraction_candidates,NULL::public.image_extraction_jobs,NULL::public.phase9_metadata_lookups,NULL::public.metadata_enrichment_attempts,NULL::jsonb,NULL::timestamptz,NULL::timestamptz,0)';
  await denied(db, 'anon', call);
  await denied(db, 'authenticated', call);
});

// T20: control — no Owner command can overlap the automatic lookup.
test('T20 control Owner search select and ISBN are refused while processing', async () => {
  const fixture = await beginAutomatic(db);
  await setActor(db, fixture.f.ownerId);
  await assert.rejects(value(db, lookupSql(fixture.f)), /P9_STATE_CONFLICT/);
  await assert.rejects(value(db, selectSql(fixture.f,
    { candidateVersion: 1, metadataRevision: 1, reviewVersion: null, optionsVersion: 1 }, randomUUID())),
  /P9_STATE_CONFLICT/);
  const isbn = "SELECT public.phase9_set_candidate_isbn_v1('" + fixture.f.sessionId + "','"
    + fixture.f.candidateId + "','" + randomUUID() + "','" + randomUUID() + "',1,'9780306406157')";
  await assert.rejects(value(db, isbn), /P9_STATE_CONFLICT/);
});

// T21: ACP-6 — saved automatic lists stay private and add no cache/full-list reuse.
test('T21 ACP-6 saved list is private and adds no cache or full-list reuse', async () => {
  await olAutomaticRoute(db);
  assert.equal(await value(db, "SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('open_library')"), true,
    'the shared catalogue policy is available, so the negative checks below are meaningful');
  const fixture = await savedFixture(db, { beginAutomatic, retainedOlResult, olAutomaticRoute });
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.prefill.status, 'saved');
  assert.equal((await ownerChoices(db, fixture.f)).lookupStatus, 'ready');
  await resetActor(db);
  // Positive scan-origin publication: only the winner/companion linkage is written.
  const companions = (await db.query(
    'SELECT option_id,store_id FROM marketplace_sec.phase9_catalogue_companions WHERE lookup_id=$1',
    [fixture.f.lookupId])).rows;
  assert.equal(companions.length, fixture.command.result.rows.length);
  assert.deepEqual(companions.map(c => c.option_id).sort(),
    fixture.command.result.rows.map(r => r.optionId).sort());
  for (const companion of companions) assert.equal(companion.store_id, fixture.f.storeId);
  // Negative private/full-list controls: no shared cache entry and nothing cross-store.
  assert.equal(await value(db, 'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'), 0);
  assert.equal(await value(db, 'SELECT count(*)::int FROM public.phase9_candidate_edition_state WHERE store_id<>$1',
    [fixture.f.storeId]), 0);
  const effect = await value(db, 'SELECT to_jsonb(e) FROM marketplace_sec.phase9_catalogue_lookup_effects e WHERE e.lookup_id=$1', [fixture.f.lookupId]);
  assert.ok(effect, 'the existing private completion effect stays');
  assert.equal(effect.cache_entry_id, null);
  // The automatic run stays external and consumes no cached edition list.
  const runLookup = (await db.query(
    'SELECT execution_mode FROM public.phase9_metadata_lookups WHERE job_id=$1', [fixture.f.jobId])).rows;
  assert.deepEqual(runLookup.map(r => r.execution_mode), ['external']);
  await denied(db, 'anon', 'SELECT options FROM public.phase9_candidate_edition_state');
  await denied(db, 'authenticated', 'SELECT options FROM public.phase9_candidate_edition_state');
});

// Native ACP-4: removal and session lifecycle overlaps on the same migrated clone.
const nativeOnly = { skip: !process.env.PHASE9_PROVIDER_NATIVE_PORT ? 'native two-connection proof only' : false };

async function nativeAs(client, { role, sub = '', app }) {
  await client.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role',$2,false)", [sub, role]);
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

async function nativeSavedFixture() {
  const fixture = await savedFixture(db, { beginAutomatic, retainedOlResult, olAutomaticRoute });
  return fixture;
}

test('T19 ACP-4 native removal before completion is refused with no saved list', nativeOnly, async () => {
  const fixture = await nativeSavedFixture();
  const a = await nativeConnection(db.database), b = await nativeConnection(db.database);
  try {
    await resetActor(db);
    const version = await value(db, 'SELECT version FROM public.image_extraction_candidates WHERE id=$1', [fixture.f.candidateId]);
    await nativeAs(a, { role: 'authenticated', sub: fixture.f.ownerId, app: 'prefill-holder' });
    await a.query('BEGIN');
    const pid = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await a.query('SELECT public.phase9_owner_remove_candidate_v1($1,$2,$3,$4,$5)',
      [fixture.f.sessionId, fixture.f.candidateId, version, 'remove-command-0001', randomUUID()]);
    await nativeAs(b, { role: 'service_role', app: 'prefill-contender' });
    const pending = b.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(fixture.command)]).then(r => ({ ok: true, receipt: r.rows[0].receipt }), error => ({ ok: false, error }));
    await waitForBlock(db, 'prefill-contender', pid);
    await a.query('COMMIT');
    const outcome = await pending;
    // Recovery observes the bounded removal before structural validation: a
    // definite stale receipt, not a thrown conflict and not a saved list.
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.receipt, { status: 'stale_rejected' });
    assert.equal(await stateCount(db, fixture.f.candidateId), 0);
    assert.equal(await value(db, 'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects'), 0);
    assert.equal(await value(db, 'SELECT version FROM public.image_extraction_candidates WHERE id=$1',
      [fixture.f.candidateId]), version + 1);
  } finally { await a.end(); await b.end(); }
});

test('T19 ACP-4 native completion before removal saves then clears the persisted state', nativeOnly, async () => {
  const fixture = await nativeSavedFixture();
  const a = await nativeConnection(db.database), b = await nativeConnection(db.database);
  try {
    await resetActor(db);
    const version = await value(db, 'SELECT version FROM public.image_extraction_candidates WHERE id=$1', [fixture.f.candidateId]);
    await nativeAs(a, { role: 'service_role', app: 'prefill-holder' });
    await a.query('BEGIN');
    const pid = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const completed = (await a.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(fixture.command)])).rows[0].receipt;
    assert.equal(completed.status, 'completed');
    assert.equal(completed.prefill.status, 'saved');
    // INFO: the completion advances metadata_revision, never candidate version.
    assert.equal((await a.query('SELECT version FROM public.image_extraction_candidates WHERE id=$1',
      [fixture.f.candidateId])).rows[0].version, version);
    await nativeAs(b, { role: 'authenticated', sub: fixture.f.ownerId, app: 'prefill-contender' });
    const pending = b.query('SELECT public.phase9_owner_remove_candidate_v1($1,$2,$3,$4,$5) AS result',
      [fixture.f.sessionId, fixture.f.candidateId, version, 'remove-command-0002', randomUUID()])
      .then(r => ({ ok: true, result: r.rows[0].result }), error => ({ ok: false, error }));
    await waitForBlock(db, 'prefill-contender', pid);
    await a.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.ok, true);
    assert.equal(outcome.result.reviewDisposition, 'owner_removed_from_scan');
    const state = await stateRow(db, fixture.f.candidateId);
    assert.deepEqual(state.options, []);
    assert.equal(state.request_id, null);
    assert.equal(state.selection_id, null);
    assert.equal(state.request_generation, 1);
    await setActor(db, fixture.f.ownerId);
    await assert.rejects(value(db, readSql(fixture.f)), /P9_STATE_CONFLICT/);
    const replayed = await recoverCommand(db, fixture.command.fence);
    assert.deepEqual(replayed, { ...completed, status: 'replayed' });
  } finally { await a.end(); await b.end(); }
});

test('T19b ACP-4 native session close before completion is stale_rejected', nativeOnly, async () => {
  const fixture = await nativeSavedFixture();
  const a = await nativeConnection(db.database), b = await nativeConnection(db.database);
  try {
    await resetActor(db);
    const sessionVersion = await value(db, 'SELECT version FROM public.image_extraction_sessions WHERE id=$1', [fixture.f.sessionId]);
    await nativeAs(a, { role: 'authenticated', sub: fixture.f.ownerId, app: 'prefill-holder' });
    await a.query('BEGIN');
    const pid = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await a.query('SELECT public.phase9_close_session_v3($1,$2,$3,$4)',
      [fixture.f.sessionId, sessionVersion, 'close-command-0001', randomUUID()]);
    await nativeAs(b, { role: 'service_role', app: 'prefill-contender' });
    const pending = b.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(fixture.command)]).then(r => ({ ok: true, receipt: r.rows[0].receipt }), error => ({ ok: false, error }));
    await waitForBlock(db, 'prefill-contender', pid);
    await a.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.receipt, { status: 'stale_rejected' });
    assert.equal(await stateCount(db, fixture.f.candidateId), 0);
  } finally { await a.end(); await b.end(); }
});

test('T19b ACP-4 native completion before session close saves then the read conflicts', nativeOnly, async () => {
  const fixture = await nativeSavedFixture();
  const a = await nativeConnection(db.database), b = await nativeConnection(db.database);
  try {
    await resetActor(db);
    const sessionVersion = await value(db, 'SELECT version FROM public.image_extraction_sessions WHERE id=$1', [fixture.f.sessionId]);
    await nativeAs(a, { role: 'service_role', app: 'prefill-holder' });
    await a.query('BEGIN');
    const pid = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const completed = (await a.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(fixture.command)])).rows[0].receipt;
    assert.equal(completed.prefill.status, 'saved');
    await nativeAs(b, { role: 'authenticated', sub: fixture.f.ownerId, app: 'prefill-contender' });
    const pending = b.query('SELECT public.phase9_close_session_v3($1,$2,$3,$4) AS result',
      [fixture.f.sessionId, sessionVersion, 'close-command-0002', randomUUID()])
      .then(r => ({ ok: true, result: r.rows[0].result }), error => ({ ok: false, error }));
    await waitForBlock(db, 'prefill-contender', pid);
    await a.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.ok, true);
    await setActor(db, fixture.f.ownerId);
    await assert.rejects(value(db, readSql(fixture.f)), /P9_STATE_CONFLICT/);
    const state = await stateRow(db, fixture.f.candidateId);
    assert.equal(state.options_version, 1);
    assert.ok(state.request_id);
    const replayed = await recoverCommand(db, fixture.command.fence);
    assert.deepEqual(replayed, { ...completed, status: 'replayed' });
  } finally { await a.end(); await b.end(); }
});

test('T19c ACP-4 native session expiry orderings', nativeOnly, async () => {
  const fixture = await nativeSavedFixture();
  const a = await nativeConnection(db.database), b = await nativeConnection(db.database);
  try {
    await nativeAs(a, { role: 'service_role', app: 'prefill-expiry' });
    const completed = (await a.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(fixture.command)])).rows[0].receipt;
    assert.equal(completed.prefill.status, 'saved');
    await resetActor(db);
    await db.query("UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [fixture.f.sessionId]);
    await nativeAs(b, { role: 'authenticated', sub: fixture.f.ownerId, app: 'prefill-expiry-owner' });
    const read = await b.query('SELECT public.phase9_owner_candidate_edition_choices_v1($1,$2) AS choices',
      [fixture.f.sessionId, fixture.f.candidateId])
      .then(r => ({ ok: true, choices: r.rows[0].choices }), error => ({ ok: false, error }));
    assert.equal(read.ok, false);
    assert.match(String(read.error?.message ?? ''), /P9_STATE_CONFLICT/);
    assert.deepEqual(await recoverCommand(db, fixture.command.fence), { ...completed, status: 'replayed' });
    const second = await nativeSavedFixture();
    await resetActor(db);
    await db.query("UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [second.f.sessionId]);
    await nativeAs(a, { role: 'service_role', app: 'prefill-expiry' });
    const stale = await a.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(second.command)]).then(r => r.rows[0].receipt, error => ({ error }));
    assert.deepEqual(stale, { status: 'stale_rejected' });
    assert.equal(await stateCount(db, second.f.candidateId), 0);
  } finally { await a.end(); await b.end(); }
});

test('T19d ACP-4 native completion crossing session expiry is stale_rejected with zero effects', nativeOnly, async () => {
  const fixture = await nativeSavedFixture();
  const blocker = await nativeConnection(db.database), completion = await nativeConnection(db.database);
  try {
    await resetActor(db);
    // Short but initially valid session deadline; the completion will be blocked
    // on the job row until after this deadline passes.
    await db.query("UPDATE public.image_extraction_sessions SET expires_at=clock_timestamp()+interval '1500 milliseconds' WHERE id=$1",
      [fixture.f.sessionId]);
    await nativeAs(blocker, { role: 'postgres', app: 'prefill-expiry-blocker' });
    await blocker.query('BEGIN');
    const pid = (await blocker.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    await blocker.query('SELECT 1 FROM public.image_extraction_jobs WHERE id=$1 FOR UPDATE', [fixture.f.jobId]);
    await nativeAs(completion, { role: 'service_role', app: 'prefill-expiry-contender' });
    const pending = completion.query('SELECT public.phase9_complete_automatic_metadata_v1($1::jsonb) AS receipt',
      [JSON.stringify(fixture.command)]).then(r => ({ ok: true, receipt: r.rows[0].receipt }), error => ({ ok: false, error }));
    await waitForBlock(db, 'prefill-expiry-contender', pid);
    await new Promise(resolve => setTimeout(resolve, 2200));
    await blocker.query('COMMIT');
    const outcome = await pending;
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.receipt, { status: 'stale_rejected' });
    assert.equal(await stateCount(db, fixture.f.candidateId), 0);
    assert.equal(await value(db, 'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects'), 0);
    assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1',
      [fixture.f.jobId]), 'in_progress');
  } finally { await blocker.end(); await completion.end(); }
});

test('T1b ACP-1 absent-row save reads a null queryLanguage for an und identity', async () => {
  const f = await seedCard(db, { language: 'und' });
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0', card: f });
  await retainedOlResult(db, fixture, 1);
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.prefill.status, 'saved');
  const saved = await stateRow(db, fixture.f.candidateId);
  assert.deepEqual(saved.options, fixture.command.result.rows, 'state stores the exact worker rows');
  const read = await ownerChoices(db, fixture.f);
  assert.equal(read.lookupStatus, 'ready');
  assert.equal(read.queryLanguage, null);
  // The Owner read is the allowlisted projection (M75:33, M65:3), not the raw
  // worker rows: only the public row fields survive and no private normalized
  // metadata may be serialized.
  assert.equal(read.rows.length, fixture.command.result.rows.length);
  const privateMetadataFields = ['adapterKey', 'adapterVersion', 'normalizerVersion', 'correlationId',
    'attemptId', 'providerRecordId', 'fetchedAt', 'matchRationale', 'confidence',
    'contractVersion', 'schemaVersion'];
  for (const [index, row] of read.rows.entries()) {
    const stored = fixture.command.result.rows[index];
    assert.equal(row.optionId, stored.optionId);
    assert.equal(row.ordinal, stored.ordinal);
    assert.equal(row.eligibility, stored.eligibility);
    assert.equal(row.googleBooksUrl, stored.googleBooksUrl);
    assert.ok(row.metadata, 'eligible rows keep Owner-safe metadata');
    for (const field of privateMetadataFields) {
      assert.equal(Object.hasOwn(row.metadata, field), false, 'Owner read drops ' + field);
    }
  }
});

test('T2b defensive the registry retention cap clamps the saved deadline', async () => {
  const f = await seedCard(db);
  await setCardIsbn(db, f, '9780306406157');
  await setCardIsbn(db, f, null);
  const prior = await stateRow(db, f.candidateId);
  assert.ok(prior);
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0', card: f });
  await retainedOlResult(db, fixture, 1);
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET options_retention_seconds=1800 WHERE adapter_key='open_library'");
  const fetched = fixture.command.result.retention.sourceFetchedAt;
  const result = await prefillHelper(db, {
    candidateId: f.candidateId, jobId: fixture.f.jobId, lookupId: fixture.f.lookupId,
    attemptId: fixture.f.attemptId, rows: fixture.command.result.rows,
    fetched, deadline: fixture.command.result.retention.permittedDeadlineAt,
    generation: prior.request_generation,
  });
  assert.equal(result.status, 'saved');
  assert.equal(Date.parse(result.optionsExpiresAt), Date.parse(fetched) + 1800 * 1000);
  const saved = await stateRow(db, f.candidateId);
  assert.equal(Date.parse(saved.options_expires_at), Date.parse(fetched) + 1800 * 1000);
  assert.equal(Date.parse(saved.source_fetched_at), Date.parse(fetched));
});

test('T3b truthfully retained empty OL list saves empty and reads ready', async () => {
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, 1);
  fixture.command.result.rows = [];
  fixture.command.result.catalogueCompanions = [];
  fixture.command.result.outcome.candidates = [];
  fixture.command.result.outcome.selected = null;
  fixture.command.result.outcome.outcome = 'no_acceptable_match';
  fixture.command.result.outcome.evidence = [];
  fixture.command.result.outcome.secondaryEligible = true;
  fixture.command.selectedOptionId = null;
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.prefill.status, 'saved');
  assert.equal(receipt.prefill.optionsVersion, 1);
  const saved = await stateRow(db, fixture.f.candidateId);
  assert.deepEqual(saved.options, []);
  const read = await ownerChoices(db, fixture.f);
  assert.equal(read.lookupStatus, 'ready');
  assert.deepEqual(read.rows, []);
});

test('T8b local no-list completion records no_retention and leaves the card manual', async () => {
  const f = await seedCard(db);
  const { jobId } = await seedAutomaticLineage(db, f);
  const context = await value(db, await claimJob(db, f, jobId));
  await setActor(db, f.ownerId, 'service_role');
  const command = {
    fence: { jobId, worker: 'picker-worker-0001', leaseToken: 'a'.repeat(64), claimAttempt: 1,
      candidateId: f.candidateId, storeId: f.storeId, sessionId: f.sessionId,
      candidateVersion: context.candidateVersion, queryIdentity: context.queryIdentity,
      capturedRequestId: null, requestGeneration: 0 },
    lookupId: randomUUID(), attemptId: null,
    result: { version: 'p9-metadata-result-v2', purpose: 'automatic',
      outcome: { outcome: 'insufficient_query', candidates: [], selected: null, evidence: [],
        retryable: false, secondaryEligible: false, providerRequestId: null, representativeCover: null },
      rows: null, catalogueCompanions: null, retention: null },
    selectedOptionId: null, source: 'local',
  };
  const receipt = await completeCommand(db, f, command);
  assert.equal(receipt.status, 'completed');
  assert.deepEqual(receipt.prefill, { status: 'skipped', reason: 'no_retention' });
  assert.equal(await value(db, 'SELECT state FROM public.image_extraction_candidates WHERE id=$1',
    [f.candidateId]), 'needs_review');
  assert.equal(await stateCount(db, f.candidateId), 0);
});

describe('FIX1 registry snapshot regression (02d SDD §3; plan hard rule)', () => {
  // Deterministic stand-in for an admin commit between validation and prefill:
  // the candidate UPDATE is after the registry validation and before the helper.
  // This exercises the real completion wiring, not a two-connection timing race.
  test('F1 registry disable after validation cannot roll back the automatic winner', async () => {
    const fixture = await savedFixture(db, { beginAutomatic, retainedOlResult, olAutomaticRoute });
    await resetActor(db);
    await db.exec(`CREATE FUNCTION public.phase9_test_disable_before_prefill() RETURNS trigger
      LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
        UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='open_library';
        RETURN NEW;
      END$$;
      CREATE TRIGGER phase9_test_disable_before_prefill AFTER UPDATE OF state
      ON public.image_extraction_candidates FOR EACH ROW
      WHEN (OLD.state='processing' AND NEW.state='ready')
      EXECUTE FUNCTION public.phase9_test_disable_before_prefill()`);
    try {
      // Predicted red before FIX1: P9_AUTO_SOURCE_INVALID from the helper's second read.
      const receipt = await completeCommand(db, fixture.f, fixture.command);
      assert.equal(receipt.status, 'completed');
      assert.equal(receipt.outcome, 'accepted_metadata_match');
      assert.equal(receipt.selectedOptionId, fixture.command.selectedOptionId);
      assert.equal(receipt.prefill.status, 'saved');
      await resetActor(db);
      assert.equal(await value(db, "SELECT enabled FROM public.phase9_provider_registry WHERE adapter_key='open_library'"), false,
        'the registry changed after validation; the automatic result still commits');
      assert.equal(await value(db, 'SELECT state FROM public.image_extraction_candidates WHERE id=$1',
        [fixture.f.candidateId]), 'ready');
      assert.equal(await value(db, 'SELECT status FROM public.image_extraction_jobs WHERE id=$1',
        [fixture.f.jobId]), 'resolved');
      assert.deepEqual(await value(db, 'SELECT coherent_edition FROM public.phase9_selected_metadata_snapshots WHERE id=$1',
        [receipt.snapshotId]), fixture.command.result.outcome.selected);
      const saved = await stateRow(db, fixture.f.candidateId);
      assert.deepEqual(saved.options, fixture.command.result.rows);
      assert.equal(saved.options_version, 1);
      // Current-policy checks still hide disabled sources from the Owner read (§3/5).
      assert.equal((await ownerChoices(db, fixture.f)).lookupStatus, 'idle');
      assert.deepEqual(await recoverCommand(db, fixture.command.fence), { ...receipt, status: 'replayed' });
    } finally {
      await resetActor(db);
      await db.exec(`DROP TRIGGER phase9_test_disable_before_prefill ON public.image_extraction_candidates;
        DROP FUNCTION public.phase9_test_disable_before_prefill()`);
    }
  });

  test('F1 registry-row helper overload stays private and owned by postgres', async () => {
    await resetActor(db);
    const signature = 'marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer,public.phase9_provider_registry)';
    const properties = await value(db, `SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),
      'definer',prosecdef,'config',proconfig) FROM pg_proc WHERE oid=to_regprocedure($1)`, [signature]);
    assert.equal(properties.owner, 'postgres');
    assert.equal(properties.definer, true);
    assert.ok(properties.config.includes('search_path=""'));
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await resetActor(db);
      assert.equal(await value(db, 'SELECT has_function_privilege($1,$2,\'EXECUTE\')', [role, signature]), false);
      await denied(db, role, `SELECT marketplace_sec.phase9_prefill_automatic_editions_v1(
        NULL::public.image_extraction_candidates,NULL::public.image_extraction_jobs,
        NULL::public.phase9_metadata_lookups,NULL::public.metadata_enrichment_attempts,
        NULL::jsonb,NULL::timestamptz,NULL::timestamptz,0,NULL::public.phase9_provider_registry)`);
    }
  });
});
