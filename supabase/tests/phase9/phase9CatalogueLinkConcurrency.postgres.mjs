// 02a §§4/7/10: independent REAL roles/connections in the runner's isolated clone.
// No HTTP. Every case truncates its disposable fixtures; no live deletion claim.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, afterEach, beforeEach, test } from 'node:test';
import { json, literal, owner, q, race, service, sql, verifyConnectionsClosed, waitFor } from './editionPickerPostgresConnections.mjs';
import { addSql, card, choices, completeSql, ownerAction, provider, save, selectSql } from './editionPickerPostgresFixture.mjs';
import { enableLibrary, olOperation, olResult, successfulReads } from './openLibraryPostgresFixture.mjs';
import { add, automaticCard, catalogueBytes, effects, facts, helper, labelledCard, linked,
  requireHelper, seedIncumbent, selectionBytes, staleCard, unmatched } from './catalogueLinkFixture.mjs';

// Thin psql adapter lets BOTH engines use the exact same bounded legacy fixtures.
// Actor state is applied on EACH separate connection, never inferred from the last one.
let role = 'postgres', actor = '';
const db = {
  async exec(statement) {
    if (/^(?:RESET ROLE|SET ROLE)\b/.test(statement)) {
      role = statement.match(/SET ROLE (\w+)/)?.[1] ?? 'postgres';
      actor = statement.match(/set_config\('request.jwt.claim.sub','([^']*)'/)?.[1] ?? actor;
      return;
    }
    await sql(statement, role, actor);
  },
  async query(statement, values = []) {
    const rpc = /^SELECT public\./.test(statement);
    statement = statement.replace(/\$(\d+)/g, (_, index) => {
      const value = values[Number(index) - 1];
      return !rpc && Array.isArray(value) && value.every(v => typeof v === 'string')
        ? 'ARRAY[' + value.map(q).join(',') + ']::text[]' : literal(value);
    });
    if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(statement) && !/\bRETURNING\b/i.test(statement)) statement += ' RETURNING *';
    return { rows: await json("WITH r AS (" + statement + ") SELECT coalesce(json_agg(r),'[]') FROM r", role, actor) };
  },
};
async function clean() {
  role = 'postgres'; actor = '';
  await sql('TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE');
  await provider(); await enableLibrary();
  await sql("UPDATE public.phase9_provider_registry SET public_display_allowed=true,provider_kind='metadata',adapter_version='1.0.0',policy_version=1 WHERE adapter_key='open_library'");
}
beforeEach(clean);
afterEach(async () => { await verifyConnectionsClosed(); await clean(); });
after(verifyConnectionsClosed);

async function ol(overrides = {}) {
  const f = await card(), m = facts(overrides);
  const review = { originalTitle: m.title, authors: m.authors, originalLanguage: m.language, script: m.script,
    originalFieldConfirmation: { title: true, authors: m.authors.map(() => true) } };
  await sql('UPDATE public.image_extraction_candidates SET observed_title=' + q(m.title)
    + ',observed_authors=ARRAY[' + m.authors.map(q).join(',') + '],observed_isbn_clue=' + literal(m.isbn13 ?? m.isbn10)
    + ',observed_language=' + q(m.language) + ',owner_review_snapshot=jsonb_set(owner_review_snapshot,\'{value}\',(owner_review_snapshot->\'value\')||' + literal(review) + ') WHERE id=' + q(f.candidateId));
  const p = await olOperation(f); await successfulReads(p);
  const result = olResult(p, m); result.rows = [result.rows[0]];
  result.rows[0].metadata.providerRecordId = m.providerRecordId;
  result.rows[0].googleBooksUrl = 'https://openlibrary.org/books/' + m.providerRecordId;
  assert.equal((await service(completeSql(p, result))).status, 'completed');
  f.selected = await owner(selectSql(f, await choices(f), result.rows[0].optionId), f);
  await save(f); return { ...f, ...p, facts: result.rows[0].metadata };
}
const item = f => json('SELECT row_to_json(i) FROM public.store_inventory i WHERE created_from_candidate_id=' + q(f.candidateId));
const totals = () => json("SELECT json_build_object('works',(SELECT count(*) FROM public.canonical_works),'editions',(SELECT count(*) FROM public.canonical_editions),'inventory',(SELECT count(*) FROM public.store_inventory))");
function accepted(r) { assert.equal(r.ok, true, 'contender command must succeed'); return r.value; }
async function overlap(name, left, right) {
  await requireHelper(db); // absent helper yields assertion, never a barrier timeout.
  let result, error;
  try { result = await race(name, left, right); } catch (caught) { error = caught; }
  assert.equal(error?.message ?? null, null, 'native command must reach the documented Lock wait');
  assert.equal(result.evidence.wait_event_type, 'Lock'); return result;
}

// Extends the existing race API only for rollback/delete/postgres test holders.
// An interactive holder emits a ready marker; pg_stat_activity + pg_blocking_pids
// proves actual waiting before release. Every pending rejection is handled at once.
async function held(name, statement, contender, { rollback = false, afterWait = '', holderRole = 'postgres', holderActor = '', mustWait = true } = {}) {
  const [port, database, psql] = process.argv.slice(2), application = 'ep8-cat-' + name;
  const child = spawn(psql, ['-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', database,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', stderr = '', pending, closedFlag = false;
  child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  const closed = new Promise(resolve => {
    child.on('error', error => { closedFlag = true; resolve({ code: -1, error }); });
    child.on('close', code => { closedFlag = true; resolve({ code }); });
  });
  child.stdin.on('error', () => {});
  child.stdin.write('SET application_name=' + q(application + '-holder') + "; SET statement_timeout='15s'; SET idle_in_transaction_session_timeout='15s';"
    + " SELECT set_config('request.jwt.claim.role'," + q(holderRole) + ",false); SELECT set_config('request.jwt.claim.sub'," + q(holderActor) + ',false); SET ROLE ' + holderRole
    + '; BEGIN; ' + statement + "; SELECT json_build_object('pid',pg_backend_pid());\n\\echo CAT_HELD\n");
  try {
    await waitFor(() => { assert.equal(closedFlag, false, 'holder must reach barrier'); return output.includes('CAT_HELD'); }, name);
    const pid = JSON.parse(output.split(/\r?\n/).find(line => line.startsWith('{"pid"'))).pid;
    pending = sql(contender.statement, contender.role, contender.actor ?? '', application + '-contender')
      .then(value => ({ ok: true, value: JSON.parse(value) }), error => ({ ok: false, error }));
    const evidence = mustWait ? await waitFor(async () => {
      const rows = await json("SELECT coalesce(json_agg(s),'[]') FROM (SELECT a.pid,a.wait_event_type,a.wait_event,pg_blocking_pids(a.pid) AS blockers,"
        + "EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND NOT l.granted) AS pending_lock FROM pg_stat_activity a WHERE a.application_name="
        + q(application + '-contender') + " AND a.wait_event_type='Lock' AND " + pid + '=ANY(pg_blocking_pids(a.pid))) s');
      return rows[0];
    }, name + ' Lock') : null;
    if (mustWait) {
      assert.equal(evidence.pending_lock, true); console.log('CATALOGUE_LOCK ' + JSON.stringify({ name, holder: pid, ...evidence }));
    } else {
      // A completed receipt MUST return before holder release, independent of
      // catalogue/session locks. Bound the no-wait requirement to 5 seconds.
      let timer;
      const completed = await Promise.race([pending, new Promise(resolve => { timer = setTimeout(() => resolve(null), 5000); })]);
      clearTimeout(timer); assert.ok(completed, 'replay must finish while catalogue/session holder is still open');
      assert.equal(completed.ok, true, 'replay succeeds without catalogue reevaluation');
      assert.equal(await sql('SELECT state FROM pg_stat_activity WHERE pid=' + pid), 'idle in transaction');
    }
    child.stdin.end(afterWait + ';' + (rollback ? 'ROLLBACK' : 'COMMIT') + ';\n\\q\n');
    const [finished, result] = await Promise.all([closed, pending]);
    assert.equal(finished.code, 0, 'holder transaction must finish');
    return { result, evidence, output };
  } catch (error) {
    assert.fail('native barrier/command contract failed: ' + error.message.replace(/private-[\w-]+/g, '[redacted]'));
  } finally {
    if (!closedFlag) child.stdin.end('ROLLBACK;\n\\q\n');
    await closed; if (pending) await pending;
    assert.equal(stderr.includes('deadlock detected'), false, 'no deadlock');
  }
}

// AC6-0 RED: helper absent/no work-key wait. Reversed case/order uses one exact key.
test('AC6-0: key-order race shares one work across distinct ISBNs', async () => {
  const a = await ol(), b = await ol({ authors: ['a. author', 'B. AUTHOR'], providerRecordId: 'OL101M', isbn10: null, isbn13: '9780547928227' });
  const r = await overlap('cat-key-order', ownerAction(await addSql(a), a), ownerAction(await addSql(b), b));
  accepted(r.contender); const x = await item(a), y = await item(b); linked(x); linked(y);
  assert.equal(x.canonical_work_id, y.canonical_work_id); assert.deepEqual(await totals(), { works: 1, editions: 2, inventory: 2 });
});

// AC6-3 RED: helper missing/no unique-key waiting or linked convergence.
for (const rollback of [false, true]) test('AC6-3: shared ISBN race first writer ' + (rollback ? 'rolls back' : 'commits'), async () => {
  const a = await ol(), b = await ol(), left = await addSql(a), right = ownerAction(await addSql(b), b);
  await requireHelper(db);
  const r = await held('same-isbn-' + rollback, left, right, { rollback, holderRole: 'authenticated', holderActor: a.ownerId });
  accepted(r.result); linked(await item(b)); assert.deepEqual(await totals(), { works: 1, editions: 1, inventory: rollback ? 1 : 2 });
  if (!rollback) { linked(await item(a)); assert.equal((await item(a)).canonical_edition_id, (await item(b)).canonical_edition_id); }
});

// AC6-7 RED: linked fixture absent; same-key lock/replay itself already green.
test('AC6-7: concurrent same-command Add returns one identical receipt and one effect', async () => {
  const f = await ol(), command = await addSql(f), chosen = await selectionBytes(db, f);
  const r = await overlap('cat-replay', ownerAction(command, f), ownerAction(command, f));
  assert.deepEqual(accepted(r.contender), r.held); linked(await item(f));
  const before = await effects(db, f); assert.deepEqual(await owner(command, f), r.held);
  assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true);
  assert.equal(await selectionBytes(db, f) === chosen, true); assert.deepEqual(await totals(), { works: 1, editions: 1, inventory: 1 });
});

// AC6-12 RED: helper/ISBN conflict recovery absent; skip-only result already green.
for (const cross of [false, true]) test('AC6-12: conflicting title and crossed ISBN keys leave no losing work ' + cross, async () => {
  const a = await ol(), b = await ol({ title: 'Conflicting Work' });
  if (cross) {
    // 02a §§5.1/10: postgres-only bounded legacy bypass of completion/selection,
    // changing ONLY mutable chosen state; no constraint/trigger is disabled.
    // Valid checksums, different editions: 0306406152 -> 9780306406157, whereas
    // 9780804429573 pairs with 080442957X. ISBN-10 still hits A's incumbent.
    // clean() empties both canonical tables; A uses 9780306406157, so neither
    // this ISBN-13 nor the former Hobbit ISBN-13 has an unrelated incumbent.
    const pair = { isbn10: '0306406152', isbn13: '9780804429573' };
    Object.assign(b.facts, pair);
    // literal(object) emits JSON strings; literal(isbn13) alone was parsed as a
    // JSON number by jsonb_set, violating check1's valid_metadata shape gate.
    await sql('UPDATE public.phase9_candidate_edition_state SET selected_option_snapshot=selected_option_snapshot||' + literal(pair) + ' WHERE candidate_id=' + q(b.candidateId));
  }
  if (cross) {
    await requireHelper(db); await owner(await addSql(a), a); const before = await catalogueBytes(db);
    await add(db, b); unmatched(await item(b)); assert.deepEqual(await catalogueBytes(db), before);
  }
  else {
    await requireHelper(db);
    const capture = `; SELECT json_build_object('incumbentBytes',jsonb_build_array(
      (SELECT jsonb_agg(to_jsonb(w) ORDER BY to_jsonb(w)::text)::text FROM public.canonical_works w),
      (SELECT jsonb_agg(to_jsonb(e) ORDER BY to_jsonb(e)::text)::text FROM public.canonical_editions e)))`;
    const r = await held('conflicting-title', await addSql(a) + capture, ownerAction(await addSql(b), b), { holderRole: 'authenticated', holderActor: a.ownerId });
    accepted(r.result); linked(await item(a)); unmatched(await item(b));
    const incumbent = JSON.parse(r.output.split(/\r?\n/).find(line => line.includes('"incumbentBytes"'))).incumbentBytes;
    assert.deepEqual(await catalogueBytes(db), incumbent, 'first writer canonical bytes are unchanged by loser');
  }
  assert.deepEqual(await totals(), { works: 1, editions: 1, inventory: 2 });
});

// AC6-12 RED: helper defensive unique_violation recovery absent. One-shot fixture
// trigger raises each REAL constraint name; sequence state survives subtransaction
// rollback so an accidental retry INSERT is detectable. No production SQL altered.
for (const constraint of ['canonical_works_title_normalized_primary_authors_key', 'canonical_editions_isbn_10_unique', 'canonical_editions_isbn_13_unique']) {
  test('AC6-12: recognized ' + constraint + ' rolls back the attempted work without retrying writes', async () => {
    const f = await ol(); await requireHelper(db);
    const table = constraint.startsWith('canonical_works') ? 'canonical_works' : 'canonical_editions';
    await sql(`CREATE SEQUENCE public.catalogue_test_violation;
      CREATE FUNCTION public.catalogue_test_violate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF nextval('public.catalogue_test_violation')=1 THEN RAISE unique_violation USING CONSTRAINT=${q(constraint)}; END IF; RETURN NEW; END$$;
      CREATE TRIGGER catalogue_test_violate BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.catalogue_test_violate()`);
    try {
      const before = await catalogueBytes(db); unmatched((await add(db, f)).item);
      assert.deepEqual(await catalogueBytes(db), before); assert.equal(await sql('SELECT last_value FROM public.catalogue_test_violation'), '1');
    } finally { await sql(`DROP TRIGGER catalogue_test_violate ON public.${table}; DROP FUNCTION public.catalogue_test_violate(); DROP SEQUENCE public.catalogue_test_violation`); }
  });
}

// AC6-12 RED: helper/reselect missing. Privileged INCUMBENT fixture holds one
// unique key uncommitted; real Owner Add waits, then reuses fresh committed rows.
// Test both key orientations; absent optional ISBN is never filled by the loser.
for (const key of ['isbn_10', 'isbn_13']) test('AC6-12: native ' + key + ' unique-key winner is reselected without updating it', async () => {
  const f = await ol(), workId = randomUUID(), editionId = randomUUID(); await requireHelper(db);
  const setup = 'INSERT INTO public.canonical_works(id,title_normalized,primary_title,primary_authors) VALUES('
    + [workId, 'catalogue sample', f.facts.title].map(q).join(',') + ",ARRAY['a. author','b. author']);"
    + 'INSERT INTO public.canonical_editions(id,work_id,' + key + ',title,authors) VALUES('
    + [editionId, workId, key === 'isbn_10' ? f.facts.isbn10 : f.facts.isbn13, f.facts.title].map(q).join(',') + ",ARRAY['B. Author','A. Author']);"
    + "SELECT json_build_object('incumbentBytes',jsonb_build_array((SELECT jsonb_agg(to_jsonb(w) ORDER BY to_jsonb(w)::text)::text FROM public.canonical_works w),"
    + '(SELECT jsonb_agg(to_jsonb(e) ORDER BY to_jsonb(e)::text)::text FROM public.canonical_editions e)))';
  const r = await held('crossed-' + key, setup, ownerAction(await addSql(f), f));
  accepted(r.result); const saved = await item(f); linked(saved); assert.equal(saved.canonical_edition_id, editionId);
  assert.deepEqual(await totals(), { works: 1, editions: 1, inventory: 1 });
  const before = JSON.parse(r.output.split(/\r?\n/).find(line => line.includes('"incumbentBytes"'))).incumbentBytes;
  assert.deepEqual(await catalogueBytes(db), before);
});

// AC6-13 RED: helper absent; work-key race must not be mistaken for ISBN conflict.
test('AC6-13: distinct ISBNs race one work and persist two editions', async () => {
  const a = await ol(), b = await ol({ providerRecordId: 'OL101M', isbn10: null, isbn13: '9791090636071' });
  const r = await overlap('cat-two-isbns', ownerAction(await addSql(a), a), ownerAction(await addSql(b), b));
  accepted(r.contender); linked(await item(a)); linked(await item(b));
  assert.equal((await item(a)).canonical_work_id, (await item(b)).canonical_work_id);
  assert.notEqual((await item(a)).canonical_edition_id, (await item(b)).canonical_edition_id);
  assert.deepEqual(await totals(), { works: 1, editions: 2, inventory: 2 });
});

// AC6-21 RED: helper work/edition SHARE locks absent. The option is non-FK JSON,
// so deleting this ISBN incumbent is a REAL allowed delete race, not STALE-CAN.
for (const target of ['canonical_works', 'canonical_editions']) test('AC6-21: Add-held ' + target + ' target blocks deletion until inventory commit', async () => {
  const f = await ol(), targetIds = await seedIncumbent(db, f.facts); await requireHelper(db);
  const id = target === 'canonical_works' ? targetIds.workId : targetIds.editionId;
  const r = await held('delete-after-' + target, await addSql(f),
    { role: 'postgres', statement: 'WITH d AS (DELETE FROM public.' + target + ' WHERE id=' + q(id) + ' RETURNING id) SELECT count(*)::int FROM d' },
    { holderRole: 'authenticated', holderActor: f.ownerId });
  assert.equal(accepted(r.result), 1); const saved = await item(f);
  if (target === 'canonical_works') assert.equal(saved.canonical_work_id, null); else assert.equal(saved.canonical_edition_id, null);
  assert.equal((await totals()).inventory, 1);
});

// AC6-21 RED: disappearance-safe resolution missing; delete wins the prospective
// work lock and is observed after waiting. Snapshot/state are unchanged.
test('AC6-21: committed deletion before helper work lock yields no orphan repair', async () => {
  const f = await ol(), target = await seedIncumbent(db, f.facts), chosen = await selectionBytes(db, f); await requireHelper(db);
  const r = await held('delete-wins', 'DELETE FROM public.canonical_works WHERE id=' + q(target.workId), ownerAction(await addSql(f), f));
  accepted(r.result); unmatched(await item(f)); assert.equal(await selectionBytes(db, f) === chosen, true);
  assert.equal((await totals()).works, 0);
});

// AC6-21 RED: no new helper link. Actual non-FK option target can be deleted
// before Add's FIRST probe; a new edition is then created from retained facts.
test('AC6-21: edition deletion committed before initial eligibility uses retained OL identity', async () => {
  const f = await ol(), target = await seedIncumbent(db, f.facts), chosen = await selectionBytes(db, f);
  await sql('DELETE FROM public.canonical_editions WHERE id=' + q(target.editionId));
  const result = await add(db, f); linked(result.item); assert.notEqual(result.item.canonical_edition_id, target.editionId);
  assert.equal(result.item.canonical_work_id, target.workId); assert.equal(await selectionBytes(db, f) === chosen, true);
});

// AC6-21 RED: gate's missing-target local-copy fallback absent. Test-only wrapper
// pauses immediately before/after the ORDINARY eligibility evaluation; original
// definition/ACL is preserved by rename and restored in finally. Neither Add nor
// catalogue helper is replaced. Actual work deletion is FK-legal in both windows.
for (const window of ['before-eligibility', 'after-eligibility']) for (const edition of [false, true]) test('AC6-21: delete between absence probe and ' + window + (edition ? ' edition' : ' work') + ' is rechecked', async () => {
  const f = edition ? await ol() : await labelledCard(db, 'CAN');
  if (edition) f.target = await seedIncumbent(db, f.facts);
  const chosen = await selectionBytes(db, f); await requireHelper(db);
  const lock = 81921, signature = '(public.image_extraction_candidates)';
  await sql('ALTER FUNCTION marketplace_sec.phase9_unit7a_commit_eligible' + signature + ' RENAME TO catalogue_test_original_eligible');
  await sql(`CREATE FUNCTION marketplace_sec.phase9_unit7a_commit_eligible(c public.image_extraction_candidates)
    RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE accepted boolean; BEGIN
    ${window === 'before-eligibility' ? 'PERFORM pg_catalog.pg_advisory_xact_lock(' + lock + ');' : ''}
    accepted:=marketplace_sec.catalogue_test_original_eligible(c);
    ${window === 'after-eligibility' ? 'PERFORM pg_catalog.pg_advisory_xact_lock(' + lock + ');' : ''}
    RETURN accepted; END$$;
    REVOKE ALL ON FUNCTION marketplace_sec.phase9_unit7a_commit_eligible${signature} FROM PUBLIC,anon,authenticated,service_role`);
  try {
    const r = await held(window, 'SELECT pg_advisory_xact_lock(' + lock + ')', ownerAction(await addSql(f), f),
      { afterWait: 'DELETE FROM public.' + (edition ? 'canonical_editions' : 'canonical_works') + ' WHERE id=' + q(edition ? f.target.editionId : f.target.workId) });
    accepted(r.result);
    if (edition) { linked(await item(f)); assert.notEqual((await item(f)).canonical_edition_id, f.target.editionId); }
    else unmatched(await item(f));
    assert.equal(await selectionBytes(db, f) === chosen, true);
  } finally { await sql('DROP FUNCTION marketplace_sec.phase9_unit7a_commit_eligible' + signature
    + '; ALTER FUNCTION marketplace_sec.catalogue_test_original_eligible' + signature + ' RENAME TO phase9_unit7a_commit_eligible'); }
});

// AC6-22 RED: M69 edition-only orphan links; helper lock/recheck contract absent.
test('AC6-22: real work delete racing a saved CAN produces NULL/NULL and existing edition hydration', async () => {
  const f = await labelledCard(db, 'CAN'); await requireHelper(db);
  const r = await held('orphan-can', 'DELETE FROM public.canonical_works WHERE id=' + q(f.target.workId), ownerAction(await addSql(f), f));
  accepted(r.result); const saved = await item(f); unmatched(saved); assert.equal(saved.publisher, f.facts.publisher);
  assert.equal((await totals()).works, 0);
});

// AC6-23 RED: establishing first stale Add/fallback missing; replay is green today.
for (const admitted of [false, true]) test('AC6-23: stale-target receipt ' + admitted + ' replays while catalogue changes', async () => {
  const f = await staleCard(db, { admitted }), first = await add(db, f); await requireHelper(db);
  if (admitted) linked(first.item); else unmatched(first.item);
  // Real edition delete is allowed: the stale immutable snapshot references a
  // DIFFERENT absent UUID; inventory FK has SET NULL. Holding the session row
  // makes the delete transaction and replay overlap without locking the helper.
  const change = admitted ? 'DELETE FROM public.canonical_editions WHERE id=' + q(first.item.canonical_edition_id)
    : 'UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key=\'open_library\'';
  const beforeChosen = await selectionBytes(db, f);
  const r = await held('stale-replay-' + admitted, change + '; SELECT id FROM public.image_extraction_sessions WHERE id=' + q(f.sessionId) + ' FOR UPDATE',
    ownerAction(first.command, f), { mustWait: false });
  assert.deepEqual(accepted(r.result), first.receipt);
  assert.equal(await selectionBytes(db, f) === beforeChosen, true);
  const before = await effects(db, f); assert.deepEqual(await owner(first.command, f), first.receipt);
  assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true);
  if (admitted) { assert.equal((await item(f)).canonical_edition_id, null); assert.equal((await item(f)).canonical_work_id, first.item.canonical_work_id); }
  else unmatched(await item(f));
});

// AC6-24 RED: broad grants reproduced by fixture; RLS alone cannot deny TRUNCATE.
test('AC6-24: actual anon/authenticated roles lose all six writes, retain SELECT; postgres Add creates rows', async () => {
  const f = await ol();
  for (const client of ['anon', 'authenticated']) for (const table of ['canonical_works', 'canonical_editions']) {
    assert.equal(await sql('SELECT current_user', client), client);
    assert.equal(await sql('SELECT count(*) FROM public.' + table, client), '0');
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const allowed = await sql("SELECT has_table_privilege(" + q(client) + ',' + q('public.' + table) + ',' + q(privilege) + ')');
      assert.equal(allowed, 'f', client + ' ' + privilege + ' ' + table);
    }
    for (const command of [
      'INSERT INTO public.' + table + '(id,' + (table === 'canonical_works' ? 'title_normalized,primary_title' : 'title') + ') VALUES('
        + q(randomUUID()) + ',' + (table === 'canonical_works' ? "'untrusted','untrusted'" : "'untrusted'") + ')',
      'UPDATE public.' + table + ' SET ' + (table === 'canonical_works' ? 'primary_title' : 'title') + "='untrusted'",
      'DELETE FROM public.' + table, 'TRUNCATE public.' + table + ' CASCADE',
    ]) await assert.rejects(sql(command, client, f.ownerId), /permission denied/);
  }
  await requireHelper(db);
  for (const client of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await sql("SELECT has_function_privilege(" + q(client) + ',' + q(helper) + ",'EXECUTE')"), 'f');
    await assert.rejects(sql('SELECT * FROM marketplace_sec.phase9_catalogue_link_for_add_v1(' + [f.candidateId, f.sessionId, f.storeId].map(q).join(',') + ')', client, f.ownerId), /permission denied/);
  }
  const receipt = await owner(await addSql(f), f); assert.equal(receipt.outcome, 'committed_private'); linked(await item(f));
  for (const client of ['anon', 'authenticated']) assert.equal(await sql('SELECT count(*) FROM public.canonical_editions', client), '1');
});

// AC6-25 RED: selected OL no helper IDs; sparse incumbent must never null chosen facts.
test('AC6-25: selected OL waits for sparse incumbent lock but hydrates provider snapshot', async () => {
  const f = await automaticCard(db), target = await seedIncumbent(db, f.facts, { sparse: true }); await requireHelper(db);
  const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  const r = await held('sparse-selected', 'SELECT id FROM public.canonical_editions WHERE id=' + q(target.editionId) + ' FOR UPDATE', ownerAction(await addSql(f), f));
  accepted(r.result); const saved = await item(f); linked(saved); assert.equal(saved.canonical_edition_id, target.editionId);
  assert.deepEqual([saved.publisher, saved.published_date, saved.cover_url], [f.facts.publisher, f.facts.publishedDate, f.facts.coverReference]);
  assert.deepEqual(await catalogueBytes(db), before); assert.equal(await selectionBytes(db, f) === chosen, true);
});
