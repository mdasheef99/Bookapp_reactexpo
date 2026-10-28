// 02b sections 4.5/7.1/8.1-8.2/11: transactional M85 publication and guard proof.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { applyM85IfPresent, cacheRequest, cacheVersions, catalogueBatch, completeCatalogueV2, createLeanDatabase,
  requireM85, reuseCatalogueCache, scanCacheCard } from './leanCatalogueFixture.mjs';
import { add, enableOL, readSql, resetActor, saveReview, scalar, seedIncumbent, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { fence, finalize, prepareCall, recover, resultRows, rpc, seedOperation } from './editionOptionsCompletionFixture.mjs';
import { completionFootprint } from './leanCatalogueCompletionFixture.mjs';
import { seedCard } from './editionPickerFixture.mjs';

let db;
before(async()=>{db=await createLeanDatabase({m84:true,m85:true});});
beforeEach(async()=>{
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE');
  await enableOL(db);
});
after(async()=>{await db?.close();});
async function batch(overrides={}) { return catalogueBatch(db,overrides,null,{existing:await scanCacheCard(db,overrides)}); }
async function published(f) {
  assert.equal((await completeCatalogueV2(db,f)).status,'completed'); await resetActor(db);
  const effect=(await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.ok(effect,'real M84 durable effect must exist');
  assert.notEqual(effect.cache_entry_id,null,'M85 completion publication must bind a safe cache payload to its private receipt');
  const entry=(await db.query('SELECT * FROM public.phase9_metadata_cache_entries WHERE id=$1',[effect.cache_entry_id])).rows[0];
  assert.ok(entry,'publication receipt must identify its persisted entry');
  return {effect,entry};
}
async function cacheCount() { await resetActor(db); return scalar(db,'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'); }

test('[baseline] publication fixture builds a real six-row scan result and committed M84 receipt',async()=>{
  const f=await batch(); await resetActor(db);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_valid_rows($1) AS valid',[f.rows])).rows[0].valid,true);
  assert.equal(f.rows.length,6); assert.equal(f.catalogueCompanions.length,5);
  assert.equal((await completeCatalogueV2(db,f)).status,'completed'); await resetActor(db);
  const saved=(await db.query('SELECT completion_response,canonical_results FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.equal(saved.completion_response.status,'completed'); assert.equal(saved.canonical_results.length,6);
});

test('AC7-7/15: completion publishes ordered strict facts and strips all private worker envelope fields',async()=>{
  const f=await batch(), {entry,effect}=await published(f), p=entry.bibliographic_payload;
  assert.equal(entry.payload_kind,'edition_options_v1'); assert.equal(entry.privacy_scope,'public_bibliographic');
  assert.equal(entry.store_id,null); assert.equal(entry.normalized_snapshot,null);
  assert.equal(entry.source_attempt_id,null); assert.equal(entry.provider_record_id,null);
  assert.deepEqual(Object.keys(p).sort(),['rows','sourceFetchedAt','version']); assert.equal(p.version,'psr-edition-cache-v1');
  assert.equal(Date.parse(p.sourceFetchedAt),Date.parse(f.fetched)); assert.equal(p.rows.length,6);
  for(let i=0;i<p.rows.length;i++) {
    const r=p.rows[i], original=f.rows[i];
    assert.deepEqual(Object.keys(r).sort(),['companion','eligibility','googleBooksUrl','metadata','ordinal','providerRecordId']);
    assert.equal(r.ordinal,original.ordinal); assert.equal(r.eligibility,original.eligibility);
    if(original.metadata===null) assert.deepEqual(r,{ordinal:5,eligibility:'unavailable',googleBooksUrl:null,providerRecordId:null,metadata:null,companion:null});
    else {
      const expected={...original.metadata};
      for(const key of ['correlationId','attemptId','matchRationale','confidence']) delete expected[key];
      assert.deepEqual(r.metadata,expected); assert.equal(r.providerRecordId,expected.providerRecordId);
      const c=f.catalogueCompanions.find(c=>c.optionId===original.optionId);
      assert.deepEqual(r.companion,{version:c.version,workExternalId:c.workExternalId,oclc:c.oclc,lccn:c.lccn});
    }
  }
  for(const privateId of [f.storeId,f.candidateId,f.lookupId,f.attemptId,f.jobId,...f.rows.map(r=>r.optionId)])
    assert.equal(JSON.stringify(p).includes(privateId),false,privateId);
  const digest=(await db.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS digest",[p])).rows[0].digest;
  assert.equal(entry.payload_digest,digest); assert.equal(effect.cache_payload_digest,digest);
});

test('AC7-24: publication records lookup versions and uses the exact SQL-normalized scoped tuple',async()=>{
  const f=await batch(), {entry}=await published(f), v=cacheVersions();
  for(const [column,key] of [['adapter_key','adapterKey'],['adapter_version','adapterVersion'],['capability_version','capabilityVersion'],
    ['normalizer_version','normalizerVersion'],['schema_version','schemaVersion'],['routing_policy_version','routingPolicyVersion'],
    ['cache_policy_version','cachePolicyVersion'],['reuse_policy_version','reusePolicyVersion']]) assert.equal(entry[column],v[key],column);
  const tuple=['psr-edition-cache-v1','public_bibliographic',null,f.context.queryIdentity,v.adapterKey,v.adapterVersion,
    v.capabilityVersion,v.normalizerVersion,v.schemaVersion,v.routingPolicyVersion,v.cachePolicyVersion,v.reusePolicyVersion,v.companionVersion];
  const expected=(await db.query("SELECT 'psr-edition-cache-v1:'||encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS key",[tuple])).rows[0].key;
  assert.equal(entry.provider_cache_identity,expected);
});

test('AC7-13: completion replay preserves cache payload, digest, expiry and creation bytes',async()=>{
  const f=await batch(); await published(f); const before=await completionFootprint(db);
  const replay=await completeCatalogueV2(db,f); assert.equal(replay.status,'replayed');
  assert.equal(await completionFootprint(db),before); await setActor(db,f.ownerId,'service_role');
  assert.deepEqual(await recover(db,f),replay); assert.equal(await completionFootprint(db),before);
});

test('AC7-7/26: Owner-confirmed equal-looking scan query publishes only a store-private entry',async()=>{
  const card=await scanCacheCard(db); await setActor(db,card.ownerId);
  await saveReview(db,card,{...card.review,originalTitle:card.facts.title,authors:card.facts.authors,
    originalLanguage:card.facts.language,originalFieldConfirmation:{title:true,authors:[true,true]}});
  const f=await catalogueBatch(db,{},null,{existing:card}), {entry}=await published(f);
  assert.equal(entry.privacy_scope,'store_private'); assert.equal(entry.store_id,card.storeId);
  assert.equal(JSON.stringify(entry.bibliographic_payload).includes('Reviewed internal note.'),false);
});

test('AC7-6: publication filters hidden targets while preserving the original private options',async()=>{
  const initial=await batch(), {effect}=await published(initial); await resetActor(db);
  const hidden=effect.canonical_results.find(r=>r.canonicalEditionId);
  assert.ok(hidden); await db.query('UPDATE public.canonical_editions SET hidden=true WHERE id=$1',[hidden.canonicalEditionId]);
  // A confirmed query has a distinct private cache key, so this tests new publication
  // rather than asking a live public incumbent to refresh against section 8.2.
  await setActor(db,initial.ownerId);
  await saveReview(db,initial,{...initial.review,originalTitle:initial.facts.title,authors:initial.facts.authors,
    originalLanguage:initial.facts.language,originalFieldConfirmation:{title:true,authors:[true,true]}});
  const next=await catalogueBatch(db,{},null,{existing:initial}), {entry}=await published(next);
  assert.equal(entry.bibliographic_payload.rows.some(r=>r.providerRecordId===initial.rows[0].metadata.providerRecordId),false);
  const privateRows=(await db.query('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[next.candidateId])).rows[0].options;
  assert.deepEqual(privateRows,next.rows);
});

test('AC7-13/14: unexpected cache publication failure rolls back all completion writes and retry reuses durable HTTP receipts',async()=>{
  const f=await batch(); await requireM85(db,'marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)');
  await resetActor(db); const before=await completionFootprint(db);
  await db.exec(`CREATE FUNCTION public.phase9_test_cache_publication_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE SQLSTATE 'XX000' USING MESSAGE='recorded unexpected publication failure'; END$$;
    CREATE TRIGGER phase9_test_cache_publication_failure BEFORE INSERT ON public.phase9_metadata_cache_entries
      FOR EACH ROW EXECUTE FUNCTION public.phase9_test_cache_publication_failure()`);
  try { await assert.rejects(()=>completeCatalogueV2(db,f),e=>e.code==='XX000'); }
  finally { await resetActor(db); await db.exec('DROP TRIGGER phase9_test_cache_publication_failure ON public.phase9_metadata_cache_entries; DROP FUNCTION public.phase9_test_cache_publication_failure()'); }
  assert.equal(await completionFootprint(db),before,'options, catalogue, statistics, job, usage and receipt must all roll back');
  await published(f); await resetActor(db);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id='${f.jobId}'`),3);
});

test('AC7-10: denial of public display skips publication but preserves successful options and usage accounting',async()=>{
  await published(await batch()); const f=await batch({title:'Another safe title'}), count=await cacheCount();
  await db.query("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
  assert.equal((await completeCatalogueV2(db,f)).status,'completed'); assert.equal(await cacheCount(),count);
  const effect=(await db.query('SELECT cache_entry_id FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.equal(effect.cache_entry_id,null);
});

test('AC7-11/16: M73 policy accepts genuine cache-only lineage and refuses it without the matching private receipt',async()=>{
  await published(await batch()); const f=await cacheRequest(db,await scanCacheCard(db));
  assert.equal((await reuseCatalogueCache(db,f)).status,'completed'); await resetActor(db);
  const policy=()=>db.query(`SELECT marketplace_sec.phase9_edition_source_policy(s) AS admitted
    FROM public.phase9_candidate_edition_state s WHERE candidate_id=$1`,[f.candidateId]);
  assert.equal((await policy()).rows[0].admitted,true);
  const state=(await db.query('SELECT source_lookup_id FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0];
  await db.query('DELETE FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[state.source_lookup_id]);
  assert.equal((await policy()).rows[0].admitted,false,'a cache-hit flag without its private receipt grants no lineage');
});

test('[baseline] idle cache path leaves the v2 receipt byte-equal to the persisted M84 result',async()=>{
  const old=await createLeanDatabase({m84:true});
  try {
    const f=await catalogueBatch(old); await resetActor(old);
    await old.query("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
    const response=await completeCatalogueV2(old,f); await resetActor(old);
    const original=await completionFootprint(old);
    const saved=(await old.query('SELECT completion_response::text AS bytes,cache_entry_id,cache_payload_digest FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
    await applyM85IfPresent(old);
    assert.equal((await completeCatalogueV2(old,f)).status,'replayed'); await resetActor(old);
    const upgraded=(await old.query('SELECT completion_response::text AS bytes,cache_entry_id,cache_payload_digest FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
    assert.deepEqual(upgraded,saved); assert.equal(saved.cache_entry_id,null); assert.equal(saved.cache_payload_digest,null);
    assert.equal(await completionFootprint(old),original);
    await setActor(old,f.ownerId,'service_role'); assert.deepEqual(await recover(old,f),{...response,status:'replayed'});
  } finally { await old.close(); }
});

test('[baseline] Google completion and manual Add publish no shared cache entry',async()=>{
  const f=await seedOperation(db); await prepareCall(db,f); await finalize(db,f); const result=resultRows(f);
  assert.equal((await rpc(db,'phase9_complete_candidate_edition_options_v2',[...fence(f),f.lookupId,f.attemptId,
    result.fetched,result.deadline,true,result.rows,null])).status,'completed');
  const manual=await seedCard(db); await setActor(db,manual.ownerId); await saveReview(db,manual);
  assert.equal((await add(db,manual)).item.canonical_edition_id,null); await resetActor(db);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM public.phase9_metadata_cache_entries WHERE privacy_scope='public_bibliographic'"),0);
});


test('AC7-24: publication expiry is bounded by original options and registry revalidation, never now plus TTL',async()=>{
  await resetActor(db);
  const policy=(await db.query("SELECT revalidation_seconds FROM public.phase9_provider_registry WHERE adapter_key='open_library'")).rows[0];
  try {
    await db.query("UPDATE public.phase9_provider_registry SET revalidation_seconds=600 WHERE adapter_key='open_library'");
    for(const [label,seconds,expected] of [['registry deadline',3600,600],['original options deadline',60,60]]) {
      const f=await batch({title:'TTL '+label}); f.deadline=new Date(Date.parse(f.fetched)+seconds*1000).toISOString();
      const {entry}=await published(f);
      assert.equal(Date.parse(entry.expires_at),Date.parse(f.fetched)+expected*1000,label);
      assert.equal((await completeCatalogueV2(db,f)).status,'replayed'); await resetActor(db);
      const after=(await db.query('SELECT expires_at FROM public.phase9_metadata_cache_entries WHERE id=$1',[entry.id])).rows[0];
      assert.equal(Date.parse(after.expires_at),Date.parse(entry.expires_at));
    }
  } finally { await resetActor(db); await db.query("UPDATE public.phase9_provider_registry SET revalidation_seconds=$1 WHERE adapter_key='open_library'",[policy.revalidation_seconds]); }
});


test('AC7-3/15: a catalogue identity conflict remains in the safe cache and all private options',async()=>{
  const f=await batch(); await resetActor(db);
  const incumbent=await seedIncumbent(db,{...f.rows[0].metadata,title:'Conflicting tuple target'});
  await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id)
    VALUES('open_library','edition',$1,$2)`,[f.rows[0].metadata.providerRecordId,incumbent.editionId]);
  const {entry,effect}=await published(f);
  assert.equal(effect.canonical_results[0].canonicalWorkId,null);
  assert.equal(effect.canonical_results[0].canonicalEditionId,null);
  assert.equal(entry.bibliographic_payload.rows.length,6);
  assert.equal(entry.bibliographic_payload.rows[0].providerRecordId,f.rows[0].metadata.providerRecordId);
  const saved=(await db.query('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0];
  assert.deepEqual(saved.options,f.rows);
});
