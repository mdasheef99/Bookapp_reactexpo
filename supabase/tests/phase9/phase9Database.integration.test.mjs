import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import {
  createPhase9Database, phase9MigrationNames, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const STORE_A = '92000000-0000-0000-0000-000000000001';
const STORE_B = '92000000-0000-0000-0000-000000000002';
const STORE_C = '92000000-0000-0000-0000-000000000003';
const OWNER_A = '91000000-0000-0000-0000-000000000001';
const OWNER_A2 = '91000000-0000-0000-0000-000000000002';
const OWNER_B = '91000000-0000-0000-0000-000000000003';
const CUSTOMER_A = '91000000-0000-0000-0000-000000000004';
const MANAGER_A = '91000000-0000-0000-0000-000000000005';
let db;

before(async () => {
  db = await createPhase9Database();
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES('${STORE_A}','Store A'),('${STORE_B}','Store B'),('${STORE_C}','Store C');
    INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
      ('${STORE_A}','${OWNER_A}','owner','active'),('${STORE_A}','${OWNER_A2}','owner','active'),
      ('${STORE_B}','${OWNER_B}','owner','active'),
      ('${STORE_A}','${MANAGER_A}','manager','active');
  `);
});
afterEach(async () => {
  await resetActor(db);
  await db.exec('DELETE FROM public.phase9_usage_reservations; DELETE FROM public.image_extraction_jobs');
  await db.exec("UPDATE public.image_extraction_sessions SET status='closed' WHERE status IN ('active','closing')");
});
after(async () => db.close());

test('clean Phase 6 migration creates all relations and deferred foreign keys', async () => {
  assert.deepEqual(phase9MigrationNames, [
    '20260722000001_marketplace_phase9_catalogue_metadata_expand.sql',
    '20260722000002_marketplace_phase9_extraction_persistence.sql',
    '20260722000003_marketplace_phase9_media_registry.sql',
    '20260722000004_marketplace_phase9_condition_damage_transition.sql',
    '20260722000005_marketplace_phase9_controlled_inventory_commands.sql',
    '20260722000006_marketplace_phase9_storage_boundaries.sql',
    '20260722000007_marketplace_phase9_public_projection_search.sql',
    '20260722000008_marketplace_phase9_request_photo_seam.sql',
    '20260722000010_marketplace_phase9_public_boundary_security_correction.sql',
    '20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql',
    '20260726000012_marketplace_phase9_vision_analysis_runtime.sql',
    '20260727000013_marketplace_phase9_service_rpc_wrappers.sql',
    '20260727000014_marketplace_phase9_vision_provider_attempts.sql',
    '20260728000015_marketplace_phase9_metadata_foundation.sql',
  ]);
  const count = await scalar(db, `SELECT count(*)::int FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('phase9_provider_registry','book_search_aliases',
    'image_extraction_sessions','image_extraction_inputs','image_extraction_candidates',
    'metadata_enrichment_attempts','image_extraction_jobs','phase9_upload_capabilities',
    'phase9_usage_reservations','phase9_idempotency_keys','media_assets','inventory_media_links',
    'media_lifecycle_attempts','order_request_photo_requests','order_request_media_links')`);
  assert.equal(count, 15);
  const fks = await scalar(db, `SELECT count(*)::int FROM information_schema.table_constraints
    WHERE constraint_type='FOREIGN KEY' AND constraint_name IN
    ('store_inventory_created_from_candidate_fk','listing_primary_public_media_fk','input_media_asset_fk',
     'candidate_metadata_attempt_fk','capability_consumed_media_fk','media_request_photo_request_fk')`);
  assert.equal(fks, 6);
});

test('provider provenance and canonical search-only alias constraints reject invalid rows', async () => {
  await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version)
    VALUES('fixture_metadata','metadata','v1')`);
  await assert.rejects(db.exec(`INSERT INTO public.book_search_aliases(id,canonical_edition_id,inventory_id,
    alias_text,alias_normalized,alias_language,alias_type,source_type,source_ref,approval_status)
    VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'x','x','en','translation','automated','fixture','approved')`));
  await assert.rejects(db.exec(`INSERT INTO public.book_search_aliases(id,alias_text,alias_normalized,
    alias_language,alias_type,source_type,source_ref,approval_status)
    VALUES(gen_random_uuid(),'x','x','en','identity_alias','automated','fixture','approved')`));
  const inventoryId = await scalar(db, `INSERT INTO public.store_inventory(id,store_id,title,condition,selling_price_minor,
    quantity_total,quantity_available) VALUES(gen_random_uuid(),'${STORE_A}','Alias Book','good',1,1,1) RETURNING id::text`);
  await assert.rejects(db.exec(`INSERT INTO public.book_search_aliases(id,inventory_id,store_id,alias_text,
    alias_normalized,alias_language,alias_type,source_type,source_ref,approval_status)
    VALUES(gen_random_uuid(),'${inventoryId}','${STORE_B}','Alias','alias','en','translation','owner_verified',
      '${OWNER_A}','approved')`));
});

test('language policy persists and detected counts widen for over-limit evidence', async () => {
  await setActor(db, OWNER_A);
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(NULL,'hi','Deva','good','A1',1,
    'private','start-language-0001',gen_random_uuid())`);
  assert.equal(await scalar(db, `SELECT selected_language FROM public.phase9_owner_session_summary('${sessionId}')`), 'hi');
  await assert.rejects(db.query(`SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,
    'private','start-language-0001',gen_random_uuid())`));
  await resetActor(db);
  await db.exec(`INSERT INTO public.image_extraction_inputs(id,session_id,store_id,source_kind,
    state,sha256,detected_candidate_count,orchestration_version) VALUES(gen_random_uuid(),'${sessionId}',
    '${STORE_A}','camera','failed','abc',16,'v1')`);
  await assert.rejects(db.exec(`INSERT INTO public.image_extraction_inputs(id,session_id,store_id,source_kind,
    state,sha256,detected_candidate_count,orchestration_version) VALUES(gen_random_uuid(),'${sessionId}',
    '${STORE_A}','camera','failed','def',101,'v1')`));
});

test('forged store is denied and initiating Owner owns session access', async () => {
  await setActor(db, MANAGER_A);
  await assert.rejects(db.query(`SELECT public.phase9_start_session('${STORE_A}','en',NULL,'good','A1',1,
    'private','start-manager-0001',gen_random_uuid())`));
  await setActor(db, OWNER_A);
  await assert.rejects(db.query(`SELECT public.phase9_start_session('${STORE_B}','en',NULL,'good','A1',1,
    'private','start-forged-0001',gen_random_uuid())`));
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,
    'private','start-owner-0001',gen_random_uuid())`);
  assert.equal(await scalar(db, `SELECT store_id::text FROM public.phase9_owner_session_summary('${sessionId}')`), STORE_A);
  await setActor(db, OWNER_A2);
  await assert.rejects(db.query(`SELECT * FROM public.phase9_owner_session_summary('${sessionId}')`));
});

test('legacy authenticated upload path authority is revoked', async () => {
  await setActor(db, OWNER_A);
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,
    'private','start-capability-0001',gen_random_uuid())`);
  const objectPath = `${STORE_A}/scan_input/${sessionId}/one.webp`;
  await assert.rejects(db.query(`SELECT public.phase9_authorize_upload('${sessionId}','scan_input',
    'marketplace-media-staging','${objectPath}','hash-a',1,transaction_timestamp()+interval '5 minutes',
    'capability-issue-0001',gen_random_uuid())`));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated',
    'public.phase9_authorize_upload(uuid,text,text,text,text,integer,timestamptz,text,uuid)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated',
    'public.phase9_accept_scan_input(uuid,uuid,uuid,text,text,text,uuid)','EXECUTE')`), false);
});

test('private base tables deny authenticated direct access and worker functions are separated', async () => {
  await resetActor(db);
  for (const table of ['image_extraction_sessions','image_extraction_candidates','media_assets',
    'phase9_upload_capabilities','image_extraction_jobs','phase9_usage_reservations']) {
    assert.equal(await scalar(db, `SELECT has_table_privilege('authenticated','public.${table}','SELECT')`), false);
  }
  assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated',
    'public.phase9_owner_session_summary(uuid)','EXECUTE')`), true);
  assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated',
    'marketplace_sec.claim_phase9_jobs(integer,text,boolean)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege('service_role',
    'marketplace_sec.claim_phase9_jobs(integer,text,boolean)','EXECUTE')`), true);
});

test('job claim lease excludes a second worker and retries dead-letter at attempt five', async () => {
  await resetActor(db);
  const jobId = await scalar(db, `INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,
    job_kind,dedupe_key) VALUES('${STORE_A}','input',gen_random_uuid(),'vision_extract','job-lease-1') RETURNING id::text`);
  await db.exec("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)");
  const claims = await Promise.all([
    db.query("SELECT * FROM marketplace_sec.claim_phase9_jobs(1,'worker-a')"),
    db.query("SELECT * FROM marketplace_sec.claim_phase9_jobs(1,'worker-b')"),
  ]);
  assert.equal(claims.reduce((count, result) => count + result.rows.length, 0), 1);
  const worker = claims[0].rows.length ? 'worker-a' : 'worker-b';
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await db.query(`SELECT marketplace_sec.fail_phase9_job('${jobId}','${worker}','transient','fixture')`);
    if (attempt < 5) await db.query(`SELECT * FROM marketplace_sec.claim_phase9_jobs(1,'${worker}',true)`);
  }
  const staleId = await scalar(db, `INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,
    job_kind,status,attempt_count,lease_owner,lease_expires_at,dedupe_key)
    VALUES('${STORE_A}','input',gen_random_uuid(),'vision_extract','in_progress',1,'stale-worker',
      transaction_timestamp()-interval '1 second','job-stale-1') RETURNING id::text`);
  await assert.rejects(db.query(`SELECT marketplace_sec.fail_phase9_job('${staleId}','stale-worker','transient','late')`));
  await db.exec('RESET ROLE');
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_jobs WHERE id='${jobId}'`), 'dead_letter');
});

test('cost reservations enforce store/job/kind/policy uniqueness', async () => {
  await resetActor(db);
  const jobId = await scalar(db, `INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,
    job_kind,dedupe_key) VALUES('${STORE_A}','input',gen_random_uuid(),'vision_extract','job-cost-1') RETURNING id::text`);
  const values = `'${STORE_A}','${jobId}','vision',1,'extract','fixture','v1','cost-1',1`;
  const inserts = await Promise.allSettled([
    db.exec(`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
      operation,adapter_key,adapter_version,idempotency_identity,reserved_cost_units) VALUES(${values})`),
    db.exec(`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
      operation,adapter_key,adapter_version,idempotency_identity,reserved_cost_units)
      VALUES('${STORE_A}','${jobId}','vision',1,'extract','fixture','v1','cost-2',1)`),
  ]);
  assert.deepEqual(inserts.map(({ status }) => status).sort(), ['fulfilled','rejected']);
});

test('condition/damage are separate and the Phase 6 quantity constraint remains NOT VALID', async () => {
  const condition = await scalar(db, `SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conname='store_inventory_phase9_condition_check'`);
  assert.match(condition, /very_good/);
  assert.match(condition, /acceptable/);
  assert.doesNotMatch(condition, /damaged/);
  assert.equal(await scalar(db, `SELECT convalidated FROM pg_constraint
    WHERE conname='store_inventory_quantity_balance'`), false);
});

test('candidate commit is idempotent and publication retry cannot repeat quantity', async () => {
  await setActor(db, OWNER_A);
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,
    'private','start-commit-0001',gen_random_uuid())`);
  const candidateId = await scalar(db, `SELECT public.phase9_add_manual_candidate('${sessionId}',
    'Fixture Book',ARRAY['Author'],'en','manual-commit-0001',gen_random_uuid())`);
  await db.query(`SELECT public.phase9_update_candidate_review('${candidateId}',1,
    '{"title":"Fixture Book"}'::jsonb,'review-commit-0001',gen_random_uuid())`);
  const sql = `SELECT * FROM public.phase9_commit_candidate('${candidateId}',2,'create_private',NULL,2,500,
    'good',false,ARRAY[]::text[],'',true,'commit-private-0001',gen_random_uuid())`;
  const first = await db.query(sql);
  const replay = await db.query(sql);
  assert.equal(replay.rows[0].inventory_id, first.rows[0].inventory_id);
  await assert.rejects(db.query(sql.replace('NULL,2,500', 'NULL,3,500')), /P9_IDEMPOTENCY_MISMATCH/);
  const before = await scalar(db, `SELECT (public.phase9_owner_inventory('${first.rows[0].inventory_id}')->>'quantity_total')::int`);
  await db.query(`SELECT public.phase9_retry_publication('${first.rows[0].inventory_id}',1,
    'publish-retry-0001',gen_random_uuid())`);
  assert.equal(await scalar(db, `SELECT (public.phase9_owner_inventory('${first.rows[0].inventory_id}')->>'quantity_total')::int`), before);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT state FROM public.image_extraction_candidates WHERE id='${candidateId}'`), 'committed');
  assert.equal(await scalar(db, `SELECT publication_status FROM public.store_inventory WHERE id='${first.rows[0].inventory_id}'`), 'published');
  await db.exec("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)");
  await assert.rejects(db.query(`SELECT public.phase9_retry_publication('${first.rows[0].inventory_id}',1,
    'publish-worker-unclaimed-0001',gen_random_uuid(),'worker-x')`));
  await db.exec('RESET ROLE');
});

test('unreviewed and skipped candidates cannot commit', async () => {
  await setActor(db, OWNER_A);
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,
    'private','start-skip-session-0001',gen_random_uuid())`);
  const candidateId = await scalar(db, `SELECT public.phase9_add_manual_candidate('${sessionId}',
    'Skipped Book',ARRAY['Author'],'en','manual-skip-0001',gen_random_uuid())`);
  const commit = `SELECT * FROM public.phase9_commit_candidate('${candidateId}',1,'create_private',NULL,1,100,
    'good',false,ARRAY[]::text[],'',true,'commit-skip-0001',gen_random_uuid())`;
  await assert.rejects(db.query(commit));
  await db.query(`SELECT public.phase9_skip_candidate('${candidateId}',1,'false_detection','skip-candidate-0001',gen_random_uuid())`);
  await assert.rejects(db.query(commit.replace("'commit-skip-0001'", "'commit-skip-0002'")));
});

test('quantity adjustment preserves reserved, sold and removed buckets', async () => {
  await resetActor(db);
  const inventoryId = await scalar(db, `INSERT INTO public.store_inventory(id,store_id,title,condition,selling_price_minor,
    quantity_total,quantity_available,quantity_reserved,quantity_sold,quantity_removed,version)
    VALUES(gen_random_uuid(),'${STORE_A}','Quantity Book','good',500,10,4,3,2,1,1) RETURNING id::text`);
  await setActor(db, OWNER_A);
  await db.query(`SELECT public.phase9_adjust_inventory_quantity('${inventoryId}',1,2,'quantity-add-0001',gen_random_uuid())`);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT quantity_total=12 AND quantity_available=6 AND quantity_reserved=3
    AND quantity_sold=2 AND quantity_removed=1 FROM public.store_inventory WHERE id='${inventoryId}'`), true);
  await setActor(db, OWNER_A);
  await assert.rejects(db.query(`SELECT public.phase9_adjust_inventory_quantity('${inventoryId}',2,-7,
    'quantity-remove-0001',gen_random_uuid())`));
});

test('typed media rejects privacy crossing and public projection excludes private fields', async () => {
  await resetActor(db);
  await assert.rejects(db.exec(`INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,
    bucket_id,object_path,sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status)
    VALUES('${STORE_A}','${OWNER_A}','customer_request','public','inventory-photos','bad.webp','x',
    'image/webp',1,1,1,'request','approved')`));
  const columns = (await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='phase9_public_listing_projection'`)).rows.map((row) => row.column_name);
  for (const field of ['quantity_total','quantity_available','shelf_location','object_path','customer_user_id'])
    assert.equal(columns.includes(field), false);
});

test('public discovery allowlist is exact and the projection remains an internal invoker-safe source', async () => {
  await resetActor(db);
  const viewOptions = await scalar(db, `SELECT reloptions::text FROM pg_class
    WHERE oid='public.phase9_public_listing_projection'::regclass`);
  assert.match(viewOptions, /security_barrier=true/);
  assert.match(viewOptions, /security_invoker=true/);
  for (const role of ['anon','authenticated','service_role']) {
    assert.equal(await scalar(db, `SELECT has_table_privilege('${role}',
      'public.phase9_public_listing_projection','SELECT')`), false);
  }

  const publicSignatures = [
    'public.phase9_marketplace_store_search(text,integer,jsonb)',
    'public.phase9_storefront_catalogue(uuid,integer,jsonb)',
    'public.phase9_listing_detail(uuid)',
  ];
  for (const signature of publicSignatures)
    assert.equal(await scalar(db, `SELECT has_function_privilege('anon','${signature}','EXECUTE')`), true);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'phase9_%'
      AND has_function_privilege('anon',p.oid,'EXECUTE')
      AND p.oid::regprocedure::text NOT IN
        ('phase9_marketplace_store_search(text,integer,jsonb)',
         'phase9_storefront_catalogue(uuid,integer,jsonb)','phase9_listing_detail(uuid)')`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'phase9_%request%photo%'
      AND has_function_privilege('anon',p.oid,'EXECUTE')`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec' AND p.proname LIKE 'phase9_%'
      AND (has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('authenticated',p.oid,'EXECUTE'))`), 0);

  await setActor(db, CUSTOMER_A, 'anon');
  await assert.rejects(db.query('SELECT * FROM public.phase9_public_listing_projection'));
  assert.equal((await db.query(`SELECT * FROM public.phase9_listing_detail(gen_random_uuid())`)).rows.length, 0);
});

test('storage buckets preserve private/public boundaries with no authenticated object policy', async () => {
  assert.equal(await scalar(db, `SELECT public FROM storage.buckets WHERE id='marketplace-media-staging'`), false);
  assert.equal(await scalar(db, `SELECT public FROM storage.buckets WHERE id='inventory-photos'`), true);
  assert.equal(await scalar(db, `SELECT public FROM storage.buckets WHERE id='order-request-photos'`), false);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND roles::text LIKE '%authenticated%'
    AND (coalesce(qual,'')||coalesce(with_check,'')) ~ 'marketplace-media-staging|image-extraction-inputs|inventory-photos|order-request-photos'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_policies WHERE schemaname='storage'
    AND tablename='objects' AND policyname IN ('mkt owner upload','mkt owner update','mkt owner delete','mkt private read')`), 4);
});

test('marketplace function groups stores before pagination', async () => {
  const body = await scalar(db, `SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname='phase9_marketplace_store_search'`);
  assert.ok(body.indexOf('GROUP BY') < body.indexOf('LIMIT'));
  assert.match(body, /store_id/);
  await resetActor(db);
  for (const [store, title] of [[STORE_A,'Cursor Book'],[STORE_B,'Cursor Book'],[STORE_C,'Cursor Book']]) {
    await db.exec(`INSERT INTO public.store_inventory(id,store_id,title,condition,selling_price_minor,quantity_total,
      quantity_available,visibility_status) VALUES(gen_random_uuid(),'${store}','${title}','good',100,1,1,'published')`);
  }
  const first = await db.query(`SELECT * FROM public.phase9_marketplace_store_search('Cursor Book',1,NULL)`);
  assert.equal(first.rows.length,1);
  const cursor = JSON.stringify({query_hash:'dab95b725a3eb9ce3fca77894eb9d1a9',ranking_version:'phase9-r1',last_rank:2,last_store_id:first.rows[0].store_id});
  const second = await db.query(`SELECT * FROM public.phase9_marketplace_store_search('Cursor Book',1,'${cursor}'::jsonb)`);
  assert.equal(second.rows.length,1); assert.notEqual(second.rows[0].store_id,first.rows[0].store_id);
});

test('request-photo seam is item/customer/store scoped', async () => {
  await resetActor(db);
  const inventoryId = await scalar(db, `INSERT INTO public.store_inventory(id,store_id,title,condition,
    selling_price_minor,quantity_total,quantity_available) VALUES(gen_random_uuid(),'${STORE_A}','Photo Book','good',500,1,1) RETURNING id::text`);
  const requestId = await scalar(db, `INSERT INTO public.store_order_requests(id,store_id,user_id)
    VALUES(gen_random_uuid(),'${STORE_A}','${CUSTOMER_A}') RETURNING id::text`);
  const itemId = await scalar(db, `INSERT INTO public.store_order_request_items(id,order_request_id,store_id,
    inventory_id) VALUES(gen_random_uuid(),'${requestId}','${STORE_A}','${inventoryId}') RETURNING id::text`);
  await setActor(db, CUSTOMER_A);
  const photoId = await scalar(db, `SELECT public.phase9_request_current_copy_photos('${itemId}',1,1,
    'photo-request-0001',gen_random_uuid())`);
  assert.equal(await scalar(db, `SELECT state FROM public.phase9_request_photo_status('${photoId}')`), 'requested');
  await setActor(db, OWNER_B);
  await assert.rejects(db.query(`SELECT * FROM public.phase9_request_photo_status('${photoId}')`));
  await setActor(db, OWNER_A);
  const photoPath = `${STORE_A}/customer_request/${photoId}/one.webp`;
  const capId = await scalar(db, `SELECT public.phase9_authorize_request_photo_upload('${photoId}',1,1,
    '${photoPath}','photo-hash',transaction_timestamp()+interval '5 minutes','photo-capability-0001',gen_random_uuid())`)
    .catch((error)=>{ error.message=`C15:${error.message}`; throw error; });
  await resetActor(db);
  const mediaId = await scalar(db, `INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,
    bucket_id,object_path,sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status)
    VALUES('${STORE_A}','${OWNER_A}','customer_request','private_request','order-request-photos','${photoPath}',
      'photo-hash','image/webp',100,10,10,'request','staged') RETURNING id::text`);
  await setActor(db, OWNER_A);
  await db.query(`SELECT public.phase9_supply_request_photo('${photoId}','${capId}','${mediaId}',1,
    'photo-supply-0001',gen_random_uuid())`).catch((error)=>{ error.message=`C16:${error.message}`; throw error; });
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT lifecycle_status FROM public.media_assets WHERE id='${mediaId}'`),'staged');
  const validationJob = await scalar(db, `SELECT id::text FROM public.image_extraction_jobs
    WHERE entity_id='${photoId}' AND job_kind='request_photo_validation'`);
  await db.exec(`SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false);
    UPDATE public.image_extraction_jobs SET status='in_progress',lease_owner='photo-worker',
      lease_expires_at=transaction_timestamp()+interval '5 minutes' WHERE id='${validationJob}';`);
  await db.query(`SELECT marketplace_sec.complete_request_photo_validation('${validationJob}','photo-worker','${photoId}',true)`);
  await db.exec('RESET ROLE');
  await setActor(db, OWNER_A);
  const photoVersion = await scalar(db, `SELECT version FROM public.phase9_request_photo_status('${photoId}')`);
  assert.equal(await scalar(db, `SELECT state FROM public.phase9_request_photo_status('${photoId}')`),'provided');
  const firstExpiry = '2099-01-01T00:10:00Z';
  const holdId = await scalar(db, `SELECT public.phase9_confirm_request_photo_item('${photoId}',${photoVersion},1,500,'{}',
    '${firstExpiry}','photo-confirm-0001',gen_random_uuid())`)
    .catch((error)=>{ error.message=`C28:${error.message}`; throw error; });
  assert.equal(await scalar(db, `SELECT public.phase9_confirm_request_photo_item('${photoId}',${photoVersion},1,500,'{}',
    '${firstExpiry}','photo-confirm-0001',gen_random_uuid())`),holdId);
  const proposalVersion = Number(photoVersion)+1;
  const refreshed = await scalar(db, `SELECT public.phase9_confirm_request_photo_item('${photoId}',${proposalVersion},1,500,'{}',
    transaction_timestamp()+interval '20 minutes','photo-confirm-0002',gen_random_uuid())`);
  assert.notEqual(refreshed,holdId);
  await setActor(db, CUSTOMER_A);
  await db.query(`SELECT public.phase9_accept_request_photos('${photoId}',${proposalVersion+1},'photo-accept-0001',gen_random_uuid())`);
  await assert.rejects(db.query(`SELECT public.phase9_decline_request_photos('${photoId}',${proposalVersion+2},
    'photo-decline-late-0001',gen_random_uuid())`));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT quantity_available=0 AND quantity_reserved=1
    FROM public.store_inventory WHERE id='${inventoryId}'`),true);
  assert.equal(await scalar(db, `SELECT hold_type FROM public.inventory_holds WHERE id='${refreshed}'`),'firm');
});
