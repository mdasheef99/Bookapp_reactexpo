import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { commitSql, seedReviewedCandidate } from './unit7aFixture.mjs';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  applyUnit7aQualityHandoff, createUnit7bDatabase, grantPublicationEligibility,
  setPublication,
} from './unit7bFixture.mjs';

const noDamage = {
  hasDamage: false, damageTypes: [], damageNote: null, isSellable: true,
  completeReadableSafe: true,
};

async function withDb(run) {
  const db = await createUnit7bDatabase();
  try { await run(db); } finally { await db.close(); }
}

test('M40 -> M41 deterministically upgrades an eligible existing Unit 7A row', () => withDb(async (db) => {
  const candidate = await seedReviewedCandidate(db, {
    review: { damageDisclosure: noDamage },
  });
  const committed = await scalar(db, commitSql(candidate));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT listing_quality_status FROM public.store_inventory
    WHERE id='${committed.inventoryId}'`), 'missing_metadata');

  await applyUnit7aQualityHandoff(db);
  assert.equal(await scalar(db, `SELECT listing_quality_status FROM public.store_inventory
    WHERE id='${committed.inventoryId}'`), 'ready');
}));

test('reviewed candidate crosses the normal Unit 7A -> Unit 7B seam without SQL repair', () => withDb(async (db) => {
  await applyUnit7aQualityHandoff(db);
  const candidate = await seedReviewedCandidate(db, {
    review: { damageDisclosure: noDamage },
  });
  await grantPublicationEligibility(db, candidate);
  await resetActor(db);
  await db.exec(`UPDATE public.stores SET status='active',verification_status='approved',
    setup_status='complete',selling_status='allowed' WHERE id='${candidate.storeId}'`);
  await setActor(db, candidate.ownerId);
  const committed = await scalar(db, commitSql(candidate));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT listing_quality_status FROM public.store_inventory
    WHERE id='${committed.inventoryId}'`), 'ready');

  await setActor(db, candidate.ownerId);
  const published = await setPublication(db, {
    ...candidate, inventoryId: committed.inventoryId,
  });
  assert.equal(published.outcome, 'published');
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_book_listings
    WHERE inventory_id='${committed.inventoryId}' AND listing_quality_status='ready'`), 1);
}));

test('incomplete metadata cannot smuggle a client-supplied ready status through the handoff', () => withDb(async (db) => {
  await applyUnit7aQualityHandoff(db);
  const candidate = await seedReviewedCandidate(db);
  await resetActor(db);
  const inventoryId = randomUUID();
  const quality = await scalar(db, `INSERT INTO public.store_inventory(
      id,store_id,title,authors,language,condition,selling_price_minor,
      quantity_total,quantity_available,is_sellable,entry_method,
      created_from_candidate_id,created_by,listing_quality_status)
    VALUES('${inventoryId}','${candidate.storeId}',' ',ARRAY[]::text[],NULL,'good',725,
      1,1,true,'image_extraction','${candidate.candidateId}','${candidate.ownerId}','ready')
    RETURNING listing_quality_status`);
  assert.equal(quality, 'missing_metadata');
}));

test('later quality downgrade refreshes and retracts an already published projection', () => withDb(async (db) => {
  await applyUnit7aQualityHandoff(db);
  const candidate = await seedReviewedCandidate(db, {
    review: { damageDisclosure: noDamage },
  });
  await grantPublicationEligibility(db, candidate);
  await resetActor(db);
  await db.exec(`UPDATE public.stores SET status='active',verification_status='approved',
    setup_status='complete',selling_status='allowed' WHERE id='${candidate.storeId}'`);
  await setActor(db, candidate.ownerId);
  const committed = await scalar(db, commitSql(candidate));
  await setPublication(db, { ...candidate, inventoryId: committed.inventoryId });
  await resetActor(db);
  await db.exec(`UPDATE public.store_inventory SET listing_quality_status='missing_metadata'
    WHERE id='${committed.inventoryId}'`);
  const row = (await db.query(`SELECT visibility_status,publication_status
    FROM public.store_inventory WHERE id='${committed.inventoryId}'`)).rows[0];
  assert.deepEqual(row, { visibility_status: 'blocked', publication_status: 'private' });
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_book_listings
    WHERE inventory_id='${committed.inventoryId}'`), 0);
}));
