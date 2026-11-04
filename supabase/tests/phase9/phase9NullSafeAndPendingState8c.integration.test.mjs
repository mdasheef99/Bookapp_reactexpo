// 02c §4.3 / 8c-1a: NULL operation_version is automatic; expired-options read model recovery.
// Disposable PGlite only. No provider HTTP, live database or migration application.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { clean, createProviderDatabase, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { selectedPrefix } from './providerDatabaseHarness.mjs';
import { claimJob, lookupSql, readSql, row, scalar, seedAutomaticLineage, seedCard, selectSql } from './editionPickerFixture.mjs';
import { rpc, token, worker } from './editionOptionsCompletionFixture.mjs';

const M94 = '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql';
const M95 = '20261104000095_marketplace_phase9_8c_null_safe_and_pending_state.sql';
const redefined = [
  'phase9_register_structural_metadata_lookup',
  'phase9_register_structural_metadata_attempt',
  'phase9_register_metadata_attempt',
  'phase9_reserve_metadata_usage',
  'phase9_register_metadata_provider_call_pre_queue_v1',
  'phase9_register_edition_options_provider_call_pre_queue_v1',
  'phase9_owner_ux_metadata_state',
];
const identity = '["p9-metadata-lookup-v1","p9-bibliographic-normalizer-v1","isbn","9780141439723","",[],"und",[]]';
let db, beforeDefinitions, afterDefinitions;
const hasM95 = fs.existsSync(migrationPath(M95));

async function definitions(database) {
  const rows = (await database.query(`SELECT p.oid AS oid,n.nspname||'.'||p.proname||'('||pg_catalog.pg_get_function_identity_arguments(p.oid)||')' AS signature,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,p.provolatile,p.prosecdef,p.proconfig
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec' AND p.proname=ANY($1::text[]) ORDER BY 1`, [redefined])).rows;
  return Object.fromEntries(rows.map(row => [row.signature, row]));
}
async function mutate(_f, sql, values) {
  await resetActor(db); await db.query(sql, values);
}
async function automaticJob({ nullVersion = true } = {}) {
  const f = await seedCard(db);
  const { jobId } = await seedAutomaticLineage(db, f);
  if (nullVersion) await mutate(f, 'UPDATE public.image_extraction_jobs SET operation_version=NULL WHERE id=$1', [jobId]);
  const context = await scalar(db, await claimJob(db, f, jobId));
  return { ...f, jobId, context };
}
async function explicitJob() {
  const f = await seedCard(db);
  const receipt = await scalar(db, lookupSql(f));
  const context = await scalar(db, await claimJob(db, f, receipt.operationId));
  return { ...f, jobId: receipt.operationId, context };
}
async function configureOpenLibrary({ automatic = true, explicit = false } = {}) {
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,
    automatic_order=NULL,explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL
    WHERE adapter_key<>'open_library';`);
  await db.query(`UPDATE public.phase9_provider_registry SET enabled=true,matching_allowed=true,storage_allowed=true,
    adapter_version='2.0.0',accepted_adapter_versions=ARRAY['2.0.0'],
    version_contracts=jsonb_build_object('2.0.0',marketplace_sec.phase9_provider_validation_contract_v1('open_library','2.0.0')),
    validation_contract='open-library-v2',host_policy_version='open-library-hosts-v1',
    automatic_lookup_allowed=$1,automatic_role=CASE WHEN $1 THEN 'primary' END,
    automatic_order=CASE WHEN $1 THEN 1 END,explicit_search_allowed=$2,
    explicit_role=CASE WHEN $2 THEN 'primary' END,explicit_order=CASE WHEN $2 THEN 1 END,
    policy_version=1 WHERE adapter_key='open_library'`, [automatic, explicit]);
}
async function configureGoogleLegacy() {
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,automatic_role=NULL,
    automatic_order=NULL,explicit_search_allowed=false,explicit_role=NULL,explicit_order=NULL;
    UPDATE public.phase9_provider_registry SET enabled=true,matching_allowed=true,storage_allowed=true,
    adapter_version='1.0.0',policy_version=1 WHERE adapter_key='google_books';`);
}
function lookupArgs(f, { adapter = 'open_library', version = '2.0.0', capability = 'open-library-capability-v2', key = 'automatic:' + f.jobId } = {}) {
  return [f.jobId, worker, token, 1, f.candidateId, f.context.candidateVersion, f.context.queryIdentity, key,
    adapter, version, capability, 'p9-metadata-foundation-v1', 'bibliographic', 'p9-metadata-lookup-v1',
    'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'store_private', '1',
    'p9-metadata-cache-v1', 'metadata-v1', null];
}
async function seedLookup(f, { adapter = 'open_library', version = '2.0.0', capability = 'open-library-capability-v2' } = {}) {
  const id = randomUUID();
  await mutate(f, `INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,
    execution_mode,provider_cache_identity,adapter_key,adapter_version,capability_version,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,
    reuse_policy_version,cache_policy_version,cache_namespace,claim_attempt_number,claim_worker,claim_lease_token_hash)
    VALUES($1,$2,$3,$4,$5,'external',$6,$7,$8,$9,'p9-metadata-foundation-v1','bibliographic',
    'p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1','store_private','1',
    'p9-metadata-cache-v1','metadata-v1',1,$10,encode(extensions.digest($11,'sha256'),'hex'))`,
  [id, f.candidateId, f.storeId, f.jobId, f.context.queryIdentity, 'automatic:' + f.jobId, adapter, version,
    capability, worker, token]);
  await setActor(db, '', 'service_role');
  return id;
}
async function seedReservation(f, lookupId, { adapter = 'open_library', version = '2.0.0' } = {}) {
  const id = randomUUID();
  await resetActor(db);
  const dedupe = (await db.query('SELECT dedupe_key FROM public.image_extraction_jobs WHERE id=$1', [f.jobId])).rows[0].dedupe_key;
  await db.query(`INSERT INTO public.phase9_usage_reservations(id,store_id,job_id,cost_kind,policy_version,operation,
    adapter_key,adapter_version,idempotency_identity,reserved_cost_units)
    VALUES($1,$2,$3,'metadata',1,'metadata_lookup',$4,$5,$6,0)`, [id, f.storeId, f.jobId, adapter, version, dedupe]);
  await setActor(db, '', 'service_role');
  return id;
}
async function seedAttempt(f, lookupId, reservationId, { adapter = 'open_library', version = '2.0.0', capability = 'open-library-capability-v2' } = {}) {
  const id = randomUUID(), providerAttemptIdentity = randomUUID();
  await mutate(f, `INSERT INTO public.metadata_enrichment_attempts(id,candidate_id,store_id,adapter_key,
    attempt_sequence,query_kind,status,adapter_version,schema_version,normalizer_version,reuse_policy_version,
    lookup_id,provider_role,query_identity,normalized_outcome,disposition,provider_attempt_identity,
    usage_reservation_id,capability_version,routing_policy_version)
    VALUES($1,$2,$3,$4,1,'bibliographic','registered',$5,'p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1',1,$6,'primary',$7,'unresolved','unresolved',$8,$9,$10,'p9-metadata-routing-v1')`,
  [id, f.candidateId, f.storeId, adapter, version, lookupId, f.context.queryIdentity, providerAttemptIdentity,
    reservationId, capability]);
  await setActor(db, '', 'service_role');
  return id;
}
async function seedAcceptedLookup(f, rows = [row()]) {
  await setActor(db, f.ownerId);
  const receipt = await scalar(db, lookupSql(f));
  await resetActor(db);
  const state = (await db.query('SELECT * FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
  const lookupId = randomUUID(), attemptId = randomUUID(), providerAttemptIdentity = randomUUID();
  await db.query(`INSERT INTO public.phase9_metadata_lookups(id,candidate_id,store_id,job_id,query_identity,
    execution_mode,provider_cache_identity,adapter_key,adapter_version,capability_version,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,privacy_scope,
    reuse_policy_version,cache_policy_version,cache_namespace,claim_attempt_number,claim_worker,
    claim_lease_token_hash,normalized_outcome,completed_at)
    VALUES($1,$2,$3,$4,$5,'external',$6,'google_books','1.0.0','cap-v1','p9-metadata-foundation-v1',
    'bibliographic','p9-metadata-lookup-v1','p9-bibliographic-normalizer-v1','p9-metadata-routing-v1',
    'store_private','1','p9-metadata-cache-v1','metadata-v1',1,$7,encode(extensions.digest($8,'sha256'),'hex'),
    'accepted_metadata_match',transaction_timestamp())`,
  [lookupId, f.candidateId, f.storeId, receipt.operationId, state.query_identity, 'accepted:' + receipt.operationId, worker, token]);
  await db.query(`INSERT INTO public.metadata_enrichment_attempts(id,candidate_id,store_id,adapter_key,
    attempt_sequence,query_kind,status,adapter_version,schema_version,normalizer_version,reuse_policy_version,
    lookup_id,provider_role,query_identity,normalized_outcome,disposition,provider_attempt_identity,
    capability_version,routing_policy_version)
    VALUES($1,$2,$3,'google_books',1,'bibliographic','completed','1.0.0','p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1',1,$4,'primary',$5,'accepted_metadata_match','accepted',$6,'cap-v1',
    'p9-metadata-routing-v1')`,
  [attemptId, f.candidateId, f.storeId, lookupId, state.query_identity, providerAttemptIdentity]);
  await db.query(`UPDATE public.phase9_candidate_edition_state SET options=$1,options_version=options_version+1,
    source_lookup_id=$2,source_attempt_id=$3,source_fetched_at=transaction_timestamp(),
    options_expires_at=transaction_timestamp()+interval '1 hour' WHERE candidate_id=$4`,
  [rows, lookupId, attemptId, f.candidateId]);
  await db.query("UPDATE public.image_extraction_jobs SET status='resolved',completed_at=transaction_timestamp() WHERE id=$1", [receipt.operationId]);
  await setActor(db, f.ownerId);
  return { receipt, lookupId, attemptId, rows, choices: await scalar(db, readSql(f)) };
}

async function bleakShape({ openJob = false } = {}) {
  const f = await seedCard(db);
  const { jobId } = await seedAutomaticLineage(db, f);
  const context = await scalar(db, await claimJob(db, f, jobId));
  const failed = await rpc(db, 'phase9_fail_metadata_job', [jobId, worker, token, 1, f.candidateId,
    context.candidateVersion, context.queryIdentity, 'ambiguous_match', false]);
  assert.equal(failed.manual_outcome, 'ambiguous');
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL,owner_isbn13='9780141439723' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const saved = await seedAcceptedLookup(f);
  await resetActor(db);
  await db.query('SELECT marketplace_sec.phase9_edition_clear_options($1)', [f.candidateId]);
  if (openJob) await db.query("UPDATE public.image_extraction_jobs SET status='open' WHERE id=$1", [saved.receipt.operationId]);
  await setActor(db, f.ownerId);
  return { ...f, saved };
}
async function metadataState(f) {
  await resetActor(db);
  const result = await scalar(db, `SELECT marketplace_sec.phase9_owner_ux_metadata_state('${f.candidateId}')`);
  await setActor(db, f.ownerId);
  return result;
}
async function identityOf(f) {
  await resetActor(db);
  const result = await scalar(db, `SELECT marketplace_sec.phase9_edition_query_identity(c) FROM public.image_extraction_candidates c WHERE id='${f.candidateId}'`);
  await setActor(db, f.ownerId);
  return result;
}

before(async () => {
  const prefix = selectedPrefix('8a-5');
  db = await createProviderDatabase({ migrations: [...prefix.migrations, M94], installed: prefix.installed });
  beforeDefinitions = await definitions(db);
  if (hasM95) await db.exec(fs.readFileSync(migrationPath(M95), 'utf8'));
  afterDefinitions = await definitions(db);
});
beforeEach(async () => { await clean(db); await resetActor(db); });
after(async () => { await db?.close(); });

// Fix A: each seeded red reaches the changed function's own NULL comparison.
test('A1 structural lookup: NULL automatic job on Open Library v2 is accepted', async () => {
  await configureOpenLibrary({ automatic: true });
  const f = await automaticJob();
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', lookupArgs(f));
  assert.ok(lookup.lookup_id);
});

test('A2 reserve: NULL automatic job on Open Library v2 is accepted with a seeded lookup', async () => {
  await configureOpenLibrary({ automatic: true });
  const f = await automaticJob();
  const lookupId = await seedLookup(f);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [f.jobId, worker, token, 1, lookupId, 'open_library', '2.0.0', 1]);
  assert.ok(usage.reservation_id);
});

test('A3 attempt: NULL automatic job on Open Library v2 is accepted with a seeded lookup and reservation', async () => {
  await configureOpenLibrary({ automatic: true });
  const f = await automaticJob();
  const lookupId = await seedLookup(f), reservationId = await seedReservation(f, lookupId);
  const attempt = await rpc(db, 'phase9_register_metadata_attempt', [lookupId, f.jobId, worker, token, 1,
    randomUUID(), 'automatic:' + f.jobId, 'primary', 1, 'open_library', '2.0.0', 'open-library-capability-v2',
    'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'local_insufficient', reservationId]);
  assert.ok(attempt.attempt_id);
});

test('A3b structural attempt: NULL automatic job reaches its delegate with the automatic identity', async () => {
  await configureOpenLibrary({ automatic: true });
  const f = await automaticJob();
  const lookupId = await seedLookup(f), reservationId = await seedReservation(f, lookupId);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [lookupId, f.jobId, worker, token, 1,
    f.candidateId, f.context.candidateVersion, randomUUID(), 'automatic:' + f.jobId, 'primary', 1, 'open_library',
    '2.0.0', 'open-library-capability-v2', 'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1', 'local_insufficient', reservationId]);
  assert.ok(attempt.attempt_id);
});

test('A4 edition-options physical call: NULL automatic job on Open Library v2 is accepted with a seeded attempt', async () => {
  await configureOpenLibrary({ automatic: true });
  const f = await automaticJob();
  const lookupId = await seedLookup(f), reservationId = await seedReservation(f, lookupId);
  const attemptId = await seedAttempt(f, lookupId, reservationId);
  const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1', [attemptId, f.jobId, worker, token, 1,
    randomUUID(), 0, 'search']);
  assert.ok(call.provider_call_id);
  assert.equal(await value(db, 'SELECT edition_call_stage FROM public.phase9_metadata_provider_calls WHERE id=$1', [call.provider_call_id]), 'search');
});

test('A5 explicit edition-options job on Open Library v2 is unchanged', async () => {
  await configureOpenLibrary({ automatic: false, explicit: true });
  const f = await explicitJob();
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', lookupArgs(f, { key: 'explicit:' + f.jobId }));
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [f.jobId, worker, token, 1, lookup.lookup_id, 'open_library', '2.0.0', 1]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [lookup.lookup_id, f.jobId, worker, token,
    1, f.candidateId, f.context.candidateVersion, randomUUID(), 'explicit:' + f.jobId, 'primary', 1, 'open_library',
    '2.0.0', 'open-library-capability-v2', 'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]);
  const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1', [attempt.attempt_id, f.jobId, worker,
    token, 1, randomUUID(), 0, 'search']);
  assert.ok(call.provider_call_id);
});

test('A6 non-NULL automatic job on Open Library v2 is unchanged', async () => {
  await configureOpenLibrary({ automatic: true });
  const f = await automaticJob({ nullVersion: false });
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', lookupArgs(f));
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [f.jobId, worker, token, 1, lookup.lookup_id, 'open_library', '2.0.0', 1]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [lookup.lookup_id, f.jobId, worker, token,
    1, f.candidateId, f.context.candidateVersion, randomUUID(), 'automatic:' + f.jobId, 'primary', 1, 'open_library',
    '2.0.0', 'open-library-capability-v2', 'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]);
  const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1', [attempt.attempt_id, f.jobId, worker,
    token, 1, randomUUID(), 0, 'search']);
  assert.ok(call.provider_call_id);
});

test('A7 NULL automatic job still registers the single-call Google legacy path', async () => {
  await configureGoogleLegacy();
  const f = await automaticJob();
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', lookupArgs(f, {
    adapter: 'google_books', version: '1.0.0', capability: 'google-books-capability-v1', key: 'automatic:' + f.jobId }));
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [f.jobId, worker, token, 1, lookup.lookup_id, 'google_books', '1.0.0', 1]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [lookup.lookup_id, f.jobId, worker, token,
    1, f.candidateId, f.context.candidateVersion, randomUUID(), 'automatic:' + f.jobId, 'primary', 1, 'google_books',
    '1.0.0', 'google-books-capability-v1', 'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1',
    'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]);
  const call = await rpc(db, 'phase9_register_metadata_provider_call', [attempt.attempt_id, f.jobId, worker, token, 1, randomUUID()]);
  assert.ok(call.provider_call_id);
});

test('A8 M93 protection trigger still rejects an unadmitted call after M95', { skip: !hasM95 ? 'M95 not built yet' : false }, async () => {
  await configureOpenLibrary({ automatic: true });
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET protection_policy='{\"version\":\"p9-protection-v1\",\"minIntervalMs\":1000,\"storeWindowSeconds\":60,\"storeMaxGets\":20,\"backoffBaseMs\":1,\"backoffMaxMs\":2,\"breakerFailures\":3,\"breakerWindowSeconds\":60,\"breakerCooldownMs\":1,\"halfOpenMax\":1,\"mode\":\"single_instance\",\"contactId\":\"test-contact\"}'::jsonb WHERE adapter_key='open_library'");
  const f = await automaticJob();
  const lookupId = await seedLookup(f), reservationId = await seedReservation(f, lookupId);
  const attemptId = await seedAttempt(f, lookupId, reservationId);
  await assert.rejects(rpc(db, 'phase9_register_edition_options_provider_call_v1', [attemptId, f.jobId, worker, token, 1, randomUUID(), 0, 'search']), /P9_PROVIDER_RUN_NOT_ADMITTED/);
});

test('B1 Bleak House shape reads ambiguous, not pending', async () => {
  const f = await bleakShape();
  assert.deepEqual(JSON.parse(await identityOf(f)), JSON.parse(identity));
  assert.equal(await metadataState(f), 'ambiguous');
});

test('B2 Bleak House shape with an open job still reads pending', async () => {
  const f = await bleakShape({ openJob: true });
  assert.equal(await metadataState(f), 'pending');
});

test('B3 M79 scanned card with no lookup and no job stays pending', async () => {
  const f = await seedCard(db);
  const { jobId } = await seedAutomaticLineage(db, f);
  await mutate(f, 'DELETE FROM public.phase9_metadata_lookups WHERE candidate_id=$1', [f.candidateId]);
  await mutate(f, "UPDATE public.image_extraction_jobs SET status='resolved' WHERE id=$1", [jobId]);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await value(db, 'SELECT count(*)::int FROM public.phase9_metadata_lookups WHERE candidate_id=$1', [f.candidateId]), 0);
  assert.equal(await metadataState(f), 'pending');
});

test('B4 M79 changed ISBN after a match stays pending', async () => {
  const f = await seedCard(db);
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780306406157' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  await seedAcceptedLookup(f);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780140449136' WHERE id=$1", [f.candidateId]);
  assert.equal(await metadataState(f), 'pending');
});

test('B5 M80 A to B and back to A stays pending', async () => {
  const f = await seedCard(db);
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780306406157' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  await seedAcceptedLookup(f);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780140449136' WHERE id=$1", [f.candidateId]);
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780306406157' WHERE id=$1", [f.candidateId]);
  assert.equal(await metadataState(f), 'pending');
});

test('B6 M80 manual card stays ambiguous and an open job keeps it pending', async () => {
  const f = await seedCard(db);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET input_id=NULL,owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780306406157' WHERE id=$1", [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await setActor(db, f.ownerId);
  await scalar(db, lookupSql(f));
  assert.equal(await metadataState(f), 'pending');
});

test('B7 M80 newer lookup row than the match stays pending', async () => {
  const f = await seedCard(db);
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780306406157' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  await seedAcceptedLookup(f);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, `INSERT INTO public.phase9_metadata_lookups
    SELECT * FROM jsonb_populate_record(NULL::public.phase9_metadata_lookups,
      to_jsonb((SELECT l FROM public.phase9_metadata_lookups l WHERE l.candidate_id=$1 LIMIT 1))
      || jsonb_build_object('id',gen_random_uuid(),'routing_policy_version','p9-metadata-routing-v-newer','created_at',now()+interval '1 minute'))`, [f.candidateId]);
  assert.equal(await metadataState(f), 'pending');
});

test('B8 choosing an edition still reads selected', async () => {
  const f = await seedCard(db);
  await mutate(f, "UPDATE public.image_extraction_candidates SET owner_isbn13='9780306406157' WHERE id=$1", [f.candidateId]);
  await setActor(db, f.ownerId);
  const saved = await seedAcceptedLookup(f);
  await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
  assert.equal(await metadataState(f), 'selected');
});

test('M95 preserves owner, volatility, security, search_path and ACLs', async () => {
  assert.deepEqual(Object.keys(afterDefinitions).sort(), Object.keys(beforeDefinitions).sort());
  for (const [signature, after] of Object.entries(afterDefinitions)) {
    const before = beforeDefinitions[signature];
    assert.equal(after.owner, 'postgres', signature);
    assert.equal(after.provolatile, before.provolatile, signature + ' volatility');
    assert.equal(after.prosecdef, before.prosecdef, signature + ' security');
    assert.equal(after.proconfig?.join('|') ?? null, before.proconfig?.join('|') ?? null, signature + ' search_path');
    assert.equal(after.acl, before.acl, signature + ' ACL');
    assert.equal((await value(db, `SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE p.oid=$1 AND a.grantee=0 AND a.privilege_type='EXECUTE')`, [after.oid])), true, signature + ' PUBLIC');
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await value(db, `SELECT has_function_privilege($1,$2,'EXECUTE')`, [role, after.oid]), false, signature + ' ' + role);
    }
  }
  for (const name of ['phase9_register_structural_metadata_lookup', 'phase9_register_structural_metadata_attempt',
    'phase9_register_metadata_attempt', 'phase9_reserve_metadata_usage']) {
    const definition = Object.values(afterDefinitions).find(row => row.signature.startsWith(`marketplace_sec.${name}(`));
    assert.equal(await value(db, `SELECT has_function_privilege('service_role',$1,'EXECUTE')`, [definition.oid]), true, name + ' service_role');
  }
  for (const name of ['phase9_register_metadata_provider_call_pre_queue_v1',
    'phase9_register_edition_options_provider_call_pre_queue_v1', 'phase9_owner_ux_metadata_state']) {
    const definition = Object.values(afterDefinitions).find(row => row.signature.startsWith(`marketplace_sec.${name}(`));
    assert.equal(await value(db, `SELECT has_function_privilege('service_role',$1,'EXECUTE')`, [definition.oid]), false, name + ' service_role');
  }
});

test('B9 Bleak House shape with a newer in-flight lookup stays pending', async () => {
  const f = await bleakShape();
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, `INSERT INTO public.phase9_metadata_lookups
    SELECT * FROM jsonb_populate_record(NULL::public.phase9_metadata_lookups,
      to_jsonb((SELECT l FROM public.phase9_metadata_lookups l WHERE l.id=$1))
      || jsonb_build_object('id',gen_random_uuid(),'routing_policy_version','p9-metadata-routing-v-newer',
        'normalized_outcome','unresolved','completed_at',NULL,'created_at',now()+interval '1 minute'))`, [f.saved.lookupId]);
  assert.equal(await metadataState(f), 'pending');
});
