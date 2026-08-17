import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  disableTransientProjectionFault, installTransientProjectionFault,
} from './unit7bFixture.mjs';
import {
  adjustStock, createUnit7cDatabase, publishInventory, saveDetails,
  seedUnit7cInventory, storeViewDetail, storeViewPage, storeViewPageV2,
  unit7cState,
} from './unit7cFixture.mjs';

async function withDb(run) {
  const db = await createUnit7cDatabase();
  try { await run(db); } finally { await db.close(); }
}

async function seedCategory(db, root, effectiveState, ordinal) {
  const fixture = await seedUnit7cInventory(db, {
    storeId: root.storeId,
    ownerId: root.ownerId,
    otherOwnerId: root.otherOwnerId,
    title: `${effectiveState}-${ordinal}`,
  });
  if (effectiveState === 'live') await publishInventory(db, fixture);
  if (effectiveState === 'paused') {
    await publishInventory(db, fixture);
    await publishInventory(db, fixture, {
      intent: 'pause', intentVersion: 2,
      idempotencyKey: `u7c-filter-pause-${fixture.inventoryId}`,
    });
  }
  if (effectiveState === 'needs_attention') {
    await saveDetails(db, fixture, { isSellable: false });
  }
  if (effectiveState === 'out_of_stock') await adjustStock(db, fixture, -3);
  return fixture;
}

async function seedFilterMatrix(db) {
  const root = await seedUnit7cInventory(db, { title: 'private-0' });
  const owned = [root];
  for (const effectiveState of [
    'private', 'live', 'paused', 'needs_attention', 'out_of_stock',
  ]) {
    const start = effectiveState === 'private' ? 1 : 0;
    for (let ordinal = start; ordinal < 4; ordinal += 1) {
      owned.push(await seedCategory(db, root, effectiveState, ordinal));
    }
  }

  const failed = await seedUnit7cInventory(db, {
    storeId: root.storeId,
    ownerId: root.ownerId,
    otherOwnerId: root.otherOwnerId,
    title: 'publication-failed-0',
  });
  await installTransientProjectionFault(db, failed);
  const failedResult = await publishInventory(db, failed);
  assert.equal(failedResult.outcome, 'committed_publication_failed');
  await disableTransientProjectionFault(db);
  owned.push(failed);

  const foreign = await seedUnit7cInventory(db, { title: 'foreign-private' });
  await seedCategory(db, foreign, 'live', 99);
  await setActor(db, root.ownerId);
  return { root, owned, foreign };
}

async function authoritativeItems(db, fixtures) {
  const entries = [];
  for (const fixture of fixtures) {
    const item = await storeViewDetail(db, fixture.inventoryId);
    entries.push([fixture.inventoryId, item]);
  }
  return new Map(entries);
}

function matchesFilter(item, filter) {
  return filter === 'all'
    || (filter === 'needs_attention'
      ? item.attention.attentionState === 'action_required'
      : item.lifecycle.effectiveState === filter);
}

async function traverse(db, filter, pageSize) {
  const ids = [];
  const items = [];
  let cursor = null;
  let pages = 0;
  do {
    const page = await storeViewPageV2(db, pageSize, cursor, filter);
    pages += 1;
    items.push(...page.items);
    ids.push(...page.items.map((item) => item.identity.inventoryId));
    assert.equal(page.pageInfo.hasNextPage, page.pageInfo.nextCursor !== null);
    cursor = page.pageInfo.nextCursor;
    assert.ok(pages < 100, 'cursor traversal must terminate');
  } while (cursor !== null);
  assert.equal(new Set(ids).size, ids.length, `${filter} must not duplicate rows`);
  return { ids, items, pages };
}

test('U7C-WU2A-RED/GREEN all six filters are complete before keyset pagination', () => withDb(async (db) => {
  const { owned } = await seedFilterMatrix(db);
  const items = await authoritativeItems(db, owned);
  const filters = ['all', 'private', 'live', 'paused', 'needs_attention', 'out_of_stock'];

  for (const pageSize of [1, 2, 3]) {
    for (const filter of filters) {
      const first = await traverse(db, filter, pageSize);
      const repeated = await traverse(db, filter, pageSize);
      const expected = [...items]
        .filter(([, item]) => matchesFilter(item, filter))
        .map(([id]) => id);
      assert.deepEqual(new Set(first.ids), new Set(expected), `${filter} completeness`);
      assert.deepEqual(first.ids, repeated.ids, `${filter} deterministic traversal`);
      if (filter !== 'all') assert.ok(first.pages > 1, `${filter} must span pages`);
    }
  }

  assert.equal([...items.values()].some(
    (item) => item.lifecycle.effectiveState === 'publication_failed',
  ), true);
  const attention = await traverse(db, 'needs_attention', 1);
  const failedEntry = [...items].find(([, item]) => item.lifecycle.effectiveState === 'publication_failed');
  const failedId = failedEntry[0];
  const failed = attention.items.find((item) => item.identity.inventoryId === failedId);
  assert.ok(failed, 'publication_failed must be included in needs_attention');
  assert.equal(failed.lifecycle.effectiveState, 'publication_failed');
  assert.equal(failed.attention.attentionState, 'action_required');
  assert.equal(failed.attention.attentionReasons.includes('publication_failed'), true);
  assert.equal(failed.capabilities.includes('retry_publication'), true);
  assert.equal(attention.items.filter(
    (item) => item.lifecycle.effectiveState === 'needs_attention',
  ).length, 4, 'ordinary attention rows remain in the same bucket');
  assert.equal(attention.items.some(
    (item) => item.lifecycle.effectiveState === 'out_of_stock',
  ), false, 'out_of_stock is not an attention reason');
}));

test('U7C-WU2A-RED/GREEN cursor is context-bound and invalid filters fail safely', () => withDb(async (db) => {
  const { root, foreign } = await seedFilterMatrix(db);
  const attention = await storeViewPageV2(db, 1, null, 'needs_attention');
  assert.equal(attention.pageInfo.hasNextPage, true);
  await assert.rejects(
    storeViewPageV2(db, 1, attention.pageInfo.nextCursor, 'private'),
    /P9_CURSOR_INVALID/,
  );
  await assert.rejects(storeViewPageV2(db, 1, null, 'unknown'), /P9_REQUEST_INVALID/);
  await assert.rejects(storeViewPageV2(db, 1, 'not-base64', 'all'), /P9_CURSOR_INVALID/);
  await setActor(db, foreign.ownerId);
  await assert.rejects(
    storeViewPageV2(db, 1, attention.pageInfo.nextCursor, 'needs_attention'),
    /P9_CURSOR_INVALID/,
  );
  await setActor(db, root.otherOwnerId);
  await assert.rejects(storeViewPageV2(db, 1, null, 'all'), /P9_OWNER_NOT_AUTHORIZED/);
}));

test('U7C-WU2A-RED/GREEN tenancy and existing v1/detail contracts remain unchanged', () => withDb(async (db) => {
  const { root, owned, foreign } = await seedFilterMatrix(db);
  const ownerPage = await traverse(db, 'all', 2);
  assert.equal(ownerPage.ids.length, owned.length);
  assert.equal(ownerPage.ids.includes(foreign.inventoryId), false);

  await setActor(db, foreign.ownerId);
  const foreignPage = await traverse(db, 'all', 1);
  assert.equal(foreignPage.ids.includes(foreign.inventoryId), true);
  assert.equal(foreignPage.ids.some((id) => owned.some((item) => item.inventoryId === id)), false);

  await setActor(db, root.ownerId);
  const v1 = await storeViewPage(db, 1);
  assert.equal(v1.items.length, 1);
  assert.equal((await storeViewDetail(db, root.inventoryId)).identity.inventoryId, root.inventoryId);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'anon','public.phase9_store_view_page_v2(integer,text,text)','EXECUTE')`), false);
  assert.equal(await scalar(db, `SELECT has_function_privilege(
    'authenticated','public.phase9_store_view_page_v2(integer,text,text)','EXECUTE')`), true);
}));
