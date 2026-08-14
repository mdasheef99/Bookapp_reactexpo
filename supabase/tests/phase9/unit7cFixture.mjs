import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  createUnit7bDatabase, seedPublicationInventory, setPublication,
} from './unit7bFixture.mjs';

export const M41 = '20260813000041_marketplace_phase9_unit7a_quality_handoff.sql';
export const M42 = '20260814000042_marketplace_phase9_generated_authors_projection.sql';
export const M43 = '20260814000043_marketplace_phase9_unit7c_inventory_management.sql';
export const M44 = '20260814000044_marketplace_phase9_store_view_filter_contract.sql';

export async function createUnit7cDatabase() {
  const db = await createUnit7bDatabase();
  await db.exec(fs.readFileSync(migrationPath(M41), 'utf8'));
  await db.exec(`
    CREATE OR REPLACE FUNCTION public.marketplace_authors_text(p_authors text[])
    RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
      SELECT array_to_string(COALESCE(p_authors, '{}'::text[]), ' ')
    $$;
    ALTER TABLE public.marketplace_book_listings DROP COLUMN authors_text;
    ALTER TABLE public.marketplace_book_listings
      ADD COLUMN authors_text text GENERATED ALWAYS AS (
        public.marketplace_authors_text(public_authors)
      ) STORED;
  `);
  await db.exec(fs.readFileSync(migrationPath(M42), 'utf8'));
  if (process.env.PHASE9_UNIT7C_PRE_MIGRATION !== '1') {
    // The disposable Phase 6 snapshot predates the live event-source column.
    // Add only that production column before exercising the real M43 path.
    await db.exec(`ALTER TABLE public.marketplace_events ADD COLUMN IF NOT EXISTS
      source text NOT NULL DEFAULT 'system_job'`);
    await db.exec(fs.readFileSync(migrationPath(M43), 'utf8'));
    if (fs.existsSync(migrationPath(M44))) {
      await db.exec(fs.readFileSync(migrationPath(M44), 'utf8'));
    }
  }
  return db;
}

export async function seedUnit7cInventory(db, overrides = {}) {
  return seedPublicationInventory(db, {
    quantityTotal: 3,
    quantityAvailable: 3,
    ...overrides,
  });
}

export async function publishInventory(db, fixture, overrides = {}) {
  return setPublication(db, fixture, {
    commandId: overrides.commandId ?? randomUUID(),
    idempotencyKey: overrides.idempotencyKey ?? `u7c-publish-${randomUUID()}`,
    ...overrides,
  });
}

export function saveSql(fixture, changes, overrides = {}) {
  return `SELECT public.phase9_update_store_inventory_details_v1(
    '${overrides.inventoryId ?? fixture.inventoryId}',
    ${overrides.inventoryVersion ?? 1},
    '${sqlJson(changes)}'::jsonb,
    '${overrides.idempotencyKey ?? `u7c-save-${randomUUID()}`}',
    '${overrides.commandId ?? randomUUID()}'
  )`;
}

export async function saveDetails(db, fixture, changes, overrides = {}) {
  return scalar(db, saveSql(fixture, changes, overrides));
}

export function stockSql(fixture, delta, overrides = {}) {
  return `SELECT public.phase9_adjust_inventory_stock_v2(
    '${overrides.inventoryId ?? fixture.inventoryId}',
    ${overrides.inventoryVersion ?? 1},${delta},
    '${overrides.idempotencyKey ?? `u7c-stock-${randomUUID()}`}',
    '${overrides.commandId ?? randomUUID()}'
  )`;
}

export async function adjustStock(db, fixture, delta, overrides = {}) {
  return scalar(db, stockSql(fixture, delta, overrides));
}

export async function unit7cState(db, fixture) {
  await resetActor(db);
  const inventory = (await db.query(`SELECT * FROM public.store_inventory
    WHERE id='${fixture.inventoryId}'`)).rows[0];
  const listings = (await db.query(`SELECT * FROM public.marketplace_book_listings
    WHERE inventory_id='${fixture.inventoryId}'`)).rows;
  const revisions = (await db.query(`SELECT * FROM public.phase9_publication_revisions
    WHERE inventory_id='${fixture.inventoryId}' ORDER BY revision_number`)).rows;
  const effects = (await db.query(`SELECT
    (SELECT count(*)::int FROM public.marketplace_audit_logs
      WHERE entity_id='${fixture.inventoryId}') audits,
    (SELECT count(*)::int FROM public.marketplace_events
      WHERE entity_id='${fixture.inventoryId}') events`)).rows[0];
  await setActor(db, fixture.ownerId);
  return { inventory, listings, revisions, ...effects };
}

export async function storeViewPage(db, pageSize = 20, cursor = null) {
  return scalar(db, `SELECT public.phase9_store_view_page_v1(
    ${pageSize},${cursor == null ? 'NULL' : `'${sql(cursor)}'`})`);
}

export async function storeViewPageV2(db, pageSize = 20, cursor = null, filter = 'all') {
  return scalar(db, `SELECT public.phase9_store_view_page_v2(
    ${pageSize},${cursor == null ? 'NULL' : `'${sql(cursor)}'`},'${sql(filter)}')`);
}

export async function storeViewDetail(db, inventoryId) {
  return scalar(db, `SELECT public.phase9_store_view_detail_v1('${inventoryId}')`);
}

function sqlJson(value) { return JSON.stringify(value).replaceAll("'", "''"); }
function sql(value) { return String(value).replaceAll("'", "''"); }
