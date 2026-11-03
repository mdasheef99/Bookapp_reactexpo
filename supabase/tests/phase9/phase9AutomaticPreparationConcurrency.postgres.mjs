// 02c §§4.3/5.1/9: real independent connections, disposable M88-template clone only.
// Invoke like phase9CatalogueLinkConcurrency.postgres.mjs: node <file> <port> <database> <psql>.
// The template is bookconnect_u8b_<digits>; install M89..M94 explicitly in its clone.
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {nativeConnection,selectedPrefix} from './providerDatabaseHarness.mjs';
import {receivingCard} from './providerAutomaticReviewFixture.mjs';
import {claimJob,seedAutomaticLineage,seedCard} from './editionPickerFixture.mjs';
import {rpc,token,worker} from './editionOptionsCompletionFixture.mjs';
const [port,template]=process.argv.slice(2);
assert.match(port??'',/^\d{4,5}$/);
assert.match(template??'',/^bookconnect_u8b_\d+$/);
process.env.PHASE9_PROVIDER_NATIVE_PORT=port;
process.env.PHASE9_PROVIDER_NATIVE_DATABASE=template;
const migration='20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql';
const policy={version:'p9-protection-v1',minIntervalMs:1000,storeWindowSeconds:60,storeMaxGets:20,
  backoffBaseMs:1,backoffMaxMs:2,breakerFailures:3,breakerWindowSeconds:60,breakerCooldownMs:1,
  halfOpenMax:1,mode:'single_instance',contactId:'test-contact'};
let db;
before(async()=>{
  const prefix=selectedPrefix('8a-5');
  db=await createProviderDatabase({migrations:[...prefix.migrations,migration],installed:prefix.installed});
});
beforeEach(async()=>{
  await clean(db);await resetActor(db);
  await db.query("UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key='google_books'",[policy]);
});
after(async()=>{await db?.close();});
async function fresh(card=null) {
  const f=card??await seedCard(db),{jobId}=await seedAutomaticLineage(db,f,'accepted',card?'b'.repeat(64):'a'.repeat(64));
  const context=await value(db,await claimJob(db,f,jobId));
  const state=await rpc(db,'phase9_automatic_edition_fence_v1',[jobId,worker,token,1]);
  await resetActor(db);
  const contract=await value(db,"SELECT marketplace_sec.phase9_provider_validation_contract_v1('google_books','1.0.0')");
  return {...f,jobId,fence:{jobId,worker,leaseToken:token,claimAttempt:1,candidateId:f.candidateId,
    storeId:f.storeId,sessionId:f.sessionId,candidateVersion:state.candidateVersion,queryIdentity:context.queryIdentity,
    capturedRequestId:state.capturedRequestId,requestGeneration:state.requestGeneration},
  spec:{provider_cache_identity:'u5-native-shared',adapter_key:'google_books',adapter_version:'1.0.0',
    capability_version:contract.capabilityVersion,schema_version:contract.lookupSchemaVersion,lookup_strategy:'isbn',
    lookup_contract_version:'p9-metadata-lookup-v1',normalizer_version:contract.normalizerVersion,
    routing_policy_version:'p9-metadata-routing-v1',privacy_scope:'store_private',reuse_policy_version:'1',
    cache_policy_version:'p9-metadata-cache-v1',cache_namespace:'metadata-v1'}};
}
async function service(client) {
  await client.query("SET statement_timeout='9s'; SET idle_in_transaction_session_timeout='15s'");
  await client.query("SELECT set_config('request.jwt.claim.role','service_role',false)");
  await client.query('SET ROLE service_role');
}
const prepare=(client,f)=>client.query(
  'SELECT public.phase9_prepare_automatic_metadata_v1($1::jsonb,$2::jsonb,false) AS body',[f.fence,f.spec]);
async function until(predicate,label) {
  const deadline=Date.now()+10000;
  while(Date.now()<deadline) {
    const result=await predicate();
    if(result)return result;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail('bounded native barrier timed out: '+label);
}
async function electionWait(contenderPid,holderPid) {
  return until(async()=>{
    const rows=(await db.query('SELECT a.wait_event_type,pg_blocking_pids(a.pid) AS blockers '+
      'FROM pg_stat_activity a WHERE a.pid=$1 AND a.wait_event_type=\'Lock\' '+
      'AND $2=ANY(pg_blocking_pids(a.pid)) AND EXISTS(SELECT 1 FROM pg_locks l '+
      'WHERE l.pid=a.pid AND NOT l.granted AND l.relation=\'public.phase9_metadata_lookups\'::regclass)',
    [contenderPid,holderPid])).rows;
    return rows[0];
  },'actual election table lock');
}
async function count(table,jobId) {
  return value(db,'SELECT count(*)::int FROM '+table+' WHERE job_id=$1',[jobId]);
}

// Catches releasing the election mutex between no-leader observation, admission and leader insertion.
test('I-native-election: concurrent equal-query jobs admit one leader and leave the other as a runless follower',async()=>{
  const left=await fresh(),right=await fresh(await receivingCard(db,left));
  await resetActor(db);
  const holder=await nativeConnection(db.database),contender=await nativeConnection(db.database);
  let pending;
  try {
    const holderPid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const contenderPid=(await contender.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await service(holder);await service(contender);await holder.query('BEGIN');
    const first=(await prepare(holder,left)).rows[0].body;
    assert.deepEqual(first.admission,{status:'started',round:0});assert.equal(first.coalescing.mode,'leader');
    pending=prepare(contender,right).then(result=>({result}),error=>({error}));
    const evidence=await electionWait(contenderPid,holderPid);
    assert.equal(evidence.wait_event_type,'Lock');assert.ok(evidence.blockers.includes(holderPid));
    await holder.query('COMMIT');
    const outcome=await pending;assert.equal(outcome.error,undefined);
    assert.deepEqual(outcome.result.rows[0].body,{admission:null,
      coalescing:{mode:'follower_pending',leaderLookupId:first.coalescing.lookupId}});
    assert.equal(await count('public.phase9_metadata_lookups',left.jobId),1);
    assert.equal(await count('public.phase9_metadata_lookups',right.jobId),0);
    assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',left.jobId),1);
    assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',right.jobId),0);
    assert.equal(await count('public.phase9_metadata_provider_calls',right.jobId),0);
    assert.equal(await value(db,'SELECT slots_remaining::int FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1',[left.jobId]),1);
  } finally {
    try { await holder.query('ROLLBACK');await pending; }
    finally { await Promise.all([holder.end(),contender.end()]); }
  }
});

// Catches using transaction_timestamp rather than rechecking wall-clock lease scope after the table lock.
test('I-native-expiry: a lease expiring during the observed election wait leaves no admission or lineage',async()=>{
  const f=await fresh();await resetActor(db);
  const holder=await nativeConnection(db.database),contender=await nativeConnection(db.database);
  let pending;
  try {
    const holderPid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const contenderPid=(await contender.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await holder.query("SET idle_in_transaction_session_timeout='15s'; BEGIN");
    await holder.query('LOCK TABLE public.phase9_metadata_lookups IN SHARE ROW EXCLUSIVE MODE');
    await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()+interval '5 seconds' WHERE id=$1",[f.jobId]);
    await service(contender);
    pending=prepare(contender,f).then(result=>({result}),error=>({error}));
    const evidence=await electionWait(contenderPid,holderPid);
    assert.equal(evidence.wait_event_type,'Lock');assert.ok(evidence.blockers.includes(holderPid));
    assert.equal(await until(()=>value(db,'SELECT clock_timestamp()>lease_expires_at FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),'database lease expiry'),true);
    await holder.query('COMMIT');
    const outcome=await pending;assert.match(outcome.error.message,/P9_STATE_CONFLICT/);
    assert.equal(await count('public.phase9_metadata_lookups',f.jobId),0);
    assert.equal(await count('public.phase9_usage_reservations',f.jobId),0);
    assert.equal(await count('public.phase9_metadata_provider_calls',f.jobId),0);
    assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),0);
    assert.equal(await count('marketplace_sec.phase9_metadata_admissions',f.jobId),0);
    assert.equal(await value(db,'SELECT attempt_count FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),1);
  } finally {
    try { await holder.query('ROLLBACK');await pending; }
    finally { await Promise.all([holder.end(),contender.end()]); }
  }
});

async function rowWait(contenderPid,holderPid) {
  return until(async()=>{
    const rows=(await db.query("SELECT a.wait_event_type,pg_blocking_pids(a.pid) AS blockers "+
      "FROM pg_stat_activity a WHERE a.pid=$1 AND a.wait_event_type='Lock' "+
      'AND $2=ANY(pg_blocking_pids(a.pid))',[contenderPid,holderPid])).rows;
    return rows[0];
  },'actual row lock');
}

// Mutation caught: the fence reader returns a transaction-time-valid lease that expired while waiting on its candidate.
test('F1-native-reader-expiry: candidate lock wait expires the reader lease and rejects the fence',async()=>{
  const f=await fresh();await resetActor(db);
  const holder=await nativeConnection(db.database),reader=await nativeConnection(db.database);
  let pending;
  try {
    const holderPid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const readerPid=(await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await holder.query("SET idle_in_transaction_session_timeout='15s'; BEGIN");
    await holder.query('SELECT id FROM public.image_extraction_candidates WHERE id=$1 FOR UPDATE',[f.candidateId]);
    await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=clock_timestamp()+interval '5 seconds' WHERE id=$1",[f.jobId]);
    await service(reader);
    pending=reader.query('SELECT public.phase9_automatic_edition_fence_v1($1,$2,$3,$4) AS body',
      [f.jobId,worker,token,1]).then(result=>({result}),error=>({error}));
    const evidence=await rowWait(readerPid,holderPid);
    assert.equal(evidence.wait_event_type,'Lock');assert.ok(evidence.blockers.includes(holderPid));
    assert.equal(await until(()=>value(db,'SELECT clock_timestamp()>lease_expires_at FROM public.image_extraction_jobs WHERE id=$1',[f.jobId]),'database reader lease expiry'),true);
    await holder.query('COMMIT');
    const outcome=await pending;assert.match(outcome.error.message,/P9_STATE_CONFLICT/);
    assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),0);
    assert.equal(await count('public.phase9_metadata_lookups',f.jobId),0);
  } finally {
    try { await holder.query('ROLLBACK');await pending; }
    finally { await Promise.all([holder.end(),reader.end()]); }
  }
});

// Mutation caught: two preparations sharing one job and claim both start admission or duplicate its lookup/run.
test('T2-native-same-claim: concurrent preparations start once and replay the committed run',async()=>{
  const f=await fresh();await resetActor(db);
  const holder=await nativeConnection(db.database),contender=await nativeConnection(db.database);
  let pending;
  try {
    const holderPid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const contenderPid=(await contender.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await service(holder);await service(contender);await holder.query('BEGIN');
    const first=(await prepare(holder,f)).rows[0].body;
    assert.deepEqual(first.admission,{status:'started',round:0});assert.equal(first.coalescing.mode,'leader');
    pending=prepare(contender,f).then(result=>({result}),error=>({error}));
    const evidence=await rowWait(contenderPid,holderPid);
    assert.equal(evidence.wait_event_type,'Lock');assert.ok(evidence.blockers.includes(holderPid));
    await holder.query('COMMIT');
    const outcome=await pending;assert.equal(outcome.error,undefined);
    const second=outcome.result.rows[0].body;
    assert.deepEqual(second,{admission:{status:'replayed',round:0,runStatus:'running'},coalescing:null});
    assert.equal([first,second].filter(result=>result.admission.status==='started').length,1);
    assert.equal(await count('marketplace_sec.phase9_automatic_provider_runs',f.jobId),1);
    assert.equal(await count('public.phase9_metadata_lookups',f.jobId),1);
    assert.equal(await value(db,'SELECT id FROM public.phase9_metadata_lookups WHERE job_id=$1',[f.jobId]),first.coalescing.lookupId);
  } finally {
    try { await holder.query('ROLLBACK');await pending; }
    finally { await Promise.all([holder.end(),contender.end()]); }
  }
});
