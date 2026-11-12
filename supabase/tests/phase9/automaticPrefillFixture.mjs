// 02d Unit 1a: disposable prefill databases (M89-M99 + M100 when present).
// New-behavior tests run the post-install chain when M100 exists; the pre-install
// chain is reserved for before/after receipt controls. No provider HTTP.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createProviderDatabase, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { selectedPrefix } from './providerDatabaseHarness.mjs';
import { migrationPath } from './databaseHarness.mjs';
import { claimJob, lookupSql } from './editionPickerFixture.mjs';
import { complete as completeExplicit, finalize, prepareCall } from './editionOptionsCompletionFixture.mjs';

export const M94 = '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql';
export const M95 = '20261104000095_marketplace_phase9_8c_null_safe_and_pending_state.sql';
export const M96 = '20261104000096_marketplace_phase9_8c_final_attempt_sweep.sql';
export const M97 = '20261105000097_marketplace_phase9_8c_sweep_recovery.sql';
export const M98 = '20261105000098_marketplace_phase9_8c_pause_defer_and_retry_bound.sql';
export const M99 = '20261106000099_marketplace_phase9_8c_fix_round.sql';
export const M100 = '20261112000100_marketplace_phase9_02d_prefill_save.sql';
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

// Missing M100 is deliberate in the red run: the post-install chain then stops at
// M99 and the new-behavior assertions fail semantically instead of at import time.
export function prefillMigrations({ preInstall = false } = {}) {
  const prefix = selectedPrefix('8a-5');
  const migrations = [...prefix.migrations, ...(preInstall ? PRE_INSTALL : POST_INSTALL)];
  if (!preInstall && m100Present()) migrations.push(M100);
  return { migrations, installed: prefix.installed };
}

export async function createPrefillDatabase({ preInstall = false } = {}) {
  const db = await createProviderDatabase(prefillMigrations({ preInstall }));
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

export async function savedFixture(db, helpers) {
  const { olAutomaticRoute, beginAutomatic, retainedOlResult } = helpers;
  await olAutomaticRoute(db);
  const fixture = await beginAutomatic(db, { key: 'open_library', version: '2.0.0' });
  await retainedOlResult(db, fixture, 1);
  return fixture;
}
