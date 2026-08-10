import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import {
  createPhase9Database, migrationPath, resetActor, scalar, setActor,
} from './databaseHarness.mjs';

const M35 = '20260810000035_marketplace_phase9_single_image_removal.sql';
const M36 = '20260810000036_marketplace_phase9_worker_wake_dispatcher.sql';
const STORE = 'ad000000-0000-0000-0000-000000000001';
const ENTITY = 'ad000000-0000-0000-0000-000000000002';
const WORKER = 'phase9-parity-worker-0001';
const kinds = ['media_validate_sanitize', 'vision_extract', 'metadata_enrich'];
const claimFunctions = {
  media_validate_sanitize: 'public.claim_phase9_media_validation_jobs',
  vision_extract: 'public.claim_phase9_vision_jobs',
  metadata_enrich: 'public.claim_phase9_metadata_jobs',
};
let db;

async function installExternalStubs() {
  await db.exec(`
    CREATE SCHEMA vault;
    CREATE TABLE vault.decrypted_secrets(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE,
      description text, secret text, decrypted_secret text, key_id uuid,
      nonce bytea, created_at timestamptz DEFAULT transaction_timestamp(),
      updated_at timestamptz DEFAULT transaction_timestamp()
    );
    CREATE SCHEMA net;
    CREATE TABLE net.test_requests(
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, url text NOT NULL,
      body jsonb NOT NULL, params jsonb NOT NULL, headers jsonb NOT NULL,
      timeout_milliseconds integer NOT NULL, created_at timestamptz DEFAULT transaction_timestamp()
    );
    CREATE TABLE net._http_response(
      id bigint PRIMARY KEY,status_code integer,content_type text,headers jsonb,
      content text,timed_out boolean,error_msg text,created timestamptz DEFAULT transaction_timestamp()
    );
    CREATE FUNCTION net.http_post(
      url text,body jsonb DEFAULT '{}'::jsonb,params jsonb DEFAULT '{}'::jsonb,
      headers jsonb DEFAULT '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds integer DEFAULT 5000
    ) RETURNS bigint LANGUAGE plpgsql AS $$
    DECLARE v_id bigint;
    BEGIN
      IF url LIKE '%enqueue-failure%' THEN RAISE EXCEPTION 'private network detail'; END IF;
      INSERT INTO net.test_requests(url,body,params,headers,timeout_milliseconds)
      VALUES(url,body,params,headers,timeout_milliseconds) RETURNING id INTO v_id;
      RETURN v_id;
    END$$;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job(
      jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,jobname text UNIQUE,
      schedule text NOT NULL,command text NOT NULL,database text DEFAULT current_database(),
      username text DEFAULT current_user,active boolean DEFAULT true
    );
    CREATE FUNCTION cron.schedule(job_name text,schedule text,command text)
    RETURNS bigint LANGUAGE plpgsql AS $$DECLARE v_id bigint; BEGIN
      INSERT INTO cron.job(jobname,schedule,command) VALUES(job_name,schedule,command)
      RETURNING jobid INTO v_id; RETURN v_id; END$$;
    CREATE FUNCTION cron.unschedule(job_name text) RETURNS boolean LANGUAGE plpgsql AS $$
      DECLARE v_count integer; BEGIN DELETE FROM cron.job WHERE jobname=job_name;
      GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count>0; END$$;
    CREATE FUNCTION cron.alter_job(
      job_id bigint,schedule text DEFAULT NULL,command text DEFAULT NULL,
      database text DEFAULT NULL,username text DEFAULT NULL,active boolean DEFAULT NULL
    ) RETURNS void LANGUAGE sql AS $$UPDATE cron.job SET
      schedule=coalesce(alter_job.schedule,cron.job.schedule),
      command=coalesce(alter_job.command,cron.job.command),
      database=coalesce(alter_job.database,cron.job.database),
      username=coalesce(alter_job.username,cron.job.username),
      active=coalesce(alter_job.active,cron.job.active) WHERE jobid=job_id$$;
  `);
}

async function addJob(kind, state, suffix = `${kind}-${Date.now()}`) {
  const attributes = {
    open_due: ["'open'", '0', '5', "transaction_timestamp()-interval '1 second'", 'NULL'],
    retry_due: ["'retry_scheduled'", '1', '5', "transaction_timestamp()-interval '1 second'", 'NULL'],
    future_retry: ["'retry_scheduled'", '1', '5', "transaction_timestamp()+interval '1 hour'", 'NULL'],
    active_lease: ["'in_progress'", '1', '5', "transaction_timestamp()-interval '1 second'", "transaction_timestamp()+interval '1 hour'"],
    expired_lease: ["'in_progress'", '1', '5', "transaction_timestamp()-interval '1 second'", "transaction_timestamp()-interval '1 second'"],
    max_attempts: ["'open'", '5', '5', "transaction_timestamp()-interval '1 second'", 'NULL'],
  }[state];
  return scalar(db, `INSERT INTO public.image_extraction_jobs(
    store_id,entity_type,entity_id,job_kind,status,attempt_count,max_attempts,
    next_attempt_at,lease_owner,lease_expires_at,dedupe_key,operation_version
  ) VALUES('${STORE}','input','${ENTITY}','${kind}',${attributes[0]},${attributes[1]},
    ${attributes[2]},${attributes[3]},${state.includes('lease') ? `'${WORKER}'` : 'NULL'},
    ${attributes[4]},'wake-${suffix}','phase9-v1') RETURNING id::text`);
}

async function addVault(stage, url = `https://phase9-${stage}.onrender.com`) {
  const prefix = stage === 'media' ? 'media' : stage;
  await db.exec(`INSERT INTO vault.decrypted_secrets(name,decrypted_secret) VALUES
    ('phase9_${prefix}_worker_url','${url}'),
    ('phase9_${prefix}_worker_ingress_token','${prefix}-ingress-token-A7z.49_xYp-001-strong')`);
}

before(async () => {
  db = await createPhase9Database({ throughMigration: M35 });
  await db.exec(`INSERT INTO public.stores(id,display_name) VALUES('${STORE}','Wake Store')`);
  await installExternalStubs();
  await db.exec(fs.readFileSync(migrationPath(M36), 'utf8'));
});

beforeEach(async () => {
  await resetActor(db);
  await db.exec(`DELETE FROM public.image_extraction_jobs WHERE store_id='${STORE}';
    DELETE FROM net.test_requests; DELETE FROM net._http_response;
    DELETE FROM marketplace_sec.phase9_worker_wake_dispatches;
    DELETE FROM vault.decrypted_secrets;`);
});

after(async () => db?.close());

test('M36 creates exactly one inactive 60-second cron job', async () => {
  assert.deepEqual((await db.query(`SELECT jobname,schedule,active FROM cron.job`)).rows,
    [{ jobname: 'phase9-worker-wake-dispatcher', schedule: '* * * * *', active: false }]);
});

for (const kind of kinds) {
  for (const [state, expected] of [
    ['open_due', true], ['retry_due', true], ['future_retry', false],
    ['active_lease', false], ['expired_lease', true], ['max_attempts', false],
  ]) {
    test(`claimability parity: ${kind} ${state}`, async () => {
      const id = await addJob(kind, state, `${kind}-${state}`);
      const beforeRow = await scalar(db, `SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id='${id}'`);
      assert.equal(await scalar(db, `SELECT marketplace_sec.has_claimable_phase9_work('${kind}')`), expected);
      assert.deepEqual(await scalar(db, `SELECT to_jsonb(j) FROM public.image_extraction_jobs j WHERE id='${id}'`), beforeRow);
      await setActor(db, STORE, 'service_role');
      const actual = Number(await scalar(db, `SELECT count(*)::int FROM ${claimFunctions[kind]}(1,'${WORKER}')`));
      assert.equal(actual > 0, expected);
    });
  }
}

for (const [stage, kind] of [
  ['media', 'media_validate_sanitize'],
  ['vision', 'vision_extract'],
  ['metadata', 'metadata_enrich'],
]) {
  test(`due ${stage}-only work dispatches exactly one matching bounded request`, async () => {
    await addVault('media'); await addVault('vision'); await addVault('metadata');
    await addJob(kind, 'open_due', `${stage}-a`);
    await addJob(kind, 'open_due', `${stage}-b`);
    const jobsBefore = await scalar(db, `SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM public.image_extraction_jobs j WHERE store_id='${STORE}'`);
    const result = await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
    assert.equal(result.dispatched, 1);
    const requests = (await db.query(`SELECT url,body,headers,timeout_milliseconds
      FROM net.test_requests`)).rows;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `https://phase9-${stage}.onrender.com/run`);
    assert.deepEqual(requests[0].body, { batchSize: 1, contractVersion: 'phase9-v1' });
    assert.equal(requests[0].timeout_milliseconds, 120000);
    assert.match(requests[0].headers['x-phase9-dispatch-id'],
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.deepEqual(await scalar(db, `SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM public.image_extraction_jobs j WHERE store_id='${STORE}'`), jobsBefore);
  });
}

test('empty and nonclaimable queues dispatch nothing', async () => {
  await addVault('media'); await addVault('vision'); await addVault('metadata');
  await addJob('media_validate_sanitize', 'future_retry', 'media-future');
  await addJob('vision_extract', 'max_attempts', 'vision-exhausted');
  await addJob('metadata_enrich', 'active_lease', 'metadata-leased');
  assert.equal((await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()')).dispatched, 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM net.test_requests'), 0);
  await db.exec(`DELETE FROM public.image_extraction_jobs WHERE store_id='${STORE}'`);
  assert.equal((await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()')).dispatched, 0);
});

test('120-second timeout budget covers measured cold wake and provider ceiling with bounded margin', () => {
  const measuredColdWakeMs = Math.max(23_423, 22_598);
  const configuredProviderCeilingMs = 30_000;
  const claimProcessingAndResponseMarginMs = 45_000;
  const dispatcherTimeoutMs = 120_000;
  assert.ok(dispatcherTimeoutMs
    > measuredColdWakeMs + configuredProviderCeilingMs + claimProcessingAndResponseMarginMs);
  assert.equal(dispatcherTimeoutMs, 2 * 60_000);
});

test('Vault values are absent from dispatcher output and persisted observability', async () => {
  await addVault('vision');
  await addJob('vision_extract', 'expired_lease', 'secret-scan');
  const result = await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  const observation = await scalar(db, 'SELECT to_jsonb(d) FROM marketplace_sec.phase9_worker_wake_dispatches d');
  const serialized = JSON.stringify({ result, observation });
  assert.doesNotMatch(serialized, /onrender|ingress-token|Bearer|A7z|url|secret/iu);
});

test('enqueue failure is bounded and a later tick can dispatch normally', async () => {
  await addVault('metadata', 'https://enqueue-failure.example');
  await addJob('metadata_enrich', 'retry_due', 'network-failure');
  assert.deepEqual(await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()'), {
    configured_missing: 0, dispatched: 0, enqueue_failed: 1, reconciled: 0,
  });
  await db.exec(`UPDATE vault.decrypted_secrets SET decrypted_secret='https://phase9-metadata.onrender.com'
    WHERE name='phase9_metadata_worker_url';
    UPDATE marketplace_sec.phase9_worker_wake_dispatches SET tick_started_at=tick_started_at-interval '1 minute';`);
  assert.equal((await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()')).dispatched, 1);
});

test('HTTP timeout reconciliation plus an active accepted lease suppresses the next wake tick', async () => {
  await addVault('vision');
  const id = await addJob('vision_extract', 'open_due', 'timeout-claim');
  await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  const requestId = await scalar(db, 'SELECT id FROM net.test_requests');
  await setActor(db, STORE, 'service_role');
  assert.equal(Number(await scalar(db, `SELECT count(*)::int FROM public.claim_phase9_vision_jobs(1,'${WORKER}')`)), 1);
  await resetActor(db);
  await db.exec(`INSERT INTO net._http_response(id,timed_out,error_msg) VALUES(${requestId},true,'private timeout detail');
    UPDATE marketplace_sec.phase9_worker_wake_dispatches SET tick_started_at=tick_started_at-interval '1 minute';`);
  const result = await scalar(db, 'SELECT marketplace_sec.dispatch_phase9_worker_wakes()');
  assert.equal(result.reconciled, 1);
  assert.equal(result.dispatched, 0);
  assert.equal(await scalar(db, 'SELECT count(*)::int FROM net.test_requests'), 1);
  assert.equal(await scalar(db, `SELECT attempt_count FROM public.image_extraction_jobs WHERE id='${id}'`), 1);
  assert.equal(await scalar(db, `SELECT response_state FROM marketplace_sec.phase9_worker_wake_dispatches`), 'timed_out');
});

test('private dispatcher and observability deny client and service roles', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await setActor(db, STORE, role);
    await assert.rejects(db.query("SELECT marketplace_sec.has_claimable_phase9_work('vision_extract')"));
    await assert.rejects(db.query('SELECT marketplace_sec.dispatch_phase9_worker_wakes()'));
    await assert.rejects(db.query('SELECT * FROM marketplace_sec.phase9_worker_wake_dispatches'));
  }
});
