// 02c §§4.3/8/9: concurrent store creation must receive admission state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {createProviderDatabase,nativeConnection,value} from './providerReplacementFixture.mjs';
test('queue install: store inserted during migration receives its private admission row',
  {skip:!process.env.PHASE9_PROVIDER_NATIVE_PORT},async()=>{
  const db=await createProviderDatabase({selection:'8a-4'}),writer=await nativeConnection(db.database);
  const sql=fs.readFileSync(new URL('../../migrations/20261101000093_marketplace_phase9_provider_queue_protection.sql',import.meta.url),'utf8');
  const anchor='INSERT INTO marketplace_sec.phase9_store_admission(store_id) SELECT id FROM public.stores;';
  const split=sql.indexOf(anchor)+anchor.length;assert.ok(split>=anchor.length);
  const store=randomUUID();
  try {
    await db.exec(sql.slice(0,split));
    const locks=await value(db,"SELECT array_agg(mode) FROM pg_locks WHERE pid=pg_backend_pid() AND relation='public.stores'::regclass");
    assert.ok(locks.includes('ShareRowExclusiveLock'),'the FK DDL already serializes store inserts through migration commit');
    const pending=writer.query('INSERT INTO public.stores(id,display_name) VALUES($1,$2)',[store,'Concurrent store']);
    // Let the writer reach the lock boundary while migration remains open.
    await db.exec('SELECT pg_sleep(0.2)');
    await db.exec(sql.slice(split));await pending;
    assert.equal(await value(db,'SELECT count(*)::int FROM marketplace_sec.phase9_store_admission WHERE store_id=$1',[store]),1);
  } finally {await db.exec('ROLLBACK');await writer.end();await db.close();}
});
