// 02c §§4.1/9/10/11.1: harness selection/prerequisite regressions, no database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {nativeAdapter,packageOrder,requireObject,selectedPrefix} from './providerDatabaseHarness.mjs';
import {noSharedChange} from './providerReplacementFixture.mjs';
test('all suites select explicit M88 or the entire approved prefix',()=>{
  const manifest=Object.fromEntries(packageOrder.map((p,i)=>[p,[`approved-${i}.sql`]]));
  assert.deepEqual(selectedPrefix('m88',manifest),{installed:[],migrations:[]});
  for(const [i,p] of packageOrder.entries())assert.deepEqual(selectedPrefix(p,manifest),{
    installed:packageOrder.slice(0,i+1),migrations:Array.from({length:i+1},(_,j)=>`approved-${j}.sql`)});
  assert.throws(()=>selectedPrefix('8a-2',{'8a-1':[],'8a-2':['later.sql']}),/approved prefix missing migration: 8a-1/);
  assert.throws(()=>selectedPrefix('latest',manifest),/approved 8a prefix/);
});
test('installed package missing object fails instead of skipping; M88 future prerequisite is explicit',()=>{
  const skips=[],t={skip:message=>skips.push(message)};
  assert.equal(requireObject(t,{installedPackages:[]},false,'8a-1','config'),false);assert.equal(skips.length,1);
  assert.throws(()=>requireObject(t,{installedPackages:['8a-1']},false,'8a-1','config'),/installed but promised object missing/);
  assert.equal(skips.length,1,'installed failures never call skip');
});
// 02c §4.2 C/D/J: existing receipts must survive, keyed by their actual PK.
test('shared-effect comparison rejects deletion and distinguishes choices on one lookup',()=>{
  const name='marketplace_sec.phase9_catalogue_choice_effects';
  const first={selection_id:'choice-1',lookup_id:'lookup',counted:false};
  const second={selection_id:'choice-2',lookup_id:'lookup',counted:false};
  const before={[name]:[first,second]};
  assert.doesNotThrow(()=>noSharedChange(before,{[name]:[second,first]},'reorder'));
  assert.throws(()=>noSharedChange(before,{[name]:[first]},'delete'),/existing private receipt/);
  assert.throws(()=>noSharedChange(before,{[name]:[first,{...second,counted:true}]},'mutate'),/existing private receipt/);
  assert.doesNotThrow(()=>noSharedChange(before,{[name]:[first,second,{selection_id:'choice-3',lookup_id:'lookup',counted:false}]},'private receipt'));
  const lookup='marketplace_sec.phase9_catalogue_lookup_effects';
  assert.throws(()=>noSharedChange({[lookup]:[{lookup_id:'lookup'}]},{[lookup]:[]},'delete'),/existing private receipt/);
});
test('native adapter preserves SQL text arrays and encodes only explicitly typed JSON arrays',async()=>{
  const strings=['one','two'],json=['validated_isbn'];
  const adapter=nativeAdapter({async query(sql,values){
    assert.equal(values[0],strings);assert.equal(values[1],JSON.stringify(json));return {rows:[]};
  }});
  await adapter.query('SELECT $1::text[], $2::jsonb',[strings,json]);
});
test('native provider group is selectable outside cache result and carries prefix with restored environment',()=>{
  const s=fs.readFileSync(new URL('./run-phase9-bookstore-first-postgres.ps1',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  assert.match(s,/'lean-catalogue-cache', 'provider-replacement'/);
  assert.match(s,/if \(\$OnlyGroup -eq 'provider-replacement'\) \{ \$IncludeProviderReplacement = \$true \}/);
  assert.match(s,/^      \}\n      # 02c §9:[^\n]*\n      if \(\$IncludeProviderReplacement\) \{\n        Invoke-NativeGroup 'provider-replacement'/m);
  assert.match(s,/PHASE9_PROVIDER_PREFIX = \$ProviderPrefix/);
  assert.match(s,/PHASE9_PROVIDER_PREFIX = \$savedProviderPrefix/);
  assert.match(s,/--test-concurrency=1 @providerTests/);
});
test('freeze inventories require every overload and separate metadata without copying M88 hashes',()=>{
  const read=n=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+n,import.meta.url)));
  const i=read('provider-replacement-generic-inventory.json'),g=read('provider-replacement-generic-sha256.json');
  assert.equal(new Set(i.sql.map(r=>r.signature)).size,i.sql.length);assert.ok(i.sql.length>=70);
  for(const n of ['phase9_register_structural_metadata_lookup','phase9_register_metadata_lookup','phase9_complete_automatic_metadata_v1'])
    assert.ok(i.sql.some(r=>r.signature.includes('.'+n+'(')),n);
  assert.ok(Array.isArray(g.metadata));assert.equal(g.inventory,'provider-replacement-generic-inventory.json');
  if(g.baselineArtifact===null){assert.deepEqual(g.sql,[]);assert.deepEqual(g.metadata,[]);}
  else assert.deepEqual(g.sql.map(r=>r.signature),g.metadata.map(r=>r.signature));
});
