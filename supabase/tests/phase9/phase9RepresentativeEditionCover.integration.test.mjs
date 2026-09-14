import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import { commitSql, createUnit7aDatabase, seedReviewedCandidate } from './unit7aFixture.mjs';

const migrations = [
  '20260817000047_marketplace_phase9_legacy_rpc_security_remediation.sql',
  '20260817000048_marketplace_phase9_legacy_rpc_service_role_compatibility.sql',
  '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql',
  '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql',
  '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql',
  '20260830000055_marketplace_phase9_unit6g_metadata_add_authority_correction.sql',
  '20260830000056_marketplace_phase9_metadata_throughput.sql',
  '20260906000057_marketplace_phase9_media_output_intents.sql',
  '20260906000058_marketplace_phase9_media_completion_receipts.sql',
  '20260906000059_marketplace_phase9_media_output_cleanup.sql',
  '20260911000060_marketplace_phase9_duplicate_confirmation.sql',
  '20260913000061_marketplace_phase9_representative_edition_cover.sql',
  '20260913000062_marketplace_phase9_representative_cover_detail_projection.sql',
];
const coverUrl = 'https://books.google.com/books/content?id=alternate-cover';
let db;

before(async () => {
  db = await createUnit7aDatabase();
  await db.exec(`CREATE TABLE IF NOT EXISTS public.marketplace_event_schema_registry(
    event_type text NOT NULL,schema_version integer NOT NULL CHECK(schema_version>=1),
    entity_type text NOT NULL,is_transition boolean NOT NULL,
    privacy_classification text NOT NULL CHECK(privacy_classification IN('internal','confidential')),
    PRIMARY KEY(event_type,schema_version));
    ALTER TABLE public.marketplace_events
      ADD COLUMN IF NOT EXISTS actor_role text,
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system_job',
      ADD COLUMN IF NOT EXISTS idempotency_key text,
      ADD COLUMN IF NOT EXISTS command_id uuid,
      ADD COLUMN IF NOT EXISTS correlation_id uuid,
      ADD COLUMN IF NOT EXISTS causation_event_id uuid,
      ADD COLUMN IF NOT EXISTS privacy_classification text NOT NULL DEFAULT 'internal',
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;
    CREATE FUNCTION public.phase9_complete_media_validation_v2(
      uuid,text,text,integer,text,text,text,text,text,bigint,integer,integer)
    RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
      SELECT marketplace_sec.phase9_complete_media_validation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    $$;
    CREATE FUNCTION public.phase9_bind_media_validation_snapshot_v2(
      uuid,text,text,integer,text,text,bigint,text)
    RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
      SELECT marketplace_sec.phase9_bind_media_validation_snapshot($1,$2,$3,$4,$5,$6,$7,$8)
    $$;`);
  for (const migration of migrations) {
    await db.exec(fs.readFileSync(migrationPath(migration), 'utf8'));
  }
});
after(async () => db?.close());

test('M61/M62 keep private helpers inaccessible and public delegates role-scoped', async () => {
  const signature = `public.phase9_store_metadata_representative_cover_v1(
    uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb)`;
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'service_role','${signature}','EXECUTE')`), true);
  assert.equal(await scalar(db, `SELECT has_function_privilege('service_role',
    'marketplace_sec.phase9_store_metadata_representative_cover_v1(
      uuid,uuid,uuid,text,text,integer,uuid,integer,text,text,text,text,jsonb)','EXECUTE')`), true);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'authenticated','${signature}','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_table_privilege(
    'service_role','marketplace_sec.phase9_metadata_representative_covers','SELECT')`), false);
  assert.equal(await scalar(db, `SELECT relrowsecurity FROM pg_class
    WHERE oid='marketplace_sec.phase9_metadata_representative_covers'::regclass`), true);
  const projectionHelper =
    'marketplace_sec.phase9_owner_ux_with_representative_cover(jsonb)';
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await scalar(db, `SELECT has_function_privilege(
      '${role}','${projectionHelper}','EXECUTE')`), false);
  }
  const detail = 'public.phase9_owner_candidate_detail_v2(uuid,uuid)';
  const save = `public.phase9_update_candidate_review_v2(
    uuid,uuid,integer,integer,jsonb,text,uuid)`;
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'authenticated','${detail}','EXECUTE')`), true);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'authenticated','${save}','EXECUTE')`), true);
  for (const role of ['anon', 'service_role']) {
    assert.equal(await scalar(db, `SELECT has_function_privilege(
      '${role}','${detail}','EXECUTE')`), false);
    assert.equal(await scalar(db, `SELECT has_function_privilege(
      '${role}','${save}','EXECUTE')`), false);
  }
});

test('M61 labels the fallback and copies it only at explicit inventory commit', async () => {
  const fixture = await seedReviewedCandidate(db);
  await resetActor(db);
  const jobId = randomUUID();
  const lookupId = randomUUID();
  const attemptId = randomUUID();
  const selectionId = randomUUID();
  const coherent = {
    title: 'Matched title', authors: ['Matched author'], language: 'en',
    coverReference: null, providerRecordId: 'selected-without-cover',
  };
  const selectedReview = {
    ...fixture.review,
    metadataChoice: { mode: 'selected', selectionId },
  };
  const saveCommandId = randomUUID();
  await db.exec(`INSERT INTO public.phase9_provider_registry(
      adapter_key,provider_kind,adapter_version,enabled,matching_allowed,
      storage_allowed,revalidation_seconds,policy_version)
    VALUES('google_books','metadata','1.0.0',true,true,true,86400,1)
    ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,storage_allowed=true;
    INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,
      dedupe_key,operation_version,status)
    VALUES('${jobId}','${fixture.storeId}','candidate','${fixture.candidateId}',
      'metadata_enrich','m61:${fixture.candidateId}','p9-metadata-foundation-v1','resolved');
    INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,
      execution_mode,provider_cache_identity,adapter_key,adapter_version,capability_version,
      schema_version,lookup_strategy,lookup_contract_version,normalizer_version,
      routing_policy_version,privacy_scope,reuse_policy_version,cache_policy_version,
      cache_namespace,claim_attempt_number,claim_worker,claim_lease_token_hash,normalized_outcome,
      completed_at,outcome_source_attempt_id)
    VALUES('${lookupId}','${fixture.candidateId}','${fixture.storeId}','${jobId}','m61-query',
      'external','m61-cache:${fixture.candidateId}','google_books','1.0.0','cap-v1',
      'p9-metadata-v1','bibliographic','lookup-v1','normalizer-v1','routing-v1',
      'store_private','1','cache-v1','m61',1,'m61-worker','${'a'.repeat(64)}',
      'accepted_metadata_match',transaction_timestamp(),NULL);
    INSERT INTO public.metadata_enrichment_attempts(id,candidate_id,store_id,adapter_key,
      attempt_sequence,query_kind,status,adapter_version,schema_version,normalizer_version,
      reuse_policy_version,lookup_id,provider_role,query_identity,capability_version,
      routing_policy_version,normalized_outcome,disposition,normalized_payload,completed_at)
    VALUES('${attemptId}','${fixture.candidateId}','${fixture.storeId}','google_books',1,
      'bibliographic','completed','1.0.0','p9-metadata-v1','normalizer-v1',1,
      '${lookupId}','primary','m61-query','cap-v1','routing-v1','accepted_metadata_match',
      'accepted','${JSON.stringify(coherent)}'::jsonb,transaction_timestamp());
    UPDATE public.phase9_metadata_lookups SET outcome_source_attempt_id='${attemptId}'
      WHERE id='${lookupId}';
    INSERT INTO public.phase9_selected_metadata_snapshots(id,candidate_id,store_id,lookup_id,
      selected_attempt_id,outcome_source_attempt_id,snapshot_version,selection_policy_version,
      coherent_edition,match_evidence,manual_outcome)
    VALUES('${selectionId}','${fixture.candidateId}','${fixture.storeId}','${lookupId}',
      '${attemptId}','${attemptId}','p9-selected-metadata-v1','p9-metadata-selection-v1',
      '${JSON.stringify(coherent)}'::jsonb,'["exact_original_title","author_overlap"]'::jsonb,
      'accepted_metadata_match');
    INSERT INTO marketplace_sec.phase9_metadata_representative_covers(
      source_attempt_id,source_lookup_id,source_candidate_id,source_store_id,source_job_id,
      cover_reference,adapter_key,adapter_version,
      source_provider_record_id,source_relation,selection_policy_version,match_evidence)
    VALUES('${attemptId}','${lookupId}','${fixture.candidateId}','${fixture.storeId}','${jobId}',
      '${coverUrl}','google_books','1.0.0','alternate-with-cover',
      'representative_edition','p9-representative-cover-v1',
      '["exact_title","exact_author_set","language_compatible"]'::jsonb);
    UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id='${selectionId}',
      metadata_attempt_id='${attemptId}',canonical_edition_id=NULL
      WHERE id='${fixture.candidateId}';`);
  const versions = (await db.query(`SELECT version,review_version,metadata_revision
    FROM public.image_extraction_candidates WHERE id='${fixture.candidateId}'`)).rows[0];

  await setActor(db, fixture.ownerId);
  const saved = await scalar(db, `SELECT public.phase9_update_candidate_review_v2(
    '${fixture.sessionId}','${fixture.candidateId}',${versions.version},
    ${versions.metadata_revision},'${JSON.stringify(selectedReview).replaceAll("'", "''")}'::jsonb,
    'm61-save-${fixture.candidateId}','${saveCommandId}')`);
  const replay = await scalar(db, `SELECT public.phase9_update_candidate_review_v2(
    '${fixture.sessionId}','${fixture.candidateId}',${versions.version},
    ${versions.metadata_revision},'${JSON.stringify(selectedReview).replaceAll("'", "''")}'::jsonb,
    'm61-save-${fixture.candidateId}','${saveCommandId}')`);
  const detail = await scalar(db, `SELECT public.phase9_owner_candidate_detail_v2(
    '${fixture.sessionId}','${fixture.candidateId}')`);
  assert.equal(detail.metadata.snapshot.coverReference, null);
  assert.equal(detail.metadata.representativeCover.coverReference, coverUrl);
  assert.equal(detail.metadata.representativeCover.sourceRecordId, 'alternate-with-cover');
  assert.deepEqual(saved.metadata.representativeCover, detail.metadata.representativeCover);
  assert.deepEqual(replay.metadata.representativeCover, detail.metadata.representativeCover);
  const batch = await scalar(db, `SELECT public.phase9_owner_batch_review_v1(
    '${fixture.sessionId}')`);
  assert.equal(batch.items[0].metadataSummary.coverReference, null);
  assert.equal(batch.items[0].metadataSummary.representativeCover.coverReference, coverUrl);
  assert.equal(batch.items[0].metadataSummary.representativeCover.sourceRelation,
    'representative_edition');
  assert.equal(batch.items[0].fieldSources.cover, 'representative');
  assert.equal(batch.items[0].allowedActions.includes('add_to_inventory'), true,
    JSON.stringify(batch.items[0]));

  const committed = await scalar(db, commitSql(fixture, {
    candidateVersion: saved.candidateVersion,
    reviewVersion: saved.review.reviewVersion,
    metadataRevision: saved.metadata.revision,
  }));
  await resetActor(db);
  const inventory = (await db.query(`SELECT cover_url,representative_cover
    FROM public.store_inventory WHERE id='${committed.inventoryId}'`)).rows[0];
  assert.equal(inventory.cover_url, null);
  assert.equal(inventory.representative_cover.coverReference, coverUrl);
  assert.equal(inventory.representative_cover.sourceRecordId, 'alternate-with-cover');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_book_listings
    WHERE inventory_id='${committed.inventoryId}'`), 0);
  await assert.rejects(db.query(`UPDATE public.store_inventory SET representative_cover=NULL
    WHERE id='${committed.inventoryId}'`), /P9_METADATA_REPRESENTATIVE_COVER_IMMUTABLE/);
});
