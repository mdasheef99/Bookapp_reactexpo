// Disposable, independent PostgreSQL connections. Master §3 MAS-17; Security §12.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const exec = promisify(execFile);
const [port, database, psql] = process.argv.slice(2);
assert.match(port ?? '', /^\d{4,5}$/);
assert.match(database ?? '', /^bookconnect_u8b_\d+$/);
const worker = 'postgres-media-worker';
const q = value => `'${String(value).replaceAll("'", "''")}'`;
async function sql(statement, role = 'service_role', actor = '', application = 'media-proof') {
  const prefix = `SET application_name=${q(application)}; SET statement_timeout='15s';
    DO $$BEGIN PERFORM set_config('request.jwt.claim.role',${q(role)},false);
      PERFORM set_config('request.jwt.claim.sub',${q(actor)},false); END$$;
    SET ROLE ${role};`;
  const { stdout } = await exec(psql, ['-h', '127.0.0.1', '-p', port, '-U', 'postgres',
    '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', prefix + statement],
  { windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024 });
  return stdout.trim();
}
async function json(statement, role = 'service_role', actor = '') {
  return JSON.parse(await sql(statement, role, actor));
}
async function store() {
  const id = randomUUID();
  await sql(`INSERT INTO public.stores(id,display_name,setup_status,selling_status)
    VALUES(${q(id)},'Disposable media proof','complete','allowed')`, 'postgres');
  return id;
}
async function prepare(storeId, attempt = 1) {
  const owner = randomUUID();
  await sql(`INSERT INTO public.store_administrators(store_id,user_id,role,status)
    VALUES(${q(storeId)},${q(owner)},'owner','active')`, 'postgres');
  const session = await json(`SELECT to_json(public.phase9_start_session(NULL,'en',NULL,'good','A1',1,'private',
    ${q(randomUUID())},${q(randomUUID())}))`, 'authenticated', owner);
  const cap = await json(`SELECT marketplace_sec.phase9_issue_scan_upload(${q(owner)},${q(session)},
    'camera','image/png',68,1,${q(randomUUID())},${q(randomUUID())})`, 'service_role', owner);
  const input = await json(`SELECT marketplace_sec.phase9_register_scan_upload_completion(${q(owner)},
    ${q(cap.capability_id)},'camera',${q(cap.bucket_id)},${q(cap.object_path)},${q('a'.repeat(64))},
    ${q('b'.repeat(64))},'image/png',68,'phase9-v1',${q(randomUUID())},${q(randomUUID())})`);
  if (attempt > 1) await sql(`UPDATE public.image_extraction_jobs SET attempt_count=${attempt - 1}
    WHERE id=${q(input.job_id)}`, 'postgres');
  const claims = await json(`SELECT coalesce(json_agg(c),'[]') FROM public.claim_phase9_media_validation_jobs(10,${q(worker)}) c`);
  const claim = claims.find(row => row.id === input.job_id);
  assert.equal(claim.id, input.job_id);
  const args = [q(claim.id), q(worker), q(claim.lease_token), claim.attempt_count].join(',');
  const context = await json(`SELECT public.phase9_prepare_media_validation_outputs(${args})`);
  await sql(`SELECT public.phase9_bind_media_validation_snapshot(${args},${q(context.snapshot_path)},
    ${q(context.source_sha256)},${context.source_bytes},${q(context.source_mime)})`);
  return { owner, session, storeId, input, claim, args, context };
}
const command = (p, hash = 'c'.repeat(64)) => `SELECT public.phase9_complete_media_validation(${p.args},
  ${q(p.context.source_object_identity)},${q(p.context.source_sha256)},${q(p.context.snapshot_path)},
  ${q(p.context.target_path)},${q(hash)},32,1,1)`;
async function waitFor(predicate) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('concurrency barrier timeout');
}
async function heldTransaction(statement, marker, role = 'service_role') {
  // Marker is acquired after the action but before commit, proving overlap.
  const pending = sql(`BEGIN; ${statement}; SELECT pg_advisory_xact_lock(${marker});
    SELECT pg_sleep(3); COMMIT`, role, '', `holder-${marker}`);
  await waitFor(async () => (await sql(`SELECT EXISTS(SELECT 1 FROM pg_locks
    WHERE locktype='advisory' AND objid=${marker} AND granted)`, 'postgres')) === 't');
  return { pending };
}
const cleanup = () => json(`SELECT coalesce(json_agg(c),'[]') FROM public.claim_phase9_media_output_cleanup_jobs(50,${q(worker)}) c`);
const tally = () => json(`SELECT json_build_object(
  'candidates',(SELECT count(*) FROM public.image_extraction_candidates),
  'inventory',(SELECT count(*) FROM public.store_inventory),
  'events',(SELECT count(*) FROM public.marketplace_events))`, 'postgres');

const storeA = await store();
const first = await prepare(storeA);
const second = await prepare(storeA, 5);
const before = await tally();
const winner = await heldTransaction(command(first), 95701);
const loser = sql(command(second), 'service_role', '', 'duplicate-loser');
await waitFor(async () => (await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
  WHERE application_name='duplicate-loser' AND wait_event_type='Lock')`, 'postgres')) === 't');
const [, loserText] = await Promise.all([winner.pending, loser]);
assert.equal(JSON.parse(loserText).state, 'duplicate_rejected');
const accepted = await json(command(first));
assert.equal(accepted.state, 'queued');
assert.deepEqual(await json(command(first)), accepted);
await assert.rejects(sql(command(first, 'd'.repeat(64))), /P9_IDEMPOTENCY_MISMATCH/);
assert.deepEqual(await tally(), before, 'completion and loser must not invent candidate/inventory/event effects');
assert.equal(await sql(`SELECT count(*) FROM public.image_extraction_inputs WHERE store_id=${q(storeA)}
  AND sha256=${q('c'.repeat(64))}`, 'postgres'), '1');
assert.equal(await sql(`SELECT count(*) FROM public.phase9_usage_reservations WHERE job_id=${q(accepted.vision_job_id)}`, 'postgres'), '1');
assert.equal(await sql(`SELECT status FROM public.image_extraction_jobs WHERE id=${q(second.claim.id)}`, 'postgres'), 'resolved');
assert.equal(await sql(`SELECT session_id FROM public.image_extraction_inputs WHERE id=${q(second.input.input_id)}`, 'postgres'), second.session);
assert.equal(await sql(`SELECT count(*) FROM public.media_assets WHERE object_path=${q(second.context.target_path)}`, 'postgres'), '0');
const cleanupRows = await cleanup();
assert.ok(cleanupRows.some(row => row.object_path === second.context.target_path));
assert.ok(!cleanupRows.some(row => row.object_path === first.context.target_path || row.object_path === first.context.snapshot_path));
console.log('PASS concurrent duplicate: one accepted receipt/reservation, terminal attempt-five rejection, no extra business effects');

const independent = await prepare(await store());
assert.equal((await json(command(independent))).state, 'queued');
const fresh = await prepare(await store());
const historical = await prepare(await store());
await sql(`UPDATE public.image_extraction_jobs SET status='dead_letter',attempt_count=5,lease_owner=NULL,
  lease_token_hash=NULL,lease_expires_at=NULL,dead_lettered_at=transaction_timestamp()
  WHERE id=${q(historical.claim.id)}`, 'postgres');
const deadBefore = await sql(`SELECT row_to_json(j) FROM public.image_extraction_jobs j WHERE id=${q(historical.claim.id)}`, 'postgres');
const completing = await heldTransaction(command(fresh), 95702);
const during = await cleanup();
assert.ok(!during.some(row => row.object_path === fresh.context.target_path));
await completing.pending;
assert.ok(!(await cleanup()).some(row => row.object_path === fresh.context.target_path));
assert.equal(await sql(`SELECT row_to_json(j) FROM public.image_extraction_jobs j WHERE id=${q(historical.claim.id)}`, 'postgres'), deadBefore);
console.log('PASS completion versus cleanup: accepted output protected; historical dead letter unchanged; store hashes independent');

const held = await prepare(await store());
await sql(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 minute'
  WHERE id=${q(held.claim.id)}`, 'postgres');
const assetInsert = `INSERT INTO public.media_assets(store_id,uploaded_by,purpose,privacy_class,bucket_id,
  object_path,sha256,detected_mime,bytes,width,height,retention_class,lifecycle_status,hold_type,hold_started_at)
  VALUES(${q(held.storeId)},${q(held.owner)},'scan_input','private_scan',${q(held.context.target_bucket)},
  ${q(held.context.target_path)},${q('e'.repeat(64))},'image/webp',32,1,1,'phase9-private-scan','held','review',transaction_timestamp())`;
const holding = await heldTransaction(assetInsert, 95703, 'postgres');
assert.ok(!(await cleanup()).some(row => row.object_path === held.context.target_path));
await holding.pending;
assert.ok(!(await cleanup()).some(row => row.object_path === held.context.target_path));
await assert.rejects(sql(command(held)), /P9_STATE_CONFLICT/);
// Reverse ordering: cleanup has reserved deletion before a new held asset insert.
const reserved = await prepare(await store());
await sql(`UPDATE public.image_extraction_jobs SET lease_expires_at=transaction_timestamp()-interval '1 minute'
  WHERE id=${q(reserved.claim.id)}`, 'postgres');
const reserving = await heldTransaction(`SELECT * FROM public.claim_phase9_media_output_cleanup_jobs(50,${q(worker)})`, 95704);
const blockedInsert = sql(assetInsert.replaceAll(held.context.target_path, reserved.context.target_path)
  .replaceAll(held.storeId, reserved.storeId).replaceAll(held.owner, reserved.owner), 'postgres', '', 'hold-loser');
const rejectedInsert = assert.rejects(blockedInsert, /P9_STATE_CONFLICT/);
await waitFor(async () => (await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
  WHERE application_name='hold-loser' AND wait_event_type='Lock')`, 'postgres')) === 't');
await Promise.all([reserving.pending, rejectedInsert]);
console.log('PASS both reference/hold race orders: protected registry wins or permanent deletion fence wins');
console.log('UNIT6G_MEDIA_REAL_POSTGRES_CONCURRENCY_PASS');
