import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { commitSql, seedReviewedCandidate } from './unit7aFixture.mjs';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  addApprovedPublicMedia, addPublicMedia, businessEffectSnapshot,
  completePublicCopyDerivative, createUnit7bDatabase, disableTransientProjectionFault,
  installTransientProjectionFault, linkPublicCopyDerivative, registerPublicCopySource,
  grantPublicationEligibility, seedPublicationInventory, setPublication, state,
} from './unit7bFixture.mjs';

async function withDb(run) {
  const db = await createUnit7bDatabase();
  try { await run(db); } finally { await db.close(); }
}

test('U7B-RT17 public copy travels through authorization registration sanitation promotion linking refresh and revocation', () => withDb(async (db) => {
  const step = async (label, action) => action().catch((error) => {
    error.message = `${label}: ${error.message}`; throw error;
  });
  const f = await seedPublicationInventory(db);
  await setActor(db, f.otherOwnerId);
  await assert.rejects(registerPublicCopySource(db, f), /P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, f.ownerId);
  const observedMismatch = await seedPublicationInventory(db);
  await assert.rejects(registerPublicCopySource(db, observedMismatch, {
    mime: 'image/png', observedMime: 'image/jpeg',
  }), /P9_OWNER_NOT_AUTHORIZED|P9_MEDIA_NOT_APPROVED/);
  await setActor(db, f.ownerId);
  const source = await step('register valid source', () => registerPublicCopySource(db, f));
  assert.equal(source.authorization.bucket, 'marketplace-media-staging');
  assert.match(source.authorization.path, new RegExp(`^${f.storeId}/public_copy/${f.inventoryId}/`));
  assert.equal(source.registered.state, 'processing');
  await resetActor(db);
  const staged = (await db.query(`SELECT privacy_class,bucket_id,lifecycle_status,
    validation_version,reencode_version,exif_strip_version FROM public.media_assets
    WHERE id='${source.registered.media_asset_id}'`)).rows[0];
  assert.equal(staged.privacy_class, 'private_scan');
  assert.equal(staged.bucket_id, 'marketplace-media-staging');
  assert.equal(staged.lifecycle_status, 'staged');
  assert.equal(staged.validation_version, null); assert.equal(staged.reencode_version, null);

  const completed = await step('complete derivative', () => completePublicCopyDerivative(db, f, source));
  assert.equal(completed.completed.state, 'approved');
  await setActor(db, f.ownerId);
  const approvedStatus = await scalar(db, `SELECT public.phase9_public_copy_status_v1(
    '${source.registered.media_asset_id}')`);
  assert.equal(approvedStatus.state, 'approved');
  assert.equal(approvedStatus.mediaAssetId, completed.completed.media_asset_id);
  await resetActor(db);
  const derivative = (await db.query(`SELECT purpose,privacy_class,bucket_id,object_path,
    detected_mime,validation_version,reencode_version,exif_strip_version,
    source_media_asset_id,lifecycle_status FROM public.media_assets
    WHERE id='${completed.completed.media_asset_id}'`)).rows[0];
  assert.equal(derivative.bucket_id, 'inventory-photos'); assert.equal(derivative.detected_mime, 'image/webp');
  assert.match(derivative.reencode_version, /magick-wasm/); assert.match(derivative.exif_strip_version, /strip/);
  assert.equal(derivative.source_media_asset_id, source.registered.media_asset_id);
  assert.equal(derivative.lifecycle_status, 'approved'); assert.doesNotMatch(derivative.object_path, /\.\.|[?#]/u);

  await setActor(db, f.ownerId);
  const failedSource = await step('register failed source', () => registerPublicCopySource(db, f, {
    role: 'actual_copy', ordinal: 2,
  }));
  await setActor(db, f.ownerId, 'service_role');
  const failedClaim = (await db.query(
    "SELECT * FROM public.claim_phase9_media_validation_jobs(1,'media-worker-0000000001')",
  )).rows[0];
  assert.equal(await scalar(db, `SELECT public.phase9_fail_media_validation_v2(
    '${failedClaim.id}','media-worker-0000000001','${failedClaim.lease_token}',
    ${failedClaim.attempt_count},false,'P9_MEDIA_MIME_MISMATCH')`), 'resolved');
  await setActor(db, f.ownerId);
  assert.equal((await scalar(db, `SELECT public.phase9_public_copy_status_v1(
    '${failedSource.registered.media_asset_id}')`)).state, 'failed');

  await setActor(db, f.ownerId);
  await assert.rejects(scalar(db, `SELECT public.phase9_submit_public_copy_media_v2(
    '${f.inventoryId}','${source.authorization.capabilityId}','${source.registered.media_asset_id}',
    'primary_fallback',1,'u7b-link-source-${f.inventoryId}','${randomUUID()}')`), /P9_MEDIA_NOT_APPROVED/);
  const published = await step('publish before link', () => setPublication(db, f));
  assert.equal((await state(db, f)).listings[0].public_cover_url, null);
  await step('link derivative', () => linkPublicCopyDerivative(db, f, completed));
  let s = await state(db, f);
  assert.equal(s.listings[0].primary_public_media_id, completed.completed.media_asset_id);
  assert.match(s.listings[0].public_cover_url, /^\/storage\/v1\/object\/public\/inventory-photos\//u);
  assert.equal((await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${published.listingId}')`)).coverUrl,
    s.listings[0].public_cover_url);
  await assert.rejects(addApprovedPublicMedia(db, f, 'primary_fallback', 2), /duplicate key|unique/iu);

  const canonical = await seedPublicationInventory(db);
  await resetActor(db);
  await db.exec(`UPDATE public.store_inventory SET cover_url='https://covers.example/canonical.webp'
    WHERE id='${canonical.inventoryId}'`);
  await addApprovedPublicMedia(db, canonical, 'primary_fallback', 1);
  await step('canonical publish', () => setPublication(db, canonical));
  assert.equal((await state(db, canonical)).listings[0].public_cover_url, 'https://covers.example/canonical.webp');

  const damaged = await seedPublicationInventory(db, {
    hasDamage: true, damageTypes: ['cover'], damageNote: 'Visible mark',
  });
  const damageLink = await addApprovedPublicMedia(db, damaged, 'damage', 1);
  await step('damaged publish', () => setPublication(db, damaged));
  assert.equal((await state(db, damaged)).listings[0].primary_public_media_id, null);
  assert.equal((await state(db, damaged)).listings[0].public_cover_url, null);
  await resetActor(db);
  await db.exec(`DELETE FROM public.inventory_media_links WHERE id='${damageLink.linkId}'`);
  const damageRetracted = await state(db, damaged);
  assert.equal(damageRetracted.inventory.visibility_status, 'blocked');
  assert.equal(damageRetracted.listings.length, 0);

  await resetActor(db);
  await db.exec(`UPDATE public.media_assets SET lifecycle_status='failed'
    WHERE id='${completed.completed.media_asset_id}'`);
  s = await state(db, f);
  assert.equal(s.inventory.visibility_status, 'blocked'); assert.equal(s.listings.length, 0);
}));
test('U7B-RT18 later publication pause and retry do not change the closed ingestion summary', () => withDb(async (db) => {
  const c = await seedReviewedCandidate(db, { review: { damageDisclosure: {
    hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
    completeReadableSafe: true,
  } } });
  await grantPublicationEligibility(db, c);
  await resetActor(db);
  await db.exec(`UPDATE public.stores SET status='active',verification_status='approved',setup_status='complete',selling_status='allowed' WHERE id='${c.storeId}'`);
  await setActor(db, c.ownerId);
  const committed = await scalar(db, commitSql(c));
  await resetActor(db);
  await db.exec(`UPDATE public.store_inventory SET listing_quality_status='ready'
    WHERE id='${committed.inventoryId}'`);
  await setActor(db, c.ownerId);
  const before = await scalar(db, `SELECT public.phase9_owner_session_summary_v2('${c.sessionId}')`);
  const frozen = JSON.stringify(before.closeSummary);
  const assertFrozen = async (step) => {
    const current = await scalar(db, `SELECT public.phase9_owner_session_summary_v2('${c.sessionId}')`);
    assert.equal(JSON.stringify(current.closeSummary), frozen, `${step} rewrote the closed summary`);
  };
  await scalar(db, `SELECT public.phase9_set_publication_state_v2('${committed.inventoryId}',1,1,
    'publish','u7b-summary-publish-${c.candidateId}','${randomUUID()}')`);
  await assertFrozen('publish');
  await scalar(db, `SELECT public.phase9_set_publication_state_v2('${committed.inventoryId}',1,2,
    'pause','u7b-summary-pause-${c.candidateId}','${randomUUID()}')`);
  await assertFrozen('pause');
  await installTransientProjectionFault(db, { ownerId: c.ownerId });
  await scalar(db, `SELECT public.phase9_set_publication_state_v2('${committed.inventoryId}',1,3,
    'publish','u7b-summary-failure-${c.candidateId}','${randomUUID()}')`);
  await assertFrozen('transient publication failure');
  await disableTransientProjectionFault(db);
  await scalar(db, `SELECT public.phase9_retry_publication_owner_v1('${committed.inventoryId}',4,
    'u7b-summary-owner-retry-${c.candidateId}','${randomUUID()}')`);
  await assertFrozen('Owner retry');
  await scalar(db, `SELECT public.phase9_set_publication_state_v2('${committed.inventoryId}',1,4,
    'private','u7b-summary-private-${c.candidateId}','${randomUUID()}')`);
  await db.exec("SELECT set_config('phase9.test_projection_fault','on',false)");
  await scalar(db, `SELECT public.phase9_set_publication_state_v2('${committed.inventoryId}',1,5,
    'publish','u7b-summary-worker-failure-${c.candidateId}','${randomUUID()}')`);
  await disableTransientProjectionFault(db);
  await setActor(db, c.ownerId, 'service_role');
  const claim = (await db.query(
    "SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')",
  )).rows[0];
  await scalar(db, `SELECT public.phase9_retry_publication_worker_v1('${committed.inventoryId}',6,
    '${claim.job_id}','${claim.lease_token}',${claim.attempt_number},'publication-worker-0001',
    'u7b-summary-worker-retry-${c.candidateId}','${randomUUID()}')`);
  await setActor(db, c.ownerId);
  await assertFrozen('worker retry');
}));

test('U7B-RT19 Owner inventory v2 exposes bounded publication fields and all four status filters while v1 is unchanged', () => withDb(async (db) => {
  const privateRow = await seedPublicationInventory(db, { title: 'Private filter row' });
  const sameStore = { storeId: privateRow.storeId, ownerId: privateRow.ownerId,
    otherOwnerId: privateRow.otherOwnerId };
  const publishedRow = await seedPublicationInventory(db, { ...sameStore, title: 'Published filter row' });
  await setPublication(db, publishedRow);
  const pausedRow = await seedPublicationInventory(db, { ...sameStore, title: 'Paused filter row' });
  await setPublication(db, pausedRow);
  await setPublication(db, pausedRow, {
    intent: 'pause', intentVersion: 2, idempotencyKey: `u7b-filter-pause-${pausedRow.inventoryId}`,
  });
  const failedRow = await seedPublicationInventory(db, { ...sameStore, title: 'Failed filter row' });
  await installTransientProjectionFault(db, failedRow);
  await setPublication(db, failedRow);
  await disableTransientProjectionFault(db);
  const expected = {
    private: privateRow.inventoryId, published: publishedRow.inventoryId,
    paused: pausedRow.inventoryId, publication_failed: failedRow.inventoryId,
  };
  for (const [filter, inventoryId] of Object.entries(expected)) {
    const page = await scalar(db, `SELECT public.phase9_owner_inventory_page_v2(
      25,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'${filter}')`);
    assert.equal(page.contractVersion, 'phase9-owner-inventory-v2');
    assert.deepEqual(page.items.map((item) => item.id), [inventoryId], `${filter} membership drift`);
    const item = page.items[0];
    for (const required of ['publicationStatus','publicationIntentVersion','visibilityStatus',
      'publicationRetryable','publicationFailureReason','publicListingStatus']) {
      assert.ok(Object.hasOwn(item, required), `${filter} missing ${required}`);
    }
    for (const forbidden of ['storeId','shelfLocation','internalNotes','acquisitionCostMinor',
      'retryJobId','leaseToken','lastSafeErrorCode']) assert.equal(Object.hasOwn(item, forbidden), false);
  }
  const v1 = await scalar(db, 'SELECT public.phase9_owner_inventory_page_v1(25,NULL,NULL,NULL,NULL,NULL,NULL,NULL)');
  assert.equal(v1.contractVersion, 'phase9-owner-inventory-v1');
  for (const item of v1.items) {
    assert.equal(item.publicationStatus, undefined);
    assert.equal(item.publicationIntentVersion, undefined);
    assert.equal(item.publicationRetryable, undefined);
  }
}));

test('U7B-RT20 one successful state command emits one audit and one event while replay and projection trigger emit zero duplicates', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); const commandId = randomUUID();
  await setPublication(db, f, { commandId }); await setPublication(db, f, { commandId });
  await addApprovedPublicMedia(db, f, 'primary_fallback', 1);
  await setPublication(db, f, { intent: 'pause', intentVersion: 2,
    idempotencyKey: `u7b-audit-pause-${f.inventoryId}` });
  await setPublication(db, f, { intent: 'private', intentVersion: 3,
    idempotencyKey: `u7b-audit-private-${f.inventoryId}` });
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE entity_id='${f.inventoryId}' AND action='phase9.publication.publish'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE entity_id='${f.inventoryId}' AND action='phase9.publication.pause'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE entity_id='${f.inventoryId}' AND action='phase9.publication.private'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE entity_id='${f.inventoryId}'`), 3);

  let faultInstalled = false;
  for (const retryPath of ['owner', 'worker']) {
    const candidate = await seedPublicationInventory(db);
    if (!faultInstalled) {
      await installTransientProjectionFault(db, candidate); faultInstalled = true;
    } else {
      await db.exec("SELECT set_config('phase9.test_projection_fault','on',false)");
    }
    await setPublication(db, candidate);
    await disableTransientProjectionFault(db);
    if (retryPath === 'owner') {
      await scalar(db, `SELECT public.phase9_retry_publication_owner_v1('${candidate.inventoryId}',2,
        'u7b-audit-owner-retry-${candidate.inventoryId}','${randomUUID()}')`);
    } else {
      await setActor(db, candidate.ownerId, 'service_role');
      const claim = (await db.query(
        "SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')",
      )).rows[0];
      await scalar(db, `SELECT public.phase9_retry_publication_worker_v1('${candidate.inventoryId}',2,
        '${claim.job_id}','${claim.lease_token}',${claim.attempt_number},'publication-worker-0001',
        'u7b-audit-worker-retry-${candidate.inventoryId}','${randomUUID()}')`);
    }
    await resetActor(db);
    assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
      WHERE entity_id='${candidate.inventoryId}'`), 2, `${retryPath} audit ownership`);
    assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
      WHERE entity_id='${candidate.inventoryId}'`), 2, `${retryPath} event ownership`);
  }
}));
