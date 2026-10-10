// Operation and automatic-baseline proof against the forward Task 2 schema, not a live database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import {
  claimJob, createEditionPickerDatabase, lookupSql, metadata, readSql, resetActor, row,
  scalar, seedAutomaticLineage, seedCanonical, seedCard, seedOptions, selectSql, setActor,
} from './editionPickerFixture.mjs';
let db;
before(async () => { db = await createEditionPickerDatabase(); });
after(async () => db?.close());

test('automatic context preserves authoritative vision checks, rejects conflicts and retains medium text suggestions', async () => {
  const isbn = '9780553296983', f = await seedCard(db, { isbn });
  const lineage = await seedAutomaticLineage(db, f);
  const edition = await seedCanonical(db, f, { isbn13: isbn });
  const sql = await claimJob(db, f, lineage.jobId);
  const context = await scalar(db, sql);
  assert.equal(context.localCanonicalEditionId, edition);
  assert.equal('purpose' in context, false); assert.equal(context.candidateState, 'processing');
  await resetActor(db);
  await db.query("UPDATE public.canonical_editions SET title='Conflicting title' WHERE id=$1", [edition]);
  await setActor(db, f.ownerId, 'service_role');
  assert.equal((await scalar(db, sql)).localCanonicalEditionId, null);
  await resetActor(db);
  await db.query("UPDATE public.canonical_editions SET title=$1 WHERE id=$2", [metadata.title, edition]);
  await db.query("UPDATE public.image_extraction_candidates SET observed_isbn_clue=NULL WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId, 'service_role');
  assert.equal((await scalar(db, sql)).localCanonicalEditionId, edition);
  await resetActor(db);
  await assert.rejects(db.query("UPDATE public.image_analysis_results SET authoritative_outcome='quality_rejected' WHERE id=$1",
    [lineage.resultId]), /P9_VISION_EVIDENCE_IMMUTABLE/);
  const invalid = await seedCard(db), rejected = await seedAutomaticLineage(db, invalid, 'quality_rejected');
  const invalidSql = await claimJob(db, invalid, rejected.jobId);
  await assert.rejects(db.query(invalidSql), /P9_STATE_CONFLICT/);
});
test('explicit structural admission tolerates selling-version updates but rejects removal or expired lease', async () => {
  const f = await seedCard(db), receipt = await scalar(db, lookupSql(f));
  const sql = await claimJob(db, f, receipt.operationId);
  const first = await scalar(db, sql);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=jsonb_set(owner_review_snapshot,"
    + "'{value,quantity}','7'),version=version+1 WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId, 'service_role');
  const updated = await scalar(db, sql);
  assert.equal(updated.requestGeneration, first.requestGeneration);
  assert.equal(updated.candidateVersion, first.candidateVersion + 1);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [receipt.operationId]);
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(db.query(sql), /P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()+interval '5 minutes' WHERE id=$1", [receipt.operationId]);
  await db.query("UPDATE public.image_extraction_candidates SET review_disposition='owner_removed_from_scan' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(db.query(sql), /P9_STATE_CONFLICT/);
});
test('new explicit operation fences a superseded job after options expire without losing selection', async () => {
  const f = await seedCard(db), options = await seedOptions(db, f);
  const selected = await scalar(db, selectSql(f, options.choices, options.rows[0].optionId));
  const oldSql = await claimJob(db, f, options.receipt.operationId);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1", [options.receipt.operationId]);
  await db.query("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',"
    + "options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const next = await scalar(db, lookupSql(f));
  assert.notEqual(next.operationId, options.receipt.operationId);
  assert.deepEqual((await scalar(db, readSql(f))).selection, selected.selection);
  await claimJob(db, f, options.receipt.operationId);
  await assert.rejects(db.query(oldSql), /P9_STATE_CONFLICT/);
});
test('null arguments, source mixtures and internal selection fragments fail closed', async () => {
  const f = await seedCard(db), options = await seedOptions(db, f);
  const request = lookupSql(f);
  await assert.rejects(db.query(request.replace(',0,', ',NULL,')), /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(selectSql(f, options.choices, options.rows[0].optionId).replace("'edition_option'", 'NULL')), /P9_REQUEST_INVALID/);
  const select = selectSql(f, options.choices, options.rows[0].optionId);
  await assert.rejects(db.query(select.replace(",NULL,'", ",'" + randomUUID() + "','")), /P9_REQUEST_INVALID/);
  await resetActor(db);
  await assert.rejects(db.query("UPDATE public.phase9_candidate_edition_state SET selection_id=$1,selected_source_id=$1,"
    + "selected_option_snapshot=$2,selected_at=transaction_timestamp(),selected_by=$3 WHERE candidate_id=$4",
  [randomUUID(), metadata, f.ownerId, f.candidateId]), /check constraint/);
});

test('safe stored rows must satisfy the public ISBN bounds before a gateway projection', async () => {
  await resetActor(db);
  const malformed = row(0, { metadata: { ...metadata, isbn13: '123' }, eligibility: 'ineligible' });
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_edition_valid_rows('" +
    JSON.stringify([malformed]).replaceAll("'", "''") + "'::jsonb)"), false);
});

test('a material observed ISBN correction invalidates selection while formatting changes preserve it', async () => {
  const f = await seedCard(db), options = await seedOptions(db, f);
  const selected = await scalar(db, selectSql(f, options.choices, options.rows[0].optionId));
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET observed_isbn_clue='978-0-306-40615-7' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  assert.deepEqual((await scalar(db, readSql(f))).selection, selected.selection);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET observed_isbn_clue='9780061120084' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const corrected = await scalar(db, readSql(f));
  assert.equal(corrected.requestGeneration, selected.requestGeneration + 1);
  assert.equal(corrected.selection, null); assert.deepEqual(corrected.rows, []);
});
