import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createPhase9Database, resetActor, scalar, setActor } from './databaseHarness.mjs';

const STORE_A = '92000000-0000-0000-0000-000000000021';
const STORE_B = '92000000-0000-0000-0000-000000000022';
const OWNER_A = '91000000-0000-0000-0000-000000000021';
const SESSION_A = '93000000-0000-0000-0000-000000000021';
const INPUT_A = '94000000-0000-0000-0000-000000000021';
const MEDIA_A = '95000000-0000-0000-0000-000000000021';
const JOB_A = '96000000-0000-0000-0000-000000000021';
const WORKER = 'vision-worker-0000000001';
let db;

const baseResult = (observations = [{
  ordinal: 1,
  title_guess: 'Fixture Book',
  author_guesses: ['Fixture Author'],
  publisher_clue: 'Fixture Publisher',
  isbn_clue: null,
  detected_language: 'en',
  confidence: 0.9,
  geometry: null,
  warning_codes: [],
}], outcome = 'analyzed', count = observations.length) => ({
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'fixture-prompt-v2',
  adapter_key: 'fixture_adapter',
  adapter_version: '1.0.0',
  job_reference: 'job_97000000000040008000000000000021',
  attempt_number: 1,
  correlation_id: '97000000-0000-4000-8000-000000000021',
  expected_language: 'en',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  received_at: '2026-07-26T00:00:01.000Z',
  image_outcome: outcome,
  detected_visible_book_count: count,
  observations,
  warning_codes: [],
});

async function seedVisionJob(storeId = STORE_A, jobId = JOB_A) {
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,orchestration_version,prompt_version)
    VALUES('${SESSION_A}','${storeId}','${OWNER_A}','en','good','A1','phase9-v1','fixture-prompt-v2');
    INSERT INTO public.media_assets
    (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,detected_mime,bytes,width,height,
     validation_version,validated_at,reencode_version,exif_strip_version,session_id,retention_class,lifecycle_status)
    VALUES('${MEDIA_A}','${storeId}','${OWNER_A}','scan_input','private_scan','image-extraction-inputs',
      '${storeId}/scan_input/${SESSION_A}/${INPUT_A}/attempt-1.webp','${'a'.repeat(64)}','image/webp',32,1,1,
      'phase9-media-v1',transaction_timestamp(),'fixture','fixture','${SESSION_A}','phase9-private-scan','linked');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT_A}','${SESSION_A}','${storeId}','${MEDIA_A}','camera','queued','${'a'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,correlation_id)
    VALUES('${jobId}','${storeId}','input','${INPUT_A}','vision_extract','vision:${INPUT_A}','phase9-v1',
      '97000000-0000-4000-8000-000000000021');`);
}

async function claimOnly() {
  return (await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows[0];
}

async function claim() {
  const claimed = await claimOnly();
  await db.query(`SELECT marketplace_sec.phase9_vision_job_context(
    '${claimed.id}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  return claimed;
}

async function persist(claimed, result = baseResult()) {
  return (await db.query(`SELECT marketplace_sec.phase9_persist_vision_analysis(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${JSON.stringify(result).replaceAll("'", "''")}'::jsonb) AS value`)).rows[0].value;
}

before(async () => {
  db = await createPhase9Database();
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE_A}','Store A'),('${STORE_B}','Store B');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE_A}','${OWNER_A}','owner','active');`);
});

beforeEach(async () => {
  await resetActor(db);
  await db.exec(`TRUNCATE public.image_analysis_observations,public.image_analysis_results,
    public.image_extraction_candidates,public.image_extraction_jobs,public.image_extraction_inputs,
    public.media_assets,public.image_extraction_sessions CASCADE;`);
  await setActor(db, OWNER_A, 'service_role');
  await seedVisionJob();
});

after(async () => db.close());

test('V4-W02/W03 reclaim rotates the lease and rejects stale context/persist/fail', async () => {
  const first = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second'
    WHERE id='${JOB_A}'`);
  const second = await claim();
  assert.equal(second.attempt_count, 2);
  assert.notEqual(second.lease_token, first.lease_token);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${first.lease_token}',${first.attempt_count})`), /P9_STATE_CONFLICT/);
  await assert.rejects(persist(first), /P9_STATE_CONFLICT/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_fail_vision_job(
    '${JOB_A}','${WORKER}','${first.lease_token}',${first.attempt_count},'P9_VISION_ANALYZER_TIMEOUT')`),
  /P9_STATE_CONFLICT/);
});

test('V4-D01 atomically persists result, observation, candidate, input, session, and job', async () => {
  const claimed = await claim();
  const completed = await persist(claimed);
  assert.deepEqual(completed, { outcome: 'accepted', candidate_count: 1, detected_visible_book_count: 1 });
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'), 1);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`), 'ready');
  assert.equal(await scalar(db, `SELECT candidate_count FROM public.image_extraction_sessions WHERE id='${SESSION_A}'`), 1);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`), 'resolved');
});

test('V4-D02 constraint failure rolls back the entire persistence transaction', async () => {
  const claimed = await claim();
  await db.exec(`INSERT INTO public.image_extraction_candidates
    (session_id,input_id,store_id,candidate_index,observed_title,observed_language)
    VALUES('${SESSION_A}','${INPUT_A}','${STORE_A}',1,'Preexisting conflict','en')`);
  await assert.rejects(persist(claimed), /unique|duplicate/i);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'), 1);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`), 'in_progress');
});

test('V4-D03/D04 exact replay is duplicate-free after ambiguous response loss', async () => {
  const claimed = await claim();
  const first = await persist(claimed);
  assert.deepEqual(await persist(claimed), first);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'), 1);
});

test('V4-D05 changed canonical payload or changed attempt replay cannot overwrite evidence', async () => {
  const claimed = await claim();
  await persist(claimed);
  await assert.rejects(persist(claimed, {
    ...baseResult(),
    observations: [{ ...baseResult().observations[0], title_guess: 'Changed Book' }],
  }), /P9_VISION_PERSISTENCE_CONFLICT/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_persist_vision_analysis(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',2,'${JSON.stringify(baseResult())}'::jsonb)`),
  /P9_VISION_PERSISTENCE_CONFLICT|P9_STATE_CONFLICT/);
});

test('vision RPCs reject NULL claim arguments and missing jobs without effects', async () => {
  await assert.rejects(
    db.query(`SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(NULL,'${WORKER}')`),
    /P9_OWNER_NOT_AUTHORIZED/,
  );
  await assert.rejects(
    db.query('SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,NULL)'),
    /P9_OWNER_NOT_AUTHORIZED/,
  );
  const claimed = await claim();
  for (const sql of [
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB_A}',NULL,'${claimed.lease_token}',1)`,
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB_A}','${WORKER}',NULL,1)`,
    `SELECT marketplace_sec.phase9_vision_job_context('${JOB_A}','${WORKER}','${claimed.lease_token}',NULL)`,
    `SELECT marketplace_sec.phase9_vision_job_context('96000000-0000-0000-0000-000000000099',
      '${WORKER}','${claimed.lease_token}',1)`,
    `SELECT marketplace_sec.phase9_fail_vision_job('${JOB_A}',NULL,'${claimed.lease_token}',1,
      'P9_VISION_DATABASE_RETRYABLE')`,
    `SELECT marketplace_sec.phase9_persist_vision_analysis('${JOB_A}','${WORKER}',
      '${claimed.lease_token}',1,NULL)`,
  ]) await assert.rejects(db.query(sql), /P9_OWNER_NOT_AUTHORIZED|P9_STATE_CONFLICT/);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}')`), /does not exist|function/i);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`),
    'in_progress');
});

test('relationship corruption terminalizes only the exactly claimed job and replays safely', async () => {
  const claimed = await claim();
  const before = {
    inputs: await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_inputs'),
    sessions: await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_sessions'),
    media: await scalar(db, 'SELECT count(*)::int FROM public.media_assets'),
    candidates: await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'),
    inventory: await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'),
    listings: await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'),
  };
  await db.exec(`UPDATE public.image_extraction_jobs SET entity_type='forged' WHERE id='${JOB_A}'`);
  const first = await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  assert.deepEqual(first, {
    outcome: 'relationship_reconciliation_required',
    safe_error_code: 'P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED',
  });
  assert.deepEqual(await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`), first);
  const job = (await db.query(`SELECT status,lease_owner,lease_expires_at,lease_token_hash,
    last_safe_error_code FROM public.image_extraction_jobs WHERE id='${JOB_A}'`)).rows[0];
  assert.deepEqual(job, {
    status: 'resolved',
    lease_owner: null,
    lease_expires_at: null,
    lease_token_hash: null,
    last_safe_error_code: 'P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED',
  });
  assert.equal((await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows.length, 0);
  assert.deepEqual({
    inputs: await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_inputs'),
    sessions: await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_sessions'),
    media: await scalar(db, 'SELECT count(*)::int FROM public.media_assets'),
    candidates: await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'),
    inventory: await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'),
    listings: await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'),
  }, before);
});

test('relationship reconciliation rejects stale tokens and same-worker reclaimed attempts', async () => {
  const first = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs
    SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id='${JOB_A}'`);
  const second = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs SET entity_type='forged' WHERE id='${JOB_A}'`);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${first.lease_token}',${first.attempt_count})`), /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`),
    'in_progress');
  await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${second.lease_token}',${second.attempt_count})`);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`),
    'resolved');
});

test('missing input terminalizes only the exactly claimed job', async () => {
  const claimed = await claimOnly();
  await db.exec(`UPDATE public.image_extraction_jobs
    SET entity_id='94000000-0000-0000-0000-000000000099' WHERE id='${JOB_A}'`);
  const result = await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  assert.equal(result.outcome, 'relationship_reconciliation_required');
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`),
    'resolved');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_inputs'), 1);
});

test('missing session relationship terminalizes only the exactly claimed job', async () => {
  const claimed = await claimOnly();
  await resetActor(db);
  await db.exec(`SET session_replication_role='replica';
    UPDATE public.image_extraction_inputs SET session_id='93000000-0000-0000-0000-000000000099'
    WHERE id='${INPUT_A}';
    SET session_replication_role='origin';`);
  await setActor(db, OWNER_A, 'service_role');
  const result = await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  assert.equal(result.outcome, 'relationship_reconciliation_required');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_sessions'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.media_assets'), 1);
});

test('missing media relationship terminalizes only the exactly claimed job', async () => {
  const claimed = await claimOnly();
  await resetActor(db);
  await db.exec(`SET session_replication_role='replica';
    UPDATE public.image_extraction_inputs SET media_asset_id='95000000-0000-0000-0000-000000000099'
    WHERE id='${INPUT_A}';
    SET session_replication_role='origin';`);
  await setActor(db, OWNER_A, 'service_role');
  const result = await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  assert.equal(result.outcome, 'relationship_reconciliation_required');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.media_assets'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_inputs'), 1);
});

test('database canonical hashing is authoritative and exact replay recomputes it', async () => {
  const claimed = await claim();
  const first = await persist(claimed);
  assert.deepEqual(await persist(claimed), first);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT canonical_result_sha256=
    encode(extensions.digest(canonical_result_snapshot::text,'sha256'),'hex')
    FROM public.image_analysis_results`), true);
});

test('direct persistence rejects nested metadata, active text, and open warnings', async () => {
  const claimed = await claim();
  const variants = [
    baseResult([{
      ...baseResult().observations[0],
      geometry: { x: 0, y: 0, width: 1, height: 1, rotation: 0, signed_url: 'https://private' },
    }]),
    baseResult([{
      ...baseResult().observations[0],
      author_guesses: ['curl --upload-file private.jpg'],
    }]),
    baseResult([{
      ...baseResult().observations[0],
      author_guesses: ['C:\\private\\cover.jpg'],
    }]),
    baseResult([{
      ...baseResult().observations[0],
      author_guesses: ['access_token=privatecredential123'],
    }]),
    baseResult([{
      ...baseResult().observations[0],
      warning_codes: [7],
    }]),
    baseResult([{
      ...baseResult().observations[0],
      warning_codes: ['provider_says_maybe'],
    }]),
  ];
  for (const value of variants) {
    await assert.rejects(persist(claimed, value), /P9_VISION_SCHEMA_INVALID/);
  }
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 0);
});

test('database canonical validation accepts one-character model version', async () => {
  const claimed = await claim();
  const completed = await persist(claimed, { ...baseResult(), model_version: 'v' });
  assert.equal(completed.outcome, 'accepted');
  assert.equal(await scalar(db, 'SELECT model_version FROM public.image_analysis_results'), 'v');
});

test('database validation uses UTF-8 bytes and accepts the 15-observation maximum', async () => {
  let claimed = await claim();
  const observations = Array.from({ length: 15 }, (_, index) => ({
    ...baseResult().observations[0],
    ordinal: index + 1,
    title_guess: `Fixture Book ${index + 1}`,
  }));
  assert.equal((await persist(claimed, baseResult(observations))).candidate_count, 15);

  await resetActor(db);
  await db.exec(`TRUNCATE public.image_analysis_observations,public.image_analysis_results,
    public.image_extraction_candidates,public.image_extraction_jobs,public.image_extraction_inputs,
    public.media_assets,public.image_extraction_sessions CASCADE;`);
  await setActor(db, OWNER_A, 'service_role');
  await seedVisionJob();
  claimed = await claim();
  const oversized = baseResult([{
    ...baseResult().observations[0],
    title_guess: 'é'.repeat(140000),
  }]);
  await assert.rejects(persist(claimed, oversized), /P9_VISION_SCHEMA_INVALID/);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 0);
});

test('wrong job kind is rejected without reconciliation or mutation', async () => {
  const claimed = await claimOnly();
  await db.exec(`UPDATE public.image_extraction_jobs
    SET job_kind='metadata_enrich' WHERE id='${JOB_A}'`);
  await assert.rejects(db.query(`SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`),
  /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`),
    'in_progress');
});

test('cross-store persist terminalizes only the job', async () => {
  const claimed = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs SET store_id='${STORE_B}' WHERE id='${JOB_A}'`);
  const result = await persist(claimed);
  assert.equal(result.outcome, 'relationship_reconciliation_required');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`),
    'processing');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_results'), 0);
});

test('cross-store fail terminalizes only the job', async () => {
  const claimed = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs SET store_id='${STORE_B}' WHERE id='${JOB_A}'`);
  const result = await scalar(db, `SELECT marketplace_sec.phase9_fail_vision_job(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    'P9_VISION_DATABASE_RETRYABLE')`);
  assert.equal(result, 'relationship_reconciliation_required');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`),
    'processing');
});

test('V4-D06 zero-books, all-mismatch, and over-limit persist zero candidates with exact terminal states', async () => {
  let claimed = await claim();
  await persist(claimed, baseResult([], 'no_books', 0));
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'), 0);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`), 'skipped');
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`), 'resolved_noop');
});

test('V4-D06 all-language-mismatch retains evidence and resolves noop', async () => {
  const claimed = await claim();
  const mismatch = baseResult([
    { ...baseResult().observations[0], ordinal: 1, detected_language: 'hi' },
    { ...baseResult().observations[0], ordinal: 2, detected_language: 'und' },
  ]);
  const completed = await persist(claimed, mismatch);
  assert.equal(completed.outcome, 'language_mismatch');
  assert.equal(completed.candidate_count, 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 2);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'), 0);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`), 'skipped');
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB_A}'`), 'resolved_noop');
});

test('V4-D06 over-limit stores image evidence and rejects the whole result', async () => {
  const claimed = await claim();
  const completed = await persist(claimed, baseResult([], 'too_many_books', 16));
  assert.equal(completed.outcome, 'over_visible_book_limit');
  assert.equal(completed.candidate_count, 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates'), 0);
  assert.equal(await scalar(db, `SELECT detected_candidate_count FROM public.image_extraction_inputs
    WHERE id='${INPUT_A}'`), 16);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`), 'failed');
});

test('V4-W05 transient analyzer failure dead-letters exactly on attempt five', async () => {
  let status;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const claimed = await claim();
    assert.equal(claimed.attempt_count, attempt);
    status = await scalar(db, `SELECT marketplace_sec.phase9_fail_vision_job(
      '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
      'P9_VISION_ANALYZER_TIMEOUT')`);
    if (attempt < 5) {
      assert.equal(status, 'retry_scheduled');
      await db.exec(`UPDATE public.image_extraction_jobs
        SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id='${JOB_A}'`);
    }
  }
  assert.equal(status, 'dead_letter');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`), 'failed');
});

test('V4-P03/P04 repeated books stay distinct while mixed-language evidence is retained and skipped', async () => {
  const claimed = await claim();
  const repeatedMixed = baseResult([
    { ...baseResult().observations[0], ordinal: 1, title_guess: 'Same Book' },
    { ...baseResult().observations[0], ordinal: 2, title_guess: 'Same Book' },
    { ...baseResult().observations[0], ordinal: 3, detected_language: 'hi' },
    { ...baseResult().observations[0], ordinal: 4, detected_language: 'und' },
  ]);
  const completed = await persist(claimed, repeatedMixed);
  assert.equal(completed.candidate_count, 2);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_analysis_observations'), 4);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_analysis_observations
    WHERE disposition IN ('language_mismatch','unknown_language')`), 2);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_candidates
    WHERE observed_title='Same Book'`), 2);
});

test('V4-S01/S02 client grants and cross-store authoritative relationships are denied', async () => {
  const claimed = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs SET store_id='${STORE_B}' WHERE id='${JOB_A}'`);
  const reconciliation = await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB_A}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  assert.equal(reconciliation.outcome, 'relationship_reconciliation_required');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_inputs WHERE id='${INPUT_A}'`),
    'processing');
  await resetActor(db);
  await setActor(db, OWNER_A, 'authenticated');
  await assert.rejects(db.query(`SELECT marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`),
    /permission denied|P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(db.query('SELECT * FROM public.image_analysis_results'),
    /permission denied/);
});

test('V4-S04 immutable evidence rejects update and delete', async () => {
  const claimed = await claim();
  await persist(claimed);
  await resetActor(db);
  await assert.rejects(db.exec(`UPDATE public.image_analysis_results SET provider_key='changed'`),
    /P9_VISION_EVIDENCE_IMMUTABLE/);
  await assert.rejects(db.exec('DELETE FROM public.image_analysis_observations'),
    /P9_VISION_EVIDENCE_IMMUTABLE/);
});

test('V4-N01 vision completion has no inventory, listing, metadata, or event effects', async () => {
  await resetActor(db);
  const before = {
    inventory: await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'),
    listings: await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'),
    metadata: await scalar(db, 'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),
    events: await scalar(db, 'SELECT count(*)::int FROM public.marketplace_events'),
  };
  await setActor(db, OWNER_A, 'service_role');
  const claimed = await claim();
  await persist(claimed);
  await resetActor(db);
  assert.deepEqual({
    inventory: await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'),
    listings: await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'),
    metadata: await scalar(db, 'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),
    events: await scalar(db, 'SELECT count(*)::int FROM public.marketplace_events'),
  }, before);
});
