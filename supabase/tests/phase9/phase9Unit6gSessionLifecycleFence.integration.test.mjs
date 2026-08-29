import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  commitSql, createUnit7aDatabase, seedReviewedCandidate,
} from './unit7aFixture.mjs';

const M52 = '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql';
const M53 = '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql';
const M54 = '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql';
const lifecycleCases = [
  { label: 'closing', status: 'closing', expired: false },
  { label: 'closed', status: 'closed', expired: false },
  { label: 'expired-status', status: 'expired', expired: false },
  { label: 'past-expiry', status: 'active', expired: true },
];

let db;

const sqlJson = (value) => JSON.stringify(value).replaceAll("'", "''");

before(async () => {
  db = await createUnit7aDatabase();
  await db.exec(`CREATE TABLE IF NOT EXISTS public.marketplace_event_schema_registry(
    event_type text NOT NULL,schema_version integer NOT NULL CHECK(schema_version>=1),
    entity_type text NOT NULL,is_transition boolean NOT NULL,
    privacy_classification text NOT NULL CHECK(privacy_classification IN('internal','confidential')),
    PRIMARY KEY(event_type,schema_version));
    ALTER TABLE public.marketplace_events
      ADD COLUMN IF NOT EXISTS actor_role text,
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system_job',
      ADD COLUMN IF NOT EXISTS idempotency_key text,
      ADD COLUMN IF NOT EXISTS command_id uuid,
      ADD COLUMN IF NOT EXISTS correlation_id uuid,
      ADD COLUMN IF NOT EXISTS causation_event_id uuid,
      ADD COLUMN IF NOT EXISTS privacy_classification text NOT NULL DEFAULT 'internal',
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;`);
  await db.exec(fs.readFileSync(migrationPath(M52), 'utf8'));
  await db.exec(fs.readFileSync(migrationPath(M53), 'utf8'));
  await db.exec(fs.readFileSync(migrationPath(M54), 'utf8'));
});

after(async () => db?.close());

function saveSql(fixture, { idempotencyKey, commandId } = {}) {
  return `SELECT public.phase9_update_candidate_review_v2(
    '${fixture.sessionId}','${fixture.candidateId}',${fixture.candidateVersion},
    ${fixture.metadataRevision},'${sqlJson(fixture.review)}'::jsonb,
    '${idempotencyKey ?? `m54-save-${randomUUID()}`}',
    '${commandId ?? randomUUID()}')`;
}

function removeSql(fixture, { idempotencyKey, commandId } = {}) {
  return `SELECT public.phase9_owner_remove_candidate_v1(
    '${fixture.sessionId}','${fixture.candidateId}',${fixture.candidateVersion},
    '${idempotencyKey ?? `m54-remove-${randomUUID()}`}',
    '${commandId ?? randomUUID()}')`;
}

async function setLifecycle(fixture, lifecycle) {
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions
    SET status='${lifecycle.status}',
      expires_at=${lifecycle.expired
    ? "transaction_timestamp()-interval '1 minute'"
    : "transaction_timestamp()+interval '1 day'"}
    WHERE id='${fixture.sessionId}'`);
  await setActor(db, fixture.ownerId);
}

async function effectSnapshot(fixture, keys) {
  await resetActor(db);
  return scalar(db, `SELECT jsonb_build_object(
    'candidate',(SELECT jsonb_build_object(
      'state',state,'version',version,'reviewVersion',review_version,
      'reviewDisposition',review_disposition,'reviewReady',review_ready,
      'inventoryId',committed_inventory_id)
      FROM public.image_extraction_candidates WHERE id='${fixture.candidateId}'),
    'committedCount',(SELECT committed_count FROM public.image_extraction_sessions
      WHERE id='${fixture.sessionId}'),
    'inventoryCount',(SELECT count(*) FROM public.store_inventory
      WHERE created_from_candidate_id='${fixture.candidateId}'),
    'auditCount',(SELECT count(*) FROM public.marketplace_audit_logs
      WHERE details->>'candidateId'='${fixture.candidateId}'),
    'eventCount',(SELECT count(*) FROM public.marketplace_events
      WHERE payload->>'candidateId'='${fixture.candidateId}'),
    'replayCount',(SELECT count(*) FROM public.phase9_idempotency_keys
      WHERE idempotency_key IN (${keys.map((key) => `'${key}'`).join(',')})))`);
}

test('M54-01 non-mutable sessions expose read-only candidate actions', async () => {
  for (const lifecycle of lifecycleCases) {
    const fixture = await seedReviewedCandidate(db);
    await setLifecycle(fixture, lifecycle);
    const detail = await scalar(db, `SELECT public.phase9_owner_candidate_detail_v2(
      '${fixture.sessionId}','${fixture.candidateId}')`);
    const batch = await scalar(db, `SELECT public.phase9_owner_batch_review_v1(
      '${fixture.sessionId}')`);
    assert.deepEqual(detail.allowedActions, ['view_readiness'], lifecycle.label);
    assert.deepEqual(batch.items[0].allowedActions,
      ['view_metadata', 'view_readiness'], lifecycle.label);
  }
});

test('M54-02 Save, Add and Remove reject every non-mutable lifecycle without effects', async () => {
  for (const lifecycle of lifecycleCases) {
    const fixture = await seedReviewedCandidate(db);
    const keys = [
      `m54-save-deny-${randomUUID()}`,
      `m54-add-deny-${randomUUID()}`,
      `m54-remove-deny-${randomUUID()}`,
    ];
    const before = await effectSnapshot(fixture, keys);
    await setLifecycle(fixture, lifecycle);
    await assert.rejects(db.query(saveSql(fixture, { idempotencyKey: keys[0] })),
      /P9_STATE_CONFLICT/, `Save ${lifecycle.label}`);
    await assert.rejects(db.query(commitSql(fixture, { idempotencyKey: keys[1] })),
      /P9_STATE_CONFLICT/, `Add ${lifecycle.label}`);
    await assert.rejects(db.query(removeSql(fixture, { idempotencyKey: keys[2] })),
      /P9_STATE_CONFLICT/, `Remove ${lifecycle.label}`);
    const after = await effectSnapshot(fixture, keys);
    assert.deepEqual(after, before, lifecycle.label);
  }
});

test('M54-03 active, unexpired Save, Add and Remove controls still succeed', async () => {
  const saved = await seedReviewedCandidate(db);
  const saveResult = await scalar(db, saveSql(saved));
  assert.equal(saveResult.candidateId, saved.candidateId);
  assert.equal(saveResult.allowedActions.includes('add_to_inventory'), true);

  const added = await seedReviewedCandidate(db);
  const addResult = await scalar(db, commitSql(added));
  assert.equal(addResult.candidateId, added.candidateId);
  assert.equal(addResult.outcome, 'committed_private');

  const removed = await seedReviewedCandidate(db);
  const removeResult = await scalar(db, removeSql(removed));
  assert.equal(removeResult.reviewDisposition, 'owner_removed_from_scan');
});

test('M54-04 completed replays survive Close and Save replay becomes read-only', async () => {
  const saved = await seedReviewedCandidate(db);
  const saveIdentity = {
    idempotencyKey: `m54-save-replay-${randomUUID()}`, commandId: randomUUID(),
  };
  const saveCommand = saveSql(saved, saveIdentity);
  const saveResult = await scalar(db, saveCommand);
  await setLifecycle(saved, { status: 'closed', expired: false });
  const saveReplay = await scalar(db, saveCommand);
  assert.deepEqual(saveReplay, {
    ...saveResult,
    allowedActions: ['view_readiness'],
  });

  const added = await seedReviewedCandidate(db);
  const addIdentity = {
    idempotencyKey: `m54-add-replay-${randomUUID()}`, commandId: randomUUID(),
  };
  const addCommand = commitSql(added, addIdentity);
  const addResult = await scalar(db, addCommand);
  await setLifecycle(added, { status: 'closed', expired: false });
  assert.deepEqual(await scalar(db, addCommand), addResult);

  const removed = await seedReviewedCandidate(db);
  const removeIdentity = {
    idempotencyKey: `m54-remove-replay-${randomUUID()}`, commandId: randomUUID(),
  };
  const removeCommand = removeSql(removed, removeIdentity);
  const removeResult = await scalar(db, removeCommand);
  await setLifecycle(removed, { status: 'closed', expired: false });
  assert.deepEqual(await scalar(db, removeCommand), removeResult);
});
