import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import {
  createPhase9Database, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const STORE_A = '92000000-0000-0000-0000-000000000001';
const STORE_B = '92000000-0000-0000-0000-000000000002';
const OWNER_A = '91000000-0000-0000-0000-000000000001';
const OWNER_A2 = '91000000-0000-0000-0000-000000000002';
const OWNER_B = '91000000-0000-0000-0000-000000000003';
const MANAGER = '91000000-0000-0000-0000-000000000004';
const STAFF = '91000000-0000-0000-0000-000000000005';
const SUPPORT = '91000000-0000-0000-0000-000000000006';
const REVIEW_COMMAND = '93000000-0000-4000-8000-000000000001';
const CLOSE_COMMAND = '93000000-0000-4000-8000-000000000002';
let db;
let sessionSequence = 0;

const json = (value) => JSON.stringify(value).replaceAll("'", "''");
const review = (title = 'Reviewed Book') => ({
  originalTitle: title,
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
});

before(async () => {
  db = await createPhase9Database({
    throughMigration: '20260730000029_marketplace_phase9_owner_safe_contracts.sql',
  });
  await db.exec(`
    INSERT INTO public.stores(id,display_name) VALUES
      ('${STORE_A}','Store A'),('${STORE_B}','Store B');
    INSERT INTO public.store_administrators(store_id,user_id,role,status) VALUES
      ('${STORE_A}','${OWNER_A}','owner','active'),
      ('${STORE_A}','${OWNER_A2}','owner','active'),
      ('${STORE_B}','${OWNER_B}','owner','active'),
      ('${STORE_A}','${MANAGER}','manager','active'),
      ('${STORE_A}','${STAFF}','staff','active');
    CREATE OR REPLACE FUNCTION marketplace_sec.has_platform_role(roles text[])
    RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT auth.uid()='${SUPPORT}'::uuid AND 'support'=ANY(roles)
    $$;
  `);
});
afterEach(async () => {
  await resetActor(db);
  await db.exec(`
    DELETE FROM public.phase9_idempotency_keys
      WHERE operation IN ('C01','U6C01','U6C02');
    DELETE FROM public.image_extraction_candidates;
    DELETE FROM public.image_extraction_inputs;
    DELETE FROM public.media_assets WHERE bucket_id='fixture';
    DELETE FROM public.image_extraction_sessions;
  `);
});
after(async () => db?.close());

async function session(owner = OWNER_A) {
  await setActor(db, owner);
  sessionSequence += 1;
  return scalar(db, `SELECT public.phase9_start_session(
    NULL,'en',NULL,'good','A1',1,'private',
    'unit6a-start-${String(sessionSequence).padStart(5, '0')}',gen_random_uuid())`);
}

async function candidate(sessionId, state = 'needs_review', title = 'Book') {
  await resetActor(db);
  return scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,selected_snapshot,metadata_revision)
    VALUES('${sessionId}','${STORE_A}',1,'${title}',ARRAY['Author'],'en',
      '${state}','{}',1) RETURNING id::text`);
}

test('all eight RPCs have exact signatures, owner, definer path and grant matrix', async () => {
  const signatures = [
    'phase9_owner_discover_session_v1()',
    'phase9_owner_session_summary_v2(uuid)',
    'phase9_owner_session_inputs_v1(uuid,integer,text)',
    'phase9_owner_candidates_page_v2(text,uuid,text,integer,text)',
    'phase9_owner_candidate_detail_v2(uuid,uuid)',
    'phase9_update_candidate_review_v2(uuid,uuid,integer,integer,jsonb,text,uuid)',
    'phase9_owner_session_readiness_v1(uuid)',
    'phase9_close_session_v2(uuid,integer,text,uuid)',
  ];
  for (const signature of signatures) {
    const name = signature.slice(0, signature.indexOf('('));
    const metadata = await scalar(db, `SELECT jsonb_build_object(
      'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
      'definer',p.prosecdef,'config',p.proconfig)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='${name}'`);
    assert.equal(metadata.signature, signature);
    assert.equal(metadata.owner, 'postgres');
    assert.equal(metadata.definer, true);
    assert.match(String(metadata.config), /search_path=/);
    assert.equal(await scalar(db,
      `SELECT has_function_privilege('authenticated','public.${signature}','EXECUTE')`), true);
    assert.equal(await scalar(db,
      `SELECT has_function_privilege('anon','public.${signature}','EXECUTE')`), false);
  }
  for (const table of ['image_extraction_sessions','image_extraction_inputs',
    'image_extraction_candidates','image_extraction_jobs',
    'phase9_selected_metadata_snapshots','phase9_metadata_lookups',
    'phase9_idempotency_keys','phase9_owner_review_scopes',
    'phase9_owner_ux_cursor_keys']) {
    assert.equal(await scalar(db,
      `SELECT has_table_privilege('authenticated','public.${table}','SELECT')`), false);
    assert.equal(await scalar(db, `SELECT relrowsecurity FROM pg_class
      WHERE oid='public.${table}'::regclass`), true);
  }
  assert.equal(await scalar(db, `SELECT bool_and(
      NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND NOT has_function_privilege('anon',p.oid,'EXECUTE'))
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='marketplace_sec'
      AND (p.proname LIKE 'phase9_owner_ux_%'
        OR p.proname IN ('phase9_replay','phase9_finish_replay'))`), true);
});

test('discovery and queue share initiator-only NeedsReviewMembershipV1', async () => {
  const sessionId = await session();
  await resetActor(db);
  await assert.rejects(db.exec(`INSERT INTO public.image_extraction_sessions(
    store_id,created_by,status,selected_language,default_condition,
    default_location,default_quantity,default_publication)
    VALUES('${STORE_A}','${OWNER_A}','active','en','good','A1',1,'private')`));
  const included = [];
  for (const [state, disposition, ready, expired] of [
    ['needs_review', null, false, false],
    ['possible_duplicate', null, false, false],
    ['failed', null, false, false],
    ['ready', null, false, false],
    ['ready', 'reviewed', false, false],
  ]) {
    await resetActor(db);
    included.push(await scalar(db, `INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,review_disposition,owner_review_snapshot,
      review_ready,metadata_revision,expires_at)
      VALUES('${sessionId}','${STORE_A}',${included.length + 1},'Included',
      ARRAY[]::text[],'en','${state}',${disposition ? `'${disposition}'` : 'NULL'},
      ${ready ? `'{}'::jsonb` : 'NULL'},${ready},1,
      ${expired ? "transaction_timestamp()-interval '1 day'" : "transaction_timestamp()+interval '1 day'"})
      RETURNING id::text`));
  }
  for (const [state, disposition, ready, expired] of [
    ['processing', null, false, false],
    ['commit_in_progress', null, false, false],
    ['committed', 'reviewed', true, false],
    ['ready', 'reviewed', true, false],
    ['needs_review', 'skipped_false_detection', false, false],
    ['needs_review', null, false, true],
  ]) {
    await resetActor(db);
    await db.exec(`INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,review_disposition,review_ready,metadata_revision,expires_at)
      VALUES('${sessionId}','${STORE_A}',${included.length + 1},'Excluded',
      ARRAY[]::text[],'en','${state}',${disposition ? `'${disposition}'` : 'NULL'},
      ${ready},1,${expired ? "transaction_timestamp()-interval '1 day'" : "transaction_timestamp()+interval '1 day'"})`);
  }
  await db.exec(`UPDATE public.image_extraction_sessions
    SET status='closed',closed_at=transaction_timestamp(),
      expires_at=transaction_timestamp()-interval '1 day'
    WHERE id='${sessionId}'`);
  await setActor(db, OWNER_A);
  const discovery = await scalar(db, 'SELECT public.phase9_owner_discover_session_v1()');
  const page = await scalar(db,
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)");
  assert.equal(discovery.needsReviewCount, included.length);
  assert.equal(page.items.length, included.length);
  assert.deepEqual(new Set(page.items.map((item) => item.candidateId)), new Set(included));
  assert.ok(page.items.every((item) => item.sessionStatus === 'closed'));
  assert.equal(page.scopeVersion, discovery.reviewScopeVersion);
});

test('same-store noninitiator, cross-store, role, revoked and unauthenticated actors are denied', async () => {
  const sessionId = await session();
  const candidateId = await candidate(sessionId);
  const targetCalls = [
    `SELECT public.phase9_owner_session_summary_v2('${sessionId}')`,
    `SELECT public.phase9_owner_session_inputs_v1('${sessionId}',20,NULL)`,
    `SELECT public.phase9_owner_candidates_page_v2('session','${sessionId}','all',20,NULL)`,
    `SELECT public.phase9_owner_candidate_detail_v2('${sessionId}','${candidateId}')`,
    `SELECT public.phase9_update_candidate_review_v2('${sessionId}','${candidateId}',
      1,1,'{}'::jsonb,'denied-review-0001',gen_random_uuid())`,
    `SELECT public.phase9_owner_session_readiness_v1('${sessionId}')`,
    `SELECT public.phase9_close_session_v2('${sessionId}',1,
      'denied-close-00001',gen_random_uuid())`,
  ];
  for (const actor of [OWNER_A2, OWNER_B, MANAGER, STAFF, SUPPORT]) {
    await setActor(db, actor);
    for (const sql of targetCalls)
      await assert.rejects(db.query(sql), /P9_OWNER_NOT_AUTHORIZED/);
    if ([MANAGER, STAFF, SUPPORT].includes(actor)) {
      await assert.rejects(db.query('SELECT public.phase9_owner_discover_session_v1()'),
        /P9_OWNER_NOT_AUTHORIZED/);
      await assert.rejects(db.query(
        "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)"),
      /P9_OWNER_NOT_AUTHORIZED/);
    }
  }
  await resetActor(db);
  for (const sql of [
    'SELECT public.phase9_owner_discover_session_v1()',
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)",
    ...targetCalls,
  ]) await assert.rejects(db.query(sql), /P9_AUTH_REQUIRED|P9_OWNER_NOT_AUTHORIZED/);
  await resetActor(db);
  await db.exec(`UPDATE public.store_administrators SET status='revoked'
    WHERE store_id='${STORE_A}' AND user_id='${OWNER_A}'`);
  await setActor(db, OWNER_A);
  for (const sql of [
    'SELECT public.phase9_owner_discover_session_v1()',
    "SELECT public.phase9_owner_candidates_page_v2('needs_review',NULL,'all',20,NULL)",
    ...targetCalls,
  ]) await assert.rejects(db.query(sql), /P9_OWNER_NOT_AUTHORIZED/);
  await resetActor(db);
  await db.exec(`UPDATE public.store_administrators SET status='active'
    WHERE store_id='${STORE_A}' AND user_id='${OWNER_A}'`);
});

test('candidate detail does not enumerate absent, random, foreign or mismatched candidates', async () => {
  const sessionA = await session();
  const candidateA = await candidate(sessionA);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_sessions SET status='closed'
    WHERE id='${sessionA}'`);
  const sessionB = await session();
  const candidateB = await candidate(sessionB, 'needs_review', 'Foreign');
  await resetActor(db);
  const foreignSession = await scalar(db, `INSERT INTO public.image_extraction_sessions(
    store_id,created_by,status,selected_language,default_condition,
    default_location,default_quantity,default_publication)
    VALUES('${STORE_B}','${OWNER_B}','closed','en','good','A1',1,'private')
    RETURNING id::text`);
  const foreignCandidate = await scalar(db, `INSERT INTO public.image_extraction_candidates(
    session_id,store_id,candidate_index,observed_title,observed_authors,
    observed_language,state,metadata_revision)
    VALUES('${foreignSession}','${STORE_B}',1,'Cross Store',ARRAY[]::text[],
      'en','needs_review',1) RETURNING id::text`);
  await setActor(db, OWNER_A);
  const failures = [];
  for (const id of [
    '92000000-0000-4000-8000-999999999999',
    candidateB,
    foreignCandidate,
  ]) {
    try {
      await db.query(`SELECT public.phase9_owner_candidate_detail_v2(
        '${sessionA}','${id}')`);
    } catch (error) {
      failures.push(String(error));
    }
  }
  assert.equal(failures.length, 3);
  assert.ok(failures.every((value) => /P9_NOT_FOUND/.test(value)));
  assert.equal(new Set(failures.map((value) =>
    value.match(/P9_NOT_FOUND/)?.[0])).size, 1);
  assert.equal(await scalar(db, `SELECT (
    public.phase9_owner_candidate_detail_v2('${sessionA}','${candidateA}')
      ->>'candidateId')::uuid='${candidateA}'::uuid`), true);
});

test('input and candidate cursors are deterministic, context-bound and invalidated by membership change', async () => {
  const sessionId = await session();
  await resetActor(db);
  for (let index = 1; index <= 3; index += 1) {
    await db.exec(`INSERT INTO public.image_extraction_candidates(
      session_id,store_id,candidate_index,observed_title,observed_authors,
      observed_language,state,metadata_revision)
      VALUES('${sessionId}','${STORE_A}',${index},'Book ${index}',
      ARRAY[]::text[],'en','needs_review',1)`);
  }
  await setActor(db, OWNER_A);
  const first = await scalar(db,
    `SELECT public.phase9_owner_candidates_page_v2(
      'session','${sessionId}','all',2,NULL)`);
  assert.equal(first.items.length, 2);
  assert.equal(first.pageInfo.hasMore, true);
  const second = await scalar(db,
    `SELECT public.phase9_owner_candidates_page_v2(
      'session','${sessionId}','all',2,'${first.pageInfo.nextCursor}')`);
  assert.equal(second.items.length, 1);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.candidateId)).size, 3);
  await assert.rejects(db.query(
    `SELECT public.phase9_owner_candidates_page_v2(
      'session','${sessionId}','all',3,'${first.pageInfo.nextCursor}')`),
  /P9_CURSOR_INVALID/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_candidates SET state='ready',
    review_disposition='reviewed',review_ready=true
    WHERE id='${first.items[0].candidateId}'`);
  await setActor(db, OWNER_A);
  await assert.rejects(db.query(
    `SELECT public.phase9_owner_candidates_page_v2(
      'session','${sessionId}','all',2,'${first.pageInfo.nextCursor}')`),
  /P9_CURSOR_INVALID/);
});

test('review update fences candidate and metadata revisions, replays exactly and has no Unit 7 effect', async () => {
  const sessionId = await session();
  const candidateId = await candidate(sessionId);
  const before = await scalar(db, `SELECT jsonb_build_object(
    'inventory',(SELECT count(*) FROM public.store_inventory),
    'listings',(SELECT count(*) FROM public.marketplace_book_listings),
    'commits',(SELECT count(*) FROM public.image_extraction_candidates WHERE state='committed'))`);
  await setActor(db, OWNER_A);
  const command = `SELECT public.phase9_update_candidate_review_v2(
    '${sessionId}','${candidateId}',1,1,'${json(review())}'::jsonb,
    'unit6a-review-0001','${REVIEW_COMMAND}')`;
  const first = await scalar(db, command);
  const replay = await scalar(db, command);
  assert.deepEqual(replay, first);
  assert.equal(first.candidateVersion, 2);
  assert.equal(first.metadata.revision, 1);
  assert.equal(first.candidateState, 'ready');
  assert.equal(first.readiness.reviewReady, true);
  await assert.rejects(db.query(command.replace('Reviewed Book', 'Changed Book')),
    /P9_IDEMPOTENCY_MISMATCH/);
  await assert.rejects(db.query(command.replace(',1,1,', ',2,2,')
    .replace('unit6a-review-0001', 'unit6a-review-0002')),
  /P9_VERSION_CONFLICT/);
  await assert.rejects(db.query(command.replace(',1,1,', ',1,1,')
    .replace('unit6a-review-0001', 'unit6a-review-0003')),
  /P9_CANDIDATE_VERSION_CONFLICT/);
  await resetActor(db);
  const after = await scalar(db, `SELECT jsonb_build_object(
    'inventory',(SELECT count(*) FROM public.store_inventory),
    'listings',(SELECT count(*) FROM public.marketplace_book_listings),
    'commits',(SELECT count(*) FROM public.image_extraction_candidates WHERE state='committed'))`);
  assert.deepEqual(after, before);
});

test('Close requires terminal inputs, fences session version, replays exactly and preserves staged candidates', async () => {
  const sessionId = await session();
  const candidateId = await candidate(sessionId);
  await resetActor(db);
  const mediaId = await scalar(db, `INSERT INTO public.media_assets(
    store_id,uploaded_by,purpose,privacy_class,bucket_id,object_path,sha256,
    detected_mime,bytes,width,height,session_id,retention_class,lifecycle_status)
    VALUES('${STORE_A}','${OWNER_A}','scan_input','private_scan','fixture',
      '${sessionId}/close','${'a'.repeat(64)}','image/webp',1,1,1,
      '${sessionId}','phase9_scan_input','approved') RETURNING id::text`);
  await db.exec(`INSERT INTO public.image_extraction_inputs(
    session_id,store_id,media_asset_id,source_kind,state,sha256,orchestration_version)
    VALUES('${sessionId}','${STORE_A}','${mediaId}','camera','processing','hash','v1')`);
  await setActor(db, OWNER_A);
  const command = `SELECT public.phase9_close_session_v2(
    '${sessionId}',1,'unit6a-close-00001','${CLOSE_COMMAND}')`;
  await assert.rejects(db.query(command), /P9_STATE_CONFLICT/);
  await resetActor(db);
  await db.exec(`UPDATE public.image_extraction_inputs SET state='ready'
    WHERE session_id='${sessionId}'`);
  await setActor(db, OWNER_A);
  await assert.rejects(db.query(command.replace(',1,', ',2,')), /P9_VERSION_CONFLICT/);
  const first = await scalar(db, command);
  const replay = await scalar(db, command);
  assert.deepEqual(replay, first);
  assert.equal(first.sessionStatus, 'closed');
  assert.equal(first.sessionVersion, 2);
  assert.equal(first.closeState, 'closed');
  assert.equal(first.closeAllowed, false);
  assert.equal(first.closeSummary.committedInventoryItems, 0);
  assert.equal(first.closeSummary.quantitiesAddedToExisting, 0);
  assert.equal(first.closeSummary.privateItems, 0);
  assert.equal(first.closeSummary.publishedItems, 0);
  await assert.rejects(db.query(command.replace(
    'unit6a-close-00001', 'unit6a-close-00002')), /P9_STATE_CONFLICT/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int
    FROM public.image_extraction_candidates WHERE id='${candidateId}'`), 1);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.store_inventory'), 0);
});
