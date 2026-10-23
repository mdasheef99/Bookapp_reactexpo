// Task 8 LOCAL proof. Picker SDD §§7/9-11, EP-AC07/09/10/12-16/18/20.
// Invoked ONLY by run-phase9-bookstore-first-postgres.ps1 -IncludeEditionPicker after unchanged M65-M78.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { json, owner, q, race, rpcSql, service, sql, verifyConnectionsClosed } from './editionPickerPostgresConnections.mjs';
import { addSql, assertCommitted, card, choices, chosen, completeSql, expire, inventory, lookupSql,
  operation, options, ownerAction, provider, result, save, selectSql, state, withOptions,
  workerAction } from './editionPickerPostgresFixture.mjs';
import './phase9EditionPickerAcceptance.postgres.mjs';

before(async () => {
  await provider();
  assert.equal(await sql('SELECT current_user', 'authenticated'), 'authenticated');
  assert.equal(await sql('SELECT current_user', 'service_role'), 'service_role');
  console.log('EP8_STACK: unchanged Phase 9 M01-M62 (M09 excluded), M65-M78; no M63/M64');
});
after(verifyConnectionsClosed);
function conflict(value, pattern = /P9_(?:VERSION_CONFLICT|CANDIDATE_VERSION_CONFLICT|STATE_CONFLICT)/) {
  assert.equal(value.ok, false, 'conflicting command must fail safely');
  assert.match(value.error.message, pattern);
}
function accepted(value) {
  if (!value.ok) throw value.error;
  return value.value;
}
async function tally(f) {
  return json("SELECT json_build_object('inventory',(SELECT count(*) FROM public.store_inventory WHERE created_from_candidate_id="
    + q(f.candidateId) + "),'audit',(SELECT count(*) FROM public.marketplace_audit_logs WHERE action='phase9.candidate_commit'"
    + " AND details->>'candidateId'=" + q(f.candidateId) + "),'events',(SELECT count(*) FROM public.marketplace_events"
    + " WHERE event_type='inventory.created_from_candidate' AND payload->>'candidateId'=" + q(f.candidateId)
    + "),'committed',(SELECT committed_count FROM public.image_extraction_sessions WHERE id=" + q(f.sessionId) + '))');
}

test('EP-AC12: parallel selections at the same candidate/version accept one choice and reject the other', async () => {
  const f = await withOptions(), before = await state(f);
  const first = selectSql(f, f.choices, f.result.rows[0].optionId);
  const second = selectSql(f, f.choices, f.result.rows[1].optionId);
  const r = await race('selections', ownerAction(first, f), ownerAction(second, f));
  conflict(r.contender);
  const current = await choices(f);
  assert.equal(current.selection.optionId, f.result.rows[0].optionId);
  assert.equal(current.selection.selectionId, r.held.selection.selectionId);
  assert.equal(current.metadataRevision, before.metadata_revision + 1);
  assert.deepEqual(await inventory(f), []);
});

// Slice 5a SDD §§5.5/12: hold one real command transaction, then prove the contender
// waits on its session lock and loses at the version/generation fence after release.
for (const contender of ['request', 'select']) {
  test('AC5a lock order: ISBN set wins against concurrent ' + contender + ' without deadlock', async () => {
    const f = await withOptions(), before = await choices(f);
    const command = rpcSql('phase9_set_candidate_isbn_v1', [f.sessionId, f.candidateId,
      randomUUID(), randomUUID(), before.candidateVersion, '9780306406157']);
    const competing = contender === 'request' ? lookupSql(f, before.requestGeneration)
      : selectSql(f, before, f.result.rows[0].optionId);
    const raced = await race('isbn-' + contender, ownerAction(command, f), ownerAction(competing, f));
    conflict(raced.contender);
    assert.equal(raced.held.ownerIsbn13, '9780306406157');
    const current = await choices(f);
    assert.equal(current.candidateVersion, before.candidateVersion + 1);
    assert.equal(current.metadataRevision, before.metadataRevision + 1);
    assert.equal(current.selection, null);
    assert.deepEqual(current.rows, []);
    assert.equal(await sql("SELECT count(*) FROM public.phase9_idempotency_keys WHERE actor_or_service="
      + q(f.ownerId) + " AND operation='EP_ISBN_V1'"), '1');
    // The validated helper is the first lock-taking statement; its body preserves
    // session → candidate order, followed by state insertion/update in the command.
    const body = await sql("SELECT prosrc FROM pg_proc WHERE oid='public.phase9_set_candidate_isbn_v1(uuid,uuid,uuid,text,integer,text)'::regprocedure");
    assert.ok(body.indexOf('phase9_edition_assert_owner_candidate') < body.indexOf('INSERT INTO public.phase9_candidate_edition_state'));
    const guard = await sql("SELECT prosrc FROM pg_proc WHERE oid='marketplace_sec.phase9_edition_assert_owner_candidate(uuid,uuid)'::regprocedure");
    assert.ok(guard.indexOf('phase9_owner_ux_lock_active_session') < guard.indexOf('FOR UPDATE'));
  });
}

test('EP-AC12/13: selection wins against stale Add; only a fresh Save/Add can materialize the new edition', async () => {
  const f = await chosen(), before = await choices(f), staleAdd = await addSql(f);
  const selection = selectSql(f, before, f.result.rows[1].optionId);
  const r = await race('selection-add', ownerAction(selection, f), ownerAction(staleAdd, f));
  conflict(r.contender);
  assert.deepEqual(await inventory(f), []);
  assert.equal((await choices(f)).selection.snapshot.publisher, 'Alternative Fixture Press');
  f.selected = r.held;
  await save(f);
  assert.equal((await owner(await addSql(f), f)).outcome, 'committed_private');
  await assertCommitted(f);
});

test('EP-AC12/13: Add wins against concurrent selection; the committed choice stays immutable', async () => {
  const f = await chosen(), current = await choices(f);
  const r = await race('add-selection', ownerAction(await addSql(f), f),
    ownerAction(selectSql(f, current, f.result.rows[1].optionId), f));
  conflict(r.contender);
  assert.equal(r.held.outcome, 'committed_private');
  await assertCommitted(f);
});

test('EP-AC09/14: queued lookup overlaps Add, then cannot accept work for the committed candidate', async () => {
  const f = await chosen();
  await expire(f);
  const current = await choices(f), add = await addSql(f);
  const request = lookupSql(f, current.requestGeneration);
  const r = await race('queued-lookup-add', ownerAction(request, f), ownerAction(add, f));
  assert.equal(r.held.status, 'pending');
  assert.equal(accepted(r.contender).outcome, 'committed_private');
  await assertCommitted(f);
  const claims = await service("SELECT coalesce(json_agg(c),'[]') FROM public.claim_phase9_metadata_jobs(10,"
    + q('edition-picker-postgres-worker') + ') c');
  const claim = claims.find(c => c.id === r.held.operationId);
  if (claim) await assert.rejects(service(rpcSql('phase9_metadata_job_context',
    [claim.id, 'edition-picker-postgres-worker', claim.lease_token, claim.attempt_count])), /P9_STATE_CONFLICT/);
  assert.deepEqual((await options(f)).options, []);
});

for (const order of ['commit-first', 'completion-first']) {
  test('EP-AC09/14: in-flight completion versus Add, ' + order, async () => {
    const f = await chosen();
    await expire(f);
    const p = await operation(f), rows = result(p, { publisher: 'Late response must not become chosen' });
    const completion = completeSql(p, rows), add = await addSql(f);
    const left = order === 'commit-first' ? ownerAction(add, f) : workerAction(completion);
    const right = order === 'commit-first' ? workerAction(completion) : ownerAction(add, f);
    const r = await race(order, left, right);
    if (order === 'commit-first') {
      assert.equal(r.held.outcome, 'committed_private');
      assert.equal(accepted(r.contender).status, 'stale_rejected');
    } else {
      assert.equal(r.held.status, 'completed');
      assert.equal(accepted(r.contender).outcome, 'committed_private');
    }
    await assertCommitted(f);
    assert.equal((await service(completion)).status, 'stale_rejected', 'late replay cannot resurrect alternatives');
    assert.equal((await options(f)).selected_option_snapshot.publisher, f.selected.selection.snapshot.publisher);
  });
}

test('EP-AC07: concurrent exact lookup replay and a separate repeated tap create one logical request', async () => {
  const f = await card(), request = lookupSql(f, 0, randomUUID(), randomUUID());
  const exact = await race('lookup-replay', ownerAction(request, f), ownerAction(request, f));
  assert.deepEqual(accepted(exact.contender), exact.held);
  const tap = await race('lookup-tap', ownerAction(lookupSql(f), f), ownerAction(lookupSql(f), f));
  assert.equal(accepted(tap.contender).operationId, exact.held.operationId);
  assert.equal(tap.held.operationId, exact.held.operationId);
  assert.equal(await sql("SELECT count(*) FROM public.image_extraction_jobs WHERE entity_id=" + q(f.candidateId)
    + " AND operation_version='p9-owner-edition-options-v1'"), '1');
  assert.equal(await sql("SELECT count(*) FROM public.phase9_idempotency_keys WHERE actor_or_service="
    + q(f.ownerId) + " AND operation='EP_LOOKUP_V1'"), '3');
});

test('EP-AC10: concurrent selection replay returns the one held choice without advancing versions twice', async () => {
  const f = await withOptions(), before = await choices(f);
  const command = selectSql(f, before, f.result.rows[0].optionId, { key: randomUUID(), command: randomUUID() });
  const r = await race('select-replay', ownerAction(command, f), ownerAction(command, f));
  const replay = accepted(r.contender);
  assert.deepEqual(replay.selection, r.held.selection); assert.deepEqual(replay.rows, []);
  assert.equal((await choices(f)).metadataRevision, before.metadataRevision + 1);
  assert.equal(await sql("SELECT count(*) FROM public.phase9_idempotency_keys WHERE actor_or_service="
    + q(f.ownerId) + " AND operation='EP_SELECT_V1'"), '1');
});

test('EP-AC07/20: concurrent completion retries recover one persisted set and one physical call', async () => {
  const f = await card(), p = await operation(f), rows = result(p), command = completeSql(p, rows);
  const r = await race('completion-replay', workerAction(command), workerAction(command));
  assert.equal(r.held.status, 'completed'); assert.equal(accepted(r.contender).status, 'replayed');
  assert.equal((await options(f)).options_version, 1);
  assert.deepEqual((await options(f)).options, rows.rows);
  assert.equal(await sql('SELECT count(*) FROM public.phase9_metadata_provider_calls WHERE job_id=' + q(p.jobId)), '1');
  assert.equal((await service(rpcSql('phase9_recover_candidate_edition_options_v1',
    [p.jobId, 'edition-picker-postgres-worker', p.token, p.attempt, f.candidateId, f.storeId,
      f.sessionId, p.jobId, p.context.requestGeneration, p.context.queryIdentity]))).status, 'replayed');
});

test('EP-AC13/14/20: response loss with overlapping Add replay has exactly one complete inventory effect', async () => {
  const f = await chosen(), command = await addSql(f);
  const r = await race('add-replay', ownerAction(command, f), ownerAction(command, f));
  const recovered = accepted(r.contender);
  assert.deepEqual(recovered, r.held);
  assert.deepEqual(await owner(command, f), recovered, 'discarded success response is recovered through the exact command');
  assert.deepEqual(await tally(f), { inventory: 1, audit: 1, events: 1, committed: 1 });
  await assertCommitted(f);
});

test('EP-AC18: Owner/tenant/worker boundaries and stale claims remain enforced on native PostgreSQL', async () => {
  const f = await chosen(), other = await card();
  await assert.rejects(owner(selectSql(f, await choices(f), f.result.rows[1].optionId), other),
    /P9_NOT_FOUND|P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(owner(await addSql(f), other), /P9_NOT_FOUND|P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(sql('SELECT options FROM public.phase9_candidate_edition_state', 'authenticated', f.ownerId),
    /permission denied/);
  await sql("UPDATE public.store_administrators SET status='inactive' WHERE store_id=" + q(f.storeId));
  await assert.rejects(choices(f), /P9_OWNER_NOT_AUTHORIZED/);
  await sql("UPDATE public.store_administrators SET status='active' WHERE store_id=" + q(f.storeId));
  const p = await operation(await card()), command = completeSql(p, result(p));
  await assert.rejects(sql(command, 'authenticated', f.ownerId), /permission denied/);
  const stale = { ...p, token: 'b'.repeat(64) };
  assert.equal((await service(completeSql(stale, result(stale)))).status, 'stale_rejected');
  await sql("UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 minute'"
    + ' WHERE id=' + q(p.jobId));
  assert.equal((await service(command)).status, 'stale_rejected');
});
