// Picker §§5-8/9; Unit 7A §§5-11: actual disposable SQL, synthetic metadata only.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { migrationPath } from './databaseHarness.mjs';
import { complete, createCompletionDatabase, finalize, prepareCall } from './editionOptionsCompletionFixture.mjs';
import { claimJob, json, lookupSql, metadata, readSql, resetActor, row, scalar, seedCard, seedOptions as legacySeedOptions,
  selectSql, setActor } from './editionPickerFixture.mjs';
import { commitSql, seedReviewedCandidate } from './unit7aFixture.mjs';
export { commitSql, json, metadata, readSql, resetActor, row, scalar, seedCard,
  selectSql, setActor };
export const M69 = '20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql';
export async function createCommitDatabase() {
  const db = await createCompletionDatabase();
  // Use the production M56 dispatcher with empty external interfaces. No HTTP is possible.
  const dispatch = fs.readFileSync(migrationPath('20260810000036_marketplace_phase9_worker_wake_dispatcher.sql'), 'utf8');
  await db.exec(dispatch.slice(0, dispatch.indexOf('CREATE FUNCTION marketplace_sec.has_claimable_phase9_work')) + 'COMMIT;');
  await db.exec(`CREATE SCHEMA net; CREATE TABLE net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text);
    CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);`);
  if (fs.existsSync(migrationPath(M69))) await db.exec(fs.readFileSync(migrationPath(M69), 'utf8'));
  return db;
}
export async function reviewValue(db, f) {
  return privateRead(db, () => scalar(db, "SELECT owner_review_snapshot->'value' FROM public.image_extraction_candidates WHERE id='" + f.candidateId + "'"));
}
export async function saveReview(db, f, value = null, overrides = {}) {
  const c = await privateRead(db, async () => (await db.query('SELECT version,metadata_revision FROM public.image_extraction_candidates WHERE id=$1', [f.candidateId])).rows[0]);
  return scalar(db, "SELECT public.phase9_update_candidate_review_v2('" + f.sessionId + "','" + f.candidateId + "',"
    + (overrides.candidateVersion ?? c.version) + ',' + (overrides.metadataRevision ?? c.metadata_revision)
    + ",'" + json(value ?? await reviewValue(db, f)) + "','" + randomUUID() + "','" + randomUUID() + "')");
}
export async function currentCommitSql(db, f, overrides = {}) {
  const c = await privateRead(db, async () => (await db.query('SELECT version,review_version,metadata_revision FROM public.image_extraction_candidates WHERE id=$1', [f.candidateId])).rows[0]);
  return commitSql(f, { candidateVersion: c.version, reviewVersion: c.review_version,
    metadataRevision: c.metadata_revision, ...overrides });
}
export async function chosenCard(db, options = {}) {
  const f = await seedCard(db, options);
  const saved = await seedOptions(db, f, [row(0, { metadata: { ...metadata, ...options.metadata } })]);
  const selected = await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
  return { ...f, saved, selected };
}
export async function canonicalCard(db) {
  const f=await seedReviewedCandidate(db,{selectedMetadata:true}); await resetActor(db);
  const digits='978'+String(await scalar(db,'SELECT count(*)::int FROM public.canonical_editions')).padStart(9,'0');
  const checksum=(10-[...digits].reduce((sum,n,i)=>sum+Number(n)*(i%2?3:1),0)%10)%10;
  const isbn=digits+checksum;
  await db.query('UPDATE public.canonical_editions SET isbn_13=$1,cover_url=$2 WHERE id=$3',
    [isbn,metadata.coverReference,f.canonicalEditionId]);
  const edition=(await db.query('SELECT * FROM public.canonical_editions WHERE id=$1',[f.canonicalEditionId])).rows[0];
  const review={...await reviewValue(db,f),originalTitle:edition.title,authors:edition.authors};
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2,observed_isbn_clue=$3 WHERE id=$4',
    [edition.title,edition.authors,isbn,f.candidateId]);
  await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=$1,selected_metadata_snapshot_id=$2,review_ready=true WHERE id=$3',
    [{value:review,confirmed_title:{value:review.originalTitle},confirmed_authors:review.authors},f.selectionId,f.candidateId]);
  await setActor(db,f.ownerId); return {...f,edition};
}
export async function inventory(db, id) {
  return (await db.query('SELECT * FROM public.store_inventory WHERE id=$1', [id])).rows[0];
}
export async function expire(db, f) {
  await resetActor(db);
  await db.query("UPDATE public.phase9_candidate_edition_state SET source_fetched_at=transaction_timestamp()-interval '25 hours',"
    + "options_expires_at=transaction_timestamp()-interval '1 hour' WHERE candidate_id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
}
export async function optionsTruth(db, f) {
  return privateRead(db, async () => (await db.query('SELECT * FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0]);
}
export async function originalSelection(db, f, textOnly = false) {
  const saved = await seedOptions(db, f, [], '1 hour', true), selectionId = randomUUID();
  const coherent = { ...metadata, coverReference: null };
  await resetActor(db);
  await db.query("INSERT INTO public.phase9_selected_metadata_snapshots(id,candidate_id,store_id,lookup_id,selected_attempt_id,"
    + "outcome_source_attempt_id,snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)"
    + "VALUES($1,$2,$3,$4,$5,$5,'p9-selected-v1','p9-metadata-selection-v1',$6,$7,'accepted_metadata_match')",
  [selectionId, f.candidateId, f.storeId, saved.lookupId, saved.attemptId, coherent,
    textOnly ? ['exact_original_title_author_language'] : ['validated_isbn']]);
  await db.query("INSERT INTO marketplace_sec.phase9_metadata_representative_covers(source_attempt_id,source_lookup_id,"
    + "source_candidate_id,source_store_id,source_job_id,cover_reference,adapter_key,adapter_version,source_provider_record_id,"
    + "source_relation,selection_policy_version,match_evidence) VALUES($1,$2,$3,$4,$5,$6,'google_books','1.0.0',"
    + "'old-alternate','representative_edition','p9-representative-cover-v1','[\"exact_title\",\"exact_author_set\",\"language_compatible\"]')",
  [saved.attemptId, saved.lookupId, f.candidateId, f.storeId, saved.receipt.operationId,
    'https://books.google.com/books/content?id=old-alternate']);
  const review = { ...await reviewValue(db, f), authors: coherent.authors,
    originalFieldConfirmation: { title: true, authors: [true, true] }, metadataChoice: { mode: 'selected', selectionId } };
  await db.query("UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=$1,owner_review_snapshot=$2,review_ready=true WHERE id=$3",
    [selectionId, { value: review, confirmed_title: { value: review.originalTitle }, confirmed_authors: review.authors }, f.candidateId]);
  await setActor(db, f.ownerId);
  return { ...f, selectionId, saved };
}
export async function seedOptions(db, f, rows = [row()], lifetime = '1 hour', automatic = false) {
  if (automatic) return legacySeedOptions(db, f, rows, lifetime, true);
  const receiptSql = lookupSql(f);
  const receipt = await scalar(db, receiptSql);
  await resetActor(db);
  await db.exec("INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,matching_allowed,"
    + "storage_allowed,revalidation_seconds,policy_version) VALUES('google_books','metadata','1.0.0',true,true,true,86400,1) "
    + "ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,storage_allowed=true;");
  const context = await scalar(db, await claimJob(db, f, receipt.operationId));
  const operation = { ...f, jobId: receipt.operationId, context, attempt: 1 };
  await prepareCall(db, operation); await finalize(db, operation);
  const fetched = new Date().toISOString(), deadline = new Date(Date.parse(fetched) + 3600000).toISOString();
  rows = rows.map(r => ({ ...r, metadata: r.metadata && { ...r.metadata, fetchedAt: fetched,
    correlationId: operation.lookupId, attemptId: operation.attemptId } }));
  await complete(db, operation, { rows, fetched, deadline });
  await resetActor(db);
  const savedRows = await scalar(db, "SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id='" + f.candidateId + "'");
  await setActor(db, f.ownerId);
  return { receipt, receiptSql, lookupId: operation.lookupId, attemptId: operation.attemptId,
    rows: savedRows, choices: await scalar(db, readSql(f)) };
}
async function privateRead(db, action) {
  const role = await scalar(db, 'SELECT current_user');
  await db.exec('RESET ROLE');
  try { return await action(); }
  finally { if (role !== 'postgres') await db.exec('SET ROLE ' + role); }
}
