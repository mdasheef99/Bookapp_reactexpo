// 02d Unit 1a: disposable prefill databases (M89-M99 + M100 when present).
// New-behavior tests run the post-install chain when M100 exists; the pre-install
// chain is reserved for before/after receipt controls. No provider HTTP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createProviderDatabase, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { selectedPrefix } from './providerDatabaseHarness.mjs';
import { migrationPath } from './databaseHarness.mjs';
import { claimJob, lookupSql, row } from './editionPickerFixture.mjs';
import { complete as completeExplicit, finalize, prepareCall, rpc } from './editionOptionsCompletionFixture.mjs';

export const M94 = '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql';
export const M95 = '20261104000095_marketplace_phase9_8c_null_safe_and_pending_state.sql';
export const M96 = '20261104000096_marketplace_phase9_8c_final_attempt_sweep.sql';
export const M97 = '20261105000097_marketplace_phase9_8c_sweep_recovery.sql';
export const M98 = '20261105000098_marketplace_phase9_8c_pause_defer_and_retry_bound.sql';
export const M99 = '20261106000099_marketplace_phase9_8c_fix_round.sql';
export const M100 = '20261112000100_marketplace_phase9_02d_prefill_save.sql';
export const M101 = '20261112000101_marketplace_phase9_02d_search_while_fresh.sql';
export const PRE_INSTALL = [M94];
export const POST_INSTALL = [M94, M95, M96, M97, M98, M99];
// The upgrade path always applies M95-M99 before M100; the pre-install baseline is M89-M94 only.
export const UPGRADE = [M95, M96, M97, M98, M99];
export const EVENT_COLUMN_BOOTSTRAP = `CREATE TABLE IF NOT EXISTS public.marketplace_event_schema_registry(
  event_type text NOT NULL,schema_version integer NOT NULL,entity_type text NOT NULL,
  is_transition boolean NOT NULL,privacy_classification text NOT NULL,PRIMARY KEY(event_type,schema_version));
  ALTER TABLE public.marketplace_events ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system_job',
  ADD COLUMN IF NOT EXISTS idempotency_key text,ADD COLUMN IF NOT EXISTS command_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,ADD COLUMN IF NOT EXISTS causation_event_id uuid,
  ADD COLUMN IF NOT EXISTS privacy_classification text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;`;

export function m100Present() {
  return fs.existsSync(migrationPath(M100));
}

export function m101Present() {
  return fs.existsSync(migrationPath(M101));
}

// Missing M100/M101 is deliberate in the red run: the chain then stops before
// the missing file and the new-behavior assertions fail semantically instead of
// at import time. searchWhileFresh is opt-in so the 1a suite's chain stays M94-M100.
export function prefillMigrations({ preInstall = false, searchWhileFresh = false, stopBeforeM100 = false } = {}) {
  const prefix = selectedPrefix('8a-5');
  const migrations = [...prefix.migrations, ...(preInstall ? PRE_INSTALL : POST_INSTALL)];
  if (!preInstall && !stopBeforeM100 && m100Present()) migrations.push(M100);
  if (!preInstall && !stopBeforeM100 && searchWhileFresh && m101Present()) migrations.push(M101);
  return { migrations, installed: prefix.installed };
}

export async function createPrefillDatabase({ preInstall = false, searchWhileFresh = false, stopBeforeM100 = false } = {}) {
  const db = await createProviderDatabase(prefillMigrations({ preInstall, searchWhileFresh, stopBeforeM100 }));
  // Same test-only event-column bootstrap the PGlite picker fixture applies
  // (editionPickerFixture.mjs:31-39); native clones otherwise lack actor_role
  // and the M54 removal command cannot run there.
  await db.exec(EVENT_COLUMN_BOOTSTRAP);
  return db;
}

// Upgrade path only: pre-install databases never receive M100 at creation.
// Migrations run as the migrating role; the preceding command leaves the actor
// switched for RLS/Owner checks.
export async function applyM100(db) {
  await resetActor(db);
  for (const name of UPGRADE) await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
  if (!m100Present()) return false;
  await db.exec(fs.readFileSync(migrationPath(M100), 'utf8'));
  return true;
}

export async function helperExists(db) {
  await resetActor(db);
  const signature = 'marketplace_sec.phase9_prefill_automatic_editions_v1(public.image_extraction_candidates,public.image_extraction_jobs,public.phase9_metadata_lookups,public.metadata_enrichment_attempts,jsonb,timestamptz,timestamptz,integer)';
  return value(db, 'SELECT to_regprocedure($1) IS NOT NULL', [signature]);
}

// 02d Unit 1b: real worker-boundary claim/fail/completion. The 1a claimJob
// shortcut is deliberately not used for the states under test; only the retry
// clock and lease expiry are moved by the suites to simulate elapsed time.
export async function claimViaCommand(db, f, jobId, worker = 'search-while-fresh-worker-0001') {
  await setActor(db, f.ownerId, 'service_role');
  const rows = (await db.query('SELECT * FROM public.claim_phase9_metadata_jobs($1,$2)', [10, worker])).rows;
  const claimed = rows.find(candidate => candidate.id === jobId);
  assert.ok(claimed, 'real claim must return the tested job ' + jobId);
  const context = await value(db, 'SELECT public.phase9_metadata_job_context($1,$2,$3,$4)',
    [jobId, worker, claimed.lease_token, claimed.attempt_count]);
  return { jobId, worker, token: claimed.lease_token, attempt: claimed.attempt_count, context };
}

export async function failViaCommand(db, f, claim, outcome = 'provider_unavailable', retryable = true) {
  await setActor(db, f.ownerId, 'service_role');
  return rpc(db, 'phase9_fail_candidate_edition_options_v1', [claim.jobId, claim.worker, claim.token,
    claim.attempt, f.candidateId, f.storeId, f.sessionId, claim.jobId,
    claim.context.requestGeneration, claim.context.queryIdentity, outcome, retryable]);
}

export async function completeRequest(db, f, claim, { adapter = 'google_books', rows = null } = {}) {
  await setActor(db, f.ownerId, 'service_role');
  const { jobId, worker, token, attempt, context } = claim;
  const fetched = new Date().toISOString();
  const deadline = new Date(Date.parse(fetched) + 3600000).toISOString();
  const version = '1.0.0';
  if (adapter === 'open_library') {
    const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [
      jobId, worker, token, attempt, f.candidateId, context.candidateVersion, context.queryIdentity,
      'edition-options:' + jobId, 'open_library', version, 'open-library-capability-v1',
      'p9-metadata-foundation-v1', 'bibliographic', 'p9-metadata-lookup-v1',
      'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'store_private', '1',
      'p9-metadata-cache-v1', 'metadata-v1', null]);
    const usage = await rpc(db, 'phase9_reserve_metadata_usage', [jobId, worker, token, attempt,
      lookup.lookup_id, 'open_library', version, 1]);
    const attemptRow = await rpc(db, 'phase9_register_structural_metadata_attempt', [
      lookup.lookup_id, jobId, worker, token, attempt, f.candidateId, context.candidateVersion,
      randomUUID(), 'edition-options:' + jobId, 'primary', 1, 'open_library', version,
      'open-library-capability-v1', 'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1',
      'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]);
    for (const [sequence, stage] of [[0, 'search'], [1, 'editions'], [2, 'author:OL1A']]) {
      const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1', [
        attemptRow.attempt_id, jobId, worker, token, attempt, randomUUID(), sequence, stage]);
      await rpc(db, 'phase9_finalize_edition_options_provider_call_v1', [
        call.provider_call_id, jobId, worker, token, attempt, 'finalized',
        'no_acceptable_match', false, true]);
    }
    const options = (rows ?? [row()]).map((option, index) => ({ ...option, ordinal: index,
      googleBooksUrl: 'https://openlibrary.org/books/OL' + (100 + index) + 'M',
      metadata: option.metadata && { ...option.metadata, adapterKey: 'open_library',
        adapterVersion: version, providerRecordId: 'OL' + (100 + index) + 'M', coverReference: null,
        correlationId: lookup.lookup_id, attemptId: attemptRow.attempt_id, fetchedAt: fetched,
        matchRationale: 'exact_validated_isbn' } }));
    const response = await rpc(db, 'phase9_complete_candidate_edition_options_v1', [
      jobId, worker, token, attempt, f.candidateId, f.storeId, f.sessionId, jobId,
      context.requestGeneration, context.queryIdentity, lookup.lookup_id, attemptRow.attempt_id,
      fetched, deadline, true, options]);
    return { response, rows: options, lookupId: lookup.lookup_id, attemptId: attemptRow.attempt_id };
  }
  if (adapter !== 'google_books') throw new Error('unsupported completion adapter ' + adapter);
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [
    jobId, worker, token, attempt, f.candidateId, context.candidateVersion, context.queryIdentity,
    'edition-options:' + jobId, 'google_books', version, 'cap-v1', 'p9-metadata-foundation-v1',
    'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1', 'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null]);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [jobId, worker, token, attempt,
    lookup.lookup_id, 'google_books', version, 1]);
  const attemptRow = await rpc(db, 'phase9_register_structural_metadata_attempt', [
    lookup.lookup_id, jobId, worker, token, attempt, f.candidateId, context.candidateVersion,
    randomUUID(), 'edition-options:' + jobId, 'primary', 1, 'google_books', version, 'cap-v1',
    'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'local_insufficient', usage.reservation_id]);
  const call = await rpc(db, 'phase9_register_metadata_provider_call', [
    attemptRow.attempt_id, jobId, worker, token, attempt, randomUUID()]);
  await rpc(db, 'phase9_finalize_metadata_provider_call', [
    call.provider_call_id, jobId, worker, token, attempt, 'finalized', 'coherent_match',
    'coherent_match', 'fixture-request-' + attempt, false, null, []]);
  const options = (rows ?? [row()]).map(option => ({ ...option, metadata: option.metadata && {
    ...option.metadata, correlationId: lookup.lookup_id, attemptId: attemptRow.attempt_id,
    fetchedAt: fetched } }));
  const response = await rpc(db, 'phase9_complete_candidate_edition_options_v1', [
    jobId, worker, token, attempt, f.candidateId, f.storeId, f.sessionId, jobId,
    context.requestGeneration, context.queryIdentity, lookup.lookup_id, attemptRow.attempt_id,
    fetched, deadline, true, options]);
  return { response, rows: options, lookupId: lookup.lookup_id, attemptId: attemptRow.attempt_id };
}

export async function completeCommand(db, f, command) {
  await setActor(db, f.ownerId, 'service_role');
  return value(db, 'SELECT public.phase9_complete_automatic_metadata_v1($1)', [command]);
}

export async function recoverCommand(db, fence) {
  await setActor(db, '', 'service_role');
  return value(db, 'SELECT public.phase9_recover_automatic_metadata_v1($1)', [fence]);
}

export async function ownerChoices(db, f) {
  await setActor(db, f.ownerId);
  return value(db, "SELECT public.phase9_owner_candidate_edition_choices_v1($1,$2)",
    [f.sessionId, f.candidateId]);
}

export async function stateRow(db, candidateId) {
  await resetActor(db);
  const rows = (await db.query(
    'SELECT to_jsonb(s) AS state FROM public.phase9_candidate_edition_state s WHERE s.candidate_id=$1',
    [candidateId])).rows;
  return rows[0]?.state ?? null;
}

export async function stateCount(db, candidateId) {
  await resetActor(db);
  return value(db, 'SELECT count(*)::int FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [candidateId]);
}

export async function setCardIsbn(db, f, isbn13) {
  await resetActor(db);
  const version = await value(db, 'SELECT version FROM public.image_extraction_candidates WHERE id=$1', [f.candidateId]);
  await setActor(db, f.ownerId);
  return value(db, 'SELECT public.phase9_set_candidate_isbn_v1($1,$2,$3,$4,$5,$6)',
    [f.sessionId, f.candidateId, randomUUID(), randomUUID(), version, isbn13]);
}

// Valid-command Owner-state seed: explicit request, registered/finalized call,
// then the real completion RPC. A direct attempts insert is denied by the
// M68/M85 automatic-payload guard in the installed chain.
export async function seedExplicitOptions(db, f, rows) {
  const receipt = await value(db, lookupSql(f));
  await resetActor(db);
  await db.exec(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,
    matching_allowed,storage_allowed,revalidation_seconds,policy_version)
    VALUES('google_books','metadata','1.0.0',true,true,true,86400,1)
    ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,
      storage_allowed=true,adapter_version='1.0.0'`);
  const context = await value(db, await claimJob(db, f, receipt.operationId));
  const operation = { ...f, jobId: receipt.operationId, context, attempt: 1 };
  await prepareCall(db, operation);
  await finalize(db, operation);
  const fetched = new Date().toISOString();
  const deadline = new Date(Date.parse(fetched) + 3600000).toISOString();
  const options = rows.map(r => ({ ...r, metadata: r.metadata && { ...r.metadata, fetchedAt: fetched,
    correlationId: operation.lookupId, attemptId: operation.attemptId } }));
  await completeExplicit(db, operation, { rows: options, fetched, deadline });
  await setActor(db, f.ownerId);
  const choices = await ownerChoices(db, f);
  return { receipt, lookupId: operation.lookupId, attemptId: operation.attemptId, rows: options, choices };
}

// Direct private-helper entry for defensive ACP-13 cases. Optional patches let a
// test force one state while keeping every other row built by a valid command.
export async function prefillHelper(db, {
  candidateId, jobId, lookupId, attemptId = null, rows = null, fetched = null, deadline = null,
  generation = 0, candidatePatch = null, lookupPatch = null,
}) {
  await resetActor(db);
  return value(db, `SELECT marketplace_sec.phase9_prefill_automatic_editions_v1(
    (SELECT r FROM public.image_extraction_candidates c,
      LATERAL jsonb_populate_record(NULL::public.image_extraction_candidates,
        to_jsonb(c)||coalesce($9::jsonb,'{}'::jsonb)) r WHERE c.id=$1),
    (SELECT j FROM public.image_extraction_jobs j WHERE j.id=$2),
    (SELECT r FROM public.phase9_metadata_lookups l,
      LATERAL jsonb_populate_record(NULL::public.phase9_metadata_lookups,
        to_jsonb(l)||coalesce($10::jsonb,'{}'::jsonb)) r WHERE l.id=$3),
    (SELECT a FROM public.metadata_enrichment_attempts a WHERE a.id=$4),
    $5::jsonb,$6::timestamptz,$7::timestamptz,$8::integer)`,
  [candidateId, jobId, lookupId, attemptId,
    rows === null ? null : JSON.stringify(rows), fetched, deadline, generation,
    candidatePatch === null ? null : JSON.stringify(candidatePatch),
    lookupPatch === null ? null : JSON.stringify(lookupPatch)]);
}

export async function savedFixture(db, helpers, count = 1) {
  const { olAutomaticRoute, beginAutomatic, retainedOlResult } = helpers;
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, count);
  return fixture;
}
