// 02c §§4.3/7/8/9; M97 sweep recovery. Disposable PGlite only; no provider HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {before,after,beforeEach,test} from 'node:test';
import {database,clean,resetActor,value,job,row,sweep,installed,footprint,nativeConnection} from './finalAttemptSweep8cFixture.mjs';
import {migrationPath} from './databaseHarness.mjs';
import {seedCard,seedAutomaticLineage,lookupSql,readSql} from './editionPickerFixture.mjs';
import {automaticGoogleCommand,setActor} from './providerReplacementFixture.mjs';

const M97='20261105000097_marketplace_phase9_8c_sweep_recovery.sql';
const hasM97=fs.existsSync(migrationPath(M97));
const feature={skip:!installed()||!hasM97?'M96/M97 not installed; not a behavioural RED':false};
const worker='8c-fixture-worker-0001',hash='a'.repeat(64);
let db,beforeDefinitions,afterDefinitions;

async function definitions(database) {
 const rows=(await database.query(`SELECT p.oid AS oid,
   n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')' AS signature,
   pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,p.provolatile,p.prosecdef,p.proconfig
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE (n.nspname='marketplace_sec' AND p.proname IN('phase9_sweep_exhausted_metadata_jobs_v1','phase9_owner_ux_metadata_state'))
      OR (n.nspname='public' AND p.proname='phase9_sweep_exhausted_metadata_jobs_v1')
   ORDER BY 1`)).rows;
 return Object.fromEntries(rows.map(r=>[r.signature,r]));
}
async function state(f) {
 await resetActor(db);
 return value(db,`SELECT marketplace_sec.phase9_owner_ux_metadata_state('${f.candidateId}')`);
}
async function choices(f) {
 await setActor(db,f.ownerId);
 const result=await value(db,readSql(f));
 await resetActor(db);
 return result;
}
async function admission(jobId) {
 await resetActor(db);
 return value(db,'SELECT to_jsonb(a) FROM marketplace_sec.phase9_metadata_admissions a WHERE a.job_id=$1',[jobId]);
}
async function run(jobId,round=0) {
 await resetActor(db);
 return value(db,'SELECT to_jsonb(r) FROM marketplace_sec.phase9_automatic_provider_runs r WHERE r.job_id=$1 AND r.round=$2',[jobId,round]);
}
async function addAdmission(f,{slots=0,attempt=5,tokenHash=hash}={}) {
 await resetActor(db);
 if(slots===0)return db.query(`INSERT INTO marketplace_sec.phase9_metadata_admissions(job_id,claim_attempt_number,
  claim_worker,claim_lease_token_hash) VALUES($1,$2,$3,$4)`,[f.id,attempt,worker,tokenHash]);
 return db.query(`INSERT INTO marketplace_sec.phase9_metadata_admissions(job_id,claim_attempt_number,claim_worker,
  claim_lease_token_hash,store_id,adapter_key,adapter_version,fence,policy,slots_remaining)
  VALUES($1,$2,$3,$4,$5,'google_books','1.0.0','{}','{}',$6)`,[f.id,attempt,worker,tokenHash,f.store,slots]);
}
async function addRun(f,{status='running',round=0,attempt=5,tokenHash=hash,version='1.0.0'}={}) {
 await resetActor(db);
 return db.query(`INSERT INTO marketplace_sec.phase9_automatic_provider_runs(job_id,query_identity_hash,adapter_key,
  adapter_version,round,claim_attempt_number,claim_worker,claim_lease_token_hash,candidate_version,
  request_generation,fence_digest,status)
  VALUES($1,$2,'google_books',$3,$4,$5,$6,$2,1,0,$2,$7)`,[f.id,tokenHash,version,round,attempt,worker,status]);
}
async function addReservation(f) {
 await resetActor(db);
 return db.query(`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
  operation,idempotency_identity,reserved_cost_units)
  VALUES($1,$2,'metadata',1,'metadata_lookup',$2::uuid::text,0)`,[f.store,f.id]);
}
async function stale({status='in_progress',lease='2000-01-01T00:00:00Z',slots=0,attempt=5}={}) {
 const f=await job(db,{status,attempt,lease});
 await addAdmission(f,{slots,attempt});
 return f;
}
async function crash({lease='2000-01-01T00:00:00Z',slots=1,runStatus='running',round=0,attempt=5,tokenHash=hash}={}) {
 const f=await job(db,{status:'in_progress',attempt,lease});
 await addAdmission(f,{slots,attempt,tokenHash});
 await addRun(f,{status:runStatus,round,attempt,tokenHash});
 return f;
}

before(async()=>{
 db=await database();
 beforeDefinitions=await definitions(db);
 if(installed()&&hasM97)await db.exec(fs.readFileSync(migrationPath(M97),'utf8'));
 afterDefinitions=await definitions(db);
});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});

test('T1 zero-slot matching admission + expired lease closes the stale job',feature,async()=>{
 const f=await stale();
 const before=await footprint(db);
 const result=await sweep(db);
 assert.equal(result.closed,1);
 assert.deepEqual(result.jobIds,[f.id]);
 const after=await row(db,f.id);
 assert.equal(after.status,'dead_letter');
 for(const k of ['lease_owner','lease_token_hash','lease_expires_at'])assert.equal(after[k],null);
 assert.equal(after.last_safe_error_code,'P9_METADATA_ATTEMPTS_EXHAUSTED');
 assert.equal(after.last_safe_error_category,'metadata');
 assert.ok(after.completed_at);assert.equal(after.completed_at,after.dead_lettered_at);assert.equal(after.completed_at,after.updated_at);
 const expected=structuredClone(before);
 expected['public.image_extraction_jobs']=expected['public.image_extraction_jobs'].map(j=>j.id===f.id?after:j);
 assert.deepEqual(await footprint(db),expected,'only the closed job row changes');
});

test('T2 positive admission without a crash run stays blocked',feature,async()=>{
 const f=await stale({slots:1});
 const before=await footprint(db);
 assert.equal((await sweep(db)).closed,0);
 assert.deepEqual(await footprint(db),before);
 assert.equal((await row(db,f.id)).status,'in_progress');
});

test('T3 live lease stays untouched',feature,async()=>{
 const f=await job(db,{status:'in_progress',attempt:5,lease:new Date(Date.now()+3600000).toISOString()});
 await addAdmission(f,{slots:0,attempt:5});
 const before=await footprint(db);
 assert.equal((await sweep(db)).closed,0);
 assert.deepEqual(await footprint(db),before);
 assert.equal((await row(db,f.id)).status,'in_progress');
});

test('T4 realistic positive-slot zero-call crash closes job and finalizes the run',feature,async()=>{
 const f=await crash();
 const runBefore=await run(f.id);
 assert.equal(runBefore.status,'running');
 const result=await sweep(db);
 assert.equal(result.closed,1);
 assert.deepEqual(result.jobIds,[f.id]);
 const after=await row(db,f.id);
 assert.equal(after.status,'dead_letter');
 const terminal=await run(f.id);
 assert.equal(terminal.status,'finalized');
 assert.equal(terminal.retry_allowed,false);
 assert.equal(terminal.due_at,null);
 assert.equal(terminal.outcome,null);
 assert.equal(terminal.no_egress_recheck,false);
 assert.match(terminal.receipt_digest,/^[0-9a-f]{64}$/);
 assert.equal((await admission(f.id)).slots_remaining,0);
});

test('T5 any provider-call row keeps the run and job blocking',feature,async()=>{
 const {f}=await automaticGoogleCommand(db);
 await resetActor(db);
 await db.query(`UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=5,
  lease_owner=$2,lease_token_hash=$3,lease_expires_at='2000-01-01T00:00:00Z' WHERE id=$1`,[f.jobId,worker,hash]);
 const target={id:f.jobId,store:f.storeId};
 await addAdmission(target,{slots:1,attempt:5});
 await addRun(target,{status:'running',attempt:5});
 const runBefore=await run(f.jobId);
 assert.equal((await sweep(db)).closed,0);
 assert.deepEqual(await run(f.jobId),runBefore);
 assert.equal((await row(db,f.jobId)).status,'in_progress');
});

test('T6 unknown run keeps the job blocking',feature,async()=>{
 const f=await crash({runStatus:'unknown'});
 const runBefore=await run(f.id);
 assert.equal((await sweep(db)).closed,0);
 assert.deepEqual(await run(f.id),runBefore);
 assert.equal((await row(db,f.id)).status,'in_progress');
});

test('T7 reserved usage reservation keeps the crash shape blocking',feature,async()=>{
 const f=await crash();
 await addReservation(f);
 const before=await footprint(db);
 assert.equal((await sweep(db)).closed,0);
 assert.deepEqual(await footprint(db),before);
});

test('T8 scanned no-lookup dead-letter job reads ambiguous and picker idle',feature,async()=>{
 const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
 await resetActor(db);
 await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL,state='ready' WHERE id=$1",[f.candidateId]);
 await db.query(`UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=5,
  lease_owner=$2,lease_token_hash=$3,lease_expires_at='2000-01-01T00:00:00Z' WHERE id=$1`,[jobId,worker,hash]);
 assert.equal((await sweep(db)).closed,1);
 assert.equal(await state(f),'ambiguous');
 assert.equal((await choices(f)).lookupStatus,'idle');
});

test('T8b explicit exhausted request reads failed in the picker',feature,async()=>{
 const f=await seedCard(db);
 await setActor(db,f.ownerId);
 const receipt=await value(db,lookupSql(f));
 await resetActor(db);
 await db.query(`UPDATE public.image_extraction_jobs SET status='open',attempt_count=5,
  lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL WHERE id=$1`,[receipt.operationId]);
 assert.equal((await choices(f)).lookupStatus,'failed');
});

test('T9 scanned no-lookup and no job still reads pending',feature,async()=>{
 const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
 await resetActor(db);
 await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1',[f.candidateId]);
 await db.query('DELETE FROM public.image_extraction_jobs WHERE id=$1',[jobId]);
 assert.equal(await state(f),'pending');
});

test('T10 dead-letter job plus a newer open job reads pending',feature,async()=>{
 const f=await seedCard(db),{jobId}=await seedAutomaticLineage(db,f);
 await resetActor(db);
 await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1',[f.candidateId]);
 await db.query(`UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=5,
  lease_owner=$2,lease_token_hash=$3,lease_expires_at='2000-01-01T00:00:00Z' WHERE id=$1`,[jobId,worker,hash]);
 assert.equal((await sweep(db)).closed,1);
 await resetActor(db);
 await db.query(`INSERT INTO public.image_extraction_jobs(store_id,entity_type,entity_id,job_kind,dedupe_key)
  VALUES($1,'candidate',$2,'metadata_enrich','m97:'||gen_random_uuid()::text)`,[f.storeId,f.candidateId]);
 assert.equal(await state(f),'pending');
});

test('T11 ACL, owner and attributes are unchanged',feature,async()=>{
 assert.deepEqual(Object.keys(afterDefinitions).sort(),Object.keys(beforeDefinitions).sort());
 for(const [signature,after] of Object.entries(afterDefinitions)) {
  const before=beforeDefinitions[signature];
  assert.equal(after.owner,'postgres',signature);
  assert.equal(after.provolatile,before.provolatile,signature+' volatility');
  assert.equal(after.prosecdef,before.prosecdef,signature+' security');
  assert.equal(after.proconfig?.join('|')??null,before.proconfig?.join('|')??null,signature+' search_path');
  assert.equal(after.acl,before.acl,signature+' ACL');
  assert.equal(await value(db,`SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=$1 AND a.grantee=0 AND a.privilege_type='EXECUTE')`,[after.oid]),true,signature+' PUBLIC');
  for(const role of ['anon','authenticated'])
   assert.equal(await value(db,'SELECT has_function_privilege($1,$2,\'EXECUTE\')',[role,after.oid]),false,signature+' '+role);
 }
 const sweepDefinition=Object.values(afterDefinitions).find(r=>r.signature.startsWith('marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1('));
 assert.equal(sweepDefinition.owner,'postgres','sweep owner');
 assert.equal(sweepDefinition.prosecdef,true,'sweep SECURITY DEFINER');
 assert.deepEqual(sweepDefinition.proconfig,['search_path=""'],'sweep search_path');
 assert.equal(await value(db,"SELECT has_function_privilege('service_role',$1,'EXECUTE')",[sweepDefinition.oid]),true,'sweep service_role');
 for(const role of ['anon','authenticated'])
  assert.equal(await value(db,'SELECT has_function_privilege($1,$2,\'EXECUTE\')',[role,sweepDefinition.oid]),false,'sweep '+role);
 const stateDefinition=Object.values(afterDefinitions).find(r=>r.signature.startsWith('marketplace_sec.phase9_owner_ux_metadata_state('));
 assert.equal(stateDefinition.owner,'postgres','owner state owner');
 assert.equal(stateDefinition.prosecdef,true,'owner state SECURITY DEFINER');
 assert.equal(stateDefinition.provolatile,'s','owner state stability');
 assert.deepEqual(stateDefinition.proconfig,['search_path=""'],'owner state search_path');
 for(const role of ['anon','authenticated','service_role'])
  assert.equal(await value(db,'SELECT has_function_privilege($1,$2,\'EXECUTE\')',[role,stateDefinition.oid]),false,'owner state '+role);
});

test('T12 queued crash run with a matching admission closes',feature,async()=>{
 const f=await job(db,{status:'retry_scheduled',attempt:5,lease:null});
 await addAdmission(f,{slots:0,attempt:5});
 await addRun(f,{status:'queued',attempt:5});
 assert.equal((await sweep(db)).closed,1);
 assert.equal((await row(db,f.id)).status,'dead_letter');
 assert.equal((await run(f.id)).status,'finalized');
});

test('T13 absent lease with the crash shape closes',feature,async()=>{
 const f=await job(db,{status:'in_progress',attempt:5,lease:null});
 await addAdmission(f,{slots:1,attempt:5});
 await addRun(f,{status:'running',attempt:5});
 assert.equal((await sweep(db)).closed,1);
 assert.equal((await row(db,f.id)).status,'dead_letter');
 assert.equal((await run(f.id)).status,'finalized');
});

test('T14 mixed runs close only the eligible job',feature,async()=>{
 const closed=await job(db,{status:'in_progress',attempt:5,lease:'2000-01-01T00:00:00Z'});
 await addAdmission(closed,{slots:1,attempt:5});
 await addRun(closed,{status:'finalized',round:0,attempt:5});
 await addRun(closed,{status:'running',round:1,attempt:5});
 const blocked=await job(db,{status:'in_progress',attempt:5,lease:'2000-01-01T00:00:00Z'});
 await addAdmission(blocked,{slots:1,attempt:5});
 await addRun(blocked,{status:'running',round:1,attempt:5});
 await addRun(blocked,{status:'unknown',round:0,attempt:5,tokenHash:'b'.repeat(64)});
 const result=await sweep(db);
 assert.equal(result.closed,1);
 assert.deepEqual(result.jobIds,[closed.id]);
 assert.equal((await row(db,closed.id)).status,'dead_letter');
 assert.equal((await row(db,blocked.id)).status,'in_progress');
});

test('T15 second sweep is a no-op',feature,async()=>{
 const f=await crash();
 assert.equal((await sweep(db)).closed,1);
 const before=await footprint(db);
 assert.equal((await sweep(db)).closed,0);
 assert.deepEqual(await footprint(db),before);
});

test('T16 skipped candidate rolls back alone while the batch still closes another',feature,async()=>{
 const skipped=await crash();
 const closed=await stale();
 const skippedJob=await row(db,skipped.id),skippedRun=await run(skipped.id),skippedAdmission=await admission(skipped.id);
 await resetActor(db);
 await db.exec(`CREATE FUNCTION public.m97_test_skip_dead_letter() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
   IF NEW.status='dead_letter' AND NEW.id::text=current_setting('m97.skip_job',true) THEN RETURN NULL; END IF;
   RETURN NEW;
  END$$;
  CREATE TRIGGER m97_test_skip_dead_letter BEFORE UPDATE ON public.image_extraction_jobs
   FOR EACH ROW EXECUTE FUNCTION public.m97_test_skip_dead_letter();`);
 try {
  await db.query("SELECT set_config('m97.skip_job',$1,false)",[skipped.id]);
  const result=await sweep(db);
  assert.equal(result.closed,1);
  assert.deepEqual(result.jobIds,[closed.id]);
  assert.deepEqual(await row(db,skipped.id),skippedJob,'skipped job is byte-unchanged');
  assert.deepEqual(await run(skipped.id),skippedRun,'skipped run is byte-unchanged');
  assert.deepEqual(await admission(skipped.id),skippedAdmission,'skipped admission is byte-unchanged');
  assert.equal((await row(db,closed.id)).status,'dead_letter');
 } finally {
  await resetActor(db);
  await db.exec("SELECT set_config('m97.skip_job','',false); DROP TRIGGER IF EXISTS m97_test_skip_dead_letter ON public.image_extraction_jobs; DROP FUNCTION IF EXISTS public.m97_test_skip_dead_letter();");
 }
});

test('T17 native overlapping sweeps close once',{skip:!installed()||!hasM97||!process.env.PHASE9_PROVIDER_NATIVE_PORT?'requires M97 native group':false},async()=>{
 const f=await crash();
 const a=await nativeConnection(db.database),b=await nativeConnection(db.database);
 try {
  assert.notEqual((await a.query('SELECT pg_backend_pid() AS id')).rows[0].id,(await b.query('SELECT pg_backend_pid() AS id')).rows[0].id);
  await a.query('BEGIN');
  const first=(await a.query('SELECT public.phase9_sweep_exhausted_metadata_jobs_v1(1) AS body')).rows[0].body;
  const second=(await b.query('SELECT public.phase9_sweep_exhausted_metadata_jobs_v1(1) AS body')).rows[0].body;
  assert.equal(first.closed,1);
  assert.equal(second.closed,0);
  await a.query('COMMIT');
 }finally{await a.query('ROLLBACK');await Promise.all([a.end(),b.end()]);}
 assert.equal((await row(db,f.id)).status,'dead_letter');
 assert.equal((await run(f.id)).status,'finalized');
});
