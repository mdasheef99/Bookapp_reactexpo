// DOC-3 §5.2.1; picker §§5/9/13.14: real SQL author-receipt isolation, disposable DB only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test, before, after } from 'node:test';
import { migrationPath } from './databaseHarness.mjs';
import { createCommitDatabase } from './editionPickerCommitFixture.mjs';
import { seedOperation, rpc, worker, token, complete, resultRows, setActor, resetActor }
  from './editionOptionsCompletionFixture.mjs';

const suffixes = [
  '20261008000070_marketplace_phase9_edition_picker_confirmation.sql',
  '20261010000071_marketplace_phase9_edition_picker_selection_eligibility.sql',
  '20261010000072_marketplace_phase9_edition_picker_superseded_jobs.sql',
  '20261011000073_marketplace_phase9_open_library_edition_options.sql',
  '20261012000074_marketplace_phase9_open_library_author_isolation.sql',
];
let db;
before(async () => {
  db = await createCommitDatabase();
  for (const file of suffixes) await db.exec(fs.readFileSync(migrationPath(file), 'utf8'));
});
after(async () => { await db?.close(); });
async function operation() {
  const f = await seedOperation(db);
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET enabled=true WHERE adapter_key='open_library'");
  await setActor(db, f.ownerId, 'service_role');
  const claim = [f.jobId, worker, token, f.attempt];
  const lookup = await rpc(db, 'phase9_register_structural_metadata_lookup', [
    ...claim, f.candidateId, f.context.candidateVersion, f.context.queryIdentity, 'edition-options:' + f.jobId,
    'open_library', '1.0.0', 'open-library-capability-v1', 'p9-metadata-foundation-v1',
    'bibliographic', 'p9-metadata-lookup-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'store_private', '1', 'p9-metadata-cache-v1', 'metadata-v1', null,
  ]);
  const usage = await rpc(db, 'phase9_reserve_metadata_usage', [
    ...claim, lookup.lookup_id, 'open_library', '1.0.0', 1,
  ]);
  const attempt = await rpc(db, 'phase9_register_structural_metadata_attempt', [
    lookup.lookup_id, ...claim, f.candidateId, f.context.candidateVersion, randomUUID(),
    'edition-options:' + f.jobId, 'primary', 1, 'open_library', '1.0.0', 'open-library-capability-v1',
    'p9-metadata-foundation-v1', 'p9-bibliographic-normalizer-v1', 'p9-metadata-routing-v1',
    'local_insufficient', usage.reservation_id,
  ]);
  return { ...f, lookupId: lookup.lookup_id, attemptId: attempt.attempt_id, reservationId: usage.reservation_id };
}
const register = (f, sequence, stage) => rpc(db, 'phase9_register_edition_options_provider_call_v1', [
  f.attemptId, f.jobId, worker, token, f.attempt, randomUUID(), sequence, stage,
]);
const finish = (f, call, outcome = 'no_acceptable_match', retryable = false,
  status = 'finalized', egress = true) => rpc(db, 'phase9_finalize_edition_options_provider_call_v1', [
  call.provider_call_id, f.jobId, worker, token, f.attempt, status, outcome, retryable, egress,
]);
async function read(f, sequence, stage) {
  const call = await register(f, sequence, stage); await finish(f, call); return call;
}
function rows(f, failedFirst = false) {
  const result = resultRows(f);
  result.rows[0].googleBooksUrl = 'https://openlibrary.org/books/OL101M';
  result.rows[0].metadata = { ...result.rows[0].metadata, adapterKey: 'open_library', providerRecordId: 'OL101M',
    coverReference: null, matchRationale: 'confirmation_required_text_evidence' };
  const unavailable = { optionId: randomUUID(), ordinal: 0, googleBooksUrl: null,
    eligibility: 'unavailable', metadata: null };
  result.rows = failedFirst ? [unavailable, { ...result.rows[0], ordinal: 1 }]
    : [result.rows[0], { ...unavailable, ordinal: 1 }];
  return result;
}
const isolated = ['malformed_response', 'unsupported_content_type', 'response_too_large'];
for (const outcome of isolated) {
  for (const failedFirst of [true, false]) test(outcome + ' author failure first=' + failedFirst
    + ' permits continuation/completion without rewriting its receipt', async () => {
    const f = await operation(); await read(f, 0, 'search'); await read(f, 1, 'editions');
    if (!failedFirst) await read(f, 2, 'author:OL1A');
    const bad = await register(f, failedFirst ? 2 : 3, 'author:OL2A');
    await finish(f, bad, outcome);
    if (failedFirst) await read(f, 3, 'author:OL1A');
    const result = rows(f, failedFirst);
    assert.equal((await complete(db, f, result)).status, 'completed');
    assert.equal((await complete(db, f, result)).status, 'replayed');
    const receipts = (await db.query(
      'SELECT * FROM public.phase9_metadata_provider_calls WHERE logical_attempt_id=$1 ORDER BY edition_call_sequence',
      [f.attemptId])).rows;
    assert.equal(receipts.length, 4);
    assert.equal(receipts.find(call => call.id === bad.provider_call_id).normalized_outcome, outcome);
    assert.equal(receipts.find(call => call.id === bad.provider_call_id).logical_outcome, outcome);
    assert.ok(receipts.every(call => call.status === 'finalized' && call.edition_egress_started === true));
    assert.equal((await finish(f, bad, outcome)).status, 'finalized');
    await assert.rejects(finish(f, bad), /P9_IDEMPOTENCY_MISMATCH/);
    assert.equal((await db.query('SELECT status FROM public.phase9_usage_reservations WHERE id=$1',
      [f.reservationId])).rows[0].status, 'consumed');
  });
}
for (const outcome of isolated) {
  for (const stage of ['search', 'editions']) test(outcome + ' on mandatory ' + stage + ' still blocks', async () => {
    const f = await operation();
    if (stage === 'editions') await read(f, 0, 'search');
    const sequence = stage === 'search' ? 0 : 1;
    const bad = await register(f, sequence, stage); await finish(f, bad, outcome);
    await assert.rejects(register(f, sequence + 1, stage === 'search' ? 'editions' : 'author:OL1A'), /P9_STATE_CONFLICT/);
    await assert.rejects(complete(db, f, rows(f)), /P9_STATE_CONFLICT/);
  });
}
for (const [outcome, retryable, status, egress] of [
  ['authentication_configuration_failure', false, 'finalized', true],
  ['rate_limited', true, 'finalized', true],
  ['provider_unavailable', true, 'finalized', true],
  ['malformed_response', true, 'finalized', true],
  ['network_failure', true, 'outcome_unknown', true],
  ['cancelled', false, 'stale_rejected', false],
]) test('author ' + outcome + '/' + status + ' remains blocking', async () => {
  const f = await operation(); await read(f, 0, 'search'); await read(f, 1, 'editions');
  const bad = await register(f, 2, 'author:OL2A'); await finish(f, bad, outcome, retryable, status, egress);
  await assert.rejects(register(f, 3, 'author:OL1A'), /P9_STATE_CONFLICT/);
  await assert.rejects(complete(db, f, rows(f)), /P9_STATE_CONFLICT/);
});

test('isolated author-content failure cannot bypass fresh provider disablement', async () => {
  const f = await operation(); await read(f, 0, 'search'); await read(f, 1, 'editions');
  const bad = await register(f, 2, 'author:OL2A'); await finish(f, bad, 'malformed_response');
  await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='open_library'");
  await setActor(db, f.ownerId, 'service_role');
  await assert.rejects(register(f, 3, 'author:OL1A'), /P9_STATE_CONFLICT/);
  await assert.rejects(complete(db, f, rows(f)), /P9_METADATA_STORAGE_DENIED/);
});
test('M74 preserves private command signatures and the service-only execution boundary', async () => {
  const result = await db.query("SELECT p.proname,p.prosecdef,p.proconfig,"
    + "has_function_privilege('anon',p.oid,'EXECUTE') AS anon,"
    + "has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,"
    + "has_function_privilege('service_role',p.oid,'EXECUTE') AS service"
    + " FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace"
    + " WHERE n.nspname='marketplace_sec' AND p.proname IN"
    + "('phase9_complete_candidate_edition_options_v1','phase9_register_edition_options_provider_call_v1')");
  assert.equal(result.rows.length,2);
  for (const row of result.rows) {
    assert.equal(row.prosecdef,true); assert.deepEqual(row.proconfig,['search_path=""']);
    assert.equal(row.anon,false); assert.equal(row.authenticated,false); assert.equal(row.service,true);
  }
});
