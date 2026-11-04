// 02c §§7–9; Owner 2026-11-04: disposable M95/M96 proof, no accounting settlement.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createProviderDatabase, clean, resetActor, value} from './providerReplacementFixture.mjs';
import {selectedPrefix, nativeConnection} from './providerDatabaseHarness.mjs';
import {migrationPath} from './databaseHarness.mjs';
export {clean, resetActor, value, nativeConnection};
export const migration='20261104000096_marketplace_phase9_8c_final_attempt_sweep.sql';
export const baseline=process.env.PHASE9_8C1B_BASELINE==='1';
export const installed=()=>!baseline && fs.existsSync(migrationPath(migration));
export const scriptsRoot=new URL('../../../docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/8c/',import.meta.url);
export async function database() {
 const prefix=selectedPrefix('8a-5');
 const db=await createProviderDatabase({migrations:[...prefix.migrations,
  '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql',
  '20261104000095_marketplace_phase9_8c_null_safe_and_pending_state.sql'],installed:prefix.installed});
 db.triggerBefore=await value(db,"SELECT pg_get_functiondef('marketplace_sec.phase9_release_closed_admission_v1()'::regprocedure)");
 db.dispatchBefore=await value(db,"SELECT jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text,'volatility',provolatile,'security',prosecdef,'config',proconfig) FROM pg_proc WHERE oid='marketplace_sec.dispatch_phase9_worker_wakes()'::regprocedure");
 if(installed())await db.exec(fs.readFileSync(migrationPath(migration),'utf8'));
 return db;
}
export async function job(db,{kind='metadata_enrich',status='open',attempt=5,version=null,lease=null}={}) {
 await resetActor(db);
 const store=randomUUID(),id=randomUUID();
 await db.query('INSERT INTO public.stores(id,display_name) VALUES($1,$2)',[store,'8c fixture']);
 await db.query(`INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,
  dedupe_key,status,attempt_count,max_attempts,operation_version,lease_expires_at,lease_owner,lease_token_hash)
  VALUES($1,$2,'candidate',$3,$4,$5,$6,$7,5,$8,$9,$10,$11)`,
 [id,store,randomUUID(),kind,'8c:'+id,status,attempt,version,lease,
  status==='in_progress'?'8c-fixture-worker-0001':null,status==='in_progress'?'a'.repeat(64):null]);
 return {id,store};
}
export async function row(db,id) {
 await resetActor(db);return value(db,'SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id=$1',[id]);
}
export async function sweep(db,limit=50) {
 await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role','service_role',false); SET ROLE service_role");
 return value(db,'SELECT public.phase9_sweep_exhausted_metadata_jobs_v1($1)',[limit]);
}
export const scriptNames=['01-pause','02-capture-drain-check','03-switch-while-paused','04-smoke-mode','05-resume','06-rollback'];
// Test operating values only; never copied into operator scripts.
export const replacements={
 '__CONFIRM_SINGLE_WORKER_QUIESCENT__':'CONFIRMED_SINGLE_WORKER_QUIESCENT',
 '__CONFIRM_SMOKE_PASSED_AND_DRAINED__':'CONFIRMED_SMOKE_PASSED_AND_DRAINED',
 '__STORE_WINDOW_SECONDS__':'60','__STORE_MAX_GETS__':'20','__BACKOFF_BASE_MS__':'1',
 '__BACKOFF_MAX_MS__':'2','__BREAKER_FAILURES__':'3','__BREAKER_WINDOW_SECONDS__':'60',
 '__BREAKER_COOLDOWN_MS__':'1','__CONTACT_ID__':'fixture-contact',
 '__SMOKE_JOB_IDS__':'[]','__SMOKE_EXPIRES_AT__':'2099-01-01T00:00:00Z'
};
export function sql(name,fill=true,overrides={}) {
 let source=fs.readFileSync(new URL(name+'.sql',scriptsRoot),'utf8');
 if(fill)for(const [key,value]of Object.entries({...replacements,...overrides}))source=source.replaceAll(key,value);
 if(process.env.PHASE9_8C1B_SCRIPT_MUTANT==='1')source=source.replaceAll("IF obligations<>'[]'::jsonb THEN RAISE EXCEPTION 'P9_8C_DRAIN_BLOCKED: %',obligations; END IF;",'-- test-only mutant: omit dirty guard');
 return source;
}
export async function run(db,name,fill=true,overrides={}) {
 await resetActor(db);
 if(fill && name==='03-switch-while-paused') {
  const hash=await value(db,"SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(r) ORDER BY adapter_key),'[]')::text,'sha256'),'hex') FROM public.phase9_provider_registry r WHERE adapter_key IN('google_books','open_library')");
  overrides={'__EXPECTED_BEFORE_MANIFEST_SHA256__':hash,...overrides};
 }
 try{return await db.exec(sql(name,fill,overrides));}catch(error){await db.exec('ROLLBACK');throw error;}
}
export async function footprint(db) {
 await resetActor(db);
 const tables=['marketplace_sec.phase9_external_admission_gate','public.phase9_provider_registry',
 'public.image_extraction_jobs','public.phase9_usage_reservations','public.phase9_metadata_provider_calls',
 'marketplace_sec.phase9_automatic_provider_runs','marketplace_sec.phase9_metadata_admissions'];
 // One native Client backs db. Await each read so errors cannot leave sibling
 // queries queued/running when the next beforeEach starts its TRUNCATE.
 const entries=[];
 for(const table of tables)entries.push([table,await value(db,
  `SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM ${table} x`)]);
 return Object.fromEntries(entries);
}
