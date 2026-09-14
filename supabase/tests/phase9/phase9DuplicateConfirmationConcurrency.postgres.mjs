// Disposable real-PostgreSQL proof. Every sql() call uses an independent psql connection.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const exec = promisify(execFile);
const [port, database, psql] = process.argv.slice(2);
assert.match(port ?? '', /^\d{4,5}$/);
assert.match(database ?? '', /^bookconnect_u8b_\d+$/);
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
async function sql(statement, role = 'service_role', actor = '', application = 'u6h-proof') {
  const prefix = `SET application_name=${q(application)}; SET statement_timeout='20s';
    DO $$BEGIN PERFORM set_config('request.jwt.claim.role',${q(role)},false);
      PERFORM set_config('request.jwt.claim.sub',${q(actor)},false); END$$; SET ROLE ${role};`;
  const { stdout } = await exec(psql, ['-h','127.0.0.1','-p',port,'-U','postgres','-d',database,
    '-X','-qAt','-v','ON_ERROR_STOP=1','-c',prefix + statement],
  { windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}
const json = async (statement, role = 'service_role', actor = '') => JSON.parse(await sql(statement, role, actor));
async function waitFor(predicate) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('concurrency barrier timeout');
}
async function held(statement, marker, application) {
  const pending = sql(`BEGIN; ${statement}; SELECT pg_advisory_xact_lock(${marker}); SELECT pg_sleep(2); COMMIT`,
    'service_role', '', application);
  await waitFor(async () => (await sql(`SELECT EXISTS(SELECT 1 FROM pg_locks
    WHERE locktype='advisory' AND objid=${marker} AND granted)`, 'postgres')) === 't');
  return pending;
}

const store = randomUUID();
await sql(`INSERT INTO public.stores(id,display_name,setup_status,selling_status)
 VALUES(${q(store)},'U6H PostgreSQL','complete','allowed')`, 'postgres');
async function prepare() {
  const owner = randomUUID();
  await sql(`INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES(${q(store)},${q(owner)},'owner','active')`, 'postgres');
  const session = await json(`SELECT to_json(public.phase9_start_session(NULL,'en',NULL,'good','A1',1,'private',
    ${q(randomUUID())},${q(randomUUID())}))`, 'authenticated', owner);
  const cap = await json(`SELECT marketplace_sec.phase9_issue_scan_upload(${q(owner)},${q(session)},
    'camera','image/png',68,1,${q(randomUUID())},${q(randomUUID())})`, 'service_role', owner);
  const input = await json(`SELECT marketplace_sec.phase9_register_scan_upload_completion(${q(owner)},
    ${q(cap.capability_id)},'camera',${q(cap.bucket_id)},${q(cap.object_path)},${q('a'.repeat(64))},
    ${q('b'.repeat(64))},'image/png',68,'phase9-v1',${q(randomUUID())},${q(randomUUID())})`);
  const claims = await json(`SELECT coalesce(json_agg(c),'[]') FROM public.claim_phase9_media_validation_jobs(10,'u6h-postgres-worker') c`);
  const claim = claims.find((row) => row.id === input.job_id);
  const args = [q(claim.id),q('u6h-postgres-worker'),q(claim.lease_token),claim.attempt_count].join(',');
  const context = await json(`SELECT public.phase9_prepare_media_validation_outputs(${args})`);
  await sql(`SELECT public.phase9_bind_media_validation_snapshot(${args},${q(context.snapshot_path)},
    ${q(context.source_sha256)},${context.source_bytes},${q(context.source_mime)})`);
  return { owner, session, input, args, context };
}
const complete = (p) => `SELECT public.phase9_complete_media_validation(${p.args},
 ${q(p.context.source_object_identity)},${q(p.context.source_sha256)},${q(p.context.snapshot_path)},
 ${q(p.context.target_path)},${q('d'.repeat(64))},32,1,1)`;
const first = await prepare();
const second = await prepare();
const holder = held(complete(first), 96001, 'u6h-completion-winner');
const loser = sql(complete(second), 'service_role', '', 'u6h-completion-loser');
await waitFor(async () => (await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
 WHERE application_name='u6h-completion-loser' AND wait_event_type='Lock')`, 'postgres')) === 't');
const [winnerText, loserText] = await Promise.all([holder, loser]);
assert.equal(JSON.parse(winnerText).state, 'queued');
assert.equal(JSON.parse(loserText).state, 'confirmation_required');
assert.equal(await sql(`SELECT count(*) FROM public.image_extraction_inputs
 WHERE store_id=${q(store)} AND sha256=${q('d'.repeat(64))} AND duplicate_of_input_id IS NULL`, 'postgres'), '1');
const pending = await json(`SELECT json_build_object('input',i.id,'inputVersion',i.version,'confirmationVersion',c.version,
 'intent',c.sanitized_intent_id) FROM public.image_extraction_inputs i
 JOIN marketplace_sec.phase9_duplicate_input_confirmations c ON c.input_id=i.id WHERE i.id=${q(second.input.input_id)}`, 'postgres');
const key = randomUUID();
const command = randomUUID();
const proceed = `SELECT marketplace_sec.phase9_resolve_duplicate_scan_input(${q(second.owner)},${q(second.session)},
 ${q(pending.input)},'proceed',${pending.inputVersion},${pending.confirmationVersion},${q(key)},${q(command)},
 ${q('c'.repeat(64))},${q('d'.repeat(64))},32,'image/webp')`;
const proceeding = held(proceed, 96002, 'u6h-proceed-holder');
const cleanup = sql(`SELECT coalesce(json_agg(c),'[]') FROM public.claim_phase9_media_output_cleanup_jobs(50,'u6h-cleanup-worker') c`,
  'service_role', '', 'u6h-cleanup-racer');
const replay = sql(proceed, 'service_role', '', 'u6h-proceed-replay');
const [proceedText, cleanupText, replayText] = await Promise.all([proceeding, cleanup, replay]);
assert.deepEqual(JSON.parse(replayText), JSON.parse(proceedText));
assert.equal(JSON.parse(cleanupText).some((row) => row.intent_id === pending.intent), false);
assert.equal(await sql(`SELECT count(*) FROM public.image_extraction_jobs
 WHERE entity_id=${q(pending.input)} AND job_kind='vision_extract'`, 'postgres'), '1');
assert.equal(await sql(`SELECT count(*) FROM public.media_assets m JOIN public.image_extraction_inputs i
 ON i.media_asset_id=m.id WHERE i.id=${q(pending.input)} AND m.session_id=${q(second.session)}`, 'postgres'), '1');
console.log('UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS');
