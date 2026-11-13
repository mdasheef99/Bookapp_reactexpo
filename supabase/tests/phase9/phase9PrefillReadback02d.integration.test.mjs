// 02d Unit 3 / ACP-9: readback matrix on disposable native PostgreSQL only.
// T2/T3 are deliberately stateful and ordered: T2 completes one saved OL list,
// T3 then runs the actual 8c 06-rollback and proves no new saved events.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { clean, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { beginAutomatic, olAutomaticRoute, retainedOlResult } from './providerAutomaticReviewFixture.mjs';
import { seedCard, seedAutomaticLineage, claimJob } from './editionPickerFixture.mjs';
import { M100, M101, completeCommand, createPrefillDatabase, recoverCommand, stateRow }
  from './automaticPrefillFixture.mjs';
import { migrationPath } from './databaseHarness.mjs';
import { run } from './finalAttemptSweep8cFixture.mjs';

const readbackUrl = new URL('../../../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/02d/01-readback.sql', import.meta.url);
const CUTOFF = "'-infinity'::timestamptz";

let db;
let t2;

function assertNative() {
  assert.match(process.env.PHASE9_PROVIDER_NATIVE_PORT ?? '', /^\d{4,5}$/,
    'native runner is required; refusing a PGlite fallback');
  assert.match(process.env.PHASE9_PROVIDER_NATIVE_DATABASE ?? '', /^bookconnect_u8b_\d+$/,
    'native runner must provide a disposable bookconnect_u8b_<pid> database');
}

function readbackSource(cutoff) {
  let source = fs.readFileSync(readbackUrl, 'utf8');
  if (cutoff !== undefined) {
    assert.ok(source.includes(CUTOFF), 'readback cutoff literal must be present');
    source = source.replace(CUTOFF, `'${cutoff}'::timestamptz`);
  }
  return source;
}

async function readback(cutoff) {
  await resetActor(db);
  const { rows } = await db.query(readbackSource(cutoff));
  assert.equal(rows.length, 11, 'readback returns one row per check');
  return Object.fromEntries(rows.map(row => {
    assert.ok(row.check, 'check name');
    assert.ok(row.expected_note, 'expected note');
    return [row.check, row.value];
  }));
}

before(async () => {
  assertNative();
  db = await createPrefillDatabase({ stopBeforeM100: true });
});
after(async () => { await db?.close(); });

test('T1 M99 baseline reports the hook absent, then M100 and M101 transition', async () => {
  const baseline = await readback();
  assert.deepEqual(baseline['R1.helper_overloads'], { without_registry: false, with_registry: false });
  assert.equal(baseline['R1.completion_calls_hook'], false);
  assert.equal(baseline['R1.choices_emit_query_language'], false);
  assert.equal(baseline['R1.m101_search_while_fresh'].installed, true);
  assert.equal(baseline['R1.m101_search_while_fresh'].if_not_pending, false);
  assert.equal(baseline['R1.m101_search_while_fresh'].version_increment, false);
  assert.equal(baseline['R1.m101_search_while_fresh'].nowait, false);

  await resetActor(db);
  await db.exec(fs.readFileSync(migrationPath(M100), 'utf8'));
  const afterM100 = await readback();
  assert.deepEqual(afterM100['R1.helper_overloads'], { without_registry: true, with_registry: true });
  assert.equal(afterM100['R1.completion_calls_hook'], true);
  assert.equal(afterM100['R1.choices_emit_query_language'], true);
  assert.equal(afterM100['R1.m101_search_while_fresh'].if_not_pending, false);
  assert.equal(afterM100['R1.m101_search_while_fresh'].version_increment, false);
  assert.equal(afterM100['R1.m101_search_while_fresh'].nowait, false);

  await resetActor(db);
  await db.exec(fs.readFileSync(migrationPath(M101), 'utf8'));
  const afterM101 = await readback();
  assert.deepEqual(afterM101['R1.m101_search_while_fresh'], {
    installed: true, if_not_pending: true, version_increment: true, nowait: true,
  });
});

test('T2 saved automatic OL list is counted after M100+M101', async () => {
  const installed = await readback();
  assert.deepEqual(installed['R1.helper_overloads'], { without_registry: true, with_registry: true });

  await clean(db);
  await olAutomaticRoute(db);
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET enabled=false,automatic_lookup_allowed=false,
    automatic_role=NULL,automatic_order=NULL,explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL
    WHERE adapter_key='google_books'`);

  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, 1);
  const receipt = await completeCommand(db, fixture.f, fixture.command);
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.prefill.status, 'saved');

  const view = await readback();
  assert.equal(view['R2.open_library'].automatic_lookup_allowed, true);
  assert.equal(view['R2.open_library'].automatic_role, 'primary');
  assert.equal(view['R2.open_library'].automatic_order, 1);
  assert.equal(view['R2.google_books'].enabled, false);
  assert.equal(view['R2.google_books'].automatic_lookup_allowed, false);
  assert.equal(view['R3.saved_list_events'], 1);
  assert.deepEqual(view['R3.receipts_by_prefill'],
    [{ status: 'saved', reason: null, count: 1 }]);
  assert.equal(view['R3.current_retained_state'].rows_with_saved_options, 1);

  const saved = await stateRow(db, fixture.f.candidateId);
  assert.deepEqual(saved.options, fixture.command.result.rows);
  t2 = { fixture, receipt, saved };
});

test('T3 actual 06 rollback: OL automatic off, no saved after cutoff, old list unchanged', async () => {
  assert.ok(t2, 'T2 must complete first');
  const candidateId = t2.fixture.f.candidateId;
  const beforeState = await stateRow(db, candidateId);
  const explicitBefore = (await readback())['R2.open_library'].explicit_search_allowed;

  await run(db, '01-pause');
  await run(db, '02-capture-drain-check');
  await run(db, '06-rollback');

  const gate = await value(db, 'SELECT to_jsonb(g) FROM marketplace_sec.phase9_external_admission_gate g');
  assert.equal(gate.mode, 'paused');
  const cutoff = await value(db, 'SELECT clock_timestamp()::text');

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
  const localReceipt = await completeCommand(db, f, command);
  assert.deepEqual(localReceipt.prefill, { status: 'skipped', reason: 'no_retention' });

  const view = await readback(cutoff);
  assert.equal(view['R2.open_library'].automatic_lookup_allowed, false);
  assert.equal(view['R2.open_library'].automatic_role, null);
  assert.equal(view['R2.open_library'].automatic_order, null);
  assert.equal(view['R2.open_library'].explicit_search_allowed, explicitBefore);
  assert.equal(view['R2.google_books'].enabled, false);
  assert.equal(view['R3.saved_list_events'], 0);
  assert.deepEqual(view['R3.receipts_by_prefill'],
    [{ status: 'skipped', reason: 'no_retention', count: 1 }]);

  assert.deepEqual(await stateRow(db, candidateId), beforeState);
  assert.deepEqual(await recoverCommand(db, t2.fixture.command.fence),
    { ...t2.receipt, status: 'replayed' });
});

test('T4 the complete readback executes inside BEGIN READ ONLY and changes nothing', async () => {
  const snapshotSql = `SELECT jsonb_build_object(
    'effects',(SELECT count(*) FROM marketplace_sec.phase9_automatic_completion_effects),
    'state',(SELECT count(*) FROM public.phase9_candidate_edition_state),
    'jobs',(SELECT count(*) FROM public.image_extraction_jobs),
    'registry',(SELECT jsonb_agg(to_jsonb(r) ORDER BY adapter_key) FROM public.phase9_provider_registry r),
    'gate',(SELECT to_jsonb(g) FROM marketplace_sec.phase9_external_admission_gate g),
    'functions',(SELECT jsonb_object_agg(v.signature,md5(p.prosrc)) FROM (VALUES
      ('marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer)'),
      ('marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer,public.phase9_provider_registry)'),
      ('marketplace_sec.phase9_complete_automatic_metadata_v1(jsonb)'),
      ('marketplace_sec.phase9_edition_legacy_choices(public.image_extraction_candidates)'),
      ('public.phase9_request_candidate_edition_options_v1(uuid,uuid,integer,text,uuid)')
    ) v(signature) JOIN pg_proc p ON p.oid=to_regprocedure(v.signature)))`;
  await resetActor(db);
  const beforeSnapshot = await value(db, snapshotSql);
  let rows;
  await db.exec('BEGIN READ ONLY');
  try {
    ({ rows } = await db.query(readbackSource()));
  } finally {
    await db.exec('ROLLBACK');
  }
  assert.equal(rows.length, 11);
  assert.ok(rows.every(row => row.value !== undefined && row.expected_note));
  await resetActor(db);
  assert.deepEqual(await value(db, snapshotSql), beforeSnapshot);
});
