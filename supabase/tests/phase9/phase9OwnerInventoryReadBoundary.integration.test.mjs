import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { createPhase9Database, scalar, setActor, resetActor } from './databaseHarness.mjs';

const migrationName = '20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql';
const DRAFT_PATH = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
const STORE = '96000000-0000-0000-0000-000000000001';
const OTHER_STORE = '96000000-0000-0000-0000-000000000002';
const OWNER = '97000000-0000-0000-0000-000000000001';
const OTHER_OWNER = '97000000-0000-0000-0000-000000000002';

async function applyDraft(db) {
  // The compact PGlite Phase 6 baseline predates these Phase 4 inventory
  // columns. Add only the live-schema fields this read contract projects so
  // local behavior tests exercise the function body rather than a fixture gap.
  await db.exec(`
    ALTER TABLE public.store_inventory
      ADD COLUMN IF NOT EXISTS public_notes text,
      ADD COLUMN IF NOT EXISTS listing_quality_status text NOT NULL DEFAULT 'ready',
      ADD COLUMN IF NOT EXISTS entry_method text NOT NULL DEFAULT 'manual';
  `);
  await db.exec(fs.readFileSync(DRAFT_PATH, 'utf8'));
}

async function seedOwnerInventory(db) {
  await db.exec(`
    INSERT INTO public.stores(id,display_name,status,setup_status,selling_status)
    VALUES
      ('${STORE}','Owner Store','active','complete','allowed'),
      ('${OTHER_STORE}','Other Store','active','complete','allowed');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES
      ('${STORE}','${OWNER}','owner','active'),
      ('${OTHER_STORE}','${OTHER_OWNER}','owner','active');
    INSERT INTO public.store_inventory(
      id,store_id,title,authors,condition,selling_price_minor,quantity_total,
      quantity_available,visibility_status,publication_status,created_by,
      entry_method,listing_quality_status,created_at,updated_at
    ) VALUES
      ('98000000-0000-0000-0000-000000000001','${STORE}','Book 1',ARRAY['Author 1'],
        'good',100,1,1,'draft','private','${OWNER}','manual','ready',
        '2026-08-01T00:00:00Z','2026-08-01T00:00:00Z'),
      ('98000000-0000-0000-0000-000000000002','${STORE}','Book 2',ARRAY['Author 2'],
        'good',200,2,2,'draft','private','${OWNER}','image_extraction','ready',
        '2026-08-01T00:00:00Z','2026-08-01T00:00:00Z'),
      ('98000000-0000-0000-0000-000000000003','${STORE}','Book 3',ARRAY['Author 3'],
        'good',300,1,1,'draft','private','${OWNER}','metadata_import','ready',
        '2026-08-01T00:00:00Z','2026-08-01T00:00:00Z'),
      ('98000000-0000-0000-0000-000000000004','${OTHER_STORE}','Other Book',ARRAY['Other Author'],
        'good',400,1,1,'draft','private','${OTHER_OWNER}','manual','ready',
        '2026-08-01T00:00:00Z','2026-08-01T00:00:00Z');
  `);
}

test('WU1 forward draft parses locally without changing the stable detail RPC', async () => {
  const db = await createPhase9Database({
    throughMigration: '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
  });

  try {
    await applyDraft(db);

    const functions = await db.query(`
      SELECT p.oid::regprocedure::text AS signature,
        p.prosecdef AS security_definer,
        pg_get_function_result(p.oid)::text AS result_type,
        coalesce(array_to_string(p.proconfig, ','), '') AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname IN ('phase9_owner_inventory', 'phase9_owner_inventory_page_v1')
      ORDER BY signature
    `);
    assert.deepEqual(functions.rows.map((row) => row.signature), [
      'phase9_owner_inventory(uuid)',
      'phase9_owner_inventory_page_v1(integer,text,text,text,text,text,text,text)',
    ]);
    assert.equal(functions.rows[0].security_definer, true);
    assert.equal(functions.rows[0].result_type, 'jsonb');
    assert.equal(functions.rows[1].security_definer, true);
    assert.equal(functions.rows[1].result_type, 'jsonb');
    assert.equal(functions.rows[1].config, 'search_path=""');

    const indexes = await db.query(`
      SELECT indexdef::text
      FROM pg_indexes
      WHERE schemaname='public'
        AND indexname='store_inventory_owner_read_page_idx'
    `);
    assert.equal(indexes.rows.length, 1);
    assert.match(indexes.rows[0].indexdef, /\(store_id, updated_at DESC, id DESC\)/u);

    const stableDetail = await db.query(`
      SELECT pg_get_functiondef(p.oid)::text AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname='phase9_owner_inventory'
    `);
    assert.match(stableDetail.rows[0].definition, /'publication_status'/u);
    assert.match(stableDetail.rows[0].definition, /'quantity_total'/u);
    assert.doesNotMatch(stableDetail.rows[0].definition, /phase9_owner_inventory_page_v1/iu);
  } finally {
    await db.close();
  }
});

test('local execution covers deterministic pagination, filters, empty results, and owner scope', async () => {
  const db = await createPhase9Database({
    throughMigration: '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
  });

  try {
    await applyDraft(db);
    await seedOwnerInventory(db);
    await setActor(db, OWNER);

    const first = await scalar(db,
      'SELECT public.phase9_owner_inventory_page_v1(1,NULL,NULL,NULL,NULL,NULL,NULL,NULL)');
    assert.deepEqual(first.items.map((item) => item.id), [
      '98000000-0000-0000-0000-000000000003',
    ]);
    assert.equal(first.pageInfo.hasMore, true);
    assert.ok(first.pageInfo.nextCursor);

    const second = await scalar(db,
      `SELECT public.phase9_owner_inventory_page_v1(1,'${first.pageInfo.nextCursor}',NULL,NULL,NULL,NULL,NULL,NULL)`);
    assert.deepEqual(second.items.map((item) => item.id), [
      '98000000-0000-0000-0000-000000000002',
    ]);

    const third = await scalar(db,
      `SELECT public.phase9_owner_inventory_page_v1(1,'${second.pageInfo.nextCursor}',NULL,NULL,NULL,NULL,NULL,NULL)`);
    assert.deepEqual(third.items.map((item) => item.id), [
      '98000000-0000-0000-0000-000000000001',
    ]);
    assert.equal(third.pageInfo.hasMore, false);
    assert.equal(third.pageInfo.nextCursor, null);

    const filtered = await scalar(db,
      "SELECT public.phase9_owner_inventory_page_v1(50,NULL,'book 2',NULL,NULL,NULL,NULL,NULL)");
    assert.deepEqual(filtered.items.map((item) => item.id), [
      '98000000-0000-0000-0000-000000000002',
    ]);

    const empty = await scalar(db,
      "SELECT public.phase9_owner_inventory_page_v1(50,NULL,'no such book',NULL,NULL,NULL,NULL,NULL)");
    assert.deepEqual(empty, {
      contractVersion: 'phase9-owner-inventory-v1',
      items: [],
      pageInfo: { nextCursor: null, hasMore: false },
    });

    await assert.rejects(
      db.query('SELECT public.phase9_owner_inventory_page_v1(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)'),
      /P9_REQUEST_INVALID/,
    );
    await assert.rejects(
      db.query("SELECT public.phase9_owner_inventory_page_v1(50,NULL,NULL,'unsupported',NULL,NULL,NULL,NULL)"),
      /P9_REQUEST_INVALID/,
    );
    await assert.rejects(
      db.query(`SELECT public.phase9_owner_inventory_page_v1(1,'${first.pageInfo.nextCursor}x',NULL,NULL,NULL,NULL,NULL,NULL)`),
      /P9_CURSOR_INVALID/,
    );

    await setActor(db, OTHER_OWNER);
    const otherStore = await scalar(db,
      'SELECT public.phase9_owner_inventory_page_v1(50,NULL,NULL,NULL,NULL,NULL,NULL,NULL)');
    assert.deepEqual(otherStore.items.map((item) => item.id), [
      '98000000-0000-0000-0000-000000000004',
    ]);

    await resetActor(db);
    await assert.rejects(
      db.query('SELECT public.phase9_owner_inventory_page_v1(50,NULL,NULL,NULL,NULL,NULL,NULL,NULL)'),
      /P9_AUTH_REQUIRED/,
    );
  } finally {
    await db.close();
  }
});

test('unexpected cursor-helper failures map to P9_INTERNAL_ERROR rather than P9_CURSOR_INVALID', async () => {
  const db = await createPhase9Database({
    throughMigration: '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
  });

  try {
    await applyDraft(db);
    await seedOwnerInventory(db);
    await setActor(db, OWNER);
    const first = await scalar(db,
      'SELECT public.phase9_owner_inventory_page_v1(1,NULL,NULL,NULL,NULL,NULL,NULL,NULL)');
    assert.ok(first.pageInfo.nextCursor);

    await resetActor(db);
    await db.exec(`CREATE OR REPLACE FUNCTION extensions.digest(value text, algorithm text)
      RETURNS bytea LANGUAGE plpgsql IMMUTABLE AS $$
      BEGIN RAISE EXCEPTION 'digest backend unavailable'; END;
      $$;`);
    await setActor(db, OWNER);

    await assert.rejects(
      db.query(`SELECT public.phase9_owner_inventory_page_v1(
        1,'${first.pageInfo.nextCursor}',NULL,NULL,NULL,NULL,NULL,NULL)`),
      /P9_INTERNAL_ERROR/,
    );
  } finally {
    await db.close();
  }
});
