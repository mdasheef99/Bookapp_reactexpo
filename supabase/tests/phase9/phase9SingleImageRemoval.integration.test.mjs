import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import {
  createPhase9Database, migrationPath, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const M34 = '20260809000034_marketplace_phase9_vision_language_hint_correction.sql';
const M35 = '20260810000035_marketplace_phase9_single_image_removal.sql';
const STORE = '9a000000-0000-0000-0000-000000000001';
const OWNER = '9b000000-0000-0000-0000-000000000001';
const COMMAND_A = '9c000000-0000-4000-8000-000000000001';
const COMMAND_B = '9c000000-0000-4000-8000-000000000002';
let db;
let sessionId;
let firstCapability;
let legacySecondCapability;

async function issue(ordinal, key, command = COMMAND_A) {
  return (await db.query(`SELECT marketplace_sec.phase9_issue_scan_upload(
    '${OWNER}','${sessionId}','camera','image/png',68,${ordinal},'${key}','${command}'
  ) AS value`)).rows[0].value;
}

async function register(capability, key, command = COMMAND_A) {
  return (await db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion(
    '${OWNER}','${capability.capability_id}','camera','${capability.bucket_id}',
    '${capability.object_path}','${'a'.repeat(64)}','${'b'.repeat(64)}',
    'image/png',68,'phase9-v1','${key}','${command}'
  ) AS value`)).rows[0].value;
}

before(async () => {
  db = await createPhase9Database({ throughMigration: M34 });
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Single Image Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
      VALUES('${STORE}','${OWNER}','owner','active');
  `);
  await setActor(db, OWNER);
  sessionId = await scalar(db, `SELECT public.phase9_start_session(
    NULL,'en',NULL,'good','A1',1,'private','single-image-session-0001','${COMMAND_A}')`);
  await setActor(db, OWNER, 'service_role');
  firstCapability = await issue(1, 'legacy-first-issue-0001');
  legacySecondCapability = await issue(2, 'legacy-second-issue-0001', COMMAND_B);
  await resetActor(db);
  await db.exec(fs.readFileSync(migrationPath(M35), 'utf8'));
});

after(async () => db?.close());

test('M35 applies over legacy multi-capability state and registration admits only one current input', async () => {
  await setActor(db, OWNER, 'service_role');
  const first = await register(firstCapability, 'first-register-0001');
  await assert.rejects(
    register(legacySecondCapability, 'legacy-second-register-0001', COMMAND_B),
    /P9_SINGLE_IMAGE_LIMIT/,
  );
  await assert.rejects(issue(1, 'blocked-third-issue-0001', COMMAND_B), /P9_SINGLE_IMAGE_LIMIT/);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE session_id='${sessionId}' AND quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'`), 1);
  assert.equal(first.state, 'uploaded');
});

test('owner removal cancels exact jobs, preserves historical rows, and enables replacement', async () => {
  await resetActor(db);
  const input = (await db.query(`SELECT id::text,version FROM public.image_extraction_inputs
    WHERE session_id='${sessionId}' AND quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'`)).rows[0];
  await setActor(db, OWNER);
  const removed = await scalar(db, `SELECT public.phase9_remove_scan_input_v1(
    '${sessionId}','${input.id}',${input.version},'remove-first-input-0001','${COMMAND_A}')`);
  assert.equal(removed.inputState, 'skipped');
  assert.deepEqual(await scalar(db, `SELECT public.phase9_remove_scan_input_v1(
    '${sessionId}','${input.id}',${input.version},'remove-first-input-0001','${COMMAND_A}')`), removed);
  assert.equal((await scalar(db, `SELECT public.phase9_owner_session_inputs_v1('${sessionId}')`)).items.length, 0);
  assert.equal((await scalar(db, 'SELECT public.phase9_owner_discover_session_v1()')).activeSession.inputCount, 0);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT input_count FROM public.image_extraction_sessions WHERE id='${sessionId}'`), 1);
  assert.equal(await scalar(db, `SELECT state='skipped' AND quality_reason='P9_OWNER_REMOVED'
    FROM public.image_extraction_inputs WHERE id='${input.id}'`), true);
  assert.equal(await scalar(db, `SELECT bool_and(status='cancelled') FROM public.image_extraction_jobs
    WHERE entity_type='input' AND entity_id='${input.id}'`), true);

  await setActor(db, OWNER, 'service_role');
  const replacement = await register(legacySecondCapability, 'legacy-second-register-0001', COMMAND_B);
  assert.equal(replacement.state, 'uploaded');
});

test('candidate lineage rejects removal atomically without changing job or book state', async () => {
  await resetActor(db);
  const input = (await db.query(`SELECT id::text,version FROM public.image_extraction_inputs
    WHERE session_id='${sessionId}' AND quality_reason IS DISTINCT FROM 'P9_OWNER_REMOVED'`)).rows[0];
  const candidate = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,input_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state
  ) VALUES('${sessionId}','${input.id}','${STORE}',1,'Preserved book',ARRAY['Author'],'en','needs_review')
  RETURNING id::text`);
  await setActor(db, OWNER);
  await assert.rejects(db.query(`SELECT public.phase9_remove_scan_input_v1(
    '${sessionId}','${input.id}',${input.version},'remove-rejected-0001','${COMMAND_B}')`),
  /P9_INPUT_HAS_CANDIDATES/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${input.id}'`), 'uploaded');
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs
    WHERE entity_type='input' AND entity_id='${input.id}' AND job_kind='media_validate_sanitize'`), 'open');
  assert.equal(await scalar(db, `SELECT observed_title FROM public.image_extraction_candidates WHERE id='${candidate}'`), 'Preserved book');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'), 0);
});
