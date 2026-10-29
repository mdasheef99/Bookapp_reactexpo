// 02b ??4.6/5/8.2/11/12: M87 cache admission and generic writer boundary.
import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { cacheRequest,catalogueBatch,completeCatalogueV2,createLeanDatabase,scanCacheCard,
  reuseCatalogueCache,blockIsbn } from './leanCatalogueFixture.mjs';
import { enableOL,resetActor,scalar } from './catalogueLinkFixture.mjs';
let db;
before(async()=>{db=await createLeanDatabase({m88:true});});
beforeEach(async()=>{await resetActor(db); await db.exec(
  'TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries,marketplace_sec.phase9_catalogue_isbn_blocklist CASCADE');
  await enableOL(db);});
after(async()=>{await db?.close();});
async function persisted(f) {
  await resetActor(db);
  return (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1',[f.lookupId])).rows[0];
}
test('[baseline] admission fixture records a real completed lookup and binds every companion',async()=>{
  const f=await catalogueBatch(db,{},null,{existing:await scanCacheCard(db)});
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  assert.equal((await persisted(f)).canonical_results.length,f.rows.length);
  assert.equal(await scalar(db,`SELECT count(*)::int FROM marketplace_sec.phase9_catalogue_companions WHERE lookup_id='${f.lookupId}'`),5);
});
test('AC7-3: blocked ISBN is skipped as a whole cache record while a clean neighbour publishes and reuses',async()=>{
  const f=await catalogueBatch(db,{},null,{existing:await scanCacheCard(db)});
  f.rows[0].metadata={...f.rows[0].metadata,isbn10:'0306406152',isbn13:'9780306406157'};
  await blockIsbn(db,'9780306406157');
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  const receipt=await persisted(f); assert.notEqual(receipt.cache_entry_id,null,'M86 must publish the clean cache neighbours');
  const entry=(await db.query('SELECT bibliographic_payload FROM public.phase9_metadata_cache_entries WHERE id=$1',[receipt.cache_entry_id])).rows[0];
  const blocked=f.rows[0].metadata.providerRecordId, clean=f.rows[1].metadata.providerRecordId;
  assert.equal(entry.bibliographic_payload.rows.some(r=>r.providerRecordId===blocked),false);
  assert.equal(entry.bibliographic_payload.rows.some(r=>r.providerRecordId===clean),true);
  const receiving=await cacheRequest(db,await scanCacheCard(db));
  assert.equal((await reuseCatalogueCache(db,receiving)).status,'completed'); await resetActor(db);
  const options=(await db.query('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1',[receiving.candidateId])).rows[0].options;
  assert.equal(options.some(r=>r.metadata?.providerRecordId===blocked),false);
  assert.equal(options.some(r=>r.metadata?.providerRecordId===clean),true);
  assert.equal(await scalar(db,"SELECT count(*)::int FROM public.canonical_editions WHERE isbn_13='9780306406157'"),0);
});

// AC7-21(b) remains OPEN: section 8.2 gives the writer only a persisted lookup,
// whose M73 options CHECK rejects synthetic adapters. No alternate payload input
// or validator exception is specified; keep the production CHECK intact.
