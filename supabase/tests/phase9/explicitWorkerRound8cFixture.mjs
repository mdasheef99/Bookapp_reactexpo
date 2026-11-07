// Unit 2 (8c): compiled explicit worker against real M93..M99 SQL.
// Disposable databases only; recorded HTTP; no live provider.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { clean, createProviderDatabase, resetActor, setActor, value }
  from './providerReplacementFixture.mjs';
import { selectedPrefix } from './providerDatabaseHarness.mjs';
import { seedCard, lookupSql } from './editionPickerFixture.mjs';

export const WORKER = 'metadata-worker-sql-u2';
export const reserveRpc = 'phase9_reserve_metadata_provider_round_v1';
export const releaseRpc = 'phase9_release_metadata_provider_round_v1';
export const registerRpc = 'phase9_register_edition_options_provider_call_v1';
export const completeRpc = 'phase9_complete_candidate_edition_options_v2';
export const failRpc = 'phase9_fail_candidate_edition_options_v1';
export const TEST_ONLY_POLICY_8C = Object.freeze({
  version: 'p9-protection-v1', minIntervalMs: 1000, storeWindowSeconds: 60, storeMaxGets: 6,
  backoffBaseMs: 100, backoffMaxMs: 400, breakerFailures: 2, breakerWindowSeconds: 60,
  breakerCooldownMs: 30000, halfOpenMax: 1, mode: 'single_instance', contactId: 'fixture-contact',
});
const MIGRATIONS = [
  '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql',
  '20261104000095_marketplace_phase9_8c_null_safe_and_pending_state.sql',
  '20261104000096_marketplace_phase9_8c_final_attempt_sweep.sql',
  '20261105000097_marketplace_phase9_8c_sweep_recovery.sql',
  '20261105000098_marketplace_phase9_8c_pause_defer_and_retry_bound.sql',
  '20261106000099_marketplace_phase9_8c_fix_round.sql',
];
const DIST = process.env.PHASE9_METADATA_DIST ?? resolve(process.cwd(), '.phase9-dist');
const distImport = path => import(pathToFileURL(resolve(DIST, path)).href);
const { runMetadataWorkerBatch, getWorkerProtectionState } =
  await distImport('workers/phase9-metadata-worker/index.js');
const { createInstalledDescriptorManifest } =
  await distImport('workers/phase9-metadata-worker/bootstrap.js');
const { GoogleBooksAdapter } =
  await distImport('supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter.js');
const { GOOGLE_BOOKS_CAPABILITY } =
  await distImport('supabase/functions/_shared/imageInventory/metadata/googleBooks/index.js');
const { OpenLibraryEditionOptionsAdapter } =
  await distImport('supabase/functions/_shared/imageInventory/metadata/openLibrary/adapter.js');
const { createProtectionState } =
  await distImport('supabase/functions/_shared/imageInventory/runtime/providerProtection.js');
const { createMetadataEditionOptionsBoundary } =
  await distImport('supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc.js');

// Named-signature RPC preservation copied from automaticWorkerDatabaseFixture.mjs
// (kept local so the HEAD/red build never imports the working-tree dist).
function databaseRpc(db, calls, errors, after = async (_name, _p, result) => result) {
  return async (name, p = {}) => {
    assert.match(name, /^(phase9_[a-z0-9_]+|claim_phase9_metadata_jobs)$/);
    calls.push({ name, parameters: structuredClone(p) });
    try {
      const candidates = (await db.query(`SELECT p.proargnames,p.proretset,
        ARRAY(SELECT format_type(t,NULL) FROM unnest(p.proargtypes) t) AS types
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=$1`, [name])).rows;
      const keys = Object.keys(p);
      const matches = candidates.filter(row => keys.length === row.types.length
        && keys.every(key => row.proargnames.includes(key)));
      assert.equal(matches.length, 1, 'one exact installed RPC signature: ' + name);
      const signature = matches[0];
      const args = keys.map(key => `${key} := $${keys.indexOf(key) + 1}::${signature.types[signature.proargnames.indexOf(key)]}`);
      const parameters = keys.map(key => {
        const type = signature.types[signature.proargnames.indexOf(key)];
        return ['json', 'jsonb'].includes(type) && p[key] !== null ? JSON.stringify(p[key]) : p[key];
      });
      const rows = (await db.query(`SELECT ${signature.proretset ? '*' : 'public.' + name + '(' + args.join(',') + ') AS result'}
        ${signature.proretset ? 'FROM public.' + name + '(' + args.join(',') + ')' : ''}`, parameters)).rows;
      return await after(name, p, { data: signature.proretset ? rows : rows[0].result, error: null });
    } catch (error) {
      errors.push({ name, error });
      return { data: null, error };
    }
  };
}

async function rpc(db, name, values) {
  const result = await db.query('SELECT public.' + name + '('
    + values.map((_, index) => '$' + (index + 1)).join(',') + ')', values);
  return Object.values(result.rows[0])[0];
}

export async function createExplicitDatabase() {
  const prefix = selectedPrefix('8a-5');
  const db = await createProviderDatabase({ migrations: [...prefix.migrations, ...MIGRATIONS],
    installed: prefix.installed });
  try {
    await resetActor(db);
    for (const signature of [
      'public.phase9_reserve_metadata_provider_round_v1(jsonb,text,text)',
      'public.phase9_release_metadata_provider_round_v1(jsonb,text,text)',
      'public.phase9_register_edition_options_provider_call_v1(uuid,uuid,text,text,integer,uuid,integer,text)',
      'public.phase9_fail_candidate_edition_options_v1(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,text,boolean)',
      'marketplace_sec.phase9_settle_terminal_usage_v1(uuid,uuid,text)',
    ]) assert.equal(await value(db, 'SELECT to_regprocedure($1) IS NOT NULL', [signature]), true, signature);
    assert.equal(await value(db, `SELECT count(*)>0 FROM pg_trigger
      WHERE tgname='phase9_provider_run_grant_v1' AND NOT tgisinternal`), true);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function closeExplicitDatabase(db) {
  await db?.close();
}

async function routeRegistry(db, route, protection) {
  await db.exec(`UPDATE public.phase9_provider_registry SET automatic_lookup_allowed=false,
    automatic_role=NULL, automatic_order=NULL, explicit_search_allowed=false, explicit_role=NULL,
    explicit_order=NULL, protection_policy=NULL`);
  if (route === 'ol-v2-primary') {
    await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='2.0.0',
      explicit_search_allowed=true, explicit_role='primary', explicit_order=1,
      accepted_adapter_versions=ARRAY['1.0.0','2.0.0'],
      version_contracts=version_contracts||jsonb_build_object('2.0.0',
        marketplace_sec.phase9_provider_validation_contract_v1('open_library','2.0.0')),
      validation_contract='open-library-v2', protection_policy=$1
      WHERE adapter_key='open_library'`, [protection ? TEST_ONLY_POLICY_8C : null]);
  } else if (route === 'ol-v1-primary') {
    await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='1.0.0',
      explicit_search_allowed=true, explicit_role='primary', explicit_order=1,
      accepted_adapter_versions=ARRAY['1.0.0'], validation_contract='open-library-v1',
      protection_policy=NULL WHERE adapter_key='open_library'`);
  } else if (route === 'google-primary') {
    await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='1.0.0',
      explicit_search_allowed=true, explicit_role='primary', explicit_order=1,
      accepted_adapter_versions=ARRAY['1.0.0'], protection_policy=NULL
      WHERE adapter_key='google_books'`);
  } else if (route === 'google-primary-ol-secondary') {
    await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='1.0.0',
      explicit_search_allowed=true, explicit_role='primary', explicit_order=1,
      accepted_adapter_versions=ARRAY['1.0.0'], protection_policy=NULL
      WHERE adapter_key='google_books'`);
    await db.query(`UPDATE public.phase9_provider_registry SET adapter_version='1.0.0',
      explicit_search_allowed=true, explicit_role='secondary', explicit_order=2,
      accepted_adapter_versions=ARRAY['1.0.0'], protection_policy=$1
      WHERE adapter_key='open_library'`, [protection ? TEST_ONLY_POLICY_8C : null]);
  } else throw new Error('unknown fixture route ' + route);
}

export async function prepareExplicitJob(db, { route = 'ol-v2-primary', protection = true,
  capacityUsed = 0 } = {}) {
  await clean(db);
  await resetActor(db);
  const card = await seedCard(db);
  const receipt = await value(db, lookupSql(card));
  await resetActor(db);
  await routeRegistry(db, route, protection);
  await db.query(`UPDATE marketplace_sec.phase9_store_admission SET gets_used=$1,
    window_started_at=clock_timestamp(), window_seconds=60, next_due_at='-infinity'
    WHERE store_id=$2`, [capacityUsed, card.storeId]);
  await db.exec("UPDATE marketplace_sec.phase9_external_admission_gate SET mode='open'");
  for (const key of ['google_books', 'open_library']) {
    Object.assign(getWorkerProtectionState(key), createProtectionState());
  }
  return { ...card, jobId: receipt.operationId };
}

function payloadFor(address, googleRoute) {
  const path = new URL(String(address)).pathname;
  if (googleRoute && path.startsWith('/books/v1/volumes')) {
    return { kind: 'books#volumes', totalItems: 1, items: [{ id: 'fixture-volume',
      volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'], language: 'en',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] };
  }
  if (path === '/search.json') return { docs: [{ key: '/works/OL1W' }] };
  if (path.endsWith('/editions.json')) return { entries: [{ key: '/books/OL100M',
    title: 'The Fixture Book', authors: [{ key: '/authors/OL1A' }],
    languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'] }] };
  return { key: '/authors/OL1A', name: 'Fixture Author' };
}

export function explicitWorkerFixture(db, options = {}) {
  const { route = 'ol-v2-primary', protection = true, capacityUsed = 0,
    response = null, loseReserve = 0, loseRelease = 0, malformedReserve = false,
    recoverySeam = false, googleEmpty = false } = options;
  return (async () => {
    const card = await prepareExplicitJob(db, { route, protection, capacityUsed });
    const calls = [], errors = [], urls = [], logEvents = [], reserveReceipts = [];
    let loseReserveLeft = loseReserve, loseReleaseLeft = loseRelease;
    let seeded = false, contextSeam = null;
    const googleRoute = route === 'google-primary' || route === 'google-primary-ol-secondary';
    const recorded = async (address, init) => {
      urls.push(String(address));
      if (response) return response(address, init);
      if (googleEmpty && googleRoute && String(address).includes('googleapis')) {
        return new Response(JSON.stringify({ kind: 'books#volumes', totalItems: 0 }),
          { headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify(payloadFor(address, googleRoute)),
        { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } });
    };
    const library = new OpenLibraryEditionOptionsAdapter({
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recorded, retentionAllowed: true,
    });
    const google = googleRoute ? new GoogleBooksAdapter({ mode: 'real', apiKey: 'fixture',
      timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recorded,
      // Explicit Google retention needs a configured verifier; otherwise the descriptor
      // is not explicit-ready and the route is manual before any executor step.
      verifyOptionsRetention: ({ fetchedAt }) => ({ storagePermissionVerified: true,
        permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 3600000).toISOString() }) }) : null;
    const installed = createInstalledDescriptorManifest({ google, openLibrary: library });
    async function seedRecoveryOnly() {
      const context = contextSeam;
      const fence = { jobId: context.jobId, worker: WORKER, leaseToken: context.claimToken,
        claimAttempt: context.attempt, candidateId: context.candidateId, storeId: context.storeId,
        sessionId: context.sessionId, requestId: context.jobId,
        requestGeneration: context.requestGeneration, queryIdentity: context.queryIdentity };
      await rpc(db, reserveRpc, [JSON.stringify(fence), 'open_library', '2.0.0']);
      const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [
        context.jobId, WORKER, context.claimToken, context.attempt, context.candidateId,
        context.candidateVersion, context.queryIdentity, 'recovery-seam:' + context.jobId,
        'open_library', '2.0.0', 'open-library-capability-v2', 'p9-metadata-foundation-v1',
        'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1',
        'p9-metadata-routing-v1', 'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null,
      ]);
      const usage = await rpc(db, 'phase9_reserve_metadata_usage', [context.jobId, WORKER,
        context.claimToken, context.attempt, lookup.lookup_id, 'open_library', '2.0.0', 1]);
      const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [
        lookup.lookup_id, context.jobId, WORKER, context.claimToken, context.attempt,
        context.candidateId, context.candidateVersion, randomUUID(), 'recovery-seam:' + context.jobId,
        'primary', 1, 'open_library', '2.0.0', 'open-library-capability-v2',
        'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
        'local_insufficient', usage.reservation_id,
      ]);
      await rpc(db, registerRpc, [attempt.attempt_id, context.jobId, WORKER, context.claimToken,
        context.attempt, randomUUID(), 0, 'search']);
    }
    const after = async (name, p, result) => {
      if (name === 'phase9_metadata_job_context' && result?.data?.jobId) contextSeam = result.data;
      if (name === 'phase9_provider_configuration_v1' && recoverySeam && contextSeam && !seeded) {
        seeded = true;
        await seedRecoveryOnly();
      }
      if (name === reserveRpc && malformedReserve) return { data: { status: 'bogus' }, error: null };
      return result;
    };
    const rawRpc = databaseRpc(db, calls, errors, after);
    // Throw OUTSIDE databaseRpc so the worker sees a lost transport response (not a
    // returned SQL refusal) and performs its exact replay.
    const serviceClient = { rpc: async (name, p = {}) => {
      const result = await rawRpc(name, p);
      if (name === reserveRpc && result.error === null && result.data) reserveReceipts.push(result.data);
      if (name === reserveRpc && loseReserveLeft > 0) {
        loseReserveLeft -= 1;
        throw new Error('simulated lost reserve response');
      }
      if (name === releaseRpc && loseReleaseLeft > 0) {
        loseReleaseLeft -= 1;
        throw new Error('simulated lost release response');
      }
      return result;
    } };
    const dependencies = { workerId: WORKER, workerAuthToken: 'local-fixture-only', serviceClient,
      primary: google, primaryCapability: google === null ? null : GOOGLE_BOOKS_CAPABILITY,
      editionFallback: library, installed,
      editionOptionsBoundary: createMetadataEditionOptionsBoundary(serviceClient),
      providerContacts: { 'fixture-contact': 'BookConnect fixture (fixture@example.invalid)' },
    };
    const runner = {
      ...card, dependencies, calls, errors, urls, logEvents, reserveReceipts,
      names: () => calls.map(call => call.name),
      counts: async () => {
        await resetActor(db);
        const job = await value(db, 'SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id=$1',
          [card.jobId]);
        const counts = {};
        for (const [key, table, where] of [
          ['lookups', 'public.phase9_metadata_lookups', 'job_id'],
          ['attempts', 'public.metadata_enrichment_attempts', 'candidate_id'],
          ['reservations', 'public.phase9_usage_reservations', 'job_id'],
          ['calls', 'public.phase9_metadata_provider_calls', 'job_id'],
          ['admissions', 'marketplace_sec.phase9_metadata_admissions', 'job_id'],
        ]) counts[key] = Number(await value(db, `SELECT count(*) FROM ${table} WHERE ${where}=$1`,
          [key === 'attempts' ? card.candidateId : card.jobId]));
        counts.slots = Number(await value(db, `SELECT coalesce(max(slots_remaining),0)
          FROM marketplace_sec.phase9_metadata_admissions WHERE job_id=$1`, [card.jobId]));
        counts.getsUsed = Number(await value(db, `SELECT gets_used
          FROM marketplace_sec.phase9_store_admission WHERE store_id=$1`, [card.storeId]));
        const reservations = (await db.query(`SELECT status,actual_cost_units
          FROM public.phase9_usage_reservations WHERE job_id=$1`, [card.jobId])).rows;
        return { job, counts, reservations };
      },
      async run() {
        await setActor(db, card.ownerId, 'service_role');
        return runMetadataWorkerBatch(1, dependencies);
      },
    };
    return runner;
  })();
}
