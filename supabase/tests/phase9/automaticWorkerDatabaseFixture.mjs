// 02c §§4.3/5.1/9: compiled worker, recorded HTTP and real disposable SQL.
import assert from 'node:assert/strict';
import { createProviderDatabase, resetActor, setActor, value } from './providerReplacementFixture.mjs';
import { selectedPrefix } from './providerDatabaseHarness.mjs';
import { seedAutomaticLineage, seedCard } from './editionPickerFixture.mjs';
import { olAutomaticRoute } from './providerAutomaticReviewFixture.mjs';
import { runMetadataWorkerBatch, getWorkerProtectionState } from '../../../.phase9-dist/workers/phase9-metadata-worker/index.js';
import { createInstalledDescriptorManifest } from '../../../.phase9-dist/workers/phase9-metadata-worker/bootstrap.js';
import { GoogleBooksAdapter } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter.js';
import { GOOGLE_BOOKS_CAPABILITY } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/index.js';
import { OpenLibraryEditionOptionsAdapter } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/openLibrary/adapter.js';
import { createProtectionState } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/providerProtection.js';

// Identical to functions/__tests__/support/providerProtection.ts; test-only, never a runtime default.
export const TEST_ONLY_POLICY = { version: 'p9-protection-v1', minIntervalMs: 1000, storeWindowSeconds: 60,
  storeMaxGets: 6, backoffBaseMs: 100, backoffMaxMs: 400, breakerFailures: 2,
  breakerWindowSeconds: 60, breakerCooldownMs: 30000, halfOpenMax: 1,
  mode: 'single_instance', contactId: 'fixture-contact' };
export async function createAutomaticWorkerDatabase() {
  const prefix = selectedPrefix('8a-5');
  return createProviderDatabase({ migrations: [...prefix.migrations,
    '20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql'], installed: prefix.installed });
}

// Parameter names/types come from the INSTALLED public function, including overloaded finish.
// No RPC is emulated, and the database's original SQLSTATE passes through unchanged.
export function databaseRpc(db, calls, errors, after = async (_name, _p, result) => result) {
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
      const args = keys.map((key, i) => `${key} := $${i + 1}::${signature.types[signature.proargnames.indexOf(key)]}`);
      const parameters = keys.map(key => {
        const type = signature.types[signature.proargnames.indexOf(key)];
        return ['json', 'jsonb'].includes(type) && p[key] !== null ? JSON.stringify(p[key]) : p[key];
      });
      const rows = (await db.query(`SELECT ${signature.proretset ? '*' : 'public.' + name + '(' + args.join(',') + ') AS result'}
        ${signature.proretset ? 'FROM public.' + name + '(' + args.join(',') + ')' : ''}`, parameters)).rows;
      return await after(name, p, { data: signature.proretset ? rows : rows[0].result, error: null });
    } catch (error) {
      errors.push({ name, error });
      return { data: null, error }; // Preserve the real code; never manufacture P0001.
    }
  };
}
export async function automaticWorkerFixture(db, { provider = 'google_books', fetcher, after, card: receiving = null } = {}) {
  const card = receiving ?? await seedCard(db);
  const { jobId } = await seedAutomaticLineage(db, card, 'accepted', (receiving === null ? 'a' : 'b').repeat(64));
  if (provider === 'open_library') await olAutomaticRoute(db);
  await resetActor(db);
  await db.query('UPDATE public.phase9_provider_registry SET protection_policy=$1 WHERE adapter_key=$2', [TEST_ONLY_POLICY, provider]);
  const calls = [], errors = [], urls = [];
  Object.assign(getWorkerProtectionState(provider), createProtectionState());
  const recorded = async (address, init) => {
    urls.push(String(address));
    if (fetcher) return fetcher(address, init);
    if (provider === 'google_books') return new Response(JSON.stringify({ kind: 'books#volumes', totalItems: 1,
      items: [{ id: 'recorded-worker-winner', volumeInfo: { title: 'The Fixture Book', authors: ['Fixture Author'],
        language: 'en', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] }),
    { headers: { 'content-type': 'application/json' } });
    const path = new URL(String(address)).pathname;
    const payload = path === '/search.json' ? { docs: [{ key: '/works/OL1W' }] }
      : path.endsWith('/editions.json') ? { entries: [{ key: '/books/OL100M', title: 'The Fixture Book',
        authors: [{ key: '/authors/OL1A' }], languages: [{ key: '/languages/eng' }], isbn_13: ['9780306406157'] }] }
        : { key: '/authors/OL1A', name: 'Fixture Author' };
    return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } });
  };
  const google = provider === 'google_books' ? new GoogleBooksAdapter({ mode: 'real', apiKey: 'recorded-no-network',
    timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recorded }) : null;
  const library = new OpenLibraryEditionOptionsAdapter({ timeoutMs: 1000, maxResponseBytes: 64000, fetcher: recorded });
  const dependencies = { workerId: 'metadata-worker-sql-u5', workerAuthToken: 'local-fixture-only',
    serviceClient: { rpc: databaseRpc(db, calls, errors, after),
      // Exact PostgREST read used by FIX2 L1, backed by the real SQL rows, never fabricated lineage.
      from(table) {
        assert.equal(table, 'metadata_enrichment_attempts');
        return { select: () => ({ eq: (key, id) => {
          assert.equal(key, 'id');
          return { maybeSingle: async () => {
            const rows = (await db.query(`SELECT to_jsonb(a)||jsonb_build_object(
              'lookup',(SELECT to_jsonb(l) FROM public.phase9_metadata_lookups l WHERE l.id=a.lookup_id),
              'calls',(SELECT coalesce(jsonb_agg(to_jsonb(pc)),'[]') FROM public.phase9_metadata_provider_calls pc
                WHERE pc.logical_attempt_id=a.id)) AS result FROM public.metadata_enrichment_attempts a WHERE a.id=$1`, [id])).rows;
            return { data: rows[0]?.result ?? null, error: null };
          } };
        } }) };
      },
    }, primary: google,
    primaryCapability: google === null ? null : GOOGLE_BOOKS_CAPABILITY, editionFallback: library,
    installed: createInstalledDescriptorManifest({ google, openLibrary: library }) };
  return { ...card, jobId, calls, errors, urls, dependencies,
    async run() { await setActor(db, card.ownerId, 'service_role'); return runMetadataWorkerBatch(1, dependencies); },
    async counts() {
      await resetActor(db);
      const result = {};
      for (const [key, table] of Object.entries({ runs: 'marketplace_sec.phase9_automatic_provider_runs',
        lookups: 'public.phase9_metadata_lookups', reservations: 'public.phase9_usage_reservations',
        calls: 'public.phase9_metadata_provider_calls' })) {
        result[key] = await value(db, `SELECT count(*)::int FROM ${table} WHERE job_id=$1`, [jobId]);
      }
      result.attempts = await value(db, 'SELECT count(*)::int FROM public.metadata_enrichment_attempts WHERE candidate_id=$1', [card.candidateId]);
      return result;
    } };
}
