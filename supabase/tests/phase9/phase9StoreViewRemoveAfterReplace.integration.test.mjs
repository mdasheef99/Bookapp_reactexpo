// Remove-after-replace integration + migration-text coverage.
// Run again with PHASE9_REMOVEFIX_RECEIPTS=1 to cover the output-intent /
// completion-receipt path (migrations 57-59); the default run uses the older
// migration 40 validation path.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  addPublicMedia, completePublicCopyDerivative, linkPublicCopyDerivative,
} from './unit7bFixture.mjs';
import {
  registerStoreViewCopySource, removeMedia, replaceMedia, seedUnit7cInventory,
  storeViewMedia, unit7cMediaState,
} from './unit7cFixture.mjs';
import { createStoreViewSlice0bDatabase, SLICE0B } from './storeViewSlice0bFixture.mjs';
import { mediaCorrectionMigrations } from './mediaCorrectionFixture.mjs';

const REMOVEFIX = '20261103100000_store_view_remove_after_replace.sql';
const preMigration = process.env.PHASE9_REMOVEFIX_PRE_MIGRATION === '1';
// PHASE9_REMOVEFIX_RECEIPTS=1 loads migrations 57-59 (media output intents,
// completion receipts, cleanup) first, so the same cases run on the database
// shape the live project has. The default stays the older path.
const withReceipts = process.env.PHASE9_REMOVEFIX_RECEIPTS === '1';
const migrationSql = () => fs.readFileSync(migrationPath(REMOVEFIX), 'utf8');

async function withDb(run, { includeFix = true } = {}) {
  const db = await createStoreViewSlice0bDatabase({ includeFix: false });
  try {
    if (withReceipts) {
      for (const name of mediaCorrectionMigrations) {
        await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
      }
    }
    // Always include Slice 0b, even if its own pre-migration switch is set.
    await db.exec(fs.readFileSync(migrationPath(SLICE0B), 'utf8'));
    if (includeFix && !preMigration) await db.exec(migrationSql());
    await run(db);
  } finally {
    await db.close();
  }
}

async function approvedUpload(db, f, options = {}) {
  const source = await registerStoreViewCopySource(db, f, {
    role: 'actual_copy', ordinal: 1, operationKind: 'add', ...options,
  });
  return completePublicCopyDerivative(db, f, source);
}

async function linkedUpload(db, f) {
  const upload = await approvedUpload(db, f);
  const linkId = await linkPublicCopyDerivative(db, f, upload);
  return { ...upload, linkId, assetId: upload.completed.media_asset_id };
}

async function capability(db, f, id) {
  await resetActor(db);
  const row = (await db.query(`SELECT * FROM public.phase9_upload_capabilities
    WHERE id=$1`, [id])).rows[0];
  await setActor(db, f.ownerId);
  return row;
}

async function ownerMediaRecords(db, f) {
  // The private helper is postgres-only; exercise it as the fixture admin,
  // then restore the owner for the public command/read surfaces.
  await resetActor(db);
  const result = await scalar(db, `SELECT marketplace_sec.phase9_owner_media_records_v1(i)
    FROM public.store_inventory i WHERE i.id='${f.inventoryId}'`);
  await setActor(db, f.ownerId);
  return result;
}

async function removeWithReplacementTarget(db, f, linkId, options) {
  if (!preMigration) return removeMedia(db, f, linkId, options);
  const before = await unit7cMediaState(db, f);
  await assert.rejects(removeMedia(db, f, linkId, options), error => {
    assert.equal(error.code, '23503');
    assert.equal(error.constraint, 'phase9_upload_capabilities_target_media_link_id_fkey');
    return true;
  });
  assert.deepEqual(await unit7cMediaState(db, f), before);
  return null;
}

async function assertRemoval(db, f, photo, before, result, commandId) {
  assert.equal(result.outcome, 'media_removed');
  assert.equal(result.inventoryId, f.inventoryId);
  assert.equal(result.inventoryVersion, before.inventory.version + 1);
  assert.equal(result.removedMediaAssetId, photo.assetId);
  assert.equal(result.publicRevisionNumber, null);
  const after = await unit7cMediaState(db, f);
  assert.equal(after.inventory.version, result.inventoryVersion);
  assert.equal(after.links.some(l => l.id === photo.linkId), false);
  assert.deepEqual(after.revisions, before.revisions);
  assert.equal(after.audits, before.audits + 1);
  assert.equal(after.events, before.events + 1);
  await resetActor(db);
  const audits = (await db.query(`SELECT action,details FROM public.marketplace_audit_logs
    WHERE entity_id=$1 AND details->>'commandId'=$2`, [f.inventoryId, commandId])).rows;
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'phase9.inventory.media_removed');
  assert.equal(audits[0].details.mediaAssetId, photo.assetId);
  assert.equal(audits[0].details.inventoryVersion, result.inventoryVersion);
  const events = (await db.query(`SELECT event_type,payload FROM public.marketplace_events
    WHERE entity_id=$1 AND payload->>'commandId'=$2`, [f.inventoryId, commandId])).rows;
  assert.equal(events.length, 1);
  assert.equal(events[0].event_type, 'inventory.media.removed');
  assert.equal(events[0].payload.inventoryVersion, result.inventoryVersion);
  await setActor(db, f.ownerId);
  return after;
}

test('Removefix ADD -> REPLACE -> REMOVE keeps capability history, hides retired media and replays exactly', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const original = await linkedUpload(db, f);
  const replacement = await approvedUpload(db, f, {
    operationKind: 'replace', targetLinkId: original.linkId,
  });
  const replaced = await replaceMedia(db, f, replacement.authorization.capabilityId,
    replacement.completed.media_asset_id, original.linkId);
  assert.equal(replaced.outcome, 'media_replaced');
  assert.equal(replaced.inventoryVersion, 2);
  assert.equal(replaced.mediaLinkId, original.linkId);
  const historicalCapability = await capability(db, f, replacement.authorization.capabilityId);
  assert.equal(historicalCapability.operation_kind, 'replace');
  assert.equal(historicalCapability.target_media_link_id, original.linkId);
  assert.equal(historicalCapability.status, 'consumed');
  const before = await unit7cMediaState(db, f);
  assert.equal(before.links.length, 1);
  assert.equal(before.links[0].media_asset_id, replacement.completed.media_asset_id);
  const options = {
    inventoryVersion: 2, commandId: randomUUID(), idempotencyKey: `removefix-${randomUUID()}`,
  };
  const result = await removeWithReplacementTarget(db, f, original.linkId, options);
  if (preMigration) return;
  const after = await assertRemoval(db, f, {
    linkId: original.linkId, assetId: replacement.completed.media_asset_id,
  }, before, result, options.commandId);
  assert.equal(result.inventoryVersion, 3);
  assert.deepEqual(after.links, []);
  assert.deepEqual(await capability(db, f, replacement.authorization.capabilityId), historicalCapability);
  const records = await ownerMediaRecords(db, f);
  assert.deepEqual(records.media, []);
  // Neither the retired ADD derivative nor the removed REPLACE derivative
  // may reappear as a pending upload or replacement.
  assert.deepEqual(records.pendingReplacements, []);
  const publicRead = await storeViewMedia(db, f.inventoryId);
  assert.deepEqual(publicRead.media, []);
  assert.deepEqual(publicRead.pendingReplacements, []);
  await resetActor(db);
  const replayRow = (await db.query(`SELECT operation,status,canonical_response
    FROM public.phase9_idempotency_keys WHERE idempotency_key=$1`, [options.idempotencyKey])).rows;
  assert.equal(replayRow.length, 1);
  assert.equal(replayRow[0].operation, 'U7CC04');
  assert.equal(replayRow[0].status, 'completed');
  assert.deepEqual(replayRow[0].canonical_response, result);
  await setActor(db, f.ownerId);
  // Reuse the original expected version as well as both command identities:
  // completed replay must win over the now-missing link and stale version.
  assert.deepEqual(await removeMedia(db, f, original.linkId, options), result);
  assert.deepEqual(await unit7cMediaState(db, f), after);
  assert.deepEqual(await capability(db, f, replacement.authorization.capabilityId), historicalCapability);
}));

test('Removefix REPLACE of an existing photo -> REMOVE succeeds (baseline asserts SQLSTATE 23503)', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const original = await addPublicMedia(db, f);
  const replacement = await approvedUpload(db, f, {
    operationKind: 'replace', targetLinkId: original.linkId,
  });
  const replaced = await replaceMedia(db, f, replacement.authorization.capabilityId,
    replacement.completed.media_asset_id, original.linkId);
  assert.equal(replaced.mediaLinkId, original.linkId);
  assert.equal(replaced.inventoryVersion, 2);
  const before = await unit7cMediaState(db, f);
  const commandId = randomUUID();
  const result = await removeWithReplacementTarget(db, f, original.linkId, { inventoryVersion: 2, commandId });
  if (preMigration) return;
  await assertRemoval(db, f, {
    linkId: original.linkId, assetId: replacement.completed.media_asset_id,
  }, before, result, commandId);
}));

test('Removefix consumed REPLACE capability cannot re-attach its derivative after removal', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const original = await linkedUpload(db, f);
  const replacement = await approvedUpload(db, f, {
    operationKind: 'replace', targetLinkId: original.linkId,
  });
  const replaced = await replaceMedia(db, f, replacement.authorization.capabilityId,
    replacement.completed.media_asset_id, original.linkId);
  assert.equal(replaced.mediaLinkId, original.linkId);
  const options = {
    inventoryVersion: 2, commandId: randomUUID(), idempotencyKey: `removefix-resubmit-${randomUUID()}`,
  };
  const result = await removeWithReplacementTarget(db, f, original.linkId, options);
  if (preMigration) return;
  assert.equal(result.outcome, 'media_removed');
  // A replace capability applies only through the replace command: after its
  // target link is removed it must not re-attach through the add path.
  await setActor(db, f.ownerId);
  await assert.rejects(scalar(db, `SELECT public.phase9_submit_public_copy_media_v2(
    '${f.inventoryId}','${replacement.authorization.capabilityId}',
    '${replacement.completed.media_asset_id}','actual_copy',1,
    'removefix-resubmit-${randomUUID()}','${randomUUID()}')`), /P9_MEDIA_NOT_APPROVED/);
  const after = await unit7cMediaState(db, f);
  assert.deepEqual(after.links, []);
}));

test('Removefix plain ADD capability still links through submit after migration', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const upload = await approvedUpload(db, f);
  const linkId = await linkPublicCopyDerivative(db, f, upload);
  assert.ok(linkId);
  const after = await unit7cMediaState(db, f);
  assert.equal(after.links.length, 1);
  assert.equal(after.links[0].id, linkId);
  assert.equal(after.links[0].media_asset_id, upload.completed.media_asset_id);
}));

for (const stage of ['processing', 'approved']) {
  test(`Removefix pending ${stage} REPLACE is listed while its target exists, hidden after removal, and cannot apply`, () => withDb(async db => {
    const f = await seedUnit7cInventory(db);
    const original = await addPublicMedia(db, f);
    const source = await registerStoreViewCopySource(db, f, {
      role: 'actual_copy', ordinal: 1, operationKind: 'replace', targetLinkId: original.linkId,
    });
    let upload = stage === 'approved' ? await completePublicCopyDerivative(db, f, source) : null;
    const pendingCapability = await capability(db, f, source.authorization.capabilityId);
    assert.equal(pendingCapability.status, 'consumed');
    assert.equal(pendingCapability.operation_kind, 'replace');
    assert.equal(pendingCapability.target_media_link_id, original.linkId);
    assert.ok(pendingCapability.consumed_media_asset_id);
    const pending = (await ownerMediaRecords(db, f)).pendingReplacements;
    assert.equal(pending.length, 1);
    assert.equal(pending[0].capabilityId, source.authorization.capabilityId);
    assert.equal(pending[0].targetLinkId, original.linkId);
    assert.equal(pending[0].operationKind, 'replace');
    assert.equal(pending[0].state, stage);
    const result = await removeWithReplacementTarget(db, f, original.linkId, { inventoryVersion: 1 });
    if (preMigration) return;
    assert.equal(result.inventoryVersion, 2);
    assert.deepEqual(await ownerMediaRecords(db, f), { media: [], pendingReplacements: [] });
    assert.deepEqual(await capability(db, f, source.authorization.capabilityId), pendingCapability);
    // For the staged case, let sanitization finish after removal. Even this
    // valid, approved derivative must stay hidden and cannot revive the link.
    if (!upload) upload = await completePublicCopyDerivative(db, f, source);
    assert.deepEqual(await ownerMediaRecords(db, f), { media: [], pendingReplacements: [] });
    const beforeRejectedReplace = await unit7cMediaState(db, f);
    await assert.rejects(replaceMedia(db, f, source.authorization.capabilityId,
      upload.completed.media_asset_id, original.linkId, { inventoryVersion: 2 }), /P9_MEDIA_LINK_NOT_FOUND/);
    assert.deepEqual(await unit7cMediaState(db, f), beforeRejectedReplace);
  }));
}

async function authorizeReplacement(db, f, targetLinkId) {
  return scalar(db, `SELECT public.phase9_authorize_store_view_media_upload_v1(
    '${f.inventoryId}','actual_copy',1,'replace','${targetLinkId}','image/png',128,
    '${'b'.repeat(64)}',transaction_timestamp()+interval '10 minutes',
    'removefix-auth-${randomUUID()}','${randomUUID()}')`);
}

test('Removefix issued REPLACE remains visible with a live target and disappears when that target is removed', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const original = await addPublicMedia(db, f);
  const authorization = await authorizeReplacement(db, f, original.linkId);
  const pending = (await ownerMediaRecords(db, f)).pendingReplacements;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].capabilityId, authorization.capabilityId);
  assert.equal(pending[0].operationKind, 'replace');
  assert.equal(pending[0].targetLinkId, original.linkId);
  assert.equal(pending[0].state, 'upload_pending');
  const issued = await capability(db, f, authorization.capabilityId);
  assert.equal(issued.status, 'issued');
  const result = await removeWithReplacementTarget(db, f, original.linkId, { inventoryVersion: 1 });
  if (preMigration) return;
  assert.equal(result.outcome, 'media_removed');
  assert.deepEqual(await ownerMediaRecords(db, f), { media: [], pendingReplacements: [] });
  assert.deepEqual(await capability(db, f, authorization.capabilityId), issued);
}));

test('Removefix never-replaced photo removal preserves version/audit semantics and rejects another store owner', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const photo = await addPublicMedia(db, f);
  const before = await unit7cMediaState(db, f);
  const other = await seedUnit7cInventory(db);
  await setActor(db, other.ownerId);
  await assert.rejects(removeMedia(db, f, photo.linkId), /P9_OWNER_NOT_AUTHORIZED/);
  assert.deepEqual(await unit7cMediaState(db, f), before);
  const commandId = randomUUID();
  const result = await removeMedia(db, f, photo.linkId, { commandId });
  await assertRemoval(db, f, photo, before, result, commandId);
  assert.deepEqual(await ownerMediaRecords(db, f), { media: [], pendingReplacements: [] });
}));

test('Removefix authorize REPLACE rejects a missing target and targets in another inventory or store', () => withDb(async db => {
  const f = await seedUnit7cInventory(db);
  const sibling = await seedUnit7cInventory(db, { storeId: f.storeId, ownerId: f.ownerId });
  const siblingPhoto = await addPublicMedia(db, sibling);
  const other = await seedUnit7cInventory(db);
  const otherPhoto = await addPublicMedia(db, other);
  await setActor(db, f.ownerId);
  for (const target of [randomUUID(), siblingPhoto.linkId, otherPhoto.linkId]) {
    await assert.rejects(authorizeReplacement(db, f, target), /P9_MEDIA_LINK_NOT_FOUND/);
  }
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_upload_capabilities
    WHERE bound_entity_id='${f.inventoryId}'`), 0);
}));

test('Removefix migration text changes only the target FK, the Slice 0b reader target-existence guard and the submit replace guard', () => {
  const sql = migrationSql();
  assert.equal((sql.match(/\bDROP\s+CONSTRAINT\b/gi) ?? []).length, 1);
  assert.match(sql, /ALTER TABLE public\.phase9_upload_capabilities\s+DROP CONSTRAINT IF EXISTS phase9_upload_capabilities_target_media_link_id_fkey;/);
  assert.equal((sql.match(/\bCREATE OR REPLACE FUNCTION\b/gi) ?? []).length, 2);
  assert.equal((sql.match(/SET\s+LOCAL\s+lock_timeout/gi) ?? []).length, 1);
  assert.doesNotMatch(sql, /\b(?:GRANT|REVOKE)\b/i);
  assert.doesNotMatch(sql, /phase9_(?:remove_store_view_media|replace_store_view_media|authorize_store_view_media_upload)_v1/);
  // No top-level data change: the only INSERT lives inside the copied submit
  // body (proven identical below), and FOR UPDATE there is part of that copy.
  const withoutFunctions = sql.replace(/CREATE OR REPLACE FUNCTION[\s\S]*?END\$function\$/g, '');
  assert.doesNotMatch(withoutFunctions, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  assert.equal((sql.match(/\bINSERT\b/gi) ?? []).length, 1);
  assert.doesNotMatch(sql, /\bADD\s+(?:CONSTRAINT|COLUMN)\b|\bREFERENCES\b|\bCASCADE\b/i);
  assert.equal((sql.match(/^BEGIN;/gm) ?? []).length, 1);
  assert.equal((sql.match(/^COMMIT;/gm) ?? []).length, 1);
  const signature = 'CREATE OR REPLACE FUNCTION marketplace_sec.phase9_owner_media_records_v1(p_inventory store_inventory)';
  const extractReader = text => {
    const from = text.indexOf(signature);
    const to = text.indexOf('END$function$;', from);
    assert.ok(from >= 0 && to > from);
    return text.slice(from, to + 'END$function$;'.length).replaceAll('\r\n', '\n');
  };
  const baseline = extractReader(fs.readFileSync(migrationPath(SLICE0B), 'utf8'));
  const statusPredicate = "    AND (c.status='consumed' OR (c.status='issued' AND c.expires_at>transaction_timestamp()))";
  const targetGuard = "\n    AND (c.operation_kind IS DISTINCT FROM 'replace' OR EXISTS(\n      SELECT 1 FROM public.inventory_media_links t\n      WHERE t.id=c.target_media_link_id AND t.inventory_id=p_inventory.id))";
  assert.ok(baseline.includes(statusPredicate));
  assert.equal(extractReader(sql), baseline.replace(statusPredicate, statusPredicate + targetGuard));
  assert.match(sql, /ALTER FUNCTION marketplace_sec\.phase9_owner_media_records_v1\(\s*public\.store_inventory\) OWNER TO postgres;/);
  const submitSignature = 'public.phase9_submit_public_copy_media_v2(';
  const extractSubmitBody = (text, endMarker) => {
    const from = text.indexOf(submitSignature);
    assert.ok(from >= 0);
    const declareAt = text.indexOf('DECLARE v_inventory', from);
    const to = text.indexOf(endMarker, declareAt);
    assert.ok(declareAt > from && to > declareAt);
    return text.slice(declareAt, to + endMarker.length).replaceAll('\r\n', '\n');
  };
  const submitBaseline = extractSubmitBody(
    fs.readFileSync(migrationPath('20260812000040_marketplace_phase9_safe_publication.sql'), 'utf8'), 'END$$;');
  const submitAnchor = "    OR v_source.sha256<>v_cap.source_sha256 OR v_asset.store_id<>v_inventory.store_id";
  const submitGuard = "\n    OR v_cap.operation_kind='replace'";
  assert.ok(submitBaseline.includes(submitAnchor));
  // The migration closes the body with $function$ where migration 40 used $$.
  const submitNew = extractSubmitBody(sql, 'END$function$;').slice(0, -'$function$;'.length) + '$$;';
  assert.equal(submitNew, submitBaseline.replace(submitAnchor, submitAnchor + submitGuard));
  assert.match(sql, /ALTER FUNCTION public\.phase9_submit_public_copy_media_v2\(uuid,uuid,uuid,text,integer,text,uuid\) OWNER TO postgres;/);
});

test('Removefix preserves reader ACL/owner/security, command definitions and the operation-target CHECK', () => withDb(async db => {
  const metadataSql = `SELECT p.oid::text,p.oid::regprocedure::text signature,
    pg_get_userbyid(p.proowner) owner,p.proacl::text,p.prosecdef,p.proconfig,p.provolatile
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec' AND p.proname='phase9_owner_media_records_v1'`;
  const definitionsSql = `SELECT p.proname,pg_get_functiondef(p.oid) definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('phase9_remove_store_view_media_v1',
      'phase9_replace_store_view_media_v1','phase9_authorize_store_view_media_upload_v1')
    ORDER BY p.proname`;
  const checkSql = `SELECT pg_get_constraintdef(oid) definition FROM pg_constraint
    WHERE conrelid='public.phase9_upload_capabilities'::regclass
      AND conname='phase9_upload_capability_operation_target_check'`;
  const fkSql = `SELECT count(*)::int FROM pg_constraint
    WHERE conrelid='public.phase9_upload_capabilities'::regclass
      AND conname='phase9_upload_capabilities_target_media_link_id_fkey'`;
  const before = (await db.query(metadataSql)).rows;
  const definitions = (await db.query(definitionsSql)).rows;
  const check = (await db.query(checkSql)).rows;
  assert.equal(before.length, 1);
  assert.equal(before[0].owner, 'postgres');
  assert.equal(before[0].prosecdef, true);
  assert.equal(before[0].provolatile, 's');
  assert.ok(before[0].proconfig.includes('search_path=""'));
  assert.equal(definitions.length, 3);
  assert.equal(check.length, 1);
  assert.equal(await scalar(db, fkSql), 1);
  if (!preMigration) await db.exec(migrationSql());
  assert.deepEqual((await db.query(metadataSql)).rows, before);
  assert.deepEqual((await db.query(definitionsSql)).rows, definitions);
  assert.deepEqual((await db.query(checkSql)).rows, check);
  assert.equal(await scalar(db, fkSql), preMigration ? 1 : 0);
}, { includeFix: false }));
