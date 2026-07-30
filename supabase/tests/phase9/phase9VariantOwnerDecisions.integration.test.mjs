import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createPhase9Database,
  resetActor,
  scalar,
  setActor,
} from './databaseHarness.mjs';
import { createCanonicalBenchmarkPayload } from './variantOwnerFixture.mjs';

const STORE = '72000000-0000-0000-0000-000000000071';
const OTHER_STORE = '72000000-0000-0000-0000-000000000072';
const OWNER = '71000000-0000-0000-0000-000000000071';
const MANAGER = '71000000-0000-0000-0000-000000000072';
const STAFF = '71000000-0000-0000-0000-000000000073';
const INACTIVE_OWNER = '71000000-0000-0000-0000-000000000074';
const OTHER_OWNER = '71000000-0000-0000-0000-000000000075';
const PLATFORM = '71000000-0000-0000-0000-000000000079';
const PLATFORM_2 = '71000000-0000-0000-0000-000000000080';
const SESSION = '73000000-0000-0000-0000-000000000071';
const INPUT = '74000000-0000-0000-0000-000000000071';
const MEDIA = '75000000-0000-0000-0000-000000000071';
const JOB = '76000000-0000-0000-0000-000000000071';
const CORRELATION = '77000000-0000-4000-8000-000000000071';
const WORKER = 'vision-worker-0000000071';
const TITLE = 'ಗೋದಾನ';
let db;

const json = (value) => JSON.stringify(value).replaceAll("'", "''");
const vision = {
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
    author_guesses: [],
    publisher_clue: null,
    isbn_clue: null,
    detected_language: 'kn',
    confidence: 0.9,
    geometry: null,
    warning_codes: [],
  }],
  warning_codes: [],
};
const variants = {
  contract_version: 'p9-contract-v1',
  proposal_schema_version: 'search_variant_proposals_v1',
  analysis_reference: CORRELATION,
  generation_source: 'recorded_fixture',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  prompt_version: 'fixture-prompt-v2',
  proposals: [{
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
  }],
};

async function seed() {
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location,
     orchestration_version,prompt_version)
    VALUES('${SESSION}','${STORE}','${OWNER}','kn','good','A1',
      'phase9-v1','fixture-prompt-v2');
    INSERT INTO public.media_assets
    (id,store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
     detected_mime,bytes,width,height,validation_version,validated_at,
     reencode_version,exif_strip_version,session_id,retention_class,lifecycle_status)
    VALUES('${MEDIA}','${STORE}','${OWNER}','scan_input','private_scan',
      'image-extraction-inputs','${STORE}/scan_input/${SESSION}/${INPUT}/a.webp',
      '${'a'.repeat(64)}','image/webp',32,1,1,'phase9-media-v1',
      transaction_timestamp(),'fixture','fixture','${SESSION}',
      'phase9-private-scan','linked');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT}','${SESSION}','${STORE}','${MEDIA}','camera','queued',
      '${'a'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,
     correlation_id)
    VALUES('${JOB}','${STORE}','input','${INPUT}','vision_extract',
      'vision:${INPUT}','phase9-v1','${CORRELATION}');`);
  const claim = (await db.query(
    `SELECT * FROM marketplace_sec.claim_phase9_vision_jobs(1,'${WORKER}')`,
  )).rows[0];
  await scalar(db, `SELECT marketplace_sec.phase9_vision_job_context(
    '${JOB}','${WORKER}','${claim.lease_token}',${claim.attempt_count})`);
  await scalar(db, `SELECT public.phase9_persist_vision_analysis_with_variants(
    '${JOB}','${WORKER}','${claim.lease_token}',${claim.attempt_count},
    '${json(vision)}'::jsonb,'${json(variants)}'::jsonb)`);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: TITLE, language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
}

async function resetFixture() {
  await resetActor(db);
  await db.exec(`TRUNCATE public.phase9_search_variant_decisions,
    public.phase9_search_variant_alias_links,public.book_search_aliases,
    public.phase9_search_variant_proposal_sets,
    public.phase9_search_variant_proposals,public.image_analysis_observations,
    public.image_analysis_results,public.image_extraction_candidates,
    public.image_extraction_jobs,public.image_extraction_inputs,
    public.media_assets,public.image_extraction_sessions CASCADE`);
  await setActor(db, OWNER, 'service_role');
  await seed();
}

before(async () => {
  db = await createPhase9Database({
    throughMigration:
      '20260729000027_marketplace_phase9_exact_rollout_activation.sql',
  });
  await db.exec(`INSERT INTO public.stores(
      id,display_name,status,setup_status,selling_status)
    VALUES('${STORE}','Store A','active','complete','allowed'),
      ('${OTHER_STORE}','Store B','active','complete','allowed');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active'),
      ('${STORE}','${MANAGER}','manager','active'),
      ('${STORE}','${STAFF}','staff','active'),
      ('${STORE}','${INACTIVE_OWNER}','owner','revoked'),
      ('${OTHER_STORE}','${OTHER_OWNER}','owner','active')`);
});
beforeEach(resetFixture);
after(async () => db.close());

test('Owner read and approve are scoped, versioned and exactly idempotent', async () => {
  const proposal = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  await setActor(db, OWNER, 'authenticated');
  const page = (await db.query(`SELECT * FROM public.phase9_owner_search_variant_review(
    '${STORE}','proposed','title',NULL,NULL,10)`)).rows;
  assert.equal(page.length, 1);
  assert.deepEqual(page[0].allowed_actions,
    ['approve', 'reject', 'replace', 'leave_unresolved']);
  await assert.rejects(db.query(`SELECT * FROM public.phase9_owner_search_variant_review(
    '${OTHER_STORE}',NULL,NULL,NULL,NULL,10)`), /P9_OWNER_NOT_AUTHORIZED/);
  const command = `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'approve','owner_confirmed',NULL,
    'owner-approve-00000071')`;
  assert.equal((await scalar(db, command)).status, 'active');
  assert.equal((await scalar(db, command)).replayed, true);
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'approve','different_reason',NULL,
    'owner-approve-00000071')`), /P9_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'reject','owner_rejected',NULL,
    'owner-reject-00000071')`), /P9_STALE_VERSION/);
});

test('Unit 5C-5 denies manager staff inactive and other-store Owner authority', async () => {
  const proposal = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  for (const actor of [MANAGER, STAFF, INACTIVE_OWNER, OTHER_OWNER]) {
    await setActor(db, actor, 'authenticated');
    await assert.rejects(db.query(
      `SELECT * FROM public.phase9_owner_search_variant_review(
        '${STORE}',NULL,NULL,NULL,NULL,10)`),
    /P9_OWNER_NOT_AUTHORIZED/);
    await assert.rejects(db.query(
      `SELECT public.phase9_owner_decide_search_variant(
        '${STORE}','${proposal}',1,'approve','owner_confirmed',NULL,
        'role-denied-approve-${actor.slice(-4)}')`),
    /P9_OWNER_NOT_AUTHORIZED/);
    await assert.rejects(db.query(
      `SELECT public.phase9_owner_decide_search_variant(
        '${STORE}','${proposal}',1,'reject','owner_rejected',NULL,
        'role-denied-reject-${actor.slice(-4)}')`),
    /P9_OWNER_NOT_AUTHORIZED/);
    await assert.rejects(db.query(
      `SELECT public.phase9_owner_replace_search_variant(
        '${STORE}','${proposal}',1,'Godan','kn-Latn','Latn',
        'roman_alternative','owner_corrected',NULL,
        'role-denied-replace-${actor.slice(-4)}')`),
    /P9_OWNER_NOT_AUTHORIZED/);
  }
});

test('manager replay and stale-reconciled approval remain denied', async () => {
  const proposal = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  await setActor(db, OWNER, 'authenticated');
  const command = `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'approve','owner_confirmed',NULL,
    'owner-role-replay-000071')`;
  assert.equal((await scalar(db, command)).status, 'active');
  await setActor(db, MANAGER, 'authenticated');
  await assert.rejects(db.query(command), /P9_OWNER_NOT_AUTHORIZED/);

  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Changed title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: TITLE, language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  await setActor(db, MANAGER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'approve','owner_reconciled',NULL,
    'manager-stale-approve-0071')`), /P9_OWNER_NOT_AUTHORIZED/);
});

test('Owner reject is terminal for automatic activation', async () => {
  const proposal = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  await setActor(db, OWNER, 'authenticated');
  await scalar(db, `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',1,'reject','owner_rejected',NULL,
    'owner-reject-00000072')`);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT status
    FROM public.phase9_search_variant_proposals WHERE id='${proposal}'`), 'rejected');
});

test('fresh current reconciliation is required for stale Owner approval', async () => {
  const proposal = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Changed title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'approve','owner_reconciled',NULL,
    'owner-stale-approve-000071')`), /P9_STATE_CONFLICT|P9_VARIANT_SOURCE_MISMATCH/);

  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: TITLE, language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  await setActor(db, OWNER, 'authenticated');
  const reviewable = (await db.query(
    `SELECT allowed_actions FROM public.phase9_owner_search_variant_review(
      '${STORE}','stale','title',NULL,NULL,10)`)).rows[0];
  assert.ok(reviewable.allowed_actions.includes('approve'));

  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: 'Newer title', language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'approve','owner_reconciled',NULL,
    'owner-stale-approve-000072')`), /P9_VARIANT_SOURCE_MISMATCH/);
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${OTHER_STORE}','${proposal}',2,'approve','owner_reconciled',NULL,
    'owner-stale-approve-000073')`), /P9_OWNER_NOT_AUTHORIZED/);

  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET owner_review_snapshot='${json({
      confirmed_title: {
        confirmed: true, text: TITLE, language: 'kn', script: 'Knda',
      },
    })}'::jsonb`);
  await setActor(db, OWNER, 'authenticated');
  const command = `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'approve','owner_reconciled',NULL,
    'owner-stale-approve-000074')`;
  assert.equal((await scalar(db, command)).status, 'active');
  assert.equal((await scalar(db, command)).replayed, true);
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'approve','changed_reason',NULL,
    'owner-stale-approve-000074')`), /P9_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(db.query(`SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${proposal}',2,'reject','owner_rejected',NULL,
    'owner-stale-reject-000074')`), /P9_STALE_VERSION/);
});

test('Owner replacement preserves source/model evidence in a distinct row', async () => {
  const source = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  await setActor(db, OWNER, 'authenticated');
  const result = await scalar(db, `SELECT public.phase9_owner_replace_search_variant(
    '${STORE}','${source}',1,'Godan','kn-Latn','Latn','roman_alternative',
    'owner_corrected',NULL,'owner-replace-00000071')`);
  await resetActor(db);
  assert.notEqual(result.replacement_proposal_id, source);
  assert.equal(await scalar(db, `SELECT generation_source
    FROM public.phase9_search_variant_proposals
    WHERE id='${result.replacement_proposal_id}'`), 'owner_correction');
  assert.equal(await scalar(db, `SELECT source_proposal_id::text
    FROM public.phase9_search_variant_proposals
    WHERE id='${result.replacement_proposal_id}'`), source);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.phase9_search_variant_proposals
    WHERE id='${source}' AND status='rejected'`), 1);
});

test('Owner-origin corrections can be rejected and replaced again', async () => {
  const source = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  await setActor(db, OWNER, 'authenticated');
  const first = await scalar(db, `SELECT public.phase9_owner_replace_search_variant(
    '${STORE}','${source}',1,'Godan','kn-Latn','Latn','roman_alternative',
    'owner_corrected',NULL,'owner-replace-00000072')`);
  const second = await scalar(db, `SELECT public.phase9_owner_replace_search_variant(
    '${STORE}','${first.replacement_proposal_id}',1,'Godaana','kn-Latn','Latn',
    'roman_alternative',
    'owner_corrected',NULL,'owner-replace-00000073')`);
  await scalar(db, `SELECT public.phase9_owner_decide_search_variant(
    '${STORE}','${second.replacement_proposal_id}',1,'reject','owner_rejected',
    NULL,'owner-reject-00000073')`);
  assert.notEqual(second.replacement_proposal_id, first.replacement_proposal_id);
});

test('platform benchmark and rollout RPCs fence replay, authority and revocation', async () => {
  const benchmark = createCanonicalBenchmarkPayload(
    Array(100).fill('complete'), 1,
  );
  const manifest = json(benchmark.manifest);
  const execution = (changed = false) => json({
    ...benchmark.execution,
    result: changed
      ? { ...benchmark.execution.result, denial_reason: 'changed_replay' }
      : benchmark.execution.result,
  });
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_record_search_variant_benchmark(
    '${manifest}'::jsonb,'${execution()}'::jsonb)`), /permission denied/i);
  await setActor(db, OWNER, 'service_role');
  const recorded = await scalar(db,
    `SELECT public.phase9_record_search_variant_benchmark(
      '${manifest}'::jsonb,'${execution()}'::jsonb)`);
  const replay = await scalar(db,
    `SELECT public.phase9_record_search_variant_benchmark(
      '${manifest}'::jsonb,'${execution()}'::jsonb)`);
  assert.deepEqual(replay, recorded);
  const proposal = await scalar(db,
    'SELECT id::text FROM public.phase9_search_variant_proposals');
  assert.equal(await scalar(db,
    `SELECT public.phase9_search_variant_automatic_activation_allowed(
      '${proposal}','kn','Knda','title','fixture_multimodal','2026-07-26',
      'fixture-prompt-v2','search_variant_proposals_v1')`), false);
  await assert.rejects(db.query(
    `SELECT public.phase9_record_search_variant_benchmark(
      '${manifest}'::jsonb,'${execution(true)}'::jsonb)`),
  /P9_BENCHMARK_ELIGIBILITY_MISMATCH|P9_IDEMPOTENCY_CONFLICT/);

  await resetActor(db);
  await db.exec(`CREATE OR REPLACE FUNCTION marketplace_sec.has_platform_role(
    roles text[]) RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT auth.uid() IN ('${PLATFORM}'::uuid,'${PLATFORM_2}'::uuid)
        AND 'platform_admin'=ANY(roles)
    $$`);
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query(`SELECT public.phase9_review_search_variant_benchmark(
      '${recorded.execution_id}','approved','benchmark_approved',NULL,
      '${'1'.repeat(64)}',NULL)`), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(db.query(
    'SELECT * FROM public.phase9_platform_search_variant_rollout_state()'),
  /P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, PLATFORM, 'authenticated');
  await db.exec('BEGIN');
  const review = await scalar(db,
    `SELECT public.phase9_review_search_variant_benchmark(
      '${recorded.execution_id}','approved','benchmark_approved',NULL,
      '${'1'.repeat(64)}',NULL)`);
  assert.equal(await scalar(db,
    `SELECT public.phase9_review_search_variant_benchmark(
      '${recorded.execution_id}','approved','benchmark_approved',NULL,
      '${'1'.repeat(64)}',NULL)`), review);
  await scalar(db, `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,true,true,true,
      '${review}','rollout_approved','${'2'.repeat(64)}')`);
  await setActor(db, PLATFORM_2, 'authenticated');
  await db.exec('SAVEPOINT cross_actor_review');
  await assert.rejects(db.query(`SELECT public.phase9_review_search_variant_benchmark(
      '${recorded.execution_id}','approved','benchmark_approved',NULL,
      '${'1'.repeat(64)}',NULL)`), /P9_IDEMPOTENCY_CONFLICT/);
  await db.exec('ROLLBACK TO SAVEPOINT cross_actor_review');
  await db.exec('SAVEPOINT cross_actor_rollout');
  await assert.rejects(db.query(`SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,true,true,true,
      '${review}','rollout_approved','${'2'.repeat(64)}')`),
  /P9_IDEMPOTENCY_CONFLICT/);
  await db.exec('ROLLBACK TO SAVEPOINT cross_actor_rollout');
  await setActor(db, PLATFORM, 'authenticated');
  assert.equal((await scalar(db,
    `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,true,true,true,
      '${review}','rollout_approved','${'2'.repeat(64)}')`)).replayed, true);
  await scalar(db, `SELECT public.phase9_review_search_variant_benchmark(
      '${recorded.execution_id}','revoked','benchmark_revoked',NULL,
      '${'3'.repeat(64)}','${review}')`);
  await db.exec('COMMIT');
  await assert.rejects(db.query(
    `SELECT public.phase9_review_search_variant_benchmark(
      '${recorded.execution_id}','approved','changed_reason',NULL,
      '${'1'.repeat(64)}',NULL)`), /P9_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(db.query(
    `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v1',1,true,false,false,
      NULL,'rollout_approved','${'2'.repeat(64)}')`),
  /P9_IDEMPOTENCY_CONFLICT/);
  const state = (await db.query(
    'SELECT * FROM public.phase9_platform_search_variant_rollout_state()')).rows;
  assert.equal(state.length, 1);
  assert.equal(state[0].automatic_activation_enabled, true);
  assert.equal(state[0].review_status, 'revoked');
  await setActor(db, OWNER, 'service_role');
  assert.equal(await scalar(db,
    `SELECT public.phase9_search_variant_automatic_activation_allowed(
      '${proposal}','kn','Knda','title','fixture_multimodal','2026-07-26',
      'fixture-prompt-v2','search_variant_proposals_v1')`), false);
  assert.equal(await scalar(db,
    `SELECT public.phase9_search_variant_automatic_activation_allowed(
      '${proposal}','kn','Knda','title','fixture_multimodal','wrong-version',
      'fixture-prompt-v2','search_variant_proposals_v1')`), false);
  await setActor(db, PLATFORM, 'authenticated');
  await assert.rejects(db.query(
    `SELECT public.phase9_set_search_variant_language_rollout(
    'kn','Knda','fixture-policy-v2',2,false,true,false,NULL,
    'roman_only','${'4'.repeat(64)}')`),
  /P9_ROLLOUT_EVIDENCE_INVALID/);
  await scalar(db, `SELECT public.phase9_set_search_variant_language_rollout(
    'kn','Knda','fixture-policy-v2',2,false,false,false,NULL,
    'all_disabled','${'4'.repeat(64)}')`);
  const independent = (await db.query(
    'SELECT * FROM public.phase9_platform_search_variant_rollout_state()')).rows[0];
  assert.equal(independent.vision_enabled, false);
  assert.equal(independent.romanization_enabled, false);
  assert.equal(independent.automatic_activation_enabled, false);
  await assert.rejects(db.query(
    `SELECT public.phase9_set_search_variant_language_rollout(
      'kn','Knda','fixture-policy-v3',2,true,false,false,NULL,
      'stale_writer','${'5'.repeat(64)}')`), /P9_STALE_VERSION/);
  await resetActor(db);
  const audit = (await db.query(`SELECT previous_policy_version,
    resulting_policy_version,previous_review_id::text,resulting_review_id::text
    FROM public.phase9_search_variant_rollout_audit ORDER BY changed_at`)).rows;
  assert.deepEqual(audit[0], {
    previous_policy_version: null,
    resulting_policy_version: 'fixture-policy-v1',
    previous_review_id: null,
    resulting_review_id: review,
  });
});
