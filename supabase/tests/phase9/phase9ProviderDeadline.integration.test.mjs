// 02c §3.1 / §4.2 / AC8-10: real lock waits on disposable PostgreSQL only.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProviderDatabase,nativeConnection,resetActor,value} from './providerReplacementFixture.mjs';
import {catalogueBatch,completeCatalogueV2} from './leanCatalogueFixture.mjs';
import {completionFootprint} from './leanCatalogueCompletionFixture.mjs';

const native=!!process.env.PHASE9_PROVIDER_NATIVE_PORT;
for(const selection of ['8a-2','8a-4'])test(`P2 ${selection}: advisory-lock wait past the provider deadline rolls back completion`,
  {skip:native?false:'NEEDS native PostgreSQL independent connections'},async()=>{
  const db=await createProviderDatabase({selection});
  let holder,observer,pending,holding=false;
  try {
    const f=await catalogueBatch(db);
    await resetActor(db);
    await db.exec("SET statement_timeout='30s'; UPDATE public.phase9_provider_registry SET options_retention_seconds=8 WHERE adapter_key='open_library'");
    const keys=await value(db,'SELECT marketplace_sec.phase9_catalogue_plan_keys_v1($1,$2)',
      [f.rows[0].metadata,f.catalogueCompanions[0]]);
    assert.ok(keys.length,'fixture must produce a real canonical identity lock');
    const before=await completionFootprint(db),pid=await value(db,'SELECT pg_backend_pid()');
    holder=await nativeConnection(db.database);observer=await nativeConnection(db.database);
    await observer.query("SET statement_timeout='30s'");
    const holderPid=(await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await holder.query('BEGIN');holding=true;
    await holder.query('SELECT pg_advisory_xact_lock($1::bigint)',[keys[0]]);
    f.fetched=new Date().toISOString();
    f.deadline=new Date(Date.parse(f.fetched)+3600000).toISOString();
    for(const row of f.rows)if(row.metadata)row.metadata.fetchedAt=f.fetched;
    for(const companion of f.catalogueCompanions)companion.fetchedAt=f.fetched;
    const expires=Date.parse(f.fetched)+8000;
    pending=completeCatalogueV2(db,f).then(receipt=>({receipt}),error=>({error}));
    const observeUntil=Date.now()+5000;let wait;
    while(Date.now()<observeUntil) {
      wait=(await observer.query(`SELECT wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers,xact_start
        FROM pg_stat_activity WHERE pid=$1`,[pid])).rows[0];
      if(wait?.blockers.includes(holderPid))break;
      await new Promise(resolve=>setTimeout(resolve,30));
    }
    assert.ok(wait?.blockers.includes(holderPid),'completion must be observed waiting for the held identity lock');
    assert.equal(wait.wait_event_type,'Lock');assert.equal(wait.wait_event,'advisory');
    assert.ok(new Date(wait.xact_start).getTime()<expires,'completion transaction started before the capped deadline');
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,expires-Date.now()+250)));
    assert.equal((await observer.query('SELECT clock_timestamp()>=$1::timestamptz AS expired',
      [new Date(expires).toISOString()])).rows[0].expired,true);
    await holder.query('COMMIT');holding=false;
    const result=await pending;
    assert.equal(result.error?.message,'P9_METADATA_STORAGE_DENIED',
      'an expired list must not return a successful completion');
    assert.equal(await completionFootprint(db),before,'the rejected transaction must roll back all effects');
  } finally {
    if(holding)await holder.query('ROLLBACK').catch(()=>{});
    if(pending)await pending;
    if(holder)await holder.end();
    if(observer)await observer.end();
    await db.close();
  }
});
