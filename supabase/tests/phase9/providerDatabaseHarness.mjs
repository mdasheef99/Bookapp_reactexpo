// 02c §§4.1/4.4/9: explicit M88/prefix selection; each native suite owns a clone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
export const packages = JSON.parse(fs.readFileSync(new URL('./fixtures/provider-replacement-packages.json', import.meta.url)));
export const packageOrder = ['8a-1','8a-2','8a-3','8a-4','8a-5'];
export function selectedPrefix(selection = process.env.PHASE9_PROVIDER_PREFIX ?? 'm88', manifest = packages) {
  assert.ok(selection === 'm88' || packageOrder.includes(selection), 'select m88 or an approved 8a prefix');
  const installed = selection === 'm88' ? [] : packageOrder.slice(0,packageOrder.indexOf(selection)+1);
  for (const pkg of installed) assert.ok(manifest[pkg]?.length, 'approved prefix missing migration: '+pkg);
  return { installed, migrations: installed.flatMap(pkg=>manifest[pkg]) };
}
export function promised(db, pkg) {
  return (pkg.match(/8a-[1-5]/g) ?? []).every(p=>db.installedPackages.includes(p));
}
export function requireObject(t, db, exists, pkg, label) {
  if (!exists) {
    assert.equal(promised(db,pkg),false,`${pkg} installed but promised object missing: ${label}`);
    t.skip(`NEEDS-OBJECT ${pkg}: ${label}; missing objects are not behavioral RED`);
  }
  return exists;
}
export async function nativeConnection(database=process.env.PHASE9_PROVIDER_NATIVE_DATABASE) {
  const port=process.env.PHASE9_PROVIDER_NATIVE_PORT;
  assert.match(port??'',/^\d{4,5}$/); assert.match(database??'',/^bookconnect_u8b_\d+$/);
  const { Client }=await import('pg');
  const client=new Client({host:'127.0.0.1',port:Number(port),database,user:'postgres',password:'',
    connectionTimeoutMillis:5000,statement_timeout:5000});
  await client.connect(); return client;
}
let cloneNumber=0;
export async function nativeClone() {
  const source=process.env.PHASE9_PROVIDER_NATIVE_DATABASE;
  assert.match(source??'',/^bookconnect_u8b_\d+$/);
  const clone=source+process.pid+String(++cloneNumber).padStart(3,'0'); assert.ok(clone.length<63);
  const {Client}=await import('pg');
  const admin=new Client({host:'127.0.0.1',port:Number(process.env.PHASE9_PROVIDER_NATIVE_PORT),database:'postgres',user:'postgres',password:''});
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${clone} TEMPLATE ${source}`);
    const client=await nativeConnection(clone);
    return {client,database:clone,async close(){
      try {await client.end();await admin.query(`DROP DATABASE ${clone}`);}finally{await admin.end();}
    }};
  } catch(error) {await admin.query(`DROP DATABASE IF EXISTS ${clone}`);await admin.end();throw error;}
}
export function nativeAdapter(client) {
  const types=new Map();
  return {exec:sql=>client.query(sql),async query(sql,parameters=[]) {
    const values=[...parameters],call=sql.match(/^\s*SELECT\s+(public|marketplace_sec)\.(\w+)\s*\(/i);
    if(call && values.some(Array.isArray)) {
      const key=call[1]+'.'+call[2]+':'+values.length;
      if(!types.has(key)) {
        const candidates=(await client.query(`SELECT p.proargtypes::text AS arguments FROM pg_proc p
          JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname=$2 AND p.pronargs=$3`,
        [call[1],call[2],values.length])).rows;
        assert.equal(candidates.length,1,'native fixture must resolve one exact RPC arity: '+key);
        types.set(key,candidates[0].arguments.split(' ').map(Number));
      }
      const argumentTypes=types.get(key);
      for(let i=0;i<values.length;i++)if(Array.isArray(values[i]) && [114,3802].includes(argumentTypes[i]))values[i]=JSON.stringify(values[i]);
    }
    for(let i=0;i<values.length;i++)if(Array.isArray(values[i]) &&
      new RegExp('\\$'+(i+1)+'\\s*::\\s*jsonb?\\b','i').test(sql))values[i]=JSON.stringify(values[i]);
    return client.query(sql,values);
  }};
}
