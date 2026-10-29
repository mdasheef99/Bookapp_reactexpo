// 02b sections 5/7.1/8/10/11: queued AC7-8/10/13/17 gaps, in-process SQL only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { cacheRequest, catalogueBatch, completeCatalogueV2, createLeanDatabase,
  reuseCatalogueCache, scanCacheCard } from './leanCatalogueFixture.mjs';
import { enableOL, facts, resetActor, seedIncumbent, setActor } from './catalogueLinkFixture.mjs';
import { complete, completionServiceClient, recover, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';
import { claimJob, seedAutomaticLineage, seedCard, scalar } from './editionPickerFixture.mjs';
import { completionFootprint } from './leanCatalogueCompletionFixture.mjs';

let db;
before(async () => { db = await createLeanDatabase({ m88: true }); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,public.phase9_metadata_cache_entries CASCADE');
  await enableOL(db);
  await db.exec("UPDATE public.phase9_provider_registry SET matching_allowed=true,storage_allowed=true WHERE adapter_key='open_library'");
});
after(async () => { await db?.close(); });
const batch = async () => catalogueBatch(db, {}, null, { existing: await scanCacheCard(db) });
async function effect(f) {
  await resetActor(db);
  return (await db.query('SELECT * FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1', [f.lookupId])).rows[0];
}
async function entry(id) {
  await resetActor(db);
  return (await db.query('SELECT c.*,to_jsonb(c)::text AS bytes FROM public.phase9_metadata_cache_entries c WHERE id=$1', [id])).rows[0];
}
async function publish(f) {
  assert.equal((await completeCatalogueV2(db, f)).status, 'completed');
  const receipt = await effect(f);
  assert.ok(receipt.cache_entry_id);
  return entry(receipt.cache_entry_id);
}

test('AC7-17: an old-worker v1 NULL-companion completion succeeds on M88 without publishing the new kind', async () => {
  const f = await batch();
  assert.equal((await complete(db, f, { rows: f.rows, fetched: f.fetched, deadline: f.deadline })).status, 'completed');
  const receipt = await effect(f);
  assert.equal(receipt.cache_entry_id, null);
  assert.equal(receipt.cache_payload_digest, null);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.phase9_metadata_cache_entries')).rows[0].n, 0);
  const state = (await db.query('SELECT options FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
  assert.deepEqual(state.options, f.rows);
});

test('AC7-8: new functions deny PUBLIC and expose service EXECUTE only on the intended entry points', async () => {
  const privateNames = ['phase9_catalogue_valid_companion_v1', 'phase9_catalogue_companion_for_choice_v1',
    'phase9_catalogue_count_search_v1', 'phase9_catalogue_lock_owner_scope_v1', 'phase9_catalogue_plan_keys_v1',
    'phase9_catalogue_valid_cache_v1', 'phase9_catalogue_cache_receipt_guard',
    'phase9_catalogue_query_scope_v1', 'phase9_catalogue_store_cache_v1', 'phase9_catalogue_reuse_cache_core_v1'];
  const serviceNames = ['phase9_complete_candidate_edition_options_v2', 'phase9_reuse_candidate_edition_cache_v1'];
  const functions = (await db.query(`SELECT p.oid,p.proname,n.nspname,p.prosecdef,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='marketplace_sec' AND p.proname=ANY($1::text[]))
      OR (n.nspname IN('public','marketplace_sec') AND p.proname=ANY($2::text[]))`, [privateNames, serviceNames])).rows;
  assert.equal(functions.length, privateNames.length + 2 * serviceNames.length);
  for (const f of functions) {
    assert.equal(f.public_execute, false, `${f.nspname}.${f.proname}: PUBLIC`);
    const isEntry = serviceNames.includes(f.proname);
    if (isEntry) assert.equal(f.prosecdef, f.nspname === 'marketplace_sec');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const allowed = (await db.query("SELECT has_function_privilege($1,$2::oid,'EXECUTE') AS allowed", [role, f.oid])).rows[0].allowed;
      assert.equal(allowed, isEntry && role === 'service_role', `${role}: ${f.nspname}.${f.proname}`);
    }
  }
  for (const table of ['phase9_catalogue_companions', 'phase9_catalogue_lookup_effects']) {
    const acl = (await db.query(`SELECT EXISTS(SELECT 1 FROM pg_class c,
      LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=('marketplace_sec.'||$1)::regclass AND a.grantee=0) AS public_grant`, [table])).rows[0];
    assert.equal(acl.public_grant, false, table);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await db.query("SELECT has_table_privilege($1,'marketplace_sec.'||$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed", [role, table])).rows[0].allowed, false);
    }
  }
});

test('AC7-13/24: a live incumbent with a different valid digest wins and binds the second receipt', async () => {
  const a = await batch(), incumbent = await publish(a), b = await batch();
  b.rows[0].metadata.subtitle = 'A different valid provider subtitle';
  const proposal = structuredClone(incumbent.bibliographic_payload);
  proposal.sourceFetchedAt = b.fetched;
  for (const row of proposal.rows) if (row.metadata) {
    row.metadata = { ...b.rows[row.ordinal].metadata };
    for (const key of ['correlationId', 'attemptId', 'matchRationale', 'confidence']) delete row.metadata[key];
  }
  await resetActor(db);
  const proposed = (await db.query(`SELECT marketplace_sec.phase9_catalogue_valid_cache_v1($1) AS valid,
    encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS digest`, [proposal])).rows[0];
  assert.equal(proposed.valid, true);
  assert.notEqual(proposed.digest, incumbent.payload_digest);
  assert.equal((await completeCatalogueV2(db, b)).status, 'completed');
  const receipt = await effect(b);
  assert.equal(receipt.cache_entry_id, incumbent.id);
  assert.equal(receipt.cache_payload_digest, incumbent.payload_digest);
  assert.notEqual(receipt.cache_payload_digest, proposed.digest);
  assert.equal((await entry(incumbent.id)).bytes, incumbent.bytes);
  assert.equal((await db.query('SELECT options->0->\'metadata\'->>\'subtitle\' AS subtitle FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [b.candidateId])).rows[0].subtitle, b.rows[0].metadata.subtitle);
});

for (const flag of ['storage_allowed', 'matching_allowed']) {
  test(`AC7-10: ${flag}=false refuses publication without partial completion effects`, async () => {
    const f = await batch();
    await resetActor(db);
    await db.exec(`UPDATE public.phase9_provider_registry SET ${flag}=false WHERE adapter_key='open_library'`);
    const before = await completionFootprint(db);
    await assert.rejects(() => completeCatalogueV2(db, f), e => e.code === 'P0001' && /^P9_/.test(e.message));
    assert.equal(await completionFootprint(db), before);
  });
  test(`AC7-10: ${flag}=false makes cache reuse miss without partial effects`, async () => {
    await publish(await batch());
    const receiver = await cacheRequest(db, await scanCacheCard(db));
    await resetActor(db);
    await db.exec(`UPDATE public.phase9_provider_registry SET ${flag}=false WHERE adapter_key='open_library'`);
    const before = await completionFootprint(db);
    assert.deepEqual(await reuseCatalogueCache(db, receiver), { status: 'miss' });
    assert.equal(await completionFootprint(db), before);
  });
}

// 02b section 3.1: one independently specified corpus is exercised by SQL and TS.
const timestampCases = JSON.parse(fs.readFileSync(new URL('./catalogueTimestampCases.json', import.meta.url), 'utf8'));
for (const c of timestampCases) test(`fetchedAt SQL parity: ${c.label}`, async () => {
  const optionId = '10000000-0000-4000-8000-000000000001';
  const m = facts({ correlationId: '10000000-0000-4000-8000-000000000002',
    attemptId: '10000000-0000-4000-8000-000000000003', fetchedAt: c.source });
  const companion = { version: 'psr-catalogue-write-v1', optionId,
    adapterKey: m.adapterKey, adapterVersion: m.adapterVersion, normalizerVersion: m.normalizerVersion,
    lookupId: m.correlationId, attemptId: m.attemptId, providerRecordId: m.providerRecordId, fetchedAt: c.companion };
  const valid = (await db.query('SELECT marketplace_sec.phase9_catalogue_valid_companion_v1($1,$2,$3) AS valid', [companion, m, optionId])).rows[0].valid;
  assert.equal(valid, c.sql);
});

// 02b sections 5/7.2/10: characterize durable local receipts at the real edition recovery boundary.
test('completed automatic local match remains behind the edition recovery fence; worker handles stale status without egress', async () => {
  const m = facts(), target = await seedIncumbent(db, m);
  const card = await seedCard(db, { isbn:m.isbn13, review:{ originalTitle:m.title, authors:m.authors,
    originalLanguage:m.language, script:m.script, originalFieldConfirmation:{ title:true, authors:m.authors.map(() => true) } } });
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET observed_title=$1,observed_authors=$2 WHERE id=$3',
    [m.title,m.authors,card.candidateId]);
  const { jobId } = await seedAutomaticLineage(db, card);
  const rawContext = await scalar(db, await claimJob(db, card, jobId));
  const f = { ...card, jobId, attempt:1, context:{ ...rawContext, requestGeneration:0 } };
  await setActor(db, f.ownerId, 'service_role');
  const completed = await rpc(db, 'phase9_complete_structural_local_metadata_match', [
    f.jobId, worker, token, f.attempt, f.candidateId, f.context.candidateVersion, f.context.queryIdentity,
    'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', 'p9-metadata-v1', target.editionId, 'p9-selected-v1', 'p9-metadata-selection-v1', ['validated_isbn'],
  ]);
  const recovered = await recover(db, f);
  assert.ok(completed.lookup_id); assert.ok(completed.snapshot_id);
  assert.equal(completed.creates_provider_charge, false);
  await resetActor(db);
  const local = (await db.query('SELECT l.execution_mode,e.completion_response FROM public.phase9_metadata_lookups l JOIN marketplace_sec.phase9_catalogue_lookup_effects e ON e.lookup_id=l.id WHERE l.id=$1', [completed.lookup_id])).rows[0];
  assert.equal(local.execution_mode, 'local');
  assert.deepEqual(local.completion_response, completed);
  assert.deepEqual(recovered, { status:'stale_rejected' });
  const { createMetadataEditionOptionsBoundary } = await import('../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataEditionOptionsRpc.js');
  const { executeEditionOptionsLookup } = await import('../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataEditionOptions.js');
  const { decodeMetadataJobContext } = await import('../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataJobContext.js');
  const { requestFromMetadataContext } = await import('../../../.phase9-dist/supabase/functions/_shared/imageInventory/runtime/metadataGatewayContext.js');
  // Exercise the edition worker's handling of the actual SQL status; the stored job remains automatic.
  const decoded = decodeMetadataJobContext(rawContext);
  const context = { ...decoded, purpose:'edition_options', requestGeneration:0 };
  const request = { ...requestFromMetadataContext(decoded), claimWorker:worker };
  const failures = [], service = completionServiceClient(db);
  const client = { rpc: async (name, params) => {
    if (name === 'phase9_fail_candidate_edition_options_v1') failures.push(params);
    return service.rpc(name, params);
  } };
  const boundary = createMetadataEditionOptionsBoundary(client);
  const before = await completionFootprint(db);
  await setActor(db, f.ownerId, 'service_role');
  const result = await executeEditionOptionsLookup(context, { editionOptions: { request, boundary,
    cacheVersions() { assert.fail('local receipt must not enter reuse'); } } },
    { lookupEditionOptions() { assert.fail('local receipt must never authorize HTTP'); } }, new AbortController().signal);
  assert.deepEqual(result, { outcome:'stale_claim' });
  assert.deepEqual(failures, []);
  assert.equal(await completionFootprint(db), before);
});
