// Picker §§4.1-4.3/5/9, SQL proposal §§3.6/4, MAS-02/17: independent-review regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrationPath } from './databaseHarness.mjs';
import { createCommitDatabase, currentCommitSql, inventory, reviewValue, saveReview, selectSql, expire } from './editionPickerCommitFixture.mjs';
import { after, before, test } from 'node:test';
import { GoogleBooksAdapter } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/adapter.js';
import { buildMetadataQueryIdentity } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/queryIdentity.js';
import { parseNormalizedMetadataEdition } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/contracts/metadata.js';
import { GOOGLE_BOOKS_EDITION_HOST_POLICY } from '../../../.phase9-dist/supabase/functions/_shared/imageInventory/metadata/googleBooks/decoder.js';
import { asService, candidateTruth, complete, fail, fence, finalize,
  prepareCall, readSql, resetActor, resultRows, rpc, scalar, seedOperation, setActor } from './editionOptionsCompletionFixture.mjs';
let db, beforeBoundary;
async function preservedBoundary() {
  return (await db.query("SELECT n.nspname,p.proname,p.prosrc,p.prosecdef,p.proconfig,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN ('phase9_select_candidate_edition_v1','phase9_edition_identity_compatible','phase9_edition_current_snapshot','phase9_edition_local_match','phase9_edition_option_eligible') ORDER BY 1,2")).rows;
}
before(async () => {
  // This correction suite now uses the complete M65-M70 stack, then optional M71.
  // Optional only for semantic RED before M71 exists; production SQL is never mocked.
  db = await createCommitDatabase();
  await db.exec(fs.readFileSync(migrationPath('20261008000070_marketplace_phase9_edition_picker_confirmation.sql'), 'utf8'));
  beforeBoundary = await preservedBoundary();
  const forward = migrationPath('20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql');
  if (fs.existsSync(forward)) await db.exec(fs.readFileSync(forward, 'utf8'));
});
after(async () => db?.close());
async function ready(options) {
  const f = await prepareCall(db, await seedOperation(db, options));
  await finalize(db, f); return f;
}

async function checkedStep(label, work) {
  try { return await work(); }
  catch (error) { error.message = label + ': ' + error.message; throw error; }
}

test('real adapter exact ISBN with unknown query language completes through SQL', async () => {
  const f = await ready({ language: 'und', isbn: '0306406152' });
  const query = buildMetadataQueryIdentity({ strategy: 'bibliographic', isbnClue: f.context.isbnClue,
    title: f.context.title, authors: f.context.authors, language: f.context.language, editionClues: [] });
  assert.equal(query.normalizedLanguage, 'und');
  const adapter = new GoogleBooksAdapter({ mode: 'real', apiKey: 'fixture-only', timeoutMs: 10000,
    maxResponseBytes: 100000, verifyOptionsRetention: ({ fetchedAt }) => ({ storagePermissionVerified: true,
      permittedDeadlineAt: new Date(Date.parse(fetchedAt) + 3600000).toISOString() }),
    fetcher: async () => new Response(JSON.stringify({ items: [{ id: 'exact-isbn', volumeInfo: {
      title: f.context.title, authors: f.context.authors, language: 'en',
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }],
    } }] }), { headers: { 'content-type': 'application/json' } }),
  });
  const provider = await adapter.lookupEditionOptions({ query, correlationId: f.lookupId,
    attemptId: f.attemptId, signal: new AbortController().signal });
  assert.equal(provider.rows[0].eligibility, 'eligible');
  assert.equal(provider.rows[0].metadata.matchRationale, 'exact_validated_isbn');
  assert.equal((await complete(db, f, { rows: provider.rows, fetched: provider.fetchedAt,
    deadline: provider.retentionEvidence.permittedDeadlineAt })).status, 'completed');
  await setActor(db, f.ownerId);
  const choices = await scalar(db, readSql(f));
  assert.equal(choices.rows[0].eligibility, 'eligible');
  const beforeReview = await reviewValue(db, f);
  const command = selectSql(f, choices, choices.rows[0].optionId);
  const selected = await checkedStep('selection', () => scalar(db, command));
  assert.equal(selected.selection.confirmedByOwner, true);
  assert.equal(selected.selection.source, 'edition_option');
  assert.equal(selected.selection.snapshot.language, 'en');
  assert.equal(selected.selection.snapshot.isbn13, '9780306406157');
  const resumed = await scalar(db, readSql(f));
  assert.deepEqual(resumed.selection, selected.selection);
  const detail = await scalar(db, "SELECT public.phase9_owner_candidate_detail_v2('" + f.sessionId + "','" + f.candidateId + "')");
  assert.deepEqual(detail.metadata.snapshot, selected.selection.snapshot);
  const sellingKeys = ['quantity', 'priceMinor', 'baseCondition', 'damageDisclosure', 'shelfLocation', 'notes', 'publicationIntent'];
  const chosenReview = await reviewValue(db, f);
  for (const key of sellingKeys) assert.deepEqual(chosenReview[key], beforeReview[key], key);
  await checkedStep('Save', () => saveReview(db, f));
  assert.deepEqual((await scalar(db, readSql(f))).selection, selected.selection);
  for (const key of sellingKeys) assert.deepEqual((await reviewValue(db, f))[key], beforeReview[key], key);
  // Replay through the public M70 wrapper after Save and expiry still confirms held authority.
  await expire(db, f);
  assert.equal((await checkedStep('selection replay after Save/expiry', () => scalar(db, command))).selection.confirmedByOwner, true);
  const addCommand = await currentCommitSql(db, f);
  const committed = await checkedStep('Add', () => scalar(db, addCommand));
  await resetActor(db);
  const item = await inventory(db, committed.inventoryId);
  assert.equal(item.language, 'en'); assert.equal(item.isbn_13, '9780306406157');
  assert.equal(item.title, selected.selection.snapshot.title);
  assert.deepEqual(item.authors, selected.selection.snapshot.authors);
  assert.equal(item.selling_price_minor, beforeReview.priceMinor);
  assert.equal(item.quantity_total, beforeReview.quantity);
  assert.equal(item.shelf_location, beforeReview.shelfLocation);
  assert.equal(item.condition, beforeReview.baseCondition);
  assert.equal(item.has_damage, beforeReview.damageDisclosure.hasDamage);
  assert.deepEqual(item.damage_types, beforeReview.damageDisclosure.damageTypes);
  assert.equal(item.damage_notes, beforeReview.damageDisclosure.damageNote);
  assert.equal(item.is_sellable, beforeReview.damageDisclosure.isSellable);
  assert.equal(item.internal_notes, beforeReview.notes.internalNote);
  assert.equal(item.public_notes, beforeReview.notes.publicNote);
  assert.equal(item.publication_status, 'private');
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.store_inventory WHERE created_from_candidate_id='" + f.candidateId + "'"), 1);
  await setActor(db, f.ownerId);
  // The existing unfinished-card guard rejects selection replay after commit.
  // Safe replay before Add succeeded above; after Add rejection must have no effect.
  await assert.rejects(scalar(db, command), /P9_STATE_CONFLICT/);
  await resetActor(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM public.store_inventory WHERE created_from_candidate_id='" + f.candidateId + "'"), 1);
  assert.deepEqual(await inventory(db, committed.inventoryId), item);

});
for (const [name, options, mutation] of [
  ['known language conflict', { language: 'fr', isbn: '0306406152' }, {}],
  ['unknown language without exact ISBN', { language: 'und', isbn: null }, {}],
  ['supplied title conflict', { language: 'und', isbn: '0306406152' }, { title: 'Different book' }],
  ['supplied author conflict', { language: 'und', isbn: '0306406152' }, { authors: ['Different author'] }],
]) test('unknown-language exception does not admit ' + name, async () => {
  const f = await ready(options), result = resultRows(f);
  Object.assign(result.rows[0].metadata, mutation);
  await assert.rejects(complete(db, f, result), /P9_EDITION_ROWS_INVALID/);
});

for (const [name, kind, retryable, expected, physical] of [
  ['disabled provider without a lookup', 'provider_disabled', false, 'resolved', false],
  ['scheduled retry with finalized 429', 'rate_limited', true, 'retry_scheduled', true],
  ['terminal validation failure with a lookup', 'schema_invalid', false, 'dead_letter', true],
]) test('failure transition replays after response loss: ' + name, async () => {
  const f = await seedOperation(db);
  if (physical) { await prepareCall(db, f); await finalize(db, f, kind, retryable); }
  const truth = await candidateTruth(db, f); await asService(db, f);
  const first = await fail(db, f, kind, retryable);
  assert.equal(first.status, expected);
  await resetActor(db);
  const job = (await db.query('SELECT status,next_attempt_at,updated_at FROM public.image_extraction_jobs WHERE id=$1', [f.jobId])).rows[0];
  await asService(db, f);
  assert.deepEqual(await fail(db, f, kind, retryable), {
    status: 'replayed', job_status: expected, manual_outcome: first.manual_outcome,
  });
  await assert.rejects(fail(db, f, 'network_failure', true), /P9_IDEMPOTENCY_MISMATCH/);
  for (const [index, value] of [[1, 'different-worker-0001'], [2, 'b'.repeat(64)], [3, 2], [8, 8]]) {
    await assert.rejects(rpc(db, 'phase9_fail_candidate_edition_options_v1',
      [...fence(f).map((v, i) => i === index ? value : v), kind, retryable]), /P9_STATE_CONFLICT/);
  }
  assert.deepEqual(await candidateTruth(db, f), truth);
  assert.deepEqual((await db.query('SELECT status,next_attempt_at,updated_at FROM public.image_extraction_jobs WHERE id=$1', [f.jobId])).rows[0], job);
});
test('a reclaimed attempt rejects the old failure receipt and accepts only its current claim', async () => {
  const f = await seedOperation(db); await fail(db, f);
  await resetActor(db);
  await db.query("UPDATE public.image_extraction_jobs SET status='in_progress',attempt_count=2,lease_owner=$2,"
    + "lease_token_hash=encode(extensions.digest($3,'sha256'),'hex'),lease_expires_at=transaction_timestamp()+interval '1 hour' WHERE id=$1",
  [f.jobId, 'picker-worker-0001', 'b'.repeat(64)]);
  await asService(db, f);
  await assert.rejects(fail(db, f), /P9_STATE_CONFLICT/);
  const args = fence({ ...f, attempt: 2 }); args[2] = 'b'.repeat(64);
  assert.equal((await rpc(db, 'phase9_fail_candidate_edition_options_v1', [...args, 'provider_unavailable', true])).status, 'retry_scheduled');
  assert.equal((await rpc(db, 'phase9_fail_candidate_edition_options_v1', [...args, 'provider_unavailable', true])).status, 'replayed');
});

const malformed = [
  ['oversized rationale', { matchRationale: 'x'.repeat(800) }],
  ['oversized normalizer version', { normalizerVersion: 'x'.repeat(65) }],
  ['UTF-16 rationale bound', { matchRationale: '😀'.repeat(257) }],
  ['UTF-16 author bound', { authors: ['😀'.repeat(129)] }],
  ['unsupported contract', { contractVersion: 'unsupported' }],
  ['unsupported schema', { schemaVersion: 'unsupported' }],
  ['invalid ISBN-13 beside valid ISBN-10', { isbn13: '9999999999999' }],
  ['invalid ISBN-10', { isbn10: '9999999999' }],
  ['incoherent validated pair', { isbn13: '9780140328721' }],
  ['ISBN-13 in ISBN-10 field', { isbn10: '9780306406157' }],
  ['ISBN-10 in ISBN-13 field', { isbn13: '0306406152' }],
];
for (const eligibility of ['eligible', 'ineligible']) for (const [name, mutation] of malformed)
  test('direct completion rejects ' + name + ' on an ' + eligibility + ' row', async () => {
    const f = await ready(), result = resultRows(f);
    result.rows[0].eligibility = eligibility; Object.assign(result.rows[0].metadata, mutation);
    assert.throws(() => parseNormalizedMetadataEdition(result.rows[0].metadata, GOOGLE_BOOKS_EDITION_HOST_POLICY));
    await assert.rejects(complete(db, f, result), /P9_EDITION_ROWS_INVALID/);
    await setActor(db, f.ownerId); assert.deepEqual((await scalar(db, readSql(f))).rows, []);
  });
test('maximum normalized rationale and normalizer bounds remain valid for an ineligible option', async () => {
  const f = await ready(), result = resultRows(f);
  Object.assign(result.rows[0], { eligibility: 'ineligible' });
  Object.assign(result.rows[0].metadata, { matchRationale: 'x'.repeat(512), normalizerVersion: 'x'.repeat(64) });
  assert.doesNotThrow(() => parseNormalizedMetadataEdition(result.rows[0].metadata, GOOGLE_BOOKS_EDITION_HOST_POLICY));
  assert.equal((await complete(db, f, result)).status, 'completed');
});
for (const eligibility of ['eligible', 'ineligible']) test('completion rejects a timestamp without a timezone on an ' + eligibility + ' row', async () => {
  const f = await ready(), result = resultRows(f);
  result.fetched = result.fetched.replace(/Z$/, '');
  Object.assign(result.rows[0], { eligibility });
  result.rows[0].metadata.fetchedAt = result.fetched;
  assert.throws(() => parseNormalizedMetadataEdition(result.rows[0].metadata, GOOGLE_BOOKS_EDITION_HOST_POLICY));
  await assert.rejects(complete(db, f, result), /P9_EDITION_ROWS_INVALID/);
});
// Picker §5 / SQL proposal §3.6: PostgreSQL casts alone do not prove the normalized timestamp contract.
for (const eligibility of ['eligible', 'ineligible']) for (const [name, timestamp] of [
  ['PostgreSQL era date', (day) => day + ' AD 00:00:00Z'],
  ['PostgreSQL ordinal date', (day) => day.slice(0, 4) + '.'
    + String(1 + (Date.parse(day + 'T00:00:00Z') - Date.UTC(Number(day.slice(0, 4)), 0, 1)) / 86400000).padStart(3, '0')
    + ' 00:00:00Z'],
  ['leap-second timestamp', (day) => day + 'T00:00:60Z'],
]) test('completion rejects ' + name + ' on an ' + eligibility + ' row', async () => {
  const f = await ready(), result = resultRows(f);
  const day = result.fetched.slice(0, 10);
  result.fetched = timestamp(day);
  result.deadline = new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString();
  Object.assign(result.rows[0], { eligibility });
  result.rows[0].metadata.fetchedAt = result.fetched;
  assert.throws(() => parseNormalizedMetadataEdition(result.rows[0].metadata, GOOGLE_BOOKS_EDITION_HOST_POLICY),
    /ISO-8601 timestamp/);
  await assert.rejects(complete(db, f, result), /P9_EDITION_ROWS_INVALID/);
  await setActor(db, f.ownerId);
  assert.deepEqual((await scalar(db, readSql(f))).rows, []);
});
for (const eligibility of ['eligible', 'ineligible']) for (const [name, timestamp] of [
  ['UTC without fractions', (fetched) => fetched.slice(0, 19) + 'Z'],
  ['fractional offset time', (fetched) => new Date(Date.parse(fetched) + 330 * 60000).toISOString().replace(/Z$/, '+05:30')],
]) test('completion preserves normalized ISO ' + name + ' on an ' + eligibility + ' row', async () => {
  const f = await ready(), result = resultRows(f);
  result.fetched = timestamp(result.fetched);
  Object.assign(result.rows[0], { eligibility });
  result.rows[0].metadata.fetchedAt = result.fetched;
  assert.doesNotThrow(() => parseNormalizedMetadataEdition(result.rows[0].metadata, GOOGLE_BOOKS_EDITION_HOST_POLICY));
  assert.equal((await complete(db, f, result)).status, 'completed');
  await setActor(db, f.ownerId);
  await resetActor(db);
  const stored = await db.query("SELECT options->0->'metadata'->>'fetchedAt' AS fetched"
    + " FROM public.phase9_candidate_edition_state WHERE candidate_id=$1", [f.candidateId]);
  assert.equal(stored.rows[0].fetched, result.fetched);
});

test('a failure receipt cannot authorize options completion or success recovery', async () => {
  const f = await ready(), result = resultRows(f);
  await fail(db, f, 'network_failure', true);
  assert.equal((await complete(db, f, result)).status, 'stale_rejected');
  assert.equal((await rpc(db, 'phase9_recover_candidate_edition_options_v1', fence(f))).status, 'stale_rejected');
  await setActor(db, f.ownerId); assert.deepEqual((await scalar(db, readSql(f))).rows, []);
});
test('failure receipts and normalized validation helpers stay private', async () => {
  const f = await seedOperation(db); await fail(db, f, 'provider_disabled', false);
  await resetActor(db);
  const receipt = await scalar(db, "SELECT failure_receipt FROM public.phase9_candidate_edition_state WHERE candidate_id='" + f.candidateId + "'");
  assert.equal(JSON.stringify(receipt).includes('a'.repeat(64)), false);
  assert.equal(JSON.stringify(receipt).includes(f.context.title), false);
  assert.equal('jobStatus' in receipt, false);
  for (const name of ['phase9_edition_option_eligible', 'phase9_edition_utf16_length', 'phase9_edition_valid_normalized_metadata']) {
    const row = (await db.query("SELECT p.proowner::regrole::text AS owner,p.proconfig,"
      + "has_function_privilege('service_role',p.oid,'EXECUTE') AS service,"
      + "has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,"
      + "has_function_privilege('anon',p.oid,'EXECUTE') AS anon FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace"
      + " WHERE n.nspname='marketplace_sec' AND p.proname=$1", [name])).rows[0];
    assert.equal(row.owner, 'postgres'); assert.deepEqual(row.proconfig, ['search_path=""']);
    assert.equal(row.service, false); assert.equal(row.authenticated, false); assert.equal(row.anon, false);
  }
  await setActor(db, f.ownerId);
  assert.equal('failure_receipt' in (await scalar(db, readSql(f))), false);
  await assert.rejects(db.query('SELECT failure_receipt FROM public.phase9_candidate_edition_state'), /permission denied/);
});

// Select must independently revalidate unsuitable rows, not trust the stored eligibility label.
for (const [name, options, mutation] of [
  ['known language conflict', { language: 'fr', isbn: '0306406152' }, {}],
  ['unknown language without ISBN', { language: 'und', isbn: null }, {}],
  ['contradictory title', { language: 'und', isbn: '0306406152' }, { title: 'Other book' }],
  ['contradictory authors', { language: 'und', isbn: '0306406152' }, { authors: ['Other author'] }],
  ['invalid identifier', { language: 'und', isbn: '0306406152' }, { isbn13: '9999999999999' }],
  ['incoherent identifiers', { language: 'und', isbn: '0306406152' }, { isbn13: '9780140328721' }],
]) test('public M70 selection rejects ' + name + ' even with a forged eligible label', async () => {
  const f = await ready(options), result = resultRows(f);
  result.rows[0].eligibility = 'ineligible';
  await complete(db, f, result);
  Object.assign(result.rows[0].metadata, mutation);
  // Corrupt only this disposable stored row; completion's stricter controls are covered above.
  await resetActor(db);
  const q = await scalar(db, "SELECT query_identity FROM public.phase9_candidate_edition_state WHERE candidate_id='" + f.candidateId + "'");
  assert.equal(await scalar(db, "SELECT marketplace_sec.phase9_edition_option_eligible('" + JSON.stringify(result.rows[0].metadata).replaceAll("'", "''") + "','" + q.replaceAll("'", "''") + "')"), false);
  result.rows[0].eligibility = 'eligible';
  await db.query('UPDATE public.phase9_candidate_edition_state SET options=$1 WHERE candidate_id=$2', [result.rows, f.candidateId]);
  await setActor(db, f.ownerId);
  const choices = await scalar(db, readSql(f));
  await assert.rejects(scalar(db, selectSql(f, choices, result.rows[0].optionId)), /P9_STATE_CONFLICT/);
});
for (const label of ['stale version', 'expired options']) test('unknown-language exact ISBN still rejects ' + label, async () => {
  const f = await ready({ language: 'und', isbn: '0306406152' });
  const result = resultRows(f); await complete(db, f, result);
  await setActor(db, f.ownerId); const choices = await scalar(db, readSql(f));
  if (label === 'expired options') await expire(db, f);
  await assert.rejects(scalar(db, selectSql(f, choices, choices.rows[0].optionId,
    label === 'stale version' ? { metadataRevision: choices.metadataRevision + 1 } : {})),
    label === 'stale version' ? /P9_VERSION_CONFLICT/ : /P9_STATE_CONFLICT/);
});

test('M71 preserves the M70 wrapper, strict automatic/local helpers and private delegate ACL', async () => {
  await resetActor(db);
  assert.deepEqual(await preservedBoundary(), beforeBoundary);
  const signature = 'marketplace_sec.phase9_edition_legacy_select_candidate(uuid,uuid,integer,integer,integer,text,integer,uuid,uuid,text,uuid)';
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await scalar(db, "SELECT has_function_privilege('" + role + "','" + signature + "','EXECUTE')"), false);
  }
  const delegate = await scalar(db, "SELECT prosrc FROM pg_proc WHERE oid='" + signature + "'::regprocedure");
  assert.match(delegate, /phase9_edition_option_eligible\(m,q\)/);
});
