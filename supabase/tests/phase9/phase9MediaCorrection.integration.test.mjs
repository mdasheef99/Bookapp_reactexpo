import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { seedPublicationInventory, registerPublicCopySource } from './unit7bFixture.mjs';
import { scalar, setActor } from './databaseHarness.mjs';
import { createMediaCorrectionDatabase } from './mediaCorrectionFixture.mjs';
let db;
const worker='media-worker-correction';
before(async()=> { db=await createMediaCorrectionDatabase(); });
after(async()=>db?.close());
async function prepare() {
 const fixture=await seedPublicationInventory(db);
 const source=await registerPublicCopySource(db,fixture);
 await setActor(db,fixture.ownerId,'service_role');
 const claim=(await db.query(`SELECT * FROM public.claim_phase9_media_validation_jobs(10,'${worker}')`)).rows.find(r=>r.id===source.registered.job_id);
 const args=`'${claim.id}','${worker}','${claim.lease_token}',${claim.attempt_count}`;
 const context=await scalar(db,`SELECT public.phase9_prepare_media_validation_outputs(${args})`);
 return {fixture,source,claim,args,context};
}
async function bind(p) { return scalar(db,`SELECT public.phase9_bind_media_validation_snapshot_v2(${p.args},'${p.context.snapshot_path}','${p.context.source_sha256}',${p.context.source_bytes},'${p.context.source_mime}')`); }
function complete(p,bytes=96) { return scalar(db,`SELECT public.phase9_complete_media_validation_v2(${p.args},'${p.context.source_object_identity}','${p.context.source_sha256}','${p.context.snapshot_path}','${p.context.target_path}','${'e'.repeat(64)}',${bytes},1,1)`); }
test('prepare persists two service-only intents before upload and snapshot binding protects independently',async()=>{
 const p=await prepare(); assert.equal(p.context.output_intent_version,1); await db.exec('RESET ROLE');
 assert.equal(await scalar(db,`SELECT count(*)::int FROM marketplace_sec.phase9_media_output_intents WHERE job_id='${p.claim.id}'`),2);
 await bind(p);
 await db.exec('RESET ROLE'); assert.equal(await scalar(db,`SELECT state FROM marketplace_sec.phase9_media_output_intents WHERE job_id='${p.claim.id}' AND output_kind='snapshot'`),'accepted');
 await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 minute' WHERE id='${p.claim.id}'`);
 const cleanup=(await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(10,'${worker}')`)).rows;
 assert.equal(cleanup.filter(r=>r.object_path===p.context.snapshot_path).length,0);
 assert.equal(cleanup.filter(r=>r.object_path===p.context.target_path).length,1);
});
test('public completion exact replay is canonical; changed payload and claim rejected',async()=>{
 const p=await prepare(); await bind(p); const first=await complete(p); assert.deepEqual(await complete(p),first);
 await assert.rejects(complete(p,95),/P9_IDEMPOTENCY_MISMATCH/);
 await assert.rejects(complete({...p,args:p.args.replace(p.claim.lease_token,'f'.repeat(64))}),/P9_IDEMPOTENCY_MISMATCH/);
});
test('null and missing claim cannot register intents',async()=>{
 await assert.rejects(scalar(db,`SELECT public.phase9_prepare_media_validation_outputs('${randomUUID()}',NULL,NULL,NULL)`),/P9_OWNER_NOT_AUTHORIZED|P9_STATE_CONFLICT/);
});
test('reserved deletion permanently fences asset insertion and repeats successful sweeps',async()=>{
 const p=await prepare(); await db.exec(`UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id='${p.claim.id}'`);
 const rows=(await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(20,'${worker}')`)).rows;
 const target=rows.find(r=>r.object_path===p.context.target_path); assert.ok(target);
 await assert.rejects(db.exec(`INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,detected_mime,bytes,width,height,retention_class) VALUES('${p.fixture.storeId}','${p.fixture.ownerId}','public_copy','public','inventory-photos','${p.context.target_path}','${'e'.repeat(64)}','image/webp',96,1,1,'phase9-public-copy')`),/P9_STATE_CONFLICT/);
 await scalar(db,`SELECT public.phase9_finish_media_output_cleanup('${target.intent_id}','${worker}','${target.lease_token}',${target.attempt_count},'deleted')`);
 await db.exec('RESET ROLE'); assert.equal(await scalar(db,`SELECT state FROM marketplace_sec.phase9_media_output_intents WHERE id='${target.intent_id}'`),'delete_reserved');
 await db.exec(`UPDATE marketplace_sec.phase9_media_output_intents SET next_cleanup_at=transaction_timestamp()-interval '1 minute' WHERE id='${target.intent_id}'`);
 assert.ok((await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(20,'${worker}')`)).rows.some(r=>r.intent_id===target.intent_id));
});


async function prepareScan(fixture=undefined, attempt=1) {
 fixture??=await seedPublicationInventory(db);
 await setActor(db,fixture.ownerId,'service_role');
 await db.exec(`UPDATE public.image_extraction_sessions SET status='closed',closed_at=transaction_timestamp() WHERE created_by='${fixture.ownerId}' AND status IN ('active','closing')`);
 await setActor(db,fixture.ownerId);
 const sessionId=await scalar(db,`SELECT public.phase9_start_session(NULL,'en',NULL,'good','A1',1,'private','scan-${randomUUID()}','${randomUUID()}')`);
 await setActor(db,fixture.ownerId,'service_role');
 const cap=await scalar(db,`SELECT marketplace_sec.phase9_issue_scan_upload('${fixture.ownerId}','${sessionId}','camera','image/png',68,1,'issue-${randomUUID()}','${randomUUID()}')`);
 const registered=await scalar(db,`SELECT marketplace_sec.phase9_register_scan_upload_completion('${fixture.ownerId}','${cap.capability_id}','camera','${cap.bucket_id}','${cap.object_path}','${'a'.repeat(64)}','${'b'.repeat(64)}','image/png',68,'phase9-v1','register-${randomUUID()}','${randomUUID()}')`);
 if(attempt>1) await db.exec(`UPDATE public.image_extraction_jobs SET attempt_count=${attempt-1} WHERE id='${registered.job_id}'`);
 const claim=(await db.query(`SELECT * FROM public.claim_phase9_media_validation_jobs(10,'${worker}')`)).rows.find(r=>r.id===registered.job_id);
 const args=`'${claim.id}','${worker}','${claim.lease_token}',${claim.attempt_count}`;
 const context=await scalar(db,`SELECT public.phase9_prepare_media_validation_outputs(${args})`);
 return {fixture,sessionId,registered,claim,args,context};
}
test('scan exact replay and duplicate at attempt five are atomic terminal receipts with new provenance',async()=>{
 const first=await prepareScan(); await bind(first); const result=await complete(first); assert.equal(result.state,'queued');
 assert.deepEqual(await complete(first),result);
 const second=await prepareScan(first.fixture,5); await bind(second);
 const rejected=await complete(second); assert.equal(rejected.state,'duplicate_rejected'); assert.equal(rejected.safe_error_code,'P9_MEDIA_DUPLICATE_INPUT');
 assert.deepEqual(await complete(second),rejected);
 assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs WHERE id='${second.claim.id}'`),'resolved');
 assert.equal(await scalar(db,`SELECT count(*)::int FROM public.media_assets WHERE object_path='${second.context.target_path}'`),0);
 assert.equal(await scalar(db,`SELECT count(*)::int FROM public.image_extraction_jobs WHERE entity_id='${second.registered.input_id}' AND job_kind='vision_extract'`),0);
 assert.equal(await scalar(db,`SELECT session_id::text FROM public.image_extraction_inputs WHERE id='${second.registered.input_id}'`),second.sessionId);
});
test('scan and public reuse reject policy mismatch and active holds without linking',async()=>{
 for(const scan of [false,true]) {
  const p=await (scan?prepareScan():prepare()); await bind(p);
  await db.exec(`INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status,validation_version,validated_at,reencode_version,exif_strip_version,session_id,source_media_asset_id)
   VALUES('${p.fixture.storeId}','${p.fixture.ownerId}','${scan?'scan_input':'public_copy'}','${scan?'private_scan':'public'}','${p.context.target_bucket}','${p.context.target_path}','${'e'.repeat(64)}','image/webp',96,1,1,'wrong-retention','${scan?'linked':'approved'}','phase9-media-v1',transaction_timestamp(),'magick-wasm-0.0.41-webp','magick-wasm-0.0.41-strip',${scan?`'${p.sessionId}'`:'NULL'},${scan?'NULL':`'${p.context.source_media_asset_id}'`})`);
  await assert.rejects(complete(p),/P9_MEDIA_NOT_APPROVED/);
  await db.exec(`UPDATE public.media_assets SET retention_class='${scan?'phase9-private-scan':'phase9-public-copy'}',hold_type='review',hold_started_at=transaction_timestamp() WHERE object_path='${p.context.target_path}'`);
  await assert.rejects(complete(p),/P9_MEDIA_NOT_APPROVED/);
  await db.exec(`UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id='${p.claim.id}'`);
  const cleanup=(await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'${worker}')`)).rows;
  assert.equal(cleanup.some(r=>r.object_path===p.context.target_path),false);
 }
});
test('cleanup failures are bounded at five and protected snapshots stay accepted',async()=>{
 const p=await prepare(); await bind(p); await db.exec(`UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id='${p.claim.id}'`);
 let intent;
 for(let n=1;n<=5;n++) {
  await db.exec('RESET ROLE');
  await db.exec(`UPDATE marketplace_sec.phase9_media_output_intents SET next_cleanup_at=transaction_timestamp()-interval '1 minute' WHERE job_id='${p.claim.id}'`);
  const row=(await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'${worker}')`)).rows.find(r=>r.object_path===p.context.target_path); assert.ok(row); intent=row.intent_id;
  assert.equal(await scalar(db,`SELECT public.phase9_finish_media_output_cleanup('${row.intent_id}','${worker}','${row.lease_token}',${row.attempt_count},'retryable_error')`),n===5?'manual_reconciliation':'recheck');
 }
 assert.equal(await scalar(db,`SELECT state FROM marketplace_sec.phase9_media_output_intents WHERE id='${intent}'`),'delete_reserved');
 assert.equal((await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'${worker}')`)).rows.some(r=>r.intent_id===intent),false);
});
test('service-only wrappers reject authenticated calls and legacy bypass is revoked',async()=>{
 const p=await prepare(); await setActor(db,p.fixture.ownerId);
 await assert.rejects(scalar(db,`SELECT public.phase9_prepare_media_validation_outputs(${p.args})`),/permission denied/);
 await assert.rejects(scalar(db,`SELECT public.claim_phase9_media_output_cleanup_jobs(1,'${worker}')`),/permission denied/);
 await setActor(db,p.fixture.ownerId,'service_role');
 await assert.rejects(scalar(db,`SELECT public.phase9_complete_media_validation_v2_legacy(${p.args},NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)`),/permission denied/);
});



test('legacy public aliases route through durable guards for scan and public copy',async()=>{
 for(const scan of [false,true]) {
  const p=await (scan?prepareScan():prepare());
  await scalar(db,`SELECT public.phase9_bind_media_validation_snapshot(${p.args},'${p.context.snapshot_path}','${p.context.source_sha256}',${p.context.source_bytes},'${p.context.source_mime}')`);
  const sql=`SELECT public.phase9_complete_media_validation(${p.args},'${p.context.source_object_identity}','${p.context.source_sha256}','${p.context.snapshot_path}','${p.context.target_path}','${'e'.repeat(64)}',96,1,1)`;
  const first=await scalar(db,sql); assert.deepEqual(await scalar(db,sql),first);
  assert.deepEqual(await complete(p),first);
 }
});
test('stale and null completion and snapshot arguments are denied for both domains',async()=>{
 for(const scan of [false,true]) {
  const p=await (scan?prepareScan():prepare()); await bind(p);
  await assert.rejects(complete(p,'NULL'),/P9_MEDIA_NOT_APPROVED/);
  await assert.rejects(scalar(db,`SELECT public.phase9_bind_media_validation_snapshot_v2(${p.args},NULL,NULL,NULL,NULL)`),/P9_STATE_CONFLICT/);
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 minute' WHERE id='${p.claim.id}'`);
  await assert.rejects(complete(p),/P9_STATE_CONFLICT/);
 }
});
test('health exposes bounded reconciliation metrics without private paths',async()=>{
 const result=await scalar(db,'SELECT public.phase9_media_output_cleanup_health()');
 assert.deepEqual(Object.keys(result).sort(),['due_count','manual_reconciliation','oldest_due_seconds']);
 assert.ok(result.manual_reconciliation>=1); assert.ok(result.due_count>=0); assert.ok(result.oldest_due_seconds>=0);
});
test('expired cleanup acknowledgment retries cannot reopen the permanent fence',async()=>{
 const p=await prepare(); await db.exec(`UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id='${p.claim.id}'`);
 let prior;
 for(let n=1;n<=5;n++) {
  const row=(await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'${worker}')`)).rows.find(r=>r.object_path===p.context.target_path); assert.ok(row);
  if(prior) await assert.rejects(scalar(db,`SELECT public.phase9_finish_media_output_cleanup('${prior.intent_id}','${worker}','${prior.lease_token}',${prior.attempt_count},'deleted')`),/P9_STATE_CONFLICT/);
  await db.exec('RESET ROLE');
  await db.exec(`UPDATE marketplace_sec.phase9_media_output_intents SET cleanup_expires_at=transaction_timestamp()-interval '1 minute' WHERE id='${row.intent_id}'`); prior=row;
 }
 const rows=(await db.query(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,'${worker}')`)).rows;
 assert.equal(rows.some(r=>r.intent_id===prior.intent_id),false);
 assert.equal(await scalar(db,`SELECT cleanup_status FROM marketplace_sec.phase9_media_output_intents WHERE id='${prior.intent_id}'`),'manual_reconciliation');
 assert.equal(await scalar(db,`SELECT state FROM marketplace_sec.phase9_media_output_intents WHERE id='${prior.intent_id}'`),'delete_reserved');
});
test('revoked scan capability and incompatible public source policy fail closed',async()=>{
 const scan=await prepareScan(); await bind(scan);
 await db.exec(`UPDATE public.phase9_upload_capabilities SET status='revoked',revoked_at=transaction_timestamp() WHERE id=(SELECT upload_capability_id FROM public.image_extraction_inputs WHERE id='${scan.registered.input_id}')`);
 await assert.rejects(complete(scan),/P9_MEDIA_NOT_APPROVED|P9_STATE_CONFLICT/);
 const p=await prepare(); await bind(p);
 await db.exec(`UPDATE public.media_assets SET retention_class='incompatible-source-policy' WHERE id='${p.context.source_media_asset_id}'`);
 await assert.rejects(complete(p),/P9_MEDIA_NOT_APPROVED/);
});

test('unrelated uniqueness errors roll back without duplicate receipt or terminal mutation',async()=>{
 const p=await prepareScan(); await bind(p); await db.exec('RESET ROLE');
 await db.exec(`CREATE FUNCTION marketplace_sec.phase9_test_other_unique() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
  IF NEW.id='${p.registered.input_id}' AND NEW.media_asset_id IS NOT NULL THEN RAISE EXCEPTION 'unrelated_unique' USING ERRCODE='23505',CONSTRAINT='other_unique_constraint'; END IF; RETURN NEW; END$$;
  CREATE TRIGGER phase9_test_other_unique BEFORE UPDATE ON public.image_extraction_inputs FOR EACH ROW EXECUTE FUNCTION marketplace_sec.phase9_test_other_unique()`);
 try {
  await assert.rejects(complete(p),e=>e.code==='23505');
  assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs WHERE id='${p.claim.id}'`),'in_progress');
  assert.equal(await scalar(db,`SELECT count(*)::int FROM marketplace_sec.phase9_media_completion_receipts WHERE job_id='${p.claim.id}'`),0);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.media_assets WHERE object_path='${p.context.target_path}'`),0);
 } finally { await db.exec('DROP TRIGGER phase9_test_other_unique ON public.image_extraction_inputs; DROP FUNCTION marketplace_sec.phase9_test_other_unique()'); }
});
