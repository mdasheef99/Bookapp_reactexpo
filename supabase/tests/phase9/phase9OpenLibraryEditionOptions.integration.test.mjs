// Open Library amendment: full M65-M74 stack, disposable database only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test,before,after} from 'node:test';
import {createWorkerCompletionDatabase,seedOperation,rpc,worker,token,complete,recover,resultRows,finalize,prepareCall,
  setActor,resetActor,scalar as fixtureScalar,readSql,selectSql} from './editionOptionsCompletionFixture.mjs';
import {metadata} from './editionPickerFixture.mjs';
import {currentCommitSql,saveReview,reviewValue,originalSelection,seedCard} from './editionPickerCommitFixture.mjs';
async function scalar(db,sql,values=[]) {const result=await db.query(sql,values);return Object.values(result.rows[0] ?? {})[0];}
let db;
// One M84 database for all cases; provider HTTP remains recorded and local.
before(async()=>{db=await createWorkerCompletionDatabase();});
after(async()=>{await db?.close();});
async function olCall(options={}) {
 const f=await seedOperation(db,options),lookupAdapter=options.lookupAdapter ?? 'open_library';
 await resetActor(db);
 await db.exec("UPDATE public.phase9_provider_registry SET enabled=true WHERE adapter_key='open_library'");
 await setActor(db,f.ownerId,'service_role');
 const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',[
  f.jobId,worker,token,f.attempt,f.candidateId,f.context.candidateVersion,f.context.queryIdentity,
  'edition-options:'+f.jobId,lookupAdapter,'1.0.0','open-library-capability-v1','p9-metadata-foundation-v1',
  'bibliographic','p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
  'store_private','1','p9-metadata-cache-v1','metadata-v1',null]);
 const usage=await rpc(db,'phase9_reserve_metadata_usage',[f.jobId,worker,token,f.attempt,lookup.lookup_id,lookupAdapter,'1.0.0',1]);
 const attempt=await rpc(db,'phase9_register_structural_metadata_attempt',[
  lookup.lookup_id,f.jobId,worker,token,f.attempt,f.candidateId,f.context.candidateVersion,
  randomUUID(),'edition-options:'+f.jobId,'primary',1,'open_library','1.0.0','open-library-capability-v1',
  'p9-metadata-foundation-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',usage.reservation_id]);
 return {...f,lookupId:lookup.lookup_id,attemptId:attempt.attempt_id,reservationId:usage.reservation_id};
}
async function getCall(f,sequence,stage,identity=randomUUID()) {
 return rpc(db,'phase9_register_edition_options_provider_call_v1',[f.attemptId,f.jobId,worker,token,
  f.attempt,identity,sequence,stage]);
}
async function http(f,sequence,stage) {
 const call=await getCall(f,sequence,stage);await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
  [call.provider_call_id,f.jobId,worker,token,f.attempt,'finalized','no_acceptable_match',false,true]);
 return call;
}
function olRows(f) {
 const result=resultRows(f);
 result.rows[0].googleBooksUrl='https://openlibrary.org/books/OL100M';
 result.rows[0].metadata={...result.rows[0].metadata,adapterKey:'open_library',providerRecordId:'OL100M',
  coverReference:'https://covers.openlibrary.org/b/id/123-M.jpg',matchRationale:'exact_validated_isbn'};
 return result;
}
test('worker validates coherent OL facts without changing Google validation',async()=>{
 assert.equal(await scalar(db,'SELECT marketplace_sec.phase9_edition_valid_normalized_metadata($1::jsonb)',[
  {...metadata,adapterKey:'open_library',providerRecordId:'OL100M',coverReference:'https://covers.openlibrary.org/b/id/123-M.jpg'}]),true);
});
test('OL is disabled in the migration until separately activated',async()=>{
 assert.equal(await scalar(db,"SELECT enabled FROM public.phase9_provider_registry WHERE adapter_key='open_library'"),false);
});
test('per-GET registration enforces sequence, stages and immutable replay identity',async()=>{
 const f=await olCall(); const identity=randomUUID();
 const first=await getCall(f,0,'search',identity);
 assert.equal((await getCall(f,0,'search',identity)).provider_call_id,first.provider_call_id);
 await assert.rejects(getCall(f,0,'search'),/P9_IDEMPOTENCY_MISMATCH/);
 await assert.rejects(getCall(f,1,'editions'),/P9_STATE_CONFLICT/);
 await rpc(db,'phase9_finalize_edition_options_provider_call_v1',
  [first.provider_call_id,f.jobId,worker,token,f.attempt,'finalized','no_acceptable_match',false,true]);
 await http(f,1,'editions');
 await assert.rejects(getCall(f,2,'author:https://evil.invalid'),/P9_REQUEST_INVALID/);
 await assert.rejects(getCall(f,6,'author:OL6A'),/P9_REQUEST_INVALID/);
});
test('full OL completion, read, confirmation and replay preserve factual snapshot',async()=>{
 const f=await olCall({isbn:'9780306406157',language:'und'});
 await http(f,0,'search');await http(f,1,'editions');await http(f,2,'author:OL1A');
 const result=olRows(f);assert.equal((await complete(db,f,result)).status,'completed');
 assert.equal((await recover(db,f)).status,'replayed');
 await setActor(db,f.ownerId);const choices=await scalar(db,readSql(f));
 assert.equal(choices.rows[0].metadata.coverReference,'https://covers.openlibrary.org/b/id/123-M.jpg');
 const selected=await scalar(db,selectSql(f,choices,result.rows[0].optionId));
 assert.equal(selected.selection.confirmedByOwner,true);
 assert.equal(selected.selection.snapshot.title,result.rows[0].metadata.title);
});
test('foreign provider URL, metadata provider and ISBN corruption fail closed',async()=>{
 const f=await olCall();await http(f,0,'search');await http(f,1,'editions');
 for (const mutate of [
  row=>row.googleBooksUrl='https://books.google.com/books?id=OL100M',
  row=>row.metadata.adapterKey='google_books',
  row=>row.metadata.isbn13='9999999999999',
  row=>row.metadata.coverReference='https://evil.invalid/123.jpg',
 ]) {const result=olRows(f);mutate(result.rows[0]);await assert.rejects(complete(db,f,result),/P9_EDITION_ROWS_INVALID/);}
});
test('revoked OL policy hides and cleans OL choices independently of Google',async()=>{
 const f=await olCall();await http(f,0,'search');await http(f,1,'editions');await complete(db,f,olRows(f));
 await resetActor(db);await db.exec("UPDATE public.phase9_provider_registry SET storage_allowed=false WHERE adapter_key='open_library'");
 await setActor(db,f.ownerId);assert.deepEqual((await scalar(db,readSql(f))).rows,[]);
 await resetActor(db);assert.equal(await scalar(db,"SELECT marketplace_sec.phase9_edition_options_due(c) FROM public.image_extraction_candidates c WHERE id=$1",[f.candidateId]),true);
 await db.exec("UPDATE public.phase9_provider_registry SET storage_allowed=true WHERE adapter_key='open_library'");
});
test('anonymous callers cannot register OL physical calls',async()=>{
 const f=await olCall();await setActor(db,f.ownerId,'anon');
 await assert.rejects(getCall(f,0,'search'),/permission denied|P9_OWNER_NOT_AUTHORIZED/);
});
test('old Google single-call completion is unchanged under M73',async()=>{
 const f=await prepareCall(db,await seedOperation(db));await finalize(db,f);assert.equal((await complete(db,f)).status,'completed');
});

test('known registration-only cancellation is not counted as an attempted GET and replays exactly',async()=>{
 const f=await olCall(),call=await getCall(f,0,'search');
 const params=[call.provider_call_id,f.jobId,worker,token,f.attempt,'stale_rejected','cancelled',false,false];
 await rpc(db,'phase9_finalize_edition_options_provider_call_v1',params);
 await rpc(db,'phase9_finalize_edition_options_provider_call_v1',params);
 assert.equal(await scalar(db,'SELECT edition_egress_started FROM public.phase9_metadata_provider_calls WHERE id=$1',[call.provider_call_id]),false);
 await assert.rejects(rpc(db,'phase9_finalize_edition_options_provider_call_v1',[...params.slice(0,8),true]),/P9_IDEMPOTENCY_MISMATCH/);
 await assert.rejects(getCall(f,1,'editions'),/P9_STATE_CONFLICT/);
});

import {GoogleBooksAdapter} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter.js';
import {GOOGLE_BOOKS_CAPABILITY} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/index.js';
import {OpenLibraryEditionOptionsAdapter} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/openLibrary/index.js';
import {createMetadataEditionOptionsBoundary} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc.js';
import {decodeMetadataJobContext} from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataJobContext.js';
import {runMetadataWorkerBatch} from '../../../.phase9-dist/workers/phase9-metadata-worker/index.js';
import {completionServiceClient} from './editionOptionsCompletionFixture.mjs';
import {seedAutomaticLineage} from './editionPickerFixture.mjs';
async function queued() {
 const f=await seedOperation(db),lineage=await seedAutomaticLineage(db,f);await resetActor(db);
 await db.query("UPDATE public.phase9_provider_registry SET enabled=true WHERE adapter_key='open_library'");
 await db.query("UPDATE public.image_extraction_candidates SET state='ready' WHERE id=$1",[f.candidateId]);
 await db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[lineage.jobId]);
 await db.query("UPDATE public.image_extraction_jobs SET status='open',attempt_count=0,lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,next_attempt_at=transaction_timestamp() WHERE id=$1",[f.jobId]);
 await setActor(db,f.ownerId,'service_role');return f;
}
function workerTransport({google503=false,googleVerified=false,googleFailure=null,libraryFailures=0,libraryLostResponses=0,afterRegister=null,contextReadFailureAfterRegister=false,lostRegistrationResponses=0,authorFailure=null,failedAuthorFirst=false,malformedEdition=false}={}) {
 const service=completionServiceClient(db),urls=[],registrations=[];let googleRequests=0,contextFailurePending=false;
 const names={
  phase9_register_edition_options_provider_call_v1:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_physical_call_identity','p_call_sequence','p_call_stage'],
  phase9_finish_edition_primary_for_fallback_v1:['p_attempt_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_outcome'],
  phase9_finalize_edition_options_provider_call_v1:['p_provider_call_id','p_job_id','p_worker','p_lease_token','p_attempt_count','p_status','p_outcome','p_retryable','p_egress_started'],
 };
 const client={rpc:async(name,p)=>{
  if(name==='phase9_metadata_job_context' && contextFailurePending){
   contextFailurePending=false;return {data:null,error:new Error('fixture transient context read')};
  }
  if(!names[name])return service.rpc(name,p);
  try {
   const data=await rpc(db,name,names[name].map(key=>p[key]));
   if(name==='phase9_register_edition_options_provider_call_v1'){
    registrations.push(p.p_physical_call_identity);
    if(lostRegistrationResponses-- >0)return {data:null,error:new Error('fixture lost committed registration response')};
    if(contextReadFailureAfterRegister){contextReadFailureAfterRegister=false;contextFailurePending=true;}
    if(afterRegister)await afterRegister();
   }
   return {data,error:null};
  } catch(error){return {data:null,error};}
 }};
 const primary=new GoogleBooksAdapter({mode:'real',apiKey:'fixture',timeoutMs:1000,maxResponseBytes:64000,
  ...(googleVerified?{verifyOptionsRetention:({fetchedAt})=>({storagePermissionVerified:true,permittedDeadlineAt:new Date(Date.parse(fetchedAt)+3600000).toISOString()})}:{}),
  fetcher:async()=>{googleRequests++;
   if(googleFailure==='network')throw new TypeError('fixture connection failure');
   if(googleFailure==='content')return new Response('<html>fixture</html>',{headers:{'content-type':'text/html'}});
   if(googleFailure==='size')return new Response('{}',{headers:{'content-type':'application/json','content-length':'1000000'}});
   return new Response(JSON.stringify({totalItems:0}),{
   status:google503?503:200,headers:{'content-type':'application/json'}});
  }});
 const fallback=new OpenLibraryEditionOptionsAdapter({timeoutMs:1000,maxResponseBytes:64000,fetcher:async address=>{
  const url=new URL(String(address));urls.push(url);
  if(libraryLostResponses-- >0)throw new TypeError('fixture lost attempted OL response');
  if(libraryFailures-- >0)return new Response('{}',{status:503,headers:{'content-type':'application/json'}});
  if(url.pathname==='/authors/OL2A.json' && authorFailure) {
   if(authorFailure==='malformed_response')return new Response('{',{headers:{'content-type':'application/json'}});
   if(authorFailure==='unsupported_content_type')return new Response('invalid',{headers:{'content-type':'text/html'}});
   return new Response('{}',{headers:{'content-type':'application/json','content-length':'64001'}});
  }
  const good={key:'/books/OL100M',title:'The Fixture Book',authors:[{key:malformedEdition?'/authors/OL5A':'/authors/OL1A'}],
   languages:[{key:'/languages/eng'}],isbn_13:['9780306406157'],covers:[123]};
  const broken={...good,key:'/books/OL101M',authors:[{key:'/authors/OL2A'}]};
  const entries=malformedEdition?[{...good,key:'/books/OL101M',publishers:'invalid',
   authors:[1,2,3,4].map(id=>({key:'/authors/OL'+id+'A'}))},good]:
   authorFailure?(failedAuthorFirst?[broken,good]:[good,broken]):[good];
  const raw=url.pathname==='/search.json'?{docs:[{key:'/works/OL1W'}]}:url.pathname.endsWith('/editions.json')?
   {entries}:{key:url.pathname.replace(/\.json$/,''),name:'Fixture Author'};
  return new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}});
 }});
 const dependencies={workerId:worker,workerAuthToken:'fixture',serviceClient:client,primary,
  primaryCapability:GOOGLE_BOOKS_CAPABILITY,editionFallback:fallback,editionOptionsBoundary:createMetadataEditionOptionsBoundary(client)};
 return {urls,registrations,googleRequests:()=>googleRequests,run:()=>runMetadataWorkerBatch(1,dependencies)};
}
test('actual public M73 context decodes through the M38 v2 wrapper',async()=>{
 const f=await olCall(),lineage=await seedAutomaticLineage(db,f);await resetActor(db);
 await db.query("UPDATE public.image_extraction_candidates SET state='ready' WHERE id=$1",[f.candidateId]);
 await db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1",[lineage.jobId]);
 await setActor(db,f.ownerId,'service_role');
 const context=await rpc(db,'phase9_metadata_job_context',[f.jobId,worker,token,f.attempt]);
 assert.equal(context.contractVersion,'p9-metadata-job-context-v2');
 assert.equal(context.currentAttemptAdapterKey,'open_library');
 assert.equal(decodeMetadataJobContext(context).purpose,'edition_options');
});
test('compiled OL worker persists full-stack results and counts three actual GET receipts',async()=>{
 const f=await queued(),t=workerTransport();
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 assert.equal(t.googleRequests(),0);assert.equal(t.urls.length,3);
 await resetActor(db);
 assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_metadata_provider_calls WHERE job_id=$1 AND edition_egress_started=true',[f.jobId]),3);
 await setActor(db,f.ownerId);assert.equal((await scalar(db,readSql(f))).rows[0].googleBooksUrl,'https://openlibrary.org/books/OL100M');
});
test('compiled Google technical failure uses one real OL secondary with the primary usage reservation',async()=>{
 const f=await queued(),t=workerTransport({google503:true,googleVerified:true});
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 assert.equal(t.googleRequests(),1);assert.equal(t.urls.length,3);
 await resetActor(db);
 const attempts=(await db.query('SELECT adapter_key,provider_role,normalized_outcome FROM public.metadata_enrichment_attempts WHERE lookup_id=(SELECT id FROM public.phase9_metadata_lookups WHERE job_id=$1) ORDER BY attempt_sequence',[f.jobId])).rows;
 assert.deepEqual(attempts.map(row=>[row.adapter_key,row.provider_role]),[['google_books','primary'],['open_library','secondary']]);
 assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_usage_reservations WHERE job_id=$1',[f.jobId]),1);
});
test('an OL-secondary retry resumes OL without repeating the failed Google request',async()=>{
 const f=await queued(),t=workerTransport({google503:true,googleVerified:true,libraryFailures:1});
 assert.equal((await t.run()).results[0].outcome,'retry_scheduled');
 await resetActor(db);await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
 await setActor(db,f.ownerId,'service_role');
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 assert.equal(t.googleRequests(),1);assert.equal(t.urls.length,4);
});
test('a fresh-fence failure after registration records no egress and sends no HTTP',async()=>{
 const f=await queued(),t=workerTransport({afterRegister:async()=>{
  await resetActor(db);
  await db.query('UPDATE public.phase9_candidate_edition_state SET request_generation=request_generation+1 WHERE candidate_id=$1',[f.candidateId]);
  await setActor(db,f.ownerId,'service_role');
 }});
 await t.run();assert.equal(t.urls.length,0);
 await resetActor(db);
 assert.equal(await scalar(db,'SELECT edition_egress_started FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.jobId]),false);
});

test('a transient post-registration context failure retries on a new claim without repeating a known-unsent GET',async()=>{
 const f=await queued(),t=workerTransport({contextReadFailureAfterRegister:true});
 assert.equal((await t.run()).results[0].outcome,'retry_scheduled');
 assert.equal(t.urls.length,0);await resetActor(db);
 assert.equal(await scalar(db,'SELECT edition_egress_started FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.jobId]),false);
 await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
 await setActor(db,f.ownerId,'service_role');
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 assert.equal(t.urls.length,3);await resetActor(db);
 assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_metadata_provider_calls WHERE job_id=$1 AND edition_egress_started=true',[f.jobId]),3);
});
test('a lost registration response is reconciled by exact replay and never sends HTTP under uncertainty',async()=>{
 const f=await queued(),t=workerTransport({lostRegistrationResponses:1});
 assert.equal((await t.run()).results[0].outcome,'retry_scheduled');assert.equal(t.urls.length,0);
 assert.equal(t.registrations.length,2);assert.equal(t.registrations[0],t.registrations[1]);await resetActor(db);
 assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.jobId]),1);
 assert.equal(await scalar(db,'SELECT edition_egress_started FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.jobId]),false);
 await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
 await setActor(db,f.ownerId,'service_role');assert.equal((await t.run()).results[0].outcome,'edition_options_available');
});

test('an OL primary cannot relabel a Google lookup',async()=>{
 await assert.rejects(olCall({lookupAdapter:'google_books'}),/P9_STATE_CONFLICT/);
});
test('an unproven OL egress receipt cannot authorize another stage or completion',async()=>{
 const f=await olCall(),call=await getCall(f,0,'search');
 await finalize(db,{...f,callId:call.provider_call_id},'no_acceptable_match');
 await assert.rejects(getCall(f,1,'editions'),/P9_STATE_CONFLICT/);
 await assert.rejects(complete(db,f,{...olRows(f),rows:[]}),/P9_STATE_CONFLICT/);
});
test('a mismatched secondary registry policy version denies OL before HTTP',async()=>{
 const f=await queued(),t=workerTransport({google503:true,googleVerified:true});
 await resetActor(db);await db.query("UPDATE public.phase9_provider_registry SET policy_version=2 WHERE adapter_key='open_library'");
 await setActor(db,f.ownerId,'service_role');assert.equal((await t.run()).results[0].outcome,'retry_scheduled');
 assert.equal(t.googleRequests(),1);assert.equal(t.urls.length,0);
 await resetActor(db);assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_metadata_provider_calls WHERE job_id=$1 AND edition_call_sequence IS NOT NULL',[f.jobId]),0);
 await db.query("UPDATE public.phase9_provider_registry SET policy_version=1 WHERE adapter_key='open_library'");
});

test('the compiled OL result survives Owner selection, Save/resume, Add replay and confirmed cleanup',async()=>{
 const f=await queued(),selling=await reviewValue(db,f),t=workerTransport();
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 await setActor(db,f.ownerId);const choices=await scalar(db,readSql(f));
 const selected=await scalar(db,selectSql(f,choices,choices.rows[0].optionId));
 const chosen=await reviewValue(db,f);
 await saveReview(db,f,{...chosen,originalFieldConfirmation:{title:true,authors:chosen.authors.map(()=>true)}});
 const detail=await scalar(db,"SELECT public.phase9_owner_candidate_detail_v2('"+f.sessionId+"','"+f.candidateId+"')");
 const batch=await scalar(db,"SELECT public.phase9_owner_batch_review_v1('"+f.sessionId+"')");
 assert.equal(detail.metadata.snapshot.coverReference,'https://covers.openlibrary.org/b/id/123-M.jpg');
 assert.equal(batch.items[0].metadataSummary.coverReference,'https://covers.openlibrary.org/b/id/123-M.jpg');
 assert.equal(detail.metadata.selectionId,selected.selection.selectionId);
 const sql=await currentCommitSql(db,f),added=await scalar(db,sql),replayed=await scalar(db,sql);
 assert.equal(added.inventoryId,replayed.inventoryId);await resetActor(db);
 const item=(await db.query('SELECT * FROM public.store_inventory WHERE id=$1',[added.inventoryId])).rows[0];
 assert.equal(item.cover_url,'https://covers.openlibrary.org/b/id/123-M.jpg');
 assert.equal(item.title,'The Fixture Book');assert.deepEqual(item.authors,['Fixture Author']);
 assert.equal(item.quantity_total,selling.quantity);assert.equal(item.selling_price_minor,selling.priceMinor);
 assert.equal(item.canonical_edition_id,null);assert.equal(item.visibility_status,'draft');
 const state=(await db.query('SELECT options,selected_option_snapshot FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0];
 assert.deepEqual(state.options,[]);assert.equal(state.selected_option_snapshot.providerRecordId,'OL100M');
 assert.equal(await scalar(db,'SELECT count(*) FROM public.store_inventory WHERE created_from_candidate_id=$1',[f.candidateId]),1);
});

for (const [googleFailure,expected] of [['network','network_failure'],['content','unsupported_content_type'],['size','response_too_large']]) {
 test('Google '+expected+' uses the independently permitted OL secondary',async()=>{
  const f=await queued(),t=workerTransport({googleVerified:true,googleFailure});
  assert.equal((await t.run()).results[0].outcome,'edition_options_available');
  assert.equal(t.googleRequests(),1);assert.equal(t.urls.length,3);await resetActor(db);
  const a=(await db.query('SELECT adapter_key,provider_role,normalized_outcome,predecessor_outcome FROM public.metadata_enrichment_attempts WHERE lookup_id=(SELECT id FROM public.phase9_metadata_lookups WHERE job_id=$1) ORDER BY attempt_sequence',[f.jobId])).rows;
  assert.equal(a[0].normalized_outcome,expected);assert.equal(a[1].predecessor_outcome,expected);
 });
}

test('M73 preserves the existing Google representative cover when the selected record has no cover',async()=>{
 const f=await originalSelection(db,await seedCard(db));
 const batch=await scalar(db,"SELECT public.phase9_owner_batch_review_v1('"+f.sessionId+"')");
 assert.equal(batch.items[0].metadataSummary.coverReference,null);
 assert.equal(batch.items[0].metadataSummary.representativeCover?.sourceRecordId,'old-alternate');
 assert.equal(batch.items[0].metadataSummary.representativeCover?.coverReference,'https://books.google.com/books/content?id=old-alternate');
 assert.equal(batch.items[0].fieldSources.cover,'representative');
});

test('a lost OL HTTP response is accounted before a bounded fresh-claim retry and is never replayed in the old claim',async()=>{
 const f=await queued(),t=workerTransport({libraryLostResponses:1});
 assert.equal((await t.run()).results[0].outcome,'retry_scheduled');
 assert.equal(t.urls.length,1);await resetActor(db);
 const readCalls=()=>db.query('SELECT physical_call_identity,claim_attempt_number,status,edition_egress_started FROM public.phase9_metadata_provider_calls WHERE job_id=$1 ORDER BY created_at,id',[f.jobId]);
 const initial=(await readCalls()).rows;
 assert.equal(initial.length,1);assert.equal(initial[0].status,'outcome_unknown');
 assert.equal(initial[0].edition_egress_started,true);assert.equal(initial[0].claim_attempt_number,1);
 await setActor(db,f.ownerId,'service_role');
 assert.equal((await t.run()).results.length,0);assert.equal(t.urls.length,1);
 await resetActor(db);
 await db.query("UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id=$1",[f.jobId]);
 await setActor(db,f.ownerId,'service_role');
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 assert.equal(t.urls.length,4);assert.equal(t.googleRequests(),0);await resetActor(db);
 const calls=(await readCalls()).rows;
 assert.deepEqual(calls[0],initial[0]);
 assert.equal(calls.length,4);assert.equal(new Set(calls.map(call=>call.physical_call_identity)).size,4);
 assert.deepEqual(calls.map(call=>call.claim_attempt_number),[1,2,2,2]);
 assert.deepEqual(calls.map(call=>call.status),['outcome_unknown','finalized','finalized','finalized']);
 assert.equal(calls.every(call=>call.edition_egress_started===true),true);
 assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_usage_reservations WHERE job_id=$1',[f.jobId]),1);
});


test('compiled M74 worker skips malformed factual rows before spending the author budget',async()=>{
 const f=await queued(),t=workerTransport({malformedEdition:true});
 assert.equal((await t.run()).results[0].outcome,'edition_options_available');
 assert.deepEqual(t.urls.map(url=>url.pathname),['/search.json','/works/OL1W/editions.json','/authors/OL5A.json']);
 await setActor(db,f.ownerId);const choices=await scalar(db,readSql(f));
 assert.deepEqual(choices.rows.map(row=>row.eligibility),['unavailable','eligible']);
 assert.equal(choices.rows[1].googleBooksUrl,'https://openlibrary.org/books/OL100M');
 assert.deepEqual(choices.rows[1].metadata.authors,['Fixture Author']);
});
for(const authorFailure of ['malformed_response','unsupported_content_type','response_too_large']) {
 for(const failedAuthorFirst of [true,false]) test('compiled M74 worker retains independent rows after '+authorFailure
  +', failed author first='+failedAuthorFirst,async()=>{
  const f=await queued(),t=workerTransport({authorFailure,failedAuthorFirst});
  assert.equal((await t.run()).results[0].outcome,'edition_options_available');
  assert.equal(t.googleRequests(),0);assert.equal(t.urls.length,4);
  await resetActor(db);
  const receipts=(await db.query('SELECT status,normalized_outcome,logical_outcome,edition_call_stage,edition_egress_started FROM public.phase9_metadata_provider_calls WHERE job_id=$1 ORDER BY edition_call_sequence',[f.jobId])).rows;
  assert.equal(receipts.length,4);
  const failed=receipts.find(row=>row.edition_call_stage==='author:OL2A');
  assert.equal(failed.normalized_outcome,authorFailure);assert.equal(failed.logical_outcome,authorFailure);
  assert.ok(receipts.every(row=>row.status==='finalized' && row.edition_egress_started===true));
  assert.equal(await scalar(db,'SELECT count(*) FROM public.phase9_usage_reservations WHERE job_id=$1',[f.jobId]),1);
  assert.equal(await scalar(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),1);
  await setActor(db,f.ownerId);const choices=await scalar(db,readSql(f));
  assert.deepEqual(choices.rows.map(row=>row.ordinal),[0,1]);
  assert.equal(choices.rows[failedAuthorFirst?0:1].eligibility,'unavailable');
  assert.equal(choices.rows[failedAuthorFirst?1:0].googleBooksUrl,'https://openlibrary.org/books/OL100M');
  assert.deepEqual(choices.rows[failedAuthorFirst?1:0].metadata.authors,['Fixture Author']);
 });
}
