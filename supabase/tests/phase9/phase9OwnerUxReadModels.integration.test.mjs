import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import {
  createPhase9Database, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const STORE = '94000000-0000-0000-0000-000000000001';
const OTHER_STORE = '94000000-0000-0000-0000-000000000002';
const OWNER = '95000000-0000-0000-0000-000000000001';
const OTHER_OWNER = '95000000-0000-0000-0000-000000000002';
const CROSS_OWNER = '95000000-0000-0000-0000-000000000003';
const MANAGER = '95000000-0000-0000-0000-000000000004';
let db;
let sessionSequence = 0;
const json = (value) => JSON.stringify(value).replaceAll("'", "''");
const reviewValue = {
  originalTitle: 'Book', authors: ['Author'], originalLanguage: 'en',
  script: 'Latn', metadataChoice: { mode: 'manual', selectionId: null },
  quantity: 1, priceMinor: 0, baseCondition: 'good',
  damageDisclosure: {
    hasDamage: false, damageTypes: [], damageNote: null,
    isSellable: true, completeReadableSafe: true,
  },
  shelfLocation: 'A1', notes: { publicNote: null, internalNote: null },
  publicationIntent: 'private', duplicateIntent: null,
  originalFieldConfirmation: { title: true, authors: [true] },
  candidateDisposition: 'reviewed',
};

before(async () => {
  db = await createPhase9Database({
    throughMigration: '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
  });
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES
      ('${STORE}','Store'),('${OTHER_STORE}','Other Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
      ('${STORE}','${OWNER}','owner','active'),
      ('${STORE}','${OTHER_OWNER}','owner','active'),
      ('${OTHER_STORE}','${CROSS_OWNER}','owner','active'),
      ('${STORE}','${MANAGER}','manager','active');
  `);
});
afterEach(async () => {
  await resetActor(db);
  await db.exec(`
    DELETE FROM public.phase9_idempotency_keys WHERE operation='C01';
    DELETE FROM public.phase9_search_variant_proposals;
    UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=NULL
      WHERE selected_metadata_snapshot_id IS NOT NULL;
    ALTER TABLE public.phase9_selected_metadata_snapshots
      DISABLE TRIGGER phase9_selected_metadata_snapshot_immutable;
    DELETE FROM public.phase9_selected_metadata_snapshots;
    ALTER TABLE public.phase9_selected_metadata_snapshots
      ENABLE TRIGGER phase9_selected_metadata_snapshot_immutable;
    DELETE FROM public.phase9_metadata_lookups;
    DELETE FROM public.metadata_enrichment_attempts;
    UPDATE public.image_extraction_candidates
      SET committed_inventory_id=NULL,committed_listing_id=NULL
      WHERE store_id='${STORE}';
    DELETE FROM public.marketplace_book_listings
      WHERE inventory_id IN (
        SELECT id FROM public.store_inventory
        WHERE store_id='${STORE}' AND created_by='${OWNER}'
      );
    DELETE FROM public.store_inventory
      WHERE store_id='${STORE}' AND created_by='${OWNER}';
    DELETE FROM public.image_extraction_candidates;
    ALTER TABLE public.image_analysis_observations
      DISABLE TRIGGER image_analysis_observations_immutable;
    ALTER TABLE public.image_analysis_results
      DISABLE TRIGGER image_analysis_results_immutable;
    DELETE FROM public.image_analysis_observations;
    DELETE FROM public.image_analysis_results;
    ALTER TABLE public.image_analysis_observations
      ENABLE TRIGGER image_analysis_observations_immutable;
    ALTER TABLE public.image_analysis_results
      ENABLE TRIGGER image_analysis_results_immutable;
    DELETE FROM public.image_extraction_inputs;
    DELETE FROM public.image_extraction_jobs;
    DELETE FROM public.media_assets WHERE bucket_id='unit6a-fixture';
    DELETE FROM public.image_extraction_sessions;
  `);
});
after(async () => db?.close());

async function createSession(status = 'active') {
  await setActor(db, OWNER);
  sessionSequence += 1;
  const id = await scalar(db, `SELECT public.phase9_start_session(
    NULL,'en',NULL,'good','Shelf A',2,'private',
    'read-model-${String(sessionSequence).padStart(8, '0')}',gen_random_uuid())`);
  if (status !== 'active') {
    await resetActor(db);
    await db.exec(`UPDATE public.image_extraction_sessions SET status='${status}',
      closed_at=CASE WHEN '${status}'='closed' THEN transaction_timestamp() ELSE NULL END
      WHERE id='${id}'`);
  }
  return id;
}

async function createMedia(sessionId, suffix) {
  return scalar(db, `INSERT INTO public.media_assets(
    store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
    detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)
    VALUES('${STORE}','${OWNER}','scan_input','private_scan','unit6a-fixture',
      '${sessionId}/${suffix}','${String(suffix).padStart(64, 'a').slice(-64)}',
      'image/webp',1,1,1,'${sessionId}','phase9_scan_input','approved')
    RETURNING id::text`);
}

test('U6Q02 returns exact defaults, state mapping and reconciled Close categories', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const mediaA = await createMedia(sessionId, 'a');
  const mediaB = await createMedia(sessionId, 'b');
  const mediaC = await createMedia(sessionId, 'c');
  await db.exec(`
    INSERT INTO public.image_extraction_inputs(
      session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version,
      quality_reason,detected_candidate_count)
    VALUES
      ('${sessionId}','${STORE}','${mediaA}','camera','ready','a','v1',NULL,2),
      ('${sessionId}','${STORE}','${mediaB}','gallery','failed','b','v1','P9_VISION_QUALITY_REJECTED',0),
      ('${sessionId}','${STORE}','${mediaC}','camera','skipped','c','v1','P9_VISION_LANGUAGE_MISMATCH',0);
    INSERT INTO public.image_extraction_candidates(
      session_id,input_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,review_disposition,review_ready,metadata_revision)
    SELECT '${sessionId}',i.id,'${STORE}',row_number() over(order by i.id),
      'Book',ARRAY[]::text[],'en',
      CASE WHEN i.state='ready' THEN 'ready' ELSE 'failed' END,
      CASE WHEN i.state='ready' THEN 'reviewed' ELSE NULL END,
      i.state='ready',1
    FROM public.image_extraction_inputs i WHERE i.session_id='${sessionId}';
    INSERT INTO public.image_extraction_candidates(
      session_id,input_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,review_disposition,review_ready,metadata_revision)
    VALUES('${sessionId}',NULL,'${STORE}',4,'Manual',ARRAY[]::text[],'en',
      'needs_review',NULL,false,1);
  `);
  await setActor(db, OWNER);
  const summary = await scalar(db,
    `SELECT public.phase9_owner_session_summary_v2('${sessionId}')`);
  assert.deepEqual(summary.defaults, {
    language: 'en', script: null, condition: 'good',
    location: 'Shelf A', quantity: 2, publication: 'private',
  });
  assert.equal(summary.status, 'active');
  assert.equal(summary.allInputsTerminal, true);
  assert.equal(summary.closeState, 'closeable');
  assert.deepEqual(summary.closeSummary, {
    imagesSubmitted: 3, imagesProcessed: 1, imagesFailed: 1, imagesSkipped: 1,
    candidatesDetected: 4, candidatesReviewReady: 1, candidatesNeedsReview: 3,
    candidatesFailed: 2, falseDetections: 0, manualMissedCandidates: 1,
    committedInventoryItems: 0, quantitiesAddedToExisting: 0,
    privateItems: 0, publishedItems: 0, languageSkips: 1,
    candidateCapSkips: 0, qualitySkips: 1,
  });

  await resetActor(db);
  const privateInventory = await scalar(db, `INSERT INTO public.store_inventory(
    id,store_id,title,authors,language,condition,selling_price_minor,shelf_location,
    quantity_total,quantity_available,has_damage,is_sellable,created_by,
    publication_status,visibility_status)
    VALUES(gen_random_uuid(),'${STORE}','Private outcome',ARRAY['Author'],'en','good',100,'A1',
      1,1,false,true,'${OWNER}','private','draft') RETURNING id::text`);
  const publishedInventory = await scalar(db, `INSERT INTO public.store_inventory(
    id,store_id,title,authors,language,condition,selling_price_minor,shelf_location,
    quantity_total,quantity_available,has_damage,is_sellable,created_by,
    publication_status,visibility_status)
    VALUES(gen_random_uuid(),'${STORE}','Published outcome',ARRAY['Author'],'en','good',100,'A1',
      2,2,false,true,'${OWNER}','published','published') RETURNING id::text`);
  await db.exec(`WITH ranked AS (
      SELECT id,row_number() OVER(ORDER BY candidate_index,id) ordinal
      FROM public.image_extraction_candidates WHERE session_id='${sessionId}'
    )
    UPDATE public.image_extraction_candidates candidate SET
      state='committed',review_disposition='reviewed',review_ready=true,
      committed_inventory_id=CASE ranked.ordinal
        WHEN 1 THEN '${privateInventory}'::uuid ELSE '${publishedInventory}'::uuid END,
      commit_outcome=CASE ranked.ordinal
        WHEN 1 THEN 'committed_private' ELSE 'quantity_incremented' END
    FROM ranked WHERE candidate.id=ranked.id AND ranked.ordinal IN (1,2)`);
  await setActor(db, OWNER);
  const withUnit7 = await scalar(db,
    `SELECT public.phase9_owner_session_summary_v2('${sessionId}')`);
  assert.deepEqual({
    committedInventoryItems: withUnit7.closeSummary.committedInventoryItems,
    quantitiesAddedToExisting: withUnit7.closeSummary.quantitiesAddedToExisting,
    privateItems: withUnit7.closeSummary.privateItems,
    publishedItems: withUnit7.closeSummary.publishedItems,
  }, {
    committedInventoryItems: 2, quantitiesAddedToExisting: 1,
    privateItems: 1, publishedItems: 1,
  });
});

test('U6Q02 maps active, closing, closed and expired without private authority fields', async () => {
  for (const [status, closeState] of [
    ['active', 'closeable'], ['closing', 'not_closeable'],
    ['closed', 'closed'], ['expired', 'expired'],
  ]) {
    const sessionId = await createSession(status);
    await setActor(db, OWNER);
    const value = await scalar(db,
      `SELECT public.phase9_owner_session_summary_v2('${sessionId}')`);
    assert.equal(value.status, status);
    assert.equal(value.closeState, closeState);
    assert.equal('storeId' in value, false);
    assert.equal('createdBy' in value, false);
    await resetActor(db);
    await db.exec(`DELETE FROM public.image_extraction_sessions WHERE id='${sessionId}'`);
  }
});

test('U6Q03 maps every input state/job retry branch and paginates without skips', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const states = ['uploaded','validating','queued','processing','ready','failed','skipped'];
  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    const media = await createMedia(sessionId, `state-${index}`);
    const input = await scalar(db, `INSERT INTO public.image_extraction_inputs(
      session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version,
      validation_error_code,detected_candidate_count)
      VALUES('${sessionId}','${STORE}','${media}','${index % 2 ? 'gallery' : 'camera'}',
      '${state}','hash-${index}','v1',
      ${state === 'failed' ? "'P9_MEDIA_DECODE_FAILED'" : 'NULL'},
      ${state === 'ready' ? '2' : 'NULL'}) RETURNING id::text`);
    if (['validating','queued','processing'].includes(state)) {
      await db.exec(`INSERT INTO public.image_extraction_jobs(
        store_id,entity_type,entity_id,job_kind,status,dedupe_key,last_safe_error_code)
        VALUES('${STORE}','input','${input}','vision_extract',
        '${state === 'processing' ? 'retry_scheduled' : 'open'}',
        'input-job-${index}',
        ${state === 'processing' ? "'P9_VISION_ANALYZER_TIMEOUT'" : 'NULL'})`);
    }
  }
  await setActor(db, OWNER);
  const seen = [];
  let cursor = null;
  do {
    const page = await scalar(db, `SELECT public.phase9_owner_session_inputs_v1(
      '${sessionId}',2,${cursor ? `'${cursor}'` : 'NULL'})`);
    seen.push(...page.items);
    cursor = page.pageInfo.nextCursor;
  } while (cursor);
  assert.deepEqual(seen.map((item) => item.inputState).sort(), states.slice().sort());
  assert.deepEqual(seen.map((item) => item.ordinal), [1,2,3,4,5,6,7]);
  assert.equal(new Set(seen.map((item) => item.inputId)).size, 7);
  assert.equal(seen.find((item) => item.inputState === 'processing').retryState,
    'server_retrying');
  assert.equal(seen.find((item) => item.inputState === 'failed').retryState,
    'new_upload_required');
  assert.equal(seen.find((item) => item.inputState === 'ready').terminal, true);
  assert.ok(seen.every((item) => !('jobId' in item) && !('attemptCount' in item)
    && !('objectPath' in item) && !('leaseToken' in item)));
});

test('input cursor rejects tamper, actor, session, contract and page-size context changes', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const mediaOne = await createMedia(sessionId, 'cursor-one');
  const mediaTwo = await createMedia(sessionId, 'cursor-two');
  await db.exec(`INSERT INTO public.image_extraction_inputs(
    session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES
    ('${sessionId}','${STORE}','${mediaOne}','camera','ready','one','v1'),
    ('${sessionId}','${STORE}','${mediaTwo}','camera','ready','two','v1')`);
  await setActor(db, OWNER);
  const first = await scalar(db, `SELECT public.phase9_owner_session_inputs_v1(
    '${sessionId}',1,NULL)`);
  const cursor = first.pageInfo.nextCursor;
  for (const changed of [`${cursor}x`, cursor.slice(1)]) {
    await assert.rejects(db.query(`SELECT public.phase9_owner_session_inputs_v1(
      '${sessionId}',1,'${changed}')`), /P9_CURSOR_INVALID/);
  }
  await assert.rejects(db.query(`SELECT public.phase9_owner_session_inputs_v1(
    '${sessionId}',2,'${cursor}')`), /P9_CURSOR_INVALID/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions
    SET status='closed',closed_at=transaction_timestamp() WHERE id='${sessionId}'`);
  const secondOwnedSession = await createSession();
  await setActor(db, OWNER);
  await assert.rejects(db.query(`SELECT public.phase9_owner_session_inputs_v1(
    '${secondOwnedSession}',1,'${cursor}')`), /P9_CURSOR_INVALID/);
  await setActor(db, OTHER_OWNER);
  await assert.rejects(db.query(`SELECT public.phase9_owner_session_inputs_v1(
    '${sessionId}',1,'${cursor}')`), /P9_OWNER_NOT_AUTHORIZED|P9_CURSOR_INVALID/);
});

test('U6Q05 exposes every bounded metadata state and no raw evidence', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const job = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,dedupe_key)
    VALUES('${STORE}','candidate',gen_random_uuid(),'metadata_enrich','metadata-job')
    RETURNING id::text`);
  const candidate = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,observed_script,state,metadata_revision)
    VALUES('${sessionId}','${STORE}',1,'Observed',ARRAY['Author'],'en','Latn',
    'needs_review',1) RETURNING id::text`);
  await setActor(db, OWNER);
  const pending = await scalar(db,
    `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidate}')`);
  assert.equal(pending.metadata.state, 'pending');
  assert.equal(pending.metadata.snapshot, null);
  await resetActor(db);
  const lookup = await scalar(db, `INSERT INTO public.phase9_metadata_lookups(
    candidate_id,store_id,job_id,query_identity,execution_mode,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,
    routing_policy_version,privacy_scope,claim_attempt_number,claim_worker,
    claim_lease_token_hash,normalized_outcome)
    VALUES('${candidate}','${STORE}','${job}','q','local','v1','bibliographic',
      'v1','v1','v1','public_bibliographic',1,'worker-0000000001',
      '${'a'.repeat(64)}','manual_metadata_required') RETURNING id::text`);
  await setActor(db, OWNER);
  const manual = await scalar(db,
    `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidate}')`);
  assert.equal(manual.metadata.state, 'manual');
  assert.equal(manual.metadata.snapshot, null);
  for (const [outcome, state] of [
    ['no_match', 'no_match'],
    ['ambiguous', 'ambiguous'],
    ['policy_denied', 'failed'],
  ]) {
    await resetActor(db);
    await db.exec(`UPDATE public.phase9_metadata_lookups
      SET normalized_outcome='${outcome}' WHERE id='${lookup}'`);
    await setActor(db, OWNER);
    const detail = await scalar(db,
      `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidate}')`);
    assert.equal(detail.metadata.state, state);
    assert.equal(detail.metadata.snapshot, null);
  }
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_metadata_lookups
    SET normalized_outcome='technical_failure' WHERE id='${lookup}'`);
  await setActor(db, OWNER);
  const outage = await scalar(db,
    `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidate}')`);
  assert.equal(outage.metadata.state, 'temporarily_unavailable');
  await resetActor(db);
  const edition = await scalar(db, `INSERT INTO public.canonical_editions(
    id,title,authors,language,categories)
    VALUES(gen_random_uuid(),'Canonical',ARRAY['Canonical Author'],'en',
      ARRAY['Fiction']) RETURNING id::text`);
  const snapshot = await scalar(db, `INSERT INTO public.phase9_selected_metadata_snapshots(
    candidate_id,store_id,lookup_id,canonical_edition_id,snapshot_version,
    selection_policy_version,coherent_edition,match_evidence,manual_outcome)
    VALUES('${candidate}','${STORE}','${lookup}','${edition}','v1','v1',NULL,
      '[]','local_canonical_match') RETURNING id::text`);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET selected_metadata_snapshot_id='${snapshot}' WHERE id='${candidate}'`);
  await setActor(db, OWNER);
  const selected = await scalar(db,
    `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidate}')`);
  assert.equal(selected.metadata.state, 'selected');
  assert.equal(selected.metadata.snapshot.title, 'Canonical');
  assert.deepEqual(selected.metadata.snapshot.authors, ['Canonical Author']);
  assert.ok(selected.metadata.revision > outage.metadata.revision);
  const serialized = JSON.stringify(outage);
  for (const forbidden of [
    'raw_payload','match_evidence','confidence','geometry','provider',
    'attempt','cost','prompt','object_path','correlation',
  ]) assert.equal(serialized.includes(forbidden), false);
});

test('U6Q06 covers every blocker code, returns one bounded next ID and no ID array', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const blockingMedia = await createMedia(sessionId, 'blocking');
  const invalidReview = {
    ...reviewValue,
    originalLanguage: '',
    quantity: 0,
    priceMinor: -1,
    baseCondition: null,
    damageDisclosure: null,
    shelfLocation: '',
    publicationIntent: null,
    metadataChoice: null,
    originalFieldConfirmation: { title: false, authors: [false] },
  };
  await db.exec(`
    INSERT INTO public.image_extraction_inputs(
      session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${sessionId}','${STORE}','${blockingMedia}','camera','processing','blocking-input','v1');
    INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,review_disposition,review_ready,metadata_revision,
      owner_review_snapshot)
    VALUES
      ('${sessionId}','${STORE}',1,'Book',ARRAY['Author'],'en',
        'processing',NULL,false,1,NULL),
      ('${sessionId}','${STORE}',2,'Book',ARRAY['Author'],'en',
        'failed',NULL,false,1,NULL),
      ('${sessionId}','${STORE}',3,'Book',ARRAY['Author'],'en',
        'needs_review',NULL,false,1,NULL),
      ('${sessionId}','${STORE}',4,'Book',ARRAY['Author'],'en',
        'needs_review','reviewed',false,1,
        jsonb_build_object('value','${json(invalidReview)}'::jsonb)),
      ('${sessionId}','${STORE}',5,'Book',ARRAY['Author'],'en',
        'possible_duplicate','reviewed',false,1,
        jsonb_build_object('value','${json(reviewValue)}'::jsonb));
    UPDATE public.image_extraction_candidates SET
      duplicate_advice=jsonb_build_object(
        'state','possible_match','targetInventoryId',NULL,
        'matchReason','fuzzy_possible_match','compatibility',jsonb_build_object(),
        'display',jsonb_build_object(),'allowedIntents',
        jsonb_build_array('create_separate')),
      duplicate_advice_version=1
    WHERE session_id='${sessionId}' AND candidate_index=5;
  `);
  const staleCandidate = await scalar(db, `SELECT id::text
    FROM public.image_extraction_candidates
    WHERE session_id='${sessionId}' AND candidate_index=4`);
  const inputId = await scalar(db, `SELECT id::text FROM public.image_extraction_inputs
    WHERE session_id='${sessionId}' LIMIT 1`);
  const visionJob = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,status,dedupe_key)
    VALUES('${STORE}','input','${inputId}','vision_extract','resolved',
      'readiness-variant-job') RETURNING id::text`);
  const analysis = await scalar(db, `INSERT INTO public.image_analysis_results(
    store_id,session_id,input_id,vision_job_id,contract_version,
    analysis_schema_version,pipeline_version,prompt_version,adapter_key,
    adapter_version,provider_key,model_key,model_version,image_outcome,
    authoritative_outcome,detected_visible_book_count,accepted_candidate_count,
    canonical_result_snapshot,canonical_result_sha256,completing_attempt,
    completing_worker,completing_lease_token_hash,completion_summary,received_at)
    VALUES('${STORE}','${sessionId}','${inputId}','${visionJob}','p9-contract-v1',
      'p9-vision-v2','v1','v1','fixture','v1','fixture','fixture','v1',
      'analyzed','accepted',1,1,'{}','${'b'.repeat(64)}',1,
      'fixture-worker-0001','${'c'.repeat(64)}','{}',transaction_timestamp())
    RETURNING id::text`);
  const observation = await scalar(db, `INSERT INTO public.image_analysis_observations(
    analysis_result_id,store_id,input_id,observation_ordinal,disposition,
    observed_title,observed_authors,observed_language,confidence,observation_snapshot)
    VALUES('${analysis}','${STORE}','${inputId}',1,'candidate','Book',
      ARRAY['Author'],'en',1,'{}') RETURNING id::text`);
  await db.exec(`INSERT INTO public.phase9_search_variant_proposals(
    proposal_identity,store_id,analysis_result_id,vision_job_id,candidate_id,
    observation_id,source_field,target_type,author_index,source_text,
    source_language,source_script,source_normalized,variant_text,variant_normalized,
    variant_language,variant_script,variant_type,proposal_schema_version,
    contract_version,generation_source,provider_key,model_key,model_version,
    prompt_version,status,search_eligible,lifecycle_reason,stale_at)
    VALUES('${'d'.repeat(64)}','${STORE}','${analysis}','${visionJob}',
      '${staleCandidate}','${observation}','observation:1:title','title',NULL,
      'Book','en','Latn','book','Buk','buk','en','Latn','roman_alternative',
      'search_variant_proposals_v1','p9-contract-v1','recorded_fixture',
      'fixture','fixture','v1','v1','stale',false,'source_changed',
      transaction_timestamp())`);
  await setActor(db, OWNER);
  const value = await scalar(db,
    `SELECT public.phase9_owner_session_readiness_v1('${sessionId}')`);
  for (const code of [
    'input_processing','candidate_processing','candidate_failed','review_missing',
    'title_unconfirmed','author_confirmation_incomplete','language_missing',
    'metadata_choice_missing','quantity_invalid','price_invalid',
    'condition_missing','damage_answer_missing','damage_details_missing',
    'location_missing','publication_intent_missing','duplicate_intent_missing',
    'variant_source_stale',
  ]) assert.ok(value.blockerCounts[code] > 0, `${code} was not derived`);
  assert.ok(value.nextBlockingCandidateId);
  assert.equal('blockingCandidateIds' in value, false);
  assert.deepEqual(Object.keys(value.blockerCounts).sort(), [
    'author_confirmation_incomplete','candidate_failed','candidate_processing',
    'condition_missing','damage_answer_missing','damage_details_missing',
    'duplicate_intent_missing','input_processing','language_missing',
    'location_missing','metadata_choice_missing','price_invalid',
    'publication_intent_missing','quantity_invalid','review_missing',
    'title_unconfirmed','variant_source_stale',
  ].sort());
});

test('U6Q06 returns the direct ready outcome when no blockers remain', async () => {
  const sessionId = await createSession();
  await setActor(db, OWNER);
  const value = await scalar(db,
    `SELECT public.phase9_owner_session_readiness_v1('${sessionId}')`);
  assert.equal(value.allInputsTerminal, true);
  assert.equal(value.closeState, 'closeable');
  assert.equal(value.closeAllowed, true);
  assert.equal(value.nextBlockingCandidateId, null);
  assert.ok(Object.values(value.blockerCounts).every((count) => count === 0));
});

test('U6Q05 keeps committed and false candidates read-only and out of readiness blockers', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const committed = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,metadata_revision)
    VALUES('${sessionId}','${STORE}',1,'Committed',ARRAY['Author'],'en',
      'committed',1) RETURNING id::text`);
  const skipped = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,review_disposition,metadata_revision)
    VALUES('${sessionId}','${STORE}',2,'False detection',ARRAY[]::text[],'en',
      'ready','skipped_false_detection',1) RETURNING id::text`);
  await setActor(db, OWNER);
  for (const candidateId of [committed, skipped]) {
    const detail = await scalar(db,
      `SELECT public.phase9_owner_candidate_detail_v2(
        '${sessionId}','${candidateId}')`);
    assert.deepEqual(detail.allowedActions, ['view_readiness']);
    assert.equal(detail.readiness.reviewReady, false);
  }
  const readiness = await scalar(db,
    `SELECT public.phase9_owner_session_readiness_v1('${sessionId}')`);
  assert.equal(readiness.nextBlockingCandidateId, null);
  assert.ok(Object.values(readiness.blockerCounts).every((count) => count === 0));
});

test('discovery/queue filter by initiator while all target operations deny noninitiators', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const candidate = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,metadata_revision)
    VALUES('${sessionId}','${STORE}',1,'Private',ARRAY[]::text[],'en',
      'needs_review',1) RETURNING id::text`);
  await setActor(db, OTHER_OWNER);
  const discovery = await scalar(db,
    'SELECT public.phase9_owner_discover_session_v1()');
  const queue = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)");
  assert.equal(discovery.activeSession, null);
  assert.equal(discovery.needsReviewCount, 0);
  assert.equal(queue.items.length, 0);
  const targetCalls = [
    `SELECT public.phase9_owner_session_summary_v2('${sessionId}')`,
    `SELECT public.phase9_owner_session_inputs_v1('${sessionId}',20,NULL)`,
    `SELECT public.phase9_owner_candidates_page_v2('session','${sessionId}','all',20,NULL)`,
    `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidate}')`,
    `SELECT public.phase9_update_candidate_review_v2('${sessionId}','${candidate}',
      1,1,'{}'::jsonb,'denied-review-0001',gen_random_uuid())`,
    `SELECT public.phase9_owner_session_readiness_v1('${sessionId}')`,
    `SELECT public.phase9_close_session_v2('${sessionId}',1,
      'denied-close-00001',gen_random_uuid())`,
  ];
  for (const sql of targetCalls)
    await assert.rejects(db.query(sql), /P9_OWNER_NOT_AUTHORIZED/);
});

test('NeedsReviewMembershipV1 includes active, closing and closed but excludes expired and other initiators', async () => {
  const active = await createSession();
  await resetActor(db);
  const closed = await scalar(db, `INSERT INTO public.image_extraction_sessions(
    store_id,created_by,status,selected_language,default_condition,
    default_location,default_quantity,default_publication)
    VALUES('${STORE}','${OWNER}','closed','en','good','A1',1,'private')
    RETURNING id::text`);
  const expired = await scalar(db, `INSERT INTO public.image_extraction_sessions(
    store_id,created_by,status,selected_language,default_condition,
    default_location,default_quantity,default_publication)
    VALUES('${STORE}','${OWNER}','expired','en','good','A1',1,'private')
    RETURNING id::text`);
  const foreign = await scalar(db, `INSERT INTO public.image_extraction_sessions(
    store_id,created_by,status,selected_language,default_condition,
    default_location,default_quantity,default_publication)
    VALUES('${STORE}','${OTHER_OWNER}','closed','en','good','A1',1,'private')
    RETURNING id::text`);
  for (const [index, session] of [active, closed, expired, foreign].entries()) {
    await db.exec(`INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,metadata_revision)
      VALUES('${session}','${STORE}',1,'Book ${index}',ARRAY[]::text[],
        'en','needs_review',1)`);
  }
  await setActor(db, OWNER);
  let page = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)");
  assert.deepEqual(new Set(page.items.map((item) => item.sessionId)),
    new Set([active, closed]));
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions SET status='closing'
    WHERE id='${active}'`);
  await setActor(db, OWNER);
  page = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)");
  assert.equal(page.items.some((item) =>
    item.sessionId === active && item.sessionStatus === 'closing'), true);
});

test('needs-review pagination is updated-at/id descending and binds actor, filter, page size and scope revision', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  const ids = [];
  for (let index = 1; index <= 3; index += 1) {
    ids.push(await scalar(db, `INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,metadata_revision,updated_at)
      VALUES('${sessionId}','${STORE}',${index},'Book ${index}',
        ARRAY[]::text[],'en','needs_review',1,
        '2026-07-30T00:00:0${index}Z') RETURNING id::text`));
  }
  await setActor(db, OWNER);
  const first = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',2,NULL)");
  assert.deepEqual(first.items.map((item) => item.candidateId), ids.slice().reverse().slice(0, 2));
  const cursor = first.pageInfo.nextCursor;
  await assert.rejects(db.query(
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',51,NULL)"),
  /P9_REQUEST_INVALID/);
  const second = await scalar(db,
    `SELECT public.phase9_owner_candidates_page_v2(
      'needs_review',NULL,'all',2,'${cursor}')`);
  assert.deepEqual(second.items.map((item) => item.candidateId), [ids[0]]);
  await assert.rejects(db.query(`SELECT public.phase9_owner_candidates_page_v2(
    'needs_review',NULL,'needs_attention',2,'${cursor}')`), /P9_CURSOR_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_owner_candidates_page_v2(
    'needs_review',NULL,'all',3,'${cursor}')`), /P9_CURSOR_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_owner_candidates_page_v2(
    'needs_review',NULL,'all',2,'${cursor.slice(0, -1)}x')`), /P9_CURSOR_INVALID/);
  await setActor(db, OTHER_OWNER);
  await assert.rejects(db.query(`SELECT public.phase9_owner_candidates_page_v2(
    'needs_review',NULL,'all',2,'${cursor}')`), /P9_CURSOR_INVALID/);
  await setActor(db, OWNER);
  const discoveryBefore = await scalar(db,
    'SELECT public.phase9_owner_discover_session_v1()');
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET review_ready=true,review_disposition='reviewed',state='ready'
    WHERE id='${ids[0]}'`);
  await setActor(db, OWNER);
  const discoveryAfter = await scalar(db,
    'SELECT public.phase9_owner_discover_session_v1()');
  assert.ok(discoveryAfter.reviewScopeVersion > discoveryBefore.reviewScopeVersion);
  await assert.rejects(db.query(`SELECT public.phase9_owner_candidates_page_v2(
    'needs_review',NULL,'all',2,'${cursor}')`), /P9_CURSOR_INVALID/);
  const restarted = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)");
  assert.equal(restarted.scopeVersion, discoveryAfter.reviewScopeVersion);
  assert.equal(restarted.items.length, discoveryAfter.needsReviewCount);
});

test('needs-review cursor preserves its signed as-of membership across time-only expiry', async () => {
  const sessionId = await createSession();
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions
    SET expires_at=transaction_timestamp()+interval '300 milliseconds'
    WHERE id='${sessionId}'`);
  for (let index = 1; index <= 3; index += 1) {
    await db.exec(`INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,metadata_revision,updated_at,expires_at)
      VALUES('${sessionId}','${STORE}',${index},'Expiring ${index}',
        ARRAY[]::text[],'en','needs_review',1,
        transaction_timestamp()+(${index}||' milliseconds')::interval,
        transaction_timestamp()+interval '300 milliseconds')`);
  }
  await setActor(db, OWNER);
  const first = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',2,NULL)");
  assert.equal(first.items.length, 2);
  assert.ok(first.pageInfo.nextCursor);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const continuation = await scalar(db,
    `SELECT public.phase9_owner_candidates_page_v2(
      'needs_review',NULL,'all',2,'${first.pageInfo.nextCursor}')`);
  assert.equal(continuation.items.length, 1);
  const restarted = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)");
  assert.equal(restarted.items.length, 0);
});
