// 02b sections 3/5/7.1/9/11: M84 completion, accounting and replay on PGlite.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { applyM84IfPresent, catalogueBatch, completeCatalogueV2, createLeanDatabase, requireM84 } from './leanCatalogueFixture.mjs';
import { add, bytes, catalogueBytes, enableOL, facts, resetActor, saveReview, scalar, seedIncumbent, setActor } from './catalogueLinkFixture.mjs';
import { complete, fence, finalize, prepareCall, recover, resultRows, rpc, seedOperation } from './editionOptionsCompletionFixture.mjs';
import { completionFootprint, originalChoiceAfterCleanup, v1IncumbentCompletion } from './leanCatalogueCompletionFixture.mjs';
import { seedCard } from './editionPickerFixture.mjs';

const v2 = 'public.phase9_complete_candidate_edition_options_v2(uuid,text,text,integer,uuid,uuid,uuid,uuid,integer,text,uuid,uuid,timestamptz,timestamptz,boolean,jsonb,jsonb)';
const effects = 'marketplace_sec.phase9_catalogue_lookup_effects';
const companions = 'marketplace_sec.phase9_catalogue_companions';
let db;
before(async () => { db = await createLeanDatabase({ m84: true }); });
beforeEach(async () => {
  await resetActor(db); await db.exec('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,marketplace_sec.phase9_catalogue_isbn_blocklist CASCADE');
  await enableOL(db);
});
after(async () => { await db?.close(); });

async function totals(database = db) {
  await resetActor(database);
  return (await database.query(`SELECT (SELECT count(*)::int FROM public.canonical_works) AS works,
    (SELECT count(*)::int FROM public.canonical_editions) AS editions,
    (SELECT count(*)::int FROM public.canonical_provider_ids) AS ids,
    (SELECT count(*)::int FROM public.book_metadata_sources) AS sources,
    (SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats) AS chosen,
    (SELECT coalesce(sum(times_added),0)::int FROM public.canonical_edition_stats) AS added,
    (SELECT coalesce(sum(times_searched),0)::int FROM public.canonical_work_stats) AS searched`)).rows[0];
}
async function persisted(f, database = db) {
  await resetActor(database);
  const state = (await database.query('SELECT options,options_version FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
  const calls = (await database.query(`SELECT edition_call_sequence,edition_call_stage,status,edition_egress_started,retryable
    FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=$1 ORDER BY edition_call_sequence`, [f.attemptId])).rows;
  const reservation = (await database.query(`SELECT u.status,u.reserved_cost_units,u.actual_cost_units
    FROM public.phase9_usage_reservations u JOIN public.metadata_enrichment_attempts a ON a.usage_reservation_id=u.id
    WHERE a.id=$1`, [f.attemptId])).rows[0];
  return { state, calls, reservation };
}
async function receipt(f, database = db) {
  await resetActor(database);
  return (await database.query(`SELECT completion_digest,completion_response,canonical_results,search_counted,searched_work_id
    FROM marketplace_sec.phase9_catalogue_lookup_effects WHERE lookup_id=$1`, [f.lookupId])).rows[0];
}
async function rejected(promise, allowed = []) {
  // 02b defines refusal, not a new companion-specific error code. A SQL error
  // must carry a SQLSTATE; an alternate response must not claim completion.
  // 42501 (permission denied) is the correct service-only refusal for the two
  // outer-actor cases, whose callers pass it explicitly; every other test keeps
  // the 42-class guard so fixture bugs still fail loudly.
  let result, failure;
  try { result = await promise; } catch (error) { failure = error; }
  if (failure) {
    assert.match(failure.code ?? '', /^[0-9A-Z]{5}$/, 'refusal must be a database error, not fixture failure');
    if (!allowed.includes(failure.code))
      assert.notEqual(failure.code.slice(0,2),'42','syntax or undefined-object errors are not feature refusals');
  }
  else {
    assert.ok(result && typeof result.status === 'string', 'refusal must be a structured response');
    assert.notEqual(result.status, 'completed'); assert.notEqual(result.status, 'replayed');
  }
}

test('[baseline] six-row fixture is valid, has four eligible options and completes through v1', async () => {
  const f = await catalogueBatch(db); await resetActor(db);
  assert.equal(new Set(f.catalogueCompanions.map(c => c.oclc)).size,5);
  assert.equal(new Set(f.catalogueCompanions.map(c => c.lccn)).size,5);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_valid_rows($1) AS valid', [f.rows])).rows[0].valid, true);
  const eligibility = (await db.query(`SELECT (x->>'ordinal')::int AS ordinal,
    marketplace_sec.phase9_edition_option_eligible(x->'metadata',$1) AS eligible
    FROM jsonb_array_elements($2::jsonb) x WHERE x->'metadata'<>'null'::jsonb ORDER BY 1`,
  [f.context.queryIdentity,f.rows])).rows;
  assert.deepEqual(eligibility.map(r => r.eligible), [true,true,true,true,false]);
  await setActor(db, f.ownerId, 'service_role');
  assert.equal((await complete(db, f, { rows:f.rows, fetched:f.fetched, deadline:f.deadline })).status, 'completed');
  const actual = await persisted(f);
  assert.deepEqual(actual.state.options, f.rows); assert.equal(actual.state.options_version, 1);
  assert.equal(actual.calls.length, 3); assert.equal(actual.reservation.status, 'consumed');
});

test('AC7-1/2e/2f: v2 stores all six options and four admitted edition sources', async () => {
  await requireM84(db, v2); const f = await catalogueBatch(db);
  const result = await completeCatalogueV2(db, f), saved = await persisted(f);
  assert.equal(result.status, 'completed'); assert.equal(result.optionsVersion, 1);
  assert.deepEqual(saved.state, { options: f.rows, options_version: 1 });
  assert.equal(saved.calls.length, 3);
  assert.ok(saved.calls.every(c => c.status === 'finalized' && c.edition_egress_started && !c.retryable));
  assert.equal(saved.reservation.status, 'consumed'); assert.equal(Number(saved.reservation.actual_cost_units), 0);
  const t = await totals(); assert.equal(t.editions, 4); assert.equal(t.sources, 4);
  assert.equal(t.works, 1, 'the four equal work keys resolve to one shared work');
  assert.deepEqual([t.chosen,t.added], [0,0]);
  await requireM84(db, companions);
  const stored = (await db.query(`SELECT provider_record_id,companion FROM marketplace_sec.phase9_catalogue_companions
    WHERE lookup_id=$1 ORDER BY provider_record_id`, [f.lookupId])).rows;
  assert.equal(stored.length, 5, 'available options retain their own companions');
  for (const expected of f.catalogueCompanions) {
    const actual = stored.find(c => c.provider_record_id === expected.providerRecordId);
    assert.deepEqual(actual?.companion,expected);
  }
  const editions = (await db.query(`SELECT s.provider_book_id,e.oclc,e.lccn,
    s.normalized_payload->>'oclc' AS source_oclc,s.normalized_payload->>'lccn' AS source_lccn
    FROM public.book_metadata_sources s JOIN public.canonical_editions e ON e.id=s.canonical_edition_id
    ORDER BY s.provider_book_id`)).rows;
  assert.deepEqual(editions,f.catalogueCompanions.slice(0,4).map(c => ({
    provider_book_id:c.providerRecordId,oclc:c.oclc,lccn:c.lccn,source_oclc:c.oclc,source_lccn:c.lccn })));
  assert.ok(await receipt(f));
});

test('AC7-1/2e: four qualifying distinct work groups create four works, editions and sources', async () => {
  await requireM84(db,v2); const f = await catalogueBatch(db,{},['B. Author']);
  for (const [ordinal,name] of ['A. Author','C. Author','D. Author','E. Author'].entries()) {
    f.rows[ordinal].metadata.authors = ['B. Author',name];
    f.catalogueCompanions.find(c => c.optionId === f.rows[ordinal].optionId).workExternalId = `OL${700+ordinal}W`;
  }
  await resetActor(db);
  const checks = (await db.query(`SELECT marketplace_sec.phase9_edition_option_eligible(x->'metadata',$1) AS ok
    FROM jsonb_array_elements($2::jsonb) x WHERE (x->>'ordinal')::int<4 ORDER BY (x->>'ordinal')::int`,
  [f.context.queryIdentity,f.rows])).rows;
  assert.deepEqual(checks.map(row => row.ok),[true,true,true,true]);
  assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  assert.deepEqual((await persisted(f)).state.options,f.rows);
  const t = await totals(); assert.deepEqual([t.works,t.editions,t.sources],[4,4,4]);
  assert.deepEqual([t.searched,t.chosen,t.added],[0,0,0]);
});

test('AC7-2e: one real provider-ID conflict skips only that edition, preserving options and accounting', async () => {
  await requireM84(db, v2); const f = await catalogueBatch(db);
  const other = await seedIncumbent(db, facts({ title:'Existing competing work', isbn10:null, isbn13:null }));
  await db.query(`INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id)
    VALUES('open_library','edition','OL101M',$1)`, [other.editionId]);
  const before = await totals(), result = await completeCatalogueV2(db, f), saved = await persisted(f), after = await totals();
  assert.equal(result.status, 'completed'); assert.deepEqual(saved.state.options, f.rows);
  assert.equal(saved.state.options_version, 1); assert.equal(saved.calls.length, 3);
  assert.equal(saved.reservation.status, 'consumed'); assert.equal(Number(saved.reservation.actual_cost_units), 0);
  assert.equal(after.editions - before.editions, 3); assert.equal(after.sources - before.sources, 3);
  assert.equal((await db.query("SELECT canonical_edition_id FROM public.canonical_provider_ids WHERE adapter_key='open_library' AND id_kind='edition' AND external_id='OL101M'")).rows[0].canonical_edition_id, other.editionId);
});

test('AC7-13: v2 replay and lost-response recovery preserve the original digest and spend', async () => {
  await requireM84(db, v2); await requireM84(db, effects);
  const f = await catalogueBatch(db), first = await completeCatalogueV2(db, f), original = await receipt(f);
  const before = [await totals(), await persisted(f), original, await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')];
  assert.match(original.completion_digest, /^[0-9a-f]{64}$/);
  const replay = await completeCatalogueV2(db, f);
  await setActor(db, f.ownerId, 'service_role'); const recovered = await recover(db, f);
  assert.equal(replay.status, 'replayed'); assert.equal(recovered.status, 'replayed');
  assert.equal(replay.optionsVersion, first.optionsVersion); assert.equal(recovered.optionsVersion, first.optionsVersion);
  assert.deepEqual([await totals(), await persisted(f), await receipt(f), await bytes(db, 'canonical_provider_ids'), await bytes(db, 'book_metadata_sources')], before);
});

test('AC7-13: companion-inclusive replay refuses a different valid companion without another write', async () => {
  await requireM84(db, v2); await requireM84(db, effects);
  const f = await catalogueBatch(db); await completeCatalogueV2(db, f);
  const before = [await totals(), await persisted(f), await receipt(f)];
  const changed = f.catalogueCompanions.map((c,i) => i === 0 ? { ...c, oclc:'99999' } : c);
  // 02b Ãƒâ€šÃ‚Â§7.1 preserves M78's P9_IDEMPOTENCY_MISMATCH replay refusal.
  await assert.rejects(() => completeCatalogueV2(db, f, { catalogueCompanions: changed }), /P9_IDEMPOTENCY_MISMATCH/);
  assert.deepEqual([await totals(), await persisted(f), await receipt(f)], before);
});

test('AC7-13: durable recovery survives cleanup of temporary option pointers', async () => {
  await requireM84(db,v2); await requireM84(db,effects);
  const f = await catalogueBatch(db), first = await completeCatalogueV2(db,f), saved = await receipt(f);
  await resetActor(db);
  // Model the existing option cleanup; the request and durable lookup remain.
  await db.query(`UPDATE public.phase9_candidate_edition_state SET options='[]'::jsonb,source_lookup_id=NULL,
    source_attempt_id=NULL,source_fetched_at=NULL,options_expires_at=NULL WHERE candidate_id=$1`,[f.candidateId]);
  const before = [await totals(),await persisted(f),await receipt(f)];
  await setActor(db,f.ownerId,'service_role'); const recovered = await recover(db,f);
  assert.equal(recovered.status,'replayed'); assert.equal(recovered.optionsVersion,first.optionsVersion);
  assert.deepEqual(await receipt(f),saved);
  assert.deepEqual([await totals(),await persisted(f),await receipt(f)],before);
  assert.deepEqual((await persisted(f)).state.options,[]);
});

test('AC7-2d/13: omitted nullable companion fields normalize before storage and replay digest', async () => {
  await requireM84(db,v2); await requireM84(db,companions); await requireM84(db,effects);
  const f = await catalogueBatch(db), absent = structuredClone(f.catalogueCompanions);
  delete absent[0].workExternalId; delete absent[0].oclc; delete absent[0].lccn;
  assert.equal((await completeCatalogueV2(db,f,{catalogueCompanions:absent})).status,'completed');
  await resetActor(db);
  const stored = (await db.query(`SELECT companion FROM marketplace_sec.phase9_catalogue_companions
    WHERE lookup_id=$1 AND option_id=$2`,[f.lookupId,f.rows[0].optionId])).rows[0].companion;
  assert.equal(stored.workExternalId,null); assert.equal(stored.oclc,null); assert.equal(stored.lccn,null);
  const before = await receipt(f), explicit = structuredClone(absent);
  Object.assign(explicit[0],{workExternalId:null,oclc:null,lccn:null});
  assert.equal((await completeCatalogueV2(db,f,{catalogueCompanions:explicit})).status,'replayed');
  assert.deepEqual(await receipt(f),before);
});

for (const variant of ['duplicate option binding','forged scope','edition ID supplied as work ID']) test(`AC7-2d: v2 rejects ${variant} before shared effects`, async () => {
  await requireM84(db, v2); const f = await catalogueBatch(db), before = [await totals(), await persisted(f)];
  const altered = variant === 'duplicate option binding'
    ? [...f.catalogueCompanions, f.catalogueCompanions[0]]
    : f.catalogueCompanions.map((c,i) => i !== 0 ? c : variant === 'forged scope'
      ? { ...c, lookupId:randomUUID() } : { ...c, workExternalId:'OL100M' });
  await rejected(completeCatalogueV2(db, f, { catalogueCompanions: altered }));
  assert.deepEqual([await totals(), await persisted(f)], before);
});

// 02b section 9: change exactly one outer scope/claim input at a time.
for (const [label,index,replacement] of [
  ['store',5,(_f,other) => other.storeId],['job',0,(_f,other) => other.jobId],
  ['candidate',4,(_f,other) => other.candidateId],['session',6,(_f,other) => other.sessionId],
  ['request',7,(_f,other) => other.jobId],['lookup ownership',10,(_f,other) => other.lookupId],
  ['attempt ownership',11,(_f,other) => other.attemptId],['worker',1,() => 'foreign-worker'],
  ['claim token',2,() => 'b'.repeat(64)],['claim attempt',3,f => f.attempt+1],
  ['generation',8,f => f.context.requestGeneration+1],['query',9,(_f,other) => other.context.queryIdentity],
  ['authenticated actor',null,null],['anonymous actor',null,null],
]) test(`AC7-8/20: v2 refuses outer ${label} with no shared or private effects`, async () => {
  await requireM84(db,v2); await requireM84(db,effects); await requireM84(db,companions);
  const f=await catalogueBatch(db), other=await catalogueBatch(db,{title:'Other scoped book'});
  const before=await completionFootprint(db);
  const args=[...fence(f),f.lookupId,f.attemptId,f.fetched,f.deadline,true,f.rows,f.catalogueCompanions];
  if (index!==null) args[index]=replacement(f,other);
  await setActor(db,f.ownerId,index===null ? (label==='anonymous actor' ? 'anon' : 'authenticated') : 'service_role');
  await rejected(rpc(db,'phase9_complete_candidate_edition_options_v2',args), index===null ? ['42501'] : []);
  assert.equal(await completionFootprint(db),before);
});

test('[baseline] original v1 choice survives another lookup and option cleanup before Add', async () => {
  await originalChoiceAfterCleanup(db);
});
test('AC7-11/31: Add uses the original companion after a different-work lookup and cleanup', async () => {
  await requireM84(db,v2); await requireM84(db,companions);
  const {original,newer,item,sources}=await originalChoiceAfterCleanup(db,true); await resetActor(db);
  const bindings=(await db.query(`SELECT external_id,canonical_work_id FROM public.canonical_provider_ids
    WHERE adapter_key='open_library' AND id_kind='work' ORDER BY external_id`)).rows;
  const first=bindings.find(b => b.external_id===original.catalogueCompanions[0].workExternalId);
  const next=bindings.find(b => b.external_id===newer.catalogueCompanions[0].workExternalId);
  assert.ok(first); assert.ok(next); assert.notEqual(first.canonical_work_id,next.canonical_work_id);
  assert.equal(item.canonical_work_id,first.canonical_work_id);
  assert.equal(sources[0].normalized_payload.workExternalId,first.external_id);
  assert.equal(sources[0].normalized_payload.oclc,original.catalogueCompanions[0].oclc);
  const saved=(await db.query(`SELECT companion FROM marketplace_sec.phase9_catalogue_companions
    WHERE lookup_id=$1 AND option_id=$2`,[original.lookupId,original.rows[0].optionId])).rows;
  assert.deepEqual(saved.map(r => r.companion),[original.catalogueCompanions[0]]);
});

test('[baseline] v1 completion without companions preserves incumbent OCLC/LCCN', async () => {
  await v1IncumbentCompletion(db);
});

test('AC7-17: post-M84 v1 completion writes a receipt without requiring companions', async () => {
  await requireM84(db, v2); await requireM84(db, effects); await requireM84(db, companions);
  const f = await v1IncumbentCompletion(db);
  assert.ok(await receipt(f));
  assert.equal(await scalar(db, `SELECT count(*)::int FROM ${companions} WHERE lookup_id='${f.lookupId}'`), 0);
  assert.deepEqual((await persisted(f)).state.options, f.rows);
});

test('AC7-17: v2 accepts SQL NULL companions without changing options', async () => {
  await requireM84(db, v2); await requireM84(db, companions);
  const f = await catalogueBatch(db);
  assert.equal((await completeCatalogueV2(db, f, { catalogueCompanions:null })).status, 'completed');
  assert.deepEqual((await persisted(f)).state.options, f.rows);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM ${companions} WHERE lookup_id='${f.lookupId}'`), 0);
});

test('AC7-13/17: a v1 lookup completed before M84 is not retrofitted on replay', async () => {
  const old = await createLeanDatabase({ m84:false });
  try {
    const f = await catalogueBatch(old);
    const initial = await complete(old, f, { rows:f.rows, fetched:f.fetched, deadline:f.deadline });
    assert.equal(initial.status, 'completed');
    await resetActor(old); await applyM84IfPresent(old); await requireM84(old, effects);
    await setActor(old, f.ownerId, 'service_role');
    assert.equal((await recover(old, f)).status, 'replayed');
    await resetActor(old); // effects table revokes ALL from service_role (M84 L44-46): read as postgres.
    assert.equal(await scalar(old, `SELECT count(*)::int FROM ${effects} WHERE lookup_id='${f.lookupId}'`), 0);
  } finally { await old.close(); }
});

test('AC7-23: empty external completion still refuses absent physical-call accounting', async () => {
  await requireM84(db, v2);
  const f = await olOperationForEmpty(), before = [await totals(), await persisted(f)];
  await rejected(completeCatalogueV2(db, f, { rows:[], catalogueCompanions:[] }));
  assert.deepEqual([await totals(), await persisted(f)], before);
});

async function olOperationForEmpty() {
  // Existing operation helper registers the lookup/reservation/attempt, but no GET.
  const { olOperation } = await import('./catalogueLinkFixture.mjs');
  const f = await olOperation(db, { isbn10:null, isbn13:null });
  return { ...f, rows:[], catalogueCompanions:[], fetched:f.facts.fetchedAt,
    deadline:new Date(Date.parse(f.facts.fetchedAt) + 3600000).toISOString() };
}

test('AC7-10/23: completed Google data remains private with normal accounting', async () => {
  await requireM84(db, v2); const f = await seedOperation(db); await prepareCall(db, f); await finalize(db, f);
  const result = resultRows(f), before = await totals(); await setActor(db, f.ownerId, 'service_role');
  const response = await rpc(db, 'phase9_complete_candidate_edition_options_v2', [...fence(f), f.lookupId, f.attemptId,
    result.fetched, result.deadline, true, result.rows, null]);
  assert.equal(response.status, 'completed'); assert.deepEqual(await totals(), before);
  assert.equal((await persisted(f)).reservation.status, 'consumed');
});

test('[baseline] AC7-10: manual Add remains unlinked and creates no shared facts', async () => {
  const f = await seedCard(db); await setActor(db, f.ownerId); await saveReview(db, f);
  const before = await totals(), result = await add(db, f);
  assert.equal(result.item.canonical_work_id, null); assert.equal(result.item.canonical_edition_id, null);
  assert.deepEqual(await totals(), before);
});

test('AC7-3: lookup completion skips an ISBN blocklisted after the rows were prepared', async () => {
  await requireM84(db,v2);
  const f=await catalogueBatch(db,{isbn10:'0306406152',isbn13:'9780306406157'});
  await resetActor(db);
  await db.query(`INSERT INTO marketplace_sec.phase9_catalogue_isbn_blocklist(isbn13,list_version,reason)
    VALUES('9780306406157','fixture-v1','Blocked after discovery')`);
  const before=await totals(); assert.equal((await completeCatalogueV2(db,f)).status,'completed');
  assert.deepEqual(await totals(),before); assert.deepEqual((await persisted(f)).state.options,f.rows);
  assert.equal((await persisted(f)).reservation.status,'consumed');
});

test('AC7-17: stale request is refused before malformed companion validation', async () => {
  await requireM84(db, v2); const f = await catalogueBatch(db), before = [await totals(), await persisted(f)];
  const stale = { ...f, context:{ ...f.context, requestGeneration:f.context.requestGeneration + 1 } };
  const response = await completeCatalogueV2(db, stale, { catalogueCompanions:[{ forged:true }] });
  assert.equal(response.status, 'stale_rejected'); assert.deepEqual([await totals(), await persisted(f)], before);
});

test('AC7-14: known oversized author key skips shared writes while completion succeeds', async () => {
  await requireM84(db, v2);
  const authors = Array.from({ length:20 }, (_,a) => Array.from({ length:4 }, (_,c) =>
    createHash('sha256').update(`completion-oversized:${a}:${c}`).digest('hex')).join(''));
  const f = await catalogueBatch(db, { authors }, authors.slice(0,1)), before = await totals();
  assert.equal((await completeCatalogueV2(db, f)).status, 'completed');
  assert.deepEqual(await totals(), before); assert.deepEqual((await persisted(f)).state.options, f.rows);
});

for (const [name,code] of [['unique violation','23505'],['program limit','54000']])
test(`AC7-14: unrelated ${name} propagates and rolls back completion effects`, async () => {
  await requireM84(db, v2); await requireM84(db, effects);
  const f = await catalogueBatch(db), before = [await totals(), await persisted(f)]; await resetActor(db);
  await db.exec(`CREATE FUNCTION public.phase9_test_unrelated_unique() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE SQLSTATE '${code}'; RETURN NEW; END$$;
    CREATE TRIGGER phase9_test_unrelated_unique BEFORE INSERT ON public.canonical_editions
      FOR EACH ROW EXECUTE FUNCTION public.phase9_test_unrelated_unique()`);
  try { await assert.rejects(() => completeCatalogueV2(db, f), error => error.code === code); }
  finally { await resetActor(db); await db.exec('DROP TRIGGER phase9_test_unrelated_unique ON public.canonical_editions; DROP FUNCTION public.phase9_test_unrelated_unique()'); }
  assert.deepEqual([await totals(), await persisted(f)], before);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM ${effects}`), 0);
});
