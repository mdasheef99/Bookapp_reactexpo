// 02b sections 4.5/5/8/9/12; AC7-8/10/15/17. Test-only green target for M85.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { applyM85IfPresent, asRole, catalogueBatch, completeCatalogueV2, createLeanDatabase, requireM85 } from './leanCatalogueFixture.mjs';
import { automaticCard, enableOL, facts, resetActor, setActor } from './catalogueLinkFixture.mjs';
import { finalize, prepareCall, resultRows, rpc, seedOperation, worker, token } from './editionOptionsCompletionFixture.mjs';
import { claimJob, scalar } from './editionPickerFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase({ m85:true }); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });

// 02b sections 8.2/10/12: the idle M85 stage adds cache lineage only.
test('AC7-11/17: M85 preserves the M73 external provider predicate exactly',async()=>{
  const old=await createLeanDatabase({m84:true});
  try {
    await enableOL(old);
    const ol=await catalogueBatch(old); await completeCatalogueV2(old,ol);
    const gb=await seedOperation(old); await prepareCall(old,gb); await finalize(old,gb);
    await completeCatalogueV2(old,{...gb,...resultRows(gb),catalogueCompanions:null});
    await resetActor(old);
    const policy=async f=>(await old.query(`SELECT marketplace_sec.phase9_edition_source_policy(s) AS admitted
      FROM public.phase9_candidate_edition_state s WHERE candidate_id=$1`,[f.candidateId])).rows[0].admitted;
    assert.equal(await policy(ol),true); assert.equal(await policy(gb),true);
    await old.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,
      enabled,matching_allowed,storage_allowed,public_display_allowed,revalidation_seconds,policy_version)
      VALUES('third_metadata','metadata','1.0.0',true,true,true,true,3600,1)`);
    const switchOL=async adapter=>{
      await old.query('UPDATE public.metadata_enrichment_attempts SET adapter_key=$1 WHERE id=$2',[adapter,ol.attemptId]);
      await old.query('UPDATE public.phase9_metadata_lookups SET adapter_key=$1 WHERE id=$2',[adapter,ol.lookupId]);
    };
    await switchOL('third_metadata'); assert.equal(await policy(ol),false,'M73 refuses an enabled third metadata provider');
    await applyM85IfPresent(old);
    assert.equal(await policy(ol),false,'M85 must preserve M73 external-lineage refusal');
    assert.equal(await policy(gb),true,'genuine Google external lineage remains admitted');
    await switchOL('open_library'); assert.equal(await policy(ol),true,'genuine Open Library external lineage remains admitted');
  } finally { await old.close(); }
});

function safePayload() {
  const metadata = facts({ isbn10:null,isbn13:null,fetchedAt:'2026-10-28T00:00:00Z' });
  for (const key of ['correlationId','attemptId','matchRationale','confidence']) delete metadata[key];
  return { version:'psr-edition-cache-v1',sourceFetchedAt:metadata.fetchedAt,rows:[{
    ordinal:0,eligibility:'eligible',googleBooksUrl:'https://openlibrary.org/books/OL100M',
    providerRecordId:'OL100M',metadata,
    companion:{ version:'psr-catalogue-write-v1',workExternalId:'OL700W',oclc:'0001234',lccn:'n 79021164' },
  }] };
}
async function columns() {
  await resetActor(db);
  return (await db.query(`SELECT table_schema,table_name,column_name,column_default,is_nullable
    FROM information_schema.columns WHERE (table_schema='public' AND table_name='phase9_metadata_cache_entries')
    OR (table_schema='marketplace_sec' AND table_name='phase9_catalogue_lookup_effects')`)).rows;
}
async function validate(payload) {
  await requireM85(db,'marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb)');
  return (await db.query('SELECT marketplace_sec.phase9_catalogue_valid_cache_v1($1) AS valid',[payload])).rows[0].valid;
}
async function checkCacheShape(overrides = {}) {
  const payload = safePayload();
  const row = { id:randomUUID(),provider_cache_identity:'psr-edition-cache-v1:'+ 'a'.repeat(64),
    query_identity:'fixture-query',adapter_key:'open_library',adapter_version:'1.0.0',capability_version:'cap-v1',
    normalizer_version:'p9-bibliographic-normalizer-v1',schema_version:'p9-metadata-v1',cache_policy_version:'cache-v1',
    reuse_policy_version:'1',privacy_scope:'public_bibliographic',store_id:null,outcome:'positive',
    normalized_snapshot:null,source_attempt_id:null,provider_record_id:null,source_fetched_at:payload.sourceFetchedAt,
    expires_at:new Date(Date.parse(payload.sourceFetchedAt)+3600000).toISOString(),payload_kind:'edition_options_v1',
    bibliographic_payload:payload,routing_policy_version:'routing-v1', ...overrides };
  const digest = (await db.query("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS digest",[row.bibliographic_payload])).rows[0].digest;
  row.payload_digest = Object.hasOwn(overrides,'payload_digest') ? overrides.payload_digest : digest;
  row.created_at=payload.sourceFetchedAt;
  return evaluateChecks('phase9_metadata_cache_entries',row);
}
// Evaluate the database's actual CHECK expressions; receipt-authorized INSERT
// acceptance is tested through real completion/reuse, never by forging receipts.
async function evaluateChecks(table, row, names=null) {
  const checks=(await db.query(`SELECT pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint
    WHERE conrelid=('public.'||$1)::regclass AND contype='c' AND ($2::text[] IS NULL OR conname=ANY($2))`,[table,names])).rows;
  assert.ok(checks.length>0,'the actual CHECK scanner must find baseline constraints');
  return (await db.query(`SELECT (${checks.map(c=>'('+c.expression+') IS NOT FALSE').join(' AND ')}) AS accepted
    FROM jsonb_populate_record(NULL::public.${table},$1::jsonb) r`,[row])).rows[0].accepted;
}
async function schemaReady() {
  const found = await columns();
  assert.ok(found.some(c=>c.table_name==='phase9_catalogue_lookup_effects' && c.column_name==='cache_entry_id'));
  assert.ok(found.some(c=>c.table_name==='phase9_metadata_cache_entries' && c.column_name==='payload_kind'),
    'M85 cache tagged union must expose payload_kind beside the real M84 effects table');
}

test('[baseline] schema fixture sees M84 nullable cache receipts and valid recorded metadata', async () => {
  const found = await columns();
  assert.equal(found.filter(c=>c.table_name==='phase9_catalogue_lookup_effects' &&
    ['cache_entry_id','cache_payload_digest'].includes(c.column_name) && c.is_nullable==='YES').length,2);
  assert.equal(found.filter(c=>c.table_name==='phase9_metadata_cache_entries').length>=20,true);
  const payload = JSON.parse(JSON.stringify(safePayload()));
  assert.equal(payload.rows.length,1); assert.equal(payload.rows[0].metadata.providerRecordId,'OL100M');
  const f = await catalogueBatch(db); await resetActor(db);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_valid_rows($1) AS valid',[f.rows])).rows[0].valid,true);
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
});

test('AC7-17: cache union adds four columns and defaults legacy rows to selected_snapshot_v1', async () => {
  await schemaReady(); const found = await columns();
  for (const name of ['payload_kind','bibliographic_payload','payload_digest','routing_policy_version'])
    assert.equal(found.filter(c=>c.table_name==='phase9_metadata_cache_entries' && c.column_name===name).length,1,name);
  assert.match(found.find(c=>c.column_name==='payload_kind').column_default,/selected_snapshot_v1/);
  assert.equal(found.find(c=>c.column_name==='payload_kind').is_nullable,'NO');
  assert.equal(await checkCacheShape(),true,'strict safe new-kind shape must satisfy the real CHECKs');
});

test('AC7-15: strict validator accepts safe bibliographic rows and unavailable null rows', async () => {
  const payload = safePayload();
  payload.rows.push({ordinal:1,eligibility:'unavailable',googleBooksUrl:null,providerRecordId:null,metadata:null,companion:null});
  assert.equal(await validate(payload),true,'M85 validator must accept the strict safe payload');
});

// 02b section 8.2: hostile jsonb has bounded refusal; duplicate keys use SQL's
// last-key semantics rather than pretending the original JSON text survives.
test('AC7-15: validator bounds hostile key sets, arrays, Unicode and numeric extremes',async()=>{
  const p=safePayload(), text=JSON.stringify(p);
  const cases=[Object.assign({},p,Object.fromEntries(Array.from({length:8192},(_,i)=>['key'+i,'x']))),
    {...p,rows:Array(8192).fill(p.rows[0])},{...p,'版本\u200d':'x'},
    text.replace('"ordinal":0','"ordinal":1e1000'),text.slice(0,-1)+',"version":"invalid"}'];
  for(const payload of cases) assert.equal(await validate(payload),false);
  assert.equal(await validate(text.replace('"version":"psr-edition-cache-v1"',
    '"version":"invalid","version":"psr-edition-cache-v1"')),true,'last valid duplicate is indistinguishable from canonical jsonb');
  assert.equal(await validate(p),true);
});

for (const [label,alter] of [
  ['forged scope',p=>{p.privacyScope='public_bibliographic';}],
  ['Owner text',p=>{p.ownerTitle='Private Owner note';}],
  ['private option ID',p=>{p.rows[0].optionId=randomUUID();}],
  ['private attempt ID',p=>{p.rows[0].metadata.attemptId=randomUUID();}],
  ['raw response',p=>{p.rawResponse={docs:[]};}],
  ['unknown metadata key',p=>{p.rows[0].metadata.unapproved='value';}],
  ['unknown companion key',p=>{p.rows[0].companion.lookupId=randomUUID();}],
  ['foreign cover',p=>{p.rows[0].metadata.coverReference='https://evil.example/cover.jpg';}],
  ['eleven rows',p=>{p.rows=Array.from({length:11},(_,ordinal)=>({...p.rows[0],ordinal}));}],
  ['oversize payload',p=>{p.rows[0].metadata.description='x'.repeat(2621441);}],
]) test(`AC7-15: validator refuses ${label}`, async () => {
  const payload = safePayload(); assert.equal(await validate(payload),true,'safe positive control must be admitted');
  alter(payload); assert.equal(await validate(payload),false,label);
});

for (const [label,changes] of [
  ['snapshot in options kind',{normalized_snapshot:{title:'private'}}],
  ['private provenance pointer',{source_attempt_id:randomUUID()}],
  ['provider record pointer',{provider_record_id:'OL100M'}],
  ['missing bibliographic payload',{bibliographic_payload:null}],
  ['missing digest',{payload_digest:null}],
  ['missing source fetched time',{source_fetched_at:null}],
  ['missing routing version',{routing_policy_version:null}],
  ['blank routing version',{routing_policy_version:' '}],
  ['invalid digest',{payload_digest:'not-hex'}],
  ['negative options',{outcome:'negative'}],
  ['public store pointer',{store_id:randomUUID()}],
  ['private scope without store',{privacy_scope:'store_private'}],
]) test(`AC7-15/17: tagged union refuses ${label}`, async () => {
  await schemaReady();
  assert.equal(await checkCacheShape(),true,'valid new-kind shape must satisfy the actual CHECKs first');
  assert.equal(await checkCacheShape(changes),false,label);
});

test('AC7-8: changed cache table retains RLS and service SELECT only through effective roles', async () => {
  await schemaReady();
  await db.query(`INSERT INTO public.phase9_metadata_cache_entries(provider_cache_identity,query_identity,adapter_key,
    adapter_version,capability_version,normalizer_version,schema_version,cache_policy_version,reuse_policy_version,
    privacy_scope,outcome,expires_at) VALUES('legacy-role-control','role-query','open_library','1.0.0','cap-v1',
    'normalizer-v1','schema-v1','cache-v1','1','public_bibliographic','negative',now()+interval '1 hour')`);
  const relation=(await db.query(`SELECT c.relrowsecurity,r.rolname FROM pg_class c JOIN pg_roles r
    ON r.oid=c.relowner WHERE c.oid='public.phase9_metadata_cache_entries'::regclass`)).rows[0];
  assert.deepEqual(relation,{relrowsecurity:true,rolname:'postgres'});
  for (const role of ['anon','authenticated','service_role']) {
    for (const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
      assert.equal((await db.query("SELECT has_table_privilege($1,'public.phase9_metadata_cache_entries',$2) AS allowed",[role,privilege])).rows[0].allowed,false);
    await asRole(db,role,null,async()=>{
      if(role==='service_role') assert.equal((await db.query('SELECT count(*)::int AS n FROM public.phase9_metadata_cache_entries')).rows[0].n,1);
      else await assert.rejects(()=>db.query('SELECT * FROM public.phase9_metadata_cache_entries'),e=>e.code==='42501');
      await assert.rejects(()=>db.query('DELETE FROM public.phase9_metadata_cache_entries'),e=>e.code==='42501');
    });
  }
});

const privateFunctions = [
  'phase9_catalogue_valid_cache_v1(jsonb)','phase9_catalogue_cache_receipt_guard()',
];
for(const signature of privateFunctions) test(`AC7-8: postgres-only cache helper ${signature}`,async()=>{
  const name='marketplace_sec.'+signature; await requireM85(db,name);
  const f=(await db.query(`SELECT r.rolname,p.proconfig,p.prosecdef FROM pg_proc p
    JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure($1)`,[name])).rows[0];
  assert.equal(f.rolname,'postgres'); assert.ok(f.proconfig.includes('search_path=""'));
  assert.equal(f.prosecdef,!signature.startsWith('phase9_catalogue_valid_cache_v1'));
  for(const role of ['anon','authenticated','service_role']) {
    assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[role,name])).rows[0].allowed,false);
    const args=signature.slice(signature.indexOf('(')+1,-1).split(',').filter(Boolean)
      .map(type=>'NULL::'+type).join(',');
    await asRole(db,role,null,async()=>{
      await assert.rejects(()=>db.query(`SELECT marketplace_sec.${signature.split('(')[0]}(${args})`),
        e=>e.code==='42501');
    });
  }
});

test('AC7-15: both named lookup CHECKs admit cache_hit and keep local/external shape branches',async()=>{
  await resetActor(db);
  const constraints=(await db.query(`SELECT conname,pg_get_constraintdef(oid) AS definition,
    to_regclass('marketplace_sec.phase9_catalogue_lookup_effects') IS NOT NULL AS baseline
    FROM pg_constraint WHERE conrelid='public.phase9_metadata_lookups'::regclass
      AND conname IN('phase9_metadata_lookups_check1','phase9_metadata_lookups_execution_mode_check')`)).rows;
  assert.equal(constraints.length,2,'both baseline lookup constraints must be visible');
  assert.equal(constraints.every(c=>c.baseline),true);
  for(const c of constraints) assert.match(c.definition,/cache_hit/,'M85 lookup CHECK must admit cache_hit');
  // Behavioral shape/receipt proof is exercised through the service reuse path in C2.
  const shape=constraints.find(c=>c.conname==='phase9_metadata_lookups_check1').definition;
  assert.match(shape,/local/); assert.match(shape,/external/);
});

test('AC7-15: cache-hit receipt proof is a deferred initially-deferred lookup constraint trigger',async()=>{
  await requireM85(db,'marketplace_sec.phase9_catalogue_cache_receipt_guard()');
  const rows=(await db.query(`SELECT t.tgdeferrable,t.tginitdeferred FROM pg_trigger t
    WHERE t.tgrelid='public.phase9_metadata_lookups'::regclass
    AND t.tgfoid='marketplace_sec.phase9_catalogue_cache_receipt_guard()'::regprocedure`)).rows;
  assert.equal(rows.some(t=>t.tgdeferrable && t.tginitdeferred),true);
});

test('[baseline] legacy writer still refuses explicit automatic positive snapshot writes',async()=>{
  const f=await catalogueBatch(db); await completeCatalogueV2(db,f);
  await resetActor(db);
  await assert.rejects(()=>db.query(`UPDATE public.metadata_enrichment_attempts
    SET normalized_payload=$1 WHERE id=$2`,[f.rows[0].metadata,f.attemptId]),
    e=>e.code==='P0001' && /P9_EDITION_AUTOMATIC_PAYLOAD_DENIED/.test(e.message));
});


test('AC7-15/17: real lookup CHECKs accept cache-hit shape and reject each missing identity/pointer variant',async()=>{
  const f=await catalogueBatch(db); await resetActor(db);
  const names=['phase9_metadata_lookups_check1','phase9_metadata_lookups_execution_mode_check'];
  const external=(await db.query('SELECT to_jsonb(l) AS row FROM public.phase9_metadata_lookups l WHERE id=$1',[f.lookupId])).rows[0].row;
  assert.equal(await evaluateChecks('phase9_metadata_lookups',external,names),true,'real M84 external control must satisfy both checks');
  const cached={...external,execution_mode:'cache_hit',outcome_source_attempt_id:f.attemptId};
  assert.equal(await evaluateChecks('phase9_metadata_lookups',cached,names),true,'M85 CHECKs must admit a complete cache-hit row');
  for(const name of ['provider_cache_identity','adapter_key','adapter_version','capability_version',
    'reuse_policy_version','cache_policy_version','cache_namespace'])
    assert.equal(await evaluateChecks('phase9_metadata_lookups',{...cached,[name]:null},names),false,name);
  for(const name of ['leader_lookup_id','reuse_source_attempt_id'])
    assert.equal(await evaluateChecks('phase9_metadata_lookups',{...cached,[name]:randomUUID()},names),false,name);
  assert.equal(await evaluateChecks('phase9_metadata_lookups',{...cached,execution_mode:'unapproved'},names),false);
  const local={...external,execution_mode:'local'};
  for(const name of ['provider_cache_identity','adapter_key','adapter_version','capability_version',
    'reuse_policy_version','cache_policy_version','cache_namespace','leader_lookup_id','reuse_source_attempt_id','outcome_source_attempt_id']) local[name]=null;
  assert.equal(await evaluateChecks('phase9_metadata_lookups',local,names),true,'M84 local branch must stay valid');
});

test('AC7-17: legacy tagged-union branch retains its snapshot and refuses all new-kind payload fields',async()=>{
  await schemaReady();
  const legacy={payload_kind:'selected_snapshot_v1',normalized_snapshot:facts(),
    bibliographic_payload:null,payload_digest:null,routing_policy_version:null};
  assert.equal(await checkCacheShape(legacy),true,'legacy positive snapshot shape must remain accepted');
  for(const changes of [{bibliographic_payload:safePayload()},{payload_digest:'b'.repeat(64)},{routing_policy_version:'routing-v1'}])
    assert.equal(await checkCacheShape({...legacy,...changes}),false);
});
