// 02c §§4.3/7/8/9; M75:14–20,110–113; Owner's empty-obligation sweep.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {before,after,beforeEach,test} from 'node:test';
import {database,clean,resetActor,value,job,row,sweep,installed,nativeConnection,footprint} from './finalAttemptSweep8cFixture.mjs';
import {automaticGoogleCommand,setActor} from './providerReplacementFixture.mjs';
import {migrationPath} from './databaseHarness.mjs';
const M97='20261105000097_marketplace_phase9_8c_sweep_recovery.sql';
const hasM97=fs.existsSync(migrationPath(M97));
let db;
before(async()=>{db=await database();if(installed()&&hasM97)await db.exec(fs.readFileSync(migrationPath(M97),'utf8'));});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});
const feature={skip:!installed()?'M96 not installed; not a behavioural RED':false};
const feature97={skip:!installed()||!hasM97?'M97 not installed; not a behavioural RED':false};
for(const explicit of [false,true])test(`S1 exhausted-only dispatcher closes ${explicit?'explicit':'automatic'} job`,async()=>{
 const f=await job(db,{version:explicit?'p9-owner-edition-options-v1':null});
 await value(db,'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
 assert.equal((await row(db,f.id)).status,'dead_letter');
});
test('S2 non-exhausted and live final lease stay untouched',async()=>{
 const a=await job(db,{attempt:4}),b=await job(db,{status:'in_progress',lease:new Date(Date.now()+3600000).toISOString()});
 const before=[await row(db,a.id),await row(db,b.id)];
 await value(db,'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
 assert.deepEqual([await row(db,a.id),await row(db,b.id)],before);
});
for(const status of ['open','retry_scheduled','in_progress'])test(`S3 M75-identical explicit fields and no request: ${status}`,feature,async()=>{
 const f=await job(db,{status,version:'p9-owner-edition-options-v1',lease:status==='in_progress'?'2000-01-01T00:00:00Z':null});
 const before=await row(db,f.id),count=await value(db,'SELECT count(*)::int FROM public.image_extraction_jobs');
 const beforeFootprint=await footprint(db);
 await sweep(db);const after=await row(db,f.id);
 assert.equal(after.status,'dead_letter');
 for(const k of ['lease_owner','lease_token_hash','lease_expires_at'])assert.equal(after[k],null);
 assert.equal(after.last_safe_error_code,'P9_METADATA_ATTEMPTS_EXHAUSTED');
 assert.equal(after.last_safe_error_category,'metadata');
 assert.ok(after.completed_at);assert.equal(after.completed_at,after.dead_lettered_at);assert.equal(after.completed_at,after.updated_at);
 const changed=new Set(['status','lease_owner','lease_token_hash','lease_expires_at','last_safe_error_code',
  'last_safe_error_category','completed_at','dead_lettered_at','updated_at']);
 for(const k of Object.keys(before))if(!changed.has(k))assert.deepEqual(after[k],before[k],k);
 assert.equal(await value(db,'SELECT count(*)::int FROM public.image_extraction_jobs'),count);
 const expected=structuredClone(beforeFootprint);
 expected['public.image_extraction_jobs']=expected['public.image_extraction_jobs'].map(j=>j.id===f.id?after:j);
 assert.deepEqual(await footprint(db),expected,'only the exact M75 job close may change the full fixture footprint');
});
test('S4 bound, held-head progress and second-run no-op',feature,async()=>{
 const held=await job(db);await db.query(`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
 operation,idempotency_identity,reserved_cost_units) VALUES($1,$2::uuid,'metadata',1,'metadata_lookup',$2::uuid::text,0)`,[held.store,held.id]);
 const a=await job(db),b=await job(db);
 assert.equal((await sweep(db,1)).closed,1);assert.equal((await sweep(db,1)).closed,1);
 const before=await footprint(db);assert.equal((await sweep(db)).closed,0);assert.deepEqual(await footprint(db),before);
 assert.equal((await row(db,held.id)).status,'open');assert.equal((await row(db,a.id)).status,'dead_letter');assert.equal((await row(db,b.id)).status,'dead_letter');
});
test('S5 M97 supersedes the zero-slot marker: the stale job closes and the trigger still rejects a live claim',feature97,async()=>{
 const f=await job(db,{status:'in_progress',lease:'2000-01-01T00:00:00Z'});
 await db.query(`INSERT INTO marketplace_sec.phase9_metadata_admissions(job_id,claim_attempt_number,claim_worker,claim_lease_token_hash)
 VALUES($1,5,'8c-fixture-worker-0001',$2)`,[f.id,'a'.repeat(64)]);
 const before=await footprint(db);
 assert.equal((await sweep(db)).closed,1);
 const after=await row(db,f.id);
 assert.equal(after.status,'dead_letter');
 for(const k of ['lease_owner','lease_token_hash','lease_expires_at'])assert.equal(after[k],null);
 const expected=structuredClone(before);
 expected['public.image_extraction_jobs']=expected['public.image_extraction_jobs'].map(j=>j.id===f.id?after:j);
 assert.deepEqual(await footprint(db),expected,'only the exact closed job row changes');
 // M93:108-110 needs OLD in_progress; restore the same stale claim for the unchanged trigger proof.
 await resetActor(db);
 await db.query("UPDATE public.image_extraction_jobs SET status='in_progress',lease_owner='8c-fixture-worker-0001',lease_token_hash=repeat('a',64),lease_expires_at='2000-01-01T00:00:00Z' WHERE id=$1",[f.id]);
 // The unchanged BEFORE trigger really rejects this identity under service_role.
 await resetActor(db);await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)");
 await assert.rejects(db.query("UPDATE public.image_extraction_jobs SET status='dead_letter' WHERE id=$1",[f.id]),/P9_STATE_CONFLICT/);
});
for(const status of ['registered','outcome_unknown','fanout_null'])test(`S6 unknown obligation ${status} is never marked unused`,feature,async()=>{
 const {f}=await automaticGoogleCommand(db);await resetActor(db);
 await db.query("UPDATE public.phase9_usage_reservations SET status='released' WHERE job_id=$1",[f.jobId]);
 await db.query("UPDATE public.image_extraction_jobs SET attempt_count=5,lease_expires_at='2000-01-01' WHERE id=$1",[f.jobId]);
 await db.query('UPDATE public.phase9_metadata_provider_calls SET status=$1,edition_call_sequence=$2,edition_call_stage=$3,edition_egress_started=NULL WHERE id=$4',
 [status==='fanout_null'?'finalized':status,status==='fanout_null'?0:null,status==='fanout_null'?'search':null,f.callId]);
 const before=await footprint(db);assert.equal((await sweep(db)).closed,0);assert.deepEqual(await footprint(db),before);
});
test('S7 dispatcher isolates a raising sweep and still runs legacy dispatch',feature,async()=>{
 await resetActor(db);
 const original=await value(db,"SELECT pg_get_functiondef('marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer)'::regprocedure)");
 try {
  await db.exec(`CREATE OR REPLACE FUNCTION marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(p_limit integer DEFAULT 50)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN RAISE EXCEPTION 'fixture_sweep_failure'; END$$`);
  const result=await value(db,'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  assert.equal(result.dispatched,0);assert.equal(result.reconciled,0);assert.ok(result.editionOptionsCleanup);
 }finally{await db.exec(original);}
});
test('S8 ACL, attributes and invalid limits',feature,async()=>{
 await resetActor(db);
 assert.equal(await value(db,"SELECT pg_get_functiondef('marketplace_sec.phase9_release_closed_admission_v1()'::regprocedure)"),db.triggerBefore);
 assert.deepEqual(await value(db,"SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text,'volatility',provolatile,'security',prosecdef,'config',proconfig) FROM pg_proc WHERE oid='marketplace_sec.dispatch_phase9_worker_wakes()'::regprocedure"),db.dispatchBefore);
 for(const schema of ['public','marketplace_sec']) {
  const signature=`${schema}.phase9_sweep_exhausted_metadata_jobs_v1(integer)`;
  for(const role of ['anon','authenticated'])assert.equal(await value(db,"SELECT has_function_privilege($1,$2,'EXECUTE')",[role,signature]),false);
  assert.equal(await value(db,"SELECT has_function_privilege('service_role',$1,'EXECUTE')",[signature]),true);
  const attributes=await value(db,"SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'security',prosecdef,'volatility',provolatile,'config',proconfig) FROM pg_proc WHERE oid=$1::regprocedure",[signature]);
  assert.equal(attributes.owner,'postgres');assert.equal(attributes.security,schema==='marketplace_sec');assert.equal(attributes.volatility,'v');assert.deepEqual(attributes.config,['search_path=""']);
  assert.equal(await value(db,"SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')",[signature]),true);
 }
 for(const n of [null,0,101])await assert.rejects(sweep(db,n),/P9_REQUEST_INVALID/);
});
for(const status of ['queued','running','unknown'])test(`S10 active M93 run ${status} is untouched`,feature,async()=>{
 const f=await job(db);await db.query(`INSERT INTO marketplace_sec.phase9_automatic_provider_runs(job_id,query_identity_hash,adapter_key,
 adapter_version,round,claim_attempt_number,claim_worker,claim_lease_token_hash,candidate_version,request_generation,fence_digest,status)
 VALUES($1,$2,'google_books','1.0.0',0,5,'8c-fixture-worker-0001',$2,1,0,$2,$3)`,[f.id,'a'.repeat(64),status]);
 const before=await footprint(db);assert.equal((await sweep(db)).closed,0);assert.deepEqual(await footprint(db),before);
});
test('S11 positive capacity hold is untouched',feature,async()=>{
 const f=await job(db);await db.query(`INSERT INTO marketplace_sec.phase9_metadata_admissions(job_id,claim_attempt_number,claim_worker,
 claim_lease_token_hash,store_id,adapter_key,adapter_version,fence,policy,slots_remaining)
 VALUES($1,5,'8c-fixture-worker-0001',$2,$3,'google_books','1.0.0','{}','{}',1)`,[f.id,'a'.repeat(64),f.store]);
 const before=await footprint(db);assert.equal((await sweep(db)).closed,0);assert.deepEqual(await footprint(db),before);
});
test('S9 native overlapping sweeps close once', {skip:!installed()||!process.env.PHASE9_PROVIDER_NATIVE_PORT?'requires M96 native group':false},async()=>{
 const f=await job(db),a=await nativeConnection(db.database),b=await nativeConnection(db.database);
 try {
  assert.notEqual((await a.query('SELECT pg_backend_pid() AS id')).rows[0].id,(await b.query('SELECT pg_backend_pid() AS id')).rows[0].id);
  await a.query('BEGIN');const first=(await a.query('SELECT public.phase9_sweep_exhausted_metadata_jobs_v1(1) AS body')).rows[0].body;
  const second=(await b.query('SELECT public.phase9_sweep_exhausted_metadata_jobs_v1(1) AS body')).rows[0].body;
  assert.equal(first.closed,1);assert.equal(second.closed,0);await a.query('COMMIT');
  const before=await row(db,f.id);assert.equal((await sweep(db)).closed,0);assert.deepEqual(await row(db,f.id),before);
 }finally{await a.query('ROLLBACK');await Promise.all([a.end(),b.end()]);}
});

// 02c §9: deterministic proof of client lifetime without starting native Postgres.
test('S12 footprint awaits each single-client query and leaves none running on failure',async()=>{
 for(const failAt of [null,3]) {
  let active=0,calls=0;const completed=[];
  const client={async exec(){assert.equal(active,0,'reset must not overlap a query');},async query(){
   const call=++calls;
   assert.equal(active,0,'footprint must not queue concurrent queries on one client');
   active++;
   try {
    await new Promise(resolve=>setImmediate(resolve));
    if(call===failAt)throw new Error('snapshot fixture failure');
    return {rows:[{body:[]}]};
   }finally{active--;completed.push(call);}
  }};
  if(failAt===null)assert.equal(Object.keys(await footprint(client)).length,7);
  else await assert.rejects(footprint(client),/snapshot fixture failure/);
  assert.equal(active,0,'footprint must settle before the next cleanup');
  assert.equal(calls,failAt??7,'a failed snapshot must not start later queries');
  assert.deepEqual(completed,Array.from({length:calls},(_,i)=>i+1));
 }
});
