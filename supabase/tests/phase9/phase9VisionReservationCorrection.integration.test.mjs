import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  createPhase9Database,
  migrationPath,
  resetActor,
  scalar,
  setActor,
} from './databaseHarness.mjs';

const MIGRATION = '20260809000033_marketplace_phase9_vision_reservation_correction.sql';
const STORE = '92000000-0000-0000-0000-000000000033';
const OWNER = '91000000-0000-0000-0000-000000000033';
const COMMAND = '93000000-0000-4000-8000-000000000033';
const WORKER = 'media-worker-0000000033';
const VISION_WORKER = 'vision-worker-000000033';
const PROVIDER_CALL = '94000000-0000-4000-8000-000000000033';
let db;
let sessionId;

async function startFixture() {
  await setActor(db, OWNER);
  sessionId = await scalar(db, `SELECT public.phase9_start_session(
    NULL,'en',NULL,'good','A1',1,'private','m33-session-idempotency-0001','${COMMAND}')`);
  await setActor(db, OWNER, 'service_role');
  const capability = await scalar(db, `SELECT marketplace_sec.phase9_issue_scan_upload(
    '${OWNER}','${sessionId}','camera','image/png',68,1,
    'm33-upload-issue-idempotency-0001','${COMMAND}')`);
  return scalar(db, `SELECT marketplace_sec.phase9_register_scan_upload_completion(
    '${OWNER}','${capability.capability_id}','camera','${capability.bucket_id}',
    '${capability.object_path}','${'a'.repeat(64)}','${'b'.repeat(64)}','image/png',68,
    'phase9-v1','m33-upload-completion-idempotency-0001','${COMMAND}')`);
}

async function completeMedia(registered) {
  const claimed = (await db.query(`SELECT * FROM marketplace_sec.claim_phase9_media_validation_jobs(
    10,'${WORKER}')`)).rows.find((row) => row.id === registered.job_id);
  assert.ok(claimed);
  const context = await scalar(db, `SELECT marketplace_sec.phase9_media_validation_context(
    '${registered.job_id}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  await scalar(db, `SELECT marketplace_sec.phase9_bind_media_validation_snapshot(
    '${registered.job_id}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${context.snapshot_path}','${'b'.repeat(64)}',68,'image/png')`);
  await scalar(db, `SELECT marketplace_sec.phase9_revalidate_media_validation_lease(
    '${registered.job_id}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${'a'.repeat(64)}','${'b'.repeat(64)}')`);
  return scalar(db, `SELECT marketplace_sec.phase9_complete_media_validation(
    '${registered.job_id}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${'a'.repeat(64)}','${'b'.repeat(64)}','${context.snapshot_path}',
    '${context.target_path}','${'c'.repeat(64)}',32,1,1)`);
}

before(async () => {
  db = await createPhase9Database({
    throughMigration: '20260727000014_marketplace_phase9_vision_provider_attempts.sql',
  });
  await db.exec(fs.readFileSync(migrationPath(MIGRATION), 'utf8'));
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Store M33');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active');`);
});

beforeEach(async () => {
  await resetActor(db);
  await db.exec(`TRUNCATE public.vision_provider_attempts,public.image_analysis_observations,
    public.image_analysis_results,public.phase9_usage_reservations,
    public.phase9_idempotency_keys,
    public.image_extraction_candidates,public.image_extraction_jobs,
    public.image_extraction_inputs,public.media_assets,public.phase9_upload_capabilities,
    public.image_extraction_sessions CASCADE;`);
});

after(async () => db.close());

test('M33 applies cleanly after the full local M32 migration tail', async () => {
  const compatibilityDb = await createPhase9Database({
    throughMigration: '20260807000032_marketplace_phase9_structural_metadata_integration.sql',
  });
  try {
    await compatibilityDb.exec(fs.readFileSync(migrationPath(MIGRATION), 'utf8'));
    assert.equal(await scalar(compatibilityDb, `SELECT to_regprocedure(
      'marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)') IS NOT NULL`), true);
  } finally {
    await compatibilityDb.close();
  }
});

test('the reservation helper remains private while the existing finalizer stays service-only', async () => {
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'anon','marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'authenticated','marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'service_role','marketplace_sec.phase9_ensure_vision_usage_reservation(uuid)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'authenticated','public.phase9_complete_media_validation(
      uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'service_role','public.phase9_complete_media_validation(
      uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer)','EXECUTE')`), true);
});

test('media completion atomically creates one vision reservation accepted by M14', async () => {
  const registered = await startFixture();
  const completed = await completeMedia(registered);
  const reservation = (await db.query(`SELECT r.* FROM public.phase9_usage_reservations r
    WHERE r.job_id='${completed.vision_job_id}'`)).rows[0];
  assert.equal(reservation.cost_kind, 'vision');
  assert.equal(reservation.policy_version, 1);
  assert.equal(reservation.operation, 'extract');
  assert.equal(reservation.idempotency_identity, `vision:${registered.input_id}`);
  assert.equal(Number(reservation.reserved_cost_units), 1);
  assert.equal(reservation.status, 'reserved');

  const visionClaim = (await db.query(`SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(
    1,'${VISION_WORKER}')`)).rows[0];
  const context = await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${completed.vision_job_id}','${VISION_WORKER}','${visionClaim.lease_token}',
    ${visionClaim.attempt_count})`);
  const provider = await scalar(db, `SELECT public.phase9_register_vision_provider_attempt(
    '${completed.vision_job_id}','${VISION_WORKER}','${visionClaim.lease_token}',
    ${visionClaim.attempt_count},'${context.job_reference}','${context.correlation_id}',
    '${context.sanitized_media_reference}','${PROVIDER_CALL}','primary','google_gemini',
    'gemini_vision','1.0.0','gemini-3.5-flash-lite','gemini-3.5-flash-lite',
    '${context.prompt_version}','${context.schema_version}')`);
  assert.equal(provider.usage_reservation_id, reservation.id);
});

test('a conflicting reservation rolls back media completion instead of resolving partially', async () => {
  const registered = await startFixture();
  const visionJob = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES('${STORE}','input','${registered.input_id}','vision_extract',
      'vision:${registered.input_id}','phase9-v1') RETURNING id`);
  await db.exec(`INSERT INTO public.phase9_usage_reservations(
    store_id,job_id,cost_kind,policy_version,operation,idempotency_identity,reserved_cost_units)
    VALUES('${STORE}','${visionJob}','vision',1,'extract','wrong-identity',1)`);
  await assert.rejects(completeMedia(registered), /P9_IDEMPOTENCY_MISMATCH/);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs
    WHERE id='${registered.input_id}'`), 'validating');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.media_assets
    WHERE session_id='${sessionId}' AND detected_mime='image/webp'`), 0);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs
    WHERE id='${registered.job_id}'`), 'in_progress');
  assert.equal(await scalar(db, `SELECT consumed_media_asset_id IS NULL
    FROM public.phase9_upload_capabilities WHERE id=(SELECT upload_capability_id
      FROM public.image_extraction_inputs WHERE id='${registered.input_id}')`), true);
});

test('M33 repair includes only structurally valid pending jobs and preserves retry history', async () => {
  const repairDb = await createPhase9Database({
    throughMigration: '20260727000014_marketplace_phase9_vision_provider_attempts.sql',
  });
  try {
    await repairDb.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Repair Store');
      INSERT INTO public.image_extraction_sessions
        (id,store_id,created_by,status,selected_language,default_condition,default_location,
         orchestration_version,prompt_version)
      VALUES
        ('95000000-0000-0000-0000-000000000031','${STORE}','${OWNER}','active','en','good','A1','phase9-v1','prompt-v1'),
        ('95000000-0000-0000-0000-000000000032','${STORE}','${OWNER}','closed','en','good','A1','phase9-v1','prompt-v1'),
        ('95000000-0000-0000-0000-000000000033','${STORE}','${OWNER}','closed','en','good','A1','phase9-v1','prompt-v1');
      INSERT INTO public.media_assets
        (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,detected_mime,
         bytes,width,height,validation_version,validated_at,reencode_version,exif_strip_version,
         session_id,retention_class,lifecycle_status)
      VALUES
        ('96000000-0000-0000-0000-000000000031','${STORE}','${OWNER}','scan_input','private_scan',
         'image-extraction-inputs','repair/pending.webp','${'d'.repeat(64)}','image/webp',32,1,1,
         'phase9-media-v1',transaction_timestamp(),'fixture','fixture',
         '95000000-0000-0000-0000-000000000031','phase9-private-scan','linked'),
        ('96000000-0000-0000-0000-000000000032','${STORE}','${OWNER}','scan_input','private_scan',
         'image-extraction-inputs','repair/terminal.webp','${'e'.repeat(64)}','image/webp',32,1,1,
          'phase9-media-v1',transaction_timestamp(),'fixture','fixture',
          '95000000-0000-0000-0000-000000000032','phase9-private-scan','linked'),
        ('96000000-0000-0000-0000-000000000033','${STORE}','${OWNER}','scan_input','private_scan',
          'image-extraction-inputs','repair/closed-pending.webp','${'f'.repeat(64)}','image/webp',32,1,1,
          'phase9-media-v1',transaction_timestamp(),'fixture','fixture',
          '95000000-0000-0000-0000-000000000033','phase9-private-scan','linked'),
        ('96000000-0000-0000-0000-000000000034','${STORE}','91000000-0000-0000-0000-000000000099',
          'scan_input','private_scan','image-extraction-inputs','repair/wrong-initiator.webp',
          '${'1'.repeat(64)}','image/webp',32,1,1,'phase9-media-v1',transaction_timestamp(),
          'fixture','fixture','95000000-0000-0000-0000-000000000031','phase9-private-scan','linked');
      INSERT INTO public.image_extraction_inputs
        (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
      VALUES
        ('97000000-0000-0000-0000-000000000031','95000000-0000-0000-0000-000000000031',
         '${STORE}','96000000-0000-0000-0000-000000000031','camera','processing','${'d'.repeat(64)}','phase9-v1'),
        ('97000000-0000-0000-0000-000000000032','95000000-0000-0000-0000-000000000032',
         '${STORE}','96000000-0000-0000-0000-000000000032','camera','processing','${'e'.repeat(64)}','phase9-v1');
      INSERT INTO public.image_extraction_inputs
        (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
      VALUES
        ('97000000-0000-0000-0000-000000000033','95000000-0000-0000-0000-000000000033',
          '${STORE}','96000000-0000-0000-0000-000000000033','camera','processing','${'f'.repeat(64)}','phase9-v1'),
        ('97000000-0000-0000-0000-000000000034','95000000-0000-0000-0000-000000000031',
          '${STORE}','96000000-0000-0000-0000-000000000034','camera','processing','${'1'.repeat(64)}','phase9-v1');
      INSERT INTO public.image_extraction_jobs
        (id,store_id,entity_type,entity_id,job_kind,status,attempt_count,next_attempt_at,
         dedupe_key,operation_version,last_safe_error_code,last_safe_error_category,completed_at)
      VALUES
        ('98000000-0000-0000-0000-000000000031','${STORE}','input',
          '97000000-0000-0000-0000-000000000031','vision_extract','retry_scheduled',2,
          transaction_timestamp()+interval '11 minutes',
          'vision:97000000-0000-0000-0000-000000000031','phase9-v1',
          'P9_VISION_ANALYZER_UNAVAILABLE','vision_analysis',NULL),
        ('98000000-0000-0000-0000-000000000032','${STORE}','input',
          '97000000-0000-0000-0000-000000000032','vision_extract','resolved',1,
          transaction_timestamp(),'vision:97000000-0000-0000-0000-000000000032',
          'phase9-v1',NULL,NULL,transaction_timestamp()),
        ('98000000-0000-0000-0000-000000000033','${STORE}','input',
          '97000000-0000-0000-0000-000000000033','vision_extract','retry_scheduled',2,
          transaction_timestamp(),'vision:97000000-0000-0000-0000-000000000033',
          'phase9-v1','P9_VISION_ANALYZER_UNAVAILABLE','vision_analysis',NULL),
        ('98000000-0000-0000-0000-000000000034','${STORE}','input',
          '97000000-0000-0000-0000-000000000034','vision_extract','open',0,
          transaction_timestamp(),'vision:97000000-0000-0000-0000-000000000034',
          'phase9-v1',NULL,NULL,NULL),
        ('98000000-0000-0000-0000-000000000035','${STORE}','input',
          '97000000-0000-0000-0000-000000000031','media_validate_sanitize','open',0,
          transaction_timestamp(),'media-duplicate:97000000-0000-0000-0000-000000000031',
          'phase9-v1',NULL,NULL,NULL);`);
    const before = (await repairDb.query(`SELECT attempt_count,next_attempt_at,last_safe_error_code,
      last_safe_error_category FROM public.image_extraction_jobs
      WHERE id='98000000-0000-0000-0000-000000000031'`)).rows[0];
    await repairDb.exec(fs.readFileSync(migrationPath(MIGRATION), 'utf8'));
    assert.equal(await scalar(repairDb, `SELECT count(*)::int FROM public.phase9_usage_reservations
      WHERE job_id='98000000-0000-0000-0000-000000000031'`), 1);
    assert.equal(await scalar(repairDb, `SELECT count(*)::int FROM public.phase9_usage_reservations
      WHERE job_id='98000000-0000-0000-0000-000000000032'`), 0);
    for (const excluded of ['033', '034', '035']) {
      assert.equal(await scalar(repairDb, `SELECT count(*)::int
        FROM public.phase9_usage_reservations
        WHERE job_id='98000000-0000-0000-0000-000000000${excluded}'`), 0);
    }
    const afterRepair = (await repairDb.query(`SELECT attempt_count,next_attempt_at,last_safe_error_code,
      last_safe_error_category FROM public.image_extraction_jobs
      WHERE id='98000000-0000-0000-0000-000000000031'`)).rows[0];
    assert.deepEqual(afterRepair, before);
  } finally {
    await repairDb.close();
  }
});
