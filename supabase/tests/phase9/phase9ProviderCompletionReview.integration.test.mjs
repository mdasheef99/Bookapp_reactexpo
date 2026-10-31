// S4/S6: 02c §§3.1/4.2/4.3/9; 02b §§3/8: exact lineage, retained deadlines.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,needs,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {beginAutomatic,olAutomaticRoute,receivingCard,retainedOlResult} from './providerAutomaticReviewFixture.mjs';
import {catalogueBatch,completeCatalogueV2} from './leanCatalogueFixture.mjs';
import {add,readSql,saveReview,selectSql,selectionBytes} from './catalogueLinkFixture.mjs';
import {claimJob,seedAutomaticLineage} from './editionPickerFixture.mjs';
import {rpc,token,worker} from './editionOptionsCompletionFixture.mjs';
import {completionFootprint} from './leanCatalogueCompletionFixture.mjs';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});

test('S4 cached automatic selection resolves the original bound companion and its existing work on Add',async t=>{
  if(!await needs(t,db,'public.phase9_complete_automatic_metadata_v1(jsonb)','8a-4'))return;
  await olAutomaticRoute(db);
  const fixture=await beginAutomatic(db,{key:'open_library',version:'2.0.0'}),{f,command}=fixture;
  await retainedOlResult(db,fixture);
  // The private accepted snapshot has no saved canonical-ID hint. Admission can
  // later become available without changing any selected metadata or companion.
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET shared_catalogue_allowed=false WHERE adapter_key='open_library'");
  await setActor(db,f.ownerId,'service_role');
  const receipt=await rpc(db,'phase9_complete_automatic_metadata_v1',[command]);
  await resetActor(db);
  assert.equal(await value(db,'SELECT canonical_edition_id FROM public.phase9_selected_metadata_snapshots WHERE id=$1',[receipt.snapshotId]),null);
  const workId=randomUUID(),m=command.result.outcome.selected;
  await db.query(`INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors,language)
    VALUES($1,'original work title','Original Work Title',ARRAY['fixture author'],'en')`,[workId]);
  await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_work_id)
    VALUES('open_library','work','OL1W',$1)`,[workId]);
  await db.exec("UPDATE public.phase9_provider_registry SET shared_catalogue_allowed=true WHERE adapter_key='open_library'");
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_catalogue_companion_for_choice_v1($1,$2,$3,$4,$5)',
    [m,randomUUID(),f.candidateId,f.storeId,f.sessionId]),null,'another option UUID never acquires the selected companion');
  await setActor(db,f.ownerId,'service_role');
  const cache=await rpc(db,'phase9_store_metadata_cache',[f.lookupId,worker,token,1,'positive',m,m.providerRecordId,
    m.fetchedAt,command.result.retention.permittedDeadlineAt]);
  assert.ok(cache.cache_id);
  const receiving=await receivingCard(db,f),{jobId}=await seedAutomaticLineage(db,receiving,'accepted','b'.repeat(64));
  const context=await value(db,await claimJob(db,receiving,jobId)),contract=f.contract;
  const reused=await rpc(db,'phase9_complete_metadata_cache_reuse',[jobId,worker,token,1,receiving.candidateId,
    context.candidateVersion,context.queryIdentity,f.cacheKey,'open_library','2.0.0',contract.capabilityVersion,
    contract.lookupSchemaVersion,'isbn','p9-metadata-lookup-v1',contract.normalizerVersion,'p9-metadata-routing-v1',
    'store_private','1','p9-metadata-cache-v1','metadata-v1','p9-selected-v1','p9-metadata-selection-v1']);
  assert.equal(reused.status,'completed');
  await resetActor(db);
  const selection=await value(db,'SELECT selected_metadata_snapshot_id FROM public.image_extraction_candidates WHERE id=$1',[receiving.candidateId]);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=$1',[jobId]),0);
  await setActor(db,f.ownerId);
  await value(db,selectSql(receiving,await value(db,readSql(receiving)),selection,{source:'current_suggestion'}));
  await saveReview(db,receiving);const chosen=await selectionBytes(db,receiving);
  const saved=await add(db,receiving);
  assert.equal(saved.item.canonical_work_id,workId,'the leader companion supplies OL1W instead of creating a title-derived work');
  assert.ok(saved.item.canonical_edition_id);
  assert.equal(await selectionBytes(db,receiving),chosen);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.canonical_works'),1);
});

for(const limit of [600,null])test(`S6 explicit completion honors ${limit??'default 24-hour'} retention and replays the original receipt`,async t=>{
  if(!await needs(t,db,'marketplace_sec.phase9_provider_validation_contract_v1(text,text)','8a-2'))return;
  const f=await catalogueBatch(db),requested=new Date(Date.parse(f.fetched)+86400000).toISOString();
  await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET options_retention_seconds=$1 WHERE adapter_key='open_library'",[limit]);
  const receipt=await completeCatalogueV2(db,f,{deadline:requested});
  assert.equal(receipt.status,'completed');
  await resetActor(db);
  const seconds=await value(db,`SELECT extract(epoch FROM options_expires_at-source_fetched_at)::int
    FROM public.phase9_candidate_edition_state WHERE candidate_id=$1`,[f.candidateId]);
  assert.equal(seconds,limit??86400);
  await db.exec("UPDATE public.phase9_provider_registry SET options_retention_seconds=300 WHERE adapter_key='open_library'");
  assert.deepEqual(await completeCatalogueV2(db,f,{deadline:requested}),{...receipt,status:'replayed'},
    'a policy change never rewrites the committed completion receipt');
});

test('P2 a deadline elapsed since transaction start rejects explicit completion atomically',async t=>{
  if(!await needs(t,db,'marketplace_sec.phase9_provider_validation_contract_v1(text,text)','8a-2'))return;
  const f=await catalogueBatch(db);
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET options_retention_seconds=2 WHERE adapter_key='open_library'");
  const before=await completionFootprint(db);
  f.fetched=new Date().toISOString();
  f.deadline=new Date(Date.parse(f.fetched)+3600000).toISOString();
  for(const row of f.rows)if(row.metadata)row.metadata.fetchedAt=f.fetched;
  for(const companion of f.catalogueCompanions)companion.fetchedAt=f.fetched;
  await db.exec('BEGIN');
  try {
    assert.equal(await value(db,"SELECT transaction_timestamp() < $1::timestamptz+interval '2 seconds'",[f.fetched]),true);
    await db.exec('SELECT pg_sleep(2.25)');
    assert.equal(await value(db,"SELECT clock_timestamp() >= $1::timestamptz+interval '2 seconds'",[f.fetched]),true);
    await assert.rejects(()=>completeCatalogueV2(db,f),/P9_METADATA_STORAGE_DENIED/);
  } finally {await db.exec('ROLLBACK');}
  assert.equal(await completionFootprint(db),before,'expired completion leaves no partial state or catalogue effects');
});

test('P2 expiry during the final job write rolls back all explicit completion effects',async t=>{
  if(!await needs(t,db,'marketplace_sec.phase9_provider_validation_contract_v1(text,text)','8a-2'))return;
  const f=await catalogueBatch(db);
  await resetActor(db);
  await db.exec("SET statement_timeout='20s'; UPDATE public.phase9_provider_registry SET options_retention_seconds=5 WHERE adapter_key='open_library'");
  await db.exec(`CREATE TEMP SEQUENCE phase9_test_terminal_count;
    CREATE FUNCTION pg_temp.phase9_test_delay_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_catalog.nextval('pg_temp.phase9_test_terminal_count'::regclass);
      PERFORM pg_catalog.pg_sleep(6); RETURN NEW; END $$;
    CREATE TRIGGER phase9_test_delay_terminal BEFORE UPDATE ON public.image_extraction_jobs
    FOR EACH ROW WHEN (NEW.id='${f.jobId}'::uuid AND NEW.status='resolved')
    EXECUTE FUNCTION pg_temp.phase9_test_delay_terminal()`);
  try {
    const before=await completionFootprint(db);
    f.fetched=new Date().toISOString();
    f.deadline=new Date(Date.parse(f.fetched)+3600000).toISOString();
    for(const row of f.rows)if(row.metadata)row.metadata.fetchedAt=f.fetched;
    for(const companion of f.catalogueCompanions)companion.fetchedAt=f.fetched;
    const started=Date.now();
    await assert.rejects(()=>completeCatalogueV2(db,f),/P9_METADATA_STORAGE_DENIED/);
    assert.ok(Date.now()-started>=5500,'the terminal-write delay must actually run');
    assert.equal(await completionFootprint(db),before,'expiry after writes rolls the entire completion back');
    assert.equal(await value(db,'SELECT is_called FROM pg_temp.phase9_test_terminal_count'),true,
      'nontransactional sequence proves the final-write trigger ran before rollback');
  } finally {
    await resetActor(db);
    await db.exec('DROP TRIGGER phase9_test_delay_terminal ON public.image_extraction_jobs');
  }
});
