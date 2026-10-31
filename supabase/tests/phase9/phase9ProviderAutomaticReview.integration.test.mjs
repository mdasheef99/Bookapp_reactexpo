// S1/S2/S3/S5/S7: 02c §§3.2/4.2/4.3/9 (AC8-9a/10/11/14).
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,genericHashes,needs,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {completionFootprint} from './leanCatalogueCompletionFixture.mjs';
import {rpc} from './editionOptionsCompletionFixture.mjs';
import {beginAutomatic,failureResult,installSingleProvider,olAutomaticRoute,retainedOlResult,singleReceipt} from './providerAutomaticReviewFixture.mjs';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});
const ready=t=>needs(t,db,'public.phase9_complete_automatic_metadata_v1(jsonb)','8a-4');
const complete=async fixture=>{await setActor(db,fixture.f.ownerId,'service_role');return rpc(db,'phase9_complete_automatic_metadata_v1',[fixture.command]);};

test('S1 installed single-call provider completes without replacing a generic function',async t=>{
  if(!await ready(t))return;
  const frozen=await genericHashes(db);
  await installSingleProvider(db);
  assert.deepEqual(await genericHashes(db),frozen);
  const fixture=await beginAutomatic(db,{key:'synthetic_catalogue'});
  await singleReceipt(db,fixture);
  assert.equal((await complete(fixture)).outcome,'accepted_metadata_match');
  assert.deepEqual(await genericHashes(db),frozen);
});

test('S2 two editions tied on the exact ISBN complete as ambiguous without selecting either',async t=>{
  if(!await ready(t))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'});
  await retainedOlResult(db,fixture,2);
  const receipt=await complete(fixture);
  assert.equal(receipt.outcome,'ambiguous');assert.equal(receipt.selectedOptionId,null);
  await resetActor(db);
  assert.equal(await value(db,'SELECT coherent_edition FROM public.phase9_selected_metadata_snapshots WHERE id=$1',[receipt.snapshotId]),null);
  await setActor(db,fixture.f.ownerId,'service_role');
  assert.deepEqual(await rpc(db,'phase9_recover_automatic_metadata_v1',[fixture.command.fence]),{...receipt,status:'replayed'});
});

test('P1 fan-out receipts without a bound row cannot authorize a coherent selected snapshot',async t=>{
  if(!await ready(t))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'});
  await retainedOlResult(db,fixture);
  // The physical receipts remain valid, but carry no selected bytes. Removing
  // the list and companion leaves only the unproved submitted selection.
  fixture.command.result.rows=null;
  fixture.command.result.catalogueCompanions=null;
  fixture.command.result.retention=null;
  fixture.command.selectedOptionId=null;
  await resetActor(db);
  const calls=(await db.query(`SELECT edition_call_sequence,edition_call_stage,status,edition_egress_started,
    retryable,normalized_outcome,logical_outcome,normalized_candidate,match_evidence
    FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=$1 ORDER BY created_at,id`,[fixture.f.attemptId])).rows;
  const receipts=calls.map(c=>({callSequence:c.edition_call_sequence,callStage:c.edition_call_stage,status:c.status,
    egressStarted:c.edition_egress_started,retryable:c.retryable,normalizedOutcome:c.normalized_outcome,
    logicalOutcome:c.logical_outcome,normalizedCandidate:c.normalized_candidate,matchEvidence:c.match_evidence}));
  const envelope={providerRole:'primary',primaryAdapterKey:'open_library',predecessorOutcome:'local_insufficient',
    queryKind:'isbn',rows:[],terminalReceipt:receipts.at(-1),receipts};
  assert.deepEqual((await db.query('SELECT * FROM marketplace_sec.phase9_provider_call_contract_v1($1,$2,$3)',
    ['open_library','2.0.0',envelope])).rows[0],{valid:true,logical_outcome:'no_acceptable_match'});
  const before=await completionFootprint(db);
  await assert.rejects(()=>complete(fixture),/P9_AUTO_SOURCE_INVALID/);
  assert.equal(await completionFootprint(db),before,'refusal leaves no snapshot, canonical effect or spend change');
});

test('P1 coherent fan-out winner retains its exact row and companion binding',async t=>{
  if(!await ready(t))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'});
  await retainedOlResult(db,fixture);
  const receipt=await complete(fixture);
  assert.equal(receipt.outcome,'accepted_metadata_match');
  assert.equal(receipt.selectedOptionId,fixture.command.result.rows[0].optionId);
  await resetActor(db);
  assert.deepEqual(await value(db,'SELECT coherent_edition FROM public.phase9_selected_metadata_snapshots WHERE id=$1',
    [receipt.snapshotId]),fixture.command.result.rows[0].metadata);
});

for(const mode of ['mismatched row','missing companion'])test(`P1 coherent fan-out rejects ${mode} atomically`,async t=>{
  if(!await ready(t))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'});
  await retainedOlResult(db,fixture);
  if(mode==='mismatched row') {
    const selected={...fixture.command.result.outcome.selected,providerRecordId:'OL999M'};
    fixture.command.result.outcome.selected=selected;
    fixture.command.result.outcome.candidates=[selected];
  } else fixture.command.result.catalogueCompanions=[];
  const before=await completionFootprint(db);
  await assert.rejects(()=>complete(fixture),mode==='mismatched row'?/P9_EDITION_ROWS_INVALID/:/P9_CATALOGUE_COMPANION_INVALID/);
  assert.equal(await completionFootprint(db),before);
});

test('S2 success fan-out receipts cannot justify a forged technical outcome',async t=>{
  if(!await ready(t))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'});
  await retainedOlResult(db,fixture,2);
  Object.assign(fixture.command.result.outcome,{outcome:'schema_invalid',candidates:[],selected:null,evidence:[]});
  fixture.command.result.rows=null;fixture.command.result.catalogueCompanions=null;fixture.command.result.retention=null;
  const before=await completionFootprint(db);
  await assert.rejects(()=>complete(fixture),/P9_AUTO_SOURCE_INVALID/);
  assert.equal(await completionFootprint(db),before);
});

test('S2 an empty fan-out result cannot be reported as ambiguous',async t=>{
  if(!await ready(t))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'});
  await retainedOlResult(db,fixture,2);
  fixture.command.result.rows=[];
  fixture.command.result.catalogueCompanions=[];
  Object.assign(fixture.command.result.outcome,{candidates:[],selected:null,evidence:[]});
  const before=await completionFootprint(db);
  await assert.rejects(()=>complete(fixture),/P9_AUTO_SOURCE_INVALID/);
  assert.equal(await completionFootprint(db),before);
});

test('S3 first automatic completion atomically saves a valid representative cover and replays it',async t=>{
  if(!await ready(t))return;
  const fixture=await beginAutomatic(db),o=fixture.command.result.outcome;
  const alternate={...o.selected,providerRecordId:'alternate-record',coverReference:'https://books.google.com/books/content?id=alternate-record'};
  o.candidates.push(alternate);
  o.representativeCover={coverReference:alternate.coverReference,sourceRelation:'representative_edition',
    sourceProviderRecordId:alternate.providerRecordId,selectionPolicyVersion:'p9-representative-cover-v1',
    matchEvidence:['exact_title','exact_author_set','language_compatible']};
  await singleReceipt(db,fixture);
  const receipt=await complete(fixture);
  assert.equal(receipt.outcome,'accepted_metadata_match');
  await resetActor(db);
  assert.equal(await value(db,'SELECT cover_reference FROM marketplace_sec.phase9_metadata_representative_covers WHERE source_attempt_id=$1',
    [fixture.f.attemptId]),alternate.coverReference);
  const footprint=await completionFootprint(db);
  assert.deepEqual(await complete(fixture),{...receipt,status:'replayed'});
  assert.equal(await completionFootprint(db),footprint);
});

test('S5 exhausted automatic job records its dead-letter timestamp and safe error',async t=>{
  if(!await ready(t))return;
  const fixture=await beginAutomatic(db,{claim:5});failureResult(fixture.command);
  await singleReceipt(db,fixture);
  assert.equal((await complete(fixture)).outcome,'technical_failure');
  await resetActor(db);
  const job=await value(db,'SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id=$1',[fixture.f.jobId]);
  assert.equal(job.status,'dead_letter');assert.ok(job.dead_lettered_at);
  assert.equal(job.dead_lettered_at,job.completed_at);
  assert.equal(job.last_safe_error_code,'P9_METADATA_ATTEMPTS_EXHAUSTED');
  assert.equal(job.last_safe_error_category,'metadata');assert.equal(job.lease_owner,null);
});

test('S5 resolved automatic job clears a previous retry error',async t=>{
  if(!await ready(t))return;
  const fixture=await beginAutomatic(db);await singleReceipt(db,fixture);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET last_safe_error_code='P9_METADATA_TECHNICAL_RETRY',last_safe_error_category='metadata' WHERE id=$1",[fixture.f.jobId]);
  await complete(fixture);await resetActor(db);
  const job=await value(db,'SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id=$1',[fixture.f.jobId]);
  assert.equal(job.status,'resolved');assert.equal(job.dead_lettered_at,null);
  assert.equal(job.last_safe_error_code,null);assert.equal(job.last_safe_error_category,null);
});

test('S7 a nonretryable physical receipt cannot be submitted as retryable even on claim five',async t=>{
  if(!await ready(t))return;
  const fixture=await beginAutomatic(db,{claim:5});failureResult(fixture.command);
  await singleReceipt(db,fixture,{retryable:false});
  const before=await completionFootprint(db);
  await assert.rejects(()=>complete(fixture),/P9_AUTO_SOURCE_INVALID/);
  assert.equal(await completionFootprint(db),before);
});
