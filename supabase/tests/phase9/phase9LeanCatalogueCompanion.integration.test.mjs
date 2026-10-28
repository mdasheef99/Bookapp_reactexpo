// 02b sections 3/4.4/5/9/11 AC7-2d, 2f, 8, 10 and 20: disposable PGlite.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { asRole, createLeanDatabase, requireLean, requireM84 } from './leanCatalogueFixture.mjs';
import { completeOL, enableOL, olOperation, readSql, resetActor, scalar, setActor } from './catalogueLinkFixture.mjs';

const companions = 'marketplace_sec.phase9_catalogue_companions';
const effects = 'marketplace_sec.phase9_catalogue_lookup_effects';
const validator = 'marketplace_sec.phase9_catalogue_valid_companion_v1(jsonb,jsonb,uuid)';
const completionTypes = '(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb)';
let db;
before(async () => { db = await createLeanDatabase({ m84: true }); });
beforeEach(async () => {
  await resetActor(db); await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });

async function envelope() {
  const f = await olOperation(db), optionId = randomUUID(), m = f.facts;
  const companion = { version: 'psr-catalogue-write-v1', optionId, adapterKey: m.adapterKey,
    adapterVersion: m.adapterVersion, normalizerVersion: m.normalizerVersion,
    lookupId: f.lookupId, attemptId: f.attemptId, providerRecordId: m.providerRecordId,
    workExternalId: 'OL700W', fetchedAt: m.fetchedAt, oclc: '001234', lccn: 'n 79021164' };
  return { f, m, optionId, companion };
}
async function valid(c, m, optionId) {
  await resetActor(db);
  return (await db.query('SELECT marketplace_sec.phase9_catalogue_valid_companion_v1($1,$2,$3) AS valid',
    [c, m, optionId])).rows[0].valid;
}
async function columns(table) {
  return (await db.query(`SELECT attname,attnotnull FROM pg_attribute WHERE attrelid=to_regclass($1)
    AND attnum>0 AND NOT attisdropped ORDER BY attnum`, [table])).rows;
}
async function fks(table) {
  return (await db.query(`SELECT a.attname,n.nspname||'.'||t.relname AS target,c.confdeltype
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.confrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN LATERAL unnest(c.conkey) k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum
    WHERE c.conrelid=to_regclass($1) AND c.contype='f' ORDER BY a.attname`, [table])).rows;
}

 test('[baseline] real old-worker completion retains its selectable option', async () => {
  await requireLean(db);
  const f = await olOperation(db), option = await completeOL(db, f);
  await setActor(db, f.ownerId); const choices = await scalar(db, readSql(f));
  assert.equal(choices.rows.length, 1); assert.equal(choices.rows[0].optionId, option.optionId);
  assert.equal(choices.rows[0].metadata.title, f.facts.title);
});

test('AC7-2d: companion relation has the fixed private lineage columns and delete actions', async () => {
  await requireM84(db, companions);
  const present = new Map((await columns(companions)).map(c => [c.attname, c.attnotnull]));
  for (const name of ['id','lookup_id','attempt_id','candidate_id','store_id','session_id','provider_record_id',
    'payload_version','metadata_digest','companion','created_at']) assert.ok(present.has(name), name + ' exists');
  for (const name of ['id','candidate_id','store_id','session_id']) assert.equal(present.get(name), true, name + ' is nonnull');
  assert.equal(present.get('option_id'), false);
  const edges = await fks(companions);
  for (const [name,target,action] of [['lookup_id','public.phase9_metadata_lookups','c'],
    ['attempt_id','public.metadata_enrichment_attempts','c'],['candidate_id','public.image_extraction_candidates','a'],
    ['store_id','public.stores','a'],['session_id','public.image_extraction_sessions','a']])
    assert.ok(edges.some(e => e.attname === name && e.target === target && e.confdeltype === action), name + ' FK');
  const indexes = (await db.query(`SELECT pg_get_indexdef(i.indexrelid) AS definition,
    pg_get_expr(i.indpred,i.indrelid) AS predicate FROM pg_index i
    WHERE i.indrelid=to_regclass($1) AND i.indisunique AND i.indpred IS NOT NULL`, [companions])).rows;
  assert.ok(indexes.some(i => /\(lookup_id,\s*attempt_id,\s*option_id\)/i.test(i.definition)
    && /option_id IS NOT NULL/i.test(i.predicate)), 'explicit options have a partial unique binding');
  assert.ok(indexes.some(i => /\(lookup_id,\s*attempt_id,\s*provider_record_id\)/i.test(i.definition)
    && /option_id IS NULL/i.test(i.predicate)), 'automatic results have a separate partial unique binding');
});

test('AC7-2d/12: lookup effects contain durable scoped receipts and nullable cache columns', async () => {
  await requireM84(db, effects);
  const present = new Map((await columns(effects)).map(c => [c.attname, c.attnotnull]));
  for (const name of ['lookup_id','candidate_id','store_id','session_id','request_generation','completion_digest',
    'canonical_results','search_counted','completion_response','completed_at']) assert.ok(present.has(name), name + ' exists');
  for (const name of ['lookup_id','candidate_id','store_id','session_id','search_counted']) assert.equal(present.get(name), true, name + ' is nonnull');
  for (const name of ['searched_work_id','cache_entry_id','cache_payload_digest']) assert.equal(present.get(name), false, name + ' is nullable');
  const edges = await fks(effects);
  for (const [name,target,action] of [['lookup_id','public.phase9_metadata_lookups','c'],
    ['searched_work_id','public.canonical_works','n'],['cache_entry_id','public.phase9_metadata_cache_entries','n']])
    assert.ok(edges.some(e => e.attname === name && e.target === target && e.confdeltype === action), name + ' FK');
  const pk = (await db.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid=to_regclass($1) AND contype='p'`, [effects])).rows;
  assert.equal(pk.length, 1); assert.match(pk[0].definition, /PRIMARY KEY\s*\(lookup_id\)/i);
});

for (const table of [companions, effects]) test(`AC7-8: ${table} is postgres-owned with RLS and no API grants`, async () => {
  await requireM84(db, table);
  const info = (await db.query(`SELECT relrowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class
    WHERE oid=to_regclass($1)`, [table])).rows[0];
  assert.deepEqual(info, { relrowsecurity: true, owner: 'postgres' });
  for (const role of ['anon','authenticated','service_role']) for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) {
    const allowed = (await db.query('SELECT has_table_privilege($1,to_regclass($2),$3) AS allowed', [role,table,privilege])).rows[0].allowed;
    assert.equal(allowed, false, `${role} must not hold ${privilege}`);
  }
  for (const role of ['anon','authenticated','service_role']) await asRole(db, role, '', async () => {
    await assert.rejects(() => db.query(`SELECT * FROM ${table} LIMIT 1`), error => error.code === '42501');
  });
});

test('AC7-8/20: companion validator is private and v2 entry points are service-only', async () => {
  await requireM84(db, validator);
  const signatures = [validator, 'marketplace_sec.phase9_complete_candidate_edition_options_v2' + completionTypes,
    'public.phase9_complete_candidate_edition_options_v2' + completionTypes];
  for (const signature of signatures) await requireM84(db, signature);
  for (const [index,signature] of signatures.entries()) for (const role of ['anon','authenticated','service_role']) {
    const canExecute = (await db.query(`SELECT has_function_privilege($1,to_regprocedure($2),'EXECUTE') AS allowed`,
      [role,signature])).rows[0].allowed;
    assert.equal(canExecute, index > 0 && role === 'service_role', signature + ' ' + role);
  }
});

test('AC7-8/20: API roles cannot call the private validator or unauthorized v2 wrapper', async () => {
  await requireM84(db,validator);
  await requireM84(db,'public.phase9_complete_candidate_edition_options_v2' + completionTypes);
  for (const role of ['anon','authenticated','service_role']) await asRole(db,role,'',async () => {
    await assert.rejects(() => db.query(`SELECT marketplace_sec.phase9_catalogue_valid_companion_v1('{}'::jsonb,'{}'::jsonb,NULL)`),
      error => error.code === '42501');
    if (role !== 'service_role') await assert.rejects(() => db.query(
      `SELECT public.phase9_complete_candidate_edition_options_v2(${Array(17).fill('NULL').join(',')})`),
    error => error.code === '42501');
  });
});

test('AC7-2d/2f: strict companion accepts a matching real option and exact OCLC/LCCN', async () => {
  await requireM84(db, validator);
  const { m, optionId, companion } = await envelope();
  assert.equal(await valid(companion, m, optionId), true);
});

const invalidCases = [
  ['unknown key', c => ({ ...c, extra: 'forged' })],
  ['wrong version', c => ({ ...c, version: 'psr-catalogue-write-v2' })],
  ['wrong option', c => ({ ...c, optionId: randomUUID() })],
  ['wrong adapter', c => ({ ...c, adapterKey: 'google_books' })],
  ['wrong adapter version', c => ({ ...c, adapterVersion: 'different' })],
  ['wrong normalizer version', c => ({ ...c, normalizerVersion: 'different' })],
  ['wrong lookup', c => ({ ...c, lookupId: randomUUID() })],
  ['wrong attempt', c => ({ ...c, attemptId: randomUUID() })],
  ['wrong record binding', c => ({ ...c, providerRecordId: 'OL101M' })],
  ['oversize record ID', c => ({ ...c, providerRecordId: 'X'.repeat(257) })],
  ['oversize work ID', c => ({ ...c, workExternalId: 'X'.repeat(257) })],
  ['wrong fetched instant', c => ({ ...c, fetchedAt: '2000-01-01T00:00:00Z' })],
  ['OCLC non-string', c => ({ ...c, oclc: 123 })],
  ['OCLC malformed scalar', c => ({ ...c, oclc: '12-3' })],
  ['OCLC too long', c => ({ ...c, oclc: '1'.repeat(65) })],
  ['LCCN malformed scalar', c => ({ ...c, lccn: 'n<script>' })],
  ['LCCN too long', c => ({ ...c, lccn: 'a'.repeat(65) })],
];
for (const [name, mutate] of invalidCases) test(`AC7-2d/2f: companion rejects ${name}`, async () => {
  await requireM84(db, validator);
  const { m, optionId, companion } = await envelope();
  assert.equal(await valid(companion, m, optionId), true, 'matching fixture must be accepted before mutation');
  const changed = mutate(companion);
  // Test the length bound itself, rather than accidentally passing only
  // because the metadata and companion contain different record IDs.
  const changedMetadata = name === 'oversize record ID' ? { ...m, providerRecordId:changed.providerRecordId } : m;
  assert.equal(await valid(changed, changedMetadata, optionId), false, name + ' must be rejected');
});
