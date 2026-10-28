// Owner B1 / 02b section 6.2: bounded native barriers; never start a database here.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { json, q, waitFor } from './editionPickerPostgresConnections.mjs';

export const receipts = output => output.split(/\r?\n/).filter(line => line.startsWith('{')).map(JSON.parse);

export function transaction(name, statement, { role = 'postgres', actor = '', hold = false } = {}) {
  assert.ok(['postgres', 'authenticated', 'service_role'].includes(role));
  const [port, database, psql] = process.argv.slice(2), application = 'ep8-local-hook-' + name;
  const child = spawn(psql, ['-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', database,
    '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '', finished = false;
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  child.stdin.on('error', () => {});
  const done = new Promise(resolve => {
    child.on('error', error => { finished = true; resolve({ code: -1, output, errors: errors + error.message }); });
    child.on('close', code => { finished = true; resolve({ code, output, errors }); });
  });
  const release = (commit = false) => {
    if (!finished && !child.stdin.writableEnded) child.stdin.end((commit ? 'COMMIT' : 'ROLLBACK') + ';\n\\q\n');
  };
  // Set privileged diagnostics before SET ROLE. Both tested calls use their real API role.
  child.stdin.write('\\set VERBOSITY verbose\nSET application_name=' + q(application)
    + "; SET deadlock_timeout='5s'; SET statement_timeout='25s'; SET idle_in_transaction_session_timeout='25s';"
    + " DO $$ BEGIN PERFORM set_config('request.jwt.claim.role'," + q(role)
    + ",false); PERFORM set_config('request.jwt.claim.sub'," + q(actor) + ',false); END$$; SET ROLE ' + role
    + "; BEGIN; SELECT json_build_object('backendPid',pg_backend_pid());\n\\echo LEAN_CONNECTED\n"
    + statement + ';\n' + (hold ? '\\echo LEAN_HELD\n' : ''));
  if (!hold) release(true);
  return {
    application, done, release,
    get finished() { return finished; }, get errors() { return errors; },
    async pid() {
      await waitFor(() => {
        assert.equal(finished, false, 'transaction must reach connection barrier: ' + errors);
        return output.includes('LEAN_CONNECTED');
      }, application);
      return receipts(output).find(value => value.backendPid)?.backendPid;
    },
    async held() {
      await waitFor(() => {
        assert.equal(finished, false, 'barrier holder must acquire its key: ' + errors);
        return output.includes('LEAN_HELD');
      }, application + ' held');
    },
  };
}

export async function waitingOn(name, connection, blockerPid) {
  const evidence = await waitFor(async () => {
    assert.equal(connection.finished, false, 'command must reach lock barrier: ' + connection.errors);
    return (await json(`SELECT coalesce(json_agg(a),'[]') FROM (
      SELECT s.pid,s.application_name,s.wait_event_type,s.wait_event,pg_blocking_pids(s.pid) AS blockers,
        EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=s.pid AND NOT l.granted) AS pending_lock
      FROM pg_stat_activity s WHERE s.application_name=${q(connection.application)}
        AND s.wait_event_type='Lock' AND ${blockerPid}=ANY(pg_blocking_pids(s.pid))) a`))[0];
  }, name + ' actual Lock');
  assert.equal(evidence.pending_lock, true);
  assert.notEqual(evidence.pid, blockerPid);
  console.log('LEAN_CATALOGUE_LOCK ' + JSON.stringify({ name, holderPid: blockerPid, ...evidence }));
  return evidence;
}

export const advisoryLocks = pid => json(`SELECT coalesce(json_agg(x ORDER BY key::bigint),'[]') FROM (
  SELECT ((classid::bigint<<32)|objid::bigint)::text AS key,granted FROM pg_locks
  WHERE pid=${pid} AND locktype='advisory' AND objsubid=1) x`);
