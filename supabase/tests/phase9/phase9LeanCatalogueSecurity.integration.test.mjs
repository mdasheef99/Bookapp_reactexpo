// 02b §§4/5/9/11/12/14 decision 6: effective 7a ACL/RLS, disposable role probes only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { asRole, createLeanDatabase, operatorId, requireLean } from './leanCatalogueFixture.mjs';
import { resetActor, scalar, seedIncumbent } from './catalogueLinkFixture.mjs';
let db, target, sourceId;
const nonoperatorId = '70000000-0000-4000-8000-000000000002';
const actors = [
  { label: 'anon', role: 'anon', id: null },
  { label: 'authenticated non-operator', role: 'authenticated', id: nonoperatorId },
  { label: 'authenticated platform operator', role: 'authenticated', id: operatorId },
  { label: 'service_role', role: 'service_role', id: nonoperatorId },
];
const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
const tables = [
  { name: 'public.canonical_provider_ids', update: 'external_id=external_id', read: ['authenticated', 'service_role'] },
  { name: 'public.canonical_work_stats', update: 'times_searched=times_searched', read: ['service_role'] },
  { name: 'public.canonical_edition_stats', update: 'times_added=times_added', read: ['service_role'] },
  { name: 'marketplace_sec.phase9_catalogue_choice_effects', update: 'counted=counted', read: [] },
  { name: 'marketplace_sec.phase9_catalogue_isbn_blocklist', update: 'reason=reason', read: [] },
];
before(async () => { db = await createLeanDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  target = await seedIncumbent(db); sourceId = randomUUID();
  await db.query(`INSERT INTO public.book_metadata_sources(id,canonical_edition_id,provider,provider_book_id,
    adapter_key,adapter_version,schema_version,request_status,raw_payload,normalized_payload)
    VALUES($1,$2,'open_library','OL100M','open_library','1.0.0','p9-metadata-v1','completed','{}','{}')`,
  [sourceId, target.editionId]);
});
after(async () => { await db?.close(); });
async function effective(table, roles, allowed = {}) {
  await resetActor(db);
  for (const role of roles) for (const privilege of privileges) {
    const actual = (await db.query('SELECT has_table_privilege($1,$2,$3) AS granted', [role, table, privilege])).rows[0].granted;
    assert.equal(actual, (allowed[role] ?? []).includes(privilege), `${role} ${privilege} on ${table}`);
  }
  const acl = (await db.query(`SELECT a.grantee,a.privilege_type FROM pg_class c
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=$1::regclass`, [table])).rows;
  assert.equal(acl.some(a => a.grantee === 0), false, `${table} must have no PUBLIC table privilege`);
  for (const role of roles) {
    const oid = await scalar(db, `SELECT oid FROM pg_roles WHERE rolname='${role}'`);
    assert.deepEqual(acl.filter(a => a.grantee === oid).map(a => a.privilege_type).sort(),
      [...(allowed[role] ?? [])].sort(), `${table} explicit ACL for ${role}, including REFERENCES/TRIGGER/MAINTAIN`);
  }
}
async function deny(actor, sql, values = []) {
  // Roll back even an unexpectedly permitted destructive command before asserting.
  let error;
  await asRole(db, actor.role, actor.id, async () => {
    assert.equal(await scalar(db, 'SELECT current_user'), actor.role, 'probe must execute under actual SET ROLE');
    await db.exec('BEGIN');
    try { await db.query(sql, values); } catch (caught) { error = caught; }
    finally { await db.exec('ROLLBACK'); }
  });
  assert.equal(error?.code, '42501', `${actor.label} must receive permission denial: ${sql}`);
}
async function seedReadable(table) {
  await resetActor(db);
  if (table.endsWith('canonical_provider_ids')) await db.query(`INSERT INTO public.canonical_provider_ids
    (adapter_key,id_kind,external_id,canonical_edition_id) VALUES('open_library','edition','OL100M',$1)`, [target.editionId]);
  if (table.endsWith('canonical_work_stats')) await db.query('INSERT INTO public.canonical_work_stats(canonical_work_id) VALUES($1)', [target.workId]);
  if (table.endsWith('canonical_edition_stats')) await db.query('INSERT INTO public.canonical_edition_stats(canonical_edition_id) VALUES($1)', [target.editionId]);
}

for (const table of tables) test('AC7-8: ' + table.name + ' has exact least-privilege ACL and RLS', async () => {
  await requireLean(db, table.name);
  const allowed = Object.fromEntries(['anon', 'authenticated', 'service_role'].map(role => [role, table.read.includes(role) ? ['SELECT'] : []]));
  await effective(table.name, ['anon', 'authenticated', 'service_role'], allowed);
  const c = (await db.query(`SELECT relrowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid=$1::regclass`, [table.name])).rows[0];
  assert.deepEqual(c, { relrowsecurity: true, owner: 'postgres' });
  const policies = (await db.query('SELECT cmd,roles,qual,with_check FROM pg_policies WHERE schemaname=$1 AND tablename=$2', table.name.split('.'))).rows;
  if (table.name.endsWith('canonical_provider_ids')) {
    assert.equal(policies.length, 1); assert.equal(policies[0].cmd, 'SELECT');
    assert.deepEqual(policies[0].roles, ['authenticated']); assert.equal(policies[0].qual, 'true');
    assert.equal(policies[0].with_check, null);
  } else assert.deepEqual(policies, [], 'server-only/private tables must have no client policy');
});

for (const table of tables) for (const actor of actors) {
  test('AC7-8: ' + actor.label + ' actual reads/writes obey ' + table.name + ' boundary', async () => {
    await requireLean(db, table.name); await seedReadable(table.name);
    if (table.read.includes(actor.role)) {
      const count = await asRole(db, actor.role, actor.id, () => scalar(db, 'SELECT count(*)::int FROM ' + table.name));
      assert.equal(count, 1, 'authorized read must return a seeded row');
    } else await deny(actor, 'SELECT * FROM ' + table.name);
    for (const sql of [
      `INSERT INTO ${table.name} DEFAULT VALUES`, `UPDATE ${table.name} SET ${table.update}`,
      `DELETE FROM ${table.name}`, `TRUNCATE ${table.name}`,
    ]) await deny(actor, sql);
  });
}

const privateFunctions = [
  ['phase9_catalogue_isbn_v1(text,text)', "NULL::text,NULL::text", 's', true],
  ['phase9_catalogue_identity_lock_key_v1(text,jsonb)', "'work','[\"catalogue sample\",[\"a. author\",\"b. author\"]]'::jsonb", 'i', false],
  ['phase9_catalogue_shared_admitted_v1(text)', "'open_library'", 's', true],
  ['phase9_catalogue_source_policy_v1(text)', "'open_library'", 'v', true],
  ['phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)', "'open_library','OL100M',NULL::text,NULL::text,NULL::text,NULL::jsonb", 'i', false],
  ['phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb)', "'{}'::jsonb,NULL::jsonb,'{}'::jsonb", 'v', true],
  ['phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)', 'NULL::uuid,NULL::uuid,NULL::uuid', 'v', true],
  ['phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer)', 'NULL::uuid,NULL::uuid,0,0,0', 'v', true],
  ['phase9_catalogue_count_choice_v1(uuid,uuid,text,uuid,uuid)', "NULL::uuid,NULL::uuid,repeat('0',64),NULL::uuid,NULL::uuid", 'v', true],
  ['phase9_edition_local_match(image_extraction_candidates)', 'NULL::public.image_extraction_candidates', 's', true],
  ['phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)',
    'NULL::uuid,NULL::uuid,1,1,1,NULL::text,1,NULL::uuid,NULL::uuid,NULL::text,NULL::uuid', 'v', true],
];
for (const [name, args, volatility, definer] of privateFunctions) test('AC7-8: private ' + name + ' has no API EXECUTE', async () => {
  await requireLean(db); // Existing M81 helper becomes a 7a replacement; require the new core first.
  const signature = 'marketplace_sec.' + name; await requireLean(db, signature); await resetActor(db);
  const fn = (await db.query(`SELECT pg_get_userbyid(proowner) AS owner,prosecdef,provolatile,proconfig
    FROM pg_proc WHERE oid=$1::regprocedure`, [signature])).rows[0];
  assert.equal(fn.owner, 'postgres'); assert.equal(fn.prosecdef, definer); assert.equal(fn.provolatile, volatility);
  assert.ok(fn.proconfig?.includes('search_path=""'), 'private function must have explicit empty search_path');
  assert.deepEqual((await db.query(`SELECT a.privilege_type FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=$1::regprocedure AND a.grantee<>p.proowner`, [signature])).rows, [], 'no PUBLIC or other non-owner EXECUTE');
  for (const actor of actors) {
    assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS granted', [actor.role, signature])).rows[0].granted, false);
    await deny(actor, 'SELECT * FROM marketplace_sec.' + name.split('(')[0] + '(' + args + ')');
  }
});

for (const name of [
  'phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)',
  'phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)',
]) test('AC7-8: public ' + name + ' retains only authenticated command execution', async () => {
  await requireLean(db); await resetActor(db);
  const signature = 'public.' + name;
  const fn = (await db.query(`SELECT pg_get_userbyid(proowner) AS owner,prosecdef,proconfig
    FROM pg_proc WHERE oid=$1::regprocedure`, [signature])).rows[0];
  assert.equal(fn.owner, 'postgres'); assert.equal(fn.prosecdef, true);
  assert.ok(fn.proconfig?.includes('search_path=""'));
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS granted", [role, signature])).rows[0].granted,
      role === 'authenticated');
  }
  const acl = (await db.query(`SELECT pg_get_userbyid(a.grantee) AS role,a.privilege_type FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=$1::regprocedure AND a.grantee<>p.proowner`, [signature])).rows;
  assert.deepEqual(acl, [{ role: 'authenticated', privilege_type: 'EXECUTE' }]);
});

test('AC7-8: additive canonical columns follow existing public reads; registry note stays service-readable', async () => {
  await requireLean(db); await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public'
    AND table_name='phase9_provider_registry' AND column_name='shared_source_note'`), 1);
  for (const actor of actors.filter(a => a.role !== 'service_role')) {
    const rows = await asRole(db, actor.role, actor.id, () => db.query(`SELECT e.hidden,e.oclc,e.lccn,
      e.source_retention_note,e.normalizer_version,w.normalizer_version AS work_normalizer
      FROM public.canonical_editions e JOIN public.canonical_works w ON w.id=e.work_id`));
    assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].hidden, false);
  }
  const note = await asRole(db, 'service_role', nonoperatorId, () => scalar(db,
    "SELECT shared_source_note FROM public.phase9_provider_registry WHERE adapter_key='open_library'"));
  assert.equal(typeof note, 'string'); assert.ok(note.length > 0);
});

test('AC7-28: metadata source ACL removes every direct write and replaces the exact live ALL policy', async () => {
  await effective('public.book_metadata_sources', ['anon', 'authenticated', 'service_role'], {
    anon: ['SELECT'], authenticated: ['SELECT'], service_role: ['SELECT'],
  });
  const policies = (await db.query(`SELECT policyname,cmd,roles,qual,with_check FROM pg_policies
    WHERE schemaname='public' AND tablename='book_metadata_sources'`)).rows;
  assert.equal(policies.length, 1);
  assert.deepEqual(policies[0], { policyname: 'metadata sources platform read', cmd: 'SELECT',
    roles: ['authenticated'], qual: 'marketplace_sec.is_platform_operator()', with_check: null });
});

for (const actor of actors) test('AC7-28: ' + actor.label + ' cannot directly mutate metadata sources', async () => {
  // This explicit ACL assertion is RED for the baseline live-style broad grants.
  const insert = (await db.query("SELECT has_table_privilege($1,'public.book_metadata_sources','INSERT') AS granted", [actor.role])).rows[0].granted;
  assert.equal(insert, false, '7a must revoke source INSERT before relying on RLS');
  for (const [sql, values] of [
    ["INSERT INTO public.book_metadata_sources(id,provider,provider_book_id) VALUES($1,'open_library','OL101M')", [randomUUID()]],
    ["UPDATE public.book_metadata_sources SET provider_book_id='OL101M' WHERE id=$1", [sourceId]],
    ['DELETE FROM public.book_metadata_sources WHERE id=$1', [sourceId]],
    ['TRUNCATE public.book_metadata_sources', []],
  ]) await deny(actor, sql, values);
});

test('AC7-28: operator/service source reads survive; non-operator and anon still see no rows', async () => {
  const policy = await scalar(db, `SELECT count(*)::int FROM pg_policies WHERE schemaname='public'
    AND tablename='book_metadata_sources' AND policyname='metadata sources platform read' AND cmd='SELECT'`);
  assert.equal(policy, 1, 'approved SELECT-only replacement must exist before read-preservation proof');
  for (const actor of actors) {
    const result = await asRole(db, actor.role, actor.id, async () => {
      assert.equal(await scalar(db, 'SELECT current_user'), actor.role);
      return (await db.query('SELECT id FROM public.book_metadata_sources')).rows;
    });
    const allowed = actor.id === operatorId || actor.role === 'service_role';
    assert.deepEqual(result.map(r => r.id), allowed ? [sourceId] : []);
  }
});

for (const table of ['canonical_works', 'canonical_editions']) test('[baseline] AC7-8: canonical clients retain SELECT only on ' + table, async () => {
  await effective('public.' + table, ['anon', 'authenticated'], { anon: ['SELECT'], authenticated: ['SELECT'] });
  for (const actor of actors.filter(a => a.role !== 'service_role')) {
    assert.equal(await asRole(db, actor.role, actor.id, () => scalar(db, 'SELECT count(*)::int FROM public.' + table)), 1);
    for (const sql of [`INSERT INTO public.${table} DEFAULT VALUES`, `UPDATE public.${table} SET id=id`,
      `DELETE FROM public.${table}`, `TRUNCATE public.${table}`]) await deny(actor, sql);
  }
});
