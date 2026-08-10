import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createPhase9Database, resetActor, scalar, setActor } from './databaseHarness.mjs';

const STORE = '72000000-0000-0000-0000-000000000051';
const OTHER_STORE = '72000000-0000-0000-0000-000000000052';
const OWNER = '71000000-0000-0000-0000-000000000051';
const SESSION = '73000000-0000-0000-0000-000000000051';
const INPUT = '74000000-0000-0000-0000-000000000051';
const VISION_JOB = '74000000-0000-0000-0000-000000000052';
const ANALYSIS_RESULT = '74000000-0000-0000-0000-000000000053';
const OBSERVATION = '74000000-0000-0000-0000-000000000054';
const CANDIDATE = '75000000-0000-0000-0000-000000000051';
const JOB = '76000000-0000-0000-0000-000000000051';
const RESERVATION = '77000000-0000-0000-0000-000000000051';
const ATTEMPT_IDENTITY = '78000000-0000-4000-8000-000000000051';
const CANONICAL_WORK = '79000000-0000-0000-0000-000000000051';
const CANONICAL_EDITION = '79000000-0000-0000-0000-000000000052';
const FOLLOWER = '75000000-0000-0000-0000-000000000052';
const FOLLOWER_JOB = '76000000-0000-0000-0000-000000000052';
const WORKER = 'metadata-worker-0000051';
const QUERY = '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "bibliographic", null, "fixture book", ["fixture author"], "en", []]';
let db;

async function seed() {
  await db.exec(`INSERT INTO public.image_extraction_sessions
    (id,store_id,created_by,selected_language,default_condition,default_location)
    VALUES('${SESSION}','${STORE}','${OWNER}','en','good','A1');
    INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,source_kind,state,sha256,orchestration_version)
    VALUES('${INPUT}','${SESSION}','${STORE}','camera','uploaded','${'b'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,status,
      completed_at)
    VALUES('${VISION_JOB}','${STORE}','input','${INPUT}','vision_extract',
      'vision:${INPUT}','phase9-v1','resolved',transaction_timestamp());
    INSERT INTO public.image_analysis_results
    (id,store_id,session_id,input_id,vision_job_id,contract_version,
      analysis_schema_version,pipeline_version,prompt_version,adapter_key,adapter_version,
      provider_key,model_key,model_version,image_outcome,authoritative_outcome,
      detected_visible_book_count,accepted_candidate_count,canonical_result_snapshot,
      canonical_result_sha256,completing_attempt,completing_worker,
      completing_lease_token_hash,completion_summary,received_at)
    VALUES('${ANALYSIS_RESULT}','${STORE}','${SESSION}','${INPUT}','${VISION_JOB}',
      'p9-contract-v1','p9-vision-v2','phase9-v1','fixture-prompt-v2','fixture_adapter',
      '1.0.0','recorded_fixture','fixture_model','1','analyzed','accepted',1,1,
      '{}'::jsonb,'${'c'.repeat(64)}',1,'vision-worker-foundation-0051',
      '${'d'.repeat(64)}','{"outcome":"accepted"}'::jsonb,transaction_timestamp());
    INSERT INTO public.image_analysis_observations
    (id,analysis_result_id,store_id,input_id,observation_ordinal,disposition,
      observed_title,observed_authors,observed_language,confidence,observation_snapshot)
    VALUES('${OBSERVATION}','${ANALYSIS_RESULT}','${STORE}','${INPUT}',1,'candidate',
      'Fixture Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb);
    INSERT INTO public.image_extraction_candidates
    (id,session_id,input_id,store_id,candidate_index,observed_title,
      observed_authors,observed_language,state,vision_job_id,analysis_observation_id,
      analysis_schema_version)
    VALUES('${CANDIDATE}','${SESSION}','${INPUT}','${STORE}',1,'Fixture Book',
      ARRAY['Fixture Author'],'en','needs_review','${VISION_JOB}','${OBSERVATION}',
      'p9-vision-v2');
    UPDATE public.image_extraction_candidates SET state='processing' WHERE id='${CANDIDATE}';
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES('${JOB}','${STORE}','candidate','${CANDIDATE}','metadata_enrich',
      'metadata:${CANDIDATE}','phase9-metadata-v1');
    INSERT INTO public.phase9_usage_reservations
    (id,store_id,job_id,cost_kind,policy_version,operation,adapter_key,adapter_version,
      idempotency_identity,reserved_cost_units)
    VALUES('${RESERVATION}','${STORE}','${JOB}','metadata',1,'metadata_lookup',
      'recorded_metadata','1.0.0','metadata-reservation-0051',1);`);
}

async function claim() {
  return (await db.query(
    `SELECT * FROM public.claim_phase9_metadata_jobs(1,'${WORKER}')`,
  )).rows[0];
}

async function lookup(claimed, leader = 'NULL') {
  return scalar(db, `SELECT public.phase9_register_metadata_lookup(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${QUERY}','provider-cache-fixture-0051','recorded_metadata','1.0.0',
    'cap-v1','p9-metadata-v1','bibliographic','p9-metadata-lookup-v1',
    'p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','store_private','1','cache-policy-v1',
    'metadata-v1',${leader})`);
}

async function completeLeader() {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  const registered = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata',
    '1.0.0','cap-v1','p9-metadata-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','local_insufficient','${RESERVATION}')`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_attempt(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'accepted','coherent_match',NULL,'miss',25,
    'fixture','{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0,
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb)`);
  await scalar(db, `SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${registered.attempt_id}','${registered.attempt_id}',
    'p9-selected-metadata-v1',
    'selection-v1','{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    '["validated_isbn"]'::jsonb,'accepted_metadata_match',NULL)`);
  return { claimed, registeredLookup, registered };
}

before(async () => {
  db = await createPhase9Database({
    throughMigration: '20260807000032_marketplace_phase9_structural_metadata_integration.sql',
  });
  await db.exec(`INSERT INTO public.stores(id,display_name)
    VALUES('${STORE}','Store'),('${OTHER_STORE}','Other Store');`);
});
beforeEach(async () => {
  await resetActor(db);
  await db.exec(`TRUNCATE public.phase9_selected_metadata_snapshots,
    public.phase9_metadata_cache_entries,public.phase9_metadata_lookups,
    public.metadata_enrichment_attempts,public.phase9_usage_reservations,
    public.image_extraction_candidates,public.image_extraction_jobs,
    public.image_extraction_inputs,public.image_extraction_sessions CASCADE;`);
  await seed();
  await setActor(db, OWNER, 'service_role');
  await db.exec(`INSERT INTO public.phase9_provider_registry(
    adapter_key,provider_kind,adapter_version,enabled,matching_allowed,storage_allowed,
    revalidation_seconds)
    VALUES('recorded_metadata','metadata','1.0.0',true,true,true,86400),
      ('recorded_secondary','metadata','2.0.0',true,true,true,86400),
      ('matching_only','metadata','1.0.0',true,true,false,86400)
    ON CONFLICT(adapter_key) DO UPDATE SET provider_kind='metadata',
      adapter_version=excluded.adapter_version,enabled=true,matching_allowed=true,
      storage_allowed=excluded.storage_allowed,
      revalidation_seconds=excluded.revalidation_seconds;`);
});
after(async () => db.close());

test('claims one metadata job with a durable fenced token and excludes a second claimant', async () => {
  const claimed = await claim();
  assert.equal(claimed.attempt_count, 1);
  assert.match(claimed.lease_token, /^[0-9a-f]{64}$/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT lease_token_hash =
    encode(extensions.digest('${claimed.lease_token}','sha256'),'hex')
    FROM public.image_extraction_jobs WHERE id='${JOB}'`), true);
  await setActor(db, OWNER, 'service_role');
  assert.equal((await db.query(
    `SELECT * FROM public.claim_phase9_metadata_jobs(1,'metadata-worker-0000052')`,
  )).rows.length, 0);
});

test('completes a strong local canonical match with no provider, attempt, reservation, or cost', async () => {
  await resetActor(db);
  await db.exec(`DELETE FROM public.phase9_usage_reservations WHERE job_id='${JOB}';
    DELETE FROM public.phase9_provider_registry WHERE provider_kind='metadata';
    INSERT INTO public.canonical_works(id,title_normalized,primary_authors,language)
    VALUES('${CANONICAL_WORK}','fixture book',ARRAY['Fixture Author'],'en')
    ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.canonical_editions(
      id,work_id,isbn_13,title,authors,language)
    VALUES('${CANONICAL_EDITION}','${CANONICAL_WORK}','9780306406157',
      'Fixture Book',ARRAY['Fixture Author'],'en')
    ON CONFLICT(id) DO NOTHING;`);
  await setActor(db, OWNER, 'service_role');
  const claimed = await claim();
  const completionSql = `SELECT public.phase9_complete_local_metadata_match(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${QUERY}','isbn','p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','store_private','p9-metadata-v1',
    '${CANONICAL_EDITION}','p9-selected-metadata-v1','selection-v1',
    '["validated_isbn"]'::jsonb)`;
  const completed = await scalar(db, completionSql);
  assert.equal(completed.manual_outcome, 'local_canonical_match');
  assert.equal(completed.creates_provider_charge, false);
  assert.deepEqual(await scalar(db, completionSql), completed);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_provider_registry
    WHERE provider_kind='metadata'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${CANDIDATE}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_usage_reservations
    WHERE job_id='${JOB}'`), 0);
  assert.equal(await scalar(db, `SELECT execution_mode FROM public.phase9_metadata_lookups
    WHERE id='${completed.lookup_id}'`), 'local');
  assert.equal(await scalar(db, `SELECT canonical_edition_id='${CANONICAL_EDITION}'
    AND selected_attempt_id IS NULL AND outcome_source_attempt_id IS NULL
    FROM public.phase9_selected_metadata_snapshots
    WHERE id='${completed.snapshot_id}'`), true);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs
    WHERE id='${JOB}'`), 'resolved');
  assert.equal(await scalar(db, `SELECT state='ready'
    AND canonical_edition_id='${CANONICAL_EDITION}'
    AND selected_metadata_snapshot_id='${completed.snapshot_id}'
    FROM public.image_extraction_candidates WHERE id='${CANDIDATE}'`), true);
});

test('registers/finalizes one fenced primary attempt with cost linkage and idempotent replay', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  const registered = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata',
    '1.0.0','cap-v1','p9-metadata-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','local_insufficient','${RESERVATION}')`);
  await assert.rejects(db.query(`UPDATE public.metadata_enrichment_attempts
    SET raw_payload='{"provider":"raw"}'::jsonb WHERE id='${registered.attempt_id}'`));
  const finalizedSql = `SELECT public.phase9_finalize_metadata_attempt(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'accepted','coherent_match','provider-request-51',
    'miss',25,'fixture-pricing-v1',
    '{"currency":"USD","input_basis":"request","input_unit_cost":0.25,
      "pricing_source_version":"fixture-v1"}'::jsonb,
    0.25,'{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb)`;
  assert.equal((await scalar(db, finalizedSql)).disposition, 'accepted');
  assert.equal((await scalar(db, finalizedSql)).disposition, 'accepted');
  const row = (await db.query(`SELECT * FROM public.metadata_enrichment_attempts
    WHERE id='${registered.attempt_id}'`)).rows[0];
  assert.equal(row.usage_reservation_id, RESERVATION);
  assert.equal(row.provider_role, 'primary');
  assert.equal(Number(row.calculated_cost_units), 0.25);
  assert.equal(await scalar(db, `SELECT status FROM public.phase9_usage_reservations
    WHERE id='${RESERVATION}'`), 'consumed');
});

test('runs one eligible secondary with its own cache identity and aggregate route cost', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  const primary = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'local_insufficient','${RESERVATION}')`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_attempt(
    '${primary.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'failed','timeout',NULL,'miss',25,
    'fixture-pricing-v1','{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0.25,NULL)`);
  const secondary = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'78000000-0000-4000-8000-000000000054',
    'provider-cache-secondary-0051','secondary',2,'recorded_secondary','2.0.0',
    'cap-v2','p9-metadata-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','timeout','${RESERVATION}')`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_attempt(
    '${secondary.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'accepted','coherent_match','secondary-request-51',
    'miss',40,'fixture-pricing-v1',
    '{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0.5,
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb)`);
  await scalar(db, `SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${secondary.attempt_id}','${secondary.attempt_id}',
    'p9-selected-metadata-v1',
    'selection-v1','{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    '["secondary_coherent_match"]'::jsonb,'accepted_metadata_match',NULL)`);
  await scalar(db, `SELECT public.phase9_store_metadata_cache(
    '${registeredLookup.lookup_id}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'positive',
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    'secondary-record-51','2026-07-28T00:00:00Z','2026-08-28T00:00:00Z')`);
  const secondaryRow = (await db.query(`SELECT provider_cache_identity,adapter_key,
    predecessor_attempt_id FROM public.metadata_enrichment_attempts
    WHERE id='${secondary.attempt_id}'`)).rows[0];
  assert.equal(secondaryRow.provider_cache_identity, 'provider-cache-secondary-0051');
  assert.equal(secondaryRow.adapter_key, 'recorded_secondary');
  assert.equal(secondaryRow.predecessor_attempt_id, primary.attempt_id);
  assert.equal(Number(await scalar(db, `SELECT actual_cost_units
    FROM public.phase9_usage_reservations WHERE id='${RESERVATION}'`)), 0.75);
  assert.equal(await scalar(db, `SELECT adapter_key
    FROM public.phase9_metadata_cache_entries
    WHERE provider_cache_identity='provider-cache-secondary-0051'`), 'recorded_secondary');
});

test('denies retained payload, snapshot, and positive cache for a non-storable provider', async () => {
  await db.exec(`UPDATE public.phase9_usage_reservations
    SET adapter_key='matching_only' WHERE id='${RESERVATION}'`);
  const claimed = await claim();
  await assert.rejects(db.query(`SELECT public.phase9_register_metadata_lookup(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${QUERY}','provider-cache-matching-only-0051','matching_only','1.0.0',
    'cap-v1','p9-metadata-v1','isbn','p9-metadata-lookup-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private',
    '999','cache-policy-v1','metadata-v1',NULL)`),
  /P9_METADATA_PROVIDER_DISABLED/);
  const registeredLookup = await scalar(db, `SELECT public.phase9_register_metadata_lookup(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${QUERY}','provider-cache-matching-only-0051','matching_only','1.0.0',
    'cap-v1','p9-metadata-v1','isbn','p9-metadata-lookup-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private',
    '1','cache-policy-v1','metadata-v1',NULL)`);
  const registered = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-matching-only-0051',
    'primary',1,'matching_only','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'local_insufficient','${RESERVATION}')`);
  await assert.rejects(db.query(`SELECT public.phase9_finalize_metadata_attempt(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'accepted','coherent_match',NULL,'miss',25,
    'fixture','{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0,
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb)`),
  /P9_METADATA_STORAGE_DENIED/);
  await assert.rejects(db.query(`SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${registered.attempt_id}','${registered.attempt_id}',
    'p9-selected-metadata-v1','selection-v1',
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    '[]'::jsonb,'accepted_metadata_match',NULL)`));
  await assert.rejects(db.query(`SELECT public.phase9_store_metadata_cache(
    '${registeredLookup.lookup_id}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'positive',
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    NULL,NULL,'2026-08-28T00:00:00Z')`));
  assert.equal(await scalar(db, `SELECT normalized_payload IS NULL
    FROM public.metadata_enrichment_attempts WHERE id='${registered.attempt_id}'`), true);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots'), 0);
  assert.equal(await scalar(db,
    'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'), 0);
});

test('rejects stale completion and duplicate role charges', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata',
    '1.0.0','cap-v1','p9-metadata-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','local_insufficient','${RESERVATION}')`);
  await assert.rejects(db.query(`SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'78000000-0000-4000-8000-000000000053',
    'provider-cache-secondary-0051','secondary',2,
    'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'timeout','${RESERVATION}')`), /P9_METADATA_SECONDARY_NOT_ELIGIBLE/);
  await assert.rejects(db.query(`SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'78000000-0000-4000-8000-000000000052',
    'provider-cache-fixture-0051','primary',1,
    'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'local_insufficient','${RESERVATION}')`));
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  await assert.rejects(db.query(`SELECT public.phase9_finalize_metadata_attempt(
    (SELECT id FROM public.metadata_enrichment_attempts LIMIT 1),'${JOB}','${WORKER}',
    '${claimed.lease_token}',${claimed.attempt_count},'failed','timeout',NULL,
    'miss',25,'fixture',
    '{"currency":"USD","input_basis":"request","pricing_source_version":"fixture-v1"}'::jsonb,
    0,NULL)`), /P9_STATE_CONFLICT/);
});

test('persists one immutable coherent snapshot without inventory/publication effects', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  const registered = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata',
    '1.0.0','cap-v1','p9-metadata-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','local_insufficient','${RESERVATION}')`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_attempt(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'accepted','coherent_match',NULL,'miss',25,
    'fixture','{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0,
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb)`);
  const selected = await scalar(db, `SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${registered.attempt_id}','${registered.attempt_id}',
    'p9-selected-metadata-v1',
    'selection-v1','{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    '["validated_isbn"]'::jsonb,'accepted_metadata_match',NULL)`);
  assert.ok(selected.snapshot_id);
  await resetActor(db);
  await assert.rejects(db.query(`UPDATE public.phase9_selected_metadata_snapshots
    SET coherent_edition='{}' WHERE id='${selected.snapshot_id}'`),
  /P9_METADATA_SNAPSHOT_IMMUTABLE/);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'), 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.marketplace_book_listings'), 0);
});

test('structural wrappers reject candidate-state TOCTOU before logical finalization', async () => {
  const claimed = await claim();
  const candidateVersion = await scalar(db, `SELECT version FROM public.image_extraction_candidates
    WHERE id='${CANDIDATE}'`);
  const registeredLookup = await scalar(db, `SELECT public.phase9_register_structural_metadata_lookup(
    '${JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${CANDIDATE}',${candidateVersion},'${QUERY}','provider-cache-fixture-0051',
    'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1','bibliographic',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1','store_private','1','cache-policy-v1','metadata-v1',NULL)`);
  const attempt = await scalar(db, `SELECT public.phase9_register_structural_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${CANDIDATE}',${candidateVersion},
    '88000000-0000-4000-8000-000000000099','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',
    '${RESERVATION}')`);
  await db.exec(`UPDATE public.image_extraction_candidates SET state='needs_review'
    WHERE id='${CANDIDATE}'`);
  await assert.rejects(db.query(`SELECT public.phase9_finalize_structural_metadata_attempt(
    '${attempt.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${CANDIDATE}',${candidateVersion},'accepted',
    'accepted_metadata_match','late-request','miss',10,'fixture',
    '{"currency":"USD","input_basis":"request","pricing_source_version":"fixture-v1"}'::jsonb,
    0,'{"title":"Fixture Book"}'::jsonb)`), /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT disposition FROM public.metadata_enrichment_attempts
    WHERE id='${attempt.attempt_id}'`), 'unresolved');
});

test('completion response-loss replay creates one accepted outcome, snapshot, job completion, and transition', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  const registered = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'local_insufficient','${RESERVATION}')`);
  const physical = await scalar(db, `SELECT public.phase9_register_metadata_provider_call(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'88000000-0000-4000-8000-000000000051')`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_provider_call(
    '${physical.provider_call_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'finalized','coherent_match','coherent_match','request-51',false,
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    '["validated_isbn"]'::jsonb)`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_attempt(
    '${registered.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'accepted','coherent_match','request-51','miss',25,
    'fixture','{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0,
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb)`);
  const completionSql = `SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${registered.attempt_id}','${registered.attempt_id}',
    'p9-selected-metadata-v1','selection-v1',
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    '["validated_isbn"]'::jsonb,'accepted_metadata_match',NULL)`;
  const first = await scalar(db, completionSql);
  assert.deepEqual(await scalar(db, completionSql), first);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots'), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.metadata_enrichment_attempts
    WHERE disposition='accepted'`), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'), 1);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${JOB}'`), 'resolved');
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_candidates
    WHERE id='${CANDIDATE}'`), 'ready');
});

test('worker reclaim retains one logical attempt while recording separate physical calls', async () => {
  const first = await claim();
  const registeredLookup = await lookup(first);
  const registered = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${first.lease_token}',1,
    '${ATTEMPT_IDENTITY}','provider-cache-fixture-0051','primary',1,
    'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'local_insufficient','${RESERVATION}')`);
  const physical1 = await scalar(db, `SELECT public.phase9_register_metadata_provider_call(
    '${registered.attempt_id}','${JOB}','${WORKER}','${first.lease_token}',1,
    '88000000-0000-4000-8000-000000000052')`);
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=
    transaction_timestamp()-interval '1 second' WHERE id='${JOB}'`);
  const second = await claim();
  assert.equal(second.attempt_count, 2);
  await assert.rejects(db.query(`SELECT public.phase9_finalize_metadata_provider_call(
    '${physical1.provider_call_id}','${JOB}','${WORKER}','${first.lease_token}',1,
    'finalized','coherent_match','coherent_match','late-request-52',false,NULL,'[]'::jsonb)`),
  /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT status FROM public.phase9_metadata_provider_calls
    WHERE id='${physical1.provider_call_id}'`), 'registered');
  const physical2 = await scalar(db, `SELECT public.phase9_register_metadata_provider_call(
    '${registered.attempt_id}','${JOB}','${WORKER}','${second.lease_token}',2,
    '88000000-0000-4000-8000-000000000053')`);
  assert.notEqual(physical2.provider_call_id, physical1.provider_call_id);
  const finalized2 = await scalar(db, `SELECT public.phase9_finalize_metadata_provider_call(
    '${physical2.provider_call_id}','${JOB}','${WORKER}','${second.lease_token}',2,
    'finalized','no_acceptable_match','no_acceptable_match',NULL,false,NULL,'[]'::jsonb)`);
  assert.equal(finalized2.status, 'finalized');
  await assert.rejects(db.query(`SELECT public.phase9_reconcile_metadata_provider_call(
    '${physical2.provider_call_id}','${JOB}','${WORKER}','${first.lease_token}',1)`),
  /P9_STATE_CONFLICT/);
  await assert.rejects(db.query(`SELECT public.phase9_reconcile_metadata_provider_call(
    '${physical1.provider_call_id}','${JOB}','${WORKER}','${first.lease_token}',1)`),
  /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT status FROM public.phase9_metadata_provider_calls
    WHERE id='${physical1.provider_call_id}'`), 'registered');
  assert.equal(await scalar(db, `SELECT status FROM public.phase9_metadata_provider_calls
    WHERE id='${physical2.provider_call_id}'`), 'finalized');
  assert.equal(await scalar(db, `SELECT normalized_outcome FROM public.phase9_metadata_provider_calls
    WHERE id='${physical2.provider_call_id}'`), 'no_acceptable_match');
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.metadata_enrichment_attempts'), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'), 2);
});

test('keeps metadata authority service-only', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  await assert.rejects(db.query(`UPDATE public.phase9_metadata_lookups
    SET normalized_outcome='no_match' WHERE id='${registeredLookup.lookup_id}'`));
  await setActor(db, OWNER, 'authenticated');
  await assert.rejects(db.query('SELECT * FROM public.phase9_metadata_lookups'));
  await assert.rejects(db.query('SELECT * FROM public.phase9_metadata_provider_calls'));
  await assert.rejects(db.query('SELECT * FROM public.phase9_metadata_coalescing_waiters'));
  await assert.rejects(db.query(
    `SELECT public.claim_phase9_metadata_jobs(1,'${WORKER}')`,
  ));
  const acl = await db.query(`SELECT p.proname,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY(ARRAY[
      'phase9_complete_structural_local_metadata_match',
      'phase9_register_structural_metadata_lookup',
      'phase9_register_structural_metadata_attempt',
      'phase9_finalize_structural_metadata_attempt',
      'phase9_metadata_job_context','phase9_metadata_cache_reuse_context',
      'phase9_metadata_coalescing_context',
      'phase9_complete_metadata_cache_reuse','phase9_select_structural_metadata_snapshot',
      'phase9_register_metadata_provider_call','phase9_finalize_metadata_provider_call',
      'phase9_reconcile_metadata_provider_call',
      'phase9_reserve_metadata_usage','phase9_fail_metadata_job'])`);
  assert.equal(acl.rows.length, 14);
  for (const fn of acl.rows) {
    assert.equal(fn.anon_execute, false, `${fn.proname} must deny anon`);
    assert.equal(fn.authenticated_execute, false, `${fn.proname} must deny authenticated`);
    assert.equal(fn.service_execute, true, `${fn.proname} must allow service_role`);
  }
  const tableAcl = (await db.query(`SELECT
    has_table_privilege('anon','public.phase9_metadata_coalescing_waiters','SELECT') AS anon_select,
    has_table_privilege('authenticated','public.phase9_metadata_coalescing_waiters','SELECT') AS authenticated_select,
    has_table_privilege('service_role','public.phase9_metadata_coalescing_waiters','SELECT') AS service_select`)).rows[0];
  assert.equal(tableAcl.anon_select, false);
  assert.equal(tableAcl.authenticated_select, false);
  assert.equal(tableAcl.service_select, true);
});

test('materializes an identical follower with source lineage and zero provider charge', async () => {
  const leader = await completeLeader();
  const cached = await scalar(db, `SELECT public.phase9_store_metadata_cache(
    '${leader.registeredLookup.lookup_id}','${WORKER}','${leader.claimed.lease_token}',
    ${leader.claimed.attempt_count},'positive',
    '{"title":"Fixture Book","authors":["Fixture Author"]}'::jsonb,
    'fixture-record-51',transaction_timestamp(),
    transaction_timestamp()+interval '30 days')`);
  assert.equal(cached.outcome, 'positive');
  await resetActor(db);
  const followerVisionJob = '74000000-0000-0000-0000-000000000062';
  const followerResult = '74000000-0000-0000-0000-000000000063';
  const followerObservation = '74000000-0000-0000-0000-000000000064';
  const followerInput = '74000000-0000-0000-0000-000000000065';
  await db.exec(`INSERT INTO public.image_extraction_inputs
    (id,session_id,store_id,source_kind,state,sha256,orchestration_version)
    VALUES('${followerInput}','${SESSION}','${STORE}','camera','uploaded',
      '${'9'.repeat(64)}','phase9-v1');
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version,status,completed_at)
    VALUES('${followerVisionJob}','${STORE}','input','${followerInput}','vision_extract',
      'vision:follower-0052','phase9-v1','resolved',transaction_timestamp());
    INSERT INTO public.image_analysis_results
    (id,store_id,session_id,input_id,vision_job_id,contract_version,
      analysis_schema_version,pipeline_version,prompt_version,adapter_key,adapter_version,
      provider_key,model_key,model_version,image_outcome,authoritative_outcome,
      detected_visible_book_count,accepted_candidate_count,canonical_result_snapshot,
      canonical_result_sha256,completing_attempt,completing_worker,
      completing_lease_token_hash,completion_summary,received_at)
    VALUES('${followerResult}','${STORE}','${SESSION}','${followerInput}','${followerVisionJob}',
      'p9-contract-v1','p9-vision-v2','phase9-v1','fixture-prompt-v2','fixture_adapter',
      '1.0.0','recorded_fixture','fixture_model','1','analyzed','accepted',1,1,
      '{}'::jsonb,'${'e'.repeat(64)}',1,'vision-worker-foundation-0052',
      '${'f'.repeat(64)}','{"outcome":"accepted"}'::jsonb,transaction_timestamp());
    INSERT INTO public.image_analysis_observations
    (id,analysis_result_id,store_id,input_id,observation_ordinal,disposition,
      observed_title,observed_authors,observed_language,confidence,observation_snapshot)
    VALUES('${followerObservation}','${followerResult}','${STORE}','${followerInput}',1,'candidate',
      'Fixture Book',ARRAY['Fixture Author'],'en',1,'{}'::jsonb);
    INSERT INTO public.image_extraction_candidates
    (id,session_id,input_id,store_id,candidate_index,observed_title,
      observed_authors,observed_language,state,vision_job_id,analysis_observation_id,
      analysis_schema_version)
    VALUES('${FOLLOWER}','${SESSION}','${followerInput}','${STORE}',2,'Fixture Book',
      ARRAY['Fixture Author'],'en','needs_review','${followerVisionJob}',
      '${followerObservation}','p9-vision-v2');
    UPDATE public.image_extraction_candidates SET state='processing' WHERE id='${FOLLOWER}';
    INSERT INTO public.image_extraction_jobs
    (id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES('${FOLLOWER_JOB}','${STORE}','candidate','${FOLLOWER}','metadata_enrich',
      'metadata:${FOLLOWER}','phase9-metadata-v1');`);
  await setActor(db, OWNER, 'service_role');
  const claimed = (await db.query(
    `SELECT * FROM public.claim_phase9_metadata_jobs(1,'${WORKER}')`,
  )).rows[0];
  const followerVersion = await scalar(db, `SELECT version FROM public.image_extraction_candidates
    WHERE id='${FOLLOWER}'`);
  const context = await scalar(db, `SELECT public.phase9_metadata_cache_reuse_context(
    '${FOLLOWER_JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${FOLLOWER}',${followerVersion},'provider-cache-fixture-0051')`);
  assert.equal(context.leaderLookupId, leader.registeredLookup.lookup_id);
  const reused = await scalar(db, `SELECT public.phase9_complete_metadata_cache_reuse(
    '${FOLLOWER_JOB}','${WORKER}','${claimed.lease_token}',${claimed.attempt_count},
    '${FOLLOWER}',${followerVersion},'${QUERY}','provider-cache-fixture-0051',
    'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1','bibliographic',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'store_private','1','cache-policy-v1','metadata-v1','p9-selected-metadata-v1',
    'selection-v1')`);
  assert.equal(reused.status, 'completed');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.metadata_enrichment_attempts
    WHERE candidate_id='${FOLLOWER}'`), 0);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs
    WHERE id='${FOLLOWER_JOB}'`), 'resolved');
  assert.equal(await scalar(db, `SELECT selected_metadata_snapshot_id IS NOT NULL
    FROM public.image_extraction_candidates WHERE id='${FOLLOWER}'`), true);
});

test('rejects uncertain canonical links and snapshot replay mismatches', async () => {
  const claimed = await claim();
  const registeredLookup = await lookup(claimed);
  await assert.rejects(db.query(`SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},NULL,NULL,'p9-selected-metadata-v1','selection-v1',NULL,
    '[]'::jsonb,'ambiguous','00000000-0000-0000-0000-000000000001')`),
  /P9_REQUEST_INVALID/);
  const sourceAttempt = await scalar(db, `SELECT public.phase9_register_metadata_attempt(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'${ATTEMPT_IDENTITY}','provider-cache-fixture-0051',
    'primary',1,'recorded_metadata','1.0.0','cap-v1','p9-metadata-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'local_insufficient','${RESERVATION}')`);
  await scalar(db, `SELECT public.phase9_finalize_metadata_attempt(
    '${sourceAttempt.attempt_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'rejected','no_acceptable_match',NULL,'miss',20,
    'fixture-pricing-v1','{"currency":"USD","input_basis":"request",
      "pricing_source_version":"fixture-v1"}'::jsonb,0.1,NULL)`);
  await scalar(db, `SELECT public.phase9_select_metadata_snapshot(
    '${registeredLookup.lookup_id}','${JOB}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},NULL,'${sourceAttempt.attempt_id}',
    'p9-selected-metadata-v1','selection-v1',NULL,
    '[]'::jsonb,'no_match',NULL)`);
  await assert.rejects(db.query(`SELECT public.phase9_store_metadata_cache(
    '${registeredLookup.lookup_id}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'ambiguous',NULL,NULL,NULL,'2026-08-28T00:00:00Z')`),
  /P9_METADATA_COHERENCE_CONFLICT/);
  assert.equal((await scalar(db, `SELECT public.phase9_store_metadata_cache(
    '${registeredLookup.lookup_id}','${WORKER}','${claimed.lease_token}',
    ${claimed.attempt_count},'negative',NULL,NULL,NULL,
    '2026-08-28T00:00:00Z')`)).outcome, 'negative');
  const cached = (await db.query(`SELECT source_attempt_id,adapter_key,cache_policy_version
    FROM public.phase9_metadata_cache_entries
    WHERE provider_cache_identity='provider-cache-fixture-0051'`)).rows[0];
  assert.equal(cached.source_attempt_id, sourceAttempt.attempt_id);
  assert.equal(cached.adapter_key, 'recorded_metadata');
  assert.equal(cached.cache_policy_version, 'cache-policy-v1');
});
