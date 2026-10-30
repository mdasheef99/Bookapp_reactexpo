// 02c §4.2 AC8-12 A–J: preserve private completion/selection/Add while denying permanent reuse.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { automaticGoogleCommand, automaticProviderCommand, clean, createProviderDatabase, footprint, noSharedChange, permissive, resetActor, sourcePolicy, value } from './providerReplacementFixture.mjs';
import { add, automaticCard, facts, readSql, saveReview, seedIncumbent, selectionBytes, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { complete, completeV2, finalize, prepareCall, resultRows, rpc, seedOperation, token, worker } from './editionOptionsCompletionFixture.mjs';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});

for(const v2 of [false,true])test(`AC8-12 C/D/E/J [8a-1/4] GREEN-control permissive Google private ${v2?'v2':'v1'} completion→Select→unlinked Add`,async()=>{
  const f=await seedOperation(db); await prepareCall(db,f); await finalize(db,f);
  await permissive(db,'google_books');
  const result=resultRows(f),beforeCompletion=await footprint(db); await setActor(db,f.ownerId,'service_role');
  assert.equal((await (v2?completeV2(db,f,result):complete(db,f,result))).status,'completed');
  await resetActor(db);
  noSharedChange(beforeCompletion,await footprint(db),'completion');
  assert.equal(await value(db,'SELECT count(*)::int FROM public.canonical_editions'),0);
  assert.equal(await value(db,"SELECT count(*)::int FROM public.phase9_metadata_cache_entries WHERE payload_kind='edition_options_v1'"),0);
  const beforeSelect=await footprint(db);await setActor(db,f.ownerId);
  const choices=await value(db,readSql(f));
  await value(db,selectSql(f,choices,result.rows[0].optionId)); await saveReview(db,f);
  noSharedChange(beforeSelect,await footprint(db),'Select');
  const before=await footprint(db),saved=await add(db,f);
  assert.equal(saved.receipt.outcome,'committed_private');
  assert.equal(saved.item.canonical_work_id,null); assert.equal(saved.item.canonical_edition_id,null);
  noSharedChange(before,await footprint(db),'Add');
});

test('AC8-12 E [8a-4] GREEN-control OL saved canonical-ID hint links through the same selected-snapshot Add boundary',async()=>{
  const m=facts(),target=await seedIncumbent(db,m);
  const f=await automaticCard(db,m,{target:target.editionId,currentSuggestion:true});
  await resetActor(db);
  assert.equal(await value(db,'SELECT canonical_edition_id FROM public.phase9_selected_metadata_snapshots WHERE id=$1',[f.selectionId]),target.editionId,
    'positive has a real saved-ID hint before Add');
  const chosen=await selectionBytes(db,f),saved=await add(db,f);
  assert.equal(saved.item.canonical_edition_id,target.editionId);assert.equal(saved.item.canonical_work_id,target.workId);
  assert.equal(await selectionBytes(db,f),chosen);
});
test('AC8-12 E [8a-4] Google saved canonical-ID hint cannot link a new Add and chosen bytes survive',async()=>{
  const {f,command}=await automaticGoogleCommand(db),m=command.result.outcome.selected;
  const target=await seedIncumbent(db,m);await setActor(db,f.ownerId,'service_role');
  await rpc(db,'phase9_finalize_structural_metadata_attempt',[f.attemptId,f.jobId,worker,token,1,f.candidateId,
    f.context.candidateVersion,'accepted','coherent_match',null,'miss',0,'fixture',{currency:'USD'},0,m]);
  const selected=await rpc(db,'phase9_select_structural_metadata_snapshot',[f.lookupId,f.jobId,worker,token,1,
    f.candidateId,f.context.candidateVersion,f.attemptId,f.attemptId,'p9-selected-v1','p9-metadata-selection-v1',m,
    ['validated_isbn'],'accepted_metadata_match',target.editionId]);
  await setActor(db,f.ownerId);await value(db,selectSql(f,await value(db,readSql(f)),selected.snapshot_id,{source:'current_suggestion'}));
  await saveReview(db,f);const chosen=await selectionBytes(db,f),before=await footprint(db);
  const saved=await add(db,f);
  assert.equal(saved.item.canonical_edition_id,null,'Google saved-ID hint must be ignored before Add linkage');
  assert.equal(saved.item.canonical_work_id,null);assert.equal(await selectionBytes(db,f),chosen);noSharedChange(before,await footprint(db),'saved-ID Add');
});

async function selectedSnapshotCache(adapterKey,scope) {
  const {f,command}=await automaticProviderCommand(db,{adapterKey,privacyScope:scope}),m=command.result.outcome.selected;
  await rpc(db,'phase9_finalize_structural_metadata_attempt',[f.attemptId,f.jobId,worker,token,1,f.candidateId,
    f.context.candidateVersion,'accepted','coherent_match',null,'miss',0,'fixture',{currency:'USD'},0,m]);
  await rpc(db,'phase9_select_structural_metadata_snapshot',[f.lookupId,f.jobId,worker,token,1,f.candidateId,
    f.context.candidateVersion,f.attemptId,f.attemptId,'p9-selected-v1','p9-metadata-selection-v1',m,['validated_isbn'],'accepted_metadata_match',null]);
  const before=await footprint(db);await setActor(db,f.ownerId,'service_role');let result,error;
  try{result=await rpc(db,'phase9_store_metadata_cache',[f.lookupId,worker,token,1,'positive',m,m.providerRecordId,
    m.fetchedAt,new Date(Date.parse(m.fetchedAt)+3600000).toISOString()]);}catch(e){error=e;}
  return {f,m,before,result,error};
}
test('AC8-12 I [8a-4] GREEN-control OL public selected-snapshot cache publishes through the same legacy boundary',async()=>{
  const {m,result,error}=await selectedSnapshotCache('open_library','public_bibliographic');
  assert.equal(error,undefined);assert.ok(result.cache_id);
  await resetActor(db);
  const cache=(await db.query('SELECT * FROM public.phase9_metadata_cache_entries WHERE id=$1',[result.cache_id])).rows[0];
  assert.equal(cache.privacy_scope,'public_bibliographic');assert.equal(cache.adapter_key,'open_library');
  assert.equal(cache.payload_kind,'selected_snapshot_v1');
  assert.deepEqual(cache.normalized_snapshot,m,'the admitted public positive retains the same selected bytes');
});
for(const scope of ['public_bibliographic','store_private'])
test(`AC8-12 I [8a-4] legacy Google selected-snapshot ${scope} cache respects independent veto`,async()=>{
  const {before,result,error}=await selectedSnapshotCache('google_books',scope);
  if(scope==='store_private') {assert.equal(error,undefined);assert.ok(result.cache_id);}
  else {
    if(error) {assert.equal(error.code,'P0001');assert.equal(error.message,'P9_METADATA_STORAGE_DENIED');}
    else assert.equal(result.cache_id??null,null,'Google public selected-snapshot cache must be vetoed');
    assert.deepEqual(await footprint(db),before);
  }
});

