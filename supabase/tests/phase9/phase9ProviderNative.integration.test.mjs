// 02c §§4.1/4.4/8/9 AC8-10; 02d §3.2 ACP-11. Real independent PostgreSQL connections only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { clean, createProviderDatabase, nativeConnection, needs, requireObject, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { catalogueBatch, completeCatalogueV2 } from './leanCatalogueFixture.mjs';
import { readSql, selectSql } from './catalogueLinkFixture.mjs';
import { token, worker } from './editionOptionsCompletionFixture.mjs';
import {olOperation} from './catalogueLinkFixture.mjs';
import {completionFootprint} from './leanCatalogueCompletionFixture.mjs';
const native=!!process.env.PHASE9_PROVIDER_NATIVE_PORT;
const options={skip:native?false:'NEEDS native PostgreSQL: run -OnlyGroup provider-replacement'};
let db;
before(async()=>{if(native)db=await createProviderDatabase();});
beforeEach(async()=>{if(db)await clean(db);});
after(async()=>{await db?.close();});

test('AC8-10 [8a-1] native source-policy SHARE lock blocks an independent registry writer',options,async()=>{
  const reader=await nativeConnection(db.database),writer=await nativeConnection(db.database); let pending;
  try {
    const pid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await reader.query('BEGIN');
    await reader.query("SELECT marketplace_sec.phase9_catalogue_source_policy_v1('open_library')");
    pending=writer.query("UPDATE public.phase9_provider_registry SET policy_version=policy_version+1 WHERE adapter_key='open_library'");
    // Observe a real database wait edge; never infer concurrency from a timeout alone.
    const deadline=Date.now()+3000; let blockers=[];
    while(Date.now()<deadline) {
      blockers=await value(db,'SELECT pg_blocking_pids($1)',[pid]);
      if(blockers.length)break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.ok(blockers.length,'registry writer must be observed waiting on policy reader');
    await reader.query('COMMIT'); await pending;
    assert.equal(await value(db,"SELECT policy_version FROM public.phase9_provider_registry WHERE adapter_key='open_library'"),2);
  } finally {
    await reader.query('ROLLBACK'); if(pending)await pending.catch(()=>{});
    await Promise.all([reader.end(),writer.end()]);
  }
});

for(const first of ['Select','registration'])test(`AC8-10 [8a-1..4] native legacy registration-C FK versus Select-L FK: ${first} first`,options,async t=>{
  const f=await catalogueBatch(db); await completeCatalogueV2(db,f); await resetActor(db);
  const job=(await db.query('SELECT status,lease_owner,lease_token_hash FROM public.image_extraction_jobs WHERE id=$1',[f.jobId])).rows[0];
  assert.equal(job.status,'resolved'); assert.equal(job.lease_owner,null); assert.equal(job.lease_token_hash,null);
  await setActor(db,f.ownerId);
  const choices=await value(db,readSql(f)),owner=await nativeConnection(db.database),legacy=await nativeConnection(db.database);
  await resetActor(db);
  const a=(await db.query('SELECT * FROM public.metadata_enrichment_attempts WHERE id=$1',[f.attemptId])).rows[0];
  const args=[f.lookupId,f.jobId,worker,token,1,randomUUID(),a.provider_cache_identity,'primary',1,
    a.adapter_key,a.adapter_version,a.capability_version,a.schema_version,a.normalizer_version,
    a.routing_policy_version,a.predecessor_outcome,a.usage_reservation_id];
  const signature='SELECT public.phase9_register_metadata_attempt('+args.map((_,i)=>'$'+(i+1)).join(',')+')';
  let holding=false;
  try {
    await owner.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[f.ownerId]);
    await owner.query("SELECT set_config('request.jwt.claim.role','authenticated',false)");
    await legacy.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
    await owner.query('SET ROLE authenticated'); await legacy.query('SET ROLE service_role');
    const rejectRegistration=async()=>{
      await assert.rejects(()=>legacy.query(signature,args),error=>error.code==='P0001' &&
        /P9_(STATE_CONFLICT|STALE_CLAIM|LEASE_LOST|CLAIM_INVALID)/.test(error.message));
    };
    if(first==='registration')await rejectRegistration();
    await owner.query('BEGIN'); holding=true;
    const selected=(await owner.query(selectSql(f,choices,f.rows[0].optionId))).rows[0];
    assert.ok(selected,'real Owner Select must succeed and hold its locks');
    if(first==='Select')await rejectRegistration();
    await owner.query('COMMIT'); holding=false;
    assert.equal(await value(db,'SELECT count(*)::int FROM public.metadata_enrichment_attempts WHERE lookup_id=$1',[f.lookupId]),1);
    t.diagnostic(`terminal-job reachability proof: candidate=${f.candidateId} lookup=${f.lookupId} job=${f.jobId}; registration rejected before FK wait`);
  } finally {
    if(holding)await owner.query('ROLLBACK'); await Promise.all([owner.end(),legacy.end()]);
  }
});

async function backendPid(connection) {
  const pid=(await connection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  return pid;
}
async function observeBlock(db,pid) {
  const deadline=Date.now()+3000;
  while(Date.now()<deadline) {
    const blockers=await value(db,'SELECT pg_blocking_pids($1)',[pid]);
    if(blockers.length)return blockers;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail('independent transaction must have a real observed lock blocker');
}
test('AC8-10 [8a-3] native pause waits for issued grant, preserves old epoch and refuses fresh grant',options,async t=>{
  if(!requireObject(t,db,await value(db,"SELECT to_regclass('marketplace_sec.phase9_external_admission_gate') IS NOT NULL"),
    '8a-3','admission gate'))return;
  const f=await olOperation(db);await resetActor(db);
  const grant=await nativeConnection(db.database),pause=await nativeConnection(db.database);let pending;
  try {
    await grant.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[f.ownerId]);
    await grant.query("SELECT set_config('request.jwt.claim.role','service_role',false)");await grant.query('SET ROLE service_role');
    const pid=await backendPid(pause),epoch=await value(db,'SELECT epoch FROM marketplace_sec.phase9_external_admission_gate');
    await grant.query('BEGIN');const id=randomUUID();
    const args=[f.attemptId,f.jobId,worker,token,1,id,0,'search'];
    const sql='SELECT public.phase9_register_edition_options_provider_call_v1($1,$2,$3,$4,$5,$6,$7,$8) AS receipt';
    const first=(await grant.query(sql,args)).rows[0].receipt;
    pending=pause.query("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='paused',epoch=epoch+1");
    await resetActor(db);await observeBlock(db,pid);await grant.query('COMMIT');await pending;
    assert.equal(await value(db,'SELECT grant_epoch FROM public.phase9_metadata_provider_calls WHERE id=$1',[first.provider_call_id]),epoch);
    const before=await completionFootprint(db);
    assert.deepEqual((await grant.query(sql,args)).rows[0].receipt,first);
    await assert.rejects(()=>grant.query(sql,[...args.slice(0,5),randomUUID(),1,'editions']),
      e=>e.code==='P0001' && e.message==='P9_EXTERNAL_ADMISSION_PAUSED');
    assert.equal(await completionFootprint(db),before);
  }finally{await grant.query('ROLLBACK');if(pending)await pending.catch(()=>{});await Promise.all([grant.end(),pause.end()]);}
});
test('AC8-10 [8a-1] native paired registry transaction exposes only complete before/after manifests',options,async t=>{
  if(!await needs(t,db,'public.phase9_provider_configuration_v1()','8a-1'))return;
  const reader=await nativeConnection(db.database),writer=await nativeConnection(db.database);
  try {
    await reader.query("SELECT set_config('request.jwt.claim.role','service_role',false)");await reader.query('SET ROLE service_role');
    const read=async()=>(await reader.query('SELECT public.phase9_provider_configuration_v1() AS body')).rows[0].body;
    const before=await read();await writer.query('BEGIN');
    await writer.query("UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL WHERE adapter_key='google_books'");
    assert.deepEqual(await read(),before,'uncommitted half transition is invisible');
    await writer.query("UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=true,automatic_role='primary',automatic_order=1 WHERE adapter_key='open_library'");
    assert.deepEqual(await read(),before);await writer.query('COMMIT');
    const expected=structuredClone(before);
    Object.assign(expected.providers.find(p=>p.adapterKey==='google_books'),{automaticLookupAllowed:false,automaticRole:null,automaticOrder:null});
    Object.assign(expected.providers.find(p=>p.adapterKey==='open_library'),{automaticLookupAllowed:true,automaticRole:'primary',automaticOrder:1});
    assert.deepEqual(await read(),expected);
  }finally{await writer.query('ROLLBACK');await Promise.all([reader.end(),writer.end()]);}
});

test('AC8-10 native empty cleanup avoids a proven cascading-TRUNCATE lock wait',options,async t=>{
  const blocker=await nativeConnection(db.database),oldCleaner=await nativeConnection(db.database);
  let pending;
  try {
    await blocker.query('BEGIN');await blocker.query('SELECT * FROM public.phase9_selected_metadata_snapshots');
    await clean(db); // completes while the same read lock that stalls the old cascade is held
    const pid=(await oldCleaner.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending=oldCleaner.query('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE');
    const deadline=Date.now()+3000;let wait;
    while(Date.now()<deadline) {
      wait=(await blocker.query('SELECT wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
      if(wait.blockers.length)break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.equal(wait.wait_event_type,'Lock');assert.ok(wait.blockers.length);
    t.diagnostic(`old empty cascade waits on ${wait.wait_event_type}/${wait.wait_event}; blockers=${wait.blockers}; revised cleanup completes without cascade`);
    await blocker.query('COMMIT');await pending;
  } finally {await blocker.query('ROLLBACK');if(pending)await pending.catch(()=>{});await Promise.all([blocker.end(),oldCleaner.end()]);}
});
