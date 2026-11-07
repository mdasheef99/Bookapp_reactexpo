// Slice 0a §3.4 diagnostic (read-only w.r.t. product behavior): does adding a
// damage photo clear `damage_evidence_required`?
//
// OBSERVED RESULT (PGlite, M41–M46, recorded 2026-10-29):
// - (a) note + types present, no photo → adding an approved damage photo
//   through the app add path (`phase9_submit_public_copy_media_v2`, driven via
//   the fixture helpers `registerStoreViewCopySource` +
//   `completePublicCopyDerivative` + `linkPublicCopyDerivative`) does NOT clear
//   the warning: the media-change path never recomputes the stored
//   `listing_quality_status`, and the save RPC rejects unchanged fields with
//   P9_NO_CHANGES, so there is no other writer. Stored status and surfaced
//   reason stay `needs_photo` / `damage_evidence_required`.
// - (b) photo present, no note → saving a note via `phase9_update_store_
//   inventory_details_v1` recomputes the status and the warning clears.
// - (c) photo present, no types → saving types recomputes the status and the
//   warning clears.
//
// Harness note: the exact Edge Function wraps the same submit RPC family, but
// the function itself is not driven here — only the RPC the app's add path
// submits through (`phase9_submit_public_copy_media_v2`). Results are PGlite
// M41–M46 diagnostics, not live-database behavior.
//
// This test PASSES by asserting the observed behavior above. It is a
// snapshot of the M41–M46 behavior only (the fixture loads just those
// migrations): if a later migration changes the outcome, the assertions
// (not just the logs) fail, which tells the reader to re-check the Slice 1a
// §4.2 button scope against the new behavior. It is not a tripwire for
// later migrations.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetActor, setActor } from './databaseHarness.mjs';
import {
  completePublicCopyDerivative, linkPublicCopyDerivative,
} from './unit7bFixture.mjs';
import {
  createUnit7cDatabase, registerStoreViewCopySource, saveDetails,
  seedUnit7cInventory, storeViewDetail, unit7cState,
} from './unit7cFixture.mjs';

async function withDb(run) {
  const db = await createUnit7cDatabase();
  try { await run(db); } finally { await db.close(); }
}

function reasons(detail) {
  return detail?.attention?.attentionReasons ?? [];
}

async function damageSnapshot(db, fixture, label) {
  const state = await unit7cState(db, fixture);
  await setActor(db, fixture.ownerId);
  const detail = await storeViewDetail(db, fixture.inventoryId);
  const snapshot = {
    status: state.inventory.listing_quality_status,
    reasons: reasons(detail),
    effectiveState: detail?.lifecycle?.effectiveState,
  };
  console.log(`[damage-evidence] ${label}:`, JSON.stringify(snapshot));
  return snapshot;
}

/** Adds one approved damage photo through the app's add RPC family. */
async function addApprovedDamagePhoto(db, fixture, ordinal = 1) {
  const source = await registerStoreViewCopySource(db, fixture, {
    role: 'damage', ordinal, operationKind: 'add', targetLinkId: null,
  });
  const completed = await completePublicCopyDerivative(db, fixture, source);
  return linkPublicCopyDerivative(db, fixture, completed);
}

test('U7C-S0A-01 damaged book with note and types: adding a damage photo does not clear the warning', () => withDb(async (db) => {
  const fixture = await seedUnit7cInventory(db);
  await saveDetails(db, fixture, {
    hasDamage: true, damageTypes: ['cover'], damageNote: 'Scuffed cover',
  }, { inventoryVersion: 1 });
  const before = await damageSnapshot(db, fixture, 'case-a before photo add');
  assert.equal(before.status, 'needs_photo');
  assert.ok(before.reasons.includes('damage_evidence_required'));

  const linked = await addApprovedDamagePhoto(db, fixture, 1);
  // The submit RPC returns the new link id as a bare uuid.
  assert.equal(typeof linked, 'string');
  assert.ok(linked.length > 0, 'expected the submit RPC to link the photo');

  const after = await damageSnapshot(db, fixture, 'case-a after photo add');
  // Observed (PGlite M41–M46): the stored status is never recomputed on the
  // media path, so the warning stays. Encoded as the assertion.
  assert.equal(after.status, 'needs_photo');
  assert.ok(after.reasons.includes('damage_evidence_required'));
}));

test('U7C-S0A-02 damaged book with photo but no note: saving a note clears the warning', () => withDb(async (db) => {
  const fixture = await seedUnit7cInventory(db);
  await saveDetails(db, fixture, {
    hasDamage: true, damageTypes: ['cover'], damageNote: 'Scuffed cover',
  }, { inventoryVersion: 1 });
  await addApprovedDamagePhoto(db, fixture, 1);
  // Craft "photo present, no note" directly: the save RPC validates, so an
  // empty note cannot be produced through it once damage is recorded.
  await resetActor(db);
  await db.exec(`UPDATE public.store_inventory SET damage_notes=NULL
    WHERE id='${fixture.inventoryId}'`);
  await setActor(db, fixture.ownerId);
  const before = await damageSnapshot(db, fixture, 'case-b before note save');
  assert.ok(before.reasons.includes('damage_evidence_required'));

  await saveDetails(db, fixture, { damageNote: 'Scuffed cover, spine crease' }, { inventoryVersion: 2 });
  const after = await damageSnapshot(db, fixture, 'case-b after note save');
  // Observed (PGlite M41–M46): the save RPC recomputes listing quality, so
  // the warning clears once note + types + 1–3 approved damage photos hold.
  assert.equal(after.status, 'ready');
  assert.ok(!after.reasons.includes('damage_evidence_required'));
}));

test('U7C-S0A-03 damaged book with photo but no types: saving types clears the warning', () => withDb(async (db) => {
  const fixture = await seedUnit7cInventory(db);
  await saveDetails(db, fixture, {
    hasDamage: true, damageTypes: ['cover'], damageNote: 'Scuffed cover',
  }, { inventoryVersion: 1 });
  await addApprovedDamagePhoto(db, fixture, 1);
  await resetActor(db);
  await db.exec(`UPDATE public.store_inventory SET damage_types='{}'
    WHERE id='${fixture.inventoryId}'`);
  await setActor(db, fixture.ownerId);
  const before = await damageSnapshot(db, fixture, 'case-c before types save');
  assert.ok(before.reasons.includes('damage_evidence_required'));

  await saveDetails(db, fixture, { damageTypes: ['cover', 'pages'] }, { inventoryVersion: 2 });
  const after = await damageSnapshot(db, fixture, 'case-c after types save');
  // Observed (PGlite M41–M46): same recompute as case (b); the warning clears.
  assert.equal(after.status, 'ready');
  assert.ok(!after.reasons.includes('damage_evidence_required'));
}));
