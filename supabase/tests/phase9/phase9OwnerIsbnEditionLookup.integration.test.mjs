// Slice 5a SDD §§5/7/11–12: real SQL boundaries, synthetic provider evidence, no network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { createCommitDatabase, reviewValue, saveReview } from './editionPickerCommitFixture.mjs';
import { seedAutomaticLineage } from './editionPickerFixture.mjs';
import { claimJob, lookupSql, metadata, readSql, resetActor, row, scalar, seedCard, selectSql, setActor } from './editionPickerFixture.mjs';
import { complete, finalize, prepareCall, rpc, token, worker } from './editionOptionsCompletionFixture.mjs';

const M78 = '20261022000078_marketplace_phase9_owner_isbn_edition_lookup.sql';
const M79 = '20261023000079_marketplace_phase9_isbn_match_metadata_state.sql';
const M80 = '20261023000080_marketplace_phase9_manual_card_and_current_match_state.sql';
const isbn = '9780306406157';
const key = '["p9-metadata-lookup-v1", "p9-bibliographic-normalizer-v1", "isbn", "9780306406157", "", [], "und", []]';
let db;
before(async () => {
  db = await createCommitDatabase();
  for (const file of [
    '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
    '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
    '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
    '20261011000073_marketplace_phase9_open_library_edition_options.sql',
    '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
    '20261016000076_marketplace_phase9_edition_explicit_matching.sql',
    '20261017000075_marketplace_phase9_edition_picker_exhausted_lookup_recovery.sql',
    '20261017000077_marketplace_phase9_edition_matching_variants.sql',
    M78,
    M79,
    M80,
  ]) {
    if (file === M78) {
      // SDD §5.5: reproduce postgres's live public-function default ACL before creation.
      await db.exec(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
        GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;`);
    }
    const sql = fs.readFileSync(migrationPath(file), 'utf8');
    try { await db.exec(sql); }
    catch (error) {
      console.error(file, { message: error.message, position: error.position, where: error.where,
        internalPosition: error.internalPosition, internalQuery: error.internalQuery });
      throw error;
    }
  }
});
after(async () => { await db?.close(); });

async function truth(f) {
  await resetActor(db);
  const c = (await db.query('SELECT * FROM public.image_extraction_candidates WHERE id=$1', [f.candidateId])).rows[0];
  await setActor(db, f.ownerId);
  return c;
}
async function state(f) {
  await resetActor(db);
  const s = (await db.query('SELECT * FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
  await setActor(db, f.ownerId);
  return s;
}
async function setIsbn(f, value = isbn, options = {}) {
  return rpc(db, 'phase9_set_candidate_isbn_v1', [f.sessionId, f.candidateId,
    options.command === undefined ? randomUUID() : options.command,
    options.key === undefined ? randomUUID() : options.key,
    options.version === undefined ? (await truth(f)).version : options.version, value]);
}
async function identity(f) {
  await resetActor(db);
  const r = (await db.query('SELECT marketplace_sec.phase9_edition_query_identity(c) FROM public.image_extraction_candidates c WHERE id=$1', [f.candidateId])).rows[0];
  await setActor(db, f.ownerId);
  return Object.values(r)[0];
}
async function mutate(f, sql, values) {
  await resetActor(db); await db.query(sql, values); await setActor(db, f.ownerId);
}
async function editedReview(f, changes = {}) {
  const review = { ...await reviewValue(db, f), ...changes };
  review.originalFieldConfirmation = { title: true, authors: review.authors.map(() => true) };
  if (Object.keys(changes).length) review.metadataChoice = { mode: 'manual', selectionId: null };
  return review;
}
async function seedOptions(_db, f, rows) {
  const generation = (await state(f))?.request_generation ?? 0;
  const receipt = await scalar(db, lookupSql(f, generation));
  await resetActor(db);
  await db.exec("INSERT INTO public.phase9_provider_registry(adapter_key,provider_kind,adapter_version,enabled,matching_allowed,storage_allowed,revalidation_seconds,policy_version) VALUES('google_books','metadata','1.0.0',true,true,true,86400,1) ON CONFLICT(adapter_key) DO UPDATE SET enabled=true,matching_allowed=true,storage_allowed=true");
  const context = await scalar(db, await claimJob(db, f, receipt.operationId));
  const operation = { ...f, jobId: receipt.operationId, context, attempt: 1 };
  await prepareCall(db, operation); await finalize(db, operation);
  const fetched = new Date().toISOString(), deadline = new Date(Date.parse(fetched) + 3600000).toISOString();
  rows = rows.map(r => ({ ...r, metadata: r.metadata && { ...r.metadata, fetchedAt: fetched,
    correlationId: operation.lookupId, attemptId: operation.attemptId } }));
  await complete(db, operation, { rows, fetched, deadline });
  await setActor(db, f.ownerId);
  return { receipt, rows, choices: await scalar(db, readSql(f)) };
}

test('M78 readback: null column, shape-only check, update trigger, postgres owners and exact ACLs', async () => {
  await resetActor(db);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.image_extraction_candidates WHERE owner_isbn13 IS NOT NULL'), 0);
  const definition = await scalar(db, "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='phase9_candidate_owner_isbn13_shape'");
  assert.match(definition, /97\[89\]\[0-9\]/);
  assert.doesNotMatch(definition, /normalized_isbn/);
  assert.match(await scalar(db, "SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname='phase9_edition_identity_change'"), /UPDATE OF[^]*owner_isbn13/);
  const functions = ['phase9_edition_query_identity', 'phase9_edition_worker_context', 'phase9_edition_identity_change',
    'phase9_edition_effective_title', 'phase9_edition_effective_authors', 'phase9_set_candidate_isbn_v1',
    'phase9_edition_option_eligible', 'phase9_register_edition_options_provider_call_v1',
    'phase9_complete_candidate_edition_options_v1', 'phase9_edition_choices'];
  const owners = (await db.query("SELECT p.proname,r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname=ANY($1) AND (n.nspname='marketplace_sec' OR (n.nspname='public' AND p.proname='phase9_set_candidate_isbn_v1'))", [functions])).rows;
  assert.equal(owners.length, functions.length);
  assert.equal(owners.every(r => r.rolname === 'postgres'), true);
  for (const helper of ['phase9_edition_effective_title', 'phase9_edition_effective_authors']) {
    const signature = 'marketplace_sec.' + helper + '(public.image_extraction_candidates)';
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, signature])).rows[0].allowed, false);
    }
    assert.equal((await db.query("SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS private", [signature])).rows[0].private, true);
  }
  const command = 'public.phase9_set_candidate_isbn_v1(uuid,uuid,uuid,text,integer,text)';
  assert.equal((await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed", [command])).rows[0].allowed, false);
  assert.equal((await db.query("SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed", [command])).rows[0].allowed, false);
  assert.equal((await db.query("SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE') AS private", [command])).rows[0].private, true);
  assert.equal((await db.query("SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS allowed", [command])).rows[0].allowed, true);
});

test('unchanged null without state returns generation zero and performs no write', async () => {
  const f = await seedCard(db), before = await truth(f);
  const response = await setIsbn(f, null);
  assert.deepEqual(response, { sessionId: f.sessionId, candidateId: f.candidateId,
    candidateVersion: before.version, metadataRevision: before.metadata_revision, requestGeneration: 0, ownerIsbn13: null });
  assert.equal(await state(f), undefined);
  assert.deepEqual(await truth(f), before);
});

test('column shape permits valid shape without invoking private checksum helper for service writes', async () => {
  const f = await seedCard(db);
  await setActor(db, f.ownerId, 'service_role');
  await db.query('UPDATE public.image_extraction_candidates SET owner_isbn13=$1 WHERE id=$2', ['9780306406158', f.candidateId]);
  for (const invalid of ['0306406152', '978-0306406157', '9770306406157', '978030640615X']) {
    await assert.rejects(db.query('UPDATE public.image_extraction_candidates SET owner_isbn13=$1 WHERE id=$2', [invalid, f.candidateId]), /phase9_candidate_owner_isbn13_shape/);
  }
});

test('set stores the ISBN-only exact key, advances versions and generation, keeps observed facts', async () => {
  const f = await seedCard(db), before = await truth(f);
  const response = await setIsbn(f);
  assert.equal(response.sessionId, f.sessionId); assert.equal(response.candidateId, f.candidateId);
  assert.equal(response.ownerIsbn13, isbn); assert.equal(response.candidateVersion, before.version + 1);
  assert.equal(response.metadataRevision, before.metadata_revision + 1); assert.equal(response.requestGeneration, 1);
  assert.equal(await identity(f), key); assert.equal((await state(f)).query_identity, key);
  const after = await truth(f);
  assert.equal(after.observed_title, before.observed_title); assert.deepEqual(after.observed_authors, before.observed_authors);
  assert.equal(after.review_ready, false); assert.equal(after.owner_review_snapshot.value.metadataChoice.mode, 'manual');
  assert.ok(new Date(after.updated_at) >= new Date(before.updated_at));
});

test('owner ISBN overrides a different observed ISBN in the exact edition-only key', async () => {
  const observedIsbn = '9780140449136';
  const f = await seedCard(db, { isbn: observedIsbn });
  await setIsbn(f, isbn);
  const c = await truth(f);
  assert.equal(c.observed_isbn_clue, observedIsbn);
  assert.equal(c.owner_isbn13, isbn);
  assert.equal(await identity(f), key);
  assert.equal((await state(f)).query_identity, key);
});

test('command rejects non-ISBN prefixes, invalid checksum, raw ISBN-10, null command and invalid idempotency keys', async () => {
  const f = await seedCard(db), before = await truth(f);
  for (const value of ['9780306406158', '9770306406158', '0306406152', '978-0306406157', '']) {
    await assert.rejects(setIsbn(f, value), /P9_REQUEST_INVALID/);
  }
  await assert.rejects(setIsbn(f, isbn, { command: null }), /P9_REQUEST_INVALID/);
  await assert.rejects(setIsbn(f, isbn, { key: 'short' }), /P9_REQUEST_INVALID/);
  await assert.rejects(setIsbn(f, isbn, { key: null }), /P9_REQUEST_INVALID/);
  assert.deepEqual(await truth(f), before);
});

test('exact replay writes once, changed ISBN/version mismatches, new stale unchanged command conflicts', async () => {
  const f = await seedCard(db), before = await truth(f);
  const options = { version: before.version, key: randomUUID(), command: randomUUID() };
  const first = await setIsbn(f, isbn, options);
  assert.deepEqual(await setIsbn(f, isbn, options), first);
  await assert.rejects(setIsbn(f, '9780140449136', options), /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(setIsbn(f, isbn, { ...options, version: first.candidateVersion }), /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(setIsbn(f, isbn, { version: before.version }), /P9_CANDIDATE_VERSION_CONFLICT/);
  const unchanged = await setIsbn(f);
  assert.equal(unchanged.candidateVersion, first.candidateVersion);
  assert.equal(unchanged.requestGeneration, first.requestGeneration);
});

test('unknown candidate, other Owner and store/session mismatch cannot change ISBN', async () => {
  const f = await seedCard(db), other = await seedCard(db), before = await truth(f);
  await setActor(db, other.ownerId);
  await assert.rejects(setIsbn(f, isbn, { version: before.version }), /P9_NOT_FOUND|P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, f.ownerId);
  await assert.rejects(setIsbn({ ...f, candidateId: randomUUID() }, isbn, { version: before.version }), /P9_NOT_FOUND/);
  await assert.rejects(setIsbn({ ...f, candidateId: other.candidateId }, isbn, { version: before.version }), /P9_NOT_FOUND/);
  assert.deepEqual(await truth(f), before);
});

for (const [label, update] of [
  ['closed session', "UPDATE public.image_extraction_sessions SET status='closed' WHERE id=$1"],
  ['committed card', "UPDATE public.image_extraction_candidates SET state='committed' WHERE id=$1"],
  ['removed card', "UPDATE public.image_extraction_candidates SET review_disposition='owner_removed_from_scan' WHERE id=$1"],
  ['expired card', "UPDATE public.image_extraction_candidates SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1"],
]) test(label + ' refuses the command without saving ISBN', async () => {
  const f = await seedCard(db);
  await mutate(f, update, [label === 'closed session' ? f.sessionId : f.candidateId]);
  await assert.rejects(setIsbn(f), /P9_STATE_CONFLICT/);
  assert.equal((await truth(f)).owner_isbn13, null);
});

for (const [label, change, clears] of [
  ['title edit', { originalTitle: 'A different book' }, true],
  ['authors edit', { authors: ['Different Author'] }, true],
  ['same-title save', {}, false],
  ['case and spacing title edit', { originalTitle: '  THE   fixture BOOK  ' }, false],
  ['case and spacing author edit', { authors: ['  FIXTURE   author  ', ' SECOND AUTHOR '] }, false],
  ['language edit', { originalLanguage: 'fr' }, false],
]) test('trigger ' + label + (clears ? ' clears ISBN and choice' : ' keeps ISBN'), async () => {
  const f = await seedCard(db);
  if (label.startsWith('case and spacing')) {
    // The review command accepts canonical text. Raw observations retain OCR spacing;
    // the first canonical save must compare normalized effective values on the trigger.
    const review = await editedReview(f), c = await truth(f);
    await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL,observed_title=$1,observed_authors=$2 WHERE id=$3',
      [change.originalTitle ?? c.observed_title, change.authors ? [change.authors[0]] : c.observed_authors, f.candidateId]);
    await setIsbn(f); await saveReview(db, f, review);
    assert.equal((await truth(f)).owner_isbn13, isbn);
    return;
  }
  await setIsbn(f);
  const saved = await seedOptions(db, f, [row()]);
  await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
  assert.equal((await truth(f)).owner_isbn13, isbn, 'coherent selection retains ISBN');
  await saveReview(db, f, await editedReview(f, change));
  const c = await truth(f), s = await state(f);
  assert.equal(c.owner_isbn13, clears ? null : isbn);
  if (clears) { assert.equal(s.selection_id, null); assert.equal(c.owner_review_snapshot.value.metadataChoice.mode, 'manual'); }
  else assert.equal(await identity(f), key);
});

test('first review save from a null snapshot retains ISBN when effective facts are unchanged', async () => {
  const f = await seedCard(db), review = await editedReview(f);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  await setIsbn(f); await saveReview(db, f, review);
  assert.equal((await truth(f)).owner_isbn13, isbn);
});

test('clear rule runs even with no edition-state row', async () => {
  const f = await seedCard(db); await setIsbn(f);
  await mutate(f, 'DELETE FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId]);
  await saveReview(db, f, await editedReview(f, { originalTitle: 'New title without edition state' }));
  assert.equal((await truth(f)).owner_isbn13, null);
});

test('observed clue/language updates in ISBN mode keep the state on the ISBN key', async () => {
  const f = await seedCard(db); await setIsbn(f); const before = await state(f);
  await mutate(f, "UPDATE public.image_extraction_candidates SET observed_language='fr',observed_publisher_clue='Changed Press' WHERE id=$1", [f.candidateId]);
  assert.equal((await state(f)).query_identity, key);
  assert.equal((await state(f)).request_generation, before.request_generation);
  assert.equal((await truth(f)).owner_isbn13, isbn);
});

test('AC5a-16: clear with equal scanned ISBN and chosen edition resets to title key; next request succeeds', async () => {
  const f = await seedCard(db, { isbn }); await setIsbn(f);
  const saved = await seedOptions(db, f, [row()]);
  await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
  const cleared = await setIsbn(f, null), s = await state(f);
  assert.equal(s.selection_id, null); assert.equal(s.query_identity, await identity(f));
  assert.notEqual(JSON.parse(s.query_identity)[2], 'isbn');
  assert.equal((await truth(f)).owner_review_snapshot.value.metadataChoice.mode, 'manual');
  const receipt = await scalar(db, lookupSql(f, cleared.requestGeneration));
  assert.equal(receipt.status, 'pending'); assert.notEqual(receipt.operationId, saved.receipt.operationId);
});

test('ISBN change resets coherent selection and supersedes the pending request', async () => {
  const f = await seedCard(db); await setIsbn(f);
  const saved = await seedOptions(db, f, [row()]);
  await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
  const before = await truth(f), response = await setIsbn(f, '9780140449136');
  assert.equal((await state(f)).selection_id, null);
  assert.equal(response.metadataRevision, before.metadata_revision + 1);
  assert.equal(JSON.parse(await identity(f))[3], '9780140449136');
  const receipt = await scalar(db, lookupSql(f, response.requestGeneration));
  await claimJob(db, f, receipt.operationId);
  await setActor(db, f.ownerId);
  await setIsbn(f, isbn);
  assert.equal((await state(f)).request_id, null);
  await setActor(db, f.ownerId, 'service_role');
  const superseded = await rpc(db, 'phase9_resolve_superseded_edition_job_v1', [receipt.operationId, worker, token, 1]);
  assert.equal(superseded.status, 'resolved_noop');
});

test('exact ISBN eligibility ignores wrong scanned title and English language, includes ISBN-10-only foreign fixture', async () => {
  await resetActor(db);
  for (const facts of [metadata, { ...metadata, language: 'fr', title: 'Titre français' },
    { ...metadata, isbn13: null, isbn10: '0306406152', language: 'fr', title: 'Titre français' }]) {
    assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_option_eligible($1::jsonb,$2) AS eligible', [facts, key])).rows[0].eligible, true);
  }
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_option_eligible($1::jsonb,$2) AS eligible', [{ ...metadata, isbn13: '9780140449136', isbn10: null }, key])).rows[0].eligible, false);
});

test('v2 ownerIsbn13 exists with no rows; no/v1 headers retain their strict old response shape', async () => {
  const f = await seedCard(db); await setIsbn(f);
  for (const [header, ownerField] of [['', false], ['bookconnect/edition-reasons-v1', false], ['bookconnect/edition-reasons-v2', true]]) {
    await db.query("SELECT set_config('request.headers',$1,false)", [JSON.stringify({ 'x-client-info': header })]);
    const choices = await scalar(db, readSql(f));
    assert.deepEqual(choices.rows, []); assert.equal(Object.hasOwn(choices, 'ownerIsbn13'), ownerField);
    if (ownerField) assert.equal(choices.ownerIsbn13, isbn);
  }
  const saved = await seedOptions(db, f, [row(0, { eligibility: 'ineligible', metadata: { ...metadata, isbn13: '9780140449136', isbn10: null } })]);
  for (const [header, reasons, ownerField] of [['', false, false], ['bookconnect/edition-reasons-v1', true, false], ['bookconnect/edition-reasons-v2', true, true]]) {
    await db.query("SELECT set_config('request.headers',$1,false)", [JSON.stringify({ 'x-client-info': header })]);
    const choices = await scalar(db, readSql(f));
    assert.equal(choices.rows.length, 1); assert.equal(Object.hasOwn(choices.rows[0], 'rejectionReason'), reasons);
    assert.equal(Object.hasOwn(choices, 'ownerIsbn13'), ownerField);
  }
  assert.equal(saved.rows.length, 1);
  await db.query("SELECT set_config('request.headers','{}',false)");
});

test('edition context preserves the M73 body except the four ISBN-mode output values', async () => {
  await resetActor(db);
  const body = await scalar(db, "SELECT prosrc FROM pg_proc WHERE oid='marketplace_sec.phase9_edition_worker_context(public.image_extraction_jobs)'::regprocedure");
  const original = fs.readFileSync(migrationPath('20261011000073_marketplace_phase9_open_library_edition_options.sql'), 'utf8')
    .match(/CREATE OR REPLACE FUNCTION marketplace_sec\.phase9_edition_worker_context\([^]*?AS \$\$([^]*?)\$\$;/)[1];
  const expected = original.replace("'title',title,'authors',authors,'isbnClue',c.observed_isbn_clue,'publisherClue',c.observed_publisher_clue,",
    "'title',CASE WHEN c.owner_isbn13 IS NOT NULL THEN '' ELSE title END,'authors',CASE WHEN c.owner_isbn13 IS NOT NULL THEN '[]'::jsonb ELSE authors END,'isbnClue',coalesce(c.owner_isbn13,c.observed_isbn_clue),'publisherClue',CASE WHEN c.owner_isbn13 IS NOT NULL THEN NULL ELSE c.observed_publisher_clue END,");
  assert.equal(body.replace(/\s+/g, ' ').trim(), expected.replace(/\s+/g, ' ').trim());
  const f = await seedCard(db); const response = await setIsbn(f);
  const receipt = await scalar(db, lookupSql(f, response.requestGeneration));
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=1,lease_owner=$1,lease_expires_at=transaction_timestamp()+interval '5 minutes',lease_token_hash=encode(extensions.digest($2,'sha256'),'hex') WHERE id=$3", [worker, token, receipt.operationId]);
  const context = (await db.query('SELECT marketplace_sec.phase9_edition_worker_context(j) FROM public.image_extraction_jobs j WHERE id=$1', [receipt.operationId])).rows[0].phase9_edition_worker_context;
  assert.equal(context.contractVersion, 'p9-metadata-job-context-v1'); assert.equal(context.title, ''); assert.deepEqual(context.authors, []);
  assert.equal(context.isbnClue, isbn); assert.equal(context.publisherClue, null); assert.equal(context.language, 'und');
  assert.equal(context.inputId, null); assert.equal(context.observationId, null); assert.equal(context.queryIdentity, key);
  assert.equal(context.providerPolicies.length, 2);
  for (const field of ['currentLookupAdapterKey', 'currentLookupAdapterVersion', 'currentAttemptAdapterKey']) assert.ok(Object.hasOwn(context, field));
});

async function olOperation(isbnMode = true) {
  const f = await seedCard(db, { isbn: null });
  const generation = isbnMode ? (await setIsbn(f)).requestGeneration : 0;
  const receipt = await scalar(db, lookupSql(f, generation));
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET enabled=true,storage_allowed=true,matching_allowed=true WHERE adapter_key='open_library'");
  const context = await scalar(db, await claimJob(db, f, receipt.operationId));
  const p = { ...f, jobId: receipt.operationId, context, attempt: 1 };
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [p.jobId, worker, token, 1, p.candidateId, context.candidateVersion, context.queryIdentity,
    'edition-options:' + p.jobId, 'open_library', '1.0.0', 'open-library-capability-v1', 'p9-metadata-foundation-v1',
    'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null]);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [p.jobId, worker, token, 1, lookup.lookup_id, 'open_library', '1.0.0', 1]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [lookup.lookup_id, p.jobId, worker, token, 1, p.candidateId, context.candidateVersion,
    randomUUID(), 'edition-options:' + p.jobId, 'primary', 1, 'open_library', '1.0.0', 'open-library-capability-v1', 'p9-metadata-foundation-v1',
    'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1', 'local_insufficient', usage.reservation_id]);
  return { ...p, lookupId: lookup.lookup_id, attemptId: attempt.attempt_id };
}
async function http(f, sequence, stage) {
  const call = await rpc(db, 'phase9_register_edition_options_provider_call_v1', [f.attemptId, f.jobId, worker, token, 1, randomUUID(), sequence, stage]);
  await rpc(db, 'phase9_finalize_edition_options_provider_call_v1', [call.provider_call_id, f.jobId, worker, token, 1, 'finalized', 'no_acceptable_match', false, true]);
  return call;
}
function olResult(f) {
  const fetched = new Date().toISOString();
  return { fetched, deadline: new Date(Date.parse(fetched) + 3600000).toISOString(), rows: [row(0, {
    googleBooksUrl: 'https://openlibrary.org/books/OL100M', metadata: { ...metadata, adapterKey: 'open_library', providerRecordId: 'OL100M',
      coverReference: 'https://covers.openlibrary.org/b/id/123-M.jpg', correlationId: f.lookupId, attemptId: f.attemptId, fetchedAt: fetched, matchRationale: 'exact_validated_isbn' },
  })] };
}

test('ISBN edition sequence 1 registers and completion accepts it; cleanup retains fresh options', async () => {
  const f = await olOperation(); await http(f, 0, 'search'); await http(f, 1, 'edition');
  const result = olResult(f); assert.equal((await complete(db, f, result)).status, 'completed');
  await resetActor(db);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_options_due(c) AS due FROM public.image_extraction_candidates c WHERE id=$1', [f.candidateId])).rows[0].due, false);
  await db.query('SELECT marketplace_sec.phase9_edition_cleanup_due(100)');
  await setActor(db, f.ownerId);
  assert.deepEqual((await state(f)).options, result.rows);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.rows.length, 1); assert.equal(choices.rows[0].metadata.isbn13, isbn);
});

test('ISBN editions sequence 1 registers and completion accepts it', async () => {
  const f = await olOperation(); await http(f, 0, 'search'); await http(f, 1, 'editions');
  const result = olResult(f);
  assert.equal((await complete(db, f, result)).status, 'completed');
  await setActor(db, f.ownerId);
  assert.deepEqual((await state(f)).options, result.rows);
});

test('title mode refuses edition at sequence 1 in both registration and completion', async () => {
  const f = await olOperation(false); await http(f, 0, 'search');
  await assert.rejects(http(f, 1, 'edition'), /P9_REQUEST_INVALID/);
  const call = await http(f, 1, 'editions');
  await resetActor(db);
  await db.query("UPDATE public.phase9_metadata_provider_calls SET edition_call_stage='edition' WHERE id=$1", [call.provider_call_id]);
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(complete(db, f, olResult(f)), /P9_STATE_CONFLICT/);
});

// M79: a finished exact-ISBN match with no edition chosen yet is waiting for the Owner, not "pending".
const metadataState = async f => {
  await resetActor(db);
  const result = (await db.query('SELECT marketplace_sec.phase9_owner_ux_metadata_state($1) AS state', [f.candidateId])).rows[0].state;
  await setActor(db, f.ownerId);
  return result;
};
const lookupCount = async f => {
  await resetActor(db);
  const n = Number((await db.query('SELECT count(*) AS n FROM public.phase9_metadata_lookups WHERE candidate_id=$1', [f.candidateId])).rows[0].n);
  await setActor(db, f.ownerId);
  return n;
};
test('M79: completed exact-ISBN lookup with no chosen edition reads as ambiguous, not pending', async () => {
  const f = await olOperation(); await http(f, 0, 'search'); await http(f, 1, 'edition');
  assert.equal((await complete(db, f, olResult(f))).status, 'completed');
  // Live cards added after the scan have no saved review yet, so no manual metadata choice.
  await resetActor(db);
  await db.query('UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
});
test('M79: a scanned card with no lookup and no job stays pending', async () => {
  const f = await seedCard(db);
  await seedAutomaticLineage(db, f);
  await mutate(f, 'DELETE FROM public.phase9_metadata_lookups WHERE candidate_id=$1', [f.candidateId]);
  await mutate(f, "UPDATE public.image_extraction_jobs SET status='resolved' WHERE entity_id=$1", [f.candidateId]);
  assert.notEqual((await truth(f)).input_id, null);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await lookupCount(f), 0);
  assert.equal(await metadataState(f), 'pending');
});
test('M79: changing the ISBN after a match reads pending again, with no chosen edition', async () => {
  const f = await olOperation(); await http(f, 0, 'search'); await http(f, 1, 'edition');
  assert.equal((await complete(db, f, olResult(f))).status, 'completed');
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await setIsbn(f, '9780140449136');
  assert.equal(await metadataState(f), 'pending');
});
test('M79: choosing an edition after the match reads selected', async () => {
  const f = await seedCard(db); await setIsbn(f);
  const saved = await seedOptions(db, f, [row()]);
  await scalar(db, selectSql(f, saved.choices, saved.rows[0].optionId));
  assert.equal(await metadataState(f), 'selected');
});
test('M80: A to B and back to A before the new search registers reads pending, not the old match', async () => {
  const f = await olOperation(); await http(f, 0, 'search'); await http(f, 1, 'edition');
  assert.equal((await complete(db, f, olResult(f))).status, 'completed');
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await setIsbn(f, '9780140449136'); await setIsbn(f, isbn);
  assert.equal(await metadataState(f), 'pending');
});
test('M80: a manually added card with no lookup and no running job reads ambiguous; a running job keeps it pending', async () => {
  const f = await seedCard(db);
  await mutate(f, 'UPDATE public.image_extraction_candidates SET input_id=NULL, owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await lookupCount(f), 0);
  assert.equal(await metadataState(f), 'ambiguous');
  const generation = (await setIsbn(f)).requestGeneration;
  assert.equal(await lookupCount(f), 0);
  assert.equal(await metadataState(f), 'ambiguous'); // ISBN saved, search not requested yet: nothing is running
  await scalar(db, lookupSql(f, generation));
  assert.equal(await lookupCount(f), 0); // only the job exists; the job alone keeps the card pending
  assert.equal(await metadataState(f), 'pending');
});
test('M80: a same-ISBN search running again (open job, or a newer lookup row than the match) reads pending despite old options', async () => {
  const f = await olOperation(); await http(f, 0, 'search'); await http(f, 1, 'edition');
  assert.equal((await complete(db, f, olResult(f))).status, 'completed');
  await mutate(f, 'UPDATE public.image_extraction_candidates SET owner_review_snapshot=NULL WHERE id=$1', [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, "UPDATE public.image_extraction_jobs SET status='open' WHERE entity_id=$1", [f.candidateId]);
  assert.equal(await metadataState(f), 'pending');
  await mutate(f, "UPDATE public.image_extraction_jobs SET status='resolved' WHERE entity_id=$1", [f.candidateId]);
  assert.equal(await metadataState(f), 'ambiguous');
  await mutate(f, `INSERT INTO public.phase9_metadata_lookups
    SELECT * FROM jsonb_populate_record(NULL::public.phase9_metadata_lookups,
      to_jsonb((SELECT l FROM public.phase9_metadata_lookups l WHERE l.candidate_id=$1 LIMIT 1))
      || jsonb_build_object('id', gen_random_uuid(), 'routing_policy_version', 'p9-metadata-routing-v-newer', 'created_at', now() + interval '1 minute'))`, [f.candidateId]);
  assert.equal(await metadataState(f), 'pending');
});
