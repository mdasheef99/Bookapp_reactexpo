import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  addApprovedPublicMedia, businessEffectSnapshot, createUnit7bDatabase,
  installTransientProjectionFault, seedPublicationInventory, setPublication, state,
} from './unit7bFixture.mjs';

async function withDb(run) {
  const db = await createUnit7bDatabase();
  try { await run(db); } finally { await db.close(); }
}

test('CORR-001 publication and discovery share rollout eligibility and fail closed after loss', () => withDb(async (db) => {
  for (const [label, overrides] of [
    ['restricted subscription', { subscriptionStatus: 'restricted' }],
    ['cancelled subscription', { subscriptionStatus: 'cancelled' }],
    ['marketplace entitlement', { marketplaceEntitled: false }],
    ['pilot locality', { pilotEnabled: false }],
    ['marketplace feature', { marketplaceEnabled: false }],
    ['store allowlist', { storeAllowlisted: false }],
    ['active listing limit', { activeListingLimit: 0 }],
  ]) {
    const f = await seedPublicationInventory(db, overrides);
    const before = await businessEffectSnapshot(db, f);
    await assert.rejects(setPublication(db, f), /P9_PUBLICATION_INELIGIBLE/u, label);
    const after = await businessEffectSnapshot(db, f);
    assert.equal(after.listings, 0); assert.equal(after.jobs, 0);
    assert.equal(after.audits, before.audits); assert.equal(after.events, before.events);
  }
  const eligible = await seedPublicationInventory(db, { subscriptionStatus: 'past_due' });
  const published = await setPublication(db, eligible);
  await resetActor(db);
  await db.exec(`UPDATE public.store_subscriptions SET status='restricted'
    WHERE store_id='${eligible.storeId}'`);
  const hidden = await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${published.listingId}')`);
  assert.equal(hidden, null);
}));

test('CORR-001 latest subscription status overrides stale allowed history', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  const published = await setPublication(db, f);
  await resetActor(db);
  await db.exec(`
    UPDATE public.store_subscriptions
      SET status='cancelled', updated_at='2026-08-13 12:00:00+00'
      WHERE store_id='${f.storeId}';
    INSERT INTO public.store_subscriptions(store_id,status,updated_at)
      VALUES('${f.storeId}','trialing','2026-08-12 12:00:00+00');
  `);
  assert.equal(await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${published.listingId}')`), null);
  assert.deepEqual(await scalar(db, `SELECT public.phase9_public_listing_search_v2(NULL,NULL,50)`), []);
  await setActor(db, f.ownerId);
  await setPublication(db, f, { intent: 'pause', intentVersion: 2,
    idempotencyKey: `pause-${randomUUID()}` });
  await assert.rejects(setPublication(db, f, { intentVersion: 3,
    idempotencyKey: `republish-${randomUUID()}` }), /P9_PUBLICATION_INELIGIBLE/u);
}));

test('CORR-002 Owner publication preserves platform moderation and blocking flags', () => withDb(async (db) => {
  let f;
  for (const moderation of ['pending', 'blocked', 'prohibited']) {
    f = await seedPublicationInventory(db);
    await setPublication(db, f); await resetActor(db);
    await db.exec(`UPDATE public.marketplace_book_listings SET moderation_status='${moderation}'
      WHERE inventory_id='${f.inventoryId}'`);
    await setActor(db, f.ownerId);
    await setPublication(db, f, { intent: 'pause', intentVersion: 2,
      idempotencyKey: `pause-${randomUUID()}` });
    await assert.rejects(setPublication(db, f, { intentVersion: 3,
      idempotencyKey: `republish-${randomUUID()}` }), /P9_PUBLICATION_INELIGIBLE/u);
    await resetActor(db);
    assert.equal(await scalar(db, `SELECT moderation_status FROM public.marketplace_book_listings
      WHERE inventory_id='${f.inventoryId}'`), moderation);
  }
  await db.exec(`UPDATE public.marketplace_book_listings SET moderation_status='approved'
    WHERE inventory_id='${f.inventoryId}';
    INSERT INTO public.listing_moderation_flags(listing_id,store_id,flag_type,status)
    SELECT id,store_id,'restricted_content','open' FROM public.marketplace_book_listings
    WHERE inventory_id='${f.inventoryId}'`);
  await setActor(db, f.ownerId);
  await assert.rejects(setPublication(db, f, { intentVersion: 3,
    idempotencyKey: `flagged-${randomUUID()}` }), /P9_PUBLICATION_INELIGIBLE/u);
  await resetActor(db);
  await db.exec(`UPDATE public.listing_moderation_flags SET status='resolved'
    WHERE listing_id=(SELECT id FROM public.marketplace_book_listings
      WHERE inventory_id='${f.inventoryId}')`);
  await setActor(db, f.ownerId);
  const restored = await setPublication(db, f, { intentVersion: 3,
    idempotencyKey: `restored-${randomUUID()}` });
  assert.equal(restored.outcome, 'published');
}));

test('CORR-003 database discovery preserves exact ISBN grouping and storefront page cardinality', () => withDb(async (db) => {
  const first = await seedPublicationInventory(db, {
    title: 'Grouped Edition', isbn10: '0306406152', isbn13: '9780306406157', priceMinor: 500,
  });
  const second = await seedPublicationInventory(db, {
    title: 'Grouped Edition', isbn10: '0306406152', isbn13: '9780306406157', priceMinor: 600,
  });
  await setActor(db, first.ownerId); await setPublication(db, first);
  await setActor(db, second.ownerId); await setPublication(db, second);
  await resetActor(db);
  const isbn10 = await scalar(db, "SELECT public.phase9_public_listing_search_v2('0-306-40615-2',NULL,1)");
  const isbn13 = await scalar(db, "SELECT public.phase9_public_listing_search_v2('9780306406157',NULL,1)");
  assert.equal(isbn10.length, 2); assert.equal(isbn13.length, 2);
  assert.deepEqual(new Set(isbn13.map((row) => row.storeId)), new Set([first.storeId, second.storeId]));
  const storefront = await scalar(db, `SELECT public.phase9_public_listing_search_v2(
    NULL,'${first.storeId}',1)`);
  assert.equal(storefront.length, 1);
}));

test('CORR-004 every media eligibility loss retracts stale public media', () => withDb(async (db) => {
  const fields = [
    "validation_version=NULL", "reencode_version=NULL", "exif_strip_version=NULL", "object_path='../unsafe.webp'",
    "lifecycle_status='failed'",
  ];
  for (const mutation of fields) {
    const f = await seedPublicationInventory(db);
    const media = await addApprovedPublicMedia(db, f, 'primary_fallback', 1);
    await setPublication(db, f);
    await resetActor(db);
    await db.exec(`UPDATE public.media_assets SET ${mutation} WHERE id='${media.assetId}'`);
    const s = await state(db, f);
    assert.equal(s.inventory.visibility_status, 'blocked', mutation);
    assert.equal(s.listings.length, 0, mutation);
  }
  const moved = await seedPublicationInventory(db);
  const target = await seedPublicationInventory(db, {
    storeId: moved.storeId, ownerId: moved.ownerId,
  });
  const media = await addApprovedPublicMedia(db, moved, 'primary_fallback', 1);
  await setActor(db, moved.ownerId); await setPublication(db, moved);
  await resetActor(db);
  await db.exec(`UPDATE public.inventory_media_links SET inventory_id='${target.inventoryId}'
    WHERE id='${media.linkId}'`);
  const movedState = await state(db, moved);
  assert.equal(movedState.inventory.visibility_status, 'blocked', 'link moved away');
  assert.equal(movedState.listings.length, 0, 'link moved away');
}));

test('CORR-005 successful worker response-loss replay survives cleared lease with zero effect', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  await installTransientProjectionFault(db, f); await setPublication(db, f);
  await db.exec("SELECT set_config('phase9.test_projection_fault','off',false)");
  await setActor(db, f.ownerId, 'service_role');
  const claim = (await db.query("SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')")).rows[0];
  const key = `worker-replay-${randomUUID()}`; const command = randomUUID();
  const call = () => scalar(db, `SELECT public.phase9_retry_publication_worker_v1(
    '${f.inventoryId}',2,'${claim.job_id}','${claim.lease_token}',${claim.attempt_number},
    'publication-worker-0001','${key}','${command}')`);
  const first = await call(); const before = await businessEffectSnapshot(db, f);
  await setActor(db, f.ownerId, 'service_role');
  const replay = await call(); const after = await businessEffectSnapshot(db, f);
  assert.deepEqual(replay, first); assert.deepEqual(after, before);
}));
