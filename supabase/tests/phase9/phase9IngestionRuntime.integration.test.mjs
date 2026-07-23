import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createPhase9Database, resetActor, scalar, setActor } from './databaseHarness.mjs';

const STORE_A = '92000000-0000-0000-0000-000000000011';
const STORE_B = '92000000-0000-0000-0000-000000000012';
const OWNER_A = '91000000-0000-0000-0000-000000000011';
const OWNER_A2 = '91000000-0000-0000-0000-000000000012';
const OWNER_B = '91000000-0000-0000-0000-000000000013';
const COMMAND = '93000000-0000-4000-8000-000000000011';
let db; let sessionId;

async function asService() {
  await setActor(db, OWNER_A, 'service_role');
}

async function issue(key, ordinal = 1) {
  const result = await db.query(`SELECT marketplace_sec.phase9_issue_scan_upload('${OWNER_A}','${sessionId}',
    'camera','image/png',68,${ordinal},'${key}','${COMMAND}') AS value`);
  return result.rows[0].value;
}

async function register(cap, key, identity = 'a'.repeat(64), sourceSha = 'b'.repeat(64)) {
  return (await db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion('${OWNER_A}',
    '${cap.capability_id}','camera','${cap.bucket_id}','${cap.object_path}','${identity}','${sourceSha}',
    'image/png',68,'phase9-v1','${key}','${COMMAND}') AS value`)).rows[0].value;
}

async function claim(worker, batchSize = 10) {
  return (await db.query(`SELECT * FROM marketplace_sec.claim_phase9_media_validation_jobs(${batchSize},'${worker}')`)).rows;
}

before(async () => {
  db = await createPhase9Database();
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE_A}','Store A'),('${STORE_B}','Store B');
    INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
      ('${STORE_A}','${OWNER_A}','owner','active'),('${STORE_A}','${OWNER_A2}','owner','active'),
      ('${STORE_B}','${OWNER_B}','owner','active');`);
  await setActor(db, OWNER_A);
  sessionId = await scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,'private',
    'ingestion-session-0001','${COMMAND}')`);
  await asService();
});

after(async () => db.close());

test('service functions independently authorize the JWT actor and initiating Owner', async () => {
  const first = await issue('ingestion-issue-0001');
  assert.match(first.object_path, new RegExp(`^${STORE_A}/scan_input/${sessionId}/`));
  assert.equal(first.bucket_id, 'marketplace-media-staging');
  assert.deepEqual(await issue('ingestion-issue-0001'), first);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_issue_scan_upload('${OWNER_A2}','${sessionId}',
    'camera','image/png',68,2,'ingestion-issue-0002','${COMMAND}')`), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_issue_scan_upload('${OWNER_B}','${sessionId}',
    'camera','image/png',68,2,'ingestion-issue-0003','${COMMAND}')`), /P9_OWNER_NOT_AUTHORIZED/);
});

test('completion is replay-safe for an unchanged object and rejects changed/cross-purpose/expired capabilities', async () => {
  const cap = await issue('ingestion-complete-issue-0001', 3);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion('${OWNER_A}',
    '${cap.capability_id}','gallery','${cap.bucket_id}','${cap.object_path}','${'a'.repeat(64)}','${'b'.repeat(64)}',
    'image/png',68,'phase9-v1','ingestion-wrong-source-0001','${COMMAND}')`), /P9_MEDIA_NOT_APPROVED/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion('${OWNER_A}',
    '${cap.capability_id}','camera','wrong-bucket','${cap.object_path}','${'a'.repeat(64)}','${'b'.repeat(64)}',
    'image/png',68,'phase9-v1','ingestion-wrong-bucket-0001','${COMMAND}')`), /P9_MEDIA_NOT_APPROVED/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_register_scan_upload_completion('${OWNER_A}',
    '${cap.capability_id}','camera','${cap.bucket_id}','wrong/path.png','${'a'.repeat(64)}','${'b'.repeat(64)}',
    'image/png',68,'phase9-v1','ingestion-wrong-path-0001','${COMMAND}')`), /P9_MEDIA_NOT_APPROVED/);
  const first = await register(cap, 'ingestion-complete-0001');
  assert.deepEqual(await register(cap, 'ingestion-complete-replay-0001'), first);
  await assert.rejects(register(cap, 'ingestion-complete-changed-0001', 'c'.repeat(64), 'd'.repeat(64)), /P9_IDEMPOTENCY_MISMATCH/);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE upload_capability_id='${cap.capability_id}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE dedupe_key='media-validate:${first.input_id}'`), 1);

  const expired = await issue('ingestion-expired-issue-0001', 4);
  await db.exec(`UPDATE public.phase9_upload_capabilities SET expires_at=transaction_timestamp()-interval '1 second'
    WHERE id='${expired.capability_id}'`);
  await assert.rejects(register(expired, 'ingestion-expired-complete-0001'), /P9_STATE_CONFLICT/);
  const crossed = await issue('ingestion-purpose-issue-0001', 5);
  await assert.rejects(db.exec(`UPDATE public.phase9_upload_capabilities SET purpose='customer_request'
    WHERE id='${crossed.capability_id}'`), /P9_MEDIA_NOT_APPROVED/);
});

test('claiming is exclusive, expired leases reclaim, and stale completion is rejected', async () => {
  const cap = await issue('ingestion-lease-issue-0001', 6);
  const registered = await register(cap, 'ingestion-lease-complete-0001');
  const claims = await Promise.all([
    claim('worker-lease-0001', 1),
    claim('worker-lease-0002', 1),
  ]);
  const firstClaim = claims.flat().find((row) => row.id === registered.job_id);
  assert.ok(firstClaim?.lease_token);
  assert.equal(claims.flat().filter((row) => row.id === registered.job_id).length, 1);
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second'
    WHERE id='${registered.job_id}'`);
  const reclaimed = await claim('worker-lease-0001');
  const secondClaim = reclaimed.find((row) => row.id === registered.job_id);
  assert.ok(secondClaim);
  assert.notEqual(secondClaim.lease_token, firstClaim.lease_token);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_media_validation_context('${registered.job_id}',
    'worker-lease-0001','${firstClaim.lease_token}',${firstClaim.attempt_count})`), /P9_STATE_CONFLICT/);
  const context = (await db.query(`SELECT marketplace_sec.phase9_media_validation_context('${registered.job_id}',
    'worker-lease-0001','${secondClaim.lease_token}',${secondClaim.attempt_count}) AS value`)).rows[0].value;
  assert.match(context.target_path, /\/attempt-2\.webp$/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_bind_media_validation_snapshot('${registered.job_id}',
    'worker-lease-0001','${firstClaim.lease_token}',${firstClaim.attempt_count},'${context.snapshot_path}',
    '${'b'.repeat(64)}',68,'image/png')`), /P9_STATE_CONFLICT/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_fail_media_validation('${registered.job_id}',
    'worker-lease-0001','${firstClaim.lease_token}',${firstClaim.attempt_count},false,'P9_MEDIA_DECODE_FAILED')`), /P9_STATE_CONFLICT/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${registered.job_id}',
    'worker-lease-0001','${firstClaim.lease_token}',${firstClaim.attempt_count},'${'a'.repeat(64)}',
    '${'b'.repeat(64)}','${context.snapshot_path}','${context.target_path}','${'c'.repeat(64)}',32,1,1)`), /P9_STATE_CONFLICT/);
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second'
    WHERE id='${registered.job_id}'`);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_revalidate_media_validation_lease('${registered.job_id}',
    'worker-lease-0001','${secondClaim.lease_token}',${secondClaim.attempt_count},
    '${'a'.repeat(64)}','${'b'.repeat(64)}')`), /P9_STATE_CONFLICT/);
});

test('terminal validation failure queues cleanup and creates zero vision jobs', async () => {
  const cap = await issue('ingestion-fail-issue-0001', 7);
  const registered = await register(cap, 'ingestion-fail-complete-0001');
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second'
    WHERE job_kind='media_validate_sanitize' AND status='in_progress'`);
  const claimed = (await claim('worker-fail-0001')).find((row) => row.id === registered.job_id);
  await db.query(`SELECT marketplace_sec.phase9_media_validation_context('${registered.job_id}','worker-fail-0001',
    '${claimed.lease_token}',${claimed.attempt_count})`);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_fail_media_validation('${registered.job_id}',
    'worker-fail-0001','${claimed.lease_token}',${claimed.attempt_count},false,'secret/path')`), /P9_OWNER_NOT_AUTHORIZED/);
  assert.equal(await scalar(db, `SELECT marketplace_sec.phase9_fail_media_validation('${registered.job_id}',
    'worker-fail-0001','${claimed.lease_token}',${claimed.attempt_count},false,'P9_MEDIA_DECODE_FAILED')`), 'resolved');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${registered.input_id}' AND job_kind='vision_extract'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${registered.input_id}' AND job_kind='staging_cleanup'`), 1);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${registered.input_id}'`), 'failed');
  assert.deepEqual(await register(cap, 'ingestion-fail-replay-after-validation-0001'), registered);
});

test('successful sanitation links one private media asset and queues exactly one vision job', async () => {
  const cap = await issue('ingestion-success-issue-0001', 8);
  const registered = await register(cap, 'ingestion-success-complete-0001');
  const claimed = (await claim('worker-success-0001')).find((row) => row.id === registered.job_id);
  const context = (await db.query(`SELECT marketplace_sec.phase9_media_validation_context('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count}) AS value`)).rows[0].value;
  assert.equal(await scalar(db, `SELECT marketplace_sec.phase9_bind_media_validation_snapshot('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count},'${context.snapshot_path}',
    '${'b'.repeat(64)}',68,'image/png')`), true);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_bind_media_validation_snapshot('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count},'forged/snapshot.bin',
    '${'c'.repeat(64)}',68,'image/png')`), /P9_IDEMPOTENCY_MISMATCH|P9_MEDIA_NOT_APPROVED/);
  assert.equal(await scalar(db, `SELECT marketplace_sec.phase9_revalidate_media_validation_lease('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count},
    '${'a'.repeat(64)}','${'b'.repeat(64)}')`), true);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count},'${'a'.repeat(64)}','${'b'.repeat(64)}',
    '${context.snapshot_path}','${context.target_path}','${'b'.repeat(64)}',32,4001,4000)`), /P9_MEDIA_NOT_APPROVED/);
  const result = (await db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count},'${'a'.repeat(64)}','${'b'.repeat(64)}',
    '${context.snapshot_path}','${context.target_path}','${'a'.repeat(64)}',32,1,1) AS value`)).rows[0].value;
  assert.equal(result.state, 'queued');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets m JOIN public.image_extraction_inputs i
    ON i.media_asset_id=m.id WHERE i.id='${registered.input_id}' AND m.purpose='scan_input'
    AND m.privacy_class='private_scan' AND m.lifecycle_status='linked'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${registered.input_id}' AND job_kind='vision_extract'`), 1);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${registered.job_id}',
    'worker-success-0001','${claimed.lease_token}',${claimed.attempt_count},'${'a'.repeat(64)}','${'b'.repeat(64)}',
    '${context.snapshot_path}','${context.target_path}','${'a'.repeat(64)}',32,1,1)`), /P9_STATE_CONFLICT/);
  assert.deepEqual(await register(cap, 'ingestion-success-replay-after-validation-0001'), registered);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE payload::text ~* 'object_path|signed_url|exif|token|raw_media'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE coalesce(last_safe_error_code,'') ~* 'signed|token|capability|exif|gps|raw_media|object_path|storage_path'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_inputs
    WHERE coalesce(validation_error_code,'') ~* 'signed|token|capability|exif|gps|raw_media|object_path|storage_path'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE details::text ~* 'object_path|storage_path|signed_url|upload_token|capability_id|exif|gps|raw_media'`), 0);
});

test('upload success followed by database completion failure recovers without duplicate effects', async () => {
  await asService();
  const cap = await issue('ingestion-partial-issue-0001', 9);
  const registered = await register(cap, 'ingestion-partial-complete-0001');
  const first = (await claim('worker-partial-0001')).find((row) => row.id === registered.job_id);
  const firstContext = (await db.query(`SELECT marketplace_sec.phase9_media_validation_context('${registered.job_id}',
    'worker-partial-0001','${first.lease_token}',${first.attempt_count}) AS value`)).rows[0].value;
  await db.query(`SELECT marketplace_sec.phase9_bind_media_validation_snapshot('${registered.job_id}',
    'worker-partial-0001','${first.lease_token}',${first.attempt_count},'${firstContext.snapshot_path}',
    '${'b'.repeat(64)}',68,'image/png')`);
  assert.equal(await scalar(db, `SELECT marketplace_sec.phase9_fail_media_validation('${registered.job_id}',
    'worker-partial-0001','${first.lease_token}',${first.attempt_count},true,
    'P9_MEDIA_PROCESSING_RETRYABLE')`), 'retry_scheduled');
  await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second'
    WHERE id='${registered.job_id}'`);

  const second = (await claim('worker-partial-0001')).find((row) => row.id === registered.job_id);
  assert.equal(second.attempt_count, 2);
  assert.notEqual(second.lease_token, first.lease_token);
  const secondContext = (await db.query(`SELECT marketplace_sec.phase9_media_validation_context('${registered.job_id}',
    'worker-partial-0001','${second.lease_token}',${second.attempt_count}) AS value`)).rows[0].value;
  assert.equal(secondContext.source_snapshot_path, firstContext.snapshot_path);
  assert.match(secondContext.target_path, /\/attempt-2\.webp$/);
  await db.query(`SELECT marketplace_sec.phase9_revalidate_media_validation_lease('${registered.job_id}',
    'worker-partial-0001','${second.lease_token}',${second.attempt_count},
    '${'a'.repeat(64)}','${'b'.repeat(64)}')`);
  await db.query(`SELECT marketplace_sec.phase9_complete_media_validation('${registered.job_id}',
    'worker-partial-0001','${second.lease_token}',${second.attempt_count},'${'a'.repeat(64)}',
    '${'b'.repeat(64)}','${secondContext.source_snapshot_path}','${secondContext.target_path}',
    '${'d'.repeat(64)}',32,1,1)`);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets m
    JOIN public.image_extraction_inputs i ON i.media_asset_id=m.id WHERE i.id='${registered.input_id}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_jobs
    WHERE entity_id='${registered.input_id}' AND job_kind='vision_extract'`), 1);
  assert.deepEqual(await register(cap, 'ingestion-partial-replay-0001'), registered);
});
