import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import {
  createPhase9Database, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const STORE = 'a6000000-0000-0000-0000-000000000001';
const OTHER_STORE = 'a6000000-0000-0000-0000-000000000002';
const OWNER = 'a7000000-0000-0000-0000-000000000001';
const MANAGER = 'a7000000-0000-0000-0000-000000000002';
const OTHER_OWNER = 'a7000000-0000-0000-0000-000000000003';
let db;
let sequence = 0;

const escape = (value) => JSON.stringify(value).replaceAll("'", "''");
const review = {
  originalTitle: 'Observed Book',
  authors: ['Observed Author'],
  originalLanguage: 'en',
  script: 'Latn',
  metadataChoice: { mode: 'manual', selectionId: null },
  quantity: 1,
  priceMinor: 0,
  baseCondition: 'good',
  damageDisclosure: {
    hasDamage: false, damageTypes: [], damageNote: null,
    isSellable: true, completeReadableSafe: true,
  },
  shelfLocation: 'A1',
  notes: { publicNote: null, internalNote: null },
  publicationIntent: 'private',
  duplicateIntent: null,
  originalFieldConfirmation: { title: true, authors: [true] },
  candidateDisposition: 'reviewed',
};

before(async () => {
  db = await createPhase9Database({
    throughMigration: '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
  });
  await db.exec(`INSERT INTO public.stores(id,display_name,status,setup_status,selling_status)
    VALUES('${STORE}','Store A','active','complete','allowed'),
      ('${OTHER_STORE}','Store B','active','complete','allowed');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES('${STORE}','${OWNER}','owner','active'),
      ('${STORE}','${MANAGER}','manager','active'),
      ('${OTHER_STORE}','${OTHER_OWNER}','owner','active')`);
});

beforeEach(async () => {
  sequence += 1;
  await resetActor(db);
  await db.exec(`TRUNCATE public.phase9_search_variant_decisions,
    public.phase9_search_variant_alias_links,public.book_search_aliases,
    public.phase9_search_variant_proposal_sets,public.phase9_search_variant_proposals,
    public.image_analysis_observations,public.image_analysis_results,
    public.image_extraction_candidates,public.image_extraction_jobs,
    public.image_extraction_inputs,public.media_assets,public.image_extraction_sessions CASCADE`);
});

after(async () => db?.close());

async function fixture() {
  await setActor(db, OWNER);
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(
    NULL,'en','Latn','good','A1',1,'private',
    'unit6e-session-${String(sequence).padStart(8, '0')}',gen_random_uuid())`);
  await resetActor(db);
  const media = await scalar(db, `INSERT INTO public.media_assets(
    store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
    detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)
    VALUES('${STORE}','${OWNER}','scan_input','private_scan','unit6e-review',
      '${sessionId}/scan.webp','${String(sequence).padStart(64, 'a').slice(-64)}',
      'image/webp',1,1,1,'${sessionId}','phase9_scan_input','approved')
    RETURNING id::text`);
  const input = await scalar(db, `INSERT INTO public.image_extraction_inputs(
    session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${sessionId}','${STORE}','${media}','camera','ready',
      'unit6e-${sequence}','v1') RETURNING id::text`);
  const job = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,status,dedupe_key)
    VALUES('${STORE}','input','${input}','vision_extract','resolved',
      'unit6e-vision-${sequence}') RETURNING id::text`);
  const analysis = await scalar(db, `INSERT INTO public.image_analysis_results(
    store_id,session_id,input_id,vision_job_id,contract_version,
    analysis_schema_version,pipeline_version,prompt_version,adapter_key,
    adapter_version,provider_key,model_key,model_version,image_outcome,
    authoritative_outcome,detected_visible_book_count,accepted_candidate_count,
    canonical_result_snapshot,canonical_result_sha256,completing_attempt,
    completing_worker,completing_lease_token_hash,completion_summary,received_at)
    VALUES('${STORE}','${sessionId}','${input}','${job}','p9-contract-v1',
      'p9-vision-v2','v1','v1','fixture','v1','fixture','fixture','v1',
      'analyzed','accepted',1,1,'{}','${'b'.repeat(64)}',1,
      'unit6e-worker-001','${'c'.repeat(64)}','{}',transaction_timestamp())
    RETURNING id::text`);
  const observation = await scalar(db, `INSERT INTO public.image_analysis_observations(
    analysis_result_id,store_id,input_id,observation_ordinal,disposition,
    observed_title,observed_authors,observed_language,confidence,observation_snapshot)
    VALUES('${analysis}','${STORE}','${input}',1,'candidate','Observed Book',
      ARRAY['Observed Author'],'en',1,'{}') RETURNING id::text`);
  const candidate = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,input_id,vision_job_id,analysis_observation_id,
    analysis_schema_version,candidate_index,
    observed_title,observed_authors,observed_language,observed_script,state,
    metadata_revision)
    VALUES('${sessionId}','${STORE}','${input}','${job}','${observation}',
      'p9-vision-v2',1,
      'Observed Book',ARRAY['Observed Author'],'en','Latn','needs_review',1)
    RETURNING id::text`);
  const titleProposal = await scalar(db, `INSERT INTO public.phase9_search_variant_proposals(
    proposal_identity,store_id,analysis_result_id,vision_job_id,candidate_id,
    observation_id,source_field,target_type,author_index,source_text,
    source_language,source_script,source_normalized,variant_text,variant_normalized,
    variant_language,variant_script,variant_type,proposal_schema_version,
    contract_version,generation_source,provider_key,model_key,model_version,
    prompt_version,status,search_eligible)
    VALUES('${'d'.repeat(64)}','${STORE}','${analysis}','${job}','${candidate}',
      '${observation}','observation:1:title','title',NULL,'Observed Book','en',
      'Latn','observed book','Observed Buk','observed buk','en','Latn',
      'roman_alternative','search_variant_proposals_v1','p9-contract-v1',
      'recorded_fixture','fixture','fixture','v1','v1','proposed',false)
    RETURNING id::text`);
  const authorProposal = await scalar(db, `INSERT INTO public.phase9_search_variant_proposals(
    proposal_identity,store_id,analysis_result_id,vision_job_id,candidate_id,
    observation_id,source_field,target_type,author_index,source_text,
    source_language,source_script,source_normalized,variant_text,variant_normalized,
    variant_language,variant_script,variant_type,proposal_schema_version,
    contract_version,generation_source,provider_key,model_key,model_version,
    prompt_version,status,search_eligible)
    VALUES('${'e'.repeat(64)}','${STORE}','${analysis}','${job}','${candidate}',
      '${observation}','observation:1:author:1','author',1,'Observed Author','en',
      'Latn','observed author','Observed Auther','observed auther','en','Latn',
      'roman_alternative','search_variant_proposals_v1','p9-contract-v1',
      'recorded_fixture','fixture','fixture','v1','v1','proposed',false)
    RETURNING id::text`);
  const versions = (await db.query(`SELECT version,metadata_revision
    FROM public.image_extraction_candidates WHERE id='${candidate}'`)).rows[0];
  return { sessionId, candidate, titleProposal, authorProposal, ...versions };
}

test('the production U6C01 review shape remains visible to M24 for title and author', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  await scalar(db, `SELECT public.phase9_update_candidate_review_v2(
    '${ids.sessionId}','${ids.candidate}',${ids.version},${ids.metadata_revision},
    '${escape(review)}'::jsonb,
    'unit6e-review-save-0001',gen_random_uuid())`);
  const rows = (await db.query(`SELECT * FROM public.phase9_owner_search_variant_review(
    '${STORE}',NULL,NULL,NULL,NULL,100)`)).rows;
  assert.equal(rows.length, 2);
  const title = rows.find((row) => row.proposal_id === ids.titleProposal);
  const author = rows.find((row) => row.proposal_id === ids.authorProposal);
  assert.equal(title.confirmed_source_text, 'Observed Book');
  assert.equal(author.confirmed_source_text, 'Observed Author');
  assert.equal(author.author_position, 0);
  for (const row of rows) {
    assert.equal(row.concurrency_version, 1);
    assert.equal(row.lifecycle_status, 'proposed');
    assert.deepEqual(row.allowed_actions,
      ['approve','reject','replace','leave_unresolved']);
  }
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::integer FROM public.store_inventory`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::integer FROM public.marketplace_book_listings`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::integer FROM public.book_search_aliases`), 0);
  assert.equal(await scalar(db, `SELECT bool_and(status='proposed' AND NOT search_eligible)
    FROM public.phase9_search_variant_proposals WHERE candidate_id='${ids.candidate}'`), true);
  for (const actor of [MANAGER, OTHER_OWNER]) {
    await setActor(db, actor);
    await assert.rejects(db.query(`SELECT * FROM public.phase9_owner_search_variant_review(
      '${STORE}',NULL,NULL,NULL,NULL,100)`), /P9_OWNER_NOT_AUTHORIZED/);
  }
});

test('the pre-U6C01 canonical confirmation envelope remains backward compatible', async () => {
  const ids = await fixture();
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates SET owner_review_snapshot='${escape({
    confirmed_title: {
      confirmed: true, text: 'Observed Book', language: 'en', script: 'Latn',
    },
    confirmed_authors: [{
      index: 1, confirmed: true, text: 'Observed Author', language: 'en', script: 'Latn',
    }],
  })}'::jsonb WHERE id='${ids.candidate}'`);
  await setActor(db, OWNER);
  const rows = (await db.query(`SELECT * FROM public.phase9_owner_search_variant_review(
    '${STORE}',NULL,NULL,NULL,NULL,100)`)).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((row) => row.confirmed_source_text)),
    new Set(['Observed Book', 'Observed Author']));
});

test('U6Q05 exposes stale-only proposal IDs so M24 can resolve the canonical recovery entry', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  await scalar(db, `SELECT public.phase9_update_candidate_review_v2(
    '${ids.sessionId}','${ids.candidate}',${ids.version},${ids.metadata_revision},
    '${escape(review)}'::jsonb,
    'unit6e-stale-save-0001',gen_random_uuid())`);
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals SET
    status='stale',search_eligible=false,lifecycle_reason='source_changed',
    stale_at=transaction_timestamp(),lifecycle_version=lifecycle_version+1
    WHERE candidate_id='${ids.candidate}'`);
  await setActor(db, OWNER);
  const detail = await scalar(db, `SELECT public.phase9_owner_candidate_detail_v2(
    '${ids.sessionId}','${ids.candidate}')`);
  assert.ok(detail.attentionCodes.includes('variant_source_stale'));
  assert.ok(detail.readiness.blockers.some((row) => row.code === 'variant_source_stale'));
  assert.ok(detail.allowedActions.includes('open_variant_review'));
  assert.deepEqual(new Set(detail.variantSummary.proposalVersions.map((row) => row.proposalId)),
    new Set([ids.titleProposal, ids.authorProposal]));
  const rows = (await db.query(`SELECT * FROM public.phase9_owner_search_variant_review(
    '${STORE}',NULL,NULL,NULL,NULL,100)`)).rows;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.lifecycle_status === 'stale'));
});
