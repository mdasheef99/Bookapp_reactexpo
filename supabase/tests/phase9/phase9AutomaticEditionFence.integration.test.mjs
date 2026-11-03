// 02c §§4.3/5.1/9: executable U5 fence/lineage proof in disposable databases only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,denied,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {selectedPrefix} from './providerDatabaseHarness.mjs';
import {beginAutomatic,failureResult,singleReceipt} from './providerAutomaticReviewFixture.mjs';
import {claimJob,seedAutomaticLineage,seedCard} from './editionPickerFixture.mjs';
import {rpc,seedOperation,token,worker} from './editionOptionsCompletionFixture.mjs';
const migration='20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
let db;
before(async()=>{
  const prefix=selectedPrefix('8a-5');
  db=await createProviderDatabase({migrations:[...prefix.migrations,migration],installed:prefix.installed});
});
beforeEach(async()=>{
  await clean(db);await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[policy]);
});
after(async()=>{await db?.close();});
async function read(f,leaseToken=token,attempt=1) {
  await setActor(db,'','service_role');
  return rpc(db,'phase9_automatic_edition_fence_v1',[f.jobId,worker,leaseToken,attempt]);
}
async function fresh(leaseToken=token) {
  const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  const context=await value(db,await claimJob(db,f,jobId,leaseToken));
  return {...f,jobId,context};
}
async function state(f,generation,requestId=null) {
  await resetActor(db);
  await db.query('INSERT INTO public.phase9_candidate_edition_state '+
    '(candidate_id,session_id,store_id,query_identity,request_generation,request_id) VALUES($1,$2,$3,$4,$5,$6) '+
    'ON CONFLICT(candidate_id) DO UPDATE SET request_generation=excluded.request_generation,request_id=excluded.request_id',
  [f.candidateId,f.sessionId,f.storeId,f.context.queryIdentity,generation,requestId]);
}
async function boundRun(fail=false,generation=0) {
  const f=await beginAutomatic(db);
  if(generation>0)await state(f.f,generation,f.f.jobId);
  const s=await read(f.f);
  Object.assign(f.command.fence,{requestGeneration:s.requestGeneration,capturedRequestId:s.capturedRequestId});
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f.command.fence,'google_books','1.0.0'])).status,'started');
  if(fail)failureResult(f.command);
  await singleReceipt(db,f);return f;
}
async function reclaim(f) {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second',"+
    "next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await setActor(db,'','service_role');
  const [claim]=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[worker])).rows;
  assert.equal(claim.id,f.jobId);assert.equal(claim.attempt_count,2);return claim;
}
async function noAcceptedEffects() {
  await resetActor(db);
  for(const table of ['phase9_selected_metadata_snapshots','phase9_metadata_cache_entries'])
    assert.equal(await value(db,'SELECT count(*)::int FROM public.'+table),0,table);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects'),0);
}

// Catches worker-side zero/null fabrication and JSON string "null" instead of SQL NULL.
test('R1-1/2: missing state returns the exact automatic DTO and UUID-castable JSON null',async()=>{
  const f=await fresh(),s=await read(f);
  assert.deepEqual(s,{candidateVersion:f.context.candidateVersion,requestGeneration:0,capturedRequestId:null,lineage:null});
  assert.equal(await value(db,"SELECT ($1::jsonb->>'capturedRequestId')::uuid",[s]),null);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_candidate_edition_state'),0);
});
// Catches always returning defaults instead of the server's persisted request fence.
test('R1-1: existing state returns its actual generation and request UUID',async()=>{
  const f=await fresh();await state(f,7,f.jobId);
  assert.deepEqual(await read(f),{candidateVersion:f.context.candidateVersion,requestGeneration:7,capturedRequestId:f.jobId,lineage:null});
});
for(const [name,args]of [
  ['worker',f=>[f.jobId,'other-worker-0001',token,1]],
  ['token',f=>[f.jobId,worker,'b'.repeat(64),1]],
  ['attempt',f=>[f.jobId,worker,token,2]],
]) {
  // Catches accepting one mismatched component of the real current lease.
  test('R1-3: refuses mismatched '+name,async()=>{
    const f=await fresh();
    await assert.rejects(rpc(db,'phase9_automatic_edition_fence_v1',args(f)),/P9_STATE_CONFLICT/);
  });
}
// Catches accepting an expired claim even though its token still matches.
test('R1-3: refuses an expired lease',async()=>{
  const f=await fresh();await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await assert.rejects(read(f),/P9_STATE_CONFLICT/);
});
// Catches substituting another job ID while retaining the first job's token.
test('R1-3: refuses a cross-job token substitution',async()=>{
  await fresh();const second=await fresh('b'.repeat(64));
  await assert.rejects(read(second),/P9_STATE_CONFLICT/);
  assert.equal((await read(second,'b'.repeat(64))).candidateVersion,second.context.candidateVersion);
});
// Catches changing either existing context contract or accepting the explicit purpose.
test('R1-4: preserves automatic and explicit contexts and refuses explicit fence reads',async()=>{
  const f=await fresh(),automatic=await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,1]);
  await read(f);
  assert.deepEqual(await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,1]),automatic);
  assert.equal(automatic.contractVersion,'p9-metadata-job-context-v2');
  assert.equal(Object.hasOwn(automatic,'capturedRequestId'),false);
  assert.equal(Object.hasOwn(automatic,'lineage'),false);
  const explicit=await seedOperation(db),before=await rpc(db,'phase9_metadata_job_context',[explicit.jobId,worker,token,1]);
  await assert.rejects(read(explicit),/P9_STATE_CONFLICT/);
  assert.deepEqual(await rpc(db,'phase9_metadata_job_context',[explicit.jobId,worker,token,1]),before);
});
for(const generation of [0,7]) {
  // Catches a default or non-default returned fence M93 cannot consume, or recovery requiring an active lease.
  test('R1-5/9: returned generation '+generation+' completes and recovers after lease clearing',async()=>{
    const f=await boundRun(false,generation),receipt=await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command]);
    assert.equal(receipt.status,'completed');assert.equal(receipt.lookupId,f.f.lookupId);
    assert.deepEqual(await rpc(db,'phase9_recover_automatic_metadata_v1',[f.command.fence]),{...receipt,status:'replayed'});
    await resetActor(db);
    assert.equal(await value(db,'SELECT lease_token_hash FROM public.image_extraction_jobs WHERE id=$1',[f.f.jobId]),null);
  });
}
// Catches a begin that ignores a persisted generation change after the read.
test('R1-6: generation changed before begin creates no automatic run',async()=>{
  const f=await fresh(),s=await read(f),fence={jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,
    candidateId:f.candidateId,storeId:f.storeId,sessionId:f.sessionId,candidateVersion:s.candidateVersion,
    queryIdentity:f.context.queryIdentity,capturedRequestId:s.capturedRequestId,requestGeneration:s.requestGeneration};
  await state(f,1);await setActor(db,'','service_role');
  await assert.rejects(rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0']),/P9_STATE_CONFLICT/);
  await noAcceptedEffects();
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_lookups'),0);
});
for(const [name,generation,request]of [['generation',1,false],['request UUID',0,true]]) {
  // Catches completing stale provider evidence after either edition-state fence component changes.
  test('R1-7/8: changed '+name+' returns stale_rejected without acceptance effects',async()=>{
    const f=await boundRun();await state(f.f,generation,request?f.f.jobId:null);await setActor(db,'','service_role');
    assert.deepEqual(await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command]),{status:'stale_rejected'});
    await noAcceptedEffects();
    assert.equal(await value(db,"SELECT count(*)::int FROM public.phase9_usage_reservations WHERE status='consumed'"),0);
  });
}
for(const physical of [false,true]) {
  // Catches treating a replacement lease as authority to restart a running round, with or without a call.
  test('R1-10: reclaimed running run is recovery_only, physical='+physical,async()=>{
    let f,original;
    if(physical){const b=await boundRun();f=b.f;original=b.command.fence;}
    else {
      f=await fresh();const s=await read(f);
      original={jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,
        storeId:f.storeId,sessionId:f.sessionId,candidateVersion:s.candidateVersion,queryIdentity:f.context.queryIdentity,
        capturedRequestId:s.capturedRequestId,requestGeneration:s.requestGeneration};
      await rpc(db,'phase9_begin_automatic_provider_run_v1',[original,'google_books','1.0.0']);
    }
    const next=await reclaim(f),current={...original,leaseToken:next.lease_token,claimAttempt:2};
    assert.deepEqual(await rpc(db,'phase9_begin_automatic_provider_run_v1',[current,'google_books','1.0.0']),{status:'recovery_only'});
    assert.deepEqual(await rpc(db,'phase9_recover_automatic_metadata_v1',[original]),{status:'stale_rejected'});
    await resetActor(db);
    assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),Number(physical));
    assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),1);
  });
}
// Catches using current registry policy or the attempt's similarly named policy column as history.
test('G-policy: lineage uses lookup policy while attempt and current registry differ',async()=>{
  const f=await boundRun();await resetActor(db);
  await db.query("UPDATE public.phase9_metadata_lookups SET reuse_policy_version='7' WHERE id=$1",[f.f.lookupId]);
  await db.exec("UPDATE public.phase9_provider_registry SET policy_version=9 WHERE adapter_key='google_books'");
  assert.equal(await value(db,'SELECT reuse_policy_version FROM public.metadata_enrichment_attempts WHERE id=$1',[f.f.attemptId]),1);
  assert.deepEqual((await read(f.f)).lineage,{adapterKey:'google_books',adapterVersion:'1.0.0',purpose:'automatic',
    role:'primary',sequence:1,lookupId:f.f.lookupId,attemptId:f.f.attemptId,claimAttempt:1,policyVersion:7});
});
// Catches taking the rebased lookup claim as historical execution and inventing new retry identities.
test('G-retry: rebased context preserves run claim and authorized retry reuses lookup and attempt',async()=>{
  const f=await boundRun(true),args=[f.command.fence,'google_books','1.0.0'];
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'retry_scheduled');
  const next=await reclaim(f.f);
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,worker,next.lease_token,2]);
  const s=await read(f.f,next.lease_token,2);
  assert.equal(s.lineage.claimAttempt,1);assert.equal(s.lineage.lookupId,f.f.lookupId);assert.equal(s.lineage.attemptId,f.f.attemptId);
  await resetActor(db);
  assert.equal(await value(db,'SELECT claim_attempt_number FROM public.phase9_metadata_lookups WHERE id=$1',[f.f.lookupId]),2);
  await setActor(db,'','service_role');
  const fence={...f.command.fence,leaseToken:next.lease_token,claimAttempt:2};
  assert.deepEqual(await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0']),{status:'started',round:1});
  const call=await rpc(db,'phase9_register_metadata_provider_call',[s.lineage.attemptId,f.f.jobId,worker,next.lease_token,2,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,f.f.jobId,worker,next.lease_token,2,
    'finalized','timeout','timeout','review-request',true,null,[]]);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',[fence,'google_books','1.0.0'])).status,'finalized');
  assert.equal((await rpc(db,'phase9_complete_automatic_metadata_v1',[{...f.command,fence}])).status,'completed');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_lookups'),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),2);
});
for(const [name,statement]of [
  ['lookup version',"UPDATE public.phase9_metadata_lookups SET adapter_version='1.0.1'"],
  ['attempt version',"UPDATE public.metadata_enrichment_attempts SET adapter_version='1.0.1'"],
  ['run version',"UPDATE marketplace_sec.phase9_automatic_provider_runs SET adapter_version='1.0.1'"],
  ['query hash',"UPDATE marketplace_sec.phase9_automatic_provider_runs SET query_identity_hash=repeat('0',64)"],
  ['attempt role',"UPDATE public.metadata_enrichment_attempts SET provider_role='secondary'"],
  ['attempt sequence',"UPDATE public.metadata_enrichment_attempts SET attempt_sequence=2"],
]) {
  // Catches adopting a run/lookup/attempt tuple whose persisted provider or query binding is crossed.
  test('G-binding: refuses crossed '+name,async()=>{
    const f=await boundRun();await resetActor(db);await db.exec(statement);
    await assert.rejects(read(f.f),/P9_STATE_CONFLICT/);
  });
}
for(const [column,otherId]of [['lookup_id',f=>f.f.lookupId],['primary_attempt_id',f=>f.f.attemptId]]) {
  // Catches adopting another job's valid UUID through the run's individually valid foreign key.
  test('G-scope: refuses another job\'s '+column,async()=>{
    const first=await boundRun(),other=await boundRun();await resetActor(db);
    await db.query('UPDATE marketplace_sec.phase9_automatic_provider_runs SET '+column+'=$1 WHERE job_id=$2',
      [otherId(other),first.f.jobId]);
    await assert.rejects(read(first.f),/P9_STATE_CONFLICT/);
  });
}
// Catches treating a valid historical tuple as permission to retry an unknown execution.
test('G-unknown: returned lineage never authorizes a reclaimed unknown run',async()=>{
  const f=await boundRun();await resetActor(db);
  await db.query("UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='unknown' WHERE job_id=$1",[f.f.jobId]);
  assert.equal((await read(f.f)).lineage.attemptId,f.f.attemptId);
  const next=await reclaim(f.f),fence={...f.command.fence,leaseToken:next.lease_token,claimAttempt:2};
  assert.deepEqual(await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0']),{status:'recovery_only'});
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),1);
});
// Catches fabricating a full Lineage from registered IDs before a run binds a physical attempt.
test('G-incomplete: pre-grant lookup and attempt do not invent historical lineage',async()=>{
  const f=await beginAutomatic(db);
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[f.command.fence,'google_books','1.0.0']);
  assert.equal((await read(f.f)).lineage,null);
});
for(const schema of ['public','marketplace_sec'])for(const role of ['anon','authenticated']) {
  // Catches granting either service entry to a client role.
  test('ACL: '+role+' cannot execute '+schema+' fence reader',async()=>{
    await denied(db,role,'SELECT '+schema+'.phase9_automatic_edition_fence_v1(NULL::uuid,NULL::text,NULL::text,1)');
  });
}
