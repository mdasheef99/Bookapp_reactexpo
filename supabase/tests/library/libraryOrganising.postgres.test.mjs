// SDD-11 Units E and F: real PostgreSQL 17 checks for the labels and note-collections migrations.
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
const LABELS = process.env.LIBRARY_LABELS_MIGRATION ?? path.join(root, 'supabase/migrations/20261023190000_library_book_labels.sql');
const COLLECTIONS = process.env.LIBRARY_COLLECTIONS_MIGRATION ?? path.join(root, 'supabase/migrations/20261023190100_library_note_collections.sql');
const binaries = process.env.LIBRARY_PG_BIN;
const modules = process.env.LIBRARY_PG_TOOLS_NODE_MODULES;
assert(binaries && modules, 'Set LIBRARY_PG_BIN and LIBRARY_PG_TOOLS_NODE_MODULES to an existing PostgreSQL 17/pg runtime.');
const require = createRequire(path.join(path.resolve(modules), '__library_runtime__.cjs'));
const { Client } = require('pg');
const native = name => path.join(binaries, name + (process.platform === 'win32' ? '.exe' : ''));

const OWNER = '10000000-0000-4000-8000-000000000001', OTHER = '10000000-0000-4000-8000-000000000002';
const id = (prefix, n) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BOOK = n => id('20000000', n), UB = n => id('50000000', n), NOTE = n => id('70000000', n);
let temp, dataDir, port, postgres, admin, main, logs = '';
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
// Seeds: OWNER has user_books 1-3 and notes 1-3 (note 1,2 on book 1; note 3 on book 2); OTHER has user_books 4-5 and note 4.
async function freshDatabase(name, migrations, { seed = true } = {}) {
  assert(/^org_[a-z0-9_]+$/.test(name));
  await admin.query('CREATE DATABASE ' + name);
  const client = await connection(name);
  await client.query(await fs.readFile(path.join(import.meta.dirname, 'libraryOrganisingBaseline.sql'), 'utf8')
    .then(sql => name === 'org_main' ? sql : sql.replace(/CREATE ROLE (anon|authenticated|service_role)[^;]*;/g, '')));
  if (seed) {
    await client.query(`INSERT INTO auth.users VALUES ('${OWNER}'),('${OTHER}');`);
    for (let n = 1; n <= 8; n++) await client.query('INSERT INTO public.books VALUES ($1,320)', [BOOK(n)]);
    for (const [n, user] of [[1, OWNER], [2, OWNER], [3, OWNER], [4, OTHER], [5, OTHER]]) {
      await client.query('INSERT INTO public.user_books(id,user_id,book_id) VALUES ($1,$2,$3)', [UB(n), user, BOOK(n)]);
    }
    for (const [n, ub, user] of [[1, 1, OWNER], [2, 1, OWNER], [3, 2, OWNER], [4, 4, OTHER]]) {
      await client.query('INSERT INTO public.reading_notes(id,user_id,user_book_id,content) VALUES ($1,$2,$3,$4)', [NOTE(n), user, UB(ub), 'note ' + n]);
    }
  }
  for (const file of migrations) {
    await client.query('BEGIN');
    await client.query(await fs.readFile(file, 'utf8'));
    await client.query('COMMIT');
  }
  return client;
}
// Runs fn as an authenticated user inside a transaction that is rolled back (or committed).
async function asUser(database, actor, fn, { role = 'authenticated', commit = false } = {}) {
  const client = await connection(database);
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
const as = (actor, fn, options) => asUser('org_main', actor, fn, options);
const rejectsCode = (call, code, message) => assert.rejects(call, e => e.code === code && (message === undefined || e.message === message),
  'expected SQLSTATE ' + code + (message ? ' ' + message : ''));
const addLabel = async (c, name) => (await c.query('INSERT INTO public.user_library_labels(name) VALUES ($1) RETURNING id', [name])).rows[0].id;
const addCollection = async (c, name) => (await c.query('INSERT INTO public.user_note_collections(name) VALUES ($1) RETURNING id', [name])).rows[0].id;
const count = async (c, table, where = 'true') => Number((await c.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0].n);
const asSuper = async (database, fn) => { const c = await connection(database); try { await c.query('BEGIN'); const r = await fn(c); await c.query('ROLLBACK'); return r; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { await c.end(); } };
let dbCounter = 0;
const nextDb = () => 'org_t' + (++dbCounter);

before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'bookconnect-library-organising-pg17-'));
  dataDir = path.join(temp, 'data');
  const server = net.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port; await new Promise(r => server.close(r));
  await runNative('initdb', ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--no-sync', '-E', 'UTF8', '--locale=C']);
  postgres = spawn(native('postgres'), ['-D', dataDir, '-p', String(port), '-h', '127.0.0.1', '-c', 'fsync=off', '-c', 'full_page_writes=off'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  postgres.stdout.on('data', c => logs += c); postgres.stderr.on('data', c => logs += c);
  for (let attempt = 0; attempt < 100; attempt++) { try { admin = await connection('postgres'); break; } catch { await sleep(100); } }
  assert(admin, 'Fresh loopback PostgreSQL did not start: ' + logs);
  assert.equal(Number((await admin.query("SELECT current_setting('server_version_num') AS n")).rows[0].n) >= 170000, true);
  main = await freshDatabase('org_main', [LABELS, COLLECTIONS]);
});
after(async () => {
  await main?.end(); await admin?.end();
  if (postgres) await runNative('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']);
  if (temp) {
    const resolved = path.resolve(temp);
    assert(path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('bookconnect-library-organising-pg17-'), 'Refuse cleanup outside named disposable target');
    await fs.rm(resolved, { recursive: true, force: true });
  }
});

// ---- Application ------------------------------------------------------------------------------
test('each migration applies cleanly on its own and both apply together', async () => {
  for (const [files, tables] of [[[LABELS], ['user_library_labels', 'user_book_labels']], [[COLLECTIONS], ['user_note_collections', 'user_note_collection_items']]]) {
    const name = nextDb(); const c = await freshDatabase(name, files);
    for (const table of tables) assert.equal(await count(c, 'pg_class', `relname='${table}' AND relrowsecurity`), 1, table + ' exists with RLS');
    await c.end();
  }
  assert.equal(await count(main, 'pg_class', "relname IN ('user_library_labels','user_book_labels','user_note_collections','user_note_collection_items') AND relrowsecurity"), 4);
});

test('the only change to an existing table is the new UNIQUE (id, user_id) on reading_notes', async () => {
  const keys = (await main.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.reading_notes'::regclass AND contype='u'`)).rows;
  assert.deepEqual(keys.map(k => [k.conname, k.def]), [['reading_notes_id_owner_key', 'UNIQUE (id, user_id)']]);
  assert.equal(await count(main, 'pg_policies', "tablename='reading_notes'"), 4, 'reading_notes policies unchanged');
  assert.equal(await count(main, 'information_schema.column_privileges', "table_name='reading_notes' AND grantee='authenticated' AND privilege_type='UPDATE'"), 5, 'reading_notes UPDATE grants unchanged');
  assert.equal(await count(main, 'pg_trigger', "tgrelid='public.reading_notes'::regclass AND NOT tgisinternal"), 0, 'no trigger added to reading_notes');
});

test('link tables have only composite owner foreign keys (one PostgREST embed path)', async () => {
  for (const [table, expected] of [['user_book_labels', 2], ['user_note_collection_items', 2]]) {
    const fks = (await main.query(`SELECT conname, array_length(conkey,1) AS n, confdeltype, confupdtype FROM pg_constraint WHERE conrelid='public.${table}'::regclass AND contype='f'`)).rows;
    assert.equal(fks.length, expected, table + ' has exactly two foreign keys');
    for (const fk of fks) { assert.equal(fk.n, 2, fk.conname + ' is composite'); assert.equal(fk.confdeltype, 'c'); assert.equal(fk.confupdtype, 'r'); }
  }
});

// ---- Labels ------------------------------------------------------------------------------------
test('label names: trimmed, 1-24 code points, case-insensitive unique per person, other people may reuse', async () => {
  await as(OWNER, async c => { await addLabel(c, 'Favourites'); await addLabel(c, '😀'.repeat(24)); await addLabel(c, 'x'); });
  for (const bad of ['', ' lead', 'trail ', 'y'.repeat(25), '😀'.repeat(25)]) {
    await rejectsCode(as(OWNER, c => addLabel(c, bad)), '23514');
  }
  await rejectsCode(as(OWNER, async c => { await addLabel(c, 'Borrowed'); await addLabel(c, 'bORROWED'); }), '23505');
  await as(OTHER, async c => { await addLabel(c, 'Borrowed'); });
});

test('25-label limit: the 26th is refused with library_label_limit; the limit is per person', async () => {
  const name = nextDb(); const c = await freshDatabase(name, [LABELS]); await c.end();
  await asUser(name, OWNER, async client => { for (let n = 1; n <= 25; n++) await addLabel(client, 'Label ' + n); }, { commit: true });
  await rejectsCode(asUser(name, OWNER, client => addLabel(client, 'One too many')), '23514', 'library_label_limit');
  await asUser(name, OTHER, client => addLabel(client, 'Mine'));
  // Deleting one frees a slot.
  await asUser(name, OWNER, async client => {
    await client.query("DELETE FROM public.user_library_labels WHERE name='Label 1'");
    await addLabel(client, 'Replacement');
  });
});

test('limit race: a concurrent 25th insert really waits on the advisory lock and only one wins', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS]); await setup.end();
  await asUser(name, OWNER, async client => { for (let n = 1; n <= 24; n++) await addLabel(client, 'L' + n); }, { commit: true });
  const open = async () => {
    const client = await connection(name);
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [OWNER]);
    return client;
  };
  const a = await open(), b = await open();
  try {
    await addLabel(a, 'first');
    const second = addLabel(b, 'second').then(() => 'ok', e => e);
    let waiting = 0;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      waiting = Number((await admin.query("SELECT count(*) AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].n);
      if (!waiting) await sleep(50);
    }
    assert.equal(waiting, 1, 'the second writer must be blocked on the advisory lock before the first commits');
    await a.query('COMMIT');
    const outcome = await second;
    assert.equal(outcome.code, '23514'); assert.equal(outcome.message, 'library_label_limit');
  } finally { await a.query('ROLLBACK').catch(() => {}); await b.query('ROLLBACK').catch(() => {}); await a.end(); await b.end(); }
  const check = await connection(name);
  assert.equal(await count(check, 'public.user_library_labels', `user_id='${OWNER}'`), 25); await check.end();
});

test('labels link only a book and a label of the same owner; duplicates and spoofing are refused', async () => {
  await as(OWNER, async c => {
    const label = await addLabel(c, 'Mine');
    await c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(1), label]);
    const [row] = (await c.query('SELECT user_id FROM public.user_book_labels')).rows;
    assert.equal(row.user_id, OWNER, 'user_id defaults to auth.uid()');
    await c.query('SAVEPOINT s1');
    await rejectsCode(c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(1), label]), '23505');
    await c.query('ROLLBACK TO s1');
    // ON CONFLICT DO NOTHING is fine; a PostgREST-style upsert (DO UPDATE) needs UPDATE and is refused.
    await c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [UB(1), label]);
    await rejectsCode(c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2) ON CONFLICT (user_book_id,label_id) DO UPDATE SET label_id=EXCLUDED.label_id', [UB(1), label]), '42501');
  });
  // Another person's book -> no (book, owner) pair exists -> FK violation.
  await rejectsCode(as(OWNER, async c => { const label = await addLabel(c, 'Mine'); await c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(4), label]); }), '23503');
  // Spoofing user_id is refused by the column grant.
  await rejectsCode(as(OWNER, async c => { const label = await addLabel(c, 'Mine'); await c.query('INSERT INTO public.user_book_labels(user_id,user_book_id,label_id) VALUES ($1,$2,$3)', [OTHER, UB(1), label]); }), '42501');
  // Another person's label: create it as OTHER (committed in a scratch database), then link as OWNER.
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS]); await setup.end();
  const foreignLabel = await asUser(name, OTHER, c => addLabel(c, 'Theirs'), { commit: true });
  await rejectsCode(asUser(name, OWNER, c => c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(1), foreignLabel])), '23503');
});

test('labels are owner-only: no cross-user reads or writes, anon denied, guard columns protected', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS]); await setup.end();
  const label = await asUser(name, OWNER, async c => {
    const created = await addLabel(c, 'Private');
    await c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(1), created]);
    return created;
  }, { commit: true });
  await asUser(name, OTHER, async c => {
    assert.equal(await count(c, 'public.user_library_labels'), 0);
    assert.equal(await count(c, 'public.user_book_labels'), 0);
    assert.equal((await c.query("UPDATE public.user_library_labels SET name='Hacked' WHERE id=$1", [label])).rowCount, 0);
    assert.equal((await c.query('DELETE FROM public.user_library_labels WHERE id=$1', [label])).rowCount, 0);
    assert.equal((await c.query('DELETE FROM public.user_book_labels WHERE label_id=$1', [label])).rowCount, 0);
  });
  await rejectsCode(asUser(name, null, c => c.query('SELECT * FROM public.user_library_labels'), { role: 'anon' }), '42501');
  await rejectsCode(asUser(name, null, c => c.query('SELECT * FROM public.user_book_labels'), { role: 'anon' }), '42501');
  await asUser(name, OWNER, async c => {
    const before = (await c.query('SELECT created_at, updated_at FROM public.user_library_labels WHERE id=$1', [label])).rows[0];
    await sleep(20);
    await c.query("UPDATE public.user_library_labels SET name='Renamed' WHERE id=$1", [label]);
    const after = (await c.query('SELECT name, created_at, updated_at FROM public.user_library_labels WHERE id=$1', [label])).rows[0];
    assert.equal(after.name, 'Renamed'); assert.equal(+after.created_at, +before.created_at); assert.ok(after.updated_at > before.updated_at, 'updated_at moves on rename');
    for (const sql of ["UPDATE public.user_library_labels SET created_at=now() WHERE id=$1", "UPDATE public.user_library_labels SET id=gen_random_uuid() WHERE id=$1",
      "UPDATE public.user_library_labels SET user_id=gen_random_uuid() WHERE id=$1", "UPDATE public.user_book_labels SET user_book_id=user_book_id WHERE label_id=$1"]) {
      await c.query('SAVEPOINT g'); await rejectsCode(c.query(sql, [label]), '42501'); await c.query('ROLLBACK TO g');
    }
    await rejectsCode(c.query('TRUNCATE public.user_library_labels'), '42501');
  });
});

test('label guards (defence in depth, as the table owner): timestamps are server-owned, ids and links are immutable', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS]); await setup.end();
  await asSuper(name, async c => {
    await c.query(`INSERT INTO public.user_library_labels(user_id,name,created_at,updated_at) VALUES ('${OWNER}','Spoof','2001-01-01','2001-01-01')`);
    const row = (await c.query("SELECT created_at FROM public.user_library_labels WHERE name='Spoof'")).rows[0];
    assert.ok(row.created_at.getFullYear() >= 2026, 'created_at is overwritten by the server clock');
    await c.query('SAVEPOINT g'); await rejectsCode(c.query("UPDATE public.user_library_labels SET id=gen_random_uuid() WHERE name='Spoof'"), '23514', 'library_label_immutable'); await c.query('ROLLBACK TO g');
    await c.query('SAVEPOINT g'); await rejectsCode(c.query(`UPDATE public.user_library_labels SET user_id='${OTHER}' WHERE name='Spoof'`), '23514', 'library_label_immutable'); await c.query('ROLLBACK TO g');
    await c.query(`INSERT INTO public.user_book_labels(user_id,user_book_id,label_id) SELECT '${OWNER}','${UB(1)}',id FROM public.user_library_labels WHERE name='Spoof'`);
    await rejectsCode(c.query('UPDATE public.user_book_labels SET created_at=now()'), '23514', 'library_label_link_immutable');
  });
});

test('a missing user is refused before any lock or count (no auth.uid)', async () => {
  await rejectsCode(as('', c => addLabel(c, 'Nobody')), '23502', 'library_label_user_required');
});

test('label cascades: deleting a book or a label removes links only; deleting the user removes labels', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS]); await setup.end();
  const [keep, drop] = await asUser(name, OWNER, async c => {
    const a = await addLabel(c, 'Keep'), b = await addLabel(c, 'Drop');
    for (const label of [a, b]) for (const book of [1, 2]) await c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(book), label]);
    return [a, b];
  }, { commit: true });
  const c = await connection(name);
  await c.query('DELETE FROM public.user_books WHERE id=$1', [UB(2)]);
  assert.equal(await count(c, 'public.user_book_labels'), 2, 'book delete removed its two links');
  assert.equal(await count(c, 'public.user_library_labels'), 2, 'labels survive a book delete');
  await c.query('DELETE FROM public.user_library_labels WHERE id=$1', [drop]);
  assert.equal(await count(c, 'public.user_book_labels', `label_id='${drop}'`), 0);
  assert.equal(await count(c, 'public.user_book_labels', `label_id='${keep}'`), 1);
  assert.equal(await count(c, 'public.user_books', `id='${UB(1)}'`), 1, 'the book itself is untouched');
  await c.query(`DELETE FROM auth.users WHERE id='${OWNER}'`);
  assert.equal(await count(c, 'public.user_library_labels'), 0); assert.equal(await count(c, 'public.user_book_labels'), 0);
  await c.end();
});

// ---- Collections -------------------------------------------------------------------------------
test('collection names: trimmed, 1-40 code points, case-insensitive unique per person', async () => {
  await as(OWNER, async c => { await addCollection(c, 'Lines about grief'); await addCollection(c, '😀'.repeat(40)); });
  for (const bad of ['', ' lead', 'trail ', 'z'.repeat(41), '😀'.repeat(41)]) await rejectsCode(as(OWNER, c => addCollection(c, bad)), '23514');
  await rejectsCode(as(OWNER, async c => { await addCollection(c, 'Quotes'); await addCollection(c, 'qUOTES'); }), '23505');
  await as(OTHER, c => addCollection(c, 'Quotes'));
});

test('25-collection limit with its own lock key, a real concurrent wait, and a per-person limit', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [COLLECTIONS]); await setup.end();
  await asUser(name, OWNER, async c => { for (let n = 1; n <= 24; n++) await addCollection(c, 'C' + n); }, { commit: true });
  await asUser(name, OWNER, async c => {
    // The label cap key must not interfere: it is a different advisory key.
    await addCollection(c, 'twenty-fifth');
    await rejectsCode(c.query('SAVEPOINT x').then(() => addCollection(c, 'twenty-sixth')), '23514', 'library_collection_limit');
  });
  await asUser(name, OTHER, c => addCollection(c, 'Mine'));
  const open = async () => {
    const client = await connection(name);
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [OWNER]);
    return client;
  };
  const a = await open(), b = await open();
  try {
    await addCollection(a, 'first');
    const second = addCollection(b, 'second').then(() => 'ok', e => e);
    let waiting = 0;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      waiting = Number((await admin.query("SELECT count(*) AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted")).rows[0].n);
      if (!waiting) await sleep(50);
    }
    assert.equal(waiting, 1);
    await a.query('COMMIT');
    const outcome = await second;
    assert.equal(outcome.code, '23514'); assert.equal(outcome.message, 'library_collection_limit');
  } finally { await a.query('ROLLBACK').catch(() => {}); await b.query('ROLLBACK').catch(() => {}); await a.end(); await b.end(); }
});

test('collection items link only own notes to own collections; a note may be in several collections', async () => {
  await as(OWNER, async c => {
    const one = await addCollection(c, 'One'), two = await addCollection(c, 'Two');
    for (const collection of [one, two]) await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [collection, NOTE(1)]);
    assert.equal(await count(c, 'public.user_note_collection_items', `note_id='${NOTE(1)}'`), 2);
    assert.equal((await c.query('SELECT DISTINCT user_id FROM public.user_note_collection_items')).rows[0].user_id, OWNER);
    await c.query('SAVEPOINT s'); await rejectsCode(c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [one, NOTE(1)]), '23505'); await c.query('ROLLBACK TO s');
    await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [one, NOTE(1)]);
    await rejectsCode(c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2) ON CONFLICT (collection_id,note_id) DO UPDATE SET note_id=EXCLUDED.note_id', [one, NOTE(1)]), '42501');
  });
  // Someone else's note: no (note, owner) pair exists.
  await rejectsCode(as(OWNER, async c => { const col = await addCollection(c, 'One'); await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [col, NOTE(4)]); }), '23503');
  await rejectsCode(as(OWNER, async c => { const col = await addCollection(c, 'One'); await c.query('INSERT INTO public.user_note_collection_items(user_id,collection_id,note_id) VALUES ($1,$2,$3)', [OTHER, col, NOTE(1)]); }), '42501');
  const name = nextDb(); const setup = await freshDatabase(name, [COLLECTIONS]); await setup.end();
  const foreign = await asUser(name, OTHER, c => addCollection(c, 'Theirs'), { commit: true });
  await rejectsCode(asUser(name, OWNER, c => c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [foreign, NOTE(1)])), '23503');
});

test('collections are owner-only; anon denied; guard columns and items are protected', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [COLLECTIONS]); await setup.end();
  const collection = await asUser(name, OWNER, async c => {
    const created = await addCollection(c, 'Private');
    await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [created, NOTE(1)]);
    return created;
  }, { commit: true });
  await asUser(name, OTHER, async c => {
    assert.equal(await count(c, 'public.user_note_collections'), 0); assert.equal(await count(c, 'public.user_note_collection_items'), 0);
    assert.equal((await c.query("UPDATE public.user_note_collections SET name='Hacked' WHERE id=$1", [collection])).rowCount, 0);
    assert.equal((await c.query('DELETE FROM public.user_note_collections WHERE id=$1', [collection])).rowCount, 0);
  });
  await rejectsCode(asUser(name, null, c => c.query('SELECT * FROM public.user_note_collections'), { role: 'anon' }), '42501');
  await rejectsCode(asUser(name, null, c => c.query('SELECT * FROM public.user_note_collection_items'), { role: 'anon' }), '42501');
  await asUser(name, OWNER, async c => {
    const before = (await c.query('SELECT created_at, updated_at FROM public.user_note_collections WHERE id=$1', [collection])).rows[0];
    await sleep(20);
    await c.query("UPDATE public.user_note_collections SET name='Renamed' WHERE id=$1", [collection]);
    const after = (await c.query('SELECT name, created_at, updated_at FROM public.user_note_collections WHERE id=$1', [collection])).rows[0];
    assert.equal(after.name, 'Renamed'); assert.equal(+after.created_at, +before.created_at); assert.ok(after.updated_at > before.updated_at);
    for (const sql of ['UPDATE public.user_note_collections SET created_at=now() WHERE id=$1', 'UPDATE public.user_note_collections SET user_id=gen_random_uuid() WHERE id=$1',
      'UPDATE public.user_note_collection_items SET added_at=now() WHERE collection_id=$1', 'UPDATE public.user_note_collection_items SET note_id=note_id WHERE collection_id=$1']) {
      await c.query('SAVEPOINT g'); await rejectsCode(c.query(sql, [collection]), '42501'); await c.query('ROLLBACK TO g');
    }
  });
  await asSuper(name, async c => {
    await c.query('SAVEPOINT g'); await rejectsCode(c.query('UPDATE public.user_note_collection_items SET added_at=now()'), '23514', 'library_collection_item_immutable'); await c.query('ROLLBACK TO g');
    await rejectsCode(c.query("UPDATE public.user_note_collections SET id=gen_random_uuid()"), '23514', 'library_collection_immutable');
  });
});

test('collection cascades: note or book delete removes items only; collection delete never deletes notes', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [COLLECTIONS]); await setup.end();
  const [col] = await asUser(name, OWNER, async c => {
    const a = await addCollection(c, 'A'), b = await addCollection(c, 'B');
    for (const n of [1, 2, 3]) await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [a, NOTE(n)]);
    await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [b, NOTE(1)]);
    return [a, b];
  }, { commit: true });
  const c = await connection(name);
  await c.query('DELETE FROM public.reading_notes WHERE id=$1', [NOTE(3)]);
  assert.equal(await count(c, 'public.user_note_collection_items'), 3, 'note delete removed one item');
  await c.query('DELETE FROM public.user_books WHERE id=$1', [UB(1)]);
  assert.equal(await count(c, 'public.user_note_collection_items'), 0, 'book delete cascades notes then items');
  assert.equal(await count(c, 'public.user_note_collections'), 2, 'collections survive');
  await c.query('DELETE FROM public.user_note_collections WHERE id=$1', [col]);
  assert.equal(await count(c, 'public.reading_notes', `id IN ('${NOTE(4)}')`), 1, 'notes are never deleted by a collection delete');
  await c.query(`DELETE FROM auth.users WHERE id='${OWNER}'`);
  assert.equal(await count(c, 'public.user_note_collections'), 0);
  await c.end();
});

test('functions are not executable by anon/authenticated/PUBLIC; every function pins search_path', async () => {
  for (const fn of ['library_label_cap_guard', 'library_label_row_guard', 'library_label_link_guard', 'library_collection_cap_guard', 'library_collection_row_guard', 'library_collection_item_guard']) {
    const row = (await main.query(`SELECT has_function_privilege('anon', p.oid, 'EXECUTE') a, has_function_privilege('authenticated', p.oid, 'EXECUTE') u,
      has_function_privilege('public', p.oid, 'EXECUTE') p, p.proconfig, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1`, [fn])).rows[0];
    assert.deepEqual([row.a, row.u, row.p], [false, false, false], fn);
    assert.deepEqual(row.proconfig, ['search_path=""'], fn + ' pins search_path');
    assert.equal(row.prosecdef, fn.endsWith('_cap_guard'), fn + ' security definer only for the cap count');
  }
});

test('migration 2 fails fast (lock_timeout) and leaves nothing behind when reading_notes is locked', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, []);
  const holder = await connection(name);
  await holder.query('BEGIN'); await holder.query('LOCK TABLE public.reading_notes IN ACCESS EXCLUSIVE MODE');
  const started = Date.now();
  try {
    await setup.query('BEGIN');
    await rejectsCode(setup.query(await fs.readFile(COLLECTIONS, 'utf8')), '55P03');
    assert.ok(Date.now() - started < 15000, 'failed within the lock timeout, not queued forever');
    await setup.query('ROLLBACK');
  } finally { await holder.query('ROLLBACK'); await holder.end(); }
  assert.equal(await count(setup, 'pg_class', "relname='user_note_collections'"), 0, 'no partial tables');
  assert.equal(await count(setup, 'pg_constraint', "conname='reading_notes_id_owner_key'"), 0, 'no partial constraint');
  await setup.end();
});

// ---- Review follow-ups (Sol / Gemini Argon, 2026-10-23) ------------------------------------------
test('caps fail closed outside READ COMMITTED (a stale snapshot could exceed the cap)', async () => {
  for (const [add, code] of [[addLabel, 'library_label_isolation_unsupported'], [addCollection, 'library_collection_isolation_unsupported']]) {
    const client = await connection('org_main');
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ'); await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [OWNER]);
      await rejectsCode(add(client, 'Isolated'), '55000', code);
    } finally { await client.query('ROLLBACK').catch(() => {}); await client.end(); }
  }
});

test('service_role with an explicit user_id cannot exceed either cap; two rows in one statement count each other', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS, COLLECTIONS]); await setup.end();
  await asUser(name, OWNER, async c => {
    for (let n = 1; n <= 24; n++) { await addLabel(c, 'L' + n); await addCollection(c, 'C' + n); }
  }, { commit: true });
  await asUser(name, null, async c => {
    await rejectsCode(c.query("INSERT INTO public.user_library_labels(user_id,name) VALUES ($1,'a'),($1,'b')", [OWNER]), '23514', 'library_label_limit');
  }, { role: 'service_role' });
  await asUser(name, null, async c => {
    await rejectsCode(c.query("INSERT INTO public.user_note_collections(user_id,name) VALUES ($1,'a'),($1,'b')", [OWNER]), '23514', 'library_collection_limit');
  }, { role: 'service_role' });
  await asUser(name, null, async c => {
    await c.query("INSERT INTO public.user_library_labels(user_id,name) VALUES ($1,'only one')", [OWNER]);
    await rejectsCode(c.query("INSERT INTO public.user_library_labels(user_id,name) VALUES ($1,'over')", [OWNER]), '23514', 'library_label_limit');
  }, { role: 'service_role' });
  // Renaming at the cap is allowed (the cap trigger is INSERT-only).
  await asUser(name, OWNER, async c => {
    await c.query("UPDATE public.user_library_labels SET name='Renamed at 24' WHERE name='L1'");
    await c.query("UPDATE public.user_note_collections SET name='Renamed at 24' WHERE name='C1'");
  });
});

test('the label cap lock does not block a collection insert (separate advisory keys)', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS, COLLECTIONS]); await setup.end();
  const open = async () => {
    const client = await connection(name);
    await client.query('BEGIN'); await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [OWNER]);
    return client;
  };
  const a = await open(), b = await open();
  try {
    await addLabel(a, 'holds the label lock');
    await b.query("SET LOCAL lock_timeout = '1s'");
    await addCollection(b, 'not blocked');
  } finally { await a.query('ROLLBACK').catch(() => {}); await b.query('ROLLBACK').catch(() => {}); await a.end(); await b.end(); }
});

test('owner deletes: only own labels, collections and items; other people cannot; notes survive; collection user_id is immutable', async () => {
  const name = nextDb(); const setup = await freshDatabase(name, [LABELS, COLLECTIONS]); await setup.end();
  const [collection, label] = await asUser(name, OWNER, async c => {
    const col = await addCollection(c, 'Mine'), lab = await addLabel(c, 'Mine');
    await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [col, NOTE(1)]);
    await c.query('INSERT INTO public.user_book_labels(user_book_id,label_id) VALUES ($1,$2)', [UB(1), lab]);
    return [col, lab];
  }, { commit: true });
  await asUser(name, OTHER, async c => {
    assert.equal((await c.query('DELETE FROM public.user_note_collection_items WHERE collection_id=$1', [collection])).rowCount, 0);
    assert.equal((await c.query('DELETE FROM public.user_book_labels WHERE label_id=$1', [label])).rowCount, 0);
  });
  await asUser(name, OWNER, async c => {
    assert.equal((await c.query('DELETE FROM public.user_note_collection_items WHERE collection_id=$1', [collection])).rowCount, 1);
    assert.equal((await c.query('DELETE FROM public.user_book_labels WHERE label_id=$1', [label])).rowCount, 1);
  }, { commit: true });
  await asUser(name, OWNER, async c => {
    await c.query('INSERT INTO public.user_note_collection_items(collection_id,note_id) VALUES ($1,$2)', [collection, NOTE(2)]);
    assert.equal((await c.query('DELETE FROM public.user_note_collections WHERE id=$1', [collection])).rowCount, 1);
    assert.equal(await count(c, 'public.reading_notes', `id IN ('${NOTE(1)}','${NOTE(2)}')`), 2, 'populated collection delete keeps the notes');
    assert.equal((await c.query('DELETE FROM public.user_library_labels WHERE id=$1', [label])).rowCount, 1);
  });
  await asSuper(name, async c => {
    const col = (await c.query(`INSERT INTO public.user_note_collections(user_id,name) VALUES ('${OWNER}','Guarded') RETURNING id`)).rows[0].id;
    await rejectsCode(c.query(`UPDATE public.user_note_collections SET user_id='${OTHER}' WHERE id=$1`, [col]), '23514', 'library_collection_immutable');
  });
  await rejectsCode(asUser(name, null, c => c.query("INSERT INTO public.user_note_collections(name) VALUES ('Nobody')"), { role: 'service_role' }), '23502', 'library_collection_user_required');
});
