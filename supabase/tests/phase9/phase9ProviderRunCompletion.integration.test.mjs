// 02c §§4.3/8/9: truthful terminal outcomes, durable receipts, one accounting effect.
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {clean,createProviderDatabase,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {beginAutomatic,failureResult,olAutomaticRoute,singleReceipt} from './providerAutomaticReviewFixture.mjs';
import {rpc,token,worker} from './editionOptionsCompletionFixture.mjs';
import {seedCard,seedAutomaticLineage,claimJob} from './editionPickerFixture.mjs';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
let db;
before(async()=>{db=await createProviderDatabase({selection:'8a-5'});});
beforeEach(async()=>{
  await clean(db);await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key IN ('google_books','open_library')",[policy]);
});
after(async()=>{await db?.close();});
async function firstFailure({fanout=false}={}) {
  if(fanout)await olAutomaticRoute(db);
  const key=fanout?'open_library':'google_books',version=fanout?'2.0.0':'1.0.0';
  const f=await beginAutomatic(db,{key,version});
  failureResult(f.command);
  if(fanout)f.command.result.outcome.providerRequestId=null;
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[f.command.fence,key,version]);
  if(fanout) {
    const c=await rpc(db,'phase9_register_edition_options_provider_call_v1',
      [f.f.attemptId,f.f.jobId,worker,token,1,randomUUID(),0,'search']);
    await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
      [c.provider_call_id,f.f.jobId,worker,token,1,'finalized','timeout',true,true]);
  } else await singleReceipt(db,f);
  return {...f,key,version};
}
async function retryClaim(f) {
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[f.command.fence,f.key,f.version]);
  await resetActor(db);
  await db.exec("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await setActor(db,'','service_role');
  const c=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,worker,c.lease_token,2]);
  f.command.fence={...f.command.fence,leaseToken:c.lease_token,claimAttempt:2};
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[f.command.fence,f.key,f.version]);
  return c.lease_token;
}
async function completedOnce(f,expectedCalls) {
  const r=await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command]);
  assert.equal(r.status,'completed');assert.equal(r.outcome,'technical_failure');
  const repeat=await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command]);
  assert.equal(repeat.status,'replayed');assert.equal(repeat.snapshotId,r.snapshotId);
  await resetActor(db);
  assert.deepEqual((await db.query(`SELECT j.status,j.attempt_count,c.state FROM public.image_extraction_jobs j
    JOIN public.image_extraction_candidates c ON c.id=j.entity_id WHERE j.id=$1`,[f.f.jobId])).rows,
  [{status:'dead_letter',attempt_count:f.command.fence.claimAttempt,state:'needs_review'}]);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.f.jobId]),expectedCalls);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects WHERE job_id=$1',[f.f.jobId]),1);
  assert.equal(await value(db,"SELECT count(*)::int FROM public.phase9_usage_reservations WHERE job_id=$1 AND status='consumed'",[f.f.jobId]),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.canonical_editions'),0);
  return r;
}
test('terminal run: fanout second failure preserves a valid stage prefix and completes once',async()=>{
  const f=await firstFailure({fanout:true}),next=await retryClaim(f);
  const first=await rpc(db,'phase9_register_edition_options_provider_call_v1',
    [f.f.attemptId,f.f.jobId,worker,next,2,randomUUID(),0,'search']);
  await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
    [first.provider_call_id,f.f.jobId,worker,next,2,'finalized','no_acceptable_match',false,true]);
  const second=await rpc(db,'phase9_register_edition_options_provider_call_v1',
    [f.f.attemptId,f.f.jobId,worker,next,2,randomUUID(),1,'edition']);
  await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
    [second.provider_call_id,f.f.jobId,worker,next,2,'finalized','timeout',true,true]);
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[f.command.fence,f.key,f.version]);
  await completedOnce(f,3);
});
test('terminal run: breaker recheck after physical failure uses original accounting and no current call',async()=>{
  const f=await firstFailure();await retryClaim(f);
  f.command.result.outcome.outcome='circuit_breaker_open';f.command.result.outcome.providerRequestId=null;
  const args=[f.command.fence,f.key,f.version];
  assert.equal((await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',args)).status,'finalized');
  assert.equal((await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',args)).status,'finalized');
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',[
    f.f.attemptId,f.f.jobId,worker,f.command.fence.leaseToken,2,randomUUID()]),/P9_PROVIDER_RUN_NOT_ADMITTED/);
  await completedOnce(f,1);
});
for(const reenable of [false,true])test(`terminal run: kill before finish completes truthfully, reenabled=${reenable}`,async()=>{
  const f=await firstFailure();await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='google_books'");
  await db.query('UPDATE public.phase9_usage_reservations SET actual_cost_units=7 WHERE job_id=$1',[f.f.jobId]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',[f.command.fence,f.key,f.version])).status,'finalized');
  if(reenable){await resetActor(db);await db.exec("UPDATE public.phase9_provider_registry SET enabled=true WHERE adapter_key='google_books'");await setActor(db,'','service_role');}
  await completedOnce(f,1);
  assert.equal(Number(await value(db,'SELECT actual_cost_units FROM public.phase9_usage_reservations WHERE job_id=$1',[f.f.jobId])),7);
});
for(const tamper of ['digest','outcome','run state','lookup','generation'])
  test(`terminal run: altered ${tamper} cannot authorize manual completion`,async()=>{
    const f=await firstFailure(),next=await retryClaim(f);
    const call=await rpc(db,'phase9_register_metadata_provider_call',[f.f.attemptId,f.f.jobId,worker,next,2,randomUUID()]);
    await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,f.f.jobId,worker,next,2,
      'finalized','timeout','timeout','review-request',true,null,[]]);
    await rpc(db,'phase9_finish_automatic_provider_run_v1',[f.command.fence,f.key,f.version]);
    await resetActor(db);
    if(tamper==='digest')await db.exec("UPDATE marketplace_sec.phase9_automatic_provider_runs SET receipt_digest=repeat('0',64) WHERE round=1");
    if(tamper==='run state')await db.exec("UPDATE marketplace_sec.phase9_automatic_provider_runs SET status='unknown' WHERE round=1");
    if(tamper==='outcome')f.command.result.outcome.outcome='network_failure';
    if(tamper==='lookup')f.command.lookupId=randomUUID();
    if(tamper==='generation')f.command.fence.requestGeneration++;
    await setActor(db,'','service_role');
    const result=await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command]).catch(e=>({error:e.message}));
    assert.ok(result.error||result.status==='stale_rejected');
    await resetActor(db);
    assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects'),0);
    assert.equal(await value(db,"SELECT count(*)::int FROM public.phase9_usage_reservations WHERE status='consumed'"),0);
  });
test('terminal run: receipt proof survives finish and completion on different timezones',async()=>{
  const f=await firstFailure(),next=await retryClaim(f);
  const c=await rpc(db,'phase9_register_metadata_provider_call',[f.f.attemptId,f.f.jobId,worker,next,2,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[c.provider_call_id,f.f.jobId,worker,next,2,
    'finalized','timeout','timeout','review-request',true,null,[]]);
  await db.exec("SET TIME ZONE 'UTC'");
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[f.command.fence,f.key,f.version]);
  await db.exec("SET TIME ZONE 'Asia/Kolkata'");
  await completedOnce(f,2);await db.exec("SET TIME ZONE 'UTC'");
});
async function initiallyOpenBreaker() {
  const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  await value(db,await claimJob(db,f,jobId));
  const c=await rpc(db,'phase9_metadata_job_context',[jobId,worker,token,1]);
  let full={jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,storeId:f.storeId,
    sessionId:f.sessionId,candidateVersion:c.candidateVersion,queryIdentity:c.queryIdentity,capturedRequestId:null,requestGeneration:0};
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[full,'google_books','1.0.0']);
  await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',[full,'google_books','1.0.0']);
  await resetActor(db);await db.exec("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await setActor(db,'','service_role');
  const next=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  await rpc(db,'phase9_metadata_job_context',[jobId,worker,next.lease_token,2]);
  full={...full,claimAttempt:2,leaseToken:next.lease_token};
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[full,'google_books','1.0.0']);
  return {f:{...f,jobId},context:c,command:{fence:full,lookupId:randomUUID(),attemptId:null,selectedOptionId:null,source:'local',
    result:{version:'p9-metadata-result-v2',purpose:'automatic',outcome:{outcome:'circuit_breaker_open',candidates:[],
      selected:null,evidence:[],retryable:true,secondaryEligible:true,providerRequestId:null,representativeCover:null},
    rows:null,catalogueCompanions:null,retention:null}}};
}
test('terminal run: initially open breaker gets one recheck then completes with no invented provider lineage',async()=>{
  const f=await initiallyOpenBreaker();
  assert.equal((await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',[f.command.fence,'google_books','1.0.0'])).status,'finalized');
  const result=await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command]);
  assert.equal(result.status,'completed');assert.equal(result.outcome,'technical_failure');
  assert.equal((await rpc(db,'phase9_recover_automatic_metadata_v1',[f.command.fence])).snapshotId,result.snapshotId);
  await resetActor(db);
  for(const table of ['metadata_enrichment_attempts','phase9_metadata_provider_calls','phase9_usage_reservations'])
    assert.equal(await value(db,`SELECT count(*)::int FROM public.${table}`),0);
});
test('terminal run: an altered request fence cannot finalize a running round',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  failureResult(f.command);await singleReceipt(db,f);
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET version=version+1 WHERE id=$1',[f.f.candidateId]);
  await setActor(db,'','service_role');
  await assert.rejects(rpc(db,'phase9_finish_automatic_provider_run_v1',
    [{...f.command.fence,candidateVersion:f.command.fence.candidateVersion+1},'google_books','1.0.0']),/P9_STATE_CONFLICT/);
});
test('terminal run: an identical finish replay returns the original scheduled result',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  failureResult(f.command);await singleReceipt(db,f);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'retry_scheduled');
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'retry_scheduled');
});
test('terminal run: scheduler-terminal at claim two does not claim exhaustion',async()=>{
  const f=await firstFailure(),next=await retryClaim(f);
  const call=await rpc(db,'phase9_register_metadata_provider_call',[f.f.attemptId,f.f.jobId,worker,next,2,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,f.f.jobId,worker,next,2,
    'finalized','timeout','timeout','review-request',true,null,[]]);
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[f.command.fence,f.key,f.version]);
  await completedOnce(f,2);
  await resetActor(db);
  assert.equal(await value(db,'SELECT last_safe_error_code FROM public.image_extraction_jobs WHERE id=$1',[f.f.jobId]),
    'P9_METADATA_TECHNICAL_FAILURE');
  assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.f.jobId]),2);
});
test('terminal run: claim five exhaustion keeps the exhaustion safe code',async()=>{
  const f=await beginAutomatic(db,{claim:5}),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  failureResult(f.command);await singleReceipt(db,f);
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'finalized');
  assert.equal((await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command])).status,'completed');
  await resetActor(db);
  assert.equal(await value(db,'SELECT last_safe_error_code FROM public.image_extraction_jobs WHERE id=$1',[f.f.jobId]),
    'P9_METADATA_ATTEMPTS_EXHAUSTED');
});
test('terminal run: breaker closes on the allowed claim and the first physical failure completes truthfully',async()=>{
  const f=await initiallyOpenBreaker(),full=f.command.fence,b=[f.f.jobId,worker,full.leaseToken,2];
  const l=await rpc(db,'phase9_register_structural_metadata_lookup',[...b,f.f.candidateId,full.candidateVersion,
    full.queryIdentity,'breaker:'+f.f.jobId,'google_books','1.0.0','cap-v1','p9-metadata-foundation-v1','isbn',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private','1','p9-metadata-cache-v1','metadata-v1',null]);
  const u=await rpc(db,'phase9_reserve_metadata_usage',[...b,l.lookup_id,'google_books','1.0.0',1]);
  const a=await rpc(db,'phase9_register_structural_metadata_attempt',[l.lookup_id,...b,f.f.candidateId,full.candidateVersion,
    randomUUID(),'breaker:'+f.f.jobId,'primary',1,'google_books','1.0.0','cap-v1','p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',u.reservation_id]);
  f.command.lookupId=l.lookup_id;f.command.attemptId=a.attempt_id;f.command.source='external';
  f.command.result.outcome.outcome='timeout';f.command.result.outcome.providerRequestId='review-request';
  const call=await rpc(db,'phase9_register_metadata_provider_call',[a.attempt_id,...b,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,...b,'finalized','timeout','timeout','review-request',true,null,[]]);
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[full,'google_books','1.0.0']);
  await completedOnce(f,1);
});
