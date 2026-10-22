// SDD-09 Unit 1: real PostgreSQL 17 checks for the reading-history migration.
// Disposable loopback cluster only; never connects to the shared Supabase project (see README.md).
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '../../..');
const migrationPath = path.join(root, 'supabase/migrations/20261022160000_library_reading_history.sql');
const binaries = process.env.LIBRARY_PG_BIN;
const modules = process.env.LIBRARY_PG_TOOLS_NODE_MODULES;
assert(binaries && modules, 'Set LIBRARY_PG_BIN and LIBRARY_PG_TOOLS_NODE_MODULES to an existing PostgreSQL 17/pg runtime.');
const require = createRequire(path.join(path.resolve(modules), '__library_runtime__.cjs'));
const { Client } = require('pg');
const native = name => path.join(binaries, name + (process.platform === 'win32' ? '.exe' : ''));

const OWNER = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const BOOK = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const UB = n => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLUB = '60000000-0000-4000-8000-000000000001';
let temp, dataDir, port, postgres, admin, logs = '';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function runNative(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(native(name), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', c => output += c); child.stderr.on('data', c => output += c);
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(output) : reject(new Error(name + ' exited ' + code + ': ' + output)));
  });
}
async function connection(database) {
  const client = new Client({ host: '127.0.0.1', port, database, user: 'postgres', connectionTimeoutMillis: 2000 });
  await client.connect(); return client;
}
async function freshDatabase(name, beforeMigration) {
  assert(/^history_[a-z0-9_]+$/.test(name));
  await admin.query('CREATE DATABASE ' + name);
  const client = await connection(name);
  await client.query(await fs.readFile(path.join(import.meta.dirname, 'readingHistoryBaseline.sql'), 'utf8')
    .then(sql => name === 'history_main' ? sql : sql.replace(/CREATE ROLE (anon|authenticated|service_role)[^;]*;/g, '')));
  await client.query(`INSERT INTO auth.users VALUES ('${OWNER}'),('${OTHER}');`);
  for (let n = 1; n <= 40; n++) await client.query('INSERT INTO public.books VALUES ($1,$2)', [BOOK(n), n === 2 ? 0 : 320]);
  if (beforeMigration) await beforeMigration(client);
  await client.query('BEGIN');
  await client.query(await fs.readFile(migrationPath, 'utf8'));
  await client.query('COMMIT');
  return client;
}
let main;
// Runs fn as an authenticated user inside a transaction that is rolled back (or committed).
async function asUser(actor, fn, { role = 'authenticated', commit = false } = {}) {
  const client = await connection('history_main');
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ' + role);
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [actor ?? '']);
    const result = await fn(client);
    await client.query(commit ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { await client.end(); }
}
const addBook = (c, n, status = 'want_to_read', extra = {}) => c.query(
  'INSERT INTO public.user_books(id,user_id,book_id,reading_status,completed_at) VALUES($1,$2,$3,$4,$5)',
  [UB(n), extra.user ?? OWNER, BOOK(n), status, extra.completedAt ?? null]);
const setStatus = (c, n, status, completedAt) => completedAt === undefined
  ? c.query('UPDATE public.user_books SET reading_status=$2 WHERE id=$1', [UB(n), status])
  : c.query('UPDATE public.user_books SET reading_status=$2, completed_at=$3 WHERE id=$1', [UB(n), status, completedAt]);
const reads = async (c, n) => (await c.query(
  'SELECT read_number, outcome, started_at, ended_at, total_pages, counts_in_stats FROM public.user_book_reads WHERE user_book_id=$1 ORDER BY read_number', [UB(n)])).rows;
const rejectsCode = (call, code) => assert.rejects(call, e => e.code === code, 'expected SQLSTATE ' + code);

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'bookconnect-reading-history-pg17-'));
  dataDir = path.join(temp, 'data');
  const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port; await new Promise(r => server.close(r));
  await runNative('initdb', ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--no-sync', '-E', 'UTF8', '--locale=C']);
  postgres = spawn(native('postgres'), ['-D', dataDir, '-p', String(port), '-h', '127.0.0.1', '-c', 'fsync=off', '-c', 'full_page_writes=off'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  postgres.stdout.on('data', c => logs += c); postgres.stderr.on('data', c => logs += c);
  for (let attempt = 0; attempt < 100; attempt++) { try { admin = await connection('postgres'); break; } catch { await sleep(100); } }
  assert(admin, 'Fresh loopback PostgreSQL did not start: ' + logs);
  assert.equal(Number((await admin.query("SELECT current_setting('server_version_num') AS n")).rows[0].n) >= 170000, true);
  main = await freshDatabase('history_main');
  await main.query(`INSERT INTO public.book_clubs VALUES ('${CLUB}','${BOOK(30)}');
    INSERT INTO public.club_members VALUES ('${CLUB}','${OWNER}','active');`);
});
after(async () => {
  await main?.end(); await admin?.end();
  if (postgres) await runNative('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
  if (temp) {
    const resolved = path.resolve(temp);
    assert(path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('bookconnect-reading-history-pg17-'), 'Refuse cleanup outside named disposable target');
    await fs.rm(resolved, { recursive: true, force: true });
  }
});

test('adding a book as Want to read records nothing; as Reading opens read #1 with the page count', () => asUser(OWNER, async c => {
  await addBook(c, 1);
  assert.deepEqual(await reads(c, 1), []);
  await addBook(c, 3, 'reading');
  const [r] = await reads(c, 3);
  assert.equal(r.outcome, 'reading'); assert.equal(r.read_number, 1); assert.ok(r.started_at); assert.equal(r.ended_at, null);
  assert.equal(r.total_pages, 320);
}));

test('a page count of 0 is stored as unknown', () => asUser(OWNER, async c => {
  await addBook(c, 2, 'reading');
  assert.equal((await reads(c, 2))[0].total_pages, null);
}));

test('Reading → Finished finishes the open read; Finished → Reading starts read #2 (no automatic reopen)', () => asUser(OWNER, async c => {
  await addBook(c, 4, 'reading'); await setStatus(c, 4, 'completed');
  let rs = await reads(c, 4);
  assert.equal(rs.length, 1); assert.equal(rs[0].outcome, 'finished'); assert.ok(rs[0].ended_at >= rs[0].started_at);
  await setStatus(c, 4, 'reading');
  rs = await reads(c, 4);
  assert.deepEqual(rs.map(r => [r.read_number, r.outcome]), [[1, 'finished'], [2, 'reading']]);
}));

test('Reading → Want to read stops the read; then Finished turns that stopped read into finished', () => asUser(OWNER, async c => {
  await addBook(c, 5, 'reading'); await setStatus(c, 5, 'want_to_read');
  assert.equal((await reads(c, 5))[0].outcome, 'did_not_finish');
  await setStatus(c, 5, 'completed');
  const rs = await reads(c, 5);
  assert.equal(rs.length, 1); assert.equal(rs[0].outcome, 'finished');
}));

test('Finished → Want to read → Finished is a status restore and never adds a read', () => asUser(OWNER, async c => {
  await addBook(c, 6, 'reading'); await setStatus(c, 6, 'completed');
  await setStatus(c, 6, 'want_to_read'); await setStatus(c, 6, 'completed');
  assert.deepEqual((await reads(c, 6)).map(r => r.outcome), ['finished']);
}));

test('inserting as Finished keeps an unknown end unknown and clamps a future completed_at to now', () => asUser(OWNER, async c => {
  await addBook(c, 7, 'completed');
  assert.equal((await reads(c, 7))[0].ended_at, null);
  await addBook(c, 8, 'completed', { completedAt: '2999-01-01T00:00:00Z' });
  const end = (await reads(c, 8))[0].ended_at;
  const now = (await c.query('SELECT now() AS n')).rows[0].n;
  assert.equal(end.getTime(), now.getTime());
}));

test('a finish uses completed_at only when the same statement set it', () => asUser(OWNER, async c => {
  await addBook(c, 9, 'reading');
  await c.query("UPDATE public.user_books SET completed_at='2000-01-01T00:00:00Z' WHERE id=$1", [UB(9)]); // stale value
  await setStatus(c, 9, 'want_to_read'); await setStatus(c, 9, 'completed');
  const now = (await c.query('SELECT now() AS n')).rows[0].n;
  assert.equal((await reads(c, 9))[0].ended_at.getTime(), now.getTime());
}));

test('re-sending the same status records nothing (clubs upsert repeat)', () => asUser(OWNER, async c => {
  await addBook(c, 10, 'reading');
  await setStatus(c, 10, 'reading');
  assert.equal((await reads(c, 10)).length, 1);
}));

test('the clubs RPC path is recorded by the trigger', () => asUser(OWNER, async c => {
  await c.query("SELECT public.set_club_current_book_reading_status($1,'reading')", [CLUB]);
  await c.query("SELECT public.set_club_current_book_reading_status($1,'completed')", [CLUB]);
  await c.query("SELECT public.set_club_current_book_reading_status($1,'completed')", [CLUB]);
  const rs = (await c.query('SELECT r.outcome FROM public.user_book_reads r JOIN public.user_books b ON b.id=r.user_book_id WHERE b.book_id=$1', [BOOK(30)])).rows;
  assert.deepEqual(rs.map(r => r.outcome), ['finished']);
}));

test('library_start_reread starts a new read on a finished book and refuses when one is open', () => asUser(OWNER, async c => {
  await addBook(c, 11, 'reading'); await setStatus(c, 11, 'completed');
  await c.query('SELECT public.library_start_reread($1)', [UB(11)]);
  assert.deepEqual((await reads(c, 11)).map(r => [r.read_number, r.outcome]), [[1, 'finished'], [2, 'reading']]);
  assert.equal((await c.query('SELECT reading_status FROM public.user_books WHERE id=$1', [UB(11)])).rows[0].reading_status, 'reading');
  await rejectsCode(c.query('SELECT public.library_start_reread($1)', [UB(11)]), 'P0001');
}));

test("library_start_reread refuses another user's book", async () => {
  await asUser(OTHER, c => addBook(c, 12, 'completed', { user: OTHER }), { commit: true });
  await asUser(OWNER, c => rejectsCode(c.query('SELECT public.library_start_reread($1)', [UB(12)]), 'P0002'));
});

test('Want to read → Finished with no reads creates one finished read without a start', () => asUser(OWNER, async c => {
  await addBook(c, 23); await setStatus(c, 23, 'completed');
  const rs = await reads(c, 23);
  assert.deepEqual(rs.map(r => [r.read_number, r.outcome]), [[1, 'finished']]);
  assert.equal(rs[0].started_at, null); assert.ok(rs[0].ended_at);
}));

test('"Leave out of my stats" carries over to the next read, by status change and by Read again', () => asUser(OWNER, async c => {
  await addBook(c, 24, 'reading'); await setStatus(c, 24, 'completed');
  await c.query('UPDATE public.user_book_reads SET counts_in_stats=false WHERE user_book_id=$1', [UB(24)]);
  await setStatus(c, 24, 'reading'); await setStatus(c, 24, 'completed');
  await c.query('SELECT public.library_start_reread($1)', [UB(24)]);
  assert.deepEqual((await reads(c, 24)).map(r => r.counts_in_stats), [false, false, false]);
}));

test('library_start_reread refuses a book already marked Reading', () => asUser(OWNER, async c => {
  await addBook(c, 25, 'reading');
  await rejectsCode(c.query('SELECT public.library_start_reread($1)', [UB(25)]), 'P0001');
}));

test('a stopped read can be reopened by hand', () => asUser(OWNER, async c => {
  await addBook(c, 26, 'reading'); await setStatus(c, 26, 'want_to_read');
  const id = (await c.query('SELECT id FROM public.user_book_reads WHERE user_book_id=$1', [UB(26)])).rows[0].id;
  await c.query('SELECT public.library_reopen_read($1)', [id]);
  assert.equal((await reads(c, 26))[0].outcome, 'reading');
}));

test('picked days cannot be in the future', () => asUser(OWNER, async c => {
  await addBook(c, 27, 'reading'); await setStatus(c, 27, 'completed');
  await rejectsCode(c.query('UPDATE public.user_book_reads SET ended_on=current_date + 5 WHERE user_book_id=$1', [UB(27)]), '23514');
}));

test('the next-read choice also clears when that book is marked Finished', () => asUser(OWNER, async c => {
  await addBook(c, 28);
  await c.query('INSERT INTO public.user_reading_settings(user_id,next_read_user_book_id) VALUES($1,$2)', [OWNER, UB(28)]);
  await setStatus(c, 28, 'completed');
  assert.equal((await c.query('SELECT next_read_user_book_id FROM public.user_reading_settings WHERE user_id=$1', [OWNER])).rows[0].next_read_user_book_id, null);
}));

test("another user can't see my progress, goals or settings; anon can't reopen", async () => {
  await asUser(OWNER, async c => {
    await addBook(c, 29, 'reading');
    const readId = (await c.query('SELECT id FROM public.user_book_reads WHERE user_book_id=$1', [UB(29)])).rows[0].id;
    await c.query('INSERT INTO public.user_book_progress(read_id,user_id,page) VALUES($1,$2,3)', [readId, OWNER]);
    await c.query('INSERT INTO public.user_reading_goals(user_id,year,target_books) VALUES($1,2025,10)', [OWNER]);
    await c.query('INSERT INTO public.user_reading_settings(user_id) VALUES($1) ON CONFLICT DO NOTHING', [OWNER]);
  }, { commit: true });
  await asUser(OTHER, async c => {
    for (const table of ['user_book_progress', 'user_reading_goals', 'user_reading_settings'])
      assert.equal((await c.query(`SELECT count(*)::int n FROM public.${table} WHERE user_id=$1`, [OWNER])).rows[0].n, 0, table);
    assert.equal((await c.query('UPDATE public.user_reading_goals SET target_books=1 WHERE user_id=$1', [OWNER])).rowCount, 0);
  });
  await main.query('DELETE FROM public.user_reading_settings WHERE user_id=$1', [OWNER]); // later tests create their own
  await asUser(null, c => rejectsCode(c.query('SELECT public.library_reopen_read(gen_random_uuid())'), '42501'), { role: 'anon' });
});

test('the database itself allows only one open read per book', async () => {
  await asUser(OWNER, c => addBook(c, 36, 'reading'), { commit: true });
  await rejectsCode(main.query("INSERT INTO public.user_book_reads(user_book_id,user_id,read_number,outcome) VALUES($1,$2,2,'reading')", [UB(36), OWNER]), '23505');
});

test('library_reopen_read reopens only the latest closed read and sets the status to Reading', () => asUser(OWNER, async c => {
  await addBook(c, 13, 'reading'); await setStatus(c, 13, 'completed');
  await c.query('SELECT public.library_start_reread($1)', [UB(13)]); await setStatus(c, 13, 'completed');
  const ids = (await c.query('SELECT id FROM public.user_book_reads WHERE user_book_id=$1 ORDER BY read_number', [UB(13)])).rows.map(r => r.id);
  await c.query('SAVEPOINT s');
  await rejectsCode(c.query('SELECT public.library_reopen_read($1)', [ids[0]]), 'P0001'); // not latest
  await c.query('ROLLBACK TO SAVEPOINT s');
  await c.query('SELECT public.library_reopen_read($1)', [ids[1]]);
  const rs = await reads(c, 13);
  assert.equal(rs[1].outcome, 'reading'); assert.equal(rs[1].ended_at, null);
  assert.equal((await c.query('SELECT reading_status FROM public.user_books WHERE id=$1', [UB(13)])).rows[0].reading_status, 'reading');
  await rejectsCode(c.query('SELECT public.library_reopen_read($1)', [ids[1]]), 'P0001'); // already open
}));

test("another user can't see or change my reads; anon has no access", async () => {
  await asUser(OWNER, c => addBook(c, 14, 'reading'), { commit: true });
  await asUser(OTHER, async c => {
    assert.equal((await c.query('SELECT count(*)::int n FROM public.user_book_reads WHERE user_book_id=$1', [UB(14)])).rows[0].n, 0);
    assert.equal((await c.query("UPDATE public.user_book_reads SET counts_in_stats=false WHERE user_book_id=$1", [UB(14)])).rowCount, 0);
    await rejectsCode(c.query('SELECT public.library_reopen_read(id) FROM (SELECT gen_random_uuid() id) x'), 'P0002');
  });
  await asUser(null, c => rejectsCode(c.query('SELECT * FROM public.user_book_reads'), '42501'), { role: 'anon' });
  await asUser(null, c => rejectsCode(c.query('SELECT public.library_start_reread($1)', [UB(14)]), '42501'), { role: 'anon' });
});

test('clients can edit only the granted read columns and cannot insert reads directly', () => asUser(OWNER, async c => {
  await addBook(c, 15, 'reading'); await setStatus(c, 15, 'completed');
  await c.query("UPDATE public.user_book_reads SET started_on='2026-10-01', ended_on='2026-10-20', counts_in_stats=false WHERE user_book_id=$1", [UB(15)]);
  await c.query('SAVEPOINT s');
  await rejectsCode(c.query("UPDATE public.user_book_reads SET outcome='reading' WHERE user_book_id=$1", [UB(15)]), '42501');
  await c.query('ROLLBACK TO SAVEPOINT s');
  await rejectsCode(c.query("INSERT INTO public.user_book_reads(user_book_id,user_id,read_number,outcome) VALUES($1,$2,9,'finished')", [UB(15), OWNER]), '42501');
}));

test('picked dates must be in order and an open read cannot have an end', () => asUser(OWNER, async c => {
  await addBook(c, 16, 'reading');
  await c.query('SAVEPOINT s');
  await rejectsCode(c.query("UPDATE public.user_book_reads SET ended_on='2026-10-20' WHERE user_book_id=$1", [UB(16)]), '23514');
  await c.query('ROLLBACK TO SAVEPOINT s');
  await setStatus(c, 16, 'completed');
  await rejectsCode(c.query("UPDATE public.user_book_reads SET started_on='2026-10-21', ended_on='2026-10-20' WHERE user_book_id=$1", [UB(16)]), '23514');
}));

test('delete rules: never an open read, never the latest read of a Finished book, otherwise allowed', () => asUser(OWNER, async c => {
  await addBook(c, 17, 'reading');
  const del = () => c.query('DELETE FROM public.user_book_reads WHERE user_book_id=$1', [UB(17)]);
  assert.equal((await del()).rowCount, 0); // open
  await setStatus(c, 17, 'completed');
  assert.equal((await del()).rowCount, 0); // latest read of a Finished book
  await setStatus(c, 17, 'want_to_read');
  assert.equal((await del()).rowCount, 1);
}));

test('progress goes only into an open read, with exactly one of page or percent', () => asUser(OWNER, async c => {
  await addBook(c, 18, 'reading');
  const readId = (await c.query('SELECT id FROM public.user_book_reads WHERE user_book_id=$1', [UB(18)])).rows[0].id;
  await c.query('INSERT INTO public.user_book_progress(read_id,user_id,page) VALUES($1,$2,0)', [readId, OWNER]);
  await c.query('SAVEPOINT s');
  await rejectsCode(c.query('INSERT INTO public.user_book_progress(read_id,user_id,page,percent) VALUES($1,$2,5,5)', [readId, OWNER]), '23514');
  await c.query('ROLLBACK TO SAVEPOINT s');
  await setStatus(c, 18, 'completed');
  await rejectsCode(c.query('INSERT INTO public.user_book_progress(read_id,user_id,page) VALUES($1,$2,10)', [readId, OWNER]), '42501');
}));

test('the next-read choice clears when that book starts', () => asUser(OWNER, async c => {
  await addBook(c, 19);
  await c.query('INSERT INTO public.user_reading_settings(user_id,next_read_user_book_id) VALUES($1,$2)', [OWNER, UB(19)]);
  await setStatus(c, 19, 'reading');
  assert.equal((await c.query('SELECT next_read_user_book_id FROM public.user_reading_settings WHERE user_id=$1', [OWNER])).rows[0].next_read_user_book_id, null);
}));

test('removing a book removes its reads and progress and clears the next-read link', () => asUser(OWNER, async c => {
  await addBook(c, 20, 'reading'); await addBook(c, 21);
  const readId = (await c.query('SELECT id FROM public.user_book_reads WHERE user_book_id=$1', [UB(20)])).rows[0].id;
  await c.query('INSERT INTO public.user_book_progress(read_id,user_id,page) VALUES($1,$2,10)', [readId, OWNER]);
  await c.query('INSERT INTO public.user_reading_settings(user_id,next_read_user_book_id) VALUES($1,$2)', [OWNER, UB(21)]);
  await c.query('DELETE FROM public.user_books WHERE id IN ($1,$2)', [UB(20), UB(21)]);
  assert.equal((await c.query('SELECT count(*)::int n FROM public.user_book_progress WHERE read_id=$1', [readId])).rows[0].n, 0);
  assert.equal((await reads(c, 20)).length, 0);
  const s = (await c.query('SELECT user_id, next_read_user_book_id FROM public.user_reading_settings WHERE user_id=$1', [OWNER])).rows[0];
  assert.equal(s.user_id, OWNER); assert.equal(s.next_read_user_book_id, null);
}));

test('goals: one per year, own rows only', async () => {
  await asUser(OWNER, async c => {
    await c.query('INSERT INTO public.user_reading_goals(user_id,year,target_books) VALUES($1,2026,24)', [OWNER]);
    await rejectsCode(c.query('INSERT INTO public.user_reading_goals(user_id,year,target_books) VALUES($1,2026,30)', [OTHER]), '42501');
  });
});

test('"Read again" and a status change on the same book serialize without deadlock or two open reads', async () => {
  await asUser(OWNER, async c => { await addBook(c, 22, 'reading'); await setStatus(c, 22, 'completed'); }, { commit: true });
  const a = await connection('history_main'), b = await connection('history_main');
  try {
    for (const c of [a, b]) {
      await c.query('BEGIN'); await c.query('SET LOCAL ROLE authenticated');
      await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [OWNER]);
    }
    await a.query('SELECT public.library_start_reread($1)', [UB(22)]);
    let done = false;
    const pending = b.query("UPDATE public.user_books SET reading_status='want_to_read' WHERE id=$1", [UB(22)]).then(() => { done = true; });
    await sleep(400);
    assert.equal(done, false, 'the second writer must wait on the book row lock');
    await a.query('COMMIT'); await pending; await b.query('COMMIT');
  } finally { await a.end(); await b.end(); }
  const rs = (await main.query("SELECT read_number, outcome FROM public.user_book_reads WHERE user_book_id=$1 ORDER BY read_number", [UB(22)])).rows;
  assert.deepEqual(rs.map(r => [r.read_number, r.outcome]), [[1, 'finished'], [2, 'did_not_finish']]);
});

test('back-fill: existing Reading and Finished books get one read each; Want to read and ownerless rows get none', async () => {
  const db = await freshDatabase('history_backfill', async c => {
    await c.query(`INSERT INTO public.user_books(id,user_id,book_id,reading_status,completed_at) VALUES
      ('${UB(31)}','${OWNER}','${BOOK(31)}','reading',NULL),
      ('${UB(32)}','${OWNER}','${BOOK(32)}','completed','2026-05-01T10:00:00Z'),
      ('${UB(33)}','${OWNER}','${BOOK(33)}','completed',NULL),
      ('${UB(34)}','${OWNER}','${BOOK(34)}','want_to_read','2026-01-01T00:00:00Z'),
      ('${UB(35)}',NULL,'${BOOK(35)}','completed',NULL)`);
  });
  try {
    const rs = (await db.query('SELECT user_book_id, outcome, started_at, ended_at FROM public.user_book_reads ORDER BY user_book_id')).rows;
    assert.deepEqual(rs.map(r => [r.user_book_id, r.outcome]), [[UB(31), 'reading'], [UB(32), 'finished'], [UB(33), 'finished']]);
    assert.equal(rs[0].started_at, null);
    assert.equal(rs[1].ended_at.toISOString(), '2026-05-01T10:00:00.000Z');
    assert.equal(rs[2].ended_at, null);
    const extra = (await db.query('SELECT total_pages, started_at, start_unknown, end_unknown FROM public.user_book_reads ORDER BY user_book_id')).rows;
    assert.deepEqual(extra.map(r => [r.total_pages, r.started_at, r.start_unknown, r.end_unknown]), [[320, null, false, false], [320, null, false, false], [320, null, false, false]]);
  } finally { await db.end(); }
});
