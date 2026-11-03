// 02c §§4.3/5.1/9: admission/election sequencing through real disposable SQL.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after,before,beforeEach,test} from 'node:test';
import {automaticGoogleCommand,clean,createProviderDatabase,denied,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {selectedPrefix} from './providerDatabaseHarness.mjs';
import {beginAutomatic,receivingCard} from './providerAutomaticReviewFixture.mjs';
import {claimJob,seedAutomaticLineage,seedCard} from './editionPickerFixture.mjs';
import {rpc,token,worker} from './editionOptionsCompletionFixture.mjs';
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
async function fresh(card=null,cacheKey='u5-shared-key') {
  const f=card??await seedCard(db),{jobId}=await seedAutomaticLineage(db,f,'accepted',card?'b'.repeat(64):'a'.repeat(64));
  const context=await value(db,await claimJob(db,f,jobId));
  const state=await rpc(db,'phase9_automatic_edition_fence_v1',[jobId,worker,token,1]);
  await resetActor(db);
  const contract=await value(db,"SELECT marketplace_sec.phase9_provider_validation_contract_v1('google_books','1.0.0')");
  await setActor(db,'','service_role');
  return {...f,jobId,context,fence:{jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,
    storeId:f.storeId,sessionId:f.sessionId,candidateVersion:state.candidateVersion,queryIdentity:context.queryIdentity,
    capturedRequestId:state.capturedRequestId,requestGeneration:state.requestGeneration},
  spec:{provider_cache_identity:cacheKey,adapter_key:'google_books',adapter_version:'1.0.0',
    capability_version:contract.capabilityVersion,schema_version:contract.lookupSchemaVersion,lookup_strategy:'isbn',
    lookup_contract_version:'p9-metadata-lookup-v1',normalizer_version:contract.normalizerVersion,
    routing_policy_version:'p9-metadata-routing-v1',privacy_scope:'store_private',reuse_policy_version:'1',
    cache_policy_version:'p9-metadata-cache-v1',cache_namespace:'metadata-v1'}};
}
async function prepare(f,recheck=false,spec=f.spec) {
  await setActor(db,'','service_role');
  return rpc(db,'phase9_prepare_automatic_metadata_v1',[f.fence,spec,recheck]);
}
const lookupArgs=(f,leader=null)=>[f.jobId,worker,f.fence.leaseToken,f.fence.claimAttempt,f.candidateId,
  f.fence.candidateVersion,f.context.queryIdentity,f.spec.provider_cache_identity,f.spec.adapter_key,
  f.spec.adapter_version,f.spec.capability_version,f.spec.schema_version,f.spec.lookup_strategy,
  f.spec.lookup_contract_version,f.spec.normalizer_version,f.spec.routing_policy_version,f.spec.privacy_scope,
  f.spec.reuse_policy_version,f.spec.cache_policy_version,f.spec.cache_namespace,leader];
async function count(table,jobId) {
  await resetActor(db);
  return value(db,'SELECT count(*)::int FROM '+table+' WHERE job_id=$1',[jobId]);
}
async function noExternalChildren(f) {
  for(const table of ['phase9_metadata_lookups','phase9_usage_reservations','phase9_metadata_provider_calls'])
    assert.equal(await count('public.'+table,f.jobId),0,table);
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),0);
}
async function cap(f,used) {
  await resetActor(db);
  await db.query('UPDATE marketplace_sec.phase9_store_admission SET gets_used=$1 WHERE store_id=$2',[used,f.storeId]);
}
async function reclaim(f) {
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second',"+
    "next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await setActor(db,'','service_role');
  const [claim]=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[worker])).rows;
  assert.equal(claim.id,f.jobId);assert.equal(claim.attempt_count,2);
  f.fence={...f.fence,leaseToken:claim.lease_token,claimAttempt:2};return claim;
}

// Catches election inserting lineage before admission or charging a hold as a GET.
test('I-leader: fresh leader reserves capacity before its only lookup and spends no GET',async()=>{
  const f=await fresh(),r=await prepare(f);
  assert.deepEqual(r.admission,{status:'started',round:0});assert.equal(r.coalescing.mode,'leader');
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
  assert.equal(await count('public.phase9_usage_reservations',f.jobId),0);
  assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
  assert.equal(await value(db,'SELECT slots_remaining::int FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.jobId]),1);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]),0);
});
// Catches the old leader-first drain_required path and consuming a technical claim for capacity.
test('I-capacity: exhausted fresh store waits durably with no external children',async()=>{
  const f=await fresh();await cap(f,20);const r=await prepare(f);
  assert.equal(r.admission.status,'capacity_wait');assert.equal(r.coalescing,null);assert.ok(r.admission.dueAt);
  await noExternalChildren(f);
  assert.equal(await value(db,'SELECT status FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),'retry_scheduled');
  assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),0);
  assert.equal(await value(db,'SELECT lease_token_hash FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),null);
});
// Catches beginning a pending follower and stranding that run when legacy deferral clears the lease.
test('I-pending: capped pending follower defers and reclaims without ever beginning a run',async()=>{
  const leader=await fresh(),first=await prepare(leader),f=await fresh(await receivingCard(db,leader));
  await cap(f,19);
  assert.deepEqual(await prepare(f),{admission:null,coalescing:{mode:'follower_pending',leaderLookupId:first.coalescing.lookupId}});
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_fail_metadata_job',[f.jobId,worker,token,1,f.candidateId,
    f.fence.candidateVersion,f.context.queryIdentity,'provider_unavailable',true])).status,'retry_scheduled');
  await reclaim(f);
  assert.deepEqual(await prepare(f),{admission:null,coalescing:{mode:'follower_pending',leaderLookupId:first.coalescing.lookupId}});
  await noExternalChildren(f);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_coalescing_waiters WHERE job_id=$1',[f.jobId]),1);
});
// Catches gating a zero-egress completed follower on full external capacity or creating its run.
test('I-completed: capped completed follower reuses through the existing registration RPC',async()=>{
  await resetActor(db);await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  const source=await automaticGoogleCommand(db);
  assert.equal((await rpc(db,'phase9_complete_automatic_metadata_v1',[source.command])).status,'completed');
  await resetActor(db);
  const cacheKey=await value(db,'SELECT provider_cache_identity FROM public.phase9_metadata_lookups WHERE id=$1',[source.f.lookupId]);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[policy]);
  const f=await fresh(await receivingCard(db,source.f),cacheKey);await cap(f,20);
  assert.deepEqual(await prepare(f),{admission:null,coalescing:{mode:'follower',leaderLookupId:source.f.lookupId}});
  await setActor(db,'','service_role');
  await rpc(db,'phase9_register_structural_metadata_lookup',lookupArgs(f,source.f.lookupId));
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),0);
  assert.equal(await count('public.phase9_usage_reservations',f.jobId),0);
  assert.equal(await value(db,'SELECT leader_lookup_id FROM public.phase9_metadata_lookups WHERE job_id=$1',[f.jobId]),source.f.lookupId);
});
// Catches reusing a store-private leader for an unrelated store with the same query and cache key.
test('I-privacy: another store gets its own admitted leader',async()=>{
  const a=await fresh(),left=await prepare(a),b=await fresh(),right=await prepare(b);
  assert.notEqual(a.storeId,b.storeId);assert.equal(right.coalescing.mode,'leader');
  assert.notEqual(right.coalescing.lookupId,left.coalescing.lookupId);
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',b.jobId),1);
});
// Catches rerouting an already begun run into a follower after losing its preparation response.
test('I-replay: existing run is checked before a newly appearing foreign leader',async()=>{
  const f=await fresh();assert.deepEqual(await prepare(f,true),{admission:{status:'started',round:0},coalescing:null});
  const other=await fresh(await receivingCard(db,f));assert.equal((await prepare(other)).coalescing.mode,'leader');
  assert.deepEqual(await prepare(f),{admission:{status:'replayed',round:0,runStatus:'running'},coalescing:null});
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),0);
  assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
});
for(const status of ['running','unknown']) {
  // Catches granting a new round from a replacement lease without a persisted safe retry allowance.
  test('I-continuation: reclaimed '+status+' run cannot create new lineage or calls',async()=>{
    const f=await fresh();await prepare(f);await resetActor(db);
    await db.query('UPDATE marketplace_sec.phase9_automatic_provider_runs SET status=$1 WHERE job_id=$2',[status,f.jobId]);
    await reclaim(f);
    assert.deepEqual(await prepare(f),{admission:{status:'recovery_only'},coalescing:null});
    assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
    assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
  });
}
// Catches inventing configuration or inserting a lookup when M93 refuses NULL operating policy.
test('I-configuration: NULL policy is returned as configuration_required without children',async()=>{
  const f=await fresh();await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  assert.deepEqual(await prepare(f),{admission:{status:'configuration_required'},coalescing:null});await noExternalChildren(f);
});
// Catches treating pre-existing unbound legacy lineage as a fresh election/admission.
test('I-orphan: unbound existing lineage is recovery_only',async()=>{
  const prior=await beginAutomatic(db),f={...prior.f,fence:prior.command.fence,spec:(await fresh()).spec};
  assert.deepEqual(await prepare(f),{admission:{status:'recovery_only'},coalescing:null});
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),0);
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
});
// Catches creating a lookup before the known-unsent breaker recheck and electing a retry follower.
test('I-recheck: no-egress retry continues admission then first creates lineage after started',async()=>{
  const f=await fresh();assert.deepEqual(await prepare(f,true),{admission:{status:'started',round:0},coalescing:null});
  assert.equal((await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',[f.fence,'google_books','1.0.0'])).status,'retry_scheduled');
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),0);
  await reclaim(f);
  assert.deepEqual(await prepare(f),{admission:{status:'started',round:1},coalescing:null});
  await setActor(db,'','service_role');
  const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',lookupArgs(f));
  assert.match(lookup.lookup_id,/^[0-9a-f-]{36}$/);
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
  assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
});
// Catches scheduling another unsent retry instead of allowing only the original recheck allowance.
test('I-recheck-terminal: still-open second claim completes with no invented provider lineage',async()=>{
  const f=await fresh();await prepare(f,true);
  assert.equal((await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',[f.fence,'google_books','1.0.0'])).status,'retry_scheduled');
  await reclaim(f);
  assert.deepEqual(await prepare(f,true),{admission:{status:'started',round:1},coalescing:null});
  assert.equal((await rpc(db,'phase9_schedule_automatic_provider_recheck_v1',[f.fence,'google_books','1.0.0'])).status,'finalized');
  const command={fence:f.fence,lookupId:randomUUID(),attemptId:null,source:'local',selectedOptionId:null,
    result:{version:'p9-metadata-result-v2',purpose:'automatic',outcome:{outcome:'circuit_breaker_open',
      candidates:[],selected:null,evidence:[],retryable:true,secondaryEligible:true,providerRequestId:null,
      representativeCover:null},rows:null,catalogueCompanions:null,retention:null}};
  const result=await rpc(db,'phase9_complete_automatic_metadata_v1',[command]);
  assert.equal(result.status,'completed');assert.equal(result.outcome,'technical_failure');
  for(const table of ['phase9_usage_reservations','phase9_metadata_provider_calls'])
    assert.equal(await count('public.'+table,f.jobId),0,table);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.metadata_enrichment_attempts'),0);
  assert.equal(await value(db,"SELECT retry_allowed FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=$1 AND round=1::smallint",[f.jobId]),false);
});
// Catches treating an open external gate refusal as legacy permission or leaving partial admission.
test('I-paused: paused gate rolls back the whole attempted leader preparation',async()=>{
  const f=await fresh();await resetActor(db);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=9");
  await assert.rejects(prepare(f),/P9_EXTERNAL_ADMISSION_PAUSED/);await noExternalChildren(f);
});
for(const [name,mutate,recheck]of [
  ['unknown key',spec=>({...spec,tenant_id:'forged'}),false],
  ['missing key',spec=>{const copy={...spec};delete copy.adapter_key;return copy;},false],
  ['wrong type',spec=>({...spec,reuse_policy_version:1}),false],
  ['null recheck',spec=>spec,null],
]) {
  // Catches accepting an unversioned lookup spec or an ambiguous preparation mode.
  test('I-input: rejects '+name+' with no partial run or lookup',async()=>{
    const f=await fresh();await assert.rejects(prepare(f,recheck,mutate(f.spec)),/P9_REQUEST_INVALID/);await noExternalChildren(f);
  });
}
for(const [name,change]of [['generation',{requestGeneration:1}],['tenant',{storeId:randomUUID()}]]) {
  // Catches trusting supplied scope instead of M93's server-derived admission fence.
  test('I-scope: rejects altered '+name,async()=>{
    const f=await fresh();f.fence={...f.fence,...change};await assert.rejects(prepare(f),/P9_STATE_CONFLICT/);await noExternalChildren(f);
  });
}
// Catches replacing the NULL-policy legacy coalescing entry or changing its leader result.
test('I-legacy: original NULL-policy coalescing remains callable without a run',async()=>{
  const f=await fresh();await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy=NULL WHERE adapter_key='google_books'");
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_metadata_coalescing_context',lookupArgs(f))).mode,'leader');
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),0);
});
for(const schema of ['public','marketplace_sec'])for(const role of ['anon','authenticated']) {
  // Catches exposing admission/election to a client role through either schema.
  test('ACL: '+role+' cannot execute '+schema+' preparation',async()=>{
    await denied(db,role,'SELECT '+schema+".phase9_prepare_automatic_metadata_v1('{}'::jsonb,'{}'::jsonb,false)");
  });
}
// Catches wrong effective security modes, owners, search paths or default PUBLIC execution.
test('ACL-flags: all four actual functions have the planned authority boundary',async()=>{
  await resetActor(db);
  for(const [name,args]of [['phase9_automatic_edition_fence_v1','uuid,text,text,integer'],
    ['phase9_prepare_automatic_metadata_v1','jsonb,jsonb,boolean']])for(const schema of ['public','marketplace_sec']) {
    const signature=schema+'.'+name+'('+args+')';
    const row=(await db.query('SELECT pg_get_userbyid(proowner) AS owner,prosecdef,proconfig '+
      'FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0];
    assert.equal(row.owner,'postgres');assert.equal(row.prosecdef,schema==='marketplace_sec');
    assert.ok(row.proconfig.includes('search_path=""'));
    assert.equal(await value(db,"SELECT has_function_privilege('service_role',$1,'EXECUTE')",[signature]),true);
    assert.equal(await value(db,"SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL "+
      "aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0)",[signature]),false);
  }
});

// Mutation caught: a capacity-wait admission marker rejects the next valid claim instead of refreshing its lease hash.
test('T1-capacity-reclaim: freed capacity admits a newly claimed job with its stale marker',async()=>{
  const f=await fresh();await cap(f,20);
  const waiting=await prepare(f);
  assert.equal(waiting.admission.status,'capacity_wait');assert.equal(waiting.coalescing,null);
  await resetActor(db);
  const oldHash=await value(db,'SELECT claim_lease_token_hash FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.jobId]);
  await cap(f,0);
  await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await setActor(db,'','service_role');
  const [claim]=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[worker])).rows;
  assert.equal(claim.id,f.jobId);assert.equal(claim.attempt_count,1);assert.notEqual(claim.lease_token,token);
  f.fence={...f.fence,leaseToken:claim.lease_token,claimAttempt:claim.attempt_count};
  const result=await prepare(f);
  assert.deepEqual(result.admission,{status:'started',round:0});assert.equal(result.coalescing.mode,'leader');
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),1);
  assert.equal(await count('public.phase9_usage_reservations',f.jobId),0);
  assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
  const newHash=await value(db,'SELECT claim_lease_token_hash FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.jobId]);
  assert.notEqual(newHash,oldHash);
  assert.equal(newHash,await value(db,'SELECT lease_token_hash FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]));
});

// Mutation caught: replaying a committed normal preparation creates another lookup, run, reservation or physical call.
test('T3-lost-response: normal preparation replays with the context lookup unchanged',async()=>{
  const f=await fresh(),first=await prepare(f,false);
  assert.deepEqual(first.admission,{status:'started',round:0});assert.equal(first.coalescing.mode,'leader');
  const context=await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,1]);
  assert.equal(context.currentLookupId,first.coalescing.lookupId);
  assert.deepEqual(await prepare(f,false),{admission:{status:'replayed',round:0,runStatus:'running'},coalescing:null});
  const replayContext=await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,1]);
  assert.equal(replayContext.currentLookupId,context.currentLookupId);
  assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
  assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),1);
  assert.equal(await count('public.phase9_usage_reservations',f.jobId),0);
  assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
});
