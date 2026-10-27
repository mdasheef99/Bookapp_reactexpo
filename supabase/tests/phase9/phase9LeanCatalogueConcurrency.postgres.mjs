// 02b §§6.2/7.2/11/12: real independent Add transactions; no later-slice batch claim.
// Run only via the existing disposable loopback PostgreSQL runner, never live DB.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, afterEach, beforeEach, test } from 'node:test';
import { json, literal, owner, q, service, sql, verifyConnectionsClosed, waitFor } from './editionPickerPostgresConnections.mjs';
import { addSql, card, choices, completeSql, ownerAction, save, selectSql } from './editionPickerPostgresFixture.mjs';
import { enableLibrary, olOperation, olResult, successfulReads } from './openLibraryPostgresFixture.mjs';
import { automaticCard, canonicalCard, facts, labelledCard, linked, seedIncumbent, unmatched } from './catalogueLinkFixture.mjs';
import { requireLean } from './leanCatalogueFixture.mjs';

// Same per-connection role adapter as the existing native catalogue suite;
// shared CAN fixtures still call the real local-completion/review RPCs.
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
const item = f => json("SELECT coalesce((SELECT row_to_json(i) FROM public.store_inventory i WHERE created_from_candidate_id=" + q(f.candidateId) + "),'null'::json)");
const totals = () => json(`SELECT json_build_object('works',(SELECT count(*) FROM public.canonical_works),
  'editions',(SELECT count(*) FROM public.canonical_editions),'ids',(SELECT count(*) FROM public.canonical_provider_ids),
  'sources',(SELECT count(*) FROM public.book_metadata_sources),'inventory',(SELECT count(*) FROM public.store_inventory))`);
const shared = () => json(`SELECT jsonb_build_array(
  (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.canonical_works x),
  (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.canonical_editions x),
  (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.canonical_provider_ids x),
  (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]') FROM public.book_metadata_sources x))`);
async function clean() {
  fixtureRole = 'postgres'; fixtureActor = '';
  await sql('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await enableLibrary();
  await sql("UPDATE public.phase9_provider_registry SET provider_kind='metadata',adapter_version='1.0.0',public_display_allowed=true WHERE adapter_key='open_library'");
}
beforeEach(clean);
afterEach(async () => { await verifyConnectionsClosed(); await clean(); });
after(verifyConnectionsClosed);
async function withOptions(overrides = {}, parent = null) {
  const f = await card(parent), m = facts(overrides);
  const review = { originalTitle: m.title, authors: m.authors, originalLanguage: m.language, script: m.script,
    originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) } };
  await sql('UPDATE public.image_extraction_candidates SET observed_title=' + q(m.title)
    + ',observed_authors=ARRAY[' + m.authors.map(q).join(',') + '],observed_isbn_clue=' + literal(m.isbn13 ?? m.isbn10)
    + ',observed_language=' + q(m.language) + ",owner_review_snapshot=jsonb_set(owner_review_snapshot,'{value}',"
    + "(owner_review_snapshot->'value')||" + literal(review) + ') WHERE id=' + q(f.candidateId));
  const p = await olOperation(f); await successfulReads(p);
  const r = olResult(p, m); r.rows = [r.rows[0]];
  Object.assign(r.rows[0].metadata, { providerRecordId: m.providerRecordId });
  r.rows[0].googleBooksUrl = 'https://openlibrary.org/books/' + m.providerRecordId;
  assert.equal((await service(completeSql(p, r))).status, 'completed', 'legacy worker v1 completion stays valid');
  return { ...p, ...f, facts: r.rows[0].metadata, optionId: r.rows[0].optionId };
}
async function selected(overrides = {}, parent = null) {
  const f = await withOptions(overrides, parent);
  f.selected = await owner(selectSql(f, await choices(f), f.optionId), f);
  await save(f); return f;
}

// Holder emits its pid only after its command/locks exist. The independent
// contender must be visible waiting on that pid in BOTH activity and lock views.
async function held(name, statement, contender, { rollback = false, role = 'postgres', actor = '', inspect = null } = {}) {
  const [port, database, psql] = process.argv.slice(2), app = 'ep8-lean-' + name;
  const child = spawn(psql, ['-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', database,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', finished = false, pending;
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
  const closed = new Promise(resolve => {
    child.on('error', error => { finished = true; resolve({ code: -1, error }); });
    child.on('close', code => { finished = true; resolve({ code }); });
  });
  child.stdin.on('error', () => {});
  child.stdin.write('SET application_name=' + q(app + '-holder') + "; SET statement_timeout='15s'; SET idle_in_transaction_session_timeout='15s';"
    + " SELECT set_config('request.jwt.claim.role'," + q(role) + ",false); SELECT set_config('request.jwt.claim.sub'," + q(actor)
    + ',false); SET ROLE ' + role + '; BEGIN; ' + statement
    + "; SELECT json_build_object('pid',pg_backend_pid());\n\\echo LEAN_HELD\n");
  try {
    await waitFor(() => { assert.equal(finished, false, 'native holder must reach the barrier: ' + errors); return output.includes('LEAN_HELD'); }, app);
    const holderPid = JSON.parse(output.split(/\r?\n/).find(line => line.startsWith('{"pid"'))).pid;
    pending = sql(contender.statement, contender.role, contender.actor ?? '', app + '-contender')
      .then(value => ({ ok: true, value: JSON.parse(value) }), error => ({ ok: false, error }));
    const evidence = await waitFor(async () => (await json(`SELECT coalesce(json_agg(a),'[]') FROM (
      SELECT s.pid,s.wait_event_type,s.wait_event,pg_blocking_pids(s.pid) AS blockers,
        EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=s.pid AND NOT l.granted) AS pending_lock
      FROM pg_stat_activity s WHERE s.application_name=${q(app + '-contender')}
        AND s.wait_event_type='Lock' AND ${holderPid}=ANY(pg_blocking_pids(s.pid))) a`))[0], app + ' actual Lock');
    assert.notEqual(evidence.pid, holderPid); assert.equal(evidence.pending_lock, true);
    console.log('LEAN_CATALOGUE_LOCK ' + JSON.stringify({ name, holderPid, ...evidence }));
    if (inspect) await inspect(evidence, holderPid);
    child.stdin.end((rollback ? 'ROLLBACK' : 'COMMIT') + ';\n\\q\n');
    const [end, result] = await Promise.all([closed, pending]);
    assert.equal(end.code, 0, 'holder transaction must finish: ' + errors);
    assert.equal(result.ok, true, 'contender command must succeed: ' + (result.error?.message ?? ''));
    assert.equal(errors.includes('deadlock detected'), false);
    return { result: result.value, evidence, output };
  } finally {
    if (!finished) child.stdin.end('ROLLBACK;\n\\q\n');
    await closed; if (pending) await pending;
  }
}

for (const noIsbn of [false, true]) for (const rollback of [false, true])
  test('AC7-18: Add-vs-Add ' + (noIsbn ? 'provider-only tuple' : 'same ISBN') + ' holder ' + (rollback ? 'rollback' : 'commit'), async () => {
    await requireLean(db);
    const m = noIsbn ? { isbn10: null, isbn13: null } : {};
    const a = await selected(m), b = await selected(m);
    const command = await addSql(b);
    const r = await held('same-' + noIsbn + '-' + rollback, await addSql(a), ownerAction(command, b),
      { rollback, role: 'authenticated', actor: a.ownerId });
    assert.equal(r.result.outcome, 'committed_private'); linked(await item(b));
    if (rollback) assert.equal(await item(a), null);
    else { linked(await item(a)); assert.equal((await item(a)).canonical_edition_id, (await item(b)).canonical_edition_id); }
    assert.deepEqual(await totals(), { works: 1, editions: 1, ids: 1, sources: 1, inventory: rollback ? 1 : 2 });
    const counters = await json('SELECT json_build_object(\'chosen\',coalesce(sum(times_chosen),0),\'added\',coalesce(sum(times_added),0)) FROM public.canonical_edition_stats');
    assert.deepEqual(counters, { chosen: rollback ? 1 : 2, added: rollback ? 1 : 2 });
    const before = await shared();
    assert.deepEqual(await owner(command, b), r.result, 'lost-response replay returns the committed Add receipt');
    assert.deepEqual(await shared(), before);
  });

test('AC7-18: reverse-order two-store Adds share the normalized work without deadlock', async () => {
  await requireLean(db);
  const a1 = await selected(), a2 = await selected({ providerRecordId: 'OL101M', isbn10: null, isbn13: '9780547928227' }, a1);
  const b2 = await selected({ providerRecordId: 'OL101M', isbn10: null, isbn13: '9780547928227', authors: ['a. author', 'B. AUTHOR'] });
  const b1 = await selected({ authors: ['a. author', 'B. AUTHOR'] }, b2);
  await held('reverse-first', await addSql(a1), ownerAction(await addSql(b2), b2), { role: 'authenticated', actor: a1.ownerId });
  // Each book has its own ordinary transaction: opposite store order is not a
  // worker multi-option batch and acquires no new private locks after shared ones.
  await held('reverse-second', await addSql(a2), ownerAction(await addSql(b1), b1), { role: 'authenticated', actor: a2.ownerId });
  const items = await Promise.all([a1, a2, b2, b1].map(item)); items.forEach(linked);
  assert.equal(new Set(items.map(i => i.canonical_work_id)).size, 1);
  assert.equal(items[0].canonical_edition_id, items[3].canonical_edition_id);
  assert.equal(items[1].canonical_edition_id, items[2].canonical_edition_id);
  assert.deepEqual(await totals(), { works: 1, editions: 2, ids: 2, sources: 2, inventory: 4 });
});

async function incumbent(m, workId = randomUUID(), editionId = randomUUID()) {
  await sql('INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors) VALUES('
    + [workId, m.title.toLowerCase(), m.title].map(q).join(',') + ",ARRAY['a. author','b. author']);"
    + 'INSERT INTO public.canonical_editions(id,work_id,title,authors,isbn_13) VALUES('
    + [editionId, workId, m.title].map(q).join(',') + ",ARRAY['B. Author','A. Author']," + literal(m.isbn13) + ')');
  return { workId, editionId };
}

for (const sameKey of [true, false]) test('AC7-4/18/OQ6: concurrent same-option Select with '
  + (sameKey ? 'one idempotency key counts one selection' : 'distinct idempotency keys counts each new selection'), async () => {
  await requireLean(db);
  const f = await withOptions(), target = await incumbent(f.facts), initial = await choices(f);
  const before = await shared(), key = randomUUID(), command = randomUUID();
  const first = selectSql(f, initial, f.optionId, { key, command });
  // The second fresh command addresses the versions that the still-uncommitted
  // first Select will produce. Reusing stale versions would test rejection,
  // rather than OQ6's two successful, distinct committed selections.
  const next = { ...initial, candidateVersion: initial.candidateVersion + 1,
    metadataRevision: initial.metadataRevision + 1, reviewVersion: initial.reviewVersion + 1 };
  const second = sameKey ? first : selectSql(f, next, f.optionId,
    { key: randomUUID(), command: randomUUID() });
  const result = await held('select-' + (sameKey ? 'same-key' : 'distinct-keys'), first, ownerAction(second, f), {
    role: 'authenticated', actor: f.ownerId,
    inspect: async () => {
      assert.equal(await sql('SELECT count(*) FROM marketplace_sec.phase9_catalogue_choice_effects'), '0',
        'independent observer cannot see the holder selection before its commit');
      assert.equal(await sql('SELECT coalesce(sum(times_chosen),0) FROM public.canonical_edition_stats'), '0');
    },
  });
  const firstReceipt = result.output.split(/\r?\n/).filter(line => line.startsWith('{'))
    .map(line => JSON.parse(line)).find(value => value.selection);
  assert.ok(firstReceipt?.selection, 'holder must return its actual successful Select receipt');
  const firstId = firstReceipt.selection.selectionId, secondId = result.result.selection.selectionId;
  assert.equal(firstId === secondId, sameKey, 'receipt replay keeps its ID; a fresh command creates another selection');
  const expected = sameKey ? 1 : 2;
  const counters = () => json(`SELECT json_build_object(
    'chosen',(SELECT coalesce(sum(times_chosen),0) FROM public.canonical_edition_stats),
    'added',(SELECT coalesce(sum(times_added),0) FROM public.canonical_edition_stats),
    'searched',(SELECT coalesce(sum(times_searched),0) FROM public.canonical_work_stats))`);
  assert.deepEqual(await counters(), { chosen: expected, added: 0, searched: 0 });
  const effects = () => json(`SELECT coalesce(json_agg(e ORDER BY e.selection_id),'[]')
    FROM marketplace_sec.phase9_catalogue_choice_effects e WHERE e.candidate_id=${q(f.candidateId)}`);
  const committed = await effects();
  assert.equal(committed.length, expected);
  for (const effect of committed) {
    assert.equal(effect.counted, true); assert.ok(effect.completed_at);
    assert.equal(effect.canonical_edition_id, target.editionId);
    assert.equal(effect.option_id, f.optionId);
  }
  assert.equal((await choices(f)).selection.selectionId, secondId);
  assert.equal((await owner(first, f)).selection.selectionId, firstId);
  assert.equal((await owner(second, f)).selection.selectionId, secondId);
  assert.deepEqual(await counters(), { chosen: expected, added: 0, searched: 0 }, 'both lost-response replays add zero');
  assert.deepEqual(await effects(), committed, 'replay preserves exact private effect rows');
  assert.deepEqual(await shared(), before, 'Select cannot create or enrich catalogue facts, IDs or sources');
  assert.equal(await item(f), null, 'Select creates no inventory');
});

for (const rollback of [false, true]) test('AC7-18: conflicting source tuple ' + (rollback ? 'rolls back' : 'commits') + ' before Add recheck', async () => {
  await requireLean(db);
  const f = await selected(), other = await incumbent(facts({ title: 'Other work', isbn13: '9780547928227' }));
  const before = await shared();
  const sourceInsert = `INSERT INTO public.book_metadata_sources(id,provider,adapter_key,provider_book_id,canonical_edition_id,
    raw_payload,normalized_payload) VALUES(${q(randomUUID())},'open_library','open_library','OL100M',${q(other.editionId)},'{}','{}')`;
  await held('source-' + rollback, sourceInsert, ownerAction(await addSql(f), f), { rollback });
  if (rollback) { linked(await item(f)); assert.equal((await totals()).editions, 2); }
  else { unmatched(await item(f)); const current = await shared(); assert.deepEqual(current.slice(0, 3), before.slice(0, 3));
    assert.equal(current[3].length, 1, 'only the privileged conflicting source survives; no provisional sources'); }
});

// Source-backed translated saved-ID path: production Add has no incoming work
// reference, so the proof comes from the existing exact provider source/tuple.
for (const competing of [false, true]) test('AC7-18/OQ3: source-backed translation work tuple ' + (competing ? 'conflict skips atomically' : 'reuses its work'), async () => {
  await requireLean(db);
  const f = await selected(), a = await incumbent(f.facts), b = await incumbent(facts({ title: 'Other work', isbn13: '9780547928227' }));
  const projected = Object.fromEntries(['adapterKey','adapterVersion','schemaVersion','normalizerVersion','providerRecordId','fetchedAt',
    'title','subtitle','authors','publisher','publishedDate','language','script','isbn10','isbn13','pageCount','categories',
    'description','editionStatement','volume','format','series','coverReference'].map(k => [k, f.facts[k]]));
  Object.assign(projected, { version: 'psr-catalogue-facts-v1', workExternalId: 'OL700W', oclc: null, lccn: null,
    coverRef: '123', sourceRetentionNote: await sql("SELECT shared_source_note FROM public.phase9_provider_registry WHERE adapter_key='open_library'") });
  await sql(`UPDATE public.canonical_works SET primary_title='Original work',title_normalized='original work' WHERE id=${q(a.workId)};
    INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_edition_id)
      VALUES('open_library','edition','OL100M',${q(a.editionId)});
    INSERT INTO public.book_metadata_sources(id,provider,adapter_key,provider_book_id,canonical_edition_id,normalized_payload)
      VALUES(${q(randomUUID())},'open_library','open_library','OL100M',${q(a.editionId)},
        ${literal(projected)});`);
  const before = await shared();
  const insert = `INSERT INTO public.canonical_provider_ids(adapter_key,id_kind,external_id,canonical_work_id)
    VALUES('open_library','work','OL700W',${q(competing ? b.workId : a.workId)})`;
  // Hold the exact work identity key as well as the row: forces the tuple
  // commit to be visible after Add's shared-phase barrier before revalidation.
  const key = await sql("SELECT marketplace_sec.phase9_catalogue_identity_lock_key_v1('provider','[\"open_library\",\"work\",\"OL700W\"]'::jsonb)::text");
  await held('work-tuple-' + competing, 'SELECT pg_advisory_xact_lock(' + key + ');' + insert,
    ownerAction(await addSql(f), f));
  if (competing) unmatched(await item(f)); else { linked(await item(f)); assert.equal((await item(f)).canonical_work_id, a.workId); }
  const current = await shared(); assert.deepEqual(current[0], before[0]); assert.deepEqual(current[1], before[1]);
  assert.deepEqual(current[3], before[3], 'source/canonical incumbents stay byte-identical');
});

async function keys(m, provider = true) {
  const work = await json(`SELECT jsonb_build_array(
    btrim(marketplace_sec.phase9_metadata_normalized_text(${q(m.title)})),
    marketplace_sec.phase9_catalogue_normalized_authors_v1(ARRAY[${m.authors.map(q).join(',')}]::text[]))`);
  const tuples = [['work', work]];
  if (provider) tuples.push(['provider', ['open_library', 'edition', m.providerRecordId]]);
  if (m.isbn10) tuples.push(['isbn10', [m.isbn10]]);
  if (m.isbn13) tuples.push(['isbn13', [m.isbn13]]);
  return json(`SELECT json_agg(k::text ORDER BY k) FROM (SELECT DISTINCT
    marketplace_sec.phase9_catalogue_identity_lock_key_v1(x->>0,x->1) k
    FROM jsonb_array_elements(${literal(tuples)}) x) s`);
}
test('AC7-18/19/OQ1: legacy raw-case unique winner retains the known skipped link with no orphan repair', async () => {
  await requireLean(db);
  const f = await selected({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'], isbn10: null, isbn13: '9780547928227' });
  const workId = randomUUID(), editionId = randomUUID();
  await sql(`INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors)
    VALUES(${q(workId)},'the hobbit','The Hobbit',ARRAY['J.R.R. Tolkien'])`);
  const workBefore = await sql('SELECT to_jsonb(w)::text FROM public.canonical_works w WHERE id=' + q(workId));
  const selectedBefore = await sql('SELECT selected_option_snapshot::text FROM public.phase9_candidate_edition_state WHERE candidate_id=' + q(f.candidateId));
  // Privileged legacy-incumbent construction deliberately does not join the new
  // advisory protocol. It exposes the accepted old-key/unique-wait interleaving;
  // this is a safe-skip regression, never a claim of normal writer convergence.
  const insert = `INSERT INTO public.canonical_editions(id,work_id,isbn_13,title,authors)
    VALUES(${q(editionId)},${q(workId)},'9780547928227','The Hobbit',ARRAY['J.R.R. Tolkien'])`;
  await held('legacy-raw-key', insert, ownerAction(await addSql(f), f));
  unmatched(await item(f));
  assert.deepEqual(await totals(), { works: 1, editions: 1, ids: 0, sources: 0, inventory: 1 });
  assert.equal(await sql('SELECT to_jsonb(w)::text FROM public.canonical_works w WHERE id=' + q(workId)), workBefore);
  assert.equal(await sql('SELECT selected_option_snapshot::text FROM public.phase9_candidate_edition_state WHERE candidate_id=' + q(f.candidateId)), selectedBefore);
});
test('AC7-22: Add requests signed identity keys in sorted deduplicated order before row locks', async () => {
  await requireLean(db);
  const initial = await selected(), target = await incumbent(initial.facts), expected = await keys(initial.facts);
  assert.equal(new Set(expected).size, expected.length); assert.ok(expected.some(k => BigInt(k) < 0n), 'fixture exercises signed keys');
  // A barrier at each successive key proves the entire acquisition prefix,
  // including that no larger identity key or shared row lock was taken early.
  for (let index = 0; index < expected.length; index++) {
    const f = index === 0 ? initial : await selected();
    await held('key-prefix-' + index, 'SELECT pg_advisory_xact_lock(' + expected[index] + ')', ownerAction(await addSql(f), f), {
      inspect: async (evidence, holderPid) => {
        const locks = await json(`SELECT coalesce(json_agg(x ORDER BY key::bigint),'[]') FROM (
          SELECT ((classid::bigint<<32)|objid::bigint)::text AS key,granted FROM pg_locks
          WHERE pid=${evidence.pid} AND locktype='advisory' AND objsubid=1) x`);
        assert.deepEqual(locks.filter(l => l.granted).map(l => l.key), expected.slice(0, index));
        assert.deepEqual(locks.filter(l => !l.granted).map(l => l.key), [expected[index]]);
        // Uncontended row locks are absent from pg_locks. A third connection
        // must actually lock both incumbents while Add waits at this key.
        let probe;
        await assert.doesNotReject(async () => {
          probe = await json(`BEGIN; SELECT json_build_object('pid',pg_backend_pid(),
            'workId',(SELECT id FROM public.canonical_works WHERE id=${q(target.workId)} FOR UPDATE NOWAIT),
            'editionId',(SELECT id FROM public.canonical_editions WHERE id=${q(target.editionId)} FOR UPDATE NOWAIT));
            ROLLBACK;`, 'postgres', '', 'ep8-lean-row-probe');
        }, 'incumbent work and edition must remain lockable until all identity advisory locks are held');
        assert.notEqual(probe.pid, evidence.pid); assert.notEqual(probe.pid, holderPid);
        assert.deepEqual({ workId: probe.workId, editionId: probe.editionId }, target);
      },
    });
    linked(await item(f));
  }
});
test('[baseline] AC7-22: aborted saved-reference subtransaction releases its larger key before a smaller-key barrier', async () => {
  const smaller = '-9000000000000000000', larger = '9000000000000000000';
  const statement = `DO $$ BEGIN
    BEGIN PERFORM pg_advisory_xact_lock(${larger}); RAISE SQLSTATE 'P9C01';
    EXCEPTION WHEN SQLSTATE 'P9C01' THEN NULL; END;
    PERFORM pg_advisory_xact_lock(${smaller});
    END $$; SELECT json_build_object('released',true)`;
  const r = await held('aborted-saved-key', 'SELECT pg_advisory_xact_lock(' + smaller + ')', { statement, role: 'postgres' }, {
    inspect: async evidence => {
      const locks = await json(`SELECT coalesce(json_agg(((classid::bigint<<32)|objid::bigint)::text),'[]')
        FROM pg_locks WHERE pid=${evidence.pid} AND locktype='advisory' AND objsubid=1 AND granted`);
      assert.deepEqual(locks, [], 'the larger key from the aborted saved phase must be released before fallback waits');
    },
  });
  assert.deepEqual(r.result, { released: true });
});

test('AC7-22: trusted saved canonical Add uses the same normalized work and compact ISBN keys', async () => {
  await requireLean(db);
  const m = facts({ title: 'The Hobbit', authors: ['J.R.R. Tolkien'], isbn10: null, isbn13: '9780547928227' });
  const target = await seedIncumbent(db, m, { displayKey: true }), f = await canonicalCard(db, m, target);
  const expected = await keys(f.facts, false);
  await held('saved-key-parity', 'SELECT pg_advisory_xact_lock(' + expected[0] + ')', ownerAction(await addSql(f), f), {
    inspect: async evidence => {
      const rows = await json(`SELECT coalesce(json_agg(((classid::bigint<<32)|objid::bigint)::text),'[]') FROM pg_locks
        WHERE pid=${evidence.pid} AND locktype='advisory' AND objsubid=1 AND NOT granted`);
      assert.deepEqual(rows, [expected[0]], 'saved-ID path must enter the shared key protocol');
    },
  });
  linked(await item(f)); assert.equal((await item(f)).canonical_edition_id, f.target.editionId);
});

test('§6.1: saved Add waits for a competing provider resolver and remains unlinked', async () => {
  const m = facts(), target = await seedIncumbent(db, m);
  const f = await automaticCard(db, m, { target: target.editionId, currentSuggestion: true });
  const competing = { ...f.facts, title: 'Competing work', isbn10: null, isbn13: null,
    correlationId: randomUUID(), attemptId: randomUUID() };
  const resolver = `SELECT * FROM marketplace_sec.phase9_catalogue_resolve_v1(${literal(competing)},NULL,
    marketplace_sec.phase9_catalogue_source_policy_v1('open_library'))`;
  await held('saved-provider-conflict', resolver, ownerAction(await addSql(f), f));
  unmatched(await item(f));
  const mapped = await json(`SELECT json_build_object('edition',ids.canonical_edition_id,'source',s.canonical_edition_id)
    FROM public.canonical_provider_ids ids JOIN public.book_metadata_sources s
      ON s.provider=ids.adapter_key AND s.provider_book_id=ids.external_id
    WHERE ids.adapter_key='open_library' AND ids.id_kind='edition' AND ids.external_id='OL100M'`);
  assert.equal(mapped.edition, mapped.source); assert.notEqual(mapped.edition, target.editionId);
  assert.equal(await json('SELECT coalesce(sum(times_chosen),0)::int FROM public.canonical_edition_stats'), 1);
});
