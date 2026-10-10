// Picker SDD §§4.3/5–6/8–9/11: per-card Owner authority, retention and selection proof.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import {
  createEditionPickerDatabase, json, lookupSql, metadata, readSql, resetActor, row,
  scalar, seedCanonical, seedCard, seedOptions, selectSql, setActor,
} from './editionPickerFixture.mjs';
let db;
before(async () => { db = await createEditionPickerDatabase(); });
after(async () => db?.close());

test('private state, RLS and controlled function grants deny all direct client access', async () => {
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT to_regclass('public.phase9_candidate_edition_state') IS NOT NULL"), true);
  assert.equal(await scalar(db, "SELECT relrowsecurity FROM pg_class WHERE oid='public.phase9_candidate_edition_state'::regclass"), true);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      assert.equal(await scalar(db, "SELECT has_table_privilege('" + role + "','public.phase9_candidate_edition_state','" + privilege + "')"), false);
    }
    assert.equal(await scalar(db, "SELECT has_function_privilege('" + role
      + "','marketplace_sec.phase9_edition_choices(image_extraction_candidates)','EXECUTE')"), false);
  }
  for (const signature of [
    'phase9_owner_candidate_edition_choices_v1(uuid,uuid)',
    'phase9_request_candidate_edition_options_v1(uuid,uuid,integer,text,uuid)',
    'phase9_select_candidate_edition_v1(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)',
  ]) {
    for (const role of ['anon', 'service_role']) assert.equal(await scalar(db,
      "SELECT has_function_privilege('" + role + "','public." + signature + "','EXECUTE')"), false);
    assert.equal(await scalar(db, "SELECT has_function_privilege('authenticated','public." + signature + "','EXECUTE')"), true);
  }
});
test('old/manual unfinished card reads safely without enqueue or creation of an option list', async () => {
  const f = await seedCard(db);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.candidateId, f.candidateId); assert.equal(choices.selection, null);
  assert.equal(choices.requestGeneration, 0); assert.equal(choices.optionsVersion, 0);
  assert.deepEqual(choices.rows, []); assert.equal(choices.lookupStatus, 'idle');
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.phase9_candidate_edition_state WHERE candidate_id='" + f.candidateId + "'"), 0);
});
test('another owner/store/candidate/session cannot read, request or select', async () => {
  const a = await seedCard(db), b = await seedCard(db);
  await setActor(db, a.ownerId);
  for (const sql of [readSql(b), lookupSql(b), readSql({ ...a, candidateId: b.candidateId })]) {
    await assert.rejects(db.query(sql), /P9_OWNER_NOT_AUTHORIZED|P9_NOT_FOUND/);
  }
  await assert.rejects(db.query(selectSql(b, { candidateVersion: 1, metadataRevision: 1, reviewVersion: 1, optionsVersion: 1 }, randomUUID())), /P9_OWNER_NOT_AUTHORIZED/);
});
for (const scenario of ['inactive_owner', 'closed', 'expired_session', 'removed', 'processing', 'expired_card']) {
  test('denies ineligible ' + scenario + ' without storing an operation', async () => {
    const f = await seedCard(db);
    await resetActor(db);
    if (scenario === 'inactive_owner') await db.query("UPDATE public.store_administrators SET status='inactive' WHERE store_id=$1", [f.storeId]);
    if (scenario === 'closed') await db.query("UPDATE public.image_extraction_sessions SET status='closed' WHERE id=$1", [f.sessionId]);
    if (scenario === 'expired_session') await db.query("UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [f.sessionId]);
    if (scenario === 'expired_card') await db.query("UPDATE public.image_extraction_candidates SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [f.candidateId]);
    if (scenario === 'removed') await db.query("UPDATE public.image_extraction_candidates SET review_disposition='owner_removed_from_scan' WHERE id=$1", [f.candidateId]);
    if (scenario === 'processing') await db.query("UPDATE public.image_extraction_candidates SET state='processing' WHERE id=$1", [f.candidateId]);
    await setActor(db, f.ownerId);
    await assert.rejects(db.query(lookupSql(f)), /P9_OWNER_NOT_AUTHORIZED|P9_STATE_CONFLICT/);
    await assert.rejects(db.query(readSql(f)), /P9_OWNER_NOT_AUTHORIZED|P9_STATE_CONFLICT/);
  });
}
test('lookup taps and exact replay share one durable operation and preserve saved review authority', async () => {
  const f = await seedCard(db), key = randomUUID(), command = randomUUID();
  const before = await scalar(db, readSql(f));
  const a = await scalar(db, lookupSql(f, 0, key, command));
  const b = await scalar(db, lookupSql(f));
  const replay = await scalar(db, lookupSql(f, 0, key, command));
  assert.equal(a.operationId, b.operationId); assert.deepEqual(a, replay);
  assert.equal(a.status, 'pending'); assert.equal(a.available, false);
  assert.equal((await scalar(db, readSql(f))).metadataRevision, before.metadataRevision);
  await assert.rejects(db.query(lookupSql(f, 0, key, randomUUID())), /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(db.query(lookupSql(f, 7)), /P9_VERSION_CONFLICT/);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.image_extraction_jobs WHERE entity_id='"
    + f.candidateId + "' AND operation_version='p9-owner-edition-options-v1'"), 1);
  assert.equal(await scalar(db, "SELECT review_ready FROM public.image_extraction_candidates WHERE id='" + f.candidateId + "'"), true);
  const receipt = await scalar(db, "SELECT canonical_response FROM public.phase9_idempotency_keys WHERE idempotency_key='" + key + "'");
  assert.equal('rows' in receipt, false);
});
test('fresh empty result is reusable and Show all/read cannot trigger another request', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f, []);
  const reused = await scalar(db, lookupSql(f));
  assert.equal(reused.operationId, result.receipt.operationId); assert.equal(reused.status, 'ready');
  assert.equal(reused.available, true); assert.deepEqual((await scalar(db, readSql(f))).rows, []);
});
test('safe projection keeps original positions and duplicates and removes private worker fields', async () => {
  const rows = [row(0), row(1, { metadata: null, googleBooksUrl: null, eligibility: 'unavailable' }), row(2)];
  const f = await seedCard(db), result = await seedOptions(db, f, rows);
  assert.deepEqual(result.choices.rows.map(r => r.ordinal), [0, 1, 2]);
  assert.equal(result.choices.rows[0].googleBooksUrl, result.choices.rows[2].googleBooksUrl);
  assert.equal(result.choices.rows[0].metadata.publishedDate, '2020');
  assert.equal('confidence' in result.choices.rows[0].metadata, false);
  assert.equal('providerRecordId' in result.choices.rows[0].metadata, false);
});
test('selection copies coherent metadata and preserves all saved selling fields', async () => {
  const f = await seedCard(db), option = row(), result = await seedOptions(db, f, [option]);
  const selected = await scalar(db, selectSql(f, result.choices, option.optionId));
  assert.equal(selected.selection.source, 'edition_option'); assert.equal(selected.selection.optionId, option.optionId);
  assert.deepEqual(selected.selection.snapshot.authors, metadata.authors);
  assert.equal(selected.selection.snapshot.coverReference, metadata.coverReference);
  assert.equal(selected.metadataRevision, result.choices.metadataRevision + 1);
  assert.equal(selected.reviewVersion, result.choices.reviewVersion + 1);
  await resetActor(db);
  const review = await scalar(db, "SELECT owner_review_snapshot->'value' FROM public.image_extraction_candidates WHERE id='" + f.candidateId + "'");
  for (const key of ['quantity', 'priceMinor', 'baseCondition', 'damageDisclosure', 'shelfLocation', 'notes', 'publicationIntent']) {
    assert.deepEqual(review[key], f.review[key]);
  }
  assert.deepEqual(review.metadataChoice, { mode: 'edition_option', selectionId: selected.selection.selectionId });
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.phase9_selected_metadata_snapshots WHERE candidate_id='" + f.candidateId + "'"), 0);
});
test('stale candidate/metadata/review versions and forged or cross-card options reject', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f);
  await assert.rejects(db.query(selectSql(f, result.choices, randomUUID())), /P9_STATE_CONFLICT/);
  await assert.rejects(db.query(selectSql(f, result.choices, result.rows[0].optionId, { candidateVersion: 99 })), /P9_CANDIDATE_VERSION_CONFLICT/);
  await assert.rejects(db.query(selectSql(f, result.choices, result.rows[0].optionId, { metadataRevision: 99 })), /P9_VERSION_CONFLICT/);
  await assert.rejects(db.query(selectSql(f, { ...result.choices, reviewVersion: 99 }, result.rows[0].optionId)), /P9_VERSION_CONFLICT/);
  await assert.rejects(db.query(selectSql(f, { ...result.choices, optionsVersion: 99 }, result.rows[0].optionId)), /P9_VERSION_CONFLICT/);
  const selected = await scalar(db, selectSql(f, result.choices, result.rows[0].optionId));
  await assert.rejects(db.query(selectSql(f, result.choices, result.rows[0].optionId)), /P9_VERSION_CONFLICT|P9_CANDIDATE_VERSION_CONFLICT/);
  assert.equal((await scalar(db, readSql(f))).selection.selectionId, selected.selection.selectionId);
});
for (const eligibility of ['unavailable', 'ineligible']) {
  test('cannot select ' + eligibility + ' rows', async () => {
    const f = await seedCard(db), option = row(0, eligibility === 'unavailable'
      ? { eligibility, metadata: null, googleBooksUrl: null } : { eligibility });
    const result = await seedOptions(db, f, [option]);
    await assert.rejects(db.query(selectSql(f, result.choices, option.optionId)), /P9_STATE_CONFLICT/);
  });
}
test('expired options are inaccessible while chosen snapshot and slim selection replay survive', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f), key = randomUUID(), command = randomUUID();
  const sql = selectSql(f, result.choices, result.rows[0].optionId, { key, command });
  const selected = await scalar(db, sql);
  await resetActor(db);
  await db.query("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',"
    + "options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const expired = await scalar(db, readSql(f));
  assert.deepEqual(expired.rows, []); assert.equal(expired.optionsExpiresAt, null);
  assert.deepEqual(expired.selection, selected.selection);
  await assert.rejects(db.query(selectSql(f, expired, result.rows[0].optionId)), /P9_STATE_CONFLICT/);
  const replay = await scalar(db, sql);
  assert.deepEqual(replay.selection, selected.selection); assert.deepEqual(replay.rows, []);
  await resetActor(db);
  const receipt = await scalar(db, "SELECT canonical_response FROM public.phase9_idempotency_keys WHERE idempotency_key='" + key + "'");
  assert.deepEqual(receipt.rows, []);
});
test('identity correction invalidates options/selection and fences the old generation; selling edits do not', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f);
  const selected = await scalar(db, selectSql(f, result.choices, result.rows[0].optionId));
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=jsonb_set(owner_review_snapshot,"
    + "'{value,priceMinor}','999') WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  assert.equal((await scalar(db, readSql(f))).requestGeneration, selected.requestGeneration);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=jsonb_set(owner_review_snapshot,"
    + "'{value,originalTitle}','\"A different book\"') WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const changed = await scalar(db, readSql(f));
  assert.equal(changed.requestGeneration, selected.requestGeneration + 1);
  assert.deepEqual(changed.rows, []); assert.equal(changed.selection, null);
  await assert.rejects(db.query(lookupSql(f, selected.requestGeneration)), /P9_VERSION_CONFLICT/);
});
test('current medium canonical suggestion can be confirmed without an options lookup', async () => {
  const f = await seedCard(db), editionId = await seedCanonical(db, f, { isbn13: null });
  const selectionId = randomUUID(), lookupId = randomUUID(), jobId = randomUUID();
  await db.query("INSERT INTO public.image_extraction_jobs(id,store_id,entity_type,entity_id,job_kind,dedupe_key,status)"
    + "VALUES($1,$2,'candidate',$3,'metadata_enrich',$1::uuid::text,'resolved')", [jobId, f.storeId, f.candidateId]);
  await db.query("INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,execution_mode,"
    + "schema_version,lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,"
    + "claim_attempt_number,claim_worker,claim_lease_token_hash,normalized_outcome)"
    + "VALUES($1,$2,$3,$4,'current-suggestion','local','v1','bibliographic','v1','v1','v1','public_bibliographic',1,"
    + "'fixture-worker-0001',repeat('a',64),'local_canonical_match')", [lookupId, f.candidateId, f.storeId, jobId]);
  await db.query("INSERT INTO public.phase9_selected_metadata_snapshots(id,candidate_id,store_id,lookup_id,canonical_edition_id,"
    + "snapshot_version,selection_policy_version,match_evidence,manual_outcome)"
    + "VALUES($1,$2,$3,$4,$5,'v1','v1','[]','local_canonical_match')", [selectionId, f.candidateId, f.storeId, lookupId, editionId]);
  await db.query("UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=$1 WHERE id=$2", [selectionId, f.candidateId]);
  await setActor(db, f.ownerId);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.selection.selectionId, selectionId);
  const confirmed = await scalar(db, selectSql(f, choices, selectionId, { source: 'current_suggestion' }));
  assert.equal(confirmed.selection.source, 'current_suggestion'); assert.equal(confirmed.selection.optionId, null);
  assert.notEqual(confirmed.selection.selectionId, selectionId);
});
test('local ISBN reuse is unique and text ambiguity stays unresolved', async () => {
  const f = await seedCard(db, { isbn: '9780140328721' }), good = await seedCanonical(db, f, { isbn13: '9780140328721' });
  const sql = "SELECT marketplace_sec.phase9_edition_local_match(c) FROM public.image_extraction_candidates c WHERE id='" + f.candidateId + "'";
  assert.equal(await scalar(db, sql), good);
  await seedCanonical(db, f, { title: 'Contradictory title', isbn13: null, isbn10: '0140328726' });
  assert.equal(await scalar(db, sql), null);
  await seedCanonical(db, f, { isbn13: null });
  await db.query("UPDATE public.image_extraction_candidates SET observed_isbn_clue=NULL WHERE id=$1", [f.candidateId]);
  assert.equal(await scalar(db, sql), null);
});
test('ISBN-10 conversion works; invalid ISBN and conflicting language/author do not win', async () => {
  const f = await seedCard(db, { isbn: '0-06-112008-1' });
  const good = await seedCanonical(db, f, { isbn13: '9780061120084' });
  const sql = "SELECT marketplace_sec.phase9_edition_local_match(c) FROM public.image_extraction_candidates c WHERE id='" + f.candidateId + "'";
  assert.equal(await scalar(db, sql), good);
  await db.query("UPDATE public.image_extraction_candidates SET observed_isbn_clue='9780306406158' WHERE id=$1", [f.candidateId]);
  assert.equal(await scalar(db, sql), null);
  const g = await seedCard(db, { isbn: '9780679783268' });
  await seedCanonical(db, g, { isbn13: '9780679783268', language: 'fr', authors: ['Wrong author'] });
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_edition_local_match(c)"
    + "FROM public.image_extraction_candidates c WHERE id='" + g.candidateId + "'"), null);
});
test('private state rejects oversized/unsafe payloads, retention extension and cross-store attachment', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f);
  await resetActor(db);
  for (const rows of [Array.from({ length: 11 }, (_, i) => row(i)),
    [row(0, { metadata: { ...metadata, rawPayload: {} } })],
    [row(0, { googleBooksUrl: 'https://evil.example/book' })]]) {
    await assert.rejects(db.query("UPDATE public.phase9_candidate_edition_state SET options=$1 WHERE candidate_id=$2", [rows, f.candidateId]), /check constraint/);
  }
  await assert.rejects(db.query("UPDATE public.phase9_candidate_edition_state SET options_expires_at=source_fetched_at+interval '25 hours' WHERE candidate_id=$1", [f.candidateId]), /check constraint/);
  await assert.rejects(db.query("UPDATE public.phase9_candidate_edition_state SET store_id=$1 WHERE candidate_id=$2", [randomUUID(), f.candidateId]), /foreign key/);
});
test('automatic → explicit → expiry → explicit preserves history without sequence collision', async () => {
  const f = await seedCard(db);
  const automatic = await seedOptions(db, f, [], '1 hour', true);
  const a = await seedOptions(db, f);
  assert.notEqual(automatic.receipt.operationId, a.receipt.operationId);
  await resetActor(db);
  await db.query("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',"
    + "options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const b = await seedOptions(db, f);
  assert.notEqual(a.receipt.operationId, b.receipt.operationId);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.metadata_enrichment_attempts WHERE candidate_id='" + f.candidateId + "'"), 3);
  await assert.rejects(db.query("UPDATE public.metadata_enrichment_attempts SET provider_attempt_identity=(SELECT provider_attempt_identity"
    + " FROM public.metadata_enrichment_attempts WHERE id=$1) WHERE id=$2", [a.attemptId, b.attemptId]), /unique constraint/);
});
test('explicit worker context admits old ready cards while claim/identity/removal fences stay enforced', async () => {
  const f = await seedCard(db), receipt = await scalar(db, lookupSql(f));
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=1,lease_owner='picker-worker-0001',"
    + "lease_expires_at=transaction_timestamp()+interval '5 minutes',lease_token_hash=encode(extensions.digest(repeat('a',64),'sha256'),'hex') WHERE id=$1", [receipt.operationId]);
  await setActor(db, f.ownerId, 'service_role');
  const sql = "SELECT public.phase9_metadata_job_context('" + receipt.operationId + "','picker-worker-0001','" + 'a'.repeat(64) + "',1)";
  const context = await scalar(db, sql);
  assert.equal(context.purpose, 'edition_options'); assert.equal(context.candidateState, 'ready');
  assert.equal(context.title, metadata.title); assert.equal(context.localCanonicalEditionId, null);
  assert.equal(context.claimToken, 'a'.repeat(64)); assert.equal(context.optionsAvailable, false);
  await assert.rejects(db.query(sql.replace('a'.repeat(64), 'b'.repeat(64))), /P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=jsonb_set(owner_review_snapshot,"
    + "'{value,originalTitle}','\"Different identity\"') WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(db.query(sql), /P9_STATE_CONFLICT/);
});

test('successive coherent choices keep their options and original query with additional authors', async () => {
  const f = await seedCard(db), options = [row(0), row(1)];
  const result = await seedOptions(db, f, options);
  const first = await scalar(db, selectSql(f, result.choices, options[0].optionId));
  const second = await scalar(db, selectSql(f, first, options[1].optionId));
  assert.equal(second.selection.optionId, options[1].optionId);
  assert.equal(second.requestGeneration, first.requestGeneration);
  assert.equal(second.rows.length, 2);
});
test('lookup replay respects expiry and separate unfinished cards keep independent options', async () => {
  const a = await seedCard(db), key = randomUUID(), command = randomUUID();
  const receipt = await scalar(db, lookupSql(a, 0, key, command));
  const result = await seedOptions(db, a);
  const b = await seedCard(db), other = await seedOptions(db, b);
  await resetActor(db);
  await db.query("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',"
    + "options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=$1", [a.candidateId]);
  await setActor(db, a.ownerId);
  const replay = await scalar(db, lookupSql(a, 0, key, command));
  assert.equal(replay.operationId, receipt.operationId); assert.equal(replay.available, false);
  assert.equal('rows' in replay, false);
  await assert.rejects(db.query(selectSql(a, result.choices, other.rows[0].optionId)), /P9_STATE_CONFLICT/);
  await setActor(db, b.ownerId);
  assert.equal((await scalar(db, readSql(b))).rows.length, 1);
});
test('current provider permission denies options without deleting the durable chosen metadata', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f);
  const selected = await scalar(db, selectSql(f, result.choices, result.rows[0].optionId));
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET storage_allowed=false WHERE adapter_key='google_books'");
  await setActor(db, f.ownerId);
  const denied = await scalar(db, readSql(f));
  assert.deepEqual(denied.rows, []); assert.deepEqual(denied.selection, selected.selection);
  assert.equal((await scalar(db, lookupSql(f))).available, false);
  await assert.rejects(db.query(selectSql(f, denied, result.rows[0].optionId)), /P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET storage_allowed=true WHERE adapter_key='google_books'");
});
test('commit transition leaves the chosen snapshot for the later atomic Add integration', async () => {
  const f = await seedCard(db), result = await seedOptions(db, f);
  const selected = await scalar(db, selectSql(f, result.choices, result.rows[0].optionId));
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET state='commit_in_progress' WHERE id=$1", [f.candidateId]);
  assert.equal(await scalar(db, "SELECT selection_id::text FROM public.phase9_candidate_edition_state WHERE candidate_id='"
    + f.candidateId + "'"), selected.selection.selectionId);
  await setActor(db, f.ownerId);
  await assert.rejects(db.query(selectSql(f, selected, result.rows[0].optionId)), /P9_STATE_CONFLICT/);
});
