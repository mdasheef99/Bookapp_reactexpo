// 02a §§3–7/10: disposable, synthetic bibliographic facts; never provider HTTP.
// §7.1 alignment is LOCAL to this fixture, after phase6_baseline and before M81:
// SET NULL FKs, named ISBN constraints, timestamp defaults, SELECT RLS and broad
// Supabase-style client grants. Deliberately NO UUID defaults: writers supply IDs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import { createCommitDatabase, chosenCard, currentCommitSql, reviewValue, saveReview } from './editionPickerCommitFixture.mjs';
import { claimJob, lookupSql, metadata, readSql, row, seedCard, seedAutomaticLineage, selectSql } from './editionPickerFixture.mjs';
import { complete, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';
export { resetActor, scalar, setActor, currentCommitSql, reviewValue, saveReview, readSql, selectSql, rpc };
export const helper = 'marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)';
// §11: eight date digits + six sequence digits (14 TOTAL), not 20 digits.
export const m81Pattern = /^\d{8}000081_marketplace_phase9_catalogue_link_at_add\.sql$/;
export const M82 = '20261026000082_marketplace_phase9_edition_choice_survives_first_save.sql';
export const suffixes = [
  '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
  '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
  '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
  '20261011000073_marketplace_phase9_open_library_edition_options.sql',
  '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
  '20261016000076_marketplace_phase9_edition_explicit_matching.sql',
  '20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql',
  '20261017000077_marketplace_phase9_edition_matching_variants.sql',
  '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql',
  '20261023000079_marketplace_phase9_isbn_match_metadata_state.sql',
  '20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql',
];
export const alignmentSql = `
ALTER TABLE public.canonical_editions DROP CONSTRAINT canonical_editions_work_id_fkey,
 ADD CONSTRAINT canonical_editions_work_id_fkey FOREIGN KEY(work_id) REFERENCES public.canonical_works(id) ON DELETE SET NULL;
ALTER TABLE public.store_inventory DROP CONSTRAINT store_inventory_canonical_work_id_fkey,
 DROP CONSTRAINT store_inventory_canonical_edition_id_fkey,
 ADD CONSTRAINT store_inventory_canonical_work_id_fkey FOREIGN KEY(canonical_work_id) REFERENCES public.canonical_works(id) ON DELETE SET NULL,
 ADD CONSTRAINT store_inventory_canonical_edition_id_fkey FOREIGN KEY(canonical_edition_id) REFERENCES public.canonical_editions(id) ON DELETE SET NULL;
ALTER TABLE public.canonical_editions RENAME CONSTRAINT canonical_editions_isbn_10_key TO canonical_editions_isbn_10_unique;
ALTER TABLE public.canonical_editions RENAME CONSTRAINT canonical_editions_isbn_13_key TO canonical_editions_isbn_13_unique;
CREATE INDEX idx_canonical_editions_title_authors ON public.canonical_editions(title, authors);
ALTER TABLE public.canonical_works ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.canonical_editions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.canonical_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalogue_link_public_works ON public.canonical_works FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY catalogue_link_public_editions ON public.canonical_editions FOR SELECT TO anon,authenticated USING(true);
GRANT ALL ON public.canonical_works,public.canonical_editions TO anon,authenticated;
`;
export async function installCatalogueTail(db, { native = false, deferM81 = false, deferM82 = false } = {}) {
  // Native runner has already applied M70–M80 to its separate test database.
  if (!native) for (const name of suffixes) {
    if (name.includes('000078_')) await db.exec(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`);
    await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  }
  await db.exec(alignmentSql);
  // Reproduce hostile defaults for the PRIVATE helper too; M81 must revoke them.
  await db.exec(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA marketplace_sec
    GRANT EXECUTE ON FUNCTIONS TO PUBLIC,anon,authenticated,service_role;`);
  if (!deferM81) await applyM81IfPresent(db);
  if (!deferM81 && !deferM82 && fs.existsSync(migrationPath(M82))) {
    await db.exec(fs.readFileSync(migrationPath(M82), 'utf8'));
  }
}
export async function applyM81IfPresent(db) {
  const files = fs.readdirSync(migrationPath('')).filter(name => m81Pattern.test(name));
  assert.ok(files.length <= 1, 'at most one approved M81 migration');
  if (files.length) await db.exec(fs.readFileSync(migrationPath(files[0]), 'utf8'));
}
export async function createCatalogueDatabase(options = {}) {
  const db = await createCommitDatabase();
  try { await installCatalogueTail(db, options); return db; }
  catch (error) { await db.close(); throw error; }
}
export const facts = (overrides = {}) => ({ ...metadata, title: 'Catalogue Sample',
  subtitle: 'Synthetic subtitle', authors: ['B. Author', 'A. Author'], categories: [],
  adapterKey: 'open_library', providerRecordId: 'OL100M',
  coverReference: 'https://covers.openlibrary.org/b/id/123-M.jpg',
  matchRationale: 'exact_validated_isbn', ...overrides });
export async function admin(db, action) {
  await resetActor(db);
  try { return await action(); } finally { await resetActor(db); }
}
export async function candidate(db, f) {
  return admin(db, async () => (await db.query('SELECT * FROM public.image_extraction_candidates WHERE id=$1', [f.candidateId])).rows[0]);
}
export async function enableOL(db) {
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET enabled=true,matching_allowed=true,
    storage_allowed=true,public_display_allowed=true,provider_kind='metadata',adapter_version='1.0.0',policy_version=1 WHERE adapter_key='open_library';`);
}
// C19 olCall/operation/receipt pattern extracted here; no suite-private imports.
export async function olOperation(db, overrides = {}, automatic = false, fallback = false, existing = null, queryAuthors = null) {
  const m = facts(overrides);
  const observedAuthors = queryAuthors ?? m.authors;
  const f = existing ?? await seedCard(db, { isbn: m.isbn13 ?? m.isbn10, language: m.language,
    review: { originalTitle: m.title, authors: observedAuthors, originalLanguage: m.language,
      script: m.script, originalFieldConfirmation: { title: true, authors: observedAuthors.map(() => true) } } });
  await resetActor(db);
  if (!existing) await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2 WHERE id=$3', [m.title, observedAuthors, f.candidateId]);
  await enableOL(db);
  if (fallback) await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,matching_allowed,storage_allowed,revalidation_seconds,policy_version)
    VALUES('google_books','metadata','1.0.0',true,true,true,86400,1) ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,storage_allowed=true,adapter_version='1.0.0'`);
  await setActor(db, f.ownerId);
  // Vision input is the existing synthetic administrative seed, not provider HTTP.
  const jobId = automatic ? (await seedAutomaticLineage(db, f)).jobId
    : (await scalar(db, lookupSql(f, existing ? (await scalar(db, readSql(f))).requestGeneration : 0))).operationId;
  const context = await scalar(db, await claimJob(db, f, jobId));
  const p = { ...f, jobId, context, attempt: 1 }, lookupAdapter = fallback ? 'google_books' : 'open_library';
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, context.queryIdentity, 'catalogue:' + jobId,
    lookupAdapter, '1.0.0', 'open-library-capability-v1', 'p9-metadata-foundation-v1', 'bibliographic',
    'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null]);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [jobId, worker, token, 1, lookup.lookup_id, lookupAdapter, '1.0.0', 1]);
  const register = (adapter, providerRole, sequence, predecessor) => rpc(db, 'phase9_register_structural_metadata_attempt', [lookup.lookup_id, jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, randomUUID(), 'catalogue:' + jobId, providerRole, sequence,
    adapter, '1.0.0', 'open-library-capability-v1', 'p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', predecessor, usage.reservation_id]);
  let attempt = await register(lookupAdapter, 'primary', 1, 'local_insufficient');
  if (fallback) {
    const base = [jobId, worker, token, 1];
    const call = await rpc(db, 'phase9_register_metadata_provider_call', [attempt.attempt_id, ...base, randomUUID()]);
    await rpc(db, 'phase9_finalize_metadata_provider_call', [call.provider_call_id, ...base, 'finalized', 'no_acceptable_match', 'no_acceptable_match', 'synthetic-primary', false, null, []]);
    await rpc(db, 'phase9_finish_edition_primary_for_fallback_v1', [attempt.attempt_id, ...base, 'no_acceptable_match']);
    p.primaryAttemptId = attempt.attempt_id;
    attempt = await register('open_library', 'secondary', 2, 'no_acceptable_match');
  }
  p.lookupId = lookup.lookup_id; p.attemptId = attempt.attempt_id;
  p.facts = { ...m, correlationId: p.lookupId, attemptId: p.attemptId, fetchedAt: new Date().toISOString() };
  return p;
}
export async function completeOL(db, f) {
  for (const [sequence, stage] of [[0, 'search'], [1, 'editions'], [2, 'author:OL1A']]) {
    const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1', [f.attemptId, f.jobId, worker, token, 1, randomUUID(), sequence, stage]);
    await rpc(db, 'phase9_finalize_edition_options_provider_call_v1', [call.provider_call_id, f.jobId, worker, token, 1, 'finalized', 'no_acceptable_match', false, true]);
  }
  const selectedRow = row(0, { googleBooksUrl: 'https://openlibrary.org/books/' + f.facts.providerRecordId, metadata: f.facts });
  assert.equal((await complete(db, f, { rows: [selectedRow], fetched: f.facts.fetchedAt,
    deadline: new Date(Date.parse(f.facts.fetchedAt) + 3600000).toISOString() })).status, 'completed');
  return selectedRow;
}
export async function olCard(db, overrides = {}, { fallback = false, queryAuthors = null } = {}) {
  const f = await olOperation(db, overrides, false, fallback, null, queryAuthors), selectedRow = await completeOL(db, f);
  await setActor(db, f.ownerId);
  f.selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), selectedRow.optionId));
  await saveReview(db, f); return f;
}
export async function refreshOL(db, held) {
  const p = await olOperation(db, { ...held.facts, publisher: 'Newer unchosen press' }, false, false, held);
  await completeOL(db, p); return p; // Deliberately do not select the newer result.
}
// Selected mode uses REAL automatic register/finalize/select commands. §6 does
// not freeze the automatic query SQL shape: TODO(confirm at implementation).
async function acceptedAutomatic(db, overrides = {}) {
  const f = await olOperation(db, overrides, true), base = [f.jobId, worker, token, 1];
  const call = await rpc(db, 'phase9_register_metadata_provider_call', [f.attemptId, ...base, randomUUID()]);
  await rpc(db, 'phase9_finalize_metadata_provider_call', [call.provider_call_id, ...base, 'finalized', 'coherent_match', 'coherent_match', 'synthetic-receipt', false, null, []]);
  await rpc(db, 'phase9_finalize_structural_metadata_attempt', [f.attemptId, ...base, f.candidateId,
    f.context.candidateVersion, 'accepted', 'coherent_match', null, 'miss', 0, 'fixture-pricing', { currency: 'USD' }, 0, f.facts]);
  return f;
}
export async function automaticCard(db, overrides = {}, { target = null, currentSuggestion = false } = {}) {
  const f = await acceptedAutomatic(db, overrides), base = [f.jobId, worker, token, 1];
  const selected = await rpc(db, 'phase9_select_structural_metadata_snapshot', [f.lookupId, ...base,
    f.candidateId, f.context.candidateVersion, f.attemptId, f.attemptId, 'p9-selected-v1',
    'p9-metadata-selection-v1', f.facts, ['validated_isbn'], 'accepted_metadata_match', target]);
  f.selectionId = selected.snapshot_id;
  await setActor(db, f.ownerId);
  if (currentSuggestion) f.selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), f.selectionId, { source: 'current_suggestion' }));
  else await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'selected', selectionId: f.selectionId } });
  await saveReview(db, f); return f;
}
// CAN uses the existing local-match completion (no invented provider provenance).
export async function canonicalCard(db, m, target, currentSuggestion = false) {
  const f = await seedCard(db, { isbn: m.isbn13, review: { originalTitle: m.title, authors: m.authors,
    originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) } } });
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2 WHERE id=$3', [m.title, m.authors, f.candidateId]);
  const { jobId } = await seedAutomaticLineage(db, f), context = await scalar(db, await claimJob(db, f, jobId));
  const selected = await rpc(db, 'phase9_complete_structural_local_metadata_match', [jobId, worker, token, 1,
    f.candidateId, context.candidateVersion, context.queryIdentity, 'bibliographic', 'p9-metadata-lookup-v1',
    'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'store_private', 'p9-metadata-v1',
    target.editionId, 'p9-selected-v1', 'p9-metadata-selection-v1', ['validated_isbn']]);
  f.selectionId = selected.snapshot_id; f.facts = m;
  await setActor(db, f.ownerId);
  if (currentSuggestion) f.selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), f.selectionId, { source: 'current_suggestion' }));
  else await saveReview(db, f, { ...await reviewValue(db, f), metadataChoice: { mode: 'selected', selectionId: f.selectionId } });
  await saveReview(db, f); return { ...f, target };
}
export async function seedIncumbent(db, m = facts(), { sparse = false, orphan = false, displayKey = false } = {}) {
  await resetActor(db);
  const workId = randomUUID(), editionId = randomUUID();
  const titleKey = displayKey ? m.title : m.title.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
  const authors = displayKey ? m.authors : m.authors.map(a => a.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()).sort();
  if (!orphan) await db.query('INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors,language) VALUES($1,$2,$3,$4,$5)', [workId, titleKey, m.title, authors, m.language]);
  await db.query(`INSERT INTO public.canonical_editions(id,work_id,isbn_10,isbn_13,title,subtitle,authors,publisher,published_date,language,cover_url,page_count,categories)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [editionId, orphan ? null : workId,
    m.isbn10, m.isbn13, m.title, m.subtitle, m.authors, sparse ? null : m.publisher,
    sparse ? null : m.publishedDate, m.language, sparse ? null : m.coverReference, m.pageCount, m.categories]);
  return { workId: orphan ? null : workId, editionId };
}
// §10 legacy bounded fixture ONLY for facts normal completion/selection refuses.
// No constraint/trigger bypass: selected JSON must still pass the old shape gate.
export async function legacyCard(db, changes) {
  const f = await olCard(db);
  f.facts = { ...f.facts, ...changes };
  await resetActor(db);
  await db.query('UPDATE public.phase9_candidate_edition_state SET selected_option_snapshot=$1 WHERE candidate_id=$2', [f.facts, f.candidateId]);
  await setActor(db, f.ownerId); return f;
}
// §10 STALE-CAN: synthetic NOT live-reachable deletion. Snapshot is inserted ONCE
// already stale; temporarily drop only its incoming canonical FK, restore NOT VALID
// immediately (new writes enforced). Immutability trigger is NEVER disabled.
// store_inventory canonical FKs stay enabled and validated throughout every Add.
export async function staleCard(db, { admitted = false, currentSuggestion = false, hint = false, invalidOutcome = false } = {}) {
  // M68 forbids automatic snapshots on explicit picker lookups. Real automatic
  // register/finalize commands validate this payload; no earlier snapshot exists.
  const f = await acceptedAutomatic(db), staleId = randomUUID(), selectionId = randomUUID(), choiceId = randomUUID();
  const attemptId = admitted && !invalidOutcome ? f.attemptId : null;
  const outcome = invalidOutcome ? 'ambiguous' : admitted ? 'accepted_metadata_match' : 'local_canonical_match';
  await resetActor(db);
  const constraints = (await db.query(`SELECT conname,pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid='public.phase9_selected_metadata_snapshots'::regclass
      AND contype='f' AND confrelid='public.canonical_editions'::regclass`)).rows;
  assert.equal(constraints.length, 1);
  const c = constraints[0], quoted = '"' + c.conname.replaceAll('"', '""') + '"';
  await db.exec('ALTER TABLE public.phase9_selected_metadata_snapshots DROP CONSTRAINT ' + quoted);
  try {
    await db.query(`INSERT INTO public.phase9_selected_metadata_snapshots(id,candidate_id,store_id,lookup_id,selected_attempt_id,outcome_source_attempt_id,
      canonical_edition_id,snapshot_version,selection_policy_version,coherent_edition,match_evidence,manual_outcome)
      VALUES($1,$2,$3,$4,$5,$5,$6,'p9-selected-v1','p9-metadata-selection-v1',$7,'["validated_isbn"]',$8)`,
    [selectionId, f.candidateId, f.storeId, f.lookupId, attemptId,
      invalidOutcome ? null : staleId, admitted && !invalidOutcome ? f.facts : null,
       outcome]);
  } finally { await db.exec('ALTER TABLE public.phase9_selected_metadata_snapshots ADD CONSTRAINT ' + quoted + ' ' + c.definition.replace(/ NOT VALID$/i, '') + ' NOT VALID'); }
  // §10 bounded postgres bypass: finish lookup/job and save the review/choice
  // directly because real selection/save dereferences the already-absent target.
  // Only construction permits the stale reference; all automatic/immutable
  // snapshot triggers remain enabled. This is not a live deletion sequence.
  await db.query(`UPDATE public.phase9_metadata_lookups SET normalized_outcome=$1,reuse_source_attempt_id=$2,
    outcome_source_attempt_id=$2,completed_at=transaction_timestamp() WHERE id=$3`, [outcome, attemptId, f.lookupId]);
  await db.query(`UPDATE public.image_extraction_jobs SET status='resolved',lease_owner=NULL,lease_expires_at=NULL,
    lease_token_hash=NULL,completed_at=transaction_timestamp() WHERE id=$1`, [f.jobId]);
  const review = { ...(await candidate(db, f)).owner_review_snapshot.value,
    metadataChoice: { mode: currentSuggestion ? 'edition_option' : 'selected', selectionId: currentSuggestion ? choiceId : selectionId } };
  await db.query("UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=$1,owner_review_snapshot=$2,state='ready' WHERE id=$3",
    [selectionId, { value: review, confirmed_title: { value: review.originalTitle }, confirmed_authors: review.authors }, f.candidateId]);
  if (currentSuggestion) await db.query(`INSERT INTO public.phase9_candidate_edition_state(candidate_id,session_id,store_id,query_identity,
    selection_id,selected_source,selected_source_id,selected_option_snapshot,selected_at,selected_by)
    SELECT id,session_id,store_id,marketplace_sec.phase9_edition_query_identity(c),$1,'current_suggestion',$2,
      marketplace_sec.phase9_edition_snapshot($3::jsonb),transaction_timestamp(),$4 FROM public.image_extraction_candidates c WHERE id=$5`,
    [choiceId, selectionId, f.facts, f.ownerId, f.candidateId]);
  if (hint) {
    // Separate synthetic candidate-hint variant: permit that incoming reference
    // at construction ONLY, then restore its FK as NOT VALID. This is not a
    // claim that a referenced live edition can be deleted through NO ACTION.
    const [fk] = (await db.query(`SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='public.image_extraction_candidates'::regclass AND contype='f'
        AND confrelid='public.canonical_editions'::regclass`)).rows;
    assert.ok(fk); const name = '"' + fk.conname.replaceAll('"', '""') + '"';
    await db.exec('ALTER TABLE public.image_extraction_candidates DROP CONSTRAINT ' + name);
    try { await db.query('UPDATE public.image_extraction_candidates SET canonical_edition_id=$1 WHERE id=$2', [staleId, f.candidateId]); }
    finally { await db.exec('ALTER TABLE public.image_extraction_candidates ADD CONSTRAINT ' + name + ' ' + fk.definition.replace(/ NOT VALID$/i, '') + ' NOT VALID'); }
  }
  // M29 resets readiness when selected_metadata_snapshot_id changes. Restore it
  // separately so a positive stale Add tests disappearance, not review readiness.
  await db.query('UPDATE public.image_extraction_candidates SET review_ready=true WHERE id=$1', [f.candidateId]);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_owner_ux_valid_review($1::jsonb) AS valid', [review])).rows[0].valid,
    true, 'bounded stale fixture must retain a validator-accepted saved review');
  await setActor(db, f.ownerId); return { ...f, selectionId, staleId };
}
export async function labelledCard(db, label, overrides = {}) {
  if (label === 'OL') return olCard(db, overrides);
  if (label === 'G') { const f = await chosenCard(db); await saveReview(db, f); return f; }
  if (label === 'MAN') { const f = await seedCard(db); await saveReview(db, f); return f; }
  if (label.startsWith('STALE-')) return staleCard(db, { admitted: label === 'STALE-OL', ...overrides });
  const m = facts(overrides), target = await seedIncumbent(db, m, { orphan: label === 'ORPHAN-CAN', sparse: label === 'sparse incumbent' });
  return canonicalCard(db, m, target, overrides.currentSuggestion);
}
export async function add(db, f, command = null) {
  await setActor(db, f.ownerId);
  command ??= await currentCommitSql(db, f);
  // Missing M81 must report an ASSERTION on behavior, including stale Add failure.
  let receipt, error;
  try { receipt = await scalar(db, command); } catch (caught) { error = caught; }
  assert.equal(error?.message ?? null, null, 'eligible Add must succeed (including disappeared catalogue targets)');
  assert.equal(receipt.outcome, 'committed_private');
  await resetActor(db);
  const item = (await db.query('SELECT * FROM public.store_inventory WHERE id=$1', [receipt.inventoryId])).rows[0];
  return { receipt, item, command };
}
export function linked(item) {
  assert.ok(item.canonical_work_id, 'Add must resolve a persisted canonical work');
  assert.ok(item.canonical_edition_id, 'Add must resolve a persisted canonical edition');
}
export function unmatched(item) {
  assert.equal(item.canonical_work_id, null, 'unmatched Add must not retain a canonical work ID');
  assert.equal(item.canonical_edition_id, null, 'unmatched Add must not retain an edition-only canonical ID');
}
export async function requireHelper(db) {
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT to_regprocedure('" + helper + "') IS NOT NULL"), true, 'M81 private helper must exist before ACL/admission assertions');
}
export async function bytes(db, table, where = 'true', values = []) {
  await resetActor(db);
  assert.match(table, /^[a-z0-9_]+$/);
  return (await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb)::text AS bytes FROM public.${table} t WHERE ${where}`, values)).rows[0].bytes;
}
export async function catalogueBytes(db) {
  return [await bytes(db, 'canonical_works'), await bytes(db, 'canonical_editions')];
}
export async function effects(db, f) {
  await resetActor(db);
  return [await catalogueBytes(db), await bytes(db, 'store_inventory'),
    await bytes(db, 'marketplace_audit_logs'), await bytes(db, 'marketplace_events'),
    await bytes(db, 'image_extraction_sessions', 'id=$1', [f.sessionId]),
    await bytes(db, 'phase9_idempotency_keys'), await bytes(db, 'phase9_metadata_provider_calls')];
}
export async function selectionBytes(db, f) {
  await resetActor(db);
  const c = await candidate(db, f);
  const rows = (await db.query(`SELECT selected_option_snapshot::text AS json,selection_id,selected_source,selected_source_id
    FROM public.phase9_candidate_edition_state WHERE candidate_id=$1`, [f.candidateId])).rows;
  return JSON.stringify([c.owner_review_snapshot, c.selected_metadata_snapshot_id, rows,
    await bytes(db, 'phase9_selected_metadata_snapshots', 'candidate_id=$1', [f.candidateId])]);
}
// Runner emits this test-only alignment into its isolated clone before M81;
// importing this module never constructs a database or runs a test.
if (process.argv[2] === '--native-setup-sql') process.stdout.write(alignmentSql + `
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA marketplace_sec
GRANT EXECUTE ON FUNCTIONS TO PUBLIC,anon,authenticated,service_role;`);
