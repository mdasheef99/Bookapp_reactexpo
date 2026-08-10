import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createPhase9Database, resetActor, scalar, setActor } from './databaseHarness.mjs';

const STORE = '82000000-0000-0000-0000-000000000041';
const OWNER = '81000000-0000-0000-0000-000000000041';
const SESSION = '83000000-0000-0000-0000-000000000041';
const INPUT = '84000000-0000-0000-0000-000000000041';
const MEDIA = '85000000-0000-0000-0000-000000000041';
const JOB = '86000000-0000-0000-0000-000000000041';
const RESERVATION = '87000000-0000-0000-0000-000000000041';
const CORRELATION = '88000000-0000-4000-8000-000000000041';
const WORKER = 'vision-worker-0000000041';
const CALL_A = '89000000-0000-4000-8000-000000000041';
const CALL_B = '89000000-0000-4000-8000-000000000042';
let db;

const jobReference = `job_${CORRELATION.replaceAll('-', '')}`;
const pgliteDigest = (value) => createHash('sha256').update(value).digest('hex');
const mediaReference = `media_${pgliteDigest(`${MEDIA}:${JOB}`).slice(0, 48)}`;
const json = (value) => JSON.stringify(value).replaceAll("'", "''");
const analysisResult = {
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'gemini-spine-v1',
  adapter_key: 'gemini_vision',
  adapter_version: '1.0.0',
  job_reference: jobReference,
  attempt_number: 1,
  correlation_id: CORRELATION,
  expected_language: 'en',
  provider_key: 'google_gemini',
  model_key: 'gemini-3.5-flash-lite',
  model_version: 'gemini-3.5-flash-lite',
  received_at: '2026-07-27T12:00:00.000Z',
  image_outcome: 'no_books',
  detected_visible_book_count: 0,
  observations: [],
  warning_codes: [],
};

async function seed() {
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,
     orchestration_version,prompt_version)
    VALUES('${SESSION}','${STORE}','${OWNER}','en','good','A1','phase9-v1','gemini-spine-v1');
    INSERT INTO public.media_assets
    (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
     detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,
     exif_strip_version,session_id,retention_class,lifecycle_status)
    VALUES('${MEDIA}','${STORE}','${OWNER}','scan_input','private_scan','image-extraction-inputs',
      '${STORE}/scan_input/${SESSION}/${INPUT}/attempt-1.webp','${'a'.repeat(64)}',
      'image/webp',32,1,1,'phase9-media-v1',transaction_timestamp(),'fixture','fixture',
      '${SESSION}','phase9-private-scan','linked');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT}','${SESSION}','${STORE}','${MEDIA}','camera','queued',
      '${'a'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,
     correlation_id,adapter_key,adapter_version)
    VALUES('${JOB}','${STORE}','input','${INPUT}','vision_extract','vision:${INPUT}',
      'phase9-v1','${CORRELATION}','gemini_vision','1.0.0');
    INSERT INTO public.phase9_usage_reservations
    (id,store_id,job_id,cost_kind,policy_version,operation,adapter_key,adapter_version,
     idempotency_identity,reserved_cost_units)
    VALUES('${RESERVATION}','${STORE}','${JOB}','vision',1,'extract','gemini_vision',
      '1.0.0','fixture-reservation-0041',1);`);
}

async function resetFixture() {
  await resetActor(db);
  await db.exec(`TRUNCATE public.vision_provider_attempts,public.image_analysis_observations,
    public.image_analysis_results,public.phase9_usage_reservations,
    public.image_extraction_candidates,public.image_extraction_jobs,
    public.image_extraction_inputs,public.media_assets,public.image_extraction_sessions CASCADE;`);
  await setActor(db, OWNER, 'service_role');
  await seed();
}

async function claim() {
  const claimed = (await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows[0];
  await db.query(`SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  return claimed;
}

function registerSql(claimed, callId = CALL_A, overrides = {}) {
  const values = {
    job: JOB,
    worker: WORKER,
    token: claimed.lease_token,
    attempt: claimed.attempt_count,
    reference: jobReference,
    correlation: CORRELATION,
    media: mediaReference,
    callId,
    ...overrides,
  };
  return `SELECT public.phase9_register_vision_provider_attempt(
    '${values.job}','${values.worker}','${values.token}',${values.attempt},
    '${values.reference}','${values.correlation}',
    '${values.media}',
    '${values.callId}','primary','google_gemini','gemini_vision','1.0.0',
    'gemini-3.5-flash-lite','gemini-3.5-flash-lite','gemini-spine-v1','p9-vision-v2')`;
}

function validateSql(attemptId, claimed, phase) {
  return `SELECT public.phase9_validate_vision_provider_egress(
    '${attemptId}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${jobReference}','${CORRELATION}',
    '${mediaReference}','${phase}')`;
}

before(async () => {
  db = await createPhase9Database();
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active');`);
});
beforeEach(resetFixture);
after(async () => db.close());

test('registers before egress and durably finalizes bounded usage and injected cost evidence', async () => {
  const claimed = await claim();
  const registered = await scalar(db, registerSql(claimed));
  assert.equal(registered.usage_reservation_id, RESERVATION);
  assert.equal(registered.duplicate_spend_count, 1);
  assert.equal(await scalar(db, `SELECT disposition FROM public.vision_provider_attempts
    WHERE id='${registered.attempt_id}'`), 'registered');

  const finalized = await scalar(db, `SELECT public.phase9_finalize_vision_provider_attempt(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'response_received','analyzed','provider-request-0041',
    '${json({
      prompt_tokens: 100, output_tokens: 25, total_tokens: 125,
      cached_tokens: 5, thinking_tokens: 10,
    })}'::jsonb,'mock-pricing-v1',
    '${json({
      currency: 'USD', input_basis: 'mocked_provider_response',
      pricing_source_version: 'mock-v1', input_unit_cost: 0.001,
    })}'::jsonb,
    0.125)`);
  assert.equal(finalized.disposition, 'response_received');
  const row = (await db.query(`SELECT * FROM public.vision_provider_attempts
    WHERE id='${registered.attempt_id}'`)).rows[0];
  assert.equal(row.provider_request_id, 'provider-request-0041');
  assert.equal(row.total_tokens, 125);
  assert.equal(Number(row.calculated_cost_units), 0.125);
  assert.equal(row.pricing_policy_version, 'mock-pricing-v1');
  await scalar(db, `SELECT marketplace_sec.phase9_persist_vision_analysis(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${json(analysisResult)}'::jsonb)`);
  const associated = await scalar(db,
    `SELECT public.phase9_associate_vision_provider_attempt(
      '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
      ${claimed.attempt_count})`);
  assert.equal(associated.disposition, 'accepted');
  assert.equal(await scalar(db, `SELECT analysis_result_id IS NOT NULL
    FROM public.vision_provider_attempts WHERE id='${registered.attempt_id}'`), true);
});

test('detects duplicate spend identities without collapsing distinct external calls', async () => {
  const claimed = await claim();
  const first = await scalar(db, registerSql(claimed, CALL_A));
  const second = await scalar(db, registerSql(claimed, CALL_B));
  assert.notEqual(first.attempt_id, second.attempt_id);
  assert.equal(second.duplicate_spend_count, 2);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.vision_provider_attempts
    WHERE spend_identity='${first.spend_identity}'`), 2);
});

test('keeps logical spend identity stable across reclaimed claim attempts', async () => {
  let claimed = await claim();
  const first = await scalar(db, registerSql(claimed, CALL_A));
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  claimed = await claim();
  const second = await scalar(db, registerSql(claimed, CALL_B));
  assert.equal(second.spend_identity, first.spend_identity);
  assert.notEqual(second.attempt_id, first.attempt_id);
  assert.equal(second.duplicate_spend_count, 2);
});

test('revalidates claim/media binding after registration and at both egress phases', async () => {
  let claimed = await claim();
  const registered = await scalar(db, registerSql(claimed));
  const validate = (phase) => validateSql(registered.attempt_id, claimed, phase);
  assert.equal((await scalar(db, validate('media_download'))).media_mime, 'image/webp');
  assert.equal((await scalar(db, validate('provider_egress'))).validated, true);
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  await assert.rejects(db.query(validate('provider_egress')), /P9_STATE_CONFLICT/);
  await claim();
  await assert.rejects(db.query(validate('media_download')), /P9_STATE_CONFLICT/);
});

test('rejects unbounded pricing keys instead of storing provider payload material', async () => {
  const claimed = await claim();
  const registered = await scalar(db, registerSql(claimed));
  await assert.rejects(db.query(
    `SELECT public.phase9_finalize_vision_provider_attempt(
      '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
      ${claimed.attempt_count},'response_received','analyzed',NULL,
      '${json({
        prompt_tokens: 1, output_tokens: 1, total_tokens: 2,
        cached_tokens: 0, thinking_tokens: 0,
      })}'::jsonb,'mock-pricing-v1','${json({ raw_response: 'forbidden' })}'::jsonb,0.002)`,
  ), /P9_OWNER_NOT_AUTHORIZED/);
  assert.equal(await scalar(db, `SELECT disposition FROM public.vision_provider_attempts
    WHERE id='${registered.attempt_id}'`), 'registered');
});

test('rejects every semantically invalid positive-allowlist pricing value', async () => {
  const invalid = [
    { currency: 'usd', input_basis: 'mock', pricing_source_version: 'v1' },
    { currency: 'USDD', input_basis: 'mock', pricing_source_version: 'v1' },
    { currency: 'USD', input_basis: 'https://pricing.invalid', pricing_source_version: 'v1' },
    { currency: 'USD', input_basis: 'mock', pricing_source_version: 'x'.repeat(65) },
    { currency: 'USD', input_basis: 'mock', pricing_source_version: 'v1', input_unit_cost: -1 },
    { currency: 'USD', input_basis: 'mock', pricing_source_version: 'v1', output_unit_cost: '1' },
    { currency: 'USD', input_basis: 'mock', pricing_source_version: 'v1', output_unit_cost: 1000001 },
  ];
  for (const [index, pricing] of invalid.entries()) {
    await resetFixture();
    const claimed = await claim();
    const registered = await scalar(db, registerSql(claimed, CALL_A));
    await assert.rejects(db.query(
      `SELECT public.phase9_finalize_vision_provider_attempt(
        '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
        ${claimed.attempt_count},'response_received','analyzed',NULL,
        '${json({
          prompt_tokens: 1, output_tokens: 1, total_tokens: 2,
          cached_tokens: 0, thinking_tokens: 0,
        })}'::jsonb,'mock-pricing-v1','${json(pricing)}'::jsonb,0.002)`,
    ), /P9_OWNER_NOT_AUTHORIZED/, `invalid pricing case ${index}`);
  }
});

test('fails closed for stale, expired, superseded and mismatched claims without creating attempts', async () => {
  let claimed = await claim();
  for (const overrides of [
    { worker: 'wrong-worker-0000000041' },
    { token: 'b'.repeat(64) },
    { attempt: 2 },
    { reference: 'job_wrong_reference_000000000000000041' },
    { correlation: '88000000-0000-4000-8000-000000000099' },
    { media: 'media_wrong_reference_000000000000000000000000000041' },
  ]) {
    await assert.rejects(db.query(registerSql(claimed, CALL_B, overrides)),
      /P9_OWNER_NOT_AUTHORIZED|P9_STATE_CONFLICT|P9_MEDIA_NOT_APPROVED/);
  }
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  await assert.rejects(db.query(registerSql(claimed, CALL_B)), /P9_STATE_CONFLICT/);
  await claim();
  await assert.rejects(db.query(registerSql(claimed, CALL_B)), /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.vision_provider_attempts'), 0);
});

test('rejects mismatched input, session and expected media-purpose/status bindings', async () => {
  for (const mutation of [
    `UPDATE public.image_extraction_jobs SET entity_id=
      '84000000-0000-0000-0000-000000000099' WHERE id='${JOB}'`,
    `UPDATE public.media_assets SET session_id=NULL WHERE id='${MEDIA}'`,
    `UPDATE public.media_assets SET lifecycle_status='failed' WHERE id='${MEDIA}'`,
  ]) {
    await resetFixture();
    const claimed = await claim();
    await db.exec(mutation);
    await assert.rejects(db.query(registerSql(claimed)), /P9_MEDIA_NOT_APPROVED/);
    assert.equal(await scalar(db,
      'SELECT count(*)::int FROM public.vision_provider_attempts'), 0);
  }
});

test('records unknown outcomes and prevents stale attempts from becoming accepted', async () => {
  let claimed = await claim();
  const stale = await scalar(db, registerSql(claimed));
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  claimed = await claim();
  await scalar(db, `SELECT public.phase9_mark_vision_provider_attempt(
    '${stale.attempt_id}','${JOB}','outcome_unknown','provider_interrupted')`);
  await assert.rejects(db.query(`SELECT public.phase9_associate_vision_provider_attempt(
    '${stale.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count})`), /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT disposition FROM public.vision_provider_attempts
    WHERE id='${stale.attempt_id}'`), 'outcome_unknown');
});

test('keeps provider-attempt rows and RPCs service-only', async () => {
  const claimed = await claim();
  const registered = await scalar(db, registerSql(claimed));
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(registerSql(claimed)), /permission denied/i);
  await assert.rejects(db.query(validateSql(
    registered.attempt_id, claimed, 'media_download',
  )), /permission denied/i);
  await assert.rejects(db.query(
    'SELECT count(*) FROM public.vision_provider_attempts',
  ), /permission denied/i);
});
