// Picker §§4.3/5/9, Master §8/MAS-17: bounded superseded-request terminal evidence.
// Disposable full M65–M71 stack; optional forward correction, no live/provider action.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { createCommitDatabase, reviewValue, saveReview } from './editionPickerCommitFixture.mjs';
import { lookupSql, readSql, resetActor, scalar, seedCard, seedAutomaticLineage, setActor } from './editionPickerFixture.mjs';
import { prepareCall, rpc, seedOperation, worker, token, finalize, complete, asService, completionServiceClient } from './editionOptionsCompletionFixture.mjs';
import { GoogleBooksAdapter } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter.js';
import { GOOGLE_BOOKS_CAPABILITY } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/index.js';
import { createMetadataEditionOptionsBoundary } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc.js';
import { runMetadataWorkerBatch } from '../../../.phase9-dist/workers/phase9-metadata-worker/index.js';

const forward='20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql';
let db;
before(async()=>{
  db=await createCommitDatabase();
  for(const name of ['20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
    '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql']) {
    await db.exec(fs.readFileSync(migrationPath(name),'utf8'));
  }
  if(fs.existsSync(migrationPath(forward))) await db.exec(fs.readFileSync(migrationPath(forward),'utf8'));
});
after(async()=>{if(db) await db.close();});
async function withRequest(body, active=false){
  let f;
  try {
    if(active) f=await seedOperation(db);
    else {
      f=await seedCard(db);
      const receipt=await scalar(db,lookupSql(f));
      f.jobId=receipt.operationId;
    }
    await body(f);
  } finally {
    await resetActor(db);
    if(f?.jobId) await db.query("UPDATE public.image_extraction_jobs SET status='cancelled' WHERE id=$1 AND status IN('open','in_progress','retry_scheduled')",[f.jobId]);
  }
}
async function edit(f){
  await setActor(db,f.ownerId);
  await saveReview(db,f,{...await reviewValue(db,f),originalTitle:'Replacement identity'});
}
async function realClaim(f){
  await setActor(db,f.ownerId,'service_role');
  const rows=(await db.query('SELECT * FROM public.claim_phase9_metadata_jobs(1,$1)',[worker])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].id,f.jobId);
  return {worker,token:rows[0].lease_token,attempt:rows[0].attempt_count};
}
const fixedClaim=f=>({worker,token,attempt:f.attempt});
async function fail(f,claim,kind='provider_unavailable',retryable=true){
  return rpc(db,'phase9_fail_metadata_job',[f.jobId,claim.worker,claim.token,claim.attempt,
    null,null,null,kind,retryable]);
}
async function job(f){
  await resetActor(db);
  return (await db.query('SELECT status,attempt_count,completed_at,last_safe_error_code,lease_expires_at FROM public.image_extraction_jobs WHERE id=$1',[f.jobId])).rows[0];
}

test('M72 terminalizer is executable only by service_role',async()=>{
  await resetActor(db);
  const rows=(await db.query(`SELECT n.nspname AS schema_name,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service_exec,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.proname='phase9_resolve_superseded_edition_job_v1'
    ORDER BY n.nspname`)).rows;
  assert.deepEqual(rows,[
    {schema_name:'marketplace_sec',service_exec:true,anon_exec:false,authenticated_exec:false},
    {schema_name:'public',service_exec:true,anon_exec:false,authenticated_exec:false},
  ]);
});

test('identity replacement ends the old real claim once and safely replays its outcome',async()=>withRequest(async f=>{
  await edit(f);
  const choices=await scalar(db,readSql(f));
  assert.equal(choices.lookupStatus,'idle');assert.equal(choices.requestGeneration,1);
  const claim=await realClaim(f);
  await assert.rejects(rpc(db,'phase9_metadata_job_context',[f.jobId,claim.worker,claim.token,claim.attempt]),/P9_STATE_CONFLICT/);
  const result=await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,claim.worker,claim.token,claim.attempt]);
  assert.equal(result.status,'resolved_noop');
  const terminal=await job(f);
  assert.equal(terminal.attempt_count,1);assert.ok(terminal.completed_at);
  assert.equal(terminal.last_safe_error_code,'P9_EDITION_REQUEST_SUPERSEDED');
  assert.equal(terminal.lease_expires_at,null);
  await setActor(db,f.ownerId,'service_role');
  assert.deepEqual(await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,claim.worker,claim.token,claim.attempt]),result);
  assert.deepEqual(await job(f),terminal);
  assert.equal(await scalar(db,"SELECT marketplace_sec.has_claimable_phase9_work('metadata_enrich')"),false);
}));

test('superseded final-attempt work terminalizes and late physical evidence stays fenced',async()=>withRequest(async f=>{
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_jobs SET attempt_count=5 WHERE id=$1',[f.jobId]);
  f.attempt=5;
  await setActor(db,f.ownerId,'service_role');
  await prepareCall(db,f);
  await edit(f);
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,worker,f.context.claimToken,5])).status,'resolved_noop');
  assert.equal((await finalize(db,f)).status,'stale_rejected');
  assert.equal((await complete(db,f)).status,'stale_rejected');
  await setActor(db,f.ownerId);
  const choices=await scalar(db,readSql(f));
  assert.equal(choices.lookupStatus,'idle');assert.deepEqual(choices.rows,[]);
  assert.equal((await job(f)).attempt_count,5);
},true));

test('old completion cannot close or replace a newer per-card request',async()=>withRequest(async f=>{
  const old=await realClaim(f);
  await edit(f);
  const newer=await scalar(db,lookupSql(f,1));
  try {
    await setActor(db,f.ownerId,'service_role');
    assert.equal((await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,old.worker,old.token,old.attempt])).status,'resolved_noop');
    await resetActor(db);
    assert.equal((await db.query('SELECT status FROM public.image_extraction_jobs WHERE id=$1',[newer.operationId])).rows[0].status,'open');
    await setActor(db,f.ownerId);
    const choices=await scalar(db,readSql(f));
    assert.equal(choices.lookupStatus,'pending');assert.equal(choices.requestGeneration,1);
  } finally {
    await resetActor(db);
    await db.query("UPDATE public.image_extraction_jobs SET status='cancelled' WHERE id=$1",[newer.operationId]);
  }
}));

test('terminal replay rejects a different claim token, worker or attempt',async()=>withRequest(async f=>{
  const claim=await realClaim(f);await edit(f);await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,claim.worker,claim.token,claim.attempt])).status,'resolved_noop');
  for(const different of [{token:'b'.repeat(64)},{worker:'different-worker-0001'},{attempt:claim.attempt+1}]) {
    await assert.rejects(rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,different.worker??claim.worker,different.token??claim.token,different.attempt??claim.attempt]),/P9_STATE_CONFLICT/);
  }
}));

test('a reclaimed claim rejects the previous token before terminalizing the superseded job',async()=>withRequest(async f=>{
  const stale=await realClaim(f);
  await edit(f);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  const current=await realClaim(f);
  assert.equal(current.attempt,stale.attempt+1);
  await assert.rejects(
    rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,stale.worker,stale.token,stale.attempt]),
    /P9_STATE_CONFLICT/,
  );
  assert.equal((await job(f)).status,'in_progress');
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,current.worker,current.token,current.attempt])).status,'resolved_noop');
  assert.equal((await job(f)).attempt_count,current.attempt);
}));

test('actual worker closes an in-flight fifth claim superseded during its recorded response',async()=>withRequest(async f=>{
  const lineage=await seedAutomaticLineage(db,f);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET state='ready' WHERE id=$1",[f.candidateId]);
  await db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[lineage.jobId]);
  await db.query("UPDATE public.image_extraction_jobs SET status='open',attempt_count=4,lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,next_attempt_at=transaction_timestamp() WHERE id=$1",[f.jobId]);
  await asService(db,f);
  const base=completionServiceClient(db);let requests=0,cleanups=0;
  const client={rpc:async(name,p)=>{
    if(name==='phase9_resolve_superseded_edition_job_v1') {
      cleanups++;
      try {return {data:await rpc(db,name,[p.p_job_id,p.p_worker,p.p_lease_token,p.p_attempt_count]),error:null};}
      catch(error) {return {data:null,error};}
    }
    return base.rpc(name,p);
  }};
  const adapter=new GoogleBooksAdapter({mode:'real',apiKey:'fixture-only',timeoutMs:10000,maxResponseBytes:100000,
    verifyOptionsRetention:({fetchedAt})=>({storagePermissionVerified:true,
      permittedDeadlineAt:new Date(Date.parse(fetchedAt)+3600000).toISOString()}),
    fetcher:async()=>{
      requests++;await edit(f);await asService(db,f);
      return new Response(JSON.stringify({kind:'books#volumes',totalItems:0,items:[]}),
        {status:200,headers:{'content-type':'application/json'}});
    }});
  const result=await runMetadataWorkerBatch(1,{workerId:worker,workerAuthToken:'fixture-only',
    serviceClient:client,primary:adapter,primaryCapability:GOOGLE_BOOKS_CAPABILITY,
    editionOptionsBoundary:createMetadataEditionOptionsBoundary(client)});
  assert.deepEqual(result,{claimed:1,results:[{outcome:'stale_claim'}]});
  const terminal=await job(f);
  assert.equal(terminal.status,'resolved_noop');assert.equal(terminal.attempt_count,5);
  assert.ok(terminal.completed_at);assert.equal(terminal.lease_expires_at,null);
  assert.equal(cleanups,1);assert.equal(requests,1);
  await setActor(db,f.ownerId);
  const choices=await scalar(db,readSql(f));
  assert.equal(choices.lookupStatus,'idle');assert.deepEqual(choices.rows,[]);
},true));

test('a current request cannot be retired and a selling edit does not detach it',async()=>withRequest(async f=>{
  await setActor(db,f.ownerId);
  const value=await reviewValue(db,f);
  await saveReview(db,f,{...value,priceMinor:value.priceMinor+100});
  await setActor(db,f.ownerId,'service_role');
  assert.equal((await rpc(db,'phase9_resolve_superseded_edition_job_v1',[f.jobId,worker,f.context.claimToken,f.attempt])).status,'not_superseded');
  assert.equal((await job(f)).status,'in_progress');
},true));
