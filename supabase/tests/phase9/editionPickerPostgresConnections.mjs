// Picker SDD §§7/9-11, EP-AC12/18: independent psql sessions in the existing disposable harness.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const [port, database, psql] = process.argv.slice(2);
assert.match(port ?? '', /^\d{4,5}$/);
assert.match(database ?? '', /^bookconnect_u8b_\d+$/);
assert.ok(psql, 'the existing harness supplies its discovered psql binary');
const args = ['-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', database,
  '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'];
export const q = value => "'" + String(value).replaceAll("'", "''") + "'";
export const literal = value => value == null ? 'NULL' : typeof value === 'number'
  ? String(value) : typeof value === 'boolean' ? String(value)
    : typeof value === 'object' ? q(JSON.stringify(value)) + '::jsonb' : q(value);
export const rpcSql = (name, values) => 'SELECT public.' + name + '(' + values.map(literal).join(',') + ')';
function prefix(role, actor, application) {
  assert.ok(['postgres', 'authenticated', 'service_role', 'anon'].includes(role));
  return 'SET application_name=' + q(application) + "; SET statement_timeout='20s';"
    + " SET idle_in_transaction_session_timeout='20s'; DO $$BEGIN PERFORM set_config("
    + "'request.jwt.claim.role'," + q(role) + ",false); PERFORM set_config('request.jwt.claim.sub',"
    + q(actor) + ',false); END$$; SET ROLE ' + role + ';';
}
export async function sql(statement, role = 'postgres', actor = '', application = 'ep8-inspect') {
  try {
    const { stdout } = await exec(psql, [...args, '-c', prefix(role, actor, application) + statement],
      { windowsHide: true, timeout: 25000, maxBuffer: 2 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) { throw new Error(error.stderr?.trim() || error.message); }
}
export const json = async (...parameters) => JSON.parse(await sql(...parameters));
export const owner = (statement, f) => json(statement, 'authenticated', f.ownerId, 'ep8-owner');
export const service = statement => json(statement, 'service_role', '', 'ep8-worker');
export async function waitFor(predicate, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const evidence = await predicate();
    if (evidence) return evidence;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('bounded barrier timed out: ' + label);
}

const holders = new Set();
export async function race(name, left, right) {
  assert.notEqual(left.role, 'postgres', 'tested operation uses its real command boundary');
  assert.notEqual(right.role, 'postgres');
  const holderName = 'ep8-' + name + '-holder', contenderName = 'ep8-' + name + '-contender';
  const child = spawn(psql, [...args, '-f', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  holders.add(child);
  let stdout = '', stderr = '', finished = false;
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const closed = new Promise(resolve => {
    child.on('error', error => { finished = true; resolve({ ok: false, error }); });
    child.on('close', code => {
      finished = true; holders.delete(child);
      resolve(code === 0 ? { ok: true, stdout } : { ok: false, error: new Error(stderr || 'psql exit ' + code) });
    });
  });
  child.stdin.write(prefix(left.role, left.actor ?? '', holderName) + 'BEGIN; ' + left.statement
    + "; SELECT json_build_object('barrierPid',pg_backend_pid(),'effectiveRole',current_user);\n\\echo EP8_HELD\n");
  let pending, released = false;
  try {
    await waitFor(() => {
      if (finished) throw new Error(stderr || 'holder exited before barrier');
      return stdout.includes('EP8_HELD');
    }, holderName);
    const barrier = JSON.parse(stdout.split(/\r?\n/).find(line => line.includes('"barrierPid"')));
    assert.equal(barrier.effectiveRole, left.role);
    pending = sql(right.statement, right.role, right.actor ?? '', contenderName)
      .then(value => ({ ok: true, value: JSON.parse(value) }), error => ({ ok: false, error }));
    const evidence = await waitFor(async () => {
      const rows = await json("SELECT coalesce(json_agg(e),'[]') FROM ("
        + 'SELECT pid,application_name,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers'
        + ' FROM pg_stat_activity WHERE datname=' + q(database) + ' AND application_name=' + q(contenderName)
        + " AND wait_event_type='Lock' AND " + barrier.barrierPid + '=ANY(pg_blocking_pids(pid))) e');
      return rows[0];
    }, contenderName);
    assert.notEqual(evidence.pid, barrier.barrierPid);
    console.log('EP8_OVERLAP ' + JSON.stringify({ name, holderPid: barrier.barrierPid,
      holderRole: left.role, contenderRole: right.role, ...evidence }));
    child.stdin.end('COMMIT;\n\\q\n'); released = true;
    const [held, contender] = await Promise.all([closed, pending]);
    if (!held.ok) throw held.error;
    return { held: JSON.parse(held.stdout.split(/\r?\n/)[0]), contender, evidence };
  } finally {
    if (!released && !finished) child.stdin.end('ROLLBACK;\n\\q\n');
    await closed;
    if (pending) await pending;
  }
}
export async function verifyConnectionsClosed() {
  for (const child of holders) child.kill();
  const remaining = await json("SELECT coalesce(json_agg(pid),'[]') FROM pg_stat_activity"
    + ' WHERE datname=' + q(database) + " AND application_name LIKE 'ep8-%' AND pid<>pg_backend_pid()");
  assert.deepEqual(remaining, [], 'every test psql connection exits before harness teardown');
  console.log('EP8_CONNECTION_TEARDOWN_PASS: zero remaining test sessions');
}