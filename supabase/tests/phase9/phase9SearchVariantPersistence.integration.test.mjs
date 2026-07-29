import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createPhase9Database,
  resetActor,
  scalar,
  setActor,
} from './databaseHarness.mjs';

const STORE_A = '72000000-0000-0000-0000-000000000051';
const STORE_B = '72000000-0000-0000-0000-000000000052';
const OWNER = '71000000-0000-0000-0000-000000000051';
const SESSION = '73000000-0000-0000-0000-000000000051';
const INPUT = '74000000-0000-0000-0000-000000000051';
const MEDIA = '75000000-0000-0000-0000-000000000051';
const JOB = '76000000-0000-0000-0000-000000000051';
const CORRELATION = '77000000-0000-4000-8000-000000000051';
const WORKER = 'vision-worker-0000000051';
const TITLE = 'ಗೋದಾನ';
const AUTHOR = 'ಲೇಖಕ';
let db;

const json = (value) => JSON.stringify(value).replaceAll("'", "''");
const result = {
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'fixture-prompt-v2',
  adapter_key: 'fixture_adapter',
  adapter_version: '1.0.0',
  job_reference: `job_${CORRELATION.replaceAll('-', '')}`,
  attempt_number: 1,
  correlation_id: CORRELATION,
  expected_language: 'kn',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  received_at: '2026-07-29T00:00:01.000Z',
  image_outcome: 'analyzed',
  detected_visible_book_count: 1,
  observations: [{
    ordinal: 1,
    title_guess: TITLE,
    author_guesses: [AUTHOR, AUTHOR],
    publisher_clue: null,
    isbn_clue: null,
    detected_language: 'kn',
    confidence: 0.9,
    geometry: null,
    warning_codes: [],
  }],
  warning_codes: [],
};
const proposal = (overrides = {}) => ({
  source_field: 'observation:1:title',
  target_type: 'title',
  author_index: null,
  source_text: TITLE,
  source_language: 'kn',
  source_script: 'Knda',
  source_normalized: TITLE,
  variant_text: 'Godaan',
  variant_language: 'kn-Latn',
  variant_script: 'Latn',
  variant_type: 'primary_roman',
  variant_normalized: 'godaan',
  ...overrides,
});
const variants = (proposals = [
  proposal(),
  proposal({
    variant_text: 'The Gift of a Cow',
    variant_language: 'en',
    variant_type: 'translation_candidate',
    variant_normalized: 'the gift of a cow',
  }),
  proposal({
    source_field: 'observation:1:author:1',
    target_type: 'author',
    author_index: 1,
    source_text: AUTHOR,
    source_normalized: AUTHOR,
    variant_text: 'Lekhak',
    variant_normalized: 'lekhak',
  }),
  proposal({
    source_field: 'observation:1:author:2',
    target_type: 'author',
    author_index: 2,
    source_text: AUTHOR,
    source_normalized: AUTHOR,
    variant_text: 'Lekhak',
    variant_normalized: 'lekhak',
  }),
]) => ({
  contract_version: 'p9-contract-v1',
  proposal_schema_version: 'search_variant_proposals_v1',
  analysis_reference: CORRELATION,
  generation_source: 'recorded_fixture',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  prompt_version: 'fixture-prompt-v2',
  proposals,
});

async function seed() {
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,
     orchestration_version,prompt_version)
    VALUES('${SESSION}','${STORE_A}','${OWNER}','kn','good','A1',
      'phase9-v1','fixture-prompt-v2');
    INSERT INTO public.media_assets
    (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
     detected_mime,bytes,width,height,validation_version,validated_at,reencode_version,
     exif_strip_version,session_id,retention_class,lifecycle_status)
    VALUES('${MEDIA}','${STORE_A}','${OWNER}','scan_input','private_scan',
      'image-extraction-inputs','${STORE_A}/scan_input/${SESSION}/${INPUT}/attempt-1.webp',
      '${'a'.repeat(64)}','image/webp',32,1,1,'phase9-media-v1',
      transaction_timestamp(),'fixture','fixture','${SESSION}',
      'phase9-private-scan','linked');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT}','${SESSION}','${STORE_A}','${MEDIA}','camera','queued',
      '${'a'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,
     correlation_id)
    VALUES('${JOB}','${STORE_A}','input','${INPUT}','vision_extract',
      'vision:${INPUT}','phase9-v1','${CORRELATION}');`);
}

async function resetFixture() {
  await resetActor(db);
  await db.exec(`TRUNCATE public.phase9_search_variant_proposal_sets,
    public.phase9_search_variant_proposals,
    public.image_analysis_observations,public.image_analysis_results,
    public.image_extraction_candidates,public.image_extraction_jobs,
    public.image_extraction_inputs,public.media_assets,
    public.image_extraction_sessions CASCADE;`);
  await setActor(db, OWNER, 'service_role');
  await seed();
}

async function claim() {
  const claimed = (await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows[0];
  await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count})`);
  return claimed;
}

const persistSql = (claimed, envelope = variants(), vision = result) =>
  `SELECT public.phase9_persist_vision_analysis_with_variants(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${json(vision)}'::jsonb,'${json(envelope)}'::jsonb)`;

before(async () => {
  db = await createPhase9Database();
  await db.exec(`INSERT INTO public.stores(id,display_name)
    VALUES('${STORE_A}','Store A'),('${STORE_B}','Store B');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE_A}','${OWNER}','owner','active');`);
});
beforeEach(resetFixture);
after(async () => db.close());

test('persists title, translation and equal-text authors independently as proposed only', async () => {
  const claimed = await claim();
  const completed = await scalar(db, persistSql(claimed));
  assert.equal(completed.variant_persistence_status, 'accepted');
  assert.equal(completed.proposal_count, 4);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.phase9_search_variant_proposals'), 4);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_proposals
    WHERE status='proposed' AND NOT search_eligible`), 4);
  assert.equal(await scalar(db, `SELECT count(DISTINCT source_field)::int
    FROM public.phase9_search_variant_proposals
    WHERE variant_normalized='lekhak'`), 2);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_proposals
    WHERE variant_type='translation_candidate' AND status='proposed'
      AND NOT search_eligible`), 1);
});

test('exact replay returns the same durable identities without resetting lifecycle', async () => {
  const claimed = await claim();
  const first = await scalar(db, persistSql(claimed));
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
    SET status='rejected',lifecycle_reason='fixture-review',
      rejected_at=transaction_timestamp()
    WHERE id='${first.proposal_ids[0]}'`);
  await setActor(db, OWNER, 'service_role');
  const replay = await scalar(db, persistSql(claimed));
  assert.deepEqual(replay.proposal_ids, first.proposal_ids);
  assert.equal(replay.proposal_count, 4);
  assert.equal(await scalar(db, `SELECT status
    FROM public.phase9_search_variant_proposals
    WHERE id='${first.proposal_ids[0]}'`), 'rejected');
});

test('changed accepted replay is rejected without appending a second proposal set', async () => {
  const claimed = await claim();
  const firstEnvelope = variants([
    proposal(),
    proposal({
      variant_text: 'Godan',
      variant_type: 'roman_alternative',
      variant_normalized: 'godan',
    }),
    proposal({
      variant_text: 'Godaana',
      variant_type: 'roman_alternative',
      variant_normalized: 'godaana',
    }),
    proposal({
      variant_text: 'The Gift of a Cow',
      variant_language: 'en',
      variant_type: 'translation_candidate',
      variant_normalized: 'the gift of a cow',
    }),
  ]);
  const changedEnvelope = variants([
    proposal({
      variant_text: 'Godaana',
      variant_normalized: 'godaana-primary',
    }),
    proposal({
      variant_text: 'Godaanu',
      variant_type: 'roman_alternative',
      variant_normalized: 'godaanu',
    }),
    proposal({
      variant_text: 'Godanu',
      variant_type: 'roman_alternative',
      variant_normalized: 'godanu',
    }),
    proposal({
      variant_text: 'Cow Gift',
      variant_language: 'en',
      variant_type: 'translation_candidate',
      variant_normalized: 'cow gift',
    }),
  ]);
  const first = await scalar(db, persistSql(claimed, firstEnvelope));
  assert.equal(first.proposal_count, 4);
  await assert.rejects(
    db.query(persistSql(claimed, changedEnvelope)),
    /P9_SEARCH_VARIANT_REPLAY_CONFLICT/,
  );
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_proposals
    WHERE source_field='observation:1:title'`), 4);
});

test('invalid source association preserves vision evidence and creates zero proposals', async () => {
  const claimed = await claim();
  const invalid = variants([proposal({ source_text: 'Wrong source' })]);
  const completed = await scalar(db, persistSql(claimed, invalid));
  assert.equal(completed.variant_persistence_status, 'rejected');
  assert.equal(completed.variant_persistence_reason, 'source_mismatch');
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.image_analysis_results'), 1);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.image_extraction_candidates'), 1);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.phase9_search_variant_proposals'), 0);
});

test('rejects wrong observations, author indexes, duplicate forms and trivial Latin rows', async () => {
  const invalidCases = [
    variants([proposal({ source_field: 'observation:2:title' })]),
    variants([proposal({
      source_field: 'observation:1:author:1',
      target_type: 'author',
      author_index: 2,
      source_text: AUTHOR,
    })]),
    variants([
      proposal(),
      proposal({
        variant_type: 'roman_alternative',
        variant_text: 'GODAAN',
        variant_normalized: 'godaan',
      }),
    ]),
    variants([proposal({
      source_text: 'Godaan',
      source_language: 'en',
      source_script: 'Latn',
      source_normalized: 'godaan',
    })]),
  ];
  for (const envelope of invalidCases) {
    await resetFixture();
    const claimed = await claim();
    const completed = await scalar(db, persistSql(claimed, envelope));
    assert.equal(completed.variant_persistence_status, 'rejected');
    assert.equal(await scalar(db,
      'SELECT count(*)::int FROM public.phase9_search_variant_proposals'), 0);
  }
});

test('empty validated envelope persists analysis with zero private proposal rows', async () => {
  const claimed = await claim();
  const completed = await scalar(db, persistSql(claimed, variants([])));
  assert.equal(completed.variant_persistence_status, 'accepted');
  assert.equal(completed.proposal_count, 0);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.phase9_search_variant_proposals'), 0);
});

test('stale and reclaimed claims create no analysis or proposal rows', async () => {
  const stale = await claim();
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  const current = await claim();
  assert.equal(current.attempt_count, 2);
  await assert.rejects(db.query(persistSql(stale)), /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.image_analysis_results'), 0);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.phase9_search_variant_proposals'), 0);
});

test('private read model enforces store scope and bounded filters', async () => {
  const claimed = await claim();
  await scalar(db, persistSql(claimed));
  const candidate = await scalar(db,
    'SELECT id FROM public.image_extraction_candidates LIMIT 1');
  assert.equal((await db.query(`SELECT * FROM public.phase9_read_search_variant_proposals(
    '${STORE_A}',NULL,'${candidate}',NULL,NULL,'proposed')`)).rows.length, 4);
  assert.equal((await db.query(`SELECT * FROM public.phase9_read_search_variant_proposals(
    '${STORE_B}',NULL,'${candidate}',NULL,NULL,'proposed')`)).rows.length, 0);
  await assert.rejects(db.query(`SELECT * FROM public.phase9_read_search_variant_proposals(
    '${STORE_A}',NULL,NULL,NULL,NULL,NULL)`), /P9_OWNER_NOT_AUTHORIZED/);
});

test('clients cannot read, mutate, or execute proposal persistence boundaries', async () => {
  const claimed = await claim();
  await scalar(db, persistSql(claimed));
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(
    'SELECT count(*) FROM public.phase9_search_variant_proposals',
  ), /permission denied/i);
  await assert.rejects(db.query(`UPDATE public.phase9_search_variant_proposals
    SET status='active'`), /permission denied/i);
  await assert.rejects(db.query(persistSql(claimed)), /permission denied/i);
  await assert.rejects(db.query(`SELECT * FROM public.phase9_read_search_variant_proposals(
    '${STORE_A}',NULL,NULL,NULL,NULL,NULL)`), /permission denied/i);
});
