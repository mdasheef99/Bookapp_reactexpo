// 02c §§3.1/4.3/8/9; OD-2026-11-01-1: explicit and third-provider round holds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,resetActor,setActor,value,synthetic} from './providerReplacementFixture.mjs';
import {beginAutomatic,installSingleProvider} from './providerAutomaticReviewFixture.mjs';
import {rpc,seedOperation,prepareCall,finalize,token,worker} from './editionOptionsCompletionFixture.mjs';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
let db;
before(async()=>{db=await createProviderDatabase({selection:'8a-5'});});
beforeEach(async()=>{
  await clean(db);await resetActor(db);
  await db.exec('UPDATE public.phase9_provider_registry SET explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL');
  await db.query(`UPDATE public.phase9_provider_registry SET protection_policy=$1,explicit_search_allowed=true,
    explicit_role='primary',explicit_order=1 WHERE adapter_key='google_books'`,[policy]);
});
after(async()=>{await db?.close();});
const fence=f=>({jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,
  storeId:f.storeId,sessionId:f.sessionId,requestId:f.jobId,requestGeneration:f.context.requestGeneration,queryIdentity:f.context.queryIdentity});
test('explicit round: reserve, grant, exact grant replay and release use one capacity unit',async()=>{
  const f=await seedOperation(db),args=[fence(f),'google_books','1.0.0'];
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',args)).status,'reserved');
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',args)).slots,1);
  await prepareCall(db,f);await resetActor(db);
  const id=await value(db,'SELECT physical_call_identity FROM public.phase9_metadata_provider_calls WHERE id=$1',[f.callId]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,f.jobId,worker,token,1,id])).provider_call_id,f.callId);
  await finalize(db,f,'timeout',true);
  assert.equal((await rpc(db,'phase9_release_metadata_provider_round_v1',args)).status,'released');
  assert.equal((await rpc(db,'phase9_release_metadata_provider_round_v1',args)).status,'released');
  await resetActor(db);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]),1);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.jobId]),0);
});
test('explicit round: forged store or stale request cannot reserve or release another scope',async()=>{
  const f=await seedOperation(db),full=fence(f);
  await assert.rejects(rpc(db,'phase9_reserve_metadata_provider_round_v1',[
    {...full,storeId:randomUUID()},'google_books','1.0.0']),/P9_STATE_CONFLICT/);
  await rpc(db,'phase9_reserve_metadata_provider_round_v1',[full,'google_books','1.0.0']);
  await resetActor(db);await db.query('UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1 WHERE candidate_id=$1',[f.candidateId]);
  await setActor(db,'','service_role');
  await assert.rejects(rpc(db,'phase9_release_metadata_provider_round_v1',[full,'google_books','1.0.0']),/P9_STATE_CONFLICT/);
});
test('explicit round: paused zero-child reservation releases capacity without consuming a claim',async()=>{
  const f=await seedOperation(db),full=fence(f);
  await rpc(db,'phase9_reserve_metadata_provider_round_v1',[full,'google_books','1.0.0']);
  await resetActor(db);await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=7");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_defer_metadata_admission_v1',[full,7])).status,'deferred');
  await resetActor(db);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.jobId]),0);
  assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),0);
});
async function installFanout() {
  await installSingleProvider(db);await resetActor(db);
  await db.exec(fs.readFileSync(new URL('./fixtures/provider-replacement-synthetic-install.sql',import.meta.url),'utf8'));
  await db.exec('UPDATE public.phase9_provider_registry SET explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL');
  await db.query(`UPDATE public.phase9_provider_registry SET explicit_search_allowed=true,explicit_role='primary',
    explicit_order=1,protection_policy=$1 WHERE adapter_key=$2`,[policy,synthetic.adapterKey]);
}
async function explicitLineage(f) {
  const base=[f.jobId,worker,token,1],key='round:'+f.jobId;
  const l=await rpc(db,'phase9_register_structural_metadata_lookup',[...base,f.candidateId,f.context.candidateVersion,
    f.context.queryIdentity,key,synthetic.adapterKey,synthetic.adapterVersion,synthetic.capabilityVersion,
    synthetic.lookupSchemaVersion,'bibliographic','p9-metadata-lookup-v1',synthetic.normalizerVersion,
    'p9-metadata-routing-v1','store_private','1','p9-metadata-cache-v1','metadata-v1',null]);
  const u=await rpc(db,'phase9_reserve_metadata_usage',[...base,l.lookup_id,synthetic.adapterKey,synthetic.adapterVersion,1]);
  const a=await rpc(db,'phase9_register_structural_metadata_attempt',[l.lookup_id,...base,f.candidateId,f.context.candidateVersion,
    randomUUID(),key,'primary',1,synthetic.adapterKey,synthetic.adapterVersion,synthetic.capabilityVersion,
    synthetic.lookupSchemaVersion,synthetic.normalizerVersion,'p9-metadata-routing-v1','local_insufficient',u.reservation_id]);
  f.attemptId=a.attempt_id;
}
for(const explicit of [false,true])test(`third-provider round: own discover/edition/person stages pass actual v2 admission, explicit=${explicit}`,async()=>{
  await installFanout();let f,full;
  if(explicit) {
    f=await seedOperation(db);full=fence(f);
    assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',[full,synthetic.adapterKey,synthetic.adapterVersion])).status,'reserved');
    await explicitLineage(f);
  } else {
    const a=await beginAutomatic(db,{key:synthetic.adapterKey,version:synthetic.adapterVersion});
    f=a.f;full=a.command.fence;
    assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[full,synthetic.adapterKey,synthetic.adapterVersion])).status,'started');
  }
  for(const [sequence,stage] of synthetic.stages.entries()) {
    const c=await rpc(db,'phase9_register_edition_options_provider_call_v1',[f.attemptId,f.jobId,worker,token,1,randomUUID(),sequence,stage]);
    await rpc(db,'phase9_finalize_edition_options_provider_call_v1',[c.provider_call_id,f.jobId,worker,token,1,'finalized','no_acceptable_match',false,true]);
  }
  const finish=explicit?'phase9_release_metadata_provider_round_v1':'phase9_finish_automatic_provider_run_v1';
  await rpc(db,finish,[full,synthetic.adapterKey,synthetic.adapterVersion]);await resetActor(db);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]),3);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.jobId]),0);
});
test('explicit round: an unknown call from an earlier claim blocks a reclaimed reservation',async()=>{
  const f=await seedOperation(db),full=fence(f);
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',[full,'google_books','1.0.0'])).status,'reserved');
  await prepareCall(db,f);
  await resetActor(db);await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await setActor(db,'','service_role');
  const claim=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  assert.equal(claim.attempt_count,2);
  await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,claim.lease_token,2]);
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',
    [{...full,claimAttempt:2,leaseToken:claim.lease_token},'google_books','1.0.0'])).status,'recovery_only');
});
test('explicit round: only finalized calls from an earlier claim still reserve',async()=>{
  const f=await seedOperation(db),full=fence(f);
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',[full,'google_books','1.0.0'])).status,'reserved');
  await prepareCall(db,f);await finalize(db,f,'timeout',true);
  await resetActor(db);await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await setActor(db,'','service_role');
  const claim=(await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows[0];
  await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,claim.lease_token,2]);
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',
    [{...full,claimAttempt:2,leaseToken:claim.lease_token},'google_books','1.0.0'])).status,'reserved');
});
test('explicit round: a same-claim in-flight call re-reserves recovery_only and keeps its hold',async()=>{
  await installFanout();
  const f=await seedOperation(db),full=fence(f),args=[full,synthetic.adapterKey,synthetic.adapterVersion];
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',args)).status,'reserved');
  await explicitLineage(f);
  const first=await rpc(db,'phase9_register_edition_options_provider_call_v1',
    [f.attemptId,f.jobId,worker,token,1,randomUUID(),0,synthetic.stages[0]]);
  assert.equal((await rpc(db,'phase9_reserve_metadata_provider_round_v1',args)).status,'recovery_only');
  await resetActor(db);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',
    [f.jobId]),5);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',
    [f.storeId]),1);
  assert.equal(await value(db,'SELECT status FROM public.phase9_metadata_provider_calls WHERE id=$1',
    [first.provider_call_id]),'registered');
  // The untouched hold grants the rest of the same round.
  await setActor(db,'','service_role');
  await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
    [first.provider_call_id,f.jobId,worker,token,1,'finalized','no_acceptable_match',false,true]);
  const second=await rpc(db,'phase9_register_edition_options_provider_call_v1',
    [f.attemptId,f.jobId,worker,token,1,randomUUID(),1,synthetic.stages[1]]);
  await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
    [second.provider_call_id,f.jobId,worker,token,1,'finalized','no_acceptable_match',false,true]);
  await resetActor(db);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',
    [f.jobId]),4);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',
    [f.storeId]),2);
});
test('round entries: API clients have neither execution nor private admission access',async()=>{
  await resetActor(db);
  for(const name of ['phase9_reserve_metadata_provider_round_v1','phase9_release_metadata_provider_round_v1',
    'phase9_schedule_automatic_provider_recheck_v1'])
    for(const schema of ['public','marketplace_sec'])
      for(const role of ['anon','authenticated'])
        assert.equal(await value(db,"SELECT has_function_privilege($1,$2,'EXECUTE')",[role,`${schema}.${name}(jsonb,text,text)`]),false);
  for(const role of ['anon','authenticated','service_role'])
    assert.equal(await value(db,"SELECT has_table_privilege($1,'marketplace_sec.phase9_metadata_admissions','SELECT')",[role]),false);
});
