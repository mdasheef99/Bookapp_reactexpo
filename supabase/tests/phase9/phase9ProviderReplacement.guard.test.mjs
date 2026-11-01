// 02c §§3.1/5.1/9/11.1: offline fixture integrity only, NOT SQL/runtime acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import { test } from 'node:test';
const read=name=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url)));
const synthetic=read('provider-replacement-synthetic.json');
test('AC8-9a [8a-2] GREEN fixture-control synthetic contract is distinct from Google and OL',()=>{
  assert.match(synthetic.retentionContract,/^[a-z][a-z0-9-]{0,63}$/);
  assert.equal(synthetic.retentionContract,'synthetic-options-v1');
  for(const other of ['open-library-options-v1','google-books-options-v1'])assert.notEqual(synthetic.retentionContract,other);
  assert.deepEqual(synthetic.stages,['discover','edition:ED-42','person:AUTH-7']);
  assert.equal(synthetic.payloadSchemaVersion,'p9-metadata-v1');
  assert.equal(synthetic.lookupSchemaVersion,'p9-metadata-foundation-v1');
});
test('AC8-9a/11 [8a-2] GREEN fixture-control each retained field has explicit test-only permission evidence',()=>{
  assert.deepEqual(Object.keys(synthetic.fieldPermissions).sort(),[...synthetic.retainedFields].sort());
  for(const [field,permission]of Object.entries(synthetic.fieldPermissions)){
    assert.equal(permission.storageAllowed,true,field); assert.equal(permission.publicDisplayAllowed,true,field);
    assert.equal(permission.imageCachingAllowed,false,field); assert.equal(permission.attributionRequired,true,field);
    assert.ok(permission.authorityReference.startsWith('Test-only'),field);
  }
});
test('AC8-10 [8a-1..5] GREEN fixture-control uncreated packages reserve no guessed migration filenames',()=>{
  const manifest=read('provider-replacement-packages.json');
  for(const pkg of ['8a-1','8a-2','8a-3','8a-4','8a-5']){
    assert.ok(Array.isArray(manifest[pkg]));
    for(const name of manifest[pkg])assert.match(name,/^\d{14}_marketplace_phase9_[a-z0-9_]+\.sql$/);
  }
});
test('AC8-9a [8a-2..4] GREEN fixture-control incomplete generalized freeze cannot masquerade as a populated golden',()=>{
  const golden=read('provider-replacement-generic-sha256.json');
  if(golden.baselineArtifact===null){assert.match(golden.status,/NEEDS-OBJECT/);assert.deepEqual(golden.sql,[]);return;}
  assert.ok(golden.sql.length>0);
  for(const row of golden.sql){assert.match(row.signature,/^(public|marketplace_sec)\.[a-z0-9_]+\(/);assert.match(row.sha256,/^[0-9a-f]{64}$/);}
});
test('AC8-9a [8a-5] explicit separate freeze covers its reviewed inventory and unchanged earlier files',()=>{
  const g=read('provider-replacement-generic-8a5-sha256.json'),i=read('provider-replacement-generic-inventory.json');
  assert.deepEqual(g.sql.map(r=>r.signature).sort(),i.sql.map(r=>r.signature).sort());
  assert.deepEqual(g.sql.map(r=>r.signature),g.metadata.map(r=>r.signature));
  assert.equal(g.files.length,5);
  for(const row of g.files)
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../../'+row.path,import.meta.url))).digest('hex'),row.sha256,row.path);
});
