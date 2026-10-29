// 02b sections 4.5/7.1/8.1-8.2/11: transactional M86 publication and guard proof.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { applyM85IfPresent, applyM86IfPresent, cacheRequest, cacheVersions, catalogueBatch, completeCatalogueV2, createLeanDatabase,
  asRole, requireM86, reuseCatalogueCache, scanCacheCard, sourcePolicy } from './leanCatalogueFixture.mjs';
import { add, enableOL, olOperation, readSql, resetActor, saveReview, scalar, seedIncumbent, selectSql, setActor } from './catalogueLinkFixture.mjs';
import { fence, finalize, prepareCall, recover, resultRows, rpc, seedOperation } from './editionOptionsCompletionFixture.mjs';
import { completionFootprint } from './leanCatalogueCompletionFixture.mjs';
import { row, seedCard } from './editionPickerFixture.mjs';
import { randomUUID } from 'node:crypto';

let db;
before(async()=>{db=await createLeanDatabase({m88:true});});
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
  assert.notEqual(effect.cache_entry_id,null,'M86 completion publication must bind a safe cache payload to its private receipt');
  const entry=(await db.query('SELECT * FROM public.phase9_metadata_cache_entries WHERE id=$1',[effect.cache_entry_id])).rows[0];
  assert.ok(entry,'publication receipt must identify its persisted entry');
  return {effect,entry};
}
async function cacheCount() { await resetActor(db); return scalar(db,'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'); }

// Owner M88 / review A1 (Terra closeout 1), 02b sections 7.1/8.2.
for(const routing of ['p9-metadata-routing-v1','p9-metadata-routing-v2'])
test(`M88 routing: attempt ${routing} preserves completion and only equal versions publish`,async()=>{
  const f=await batch(); await resetActor(db);
  await db.query('UPDATE public.metadata_enrichment_attempts SET routing_policy_version=$2 WHERE id=$1',[f.attemptId,routing]);
  const response=await completeCatalogueV2(db,f); assert.equal(response.status,'completed'); await resetActor(db);
  const effect=(await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.deepEqual(effect.completion_response,response,'completion must still return its durable receipt');
  if(routing.endsWith('v1')) assert.notEqual(effect.cache_entry_id,null,'equal-version control publishes');
  else {
    assert.equal(effect.cache_entry_id,null,'routing mismatch must skip publication');
    assert.equal(effect.cache_payload_digest,null);
    assert.equal(await cacheCount(),0,'routing mismatch must create no cache row');
  }
  assert.equal((await completeCatalogueV2(db,f)).status,'replayed');
});

// Owner M88 / review A2 (Muse closeout 1), tracker 38 section 42 item 3.
// M73 structural registration forbids OL-secondary on an OL explicit lookup.
// Exercise the definer-only helper as postgres with arranged same-adapter rows.
for(const role of ['secondary',null])
test(`M88 role: direct owner helper rejects ${role} on the same adapter; primary control publishes`,async()=>{
  const f=await batch(); await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
  const response=await completeCatalogueV2(db,f); assert.equal(response.status,'completed'); await resetActor(db);
  await enableOL(db);
  await db.query('UPDATE public.metadata_enrichment_attempts SET provider_role=$2 WHERE id=$1',[f.attemptId,role]);
  assert.equal(await scalar(db,`SELECT a.adapter_key=l.adapter_key FROM public.metadata_enrichment_attempts a
    JOIN public.phase9_metadata_lookups l ON l.id=a.lookup_id WHERE a.id='${f.attemptId}'`),true);
  const policy=await sourcePolicy(db,f.facts), publish=()=>db.query(
    'SELECT marketplace_sec.phase9_catalogue_store_cache_v1($1,$2) AS id',[f.lookupId,policy]);
  assert.equal((await publish()).rows[0].id,null,'non-primary role must skip publication even with equal adapter keys');
  assert.equal(await cacheCount(),0);
  const effect=(await db.query('SELECT completion_response,cache_entry_id FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
  assert.deepEqual(effect.completion_response,response); assert.equal(effect.cache_entry_id,null);
  await db.query("UPDATE public.metadata_enrichment_attempts SET provider_role='primary' WHERE id=$1",[f.attemptId]);
  assert.notEqual((await publish()).rows[0].id,null,'same-row primary control publishes');
});

// Owner M88 / review A3 (Terra slice 1 #2), 02b sections 6.2/8.2/AC7-24.
// PGlite has one connection: freeze the clock, then advance it at BEFORE INSERT
// past the first check to expiry. Native separately proves the actual lock wait.
for(const incumbent of [false,true])
test(`M88 deadline: expiry before key-lock read ${incumbent?'preserves incumbent bytes':'leaves an expired insert unbound'}`,async()=>{
  let saved;
  if(incumbent) {
    const initial=await published(await batch());
    await db.query('UPDATE public.phase9_metadata_cache_entries SET invalidated_at=clock_timestamp() WHERE id=$1',[initial.entry.id]);
    saved=(await db.query('SELECT to_jsonb(c)::text AS bytes FROM public.phase9_metadata_cache_entries c WHERE id=$1',[initial.entry.id])).rows[0].bytes;
  }
  const f=await batch({publisher:'Late replacement press'}); await resetActor(db);
  await db.exec(`CREATE TABLE public.phase9_test_clock(instant timestamptz);
    INSERT INTO public.phase9_test_clock VALUES('${f.fetched}'::timestamptz);
    ALTER FUNCTION pg_catalog.clock_timestamp() RENAME TO phase9_test_real_clock;
    CREATE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE
      AS 'SELECT instant FROM public.phase9_test_clock';
    CREATE TABLE public.phase9_test_deadline_barrier(expired boolean);
    CREATE FUNCTION public.phase9_test_deadline_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      UPDATE public.phase9_test_clock SET instant=NEW.expires_at;
      INSERT INTO public.phase9_test_deadline_barrier VALUES(NEW.expires_at<=pg_catalog.clock_timestamp());
      RETURN NEW; END $$;
    CREATE TRIGGER phase9_test_deadline_barrier BEFORE INSERT ON public.phase9_metadata_cache_entries
      FOR EACH ROW EXECUTE FUNCTION public.phase9_test_deadline_barrier(); DISCARD PLANS;`);
  try {
    const response=await completeCatalogueV2(db,f); assert.equal(response.status,'completed'); await resetActor(db);
    assert.deepEqual((await db.query('SELECT expired FROM public.phase9_test_deadline_barrier')).rows,[{expired:true}],
      'the first deadline check must pass and the insertion barrier must expire the proposed publication');
    const effect=(await db.query('SELECT completion_response,cache_entry_id,cache_payload_digest FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
    assert.deepEqual(effect.completion_response,response);
    assert.equal(effect.cache_entry_id,null,'expiry at the second check must skip publication');
    assert.equal(effect.cache_payload_digest,null);
    const entry=(await db.query('SELECT to_jsonb(c)::text AS bytes,expires_at<=clock_timestamp() AS expired FROM public.phase9_metadata_cache_entries c')).rows;
    assert.equal(entry.length,1);
    if(incumbent) assert.equal(entry[0].bytes,saved,'no bytes, digest, invalidation or deadline may be overwritten');
    else assert.equal(entry[0].expired,true,'the already-expired inserted row is intentionally left behind');
  } finally { await resetActor(db); await db.exec(`DROP FUNCTION pg_catalog.clock_timestamp();
    ALTER FUNCTION pg_catalog.phase9_test_real_clock() RENAME TO clock_timestamp; DISCARD PLANS;
    DROP TRIGGER phase9_test_deadline_barrier ON public.phase9_metadata_cache_entries;
    DROP FUNCTION public.phase9_test_deadline_barrier(); DROP TABLE public.phase9_test_deadline_barrier;
    DROP TABLE public.phase9_test_clock;`); }
});

// 02b sections 6.1/8.2, AC7-6: discovery uses the resolver's canonical ISBNs.
for(const [formatted,canonical] of [['0-306-40615-2','0306406152'],['0-8044-2957-x','080442957X']])
for(const hidden of [true,false])
test(`AC7-6: publication normalizes ISBN-10 ${formatted}, hidden=${hidden}`,async()=>{
  const f=await batch(), option=f.rows[4];
  option.metadata={...option.metadata,isbn10:formatted,isbn13:null};
  const target=await seedIncumbent(db,{...option.metadata,isbn10:canonical});
  await db.query('UPDATE public.canonical_editions SET hidden=$2 WHERE id=$1',[target.editionId,hidden]);
  assert.equal((await db.query('SELECT admitted FROM marketplace_sec.phase9_catalogue_isbn_v1($1,NULL)',[formatted])).rows[0].admitted,true);
  const {entry}=await published(f);
  assert.equal(entry.bibliographic_payload.rows.some(r=>r.providerRecordId===option.metadata.providerRecordId),!hidden);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM public.canonical_provider_ids
    WHERE canonical_edition_id='${target.editionId}' AND adapter_key='open_library'`),0);
});

for(const kind of ['ineligible','conflict-skipped'])
test(`AC7-6: final publication recheck covers a ${kind} row after tentative filtering`,async()=>{
  const f=await batch(), option=f.rows[kind==='ineligible'?4:0];
  option.metadata={...option.metadata,isbn10:'0-306-40615-2',isbn13:null};
  const target=await seedIncumbent(db,{...option.metadata,title:'Different canonical work',isbn10:'0306406152'});
  // A test-only wrapper hides after the writer's tentative filter, without timing.
  await db.exec(`ALTER FUNCTION marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid) RENAME TO phase9_test_original_scope;
    CREATE FUNCTION marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid) RETURNS text
    LANGUAGE plpgsql VOLATILE AS $$ DECLARE scope text; BEGIN
      scope:=marketplace_sec.phase9_test_original_scope($1,$2);
      UPDATE public.canonical_editions SET hidden=true WHERE id='${target.editionId}'; RETURN scope; END$$;`);
  try {
    const {entry,effect}=await published(f);
    assert.equal(entry.bibliographic_payload.rows.some(r=>r.providerRecordId===option.metadata.providerRecordId),false);
    assert.equal(effect.canonical_results.find(r=>r.optionId===option.optionId).canonicalEditionId,null);
    assert.deepEqual((await db.query('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[f.candidateId])).rows[0].options,f.rows);
  } finally { await resetActor(db); await db.exec(`DROP FUNCTION marketplace_sec.phase9_catalogue_query_scope_v1(uuid,uuid);
    ALTER FUNCTION marketplace_sec.phase9_test_original_scope(uuid,uuid) RENAME TO phase9_catalogue_query_scope_v1;`); }
});

// 02b sections 7.1/8: the lookup's primary tuple cannot publish secondary facts.
test('AC7-11/17: secondary Open Library completion preserves M84 receipt and accounting without publication',async()=>{
  const old=await createLeanDatabase({m84:true});
  const finish=async database=>{
    const f=await olOperation(database,{isbn10:null,isbn13:null},false,true,await scanCacheCard(database));
    for(const [sequence,stage] of [[0,'search'],[1,'editions'],[2,'author:OL1A']]) {
      const call=await rpc(database,'phase9_register_edition_options_provider_call_v1',
        [f.attemptId,f.jobId,'picker-worker-0001','a'.repeat(64),1,randomUUID(),sequence,stage]);
      await rpc(database,'phase9_finalize_edition_options_provider_call_v1',
        [call.provider_call_id,f.jobId,'picker-worker-0001','a'.repeat(64),1,'finalized','no_acceptable_match',false,true]);
    }
    const option=row(0,{googleBooksUrl:'https://openlibrary.org/books/'+f.facts.providerRecordId,metadata:f.facts});
    const response=await completeCatalogueV2(database,{...f,rows:[option],catalogueCompanions:null,
      fetched:f.facts.fetchedAt,deadline:new Date(Date.parse(f.facts.fetchedAt)+3600000).toISOString()});
    assert.equal(response.status,'completed'); await resetActor(database);
    const rows=(await database.query(`SELECT l.adapter_key,l.execution_mode,l.normalized_outcome,
      l.outcome_source_attempt_id=a.id AS owns_outcome,l.completed_at IS NOT NULL AS lookup_completed,
      a.adapter_key AS actual_adapter,a.provider_role,a.attempt_sequence,a.status,a.disposition,
      a.normalized_outcome AS attempt_outcome,a.normalized_payload,a.calculated_cost_units,
      a.completed_at IS NOT NULL AS attempt_completed,u.status AS usage_status,u.actual_cost_units,
      (SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE job_id=l.job_id) AS calls,
      (SELECT status FROM public.image_extraction_jobs WHERE id=l.job_id) AS job_status
      FROM public.phase9_metadata_lookups l JOIN public.metadata_enrichment_attempts a ON a.id=l.outcome_source_attempt_id
      JOIN public.phase9_usage_reservations u ON u.id=a.usage_reservation_id WHERE l.id=$1`,[f.lookupId])).rows[0];
    const effect=(await database.query('SELECT completion_response,cache_entry_id,cache_payload_digest FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
    assert.deepEqual(effect.completion_response,response);
    assert.equal(effect.cache_entry_id,null); assert.equal(effect.cache_payload_digest,null);
    assert.equal(await scalar(database,'SELECT count(*)::int FROM public.phase9_metadata_cache_entries'),0);
    await setActor(database,f.ownerId,'service_role');
    assert.deepEqual(await recover(database,f),{...response,status:'replayed'});
    await setActor(database,f.ownerId);
    const selected=await scalar(database,selectSql(f,await scalar(database,readSql(f)),option.optionId));
    await resetActor(database);
    const snapshot=(await database.query('SELECT selected_option_snapshot FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',
      [f.candidateId])).rows[0].selected_option_snapshot;
    assert.equal(snapshot.correlationId,f.lookupId); assert.equal(snapshot.attemptId,f.attemptId);
    await setActor(database,f.ownerId);
    await saveReview(database,f,{...f.review,originalTitle:f.facts.title,authors:f.facts.authors,
      originalLanguage:f.facts.language,script:f.facts.script,
      originalFieldConfirmation:{title:true,authors:f.facts.authors.map(()=>true)},
      metadataChoice:{mode:'edition_option',selectionId:selected.selection.selectionId}});
    const committed=await add(database,f); assert.ok(committed.item.canonical_edition_id);
    await resetActor(database);
    const lineage=(await database.query(`SELECT l.candidate_id=$4 AS owns_candidate,l.outcome_source_attempt_id=$2 AS owns_attempt,
      a.lookup_id=l.id AS owns_lookup,src.provider,src.provider_book_id,src.adapter_key
      FROM public.phase9_metadata_lookups l JOIN public.metadata_enrichment_attempts a ON a.id=l.outcome_source_attempt_id
      JOIN public.book_metadata_sources src ON src.canonical_edition_id=$3 WHERE l.id=$1`,
      [f.lookupId,f.attemptId,committed.item.canonical_edition_id,f.candidateId])).rows;
    assert.equal(lineage.length,1);
    for(const flag of ['owns_lookup','owns_attempt','owns_candidate']) assert.equal(lineage[0][flag],true,flag);
    assert.equal(lineage[0].provider_book_id,snapshot.providerRecordId);
    return {rows,lineage,receiptKeys:Object.keys(response).sort()};
  };
  try { const baseline=await finish(old); assert.deepEqual(await finish(db),baseline); } finally { await old.close(); }
});

// 02b sections 7.1/10: characterise the inherited M84 secondary policy fence.
test('AC7-11/17: divergent secondary policy versions retain the M84 storage refusal',async()=>{
  const old=await createLeanDatabase({m84:true});
  try {
    for(const database of [old,db]) {
      const f=await olOperation(database,{isbn10:null,isbn13:null},false,true,await scanCacheCard(database));
      for(const [sequence,stage] of [[0,'search'],[1,'editions'],[2,'author:OL1A']]) {
        const call=await rpc(database,'phase9_register_edition_options_provider_call_v1',
          [f.attemptId,f.jobId,'picker-worker-0001','a'.repeat(64),1,randomUUID(),sequence,stage]);
        await rpc(database,'phase9_finalize_edition_options_provider_call_v1',
          [call.provider_call_id,f.jobId,'picker-worker-0001','a'.repeat(64),1,'finalized','no_acceptable_match',false,true]);
      }
      await resetActor(database);
      await database.exec("UPDATE public.phase9_provider_registry SET policy_version=2 WHERE adapter_key='open_library'");
      const before=await completionFootprint(database), option=row(0,{
        googleBooksUrl:'https://openlibrary.org/books/'+f.facts.providerRecordId,metadata:f.facts});
      await assert.rejects(()=>completeCatalogueV2(database,{...f,rows:[option],catalogueCompanions:null,
        fetched:f.facts.fetchedAt,deadline:new Date(Date.parse(f.facts.fetchedAt)+3600000).toISOString()}),
        e=>e.code==='P0001' && e.message==='P9_METADATA_STORAGE_DENIED');
      assert.equal(await completionFootprint(database),before,'refusal preserves physical receipts and all pre-completion rows');
    }
  } finally { await old.close(); await resetActor(db);
    await db.exec("UPDATE public.phase9_provider_registry SET policy_version=1 WHERE adapter_key='open_library'"); }
});

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
  // AC7-7/15: inspect bytes read from the persisted JSONB, not a client projection.
  const stored=(await db.query("SELECT encode(convert_to(bibliographic_payload::text,'UTF8'),'hex') AS bytes FROM public.phase9_metadata_cache_entries WHERE id=$1",[entry.id])).rows[0];
  const bytes=Buffer.from(stored.bytes,'hex').toString('utf8');
  assert.deepEqual(JSON.parse(bytes),p);
  assert.doesNotMatch(bytes,/rawProviderPayload|raw_payload|store_id|candidate_id|storeId|candidateId/);
  for(const privateId of [f.storeId,f.candidateId,f.lookupId,f.attemptId,f.jobId,...f.rows.map(r=>r.optionId)])
    assert.equal(bytes.includes(privateId),false,privateId);
  const scope=(await db.query('SELECT marketplace_sec.phase9_catalogue_query_scope_v1($1,$2) AS scope',[f.candidateId,f.lookupId])).rows[0].scope;
  assert.equal(scope,'public_bibliographic','immutable scan provenance must positively establish public scope');
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

for(const expired of [true,false])
test(`AC7-24: a new completion refreshes an ${expired?'expired':'invalidated'} incumbent`,async()=>{
  const initial=await batch(), {entry:before}=await published(initial); await resetActor(db);
  if(expired) await db.query(`UPDATE public.phase9_metadata_cache_entries
    SET created_at=source_fetched_at,expires_at=source_fetched_at+interval '1 millisecond' WHERE id=$1`,[before.id]);
  else await db.query('UPDATE public.phase9_metadata_cache_entries SET invalidated_at=clock_timestamp() WHERE id=$1',[before.id]);
  const next=await batch({publisher:'Fresh cache press'}), {entry:after,effect}=await published(next);
  assert.notEqual(next.lookupId,initial.lookupId); assert.equal(after.id,before.id);
  assert.equal(after.provider_cache_identity,before.provider_cache_identity);
  assert.notEqual(after.payload_digest,before.payload_digest); assert.equal(after.invalidated_at,null);
  assert.equal(after.bibliographic_payload.rows[0].metadata.publisher,'Fresh cache press');
  assert.equal(effect.cache_payload_digest,after.payload_digest);
  assert.equal(after.expires_at.getTime()>Date.now(),true);
  const saved=await completionFootprint(db); assert.equal((await completeCatalogueV2(db,next)).status,'replayed');
  assert.equal(await completionFootprint(db),saved);
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
  const receiver=await scanCacheCard(db); await setActor(db,receiver.ownerId);
  await saveReview(db,receiver,{...receiver.review,originalTitle:receiver.facts.title,authors:receiver.facts.authors,
    originalLanguage:receiver.facts.language,originalFieldConfirmation:{title:true,authors:[true,true]}});
  const next=await catalogueBatch(db,{},null,{existing:receiver}), {entry}=await published(next);
  assert.notEqual(next.lookupId,initial.lookupId); assert.notEqual(next.jobId,initial.jobId);
  assert.equal(entry.bibliographic_payload.rows.some(r=>r.providerRecordId===initial.rows[0].metadata.providerRecordId),false);
  const privateRows=(await db.query('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[next.candidateId])).rows[0].options;
  assert.deepEqual(privateRows,next.rows);
});

test('AC7-13/14: unexpected cache publication failure rolls back all completion writes and retry reuses durable HTTP receipts',async()=>{
  const f=await batch(); await requireM86(db,'marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)');
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

test('[baseline] idle cache path leaves the v2 receipt byte-equal to the persisted M84 result',async()=>{
  const old=await createLeanDatabase({m84:true});
  try {
    const f=await catalogueBatch(old); await resetActor(old);
    await old.query("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
    const response=await completeCatalogueV2(old,f); await resetActor(old);
    const original=await completionFootprint(old);
    const saved=(await old.query('SELECT completion_response::text AS bytes,cache_entry_id,cache_payload_digest FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
    await applyM85IfPresent(old); await applyM86IfPresent(old);
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
      assert.equal(entry.expires_at.getTime(),Date.parse(f.fetched)+expected*1000,label);
      assert.equal((await completeCatalogueV2(db,f)).status,'replayed'); await resetActor(db);
      const after=(await db.query('SELECT expires_at FROM public.phase9_metadata_cache_entries WHERE id=$1',[entry.id])).rows[0];
      assert.equal(after.expires_at.getTime(),entry.expires_at.getTime());
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

// 02b ?5/?12: effective catalog/role proof, independent of DDL spelling.
for(const signature of ['phase9_catalogue_query_scope_v1(uuid,uuid)','phase9_catalogue_store_cache_v1(uuid,jsonb)'])
test(`AC7-8: M86 postgres-only cache helper ${signature}`,async()=>{
  const name='marketplace_sec.'+signature; await requireM86(db,name);
  const f=(await db.query(`SELECT r.rolname,p.proconfig,p.prosecdef FROM pg_proc p
    JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure($1)`,[name])).rows[0];
  assert.equal(f.rolname,'postgres'); assert.ok(f.proconfig.includes('search_path=""')); assert.equal(f.prosecdef,true);
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,name])).rows[0].allowed,false);
    const args=signature.slice(signature.indexOf('(')+1,-1).split(',').map(t=>'NULL::'+t).join(',');
    await asRole(db,role,null,async()=>{await assert.rejects(
      ()=>db.query(`SELECT marketplace_sec.${signature.split('(')[0]}(${args})`),e=>e.code==='42501');});
  }
});
test('AC7-13/17: successful publication sees its durable effect and precedes job resolution',async()=>{
  const f=await batch(); await requireM86(db,'marketplace_sec.phase9_catalogue_store_cache_v1(uuid,jsonb)');
  await db.exec(`CREATE TABLE public.phase9_test_publication_order(job_id uuid PRIMARY KEY);
    CREATE FUNCTION public.phase9_test_publication_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_TABLE_NAME='phase9_metadata_cache_entries' THEN
        IF NOT EXISTS(SELECT 1 FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id='${f.lookupId}')
          OR (SELECT status='resolved' FROM public.image_extraction_jobs WHERE id='${f.jobId}')
        THEN RAISE SQLSTATE 'XX000' USING MESSAGE='publication must follow effect and precede job resolution'; END IF;
        INSERT INTO public.phase9_test_publication_order VALUES('${f.jobId}');
      ELSIF NEW.id='${f.jobId}' AND NEW.status='resolved' AND NOT EXISTS(
        SELECT 1 FROM public.phase9_test_publication_order WHERE job_id=NEW.id)
      THEN RAISE SQLSTATE 'XX000' USING MESSAGE='job resolved before publication'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER phase9_test_publication_order BEFORE INSERT ON public.phase9_metadata_cache_entries
      FOR EACH ROW EXECUTE FUNCTION public.phase9_test_publication_order();
    CREATE TRIGGER phase9_test_publication_order BEFORE UPDATE ON public.image_extraction_jobs
      FOR EACH ROW EXECUTE FUNCTION public.phase9_test_publication_order();`);
  try {
    await published(f);
    assert.equal(await scalar(db,'SELECT count(*)::int FROM public.phase9_test_publication_order'),1);
    assert.equal(await scalar(db,`SELECT status FROM public.image_extraction_jobs WHERE id='${f.jobId}'`),'resolved');
  } finally { await resetActor(db); await db.exec(`DROP TRIGGER phase9_test_publication_order ON public.phase9_metadata_cache_entries;
    DROP TRIGGER phase9_test_publication_order ON public.image_extraction_jobs;
    DROP FUNCTION public.phase9_test_publication_order(); DROP TABLE public.phase9_test_publication_order;`); }
});
