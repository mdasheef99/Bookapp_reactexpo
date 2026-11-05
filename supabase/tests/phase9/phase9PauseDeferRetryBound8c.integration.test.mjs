// 02c §§4.3/7/9; 02c-1 §2; Unit C K1-K7/P1-P4. Disposable SQL only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {before,after,beforeEach,test} from 'node:test';
import {database,clean,resetActor,value,row,sweep,run,footprint,nativeConnection} from './finalAttemptSweep8cFixture.mjs';
import {migrationPath} from './databaseHarness.mjs';
import {seedCard,seedAutomaticLineage,claimJob} from './editionPickerFixture.mjs';
import {rpc,worker,token} from './editionOptionsCompletionFixture.mjs';
import {setActor,automaticGoogleCommand} from './providerReplacementFixture.mjs';
import {beginAutomatic,failureResult,singleReceipt} from './providerAutomaticReviewFixture.mjs';
const M98='20261105000098_marketplace_phase9_8c_pause_defer_and_retry_bound.sql';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
 backoffBaseMs:1,backoffMaxMs:10000,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1,
 halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
const scripts=['02-capture-drain-check','03-switch-while-paused','05-resume','06-rollback'];
let db,beforeDefs,afterDefs;
async function definitions() {
 await resetActor(db);
 return (await db.query(`SELECT n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' signature,
  pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl::text acl,pg_get_functiondef(p.oid) body,
  NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE a.grantee=0 AND a.privilege_type='EXECUTE') no_public,
  has_function_privilege('anon',p.oid,'EXECUTE') anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,
  has_function_privilege('service_role',p.oid,'EXECUTE') service
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','marketplace_sec')
  AND p.proname IN('claim_phase9_metadata_jobs','phase9_defer_metadata_admission_v1',
   'phase9_defer_paused_metadata_admission_v1','phase9_finish_automatic_provider_run_v1') ORDER BY 1`)).rows;
}
before(async()=>{
 db=await database();
 await db.exec(fs.readFileSync(migrationPath('20261105000097_marketplace_phase9_8c_sweep_recovery.sql'),'utf8'));
 beforeDefs=await definitions();
 // Baseline run intentionally still exercises R2/R3/K1 if the new file does not exist.
 if(fs.existsSync(migrationPath(M98)))await db.exec(fs.readFileSync(migrationPath(M98),'utf8'));
 afterDefs=await definitions();
});
beforeEach(async()=>{await clean(db);});after(async()=>{await db?.close();});
async function service(){await setActor(db,'','service_role');}
async function gate(){await resetActor(db);return value(db,'SELECT to_jsonb(g) FROM marketplace_sec.phase9_external_admission_gate g');}
async function fresh(attempt=1) {
 const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
 const context=await value(db,await claimJob(db,f,jobId));
 await resetActor(db);await db.query('UPDATE public.image_extraction_jobs SET attempt_count=$1 WHERE id=$2',[attempt,jobId]);
 await service();const read=await rpc(db,'phase9_automatic_edition_fence_v1',[jobId,worker,token,attempt]);
 return {...f,jobId,context,fence:{jobId,worker,leaseToken:token,claimAttempt:attempt,candidateId:f.candidateId,
  storeId:f.storeId,sessionId:f.sessionId,candidateVersion:read.candidateVersion,queryIdentity:context.queryIdentity,
  capturedRequestId:read.capturedRequestId,requestGeneration:read.requestGeneration}};
}
async function defer(f) {
 await service();return rpc(db,'phase9_defer_paused_metadata_admission_v1',[f.fence]);
}
async function oldDefer(f) {const epoch=Number((await gate()).epoch);await service();return rpc(db,'phase9_defer_metadata_admission_v1',[f.fence,epoch]);}
async function claim(){await service();return (await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(10,$1)',[worker])).rows;}
async function setPolicy(p=policy){await resetActor(db);await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[p]);}
async function begin(f){await service();return rpc(db,'phase9_begin_automatic_provider_run_v1',[f.fence,'google_books','1.0.0']);}
async function unchanged(action,pattern=/P9_STATE_CONFLICT/) {
 const prior=await footprint(db);await assert.rejects(action(),pattern);assert.deepEqual(await footprint(db),prior);
}
// Mutation: R1 missing/wrong delegation loses the restored attempt, wait epoch or neutral release.
test('R1 paused zero-obligation claim defers, restores attempt, clears lease and survives sweep',async()=>{
 const f=await fresh(5);await run(db,'01-pause');const epoch=Number((await gate()).epoch);
 assert.deepEqual(await defer(f),{status:'deferred',blockedEpoch:epoch});
 const j=await row(db,f.jobId);
 assert.equal(j.status,'retry_scheduled');assert.equal(j.attempt_count,4);
 for(const key of ['lease_owner','lease_token_hash','lease_expires_at'])assert.equal(j[key],null);
 assert.equal(Number(await value(db,'SELECT blocked_epoch FROM marketplace_sec.phase9_job_admission_wait WHERE job_id=$1',[f.jobId])),epoch);
 assert.equal((await sweep(db)).closed,0);assert.deepEqual(await row(db,f.jobId),j);
});
// Mutation: drop R2 predicate. Uses old defer deliberately so baseline fails behaviorally.
test('R2 legacy claim excludes the current epoch and resumes after actual 02/03/05',async()=>{
 const f=await fresh();await run(db,'01-pause');assert.equal((await oldDefer(f)).status,'deferred');
 assert.deepEqual(await claim(),[]);
 for(const name of ['02-capture-drain-check','03-switch-while-paused','05-resume'])await run(db,name);
 const jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].id,f.jobId);assert.equal(jobs[0].attempt_count,1);
});
// Mutation: remove R1 open/missing check; P1: do not delegate with a missing epoch.
test('R1 open, missing and reopened gate conflict without a write',async()=>{
 const f=await fresh();await unchanged(()=>defer(f));
 // P1's early guard must refuse even before attempting to lock/validate a claim.
 await unchanged(async()=>{await service();return rpc(db,'phase9_defer_paused_metadata_admission_v1',[null]);});
 const g=await gate();await db.exec('DELETE FROM marketplace_sec.phase9_external_admission_gate');
 try{
  await unchanged(()=>defer(f));
  await unchanged(async()=>{await service();return rpc(db,'phase9_defer_paused_metadata_admission_v1',[null]);});
 }finally{await resetActor(db);await db.query('INSERT INTO marketplace_sec.phase9_external_admission_gate SELECT * FROM jsonb_populate_record(NULL::marketplace_sec.phase9_external_admission_gate,$1::jsonb)',[g]);}
 // Actual reopen before the wrapper call, retaining a valid claim.
 await resetActor(db);await db.query("UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id=$1",[f.jobId]);
 for(const name of ['01-pause','02-capture-drain-check','03-switch-while-paused','05-resume'])await run(db,name);
 const live=await fresh();await unchanged(()=>defer(live));
});
// Mutation: helper accepts a stale epoch (race backstop).
test('R1 stale epoch targets the original two-argument helper',async()=>{
 const f=await fresh();await run(db,'01-pause');const epoch=Number((await gate()).epoch)-1;
 await unchanged(async()=>{await service();return rpc(db,'phase9_defer_metadata_admission_v1',[f.fence,epoch]);});
});
// Mutation: smoke cohort eligibility bypassed; noncohort must still queue.
test('R1 smoke cohort conflicts while a noncohort claim defers',async()=>{
 await run(db,'01-pause');await run(db,'03-switch-while-paused');
 const cohort=await fresh(),other=await fresh();
 await run(db,'04-smoke-mode',true,{'__SMOKE_JOB_IDS__':JSON.stringify([cohort.jobId])});
 await unchanged(()=>defer(cohort));assert.equal((await defer(other)).status,'deferred');
});
// Mutation: SQL history check skipped (K2) or begun neutral run wrongly rejected (K3).
test('R1 historical children require drain without changing the live claim',async()=>{
 const b=await beginAutomatic(db);await run(db,'01-pause');const f={...b.f,fence:b.command.fence};
 const prior=await footprint(db);assert.deepEqual(await defer(f),{status:'drain_required'});assert.deepEqual(await footprint(db),prior);
});
for(const exit of ['05-resume','06-rollback']) {
 // Mutation: K1 absent, or excludes all queued runs instead of neutral ones only.
 test('K1 actual scripts accept a neutral begun/deferred run via '+exit,async()=>{
  await setPolicy();const f=await fresh();assert.equal((await begin(f)).status,'started');
  await run(db,'01-pause');assert.equal((await defer(f)).status,'deferred');
  await resetActor(db);assert.equal(await value(db,'SELECT status FROM marketplace_sec.phase9_automatic_provider_runs WHERE job_id=$1',[f.jobId]),'queued');
  await run(db,'02-capture-drain-check');await setPolicy(null);await run(db,'03-switch-while-paused');await run(db,exit);
  assert.equal((await gate()).mode,exit==='05-resume'?'open':'paused');
 });
}
// K1 history-only adversaries keep FK-valid children on a distinct donor, then cross just the job link.
async function donor() {
 const b=await automaticGoogleCommand(db);await resetActor(db);
 await db.query("UPDATE public.phase9_usage_reservations SET status='consumed' WHERE job_id=$1",[b.f.jobId]);
 await db.query("UPDATE public.phase9_metadata_lookups SET completed_at=clock_timestamp() WHERE job_id=$1",[b.f.jobId]);
 await db.query("UPDATE public.metadata_enrichment_attempts SET disposition='failed' WHERE id=$1",[b.f.attemptId]);
 await db.query("UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id=$1",[b.f.jobId]);
 return b.f;
}
const negatives=['positive slots','in_progress','lease_owner','lease_token_hash','lease_expires_at',
 'lookup-only','lookup unresolved','call-only','non-neutral queued','unknown run','running run','round one','old epoch','reservation','queued identity'];
for(const name of scripts)for(const shape of negatives) {
 // Mutation: widen K1 by dropping status/lease/slots/run/history/current-epoch proof in this script.
 test(`K1 ${name} blocks ${shape}`,async()=>{
  const source=['lookup-only','lookup unresolved','call-only'].includes(shape)?await donor():null;
  await setPolicy();const f=await fresh();await begin(f);await run(db,'01-pause');await oldDefer(f);
  await setPolicy(null);await run(db,'03-switch-while-paused');await resetActor(db);
  if(shape==='positive slots')await db.query('UPDATE marketplace_sec.phase9_metadata_admissions SET slots_remaining=1 WHERE job_id=$1',[f.jobId]);
  else if(shape==='in_progress')await db.query("UPDATE public.image_extraction_jobs SET status='in_progress' WHERE id=$1",[f.jobId]);
  else if(shape.startsWith('lease_'))await db.query('UPDATE public.image_extraction_jobs SET '+shape+'=$1 WHERE id=$2',[
   shape==='lease_token_hash'?'b'.repeat(64):shape==='lease_owner'?worker:'2099-01-01T00:00:00Z',f.jobId]);
  else if(shape.startsWith('lookup')) {
   await db.query('UPDATE public.phase9_metadata_lookups SET job_id=$1 WHERE id=$2',[f.jobId,source.lookupId]);
   if(shape==='lookup unresolved')await db.query("UPDATE public.metadata_enrichment_attempts SET disposition='unresolved' WHERE id=$1",[source.attemptId]);
  }else if(shape==='call-only')await db.query('UPDATE public.phase9_metadata_provider_calls SET job_id=$1 WHERE id=$2',[f.jobId,source.callId]);
  else if(shape==='non-neutral queued')await db.query('UPDATE marketplace_sec.phase9_automatic_provider_runs SET no_egress_recheck=true WHERE job_id=$1',[f.jobId]);
  else if(shape==='unknown run'||shape==='running run')await db.query('UPDATE marketplace_sec.phase9_automatic_provider_runs SET status=$1 WHERE job_id=$2',[shape.split(' ')[0],f.jobId]);
  else if(shape==='round one')await db.query('UPDATE marketplace_sec.phase9_automatic_provider_runs SET round=1 WHERE job_id=$1',[f.jobId]);
  else if(shape==='queued identity')await db.query("UPDATE marketplace_sec.phase9_automatic_provider_runs SET query_identity_hash=repeat('b',64) WHERE job_id=$1",[f.jobId]);
  else if(shape==='old epoch')await db.query('UPDATE marketplace_sec.phase9_job_admission_wait SET blocked_epoch=blocked_epoch-1 WHERE job_id=$1',[f.jobId]);
  else if(shape==='reservation')await db.query(`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
   operation,idempotency_identity,reserved_cost_units) VALUES($1,$2,'metadata',1,'metadata_lookup',$2::uuid::text,0)`,[f.storeId,f.jobId]);
  await unchanged(()=>run(db,name),error=>{
   assert.match(error.message,/P9_8C_DRAIN_BLOCKED/);
   const report=JSON.parse(error.message.slice(error.message.indexOf('[')));
   assert.equal(report.find(x=>x.jobId===f.jobId)?.blocking,true);return true;
  });
 });
}
// Mutation: R2 accidentally opts NULL policy legacy jobs into v2 or filters one purpose.
test('R2 NULL-policy legacy claim still returns automatic and explicit purposes without admission markers',async()=>{
 const a=await fresh(),b=await fresh();await resetActor(db);
 await db.query("UPDATE public.image_extraction_jobs SET status='open',attempt_count=0,lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id=ANY($1::uuid[])",[[a.jobId,b.jobId]]);
 await db.query("UPDATE public.image_extraction_jobs SET operation_version='p9-owner-edition-options-v1' WHERE id=$1",[b.jobId]);
 assert.deepEqual((await claim()).map(x=>x.id).sort(),[a.jobId,b.jobId].sort());await resetActor(db);
 assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_metadata_admissions'),0);
});
async function finished(offset) {
 await setPolicy();const b=await beginAutomatic(db);await resetActor(db);
 // seedCard starts with a manual Owner review; use the unreviewed scan state (M32:1145).
 await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1',[b.f.candidateId]);
 await service();await rpc(db,'phase9_begin_automatic_provider_run_v1',[b.command.fence,'google_books','1.0.0']);
 failureResult(b.command);await singleReceipt(db,b);
 const floor=offset===null?null:new Date(Date.now()+offset).toISOString();
 const args=[b.command.fence,'google_books','1.0.0'];if(offset!==null)args.push(floor);
 return {...b,args,floor,result:await rpc(db,'phase9_finish_automatic_provider_run_v1',args)};
}
for(const offset of [5000,60000,null]) {
 // Mutation: R3 removed, floor ignored/capped, replay recomputed using changed clock/policy, or NULL altered.
 test(`R3 floor ${offset} bounds retry and replays persisted state after policy changes`,async()=>{
  // M93:672-674: base=1ms * (1+random()) <2ms; 5000ms floor controls due, max=10000ms.
  const b=await finished(offset),retry=offset!==60000;
  assert.equal(b.result.status,retry?'retry_scheduled':'finalized');
  if(offset===5000)assert.ok(Date.parse(b.result.dueAt)>=Date.parse(b.floor));
  await resetActor(db);const r=await value(db,'SELECT to_jsonb(r) FROM marketplace_sec.phase9_automatic_provider_runs r WHERE job_id=$1',[b.f.jobId]);
  assert.equal(r.status,'finalized');assert.equal(r.retry_allowed,retry);
  if(!retry)assert.equal(r.due_at,null);
  assert.equal((await row(db,b.f.jobId)).status,retry?'retry_scheduled':'in_progress');
  await setPolicy({...policy,backoffMaxMs:retry?2:120000});await service();
  const replay=await rpc(db,'phase9_finish_automatic_provider_run_v1',b.args);
  assert.equal(replay.status,b.result.status);assert.equal(replay.dueAt??null,b.result.dueAt??null);
  if(!retry) {
   assert.equal((await rpc(db,'phase9_complete_automatic_metadata_v1',[b.command])).status,'completed');
   assert.equal((await row(db,b.f.jobId)).status,'dead_letter');
   assert.equal(await value(db,'SELECT marketplace_sec.phase9_owner_ux_metadata_state($1)',[b.f.candidateId]),'temporarily_unavailable');
  }
 });
}
// Mutation: R1/R2/R3 privilege/search_path/owner drift, or accidental old-overload edits.
test('ACL every new/replaced function has literal service-only attributes; untouched delegates byte-identical',async()=>{
 const added=afterDefs.filter(r=>r.signature.includes('phase9_defer_paused_'));
 assert.equal(added.length,2);
 for(const r of afterDefs) {
  assert.equal(r.owner,'postgres',r.signature);assert.deepEqual(r.proconfig,['search_path=""']);
  assert.equal(r.prosecdef,r.signature.startsWith('marketplace_sec.'));assert.equal(r.no_public,true);
  assert.equal(r.anon,false);assert.equal(r.authenticated,false);assert.equal(r.service,true);
  const prior=beforeDefs.find(b=>b.signature===r.signature);if(!prior)continue;
  assert.equal(r.acl,prior.acl,r.signature);
  if(!r.signature.startsWith('marketplace_sec.claim_')&&!r.signature.startsWith('marketplace_sec.phase9_finish_automatic_provider_run_v1(jsonb, text, text, timestamp'))assert.equal(r.body,prior.body,r.signature);
 }
});
// Mutation: restore reversed gate-before-job lock or remove delegate epoch recheck.
test('R1 native gate transition between unlocked read and delegate conflicts without deadlock',
 {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT?'requires two native PostgreSQL sessions':false},async()=>{
 const f=await fresh();await run(db,'01-pause');const prior=await row(db,f.jobId);
 const a=await nativeConnection(db.database),b=await nativeConnection(db.database);let pending;
 try {
  await a.query('BEGIN');await a.query('SELECT id FROM public.image_extraction_jobs WHERE id=$1 FOR UPDATE',[f.jobId]);
  await b.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
  const pid=(await b.query('SELECT pg_backend_pid() id')).rows[0].id;
  pending=b.query('SELECT public.phase9_defer_paused_metadata_admission_v1($1::jsonb)',[f.fence]).then(value=>({value}),error=>({error}));
  let waiting=false;
  for(let i=0;i<100;i++) {
   waiting=(await a.query("SELECT wait_event_type='Lock' waiting FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.waiting;
   if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(waiting,true,'wrapper reached the held claim lock');
  await a.query("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='open',epoch=epoch+1 WHERE singleton");
  await a.query('COMMIT');assert.match((await pending).error?.message??'',/P9_STATE_CONFLICT/);
 }finally{await a.query('ROLLBACK');if(pending)await pending;await Promise.all([a.end(),b.end()]);}
 assert.deepEqual(await row(db,f.jobId),prior);await resetActor(db);
 assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_job_admission_wait'),0);
});
