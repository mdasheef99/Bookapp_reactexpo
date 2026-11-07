import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createSummaryDatabase } from './storeViewSummaryFixture.mjs';
import { seedUnit7cInventory, storeViewPageV2 } from './unit7cFixture.mjs';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';

const summary = db => scalar(db, 'SELECT public.phase9_store_view_summary_v1()');
const filters = { all: 'all', private: 'private', live: 'live', paused: 'paused', needsAttention: 'needs_attention', outOfStock: 'out_of_stock' };
const zeros = { counts: Object.fromEntries(Object.keys(filters).map(k => [k, 0])), availableStockValueMinor: '0' };
async function withDb(run) { const db = await createSummaryDatabase(); try { await run(db); } finally { await db.close(); } }
async function pageCount(db, filter) {
  let cursor = null; const ids = new Set(); let pages = 0;
  do {
    const page = await storeViewPageV2(db, 2, cursor, filter);
    for (const item of page.items) { assert.ok(!ids.has(item.identity.inventoryId)); ids.add(item.identity.inventoryId); }
    cursor = page.pageInfo.nextCursor;
    assert.ok(++pages < 100);
  } while (cursor);
  return ids.size;
}
test('summary matches all pages for every filter with overlaps, stale quality flags and timestamp ties', () => withDb(async db => {
  const root = await seedUnit7cInventory(db);
  const rows = [
    {}, { visibilityStatus: 'published', publicationStatus: 'published' },
    { visibilityStatus: 'paused' },
    { isSellable: false }, { quantityTotal: 0, quantityAvailable: 0 },
    { isSellable: false, quantityTotal: 0, quantityAvailable: 0 },
    { publicationStatus: 'publication_failed' },
    { publicationStatus: 'publication_failed', quantityTotal: 0, quantityAvailable: 0 },
    { hasDamage: true, damageTypes: ['torn'], damageNote: 'Torn page; no photo' },
    { qualityStatus: 'missing_price' },
    ...['missing_metadata', 'missing_condition', 'needs_photo'].map(qualityStatus => ({ qualityStatus })),
    { priceMinor: 0 },
  ];
  for (const options of rows) {
    await resetActor(db);
    const f = await seedUnit7cInventory(db, { ...root, ...options });
    // Stored quality flags can be stale independently of the current field values.
    if (options.qualityStatus) {
      await resetActor(db);
      await db.exec(`UPDATE public.store_inventory SET listing_quality_status='${options.qualityStatus}' WHERE id='${f.inventoryId}'`);
    }
  }
  const foreign = await seedUnit7cInventory(db);
  await resetActor(db);
  await db.exec(`UPDATE public.store_inventory SET updated_at='2026-10-30T00:00:00Z'`);
  await setActor(db, root.ownerId);
  const result = await summary(db);
  for (const [key, filter] of Object.entries(filters)) assert.equal(result.counts[key], await pageCount(db, filter), key);
  for (const count of Object.values(result.counts)) assert.ok(count > 0);
  assert.equal(result.counts.all, rows.length + 1);
  await setActor(db, foreign.ownerId);
  assert.equal((await summary(db)).counts.all, 1, 'foreign store is isolated');
  await resetActor(db);
  await db.exec(`UPDATE public.stores SET verification_status='rejected' WHERE id='${root.storeId}'`);
  await setActor(db, root.ownerId);
  const restricted = await summary(db);
  for (const [key, filter] of Object.entries(filters)) assert.equal(restricted.counts[key], await pageCount(db, filter), `policy ${key}`);
  assert.equal(restricted.counts.needsAttention, restricted.counts.all);
}));
test('numeric sum of three maximum integer prices and quantities is exact above bigint', () => withDb(async db => {
  const root = await seedUnit7cInventory(db, { priceMinor: 2147483647, quantityTotal: 2147483647, quantityAvailable: 2147483647 });
  for (const visibilityStatus of ['paused', 'published']) {
    await resetActor(db);
    await seedUnit7cInventory(db, { ...root, priceMinor: 2147483647, quantityTotal: 2147483647, quantityAvailable: 2147483647, visibilityStatus });
  }
  await resetActor(db);
  await setActor(db, root.ownerId);
  assert.equal((await summary(db)).availableStockValueMinor, '13835058042397261827');
}));
test('counts only mapped attention reasons, including moderation and stale ready metadata', () => withDb(async db => {
  const root = await seedUnit7cInventory(db);
  const moderated = await seedUnit7cInventory(db, {
    ...root, visibilityStatus: 'published', publicationStatus: 'published',
  });
  const staleReady = await seedUnit7cInventory(db, { ...root, title: ' ' });
  await resetActor(db);
  await db.exec(`UPDATE public.marketplace_book_listings SET moderation_status='rejected'
    WHERE inventory_id='${moderated.inventoryId}';
    UPDATE public.store_inventory SET listing_quality_status='ready'
    WHERE id='${staleReady.inventoryId}'`);
  await setActor(db, root.ownerId);
  const result = await summary(db);
  // 'metadata' is deliberately not mapped into attention by M43. A stale
  // ready flag with blank title therefore still counts as private, like the page.
  assert.deepEqual(result.counts, {
    all: 3, private: 2, live: 0, paused: 0, needsAttention: 1, outOfStock: 0,
  });
  for (const [key, filter] of Object.entries(filters))
    assert.equal(result.counts[key], await pageCount(db, filter), key);
}));
test('empty store is zeros; anonymous, non-owner and service_role cannot read', () => withDb(async db => {
  const root = await seedUnit7cInventory(db);
  await resetActor(db);
  await db.exec(`DELETE FROM public.store_inventory WHERE id='${root.inventoryId}'`);
  await setActor(db, root.ownerId);
  assert.deepEqual(await summary(db), zeros);
  await setActor(db, randomUUID());
  await assert.rejects(summary(db), /P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, '', 'authenticated');
  await assert.rejects(summary(db), /P9_AUTH_REQUIRED/);
  for (const role of ['anon', 'service_role']) {
    await setActor(db, root.ownerId, role);
    await assert.rejects(summary(db), /permission denied/);
  }
}));
test('readbacks enforce exact ACL, postgres owner, STABLE, definer, empty path and read-only execution', () => withDb(async db => {
  const root = await seedUnit7cInventory(db);
  await resetActor(db);
  const meta = (await db.query(`SELECT p.provolatile,p.prosecdef,p.proconfig,r.rolname,
    md5(pg_get_functiondef(p.oid)) AS md5,md5(p.prosrc) AS body_md5 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
    WHERE p.oid='public.phase9_store_view_summary_v1()'::regprocedure`)).rows[0];
  assert.equal(meta.provolatile, 's'); assert.equal(meta.prosecdef, true); assert.equal(meta.rolname, 'postgres');
  assert.deepEqual(meta.proconfig, ['search_path=""']); assert.match(meta.md5, /^[a-f0-9]{32}$/);
  console.log('summary function readback:', JSON.stringify(meta));
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(await scalar(db, `SELECT has_function_privilege('${role}','public.phase9_store_view_summary_v1()','EXECUTE')`), role === 'authenticated');
  const acl = (await db.query(`SELECT x.grantee::regrole::text AS role,x.privilege_type FROM pg_proc p,
    LATERAL aclexplode(p.proacl) x WHERE p.oid='public.phase9_store_view_summary_v1()'::regprocedure`)).rows;
  assert.deepEqual(acl.map(x => [x.role, x.privilege_type]).sort(), [['authenticated','EXECUTE'],['postgres','EXECUTE']]);
  await setActor(db, root.ownerId);
  await db.exec('BEGIN READ ONLY');
  assert.equal((await summary(db)).counts.all, 1);
  await db.exec('ROLLBACK');
}));
test('large seeded store measurement, without a cache', () => withDb(async db => {
  const root = await seedUnit7cInventory(db);
  await resetActor(db);
  // The fixture store carries the default active_listing_limit of 100, and the
  // listing sync trigger enforces that admission cap on every published insert
  // (phase9_publication_ineligibility returns 'active_listing_limit', which the
  // trigger rejects). A 2,001-book store needs a commensurate cap before the
  // 1200 live rows below can be seeded as genuinely live/published rows.
  await db.exec(`UPDATE public.store_entitlements SET limit_value=2000
    WHERE store_id='${root.storeId}' AND feature_key='active_listing_limit'`);
  // A representative mix: every group exercises the per-row publication
  // eligibility checks instead of defaulting to missing_metadata.
  const groups = [
    { count: 1200, visibilityStatus: 'published', publicationStatus: 'published', qualityStatus: 'ready', isSellable: true, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 3 },
    { count: 300, visibilityStatus: 'draft', publicationStatus: 'private', qualityStatus: 'ready', isSellable: true, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 3 },
    { count: 200, visibilityStatus: 'paused', publicationStatus: 'private', qualityStatus: 'ready', isSellable: true, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 3 },
    { count: 150, visibilityStatus: 'draft', publicationStatus: 'private', qualityStatus: 'ready', isSellable: true, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 0, quantitySold: 3 },
    { count: 50, visibilityStatus: 'draft', publicationStatus: 'private', qualityStatus: 'missing_price', isSellable: true, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 3 },
    { count: 50, visibilityStatus: 'draft', publicationStatus: 'private', qualityStatus: 'ready', isSellable: false, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 3 },
    { count: 50, visibilityStatus: 'draft', publicationStatus: 'publication_failed', qualityStatus: 'ready', isSellable: true, priceMinor: 17500, quantityTotal: 3, quantityAvailable: 3 },
  ];
  for (const group of groups) {
    await db.exec(`INSERT INTO public.store_inventory(id,store_id,title,authors,language,condition,selling_price_minor,
      quantity_total,quantity_available,quantity_sold,is_sellable,visibility_status,publication_status,listing_quality_status,
      entry_method,created_by)
      SELECT gen_random_uuid(),'${root.storeId}','Large fixture',ARRAY['Author'],'en','good',${group.priceMinor},
      ${group.quantityTotal},${group.quantityAvailable},${group.quantitySold ?? 0},${group.isSellable},
      '${group.visibilityStatus}','${group.publicationStatus}','${group.qualityStatus}',
      'manual','${root.ownerId}'
      FROM generate_series(1,${group.count})`);
  }
  await setActor(db, root.ownerId);
  const start = performance.now(); const result = await summary(db);
  console.log('summary 2001 books (PGlite, ms):', (performance.now() - start).toFixed(1));
  assert.equal(result.counts.all, 2001);
  assert.equal(result.counts.live, 1200);
  assert.equal(result.counts.private, 301);
  assert.equal(result.counts.paused, 200);
  assert.equal(result.counts.outOfStock, 150);
  assert.equal(result.counts.needsAttention, 150);
  const expectedMoney = groups.reduce(
    (sum, group) => sum + BigInt(group.count) * BigInt(group.priceMinor) * BigInt(group.quantityAvailable),
    725n * 3n,
  );
  assert.equal(result.availableStockValueMinor, String(expectedMoney));
}));
