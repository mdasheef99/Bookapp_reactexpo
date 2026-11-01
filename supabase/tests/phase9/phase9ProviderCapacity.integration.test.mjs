// Owner OD-2026-11-01-1; 02c §§4.3/8/9: reserve a bounded round before egress.
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {clean,createProviderDatabase,nativeConnection,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {beginAutomatic,olAutomaticRoute,retainedOlResult} from './providerAutomaticReviewFixture.mjs';
import {seedCard,seedAutomaticLineage,claimJob} from './editionPickerFixture.mjs';
import {rpc,token,worker} from './editionOptionsCompletionFixture.mjs';
import {seedOperation} from './editionOptionsCompletionFixture.mjs';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1000,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
let db;
before(async()=>{db=await createProviderDatabase({selection:'8a-5'});});
beforeEach(async()=>{
  await clean(db);await olAutomaticRoute(db);await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[policy]);
});
after(async()=>{await db?.close();});
async function pendingFence() {
  const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  await value(db,await claimJob(db,f,jobId));
  const c=await rpc(db,'phase9_metadata_job_context',[jobId,worker,token,1]);
  return {jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,storeId:f.storeId,
    sessionId:f.sessionId,candidateVersion:c.candidateVersion,queryIdentity:c.queryIdentity,
    capturedRequestId:null,requestGeneration:0};
}
test('round capacity: one remaining slot defers OL before any child or call exists',async()=>{
  const f=await pendingFence();await resetActor(db);
  await db.query('UPDATE marketplace_sec.phase9_store_admission SET gets_used=19 WHERE store_id=$1',[f.storeId]);
  await setActor(db,'','service_role');
  const r=await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0']);
  assert.equal(r.status,'capacity_wait');
  await resetActor(db);
  for(const table of ['phase9_metadata_lookups','metadata_enrichment_attempts','phase9_metadata_provider_calls','phase9_usage_reservations'])
    assert.equal(await value(db,`SELECT count(*)::int FROM public.${table}`),0,table);
  assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),0);
});
test('round capacity: reserve six, charge one actual grant and release five on finish',async()=>{
  const f=await beginAutomatic(db,{key:'open_library',version:'2.0.0'}),args=[f.command.fence,'open_library','2.0.0'];
  await rpc(db,'phase9_begin_automatic_provider_run_v1',args);
  await resetActor(db);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.f.jobId]),6);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.f.storeId]),0);
  await setActor(db,'','service_role');
  const physical='00000000-0000-4000-8000-000000000099';
  const callArgs=[f.f.attemptId,f.f.jobId,worker,token,1,physical,0,'search'];
  const call=await rpc(db,'phase9_register_edition_options_provider_call_v1',callArgs);
  assert.deepEqual(await rpc(db,'phase9_register_edition_options_provider_call_v1',callArgs),call);
  await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
    [call.provider_call_id,f.f.jobId,worker,token,1,'finalized','timeout',true,true]);
  await rpc(db,'phase9_finish_automatic_provider_run_v1',args);
  await resetActor(db);
  assert.equal(await value(db,'SELECT slots_remaining FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[f.f.jobId]),0);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.f.storeId]),1);
});
test('round capacity: a policy-protected legacy registration without admission is refused and spends nothing',async()=>{
  const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
  await value(db,await claimJob(db,f,jobId));
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[policy]);
  await setActor(db,'','service_role');
  const context=await rpc(db,'phase9_metadata_job_context',[jobId,worker,token,1]);
  const base=[jobId,worker,token,1],key='legacy-no-admission:'+jobId;
  const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',[...base,f.candidateId,context.candidateVersion,
    context.queryIdentity,key,'google_books','1.0.0','google-books-capability-v1','p9-metadata-foundation-v1','bibliographic',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private','1',
    'p9-metadata-cache-v1','metadata-v1',null]);
  const usage=await rpc(db,'phase9_reserve_metadata_usage',[...base,lookup.lookup_id,'google_books','1.0.0',1]);
  const attempt=await rpc(db,'phase9_register_structural_metadata_attempt',[lookup.lookup_id,...base,f.candidateId,
    context.candidateVersion,randomUUID(),key,'primary',1,'google_books','1.0.0','google-books-capability-v1',
    'p9-metadata-foundation-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',
    usage.reservation_id]);
  await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',
    [attempt.attempt_id,jobId,worker,token,1,randomUUID()]),/P9_PROVIDER_RUN_NOT_ADMITTED/);
  await resetActor(db);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls'),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[jobId]),0);
});
test('round capacity: cap below installed round maximum refuses configuration',async()=>{
  const f=await pendingFence();await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[{...policy,storeMaxGets:5}]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'configuration_required');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),0);
});
async function anotherJob(f,{claimed=true}={}) {
  const jobId=randomUUID();await resetActor(db);
  await db.query(`INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version)
    VALUES($1,$2,'candidate',$3,'metadata_enrich',$1::uuid::text,'p9-metadata-foundation-v1')`,[jobId,f.storeId,f.candidateId]);
  if(claimed)await db.query(`UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=1,
    lease_owner=$2,lease_token_hash=encode(extensions.digest($3,'sha256'),'hex'),
    lease_expires_at=clock_timestamp()+interval '5 minutes' WHERE id=$1`,[jobId,worker,token]);
  await setActor(db,'','service_role');
  return {...f,jobId};
}
test('round capacity: a held full store is excluded from claim backlog until due',async()=>{
  await resetActor(db);await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[{...policy,storeMaxGets:6}]);
  const f=await pendingFence();await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0']);
  const other=await anotherJob(f);
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[other,'open_library','2.0.0'])).status,'capacity_wait');
  await resetActor(db);
  assert.ok(new Date(await value(db,'SELECT next_due_at FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]))>new Date());
  for(let i=0;i<3;i++)await anotherJob(f,{claimed:false});
  assert.deepEqual((await db.query('SELECT * FROM public.phase9_claim_metadata_jobs_v2(1,$1)',[worker])).rows,[]);
  // No receipt is invented: unknown/no-call finish closes the unused hold.
  await rpc(db,'phase9_finish_automatic_provider_run_v1',[f,'open_library','2.0.0']);
  await resetActor(db);
  assert.equal(await value(db,'SELECT next_due_at<=clock_timestamp() FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]),true);
});
test('round capacity: mixed routed providers cannot reset one shared store window with conflicting policy',async()=>{
  await resetActor(db);
  await db.exec('UPDATE public.phase9_provider_registry SET explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL');
  await db.query(`UPDATE public.phase9_provider_registry SET explicit_search_allowed=true,explicit_role='primary',
    explicit_order=1,protection_policy=$1 WHERE adapter_key='google_books'`,[{...policy,storeWindowSeconds:1,storeMaxGets:1}]);
  const f=await pendingFence();
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'configuration_required');
});
test('round capacity: a shorter policy cannot erase usage in the existing longer window',async()=>{
  const f=await pendingFence();await resetActor(db);
  await db.query(`UPDATE marketplace_sec.phase9_store_admission SET gets_used=19,window_seconds=60,
    window_started_at=clock_timestamp()-interval '2 seconds' WHERE store_id=$1`,[f.storeId]);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[{...policy,storeWindowSeconds:1}]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'capacity_wait');
  await resetActor(db);
  assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[f.storeId]),19);
});
test('round capacity: an unassigned provider cannot block the actual route',async()=>{
  const f=await pendingFence();await resetActor(db);
  await db.query(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=true,automatic_role=NULL,automatic_order=NULL,
    explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL,protection_policy=$1 WHERE adapter_key='google_books'`,
  [{...policy,storeWindowSeconds:1,storeMaxGets:1}]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'started');
});
test('round capacity: an empty window can adopt the new policy without a false wait',async()=>{
  const f=await pendingFence();await resetActor(db);
  await db.query('UPDATE marketplace_sec.phase9_store_admission SET window_seconds=60 WHERE store_id=$1',[f.storeId]);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[{...policy,storeWindowSeconds:1}]);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'started');
});
test('round capacity: a service terminal transition cannot commit an expired v2 claim',async()=>{
  const f=await pendingFence();await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0']);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
  await assert.rejects(db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[f.jobId]),/P9_STATE_CONFLICT/);
  await resetActor(db);
});
test('round capacity: an in-flight grant preserves an established held-store block',async()=>{
  await resetActor(db);await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[{...policy,storeMaxGets:6}]);
  const f=await beginAutomatic(db,{key:'open_library',version:'2.0.0'}),full=f.command.fence;
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[full,'open_library','2.0.0']);
  const other=await anotherJob(full);
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[other,'open_library','2.0.0']);
  await rpc(db,'phase9_register_edition_options_provider_call_v1',[f.f.attemptId,f.f.jobId,worker,token,1,randomUUID(),0,'search']);
  await resetActor(db);
  assert.equal(await value(db,'SELECT next_due_at>clock_timestamp() FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[full.storeId]),true);
});
test('round capacity: successful completion without finish releases and wakes unused capacity',async()=>{
  await resetActor(db);await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[{...policy,storeMaxGets:8}]);
  const f=await beginAutomatic(db,{key:'open_library',version:'2.0.0'}),full=f.command.fence;
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[full,'open_library','2.0.0']);
  const other=await anotherJob(full);
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[other,'open_library','2.0.0'])).status,'capacity_wait');
  await retainedOlResult(db,f);
  const waiting=await anotherJob(full);
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[waiting,'open_library','2.0.0'])).status,'capacity_wait');
  await resetActor(db);
  assert.equal(await value(db,'SELECT next_due_at>clock_timestamp() FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[full.storeId]),true);
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_complete_automatic_metadata_v1',[f.command])).status,'completed');
  await resetActor(db);
  assert.equal(await value(db,'SELECT next_due_at<=clock_timestamp() FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[full.storeId]),true);
});
test('round capacity: a waiting admitted grant uses the clock after the store lock and an unadmitted grant is refused',
  {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT},async()=>{
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET protection_policy=NULL,
    automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL WHERE adapter_key='open_library'`);
  await db.query(`UPDATE public.phase9_provider_registry SET protection_policy=$1,
    automatic_lookup_allowed=true,automatic_role='primary',automatic_order=1 WHERE adapter_key='google_books'`,
  [{...policy,storeMaxGets:1,storeWindowSeconds:1}]);
  const a=await beginAutomatic(db),b=await beginAutomatic(db,{card:{...a.f},sourceHash:'b'.repeat(64)});
  await setActor(db,'','service_role');
  await rpc(db,'phase9_begin_automatic_provider_run_v1',[a.command.fence,'google_books','1.0.0']);
  await resetActor(db);
  await db.query("UPDATE marketplace_sec.phase9_store_admission SET window_started_at=clock_timestamp()-interval '0.25 seconds' WHERE store_id=$1",[a.f.storeId]);
  const holder=await nativeConnection(db.database),caller=await nativeConnection(db.database);
  try {
    await holder.query('BEGIN');await holder.query('SELECT 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=$1 FOR UPDATE',[a.f.storeId]);
    await caller.query("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)");
    const pending=caller.query('SELECT public.phase9_register_metadata_provider_call($1,$2,$3,$4,$5,$6)',
      [a.f.attemptId,a.f.jobId,worker,token,1,randomUUID()])
      .then(r=>({rows:r.rows}),e=>({error:e}));
    await holder.query('SELECT pg_sleep(1.25)');
    const releasedAt=(await holder.query('SELECT clock_timestamp() AS t')).rows[0].t;
    await holder.query('COMMIT');
    const registered=await pending;
    assert.ifError(registered.error);
    assert.equal(await value(db,`SELECT window_started_at>=$2::timestamptz
      FROM marketplace_sec.phase9_store_admission WHERE store_id=$1`,[a.f.storeId,releasedAt]),true);
    assert.equal(await value(db,`SELECT window_started_at+make_interval(secs=>window_seconds)>clock_timestamp()
      FROM marketplace_sec.phase9_store_admission WHERE store_id=$1`,[a.f.storeId]),true);
    await setActor(db,'','service_role');
    await assert.rejects(rpc(db,'phase9_register_metadata_provider_call',
      [b.f.attemptId,b.f.jobId,worker,token,1,randomUUID()]),/P9_PROVIDER_RUN_NOT_ADMITTED/);
    await resetActor(db);
    assert.equal(await value(db,'SELECT gets_used FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[a.f.storeId]),1);
  } finally {await holder.query('ROLLBACK');await holder.end();await caller.end();}
});
for(const expiry of ['lease','session'])test(`round capacity: admission waiting across ${expiry} expiry creates no run or hold`,
  {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT},async()=>{
  const f=await pendingFence();await resetActor(db);
  const holder=await nativeConnection(db.database),caller=await nativeConnection(db.database);
  try {
    if(expiry==='lease')await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()+interval '1 second' WHERE id=$1",[f.jobId]);
    else await db.query("UPDATE public.image_extraction_sessions SET expires_at=clock_timestamp()+interval '1 second' WHERE id=$1",[f.sessionId]);
    await holder.query('BEGIN');await holder.query('SELECT 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=$1 FOR UPDATE',[f.storeId]);
    await caller.query("SET ROLE service_role; SELECT set_config('request.jwt.claim.role','service_role',false)");
    const pending=caller.query('SELECT public.phase9_begin_automatic_provider_run_v1($1,$2,$3)',[f,'open_library','2.0.0'])
      .then(r=>({result:r.rows}),e=>({error:e.message}));
    await holder.query('SELECT pg_sleep(1.25)');await holder.query('COMMIT');
    assert.match((await pending).error??'',/P9_STATE_CONFLICT/);
    assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_automatic_provider_runs'),0);
  } finally {await holder.query('ROLLBACK');await holder.end();await caller.end();}
});
test('round capacity: integer-valued decimal policy values are accepted like the M89 validator',async()=>{
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET protection_policy=
    '{"version":"p9-protection-v1","minIntervalMs":1000,"storeWindowSeconds":60.0,"storeMaxGets":20.0,
     "backoffBaseMs":1,"backoffMaxMs":2,"breakerFailures":3,"breakerWindowSeconds":60,
     "breakerCooldownMs":1000,"halfOpenMax":1,"mode":"single_instance","contactId":"test-contact"}'::jsonb
    WHERE adapter_key='open_library'`);
  assert.equal(await value(db,`SELECT marketplace_sec.phase9_provider_configuration_valid_v1(r)
    FROM public.phase9_provider_registry r WHERE adapter_key=$1`,['open_library']),true);
  const f=await pendingFence();
  await setActor(db,'','service_role');
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'started');
  assert.equal((await rpc(db,'phase9_finish_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'recovery_only');
});
test('round capacity: due time honours session expiry when it precedes the window and lease',async()=>{
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",
    [{...policy,storeMaxGets:6}]);
  const f=await pendingFence();
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'started');
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_sessions SET expires_at=clock_timestamp()+interval '2 seconds' WHERE id=$1",
    [f.sessionId]);
  const other=await anotherJob(f),before=Date.now();
  const r=await rpc(db,'phase9_begin_automatic_provider_run_v1',[other,'open_library','2.0.0']);
  assert.equal(r.status,'capacity_wait');
  assert.ok(Date.parse(r.dueAt)<=before+3000,'due must not wait for the later lease/window');
  await resetActor(db);
  assert.ok(new Date(await value(db,'SELECT next_due_at FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',
    [f.storeId])).getTime()<=before+3000);
});
test('round capacity: a closed-session hold cannot pull due back to now',async()=>{
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",
    [{...policy,storeMaxGets:6}]);
  const f=await pendingFence();
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'started');
  await resetActor(db);
  const ownerId=await value(db,'SELECT created_by FROM public.image_extraction_sessions WHERE id=$1',[f.sessionId]);
  await db.query("UPDATE public.image_extraction_sessions SET status='closed',closed_at=clock_timestamp() WHERE id=$1",
    [f.sessionId]);
  const sessionId=randomUUID(),candidateId=randomUUID();
  await db.query(`INSERT INTO public.image_extraction_sessions(id,store_id,created_by,status,selected_language,
    selected_script,default_condition,default_location,default_quantity,default_publication)
    SELECT $1,store_id,created_by,'active',selected_language,selected_script,default_condition,default_location,
      default_quantity,default_publication FROM public.image_extraction_sessions WHERE id=$2`,[sessionId,f.sessionId]);
  await db.query(`INSERT INTO public.image_extraction_candidates
    SELECT (jsonb_populate_record(NULL::public.image_extraction_candidates,to_jsonb(c)||$1::jsonb)).*
    FROM public.image_extraction_candidates c WHERE id=$2`,
  [{id:candidateId,session_id:sessionId,input_id:null,vision_job_id:null,analysis_observation_id:null,
    analysis_schema_version:null,state:'ready'},f.candidateId]);
  const lineage=await seedAutomaticLineage(db,{storeId:f.storeId,sessionId,candidateId,ownerId},
    'accepted','b'.repeat(64));
  await value(db,await claimJob(db,{ownerId},lineage.jobId));
  const context=await rpc(db,'phase9_metadata_job_context',[lineage.jobId,worker,token,1]);
  const other={jobId:lineage.jobId,worker,leaseToken:token,claimAttempt:1,candidateId,storeId:f.storeId,sessionId,
    candidateVersion:context.candidateVersion,queryIdentity:context.queryIdentity,capturedRequestId:null,
    requestGeneration:0};
  await resetActor(db);
  await db.query(`UPDATE marketplace_sec.phase9_store_admission SET gets_used=5,window_seconds=60,
    window_started_at=clock_timestamp() WHERE store_id=$1`,[f.storeId]);
  await setActor(db,'','service_role');
  const before=Date.now(),r=await rpc(db,'phase9_begin_automatic_provider_run_v1',[other,'open_library','2.0.0']);
  assert.equal(r.status,'capacity_wait');
  assert.ok(Date.parse(r.dueAt)>before+30000,'a hold that no longer reserves must not lower due to now');
  await resetActor(db);
  assert.ok(new Date(await value(db,'SELECT next_due_at FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',
    [f.storeId])).getTime()>before+30000);
});
test('round capacity: wake ignores a hold whose session is no longer mutable',async()=>{
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",
    [{...policy,storeMaxGets:6}]);
  const f=await pendingFence();
  assert.equal((await rpc(db,'phase9_begin_automatic_provider_run_v1',[f,'open_library','2.0.0'])).status,'started');
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_sessions SET status='closed',closed_at=clock_timestamp() WHERE id=$1",
    [f.sessionId]);
  await db.query(`UPDATE marketplace_sec.phase9_store_admission SET gets_used=5,window_seconds=60,
    window_started_at=clock_timestamp(),next_due_at='-infinity' WHERE store_id=$1`,[f.storeId]);
  await db.query('SELECT marketplace_sec.phase9_wake_store_admission_v1($1)',[f.storeId]);
  const due=new Date(await value(db,'SELECT next_due_at FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',
    [f.storeId]));
  assert.ok(due.getTime()>Date.now()+30000,'wake must not schedule a closed-session hold now');
});
test('round capacity: terminal wake cannot deadlock a store holder waiting on a canonical key',
  {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT},async()=>{
  await resetActor(db);
  await db.exec('UPDATE public.phase9_provider_registry SET explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL');
  await db.query(`UPDATE public.phase9_provider_registry SET explicit_search_allowed=true,explicit_role='primary',
    explicit_order=1,protection_policy=$1 WHERE adapter_key='google_books'`,[policy]);
  const f=await seedOperation(db),full={jobId:f.jobId,worker,leaseToken:token,claimAttempt:1,
    candidateId:f.candidateId,storeId:f.storeId,sessionId:f.sessionId,requestId:f.jobId,
    requestGeneration:f.context.requestGeneration,queryIdentity:f.context.queryIdentity};
  await rpc(db,'phase9_reserve_metadata_provider_round_v1',[full,'google_books','1.0.0']);
  const storeHolder=await nativeConnection(db.database),terminal=await nativeConnection(db.database),key='8911005145';
  try {
    await storeHolder.query('BEGIN');await terminal.query('BEGIN');
    await storeHolder.query('SELECT 1 FROM marketplace_sec.phase9_store_admission WHERE store_id=$1 FOR UPDATE',[f.storeId]);
    await terminal.query('SELECT pg_advisory_xact_lock($1)',[key]);
    const finished=terminal.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[f.jobId])
      .then(async()=>{await terminal.query('COMMIT');return null;},async e=>{await terminal.query('ROLLBACK');return e.code;});
    const lock=storeHolder.query('SELECT pg_advisory_xact_lock($1)',[key]).then(()=>null,e=>e.code);
    assert.deepEqual(await Promise.all([finished,lock]),[null,null]);
  } finally {await storeHolder.query('ROLLBACK');await terminal.query('ROLLBACK');await storeHolder.end();await terminal.end();}
});
