// Unit 2 (8c): production explicit worker vs real M93..M99 SQL.
// Run with the compiled worker in .phase9-dist (green) or PHASE9_METADATA_DIST
// pointing at the HEAD build (red-first evidence).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { closeExplicitDatabase, completeRpc, createExplicitDatabase, explicitWorkerFixture,
  failRpc, registerRpc, releaseRpc, reserveRpc } from './explicitWorkerRound8cFixture.mjs';

let db;
before(async () => { db = await createExplicitDatabase(); });
after(async () => { await closeExplicitDatabase(db); });

const named = (fixture, name) => fixture.calls.filter(call => call.name === name);

test('protected OL-v2 explicit success: reserve first, bounded GETs, released and settled', async () => {
  const fixture = await explicitWorkerFixture(db, { route: 'ol-v2-primary', protection: true });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'edition_options_available' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  const names = fixture.names();
  const reserveAt = names.indexOf(reserveRpc);
  for (const name of ['phase9_register_structural_metadata_lookup', 'phase9_reserve_metadata_usage',
    'phase9_register_structural_metadata_attempt', registerRpc]) {
    assert.ok(reserveAt >= 0 && reserveAt < names.indexOf(name), name + ' after reserve');
  }
  const releaseAt = names.indexOf(releaseRpc);
  const completeAt = names.indexOf(completeRpc);
  assert.ok(releaseAt >= 0 && completeAt >= 0 && releaseAt < completeAt, 'release before completion');
  const readback = await fixture.counts();
  assert.equal(readback.counts.slots, 0);
  assert.equal(readback.reservations.length, 1);
  assert.equal(readback.reservations[0].status, 'consumed');
  assert.equal(readback.counts.getsUsed, fixture.urls.length);
  assert.ok(fixture.urls.length >= 1 && fixture.urls.length <= 6, 'bounded GETs');
  assert.equal(fixture.reserveReceipts[0].slots, 6);
  assert.equal(readback.counts.lookups, 1);
  assert.equal(readback.counts.attempts, 1);
});

test('capacity wait reschedules with restored attempt and creates no lineage or GET', async () => {
  const fixture = await explicitWorkerFixture(db, { capacityUsed: 6 });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'retry_scheduled' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'retry_scheduled');
  assert.equal(readback.job.attempt_count, 0);
  assert.equal(readback.counts.lookups, 0);
  assert.equal(readback.counts.attempts, 0);
  assert.equal(readback.counts.reservations, 0);
  assert.equal(readback.counts.calls, 0);
  assert.equal(fixture.urls.length, 0);
  assert.equal(named(fixture, failRpc).length, 0);
});

test('recovery-only seam: no new lineage, no GET, no generic failure', async () => {
  const fixture = await explicitWorkerFixture(db, { recoverySeam: true });
  const result = await fixture.run();
  assert.notDeepEqual(result.results, [{ outcome: 'edition_options_available' }]);
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'in_progress');
  assert.equal(readback.counts.lookups, 1);
  assert.equal(readback.counts.attempts, 1);
  assert.equal(readback.counts.calls, 1);
  assert.equal(fixture.urls.length, 0);
  assert.equal(named(fixture, failRpc).length, 0);
  assert.equal(readback.counts.slots, 5);
});

test('lost reserve response replays the exact submission once', async () => {
  const fixture = await explicitWorkerFixture(db, { loseReserve: 1 });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'edition_options_available' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  assert.equal(named(fixture, reserveRpc).length, 2);
  const first = named(fixture, reserveRpc)[0];
  const second = named(fixture, reserveRpc)[1];
  assert.deepEqual(first.parameters, second.parameters);
  const readback = await fixture.counts();
  assert.equal(readback.reservations.length, 1);
  assert.equal(readback.reservations[0].status, 'consumed');
});

test('lost release response replays the live fence and completes', async () => {
  const fixture = await explicitWorkerFixture(db, { loseRelease: 1 });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'edition_options_available' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  assert.equal(named(fixture, releaseRpc).length, 2);
  assert.equal(named(fixture, completeRpc).length, 1);
  const readback = await fixture.counts();
  assert.equal(readback.counts.slots, 0);
});

test('NULL-policy Google compatibility route has no admission RPC', async () => {
  const fixture = await explicitWorkerFixture(db, { route: 'google-primary', protection: false });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'edition_options_available' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  assert.equal(named(fixture, reserveRpc).length, 0);
  assert.equal(named(fixture, releaseRpc).length, 0);
  const readback = await fixture.counts();
  assert.equal(readback.reservations.length, 1);
  assert.equal(readback.reservations[0].status, 'consumed');
  assert.ok(fixture.urls.length >= 1);
});

test('NULL-policy port-native OL-v2 is denied with no egress', async () => {
  const fixture = await explicitWorkerFixture(db, { route: 'ol-v2-primary', protection: false });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'manual_metadata_required' }]);
  assert.equal(named(fixture, reserveRpc).length, 0);
  assert.equal(fixture.urls.length, 0);
  assert.equal(named(fixture, failRpc).length, 1);
  const readback = await fixture.counts();
  assert.equal(readback.counts.lookups, 1);
  assert.equal(readback.counts.reservations, 1);
  assert.equal(readback.reservations[0].status, 'released');
});

test('retryable 503 releases before the retry failure and keeps usage reserved', async () => {
  const fixture = await explicitWorkerFixture(db, {
    response: async () => new Response('', { status: 503 }),
  });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'retry_scheduled' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  const names = fixture.names();
  assert.ok(names.indexOf(releaseRpc) >= 0 && names.indexOf(releaseRpc) < names.indexOf(failRpc),
    'release before retry failure');
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'retry_scheduled');
  assert.equal(readback.reservations.length, 1);
  assert.equal(readback.reservations[0].status, 'reserved');
  assert.equal(readback.counts.slots, 0);
});

test('persistently malformed reserve keeps the hold with no lineage, GET or writes', async () => {
  const fixture = await explicitWorkerFixture(db, { malformedReserve: true });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'manual_metadata_required' }]);
  assert.equal(named(fixture, reserveRpc).length, 2);
  assert.equal(fixture.urls.length, 0);
  assert.equal(named(fixture, failRpc).length, 0);
  assert.equal(named(fixture, completeRpc).length, 0);
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'in_progress');
  assert.equal(readback.counts.lookups, 0);
});

test('lost capacity-wait response keeps SQL retry state and writes no failure', async () => {
  const fixture = await explicitWorkerFixture(db, { capacityUsed: 6, loseReserve: 1 });
  const result = await fixture.run();
  assert.notDeepEqual(result.results, [{ outcome: 'edition_options_available' }]);
  assert.equal(fixture.urls.length, 0);
  assert.equal(named(fixture, failRpc).length, 0);
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'retry_scheduled');
  assert.equal(readback.job.attempt_count, 0);
  assert.equal(readback.counts.lookups, 0);
  assert.equal(readback.counts.reservations, 0);
});

test('lost release twice keeps recovery-only and writes no completion or failure', async () => {
  const fixture = await explicitWorkerFixture(db, { loseRelease: 2 });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'manual_metadata_required' }]);
  assert.equal(named(fixture, releaseRpc).length, 2);
  assert.equal(named(fixture, completeRpc).length, 0);
  assert.equal(named(fixture, failRpc).length, 0);
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'in_progress');
});

test('protected secondary: primary release then secondary admission before fallback', async () => {
  const fixture = await explicitWorkerFixture(db, {
    route: 'google-primary-ol-secondary', protection: true, googleEmpty: true,
  });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'edition_options_available' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  const names = fixture.names();
  const secondaryReserve = names.indexOf(reserveRpc);
  const fallback = names.indexOf('phase9_finish_edition_primary_for_fallback_v1');
  assert.ok(secondaryReserve >= 0 && fallback >= 0 && secondaryReserve < fallback,
    'secondary reserve before fallback registration');
  assert.equal(named(fixture, reserveRpc).length, 1);
  assert.equal(fixture.reserveReceipts[0].slots, 6);
  const readback = await fixture.counts();
  assert.equal(readback.counts.slots, 0);
  assert.equal(readback.reservations[0].status, 'consumed');
  assert.ok(fixture.urls.length >= 4, 'Google plus OL GETs');
});

test('secondary drain_required blocks fallback egress', async () => {
  const fixture = await explicitWorkerFixture(db, {
    route: 'google-primary-ol-secondary', protection: true, googleEmpty: true, capacityUsed: 6,
  });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'manual_metadata_required' }]);
  assert.equal(named(fixture, 'phase9_finish_edition_primary_for_fallback_v1').length, 0);
  assert.equal(named(fixture, registerRpc).length, 0);
  assert.equal(fixture.urls.length, 1, 'only the Google primary GET');
});

test('terminal nonretryable sent failure preserves reserved usage for reconciliation', async () => {
  const fixture = await explicitWorkerFixture(db, {
    response: async () => new Response('', { status: 404 }),
  });
  const result = await fixture.run();
  assert.deepEqual(result.results, [{ outcome: 'manual_metadata_required' }],
    JSON.stringify(fixture.errors.map(entry => String(entry.error?.message ?? entry.error))));
  const names = fixture.names();
  assert.ok(names.indexOf(releaseRpc) >= 0 && names.indexOf(releaseRpc) < names.indexOf(failRpc),
    'release before terminal failure');
  const readback = await fixture.counts();
  assert.equal(readback.job.status, 'resolved');
  // M99 keeps a sent call with no cost evidence reserved for reconciliation; the
  // proven-unsent settlement is covered by the NULL-policy OL-v2 denial case.
  assert.equal(readback.reservations.length, 1);
  assert.equal(readback.reservations[0].status, 'reserved');
});
