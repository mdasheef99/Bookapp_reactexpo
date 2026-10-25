// 02a §§3–7/10 AC6-0..28. Sequential SQL contracts; real races live in *.postgres.mjs.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { add, admin, applyM81IfPresent, automaticCard, bytes, catalogueBytes, createCatalogueDatabase,
  currentCommitSql, effects, helper, labelledCard, legacyCard, linked, olCard,
  readSql, refreshOL, requireHelper, resetActor, reviewValue, saveReview, scalar, seedIncumbent,
  selectionBytes, setActor, staleCard, unmatched } from './catalogueLinkFixture.mjs';
import { expire, originalSelection } from './editionPickerCommitFixture.mjs';
import { seedCard, selectSql } from './editionPickerFixture.mjs';
let db;
before(async () => { db = await createCatalogueDatabase(); });
beforeEach(async () => {
  await resetActor(db);
  await db.exec(`TRUNCATE public.stores,public.canonical_works,public.canonical_editions CASCADE;
    UPDATE public.phase9_provider_registry SET enabled=true,matching_allowed=true,storage_allowed=true,
      public_display_allowed=true,provider_kind='metadata',adapter_version='1.0.0',policy_version=1 WHERE adapter_key IN('open_library','google_books');`);
});
afterEach(async () => { await resetActor(db); await db.exec('ALTER TABLE public.store_inventory DROP CONSTRAINT IF EXISTS catalogue_test_failure'); });
after(async () => { await db?.close(); });
const count = table => scalar(db, 'SELECT count(*)::int FROM public.' + table);
async function refuses(action, pattern) {
  // Each command owns its transaction, as in the existing C13/C19 suites.
  try { await assert.rejects(action, pattern); } finally { await resetActor(db); }
}
async function noWrite(f, t) {
  const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  const result = await add(db, f); unmatched(result.item);
  assert.deepEqual(await catalogueBytes(db), before, 'existing no-write regression: canonical bytes stay unchanged');
  assert.equal(await selectionBytes(db, f) === chosen, true, 'saved JSON/review bytes survive Add');
  t.diagnostic('Existing private Add, no-link, no-write and saved-byte assertions passed; checking catalogue contract next.');
  return result;
}
async function positive() { linked((await add(db, await olCard(db))).item); }

// AC6-0 RED: current picker Add creates no work/links. Exact keys: §5.2, not query-cache order.
test('AC6-0: reordered, duplicated and Unicode author keys converge to one work', async () => {
  // §7.1 fixture fidelity is an already-green regression paired with the RED
  // linking contract below. Never accidentally mask a helper relying on UUID defaults.
  const defaults = (await db.query(`SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN('canonical_works','canonical_editions') AND column_name='id'`)).rows;
  assert.equal(defaults.length, 2); assert.equal(defaults.every(r => r.column_default === null), true);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_constraint WHERE conrelid='public.store_inventory'::regclass
    AND confrelid IN('public.canonical_works'::regclass,'public.canonical_editions'::regclass)
    AND contype='f' AND convalidated AND confdeltype='n'`), 2);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_constraint WHERE conname IN('canonical_editions_isbn_10_unique','canonical_editions_isbn_13_unique')`), 2);
  // Tabs/space-runs are normalization vectors, not selectable metadata: M29's
  // safe-text gate rejects them before Add. Do not mislabel that as a skip.
  await resetActor(db);
  assert.equal((await db.query('SELECT btrim(marketplace_sec.phase9_metadata_normalized_text($1)) AS key', ['\t Ｔhe  Café, தமிழ் \t'])).rows[0].key, 'the café, தமிழ்');
  // M29 rejects lower()-identical authors at review save (P9_REQUEST_INVALID).
  // NFC full-width spellings pass that validator but collide under §5.2 NFKC;
  // both real request/select/save paths still contain duplicate NORMALIZED keys.
  const a = await olCard(db, { title: 'Ｔhe Café, தமிழ்', authors: ['B. Author', 'a. author', 'ａ. author'] });
  const b = await olCard(db, { title: 'the café, தமிழ்', authors: ['A. Author', 'b. author', 'Ａ. Author'], isbn10: null, isbn13: '9780547928227' });
  const first = (await add(db, a)).item, second = (await add(db, b)).item;
  linked(first); linked(second); assert.equal(first.canonical_work_id, second.canonical_work_id);
  assert.equal(await count('canonical_works'), 1); assert.equal(await count('canonical_editions'), 2);
  const work = (await db.query('SELECT * FROM public.canonical_works')).rows[0];
  assert.equal(work.title_normalized, 'the café, தமிழ்');
  assert.deepEqual(work.primary_authors, ['a. author', 'a. author', 'b. author']);
});

// AC6-1 RED: NULL links/no canonical insertion. §7.1 mapping and §4 unchanged private INSERT.
test('AC6-1: eligible OL Add maps every shared field and keeps selling facts private', async () => {
  const f = await olCard(db, { description: 'Provider description', editionStatement: 'Provider edition', volume: 'II', format: 'paperback' });
  await setActor(db, f.ownerId);
  const marker = 'private-' + randomUUID(), review = { ...await reviewValue(db, f), priceMinor: 1987,
    shelfLocation: marker, notes: { publicNote: marker, internalNote: marker } };
  await saveReview(db, f, review);
  const chosen = await selectionBytes(db, f), { item, receipt } = await add(db, f); linked(item);
  const w = (await db.query('SELECT * FROM public.canonical_works')).rows[0];
  const e = (await db.query('SELECT * FROM public.canonical_editions')).rows[0];
  assert.equal(e.id, item.canonical_edition_id); assert.equal(e.work_id, w.id); assert.equal(w.id, item.canonical_work_id);
  assert.deepEqual([w.title_normalized, w.primary_title, w.primary_authors, w.language], ['catalogue sample', f.facts.title, ['a. author', 'b. author'], 'en']);
  for (const [column, field] of Object.entries({ isbn_10: 'isbn10', isbn_13: 'isbn13', title: 'title', subtitle: 'subtitle',
    authors: 'authors', publisher: 'publisher', published_date: 'publishedDate', language: 'language',
    description: 'description', edition_statement: 'editionStatement', volume: 'volume', format: 'format',
    page_count: 'pageCount', categories: 'categories', cover_url: 'coverReference' })) assert.deepEqual(e[column], f.facts[field], column);
  assert.equal(new Date(e.metadata_verified_at).toISOString(), f.facts.fetchedAt);
  assert.equal(e.metadata_selection_version, 'psr-catalogue-isbn-v1');
  assert.ok(w.created_at && w.updated_at && e.created_at && e.updated_at);
  const shared = JSON.stringify([w, e]);
  assert.equal([marker, f.ownerId, f.storeId, f.sessionId, f.candidateId, f.lookupId, f.attemptId, f.jobId, receipt.inventoryId]
    .some(value => shared.includes(value)), false, 'shared rows contain no private marker or lineage identifier');
  assert.equal(item.selling_price_minor, review.priceMinor); assert.equal(item.shelf_location === marker, true);
  assert.equal(item.internal_notes === marker && item.public_notes === marker, true);
  assert.equal(item.condition, review.baseCondition); assert.equal(item.has_damage, review.damageDisclosure.hasDamage);
  assert.deepEqual(item.damage_types, review.damageDisclosure.damageTypes); assert.equal(item.damage_notes, review.damageDisclosure.damageNote);
  assert.equal(item.quantity_total, review.quantity); assert.equal(item.quantity_available, review.quantity);
  assert.deepEqual([item.quantity_reserved, item.quantity_sold, item.quantity_removed], [0, 0, 0]);
  assert.deepEqual([item.visibility_status, item.publication_status], ['draft', 'private']);
  assert.match(item.metadata_snapshot_version, /^edition-selection-v1:/);
  assert.equal(await count('marketplace_book_listings'), 0);
  assert.equal(await selectionBytes(db, f) === chosen, true);
});

// AC6-2 RED: new ISBN reuse/link missing; optional incumbent fields never refreshed (§7.2).
test('AC6-2: another Owner reuses the same ISBN without any incumbent byte change', async () => {
  const a = await olCard(db), first = (await add(db, a)).item, before = await catalogueBytes(db);
  const b = await olCard(db, { publisher: 'Different provider press', publishedDate: '2001', coverReference: null });
  assert.notEqual(a.ownerId, b.ownerId); assert.notEqual(a.storeId, b.storeId);
  const second = (await add(db, b)).item; linked(second);
  assert.equal(first.canonical_edition_id, second.canonical_edition_id);
  assert.equal(first.canonical_work_id, second.canonical_work_id);
  assert.deepEqual(await catalogueBytes(db), before); assert.equal(await count('canonical_editions'), 1);
});

// AC6-3 RED: shared-key waiting/link missing; commit/rollback variants are native PG.
// AC6-4 RED: helper absent; Google/manual no-write behavior itself is already green.
for (const label of ['G', 'MAN']) test('AC6-4: ' + label + ' stays private even when Google display/storage are allowed', async t => {
  const f = await labelledCard(db, label);
  await admin(db, () => db.exec("UPDATE public.phase9_provider_registry SET storage_allowed=true,public_display_allowed=true WHERE adapter_key='google_books'"));
  await noWrite(f, t); await positive();
});

// AC6-5 RED: helper absent; old shape gate accepts bounded malformed pair, no-link alone is green.
test('AC6-5: disagreeing valid ISBN-10/13 skips the entire shared attempt', async t => {
  const f = await legacyCard(db, { isbn10: '054792822X' });
  const result = await noWrite(f, t); assert.equal(result.item.isbn_10, '054792822X', 'private Add retains the chosen ISBN'); await positive();
});

// AC6-6 RED: helper exclusion contract absent; existing identity-edit safety is a green regression.
for (const label of ['OL', 'CAN']) test('AC6-6: normal identity save discards ' + label + ' authority before Add', async t => {
  const f = await labelledCard(db, label), before = await catalogueBytes(db);
  await setActor(db, f.ownerId);
  const review = { ...await reviewValue(db, f), originalTitle: 'Owner corrected title', metadataChoice: { mode: 'manual', selectionId: null } };
  await saveReview(db, f, review);
  // An identity change resets review_ready (M69 trigger); a second unchanged save restores it before Add.
  await saveReview(db, f);
  const result = await add(db, f); unmatched(result.item); assert.equal(result.item.title, review.originalTitle);
  assert.deepEqual(await catalogueBytes(db), before, 'identity edit preserves incumbent bytes');
  t.diagnostic('Existing manual identity-edit exclusion assertions passed; checking helper contract next.'); await requireHelper(db);
});

// AC6-7 RED: linked fixture needs helper; unmatched replay/different-key refusal are green regressions.
for (const label of ['OL', 'G', 'MAN']) test('AC6-7: exact ' + label + ' replay preserves all effect/timestamp bytes', async t => {
  const f = await labelledCard(db, label), first = await add(db, f), before = await effects(db, f);
  await admin(db, () => db.exec("UPDATE public.phase9_provider_registry SET enabled=false WHERE adapter_key='open_library'"));
  const replay = await add(db, f, first.command); assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true, 'no inventory/audit/event/count/replay/HTTP effect');
  await setActor(db, f.ownerId);
  const freshCommand = await currentCommitSql(db, f, { idempotencyKey: randomUUID() });
  await refuses(() => scalar(db, freshCommand), /P9_(?:STATE|VERSION|CANDIDATE_VERSION)_CONFLICT/);
  t.diagnostic('Existing exact-replay, effect-byte and different-key refusal assertions passed; checking catalogue contract next.');
  if (label === 'OL') linked(first.item); else { unmatched(first.item); await requireHelper(db); }
});
// AC6-7 RED: helper absent at upgrade assertion. M69's historical unmatched
// receipt already replays; installing M81 must not turn that replay into backfill.
test('AC6-7: an OL Add made before M81 stays unmatched after upgrade and exact replay', async t => {
  const prior = await createCatalogueDatabase({ deferM81: true });
  try {
    const f = await olCard(prior), first = await add(prior, f); unmatched(first.item);
    const before = await effects(prior, f); await applyM81IfPresent(prior);
    assert.equal(JSON.stringify(await effects(prior, f)) === JSON.stringify(before), true, 'migration does no data backfill');
    const replay = await add(prior, f, first.command); unmatched(replay.item);
    assert.deepEqual(replay.receipt, first.receipt);
    assert.equal(JSON.stringify(await effects(prior, f)) === JSON.stringify(before), true, 'old receipt never evaluates the writer');
    t.diagnostic('Existing unmatched receipt replay and no-backfill assertions passed; checking helper contract next.');
    await requireHelper(prior);
  } finally { await prior.close(); }
});

// AC6-8 RED: no ISBN conversion/insertion/link. Literal checksum vectors from §5.1.
for (const [isbn10, isbn13, stored10] of [
  ['0306406152', '9780306406157', '0306406152'], ['054792822x', '9780547928227', '054792822X'],
  ['080-442-957X', '9780804429573', '080442957X'], [null, '9791090636071', null],
]) test('AC6-8: ISBN conversion ' + (isbn10 ?? isbn13) + ' stores compact identity only', async () => {
  const f = await olCard(db, { isbn10, isbn13: isbn10 ? null : isbn13 });
  const { item } = await add(db, f); linked(item);
  const e = (await db.query('SELECT * FROM public.canonical_editions')).rows[0];
  assert.equal(e.isbn_13, isbn13); assert.equal(e.isbn_10, stored10);
});

// AC6-9 RED: helper/prefix contract absent; no-link negatives already green.
for (const isbn13 of ['9780306406158', '4006381333931', null]) test('AC6-9: invalid/prefix/no-ISBN ' + isbn13 + ' cannot write shared rows', async t => {
  await noWrite(await legacyCard(db, { isbn10: null, isbn13 }), t); await positive();
});

// AC6-10 RED: helper admission absent; independent policy denial itself already green.
for (const [field, value] of [['enabled', false], ['provider_kind', 'vision'], ['matching_allowed', false], ['storage_allowed', false], ['public_display_allowed', false]]) {
  test('AC6-10: chosen OL survives registry ' + field + ' refusal without shared writes', async t => {
    const f = await olCard(db);
    await admin(db, () => db.query('UPDATE public.phase9_provider_registry SET ' + field + '=$1 WHERE adapter_key=$2', [value, 'open_library']));
    await noWrite(f, t); await requireHelper(db);
  });
}
// AC6-10 RED: helper absent. Registry FKs prohibit deleting bound registry rows;
// minimal legacy unresolvable adapter/lineage is the explicitly allowed substitute.
test('AC6-10: unresolvable adapter has no invented registry fallback', async t => {
  await noWrite(await legacyCard(db, { adapterKey: 'missing_provider' }), t); await positive();
});

// AC6-11 RED: binding/admission helper absent; mismatch negatives themselves are green.
for (const change of ['adapter-version', 'policy-version', 'attempt-id', 'correlation-id', 'normalizer', 'query-identity', 'wrong-store-lineage']) {
  test('AC6-11: ' + change + ' skips without losing chosen JSON or retrying', async t => {
    let f;
    if (change === 'attempt-id') f = await legacyCard(db, { attemptId: randomUUID() });
    else if (change === 'correlation-id') f = await legacyCard(db, { correlationId: randomUUID() });
    else if (change === 'normalizer') f = await legacyCard(db, { normalizerVersion: 'unrecognized-v1' });
    else if (change === 'wrong-store-lineage') {
      const other = await olCard(db); f = await legacyCard(db, { correlationId: other.lookupId, attemptId: other.attemptId });
    } else {
      f = await olCard(db);
      await admin(db, () => change === 'query-identity'
        ? db.query('UPDATE public.phase9_metadata_lookups SET query_identity=$1 WHERE id=$2', ['different-query', f.lookupId])
        : db.exec("UPDATE public.phase9_provider_registry SET " + (change === 'adapter-version' ? "adapter_version='2.0.0'" : 'policy_version=2') + " WHERE adapter_key='open_library'"));
    }
    await noWrite(f, t); await requireHelper(db);
  });
}
// AC6-11 RED: positive bound OL fallback link absent. Real request/primary receipt/
// finish-for-fallback/secondary registration/completion/selection; no provider HTTP.
test('AC6-11: selected OL attempt remains authority when lookup primary is Google', async () => {
  const f = await olCard(db, {}, { fallback: true }); await resetActor(db);
  assert.equal((await db.query('SELECT provider_role FROM public.metadata_enrichment_attempts WHERE id=$1', [f.attemptId])).rows[0].provider_role, 'secondary');
  linked((await add(db, f)).item);
});
// AC6-11 RED: helper absent; selected-mode lookup mismatch skips, never fails Add.
// TODO(confirm at implementation): §6 leaves the automatic query comparison SQL
// open. Use another REAL lookup identity rather than assuming its array shape.
test('AC6-11: selected-mode lineage on a different automatic query skips safely', async t => {
  const f = await automaticCard(db), other = await automaticCard(db, { isbn10: null, isbn13: '9780547928227' });
  await admin(db, () => db.query('UPDATE public.phase9_metadata_lookups SET query_identity=$1 WHERE id=$2', [other.context.queryIdentity, f.lookupId]));
  await setActor(db, f.ownerId); await saveReview(db, f);
  await noWrite(f, t); await requireHelper(db);
});
// AC6-11 RED: helper absent; agreeing versions are observations, never a hard-coded 1.0.0.
test('AC6-11: a coherently versioned retained selection is admitted after a provider version change', async () => {
  // Bounded legacy version fixture: completed lookup/attempt/chosen payload are
  // advanced together as postgres; no immutable snapshot or provider HTTP changes.
  const f = await legacyCard(db, { adapterVersion: '2.0.0' }); await resetActor(db);
  await db.exec("UPDATE public.phase9_provider_registry SET adapter_version='2.0.0' WHERE adapter_key='open_library'");
  await db.query("UPDATE public.metadata_enrichment_attempts SET adapter_version='2.0.0' WHERE id=$1", [f.attemptId]);
  await db.query("UPDATE public.phase9_metadata_lookups SET adapter_version='2.0.0' WHERE id=$1", [f.lookupId]);
  linked((await add(db, f)).item);
});

// AC6-12 RED: helper absent; no-orphan/conflict negatives alone already green.
for (const variant of ['different-title', 'split-probes', 'different-populated-13', 'null-work']) {
  test('AC6-12: ' + variant + ' preserves incumbent bytes and rolls back the losing work', async t => {
    const f = await olCard(db), m = f.facts;
    if (variant === 'split-probes') {
      await seedIncumbent(db, { ...m, isbn10: null });
      await seedIncumbent(db, { ...m, title: 'Other Work', isbn13: '9780547928227' });
    } else await seedIncumbent(db, { ...m,
      ...(variant === 'different-title' ? { title: 'Other Work' } : {}),
      ...(variant === 'different-populated-13' ? { isbn13: '9780547928227' } : {}) }, { orphan: variant === 'null-work' });
    await noWrite(f, t); await requireHelper(db);
  });
}

// AC6-13 RED: one-work/two-edition concurrency missing; native PG owns this row.
// AC6-14 RED: helper resolution absent; coherent surviving CAN path already green.
for (const currentSuggestion of [false, true]) test('AC6-14: saved CAN ' + currentSuggestion + ' links only its scoped surviving target', async t => {
  const f = await labelledCard(db, 'CAN', { currentSuggestion }), before = await catalogueBytes(db);
  const { item } = await add(db, f); linked(item);
  assert.equal(item.canonical_edition_id, f.target.editionId); assert.equal(item.canonical_work_id, f.target.workId);
  assert.deepEqual(await catalogueBytes(db), before, 'surviving CAN link never updates incumbents');
  t.diagnostic('Existing scoped CAN link and incumbent-byte assertions passed; checking helper contract next.'); await requireHelper(db);
});
// AC6-14 RED: helper absent; cross-selection refusal is already green.
test('AC6-14: another candidate snapshot UUID cannot redirect a saved choice', async t => {
  const a = await automaticCard(db), b = await automaticCard(db); await resetActor(db);
  // Bounded negative server-state seed: the FK allows a snapshot ID but does
  // not prove candidate/store binding. Add must independently prove that scope.
  await db.query(`UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=$1::uuid,
    owner_review_snapshot=jsonb_set(owner_review_snapshot,'{value,metadataChoice,selectionId}',to_jsonb($1::uuid::text)) WHERE id=$2`, [b.selectionId, a.candidateId]);
  // M29 clears readiness when that ID changes. Keep the negative scoped to the
  // foreign candidate's selection, rather than an unrelated unsaved-review gate.
  await db.query('UPDATE public.image_extraction_candidates SET review_ready=true WHERE id=$1', [a.candidateId]);
  const before = await effects(db, a), command = await currentCommitSql(db, a);
  await setActor(db, a.ownerId);
  await refuses(() => scalar(db, command), /P9_STATE_CONFLICT/);
  assert.equal(JSON.stringify(await effects(db, a)) === JSON.stringify(before), true, 'misbound choice refusal leaves no effects');
  t.diagnostic('Existing cross-candidate refusal and zero-effect assertions passed; checking helper contract next.'); await requireHelper(db);
});

// AC6-15 RED: assert existence FIRST; missing function must not masquerade as denied ACL.
test('AC6-15: helper has exact private ownership, volatility, search path and four-role ACL', async () => {
  await requireHelper(db);
  assert.equal(await scalar(db, "SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='marketplace_sec' AND p.proname='phase9_catalogue_link_for_add_v1'"), 1);
  const p = (await db.query("SELECT p.prosecdef,p.provolatile,p.proconfig,r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=$1::regprocedure", [helper])).rows[0];
  assert.deepEqual([p.prosecdef, p.provolatile, p.rolname], [true, 'v', 'postgres']);
  assert.equal(Array.isArray(p.proconfig) && (p.proconfig.includes('search_path=""') || p.proconfig.includes('search_path=')), true);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, helper])).rows[0].allowed, false);
    await setActor(db, randomUUID(), role);
    await refuses(() => db.query('SELECT * FROM marketplace_sec.phase9_catalogue_link_for_add_v1($1,$2,$3)', [randomUUID(), randomUUID(), randomUUID()]), /permission denied/);
    await resetActor(db);
  }
  assert.equal(await scalar(db, "SELECT NOT EXISTS(SELECT 1 FROM pg_proc p,aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='" + helper + "'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE')"), true);
  const addSignature = 'public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)';
  for (const [role, allowed] of [['authenticated', true], ['anon', false], ['service_role', false]])
    assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, addSignature])).rows[0].allowed, allowed);
  await positive();
});

// AC6-16 RED: catalogue atomicity/helper absent; existing eligibility refusals are green.
for (const refusal of ['owner', 'session', 'removed', 'expired', 'stale-review', 'stale-version', 'unsatisfied-selling']) {
  test('AC6-16: ' + refusal + ' refuses before any catalogue/inventory effect', async t => {
    const f = await olCard(db), command = await currentCommitSql(db, f);
    await resetActor(db);
    const updates = { removed: "review_disposition='owner_removed_from_scan'",
      'stale-review': 'review_version=review_version+1', 'stale-version': 'version=version+1', 'unsatisfied-selling': 'review_ready=false' };
    // Existing Add refuses an expired SESSION (M54 lifecycle fence); it never reads candidate.expires_at.
    if (refusal === 'expired') await db.query("UPDATE public.image_extraction_sessions SET expires_at=transaction_timestamp()-interval '1 second' WHERE id=$1", [f.sessionId]);
    else if (updates[refusal]) await db.query('UPDATE public.image_extraction_candidates SET ' + updates[refusal] + ' WHERE id=$1', [f.candidateId]);
    const before = await effects(db, f);
    await setActor(db, refusal === 'owner' ? randomUUID() : f.ownerId);
    await refuses(() => scalar(db, refusal === 'session' ? command.replace(f.sessionId, randomUUID()) : command), refusal === 'expired' ? /P9_STATE_CONFLICT/ : /P9_/);
    assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true, 'eligibility refusal leaves no effects');
    t.diagnostic('Existing eligibility refusal and zero-effect assertions passed; checking helper contract next.'); await requireHelper(db);
  });
}
// AC6-16 RED: positive insert and subtransaction contract absent; outer rollback already works.
test('AC6-16: later inventory error rolls back helper rows, replay reservation and all Add effects', async t => {
  const f = await olCard(db), command = await currentCommitSql(db, f), before = await effects(db, f);
  await db.exec("ALTER TABLE public.store_inventory ADD CONSTRAINT catalogue_test_failure CHECK(created_from_candidate_id<>'" + f.candidateId + "'::uuid)");
  await setActor(db, f.ownerId); await refuses(() => scalar(db, command), /catalogue_test_failure/);
  assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true, 'inventory failure rolls back all Add effects');
  t.diagnostic('Existing inventory-error rollback assertions passed; checking linked retry next.');
  await db.exec('ALTER TABLE public.store_inventory DROP CONSTRAINT catalogue_test_failure');
  linked((await add(db, f, command)).item);
});
// AC6-16 RED: current Add never reaches the canonical insert; unexpected errors
// must fail atomically rather than be caught as a successful catalogue skip (§14 OQ7).
for (const signal of ['unrecognized-unique', 'infrastructure']) test('AC6-16: unexpected ' + signal + ' fails Add without residue', async () => {
  const f = await olCard(db), command = await currentCommitSql(db, f), before = await effects(db, f);
  await db.exec(`CREATE FUNCTION public.catalogue_test_error() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    ${signal === 'unrecognized-unique' ? "RAISE unique_violation USING CONSTRAINT='catalogue_unknown_constraint';" : "RAISE EXCEPTION USING ERRCODE='XX000',MESSAGE='catalogue_test_infrastructure';"}
    END$$; CREATE TRIGGER catalogue_test_error BEFORE INSERT ON public.canonical_editions FOR EACH ROW EXECUTE FUNCTION public.catalogue_test_error()`);
  try {
    await setActor(db, f.ownerId);
    await refuses(() => scalar(db, command), signal === 'unrecognized-unique' ? /unique|catalogue_unknown_constraint/i : /catalogue_test_infrastructure/);
    assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true);
  } finally { await resetActor(db); await db.exec('DROP TRIGGER catalogue_test_error ON public.canonical_editions; DROP FUNCTION public.catalogue_test_error()'); }
});

// AC6-17 RED: new provider-only mapping missing; cover exclusions are green regressions.
for (const coverReference of [null, 'https://covers.openlibrary.org/b/id/123-M.jpg']) test('AC6-17: provider ' + (coverReference === null ? 'null cover' : 'own OL cover') + ' and und language map without enrichment', async () => {
  const f = await olCard(db, { coverReference, language: 'und', categories: [] }), { item } = await add(db, f); linked(item);
  const e = (await db.query('SELECT * FROM public.canonical_editions')).rows[0];
  assert.equal(e.cover_url, coverReference); assert.deepEqual(e.categories, []); assert.equal(e.language, 'und');
});
// AC6-17 RED: helper admission absent; OL-key Google URL no-link alone is green.
test('AC6-17: OL key cannot admit a Google/representative/Owner cover', async t => {
  await noWrite(await legacyCard(db, { coverReference: 'https://books.google.com/books/content?id=private-alternate' }), t);
  await positive();
});

// AC6-18 RED: retained chosen lineage has no shared link today; chosen durability already green.
for (const refresh of [false, true]) test('AC6-18: chosen OL survives cleanup and ' + (refresh ? 'newer completed lookup' : 'expiry'), async t => {
  const f = await olCard(db), chosen = await selectionBytes(db, f); await expire(db, f);
  await resetActor(db); await db.query('SELECT marketplace_sec.phase9_edition_clear_options($1)', [f.candidateId]);
  if (refresh) {
    const newer = await refreshOL(db, f); await resetActor(db);
    const state = (await db.query('SELECT source_lookup_id,source_attempt_id FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0];
    assert.equal(state.source_lookup_id, newer.lookupId); assert.notEqual(state.source_lookup_id, f.lookupId);
    assert.equal(state.source_attempt_id, newer.attemptId);
  }
  const calls = await bytes(db, 'phase9_metadata_provider_calls');
  const { item } = await add(db, f); assert.equal(item.publisher, f.facts.publisher, 'private hydration survives cleanup');
  assert.equal(await selectionBytes(db, f) === chosen, true, 'chosen bytes survive cleanup and Add');
  assert.equal(await bytes(db, 'phase9_metadata_provider_calls') === calls, true, 'Add makes no provider calls');
  t.diagnostic('Existing retained-choice durability, private hydration and no-provider-call assertions passed; checking link next.');
  linked(item);
  assert.equal((await db.query('SELECT publisher FROM public.canonical_editions WHERE id=$1', [item.canonical_edition_id])).rows[0].publisher, f.facts.publisher);
});
// AC6-19: intentionally no slice-6 test; blocklist belongs to slice 7, §10/OQ2.

// AC6-20 RED: selected gate/explicit absence refusal or current_suggestion FK failure;
// admitted OL fallback also missing. §10 synthetic stale-reference construction only.
for (const admitted of [false, true]) for (const currentSuggestion of [false, true]) {
  test('AC6-20: stale ' + (admitted ? 'OL' : 'CAN') + ' ' + currentSuggestion + ' succeeds without a dangling ID', async () => {
    const f = await staleCard(db, { admitted, currentSuggestion, hint: true }), chosen = await selectionBytes(db, f);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.canonical_editions WHERE id=$1', [f.staleId])).rows[0].n, 0);
    const { item } = await add(db, f); if (admitted) linked(item); else unmatched(item);
    assert.notEqual(item.canonical_edition_id, f.staleId); assert.equal(await selectionBytes(db, f) === chosen, true);
  });
}

// AC6-21 RED: disappearance-safe helper missing. Actual allowed work delete; no FK/trigger bypass.
test('AC6-21: work deleted after selection SET NULLs the edition and preserves saved bytes', async t => {
  const f = await labelledCard(db, 'CAN'), before = await selectionBytes(db, f);
  await db.query('DELETE FROM public.canonical_works WHERE id=$1', [f.target.workId]);
  assert.equal((await db.query('SELECT work_id FROM public.canonical_editions WHERE id=$1', [f.target.editionId])).rows[0].work_id,
    null, 'real work deletion SET NULLs the surviving edition');
  const { item } = await add(db, f);
  assert.equal(await selectionBytes(db, f) === before, true, 'work deletion and Add preserve chosen bytes');
  assert.equal(item.publisher, f.facts.publisher, 'orphan edition still hydrates private metadata');
  t.diagnostic('Real SET NULL deletion, saved-byte and private-hydration assertions passed; checking NULL/NULL policy next.');
  unmatched(item);
});

// AC6-22 RED: M69 returns edition-only IDs for orphan CAN; no-repair alone already green.
test('AC6-22: orphan CAN hydrates existing fields but never links or repairs it', async t => {
  const f = await labelledCard(db, 'ORPHAN-CAN'), before = await catalogueBytes(db);
  assert.equal((await db.query('SELECT work_id FROM public.canonical_editions WHERE id=$1', [f.target.editionId])).rows[0].work_id,
    null, 'ORPHAN-CAN starts with an existing edition and no work');
  const { item } = await add(db, f); assert.equal(item.publisher, f.facts.publisher, 'orphan edition still hydrates private metadata');
  assert.deepEqual(await catalogueBytes(db), before, 'orphan edition is never repaired');
  t.diagnostic('Existing orphan, private-hydration and no-repair assertions passed; checking NULL/NULL policy next.');
  unmatched(item);
});
// AC6-22 RED: helper missing; OL ISBN orphan skip alone green, paired positive is red.
test('AC6-22: OL ISBN hit on an orphan does not manufacture a work', async t => {
  const f = await olCard(db); await seedIncumbent(db, f.facts, { orphan: true });
  await noWrite(f, t); await requireHelper(db);
});

// AC6-23 RED: first stale-target Add/fallback fails; replay short circuit already green.
for (const admitted of [false, true]) test('AC6-23: stale-target ' + admitted + ' receipt ignores later catalogue changes', async () => {
  const f = await staleCard(db, { admitted }), first = await add(db, f);
  if (admitted) linked(first.item); else unmatched(first.item);
  await resetActor(db);
  if (admitted) await db.query('DELETE FROM public.canonical_editions WHERE id=$1', [first.item.canonical_edition_id]);
  else await seedIncumbent(db, f.facts);
  const before = await effects(db, f), chosen = await selectionBytes(db, f);
  const second = await add(db, f, first.command); assert.deepEqual(second.receipt, first.receipt);
  assert.equal(JSON.stringify(await effects(db, f)) === JSON.stringify(before), true);
  assert.equal(await selectionBytes(db, f) === chosen, true);
  if (admitted) {
    // Edition deletion SET NULLs ONLY its FK; replay must neither repair that
    // ID nor clear the surviving work FK as a fresh helper evaluation might.
    assert.equal(second.item.canonical_edition_id, null);
    assert.equal(second.item.canonical_work_id, first.item.canonical_work_id);
  } else unmatched(second.item);
});

// AC6-24 RED: fixture broad client grants remain before M81. Actual roles/DML are PG.
test('AC6-24: both canonical tables retain SELECT and lose every client write privilege', async () => {
  await resetActor(db);
  for (const table of ['canonical_works', 'canonical_editions']) for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("SELECT has_table_privilege($1,$2,'SELECT') AS allowed", [role, 'public.' + table])).rows[0].allowed, true);
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'])
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, 'public.' + table, privilege])).rows[0].allowed, false, role + ' ' + privilege + ' ' + table);
  }
  await positive();
});

// AC6-25 RED: IDs missing; coherent payload must still hydrate when ISBN finds sparse incumbent.
test('AC6-25: selected OL links sparse ISBN incumbent without copying NULL optional fields', async () => {
  const f = await automaticCard(db), incumbent = await seedIncumbent(db, f.facts, { sparse: true }), before = await catalogueBytes(db);
  const { item } = await add(db, f); linked(item); assert.equal(item.canonical_edition_id, incumbent.editionId);
  assert.deepEqual([item.publisher, item.published_date, item.cover_url], [f.facts.publisher, f.facts.publishedDate, f.facts.coverReference]);
  assert.deepEqual(await catalogueBytes(db), before);
});

// AC6-26 RED: valid stale selected-mode fallback missing; invalid branches already refuse.
for (const invalid of ['no-clue', 'changed-identity', 'unconfirmed', 'missing-selection', 'manual-outcome']) {
  test('AC6-26: stale target does not relax ' + invalid + ' saved-choice gate', async t => {
    const f = await staleCard(db, { admitted: true, invalidOutcome: invalid === 'manual-outcome' }); await resetActor(db);
    const changes = { 'no-clue': 'observed_isbn_clue=NULL', 'changed-identity': `owner_review_snapshot=jsonb_set(owner_review_snapshot,'{value,originalTitle}','"Incompatible title"')`,
      unconfirmed: `owner_review_snapshot=jsonb_set(owner_review_snapshot,'{value,originalFieldConfirmation,title}','false')`,
      'missing-selection': 'selected_metadata_snapshot_id=NULL' };
    if (changes[invalid]) await db.query('UPDATE public.image_extraction_candidates SET ' + changes[invalid] + ' WHERE id=$1', [f.candidateId]);
    const command = await currentCommitSql(db, f); await setActor(db, f.ownerId);
    await refuses(() => scalar(db, command), /P9_STATE_CONFLICT/);
    assert.equal(await count('store_inventory'), 0); assert.equal(await count('canonical_works'), 0);
    t.diagnostic('Existing invalid saved-choice refusal and zero-row assertions passed; checking eligible stale fallback next.');
    // Paired positive of the same stale selected path, not a fabricated negative red.
    linked((await add(db, await staleCard(db, { admitted: true }))).item);
  });
}

// AC6-27 RED: helper cannot create from reduced current_suggestion; full payload required.
test('AC6-27: automatic OL current_suggestion uses full bound immutable provider payload', async () => {
  const f = await automaticCard(db, {}, { currentSuggestion: true });
  await resetActor(db);
  const projected = (await db.query('SELECT selected_option_snapshot AS m FROM public.phase9_candidate_edition_state WHERE candidate_id=$1', [f.candidateId])).rows[0].m;
  assert.equal(Object.hasOwn(projected, 'adapterKey'), false); assert.equal(Object.hasOwn(projected, 'attemptId'), false);
  const before = await selectionBytes(db, f); linked((await add(db, f)).item);
  assert.equal(await selectionBytes(db, f) === before, true);
});
// AC6-27 RED: helper absent; mismatched full/display JSON skip is a green negative.
test('AC6-27: mismatching full current_suggestion payload cannot create shared facts', async t => {
  const f = await automaticCard(db, {}, { currentSuggestion: true });
  await resetActor(db);
  // Mutable display state only, immutable provider snapshot is never edited.
  await db.query(`UPDATE public.phase9_candidate_edition_state SET selected_option_snapshot=jsonb_set(selected_option_snapshot,'{publisher}','"Different display"') WHERE candidate_id=$1`, [f.candidateId]);
  await noWrite(f, t); await requireHelper(db);
});
// AC6-27 RED: helper absent; existing Google automatic suggestion remains Google.
test('AC6-27: Google-backed current_suggestion succeeds privately without promotion', async t => {
  const f = await originalSelection(db, await seedCard(db));
  f.selected = await scalar(db, selectSql(f, await scalar(db, readSql(f)), f.selectionId, { source: 'current_suggestion' }));
  await saveReview(db, f); await noWrite(f, t); await requireHelper(db);
});

// AC6-28 RED: ISBN reuse normalization-at-compare helper absent; keys never rewritten.
test('AC6-28: display-cased incumbent author keys are compared after normalization only', async () => {
  const f = await olCard(db, { authors: ['Canonical Author'] });
  const target = await seedIncumbent(db, f.facts, { displayKey: true }), before = await catalogueBytes(db);
  const { item } = await add(db, f); linked(item); assert.equal(item.canonical_edition_id, target.editionId);
  assert.deepEqual(await catalogueBytes(db), before);
});

// Owner 2026-10-25, M81 fix round 2; 02a §§7.2/14 OQ7: predictable key overflow skips.
test('AC6-29: maximum-size OL authors skip oversized catalogue keys and preserve private metadata', async () => {
  // M73 permits 20 authors of 256 characters. Independent hash blocks avoid compression of repeated digests.
  const authors = Array.from({ length: 20 }, (_, author) => Array.from({ length: 4 }, (_, chunk) =>
    createHash('sha256').update(`catalogue-oversized-author:${author}:${chunk}`).digest('hex')).join(''));
  // Search with one author; the admitted result supplies the remaining authors without overflowing query_identity.
  const f = await olCard(db, { authors }, { queryAuthors: authors.slice(0, 1) });
  await resetActor(db);
  assert.equal((await db.query('SELECT marketplace_sec.phase9_edition_valid_normalized_metadata($1::jsonb) AS valid', [f.facts])).rows[0].valid, true);
  const before = await catalogueBytes(db), chosen = await selectionBytes(db, f);
  const counts = [await count('canonical_works'), await count('canonical_editions')];
  const { item } = await add(db, f); unmatched(item);
  assert.deepEqual([await count('canonical_works'), await count('canonical_editions')], counts, 'no helper rows remain');
  assert.deepEqual(await catalogueBytes(db), before, 'catalogue bytes remain unchanged');
  assert.equal(await selectionBytes(db, f), chosen, 'chosen metadata survives Add');
  assert.deepEqual(item.authors, authors);
  for (const [column, field] of Object.entries({ title: 'title', isbn_10: 'isbn10', isbn_13: 'isbn13',
    publisher: 'publisher', published_date: 'publishedDate', cover_url: 'coverReference', language: 'language' }))
    assert.equal(item[column], f.facts[field], column);
  assert.deepEqual([item.visibility_status, item.publication_status], ['draft', 'private']);
});
