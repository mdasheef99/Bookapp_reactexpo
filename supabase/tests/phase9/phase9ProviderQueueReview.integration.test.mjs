// Original 02c §§4.3/5.4/8/9 and 02c-1 §2: review regressions, no provider HTTP.
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {clean,createProviderDatabase,nativeConnection,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {beginAutomatic,failureResult,singleReceipt} from './providerAutomaticReviewFixture.mjs';
import {seedCard,seedAutomaticLineage,claimJob} from './editionPickerFixture.mjs';
import {rpc,token,worker} from './editionOptionsCompletionFixture.mjs';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1000,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
let db;
before(async()=>{db=await createProviderDatabase({selection:'8a-5'});});
beforeEach(async()=>{
  await clean(db);await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[policy]);
});
after(async()=>{await db?.close();});
async function pending() {
  const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  return {...f,jobId};
}
async function noChildrenFence() {
  const f=await pending();await value(db,await claimJob(db,f,f.jobId));
  const c=await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,1]);
  return {jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,storeId:f.storeId,
    sessionId:f.sessionId,candidateVersion:c.candidateVersion,queryIdentity:c.queryIdentity,
    capturedRequestId:null,requestGeneration:0};
}
async function safeFailure(outcome='timeout') {
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  failureResult(f.command);f.command.result.outcome.outcome=outcome;await singleReceipt(db,f);
  return {f,args};
}
test('review: fresh-store concurrent claims skip rather than blocking on admission creation',
  {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT},async()=>{
  await pending();await pending();await resetActor(db);
  const holder=await nativeConnection(db.database);
  try {
    await holder.query('BEGIN');
    await holder.query("SET LOCAL ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',true)");
    const first=(await holder.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
    await setActor(db,'','service_role');await db.exec("SET statement_timeout='800ms'");
    const second=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows;
    assert.equal(second.length,1);assert.notEqual(second[0].id,first.id);
  } finally {await holder.query('ROLLBACK');await holder.end();await db.exec("SET statement_timeout='5s'");}
});
for(const change of [{requestGeneration:1},{capturedRequestId:randomUUID()}])
  test(`review: released-lease retry receipt rejects altered ${Object.keys(change)[0]}`,async()=>{
    const {args}=await safeFailure();await rpc(db,'phase9_finish_automatic_provider_run_v1',args);
    await assert.rejects(rpc(db,'phase9_finish_automatic_provider_run_v1',[
      {...args[0],...change},...args.slice(1)]),/P9_STATE_CONFLICT|P9_IDEMPOTENCY_MISMATCH/);
  });
test('review: disabling the provider before finish grants no retry allowance',async()=>{
  const {args}=await safeFailure();await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='google_books'");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',args)).status,'finalized');
  await resetActor(db);
  assert.equal(await value(db,'SELECT retry_allowed FROM marketplace_sec.phase9_automatic_provider_runs'),false);
});
test('review: safe Retry-After lower bound survives durable retry scheduling and replay',async()=>{
  const {args,f}=await safeFailure('rate_limited'),floor=new Date(Date.now()+60000).toISOString();
  // Baseline cannot receive the header floor at all; use its actual scheduler
  // to reproduce the early due time before adding the compatible overload.
  await resetActor(db);
  const installed=await value(db,"SELECT to_regprocedure('public.phase9_finish_automatic_provider_run_v1(jsonb,text,text,timestamptz)') IS NOT NULL");
  await setActor(db,'','service_role');
  await rpc(db,'phase9_finish_automatic_provider_run_v1',installed?[...args,floor]:args);
  await resetActor(db);
  const due=await value(db,'SELECT next_attempt_at FROM public.image_extraction_jobs WHERE id=$1',[f.f.jobId]);
  assert.ok(new Date(due).getTime()>=Date.parse(floor),'persisted due cannot precede safe Retry-After');
  assert.equal(installed,true,'the typed not-before scheduler boundary is required');
});
test('review: breaker-open before any egress persists one cooldown recheck without a fake call',async()=>{
  const fence=await noChildrenFence(),args=[fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  await resetActor(db);
  const installed=await value(db,"SELECT to_regprocedure('public.phase9_schedule_automatic_provider_recheck_v1(jsonb,text,text)') IS NOT NULL");
  await setActor(db,'','service_role');
  const result=await rpc(db,installed?'phase9_schedule_automatic_provider_recheck_v1':'phase9_finish_automatic_provider_run_v1',args);
  assert.equal(result.status,'retry_scheduled','a known unsent breaker case is not an unknown physical call');
  assert.equal(installed,true,'the durable no-egress transition is required');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),0);
});
test('review: pause after begin releases an ungranted round and reopens without spending a retry',async()=>{
  const f=await noChildrenFence();await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'google_books','1.0.0']);
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=8");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[f,8])).status,'deferred');
  assert.deepEqual((await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows,[]);
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='open',epoch=9");
  await setActor(db,'','service_role');
  const c=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.equal(c.attempt_count,1);
  const next={...f,leaseToken:c.lease_token};
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[next,'google_books','1.0.0'])).round,0);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),0);
});
test('review: NULL-policy begin writes no v2 marker and keeps legacy registration working',async()=>{
  const f=await beginAutomatic(db);
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f.command.fence,'google_books','1.0.0'])).status,
    'configuration_required');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',
    [f.f.jobId]),0,'a refused begin must not create a v2 claim marker');
  await setActor(db,'','service_role');
  const call=await rpc(db,'phase9_register_metadata_provider_call',
    [f.f.attemptId,f.f.jobId,worker,token,1,randomUUID()]);
  assert.ok(call.provider_call_id,'legacy registration still bypasses the marker path');
});
test('review: a reclaimed zero-obligation queued round defers neutrally before begin',async()=>{
  const f=await noChildrenFence();
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'google_books','1.0.0'])).status,'started');
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=8");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[f,8])).status,'deferred');
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='open',epoch=9");
  await setActor(db,'','service_role');
  const first=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.equal(first.attempt_count,1);
  const next={...f,leaseToken:first.lease_token};
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=10");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[next,10])).status,'deferred',
    'a lease change on a queued zero-obligation round is not a drain');
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='open',epoch=11");
  await setActor(db,'','service_role');
  const second=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',
    [{...f,leaseToken:second.lease_token},'google_books','1.0.0'])).round,0);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),0);
});
test('review: v2 reclaim cannot grant another call while an earlier send is unknown',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  await rpc(db,'phase9_register_metadata_provider_call',[f.f.attemptId,f.f.jobId,worker,token,1,randomUUID()]);
  await resetActor(db);await db.exec("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE job_kind='metadata_enrich'");
  await setActor(db,'','service_role');
  const next=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,worker,next.lease_token,2]);
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',[
    f.f.attemptId,f.f.jobId,worker,next.lease_token,2,randomUUID()]),/P9_PROVIDER_RUN_NOT_ADMITTED|P9_STATE_CONFLICT/);
});
test('review: nullable legacy automatic operation_version retains v2 admission compatibility',async()=>{
  const f=await noChildrenFence();await resetActor(db);
  await db.query('UPDATE public.image_extraction_jobs SET operation_version=NULL WHERE id=$1',[f.jobId]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'google_books','1.0.0'])).status,'started');
});
test('review: removing protection after begin denies the next new v2 grant',async()=>{
  const f=await beginAutomatic(db),args=[f.command.fence,'google_books','1.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  await resetActor(db);await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  await setActor(db,'','service_role');
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',[
    f.f.attemptId,f.f.jobId,worker,token,1,randomUUID()]),/P9_PROVIDER_CONFIGURATION_INVALID|P9_PROVIDER_RUN_NOT_ADMITTED/);
});
test('review: a superseding request generation fences a new physical grant',async()=>{
  const f=await beginAutomatic(db),fence=f.command.fence;
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0']);
  await resetActor(db);
  await db.query(`INSERT INTO public.phase9_candidate_edition_state
    (candidate_id,session_id,store_id,query_identity,request_generation) VALUES($1,$2,$3,$4,1)
    ON CONFLICT(candidate_id) DO UPDATE SET request_generation=1`,
  [f.f.candidateId,f.f.sessionId,f.f.storeId,fence.queryIdentity]);
  await setActor(db,'','service_role');
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',[
    f.f.attemptId,f.f.jobId,worker,token,1,randomUUID()]),/P9_STATE_CONFLICT|P9_PROVIDER_RUN_NOT_ADMITTED/);
});
test('review: the allowed second failure completes and consumes accounting once',async()=>{
  const {f,args}=await safeFailure();await rpc(db,'phase9_finish_automatic_provider_run_v1',args);
  await resetActor(db);await db.exec("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await setActor(db,'','service_role');
  const next=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  await rpc(db,'phase9_metadata_job_context',[f.f.jobId,worker,next.lease_token,2]);
  const fence={...f.command.fence,claimAttempt:2,leaseToken:next.lease_token};
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[fence,'google_books','1.0.0']);
  const call=await rpc(db,'phase9_register_metadata_provider_call',[
    f.f.attemptId,f.f.jobId,worker,next.lease_token,2,randomUUID()]);
  await rpc(db,'phase9_finalize_metadata_provider_call',[call.provider_call_id,f.f.jobId,worker,next.lease_token,2,
    'finalized','timeout','timeout','review-request',true,null,[]]);
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[fence,'google_books','1.0.0']);
  const result=await rpc(db,'phase9_complete_automatic_metadata_v1',[{...f.command,fence}]);
  assert.equal(result.status,'completed');
  const replay=await rpc(db,'phase9_recover_automatic_metadata_v1',[fence]);
  assert.equal(replay.status,'replayed');assert.equal(replay.snapshotId,result.snapshotId);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.f.jobId]),2);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_usage_reservations WHERE job_id=$1 AND status=\'consumed\'',[f.f.jobId]),1);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_completion_effects WHERE job_id=$1',[f.f.jobId]),1);
});
