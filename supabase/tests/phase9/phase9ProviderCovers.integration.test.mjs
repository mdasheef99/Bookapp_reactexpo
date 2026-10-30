// 02c §4.2 AC8-7/10: saved pre-switch auxiliary covers, no data cleanup policy.
import assert from 'node:assert/strict';
import {after,before,beforeEach,test} from 'node:test';
import {clean,createProviderDatabase,needsCapabilities,resetActor,setActor,value} from './providerReplacementFixture.mjs';
import {originalSelection,seedCard} from './editionPickerCommitFixture.mjs';
import {add,readSql,saveReview,selectionBytes,selectSql} from './catalogueLinkFixture.mjs';
import {nativeAdapter} from './providerDatabaseHarness.mjs';
import pgUtils from 'pg/lib/utils.js';
let db;
before(async()=>{db=await createProviderDatabase();});
beforeEach(async()=>{await clean(db);});
after(async()=>{await db?.close();});
async function savedCover() {
  const f=await originalSelection(db,await seedCard(db));
  await saveReview(db,f);
  const detail=await value(db,'SELECT public.phase9_owner_candidate_detail_v2($1,$2)',[f.sessionId,f.candidateId]);
  const batch=await value(db,'SELECT public.phase9_owner_batch_review_v1($1)',[f.sessionId]);
  assert.ok(detail.metadata.representativeCover,'pre-switch detail positive');
  assert.ok(batch.items[0].metadataSummary.representativeCover,'pre-switch compact positive');
  return f;
}
// 02c §§4.1/4.2/9: exercise the real fixture through pg's offline wire encoder.
test('AC8-7 GREEN-control native selected-snapshot evidence binds JSON, preserving text arrays',async()=>{
  const query=db.query.bind(db);let checked=0;
  db.query=async(sql,parameters=[])=>{
    if(/INSERT INTO public\.phase9_selected_metadata_snapshots/.test(sql)) {
      const adapter=nativeAdapter({async query(statement,values) {
        assert.deepEqual(JSON.parse(pgUtils.prepareValue(values[6])),['validated_isbn']);
        checked++;return query(statement,values);
      }});
      return adapter.query(sql,parameters);
    }
    return query(sql,parameters);
  };
  try{await savedCover();assert.equal(checked,1);}finally{db.query=query;}
});
for(const mode of ['disabled','legacy automatic-off']) for(const boundary of ['detail','compact','new Add'])
test(`AC8-7 [8a-4] ${mode==='disabled'?'':'GREEN-control '}saved Google auxiliary ${boundary} ${mode==='disabled'?'suppressed after disabled':'preserved in legacy automatic-off mode'}`,async t=>{
  if(mode!=='disabled' && !await needsCapabilities(t,db))return;
  const f=await savedCover();
  const expected=await value(db,'SELECT public.phase9_owner_candidate_detail_v2($1,$2)',[f.sessionId,f.candidateId]);
  const chosen=await selectionBytes(db,f);
  const cover=mode==='disabled'?null:expected.metadata.representativeCover;
  await db.exec(mode==='disabled' ? "UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='google_books'" :
    "UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,automatic_order=NULL WHERE adapter_key='google_books'");
  await setActor(db,f.ownerId);
  if(boundary==='detail') {
    const d=await value(db,'SELECT public.phase9_owner_candidate_detail_v2($1,$2)',[f.sessionId,f.candidateId]);
    assert.deepEqual(d.metadata.representativeCover,cover,'legacy detail uses enabled; disabled Google is hidden');
  } else if(boundary==='compact') {
    const b=await value(db,'SELECT public.phase9_owner_batch_review_v1($1)',[f.sessionId]);
    assert.deepEqual(b.items[0].metadataSummary.representativeCover,cover,'legacy compact read uses enabled; disabled Google is hidden');
  } else assert.deepEqual((await add(db,f)).item.representative_cover,cover,'legacy Add uses enabled; disabled Google cannot copy a representative');
  assert.equal(await selectionBytes(db,f),chosen,'chosen own-cover snapshot bytes remain unchanged');
});
// 02c §4.2: 8a preserves enabled-only legacy behavior. No real 8b v2 mode exists yet.
for(const boundary of ['detail','compact','new Add'])test.todo(
  `AC8-7 UNPROVED-PREREQUISITE [8b]: real v2-mode fixture suppresses saved Google auxiliary ${boundary} when enabled but automatic capability is off, including rollback`);
test('AC8-7/10 GREEN-control switch preserves existing inventory, representative and selected snapshot bytes',async()=>{
  const f=await savedCover(),saved=await add(db,f),chosen=await selectionBytes(db,f);
  assert.ok(saved.item.representative_cover);
  await db.exec("UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='google_books'");
  assert.deepEqual((await db.query('SELECT * FROM public.store_inventory WHERE id=$1',[saved.item.id])).rows[0],saved.item);
  assert.equal(await selectionBytes(db,f),chosen);
});
test('AC8-7 GREEN-control both legacy Google-only representative CHECKs remain enforced',async()=>{
  await savedCover(); await resetActor(db);
  const checks=(await db.query(`SELECT conname,pg_get_constraintdef(oid) AS body FROM pg_constraint
    WHERE conrelid IN('marketplace_sec.phase9_metadata_representative_covers'::regclass,'public.store_inventory'::regclass) AND contype='c'`)).rows;
  assert.equal(checks.filter(c=>c.body.includes('books[.]google[.]com')).length,2);
  for(const change of [{cover_reference:'https://covers.openlibrary.org/b/id/123-M.jpg'}]) {
    await db.exec('BEGIN'); let error;
    try {await db.query(`INSERT INTO marketplace_sec.phase9_metadata_representative_covers
      SELECT (jsonb_populate_record(NULL::marketplace_sec.phase9_metadata_representative_covers,to_jsonb(r)||$1::jsonb)).*
      FROM marketplace_sec.phase9_metadata_representative_covers r LIMIT 1`,[change]);}
    catch(e){error=e;}finally{await db.exec('ROLLBACK');}
    assert.equal(error?.code,'23514');assert.ok(checks.some(c=>c.conname===error.constraint));
  }
  const stored=await add(db,await savedCover());
  const expression=await value(db,`SELECT pg_get_expr(conbin,conrelid) FROM pg_constraint
    WHERE conrelid='public.store_inventory'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%representative_cover%'`);
  // Evaluate the actual legacy CHECK independently of the immutable-copy trigger.
  await db.exec(`CREATE TEMP TABLE provider_cover_check(representative_cover jsonb CHECK(${expression}))`);
  await db.query('INSERT INTO provider_cover_check VALUES($1)',[stored.item.representative_cover]);
  await db.exec('BEGIN');let error;
  try{await db.query('INSERT INTO provider_cover_check VALUES($1)',[{...stored.item.representative_cover,
    coverReference:'https://covers.openlibrary.org/b/id/123-M.jpg'}]);}
  catch(e){error=e;}finally{await db.exec('ROLLBACK');}
  assert.equal(error?.code,'23514');assert.equal(error.constraint,'provider_cover_check_representative_cover_check');
});
