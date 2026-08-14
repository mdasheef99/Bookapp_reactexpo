import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { commitSql, seedReviewedCandidate } from './unit7aFixture.mjs';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  addApprovedPublicMedia, addPublicMedia, businessEffectSnapshot,
  completePublicCopyDerivative, createUnit7bDatabase, disableTransientProjectionFault,
  installTransientProjectionFault, linkPublicCopyDerivative, registerPublicCopySource,
  seedPublicationInventory, setPublication, state,
} from './unit7bFixture.mjs';

async function withDb(run) {
  const db = await createUnit7bDatabase();
  try { await run(db); } finally { await db.close(); }
}

test('U7B-RT01 locked inventory is the sole projection authority and request fields cannot substitute public content', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db, { title: 'Server authoritative title' });
  const result = await setPublication(db, f);
  assert.equal(result.outcome, 'published');
  const s = await state(db, f);
  assert.equal(s.listings[0].public_title, 'Server authoritative title');
  assert.equal(s.inventory.quantity_available, 3);
}));

test('U7B-RT02 price quantity and sellability failures are deterministic and create no listing or retry', () => withDb(async (db) => {
  for (const overrides of [{ priceMinor: 0 }, { quantityTotal: 0, quantityAvailable: 0 }, { isSellable: false }]) {
    const f = await seedPublicationInventory(db, overrides);
    await assert.rejects(setPublication(db, f), /P9_PUBLICATION_INELIGIBLE/);
    const s = await state(db, f);
    assert.equal(s.listings.length, 0); assert.equal(s.jobs.length, 0);
    assert.equal(s.inventory.publication_status, 'private');
  }
}));

test('U7B-RT03 damaged inventory requires one to three approved sanitized damage-role links and actual-copy alone is rejected', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db, { hasDamage: true, damageTypes: ['cover'], damageNote: 'Visible mark' });
  await assert.rejects(setPublication(db, f), /P9_MEDIA_NOT_APPROVED/);
  assert.equal((await state(db, f)).jobs.length, 0);
  await addApprovedPublicMedia(db, f, 'actual_copy', 1);
  await assert.rejects(setPublication(db, f, { idempotencyKey: `u7b-damage-a-${f.inventoryId}` }), /P9_MEDIA_NOT_APPROVED/);
  await addPublicMedia(db, f, { role: 'damage', order: 2, approvalStatus: 'pending' });
  await assert.rejects(setPublication(db, f, { idempotencyKey: `u7b-damage-pending-${f.inventoryId}` }), /P9_MEDIA_NOT_APPROVED/);
  await assert.rejects(addPublicMedia(db, f, {
    role: 'damage', order: 3, sanitized: false, lifecycleStatus: 'staged', bucketId: 'marketplace-media-staging',
  }), /media_assets_purpose_privacy_check/);
  await resetActor(db);
  await db.exec(`DELETE FROM public.inventory_media_links WHERE inventory_id='${f.inventoryId}'`);
  await setActor(db, f.ownerId);
  for (let count = 1; count <= 3; count += 1) {
    const candidate = count === 1 ? f : await seedPublicationInventory(db, {
      hasDamage: true, damageTypes: ['cover'], damageNote: 'Visible mark',
    });
    for (let order = 1; order <= count; order += 1) {
      await addApprovedPublicMedia(db, candidate, 'damage', order);
    }
    assert.equal((await setPublication(db, candidate, {
      idempotencyKey: `u7b-damage-valid-${count}-${candidate.inventoryId}`,
    })).outcome, 'published');
  }
  const excessive = await seedPublicationInventory(db, {
    hasDamage: true, damageTypes: ['cover'], damageNote: 'Visible mark',
  });
  await resetActor(db);
  await db.exec('ALTER TABLE public.inventory_media_links DROP CONSTRAINT inventory_media_links_public_order_check');
  await setActor(db, excessive.ownerId);
  for (let order = 1; order <= 4; order += 1) await addApprovedPublicMedia(db, excessive, 'damage', order);
  await assert.rejects(setPublication(db, excessive), /P9_MEDIA_NOT_APPROVED/);
  assert.equal((await state(db, excessive)).jobs.length, 0);
}));

test('U7B-RT04 unauthorized inactive and cross-store commands are non-enumerating and leave no durable effect', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  const denied = async (label, prepare, inventoryId = f.inventoryId) => {
    await prepare();
    const before = await businessEffectSnapshot(db, f);
    await prepare();
    const error = await setPublication(db, f, {
      inventoryId, idempotencyKey: `u7b-denied-${label}-${f.inventoryId}`,
    }).then(() => null, (failure) => failure);
    assert.match(String(error?.message), /P9_OWNER_NOT_AUTHORIZED/);
    const after = await businessEffectSnapshot(db, f);
    assert.deepEqual(after, before, `${label} must leave no listing/job/audit/event/idempotency/inventory effect`);
  };
  await denied('unauthenticated', () => resetActor(db));
  await denied('inactive-owner', async () => {
    await resetActor(db);
    await db.exec(`UPDATE public.store_administrators SET status='inactive'
      WHERE store_id='${f.storeId}' AND user_id='${f.ownerId}'`);
    await setActor(db, f.ownerId);
  });
  await resetActor(db);
  await db.exec(`UPDATE public.store_administrators SET status='active'
    WHERE store_id='${f.storeId}' AND user_id='${f.ownerId}'`);
  await denied('cross-store-owner', () => setActor(db, f.otherOwnerId));
  await denied('nonexistent-inventory', () => setActor(db, f.otherOwnerId), randomUUID());
}));

test('U7B-RT05 stale inventory and publication intent versions fail before projection', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  await assert.rejects(setPublication(db, f, { inventoryVersion: 2 }), /P9_VERSION_CONFLICT/);
  await assert.rejects(setPublication(db, f, { intentVersion: 2, idempotencyKey: `u7b-stale-${f.inventoryId}` }), /P9_VERSION_CONFLICT/);
  assert.equal((await state(db, f)).listings.length, 0);
}));

test('U7B-RT06 publish and republish retain exactly one listing per inventory', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  await setPublication(db, f);
  await setPublication(db, f, { intent: 'pause', intentVersion: 2, idempotencyKey: `u7b-pause-${f.inventoryId}` });
  await setPublication(db, f, { intentVersion: 3, idempotencyKey: `u7b-republish-${f.inventoryId}` });
  assert.equal((await state(db, f)).listings.length, 1);
}));

test('U7B-RT07 response-loss replay returns the canonical result with zero second effect', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); const commandId = randomUUID();
  const first = await setPublication(db, f, { commandId });
  const replay = await setPublication(db, f, { commandId });
  assert.deepEqual(replay, first);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs WHERE action='phase9.publication.publish' AND entity_id='${f.inventoryId}'`), 1);
}));

test('U7B-RT08 changed command identity version or intent returns P9_IDEMPOTENCY_MISMATCH with zero effect', () => withDb(async (db) => {
  const changes = [
    ['commandId', () => ({ commandId: randomUUID() })],
    ['expected inventory version', () => ({ inventoryVersion: 2 })],
    ['expected publication intent version', () => ({ intentVersion: 2 })],
    ['requested intent', () => ({ intent: 'pause' })],
  ];
  for (const [label, changed] of changes) {
    const f = await seedPublicationInventory(db); const commandId = randomUUID();
    const idempotencyKey = `u7b-mismatch-${f.inventoryId}`;
    await setPublication(db, f, { commandId, idempotencyKey });
    const before = await businessEffectSnapshot(db, f);
    await assert.rejects(setPublication(db, f, {
      commandId, idempotencyKey, ...changed(),
    }), /P9_IDEMPOTENCY_MISMATCH/, label);
    assert.deepEqual(await businessEffectSnapshot(db, f), before, `${label} mismatch must add no effect`);
  }
}));
