import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { scalar, setActor } from './databaseHarness.mjs';
import { createMediaCorrectionDatabase } from './mediaCorrectionFixture.mjs';

const STORE_A = '92000000-0000-0000-0000-000000000021';
const STORE_B = '92000000-0000-0000-0000-000000000022';
const OWNER_A = '91000000-0000-0000-0000-000000000021';
const OWNER_A2 = '91000000-0000-0000-0000-000000000022';
const OWNER_B = '91000000-0000-0000-0000-000000000023';
const COMMAND = '93000000-0000-4000-8000-000000000021';
const SOURCE_IDENTITY = 'a'.repeat(64);
const SOURCE_SHA256 = 'b'.repeat(64);

let db;

async function startSession(owner, key) {
  await setActor(db, owner, 'service_role');
  await db.exec(`UPDATE public.image_extraction_sessions SET status='closed', closed_at=transaction_timestamp()
    WHERE created_by='${owner}' AND status IN ('active','closing')`);
  await setActor(db, owner);
  return scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,'private',
    '${key}','${COMMAND}')`);
}

async function register(owner, sessionId, key, ordinal = 1) {
  await setActor(db, owner, 'service_role');
  const cap = (await db.query(`SELECT marketplace_sec.phase9_issue_scan_upload('${owner}','${sessionId}',
    'camera','image/png',68,1,'${key}-issue','${COMMAND}') AS value`)).rows[0].value;
  return (await db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion('${owner}',
    '${cap.capability_id}','camera','${cap.bucket_id}','${cap.object_path}','${SOURCE_IDENTITY}','${SOURCE_SHA256}',
    'image/png',68,'phase9-v1','${key}-complete','${COMMAND}') AS value`)).rows[0].value;
}

async function prepare(owner, sessionKey, inputKey, ordinal = 1) {
  const sessionId = await startSession(owner, sessionKey);
  const registered = await register(owner, sessionId, inputKey, ordinal);
  const worker = `worker-6g-${inputKey.slice(-8)}`;
  const claim = (await db.query(`SELECT * FROM marketplace_sec.claim_phase9_media_validation_jobs(10,'${worker}')`)).rows
    .find((row) => row.id === registered.job_id);
  const context = (await db.query(`SELECT public.phase9_prepare_media_validation_outputs('${registered.job_id}',
    '${worker}','${claim.lease_token}',${claim.attempt_count}) AS value`)).rows[0].value;
  await db.query(`SELECT marketplace_sec.phase9_bind_media_validation_snapshot('${registered.job_id}',
    '${worker}','${claim.lease_token}',${claim.attempt_count},'${context.snapshot_path}',
    '${SOURCE_SHA256}',68,'image/png')`);
  return { claim, context, registered, sessionId, worker };
}

async function complete(prepared, sanitizedSha256) {
  const { claim, context, registered, worker } = prepared;
  return (await db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${registered.job_id}',
    '${worker}','${claim.lease_token}',${claim.attempt_count},'${SOURCE_IDENTITY}','${SOURCE_SHA256}',
    '${context.snapshot_path}','${context.target_path}','${sanitizedSha256}',32,1,1) AS value`)).rows[0].value;
}

before(async () => {
  db = await createMediaCorrectionDatabase();
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE_A}','Store A'),('${STORE_B}','Store B');
    INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
      ('${STORE_A}','${OWNER_A}','owner','active'),('${STORE_A}','${OWNER_A2}','owner','active'),
      ('${STORE_B}','${OWNER_B}','owner','active');`);
  await db.exec(`UPDATE public.stores SET setup_status='complete', selling_status='allowed'
    WHERE id IN ('${STORE_A}','${STORE_B}')`);
  await setActor(db, OWNER_A, 'service_role');
});

after(async () => db.close());

test('a ready duplicate is a single-winner terminal conflict with no candidate or provenance rewrite', async () => {
  const first = await prepare(OWNER_A, 'duplicate-session-a-0001', 'duplicate-input-a-0001', 1);
  await complete(first, 'c'.repeat(64));
  await db.exec(`UPDATE public.image_extraction_inputs SET state='ready' WHERE id='${first.registered.input_id}'`);
  const second = await prepare(OWNER_A2, 'duplicate-session-a-0002', 'duplicate-input-a-0002', 2);

  const rejected = await complete(second, 'c'.repeat(64));
  assert.equal(rejected.state, 'duplicate_rejected');
  assert.equal(rejected.safe_error_code, 'P9_MEDIA_DUPLICATE_INPUT');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE store_id='${STORE_A}' AND sha256='${'c'.repeat(64)}' AND orchestration_version='phase9-v1'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets
    WHERE store_id='${STORE_A}' AND sha256='${'c'.repeat(64)}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_candidates
    WHERE input_id IN ('${first.registered.input_id}','${second.registered.input_id}')`), 0);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs
    WHERE id='${second.registered.input_id}'`), 'failed');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${second.registered.input_id}' AND job_kind='vision_extract'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets m
    JOIN public.image_extraction_inputs i ON i.media_asset_id=m.id
    WHERE i.id='${first.registered.input_id}' AND i.session_id='${first.sessionId}'
      AND m.session_id='${first.sessionId}' AND m.uploaded_by='${OWNER_A}'`), 1);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs
    WHERE id='${second.registered.job_id}'`), 'resolved');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs
    WHERE id='${second.registered.input_id}'`), 'failed');
});

test('the same sanitized hash is independent across stores', async () => {
  const storeA = await prepare(OWNER_A, 'store-hash-session-a-0001', 'store-hash-input-a-0001', 3);
  const storeB = await prepare(OWNER_B, 'store-hash-session-b-0001', 'store-hash-input-b-0001', 1);
  assert.equal((await complete(storeA, 'd'.repeat(64))).state, 'queued');
  assert.equal((await complete(storeB, 'd'.repeat(64))).state, 'queued');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE sha256='${'d'.repeat(64)}' AND orchestration_version='phase9-v1'`), 2);
});

test('serialized PGlite duplicate completions have one winner (not a PostgreSQL concurrency proof)', async () => {
  const first = await prepare(OWNER_A, 'concurrent-session-a-0001', 'concurrent-input-a-0001', 4);
  const second = await prepare(OWNER_A2, 'concurrent-session-a-0002', 'concurrent-input-a-0002', 5);
  const outcomes = await Promise.allSettled([complete(first, 'e'.repeat(64)), complete(second, 'e'.repeat(64))]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled' && outcome.value.state === 'queued').length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled' && outcome.value.state === 'duplicate_rejected').length, 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE store_id='${STORE_A}' AND sha256='${'e'.repeat(64)}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_candidates
    WHERE input_id IN ('${first.registered.input_id}','${second.registered.input_id}')`), 0);
});

// Master SDD §3 MAS-17; approved correction §4.1 canonical command receipts.
test('exact committed media command replay returns its canonical result',
  async () => {
    const p = await prepare(OWNER_B, 'sql-replay-session-0001', 'sql-replay-input-0001', 9);
    const first = await complete(p, '2'.repeat(64));
    assert.deepEqual(await complete(p, '2'.repeat(64)), first);
    await assert.rejects(complete(p, '3'.repeat(64)), /P9_IDEMPOTENCY_MISMATCH/);
  });

// SDD 04 §7/§12 and requested correction requirements 1/4.
test('reuse rejects incompatible sanitizer and retention policy',
  async () => {
    const p = await prepare(OWNER_B, 'sql-policy-session-0001', 'sql-policy-input-0001', 10);
    await db.exec(`INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,
      bucket_id,object_path,sha256,detected_mime,bytes,width,height,validation_version,validated_at,
      reencode_version,exif_strip_version,session_id,retention_class,lifecycle_status)
      VALUES('${STORE_B}','${OWNER_B}','scan_input','private_scan','image-extraction-inputs',
      '${p.context.target_path}','${'4'.repeat(64)}','image/webp',32,1,1,'obsolete-validation',
      transaction_timestamp(),'obsolete-reencode','obsolete-strip','${p.sessionId}',
      'wrong-retention','linked')`);
    await assert.rejects(complete(p, '4'.repeat(64)), /P9_MEDIA_NOT_APPROVED|P9_IDEMPOTENCY_MISMATCH/);
  });

test('an existing dead-letter row is immutable while a new duplicate is reconciled locally', async () => {
  const dead = await prepare(OWNER_A, 'dead-letter-session-0001', 'dead-letter-input-0001', 6);
  await db.exec(`UPDATE public.image_extraction_jobs SET status='dead_letter', attempt_count=5,
    lease_owner=NULL, lease_expires_at=NULL, lease_token_hash=NULL,
    dead_lettered_at=transaction_timestamp(), last_safe_error_code='P9_MEDIA_PROCESSING_RETRYABLE'
    WHERE id='${dead.registered.job_id}'`);
  const before = (await db.query(`SELECT status,attempt_count,dead_lettered_at,last_safe_error_code
    FROM public.image_extraction_jobs WHERE id='${dead.registered.job_id}'`)).rows[0];
  const winner = await prepare(OWNER_A, 'dead-letter-session-0002', 'dead-letter-input-0002', 7);
  await complete(winner, 'f'.repeat(64));
  const duplicate = await prepare(OWNER_A2, 'dead-letter-session-0003', 'dead-letter-input-0003', 8);
  assert.equal((await complete(duplicate, 'f'.repeat(64))).state, 'duplicate_rejected');
  const afterRow = (await db.query(`SELECT status,attempt_count,dead_lettered_at,last_safe_error_code
    FROM public.image_extraction_jobs WHERE id='${dead.registered.job_id}'`)).rows[0];
  assert.deepEqual(afterRow, before);
});

test('a forged cross-store target path is rejected without a private-media link', async () => {
  const prepared = await prepare(OWNER_A, 'private-boundary-session-0001', 'private-boundary-input-0001', 8);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${prepared.registered.job_id}',
    '${prepared.worker}','${prepared.claim.lease_token}',${prepared.claim.attempt_count},'${SOURCE_IDENTITY}',
    '${SOURCE_SHA256}','${prepared.context.snapshot_path}','${STORE_B}/scan_input/forged/attempt-1.webp',
    '${'1'.repeat(64)}',32,1,1)`), /P9_MEDIA_NOT_APPROVED/);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets
    WHERE store_id='${STORE_B}' AND object_path LIKE '%forged%'`), 0);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs
    WHERE id='${prepared.registered.input_id}'`), 'validating');
});
