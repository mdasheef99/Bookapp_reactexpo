import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import { createDuplicateConfirmationDatabase } from './duplicateConfirmationFixture.mjs';

const STORE = '82000000-0000-0000-0000-000000000061';
const OWNER = '81000000-0000-0000-0000-000000000061';
const OWNER2 = '81000000-0000-0000-0000-000000000062';
const COMMAND = '83000000-0000-4000-8000-000000000061';
const SOURCE_ID = 'a'.repeat(64);
const SOURCE_SHA = 'b'.repeat(64);
let db;

async function start(owner, key) {
  await setActor(db, owner, 'service_role');
  await db.exec(`UPDATE public.image_extraction_sessions SET status='closed',closed_at=transaction_timestamp()
    WHERE created_by='${owner}' AND status IN ('active','closing')`);
  await setActor(db, owner);
  return scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,'private','${key}','${COMMAND}')`);
}

async function prepare(owner, key) {
  const sessionId = await start(owner, `${key}-session`);
  await setActor(db, owner, 'service_role');
  const cap = (await db.query(`SELECT marketplace_sec.phase9_issue_scan_upload('${owner}','${sessionId}',
    'camera','image/png',68,1,'${key}-issue-key-0001','${COMMAND}') value`)).rows[0].value;
  const registered = (await db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion('${owner}',
    '${cap.capability_id}','camera','${cap.bucket_id}','${cap.object_path}','${SOURCE_ID}','${SOURCE_SHA}',
    'image/png',68,'phase9-v1','${key}-complete-key-0001','${COMMAND}') value`)).rows[0].value;
  const worker = `duplicate-worker-${key}`.slice(0, 64);
  const claim = (await db.query(`SELECT * FROM marketplace_sec.claim_phase9_media_validation_jobs(10,'${worker}')`)).rows
    .find((row) => row.id === registered.job_id);
  const context = (await db.query(`SELECT public.phase9_prepare_media_validation_outputs('${registered.job_id}',
    '${worker}','${claim.lease_token}',${claim.attempt_count}) value`)).rows[0].value;
  await db.query(`SELECT marketplace_sec.phase9_bind_media_validation_snapshot('${registered.job_id}',
    '${worker}','${claim.lease_token}',${claim.attempt_count},'${context.snapshot_path}','${SOURCE_SHA}',68,'image/png')`);
  return { owner, sessionId, registered, worker, claim, context };
}

async function complete(p, hash) {
  return (await db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${p.registered.job_id}',
    '${p.worker}','${p.claim.lease_token}',${p.claim.attempt_count},'${SOURCE_ID}','${SOURCE_SHA}',
    '${p.context.snapshot_path}','${p.context.target_path}','${hash}',32,1,1) value`)).rows[0].value;
}

async function resolve(p, decision, version, confirmationVersion, key) {
  await setActor(db, p.owner, 'service_role');
  return (await db.query(`SELECT public.phase9_resolve_duplicate_scan_input('${p.owner}',
    '${p.sessionId}','${p.registered.input_id}','${decision}',${version},${confirmationVersion},
    '${key}','${COMMAND}',${decision === 'proceed' ? `'${'c'.repeat(64)}','${'d'.repeat(64)}',32,'image/webp'` : 'NULL,NULL,NULL,NULL'}) value`)).rows[0].value;
}

before(async () => {
  db = await createDuplicateConfirmationDatabase();
  await db.exec(`INSERT INTO public.stores(id,display_name,setup_status,selling_status)
    VALUES('${STORE}','Store','complete','allowed');
    INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
    ('${STORE}','${OWNER}','owner','active'),('${STORE}','${OWNER2}','owner','active')`);
});
after(async () => db.close());

test('duplicate completion pauses with new provenance and no vision retry', async () => {
  const first = await prepare(OWNER, 'winner-0001');
  assert.equal((await complete(first, 'd'.repeat(64))).state, 'queued');
  const duplicate = await prepare(OWNER2, 'duplicate-0001');
  const outcome = await complete(duplicate, 'd'.repeat(64));
  assert.equal(outcome.state, 'confirmation_required');
  assert.deepEqual((await db.query(`SELECT status,attempt_count FROM public.image_extraction_jobs
    WHERE id='${duplicate.registered.job_id}'`)).rows[0], { status: 'resolved', attempt_count: 1 });
  assert.deepEqual(await complete(duplicate, 'd'.repeat(64)), outcome);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${duplicate.registered.input_id}'`), 'awaiting_duplicate_confirmation');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${duplicate.registered.input_id}' AND job_kind='vision_extract'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE store_id='${STORE}' AND sha256='${'d'.repeat(64)}'`), 2);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE store_id='${STORE}' AND sha256='${'d'.repeat(64)}' AND duplicate_of_input_id IS NULL`), 1);
});

test('Proceed creates exactly one new private media link and vision job; replay is canonical', async () => {
  await resetActor(db);
  const duplicate = (await db.query(`SELECT i.id input_id,i.version,c.version confirmation_version,c.session_id,
    s.created_by owner FROM public.image_extraction_inputs i
    JOIN marketplace_sec.phase9_duplicate_input_confirmations c ON c.input_id=i.id
    JOIN public.image_extraction_sessions s ON s.id=i.session_id WHERE c.state='pending' LIMIT 1`)).rows[0];
  const p = { owner: duplicate.owner, sessionId: duplicate.session_id, registered: { input_id: duplicate.input_id } };
  await setActor(db, duplicate.owner, 'service_role');
  const preflight = await scalar(db, `SELECT public.phase9_duplicate_resolution_context(
    '${duplicate.owner}','${duplicate.session_id}','${duplicate.input_id}','proceed',
    ${duplicate.version},${duplicate.confirmation_version},'duplicate-proceed-key-0001','${COMMAND}')`);
  assert.equal(preflight.replay, false);
  const first = await resolve(p, 'proceed', duplicate.version, duplicate.confirmation_version, 'duplicate-proceed-key-0001');
  const replay = await resolve(p, 'proceed', duplicate.version, duplicate.confirmation_version, 'duplicate-proceed-key-0001');
  assert.deepEqual(replay, first);
  assert.equal(first.outcome, 'processing_started');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${duplicate.input_id}' AND job_kind='vision_extract'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets m JOIN public.image_extraction_inputs i
    ON i.media_asset_id=m.id WHERE i.id='${duplicate.input_id}' AND m.session_id='${duplicate.session_id}'
    AND m.privacy_class='private_scan'`), 1);
});

test('Cancel ends only the new upload and makes its output cleanup-eligible', async () => {
  const first = await prepare(OWNER, 'cancel-winner-0001');
  await complete(first, 'e'.repeat(64));
  const duplicate = await prepare(OWNER2, 'cancel-duplicate-0001');
  await complete(duplicate, 'e'.repeat(64));
  await resetActor(db);
  const row = (await db.query(`SELECT i.version,c.version confirmation_version FROM public.image_extraction_inputs i
    JOIN marketplace_sec.phase9_duplicate_input_confirmations c ON c.input_id=i.id WHERE i.id='${duplicate.registered.input_id}'`)).rows[0];
  const result = await resolve(duplicate, 'cancel', row.version, row.confirmation_version, 'duplicate-cancel-key-0001');
  assert.equal(result.outcome, 'cancelled');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${duplicate.registered.input_id}'`), 'skipped');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${duplicate.registered.input_id}' AND job_kind='vision_extract'`), 0);
});

test('authenticated callers cannot bypass service storage verification RPCs', async () => {
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_duplicate_resolution_context('${OWNER}',
    gen_random_uuid(),gen_random_uuid(),'proceed',1,1,'direct-bypass-key-0001','${COMMAND}')`), /permission denied/);
  await assert.rejects(db.query(`SELECT public.phase9_resolve_duplicate_scan_input('${OWNER}',
    gen_random_uuid(),gen_random_uuid(),'proceed',1,1,'direct-bypass-key-0002','${COMMAND}')`), /permission denied/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_duplicate_resolution_context('${OWNER}',
    gen_random_uuid(),gen_random_uuid(),'proceed',1,1,'direct-bypass-key-0001','${COMMAND}')`),
  /permission denied|P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_resolve_duplicate_scan_input('${OWNER}',
    gen_random_uuid(),gen_random_uuid(),'proceed',1,1,'direct-bypass-key-0002','${COMMAND}',NULL,NULL,NULL,NULL)`),
  /permission denied|P9_OWNER_NOT_AUTHORIZED/);
});

test('pending media is atomically protected; Remove and Close cannot bypass Cancel; session expiry releases cleanup', async () => {
  const canonical = await prepare(OWNER, 'expiry-winner-0001');
  await complete(canonical, 'f'.repeat(64));
  const duplicate = await prepare(OWNER2, 'expiry-duplicate-0001');
  await complete(duplicate, 'f'.repeat(64));
  await resetActor(db);
  const row = (await db.query(`SELECT i.version input_version,s.version session_version,c.sanitized_intent_id
    FROM public.image_extraction_inputs i JOIN public.image_extraction_sessions s ON s.id=i.session_id
    JOIN marketplace_sec.phase9_duplicate_input_confirmations c ON c.input_id=i.id
    WHERE i.id='${duplicate.registered.input_id}'`)).rows[0];
  await db.exec(`UPDATE marketplace_sec.phase9_media_output_intents SET next_cleanup_at=transaction_timestamp()-interval '1 minute'
    WHERE id='${row.sanitized_intent_id}'`);
  await setActor(db, OWNER2, 'service_role');
  const protectedClaims = (await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'duplicate-cleanup-worker')`)).rows;
  assert.equal(protectedClaims.some((claim) => claim.intent_id === row.sanitized_intent_id), false);
  await setActor(db, OWNER2, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_remove_scan_input_v1('${duplicate.sessionId}',
    '${duplicate.registered.input_id}',${row.input_version},'duplicate-remove-key-0001','${COMMAND}')`), /P9_STATE_CONFLICT/);
  await assert.rejects(db.query(`SELECT public.phase9_close_session_v2('${duplicate.sessionId}',
    ${row.session_version},'duplicate-close-key-0001','${COMMAND}')`), /P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 second'
    WHERE id='${duplicate.sessionId}';
    UPDATE marketplace_sec.phase9_duplicate_input_confirmations
    SET expires_at=transaction_timestamp()-interval '1 second'
    WHERE input_id='${duplicate.registered.input_id}'`);
  await setActor(db, OWNER2, 'service_role');
  const expiredClaims = (await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'duplicate-cleanup-worker')`)).rows;
  assert.equal(expiredClaims.some((claim) => claim.intent_id === row.sanitized_intent_id), true,
    JSON.stringify(expiredClaims));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT state FROM marketplace_sec.phase9_duplicate_input_confirmations
    WHERE input_id='${duplicate.registered.input_id}'`), 'expired');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs
    WHERE id='${duplicate.registered.input_id}'`), 'skipped');
});
