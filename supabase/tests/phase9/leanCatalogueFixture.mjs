// 02b §§4–6/9/12/14; additive 02a §7.1 alignment, disposable databases ONLY.
// No HTTP, production admission widening, or later-slice object installation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createCatalogueDatabase, facts, olOperation, readSql, rpc, saveReview, selectSql } from './catalogueLinkFixture.mjs';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import { row } from './editionPickerFixture.mjs';
import { complete, token, worker } from './editionOptionsCompletionFixture.mjs';

export const m83Pattern = /^\d{8}000083_marketplace_phase9_lean_catalogue_identity\.sql$/;
export const operatorId = '70000000-0000-4000-8000-000000000001';
export const providerOnlyFacts = (overrides = {}) => facts({ isbn10: null, isbn13: null, ...overrides });
export const isbnFacts = (overrides = {}) => facts(overrides);

// 02b §§7.2/12 AC7-17: the unchanged worker v1 completion with exact own book URL.
// The existing catalogue helper uses OL100M literally; this wrapper also permits
// distinct synthetic records without changing its fixture or completion code.
export async function olCardWithRecord(db, overrides = {}) {
  const f = await olOperation(db, overrides);
  for (const [sequence, stage] of [[0, 'search'], [1, 'editions'], [2, 'author:OL1A']]) {
    const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1',
      [f.attemptId, f.jobId, worker, token, 1, randomUUID(), sequence, stage]);
    await rpc(db, 'phase9_finalize_edition_options_provider_call_v1',
      [call.provider_call_id, f.jobId, worker, token, 1, 'finalized', 'no_acceptable_match', false, true]);
  }
  const option = row(0, { googleBooksUrl: 'https://openlibrary.org/books/' + f.facts.providerRecordId, metadata: f.facts });
  assert.equal((await complete(db, f, { rows: [option], fetched: f.facts.fetchedAt,
    deadline: new Date(Date.parse(f.facts.fetchedAt) + 3600000).toISOString() })).status, 'completed');
  await setActor(db, f.ownerId);
  f.selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), option.optionId));
  await saveReview(db, f);
  return f;
}

// preflight-1.md §2: exact live source FK/policy names and broad existing grants.
// The baseline has no books table: source_book_id is aligned as a nullable column;
// no test asserts its unrelated legacy-books FK. UUID defaults remain absent.
// The platform-role tables are also absent: this bounded auth.uid() stub models
// the operator/non-operator predicate, never a production authorization change.
// Live is_platform_operator reads public.platform_user_roles for auth.uid() and status='active'.
export const leanAlignmentSql = `
ALTER POLICY catalogue_link_public_works ON public.canonical_works RENAME TO "canonical works readable";
ALTER POLICY catalogue_link_public_editions ON public.canonical_editions RENAME TO "canonical editions readable";
ALTER TABLE public.book_metadata_sources
 DROP CONSTRAINT book_metadata_sources_canonical_edition_id_fkey,
 ADD CONSTRAINT book_metadata_sources_canonical_edition_id_fkey FOREIGN KEY(canonical_edition_id)
   REFERENCES public.canonical_editions(id) ON DELETE SET NULL,
 ADD COLUMN source_book_id uuid,
 ADD COLUMN fetched_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ALTER COLUMN provider_book_id DROP NOT NULL,
 ALTER COLUMN raw_payload SET DEFAULT '{}'::jsonb,
 ALTER COLUMN raw_payload SET NOT NULL,
 ALTER COLUMN normalized_payload SET DEFAULT '{}'::jsonb,
 ALTER COLUMN normalized_payload SET NOT NULL,
 ALTER COLUMN confidence TYPE numeric(5,4);
CREATE OR REPLACE FUNCTION marketplace_sec.is_platform_operator() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid()='${operatorId}'::uuid $$;
ALTER FUNCTION marketplace_sec.is_platform_operator() OWNER TO postgres;
REVOKE ALL ON FUNCTION marketplace_sec.is_platform_operator() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION marketplace_sec.is_platform_operator() TO authenticated,service_role;
GRANT USAGE ON SCHEMA marketplace_sec TO anon,authenticated,service_role;
ALTER TABLE public.book_metadata_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metadata sources platform write" ON public.book_metadata_sources
 FOR ALL TO authenticated USING(marketplace_sec.is_platform_operator())
 WITH CHECK(marketplace_sec.is_platform_operator());
GRANT ALL ON public.book_metadata_sources TO anon,authenticated,service_role;
GRANT ALL ON public.canonical_works,public.canonical_editions TO service_role;
`;

export function leanMigrationFiles() {
  const names = fs.readdirSync(migrationPath('')).filter(name => m83Pattern.test(name));
  assert.ok(names.length <= 1, 'at most one approved M83 migration');
  return names;
}
export async function createLeanDatabase({ beforeM83 = null } = {}) {
  const db = await createCatalogueDatabase(); // Includes M81 and M82, in order.
  try {
    await resetActor(db);
    await db.exec(leanAlignmentSql);
    if (beforeM83) await beforeM83(db); // Upgrade fixtures run real M81 commands.
    for (const name of leanMigrationFiles()) await db.exec(fs.readFileSync(migrationPath(name), 'utf8'));
    return db; // Missing M83 deliberately leaves the real pre-feature baseline.
  } catch (error) { await db.close(); throw error; }
}
export async function requireLean(db,
  object = 'marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb)', message = null) {
  await resetActor(db);
  const probe = object.includes('(') ? 'to_regprocedure' : 'to_regclass';
  const found = (await db.query(`SELECT pg_catalog.${probe}($1) IS NOT NULL AS present`, [object])).rows[0].present;
  assert.equal(found, true, message ?? `M83 feature must exist: ${object}`);
}
export async function asRole(db, role, actor, action) {
  assert.ok(['anon', 'authenticated', 'service_role', 'postgres'].includes(role));
  await setActor(db, actor ?? '', role);
  try { return await action(); } finally { await resetActor(db); }
}
export async function blockIsbn(db, isbn13, reason = 'Synthetic operator blocklist fixture') {
  await requireLean(db, 'marketplace_sec.phase9_catalogue_isbn_blocklist');
  await db.query(`INSERT INTO marketplace_sec.phase9_catalogue_isbn_blocklist(isbn13,list_version,reason)
    VALUES($1,'fixture-list-v1',$2)`, [isbn13, reason]);
}
export async function hideEdition(db, id) {
  await requireLean(db);
  await db.query('UPDATE public.canonical_editions SET hidden=true WHERE id=$1', [id]);
}

const genericSignatures = [
  'marketplace_sec.phase9_catalogue_resolve_v1(jsonb,jsonb,jsonb)',
  'marketplace_sec.phase9_catalogue_increment_v1(uuid,uuid,integer,integer,integer)',
  'marketplace_sec.phase9_catalogue_count_choice_v1(uuid,uuid,text,uuid,uuid)',
  'marketplace_sec.phase9_catalogue_identity_lock_key_v1(text,jsonb)',
  'marketplace_sec.phase9_catalogue_isbn_v1(text,text)',
  'marketplace_sec.phase9_catalogue_link_for_add_v1(uuid,uuid,uuid)',
  'marketplace_sec.phase9_catalogue_shared_admitted_v1(text)',
  'marketplace_sec.phase9_catalogue_source_policy_v1(text)',
  'public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)',
];
export async function genericFunctionHashes(db) {
  await resetActor(db);
  return (await db.query(`SELECT p.oid::regprocedure::text AS signature,md5(p.prosrc) AS md5
    FROM pg_proc p WHERE p.oid=ANY(ARRAY(SELECT to_regprocedure(s) FROM unnest($1::text[]) s))
    ORDER BY 1`, [genericSignatures])).rows;
}

const syntheticDefinitions = new WeakMap();
const syntheticFixture = () => ({ adapterKey: 'synthetic_catalogue', note: 'Synthetic catalogue; reusable normalized facts.',
  facts: providerOnlyFacts({ adapterKey: 'synthetic_catalogue', providerRecordId: 'edition-1',
    coverReference: 'https://catalogue.example.test/covers/1.jpg' }) });
export async function installSyntheticProvider(db) {
  await requireLean(db);
  if (syntheticDefinitions.has(db)) return syntheticFixture();
  const before = await genericFunctionHashes(db);
  assert.equal(before.length, genericSignatures.length, 'all generic functions must exist before synthetic-provider proof');
  await db.query(`INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,
    enabled,matching_allowed,storage_allowed,public_display_allowed,raw_retention_seconds,
    revalidation_seconds,policy_version,shared_source_note)
    VALUES('synthetic_catalogue','metadata','1.0.0',true,true,true,true,17,3600,1,$1)`,
  ['Synthetic catalogue; reusable normalized facts.']);
  // Preserve the real validator as a test-only delegate. Only this validator
  // gets a synthetic branch; every generic body and production admission stays.
  const definition = await scalar(db, `SELECT pg_get_functiondef(to_regprocedure(
    'marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)'))`);
  await db.exec(definition.replace(/FUNCTION marketplace_sec\.phase9_catalogue_provider_ids_valid_v1\(/,
    'FUNCTION marketplace_sec.phase9_test_original_provider_ids_valid_v1('));
  await db.exec(`REVOKE ALL ON FUNCTION marketplace_sec.phase9_test_original_provider_ids_valid_v1(text,text,text,text,text,jsonb)
    FROM PUBLIC,anon,authenticated,service_role;
    CREATE OR REPLACE FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(
      p_adapter_key text,p_record_id text,p_work_id text,p_book_url text,p_cover_url text,p_completion jsonb)
    RETURNS TABLE(valid boolean,cover_ref text,logical_outcome text)
    LANGUAGE sql IMMUTABLE SET search_path='' AS $$
    SELECT coalesce(p_completion IS NULL AND char_length(p_record_id) BETWEEN 1 AND 256
      AND p_record_id ~ '^[A-Za-z0-9-]+$'
      AND (p_work_id IS NULL OR (char_length(p_work_id) BETWEEN 1 AND 256 AND p_work_id ~ '^[A-Za-z0-9-]+$'))
      AND (p_book_url IS NULL OR p_book_url='https://catalogue.example.test/books/'||p_record_id)
      AND (p_cover_url IS NULL OR p_cover_url ~ '^https://catalogue[.]example[.]test/covers/[0-9]+[.]jpg$'),false),
      CASE WHEN p_cover_url IS NOT NULL THEN substring(p_cover_url FROM '/covers/([0-9]+)[.]jpg$') END,
      NULL::text WHERE p_adapter_key='synthetic_catalogue'
    UNION ALL SELECT * FROM marketplace_sec.phase9_test_original_provider_ids_valid_v1(
      p_adapter_key,p_record_id,p_work_id,p_book_url,p_cover_url,p_completion)
      WHERE p_adapter_key IS DISTINCT FROM 'synthetic_catalogue' $$;
    ALTER FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) OWNER TO postgres;
    REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)
      FROM PUBLIC,anon,authenticated,service_role;`);
  assert.deepEqual(await genericFunctionHashes(db), before,
    'synthetic provider must change zero generic resolver/counter/lock/ISBN/Add/admission bodies');
  syntheticDefinitions.set(db, definition);
  return syntheticFixture();
}

// Call after each test's TRUNCATE: restore production dispatch and remove the
// disposable registry row so note/version/retention mutations cannot leak.
export async function resetSyntheticProvider(db) {
  const definition = syntheticDefinitions.get(db);
  if (!definition) return;
  await resetActor(db);
  await db.exec(definition);
  await db.exec(`ALTER FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb) OWNER TO postgres;
    REVOKE ALL ON FUNCTION marketplace_sec.phase9_catalogue_provider_ids_valid_v1(text,text,text,text,text,jsonb)
      FROM PUBLIC,anon,authenticated,service_role;
    DROP FUNCTION marketplace_sec.phase9_test_original_provider_ids_valid_v1(text,text,text,text,text,jsonb);
    DELETE FROM public.phase9_provider_registry WHERE adapter_key='synthetic_catalogue';`);
  syntheticDefinitions.delete(db);
}

export async function sourcePolicy(db, metadata) {
  // 02b §5/§14 decision 9: direct postgres fixture ONLY, below production
  // admission. Synthetic-provider proof never modifies the production allow-list.
  await resetActor(db);
  const registry = (await db.query(`SELECT adapter_key,adapter_version,policy_version,
    raw_retention_seconds,revalidation_seconds,shared_source_note
    FROM public.phase9_provider_registry WHERE adapter_key=$1`, [metadata.adapterKey])).rows[0];
  assert.ok(registry, 'direct policy fixture requires a registered provider');
  assert.equal(typeof registry.shared_source_note, 'string', 'admitted fixture requires a registry source note');
  return { version: 'psr-catalogue-source-policy-v1', adapterKey: registry.adapter_key,
    adapterVersion: registry.adapter_version, policyVersion: registry.policy_version,
    rawRetentionSeconds: registry.raw_retention_seconds, revalidationSeconds: registry.revalidation_seconds,
    sharedSourceNote: registry.shared_source_note, sharedAdmitted: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
    && process.argv[2] === '--native-lean-setup-sql') process.stdout.write(leanAlignmentSql);
