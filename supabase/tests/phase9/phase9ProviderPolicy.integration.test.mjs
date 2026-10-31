// 02c §§3.1,4.1–4.2,8,9 AC8-9a/10/11/12; 8a-1 then 8a-2.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { clean, createProviderDatabase, denied, footprint, needs, needsCapabilities,
  permissive, synthetic, value, facts, sourcePolicy } from './providerReplacementFixture.mjs';
let db;
before(async () => { db = await createProviderDatabase(); });
beforeEach(async () => { await clean(db); });
after(async () => { await db?.close(); });

for (const role of ['anon','authenticated']) test(`AC8-11 [8a-1] GREEN-control ${role} cannot rewrite registry policy`, async () => {
  const before = await value(db, "SELECT to_jsonb(r) FROM public.phase9_provider_registry r WHERE adapter_key='open_library'");
  await denied(db, role, "UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='open_library'");
  assert.deepEqual(await value(db, "SELECT to_jsonb(r) FROM public.phase9_provider_registry r WHERE adapter_key='open_library'"), before);
});

test('AC8-10 [8a-1] new unconfigured providers default to no capabilities or route', async t => {
  if (!await needsCapabilities(t, db)) return;
  await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version)
    VALUES('synthetic_catalogue','metadata','1.0.0')`);
  const r = await value(db, "SELECT to_jsonb(r) FROM public.phase9_provider_registry r WHERE adapter_key='synthetic_catalogue'");
  for (const k of ['automatic_lookup_allowed','explicit_search_allowed','shared_catalogue_allowed']) assert.equal(r[k], false, k);
  for (const k of ['automatic_role','explicit_role','automatic_order','explicit_order','validation_contract',
    'host_policy_version','options_retention_seconds','display_label','protection_policy']) assert.equal(r[k], null, k);
  for (const k of ['accepted_adapter_versions','approved_request_hosts','approved_book_hosts','approved_cover_hosts']) assert.deepEqual(r[k], [], k);
});

test('AC8-10 [8a-1] transition preserves old policy values and assigns separate Google/OL purposes', async t => {
  if (!await needsCapabilities(t, db)) return;
  const rows = (await db.query("SELECT * FROM public.phase9_provider_registry WHERE adapter_key IN('google_books','open_library') ORDER BY adapter_key")).rows;
  const [g,o] = rows;
  assert.equal(g.automatic_lookup_allowed,true); assert.equal(g.automatic_role,'primary'); assert.equal(g.automatic_order,1);
  assert.equal(g.explicit_search_allowed,false); assert.equal(g.explicit_role,null); assert.equal(g.explicit_order,null);
  assert.equal(g.shared_catalogue_allowed,false);
  assert.equal(o.automatic_lookup_allowed,false); assert.equal(o.automatic_role,null); assert.equal(o.automatic_order,null);
  assert.equal(o.explicit_search_allowed,true); assert.equal(o.explicit_role,'primary'); assert.equal(o.explicit_order,1);
  assert.equal(o.shared_catalogue_allowed,true);
  for (const row of rows) {
    assert.equal(row.adapter_version,'1.0.0'); assert.equal(row.policy_version,1); assert.equal(row.enabled,true);
    assert.deepEqual(row.accepted_adapter_versions,['1.0.0']);
    assert.equal(row.version_contracts['1.0.0'].payloadSchemaVersion,'p9-metadata-v1');
    assert.equal(row.version_contracts['1.0.0'].lookupSchemaVersion,'p9-metadata-foundation-v1');
    const google=row.adapter_key==='google_books';
    assert.deepEqual(row.version_contracts,{'1.0.0':{validationContract:google?'google-books-v1':'open-library-v1',
      hostPolicyVersion:google?'google-books-hosts-v1':'open-library-hosts-v1',
      capabilityVersion:google?'google-books-capability-v1':'open-library-capability-v1',
      normalizerVersion:'p9-bibliographic-normalizer-v1',payloadSchemaVersion:'p9-metadata-v1',lookupSchemaVersion:'p9-metadata-foundation-v1'}});
    assert.equal(row.validation_contract,row.version_contracts['1.0.0'].validationContract);
    assert.equal(row.host_policy_version,row.version_contracts['1.0.0'].hostPolicyVersion);
    assert.deepEqual(row.approved_request_hosts,[google?'www.googleapis.com':'openlibrary.org']);
    assert.deepEqual(row.approved_book_hosts,[google?'books.google.com':'openlibrary.org']);
    assert.deepEqual(row.approved_cover_hosts,[google?'books.google.com':'covers.openlibrary.org']);
    assert.equal(row.display_label,google?'Google Books':'Open Library');
    assert.equal(row.options_retention_seconds,google?null:86400);
    assert.equal(row.protection_policy,null,'OQ8-1/3 operating values are unapproved');
    const old=db.preMigrationRegistry.find(r=>r.adapter_key===row.adapter_key);
    for(const [key,value]of Object.entries(old))assert.deepEqual(row[key],value,'old field unchanged: '+key);
  }
});

// 02c §3.1: valid registry tuple first, then one invalid boundary per transaction.
const protection={version:'p9-protection-v1',minIntervalMs:1,storeWindowSeconds:1,storeMaxGets:1,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:1,breakerWindowSeconds:1,breakerCooldownMs:1,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
const googleTuple={validationContract:'google-books-v1',hostPolicyVersion:'google-books-hosts-v1',
  capabilityVersion:'google-books-capability-v1',normalizerVersion:'p9-bibliographic-normalizer-v1',
  payloadSchemaVersion:'p9-metadata-v1',lookupSchemaVersion:'p9-metadata-foundation-v1'};
const invalid=[
  ['duplicate accepted version',{accepted_adapter_versions:['1.0.0','1.0.0']}],
  ['too many accepted versions',{accepted_adapter_versions:Array.from({length:9},(_,i)=>'v'+i)}],
  ['unsafe version identifier',{accepted_adapter_versions:['1.0.0','bad version']}],
  ['oversized version identifier',{accepted_adapter_versions:['1.0.0','x'.repeat(65)]}],
  ['missing active version',{accepted_adapter_versions:['2.0.0']}],
  ['missing version tuple',{version_contracts:{}}],
  ['unknown tuple key',{version_contracts:{'1.0.0':{unexpected:true}}}],
  ['validator alias mismatch',{validation_contract:'never-installed'}],
  ['host alias mismatch',{host_policy_version:'never-installed'}],
  ['unsafe host',{approved_request_hosts:['127.0.0.1']}],
  ['duplicate host',{approved_request_hosts:['www.googleapis.com','www.googleapis.com']}],
  ['too many hosts',{approved_book_hosts:Array.from({length:9},(_,i)=>`host${i}.example.test`)}],
  ['oversized host',{approved_cover_hosts:['a'.repeat(254)]}],
  ['uppercase host',{approved_request_hosts:['WWW.GOOGLEAPIS.COM']}],
  ['wildcard host',{approved_cover_hosts:['*.example.test']}],
  ['host with credentials',{approved_book_hosts:['user@openlibrary.org']}],
  ['host with port',{approved_book_hosts:['books.google.com:443']}],
  ['host with path',{approved_book_hosts:['books.google.com/books']}],
  ['oversized retention',{options_retention_seconds:86401}],
  ['zero retention',{options_retention_seconds:0}],
  ['unsafe display label',{display_label:'<script>bad</script>'}],
  ['empty display label',{display_label:''}],
  ['oversized display label',{display_label:'x'.repeat(81)}],
  ['role/order mismatch',{automatic_role:'secondary',automatic_order:1}],
  ['permission/role mismatch',{automatic_lookup_allowed:false,automatic_role:'primary',automatic_order:1}],
  ['unknown protection key',{protection_policy:{...protection,unexpected:true}}],
  ['zero protection bound',{protection_policy:{...protection,minIntervalMs:0}}],
  ['oversized protection bound',{protection_policy:{...protection,storeMaxGets:2147483648}}],
  ['reversed backoff',{protection_policy:{...protection,backoffBaseMs:3}}],
  ['half-open bound',{protection_policy:{...protection,halfOpenMax:2}}],
  ['unknown protection mode',{protection_policy:{...protection,mode:'unapproved'}}],
  ['secret contact',{protection_policy:{...protection,contactId:'private@example.test'}}],
];
// Test-only bounds, never proposed OQ8-1/3 operating values.
for(const key of Object.keys(googleTuple))invalid.push([`${key} identifier bound`,{
  version_contracts:{'1.0.0':{...googleTuple,[key]:'x'.repeat(129)}}}]);
for(const key of ['minIntervalMs','storeWindowSeconds','storeMaxGets','backoffBaseMs','backoffMaxMs',
  'breakerFailures','breakerWindowSeconds','breakerCooldownMs'])
  for(const bad of [0,2147483648,1.5])invalid.push([`${key}=${bad}`,{protection_policy:{...protection,[key]:bad}}]);
const {contactId:omitted,...missingContact}=protection;
invalid.push(['missing protection key',{protection_policy:missingContact}],
  ['oversized contact identifier',{protection_policy:{...protection,contactId:'x'.repeat(65)}}]);
for(const [label,change] of invalid)test(`AC8-11 [8a-1] registry rejects ${label} at its owning constraint or documented domain boundary`,async t=>{
  if(!await needsCapabilities(t,db))return;
  await db.query('UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key=$2',[protection,'google_books']);
  const row=await value(db,"SELECT to_jsonb(r) FROM public.phase9_provider_registry r WHERE adapter_key='google_books'");
  const keys=Object.keys(change),assignment=keys.join(',');
  const update=`UPDATE public.phase9_provider_registry SET (${assignment})=(SELECT ${assignment}
    FROM jsonb_populate_record(NULL::public.phase9_provider_registry,$1::jsonb)) WHERE adapter_key='google_books'`;
  await db.query(update,[row]); // equivalent valid control
  const before=(await db.query('SELECT * FROM public.phase9_provider_registry ORDER BY adapter_key')).rows;
  await db.exec('BEGIN');let error;
  try{await db.query(update,[change]);}catch(e){error=e;}finally{await db.exec('ROLLBACK');}
  assert.ok(error,`${label}: invalid configuration must be rejected`);
  if(error.code==='23514') {
    const constraint=await value(db,'SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname=$1 AND conrelid=$2::regclass',
      [error.constraint,'public.phase9_provider_registry']);
    assert.ok(keys.some(k=>constraint.includes(k)),`wrong constraint for ${label}: ${constraint}`);
  } else {
    // 02c §4.1 names this stable invalid-configuration error; no invented codes.
    assert.equal(error.code,'P0001');assert.equal(error.message,'P9_PROVIDER_CONFIGURATION_INVALID');
  }
  assert.deepEqual((await db.query('SELECT * FROM public.phase9_provider_registry ORDER BY adapter_key')).rows,before,
    'rejected registry boundary leaves every row unchanged');
});
test('AC8-11 [8a-1] duplicate active route refuses with exact domain error',async t=>{
  if(!await needsCapabilities(t,db))return;
  await db.exec('BEGIN');let error;
  try{await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=true,automatic_role='primary',automatic_order=1
    WHERE adapter_key='open_library'`);}catch(e){error=e;}finally{await db.exec('ROLLBACK');}
  assert.equal(error?.code,'P0001');assert.equal(error.message,'P9_PROVIDER_ROUTE_INVALID');
});

test('AC8-12 [8a-1] GREEN-control all-permissive Google still fails existing shared admission', async () => {
  await permissive(db, 'google_books');
  assert.equal(await value(db,"SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('google_books')"),false);
});

test('AC8-12 [8a-1] independent immutable veto denies Google regardless of version', async t => {
  if (!await needs(t,db,'marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(text,text)','8a-1')) return;
  for (const version of ['1.0.0','2.0.0','forged']) assert.equal(await value(db,
    "SELECT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1('google_books',$1)",[version]),false);
  const fn = (await db.query(`SELECT provolatile,prosecdef,proconfig FROM pg_proc WHERE oid=
    'marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(text,text)'::regprocedure`)).rows[0];
  assert.equal(fn.provolatile,'i'); assert.equal(fn.prosecdef,false); assert.ok(fn.proconfig.includes('search_path=""'));
});

// 02c §4.2: the interim OL list alone must not satisfy either boundary's veto proof.
for (const [boundary,sql] of [
  ['admission','SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1($1)'],
  ['source policy',"SELECT (marketplace_sec.phase9_catalogue_source_policy_v1($1)->>'sharedAdmitted')::boolean"],
]) test(`AC8-12 [8a-1] ${boundary} depends on the independent veto with all registry flags permissive`, async t => {
  const veto='marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(text,text)';
  if (!await needs(t,db,veto,'8a-1')) return;
  const tuple=Object.fromEntries(['validationContract','hostPolicyVersion','capabilityVersion',
    'normalizerVersion','payloadSchemaVersion','lookupSchemaVersion'].map(key=>[key,synthetic[key]]));
  // Copy a valid row, with a distinct synthetic tuple and no competing route.
  // Extra JSON keys are ignored by M88's record type when probing a veto-only install.
  const row={...db.registry.find(r=>r.adapter_key==='open_library'),
    adapter_key:synthetic.adapterKey,adapter_version:synthetic.adapterVersion,
    automatic_lookup_allowed:false,explicit_search_allowed:false,automatic_role:null,explicit_role:null,
    automatic_order:null,explicit_order:null,accepted_adapter_versions:[synthetic.adapterVersion],
    version_contracts:{[synthetic.adapterVersion]:tuple},validation_contract:synthetic.validationContract,
    host_policy_version:synthetic.hostPolicyVersion,approved_request_hosts:['catalogue.example.test'],
    approved_book_hosts:['catalogue.example.test'],approved_cover_hosts:['catalogue.example.test'],
    display_label:'Synthetic Catalogue'};
  await db.query(`INSERT INTO public.phase9_provider_registry
    SELECT (jsonb_populate_record(NULL::public.phase9_provider_registry,$1::jsonb)).*`,[row]);
  for (const [key,expected] of [['open_library',true],['google_books',false],[synthetic.adapterKey,false]]) {
    await permissive(db,key); // Asserts every available boolean flag and route is permissive.
    assert.equal(await value(db,sql,[key]),expected,`${boundary}: all-permissive ${key}`);
  }
  await permissive(db,'open_library');
  assert.equal(await value(db,sql,['open_library']),true,`${boundary}: OL positive before veto injection`);
  const args=await value(db,'SELECT pg_get_function_identity_arguments($1::regprocedure)',[veto]);
  await db.exec('BEGIN');
  try {
    // Disposable DB only: changing the veto must change the real boundary's result.
    // A disconnected predicate plus M83's OL allow-list fails this assertion.
    await db.exec(`CREATE OR REPLACE FUNCTION marketplace_sec.phase9_provider_permanent_reuse_allowed_v1(${args})
      RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$ SELECT false $$`);
    assert.equal(await value(db,"SELECT marketplace_sec.phase9_provider_permanent_reuse_allowed_v1('open_library','1.0.0')"),false);
    for (const key of ['open_library','google_books',synthetic.adapterKey])
      assert.equal(await value(db,sql,[key]),false,`${boundary}: false independent veto must deny ${key}`);
  } finally { await db.exec('ROLLBACK'); }
  assert.equal(await value(db,sql,['open_library']),true,`${boundary}: rollback restores OL positive`);
});

test('AC8-12 [8a-2] forged admitted Google policy cannot create canonical facts or counts', async () => {
  await permissive(db,'google_books');
  const ol=facts({correlationId:randomUUID(),attemptId:randomUUID(),fetchedAt:new Date().toISOString()});
  const control=(await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1,NULL,$2)',[ol,await sourcePolicy(db,ol)])).rows;
  assert.ok(control.some(r=>r.canonical_work_id && r.canonical_edition_id),'equivalent admitted OL resolver positive');
  const m = facts({adapterKey:'google_books',providerRecordId:'GB-42',coverReference:null,
    correlationId:randomUUID(),attemptId:randomUUID(),fetchedAt:new Date().toISOString()});
  const policy = await sourcePolicy(db,m), before = await footprint(db);
  let rows, error;
  try { rows = (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1($1,NULL,$2)',[m,policy])).rows; }
  catch (caught) { error = caught; }
  assert.equal(error?.message??null,null,'Google veto is a null pair, never generic policy rejection');
  assert.deepEqual(rows,[{canonical_work_id:null,canonical_edition_id:null}],
    'Google must yield no canonical pair even with a forged sharedAdmitted policy');
  assert.deepEqual(await footprint(db),before,'Google must create zero canonical/source/provider-ID/count/cache effects');
});

test('AC8-9a [8a-2] storage/display permissions without shared capability cannot admit OL', async t => {
  if (!await needs(t, db, 'marketplace_sec.phase9_catalogue_source_policy_v2(text,text)', '8a-2')) return;
  await db.exec("UPDATE public.phase9_provider_registry SET shared_catalogue_allowed=false WHERE adapter_key='open_library'");
  assert.equal(await value(db,"SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1('open_library')"),false);
});

test('AC8-9a [8a-2] a registry row alone cannot install a validator or a field-rights profile', async () => {
  await db.query(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,
    matching_allowed,storage_allowed,public_display_allowed,shared_source_note)
    VALUES($1,'metadata','1.0.0',true,true,true,true,'Test-only permissions')`,[synthetic.adapterKey]);
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_catalogue_shared_admitted_v1($1)',[synthetic.adapterKey]),false);
});

test('AC8-9a/10 [8a-2] accepted v1 source policy remains version-bound after v2 activation', async t => {
  if (!await needs(t,db,'marketplace_sec.phase9_catalogue_source_policy_v2(text,text)','8a-2')) return;
  // Tuple/policy mutation belongs to 8c; this fixture exercises it only in a disposable DB.
  const tuple = {validationContract:'open-library-v1',hostPolicyVersion:'open-library-hosts-v1',
    capabilityVersion:'open-library-capability-v1',normalizerVersion:'p9-bibliographic-normalizer-v1',
    payloadSchemaVersion:'p9-metadata-v1',lookupSchemaVersion:'p9-metadata-foundation-v1'};
  await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='2.0.0',accepted_adapter_versions=ARRAY['1.0.0','2.0.0'],
    version_contracts=$1,validation_contract='open-library-v2' WHERE adapter_key='open_library'`,
  [{'1.0.0':tuple,'2.0.0':{...tuple,validationContract:'open-library-v2',capabilityVersion:'open-library-capability-v2'}}]);
  const p = await value(db,"SELECT marketplace_sec.phase9_catalogue_source_policy_v2('open_library','1.0.0')");
  assert.equal(p.adapterVersion,'1.0.0'); assert.equal(p.sharedAdmitted,true);
  assert.equal(Object.keys(p).length,8,'retain strict existing source-policy shape');
});
