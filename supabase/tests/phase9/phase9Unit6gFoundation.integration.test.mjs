import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { migrationPath, resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  commitSql, createUnit7aDatabase, seedReviewedCandidate,
} from './unit7aFixture.mjs';

const M52 = '20260821000052_marketplace_phase9_unit6g_contract_persistence_foundation.sql';
const M53 = '20260827000053_marketplace_phase9_unit6g_field_authority_correction.sql';
const M54 = '20260829000054_marketplace_phase9_unit6g_session_lifecycle_fence.sql';
let db;
const sqlJson = (value) => JSON.stringify(value).replaceAll("'", "''");

before(async () => {
  db = await createUnit7aDatabase();
  // The compact Phase 9 PGlite baseline predates the canonical Phase 6 registry.
  await db.exec(`CREATE TABLE IF NOT EXISTS public.marketplace_event_schema_registry(
    event_type text NOT NULL,schema_version integer NOT NULL CHECK(schema_version>=1),
    entity_type text NOT NULL,is_transition boolean NOT NULL,
    privacy_classification text NOT NULL CHECK(privacy_classification IN('internal','confidential')),
    PRIMARY KEY(event_type,schema_version));
    ALTER TABLE public.marketplace_events
      ADD COLUMN IF NOT EXISTS actor_role text,
      ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system_job',
      ADD COLUMN IF NOT EXISTS idempotency_key text,
      ADD COLUMN IF NOT EXISTS command_id uuid,
      ADD COLUMN IF NOT EXISTS correlation_id uuid,
      ADD COLUMN IF NOT EXISTS causation_event_id uuid,
      ADD COLUMN IF NOT EXISTS privacy_classification text NOT NULL DEFAULT 'internal',
      ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;`);
  await db.exec(fs.readFileSync(migrationPath(M52), 'utf8'));
  await db.exec(fs.readFileSync(migrationPath(M53), 'utf8'));
  await db.exec(fs.readFileSync(migrationPath(M54), 'utf8'));
});
after(async () => db?.close());

async function ownerFixture() {
  await resetActor(db);
  const storeId = randomUUID();
  const ownerId = randomUUID();
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES('${storeId}','Unit 6G Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
      VALUES('${storeId}','${ownerId}','owner','active');
  `);
  await setActor(db, ownerId);
  return { storeId, ownerId };
}

async function start(fixture, overrides = {}) {
  await setActor(db, fixture.ownerId);
  const commandId = overrides.commandId ?? randomUUID();
  const key = overrides.key ?? `unit6g-start-${randomUUID()}`;
  const condition = Object.hasOwn(overrides, 'condition') ? overrides.condition : 'good';
  const price = Object.hasOwn(overrides, 'price') ? overrides.price : 25000;
  const label = Object.hasOwn(overrides, 'label') ? overrides.label : 'August intake';
  const sql = `SELECT public.phase9_start_session_v2(
    'en',${condition === null ? 'NULL' : `'${condition}'`},'Shelf A',
    ${price === null ? 'NULL' : price},'private',
    ${label === null ? 'NULL' : `'${label}'`},'${key}','${commandId}')`;
  return { result: await scalar(db, sql), sql, key, commandId };
}

async function candidate(fixture, sessionId, state = 'needs_review', disposition = null) {
  await resetActor(db);
  return scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,review_disposition,metadata_revision)
    VALUES('${sessionId}','${fixture.storeId}',1,'Detected Book',ARRAY['Author'],
      'en','${state}',${disposition ? `'${disposition}'` : 'NULL'},1)
    RETURNING id::text`);
}

test('U6G-G1-01 M52 adds nullable bounded session persistence and exact disposition', async () => {
  const metadata = (await db.query(`SELECT column_name,is_nullable,data_type
    FROM information_schema.columns WHERE table_schema='public'
      AND table_name='image_extraction_sessions'
      AND column_name IN ('default_condition','default_price_minor','batch_label')
    ORDER BY column_name`)).rows;
  assert.deepEqual(metadata, [
    { column_name: 'batch_label', is_nullable: 'YES', data_type: 'text' },
    { column_name: 'default_condition', is_nullable: 'YES', data_type: 'text' },
    { column_name: 'default_price_minor', is_nullable: 'YES', data_type: 'integer' },
  ]);
  await assert.rejects(db.query(`INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,review_disposition) VALUES(
      gen_random_uuid(),gen_random_uuid(),1,'x',ARRAY[]::text[],'en','ready','other')`));
});

test('U6G-G1-02 v2 Start persists null defaults and label with exact replay', async () => {
  const fixture = await ownerFixture();
  const first = await start(fixture, { condition: null, price: null });
  const replay = await scalar(db, first.sql);
  assert.deepEqual(replay, first.result);
  assert.equal(first.result.defaults.condition, null);
  assert.equal(first.result.defaults.priceMinor, null);
  assert.equal(first.result.defaults.quantity, 1);
  assert.equal(first.result.batchLabel, 'August intake');
  await resetActor(db);
  const row = (await db.query(`SELECT default_condition,default_price_minor,batch_label,
    default_quantity FROM public.image_extraction_sessions
    WHERE id='${first.result.sessionId}'`)).rows[0];
  assert.deepEqual(row, {
    default_condition: null, default_price_minor: null,
    batch_label: 'August intake', default_quantity: 1,
  });
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(first.sql.replace("'August intake'", "'Changed label'")),
    /P9_IDEMPOTENCY_MISMATCH/);
  const summary = await scalar(db,
    `SELECT public.phase9_owner_session_summary_v3('${first.result.sessionId}')`);
  assert.equal(summary.batchLabel, 'August intake');
  assert.equal(summary.defaults.condition, null);
});

test('U6G-G1-03 Start rejects invalid bounds and keeps caller quantity absent', async () => {
  const fixture = await ownerFixture();
  await setActor(db, fixture.ownerId);
  for (const sql of [
    `SELECT public.phase9_start_session_v2('en',NULL,'',NULL,'private',NULL,
      'unit6g-invalid-0001',gen_random_uuid())`,
    `SELECT public.phase9_start_session_v2('en',NULL,'A',-1,'private',NULL,
      'unit6g-invalid-0002',gen_random_uuid())`,
    `SELECT public.phase9_start_session_v2('en',NULL,'A',NULL,'private','${'x'.repeat(81)}',
      'unit6g-invalid-0003',gen_random_uuid())`,
  ]) await assert.rejects(db.query(sql), /P9_REQUEST_INVALID/);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      AND p.proname='phase9_start_session_v2'
      AND pg_get_function_identity_arguments(p.oid) LIKE '%quantity%'`), 0);
});

test('U6G-G1-04 removal is versioned, exactly replayed, audited and counted', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId, 'processing');
  await setActor(db, fixture.ownerId);
  const key = `unit6g-remove-${randomUUID()}`;
  const commandId = randomUUID();
  const presentationBefore = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${started.result.sessionId}')`))
    .presentationRevision;
  const sql = `SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',1,'${key}','${commandId}')`;
  const first = await scalar(db, sql);
  assert.deepEqual(await scalar(db, sql), first);
  assert.equal(first.reviewDisposition, 'owner_removed_from_scan');
  assert.equal(first.candidateVersion, 2);
  assert.equal(first.presentationRevision, presentationBefore + 1);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE action='phase9.candidate.owner_removed_from_scan' AND entity_id='${candidateId}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE event_type='phase9.candidate.owner_removed_from_scan' AND entity_id='${candidateId}'`), 1);
  await setActor(db, fixture.ownerId);
  const batch = await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${started.result.sessionId}')`);
  assert.equal(batch.counts.ownerRemoved, 1);
  assert.equal(batch.counts.needsAttention, 0);
  assert.equal(batch.items.length, 0);
  const closed = await scalar(db, `SELECT public.phase9_close_session_v3(
    '${started.result.sessionId}',1,'unit6g-close-${randomUUID()}',gen_random_uuid())`);
  assert.equal(closed.closeSummary.ownerRemovedCandidates, 1);
  assert.equal(closed.closeSummary.candidatesNeedsReview, 0);
});

test('U6G-G1-12 legacy session page excludes owner-removed candidates', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const removedId = await candidate(fixture, started.result.sessionId, 'ready');
  await setActor(db, fixture.ownerId);
  await db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${removedId}',1,'unit6g-page-${randomUUID()}',
    gen_random_uuid())`);
  const keptId = await candidate(fixture, started.result.sessionId, 'needs_review');
  await setActor(db, fixture.ownerId);
  const page = await scalar(db, `SELECT public.phase9_owner_candidates_page_v2(
    'session','${started.result.sessionId}','all',20,NULL)`);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].candidateId, keptId);
});

test('U6G-G1-05 removal fences stale, changed replay and any reactivation', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId, 'ready');
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',2,'unit6g-stale-00001',gen_random_uuid())`),
  /P9_CANDIDATE_VERSION_CONFLICT/);
  const key = 'unit6g-remove-fence-0001';
  const command = randomUUID();
  const base = `SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',1,'${key}','${command}')`;
  await db.query(base);
  await assert.rejects(db.query(base.replace(command, randomUUID())), /P9_IDEMPOTENCY_MISMATCH/);
  await resetActor(db);
  await assert.rejects(db.query(`UPDATE public.image_extraction_candidates
    SET review_disposition='reviewed',state='ready' WHERE id='${candidateId}'`),
  /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT review_disposition FROM public.image_extraction_candidates
    WHERE id='${candidateId}'`), 'owner_removed_from_scan');
});

test('U6G-G1-06 removal is initiating-Owner isolated and grants are narrow', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId);
  const foreign = await ownerFixture();
  await setActor(db, foreign.ownerId);
  await assert.rejects(db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',1,'unit6g-cross-00001',gen_random_uuid())`),
  /P9_OWNER_NOT_AUTHORIZED/);
  for (const signature of [
    'phase9_start_session_v2(text,text,text,integer,text,text,text,uuid)',
    'phase9_owner_session_summary_v3(uuid)', 'phase9_owner_batch_review_v1(uuid)',
    'phase9_owner_remove_candidate_v1(uuid,uuid,integer,text,uuid)',
    'phase9_close_session_v3(uuid,integer,text,uuid)',
  ]) {
    assert.equal(await scalar(db,
      `SELECT has_function_privilege('authenticated','public.${signature}','EXECUTE')`), true);
    assert.equal(await scalar(db,
      `SELECT has_function_privilege('anon','public.${signature}','EXECUTE')`), false);
    assert.equal(await scalar(db,
      `SELECT has_function_privilege('service_role','public.${signature}','EXECUTE')`), false);
  }
});

test('U6G-G1-07 nullable sessions require v3 Close while legacy v2 still works', async () => {
  const fixture = await ownerFixture();
  const nullable = await start(fixture, { condition: null });
  await assert.rejects(db.query(`SELECT public.phase9_close_session_v2(
    '${nullable.result.sessionId}',1,'unit6g-v2-close-001',gen_random_uuid())`),
  /P9_STATE_CONFLICT/);
  const legacyFixture = await ownerFixture();
  const legacy = await start(legacyFixture, {
    condition: 'good', key: `unit6g-legacy-${randomUUID()}`,
  });
  const closed = await scalar(db, `SELECT public.phase9_close_session_v2(
    '${legacy.result.sessionId}',1,'unit6g-v2-close-002',gen_random_uuid())`);
  assert.equal(closed.sessionStatus, 'closed');
  assert.equal(Object.hasOwn(closed.closeSummary, 'ownerRemovedCandidates'), false);
});

test('U6G-G1-08 owner removal cannot enter unchanged M39 commit', async () => {
  const fixture = await seedReviewedCandidate(db);
  const key = `unit6g-remove-${randomUUID()}`;
  await db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${fixture.sessionId}','${fixture.candidateId}',${fixture.candidateVersion},
    '${key}',gen_random_uuid())`);
  await assert.rejects(db.query(commitSql(fixture, {
    candidateVersion: fixture.candidateVersion + 1,
    idempotencyKey: `unit6g-m39-deny-${randomUUID()}`,
  })), /P9_STATE_CONFLICT/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 0);
});

test('U6G-G1-09 unchanged M39 still creates exact private quantity buckets', async () => {
  const fixture = await seedReviewedCandidate(db, { review: { quantity: 4 } });
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  assert.deepEqual((await db.query(`SELECT publication_status,quantity_total,
    quantity_available,quantity_reserved,quantity_sold,quantity_removed
    FROM public.store_inventory WHERE id='${result.inventoryId}'`)).rows[0], {
    publication_status: 'private', quantity_total: 4, quantity_available: 4,
    quantity_reserved: 0, quantity_sold: 0, quantity_removed: 0,
  });
});

test('U6G-G1-10 field sources preserve detected/default values per field', async () => {
  const fixture = await seedReviewedCandidate(db, { review: {
    originalTitle: 'Observed title', authors: ['Observed Author'],
    originalLanguage: 'en', quantity: 1, baseCondition: 'good',
    shelfLocation: 'Default Shelf', publicationIntent: 'private',
    damageDisclosure: {
      hasDamage: false, damageTypes: [], damageNote: null,
      isSellable: true, completeReadableSafe: true,
    },
  } });
  const batch = await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${fixture.sessionId}')`);
  assert.deepEqual(batch.items[0].fieldSources, {
    cover: 'missing', title: 'detected', authors: 'detected',
    language: 'detected', condition: 'default', price: 'custom',
    quantity: 'default', location: 'default', publication: 'default',
    damage: 'default',
  });
});

test('U6G-G1-11 direct RPCs reject null command IDs', async () => {
  const fixture = await ownerFixture();
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(`SELECT public.phase9_start_session_v2(
    'en','good','Shelf A',100,'private',NULL,'unit6g-null-command-start',NULL)`),
  /P9_REQUEST_INVALID/);
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId);
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',1,'unit6g-null-command-remove',NULL)`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_close_session_v3(
    '${started.result.sessionId}',1,'unit6g-null-command-close',NULL)`),
  /P9_REQUEST_INVALID/);
});

test('U6G-G1-13 direct RPCs reject null idempotency keys and expected versions', async () => {
  const fixture = await ownerFixture();
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(`SELECT public.phase9_start_session_v2(
    'en','good','Shelf A',100,'private',NULL,NULL,gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_start_session_v2(
    NULL,'good','Shelf A',100,'private',NULL,'unit6g-null-lang-0001',gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_start_session_v2(
    'en','good',NULL,100,'private',NULL,'unit6g-null-loc-0001',gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_start_session_v2(
    'en','good','Shelf A',100,NULL,NULL,'unit6g-null-pub-0001',gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId);
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',NULL,
    'unit6g-null-key-remove-01',gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_owner_remove_candidate_v1(
    '${started.result.sessionId}','${candidateId}',1,NULL,gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_close_session_v3(
    '${started.result.sessionId}',NULL,'unit6g-null-version-close',gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await assert.rejects(db.query(`SELECT public.phase9_close_session_v3(
    '${started.result.sessionId}',1,NULL,gen_random_uuid())`),
  /P9_REQUEST_INVALID/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.image_extraction_candidates
    WHERE id='${candidateId}' AND review_disposition IS NOT NULL`), 0);
  assert.equal(await scalar(db, `SELECT status FROM public.image_extraction_sessions
    WHERE id='${started.result.sessionId}'`), 'active');
});

test('U6G-FA-RED-01 never-reviewed observed/default authority is not custom', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId);
  await setActor(db, fixture.ownerId);
  const batch = await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${started.result.sessionId}')`);
  assert.equal(batch.items[0].candidateId, candidateId);
  assert.deepEqual(batch.items[0].fieldSources, {
    cover: 'missing', title: 'detected', authors: 'detected',
    language: 'detected', condition: 'default', price: 'default',
    quantity: 'default', location: 'default', publication: 'default',
    damage: 'default',
  });
});

test('U6G-FA-RED-02 selected metadata without review is matched per usable field', async () => {
  const fixture = await seedReviewedCandidate(db, { selectedMetadata: true });
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates SET
    owner_review_snapshot=NULL,review_disposition=NULL,review_version=NULL,
    review_ready=false,state='needs_review' WHERE id='${fixture.candidateId}'`);
  await setActor(db, fixture.ownerId);
  const card = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${fixture.sessionId}')`)).items[0];
  assert.equal(card.review, null);
  assert.equal(card.metadataState, 'selected');
  assert.deepEqual({
    cover: card.fieldSources.cover, title: card.fieldSources.title,
    authors: card.fieldSources.authors, language: card.fieldSources.language,
  }, { cover: 'matched', title: 'matched', authors: 'matched', language: 'matched' });
});

test('U6G-FA-RED-03 malformed partial review cannot create custom authority', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates SET
    owner_review_snapshot='{"value":{"originalTitle":"partial"}}'::jsonb,
    review_disposition='reviewed',review_version=1 WHERE id='${candidateId}'`);
  await setActor(db, fixture.ownerId);
  const sources = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${started.result.sessionId}')`))
    .items[0].fieldSources;
  assert.equal(Object.values(sources).includes('custom'), false);
  assert.equal(sources.title, 'detected');
  assert.equal(sources.condition, 'default');
});

test('U6G-FA-RED-04 confirmed empty authors use missing authority', async () => {
  const fixture = await seedReviewedCandidate(db, { review: { authors: [] } });
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET observed_authors=ARRAY[]::text[] WHERE id='${fixture.candidateId}'`);
  await setActor(db, fixture.ownerId);
  const card = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${fixture.sessionId}')`)).items[0];
  assert.deepEqual(card.review.authors, []);
  assert.equal(card.fieldSources.authors, 'missing');
});

test('U6G-FA-RED-05 historical never-reviewed rows normalize on read without backfill', async () => {
  const fixture = await ownerFixture();
  const started = await start(fixture);
  const candidateId = await candidate(fixture, started.result.sessionId);
  await resetActor(db);
  const before = (await db.query(`SELECT version,owner_review_snapshot,review_version
    FROM public.image_extraction_candidates WHERE id='${candidateId}'`)).rows[0];
  await setActor(db, fixture.ownerId);
  const card = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${started.result.sessionId}')`)).items[0];
  await resetActor(db);
  const afterRead = (await db.query(`SELECT version,owner_review_snapshot,review_version
    FROM public.image_extraction_candidates WHERE id='${candidateId}'`)).rows[0];
  assert.equal(card.fieldSources.title, 'detected');
  assert.equal(card.fieldSources.condition, 'default');
  assert.deepEqual(afterRead, before);
});

test('U6G-FA-GREEN-06 reviewed values preserve matched/detected/default/custom provenance', async () => {
  const selectedFixture = await seedReviewedCandidate(db, { selectedMetadata: true });
  const selectedReview = {
    ...selectedFixture.review,
    originalTitle: `Selected canonical title ${selectedFixture.candidateId}`,
    authors: ['Canonical Author'],
    originalLanguage: 'en',
    originalFieldConfirmation: { title: true, authors: [true] },
  };
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates SET
    owner_review_snapshot='${sqlJson({
      value: selectedReview,
      confirmed_title: { value: selectedReview.originalTitle },
      confirmed_authors: selectedReview.authors,
    })}'::jsonb WHERE id='${selectedFixture.candidateId}'`);
  await setActor(db, selectedFixture.ownerId);
  const matched = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${selectedFixture.sessionId}')`))
    .items[0];
  assert.deepEqual({
    title: matched.fieldSources.title,
    authors: matched.fieldSources.authors,
    language: matched.fieldSources.language,
  }, { title: 'matched', authors: 'matched', language: 'matched' });
  assert.equal(matched.review.originalTitle, matched.metadataSummary.title);
  assert.deepEqual(matched.review.authors, matched.metadataSummary.authors);

  const inheritedFixture = await seedReviewedCandidate(db, { review: {
    originalTitle: 'Observed title', authors: ['Observed Author'],
    originalLanguage: 'en', baseCondition: 'good', shelfLocation: 'Default Shelf',
    publicationIntent: 'private', quantity: 2, priceMinor: 999,
  } });
  const inherited = (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${inheritedFixture.sessionId}')`))
    .items[0];
  assert.deepEqual({
    title: inherited.fieldSources.title,
    authors: inherited.fieldSources.authors,
    language: inherited.fieldSources.language,
    condition: inherited.fieldSources.condition,
    location: inherited.fieldSources.location,
    publication: inherited.fieldSources.publication,
    quantity: inherited.fieldSources.quantity,
    price: inherited.fieldSources.price,
  }, {
    title: 'detected', authors: 'detected', language: 'detected',
    condition: 'default', location: 'default', publication: 'default',
    quantity: 'custom', price: 'custom',
  });
});

async function projectedSelectedMetadataCard({
  title = 'Selected title', authors = ['Selected Author'], language = 'en',
  cover = 'https://books.google.com/cover.jpg', observedAuthors,
} = {}) {
  const fixture = await seedReviewedCandidate(db, { selectedMetadata: true });
  const sqlText = (value) => String(value).replaceAll("'", "''");
  const sqlTextArray = (values) => `ARRAY[${values.map((value) => `'${sqlText(value)}'`).join(',')}]::text[]`;
  await resetActor(db);
  await db.exec(`UPDATE public.canonical_editions SET
    title='${sqlText(title)}',authors=${sqlTextArray(authors)},
    language='${sqlText(language)}',cover_url='${sqlText(cover)}'
    WHERE id='${fixture.canonicalEditionId}'`);
  await db.exec(`UPDATE public.image_extraction_candidates SET
    owner_review_snapshot=NULL,review_disposition=NULL,review_version=NULL,
    review_ready=false,state='needs_review'
    ${observedAuthors === undefined ? '' : `,observed_authors=${sqlTextArray(observedAuthors)}`}
    WHERE id='${fixture.candidateId}'`);
  await setActor(db, fixture.ownerId);
  return (await scalar(db,
    `SELECT public.phase9_owner_batch_review_v1('${fixture.sessionId}')`)).items[0];
}

test('U6G-FA-001 RED-01 blank selected authors fall back per field', async () => {
  const card = await projectedSelectedMetadataCard({ authors: [''] });
  assert.equal(card.metadataSummary.authors, null);
  assert.equal(card.fieldSources.authors, 'detected');
  assert.equal(card.fieldSources.title, 'matched');
  assert.equal(card.fieldSources.language, 'matched');
  assert.equal(card.fieldSources.cover, 'matched');
});

test('U6G-FA-001 RED-02 unapproved selected cover is never matched', async () => {
  const card = await projectedSelectedMetadataCard({
    cover: 'https://evil.example/cover.jpg',
  });
  assert.equal(card.metadataSummary.coverReference, null);
  assert.equal(card.fieldSources.cover, 'missing');
});

test('U6G-FA-001 RED-03 unsafe selected title falls back per field', async () => {
  const card = await projectedSelectedMetadataCard({
    title: 'https://evil.example/active-title',
  });
  assert.equal(card.metadataSummary.title, null);
  assert.equal(card.fieldSources.title, 'detected');
  assert.equal(card.fieldSources.authors, 'matched');
});

test('U6G-FA-001 RED-04 invalid selected language falls back per field', async () => {
  const card = await projectedSelectedMetadataCard({ language: 'english' });
  assert.equal(card.metadataSummary.language, null);
  assert.equal(card.fieldSources.language, 'detected');
  assert.equal(card.fieldSources.title, 'matched');
});

test('U6G-FA-001 RED-05 valid selected metadata remains matched', async () => {
  const card = await projectedSelectedMetadataCard();
  assert.deepEqual({
    cover: card.fieldSources.cover, title: card.fieldSources.title,
    authors: card.fieldSources.authors, language: card.fieldSources.language,
  }, { cover: 'matched', title: 'matched', authors: 'matched', language: 'matched' });
});

test('U6G-FA-001 RED-07 unusable selected field with no lower authority is missing', async () => {
  const card = await projectedSelectedMetadataCard({ authors: [''], observedAuthors: [] });
  assert.equal(card.fieldSources.authors, 'missing');
  assert.equal(card.fieldSources.title, 'matched');
});
