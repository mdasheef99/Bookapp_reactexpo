// 02c §§4.3–4.4/9, 02c-1 §2: disposable 8a-5 queue/run proof, no HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {after,before,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {clean,createProviderDatabase,nativeConnection,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {seedCard,seedAutomaticLineage,claimJob} from './editionPickerFixture.mjs';
import {beginAutomatic,failureResult,olAutomaticRoute,singleReceipt} from './providerAutomaticReviewFixture.mjs';
import {rpc,seedOperation,token,worker} from './editionOptionsCompletionFixture.mjs';
const migration=new URL('../../migrations/20261101000093_marketplace_phase9_provider_queue_protection.sql',import.meta.url);
let db;
before(async()=>{
  db=await createProviderDatabase({selection:'8a-4'});
  if(fs.existsSync(migration))await db.exec(fs.readFileSync(migration,'utf8'));
});
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1000,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
beforeEach(async()=>{
  await clean(db);await resetActor(db);
  // Test-only operating bounds, never written by the migration.
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[policy]);
});
after(async()=>{await db?.close();});
async function pending(card=null) {
  const f=card??await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  return {...f,jobId};
}
async function autoFence(f) {
  await value(db,await claimJob(db,f,f.jobId));
  const c=await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,1]);
  return {jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,
    storeId:f.storeId,sessionId:f.sessionId,candidateVersion:c.candidateVersion,
    queryIdentity:c.queryIdentity,capturedRequestId:null,requestGeneration:0};
}
test('8a-5 installs service queue/round entries and private state',async()=>{
  for(const name of ['phase9_automatic_provider_runs','phase9_store_admission','phase9_job_admission_wait'])
    assert.equal(await value(db,'SELECT to_regclass($1) IS NOT NULL',['marketplace_sec.'+name]),true,name);
});
test('8a-5 claims one turn per store before returning to the backlog',async()=>{
  const a=await pending(),b=await pending();
  await resetActor(db);
  for(let i=0;i<5;i++)await db.query(`INSERT INTO public.image_extraction_jobs
    (store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES($1,'candidate',$2,'metadata_enrich',$3,'p9-metadata-foundation-v1')`,[a.storeId,a.candidateId,randomUUID()]);
  await setActor(db,'','service_role');
  const claimed=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(2,$1)',[worker])).rows;
  assert.equal(claimed.length,2);
  await resetActor(db);
  const stores=(await db.query('SELECT store_id FROM public.image_extraction_jobs WHERE id=ANY($1::uuid[])',[claimed.map(r=>r.id)])).rows;
  assert.deepEqual(new Set(stores.map(r=>r.store_id)),new Set([a.storeId,b.storeId]));
  for(const row of claimed){assert.equal(row.attempt_count,1);assert.match(row.lease_token,/^[a-f0-9]{64}$/);}
});
test('8a-5 paused no-child work defers without consuming five claims',async()=>{
  const f=await pending(),fence=await autoFence(f);
  await resetActor(db);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=1");
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[fence,1])).status,'deferred');
  assert.deepEqual((await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows,[]);
  await resetActor(db);
  assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),0);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='open',epoch=2");
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0].attempt_count,1);
});
test('8a-5 allows one known safe retry only on a new claim',async()=>{
  const f=await beginAutomatic(db),fence=f.command.fence;
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0'])).round,0);
  failureResult(f.command);await singleReceipt(db,f);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',[fence,'google_books','1.0.0'])).status,'retry_scheduled');
  await resetActor(db);
  await db.exec("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await setActor(db,'','service_role');
  const claim=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.equal(claim.attempt_count,2);
  const next={...fence,claimAttempt:2,leaseToken:claim.lease_token};
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[next,'google_books','1.0.0'])).round,1);
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[next,'google_books','1.0.0'])).status,'replayed');
});
test('8a-5 capacity defers before creating attempts and spends no allowance',async()=>{
  const f=await pending(),fence=await autoFence(f);
  await resetActor(db);
  await db.query('UPDATE marketplace_sec.phase9_store_admission SET gets_used=20 WHERE store_id=$1',[f.storeId]);
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0'])).status,'capacity_wait');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),0);
  assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),0);
});
test('8a-5 orphan/unknown physical work never schedules a retry',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  await rpc(db,'phase9_register_metadata_provider_call',[f.f.attemptId,f.f.jobId,worker,token,1,randomUUID()]);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'recovery_only');
  await resetActor(db);
  assert.equal(await value(db,'SELECT retry_allowed FROM marketplace_sec.phase9_automatic_provider_runs'),false);
  assert.equal(await value(db,'SELECT status FROM marketplace_sec.phase9_automatic_provider_runs'),'unknown');
});
test('8a-5 OL fan-out retry reuses one primary and restarts stages on the new claim',async()=>{
  await olAutomaticRoute(db);await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[policy]);
  const f=await beginAutomatic(db,{key:'open_library',version:'2.0.0'}),args=[f.command.fence,'open_library','2.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  const first=await rpc(db,'phase9_register_edition_options_provider_call_v1',
    [f.f.attemptId,f.f.jobId,worker,token,1,randomUUID(),0,'search']);
  await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
    [first.provider_call_id,f.f.jobId,worker,token,1,'finalized','timeout',true,true]);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'retry_scheduled');
  await resetActor(db);await db.exec("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await setActor(db,'','service_role');
  const claim=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,worker,claim.lease_token,2]);
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[
    {...f.command.fence,claimAttempt:2,leaseToken:claim.lease_token},'open_library','2.0.0'])).round,1);
  const second=await rpc(db,'phase9_register_edition_options_provider_call_v1',
    [f.f.attemptId,f.f.jobId,worker,claim.lease_token,2,randomUUID(),0,'search']);
  assert.notEqual(first.provider_call_id,second.provider_call_id);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_usage_reservations'),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),2);
});
test('8a-5 round-1 failure cannot authorize round 2 or a sixth claim',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);failureResult(f.command);await singleReceipt(db,f);
  await rpc(db,'phase9_finish_automatic_provider_run_v1',args);
  // Repeated finish recovers the original decision after releasing the lease.
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'retry_scheduled');
  await resetActor(db);await db.exec("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await setActor(db,'','service_role');
  const next=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  const fence={...f.command.fence,claimAttempt:2,leaseToken:next.lease_token};
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,worker,next.lease_token,2]);
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0']);
  const call=await rpc(db,'phase9_register_metadata_provider_call',[f.f.attemptId,f.f.jobId,worker,next.lease_token,2,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,f.f.jobId,worker,next.lease_token,2,
    'finalized','timeout','timeout','retry-request',true,null,[]]);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',[fence,'google_books','1.0.0'])).status,'finalized');
  await resetActor(db);
  await db.query(`UPDATE public.image_extraction_jobs SET attempt_count=3,lease_token_hash=encode(extensions.digest($1,'sha256'),'hex')
    WHERE id=$2`,['b'.repeat(64),f.f.jobId]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[
    {...fence,claimAttempt:3,leaseToken:'b'.repeat(64)},'google_books','1.0.0'])).status,'recovery_only');
  await assert.rejects(rpc(db,'phase9_begin_automatic_provider_run_v1',[
    {...fence,claimAttempt:6},'google_books','1.0.0']),/P9_AUTO_COMMAND_INVALID/);
});
for(const lock of ['store','head job'])test(`8a-5 native ${lock} lock skips A and admits B`,
  {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT},async()=>{
  const a=await pending(),b=await pending();await resetActor(db);
  await db.query(`UPDATE marketplace_sec.phase9_store_admission SET last_ticket=CASE store_id WHEN $1 THEN 0 ELSE 1 END
    WHERE store_id=ANY($2::uuid[])`,[a.storeId,[a.storeId,b.storeId]]);
  const holder=await nativeConnection(db.database);
  try {
    await holder.query('BEGIN');
    await holder.query(lock==='store'
      ? 'SELECT 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=$1 FOR UPDATE'
      : 'SELECT 1 FROM public.image_extraction_jobs WHERE id=$1 FOR UPDATE',
    [lock==='store'?a.storeId:a.jobId]);
    await setActor(db,'','service_role');
    const claimed=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows;
    assert.equal(claimed.length,1);assert.equal(claimed[0].id,b.jobId);
  } finally {await holder.query('ROLLBACK');await holder.end();}
});
test('8a-5 1000:1 backlog serves B within one store round, including explicit B',async()=>{
  const a=await pending(),b=await pending();await resetActor(db);
  await db.query(`INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key)
    SELECT $1,'candidate',$2,'metadata_enrich',gen_random_uuid()::text FROM generate_series(1,999)`,[a.storeId,a.candidateId]);
  await db.query("UPDATE public.image_extraction_jobs SET operation_version='p9-owner-edition-options-v1' WHERE id=$1",[b.jobId]);
  await setActor(db,'','service_role');
  const first=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  const second=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.ok([first.id,second.id].includes(b.jobId),'B must be served within N=2 admissions');
});
test('8a-5 forged scope and stale epoch do not defer; child obligations require drain',async()=>{
  const f=await beginAutomatic(db),fence=f.command.fence;
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=3");
  await setActor(db,f.f.ownerId,'service_role');
  await assert.rejects(rpc(db,'phase9_defer_metadata_admission_v1',[{...fence,storeId:randomUUID()},3]),/P9_STATE_CONFLICT/);
  await assert.rejects(rpc(db,'phase9_defer_metadata_admission_v1',[fence,2]),/P9_STATE_CONFLICT/);
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[fence,3])).status,'drain_required');
});
test('8a-5 explicit fence may neutrally defer its own paused request',async()=>{
  const f=await seedOperation(db);
  const fence={jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,storeId:f.storeId,
    sessionId:f.sessionId,requestId:f.jobId,requestGeneration:f.context.requestGeneration,queryIdentity:f.context.queryIdentity};
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=4");
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[fence,4])).status,'deferred');
});
test('8a-5 NULL policy stays unconfigured and unsupported shared pacing is refused',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await resetActor(db);await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  await setActor(db,f.f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',args)).status,'configuration_required');
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[{...policy,mode:'shared_db'}]);
  await setActor(db,f.f.ownerId,'service_role');
  await assert.rejects(rpc(db,'phase9_begin_automatic_provider_run_v1',args),/P9_PROVIDER_CONFIGURATION_INVALID/);
});
test('8a-5 registration replay charges capacity once and a paused new grant is denied',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  const id=randomUUID(),callArgs=[f.f.attemptId,f.f.jobId,worker,token,1,id];
  const first=await rpc(db,'phase9_register_metadata_provider_call',callArgs);
  assert.deepEqual(await rpc(db,'phase9_register_metadata_provider_call',callArgs),first);
  await resetActor(db);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.f.storeId]),1);
  const other=await beginAutomatic(db);
  await resetActor(db);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=5");
  // Existing registration is a recovery receipt, not permission for another GET.
  await setActor(db,f.f.ownerId,'service_role');
  assert.deepEqual(await rpc(db,'phase9_register_metadata_provider_call',callArgs),first);
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',[
    other.f.attemptId,other.f.jobId,worker,token,1,randomUUID()]),/P9_EXTERNAL_ADMISSION_PAUSED/);
});
test('8a-5 a stale v2 marker does not block a legacy reclaim of a NULL-policy job',async()=>{
  const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [jobId]);
  await setActor(db,'','service_role');
  const first=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.equal(first.id,jobId);assert.equal(first.attempt_count,1);
  // No begin and no run: the only v2 state is the claim marker.
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [jobId]);
  await setActor(db,'','service_role');
  const legacy='legacy-worker-0001';
  const claim=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[legacy])).rows[0];
  assert.equal(claim.id,jobId);assert.equal(claim.attempt_count,2);
  const context=await rpc(db,'phase9_metadata_job_context',[jobId,legacy,claim.lease_token,2]);
  const base=[jobId,legacy,claim.lease_token,2],key='legacy-reclaim:'+jobId;
  const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',[...base,f.candidateId,context.candidateVersion,
    context.queryIdentity,key,'google_books','1.0.0','google-books-capability-v1','p9-metadata-foundation-v1','bibliographic',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private','1',
    'p9-metadata-cache-v1','metadata-v1',null]);
  const usage=await rpc(db,'phase9_reserve_metadata_usage',[...base,lookup.lookup_id,'google_books','1.0.0',1]);
  const attempt=await rpc(db,'phase9_register_structural_metadata_attempt',[lookup.lookup_id,...base,f.candidateId,
    context.candidateVersion,randomUUID(),key,'primary',1,'google_books','1.0.0','google-books-capability-v1',
    'p9-metadata-foundation-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',
    usage.reservation_id]);
  const call=await rpc(db,'phase9_register_metadata_provider_call',
    [attempt.attempt_id,jobId,legacy,claim.lease_token,2,randomUUID()]);
  assert.ok(call.provider_call_id);
});
test('8a-5 a stale finalized run does not block a legacy reclaim of a NULL-policy job',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',args)).status,'started');
  await singleReceipt(db,f);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'finalized');
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [f.f.jobId]);
  await setActor(db,'','service_role');
  const legacy='legacy-worker-0001';
  const claim=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[legacy])).rows[0];
  assert.equal(claim.id,f.f.jobId);assert.equal(claim.attempt_count,2);
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,legacy,claim.lease_token,2]);
  const call=await rpc(db,'phase9_register_metadata_provider_call',
    [f.f.attemptId,f.f.jobId,legacy,claim.lease_token,2,randomUUID()]);
  assert.ok(call.provider_call_id);
  await resetActor(db);
  assert.equal(await value(db,'SELECT status FROM marketplace_sec.phase9_automatic_provider_runs'),'finalized');
  assert.equal(await value(db,'SELECT claim_attempt_number FROM marketplace_sec.phase9_automatic_provider_runs'),1);
  assert.equal(await value(db,'SELECT claim_attempt_number FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',
    [f.f.jobId]),1);
});
test('8a-5 configuration_required begin leaves no v2 marker behind',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await resetActor(db);
  // A second active configured route makes this otherwise valid policy unusable.
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",
    [{...policy,storeWindowSeconds:1,storeMaxGets:1}]);
  await setActor(db,f.f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',args)).status,'configuration_required');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',
    [f.f.jobId]),0);
  // Restore NULL-policy legacy routes: the refused begin did not mint this legacy claim,
  // and an unadmitted policy-protected call is no longer a legacy path.
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key IN('open_library','google_books')");
  await singleReceipt(db,f);
});
test('8a-5 a legacy reclaim of a marked job can still write its terminal transition',async()=>{
  const f=await beginAutomatic(db);
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f.command.fence,'google_books','1.0.0'])).status,'started');
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [f.f.jobId]);
  await setActor(db,'','service_role');
  const claim=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[worker])).rows[0];
  assert.equal(claim.id,f.f.jobId);assert.equal(claim.attempt_count,2);
  await db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[f.f.jobId]);
  await resetActor(db);
  assert.equal(await value(db,'SELECT status FROM public.image_extraction_jobs WHERE id=$1',[f.f.jobId]),'resolved');
});
test('8a-5 private state and new entries have no public/client grants',async()=>{
  await resetActor(db);
  for(const name of ['phase9_store_admission','phase9_automatic_provider_runs','phase9_job_admission_wait','phase9_metadata_admissions']) {
    const table='marketplace_sec.'+name;
    assert.equal(await value(db,'SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass',[table]),true);
    for(const role of ['anon','authenticated','service_role'])
      for(const right of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])
        assert.equal(await value(db,'SELECT has_table_privilege($1,$2,$3)',[role,table,right]),false);
  }
  for(const signature of ['phase9_claim_metadata_jobs_v2(integer,text)','phase9_defer_metadata_admission_v1(jsonb,bigint)',
    'phase9_begin_automatic_provider_run_v1(jsonb,text,text)','phase9_finish_automatic_provider_run_v1(jsonb,text,text)']) {
    for(const schema of ['public','marketplace_sec']) {
      for(const role of ['anon','authenticated'])
        assert.equal(await value(db,'SELECT has_function_privilege($1,$2,\'EXECUTE\')',[role,schema+'.'+signature]),false);
      assert.equal(await value(db,"SELECT has_function_privilege('service_role',$1,'EXECUTE')",[schema+'.'+signature]),true);
    }
  }
});
