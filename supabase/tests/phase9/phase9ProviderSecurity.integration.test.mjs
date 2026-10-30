// 02c §§4.2–4.4,8,9 AC8-9a/10/11; actual SET ROLE, not privilege mocks.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { automaticGoogleCommand, clean, createProviderDatabase, denied, needs, requireObject, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import {completionFootprint} from './leanCatalogueCompletionFixture.mjs';
import { olOperation, rpc } from './catalogueLinkFixture.mjs';
import { token, worker } from './editionOptionsCompletionFixture.mjs';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});
const services=[
  ['phase9_metadata_job_context(uuid,text,text,integer)','NULL::uuid,NULL::text,NULL::text,1','8a-1',true],
  ['phase9_complete_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamp with time zone,timestamp with time zone,boolean,jsonb)',
    'NULL::uuid,NULL::text,NULL::text,1,NULL::uuid,NULL::uuid,NULL::uuid,NULL::uuid,0,NULL::text,NULL::uuid,NULL::uuid,NULL::timestamptz,NULL::timestamptz,false,NULL::jsonb','8a-4',true],
  ['phase9_complete_automatic_metadata_v1(jsonb)',"'{}'::jsonb",'8a-4',false],
  ['phase9_recover_automatic_metadata_v1(jsonb)',"'{}'::jsonb",'8a-4',false],
  ['phase9_defer_metadata_admission_v1(jsonb,bigint)',"'{}'::jsonb,1::bigint",'8a-5',false],
];
test('AC8-11 [8a-1] provider configuration read has exact safe DTO and service-only ACL',async t=>{
  const signature='public.phase9_provider_configuration_v1()';
  if(!await needs(t,db,signature,'8a-1'))return;
  for(const role of ['anon','authenticated'])await denied(db,role,'SELECT public.phase9_provider_configuration_v1()');
  assert.equal(await value(db,"SELECT has_function_privilege('service_role',$1,'EXECUTE')",[signature]),true);
  assert.equal(await value(db,`SELECT EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL
    aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0)`,[signature]),false);
  const f=(await db.query('SELECT pg_get_userbyid(proowner) AS owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature])).rows[0];
  assert.equal(f.owner,'postgres');assert.equal(f.prosecdef,false);assert.equal(f.provolatile,'s');assert.ok(f.proconfig.includes('search_path=""'));
  const columns=['adapter_key','provider_kind','adapter_version','enabled','matching_allowed','storage_allowed','public_display_allowed',
    'image_cache_allowed','attribution_required','revalidation_seconds','raw_retention_seconds','policy_version','shared_source_note',
    'automatic_lookup_allowed','explicit_search_allowed','shared_catalogue_allowed','automatic_role','explicit_role','automatic_order',
    'explicit_order','accepted_adapter_versions','version_contracts','validation_contract','host_policy_version','approved_request_hosts',
    'approved_book_hosts','approved_cover_hosts','options_retention_seconds','display_label','protection_policy'];
  const providers=db.registry.map(r=>Object.fromEntries(columns.map(k=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),r[k]])));
  await setActor(db,'','service_role');
  assert.deepEqual(await value(db,'SELECT public.phase9_provider_configuration_v1()'),{version:'p9-provider-configuration-v1',providers});
});
// 02c §§3.1/4.1: simulate corrupt persisted configuration in a rolled-back fixture.
// Write guards are disabled only here so the READ boundary, not UPDATE, is tested.
const protection={version:'p9-protection-v1',minIntervalMs:1,storeWindowSeconds:1,storeMaxGets:1,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:1,breakerWindowSeconds:1,breakerCooldownMs:1,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
async function corruptConfiguration(change,expected) {
  await db.exec('BEGIN');
  try {
    const constraints=(await db.query(`SELECT conname FROM pg_constraint
      WHERE conrelid='public.phase9_provider_registry'::regclass AND contype IN('c','u')`)).rows;
    for(const {conname} of constraints)await db.exec('ALTER TABLE public.phase9_provider_registry DROP CONSTRAINT "'+conname.replaceAll('"','""')+'"');
    const indexes=(await db.query(`SELECT n.nspname,c.relname FROM pg_index i
      JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE i.indrelid='public.phase9_provider_registry'::regclass AND i.indisunique AND NOT i.indisprimary`)).rows;
    for(const {nspname,relname}of indexes)await db.exec('DROP INDEX "'+nspname.replaceAll('"','""')+'"."'+relname.replaceAll('"','""')+'"');
    await db.exec('ALTER TABLE public.phase9_provider_registry DISABLE TRIGGER USER');
    const fields=Object.keys(change);
    await db.query(`UPDATE public.phase9_provider_registry SET (${fields.join(',')})=
      (SELECT ${fields.join(',')} FROM jsonb_populate_record(NULL::public.phase9_provider_registry,$1::jsonb))
      WHERE adapter_key='open_library'`,[change]);
    const stored=await value(db,"SELECT to_jsonb(r) FROM public.phase9_provider_registry r WHERE adapter_key='open_library'");
    for(const field of fields)assert.deepEqual(stored[field],change[field],'corrupt fixture reached stored configuration');
    await setActor(db,'','service_role');
    let result,error;
    try{result=await value(db,'SELECT public.phase9_provider_configuration_v1()');}catch(e){error=e;}
    assert.equal(error?.code,'P0001');assert.equal(error.message,expected);
    assert.equal(result,undefined,'configuration read must not return a partial DTO');
  } finally {await db.exec('ROLLBACK');await resetActor(db);}
}
for(const [label,change]of [
  ['invalid bound',{options_retention_seconds:86401}],
  ['secret-bearing unknown key',{protection_policy:{...protection,apiKey:'fixture-secret-must-not-leak'}}],
  ['resolved contact instead of safe identifier',{protection_policy:{...protection,contactId:'private@example.test'}}],
])test(`AC8-11 [8a-1] configuration read rejects ${label} without a partial DTO`,async t=>{
  if(!await needs(t,db,'public.phase9_provider_configuration_v1()','8a-1'))return;
  await corruptConfiguration(change,'P9_PROVIDER_CONFIGURATION_INVALID');
});
test('AC8-11 [8a-1] configuration read rejects duplicate active route without a partial DTO',async t=>{
  if(!await needs(t,db,'public.phase9_provider_configuration_v1()','8a-1'))return;
  await corruptConfiguration({automatic_lookup_allowed:true,automatic_role:'primary',automatic_order:1},'P9_PROVIDER_ROUTE_INVALID');
});
test('AC8-11 [8a-1] configuration read returns an unresolved contact ID and excludes stored server secrets',async t=>{
  if(!await needs(t,db,'public.phase9_provider_configuration_v1()','8a-1'))return;
  await db.exec('BEGIN');
  try {
    await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='open_library'",[protection]);
    // Disposable native clones may lack PGlite's vault stub; roll it back too.
    await db.exec('CREATE SCHEMA IF NOT EXISTS vault; CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(name text,decrypted_secret text)');
    const secret='fixture-private-contact-and-api-secret';
    await db.query('INSERT INTO vault.decrypted_secrets(name,decrypted_secret) VALUES($1,$2)',[protection.contactId,secret]);
    await setActor(db,'','service_role');
    const configuration=await value(db,'SELECT public.phase9_provider_configuration_v1()');
    assert.deepEqual(configuration.providers.find(p=>p.adapterKey==='open_library').protectionPolicy,protection);
    assert.equal(JSON.stringify(configuration).includes(secret),false,'no resolved contact, credential or private licence data');
  }finally{await db.exec('ROLLBACK');await resetActor(db);}
});
for(const [signature,args,pkg,control] of services) for(const role of ['anon','authenticated'])
  test(`AC8-11 [${pkg}] ${control?'GREEN-control ':''}${role} cannot execute service ${signature}`,async t=>{
    if(!await needs(t,db,'public.'+signature,pkg))return;
    await denied(db,role,`SELECT public.${signature.split('(')[0]}(${args})`);
    assert.equal(await value(db,"SELECT has_function_privilege('service_role',$1,'EXECUTE')",['public.'+signature]),true);
    const fn=(await db.query(`SELECT pg_get_userbyid(proowner) AS owner,prosecdef,proconfig FROM pg_proc WHERE oid=$1::regprocedure`,['public.'+signature])).rows[0];
    assert.equal(fn.owner,'postgres'); assert.equal(fn.prosecdef,false); assert.ok(fn.proconfig.includes('search_path=""'));
  });

for(const [name,pkg] of [
  ['phase9_automatic_completion_effects','8a-4'],['phase9_external_admission_gate','8a-3'],
  ['phase9_automatic_provider_runs','8a-5'],['phase9_store_admission','8a-5'],['phase9_job_admission_wait','8a-5'],
]) test(`AC8-11 [${pkg}] private ${name} denies every API table privilege and enables RLS`,async t=>{
  const table='marketplace_sec.'+name;
  if(!requireObject(t,db,await value(db,'SELECT to_regclass($1) IS NOT NULL',[table]),pkg,table))return;
  const row=(await db.query('SELECT relrowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid=$1::regclass',[table])).rows[0];
  assert.equal(row.relrowsecurity,true); assert.equal(row.owner,'postgres');
  for(const role of ['anon','authenticated','service_role']) {
    for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
      assert.equal(await value(db,'SELECT has_table_privilege($1,$2,$3)',[role,table,privilege]),false,role+' '+privilege);
    await denied(db,role,'SELECT * FROM '+table);
    await denied(db,role,'INSERT INTO '+table+' DEFAULT VALUES');
    await denied(db,role,'DELETE FROM '+table);
  }
  assert.equal(await value(db,`SELECT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN LATERAL
    aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=$1::regclass AND a.grantee=0)`,[table]),false);
});

test('AC8-10 [8a-3] GREEN-control v1 physical-call identity replay creates one receipt',async()=>{
  const f=await olOperation(db), id=randomUUID(), args=[f.attemptId,f.jobId,worker,token,1,id,0,'search'];
  const first=await rpc(db,'phase9_register_edition_options_provider_call_v1',args);
  assert.deepEqual(await rpc(db,'phase9_register_edition_options_provider_call_v1',args),first);
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=$1',[f.attemptId]),1);
});
test('AC8-5/10 [8a-3] GREEN-control physical-call CHECK rejects claim 0 and claim 6',async()=>{
  const f=await olOperation(db);
  const call=await rpc(db,'phase9_register_edition_options_provider_call_v1',[f.attemptId,f.jobId,worker,token,1,randomUUID(),0,'search']);
  await resetActor(db);
  for(const invalid of [0,6]) {
    await db.exec('BEGIN'); let error;
    try{await db.query('UPDATE public.phase9_metadata_provider_calls SET claim_attempt_number=$1 WHERE id=$2',[invalid,call.provider_call_id]);}
    catch(caught){error=caught;}finally{await db.exec('ROLLBACK');}
    assert.equal(error?.code,'23514','five-claim table limit remains enforced');
    assert.match(error.constraint,/claim_attempt_number/);
  }
});
test('AC8-10 [8a-3] paused gate denies a new physical grant without creating a call',async t=>{
  if(!requireObject(t,db,await value(db,"SELECT to_regclass('marketplace_sec.phase9_external_admission_gate') IS NOT NULL"),
    '8a-3','admission gate and gate-locked legacy wrappers'))return;
  const f=await olOperation(db); await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_external_admission_gate'),1);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=epoch+1");
  const before=await completionFootprint(db);
  await setActor(db,f.ownerId,'service_role');
  let error;
  try{await rpc(db,'phase9_register_edition_options_provider_call_v1',[f.attemptId,f.jobId,worker,token,1,randomUUID(),0,'search']);}
  catch(caught){error=caught;}
  assert.equal(error?.code,'P0001');assert.equal(error.message,'P9_EXTERNAL_ADMISSION_PAUSED');
  await resetActor(db);
  assert.equal(await value(db,'SELECT count(*)::int FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=$1',[f.attemptId]),0);
  assert.equal(await completionFootprint(db),before,'paused refusal preserves all accounting and private effects');
});

for(const stage of ['never-installed','discover','author:AUTH-7','author:OL0A','author:OL1M','author:OL1A/unsafe'])
test(`AC8-11 [8a-3] GREEN-control OL non-ISBN physical grammar refuses foreign/unknown ${stage}`,async()=>{
  const f=await olOperation(db),base=[f.attemptId,f.jobId,worker,token,1];
  const positive=await rpc(db,'phase9_register_edition_options_provider_call_v1',[...base,randomUUID(),0,'search']);
  assert.ok(positive.provider_call_id,'valid legacy stage positive');
  const before=await completionFootprint(db);await setActor(db,f.ownerId,'service_role');
  await assert.rejects(()=>rpc(db,'phase9_register_edition_options_provider_call_v1',[...base,randomUUID(),2,stage]),
    e=>e.code==='P0001' && e.message==='P9_REQUEST_INVALID');
  assert.equal(await completionFootprint(db),before);
});

test('AC8-10 [8a-3] paused gate refuses fresh single-call grant and preserves accounting',async t=>{
  if(!requireObject(t,db,await value(db,"SELECT to_regclass('marketplace_sec.phase9_external_admission_gate') IS NOT NULL"),
    '8a-3','admission gate'))return;
  const {f}=await automaticGoogleCommand(db,{registerCall:false});await resetActor(db);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=epoch+1");
  const before=await completionFootprint(db);await setActor(db,f.ownerId,'service_role');
  await assert.rejects(()=>rpc(db,'phase9_register_metadata_provider_call',[f.attemptId,f.jobId,worker,token,1,randomUUID()]),
    e=>e.code==='P0001' && e.message==='P9_EXTERNAL_ADMISSION_PAUSED');
  assert.equal(await completionFootprint(db),before);
});
test('AC8-10 [8a-3] paused gate permits only exact original physical identity recovery',async t=>{
  if(!requireObject(t,db,await value(db,"SELECT to_regclass('marketplace_sec.phase9_external_admission_gate') IS NOT NULL"),
    '8a-3','admission gate'))return;
  const f=await olOperation(db),identity=randomUUID(),args=[f.attemptId,f.jobId,worker,token,1,identity,0,'search'];
  const first=await rpc(db,'phase9_register_edition_options_provider_call_v1',args);await resetActor(db);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=epoch+1");
  const before=await completionFootprint(db);await setActor(db,f.ownerId,'service_role');
  assert.deepEqual(await rpc(db,'phase9_register_edition_options_provider_call_v1',args),first);
  assert.equal(await completionFootprint(db),before);
});
