import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  addPublicMedia, completePublicCopyDerivative,
} from './unit7bFixture.mjs';
import {
  adjustStock, createUnit7cDatabase, publishInventory, removeMedia,
  registerStoreViewCopySource, reorderMedia, replaceMedia, saveDetails, seedUnit7cInventory,
  storeViewHistory, storeViewMedia, unit7cMediaState, unit7cState,
} from './unit7cFixture.mjs';

async function withDb(run) {
  const db = await createUnit7cDatabase();
  try { await run(db); } finally { await db.close(); }
}

async function registerAndComplete(db, fixture, role, ordinal, targetLinkId) {
  const source = await registerStoreViewCopySource(db, fixture, {
    role, ordinal, operationKind: 'replace', targetLinkId,
  });
  return { ...(await completePublicCopyDerivative(db, fixture, source)), role, ordinal };
}

async function registerAndFail(db, fixture, role, ordinal, targetLinkId) {
  const source = await registerStoreViewCopySource(db, fixture, {
    role, ordinal, operationKind: 'replace', targetLinkId,
  });
  await setActor(db, fixture.ownerId, 'service_role');
  const claim = (await db.query(`SELECT id,attempt_count,lease_token
    FROM public.claim_phase9_media_validation_jobs(1,'media-worker-0000000001')`)).rows[0];
  await scalar(db, `SELECT public.phase9_fail_media_validation_v2(
    '${claim.id}','media-worker-0000000001','${claim.lease_token}',${claim.attempt_count},
    false,'P9_MEDIA_MIME_MISMATCH')`);
  await setActor(db, fixture.ownerId);
  return source;
}

test('U7C-WU4-01 approved replacement keeps the old media public while processing and swaps atomically with exactly one live revision', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const primary = await addPublicMedia(db, f, { role: 'primary_fallback', order: 1 });
  await publishInventory(db, f);
  const before = await unit7cMediaState(db, f);
  assert.equal(before.revisions.length, 1);
  assert.equal(before.listing.primary_public_media_id, primary.assetId);

  const upload = await registerStoreViewCopySource(db, f, {
    role: 'primary_fallback', ordinal: 1, operationKind: 'replace', targetLinkId: primary.linkId,
  });
  const processing = await unit7cMediaState(db, f);
  assert.equal(processing.listing.primary_public_media_id, primary.assetId);
  assert.equal(processing.revisions.length, 1);

  const completed = await completePublicCopyDerivative(db, f, upload);
  const ready = await storeViewMedia(db, f.inventoryId);
  assert.equal(ready.pendingReplacements[0].state, 'approved');
  assert.equal(ready.pendingReplacements[0].mediaAssetId, completed.completed.media_asset_id);

  const commandId = randomUUID();
  const key = `u7c-replace-replay-${f.inventoryId}`;
  const swapped = await replaceMedia(db, f, upload.authorization.capabilityId,
    completed.completed.media_asset_id, primary.linkId, { inventoryVersion: 1,
      commandId, idempotencyKey: key });
  assert.equal(swapped.outcome, 'media_replaced');
  assert.equal(swapped.mediaAssetId, completed.completed.media_asset_id);
  assert.equal(swapped.removedMediaAssetId, primary.assetId);

  const after = await unit7cMediaState(db, f);
  assert.equal(after.links.length, 1);
  assert.equal(after.links[0].id, primary.linkId);
  assert.equal(after.links[0].media_asset_id, completed.completed.media_asset_id);
  assert.equal(after.listing.primary_public_media_id, completed.completed.media_asset_id);
  assert.equal(after.revisions.length, 2);
  assert.equal(after.revisions[1].source_action, 'media_change');
  assert.equal(after.inventory.version, 2);

  const replay = await replaceMedia(db, f, upload.authorization.capabilityId,
    completed.completed.media_asset_id, primary.linkId, { inventoryVersion: 1,
      commandId, idempotencyKey: key });
  assert.deepEqual(replay, swapped);
  assert.equal((await unit7cMediaState(db, f)).revisions.length, 2);
  assert.equal((await unit7cMediaState(db, f)).audits, 2);
}));

test('U7C-WU4-02 failed replacement leaves the old approved media, projection, and revisions untouched', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const primary = await addPublicMedia(db, f, { role: 'primary_fallback', order: 1 });
  await publishInventory(db, f);
  const before = await unit7cMediaState(db, f);

  const failed = await registerAndFail(db, f, 'primary_fallback', 1, primary.linkId);
  const media = await storeViewMedia(db, f.inventoryId);
  assert.equal(media.pendingReplacements[0].state, 'failed');
  assert.equal(media.pendingReplacements[0].safeErrorCode, 'P9_MEDIA_MIME_MISMATCH');

  await assert.rejects(replaceMedia(db, f, failed.authorization.capabilityId,
    failed.registered.media_asset_id, primary.linkId), /P9_MEDIA_NOT_APPROVED/);
  const after = await unit7cMediaState(db, f);
  assert.deepEqual(after.links, before.links);
  assert.deepEqual(after.listing, before.listing);
  assert.equal(after.revisions.length, 1);
  assert.equal(after.inventory.version, 1);
}));

test('U7C-WU4-02A replacement capability keeps its exact target across reorder and owner restart', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const targetA = await addPublicMedia(db, f, { role: 'actual_copy', order: 1 });
  const targetB = await addPublicMedia(db, f, { role: 'actual_copy', order: 2 });
  const upload = await registerStoreViewCopySource(db, f, {
    role: 'actual_copy', ordinal: 1, operationKind: 'replace', targetLinkId: targetA.linkId,
  });
  await resetActor(db);
  const capability = (await db.query(`SELECT operation_kind,target_media_link_id
    FROM public.phase9_upload_capabilities WHERE id='${upload.authorization.capabilityId}'`)).rows[0];
  assert.equal(capability.operation_kind, 'replace');
  assert.equal(capability.target_media_link_id, targetA.linkId);
  await setActor(db, f.ownerId);

  await reorderMedia(db, f, [targetB.linkId, targetA.linkId]);
  const refetched = await storeViewMedia(db, f.inventoryId);
  assert.equal(refetched.pendingReplacements[0].operationKind, 'replace');
  assert.equal(refetched.pendingReplacements[0].targetLinkId, targetA.linkId);
  const completed = await completePublicCopyDerivative(db, f, upload);

  await assert.rejects(replaceMedia(db, f, upload.authorization.capabilityId,
    completed.completed.media_asset_id, targetB.linkId, { inventoryVersion: 2 }),
  /P9_MEDIA_NOT_APPROVED/);
  const swapped = await replaceMedia(db, f, upload.authorization.capabilityId,
    completed.completed.media_asset_id, targetA.linkId, { inventoryVersion: 2 });
  assert.equal(swapped.mediaLinkId, targetA.linkId);
  const state = await unit7cMediaState(db, f);
  assert.equal(state.links.find((link) => link.id === targetA.linkId).media_asset_id,
    completed.completed.media_asset_id);
  assert.equal(state.links.find((link) => link.id === targetB.linkId).media_asset_id,
    targetB.assetId);
}));

test('U7C-WU4-02B pending ADD survives owner refetch and resumes the existing Unit 7B link path', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const upload = await registerStoreViewCopySource(db, f, {
    role: 'actual_copy', ordinal: 1, operationKind: 'add', targetLinkId: null,
  });
  const pending = await storeViewMedia(db, f.inventoryId);
  assert.equal(pending.pendingReplacements[0].operationKind, 'add');
  assert.equal(pending.pendingReplacements[0].targetLinkId, null);
  const completed = await completePublicCopyDerivative(db, f, upload);
  const approved = await storeViewMedia(db, f.inventoryId);
  assert.equal(approved.pendingReplacements[0].state, 'approved');

  await scalar(db, `SELECT public.phase9_submit_public_copy_media_v2(
    '${f.inventoryId}','${upload.authorization.capabilityId}',
    '${completed.completed.media_asset_id}','actual_copy',1,
    'u7c-media-link-${randomUUID()}','${randomUUID()}')`);
  const media = await storeViewMedia(db, f.inventoryId);
  assert.equal(media.media.length, 1);
  assert.equal(media.media[0].mediaAssetId, completed.completed.media_asset_id);
  assert.equal(media.pendingReplacements.length, 0);
}));

test('U7C-WU4-03 reorder is deterministic, version-fenced, replay-safe, and revises only when the live DTO changes', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const p1 = await addPublicMedia(db, f, { role: 'primary_fallback', order: 1 });
  const ac = await addPublicMedia(db, f, { role: 'actual_copy', order: 2 });
  await publishInventory(db, f);
  const before = await unit7cMediaState(db, f);
  assert.equal(before.revisions.length, 1);

  await assert.rejects(reorderMedia(db, f, [ac.linkId]), /P9_REQUEST_INVALID/);
  await assert.rejects(reorderMedia(db, f, [p1.linkId, ac.linkId]),
    /P9_NO_CHANGES/);
  await assert.rejects(reorderMedia(db, f, [ac.linkId, p1.linkId],
    { inventoryVersion: 99 }), /P9_VERSION_CONFLICT/);

  const commandId = randomUUID();
  const key = `u7c-reorder-replay-${f.inventoryId}`;
  const reordered = await reorderMedia(db, f, [ac.linkId, p1.linkId],
    { commandId, idempotencyKey: key });
  assert.deepEqual(reordered.mediaLinkIds, [ac.linkId, p1.linkId]);
  assert.equal(reordered.inventoryVersion, 2);

  let s = await unit7cMediaState(db, f);
  assert.deepEqual(s.links.map((l) => l.id), [ac.linkId, p1.linkId]);
  assert.equal(s.listing.primary_public_media_id, p1.assetId);
  assert.equal(s.revisions.length, 1);
  assert.equal(s.inventory.version, 2);

  const replay = await reorderMedia(db, f, [ac.linkId, p1.linkId],
    { commandId, idempotencyKey: key });
  assert.deepEqual(replay, reordered);
  s = await unit7cMediaState(db, f);
  assert.equal(s.revisions.length, 1);
  assert.equal(s.audits, 2);
  assert.equal(s.inventory.version, 2);

  const privateItem = await seedUnit7cInventory(db);
  const q1 = await addPublicMedia(db, privateItem, { role: 'actual_copy', order: 1 });
  const q2 = await addPublicMedia(db, privateItem, { role: 'damage', order: 2 });
  await reorderMedia(db, privateItem, [q2.linkId, q1.linkId]);
  const privateState = await unit7cMediaState(db, privateItem);
  assert.equal(privateState.revisions.length, 0);
  assert.equal(privateState.audits, 1);
}));

test('U7C-WU4-03A hidden pending links do not block visible reorder and cannot be reordered', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const first = await addPublicMedia(db, f, { role: 'actual_copy', order: 1 });
  const second = await addPublicMedia(db, f, { role: 'actual_copy', order: 2 });
  const hidden = await addPublicMedia(db, f, {
    role: 'damage', order: 3, approvalStatus: 'pending',
  });
  const before = await unit7cMediaState(db, f);

  const reordered = await reorderMedia(db, f, [second.linkId, first.linkId]);
  assert.deepEqual(reordered.mediaLinkIds, [second.linkId, first.linkId]);
  let state = await unit7cMediaState(db, f);
  assert.equal(state.inventory.version, before.inventory.version + 1);
  assert.deepEqual(state.links.map((link) => link.id), [second.linkId, first.linkId, hidden.linkId]);
  assert.equal(state.links.find((link) => link.id === hidden.linkId).public_order, 3);

  const stable = await unit7cMediaState(db, f);
  await assert.rejects(reorderMedia(db, f, [second.linkId, first.linkId, hidden.linkId], {
    inventoryVersion: stable.inventory.version,
  }), /P9_REQUEST_INVALID/);
  state = await unit7cMediaState(db, f);
  assert.equal(state.inventory.version, stable.inventory.version);
  assert.equal(state.revisions.length, stable.revisions.length);
  assert.equal(state.audits, stable.audits);
  assert.equal(state.events, stable.events);
}));

test('U7C-WU4-04 remove rejects unknown links, revises live DTO changes, and records private removals as activity only', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const ac = await addPublicMedia(db, f, { role: 'actual_copy', order: 1 });
  const other = await addPublicMedia(db, f, { role: 'actual_copy', order: 2 });
  await publishInventory(db, f);
  const stranger = await seedUnit7cInventory(db);
  const foreign = await addPublicMedia(db, stranger, { role: 'actual_copy', order: 1 });
  await setActor(db, f.ownerId);

  await assert.rejects(removeMedia(db, f, foreign.linkId), /P9_MEDIA_LINK_NOT_FOUND/);
  await assert.rejects(removeMedia(db, f, ac.linkId, { inventoryVersion: 99 }),
    /P9_VERSION_CONFLICT/);

  const removed = await removeMedia(db, f, ac.linkId);
  assert.equal(removed.removedMediaAssetId, ac.assetId);
  let s = await unit7cMediaState(db, f);
  assert.deepEqual(s.links.map((l) => l.id), [other.linkId]);
  assert.equal(s.listing.public_media_count, 1);
  assert.equal(s.revisions.length, 2);
  assert.equal(s.revisions[1].source_action, 'media_change');
  assert.equal(s.inventory.version, 2);

  const privateItem = await seedUnit7cInventory(db);
  const pv = await addPublicMedia(db, privateItem, { role: 'actual_copy', order: 1 });
  await removeMedia(db, privateItem, pv.linkId);
  assert.equal((await unit7cMediaState(db, privateItem)).revisions.length, 0);
}));

test('U7C-WU4-05 damage evidence removal is rejected on live items and valid approved replacement succeeds atomically', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db, {
    hasDamage: true, damageTypes: ['cover'], damageNote: 'Worn cover',
  });
  const damage = await addPublicMedia(db, f, { role: 'damage', order: 1 });
  await publishInventory(db, f);
  const before = await unit7cMediaState(db, f);
  assert.equal(before.revisions.length, 1);

  await assert.rejects(removeMedia(db, f, damage.linkId), /P9_MEDIA_CHANGE_UNSAFE/);
  let s = await unit7cMediaState(db, f);
  assert.equal(s.inventory.version, 1);
  assert.equal(s.inventory.visibility_status, 'published');
  assert.equal(s.listing.status, 'active');

  const replacement = await registerAndComplete(db, f, 'damage', 1, damage.linkId);
  const swapped = await replaceMedia(db, f, replacement.authorization.capabilityId,
    replacement.completed.media_asset_id, damage.linkId);
  assert.equal(swapped.outcome, 'media_replaced');
  s = await unit7cMediaState(db, f);
  assert.equal(s.inventory.visibility_status, 'published');
  assert.equal(s.listing.status, 'active');
  assert.equal(s.links[0].media_asset_id, replacement.completed.media_asset_id);
  assert.equal(s.revisions.length, 1);
  assert.equal(s.audits, 2);
}));

test('U7C-WU4-06 cross-store identity is rejected non-enumeratively and the owner read never leaks raw or staging media', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  await addPublicMedia(db, f, { role: 'primary_fallback', order: 1 });
  const other = await seedUnit7cInventory(db);
  await addPublicMedia(db, other, { role: 'actual_copy', order: 1 });

  await setActor(db, other.ownerId);
  await assert.rejects(storeViewMedia(db, f.inventoryId), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(storeViewHistory(db, f.inventoryId), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(reorderMedia(db, f, [randomUUID()]), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(removeMedia(db, f, randomUUID()), /P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, f.ownerId);

  const media = await storeViewMedia(db, f.inventoryId);
  assert.equal(media.media.length, 1);
  assert.ok(media.media[0].url.startsWith('/storage/v1/object/public/inventory-photos/'));
  assert.ok(!JSON.stringify(media).includes('marketplace-media-staging'));
  assert.ok(!JSON.stringify(media).includes('private_scan'));
  assert.equal(media.media[0].role, 'primary_fallback');

  const upload = await registerStoreViewCopySource(db, f, {
    role: 'primary_fallback', ordinal: 1, operationKind: 'replace', targetLinkId: media.media[0].linkId,
  });
  const processing = await storeViewMedia(db, f.inventoryId);
  assert.equal(processing.pendingReplacements[0].state, 'processing');
  const completed = await completePublicCopyDerivative(db, f, upload);
  const approved = await storeViewMedia(db, f.inventoryId);
  assert.equal(approved.pendingReplacements[0].state, 'approved');
  await replaceMedia(db, f, upload.authorization.capabilityId,
    completed.completed.media_asset_id, media.media[0].linkId);
  const after = await storeViewMedia(db, f.inventoryId);
  assert.equal(after.pendingReplacements.length, 0);
}));

test('U7C-WU4-07 history renders authoritative activity and public revisions with no private fields and no undo surface', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  const ac = await addPublicMedia(db, f, { role: 'actual_copy', order: 1 });
  await publishInventory(db, f);
  await saveDetails(db, f, { sellingPriceMinor: 800 });
  await removeMedia(db, f, ac.linkId, { inventoryVersion: 2 });

  const history = await storeViewHistory(db, f.inventoryId);
  const actions = history.activity.filter((e) => e.kind === 'audit').map((e) => e.action);
  assert.ok(actions.includes('phase9.inventory.details_updated'));
  assert.ok(actions.includes('phase9.publication.publish'));
  assert.ok(actions.includes('phase9.inventory.media_removed'));
  assert.equal(history.publicRevisions.length, 3);
  assert.equal(history.publicRevisions[0].sourceAction, 'media_change');
  assert.equal(history.publicRevisions[1].sourceAction, 'save_details');
  assert.equal(history.publicRevisions[2].sourceAction, 'initial_publish');

  const snapshot = JSON.stringify(history.publicRevisions[0].publicSnapshot);
  assert.ok(!snapshot.includes('shelfLocation'));
  assert.ok(!snapshot.includes('internalNotes'));
  assert.ok(!snapshot.includes('quantityTotal'));
  assert.ok(!snapshot.includes('object_path'));
  assert.ok(!JSON.stringify(history.activity).includes('shelf_location'));

  await resetActor(db);
  await assert.rejects(db.exec(`DELETE FROM public.phase9_publication_revisions
    WHERE inventory_id='${f.inventoryId}'`), /P9_APPEND_ONLY_HISTORY/);
  await setActor(db, f.ownerId);
}));

test('U7C-WU4-07A history limits source activity before aggregation and returns only allowlisted details', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db);
  await resetActor(db);
  const auditRows = Array.from({ length: 60 }, (_, index) => `(
    '${randomUUID()}','${f.storeId}','${f.ownerId}','phase9.test.audit.${index}',
    'store_inventory','${f.inventoryId}',
    jsonb_build_object('commandId','${randomUUID()}','inventoryVersion',${index},
      'privateNote','do-not-return-${index}','object_path','staging/secret-${index}'),
    transaction_timestamp()+interval '${index} seconds')`).join(',');
  await db.exec(`INSERT INTO public.marketplace_audit_logs(
    id,store_id,actor_user_id,action,entity_type,entity_id,details,created_at
  ) VALUES ${auditRows}`);
  await setActor(db, f.ownerId);

  const history = await storeViewHistory(db, f.inventoryId);
  assert.equal(history.activity.length, 50);
  assert.equal(history.activity[0].action, 'phase9.test.audit.59');
  assert.equal(history.activity.at(-1).action, 'phase9.test.audit.10');
  const serialized = JSON.stringify(history.activity);
  assert.ok(!serialized.includes('privateNote'));
  assert.ok(!serialized.includes('object_path'));
  assert.ok(history.activity.every((entry) => entry.kind !== 'audit'
    || Object.keys(entry.details).every((key) => ['commandId', 'inventoryVersion',
      'mediaLinkIds', 'mediaAssetId', 'removedMediaAssetId', 'role', 'outcome'].includes(key))));
}));

test('U7C-WU4-08 live zero-stock items keep media operations available without blocking the out-of-stock listing', () => withDb(async (db) => {
  const f = await seedUnit7cInventory(db, { quantityTotal: 1, quantityAvailable: 1 });
  const ac = await addPublicMedia(db, f, { role: 'actual_copy', order: 1 });
  await publishInventory(db, f);
  await adjustStock(db, f, -1);
  let s = await unit7cState(db, f);
  assert.equal(s.listings[0].status, 'out_of_stock');

  const removed = await removeMedia(db, f, ac.linkId, { inventoryVersion: 2 });
  assert.equal(removed.outcome, 'media_removed');
  s = await unit7cState(db, f);
  assert.equal(s.inventory.visibility_status, 'published');
  assert.equal(s.listings[0].status, 'out_of_stock');
}));
