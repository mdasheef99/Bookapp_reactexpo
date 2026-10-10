// Picker §§4.1-4.3/5/8-9: built worker + real disposable M68 boundary, recorded HTTP only.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { GoogleBooksAdapter } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter.js';
import { GOOGLE_BOOKS_CAPABILITY } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/index.js';
import { createMetadataEditionOptionsBoundary } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc.js';
import { runMetadataWorkerBatch } from '../../../.phase9-dist/workers/phase9-metadata-worker/index.js';
import { lookupSql, seedAutomaticLineage } from './editionPickerFixture.mjs';
import { asService, completionServiceClient, createCompletionDatabase, readSql, resetActor, scalar,
  seedOperation, selectSql, setActor, worker } from './editionOptionsCompletionFixture.mjs';
let db;
before(async()=>{db=await createCompletionDatabase();});
after(async()=>db?.close());
async function queued() {
  const f=await seedOperation(db), lineage=await seedAutomaticLineage(db,f); await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET state='ready' WHERE id=$1",[f.candidateId]);
  await db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[lineage.jobId]);
  await db.query("UPDATE public.image_extraction_jobs SET status='open',attempt_count=0,lease_owner=NULL,"
    +"lease_token_hash=NULL,lease_expires_at=NULL,next_attempt_at=transaction_timestamp() WHERE id=$1",[f.jobId]);
  await asService(db,f); return f;
}
function transport({permission=true,statuses=[200],loseResponse=false,failPersistence=false,invalidCompletion=false}={}) {
  let requests=0;
  const service=completionServiceClient(db);
  const client={rpc:async(name,p)=>{
    if(name==='phase9_complete_candidate_edition_options_v1' && failPersistence) {
      failPersistence=false; return {data:null,error:new Error('fixture precommit failure')};
    }
    if(name==='phase9_complete_candidate_edition_options_v1' && invalidCompletion) {
      p=structuredClone(p); p.p_rows[0].metadata.matchRationale='x'.repeat(800);
    }
    const reply=await service.rpc(name,p);
    if(name==='phase9_complete_candidate_edition_options_v1' && loseResponse && !reply.error){
      loseResponse=false; return {data:null,error:new Error('fixture committed response lost')};
    }
    return reply;
  }};
  const adapter=new GoogleBooksAdapter({
    mode:'real',apiKey:'fixture-only',timeoutMs:10000,maxResponseBytes:100000,
    ...(permission?{verifyOptionsRetention:({fetchedAt})=>({
      storagePermissionVerified:true,permittedDeadlineAt:new Date(Date.parse(fetchedAt)+3600000).toISOString(),
    })}:{}),
    fetcher:async()=>{
      const status=statuses[Math.min(requests,statuses.length-1)]; requests++;
      return new Response(JSON.stringify({kind:'books#volumes',totalItems:10,
        items:Array.from({length:10},(_,i)=>i===2?null:{kind:'books#volume',id:'same-record',
          volumeInfo:{title:'The Fixture Book',authors:['Fixture Author'],language:'en',
            publishedDate:'2020',publisher:'Fixture Press',imageLinks:{
              thumbnail:'https://books.google.com/books/content?id=same-record'}}})}),
      {status,headers:{'content-type':'application/json','x-request-id':'fixture-call-'+requests}});
    },
  });
  const boundary=createMetadataEditionOptionsBoundary(client);
  const deps={workerId:worker,workerAuthToken:'fixture-only',serviceClient:client,
    primary:adapter,primaryCapability:GOOGLE_BOOKS_CAPABILITY,editionOptionsBoundary:boundary};
  return {deps,requests:()=>requests,run:()=>runMetadataWorkerBatch(1,deps)};
}
async function makeRetryDue(f){
  await resetActor(db); await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
  await asService(db,f);
}
test('worker saves its own bounded response; explicit expiry refresh preserves the chosen snapshot',async()=>{
  const f=await queued(), t=transport(); const first=await t.run();
  assert.equal(first.results[0].outcome,'edition_options_available'); assert.equal(t.requests(),1);
  await setActor(db,f.ownerId); const choices=await scalar(db,readSql(f));
  assert.equal(choices.rows.length,10); assert.equal(choices.rows[2].eligibility,'unavailable');
  const selected=await scalar(db,selectSql(f,choices,choices.rows[0].optionId));
  await resetActor(db);
  await db.query("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=$1",[f.candidateId]);
  await setActor(db,f.ownerId);
  assert.deepEqual((await scalar(db,readSql(f))).selection,selected.selection);
  const next=await scalar(db,lookupSql(f)); assert.notEqual(next.operationId,f.jobId);
  await asService(db,f); const second=await t.run();
  assert.equal(second.results[0].outcome,'edition_options_available'); assert.equal(t.requests(),2);
  await setActor(db,f.ownerId); const refreshed=await scalar(db,readSql(f));
  assert.equal(refreshed.optionsVersion,2); assert.deepEqual(refreshed.selection,selected.selection);
});
test('committed completion response loss recovers readiness without another provider call',async()=>{
  const f=await queued(), t=transport({loseResponse:true}); const result=await t.run();
  assert.equal(result.results[0].outcome,'edition_options_available');
  assert.equal((await t.run()).claimed,0); assert.equal(t.requests(),1);
  await setActor(db,f.ownerId); assert.equal((await scalar(db,readSql(f))).lookupStatus,'ready');
});
test('absent independent retention verifier yields a controlled failure and stores no options',async()=>{
  const f=await queued(), t=transport({permission:false}); const result=await t.run();
  assert.equal(result.results[0].outcome,'manual_metadata_required');
  await resetActor(db);
  assert.equal(await scalar(db,"SELECT status FROM public.image_extraction_jobs WHERE id='"+f.jobId+"'"),'resolved');
  assert.equal(await scalar(db,"SELECT options_version FROM public.phase9_candidate_edition_state WHERE candidate_id='"+f.candidateId+"'"),0);
});
test('disabled provider resolves explicit work through its controlled failure port',async()=>{
  const f=await queued(), t=transport();
  const result=await runMetadataWorkerBatch(1,{...t.deps,primary:null,primaryCapability:null});
  assert.equal(result.results[0].outcome,'manual_metadata_required'); assert.equal(t.requests(),0);
  await resetActor(db);
  assert.equal(await scalar(db,"SELECT status FROM public.image_extraction_jobs WHERE id='"+f.jobId+"'"),'resolved');
});
for(const [name,controls] of [
  ['429 retry',{statuses:[429,200]}],['finalized response with failed persistence',{failPersistence:true}],
]) test(name+' records two actual requests and becomes ready only after durable retry',async()=>{
  const f=await queued(),t=transport(controls);
  assert.equal((await t.run()).results[0].outcome,'retry_scheduled'); await makeRetryDue(f);
  assert.equal((await t.run()).results[0].outcome,'edition_options_available'); assert.equal(t.requests(),2);
  await resetActor(db);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id='"+f.jobId+"'"),2);
});

// SQL proposal §3.6 / picker §9: actual SQL contract failure survives the concrete port and never schedules a provider retry.
test('worker treats direct SQL validation rejection as nonretryable after physical accounting',async()=>{
  const f=await queued(), t=transport({invalidCompletion:true});
  assert.equal((await t.run()).results[0].outcome,'manual_metadata_required'); assert.equal(t.requests(),1);
  await resetActor(db);
  assert.equal(await scalar(db,"SELECT status FROM public.image_extraction_jobs WHERE id='"+f.jobId+"'"),'dead_letter');
  assert.equal(await scalar(db,"SELECT count(*)::integer FROM public.phase9_metadata_provider_calls WHERE job_id='"+f.jobId+"'"),1);
  await setActor(db,f.ownerId); assert.deepEqual((await scalar(db,readSql(f))).rows,[]);
});
