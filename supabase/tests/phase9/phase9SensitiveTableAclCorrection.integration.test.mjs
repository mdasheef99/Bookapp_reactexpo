import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import {
  createPhase9Database, migrationPath, resetActor, scalar,
} from './databaseHarness.mjs';

const migration = '20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql';
const tables = [
  'vision_provider_attempts',
  'phase9_metadata_lookups',
  'phase9_metadata_cache_entries',
  'phase9_selected_metadata_snapshots',
];
const mutationPrivileges = [
  'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER',
];
const publicRpcs = [
  'claim_phase9_metadata_jobs',
  'phase9_associate_vision_provider_attempt',
  'phase9_complete_local_metadata_match',
  'phase9_finalize_metadata_attempt',
  'phase9_finalize_vision_provider_attempt',
  'phase9_invalidate_metadata_cache',
  'phase9_mark_vision_provider_attempt',
  'phase9_register_metadata_attempt',
  'phase9_register_metadata_lookup',
  'phase9_register_vision_provider_attempt',
  'phase9_select_metadata_snapshot',
  'phase9_store_metadata_cache',
  'phase9_validate_vision_provider_egress',
];
let db;

before(async () => {
  db = await createPhase9Database();
});
after(async () => db.close());

test('M16 removes effective service-role mutation while retaining service-only SELECT', async () => {
  await resetActor(db);
  await db.exec(`GRANT ALL PRIVILEGES ON TABLE ${tables.map((name) => `public.${name}`).join(',')}
    TO service_role`);

  for (const table of tables) {
    assert.equal(await scalar(db, `SELECT has_table_privilege(
      'service_role','public.${table}','SELECT')`), true);
    for (const privilege of mutationPrivileges) {
      assert.equal(await scalar(db, `SELECT has_table_privilege(
        'service_role','public.${table}','${privilege}')`), true);
    }
  }

  await db.exec(fs.readFileSync(migrationPath(migration), 'utf8'));

  for (const table of tables) {
    assert.equal(await scalar(db, `SELECT has_table_privilege(
      'service_role','public.${table}','SELECT')`), true);
    for (const privilege of mutationPrivileges) {
      assert.equal(await scalar(db, `SELECT has_table_privilege(
        'service_role','public.${table}','${privilege}')`), false);
    }
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', ...mutationPrivileges]) {
        assert.equal(await scalar(db, `SELECT has_table_privilege(
          '${role}','public.${table}','${privilege}')`), false);
      }
    }
    assert.equal(await scalar(db, `SELECT relrowsecurity FROM pg_class
      WHERE oid='public.${table}'::regclass`), true);
    assert.equal(await scalar(db, `SELECT pg_get_userbyid(relowner) FROM pg_class
      WHERE oid='public.${table}'::regclass`), 'postgres');
  }
});

test('M14 and M15 RPC execution and fixed search paths survive table revocation', async () => {
  const rows = (await db.query(`SELECT p.proname,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
      p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY($1::text[])
    ORDER BY p.proname`, [publicRpcs])).rows;
  assert.equal(rows.length, publicRpcs.length);
  for (const row of rows) {
    assert.equal(row.service_execute, true);
    assert.equal(row.anon_execute, false);
    assert.equal(row.authenticated_execute, false);
    assert.deepEqual(row.proconfig, ['search_path=""']);
  }
});
