import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import {
  createPhase9Database, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const STORE = '96000000-0000-0000-0000-000000000001';
const OWNER = '97000000-0000-0000-0000-000000000001';
const COMMAND_A = '98000000-0000-4000-8000-000000000001';
const COMMAND_B = '98000000-0000-4000-8000-000000000002';
let db;
let fixtureSequence = 0;

const escape = (value) => JSON.stringify(value).replaceAll("'", "''");
const validReview = (overrides = {}) => ({
  originalTitle: 'Reviewed Book',
  authors: ['Author'],
  originalLanguage: 'en',
  script: 'Latn',
  metadataChoice: { mode: 'manual', selectionId: null },
  quantity: 1,
  priceMinor: 0,
  baseCondition: 'good',
  damageDisclosure: {
    hasDamage: false, damageTypes: [], damageNote: null,
    isSellable: true, completeReadableSafe: true,
  },
  shelfLocation: 'A1',
  notes: { publicNote: null, internalNote: null },
  publicationIntent: 'private',
  duplicateIntent: null,
  originalFieldConfirmation: { title: true, authors: [true] },
  candidateDisposition: 'reviewed',
  ...overrides,
});

before(async () => {
  db = await createPhase9Database({
    throughMigration: '20260801000030_marketplace_phase9_unit6e_review_corrections.sql',
  });
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Store');
    INSERT INTO public.store_administrators(store_id,user_id,role,status)
      VALUES('${STORE}','${OWNER}','owner','active');
  `);
});
afterEach(async () => {
  await resetActor(db);
  await db.exec(`
    DELETE FROM public.phase9_idempotency_keys
      WHERE operation IN ('C01','U6C01','U6C02');
    DELETE FROM public.phase9_search_variant_alias_links;
    DELETE FROM public.phase9_search_variant_decisions;
    DELETE FROM public.phase9_search_variant_proposals;
    DELETE FROM public.book_search_aliases;
    UPDATE public.image_extraction_candidates SET selected_metadata_snapshot_id=NULL
      WHERE selected_metadata_snapshot_id IS NOT NULL;
    ALTER TABLE public.phase9_selected_metadata_snapshots
      DISABLE TRIGGER phase9_selected_metadata_snapshot_immutable;
    DELETE FROM public.phase9_selected_metadata_snapshots;
    ALTER TABLE public.phase9_selected_metadata_snapshots
      ENABLE TRIGGER phase9_selected_metadata_snapshot_immutable;
    DELETE FROM public.phase9_metadata_lookups;
    DELETE FROM public.metadata_enrichment_attempts;
    DELETE FROM public.image_extraction_candidates;
    ALTER TABLE public.image_analysis_observations
      DISABLE TRIGGER image_analysis_observations_immutable;
    ALTER TABLE public.image_analysis_results
      DISABLE TRIGGER image_analysis_results_immutable;
    DELETE FROM public.image_analysis_observations;
    DELETE FROM public.image_analysis_results;
    ALTER TABLE public.image_analysis_observations
      ENABLE TRIGGER image_analysis_observations_immutable;
    ALTER TABLE public.image_analysis_results
      ENABLE TRIGGER image_analysis_results_immutable;
    DELETE FROM public.image_extraction_inputs;
    DELETE FROM public.image_extraction_jobs;
    DELETE FROM public.media_assets WHERE bucket_id='unit6a-mutation';
    DELETE FROM public.image_extraction_sessions;
    DELETE FROM public.marketplace_book_listings;
    DELETE FROM public.store_inventory;
    DELETE FROM public.canonical_editions WHERE title LIKE 'Unit 6A%';
  `);
});
after(async () => db?.close());

async function fixture(state = 'needs_review') {
  await setActor(db, OWNER);
  fixtureSequence += 1;
  const sessionId = await scalar(db, `SELECT public.phase9_start_session(
    NULL,'en',NULL,'good','A1',1,'private',
    'mutation-${String(fixtureSequence).padStart(8, '0')}',gen_random_uuid())`);
  await resetActor(db);
  const candidateId = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,observed_script,state,metadata_revision)
    VALUES('${sessionId}','${STORE}',1,'Observed',ARRAY['Author'],'en','Latn',
      '${state}',1) RETURNING id::text`);
  return { sessionId, candidateId };
}

async function media(sessionId, suffix) {
  await resetActor(db);
  return scalar(db, `INSERT INTO public.media_assets(
    store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
    detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)
    VALUES('${STORE}','${OWNER}','scan_input','private_scan','unit6a-mutation',
      '${sessionId}/${suffix}','${String(suffix).padStart(64, 'e').slice(-64)}',
      'image/webp',1,1,1,'${sessionId}','phase9_scan_input','approved')
    RETURNING id::text`);
}

const updateSql = ({ sessionId, candidateId }, review, {
  candidateVersion = 1, metadataRevision = 1,
  key = 'mutation-review-001', command = COMMAND_A,
} = {}) => `SELECT public.phase9_update_candidate_review_v2(
  '${sessionId}','${candidateId}',${candidateVersion},${metadataRevision},
  '${escape(review)}'::jsonb,'${key}','${command}')`;

test('U6C01 transitions ready, needs_review and possible_duplicate to canonical ready', async () => {
  for (const state of ['ready','needs_review','possible_duplicate']) {
    const ids = await fixture(state);
    await setActor(db, OWNER);
    const value = await scalar(db, updateSql(ids, validReview(), {
      key: `transition-${state.replaceAll('_', '-')}-0001`,
    }));
    assert.equal(value.candidateState, 'ready');
    assert.equal(value.candidateVersion, 2);
    assert.equal(value.review.value.originalTitle, 'Reviewed Book');
    assert.equal(value.review.reviewVersion, 1);
    assert.equal(value.readiness.reviewReady, true);
    await resetActor(db);
    assert.deepEqual(await scalar(db, `SELECT owner_review_snapshot->'value'
      FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`),
    JSON.parse(escape(validReview()).replaceAll("''", "'")));
    await db.exec(`DELETE FROM public.image_extraction_candidates;
      DELETE FROM public.image_extraction_sessions`);
  }
});

test('U6C01 atomically replaces the strict snapshot and increments versions', async () => {
  const ids = await fixture('ready');
  await setActor(db, OWNER);
  const first = await scalar(db, updateSql(ids, validReview()));
  const secondReview = validReview({ originalTitle: 'Second Title' });
  const second = await scalar(db, updateSql(ids, secondReview, {
    candidateVersion: 2, key: 'mutation-review-002', command: COMMAND_B,
  }));
  assert.equal(first.candidateVersion, 2);
  assert.equal(second.candidateVersion, 3);
  assert.equal(second.review.reviewVersion, 2);
  assert.equal(second.review.value.originalTitle, 'Second Title');
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT owner_review_snapshot->'value'->>'originalTitle'
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`), 'Second Title');
});

test('direct RPC rejects every representative strict blocker without partial write', async () => {
  const invalid = [
    validReview({ extension: true }),
    validReview({ quantity: 0 }),
    validReview({ priceMinor: 0, publicationIntent: 'publish' }),
    validReview({ baseCondition: 'fair' }),
    validReview({ originalLanguage: 'english' }),
    validReview({ script: 'latin' }),
    validReview({ originalTitle: 'A中文书', script: 'Latn' }),
    validReview({ originalFieldConfirmation: { title: false, authors: [true] } }),
    validReview({ damageDisclosure: {
      hasDamage: true, damageTypes: [], damageNote: null,
      isSellable: true, completeReadableSafe: false,
    } }),
    validReview({ duplicateIntent: {
      action: 'increment_quantity', targetInventoryId: null, adviceVersion: 1,
    } }),
    validReview({ originalTitle: 'DROP TABLE public.books' }),
    validReview({ originalTitle: '<iframe>unsafe</iframe>' }),
    validReview({ originalTitle: '<script/x>unsafe</script>' }),
    validReview({ authors: ['<object>unsafe</object>'] }),
    validReview({ authors: [42] }),
    validReview({ shelfLocation: '  A1' }),
    validReview({ shelfLocation: '<style>unsafe</style>' }),
    validReview({ damageDisclosure: {
      hasDamage: true, damageTypes: ['cover'],
      damageNote: '<embed>unsafe</embed>',
      isSellable: true, completeReadableSafe: true,
    } }),
    validReview({ damageDisclosure: {
      hasDamage: true, damageTypes: ['cover'], damageNote: 'x'.repeat(1001),
      isSellable: true, completeReadableSafe: true,
    } }),
    validReview({ notes: {
      publicNote: '<script>alert(1)</script>', internalNote: null,
    } }),
    validReview({ notes: { publicNote: '', internalNote: null } }),
    validReview({ notes: { publicNote: null, internalNote: 42 } }),
    validReview({ originalFieldConfirmation: { title: 'true', authors: [true] } }),
  ];
  for (let index = 0; index < invalid.length; index += 1) {
    const ids = await fixture();
    await setActor(db, OWNER);
    await assert.rejects(db.query(updateSql(ids, invalid[index], {
      key: `invalid-review-${String(index).padStart(4, '0')}`,
    })), /P9_REQUEST_INVALID|P9_STATE_CONFLICT/);
    await resetActor(db);
    assert.equal(await scalar(db, `SELECT owner_review_snapshot IS NULL
      AND version=1 AND review_disposition IS NULL
      FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`), true);
    await db.exec(`DELETE FROM public.image_extraction_candidates;
      DELETE FROM public.image_extraction_sessions`);
  }
});

test('strict DB validation preserves canonical plain text', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  const value = await scalar(db, updateSql(ids,
    validReview({ originalTitle: 'A Safe Database Handbook' }),
    { key: 'safe-sql-title-0001' }));
  assert.equal(value.review.value.originalTitle, 'A Safe Database Handbook');
});

test('selected metadata, duplicate advice and unresolved blockers are independently fenced', async () => {
  const ids = await fixture('possible_duplicate');
  await resetActor(db);
  const target = await scalar(db, `INSERT INTO public.store_inventory(
    id,store_id,title,condition,selling_price_minor,quantity_total,quantity_available)
    VALUES(gen_random_uuid(),'${STORE}','Existing','good',100,1,1) RETURNING id::text`);
  await db.exec(`UPDATE public.image_extraction_candidates SET
    duplicate_advice=jsonb_build_object(
      'state','possible_match','targetInventoryId','${target}',
      'matchReason','fuzzy_possible_match',
      'compatibility',jsonb_build_object(
        'sameLanguage',true,'sameFormat',true,'sameCondition',true,
        'samePrice',true,'noCopySpecificDamageOrNote',true),
      'display',jsonb_build_object(
        'title','Existing','authors',jsonb_build_array(),'isbn10',NULL,
        'isbn13',NULL,'language','en','format',NULL,'condition','good',
        'priceMinor',100,'availableQuantity',1,'hasDamage',false,
        'hasApprovedPublicCopyPhoto',false,'hasCopySpecificNote',false,
        'location','A1'),
      'allowedIntents',jsonb_build_array('increment_quantity','create_separate',
        'manual_match')),
    duplicate_advice_version=1 WHERE id='${ids.candidateId}'`);
  await setActor(db, OWNER);
  await assert.rejects(db.query(updateSql(ids, validReview(), { candidateVersion: 2 })),
    /P9_STATE_CONFLICT|P9_REQUEST_INVALID/);
  const withChoice = validReview({ duplicateIntent: {
    action: 'increment_quantity', targetInventoryId: target, adviceVersion: 1,
  } });
  await assert.rejects(db.query(updateSql(ids, {
    ...withChoice, metadataChoice: { mode: 'selected', selectionId: null },
  }, { candidateVersion: 2, key: 'selected-invalid-001' })),
  /P9_REQUEST_INVALID|P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET duplicate_advice=jsonb_set(
      duplicate_advice,'{allowedIntents}',jsonb_build_array('create_separate'))
    WHERE id='${ids.candidateId}'`);
  const disallowedVersion = await scalar(db, `SELECT version
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`);
  await setActor(db, OWNER);
  await assert.rejects(db.query(updateSql(ids, withChoice, {
    candidateVersion: disallowedVersion, key: 'duplicate-disallowed-01',
  })), /P9_VERSION_CONFLICT/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET duplicate_advice=jsonb_set(duplicate_advice,'{allowedIntents}',
      jsonb_build_array('increment_quantity','create_separate','manual_match'))
    WHERE id='${ids.candidateId}'`);
  const allowedVersion = await scalar(db, `SELECT version
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`);
  await setActor(db, OWNER);
  const success = await scalar(db, updateSql(ids, withChoice, {
    candidateVersion: allowedVersion, key: 'duplicate-choice-001',
  }));
  assert.equal(success.readiness.reviewReady, true);
  assert.equal(success.duplicateAdvice.state, 'possible_match');
  assert.equal(success.duplicateAdvice.version, 1);
  assert.equal(success.duplicateAdvice.targetInventoryId, target);
  assert.deepEqual(success.duplicateAdvice.allowedIntents,
    ['increment_quantity','create_separate','manual_match']);
  assert.equal(success.duplicateAdvice.compatibility.sameLanguage, true);
  assert.equal(success.duplicateAdvice.display.title, 'Existing');
});

test('U6C01 records selected/manual choices without writing metadata linkage or revision', async () => {
  const ids = await fixture();
  await resetActor(db);
  const job = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,dedupe_key)
    VALUES('${STORE}','candidate','${ids.candidateId}','metadata_enrich',
      'mutation-metadata-job-${fixtureSequence}') RETURNING id::text`);
  const lookup = await scalar(db, `INSERT INTO public.phase9_metadata_lookups(
    candidate_id,store_id,job_id,query_identity,execution_mode,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
    privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash,normalized_outcome)
    VALUES('${ids.candidateId}','${STORE}','${job}','selection','local','v1',
      'bibliographic','v1','v1','v1','public_bibliographic',1,
      'mutation-worker-0001','${'a'.repeat(64)}','local_canonical_match')
    RETURNING id::text`);
  const edition = await scalar(db, `INSERT INTO public.canonical_editions(
    id,title,authors,language,categories) VALUES(gen_random_uuid(),'Unit 6A Selected',
      ARRAY['Author'],'en',ARRAY[]::text[]) RETURNING id::text`);
  const selection = await scalar(db, `INSERT INTO public.phase9_selected_metadata_snapshots(
    candidate_id,store_id,lookup_id,canonical_edition_id,snapshot_version,
    selection_policy_version,match_evidence,manual_outcome)
    VALUES('${ids.candidateId}','${STORE}','${lookup}','${edition}','v1','v1',
      '[]','local_canonical_match') RETURNING id::text`);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET selected_metadata_snapshot_id='${selection}' WHERE id='${ids.candidateId}'`);
  const metadataRevision = await scalar(db, `SELECT metadata_revision
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`);
  await setActor(db, OWNER);
  const selected = await scalar(db, updateSql(ids, validReview({
    metadataChoice: { mode: 'selected', selectionId: selection },
  }), { metadataRevision, key: 'metadata-selected-001' }));
  assert.equal(selected.metadata.state, 'selected');
  assert.equal(selected.metadata.selectionId, selection);
  assert.equal(selected.metadata.revision, metadataRevision);
  const manual = await scalar(db, updateSql(ids, validReview(), {
    candidateVersion: selected.candidateVersion,
    metadataRevision: selected.metadata.revision,
    key: 'metadata-manual-0001', command: COMMAND_B,
  }));
  assert.equal(manual.metadata.state, 'manual');
  assert.equal(manual.metadata.selectionId, null);
  assert.equal(manual.metadata.revision, metadataRevision);
  const reselected = await scalar(db, updateSql(ids, validReview({
    metadataChoice: { mode: 'selected', selectionId: selection },
  }), {
    candidateVersion: manual.candidateVersion,
    metadataRevision: manual.metadata.revision,
    key: 'metadata-reselect-01',
  }));
  assert.equal(reselected.metadata.state, 'selected');
  assert.equal(reselected.metadata.revision, metadataRevision);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT selected_metadata_snapshot_id='${selection}'
    AND metadata_revision=${metadataRevision}
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`), true);
});

test('candidate and metadata races return distinct fences and leave the winner canonical', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  const winner = await scalar(db, updateSql(ids, validReview(), {
    key: 'race-winner-0001',
  }));
  await assert.rejects(db.query(updateSql(ids, validReview({ originalTitle: 'Loser' }), {
    candidateVersion: 1, metadataRevision: 1, key: 'race-loser-00001',
    command: COMMAND_B,
  })), /P9_CANDIDATE_VERSION_CONFLICT/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates
    SET metadata_revision=metadata_revision+1 WHERE id='${ids.candidateId}'`);
  await setActor(db, OWNER);
  await assert.rejects(db.query(updateSql(ids, validReview({ originalTitle: 'Stale metadata' }), {
    candidateVersion: winner.candidateVersion, metadataRevision: 1,
    key: 'metadata-race-0001', command: COMMAND_B,
  })), /P9_VERSION_CONFLICT/);
  const current = await scalar(db,
    `SELECT public.phase9_owner_candidate_detail_v2('${ids.sessionId}','${ids.candidateId}')`);
  assert.equal(current.review.value.originalTitle, 'Reviewed Book');
});

test('metadata and duplicate evidence revisions invalidate a saved review atomically', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  const saved = await scalar(db, updateSql(ids, validReview(), {
    key: 'invalidation-review-0001',
  }));
  assert.equal(saved.readiness.reviewReady, true);
  await resetActor(db);
  const job = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,dedupe_key)
    VALUES('${STORE}','candidate','${ids.candidateId}','metadata_enrich',
      'invalidation-job-${fixtureSequence}') RETURNING id::text`);
  await db.exec(`INSERT INTO public.phase9_metadata_lookups(
    candidate_id,store_id,job_id,query_identity,execution_mode,schema_version,
    lookup_strategy,lookup_contract_version,normalizer_version,routing_policy_version,
    privacy_scope,claim_attempt_number,claim_worker,claim_lease_token_hash,normalized_outcome)
    VALUES('${ids.candidateId}','${STORE}','${job}','changed','local','v1',
      'bibliographic','v1','v1','v1','public_bibliographic',1,
      'invalidation-worker','${'b'.repeat(64)}','no_match')`);
  assert.equal(await scalar(db, `SELECT metadata_revision=2 AND review_ready=false
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`), true);
  await setActor(db, OWNER);
  await assert.rejects(db.query(updateSql(ids, validReview(), {
    candidateVersion: saved.candidateVersion, metadataRevision: 1,
    key: 'invalidation-stale-001',
  })), /P9_VERSION_CONFLICT/);
  await resetActor(db);
  const versionBeforeDuplicate = await scalar(db, `SELECT version
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`);
  await db.exec(`UPDATE public.image_extraction_candidates SET
    duplicate_advice=jsonb_build_object(
      'state','changed','targetInventoryId',NULL,'matchReason',NULL,
      'compatibility',NULL,'display',NULL,
      'allowedIntents',jsonb_build_array('create_separate')),
    duplicate_advice_version=1,review_ready=true
    WHERE id='${ids.candidateId}'`);
  assert.equal(await scalar(db, `SELECT version>${versionBeforeDuplicate}
      AND review_ready=false AND duplicate_advice_version=1
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`), true);
});

test('exact replay includes commandId and changed request/key combinations mismatch', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  const sql = updateSql(ids, validReview());
  const first = await scalar(db, sql);
  assert.deepEqual(await scalar(db, sql), first);
  await assert.rejects(db.query(updateSql(ids, validReview(), {
    command: COMMAND_B,
  })), /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(db.query(updateSql(ids, validReview({ originalTitle: 'Changed' }))),
    /P9_IDEMPOTENCY_MISMATCH/);
});

test('U6C02 rejects each nonterminal input and accepts ready, failed and skipped', async () => {
  for (const state of ['uploaded','validating','queued','processing']) {
    const ids = await fixture();
    await resetActor(db);
    const mediaId = await media(ids.sessionId, `nonterminal-${state}-${fixtureSequence}`);
    await db.exec(`INSERT INTO public.image_extraction_inputs(
      session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
      VALUES('${ids.sessionId}','${STORE}','${mediaId}','camera','${state}',
        'nonterminal-${state}','v1')`);
    await setActor(db, OWNER);
    await assert.rejects(db.query(`SELECT public.phase9_close_session_v2(
      '${ids.sessionId}',1,'close-${state}-00000001','${COMMAND_A}')`),
    /P9_STATE_CONFLICT/);
    await resetActor(db);
    assert.equal(await scalar(db, `SELECT status='active' AND version=1
      FROM public.image_extraction_sessions WHERE id='${ids.sessionId}'`), true);
    await db.exec(`DELETE FROM public.image_extraction_candidates;
      DELETE FROM public.image_extraction_inputs;
      DELETE FROM public.media_assets WHERE session_id='${ids.sessionId}';
      DELETE FROM public.image_extraction_sessions`);
  }
  for (const state of ['ready','failed','skipped']) {
    const ids = await fixture();
    await resetActor(db);
    const mediaId = await media(ids.sessionId, `terminal-${state}-${fixtureSequence}`);
    await db.exec(`INSERT INTO public.image_extraction_inputs(
      session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
      VALUES('${ids.sessionId}','${STORE}','${mediaId}','camera','${state}',
        'terminal-${state}','v1')`);
    await setActor(db, OWNER);
    const value = await scalar(db, `SELECT public.phase9_close_session_v2(
      '${ids.sessionId}',1,'close-${state}-0000000001','${COMMAND_A}')`);
    assert.equal(value.sessionStatus, 'closed');
    await resetActor(db);
    await db.exec(`DELETE FROM public.image_extraction_candidates;
      DELETE FROM public.image_extraction_inputs;
      DELETE FROM public.media_assets WHERE session_id='${ids.sessionId}';
      DELETE FROM public.image_extraction_sessions`);
  }
});

test('Close exact replay, changed command, stale writer and closed new key are distinct', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  const command = `SELECT public.phase9_close_session_v2(
    '${ids.sessionId}',1,'close-replay-00001','${COMMAND_A}')`;
  const first = await scalar(db, command);
  assert.deepEqual(await scalar(db, command), first);
  await assert.rejects(db.query(command.replace(COMMAND_A, COMMAND_B)),
    /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(db.query(command.replace(
    'close-replay-00001', 'close-replay-00002')), /P9_STATE_CONFLICT/);

  const other = await fixture();
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions SET version=2
    WHERE id='${other.sessionId}'`);
  await setActor(db, OWNER);
  await assert.rejects(db.query(`SELECT public.phase9_close_session_v2(
      '${other.sessionId}',1,'close-stale-000001','${COMMAND_B}')`),
  /P9_VERSION_CONFLICT/);
});

test('closed sessions fence subsequent input creation', async () => {
  const ids = await fixture();
  await setActor(db, OWNER);
  await scalar(db, `SELECT public.phase9_close_session_v2(
    '${ids.sessionId}',1,'close-input-fence-0001','${COMMAND_A}')`);
  await resetActor(db);
  const mediaId = await media(ids.sessionId, `after-close-${fixtureSequence}`);
  await assert.rejects(db.query(`INSERT INTO public.image_extraction_inputs(
    session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${ids.sessionId}','${STORE}','${mediaId}','camera','uploaded',
      'after-close-${fixtureSequence}','v1')`), /P9_STATE_CONFLICT/);
  assert.equal(await scalar(db, `SELECT count(*)::integer
    FROM public.image_extraction_inputs WHERE session_id='${ids.sessionId}'`), 0);
});

test('review and Close preserve every forbidden Unit 7/public/variant relation byte-for-byte', async () => {
  const ids = await fixture();
  await resetActor(db);
  const inventory = await scalar(db, `INSERT INTO public.store_inventory(
    id,store_id,title,authors,condition,selling_price_minor,quantity_total,
    quantity_available)
    VALUES(gen_random_uuid(),'${STORE}','Sentinel',ARRAY['Sentinel Author'],
      'good',100,1,1) RETURNING id::text`);
  await db.exec(`INSERT INTO public.marketplace_book_listings(
    id,inventory_id,store_id,public_title,public_authors,condition,
    selling_price_minor,availability_status,status,moderation_status,
    listing_quality_status)
    VALUES(gen_random_uuid(),'${inventory}','${STORE}','Sentinel',ARRAY['Sentinel Author'],
      'good',100,'available','active','approved','ready');
    INSERT INTO public.book_search_aliases(
      id,store_id,inventory_id,alias_text,alias_normalized,alias_language,
      alias_script,alias_type,source_type,source_ref,approval_status,
      created_by,approved_by,approved_at)
    VALUES(gen_random_uuid(),'${STORE}','${inventory}','Sentinel alias','sentinel alias','en',
      'Latn','recognized_title','owner_verified','unit6a-sentinel','approved',
      '${OWNER}','${OWNER}',transaction_timestamp())`);
  const sentinelMedia = await media(ids.sessionId, `sentinel-${fixtureSequence}`);
  const sentinelInput = await scalar(db, `INSERT INTO public.image_extraction_inputs(
    session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${ids.sessionId}','${STORE}','${sentinelMedia}','camera','ready',
      'sentinel-input-${fixtureSequence}','v1') RETURNING id::text`);
  const visionJob = await scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,status,dedupe_key)
    VALUES('${STORE}','input','${sentinelInput}','vision_extract','resolved',
      'sentinel-vision-${fixtureSequence}') RETURNING id::text`);
  const analysis = await scalar(db, `INSERT INTO public.image_analysis_results(
    store_id,session_id,input_id,vision_job_id,contract_version,
    analysis_schema_version,pipeline_version,prompt_version,adapter_key,
    adapter_version,provider_key,model_key,model_version,image_outcome,
    authoritative_outcome,detected_visible_book_count,accepted_candidate_count,
    canonical_result_snapshot,canonical_result_sha256,completing_attempt,
    completing_worker,completing_lease_token_hash,completion_summary,received_at)
    VALUES('${STORE}','${ids.sessionId}','${sentinelInput}','${visionJob}',
      'p9-contract-v1','p9-vision-v2','v1','v1','fixture','v1','fixture',
      'fixture','v1','analyzed','accepted',1,1,'{}','${'b'.repeat(64)}',1,
      'sentinel-worker-001','${'c'.repeat(64)}','{}',transaction_timestamp())
    RETURNING id::text`);
  const observation = await scalar(db, `INSERT INTO public.image_analysis_observations(
    analysis_result_id,store_id,input_id,observation_ordinal,disposition,
    observed_title,observed_authors,observed_language,confidence,observation_snapshot)
    VALUES('${analysis}','${STORE}','${sentinelInput}',1,'candidate','Observed',
      ARRAY['Author'],'en',1,'{}') RETURNING id::text`);
  await db.exec(`INSERT INTO public.phase9_search_variant_proposals(
    proposal_identity,store_id,analysis_result_id,vision_job_id,candidate_id,
    observation_id,source_field,target_type,author_index,source_text,
    source_language,source_script,source_normalized,variant_text,variant_normalized,
    variant_language,variant_script,variant_type,proposal_schema_version,
    contract_version,generation_source,provider_key,model_key,model_version,
    prompt_version,status,search_eligible)
    VALUES('${'d'.repeat(64)}','${STORE}','${analysis}','${visionJob}',
      '${ids.candidateId}','${observation}','observation:1:title','title',NULL,
      'Observed','en','Latn','observed','Observid','observid','en','Latn',
      'roman_alternative','search_variant_proposals_v1','p9-contract-v1',
      'recorded_fixture','fixture','fixture','v1','v1','proposed',false)`);
  await setActor(db, OWNER);
  const variantDetail = await scalar(db,
    `SELECT public.phase9_owner_candidate_detail_v2(
      '${ids.sessionId}','${ids.candidateId}')`);
  assert.equal(variantDetail.variantSummary.unresolvedCount, 1);
  assert.deepEqual(variantDetail.variantSummary.proposalVersions[0].allowedActions,
    ['approve','reject','replace']);
  assert.ok(variantDetail.allowedActions.includes('open_variant_review'));
  await resetActor(db);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
    SET status='stale',lifecycle_reason='source_changed',
      stale_at=transaction_timestamp()
    WHERE candidate_id='${ids.candidateId}'`);
  const staleVersion = await scalar(db, `SELECT version
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`);
  await setActor(db, OWNER);
  await assert.rejects(db.query(updateSql(ids, validReview(), {
    candidateVersion: staleVersion, key: 'stale-variant-review-0001',
  })), /P9_STATE_CONFLICT/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT owner_review_snapshot IS NULL
    AND review_ready=false AND version=${staleVersion}
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`), true);
  await db.exec(`UPDATE public.phase9_search_variant_proposals
    SET status='proposed',lifecycle_reason=NULL,stale_at=NULL
    WHERE candidate_id='${ids.candidateId}'`);
  const currentVersion = await scalar(db, `SELECT version
    FROM public.image_extraction_candidates WHERE id='${ids.candidateId}'`);
  const before = await scalar(db, `SELECT jsonb_build_object(
    'inventory',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
      FROM public.store_inventory i),'[]'::jsonb),
    'listings',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
      FROM public.marketplace_book_listings l),'[]'::jsonb),
    'aliases',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
      FROM public.book_search_aliases a),'[]'::jsonb),
    'variants',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
      FROM public.phase9_search_variant_proposals v),'[]'::jsonb),
    'public_projection',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)
      FROM public.phase9_public_listing_projection p),'[]'::jsonb))`);
  assert.ok(before.inventory.length > 0);
  assert.ok(before.listings.length > 0);
  assert.ok(before.aliases.length > 0);
  assert.ok(before.variants.length > 0);
  assert.ok(before.public_projection.length > 0);
  await setActor(db, OWNER);
  await scalar(db, updateSql(ids, validReview(), { candidateVersion: currentVersion }));
  await scalar(db, `SELECT public.phase9_close_session_v2(
    '${ids.sessionId}',1,'noninterference-001','${COMMAND_B}')`);
  await resetActor(db);
  const after = await scalar(db, `SELECT jsonb_build_object(
    'inventory',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id)
      FROM public.store_inventory i),'[]'::jsonb),
    'listings',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)
      FROM public.marketplace_book_listings l),'[]'::jsonb),
    'aliases',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
      FROM public.book_search_aliases a),'[]'::jsonb),
    'variants',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
      FROM public.phase9_search_variant_proposals v),'[]'::jsonb),
    'public_projection',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)
      FROM public.phase9_public_listing_projection p),'[]'::jsonb))`);
  assert.deepEqual(after, before);
});
