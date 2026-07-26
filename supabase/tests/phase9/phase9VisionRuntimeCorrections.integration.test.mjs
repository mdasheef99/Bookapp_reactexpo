import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createPhase9Database, resetActor, scalar, setActor } from './databaseHarness.mjs';

const STORE = '92000000-0000-0000-0000-000000000031';
const OWNER = '91000000-0000-0000-0000-000000000031';
const SESSION = '93000000-0000-0000-0000-000000000031';
const INPUT = '94000000-0000-0000-0000-000000000031';
const MEDIA = '95000000-0000-0000-0000-000000000031';
const JOB = '96000000-0000-0000-0000-000000000031';
const MISSING_JOB = '96000000-0000-0000-0000-000000000099';
const WORKER = 'vision-worker-0000000031';
let db;

const observation = (ordinal, overrides = {}) => ({
  ordinal,
  title_guess: `Fixture Book ${ordinal}`,
  author_guesses: ['Fixture Author'],
  publisher_clue: 'Fixture Publisher',
  isbn_clue: null,
  detected_language: 'en',
  confidence: 0.9,
  geometry: null,
  warning_codes: [],
  ...overrides,
});

const result = (observations = [observation(1)]) => ({
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'fixture-prompt-v2',
  adapter_key: 'fixture_adapter',
  adapter_version: '1.0.0',
  job_reference: 'job_97000000000040008000000000000031',
  attempt_number: 1,
  correlation_id: '97000000-0000-4000-8000-000000000031',
  expected_language: 'en',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: 'v',
  received_at: '2026-07-26T00:00:01.000Z',
  image_outcome: 'analyzed',
  detected_visible_book_count: observations.length,
  observations,
  warning_codes: [],
});

const jsonLiteral = (value) => JSON.stringify(value).replaceAll("'", "''");

async function seed() {
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,
     orchestration_version,prompt_version)
    VALUES('${SESSION}','${STORE}','${OWNER}','en','good','A1','phase9-v1','fixture-prompt-v2');
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
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,correlation_id)
    VALUES('${JOB}','${STORE}','input','${INPUT}','vision_extract','vision:${INPUT}',
      'phase9-v1','97000000-0000-4000-8000-000000000031');`);
}

async function resetFixture() {
  await resetActor(db);
  await db.exec(`TRUNCATE public.image_analysis_observations,public.image_analysis_results,
    public.image_extraction_candidates,public.image_extraction_jobs,public.image_extraction_inputs,
    public.media_assets,public.image_extraction_sessions CASCADE;`);
  await setActor(db, OWNER, 'service_role');
  await seed();
}

async function claim(withContext = true) {
  const claimed = (await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows[0];
  if (withContext) {
    await db.query(`SELECT marketplace_sec.phase9_vision_job_context(
      '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  }
  return claimed;
}

const contextSql = (claimed, job = JOB) => `SELECT marketplace_sec.phase9_vision_job_context(
  '${job}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`;
const persistSql = (claimed, value = result(), job = JOB) =>
  `SELECT marketplace_sec.phase9_persist_vision_analysis(
    '${job}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${jsonLiteral(value)}'::jsonb)`;
const failSql = (claimed, code, job = JOB) => `SELECT marketplace_sec.phase9_fail_vision_job(
  '${job}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},'${code}')`;

async function canonicalBytes(value) {
  return scalar(db, `SELECT octet_length(convert_to(
    '${jsonLiteral(value)}'::jsonb::text,'UTF8'))::int`);
}

async function payloadAtBytes(target) {
  const observations = Array.from({ length: 15 }, (_, index) => observation(index + 1, {
    title_guess: 'T',
    author_guesses: Array.from({ length: 20 }, () => 'A'),
    publisher_clue: 'P',
  }));
  const value = result(observations);
  const baseBytes = await canonicalBytes(value);
  let remaining = target - baseBytes;
  assert.ok(remaining >= 0);
  const slots = [];
  for (const item of observations) {
    slots.push({ owner: item, key: 'title_guess', max: 512 });
    slots.push({ owner: item, key: 'publisher_clue', max: 256 });
    item.author_guesses.forEach((_, index) => {
      slots.push({ owner: item.author_guesses, key: index, max: 256 });
    });
  }
  for (const slot of slots) {
    if (remaining < 3) break;
    const count = Math.min(slot.max - 1, Math.floor(remaining / 3));
    slot.owner[slot.key] += '界'.repeat(count);
    remaining -= count * 3;
  }
  if (remaining > 0) {
    const slot = slots.find((candidate) =>
      [...candidate.owner[candidate.key]].length + remaining <= candidate.max);
    assert.ok(slot);
    slot.owner[slot.key] += 'x'.repeat(remaining);
  }
  assert.equal(await canonicalBytes(value), target);
  return value;
}

before(async () => {
  db = await createPhase9Database();
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active');`);
});
beforeEach(resetFixture);
after(async () => db.close());

test('database derives permanent and transient failure behavior from the closed code catalogue', async () => {
  for (const code of [
    'P9_VISION_SCHEMA_INVALID',
    'P9_VISION_MEDIA_UNAVAILABLE',
    'P9_VISION_INTERNAL_PERMANENT',
  ]) {
    await resetFixture();
    const claimed = await claim();
    assert.equal(await scalar(db, failSql(claimed, code)), 'resolved');
  }
  for (const code of [
    'P9_VISION_ANALYZER_TIMEOUT',
    'P9_VISION_ANALYZER_UNAVAILABLE',
    'P9_VISION_DATABASE_RETRYABLE',
  ]) {
    await resetFixture();
    const claimed = await claim();
    assert.equal(await scalar(db, failSql(claimed, code)), 'retry_scheduled');
  }
  await resetFixture();
  const claimed = await claim();
  await assert.rejects(db.query(failSql(claimed, 'P9_UNKNOWN_FAILURE')),
    /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_fail_vision_job(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    true,'P9_VISION_ANALYZER_TIMEOUT')`), /does not exist|function/i);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs
    WHERE id='${JOB}'`), 'in_progress');
});

test('every authoritative RPC rejects omitted and explicit NULL transition arguments', async () => {
  const claimed = await claim(false);
  for (const sql of [
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(NULL,'${WORKER}')`,
    'SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,NULL)',
    `SELECT marketplace_sec.phase9_vision_job_context(NULL,'${WORKER}','${claimed.lease_token}',1)`,
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB}',NULL,'${claimed.lease_token}',1)`,
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB}','${WORKER}',NULL,1)`,
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB}','${WORKER}','${claimed.lease_token}',NULL)`,
    `SELECT marketplace_sec.phase9_persist_vision_analysis(NULL,'${WORKER}','${claimed.lease_token}',1,
      '${jsonLiteral(result())}'::jsonb)`,
    `SELECT marketplace_sec.phase9_persist_vision_analysis('${JOB}',NULL,'${claimed.lease_token}',1,
      '${jsonLiteral(result())}'::jsonb)`,
    `SELECT marketplace_sec.phase9_persist_vision_analysis('${JOB}','${WORKER}',NULL,1,
      '${jsonLiteral(result())}'::jsonb)`,
    `SELECT marketplace_sec.phase9_persist_vision_analysis('${JOB}','${WORKER}',
      '${claimed.lease_token}',NULL,'${jsonLiteral(result())}'::jsonb)`,
    `SELECT marketplace_sec.phase9_fail_vision_job(NULL,'${WORKER}','${claimed.lease_token}',1,
      'P9_VISION_DATABASE_RETRYABLE')`,
    `SELECT marketplace_sec.phase9_fail_vision_job('${JOB}',NULL,'${claimed.lease_token}',1,
      'P9_VISION_DATABASE_RETRYABLE')`,
    `SELECT marketplace_sec.phase9_fail_vision_job('${JOB}','${WORKER}',NULL,1,
      'P9_VISION_DATABASE_RETRYABLE')`,
    `SELECT marketplace_sec.phase9_fail_vision_job('${JOB}','${WORKER}',
      '${claimed.lease_token}',NULL,'P9_VISION_DATABASE_RETRYABLE')`,
  ]) await assert.rejects(db.query(sql), /P9_OWNER_NOT_AUTHORIZED/);
  for (const sql of [
    'SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1)',
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB}','${WORKER}',
      '${claimed.lease_token}')`,
    `SELECT marketplace_sec.phase9_persist_vision_analysis('${JOB}','${WORKER}',
      '${claimed.lease_token}',1)`,
    `SELECT marketplace_sec.phase9_fail_vision_job('${JOB}','${WORKER}',
      '${claimed.lease_token}',1)`,
  ]) await assert.rejects(db.query(sql), /does not exist|function/i);
});

test('missing jobs and directly expired unreclaimed leases fail closed through context, persist and fail', async () => {
  let claimed = await claim(false);
  for (const sql of [
    contextSql(claimed, MISSING_JOB),
    persistSql(claimed, result(), MISSING_JOB),
    failSql(claimed, 'P9_VISION_DATABASE_RETRYABLE', MISSING_JOB),
  ]) await assert.rejects(db.query(sql), /P9_STATE_CONFLICT/);
  await db.exec(`UPDATE public.image_extraction_jobs
    SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  for (const sql of [
    contextSql(claimed),
    persistSql(claimed),
    failSql(claimed, 'P9_VISION_DATABASE_RETRYABLE'),
  ]) await assert.rejects(db.query(sql), /P9_STATE_CONFLICT/);
});

test('direct persistence rejects absolute, UNC, drive and traversal paths but accepts slash prose', async () => {
  const claimed = await claim();
  for (const value of [
    result([observation(1, { title_guess: '/private/scan.webp' })]),
    result([observation(1, { author_guesses: ['\\\\server\\share\\scan.webp'] })]),
    result([observation(1, { publisher_clue: 'C:\\private\\scan.webp' })]),
    result([observation(1, { title_guess: '../../private/scan.webp' })]),
  ]) await assert.rejects(db.query(persistSql(claimed, value)), /P9_VISION_SCHEMA_INVALID/);
  const accepted = result([observation(1, {
    title_guess: 'War/Peace: Notes & Essays',
    author_guesses: ['A/B Collective'],
    publisher_clue: 'Books/Ideas Press',
  })]);
  assert.equal((await scalar(db, persistSql(claimed, accepted))).outcome, 'accepted');
});

test('canonical UTF-8 byte guard accepts 262143 bytes and rejects 262145 valid bytes', async () => {
  let claimed = await claim();
  const below = await payloadAtBytes(262143);
  assert.equal((await scalar(db, persistSql(claimed, below))).candidate_count, 15);
  await resetFixture();
  claimed = await claim();
  const above = await payloadAtBytes(262145);
  await assert.rejects(db.query(persistSql(claimed, above)), /P9_VISION_SCHEMA_INVALID/);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 0);
});
