// 02c §§4.1–4.4,8–11; 02c-1 §2 partial-8a and v1-choice compatibility.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { automaticGoogleCommand, clean, createProviderDatabase, legacyPolicyKeys, needs, packages, resetActor, value } from './providerReplacementFixture.mjs';
import { catalogueBatch, completeCatalogueV2 } from './leanCatalogueFixture.mjs';
import { add, readSql, saveReview, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { originalChoiceAfterCleanup } from './leanCatalogueCompletionFixture.mjs';
import { completionFootprint } from './leanCatalogueCompletionFixture.mjs';
import { complete, recover, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';
let db;
before(async () => { db = await createProviderDatabase(); });
beforeEach(async () => { await clean(db); });
after(async () => { await db?.close(); });

async function legacyGoogleAutomatic(database) {
  const {f,command}=await automaticGoogleCommand(database),{jobId,context}=f;
  for(const p of context.providerPolicies) assert.deepEqual(Object.keys(p).sort(),legacyPolicyKeys);
  const m=command.result.outcome.selected;
  await rpc(database,'phase9_finalize_structural_metadata_attempt',[f.attemptId,jobId,worker,token,1,
    f.candidateId,context.candidateVersion,'accepted','coherent_match',null,'miss',0,'fixture-pricing',{currency:'USD'},0,m]);
  const selected=await rpc(database,'phase9_select_structural_metadata_snapshot',[f.lookupId,jobId,worker,token,1,
    f.candidateId,context.candidateVersion,f.attemptId,f.attemptId,'p9-selected-v1','p9-metadata-selection-v1',m,
    ['validated_isbn'],'accepted_metadata_match',null]);
  assert.ok(selected.snapshot_id);
  await resetActor(database);
  const saved=await value(database,'SELECT coherent_edition FROM public.phase9_selected_metadata_snapshots WHERE id=$1',[selected.snapshot_id]);
  assert.deepEqual(saved,m,'old automatic selected bytes survive');
  await setActor(database,f.ownerId,'service_role');
  const cache=await rpc(database,'phase9_store_metadata_cache',[f.lookupId,worker,token,1,'positive',m,
    'coherent_match',m.fetchedAt,new Date(Date.parse(m.fetchedAt)+3600000).toISOString()]);
  assert.ok(cache.cache_id,'legacy private selected-snapshot cache remains writable');
  return f;
}
async function legacyOlExplicit(database, v2=false) {
  const f=await catalogueBatch(database);
  for(const p of f.context.providerPolicies) assert.deepEqual(Object.keys(p).sort(),legacyPolicyKeys);
  const result=()=>v2 ? completeCatalogueV2(database,f) : complete(database,f,f);
  assert.equal((await result()).status,'completed');
  const first=await recover(database,f), second=await recover(database,f);
  assert.deepEqual(second,first,'lost completion response recovers the original receipt');
  await setActor(database,f.ownerId);
  const choices=await value(database,readSql(f));
  await value(database,selectSql(f,choices,f.rows[0].optionId)); await saveReview(database,f);
  const saved=await add(database,f);
  assert.ok(saved.item.canonical_edition_id,'OL completion→Select→Add remains linked');
  return f;
}

test('AC8-10 [8a-1..4] GREEN-control old Google automatic context→physical call→selected snapshot→private cache',async()=>{
  await legacyGoogleAutomatic(db);
});
for(const v2 of [false,true]) test(`AC8-10/14 [8a-1..4] GREEN-control OL explicit ${v2?'v2 companion':'v1 omitted-companion'} completion→recover→Select→Add`,async()=>{
  await legacyOlExplicit(db,v2);
});
for(const v2 of [false,true]) test(`AC8-10/14 [8a-2/4] GREEN-control ${v2?'v2':'v1'} saved choice survives newer list expiry/cleanup`,async()=>{
  const f=await originalChoiceAfterCleanup(db,v2);
  assert.equal(f.sources[0].provider_book_id,f.original.rows[0].metadata.providerRecordId);
});

for(const pkg of ['8a-1','8a-2','8a-3','8a-4','8a-5']) {
  test(`AC8-10 [${pkg}] partial prefix: old Google automatic and OL explicit v1/v2 remain compatible`,{
    skip:packages[pkg].length===0 ? `NEEDS-OBJECT ${pkg}: approved migration filename in provider-replacement-packages.json; no filename reserved` : false,
  },async()=>{
    const native=!!process.env.PHASE9_PROVIDER_NATIVE_PORT;
    if(native){await db.close();db=null;}
    let partial;
    try {
      // 02c §§4.1/10: selectedPrefix validates every predecessor before any SQL.
      partial=await createProviderDatabase({selection:pkg});
      await clean(partial); await legacyGoogleAutomatic(partial);
      await clean(partial); await legacyOlExplicit(partial,false);
      await clean(partial); await legacyOlExplicit(partial,true);
    } finally {await partial?.close();if(native)db=await createProviderDatabase();}
  });
}

for(const name of ['phase9_complete_automatic_metadata_v1','phase9_recover_automatic_metadata_v1']) {
  test(`AC8-10/11 [8a-4] automatic ${name} rejects malformed commands without mutation`,async t=>{
    if(!await needs(t,db,`public.${name}(jsonb)`,'8a-4'))return;
    const before=await completionFootprint(db);
    await setActor(db,'','service_role');
    await assert.rejects(()=>rpc(db,name,[{}]),e=>e.code==='P0001' && /P9_AUTO_COMMAND_INVALID/.test(e.message));
    assert.equal(await completionFootprint(db),before,'malformed command changes no job/usage/attempt/effect/snapshot row');
  });
}
test('AC8-10/12 [8a-4] no-list Google automatic completion and receipt-first replay preserve selected bytes and zero shared effects',async t=>{
  if(!await needs(t,db,'public.phase9_complete_automatic_metadata_v1(jsonb)','8a-4') ||
    !await needs(t,db,'public.phase9_recover_automatic_metadata_v1(jsonb)','8a-4'))return;
  const {f,command}=await automaticGoogleCommand(db);
  const receipt=await rpc(db,'phase9_complete_automatic_metadata_v1',[command]);
  assert.equal(receipt.version,'p9-auto-completion-v1'); assert.equal(receipt.status,'completed');
  assert.equal(receipt.outcome,'accepted_metadata_match'); assert.equal(receipt.selectedOptionId,null);
  assert.deepEqual(receipt.prefill,{status:'skipped',reason:'not_installed'});
  await resetActor(db);
  assert.deepEqual(await value(db,'SELECT coherent_edition FROM public.phase9_selected_metadata_snapshots WHERE id=$1',[receipt.snapshotId]),command.result.outcome.selected);
  const before=await completionFootprint(db);
  // Completion cleared the active lease. The persisted original claim still recovers.
  await setActor(db,f.ownerId,'service_role');
  assert.deepEqual(await rpc(db,'phase9_recover_automatic_metadata_v1',[command.fence]),{...receipt,status:'replayed'});
  assert.deepEqual(await completionFootprint(db),before,'recovery cannot duplicate snapshots, effects or spend');
  assert.equal(await value(db,"SELECT count(*)::int FROM public.canonical_provider_ids WHERE adapter_key='google_books'"),0);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[f.jobId]),1);
});
for(const [label,alter] of [
  ['wrong store',c=>{c.fence.storeId='00000000-0000-4000-8000-000000000099';}],
  ['wrong query',c=>{c.fence.queryIdentity+='-forged';}],
  ['wrong claim',c=>{c.fence.claimAttempt=2;}],
  ['wrong selected binding',c=>{c.selectedOptionId='00000000-0000-4000-8000-000000000099';}],
])test(`AC8-10/11 [8a-4] automatic ${label} refuses atomically`,async t=>{
  if(!await needs(t,db,'public.phase9_complete_automatic_metadata_v1(jsonb)','8a-4'))return;
  const {command}=await automaticGoogleCommand(db),before=await completionFootprint(db);
  alter(command); let error,receipt;
  await setActor(db,'','service_role');
  try{receipt=await rpc(db,'phase9_complete_automatic_metadata_v1',[command]);}catch(caught){error=caught;}
  if(error)assert.ok(error.code==='P0001' && /^P9_(AUTO_COMMAND_INVALID|AUTO_SOURCE_INVALID|EDITION_ROWS_INVALID|CATALOGUE_COMPANION_INVALID|IDEMPOTENCY_MISMATCH)$/.test(error.message),error.message);
  else assert.deepEqual(receipt,{status:'stale_rejected'});
  assert.deepEqual(await completionFootprint(db),before,'forged authority must mutate no table');
});
for(const behavior of [
  'retained winner binds exact row UUID, metadata digest and companion; replay preserves original receipt/count/spend',
  'ambiguous retained list stays manual without a selected binding; zero-egress local result invents no receipt',
  'expired lease after committed response loss recovers receipt first without HTTP or options resurrection',
  'saved automatic selected companion reaches Add after alternatives cleanup without duplicate counts',
]) test.todo(`AC8-9a/10/14 UNPROVED-PREREQUISITE [8a-4]: reviewed retained/local automatic fixture: ${behavior}`);

// Gate labels remain visible even though no protection/presentation policy is invented.
for(const behavior of [
  'one known-safe retry uses a larger new claim and new token, never a sixth claim or same-claim send',
  'temporary capacity defers durably without provider attempt/spend; hard quota follows approved policy',
  'breaker permits one approved cooldown recheck without fallback bypass or repeated loop',
]) test(`AC8-5 [8a-5] GATED OQ8-1/OQ8-3: ${behavior}`,{skip:'GATED OQ8-1/OQ8-3: protection policy unanswered'},()=>{});
for(const behavior of ['1000:1 backlog','reversed backlog','explicit B request','locked/capped A','multiple workers/restart'])
  test(`AC8-6 [8a-5] GATED OQ8-3: native ${behavior} respects N-admission bound`,
    {skip:'GATED OQ8-3: fair-admission mechanism/limits unanswered; requires two real native connections'},()=>{});
test('AC8-9b [8b presentation] GATED OQ8-2: synthetic third-host negotiation/legacy/forged-policy projection and frozen client hashes',
  {skip:'GATED OQ8-2: paired presentation work is not approved; backend 9a cannot establish 9b'},()=>{});

for(const mode of ['registered orphan','unknown finalized response','uncertain completion'])
test(`AC8-5/10 [8a-3/4] GREEN-control ${mode} recovers original identity without another grant/spend`,async()=>{
  const {seedOperation,prepareCall,finalize}=await import('./editionOptionsCompletionFixture.mjs');
  const f=await seedOperation(db);await prepareCall(db,f);
  if(mode!=='registered orphan')await finalize(db,f);
  if(mode==='uncertain completion')await complete(db,f);
  await resetActor(db);
  const call=(await db.query('SELECT * FROM public.phase9_metadata_provider_calls WHERE id=$1',[f.callId])).rows[0];
  const before=await completionFootprint(db);await setActor(db,f.ownerId,'service_role');
  if(mode==='uncertain completion')assert.equal((await recover(db,f)).status,'replayed');
  else {
    const replay=await rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,f.jobId,worker,token,1,call.physical_call_identity]);
    assert.equal(replay.provider_call_id,f.callId);
  }
  assert.equal(await completionFootprint(db),before,'SQL recovery creates no new receipt/attempt/reservation/spend; worker GET dispatch is not observed');
});
test.todo('AC8-5/10 UNPROVED-PREREQUISITE [8b]: registered-orphan and unknown-egress recovery dispatches no new GET through the durable worker recovery contract');
