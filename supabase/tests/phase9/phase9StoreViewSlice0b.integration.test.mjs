import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import { addPublicMedia, completePublicCopyDerivative, linkPublicCopyDerivative } from './unit7bFixture.mjs';
import {
  publishInventory, registerStoreViewCopySource, removeMedia, reorderMedia,
  replaceMedia, seedUnit7cInventory, storeViewMedia, unit7cMediaState,
} from './unit7cFixture.mjs';
import fs from 'node:fs';
import { applySlice0b, cloneSlice0bDerivative, createStoreViewSlice0bDatabase, SLICE0B } from './storeViewSlice0bFixture.mjs';

async function withDb(run, options) {
  const db = await createStoreViewSlice0bDatabase(options);
  try { await run(db); } finally { await db.close(); }
}

async function approvedUpload(db, f, options = {}) {
  const source = await registerStoreViewCopySource(db, f, {
    role: 'actual_copy', ordinal: 1, operationKind: 'add', ...options,
  });
  return completePublicCopyDerivative(db, f, source);
}

async function linkedUpload(db, f, options) {
  const upload = await approvedUpload(db, f, options);
  const linkId = await linkPublicCopyDerivative(db, f, upload);
  return { ...upload, linkId, assetId: upload.completed.media_asset_id };
}

for (const size of [2, 3]) {
  test(`Slice0b reorder ${size} live photos records positions, version, revision semantics, audit/event and exact replay`, () => withDb(async (db) => {
    const f = await seedUnit7cInventory(db);
    const photos = [];
    // Only one primary fallback is legal. Gallery order is absent from the
    // existing public snapshot, so reorder must not force a duplicate revision.
    for (let i = 1; i <= size; i++) photos.push(await addPublicMedia(db, f, {
      role: i === 1 ? 'primary_fallback' : 'actual_copy', order: i,
    }));
    await publishInventory(db, f);
    const before = await unit7cMediaState(db, f);
    const order = size === 2
      ? [photos[1].linkId, photos[0].linkId]
      : [photos[2].linkId, photos[1].linkId, photos[0].linkId];
    const commandId = randomUUID();
    const idempotencyKey = `slice0b-${randomUUID()}`;
    const result = await reorderMedia(db, f, order, { commandId, idempotencyKey });
    assert.equal(result.outcome, 'media_reordered');
    assert.equal(result.inventoryVersion, 2);
    assert.equal(result.publicRevisionNumber, null);
    assert.deepEqual(result.mediaLinkIds, order);
    const after = await unit7cMediaState(db, f);
    assert.deepEqual(after.links.map(l => l.id), order);
    assert.deepEqual(after.links.map(l => l.public_order), size === 2 ? [1, 2] : [1, 2, 3]);
    assert.equal(after.inventory.version, 2);
    assert.equal(after.inventory.visibility_status, 'published');
    assert.equal(after.listing.primary_public_media_id, photos[0].assetId);
    assert.deepEqual(after.revisions, before.revisions);
    assert.equal(after.audits, before.audits + 1);
    assert.equal(after.events, before.events + 1);
    await resetActor(db);
    const audit = (await db.query(`SELECT action,details FROM public.marketplace_audit_logs
      WHERE entity_id='${f.inventoryId}' AND details->>'commandId'='${commandId}'`)).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, 'phase9.inventory.media_reordered');
    assert.deepEqual(audit[0].details.mediaLinkIds, order);
    const event = (await db.query(`SELECT event_type,payload FROM public.marketplace_events
      WHERE entity_id='${f.inventoryId}' AND payload->>'commandId'='${commandId}'`)).rows;
    assert.equal(event.length, 1);
    assert.equal(event[0].event_type, 'inventory.media.reordered');
    assert.equal(event[0].payload.inventoryVersion, 2);
    const replayRow = (await db.query(`SELECT * FROM public.phase9_idempotency_keys
      WHERE idempotency_key='${idempotencyKey}'`)).rows;
    assert.equal(replayRow.length, 1);
    assert.equal(replayRow[0].operation, 'U7CC03');
    assert.equal(replayRow[0].status, 'completed');
    assert.deepEqual(replayRow[0].canonical_response, result);
    await setActor(db, f.ownerId);
    const replay = await reorderMedia(db, f, order, { commandId, idempotencyKey });
    assert.deepEqual(replay, result);
    assert.deepEqual(await unit7cMediaState(db, f), after);
    await assert.rejects(reorderMedia(db, f, [...order].reverse(), {
      commandId, idempotencyKey,
    }), /P9_IDEMPOTENCY/);
  }));
}

test('Slice0b reorder appends a media_change revision when no prior public snapshot exists', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  await resetActor(db);
  // Legacy published fixture: the projection exists but history has no row.
  await db.exec(`UPDATE public.store_inventory SET visibility_status='published',
    publication_status='published' WHERE id='${f.inventoryId}'`);
  await setActor(db, f.ownerId);
  assert.equal((await unit7cMediaState(db, f)).revisions.length, 0);
  const result = await reorderMedia(db, f, [b.linkId, a.linkId]);
  assert.equal(result.publicRevisionNumber, 1);
  const state = await unit7cMediaState(db, f);
  assert.equal(state.revisions.length, 1);
  assert.equal(state.revisions[0].source_action, 'media_change');
}));

for (const order of [[1, 0, 2], [0, 2, 1], [1, 2, 0], [2, 0, 1]]) {
  test(`Slice0b three occupied slots permit permutation ${order.join('-')}`, () => withDb(async db => {
    const f = await seedUnit7cInventory(db);
    const photos = [];
    for (let i = 1; i <= 3; i++) photos.push(await addPublicMedia(db, f, { order: i }));
    const ids = order.map(i => photos[i].linkId);
    await reorderMedia(db, f, ids);
    const state = await unit7cMediaState(db, f);
    assert.deepEqual(state.links.map(l => l.id), ids);
    assert.deepEqual(state.links.map(l => l.public_order), [1, 2, 3]);
    assert.equal(state.revisions.length, 0);
  }));
}

for (const size of [1, 2, 3]) {
  test(`Slice0b same order with ${size} photos is P9_NO_CHANGES without effects`, () => withDb(async db => {
    const f = await seedUnit7cInventory(db);
    const ids = [];
    for (let i = 1; i <= size; i++) ids.push((await addPublicMedia(db, f, { order: i })).linkId);
    const before = await unit7cMediaState(db, f);
    await assert.rejects(reorderMedia(db, f, ids), /P9_NO_CHANGES/);
    assert.deepEqual(await unit7cMediaState(db, f), before);
  }));
}

test('Slice0b direct eligible NULL/out-of-range orders remain rejected after reorder inside the same transaction', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  await db.exec('BEGIN');
  await reorderMedia(db, f, [b.linkId, a.linkId]);
  await resetActor(db);
  assert.notEqual(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'on');
  for (const value of ['NULL', '0', '4']) {
    await db.exec('SAVEPOINT bad_order');
    await assert.rejects(db.exec(`UPDATE public.inventory_media_links SET public_order=${value}
      WHERE id='${a.linkId}'`), /P9_PUBLIC_MEDIA_ORDER_REQUIRED/);
    await db.exec('ROLLBACK TO SAVEPOINT bad_order');
  }
  await db.exec('COMMIT');
  await setActor(db, f.ownerId);
}));

test('Slice0b direct eligible NULL is rejected before any reorder', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photo = await addPublicMedia(db, f);
  await resetActor(db);
  await assert.rejects(db.exec(`UPDATE public.inventory_media_links SET public_order=NULL
    WHERE id='${photo.linkId}'`), /P9_PUBLIC_MEDIA_ORDER_REQUIRED/);
}));

test('Slice0b store A owner cannot reorder or read store B photos', () => withDb(async db => {
  const a = await seedUnit7cInventory(db);
  const b = await seedUnit7cInventory(db);
  const p = await addPublicMedia(db, b, { order: 1 });
  const q = await addPublicMedia(db, b, { order: 2 });
  const before = await unit7cMediaState(db, b);
  await setActor(db, a.ownerId);
  await assert.rejects(reorderMedia(db, b, [q.linkId, p.linkId]), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(storeViewMedia(db, b.inventoryId), /P9_OWNER_NOT_AUTHORIZED/);
  assert.deepEqual(await unit7cMediaState(db, b), before);
}));

test('Slice0b reorder preserves hidden pending links and version/request checks', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  const hidden = await addPublicMedia(db, f, { order: 3, approvalStatus: 'pending' });
  await assert.rejects(reorderMedia(db, f, [b.linkId, a.linkId], { inventoryVersion: 99 }), /P9_VERSION_CONFLICT/);
  for (const ids of [[a.linkId], [a.linkId, a.linkId], [a.linkId, b.linkId, hidden.linkId]]) {
    await assert.rejects(reorderMedia(db, f, ids), /P9_REQUEST_INVALID/);
  }
  await reorderMedia(db, f, [b.linkId, a.linkId]);
  const state = await unit7cMediaState(db, f);
  assert.deepEqual(state.links.map(l => l.id), [b.linkId, a.linkId, hidden.linkId]);
  assert.equal(state.links[2].approval_status, 'pending');
  assert.equal(state.links[2].public_order, 3);
}));

test('Slice0b assignment failure rolls back positions, flag, version and all effects', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  const before = await unit7cMediaState(db, f);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION marketplace_sec.slice0b_assignment_fault() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.public_order=2 THEN RAISE EXCEPTION 'SLICE0B_ASSIGNMENT_FAULT'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER slice0b_assignment_fault BEFORE UPDATE ON public.inventory_media_links
      FOR EACH ROW EXECUTE FUNCTION marketplace_sec.slice0b_assignment_fault()`);
  await setActor(db, f.ownerId);
  await assert.rejects(reorderMedia(db, f, [b.linkId, a.linkId]), /SLICE0B_ASSIGNMENT_FAULT/);
  assert.deepEqual(await unit7cMediaState(db, f), before);
  assert.notEqual(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'on');
}));

test('Slice0b final assertion rejects silently incomplete assignment and rolls everything back', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  const before = await unit7cMediaState(db, f);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION marketplace_sec.slice0b_skip_assignment() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.public_order=2 THEN
        PERFORM nextval('marketplace_sec.slice0b_skip_marker');
        RETURN NULL;
      END IF;
      RETURN NEW;
    END $$;
    CREATE SEQUENCE marketplace_sec.slice0b_skip_marker;
    CREATE TRIGGER slice0b_skip_assignment BEFORE UPDATE ON public.inventory_media_links
      FOR EACH ROW EXECUTE FUNCTION marketplace_sec.slice0b_skip_assignment()`);
  await setActor(db, f.ownerId);
  let failure;
  try { await reorderMedia(db, f, [b.linkId, a.linkId]); }
  catch (error) { failure = error; }
  await resetActor(db);
  // Sequence advancement survives statement rollback, proving the fault ran.
  assert.equal(await scalar(db, `SELECT is_called FROM marketplace_sec.slice0b_skip_marker`), true);
  assert.ok(failure, 'Missing expected rejection.');
  assert.match(failure.message, /P9_PUBLIC_MEDIA_ORDER_REQUIRED/);
  assert.deepEqual(await unit7cMediaState(db, f), before);
  assert.notEqual(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'on');
}));

test('Slice0b owner reader hides the derivative after ADD then REMOVE', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photo = await linkedUpload(db, f);
  await removeMedia(db, f, photo.linkId);
  const media = await storeViewMedia(db, f.inventoryId);
  assert.deepEqual(media.media, []);
  assert.deepEqual(media.pendingReplacements, []);
}));

test('Slice0b genuine approved upload that was never linked remains pending/approved', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const upload = await approvedUpload(db, f);
  const media = await storeViewMedia(db, f.inventoryId);
  assert.equal(media.pendingReplacements.length, 1);
  assert.equal(media.pendingReplacements[0].capabilityId, upload.authorization.capabilityId);
  assert.equal(media.pendingReplacements[0].mediaAssetId, upload.completed.media_asset_id);
  assert.equal(media.pendingReplacements[0].state, 'approved');
  assert.equal(media.pendingReplacements[0].operationKind, 'add');
  await linkPublicCopyDerivative(db, f, upload);
  assert.equal((await storeViewMedia(db, f.inventoryId)).pendingReplacements.length, 0);
}));

test('Slice0b pending issued, processing and failed uploads keep their states', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const source = await registerStoreViewCopySource(db, f, {
    role: 'actual_copy', ordinal: 1, operationKind: 'add',
  });
  assert.equal((await storeViewMedia(db, f.inventoryId)).pendingReplacements[0].state, 'processing');
  await setActor(db, f.ownerId, 'service_role');
  const claim = (await db.query(`SELECT * FROM public.claim_phase9_media_validation_jobs(1,'slice0b-worker-000001')`)).rows[0];
  await scalar(db, `SELECT public.phase9_fail_media_validation_v2(
    '${claim.id}','slice0b-worker-000001','${claim.lease_token}',${claim.attempt_count},
    false,'P9_MEDIA_MIME_MISMATCH')`);
  await setActor(db, f.ownerId);
  let pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
  assert.equal(pending[0].state, 'failed');
  assert.equal(pending[0].capabilityId, source.authorization.capabilityId);
  assert.equal(pending[0].safeErrorCode, 'P9_MEDIA_MIME_MISMATCH');
  const issued = await scalar(db, `SELECT public.phase9_authorize_store_view_media_upload_v1(
    '${f.inventoryId}','actual_copy',2,'add',NULL,'image/png',128,'${'b'.repeat(64)}',
    transaction_timestamp()+interval '10 minutes','slice0b-auth-${randomUUID()}','${randomUUID()}')`);
  pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
  assert.equal(pending.find(p => p.capabilityId === issued.capabilityId).state, 'upload_pending');
}));

test('Slice0b REPLACE excludes old ADD and old REPLACE capabilities across a replacement chain', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const original = await linkedUpload(db, f);
  const replacement = await approvedUpload(db, f, { operationKind: 'replace', targetLinkId: original.linkId });
  await replaceMedia(db, f, replacement.authorization.capabilityId,
    replacement.completed.media_asset_id, original.linkId);
  let media = await storeViewMedia(db, f.inventoryId);
  assert.equal(media.media[0].mediaAssetId, replacement.completed.media_asset_id);
  assert.deepEqual(media.pendingReplacements, []);
  const next = await approvedUpload(db, f, { operationKind: 'replace', targetLinkId: original.linkId });
  await replaceMedia(db, f, next.authorization.capabilityId,
    next.completed.media_asset_id, original.linkId, { inventoryVersion: 2 });
  media = await storeViewMedia(db, f.inventoryId);
  assert.equal(media.media[0].mediaAssetId, next.completed.media_asset_id);
  assert.deepEqual(media.pendingReplacements, []);
  await resetActor(db);
  const caps = (await db.query(`SELECT operation_kind,status FROM public.phase9_upload_capabilities
    WHERE bound_entity_id='${f.inventoryId}' ORDER BY created_at,id`)).rows;
  assert.equal(caps.filter(c => c.operation_kind === 'add' && c.status === 'consumed').length, 1);
  assert.equal(caps.filter(c => c.operation_kind === 'replace' && c.status === 'consumed').length, 2);
}));

test('Slice0b pre-migration removal is suppressed immediately without a data backfill', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photo = await linkedUpload(db, f);
  await removeMedia(db, f, photo.linkId);
  assert.equal((await storeViewMedia(db, f.inventoryId)).pendingReplacements[0].mediaAssetId, photo.assetId);
  await resetActor(db);
  await applySlice0b(db);
  await setActor(db, f.ownerId);
  assert.deepEqual((await storeViewMedia(db, f.inventoryId)).pendingReplacements, []);
}, { includeFix: false }));

test('Slice0b removal excludes only its upload and stays excluded after asset retirement', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const old = await linkedUpload(db, f);
  const fresh = await approvedUpload(db, f, { ordinal: 2 });
  await removeMedia(db, f, old.linkId);
  await resetActor(db);
  await db.exec(`UPDATE public.media_assets SET lifecycle_status='delete_pending' WHERE id='${old.assetId}'`);
  await setActor(db, f.ownerId);
  const pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].mediaAssetId, fresh.completed.media_asset_id);
  assert.equal(pending[0].state, 'approved');
}));

test('Slice0b other-store or other-inventory audit rows cannot hide a genuine approved upload', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const upload = await approvedUpload(db, f);
  const other = await seedUnit7cInventory(db);
  await resetActor(db);
  await db.exec(`INSERT INTO public.marketplace_audit_logs(store_id,action,entity_type,entity_id,actor_user_id,details)
    VALUES('${other.storeId}','phase9.inventory.media_removed','store_inventory','${f.inventoryId}',
      '${other.ownerId}',jsonb_build_object('mediaAssetId','${upload.completed.media_asset_id}')),
      ('${f.storeId}','phase9.inventory.media_removed','store_inventory','${other.inventoryId}',
      '${f.ownerId}',jsonb_build_object('mediaAssetId','${upload.completed.media_asset_id}'))`);
  await setActor(db, f.ownerId);
  const pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].mediaAssetId, upload.completed.media_asset_id);
}));

test('Slice0b CREATE OR REPLACE preserves signatures, postgres owner, ACLs, SECURITY DEFINER and empty search_path', () => withDb(async db => {
  const metadataSql = `SELECT p.oid::text,p.oid::regprocedure::text signature,
    pg_get_userbyid(p.proowner) owner,p.proacl::text,p.prosecdef,p.proconfig,p.provolatile
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='marketplace_sec' AND p.proname IN
      ('validate_inventory_media_link','phase9_owner_media_records_v1'))
      OR (n.nspname='public' AND p.proname IN
        ('phase9_reorder_store_view_media_v1','phase9_remove_store_view_media_v1'))
    ORDER BY n.nspname,p.proname`;
  const before = (await db.query(metadataSql)).rows;
  const removeDefinition = await scalar(db, `SELECT pg_get_functiondef(
    'public.phase9_remove_store_view_media_v1(uuid,integer,uuid,text,uuid)'::regprocedure)`);
  assert.equal(before.length, 4);
  assert.ok(before.every(p => p.owner === 'postgres' && p.prosecdef && p.proconfig.includes('search_path=""')));
  await applySlice0b(db);
  assert.deepEqual((await db.query(metadataSql)).rows, before);
  assert.equal(await scalar(db, `SELECT pg_get_functiondef(
    'public.phase9_remove_store_view_media_v1(uuid,integer,uuid,text,uuid)'::regprocedure)`), removeDefinition);
  const migration = fs.readFileSync(`supabase/migrations/${SLICE0B}`, 'utf8');
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length, 3);
  assert.doesNotMatch(migration, /(?:CREATE OR REPLACE|ALTER) FUNCTION public\.phase9_remove_store_view_media_v1/);
  assert.equal(await scalar(db, `SELECT has_function_privilege('anon',
    'public.phase9_reorder_store_view_media_v1(uuid,integer,uuid[],text,uuid)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated',
    'marketplace_sec.phase9_owner_media_records_v1(public.store_inventory)','EXECUTE')`), false);
}, { includeFix: false }));

for (const hiddenOrder of [1, 2, 3]) {
  test(`Slice0b hidden slot ${hiddenOrder}: two eligible reorder, approval, then three-photo reorder`, () => withDb(async db => {
    const f = await seedUnit7cInventory(db);
    const photos = [];
    for (let order = 1; order <= 3; order++) photos.push(await addPublicMedia(db, f, {
      order, approvalStatus: order === hiddenOrder ? 'pending' : 'approved',
    }));
    const hidden = photos[hiddenOrder - 1];
    const eligible = photos.filter(p => p !== hidden).reverse();
    await reorderMedia(db, f, eligible.map(p => p.linkId));
    let state = await unit7cMediaState(db, f);
    assert.deepEqual(state.links.map(l => l.id), [...eligible.map(p => p.linkId), hidden.linkId]);
    assert.deepEqual(state.links.map(l => l.public_order), [1, 2, 3]);
    assert.equal(state.links[2].approval_status, 'pending');
    assert.equal(state.links[2].media_asset_id, hidden.assetId);
    await resetActor(db);
    // M51 requires a valid unique order as soon as a hidden link is approved.
    await db.exec(`UPDATE public.inventory_media_links SET approval_status='approved'
      WHERE id='${hidden.linkId}'`);
    await setActor(db, f.ownerId);
    const all = [hidden.linkId, eligible[1].linkId, eligible[0].linkId];
    await reorderMedia(db, f, all, { inventoryVersion: 2 });
    state = await unit7cMediaState(db, f);
    assert.deepEqual(state.links.map(l => l.id), all);
    assert.deepEqual(state.links.map(l => l.public_order), [1, 2, 3]);
    assert.equal(state.inventory.version, 3);
  }));
}

test('Slice0b over-capacity hidden NULL link makes reorder fail atomically', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photos = [];
  for (let order = 1; order <= 3; order++) photos.push(await addPublicMedia(db, f, { order }));
  const extra = await approvedUpload(db, f);
  await resetActor(db);
  // CHECK/UNIQUE allow NULL pending orders; normal bounded UI has <=3 links.
  await db.exec(`INSERT INTO public.inventory_media_links
    (store_id,inventory_id,media_asset_id,role,public_order,approval_status)
    VALUES('${f.storeId}','${f.inventoryId}','${extra.completed.media_asset_id}',
      'actual_copy',NULL,'pending')`);
  const before = await unit7cMediaState(db, f);
  await assert.rejects(reorderMedia(db, f, photos.reverse().map(p => p.linkId)), /P9_REQUEST_INVALID/);
  assert.deepEqual(await unit7cMediaState(db, f), before);
}));

for (const lifecycle of ['held', 'delete_pending']) {
  for (const hiddenOrder of [1, 2, 3]) {
    test(`Slice0b ${lifecycle} asset in hidden slot ${hiddenOrder}: preserve or reject clearly`, () => withDb(async db => {
      const f = await seedUnit7cInventory(db);
      const photos = [];
      for (let order = 1; order <= 3; order++) photos.push(await addPublicMedia(db, f, { order }));
      const hidden = photos[hiddenOrder - 1];
      const eligible = photos.filter(p => p !== hidden).reverse().map(p => p.linkId);
      await resetActor(db);
      await db.exec(`UPDATE public.media_assets SET lifecycle_status='${lifecycle}' WHERE id='${hidden.assetId}'`);
      const hiddenBefore = (await db.query(`SELECT * FROM public.inventory_media_links WHERE id='${hidden.linkId}'`)).rows;
      const before = await unit7cMediaState(db, f);
      await setActor(db, f.ownerId);
      if (hiddenOrder < 3) {
        await assert.rejects(reorderMedia(db, f, eligible), /P9_MEDIA_CHANGE_UNSAFE/);
        assert.deepEqual(await unit7cMediaState(db, f), before);
      } else {
        await reorderMedia(db, f, eligible);
        const after = await unit7cMediaState(db, f);
        assert.deepEqual(after.links.map(l => l.id), [...eligible, hidden.linkId]);
        assert.deepEqual(after.links.map(l => l.public_order), [1, 2, 3]);
        assert.equal(after.inventory.version, 2);
      }
      await resetActor(db);
      assert.deepEqual((await db.query(`SELECT * FROM public.inventory_media_links WHERE id='${hidden.linkId}'`)).rows, hiddenBefore);
      // The asset guard stays strict even when the coordination flag is forged.
      await db.exec(`SELECT set_config('phase9.media_reorder','on',false)`);
      await assert.rejects(db.exec(`UPDATE public.inventory_media_links SET public_order=public_order
        WHERE id='${hidden.linkId}'`), /P9_MEDIA_NOT_APPROVED/);
      await db.exec(`SELECT set_config('phase9.media_reorder','off',false)`);
    }));
  }
}

test('Slice0b hidden asset with NULL validation fails reorder atomically with P9_MEDIA_CHANGE_UNSAFE', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photos = [];
  for (let order = 1; order <= 3; order++) photos.push(await addPublicMedia(db, f, {
    order, approvalStatus: order === 1 ? 'pending' : 'approved',
  }));
  const hidden = photos[0];
  const eligible = [photos[2].linkId, photos[1].linkId];
  await resetActor(db);
  await db.exec(`UPDATE public.media_assets SET validation_version=NULL WHERE id='${hidden.assetId}'`);
  await setActor(db, f.ownerId);
  const before = await unit7cMediaState(db, f);
  await assert.rejects(reorderMedia(db, f, eligible), /P9_MEDIA_CHANGE_UNSAFE/);
  assert.deepEqual(await unit7cMediaState(db, f), before);
}));

test('Slice0b pending derivative with deleted_at set is skipped for older valid derivative', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const upload = await approvedUpload(db, f);
  const olderId = upload.completed.media_asset_id;
  await resetActor(db);
  const newerId = await cloneSlice0bDerivative(db, olderId, { seconds: 1 });
  await db.exec(`UPDATE public.media_assets SET deleted_at=transaction_timestamp() WHERE id='${newerId}'`);
  await setActor(db, f.ownerId);
  const pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].mediaAssetId, olderId);
  assert.equal(pending[0].state, 'approved');
}));

for (const seconds of [-1, 0, 1]) {
  test(`Slice0b never-linked B at offset ${seconds} stays pending after removed A`, () => withDb(async db => {
    const f = await seedUnit7cInventory(db);
    const old = await linkedUpload(db, f);
    await removeMedia(db, f, old.linkId);
    await resetActor(db);
    const freshId = await cloneSlice0bDerivative(db, old.assetId, { seconds });
    await setActor(db, f.ownerId);
    const pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
    assert.equal(pending.length, 1);
    assert.equal(pending[0].capabilityId, old.authorization.capabilityId);
    assert.equal(pending[0].mediaAssetId, freshId);
    assert.equal(pending[0].state, 'approved');
    await resetActor(db);
    await db.exec(`UPDATE public.media_assets SET lifecycle_status='deleted' WHERE id='${old.assetId}'`);
    await setActor(db, f.ownerId);
    assert.equal((await storeViewMedia(db, f.inventoryId)).pendingReplacements[0].mediaAssetId, freshId);
  }));
}

test('Slice0b linked newer A cannot hide an older never-linked B', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const linked = await linkedUpload(db, f);
  await resetActor(db);
  const freshId = await cloneSlice0bDerivative(db, linked.assetId, { seconds: -1 });
  await setActor(db, f.ownerId);
  const pending = (await storeViewMedia(db, f.inventoryId)).pendingReplacements;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].mediaAssetId, freshId);
}));

test('Slice0b tied pending derivatives use deterministic ID ordering after filtering retired A', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const old = await linkedUpload(db, f);
  await removeMedia(db, f, old.linkId);
  await resetActor(db);
  const lower = '00000000-0000-4000-8000-000000000001';
  const higher = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  await cloneSlice0bDerivative(db, old.assetId, { id: lower });
  await cloneSlice0bDerivative(db, old.assetId, { id: higher });
  await setActor(db, f.ownerId);
  assert.equal((await storeViewMedia(db, f.inventoryId)).pendingReplacements[0].mediaAssetId, higher);
}));

for (const status of ['approved', 'delete_pending', 'deleted']) {
  test(`Slice0b lone removed derivative stays hidden at lifecycle ${status}`, () => withDb(async db => {
    const f = await seedUnit7cInventory(db);
    const old = await linkedUpload(db, f);
    await removeMedia(db, f, old.linkId);
    await resetActor(db);
    await db.exec(`UPDATE public.media_assets SET lifecycle_status='${status}'
      WHERE id='${old.assetId}'`);
    await setActor(db, f.ownerId);
    assert.deepEqual((await storeViewMedia(db, f.inventoryId)).pendingReplacements, []);
  }));
}

test('Slice0b KNOWN ISSUE: ADD -> REPLACE -> REMOVE is rejected by the pre-existing capability FK', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const original = await linkedUpload(db, f);
  const next = await approvedUpload(db, f, { operationKind: 'replace', targetLinkId: original.linkId });
  await replaceMedia(db, f, next.authorization.capabilityId,
    next.completed.media_asset_id, original.linkId);
  const before = await unit7cMediaState(db, f);
  // Expected failure, actively asserted (not skipped/todo). A future fix must
  // deliberately retire this known-issue contract rather than silently XPASS.
  await assert.rejects(removeMedia(db, f, original.linkId, { inventoryVersion: 2 }), error => {
    assert.equal(error.code, '23503');
    assert.equal(error.constraint, 'phase9_upload_capabilities_target_media_link_id_fkey');
    return true;
  });
  assert.deepEqual(await unit7cMediaState(db, f), before);
}));

test('Slice0b caller-forged reorder flag does not grant table write privileges', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photo = await addPublicMedia(db, f);
  await db.exec('BEGIN');
  for (const role of ['anon', 'authenticated']) {
    await setActor(db, f.ownerId, role);
    await db.exec(`SELECT set_config('phase9.media_reorder','on',true)`);
    assert.equal(await scalar(db, `SELECT has_table_privilege(current_user,
      'public.inventory_media_links','UPDATE')`), false);
    await db.exec('SAVEPOINT forged_flag');
    await assert.rejects(db.exec(`UPDATE public.inventory_media_links SET public_order=NULL
      WHERE id='${photo.linkId}'`), /permission denied/);
    await db.exec('ROLLBACK TO SAVEPOINT forged_flag');
  }
  await setActor(db, f.ownerId, 'service_role');
  assert.equal(await scalar(db, `SELECT has_table_privilege(current_user,
    'public.inventory_media_links','UPDATE')`), true);
  // Privileged writers can forge the coordination flag; it is not authorization.
  await db.exec(`SELECT set_config('phase9.media_reorder','on',true);
    UPDATE public.inventory_media_links SET public_order=NULL WHERE id='${photo.linkId}'`);
  assert.equal(await scalar(db, `SELECT public_order FROM public.inventory_media_links WHERE id='${photo.linkId}'`), null);
  await db.exec('ROLLBACK');
}));

test('Slice0b caught assignment error in the same transaction leaves reorder flag off', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  const before = await unit7cMediaState(db, f);
  await resetActor(db);
  await db.exec(`CREATE FUNCTION marketplace_sec.slice0b_caught_fault() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.public_order=2 THEN RAISE EXCEPTION 'SLICE0B_CAUGHT_FAULT'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER slice0b_caught_fault BEFORE UPDATE ON public.inventory_media_links
      FOR EACH ROW EXECUTE FUNCTION marketplace_sec.slice0b_caught_fault()`);
  await setActor(db, f.ownerId);
  await db.exec(`BEGIN; SELECT set_config('phase9.media_reorder','off',true);
    DO $$ BEGIN
      PERFORM public.phase9_reorder_store_view_media_v1('${f.inventoryId}',1,
        ARRAY['${b.linkId}','${a.linkId}']::uuid[],'caught-${randomUUID()}','${randomUUID()}');
      RAISE EXCEPTION 'SLICE0B_EXPECTED_FAILURE';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM<>'SLICE0B_CAUGHT_FAULT' THEN RAISE; END IF;
    END $$`);
  assert.equal(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'off');
  await db.exec('COMMIT');
  assert.deepEqual(await unit7cMediaState(db, f), before);
}));

test('Slice0b success and replay clear a caller-supplied on flag in the same transaction', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  const options = { commandId: randomUUID(), idempotencyKey: `flag-${randomUUID()}` };
  await db.exec('BEGIN');
  await db.exec(`SELECT set_config('phase9.media_reorder','on',true)`);
  const result = await reorderMedia(db, f, [b.linkId, a.linkId], options);
  assert.equal(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'off');
  await db.exec(`SELECT set_config('phase9.media_reorder','on',true)`);
  assert.deepEqual(await reorderMedia(db, f, [b.linkId, a.linkId], options), result);
  assert.equal(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'off');
  await db.exec('COMMIT');
}));

test('Slice0b caught validation, owner, version, request and no-change errors leave the flag off', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const a = await addPublicMedia(db, f, { order: 1 });
  const b = await addPublicMedia(db, f, { order: 2 });
  const before = await unit7cMediaState(db, f);
  const cases = [
    [f.inventoryId, 1, 'NULL', 'P9_REQUEST_INVALID'],
    [randomUUID(), 1, `ARRAY['${b.linkId}','${a.linkId}']::uuid[]`, 'P9_OWNER_NOT_AUTHORIZED'],
    [f.inventoryId, 99, `ARRAY['${b.linkId}','${a.linkId}']::uuid[]`, 'P9_VERSION_CONFLICT'],
    [f.inventoryId, 1, `ARRAY['${a.linkId}']::uuid[]`, 'P9_REQUEST_INVALID'],
    [f.inventoryId, 1, `ARRAY['${a.linkId}','${b.linkId}']::uuid[]`, 'P9_NO_CHANGES'],
  ];
  await db.exec(`BEGIN; SELECT set_config('phase9.media_reorder','off',true)`);
  for (const [inventory, version, ids, message] of cases) {
    await db.exec(`DO $$ BEGIN
      PERFORM public.phase9_reorder_store_view_media_v1('${inventory}',${version},${ids},
        'flag-error-${randomUUID()}','${randomUUID()}');
      RAISE EXCEPTION 'SLICE0B_EXPECTED_FAILURE';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM<>'${message}' THEN RAISE; END IF;
    END $$`);
    assert.equal(await scalar(db, `SELECT current_setting('phase9.media_reorder',true)`), 'off');
  }
  await db.exec('COMMIT');
  assert.deepEqual(await unit7cMediaState(db, f), before);
}));
