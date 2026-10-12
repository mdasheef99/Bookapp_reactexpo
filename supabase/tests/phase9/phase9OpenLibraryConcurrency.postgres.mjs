// Picker §§4.3/7/9/13.14: native M74 replay/accounting, independent psql connections.
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {owner,q,race,rpcSql,service,sql,verifyConnectionsClosed} from './editionPickerPostgresConnections.mjs';
import {addSql,assertCommitted,choices,completeSql,expire,inventory,options,ownerAction,provider,readSql,save,state,workerAction} from './editionPickerPostgresFixture.mjs';
import {calls,enableLibrary,finishSql,olChosen,olHttp,olOperation,olResult,registerSql,retryAfterUnknown,successfulReads,usage} from './openLibraryPostgresFixture.mjs';
before(async()=>{await provider();await enableLibrary();console.log('OL_NATIVE_STACK: M01-M62 (M09 excluded), M65-M74; M63/M64 excluded');});
after(verifyConnectionsClosed);
const accepted=value=>{if(!value.ok)throw value.error;return value.value;};
const rejected=(value,pattern)=>{assert.equal(value.ok,false);assert.match(value.error.message,pattern);};

test('OL native: identical concurrent registration records exactly one physical identity',async()=>{
 const p=await olOperation(),command=registerSql(p,0,'search',randomUUID());
 const r=await race('ol-register-replay',workerAction(command),workerAction(command));
 assert.deepEqual(accepted(r.contender),r.held);
 const receipts=await calls(p);assert.equal(receipts.length,1);assert.equal(receipts[0].edition_egress_started,null);
 assert.equal((await usage(p)).length,1);
});
test('OL native: competing identities at one sequence cannot authorize two physical requests',async()=>{
 const p=await olOperation();
 const r=await race('ol-register-conflict',workerAction(registerSql(p)),workerAction(registerSql(p)));
 rejected(r.contender,/P9_IDEMPOTENCY_MISMATCH/);assert.equal((await calls(p)).length,1);
});
test('OL native: concurrent finalization replays one immutable egress receipt',async()=>{
 const p=await olOperation(),call=await service(registerSql(p)),command=finishSql(p,call);
 const r=await race('ol-finalize-replay',workerAction(command),workerAction(command));
 assert.equal(r.held.status,'finalized');assert.equal(accepted(r.contender).status,'finalized');
 const receipts=await calls(p);assert.equal(receipts.length,1);assert.equal(receipts[0].edition_egress_started,true);
 assert.deepEqual(await service(command),r.held);
});
test('OL native: a known-unsent cancellation cannot be relabelled as attempted egress',async()=>{
 const p=await olOperation(),call=await service(registerSql(p));
 const r=await race('ol-unsent-relabel',workerAction(finishSql(p,call,'stale_rejected','cancelled',false,false)),
  workerAction(finishSql(p,call)));
 rejected(r.contender,/P9_IDEMPOTENCY_MISMATCH/);
 const receipt=(await calls(p))[0];assert.equal(receipt.edition_egress_started,false);assert.equal(receipt.status,'stale_rejected');
 await assert.rejects(service(registerSql(p,1,'editions')),/P9_STATE_CONFLICT/);
});
test('OL native: concurrent completion persists one option set and consumes one logical reservation',async()=>{
 const p=await olOperation();await successfulReads(p);
 const rows=olResult(p),command=completeSql(p,rows);
 const r=await race('ol-complete-replay',workerAction(command),workerAction(command));
 assert.equal(r.held.status,'completed');assert.equal(accepted(r.contender).status,'replayed');
 assert.equal((await options(p)).options_version,1);assert.deepEqual((await options(p)).options,rows.rows);
 const receipts=await calls(p);assert.equal(receipts.length,3);assert.ok(receipts.every(row=>row.status==='finalized' && row.edition_egress_started===true));
 const reservations=await usage(p);assert.equal(reservations.length,1);assert.equal(reservations[0].status,'consumed');
});
for(const order of ['add-first','completion-first'])test('OL native: '+order+' keeps the confirmed inventory edition immutable',async()=>{
 const f=await olChosen();await expire(f);
 const p=await olOperation(f);await successfulReads(p);
 const completion=completeSql(p,olResult(p,{publisher:'Late OL response'})),add=await addSql(f);
 const left=order==='add-first'?ownerAction(add,f):workerAction(completion);
 const right=order==='add-first'?workerAction(completion):ownerAction(add,f);
 const r=await race('ol-'+order,left,right);
 if(order==='add-first'){assert.equal(r.held.outcome,'committed_private');assert.equal(accepted(r.contender).status,'stale_rejected');}
 else{assert.equal(r.held.status,'completed');assert.equal(accepted(r.contender).outcome,'committed_private');}
 await assertCommitted(f);assert.equal((await service(completion)).status,'stale_rejected');
 assert.equal((await calls(p)).length,3);assert.equal((await options(f)).selected_option_snapshot.publisher,f.selected.selection.snapshot.publisher);
});
test('OL native: unknown response remains immutable across an accounted fresh-claim retry',async()=>{
 const p=await olOperation(),call=await service(registerSql(p));
 await service(finishSql(p,call,'outcome_unknown','network_failure',true,true));
 const before=(await calls(p))[0],next=await retryAfterUnknown(p);
 assert.equal(next.attempt,p.attempt+1);assert.notEqual(next.token,p.token);
 await assert.rejects(service(registerSql(p,1,'editions')),/P9_/);
 await successfulReads(next);assert.equal((await service(completeSql(next,olResult(next)))).status,'completed');
 const receipts=await calls(p);assert.equal(receipts.length,4);assert.deepEqual(receipts[0],before);
 assert.equal(new Set(receipts.map(row=>row.physical_call_identity)).size,4);
 assert.deepEqual(receipts.map(row=>row.claim_attempt_number),[1,2,2,2]);
 assert.equal((await usage(p)).length,1);assert.equal((await usage(p))[0].status,'consumed');
});
test('OL native: expired claims and disabled policy deny new calls while preserving saved selection',async()=>{
 const held=await olChosen(),p=await olOperation();
 await sql("UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id="+q(p.jobId));
 await assert.rejects(service(registerSql(p)),/P9_/);
 assert.equal((await service(completeSql(p,olResult(p)))).status,'stale_rejected');assert.deepEqual(await calls(p),[]);
 const fresh=await olOperation();await enableLibrary(false);
 try{
  await assert.rejects(service(registerSql(fresh)),/P9_STATE_CONFLICT/);assert.deepEqual(await calls(fresh),[]);
  const resumed=await choices(held);assert.deepEqual(resumed.rows,[]);assert.equal(resumed.selection.confirmedByOwner,true);
  await save(held,{priceMinor:1777});assert.equal((await owner(await addSql(held),held)).outcome,'committed_private');await assertCommitted(held);
 }finally{await enableLibrary();}
});
test('OL native: cleanup failure rolls back Add and exact retry has one inventory effect',async()=>{
 const f=await olChosen(),before=await options(f),candidateBefore=await state(f),command=await addSql(f);
 await sql("ALTER TABLE public.phase9_candidate_edition_state ADD CONSTRAINT ol_native_cleanup_failure CHECK(candidate_id<>"+q(f.candidateId)+"::uuid OR options<>'[]'::jsonb)");
 try{
  await assert.rejects(owner(command,f),/ol_native_cleanup_failure/);
  assert.deepEqual(await inventory(f),[]);assert.deepEqual(await options(f),before);assert.deepEqual(await state(f),candidateBefore);
 }finally{await sql('ALTER TABLE public.phase9_candidate_edition_state DROP CONSTRAINT ol_native_cleanup_failure');}
 const receipt=await owner(command,f);assert.deepEqual(await owner(command,f),receipt);await assertCommitted(f);
});
test('OL native: Owner and tenant boundaries deny foreign choices and physical-call registration',async()=>{
 const f=await olChosen(),other=await olChosen(),p=await olOperation();
 await assert.rejects(owner(readSql(f),other),/P9_/);
 await assert.rejects(sql(registerSql(p),'authenticated',f.ownerId),/permission denied/);
 await assert.rejects(sql(registerSql(p),'anon'),/permission denied/);
 assert.deepEqual(await calls(p),[]);
});

test('OL native: author-content finalization unblocks continuation without losing the failed receipt',async()=>{
 const p=await olOperation();await olHttp(p,0,'search');await olHttp(p,1,'editions');
 const bad=await service(registerSql(p,2,'author:OL2A'));
 const r=await race('ol-author-content-continuation',
  workerAction(finishSql(p,bad,'finalized','malformed_response',false,true)),
  workerAction(registerSql(p,3,'author:OL1A')));
 assert.equal(r.held.status,'finalized');const next=accepted(r.contender);
 assert.equal(next.status,'registered');await service(finishSql(p,next));
 const result=olResult(p);
 result.rows=[{optionId:randomUUID(),ordinal:0,googleBooksUrl:null,eligibility:'unavailable',metadata:null},
  {...result.rows[0],ordinal:1,metadata:{...result.rows[0].metadata,matchRationale:'confirmation_required_text_evidence'}}];
 assert.equal((await service(completeSql(p,result))).status,'completed');
 const receipts=await calls(p);assert.equal(receipts.length,4);
 assert.equal(receipts[2].normalized_outcome,'malformed_response');
 assert.equal(receipts[2].logical_outcome,'malformed_response');
 assert.ok(receipts.every(row=>row.status==='finalized' && row.edition_egress_started===true));
 assert.equal((await usage(p)).length,1);assert.equal((await usage(p))[0].status,'consumed');
 const resumed=await choices(p);
 assert.deepEqual(resumed.rows.map(row=>row.eligibility),['unavailable','eligible']);
});
