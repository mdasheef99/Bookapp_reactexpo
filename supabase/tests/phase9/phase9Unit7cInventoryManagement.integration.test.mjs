import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import { disableTransientProjectionFault, installTransientProjectionFault } from './unit7bFixture.mjs';
import {
  adjustStock, createUnit7cDatabase, publishInventory, saveDetails,
  seedUnit7cInventory, storeViewDetail, storeViewPage, unit7cState,
} from './unit7cFixture.mjs';

async function withDb(run) {
  const db = await createUnit7cDatabase();
  try { await run(db); } finally { await db.close(); }
}

test('U7C-WU1-01 Save Changes atomically updates the frozen field set once with one audit and event', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const result = await saveDetails(db, f, {
    title: '  Updated title  ', authors: ['Updated Author'], language: 'en',
    publicDescription: 'Updated description', sellingPriceMinor: 900,
    condition: 'very_good', publicConditionNote: 'Clean owner-visible copy',
    hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
    shelfLocation: ' Shelf A2 ', internalNotes: ' Private note ',
  });
  assert.equal(result.inventoryVersion, 2);
  const s = await unit7cState(db, f);
  assert.equal(s.inventory.title, 'Updated title');
  assert.deepEqual(s.inventory.authors, ['Updated Author']);
  assert.equal(s.inventory.description, 'Updated description');
  assert.equal(s.inventory.selling_price_minor, 900);
  assert.equal(s.inventory.shelf_location, 'Shelf A2');
  assert.equal(s.inventory.internal_notes, 'Private note');
  assert.equal(s.audits, 1); assert.equal(s.events, 1);
}));

test('U7C-WU1-02 Save rejects no-op stale cross-store and changed replay while exact replay adds zero', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); const commandId = randomUUID();
  await assert.rejects(saveDetails(db, f, { title: 'Unit 7B Title' }), /P9_NO_CHANGES/);
  await assert.rejects(saveDetails(db, f, { title: 'Changed' }, { inventoryVersion: 99 }), /P9_VERSION_CONFLICT/);
  await setActor(db, f.otherOwnerId);
  await assert.rejects(saveDetails(db, f, { title: 'Changed' }), /P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, f.ownerId);
  const key = `u7c-save-replay-${f.inventoryId}`;
  const first = await saveDetails(db, f, { title: 'Replay title' }, { commandId, idempotencyKey: key });
  const replay = await saveDetails(db, f, { title: 'Replay title' }, { commandId, idempotencyKey: key });
  assert.deepEqual(replay, first);
  await assert.rejects(saveDetails(db, f, { title: 'Changed replay' }, {
    commandId, idempotencyKey: key,
  }), /P9_IDEMPOTENCY_MISMATCH/);
  const s = await unit7cState(db, f);
  assert.equal(s.inventory.version, 2); assert.equal(s.audits, 1); assert.equal(s.events, 1);
}));

test('U7C-WU1-03 live public Save keeps inventory and listing identity, projects generated authors, and appends one revision', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  await publishInventory(db, f);
  const published = await unit7cState(db, f);
  const listingId = published.listings[0].id;
  assert.equal(published.revisions.length, 1);
  await saveDetails(db, f, { authors: ['Generated Seam Author'], sellingPriceMinor: 975 });
  const changed = await unit7cState(db, f);
  assert.equal(changed.inventory.id, f.inventoryId);
  assert.equal(changed.listings[0].id, listingId);
  assert.equal(changed.listings[0].selling_price_minor, 975);
  assert.equal(changed.listings[0].authors_text, 'Generated Seam Author');
  assert.equal(changed.revisions.length, 2);
}));

test('U7C-WU1-04 live private-only Save does not touch customer projection or revision history', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); await publishInventory(db, f);
  const before = await unit7cState(db, f);
  await saveDetails(db, f, { shelfLocation: 'Private Shelf', internalNotes: 'Private only' });
  const after = await unit7cState(db, f);
  assert.deepEqual(after.listings[0], before.listings[0]);
  assert.equal(after.revisions.length, before.revisions.length);
  assert.equal(after.inventory.version, 2);
}));

test('U7C-WU1-05 invalid live public Save rolls inventory projection history audit event and replay back together', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); await publishInventory(db, f);
  const before = await unit7cState(db, f);
  await assert.rejects(saveDetails(db, f, {
    condition: 'good', hasDamage: true, damageTypes: ['cover'], damageNote: 'Mark',
  }), /P9_(?:MEDIA_NOT_APPROVED|PUBLICATION_INELIGIBLE)/);
  assert.deepEqual(await unit7cState(db, f), before);
}));

test('U7C-WU1-06 private and paused edits commit without publishing or adding a public revision', () => withDb(async (db) => {
  const privateItem = await seedUnit7cInventory(db);
  await saveDetails(db, privateItem, { sellingPriceMinor: 800 });
  assert.equal((await unit7cState(db, privateItem)).revisions.length, 0);
  const paused = await seedUnit7cInventory(db); await publishInventory(db, paused);
  await publishInventory(db, paused, { intent: 'pause', intentVersion: 2, idempotencyKey: `u7c-pause-${paused.inventoryId}` });
  await saveDetails(db, paused, { sellingPriceMinor: 825 });
  const state = await unit7cState(db, paused);
  assert.equal(state.inventory.visibility_status, 'paused');
  assert.equal(state.listings[0].status, 'paused');
  assert.equal(state.revisions.length, 1);
}));

test('U7C-WU1-07 stock 1 to 0 commits as out of stock and 0 to 1 restores discovery availability', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db, { quantityTotal: 1, quantityAvailable: 1 });
  await publishInventory(db, f); const listingId = (await unit7cState(db, f)).listings[0].id;
  const zero = await adjustStock(db, f, -1);
  assert.equal(zero.inventoryVersion, 2);
  let s = await unit7cState(db, f);
  assert.equal(s.inventory.visibility_status, 'published');
  assert.equal(s.inventory.publication_status, 'published');
  assert.equal(s.listings[0].id, listingId);
  assert.equal(s.listings[0].status, 'out_of_stock');
  assert.equal(s.listings[0].availability_status, 'unavailable');
  assert.equal(await scalar(db, `SELECT jsonb_array_length(public.phase9_public_listing_search_v2(NULL,'${f.storeId}',20))`), 0);
  await adjustStock(db, f, 1, { inventoryVersion: 2 });
  s = await unit7cState(db, f);
  assert.equal(s.listings[0].status, 'active');
  assert.equal(s.listings[0].availability_status, 'low_stock');
  assert.equal(await scalar(db, `SELECT jsonb_array_length(public.phase9_public_listing_search_v2(NULL,'${f.storeId}',20))`), 1);
  assert.equal(s.revisions.length, 3);
}));

test('U7C-WU1-08 stock preserves buckets and holds, rejects invalid deltas, and exact replay adds zero', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); const commandId = randomUUID();
  await assert.rejects(adjustStock(db, f, 0), /P9_REQUEST_INVALID/);
  await assert.rejects(adjustStock(db, f, -4), /P9_QUANTITY_INVARIANT_FAILED/);
  await assert.rejects(db.exec(`UPDATE public.store_inventory SET quantity_reserved=1
    WHERE id='${f.inventoryId}'`), /permission denied/);
  await resetActor(db);
  const requestId = randomUUID(); const itemId = randomUUID();
  await db.exec(`
    UPDATE public.store_inventory SET quantity_available=2,quantity_reserved=1
      WHERE id='${f.inventoryId}';
    INSERT INTO public.store_order_requests(id,store_id,user_id)
      VALUES('${requestId}','${f.storeId}','${randomUUID()}');
    INSERT INTO public.store_order_request_items(id,order_request_id,store_id,inventory_id)
      VALUES('${itemId}','${requestId}','${f.storeId}','${f.inventoryId}');
    INSERT INTO public.inventory_holds(id,store_id,inventory_id,order_request_id,
      order_request_item_id,hold_type,status,quantity,expires_at,command_id)
      VALUES('${randomUUID()}','${f.storeId}','${f.inventoryId}','${requestId}',
        '${itemId}','firm','active',1,transaction_timestamp()+interval '1 hour','${randomUUID()}');
  `);
  await setActor(db, f.ownerId);
  const key = `u7c-stock-replay-${f.inventoryId}`;
  const first = await adjustStock(db, f, -1, { commandId, idempotencyKey: key });
  const replay = await adjustStock(db, f, -1, { commandId, idempotencyKey: key });
  assert.deepEqual(replay, first);
  const s = await unit7cState(db, f);
  assert.deepEqual({ total: s.inventory.quantity_total, available: s.inventory.quantity_available,
    reserved: s.inventory.quantity_reserved, sold: s.inventory.quantity_sold,
    removed: s.inventory.quantity_removed }, { total: 2, available: 1, reserved: 1, sold: 0, removed: 0 });
  assert.equal(s.audits, 1); assert.equal(s.events, 1);
}));

test('U7C-WU1-08b stock N to 1 produces low stock while positive available-to-available changes add no public revision', () => withDb(async (db) => {
  const low = await seedUnit7cInventory(db); await publishInventory(db, low);
  await adjustStock(db, low, -2);
  let s = await unit7cState(db, low);
  assert.equal(s.listings[0].availability_status, 'low_stock');
  assert.equal(s.revisions.length, 2);
  const positive = await seedUnit7cInventory(db); await publishInventory(db, positive);
  await adjustStock(db, positive, 1);
  s = await unit7cState(db, positive);
  assert.equal(s.inventory.quantity_total, 4); assert.equal(s.inventory.quantity_available, 4);
  assert.equal(s.listings[0].availability_status, 'available');
  assert.equal(s.revisions.length, 1);
}));

test('U7C-WU1-09 revision snapshots are deterministic allowlists and normal application roles cannot rewrite history', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); await publishInventory(db, f);
  const s = await unit7cState(db, f); const revision = s.revisions[0];
  assert.equal(revision.revision_number, 1);
  const snapshotText = JSON.stringify(revision.public_snapshot);
  for (const forbidden of ['quantity_total', 'quantity_reserved', 'shelf_location',
    'internal_notes', 'actor', 'provider', 'object_path', 'token']) {
    assert.equal(snapshotText.includes(forbidden), false, forbidden);
  }
  await setActor(db, f.ownerId);
  await assert.rejects(db.exec(`UPDATE public.phase9_publication_revisions SET revision_number=99
    WHERE id='${revision.id}'`), /permission denied/);
  await assert.rejects(db.exec(`DELETE FROM public.phase9_publication_revisions
    WHERE id='${revision.id}'`), /permission denied/);
}));

test('U7C-WU1-10 Store View page and detail are tenant-scoped server-composed DTOs with non-enumeration', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db, { quantityTotal: 0, quantityAvailable: 0 });
  await seedUnit7cInventory(db, {
    storeId: f.storeId, ownerId: f.ownerId, otherOwnerId: f.otherOwnerId,
  });
  const page = await storeViewPage(db, 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.pageInfo.hasNextPage, true);
  assert.equal(page.pageInfo.nextCursor.includes(page.items[0].identity.inventoryId), false);
  const next = await storeViewPage(db, 1, page.pageInfo.nextCursor);
  assert.equal(next.items.length, 1); assert.notEqual(next.items[0].identity.inventoryId, page.items[0].identity.inventoryId);
  assert.equal(page.items[0].rawListing, undefined);
  const detail = await storeViewDetail(db, f.inventoryId);
  assert.equal(detail.stockSummary.stockState, 'out_of_stock');
  assert.equal(detail.attention.attentionReasons.includes('out_of_stock'), false);
  assert.equal(detail.privateOperations.shelfLocation, 'Shelf Z9');
  assert.equal(detail.stock.quantityReserved, 0);
  await setActor(db, f.otherOwnerId);
  await assert.rejects(storeViewDetail(db, f.inventoryId), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(storeViewDetail(db, randomUUID()), /P9_OWNER_NOT_AUTHORIZED/);
}));

test('U7C-WU1-11 Unit 7B Publish Pause Republish and exact replay retain semantics while revisions track effective live snapshots', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); const commandId = randomUUID();
  const key = `u7c-publication-replay-${f.inventoryId}`;
  const first = await publishInventory(db, f, { commandId, idempotencyKey: key });
  assert.deepEqual(await publishInventory(db, f, { commandId, idempotencyKey: key }), first);
  await publishInventory(db, f, { intent: 'pause', intentVersion: 2, idempotencyKey: `u7c-pause-${f.inventoryId}` });
  assert.equal((await unit7cState(db, f)).revisions.length, 1);
  await publishInventory(db, f, { intentVersion: 3, idempotencyKey: `u7c-republish-${f.inventoryId}` });
  let s = await unit7cState(db, f);
  assert.equal(s.listings.length, 1); assert.equal(s.listings[0].status, 'active');
  assert.equal(s.revisions.length, 2);
  assert.deepEqual(s.revisions.map((r) => r.revision_number), [1, 2]);
  await publishInventory(db, f, { intent: 'private', intentVersion: 4,
    idempotencyKey: `u7c-private-${f.inventoryId}` });
  s = await unit7cState(db, f);
  assert.equal(s.listings.length, 0); assert.equal(s.revisions.length, 2);
}));

test('U7C-WU1-12 successful Unit 7B retry appends Revision 1 while transient failure adds none', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  await installTransientProjectionFault(db, f);
  const failed = await publishInventory(db, f);
  assert.equal(failed.outcome, 'committed_publication_failed');
  assert.equal((await unit7cState(db, f)).revisions.length, 0);
  await disableTransientProjectionFault(db);
  const retried = await scalar(db, `SELECT public.phase9_retry_publication_owner_v1(
    '${f.inventoryId}',2,'u7c-retry-${f.inventoryId}','${randomUUID()}')`);
  assert.equal(retried.outcome, 'published');
  const s = await unit7cState(db, f);
  assert.equal(s.revisions.length, 1); assert.equal(s.revisions[0].source_action, 'retry');
}));

test('U7C-WU1-13 downstream audit failure rolls Save projection history event and replay back together', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db); await publishInventory(db, f);
  const before = await unit7cState(db, f); const key = `u7c-audit-failure-${f.inventoryId}`;
  await resetActor(db);
  await db.exec(`
    CREATE FUNCTION public.unit7c_force_audit_failure() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='phase9.inventory.details_updated' THEN RAISE EXCEPTION 'UNIT7C_AUDIT_FAILURE'; END IF;
      RETURN NEW;
    END$$;
    CREATE TRIGGER unit7c_force_audit_failure BEFORE INSERT ON public.marketplace_audit_logs
      FOR EACH ROW EXECUTE FUNCTION public.unit7c_force_audit_failure();
  `);
  await setActor(db, f.ownerId);
  await assert.rejects(saveDetails(db, f, { sellingPriceMinor: 999 }, {
    idempotencyKey: key,
  }), /UNIT7C_AUDIT_FAILURE/);
  assert.deepEqual(await unit7cState(db, f), before);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_idempotency_keys
    WHERE operation='U7CC01' AND idempotency_key='${key}'`), 0);
}));

test('U7C-WU1-14 functions tables triggers and generated/default ownership have the frozen security shape', () => withDb(async (db) => {
  await resetActor(db);
  const functions = (await db.query(`SELECT p.oid::regprocedure::text signature,
      pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname IN (
      'phase9_update_store_inventory_details_v1','phase9_adjust_inventory_stock_v2',
      'phase9_store_view_page_v1','phase9_store_view_detail_v1'))
      OR (n.nspname='marketplace_sec' AND p.proname IN (
        'phase9_append_publication_revision_v1','phase9_store_view_item_v1'))`)).rows;
  assert.equal(functions.length, 6);
  for (const fn of functions) {
    assert.equal(fn.owner, 'postgres'); assert.equal(fn.prosecdef, true);
    assert.equal(fn.proconfig.some((setting) => setting.startsWith('search_path=')), true);
    assert.equal(fn.anon_execute, false);
    assert.equal(fn.signature.startsWith('marketplace_sec.') ? fn.authenticated_execute === false : fn.authenticated_execute === true, true);
  }
  const columns = (await db.query(`SELECT attname,attgenerated,pg_get_expr(d.adbin,d.adrelid) expression
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE c.oid='public.marketplace_book_listings'::regclass
      AND a.attname IN ('id','created_at','published_at','authors_text','search_document')`)).rows;
  const byName = Object.fromEntries(columns.map((column) => [column.attname, column]));
  assert.equal(byName.authors_text.attgenerated, 's');
  assert.match(byName.id.expression, /gen_random_uuid/);
  assert.match((byName.published_at ?? byName.created_at).expression, /(?:now|transaction_timestamp)/);
  assert.equal(byName.search_document.attgenerated, '');
  assert.equal(await scalar(db, `SELECT relrowsecurity FROM pg_class
    WHERE oid='public.phase9_publication_revisions'::regclass`), true);
  assert.equal(await scalar(db, `SELECT has_table_privilege('authenticated',
    'public.phase9_publication_revisions','SELECT')`), false);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_trigger
    WHERE tgrelid='public.store_inventory'::regclass AND tgname='phase9_store_inventory_listing_sync'`), 1);
}));
