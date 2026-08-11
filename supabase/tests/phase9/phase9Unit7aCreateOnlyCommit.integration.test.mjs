import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { resetActor, scalar, setActor } from './databaseHarness.mjs';
import {
  commitSql, createUnit7aDatabase, reviewedValue, seedReviewedCandidate,
} from './unit7aFixture.mjs';

let db;
before(async () => { db = await createUnit7aDatabase(); });
after(async () => db?.close());

test('U7A-01 saved review and current metadata are the sole materialization authority', async () => {
  const fixture = await seedReviewedCandidate(db, { selectedMetadata: true });
  await resetActor(db);
  const canonicalBefore = await scalar(db, `SELECT row_to_json(e)::jsonb
    FROM public.canonical_editions e WHERE id='${fixture.canonicalEditionId}'`);
  await setActor(db, fixture.ownerId);
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  const inventory = (await db.query(`SELECT * FROM public.store_inventory
    WHERE id='${result.inventoryId}'`)).rows[0];
  assert.equal(inventory.title, fixture.review.originalTitle);
  assert.deepEqual(inventory.authors, fixture.review.authors);
  assert.equal(inventory.title === 'Observed title', false);
  assert.equal(inventory.selling_price_minor, fixture.review.priceMinor);
  assert.equal(inventory.condition, fixture.review.baseCondition);
  assert.equal(inventory.shelf_location, fixture.review.shelfLocation);
  assert.equal(inventory.canonical_edition_id, fixture.canonicalEditionId);
  assert.equal(inventory.isbn_13, fixture.isbn13);
  assert.equal(inventory.description, fixture.canonicalDescription);
  assert.equal(inventory.edition_statement, fixture.canonicalEditionStatement);
  assert.equal(inventory.volume, fixture.canonicalVolume);
  assert.equal(inventory.format, fixture.canonicalFormat);
  assert.deepEqual(await scalar(db, `SELECT row_to_json(e)::jsonb
    FROM public.canonical_editions e WHERE id='${fixture.canonicalEditionId}'`), canonicalBefore);
  assert.deepEqual(await scalar(db, `SELECT proargnames FROM pg_proc
    WHERE oid='public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)'::regprocedure`), [
    'p_session_id', 'p_candidate_id', 'p_expected_candidate_version',
    'p_expected_review_version', 'p_expected_metadata_revision',
    'p_idempotency_key', 'p_command_id',
  ]);
  assert.equal(await scalar(db, `SELECT has_function_privilege('authenticated',
    'public.phase9_commit_candidate(uuid,integer,text,uuid,integer,integer,text,boolean,text[],text,boolean,text,uuid)',
    'EXECUTE')`), false);
  const security = (await db.query(`SELECT p.prosecdef,p.proconfig,
      has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') service_execute
    FROM pg_proc p
    WHERE p.oid='public.phase9_add_candidate_to_inventory_v1(uuid,uuid,integer,integer,integer,text,uuid)'::regprocedure`)).rows[0];
  assert.equal(security.prosecdef, true);
  assert.equal(security.proconfig.some((setting) => setting.startsWith('search_path=')), true);
  assert.equal(security.authenticated_execute, true);
  assert.equal(security.anon_execute, false);
  assert.equal(security.service_execute, false);
});

test('U7A-02 reviewed quantity initializes exact balanced buckets', async () => {
  const fixture = await seedReviewedCandidate(db, { review: { quantity: 7 } });
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  assert.deepEqual((await db.query(`SELECT quantity_total,quantity_available,
    quantity_reserved,quantity_sold,quantity_removed FROM public.store_inventory
    WHERE id='${result.inventoryId}'`)).rows[0], {
    quantity_total: 7, quantity_available: 7, quantity_reserved: 0,
    quantity_sold: 0, quantity_removed: 0,
  });
});

test('U7A-03 unauthorized and mismatched requests leave no durable business or replay effect', async () => {
  const fixture = await seedReviewedCandidate(db);
  const foreign = await seedReviewedCandidate(db);
  const crossKey = `unit7a-cross-store-${foreign.candidateId}`;
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(commitSql(foreign, {
    idempotencyKey: crossKey, commandId: randomUUID(),
  })), /P9_OWNER_NOT_AUTHORIZED/);
  await assert.rejects(db.query(commitSql(foreign, {
    sessionId: randomUUID(), idempotencyKey: 'unit7a-unknown-session',
    commandId: randomUUID(),
  })), /P9_OWNER_NOT_AUTHORIZED/);
  await resetActor(db);
  assert.deepEqual((await db.query(`SELECT state,version,committed_inventory_id
    FROM public.image_extraction_candidates WHERE id='${foreign.candidateId}'`)).rows[0], {
    state: 'ready', version: foreign.candidateVersion, committed_inventory_id: null,
  });
  assert.equal(await scalar(db, `SELECT committed_count FROM public.image_extraction_sessions
    WHERE id='${foreign.sessionId}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${foreign.candidateId}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE details->>'candidateId'='${foreign.candidateId}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE payload->>'candidateId'='${foreign.candidateId}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_idempotency_keys
    WHERE idempotency_key='${crossKey}'`), 0);
  await resetActor(db);
  const before = await scalar(db, 'SELECT count(*)::int FROM public.phase9_idempotency_keys');
  await assert.rejects(db.query(commitSql(fixture, { idempotencyKey: 'unit7a-unauthenticated' })), /P9_AUTH_REQUIRED/);
  await setActor(db, randomUUID());
  await assert.rejects(db.query(commitSql(fixture, { idempotencyKey: 'unit7a-inaccessible-owner' })), /P9_OWNER_NOT_AUTHORIZED/);
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(commitSql(fixture, {
    sessionId: randomUUID(), idempotencyKey: 'unit7a-mismatched-session',
  })), /P9_(?:OWNER_NOT_AUTHORIZED|NOT_FOUND)/);
  await resetActor(db);
  await db.exec(`UPDATE public.store_administrators SET status='inactive'
    WHERE store_id='${fixture.storeId}' AND user_id='${fixture.ownerId}'`);
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(commitSql(fixture, { idempotencyKey: 'unit7a-inactive-owner' })), /P9_OWNER_NOT_AUTHORIZED/);
  await resetActor(db);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM public.phase9_idempotency_keys'), before);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 0);
});

test('U7A-04 candidate, review and metadata versions independently fence commit', async () => {
  for (const [field, value, code] of [
    ['candidateVersion', 99, /P9_CANDIDATE_VERSION_CONFLICT/],
    ['reviewVersion', 99, /P9_VERSION_CONFLICT/],
    ['metadataRevision', 99, /P9_VERSION_CONFLICT/],
  ]) {
    const fixture = await seedReviewedCandidate(db);
    await assert.rejects(db.query(commitSql(fixture, {
      [field]: value, idempotencyKey: `unit7a-stale-${field}`,
    })), code);
    await resetActor(db);
    assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
      WHERE created_from_candidate_id='${fixture.candidateId}'`), 0);
  }
});

test('U7A-05 one candidate creates one new private row without updating existing inventory', async () => {
  const fixture = await seedReviewedCandidate(db);
  await resetActor(db);
  const existingId = await scalar(db, `INSERT INTO public.store_inventory(
    id,store_id,title,condition,selling_price_minor,quantity_total,quantity_available)
    VALUES(gen_random_uuid(),'${fixture.storeId}','Owner reviewed title','very_good',725,11,11)
    RETURNING id::text`);
  const existingBefore = await scalar(db, `SELECT row_to_json(i)::jsonb FROM public.store_inventory i
    WHERE id='${existingId}'`);
  await setActor(db, fixture.ownerId);
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 1);
  assert.notEqual(result.inventoryId, existingId);
  assert.deepEqual(await scalar(db, `SELECT row_to_json(i)::jsonb FROM public.store_inventory i
    WHERE id='${existingId}'`), existingBefore);
});

test('U7A-06 exact replay after response loss returns one canonical effect', async () => {
  const fixture = await seedReviewedCandidate(db);
  const commandId = randomUUID();
  const key = `unit7a-replay-${fixture.candidateId}`;
  const first = await scalar(db, commitSql(fixture, { commandId, idempotencyKey: key }));
  const replay = await scalar(db, commitSql(fixture, { commandId, idempotencyKey: key }));
  assert.deepEqual(replay, first);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 1);
  assert.equal(await scalar(db, `SELECT committed_count FROM public.image_extraction_sessions
    WHERE id='${fixture.sessionId}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE action='phase9.candidate_commit' AND entity_id='${first.inventoryId}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE event_type='inventory.created_from_candidate' AND entity_id='${first.inventoryId}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_idempotency_keys
    WHERE operation='U7AC01' AND idempotency_key='${key}' AND status='completed'`), 1);
});

test('U7A-07 changed replay is rejected without a second business effect', async () => {
  const fixture = await seedReviewedCandidate(db);
  const key = `unit7a-changed-${fixture.candidateId}`;
  await db.query(commitSql(fixture, { idempotencyKey: key, commandId: randomUUID() }));
  await assert.rejects(db.query(commitSql(fixture, {
    idempotencyKey: key, commandId: randomUUID(),
  })), /P9_IDEMPOTENCY_MISMATCH/);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 1);
});

test('U7A-08 overlapping same-client submissions retain one canonical effect', async () => {
  const fixture = await seedReviewedCandidate(db);
  const key = `unit7a-race-${fixture.candidateId}`;
  const commandId = randomUUID();
  const attempts = await Promise.allSettled([
    db.query(commitSql(fixture, { idempotencyKey: key, commandId })),
    db.query(commitSql(fixture, { idempotencyKey: key, commandId })),
    db.query(commitSql(fixture, {
      idempotencyKey: `unit7a-rival-${fixture.candidateId}`, commandId: randomUUID(),
    })),
  ]);
  const exactWinners = attempts.slice(0, 2)
    .filter(({ status }) => status === 'fulfilled')
    .map(({ value }) => Object.values(value.rows[0])[0]);
  assert.equal(exactWinners.length >= 1, true);
  assert.equal(attempts[2].status, 'rejected');
  const replay = await scalar(db, commitSql(fixture, { idempotencyKey: key, commandId }));
  for (const winner of exactWinners) assert.deepEqual(winner, replay);
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 1);
  assert.equal(await scalar(db, `SELECT committed_count FROM public.image_extraction_sessions
    WHERE id='${fixture.sessionId}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_audit_logs
    WHERE action='phase9.candidate_commit' AND details->>'candidateId'='${fixture.candidateId}'`), 1);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE event_type='inventory.created_from_candidate'
      AND payload->>'candidateId'='${fixture.candidateId}'`), 1);
});

test('U7A-09 downstream audit failure rolls back inventory, provenance, state, count and replay', async () => {
  const fixture = await seedReviewedCandidate(db);
  const key = `unit7a-rollback-${fixture.candidateId}`;
  await resetActor(db);
  await db.exec(`CREATE FUNCTION public.unit7a_force_audit_failure() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'UNIT7A_AUDIT_FAILURE'; END $$;
    CREATE TRIGGER unit7a_force_audit_failure BEFORE INSERT ON public.marketplace_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.unit7a_force_audit_failure();`);
  await setActor(db, fixture.ownerId);
  await assert.rejects(db.query(commitSql(fixture, { idempotencyKey: key })), /UNIT7A_AUDIT_FAILURE/);
  await resetActor(db);
  await db.exec('DROP TRIGGER unit7a_force_audit_failure ON public.marketplace_audit_logs; DROP FUNCTION public.unit7a_force_audit_failure()');
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 0);
  assert.equal(await scalar(db, `SELECT state='ready' AND committed_inventory_id IS NULL
    FROM public.image_extraction_candidates WHERE id='${fixture.candidateId}'`), true);
  assert.equal(await scalar(db, `SELECT committed_count FROM public.image_extraction_sessions
    WHERE id='${fixture.sessionId}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.phase9_idempotency_keys
    WHERE operation='U7AC01' AND idempotency_key='${key}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_events
    WHERE entity_id='${fixture.candidateId}' OR payload->>'candidateId'='${fixture.candidateId}'`), 0);
});

test('U7A-10 manual and selected commits never mutate shared canonical records', async () => {
  const manual = await seedReviewedCandidate(db);
  await db.query(commitSql(manual));
  const selected = await seedReviewedCandidate(db, { selectedMetadata: true });
  await resetActor(db);
  const before = await scalar(db, `SELECT jsonb_build_object(
    'works',(SELECT jsonb_agg(row_to_json(w) ORDER BY id) FROM public.canonical_works w),
    'editions',(SELECT jsonb_agg(row_to_json(e) ORDER BY id) FROM public.canonical_editions e))`);
  await setActor(db, selected.ownerId);
  await db.query(commitSql(selected));
  await resetActor(db);
  const after = await scalar(db, `SELECT jsonb_build_object(
    'works',(SELECT jsonb_agg(row_to_json(w) ORDER BY id) FROM public.canonical_works w),
    'editions',(SELECT jsonb_agg(row_to_json(e) ORDER BY id) FROM public.canonical_editions e))`);
  assert.deepEqual(after, before);
});

test('U7A-11 commit remains private and creates no listing or public/private media link', async () => {
  const fixture = await seedReviewedCandidate(db);
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT visibility_status='draft' AND publication_status='private'
    AND cardinality(photos)=0 FROM public.store_inventory WHERE id='${result.inventoryId}'`), true);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.marketplace_book_listings
    WHERE inventory_id='${result.inventoryId}'`), 0);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.inventory_media_links
    WHERE inventory_id='${result.inventoryId}'`), 0);
});

test('U7A-12 successful readback proves reciprocal durable candidate provenance', async () => {
  const fixture = await seedReviewedCandidate(db);
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  assert.equal(await scalar(db, `SELECT c.state='committed'
    AND c.committed_inventory_id=i.id AND i.created_from_candidate_id=c.id
    FROM public.image_extraction_candidates c JOIN public.store_inventory i
      ON i.id=c.committed_inventory_id WHERE c.id='${fixture.candidateId}'`), true);
  assert.equal(result.candidateId, fixture.candidateId);
  assert.equal(result.inventoryId !== null, true);
});

test('U7A-13 legacy duplicate advice and null intent cannot block or redirect create-only commit', async () => {
  const duplicateAdvice = {
    state: 'compatible_match', targetInventoryId: randomUUID(),
    matchReason: 'exact_validated_edition',
    compatibility: {
      sameLanguage: true, sameFormat: true, sameCondition: true,
      samePrice: true, noCopySpecificDamageOrNote: true,
    },
    display: null,
    allowedIntents: ['increment_quantity', 'create_separate', 'manual_match'],
  };
  const fixture = await seedReviewedCandidate(db, { duplicateAdvice });
  await resetActor(db);
  const blockers = await scalar(db, `SELECT marketplace_sec.phase9_owner_ux_review_blockers(c)
    FROM public.image_extraction_candidates c WHERE id='${fixture.candidateId}'`);
  assert.equal(blockers.some(({ code }) => code === 'duplicate_intent_missing'), false);
  await setActor(db, fixture.ownerId);
  const detail = await scalar(db, `SELECT public.phase9_owner_candidate_detail_v2(
    '${fixture.sessionId}','${fixture.candidateId}')`);
  assert.equal(detail.allowedActions.includes('add_to_inventory'), true);
  await resetActor(db);
  const targetId = await scalar(db, `INSERT INTO public.store_inventory(
    id,store_id,title,condition,selling_price_minor,quantity_total,quantity_available)
    VALUES('${duplicateAdvice.targetInventoryId}','${fixture.storeId}','Target','very_good',725,4,4)
    RETURNING id::text`);
  await setActor(db, fixture.ownerId);
  const result = await scalar(db, commitSql(fixture));
  await resetActor(db);
  assert.notEqual(result.inventoryId, targetId);
  assert.equal(await scalar(db, `SELECT quantity_total=4 AND quantity_available=4
    FROM public.store_inventory WHERE id='${targetId}'`), true);
  assert.equal(await scalar(db, `SELECT count(*)::int FROM public.store_inventory
    WHERE created_from_candidate_id='${fixture.candidateId}'`), 1);
});
