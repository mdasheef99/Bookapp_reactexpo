// 02c §7 / 02c-1 §2 steps 2–8: execute the actual operator SQL, disposable DB only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {before,after,beforeEach,test} from 'node:test';
import {database,clean,resetActor,value,job,row,run,sql,footprint,scriptNames,scriptsRoot,installed} from './finalAttemptSweep8cFixture.mjs';
import {automaticGoogleCommand} from './providerReplacementFixture.mjs';
let db;
const present=installed()&&scriptNames.every(n=>fs.existsSync(new URL(n+'.sql',scriptsRoot)));
const feature={skip:!present?'operator SQL/M96 not installed; no missing-file RED claimed':false};
before(async()=>{db=await database();});beforeEach(async()=>{await clean(db);});after(async()=>{await db?.close();});
const gate=()=>value(db,'SELECT to_jsonb(g) FROM marketplace_sec.phase9_external_admission_gate g');
const registry=()=>value(db,"SELECT jsonb_object_agg(adapter_key,to_jsonb(r)) FROM public.phase9_provider_registry r WHERE adapter_key IN ('google_books','open_library')");
async function rejectsUnchanged(name,pattern,fill=true,overrides={}) {
 const before=await footprint(db);await assert.rejects(run(db,name,fill,overrides),pattern);assert.deepEqual(await footprint(db),before);
}
async function paused(){await run(db,'01-pause');}
async function switched(){await paused();await run(db,'02-capture-drain-check');await run(db,'03-switch-while-paused');}
test('O1 happy rehearsal 01→02→03→05 switches atomically and opens a new epoch',feature,async()=>{
 const before=await registry();await switched();await run(db,'05-resume');const after=await registry(),g=await gate();
 assert.equal(g.mode,'open');assert.deepEqual(g.smoke_job_ids,[]);assert.equal(g.expires_at,null);assert.equal(Number(g.epoch),2);
 assert.equal(after.google_books.enabled,false);assert.equal(after.google_books.automatic_lookup_allowed,false);
 assert.equal(after.open_library.adapter_version,'2.0.0');assert.deepEqual(after.open_library.accepted_adapter_versions,['1.0.0','2.0.0']);
 assert.equal(after.open_library.automatic_role,'primary');assert.equal(after.open_library.protection_policy.minIntervalMs,1000);
 assert.equal(after.open_library.explicit_role,before.open_library.explicit_role);
 assert.equal(after.open_library.explicit_search_allowed,before.open_library.explicit_search_allowed);
});
test('O2 pause rejects missing singleton without mutation',feature,async()=>{
 const original=await gate();await db.exec('DELETE FROM marketplace_sec.phase9_external_admission_gate');
 try{await rejectsUnchanged('01-pause',/P9_8C_GATE_MISSING/);}
 finally{await db.query('INSERT INTO marketplace_sec.phase9_external_admission_gate SELECT * FROM jsonb_populate_record(NULL::marketplace_sec.phase9_external_admission_gate,$1::jsonb)',[original]);}
});
test('O3 drain requires committed pause',feature,async()=>{await rejectsUnchanged('02-capture-drain-check',/P9_8C_GATE_PRECONDITION/);});
test('O4 dirty metadata job reports its ID and rolls back a sweep closure',feature,async()=>{
 const close=await job(db),dirty=await job(db,{attempt:1});await paused();
 await rejectsUnchanged('02-capture-drain-check',new RegExp(dirty.id));assert.equal((await row(db,close.id)).status,'open');
});
test('O5 unknown call reports job/call IDs and leaves accounting untouched',feature,async()=>{
 const {f}=await automaticGoogleCommand(db);await resetActor(db);
 await db.query("UPDATE public.phase9_metadata_provider_calls SET status='outcome_unknown' WHERE id=$1",[f.callId]);await paused();
 const before=await footprint(db);
 await assert.rejects(run(db,'02-capture-drain-check'),e=>e.message.includes('P9_8C_DRAIN_BLOCKED')&&[f.jobId,f.callId].every(id=>(e.message+(e.detail??'')).includes(id)));
 assert.deepEqual(await footprint(db),before);
});
test('O6 any reserved reservation blocks regardless of age',feature,async()=>{
 const f=await job(db,{attempt:1});const id=await value(db,`INSERT INTO public.phase9_usage_reservations(store_id,job_id,cost_kind,policy_version,
 operation,idempotency_identity,reserved_cost_units,created_at) VALUES($1,$2::uuid,'metadata',1,'metadata_lookup',$2::uuid::text,0,'2000-01-01') RETURNING id`,[f.store,f.id]);
 await paused();const before=await footprint(db);
 await assert.rejects(run(db,'02-capture-drain-check'),e=>(e.message+(e.detail??'')).includes(id));assert.deepEqual(await footprint(db),before);
});
test('O7 staging_cleanup-only backlog does not block metadata drain',feature,async()=>{
 const f=await job(db,{kind:'staging_cleanup',attempt:0});const before=await row(db,f.id);await paused();await run(db,'02-capture-drain-check');assert.deepEqual(await row(db,f.id),before);
});
test('O8 switch rejects wrong gate and before-manifest atomically',feature,async()=>{
 await rejectsUnchanged('03-switch-while-paused',/P9_8C_GATE_PRECONDITION/);await paused();
 await db.exec("UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL WHERE adapter_key='google_books'");
 await rejectsUnchanged('03-switch-while-paused',/P9_8C_MANIFEST/);
});
test('O9 invalid policy cannot partially disable Google',feature,async()=>{await paused();await rejectsUnchanged('03-switch-while-paused',/P9_PROVIDER_CONFIGURATION_INVALID|P9_8C_POLICY/,true,{'__STORE_MAX_GETS__':'0'});});
test('O10 smoke mode enforces bounded cohort, future expiry and paused gate',feature,async()=>{
 await rejectsUnchanged('04-smoke-mode',/P9_8C_GATE_PRECONDITION/);await switched();
 await rejectsUnchanged('04-smoke-mode',/P9_8C_SMOKE/);
 const f=await job(db,{attempt:0});await run(db,'04-smoke-mode',true,{'__SMOKE_JOB_IDS__':JSON.stringify([f.id])});
 const g=await gate();assert.equal(g.mode,'smoke');assert.deepEqual(g.smoke_job_ids,[f.id]);
 await rejectsUnchanged('04-smoke-mode',/P9_8C_GATE_PRECONDITION/);
});
test('O11 resume rejects dirty jobs and unconfirmed smoke',feature,async()=>{
 await switched();await rejectsUnchanged('05-resume',/P9_8C_PLACEHOLDER_REQUIRED/,false);
 const f=await job(db,{attempt:0});await rejectsUnchanged('05-resume',new RegExp(f.id));
});
test('O12 rollback leaves Google disabled, OL explicit/version policy intact, and gate paused',feature,async()=>{
 await switched();await run(db,'05-resume');const before=await registry();await run(db,'06-rollback');const after=await registry();
 assert.equal((await gate()).mode,'paused');assert.equal(after.google_books.enabled,false);
 assert.equal(after.open_library.automatic_lookup_allowed,false);assert.equal(after.open_library.automatic_role,null);assert.equal(after.open_library.automatic_order,null);
 for(const key of Object.keys(before.open_library))if(!['automatic_lookup_allowed','automatic_role','automatic_order'].includes(key))assert.deepEqual(after.open_library[key],before.open_library[key],key);
});
test('O13 rollback refuses Google-enabled baseline without changing gate',feature,async()=>{await rejectsUnchanged('06-rollback',/P9_8C_MANIFEST/);});
for(const name of ['02-capture-drain-check','03-switch-while-paused','04-smoke-mode','05-resume'])test(`O14 unreplaced placeholders stop ${name}`,feature,async()=>{
 await paused();if(['04-smoke-mode','05-resume'].includes(name))await run(db,'03-switch-while-paused');
 await rejectsUnchanged(name,/P9_8C_PLACEHOLDER_REQUIRED/,false);
});
test('O15 operator files each have one transaction and no accounting release path',feature,async()=>{
 for(const name of scriptNames){const source=sql(name,false);assert.equal((source.match(/^BEGIN;/gm)??[]).length,1);assert.equal((source.match(/^COMMIT;/gm)??[]).length,1);assert.doesNotMatch(source,/UPDATE public\.phase9_usage_reservations|DELETE FROM/i);}
});

test('O16 old-epoch and legacy UNSENT calls block, while settled old grants remain reportable',feature,async()=>{
 const {f}=await automaticGoogleCommand(db);await resetActor(db);
 await db.query("UPDATE public.phase9_usage_reservations SET status='consumed' WHERE job_id=$1",[f.jobId]);
 await db.query("UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,completed_at=transaction_timestamp() WHERE id=$1",[f.jobId]);
 await db.query("UPDATE public.phase9_metadata_lookups SET completed_at=transaction_timestamp() WHERE job_id=$1",[f.jobId]);
 await db.query("UPDATE public.metadata_enrichment_attempts SET disposition='failed' WHERE id=$1",[f.attemptId]);
 await db.query('UPDATE public.phase9_metadata_provider_calls SET grant_epoch=0 WHERE id=$1',[f.callId]);
 await paused();await run(db,'02-capture-drain-check'); // D2/D8: completed, reconciled grants may exit.
 // D2 requires a terminal job AND cleared lease: the purpose failure fence is still missing here.
 await db.query("UPDATE public.image_extraction_jobs SET lease_owner='unreconciled-worker-0001' WHERE id=$1",[f.jobId]);
 for(const [epoch,status,egress] of [[0,'finalized',true],[0,'stale_rejected',false],[null,'stale_rejected',false]]) {
  await db.query('UPDATE public.phase9_metadata_provider_calls SET grant_epoch=$1,status=$2,edition_egress_started=$3 WHERE id=$4',[epoch,status,egress,f.callId]);
  const before=await footprint(db);
  await assert.rejects(run(db,'02-capture-drain-check'),e=>e.message.includes('P9_8C_DRAIN_BLOCKED')&&[f.jobId,f.callId].every(id=>(e.message+(e.detail??'')).includes(id)));
  assert.deepEqual(await footprint(db),before);
 }
 const names=['02-capture-drain-check','03-switch-while-paused','05-resume','06-rollback'];
 const blocks=names.map(name=>sql(name,false).match(/ -- 02c-1[^\n]*job-root report[\s\S]*?IF obligations<>[^\n]*END IF;/)?.[0]);
 assert.ok(blocks[0]);for(const block of blocks)assert.equal(block,blocks[0],'all four scripts must share the exact drain definition');
 assert.match(blocks[0],/grant_epoch<g\.epoch/);
});
test('O17 full before-manifest hash mismatch or unreplaced hash rolls back unchanged',feature,async()=>{
 await paused();
 await rejectsUnchanged('03-switch-while-paused',/P9_8C_MANIFEST_HASH/,true,{'__EXPECTED_BEFORE_MANIFEST_SHA256__':'0'.repeat(64)});
 await rejectsUnchanged('03-switch-while-paused',/P9_8C_PLACEHOLDER_REQUIRED/,true,{'__EXPECTED_BEFORE_MANIFEST_SHA256__':'__EXPECTED_BEFORE_MANIFEST_SHA256__'});
});
