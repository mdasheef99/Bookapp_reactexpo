// Owner B1 P2 / 02b sections 6.2, 7.2, 11 AC7-22/25: real M32 -> M15 local hook vs Add.
// Run only on the disposable M84 clone: node <file> <port> <database> <psql> m84.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { after, afterEach, beforeEach, test } from 'node:test';
import { json, literal, owner, q, rpcSql, service, sql, verifyConnectionsClosed } from './editionPickerPostgresConnections.mjs';
import { addSql, card, choices, completeSql, save, selectSql } from './editionPickerPostgresFixture.mjs';
import { claimJob, seedAutomaticLineage } from './editionPickerFixture.mjs';
import { token, worker } from './editionOptionsCompletionFixture.mjs';
import { enableLibrary, olOperation, olResult, successfulReads } from './openLibraryPostgresFixture.mjs';
import { facts, seedIncumbent } from './catalogueLinkFixture.mjs';
import { advisoryLocks, receipts, transaction, waitingOn } from './leanCatalogueLocalHookBarrier.mjs';

const scope = process.argv[5] ?? 'all';
assert.ok(['all', 'm83', 'm84'].includes(scope));
const enabled = scope !== 'm83' && readdirSync(new URL('../../migrations/', import.meta.url))
  .some(name => /^[0-9]{8}000084_marketplace_phase9_catalogue_companions_completion\.sql$/.test(name));
const m84Test = enabled ? test : test.skip;

// Minimal copy of the native role adapter; shared fixtures execute real commands.
let fixtureRole = 'postgres', fixtureActor = '';
const db = {
  async exec(statement) {
    if (/^(?:RESET ROLE|SET ROLE)\b/.test(statement)) {
      fixtureRole = statement.match(/SET ROLE (\w+)/)?.[1] ?? 'postgres';
      fixtureActor = statement.match(/set_config\('request.jwt.claim.sub','([^']*)'/)?.[1] ?? fixtureActor;
      return;
    }
    await sql(statement, fixtureRole, fixtureActor);
  },
  async query(statement, values = []) {
    const rpc = /^SELECT public\./.test(statement);
    statement = statement.replace(/\$(\d+)/g, (_, index) => {
      const value = values[Number(index) - 1];
      return !rpc && Array.isArray(value) && value.every(v => typeof v === 'string')
        ? 'ARRAY[' + value.map(q).join(',') + ']::text[]' : literal(value);
    });
    if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(statement) && !/\bRETURNING\b/i.test(statement)) statement += ' RETURNING *';
    return { rows: await json("WITH r AS (" + statement + ") SELECT coalesce(json_agg(r),'[]') FROM r", fixtureRole, fixtureActor) };
  },
};
async function clean() {
  fixtureRole = 'postgres'; fixtureActor = '';
  await sql('TRUNCATE public.stores,public.canonical_works,public.canonical_editions,marketplace_sec.phase9_catalogue_isbn_blocklist CASCADE');
  await enableLibrary();
  await sql("UPDATE public.phase9_provider_registry SET provider_kind='metadata',adapter_version='1.0.0',public_display_allowed=true WHERE adapter_key='open_library'");
}
beforeEach(async () => {
  if (!enabled) return;
  assert.ok(await json("SELECT coalesce(to_json(to_regclass('marketplace_sec.phase9_catalogue_lookup_effects')::text),'null'::json)"), 'runner must supply its M84 clone');
  await clean();
});
afterEach(async () => { if (enabled) { await verifyConnectionsClosed(); await clean(); } });
after(async () => { if (enabled) await verifyConnectionsClosed(); });

async function matchingCard(m, parent = null) {
  const f = await card(parent);
  const review = { originalTitle: m.title, authors: m.authors, originalLanguage: m.language, script: m.script,
    originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) } };
  await sql(`UPDATE public.image_extraction_candidates SET observed_title=${q(m.title)},
    observed_authors=ARRAY[${m.authors.map(q).join(',')}],observed_isbn_clue=${literal(m.isbn13)},
    observed_language=${q(m.language)},owner_review_snapshot=jsonb_set(owner_review_snapshot,'{value}',
    (owner_review_snapshot->'value')||${literal(review)}) WHERE id=${q(f.candidateId)}`);
  return f;
}
async function localJob(f, target) {
  assert.equal(await json(`SELECT to_json(marketplace_sec.phase9_edition_local_match(c))
    FROM public.image_extraction_candidates c WHERE id=${q(f.candidateId)}`), target.editionId);
  const { jobId } = await seedAutomaticLineage(db, f);
  const context = (await db.query(await claimJob(db, f, jobId))).rows[0].phase9_metadata_job_context;
  const args = [jobId, worker, token, 1, f.candidateId, context.candidateVersion, context.queryIdentity,
    'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', 'p9-metadata-v1', target.editionId, 'p9-selected-v1', 'p9-metadata-selection-v1', ['validated_isbn']];
  return { ...f, target, jobId, args, command: rpcSql('phase9_complete_structural_local_metadata_match', args) };
}
async function addReady(f, m) {
  // Keep the v1 fixture's completion private, as in the existing native M84 suite.
  await sql("UPDATE public.phase9_provider_registry SET public_display_allowed=false WHERE adapter_key='open_library'");
  try {
    const p = await olOperation(f); await successfulReads(p);
    const r = olResult(p, m); r.rows = [r.rows[0]];
    r.rows[0].metadata.providerRecordId = m.providerRecordId;
    r.rows[0].googleBooksUrl = 'https://openlibrary.org/books/' + m.providerRecordId;
    assert.equal((await service(completeSql(p, r))).status, 'completed');
    f.optionId = r.rows[0].optionId;
  } finally { await sql("UPDATE public.phase9_provider_registry SET public_display_allowed=true WHERE adapter_key='open_library'"); }
  const selected = await owner(selectSql(f, await choices(f), f.optionId), f);
  assert.ok(selected.selection, 'B has a real explicit selection');
  await save(f);
  return f;
}

// A provider-edition key unique to B is the barrier. It precedes EVERY common
// key, so paused Add cannot already own an ISBN/work key needed by local A.
async function identityPlan(target) {
  const common = await json(`SELECT json_build_object('work',
    marketplace_sec.phase9_catalogue_identity_lock_key_v1('work',jsonb_build_array(
      btrim(marketplace_sec.phase9_metadata_normalized_text(w.title_normalized)),
      marketplace_sec.phase9_catalogue_normalized_authors_v1(w.primary_authors)))::text,
    'isbn13',marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn13',jsonb_build_array(i.isbn13))::text,
    'isbn10',CASE WHEN i.isbn10 IS NOT NULL THEN
      marketplace_sec.phase9_catalogue_identity_lock_key_v1('isbn10',jsonb_build_array(i.isbn10))::text END)
    FROM public.canonical_editions e JOIN public.canonical_works w ON w.id=e.work_id
    CROSS JOIN LATERAL marketplace_sec.phase9_catalogue_isbn_v1(e.isbn_10,e.isbn_13) i WHERE e.id=${q(target.editionId)}`);
  const minimum = Object.values(common).filter(Boolean).sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1)[0];
  const gate = await json(`SELECT (SELECT row_to_json(g) FROM (
    SELECT 'OL'||n||'M' AS record,marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
      jsonb_build_array('open_library','edition','OL'||n||'M'))::text AS key
    FROM generate_series(1000,10999) n) g WHERE key::bigint<${minimum}::bigint ORDER BY key::bigint LIMIT 1)`);
  assert.ok(gate, 'deterministic fixture must have a provider key before all common identities');
  return { ...common, gate };
}
const searched = () => json('SELECT coalesce(sum(times_searched),0)::int FROM public.canonical_work_stats');
async function localEffect(f, response) {
  assert.equal(response.manual_outcome, 'local_canonical_match');
  assert.equal(response.creates_provider_charge, false);
  const effect = await json(`SELECT row_to_json(e) FROM marketplace_sec.phase9_catalogue_lookup_effects e WHERE lookup_id=${q(response.lookup_id)}`);
  assert.ok(effect); assert.equal(effect.candidate_id, f.candidateId);
  assert.equal(effect.session_id, f.sessionId); assert.equal(effect.store_id, f.storeId);
  assert.equal(effect.search_counted, true); assert.equal(effect.searched_work_id, f.target.workId);
  assert.deepEqual(effect.canonical_results, [{ optionId: null, canonicalWorkId: f.target.workId, canonicalEditionId: f.target.editionId }]);
  assert.deepEqual(effect.completion_response, response);
  assert.deepEqual(await json(`SELECT json_build_object(
    'lookups',(SELECT count(*) FROM public.phase9_metadata_lookups WHERE job_id=${q(f.jobId)}),
    'snapshots',(SELECT count(*) FROM public.phase9_selected_metadata_snapshots WHERE candidate_id=${q(f.candidateId)}),
    'attempts',(SELECT count(*) FROM public.metadata_enrichment_attempts WHERE candidate_id=${q(f.candidateId)}),
    'reservations',(SELECT count(*) FROM public.phase9_usage_reservations WHERE job_id=${q(f.jobId)}),
    'calls',(SELECT count(*) FROM public.phase9_metadata_provider_calls WHERE job_id=${q(f.jobId)}))`),
  { lookups: 1, snapshots: 1, attempts: 0, reservations: 0, calls: 0 });
  return effect;
}

m84Test('[control] AC7-25: real structural local hook alone completes and counts searched once across M15 replay', async () => {
  const m = facts({ isbn10: null }), target = await seedIncumbent(db, m);
  const f = await localJob(await matchingCard(m), target);
  const response = await service(f.command), effect = await localEffect(f, response);
  assert.equal(await searched(), 1);
  const replay = rpcSql('phase9_complete_local_metadata_match', [...f.args.slice(0, 4), ...f.args.slice(6)])
    .replace('SELECT public.', 'SELECT marketplace_sec.');
  assert.deepEqual(await service(replay), response, 'M15 replay returns before rechecking its resolved job');
  assert.deepEqual(await localEffect(f, response), effect);
  assert.equal(await searched(), 1);
  assert.deepEqual(await json(`SELECT json_build_object('chosen',coalesce(sum(times_chosen),0),
    'added',coalesce(sum(times_added),0)) FROM public.canonical_edition_stats`), { chosen: 0, added: 0 });
});

m84Test('P2 / AC7-22/25: same-session Add B and real M32/M15 local completion A both finish without deadlock', async () => {
  const m = facts({ isbn10: null }), target = await seedIncumbent(db, m), plan = await identityPlan(target);
  const a = await matchingCard(m), b = await addReady(await matchingCard(m, a), { ...m, providerRecordId: plan.gate.record });
  assert.equal(a.sessionId, b.sessionId); assert.notEqual(a.candidateId, b.candidateId);
  // No provider tuples/sources may make A acquire B's barrier key.
  assert.equal(await json('SELECT (SELECT count(*) FROM public.canonical_provider_ids)+(SELECT count(*) FROM public.book_metadata_sources)'), 0);
  const local = await localJob(a, target), command = await addSql(b), before = await searched();
  const barrier = transaction('provider-barrier', 'SELECT pg_advisory_xact_lock(' + plan.gate.key + ')', { hold: true });
  let add, completion;
  try {
    const barrierPid = await barrier.pid(); await barrier.held();
    add = transaction('add-b', command, { role: 'authenticated', actor: b.ownerId });
    const addPid = await add.pid(), addWait = await waitingOn('local-hook-add-before-work', add, barrierPid);
    assert.deepEqual((await advisoryLocks(addPid)).filter(lock => !lock.granted).map(lock => lock.key), [plan.gate.key]);
    assert.equal((await advisoryLocks(addPid)).some(lock => lock.key === plan.work && lock.granted), false);
    await assert.rejects(() => sql(`BEGIN; SELECT id FROM public.image_extraction_sessions
      WHERE id=${q(a.sessionId)} FOR UPDATE NOWAIT; ROLLBACK`), /could not obtain lock/i, 'actual Add already owns the session');
    completion = transaction('complete-a', local.command, { role: 'service_role' });
    const completionPid = await completion.pid(), localWait = await waitingOn('local-hook-completion-needs-session', completion, addPid);
    const locks = await advisoryLocks(completionPid);
    console.log('LEAN_CATALOGUE_LOCK ' + JSON.stringify({ name: 'local-hook-before-release', sessionId: a.sessionId,
      addPid, completionPid, barrierPid, workKey: plan.work, providerBarrierKey: plan.gate.key,
      addWait, localWait, localIdentityLocks: locks, localHoldsWork: locks.some(lock => lock.key === plan.work && lock.granted) }));
    // Current hook: A owns work -> waits session; released B then waits work -> 40P01.
    // Fixed hook: A waits session before shared keys; released B commits, then A completes.
    barrier.release(true);
    const [gateEnd, addEnd, localEnd] = await Promise.all([barrier.done, add.done, completion.done]);
    assert.equal(gateEnd.code, 0, gateEnd.errors);
    const errors = addEnd.errors + '\n' + localEnd.errors;
    assert.doesNotMatch(errors, /40P01|deadlock detected/i, 'real Add and local completion must finish without a deadlock');
    assert.equal(addEnd.code, 0, 'Add must succeed: ' + addEnd.errors);
    assert.equal(localEnd.code, 0, 'structural local completion must succeed: ' + localEnd.errors);
    assert.equal(receipts(addEnd.output).find(value => value.outcome)?.outcome, 'committed_private');
    await localEffect(local, receipts(localEnd.output).find(value => value.lookup_id));
    assert.equal(await searched(), before + 1, 'local completion contributes exactly one searched count');
    assert.deepEqual(await json(`SELECT json_build_object('work',canonical_work_id,'edition',canonical_edition_id)
      FROM public.store_inventory WHERE created_from_candidate_id=${q(b.candidateId)}`), { work: target.workId, edition: target.editionId });
  } finally {
    barrier.release();
    await Promise.all([barrier.done, add?.done, completion?.done]);
  }
});

m84Test('Round C / AC7-22/25: closed and active sessions of one owner serialize local completion and Add before shared keys', async () => {
  const m = facts({ isbn10: null }), target = await seedIncumbent(db, m), plan = await identityPlan(target);
  const a = await matchingCard(m), local = await localJob(a, target), sessionId = randomUUID();
  // Master SDD section 6 / M29 Close: terminal inputs permit Close with metadata still leased.
  // M67 structural-local completion accepts that lease after Close. M02 allows the new active S2.
  const version = await json(`SELECT to_json(version) FROM public.image_extraction_sessions WHERE id=${q(a.sessionId)}`);
  const closed = await owner(rpcSql('phase9_close_session_v2', [a.sessionId, version, randomUUID(), randomUUID()]), a);
  assert.equal(closed.closeState, 'closed');
  await sql(`INSERT INTO public.image_extraction_sessions(id,store_id,created_by,status,selected_language,selected_script,
    default_condition,default_location,default_quantity,default_publication)
    SELECT ${q(sessionId)},store_id,created_by,'active',selected_language,selected_script,
      default_condition,default_location,default_quantity,default_publication
    FROM public.image_extraction_sessions WHERE id=${q(a.sessionId)}`);
  // This time pause Add AFTER every common identity, while it already owns the work key.
  const maximum = Object.entries(plan).filter(([name, value]) => name !== 'gate' && value)
    .map(([, value]) => value).sort((x, y) => BigInt(x) < BigInt(y) ? -1 : 1).at(-1);
  const gate = await json(`SELECT (SELECT row_to_json(g) FROM (
    SELECT 'OL'||n||'M' AS record,marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider',
      jsonb_build_array('open_library','edition','OL'||n||'M'))::text AS key
    FROM generate_series(11000,20999) n) g WHERE key::bigint>${maximum}::bigint ORDER BY key::bigint LIMIT 1)`);
  assert.ok(gate, 'provider barrier follows all common keys');
  const b = await addReady(await matchingCard(m, { ...a, sessionId }), { ...m, providerRecordId: gate.record });
  assert.notEqual(a.sessionId, b.sessionId); assert.equal(a.ownerId, b.ownerId); assert.equal(a.storeId, b.storeId);
  assert.deepEqual(await json(`SELECT json_object_agg(id::text,status) FROM public.image_extraction_sessions
    WHERE id IN (${q(a.sessionId)},${q(b.sessionId)})`), { [a.sessionId]: 'closed', [b.sessionId]: 'active' });
  assert.equal(await json('SELECT (SELECT count(*) FROM public.canonical_provider_ids)+(SELECT count(*) FROM public.book_metadata_sources)'), 0);
  const scopeSql = `SELECT row_to_json(s) FROM public.phase9_owner_review_scopes s WHERE actor_user_id=${q(a.ownerId)}`;
  const scopeBefore = await json(scopeSql);
  await sql(`SELECT marketplace_sec.phase9_catalogue_lock_owner_scope_v1(${q(a.sessionId)})`);
  assert.deepEqual(await json(scopeSql), scopeBefore, 'prelock must change neither revision nor updated_at');
  const command = await addSql(b), before = await searched();
  const barrier = transaction('cross-session-provider-barrier', 'SELECT pg_advisory_xact_lock(' + gate.key + ')', { hold: true });
  let add, completion;
  try {
    const barrierPid = await barrier.pid(); await barrier.held();
    add = transaction('cross-session-add-b', command, { role: 'authenticated', actor: b.ownerId });
    const addPid = await add.pid(), addWait = await waitingOn('cross-session-add-holds-work', add, barrierPid);
    assert.equal((await advisoryLocks(addPid)).some(lock => lock.key === plan.work && lock.granted), true);
    let scopeProbeError;
    try {
      await sql(`BEGIN; SELECT actor_user_id FROM public.phase9_owner_review_scopes
        WHERE actor_user_id=${q(a.ownerId)} FOR UPDATE NOWAIT; ROLLBACK`);
    } catch (error) { scopeProbeError = error; }
    completion = transaction('cross-session-complete-a', local.command, { role: 'service_role' });
    const completionPid = await completion.pid(), localWait = await waitingOn('cross-session-local-needs-owner-scope', completion, addPid);
    const locks = await advisoryLocks(completionPid);
    // Check captured evidence after release: without the helper calls, B holds work,
    // A's lookup trigger holds owner scope and waits work, then B waits scope -> 40P01.
    console.log('LEAN_CATALOGUE_LOCK ' + JSON.stringify({ name: 'cross-session-owner-scope-before-release',
      ownerId: a.ownerId, localSessionId: a.sessionId, addSessionId: b.sessionId,
      addPid, completionPid, barrierPid, workKey: plan.work, providerBarrierKey: gate.key, addWait, localWait, localIdentityLocks: locks }));
    barrier.release(true);
    const [gateEnd, addEnd, localEnd] = await Promise.all([barrier.done, add.done, completion.done]);
    assert.equal(gateEnd.code, 0, gateEnd.errors);
    assert.doesNotMatch(addEnd.errors + '\n' + localEnd.errors, /40P01|deadlock detected/i);
    assert.equal(addEnd.code, 0, 'Add must succeed: ' + addEnd.errors);
    assert.equal(localEnd.code, 0, 'local completion must succeed: ' + localEnd.errors);
    assert.match(scopeProbeError?.message ?? '', /could not obtain lock/i, 'Add already owns the owner review scope');
    assert.deepEqual(locks, [], 'before release, local completion waits at owner scope without any advisory lock');
    assert.equal(receipts(addEnd.output).find(value => value.outcome)?.outcome, 'committed_private');
    const response = receipts(localEnd.output).find(value => value.lookup_id);
    const effect = await localEffect(local, response);
    const replay = rpcSql('phase9_complete_local_metadata_match', [...local.args.slice(0, 4), ...local.args.slice(6)])
      .replace('SELECT public.', 'SELECT marketplace_sec.');
    assert.deepEqual(await service(replay), response); assert.deepEqual(await localEffect(local, response), effect);
    assert.equal(await searched(), before + 1);
    assert.deepEqual(await json(`SELECT json_build_object('work',canonical_work_id,'edition',canonical_edition_id)
      FROM public.store_inventory WHERE created_from_candidate_id=${q(b.candidateId)}`), { work: target.workId, edition: target.editionId });
  } finally {
    barrier.release(); await Promise.all([barrier.done, add?.done, completion?.done]);
  }
});
