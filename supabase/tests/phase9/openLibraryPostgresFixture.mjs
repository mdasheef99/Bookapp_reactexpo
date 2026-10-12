// Picker §§4.3/9/13.14: native M73 command fixtures, synthetic local records only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {json,owner,q,rpcSql,service,sql} from './editionPickerPostgresConnections.mjs';
import {card,choices,completeSql,fence,lookupSql,result,save,selectSql,worker} from './editionPickerPostgresFixture.mjs';
export async function enableLibrary(enabled=true) {
 await sql("UPDATE public.phase9_provider_registry SET enabled="+enabled+",matching_allowed=true,storage_allowed=true,policy_version=1 WHERE adapter_key='open_library'");
}
async function claim(f,jobId) {
 const rows=await service("SELECT coalesce(json_agg(c),'[]') FROM public.claim_phase9_metadata_jobs(10,"+q(worker)+") c");
 const found=rows.find(row=>row.id===jobId);
 assert.ok(found,'real SKIP LOCKED claim must include this explicit request');
 const p={...f,jobId,token:found.lease_token,attempt:found.attempt_count};
 p.context=await service(rpcSql('phase9_metadata_job_context',[jobId,worker,p.token,p.attempt]));
 return p;
}
async function bind(p) {
 const base=[p.jobId,worker,p.token,p.attempt];
 const lookup=await service(rpcSql('phase9_register_structural_metadata_lookup',[...base,
  p.candidateId,p.context.candidateVersion,p.context.queryIdentity,'edition-options:'+p.jobId,
  'open_library','1.0.0','open-library-capability-v1','p9-metadata-foundation-v1','bibliographic',
  'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private',
  '1','p9-metadata-cache-v1','metadata-v1',null]));
 p.lookupId=lookup.lookup_id;
 const usage=await service(rpcSql('phase9_reserve_metadata_usage',[...base,p.lookupId,'open_library','1.0.0',1]));
 p.reservationId=usage.reservation_id;
 if(!p.attemptId) {
  const attempt=await service(rpcSql('phase9_register_structural_metadata_attempt',[p.lookupId,...base,
   p.candidateId,p.context.candidateVersion,randomUUID(),'edition-options:'+p.jobId,'primary',1,
   'open_library','1.0.0','open-library-capability-v1','p9-metadata-foundation-v1',
   'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',p.reservationId]));
  p.attemptId=attempt.attempt_id;
 }
 return p;
}
export async function olOperation(f=null) {
 f??=await card();
 const receipt=await owner(lookupSql(f,(await choices(f)).requestGeneration),f);
 // A refresh is a new logical request; never reuse the prior completed attempt.
 return bind({...await claim(f,receipt.operationId),attemptId:null});
}
export const registerSql=(p,sequence=0,stage='search',identity=randomUUID())=>
 rpcSql('phase9_register_edition_options_provider_call_v1',[p.attemptId,p.jobId,worker,p.token,p.attempt,identity,sequence,stage]);
export const finishSql=(p,call,status='finalized',outcome='no_acceptable_match',retryable=false,egress=true)=>
 rpcSql('phase9_finalize_edition_options_provider_call_v1',[call.provider_call_id,p.jobId,worker,p.token,p.attempt,status,outcome,retryable,egress]);
export async function olHttp(p,sequence,stage) {
 const call=await service(registerSql(p,sequence,stage));await service(finishSql(p,call));return call;
}
export async function successfulReads(p) {
 for(const [sequence,stage] of [[0,'search'],[1,'editions'],[2,'author:OL1A']])await olHttp(p,sequence,stage);
}
export function olResult(p,overrides={}) {
 const r=result(p,overrides);
 r.rows=r.rows.map((row,index)=>({...row,googleBooksUrl:'https://openlibrary.org/books/OL'+(100+index)+'M',
  metadata:{...row.metadata,adapterKey:'open_library',providerRecordId:'OL'+(100+index)+'M',
   coverReference:index?null:'https://covers.openlibrary.org/b/id/123-M.jpg'}}));
 return r;
}
export async function olChosen(f=null) {
 const p=await olOperation(f);await successfulReads(p);
 const r=olResult(p);assert.equal((await service(completeSql(p,r))).status,'completed');
 f={...p,operation:p,result:r,choices:await choices(p)};
 f.selected=await owner(selectSql(f,f.choices,r.rows[0].optionId),f);await save(f);return f;
}
export const calls=p=>json("SELECT coalesce(json_agg(pc ORDER BY claim_attempt_number,edition_call_sequence),'[]') FROM public.phase9_metadata_provider_calls pc WHERE job_id="+q(p.jobId));
export const usage=p=>json("SELECT coalesce(json_agg(r),'[]') FROM public.phase9_usage_reservations r WHERE job_id="+q(p.jobId));
export async function retryAfterUnknown(p) {
 assert.equal((await service(rpcSql('phase9_fail_candidate_edition_options_v1',[...fence(p),'network_failure',true]))).status,'retry_scheduled');
 // Fixture clock acceleration only; the production transition above schedules the real one-minute delay.
 await sql("UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()-interval '1 second' WHERE id="+q(p.jobId));
 return bind({...await claim(p,p.jobId),attemptId:p.attemptId});
}
