// 02c §§3.1,4.2,5.1,8,9 AC8-3/9a/11/12; 8a-2 facts/dispatch, 8a-3 physical grammar.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { clean, createProviderDatabase, facts, needs, resetActor, value } from './providerReplacementFixture.mjs';
import { row } from './editionPickerFixture.mjs';
let db;
before(async () => { db = await createProviderDatabase(); });
beforeEach(async () => { await clean(db); });
after(async () => { await db?.close(); });
const metadata = (overrides={}) => facts({correlationId:randomUUID(),attemptId:randomUUID(),
  fetchedAt:new Date().toISOString(),...overrides});
const normalized = m => value(db,'SELECT marketplace_sec.phase9_edition_valid_normalized_metadata($1)',[m]);
const rowsValid = rows => value(db,'SELECT marketplace_sec.phase9_edition_valid_rows($1)',[JSON.stringify(rows)]);

for (const [provider,record,cover] of [
  ['open_library','OL100M','https://covers.openlibrary.org/b/id/123-M.jpg'],
  ['google_books','GB-42','https://books.google.com/books/content?id=GB-42'],
]) test(`AC8-11 [8a-2] GREEN-control ${provider} v1 facts and payload schema remain valid`,async()=>{
  assert.equal(await normalized(metadata({adapterKey:provider,providerRecordId:record,coverReference:cover})),true);
});

for (const [label,change] of [
  ['unknown provider',{adapterKey:'never_installed',coverReference:null}],
  ['payload/lookup schema swap',{schemaVersion:'p9-metadata-foundation-v1'}],
  ['unknown metadata key',{providerSecret:'must not persist'}],
  ['unsafe URL protocol',{coverReference:'http://covers.openlibrary.org/b/id/123-M.jpg'}],
  ['credentialed URL',{coverReference:'https://user:pass@covers.openlibrary.org/b/id/123-M.jpg'}],
  ['unsafe categories',{categories:['<script>bad</script>']}],
]) test(`AC8-11 [8a-2] GREEN-control normalized facts reject ${label}`,async()=>{
  assert.equal(await normalized(metadata(change)),false);
});

for (const [label,change] of [
  ['uninstalled OL adapter version',{adapterVersion:'uninstalled-99'}],
  ['OL facts with a Google cover',{coverReference:'https://books.google.com/books/content?id=GB-42'}],
  ['Google facts with an OL cover',{adapterKey:'google_books',providerRecordId:'GB-42'}],
]) test(`AC8-11 [8a-2] installed facts dispatcher rejects ${label}`,async()=>{
  const m=metadata(change);
  assert.equal(await normalized(m),false,`installed facts dispatcher must reject ${label}`);
});

for (const [label,m,url] of [
  ['OL own-record mismatch',metadata(), 'https://openlibrary.org/books/OL999M'],
  ['cross-provider book URL',metadata(), 'https://books.google.com/books?id=GB-42'],
]) test(`AC8-11 [8a-2] row dispatcher rejects ${label}`,async()=>{
  const positive=row(0,{metadata:m,googleBooksUrl:'https://openlibrary.org/books/OL100M'});
  assert.equal(await rowsValid([positive]),true,'positive control reaches the real row validator');
  assert.equal(await rowsValid([{...positive,googleBooksUrl:url}]),false,`row dispatcher must reject ${label}`);
});

for (const signature of [
  'marketplace_sec.phase9_edition_valid_metadata(jsonb,boolean)',
  'marketplace_sec.phase9_edition_valid_normalized_metadata(jsonb)',
  'marketplace_sec.phase9_edition_valid_rows(jsonb)',
  'marketplace_sec.phase9_catalogue_valid_cache_v1(jsonb)',
  'marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)',
]) test(`AC8-11 [8a-2] GREEN-control pure validator is immutable/invoker: ${signature}`,async()=>{
  const f=(await db.query(`SELECT provolatile,prosecdef,proconfig FROM pg_proc WHERE oid=$1::regprocedure`,[signature])).rows[0];
  assert.equal(f.provolatile,'i'); assert.equal(f.prosecdef,false); assert.ok(f.proconfig.includes('search_path=""'));
});

test('AC8-12 [8a-2] Google edition-list payload is forbidden even when its facts are shape-valid',async()=>{
  const m=metadata({adapterKey:'google_books',providerRecordId:'GB-42',coverReference:null});
  for(const k of ['correlationId','attemptId','matchRationale','confidence']) delete m[k];
  const payload={version:'psr-edition-cache-v1',sourceFetchedAt:m.fetchedAt,rows:[{
    ordinal:0,eligibility:'eligible',googleBooksUrl:'https://books.google.com/books?id=GB-42',
    providerRecordId:'GB-42',metadata:m,
    companion:{version:'psr-catalogue-write-v1',workExternalId:null,oclc:null,lccn:null},
  }]};
  const ol=metadata();for(const k of ['correlationId','attemptId','matchRationale','confidence'])delete ol[k];
  const positive={...payload,sourceFetchedAt:ol.fetchedAt,rows:[{...payload.rows[0],providerRecordId:ol.providerRecordId,
    googleBooksUrl:'https://openlibrary.org/books/'+ol.providerRecordId,metadata:ol}]};
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_catalogue_valid_cache_v1($1)',[positive]),true,'equivalent OL cache payload positive');
  assert.equal(await value(db,'SELECT marketplace_sec.phase9_catalogue_valid_cache_v1($1)',[payload]),false,
    'independent Google veto must reject edition-list payload in both public and private cache scopes');
});

// Names are proposed by 02c; SQL argument types/dispatch extension hooks are not specified.
// Keep these visible instead of making undefined_function/module absence a RED.
for(const [label,behavior] of [
  ['own retention contract', 'accept synthetic-options-v1 only for synthetic_catalogue/1.0.0'],
  ['unknown retention contract','reject never-installed-options-v1'],
  ['cross-provider retention contract','reject open-library-options-v1 and google-books-options-v1 for synthetic facts'],
  ['malformed retention contract','reject empty, uppercase, underscore and 65-character IDs'],
  ['source deadline','reject expired, fetched-after-deadline or >24h retention and shorten to current policy'],
  ['mixed field rights','deny retained fields missing public/storage permission even with permissive registry flags'],
  ['OL v1/v2 and synthetic tuple','accept payload p9-metadata-v1; independently reject lookup/cache p9-metadata-v1'],
]) test.todo(`AC8-9a/11 UNPROVED-PREREQUISITE [8a-2]: reviewed retention/profile dispatcher hook: ${label}: ${behavior}`);

test('AC8-3 [8a-3] GATED OQ8-6: valid checksum ISBN stage accepted only after approved transport fixtures',
  {skip:'GATED OQ8-6: no automatic or explicit isbn-stage activation before Owner answer/recorded redirects+headers'},()=>{});
test('AC8-8 [8a-2] GATED OQ8-7: approved genres transport rejects oversized/unsafe input without silent truncation',
  {skip:'GATED OQ8-7: full-data and legacy/v2 categories policy is unanswered'},()=>{});

test('AC8-11 [8a-2] version-aware source policy refuses an unaccepted version',async t=>{
  if(!await needs(t,db,'marketplace_sec.phase9_catalogue_source_policy_v2(text,text)','8a-2'))return;
  await resetActor(db);
  const p=await value(db,"SELECT marketplace_sec.phase9_catalogue_source_policy_v2('open_library','never-installed')");
  assert.ok(p===null || p.sharedAdmitted===false,'unaccepted lineage cannot authorize permanent reuse');
});
