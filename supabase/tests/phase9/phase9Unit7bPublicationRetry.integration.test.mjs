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

test('U7B-RT09 Owner and worker retry cannot create increment or change inventory quantity and cannot duplicate listings', () => withDb(async (db) => {
  let faultInstalled = false;
  for (const path of ['owner', 'worker']) {
    const f = await seedPublicationInventory(db);
    if (!faultInstalled) {
      await installTransientProjectionFault(db, f); faultInstalled = true;
    } else {
      await db.exec("SELECT set_config('phase9.test_projection_fault','on',false)");
    }
    assert.equal((await setPublication(db, f)).outcome, 'committed_publication_failed');
    await disableTransientProjectionFault(db);
    const before = await businessEffectSnapshot(db, f);
    let result;
    if (path === 'owner') {
      result = await scalar(db, `SELECT public.phase9_retry_publication_owner_v1(
        '${f.inventoryId}',2,'u7b-owner-retry-${f.inventoryId}','${randomUUID()}')`);
    } else {
      await setActor(db, f.ownerId, 'service_role');
      const claim = (await db.query(
        "SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')",
      )).rows[0];
      result = await scalar(db, `SELECT public.phase9_retry_publication_worker_v1(
        '${f.inventoryId}',2,'${claim.job_id}','${claim.lease_token}',${claim.attempt_number},
        'publication-worker-0001','u7b-worker-retry-${f.inventoryId}','${randomUUID()}')`);
      await setActor(db, f.ownerId);
    }
    const after = await businessEffectSnapshot(db, f);
    assert.equal(result.outcome, 'published'); assert.equal(after.listings, 1);
    assert.equal(after.inventory_rows, 1); assert.equal(after.inventory.id, before.inventory.id);
    assert.equal(after.inventory.version, before.inventory.version);
    for (const key of ['quantity_total','quantity_available','quantity_reserved','quantity_sold','quantity_removed']) {
      assert.equal(after.inventory[key], before.inventory[key], `${path} retry changed ${key}`);
    }
  }
}));
test('U7B-RT10 deterministic rejection creates no retry while recognized transient projection failure creates exactly one intent-keyed retry', () => withDb(async (db) => {
  const bad = await seedPublicationInventory(db, { priceMinor: 0 });
  await assert.rejects(setPublication(db, bad), /P9_PUBLICATION_INELIGIBLE/);
  assert.equal((await state(db, bad)).jobs.length, 0);
  const f = await seedPublicationInventory(db); await installTransientProjectionFault(db, f);
  assert.equal((await setPublication(db, f)).outcome, 'committed_publication_failed');
  const s = await state(db, f); assert.equal(s.jobs.length, 1);
  assert.equal(s.jobs[0].dedupe_key, `publication_retry:${f.inventoryId}:2`);
}));

test('U7B-RT11 pause retains a paused unavailable listing private retracts safely and both disappear from discovery', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); const identity = (await businessEffectSnapshot(db, f)).inventory;
  const published = await setPublication(db, f);
  await setPublication(db, f, { intent: 'pause', intentVersion: 2, idempotencyKey: `u7b-pause-${f.inventoryId}` });
  let s = await state(db, f); assert.equal(s.listings[0].status, 'paused'); assert.equal(s.listings[0].availability_status, 'unavailable');
  assert.equal(await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${published.listingId}')`), null);
  await setPublication(db, f, { intent: 'private', intentVersion: 3, idempotencyKey: `u7b-private-${f.inventoryId}` });
  s = await state(db, f); assert.equal(s.inventory.visibility_status, 'draft'); assert.equal(s.listings.length, 0);
  assert.equal(s.inventory.id, identity.id); assert.equal(s.inventory.quantity_total, identity.quantity_total);

  const evidenced = await seedPublicationInventory(db);
  const evidencePublished = await setPublication(db, evidenced);
  await resetActor(db);
  const requestId = randomUUID();
  await db.exec(`INSERT INTO public.store_order_requests(id,store_id,user_id)
    VALUES('${requestId}','${evidenced.storeId}','${randomUUID()}');
    INSERT INTO public.store_order_request_items(
      id,order_request_id,store_id,inventory_id,listing_id
    ) VALUES('${randomUUID()}','${requestId}','${evidenced.storeId}',
      '${evidenced.inventoryId}','${evidencePublished.listingId}')`);
  await setActor(db, evidenced.ownerId);
  await setPublication(db, evidenced, {
    intent: 'private', intentVersion: 2, idempotencyKey: `u7b-evidence-private-${evidenced.inventoryId}`,
  });
  const tombstone = (await state(db, evidenced)).listings[0];
  assert.equal(tombstone.status, 'paused'); assert.equal(tombstone.availability_status, 'unavailable');
  assert.equal(await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${evidencePublished.listingId}')`), null);

  for (const visibility of ['blocked', 'out_of_stock']) {
    const candidate = await seedPublicationInventory(db);
    const result = await setPublication(db, candidate);
    await resetActor(db);
    await db.exec(`UPDATE public.store_inventory SET visibility_status='${visibility}'
      WHERE id='${candidate.inventoryId}'`);
    assert.equal(await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${result.listingId}')`), null);
    const after = await businessEffectSnapshot(db, candidate);
    assert.equal(after.inventory.id, candidate.inventoryId);
    assert.equal(after.inventory.quantity_total, 3);
  }
}));

test('U7B-RT12 leased retry cannot republish after Owner pause or private advances intent', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); await installTransientProjectionFault(db, f); await setPublication(db, f); await disableTransientProjectionFault(db);
  await setActor(db, f.ownerId, 'service_role');
  const claim = (await db.query("SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')")).rows[0];
  await setActor(db, f.ownerId);
  await setPublication(db, f, { intent: 'pause', intentVersion: 2, idempotencyKey: `u7b-fence-${f.inventoryId}` });
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(db.query(`SELECT public.phase9_retry_publication_worker_v1('${f.inventoryId}',2,'${claim.job_id}','${claim.lease_token}',${claim.attempt_number},'publication-worker-0001','u7b-worker-retry-${f.inventoryId}','${randomUUID()}')`), /P9_STATE_CONFLICT/);
  await resetActor(db); assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_public_listing_projection WHERE inventory_id='${f.inventoryId}'`), 0);
  const cancelled = (await db.query(`SELECT status,lease_owner,lease_token,lease_expires_at
    FROM public.image_extraction_jobs WHERE id='${claim.job_id}'`)).rows[0];
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.lease_owner, null);
  assert.equal(cancelled.lease_token, null); assert.equal(cancelled.lease_expires_at, null);
}));

test('U7B-RT13 public discovery DTO excludes exact quantity location cost notes private media and risk internals', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); const result = await setPublication(db, f);
  await resetActor(db); const dto = await scalar(db, `SELECT public.phase9_public_listing_detail_v2('${result.listingId}')`);
  assert.deepEqual(Object.keys(dto).sort(), ['authors','availabilityStatus','condition','coverUrl','currency','damageTypes','description','editionStatement','format','friendlyInventoryFreshnessSignal','fulfillmentOptions','hasDamage','isbn10','isbn13','language','listingId','moderationStatus','priceMinor','publicDamageNote','publicMediaCount','qualityStatus','status','storeId','title','volume'].sort());
  for (const forbidden of ['quantity','shelf','cost','internal','confidence','request','scan','risk']) assert.equal(JSON.stringify(dto).toLowerCase().includes(forbidden), false);
}));

test('U7B-RT14 reviewed unmatched inventory publishes without canonical mutation', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); assert.equal((await setPublication(db, f)).outcome, 'published');
  const s = await state(db, f); assert.equal(s.inventory.canonical_edition_id, null); assert.equal(s.listings[0].canonical_edition_id, null);
}));

test('U7B-RT15 database rejects unleased expired wrong-token wrong-attempt and cross-kind worker mutation', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db); await installTransientProjectionFault(db, f); await setPublication(db, f); await disableTransientProjectionFault(db);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT marketplace_sec.has_claimable_phase9_work('publication_retry')"), true);
  const wake = await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  assert.equal(wake.configured_missing, 1);
  await setActor(db, f.ownerId, 'service_role');
  const claim = (await db.query("SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')")).rows[0];
  assert.equal(claim.inventory_id, f.inventoryId); assert.equal(claim.publication_intent_version, 2);
  assert.equal(claim.attempt_number, 1); assert.ok(claim.job_id); assert.ok(claim.lease_token);
  assert.ok(Date.parse(claim.lease_expires_at) > Date.now());
  const call = (token, attempt = claim.attempt_number) => db.query(`SELECT public.phase9_retry_publication_worker_v1('${f.inventoryId}',2,'${claim.job_id}','${token}',${attempt},'publication-worker-0001','u7b-worker-fence-${randomUUID()}','${randomUUID()}')`);
  await assert.rejects(call(randomUUID()), /P9_STATE_CONFLICT/);
  await assert.rejects(call(claim.lease_token, claim.attempt_number + 1), /P9_STATE_CONFLICT/);
  await db.exec(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id='${claim.job_id}'`);
  await assert.rejects(call(claim.lease_token), /P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_jobs SET status='open',attempt_count=0,
    next_attempt_at=transaction_timestamp(),lease_owner=NULL,lease_token=NULL,
    lease_expires_at=NULL WHERE id='${claim.job_id}';
    INSERT INTO public.image_extraction_jobs(
      store_id,entity_type,entity_id,job_kind,dedupe_key,operation_version
    ) VALUES('${f.storeId}','candidate','${randomUUID()}','metadata_enrich',
      'u7b-cross-kind-${randomUUID()}','1')`);
  await setActor(db, f.ownerId, 'service_role');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const [leased] = (await db.query(
      "SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')",
    )).rows;
    assert.equal(leased.attempt_number, attempt);
    const outcome = await scalar(db, `SELECT public.phase9_fail_publication_job_v1(
      '${leased.job_id}','${leased.lease_token}','publication-worker-0001',${attempt},
      'transient','P9_PUBLICATION_FAILED')`);
    assert.equal(outcome, attempt === 5 ? 'dead_letter' : 'retry_scheduled');
    await resetActor(db);
    const lifecycle = (await db.query(`SELECT status,lease_token,lease_owner,lease_expires_at,
      next_attempt_at,dead_lettered_at FROM public.image_extraction_jobs
      WHERE id='${leased.job_id}'`)).rows[0];
    assert.equal(lifecycle.lease_token, null); assert.equal(lifecycle.lease_owner, null);
    assert.equal(lifecycle.lease_expires_at, null);
    if (attempt < 5) {
      assert.ok(Date.parse(lifecycle.next_attempt_at) > Date.now());
      await db.exec(`UPDATE public.image_extraction_jobs SET next_attempt_at=transaction_timestamp()
        WHERE id='${leased.job_id}'`);
      await setActor(db, f.ownerId, 'service_role');
    } else {
      assert.ok(lifecycle.dead_lettered_at);
      assert.equal(lifecycle.status, 'dead_letter');
    }
  }
  await setActor(db, f.ownerId, 'service_role');
  assert.equal((await db.query(
    "SELECT * FROM public.claim_phase9_publication_jobs(10,'publication-worker-0001')",
  )).rows.length, 0);
  await resetActor(db);
  const dead = (await db.query(`SELECT last_safe_error_category,last_safe_error_code,
    lease_owner,lease_token,lease_expires_at FROM public.image_extraction_jobs
    WHERE id='${claim.job_id}'`)).rows[0];
  assert.equal(dead.last_safe_error_category, 'transient');
  assert.equal(dead.last_safe_error_code, 'P9_PUBLICATION_FAILED');
  assert.equal(dead.lease_owner, null); assert.equal(dead.lease_token, null); assert.equal(dead.lease_expires_at, null);
}));

test('U7B-RT15 committed transient worker outcome is rescheduled immediately and clears the real lease', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  await installTransientProjectionFault(db, f);
  await setPublication(db, f);
  await setActor(db, f.ownerId, 'service_role');
  const claim = (await db.query(
    "SELECT * FROM public.claim_phase9_publication_jobs(1,'publication-worker-0001')",
  )).rows[0];
  const retried = await scalar(db, `SELECT public.phase9_retry_publication_worker_v1(
    '${f.inventoryId}',2,'${claim.job_id}','${claim.lease_token}',${claim.attempt_number},
    'publication-worker-0001','u7b-committed-transient-${f.inventoryId}','${randomUUID()}')`);
  assert.equal(retried.outcome, 'committed_publication_failed');
  assert.equal(await scalar(db, `SELECT public.phase9_fail_publication_job_v1(
    '${claim.job_id}','${claim.lease_token}','publication-worker-0001',${claim.attempt_number},
    'transient','P9_PUBLICATION_FAILED')`), 'retry_scheduled');
  await resetActor(db);
  const job = (await db.query(`SELECT status,lease_owner,lease_token,lease_expires_at,
    next_attempt_at FROM public.image_extraction_jobs WHERE id='${claim.job_id}'`)).rows[0];
  assert.equal(job.status, 'retry_scheduled'); assert.equal(job.lease_owner, null);
  assert.equal(job.lease_token, null); assert.equal(job.lease_expires_at, null);
  assert.ok(Date.parse(job.next_attempt_at) > Date.now());
}));

test('U7B-RT16 authenticated direct publication-field updates are denied', () => withDb(async (db) => {
  const f = await seedPublicationInventory(db);
  await assert.rejects(db.query(`UPDATE public.store_inventory SET visibility_status='published' WHERE id='${f.inventoryId}'`), /permission denied/iu);
}));
