// Picker SDD §§6-11, EP-AC10/11/13-16/18-20: actual full-stack SQL persistence, distinct from mocked UI.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { reviewedValue } from './unit7aFixture.mjs';
import { json, owner, q, service, sql } from './editionPickerPostgresConnections.mjs';
import { addSql, assertCommitted, card, choices, chosen, completeSql, expire, inventory, lookupSql, operation,
  options, provider, readSql, result, save, selectSql, state, withOptions } from './editionPickerPostgresFixture.mjs';

test('EP-AC11/13/19: choice before review persists through real Save, fresh resume and single Add', async () => {
  const f = await card();
  await sql("UPDATE public.image_extraction_candidates SET owner_review_snapshot='{}',review_version=NULL,"
    + 'review_ready=false,review_disposition=NULL WHERE id=' + q(f.candidateId));
  const available = await withOptions(f);
  const selected = await owner(selectSql(f, available.choices, available.result.rows[0].optionId), f);
  f.selected = selected;
  assert.equal(selected.selection.confirmedByOwner, true);
  assert.equal(selected.reviewVersion, null);
  const beforeSave = await owner('SELECT public.phase9_owner_candidate_detail_v2('
    + q(f.sessionId) + ',' + q(f.candidateId) + ')', f);
  assert.equal(beforeSave.review.value, null, 'selection/read do not fabricate a selling review');
  await assert.rejects(owner(await addSql(f), f), /P9_/);
  const m = selected.selection.snapshot;
  const selling = reviewedValue({ originalTitle: m.title, authors: m.authors, originalLanguage: m.language,
    script: m.script, metadataChoice: { mode: 'edition_option', selectionId: selected.selection.selectionId },
    quantity: 4, priceMinor: 0, shelfLocation: 'Latest Shelf C3',
    originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) } });
  await save(f, selling);
  // Each helper creates a fresh independent connection, including both real resume readers.
  const detail = await owner('SELECT public.phase9_owner_candidate_detail_v2('
    + q(f.sessionId) + ',' + q(f.candidateId) + ')', f);
  const batch = await owner('SELECT public.phase9_owner_batch_review_v1(' + q(f.sessionId) + ')', f);
  assert.equal(detail.metadata.selectionId, selected.selection.selectionId);
  assert.equal(batch.items[0].metadataSummary.selectionId, selected.selection.selectionId);
  assert.deepEqual(detail.review.value, selling);
  assert.equal(detail.review.value.script, m.script);
  assert.equal((await choices(f)).selection.confirmedByOwner, true);
  assert.equal((await owner(await addSql(f), f)).outcome, 'committed_private');
  await assertCommitted(f);
});

test('EP-AC13/14/16: bulk per-card Save/Add persists both choices and clears only the committed card', async () => {
  const first = await chosen(), second = await chosen(await card(first), { coverReference: null });
  const secondBefore = await options(second);
  await save(first, { priceMinor: 1001, quantity: 2 });
  await save(second, { priceMinor: 2002, quantity: 5 });
  assert.equal((await choices(first)).selection.selectionId, first.selected.selection.selectionId);
  assert.equal((await choices(second)).selection.selectionId, second.selected.selection.selectionId);
  const firstReceipt = await owner(await addSql(first), first);
  assert.equal(firstReceipt.outcome, 'committed_private');
  assert.deepEqual(await options(second), secondBefore, 'another candidate keeps its own options and selection');
  const secondReceipt = await owner(await addSql(second), second);
  assert.equal(secondReceipt.outcome, 'committed_private');
  const a = await assertCommitted(first), b = await assertCommitted(second);
  assert.notEqual(a.id, b.id);
  assert.equal(b.cover_url, null); assert.equal(b.representative_cover, null);
  assert.equal(await sql('SELECT committed_count FROM public.image_extraction_sessions WHERE id=' + q(first.sessionId)), '2');
});

test('EP-AC14/20: failure while clearing options rolls back inventory and receipts; the exact retry succeeds', async () => {
  const f = await chosen(), before = await options(f), candidateBefore = await state(f), command = await addSql(f);
  // A test-only CHECK injects a real transaction failure after INSERT, without replacing any production function.
  await sql('ALTER TABLE public.phase9_candidate_edition_state ADD CONSTRAINT ep8_injected_cleanup_failure CHECK('
    + 'candidate_id<>' + q(f.candidateId) + "::uuid OR options<>'[]'::jsonb)");
  try {
    await assert.rejects(owner(command, f), /ep8_injected_cleanup_failure/);
    assert.deepEqual(await inventory(f), []);
    assert.deepEqual(await options(f), before);
    assert.deepEqual(await state(f), candidateBefore);
    assert.equal(await sql("SELECT count(*) FROM public.phase9_idempotency_keys WHERE actor_or_service="
      + q(f.ownerId) + " AND operation='U7AC01'"), '0');
  } finally {
    await sql('ALTER TABLE public.phase9_candidate_edition_state DROP CONSTRAINT ep8_injected_cleanup_failure');
  }
  const receipt = await owner(command, f);
  assert.deepEqual(await owner(command, f), receipt);
  await assertCommitted(f);
});

test('EP-AC07/15/18: expiry, refresh, policy denial and normalized validation preserve the held selection', async () => {
  const f = await chosen(), held = f.selected.selection;
  await expire(f);
  const expired = await choices(f);
  assert.deepEqual(expired.rows, []);
  assert.equal(expired.selection.confirmedByOwner, true);
  await assert.rejects(owner(selectSql(f, expired, f.result.rows[1].optionId), f), /P9_STATE_CONFLICT/);
  const p = await operation(f), rows = result(p);
  assert.notEqual(p.jobId, f.operation.jobId);
  await assert.rejects(service(completeSql(p, rows, false)), /P9_METADATA_STORAGE_DENIED/);
  const malformed = { ...rows, rows: rows.rows.map(r => ({ ...r, metadata: { ...r.metadata, fetchedAt: '2026-10-09 BC' } })) };
  await assert.rejects(service(completeSql(p, malformed)), /P9_EDITION_ROWS_INVALID/);
  assert.deepEqual((await options(f)).options, []);
  assert.deepEqual((await choices(f)).selection, held);
  assert.equal((await service(completeSql(p, rows))).status, 'completed');
  assert.equal((await options(f)).options_version, 2);
  assert.equal(await sql('SELECT count(*) FROM public.metadata_enrichment_attempts WHERE candidate_id=' + q(f.candidateId)), '2');
  assert.deepEqual((await choices(f)).selection, held);
});

test('EP-AC19: disabling provider lookups preserves a saved edition_option and already committed inventory', async () => {
  const existing = await chosen();
  await owner(await addSql(existing), existing);
  const existingInventory = await inventory(existing), pending = await chosen();
  await provider(false);
  try {
    const resume = await choices(pending);
    assert.equal(resume.selection.confirmedByOwner, true);
    assert.equal(resume.selection.selectionId, pending.selected.selection.selectionId);
    await save(pending, { priceMinor: 1234 });
    assert.equal((await owner(await addSql(pending), pending)).outcome, 'committed_private');
    await assertCommitted(pending);
    assert.deepEqual(await inventory(existing), existingInventory);
  } finally { await provider(); }
});

test('EP-AC10/18: cross-candidate option IDs, closed sessions and anonymous access fail at real boundaries', async () => {
  const f = await withOptions(), other = await withOptions(await card(f));
  await assert.rejects(owner(selectSql(f, f.choices, other.result.rows[0].optionId), f), /P9_STATE_CONFLICT/);
  await assert.rejects(sql(readSql(f), 'anon'), /permission denied/);
  const lookup = lookupSql(f, f.choices.requestGeneration, randomUUID(), randomUUID());
  await sql("UPDATE public.image_extraction_sessions SET status='closed' WHERE id=" + q(f.sessionId));
  await assert.rejects(owner(lookup, f), /P9_STATE_CONFLICT/);
  assert.deepEqual(await inventory(f), []);
});