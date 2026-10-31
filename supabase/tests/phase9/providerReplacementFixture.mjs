// 02c §§3.1,4.1–4.4,8–11. Disposable test databases only; no provider HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLeanDatabase } from './leanCatalogueFixture.mjs';
import { migrationPath, resetActor, setActor } from './databaseHarness.mjs';
import { nativeAdapter, nativeClone, selectedPrefix, requireObject } from './providerDatabaseHarness.mjs';
export { packages, nativeConnection, requireObject } from './providerDatabaseHarness.mjs';
export { resetActor, setActor };
export { facts, rpc } from './catalogueLinkFixture.mjs';
export { sourcePolicy, installSyntheticProvider, resetSyntheticProvider } from './leanCatalogueFixture.mjs';

export const synthetic = JSON.parse(fs.readFileSync(new URL('./fixtures/provider-replacement-synthetic.json', import.meta.url)));
export const legacyPolicyKeys = ['adapterKey','adapterVersion','enabled','matchingAllowed','storageAllowed','reuseAllowed','policyVersion'].sort();
export const capabilityColumns = ['automatic_lookup_allowed','explicit_search_allowed','shared_catalogue_allowed',
  'automatic_role','explicit_role','automatic_order','explicit_order','accepted_adapter_versions','version_contracts',
  'validation_contract','host_policy_version','approved_request_hosts','approved_book_hosts','approved_cover_hosts',
  'options_retention_seconds','display_label','protection_policy'];

export async function createProviderDatabase({ selection, migrations, installed, beforeMigrations } = {}) {
  const prefix = migrations === undefined ? selectedPrefix(selection) : { migrations, installed: installed ?? [] };
  let db;
  if (process.env.PHASE9_PROVIDER_NATIVE_PORT) {
    const clone = await nativeClone();
    db = Object.assign(nativeAdapter(clone.client), { close:clone.close, database:clone.database });
  } else db = await createLeanDatabase({ m88:true });
  db.installedPackages = [];
  try {
    // The recorded preflight, unlike the disabled historical seed, has both enabled.
    await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,
      matching_allowed,storage_allowed,revalidation_seconds,policy_version)
      VALUES('google_books','metadata','1.0.0',true,true,true,86400,1) ON CONFLICT(adapter_key) DO NOTHING;
      UPDATE public.phase9_provider_registry SET enabled=true,matching_allowed=true,storage_allowed=true,
        adapter_version='1.0.0',policy_version=1,revalidation_seconds=86400,image_cache_allowed=false,
        public_display_allowed=(adapter_key='open_library'),attribution_required=(adapter_key='open_library'),
        raw_retention_seconds=CASE WHEN adapter_key='google_books' THEN 604800 ELSE 0 END
        WHERE adapter_key IN('google_books','open_library');`);
    if(beforeMigrations)db.legacyFixture=await beforeMigrations(db);
    const oldPolicy=`SELECT adapter_key,provider_kind,adapter_version,enabled,matching_allowed,storage_allowed,
      public_display_allowed,image_cache_allowed,attribution_required,revalidation_seconds,raw_retention_seconds,
      policy_version,shared_source_note FROM public.phase9_provider_registry ORDER BY adapter_key`;
    db.preMigrationRegistry=(await db.query(oldPolicy)).rows;
    for (const name of prefix.migrations) {
      assert.match(name, /^\d{14}_marketplace_phase9_[a-z0-9_]+\.sql$/);
      await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
      assert.deepEqual((await db.query(oldPolicy)).rows,db.preMigrationRegistry,
        '02c §4.1: each partial 8a migration changes only NEW registry fields');
    }
    db.installedPackages=prefix.installed;
    const gate = await value(db,"SELECT to_regclass('marketplace_sec.phase9_external_admission_gate') IS NOT NULL");
    if (gate) db.gate = (await db.query('SELECT to_jsonb(g) AS body FROM marketplace_sec.phase9_external_admission_gate g')).rows;
    db.registry = (await db.query('SELECT * FROM public.phase9_provider_registry ORDER BY adapter_key')).rows;
    return db;
  } catch (error) { await db.close(); throw error; }
}
export const createNativePrefixDatabase = migrations => createProviderDatabase({migrations});

export async function clean(db) {
  await resetActor(db);
  // Read-only suites do not need repeated ACCESS EXCLUSIVE cascades across the entire FK graph.
  const dirty = await value(db,`SELECT EXISTS(SELECT 1 FROM public.stores) OR EXISTS(SELECT 1 FROM public.canonical_works)
    OR EXISTS(SELECT 1 FROM public.canonical_editions) OR EXISTS(SELECT 1 FROM public.phase9_metadata_cache_entries)`);
  if (dirty) await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE');
  if (db.gate) for(const {body} of db.gate) {
    const fields=Object.keys(body);for(const field of fields)assert.match(field,/^[a-z_]+$/);
    await db.query(`UPDATE marketplace_sec.phase9_external_admission_gate SET (${fields.join(',')})=
      (SELECT ${fields.join(',')} FROM jsonb_populate_record(NULL::marketplace_sec.phase9_external_admission_gate,$1::jsonb))`,[body]);
  }
  // Clear routes before restoring rows: never transiently violate route uniqueness.
  if(db.installedPackages.includes('8a-1')) await db.exec(`UPDATE public.phase9_provider_registry
    SET automatic_lookup_allowed=false,explicit_search_allowed=false,automatic_role=NULL,explicit_role=NULL,
    automatic_order=NULL,explicit_order=NULL`);
  const columns = Object.keys(db.registry[0]);
  for (const name of columns) assert.match(name, /^[a-z_]+$/);
  for (const row of db.registry) await db.query(`UPDATE public.phase9_provider_registry SET (${columns.join(',')})=
    (SELECT ${columns.join(',')} FROM jsonb_populate_record(NULL::public.phase9_provider_registry,$1::jsonb))
    WHERE adapter_key=$2`, [JSON.stringify(row), row.adapter_key]);
  await db.exec("DELETE FROM public.phase9_provider_registry WHERE adapter_key='synthetic_catalogue'");
}
export async function value(db, sql, params = []) {
  return Object.values((await db.query(sql, params)).rows[0])[0];
}
export async function needs(t, db, signature, pkg) {
  await resetActor(db);
  const exists = await value(db, 'SELECT to_regprocedure($1) IS NOT NULL', [signature]);
  return requireObject(t,db,exists,pkg,signature);
}
export async function needsCapabilities(t, db) {
  const present = (await db.query(`SELECT column_name FROM information_schema.columns WHERE
    table_schema='public' AND table_name='phase9_provider_registry'`)).rows.map(r => r.column_name);
  const absent = capabilityColumns.filter(c => !present.includes(c));
  return requireObject(t,db,absent.length===0,'8a-1','registry columns: '+absent.join(','));
}
export async function permissive(db, key) {
  await resetActor(db);
  const available = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public'
    AND table_name='phase9_provider_registry' AND data_type='boolean'`)).rows.map(r => r.column_name);
  const capabilities=available.includes('automatic_lookup_allowed');
  if(capabilities) await db.query(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,explicit_search_allowed=false,
    automatic_role=NULL,automatic_order=NULL,explicit_role=NULL,explicit_order=NULL WHERE adapter_key<>$1`,[key]);
  const flags=available.map(c=>{assert.match(c,/^[a-z_]+$/);return c+'=true';});
  await db.query(`UPDATE public.phase9_provider_registry SET ${flags.join(',')},shared_source_note='Test-only full permission',
    revalidation_seconds=86400,raw_retention_seconds=86400
    ${capabilities ? ",automatic_role='primary',automatic_order=1,explicit_role='primary',explicit_order=1,options_retention_seconds=86400" : ''}
    WHERE adapter_key=$1`,[key]);
  const row=await value(db,'SELECT to_jsonb(r) FROM public.phase9_provider_registry r WHERE adapter_key=$1',[key]);
  for(const flag of available)assert.equal(row[flag],true,flag);
  if(capabilities)assert.deepEqual([row.automatic_role,row.automatic_order,row.explicit_role,row.explicit_order],['primary',1,'primary',1]);
}
export async function footprint(db) {
  await resetActor(db);
  const names = ['public.canonical_works','public.canonical_editions','public.canonical_provider_ids','public.book_metadata_sources',
    'public.canonical_work_stats','public.canonical_edition_stats','public.phase9_metadata_cache_entries',
    'marketplace_sec.phase9_catalogue_lookup_effects','marketplace_sec.phase9_catalogue_choice_effects'];
  return Object.fromEntries(await Promise.all(names.map(async name => [name,await value(db,
    `SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') FROM ${name} r`)])));
}
export async function denied(db, role, statement, params = []) {
  await setActor(db, '', role);
  let error;
  await db.exec('BEGIN');
  try { await db.query(statement, params); } catch (caught) { error = caught; }
  finally { await db.exec('ROLLBACK'); await resetActor(db); }
  assert.equal(error?.code, '42501', `${role} must receive permission denial for ${statement}`);
}

// 02c §4.3 no-retention Google transition: real legacy registration/physical receipt,
// leaving snapshot/attempt/job completion to the NEW transaction under test.
export const automaticGoogleCommand=(db,options={})=>automaticProviderCommand(db,{...options,adapterKey:'google_books'});
export async function automaticProviderCommand(db, {adapterKey='google_books',privacyScope='store_private',registerCall=true}={}) {
  assert.ok(['google_books','open_library'].includes(adapterKey),'only installed legacy providers in this fixture');
  const { seedCard,seedAutomaticLineage,claimJob }=await import('./editionPickerFixture.mjs');
  const { resultRows,rpc,token,worker }=await import('./editionOptionsCompletionFixture.mjs');
  const f=await seedCard(db), {jobId}=await seedAutomaticLineage(db,f);
  const context=await value(db,await claimJob(db,f,jobId));
  Object.assign(f,{jobId,context,attempt:1});
  const base=[jobId,worker,token,1],capability=adapterKey==='google_books'?'google-books-capability-v1':'open-library-capability-v1',key='automatic:'+jobId;
  const {randomUUID}=await import('node:crypto');
  const lookup=await rpc(db,'phase9_register_structural_metadata_lookup',[...base,f.candidateId,context.candidateVersion,
    context.queryIdentity,key,adapterKey,'1.0.0',capability,'p9-metadata-foundation-v1','bibliographic',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',privacyScope,'1',
    'p9-metadata-cache-v1','metadata-v1',null]);
  const usage=await rpc(db,'phase9_reserve_metadata_usage',[...base,lookup.lookup_id,adapterKey,'1.0.0',1]);
  const attempt=await rpc(db,'phase9_register_structural_metadata_attempt',[lookup.lookup_id,...base,f.candidateId,
    context.candidateVersion,randomUUID(),key,'primary',1,adapterKey,'1.0.0',capability,'p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','local_insufficient',usage.reservation_id]);
  const call=registerCall?await rpc(db,'phase9_register_metadata_provider_call',[attempt.attempt_id,...base,randomUUID()]):null;
  Object.assign(f,{lookupId:lookup.lookup_id,attemptId:attempt.attempt_id,callId:call?.provider_call_id,reservationId:usage.reservation_id});
  const m=resultRows(f).rows[0].metadata;
  if(adapterKey==='open_library')Object.assign(m,{adapterKey,providerRecordId:'OL100M',coverReference:'https://covers.openlibrary.org/b/id/123-M.jpg'});
  // 02c section 4.3 / F4: the positive fixture's receipt carries exactly the
  // selected bytes/evidence submitted to automatic completion.
  if(registerCall)await rpc(db,'phase9_finalize_metadata_provider_call',[f.callId,jobId,worker,token,1,
    'finalized','coherent_match','coherent_match','fixture-request-1',false,m,['validated_isbn']]);
  return { f,command:{fence:{jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,
    storeId:f.storeId,sessionId:f.sessionId,candidateVersion:context.candidateVersion,
    queryIdentity:context.queryIdentity,capturedRequestId:null,requestGeneration:0},
    lookupId:f.lookupId,attemptId:f.attemptId,selectedOptionId:null,source:'external',
    result:{version:'p9-metadata-result-v2',purpose:'automatic',outcome:{outcome:'coherent_match',
      candidates:[m],selected:m,evidence:['validated_isbn'],retryable:false,secondaryEligible:false,
      providerRequestId:'fixture-request-1',representativeCover:null},rows:null,catalogueCompanions:null,retention:null}}};
}

// AC8-12: a private bookkeeping receipt is allowed; shared attribution is not.
export function noSharedChange(before,after,operation) {
  assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort(),operation+': footprint tables');
  for(const [name,prior] of Object.entries(before)) {
    const rows=after[name];
    if(!name.includes('effects')){assert.deepEqual(rows,prior,operation+': '+name);continue;}
    const key=name.endsWith('phase9_catalogue_choice_effects')?'selection_id':'lookup_id';
    for(const original of prior)assert.deepEqual(rows.find(r=>r[key]===original[key]),original,
      operation+': existing private receipt');
    for(const row of rows) {
      if(prior.some(r=>r[key]===row[key]))continue;
      assert.equal(row.canonical_edition_id??null,null,operation+': no shared edition');
      assert.equal(row.searched_work_id??null,null,operation+': no searched work');
      assert.equal(row.cache_entry_id??null,null,operation+': no shared cache');
      assert.equal(row.search_counted??false,false,operation+': no searched count');
      assert.equal(row.counted??false,false,operation+': no chosen count');
      for(const result of row.canonical_results??[])assert.ok(!result.canonicalWorkId && !result.canonicalEditionId && !result.canonical_work_id && !result.canonical_edition_id,operation+': no canonical result');
    }
  }
}

// 02c §11.1: hash the complete pg_get_functiondef, including whitespace and all overloads.
// Do not reuse the earlier MD5(prosrc) helper: it omits signatures and function attributes.
export async function genericHashes(db) {
  await resetActor(db);
  const names = [
    'phase9_complete_candidate_edition_options_v1','phase9_complete_candidate_edition_options_v2',
    'phase9_recover_candidate_edition_options_v1','phase9_complete_automatic_metadata_v1','phase9_recover_automatic_metadata_v1',
    'phase9_register_structural_metadata_lookup','phase9_register_structural_metadata_attempt','phase9_reserve_metadata_usage',
    'phase9_register_metadata_lookup','phase9_register_metadata_attempt','phase9_metadata_job_context_v2',
    'phase9_finalize_metadata_attempt','phase9_finalize_structural_metadata_attempt','phase9_select_metadata_snapshot',
    'phase9_select_structural_metadata_snapshot','phase9_complete_metadata_cache_reuse',
    'phase9_register_metadata_provider_call','phase9_finalize_metadata_provider_call',
    'phase9_register_edition_options_provider_call_v1','phase9_finalize_edition_options_provider_call_v1',
    'phase9_finish_edition_primary_for_fallback_v1','phase9_edition_source_policy','phase9_edition_worker_context',
    'phase9_metadata_job_context','phase9_catalogue_shared_admitted_v1','phase9_catalogue_source_policy_v1',
    'phase9_catalogue_source_policy_v2','phase9_catalogue_resolve_v1','phase9_catalogue_choice_target_v1',
    'phase9_catalogue_companion_for_choice_v1','phase9_edition_legacy_select_candidate','phase9_catalogue_link_for_add_v1',
    'phase9_add_candidate_to_inventory_v1','phase9_select_candidate_edition_v1','phase9_catalogue_valid_cache_v1',
    'phase9_catalogue_store_cache_v1','phase9_catalogue_reuse_cache_core_v1','phase9_reuse_candidate_edition_cache_v1',
    'phase9_store_metadata_cache','phase9_metadata_cache_reuse_context','phase9_complete_metadata_cache_reuse',
    'phase9_catalogue_count_search_v1','phase9_catalogue_count_choice_v1','phase9_catalogue_increment_v1',
    'phase9_provider_permanent_reuse_allowed_v1','phase9_provider_configuration_v1','phase9_catalogue_isbn_v1','phase9_catalogue_identity_lock_key_v1',
  ];
  const sql = (await db.query(`SELECT format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) AS signature,
    encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS sha256,
    pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,p.provolatile,p.prosecdef,p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN('public','marketplace_sec') AND p.proname=ANY($1::text[]) ORDER BY 1`, [names])).rows;
  const checks = (await db.query(`SELECT c.conname AS signature,
    encode(sha256(convert_to(pg_get_constraintdef(c.oid,true),'UTF8')),'hex') AS sha256
    FROM pg_constraint c WHERE c.conrelid='public.phase9_metadata_provider_calls'::regclass
    AND c.contype='c' ORDER BY 1`)).rows;
  const inventory=JSON.parse(fs.readFileSync(new URL('./fixtures/provider-replacement-generic-inventory.json',import.meta.url)));
  const required=inventory.sql.filter(r=>r.pkg==='m88' || db.installedPackages.includes(r.pkg)).map(r=>r.signature).sort();
  const actual=sql.map(r=>r.signature).sort();
  for(const signature of required)assert.ok(actual.includes(signature),'complete frozen overload inventory missing: '+signature);
  // Unexpected overloads need an explicit inventory review rather than silently joining the golden.
  assert.deepEqual(actual,required,'review every generic overload before freezing');
  assert.deepEqual(checks.map(r=>r.signature).sort(),inventory.checks.toSorted());
  const metadata=sql.map(({signature,owner,acl,provolatile,prosecdef,proconfig})=>({signature,owner,acl,provolatile,prosecdef,proconfig}));
  return { sql:sql.map(({signature,sha256})=>({signature,sha256})), metadata, checks };
}
