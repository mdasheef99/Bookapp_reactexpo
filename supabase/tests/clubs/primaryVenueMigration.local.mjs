// Disposable PostgreSQL only. No DATABASE_URL, Supabase or existing database is used.
// node .../primaryVenueMigration.local.mjs <absolute embedded-postgres package directory>
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import net from 'node:net';
const runtime = process.argv[2];
if (!runtime) throw new Error('Supply an installed embedded-postgres package directory');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(resolve(runtime), 'dist/index.js')));
const root = resolve(import.meta.dirname, '../../..');
const migration = await readFile(join(root, 'supabase/migrations/20261007144356_clubs_admin_primary_venue.sql'), 'utf8');
const helperFile = await readFile(join(root, 'supabase/migrations/20260310153000_013_clubs_entitlement_enforcement.sql'), 'utf8');
const helpers = helperFile.slice(helperFile.indexOf('CREATE OR REPLACE FUNCTION'), helperFile.indexOf('CREATE OR REPLACE FUNCTION public.enforce_book_club_entitlement'));
const dataDir = await mkdtemp(join(tmpdir(), 'bookconnect-primary-pg-'));
const listener = net.createServer();
await new Promise(r => listener.listen(0, '127.0.0.1', r));
const port = listener.address().port;
await new Promise(r => listener.close(r));
const server = new EmbeddedPostgres({ databaseDir: dataDir, port, user: 'postgres', password: 'local-only', persistent: true,
  postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
// Memoize bounded shutdown so the embedded runtime's exit hook cannot retry an
// unbounded original stop. A timeout/rejection never permits directory removal.
const bounded = async (run, milliseconds) => {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(run), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Shutdown timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
};
const execFileAsync = promisify(execFile);
const hasExited = child => child.exitCode !== null || child.signalCode !== null;
// The installed runtime uses unchecked taskkill and can miss an earlier exit.
// Replace that stop path for this disposable owned process only.
const originalStop = async () => {
  const child = server.process;
  if (!child) return;
  if (!hasExited(child)) {
    let onExit;
    const exited = new Promise(resolve => { onExit=resolve; child.once('exit',onExit); });
    try {
      if (platform()==='win32') {
        try { await execFileAsync('taskkill',['/pid',String(child.pid),'/f','/t'],{timeout:8000,windowsHide:true}); }
        catch(error) { if(!hasExited(child)) throw error; }
      } else if (!child.kill('SIGINT') && !hasExited(child)) throw new Error('Unable to signal owned PostgreSQL');
      await bounded(()=>exited,8000);
    } finally { child.removeListener('exit',onExit); }
  }
  if (!hasExited(child)) throw new Error('Owned PostgreSQL has not exited');
  server.process=undefined;
};
let stopResult;
server.stop = () => stopResult ??= bounded(originalStop, 10_000);
const portIsClosed = () => new Promise((resolve, reject) => {
  const socket = net.createConnection({host:'127.0.0.1', port});
  socket.setTimeout(1000);
  socket.once('connect', () => { socket.destroy(); resolve(false); });
  socket.once('error', error => { socket.destroy(); error.code === 'ECONNREFUSED' ? resolve(true) : reject(error); });
  socket.once('timeout', () => { socket.destroy(); reject(new Error('Port verification timed out')); });
});
const cleanup = async ({stop, verifyStopped, remove, directory, timeoutMs=10_000}) => {
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !/^bookconnect-primary-pg-[^\\/]+$/.test(basename(directory))) {
    throw new Error('Unsafe cleanup target');
  }
  try {
    await bounded(stop, timeoutMs);
    if (!await bounded(verifyStopped, timeoutMs)) throw new Error('PostgreSQL termination is unconfirmed');
  } catch (error) {
    throw new Error(`PostgreSQL shutdown unconfirmed; preserving temporary test data at ${directory}`, {cause:error});
  }
  await remove(directory);
};
const clients = [];
let checks = 0;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const club=id(1), other=id(2), admin=id(10), member=id(11), moderator=id(12), v1=id(21), v2=id(22), missing=id(23);
const makeClient = async () => { const c=server.getPgClient('primary_venue_test', '127.0.0.1'); await c.connect(); clients.push(c); return c; };
const check = async (name, run) => { await run(); checks++; console.log(`PASS ${name}`); };
const asActor = async (c, actor=admin, role='authenticated') => {
  await c.query(`SET ROLE ${role}`);
  await c.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [actor ?? '']);
};
const call = (c, venue=v2, targetClub=club) => c.query('SELECT * FROM public.set_primary_club_venue($1,$2)',[targetClub,venue]);
const rejects = async (promise, code) => assert.rejects(promise, e => e.code===code);
try {
  await server.initialise(); await server.start(); await server.createDatabase('primary_venue_test');
  const owner = await makeClient();
  console.log((await owner.query('SHOW server_version')).rows[0]);
  const canonicalPolicies = `
    DROP POLICY IF EXISTS "Club venues are viewable by members" ON public.club_venues;
    DROP POLICY IF EXISTS "Club leads can manage club venues" ON public.club_venues;
    DROP POLICY IF EXISTS "Members can view club venues" ON public.club_venues;
    DROP POLICY IF EXISTS "Admins can manage club venues" ON public.club_venues;
    ALTER TABLE public.club_venues ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Members can view club venues" ON public.club_venues FOR SELECT USING(
      EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid()));
    CREATE POLICY "Admins can manage club venues" ON public.club_venues FOR ALL USING(
      EXISTS(SELECT 1 FROM public.book_clubs WHERE book_clubs.id=club_venues.club_id AND book_clubs.admin_id=auth.uid()));
  `;
  const legacyPolicies = `
    DROP POLICY IF EXISTS "Club venues are viewable by members" ON public.club_venues;
    DROP POLICY IF EXISTS "Club leads can manage club venues" ON public.club_venues;
    DROP POLICY IF EXISTS "Members can view club venues" ON public.club_venues;
    DROP POLICY IF EXISTS "Admins can manage club venues" ON public.club_venues;
    CREATE POLICY "Club venues are viewable by members" ON public.club_venues FOR SELECT USING(
      EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid()));
    CREATE POLICY "Club leads can manage club venues" ON public.club_venues FOR ALL USING(
      EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='lead'));
  `;
  await owner.query(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon,authenticated,service_role;
    CREATE TABLE public.user_profiles(user_id uuid PRIMARY KEY, membership_tier text);
    CREATE TABLE public.book_clubs(id uuid PRIMARY KEY, admin_id uuid, access_level text DEFAULT 'all', is_archived boolean DEFAULT false);
    CREATE TABLE public.club_members(club_id uuid,user_id uuid,role text,status text);
    CREATE TABLE public.venues(id uuid PRIMARY KEY);
    CREATE TABLE public.club_venues(club_id uuid REFERENCES public.book_clubs,venue_id uuid REFERENCES public.venues,is_primary boolean DEFAULT false,PRIMARY KEY(club_id,venue_id));
    CREATE TABLE public.club_events(id uuid PRIMARY KEY,venue_id uuid REFERENCES public.venues);
    GRANT SELECT ON public.book_clubs,public.club_members,public.venues TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.club_venues TO authenticated;
    ALTER TABLE public.club_venues ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Members can view club venues" ON public.club_venues FOR SELECT USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid()));
    CREATE POLICY "Admins can manage club venues" ON public.club_venues FOR ALL USING(EXISTS(SELECT 1 FROM public.book_clubs WHERE book_clubs.id=club_venues.club_id AND book_clubs.admin_id=auth.uid()));
  `);
  await owner.query(helpers);
  await owner.query('INSERT INTO user_profiles VALUES($1,\'pro\'),($2,\'free\'),($3,\'pro\')',[admin,member,moderator]);
  await owner.query('INSERT INTO book_clubs(id,admin_id) VALUES($1,$2),($3,$4)',[club,admin,other,member]);
  await owner.query("INSERT INTO club_members VALUES($1,$2,'admin','active'),($1,$3,'member','active'),($1,$4,'moderator','active')",[club,admin,member,moderator]);
  await owner.query('INSERT INTO venues VALUES($1),($2),($3)',[v1,v2,missing]);
  await owner.query('INSERT INTO club_venues VALUES($1,$2,true),($1,$3,false)',[club,v1,v2]);
  await owner.query('INSERT INTO club_events VALUES($1,$2)',[id(30),v1]);
  await check('reject duplicate preflight and roll back migration',async()=>{
    await owner.query('UPDATE club_venues SET is_primary=true');
    await rejects(owner.query(migration),'23505'); await owner.query('ROLLBACK');
    assert.equal((await owner.query("SELECT to_regprocedure('public.set_primary_club_venue(uuid,uuid)') AS rpc")).rows[0].rpc,null);
    await owner.query('UPDATE club_venues SET is_primary=false WHERE venue_id=$1',[v2]);
  });
  await check('reject unexpected policy before changing schema',async()=>{
    await owner.query('CREATE POLICY unexpected ON club_venues FOR SELECT USING(false)');
    await rejects(owner.query(migration),'55000'); await owner.query('ROLLBACK');
    await owner.query('DROP POLICY unexpected ON club_venues');
  });
  await check('reject same-name policy with altered predicate before changing schema',async()=>{
    await owner.query('DROP POLICY "Admins can manage club venues" ON club_venues; CREATE POLICY "Admins can manage club venues" ON club_venues FOR ALL USING(true)');
    await rejects(owner.query(migration),'55000');await owner.query('ROLLBACK');
    await owner.query('DROP POLICY "Admins can manage club venues" ON club_venues; CREATE POLICY "Admins can manage club venues" ON club_venues FOR ALL USING(EXISTS(SELECT 1 FROM public.book_clubs WHERE book_clubs.id=club_venues.club_id AND book_clubs.admin_id=auth.uid()))');
  });
  await check('reject same-name policy with NULL predicate before changing schema',async()=>{
    await owner.query('DROP POLICY "Admins can manage club venues" ON club_venues; CREATE POLICY "Admins can manage club venues" ON club_venues FOR ALL');
    await rejects(owner.query(migration),'55000');await owner.query('ROLLBACK');
    await owner.query('DROP POLICY "Admins can manage club venues" ON club_venues; CREATE POLICY "Admins can manage club venues" ON club_venues FOR ALL USING(EXISTS(SELECT 1 FROM public.book_clubs WHERE book_clubs.id=club_venues.club_id AND book_clubs.admin_id=auth.uid()))');
  });
  const policyFamilyDriftCases = [
    ['missing recognized SELECT policy', async () => owner.query('DROP POLICY "Members can view club venues" ON club_venues')],
    ['missing recognized ALL policy', async () => owner.query('DROP POLICY "Admins can manage club venues" ON club_venues')],
    ['historical SELECT with current ALL policy', async () => {
      await owner.query(legacyPolicies);
      await owner.query(`DROP POLICY "Club leads can manage club venues" ON club_venues;
        CREATE POLICY "Admins can manage club venues" ON club_venues FOR ALL USING(
          EXISTS(SELECT 1 FROM public.book_clubs WHERE book_clubs.id=club_venues.club_id AND book_clubs.admin_id=auth.uid()))`);
    }],
    ['current SELECT with historical ALL policy', async () => {
      await owner.query(`DROP POLICY "Admins can manage club venues" ON club_venues;
        CREATE POLICY "Club leads can manage club venues" ON club_venues FOR ALL USING(
          EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='lead'))`);
    }],
  ];
  for (const [name, createDrift] of policyFamilyDriftCases) {
    await check(`reject ${name} before changing schema`, async () => {
      await owner.query(canonicalPolicies);
      await createDrift();
      await rejects(owner.query(migration), '55000');
      await owner.query('ROLLBACK');
      const residual = (await owner.query("SELECT to_regclass('public.club_venues_one_primary_per_club') AS idx, to_regprocedure('public.set_primary_club_venue(uuid,uuid)') AS rpc")).rows[0];
      assert.equal(residual.idx, null);
      assert.equal(residual.rpc, null);
      await owner.query(canonicalPolicies);
    });
  }
  const legacyDriftCases = [
    ['legacy ALL literal case', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues FOR ALL USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='LEAD'))`],
    ['legacy ALL literal whitespace', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues FOR ALL USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='l ead'))`],
    ['legacy SELECT predicate', `DROP POLICY "Club venues are viewable by members" ON club_venues; CREATE POLICY "Club venues are viewable by members" ON club_venues FOR SELECT USING(true)`],
    ['legacy SELECT role', `DROP POLICY "Club venues are viewable by members" ON club_venues; CREATE POLICY "Club venues are viewable by members" ON club_venues FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid()))`],
    ['legacy SELECT command', `DROP POLICY "Club venues are viewable by members" ON club_venues; CREATE POLICY "Club venues are viewable by members" ON club_venues FOR UPDATE USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid()))`],
    ['legacy ALL predicate', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues FOR ALL USING(true)`],
    ['legacy ALL role', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='lead'))`],
    ['legacy ALL command', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues FOR SELECT USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='lead'))`],
    ['legacy ALL check', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues FOR ALL USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='lead')) WITH CHECK(false)`],
    ['legacy ALL restrictive mode', `DROP POLICY "Club leads can manage club venues" ON club_venues; CREATE POLICY "Club leads can manage club venues" ON club_venues AS RESTRICTIVE FOR ALL USING(EXISTS(SELECT 1 FROM public.club_members WHERE club_members.club_id=club_venues.club_id AND club_members.user_id=auth.uid() AND club_members.role='lead'))`],
  ];
  for (const [name, driftSql] of legacyDriftCases) {
    await check(`reject ${name} drift before changing schema`, async () => {
      await owner.query(legacyPolicies);
      await owner.query(driftSql);
      await rejects(owner.query(migration), '55000');
      await owner.query('ROLLBACK');
      assert.equal((await owner.query("SELECT to_regclass('public.club_venues_one_primary_per_club') AS idx, to_regprocedure('public.set_primary_club_venue(uuid,uuid)') AS rpc")).rows[0].idx, null);
      assert.equal((await owner.query("SELECT to_regprocedure('public.set_primary_club_venue(uuid,uuid)') AS rpc")).rows[0].rpc, null);
      await owner.query(canonicalPolicies);
    });
  }
  await check('apply migration on live-shaped fixture',()=>owner.query(migration));
  const actor=await makeClient(); await asActor(actor);
  await check('invoker, empty search_path and authenticated-only execute',async()=>{
    const r=(await owner.query("SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('service_role',oid,'EXECUTE') service FROM pg_proc WHERE oid='public.set_primary_club_venue(uuid,uuid)'::regprocedure")).rows[0];
    assert.equal(r.prosecdef,false); assert.deepEqual(r.proconfig,['search_path=""']); assert.equal(r.anon,false);assert.equal(r.service,false);
    assert.equal((await owner.query("SELECT has_table_privilege('authenticated','book_clubs','UPDATE') AS yes")).rows[0].yes,false);
  });
  await check('eligible admin switches primary without club UPDATE grant',async()=>{assert.equal((await call(actor)).rows[0].venue_id,v2);});
  await check('repeated selection is safe',()=>call(actor));
  await check('admin without membership row can save through admin policy',async()=>{
    await owner.query('DELETE FROM club_members WHERE user_id=$1',[admin]);await call(actor,v1);
    await owner.query("INSERT INTO club_members VALUES($1,$2,'admin','active')",[club,admin]);
  });
  await check('membership-role admin without ownership is denied',async()=>{
    await owner.query("UPDATE club_members SET role='admin' WHERE user_id=$1",[moderator]);
    await asActor(actor,moderator);await rejects(call(actor),'42501');
    await owner.query("UPDATE club_members SET role='moderator' WHERE user_id=$1",[moderator]);await asActor(actor);
  });
  await call(actor,v2);
  for (const [name,user,role] of [['member',member,'authenticated'],['moderator',moderator,'authenticated'],['anonymous',null,'anon'],['missing JWT',null,'authenticated']]) {
    await check(`${name} denied`,async()=>{await asActor(actor,user,role);await rejects(call(actor),'42501');});
  }
  await asActor(actor);
  await check('service role has no execute permission',async()=>{await asActor(actor,admin,'service_role');await rejects(call(actor),'42501');await asActor(actor);});
  await check('wrong club and null IDs denied',async()=>{await rejects(call(actor,v2,other),'42501');await rejects(call(actor,null),'42501');});
  await check('unlinked venue denied and previous primary retained',async()=>{await rejects(call(actor,missing),'23503');assert.equal((await owner.query('SELECT venue_id FROM club_venues WHERE is_primary')).rows[0].venue_id,v2);});
  await check('ineligible admin denied',async()=>{await owner.query("UPDATE user_profiles SET membership_tier='free' WHERE user_id=$1",[admin]);await rejects(call(actor),'42501');await owner.query("UPDATE user_profiles SET membership_tier='pro' WHERE user_id=$1",[admin]);});
  await check('archived club denied',async()=>{await owner.query('UPDATE book_clubs SET is_archived=true WHERE id=$1',[club]);await rejects(call(actor),'42501');await owner.query('UPDATE book_clubs SET is_archived=false WHERE id=$1',[club]);});
  await check('direct writes cannot create second primary',()=>rejects(actor.query('UPDATE club_venues SET is_primary=true WHERE venue_id=$1',[v1]),'23505'));
  await check('failure after clearing rolls back both updates',async()=>{
    await owner.query(`CREATE FUNCTION fail_primary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.is_primary THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_primary BEFORE UPDATE ON club_venues FOR EACH ROW EXECUTE FUNCTION fail_primary()`);
    await rejects(call(actor,v1),'P0001');
    assert.equal((await owner.query('SELECT venue_id FROM club_venues WHERE is_primary')).rows[0].venue_id,v2);
    await owner.query('DROP TRIGGER fail_primary ON club_venues');
  });
  const second=await makeClient();await asActor(second);
  await check('concurrent switches serialize across independent connections',async()=>{
    await actor.query('BEGIN');await call(actor,v1);
    const pid=(await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const pending=call(second,v2); let settled=false; pending.then(()=>settled=true,()=>settled=true);
    const until=Date.now()+5000; let waiting=false;
    while(Date.now()<until){waiting=(await owner.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) yes",[pid])).rows[0].yes;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(waiting,true);assert.equal(settled,false);await actor.query('COMMIT');await pending;
    assert.equal((await owner.query('SELECT venue_id FROM club_venues WHERE is_primary')).rows[0].venue_id,v2);
  });
  await check('eligibility rechecked after waiting for another selection',async()=>{
    await actor.query('BEGIN');await call(actor,v1);
    const pid=(await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const pending=call(second,v2);const failure=rejects(pending,'42501');
    const until=Date.now()+5000;let waiting=false;
    while(Date.now()<until){waiting=(await owner.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) yes",[pid])).rows[0].yes;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(waiting,true);await owner.query("UPDATE user_profiles SET membership_tier='free' WHERE user_id=$1",[admin]);
    await actor.query('COMMIT');await failure;
    await owner.query("UPDATE user_profiles SET membership_tier='pro' WHERE user_id=$1",[admin]);await call(actor,v2);
  });
  for (const lockedVenue of [v1, v2]) {
    for (const change of ['downgrade', 'archive']) {
      await check(`${change} during ${lockedVenue===v1?'target':'previous-primary'} row wait rejects and preserves primary`,async()=>{
        const blocker=await makeClient();
        await blocker.query('BEGIN');
        let failure;
        try {
          await blocker.query('SELECT * FROM club_venues WHERE venue_id=$1 FOR UPDATE',[lockedVenue]);
          const pid=(await actor.query('SELECT pg_backend_pid() pid')).rows[0].pid;
          failure=rejects(call(actor,v1),'42501'); failure.catch(()=>{});
          const until=Date.now()+5000;let waiting=false;
          while(Date.now()<until){waiting=(await owner.query('SELECT cardinality(pg_blocking_pids($1))>0 yes',[pid])).rows[0].yes;if(waiting)break;await new Promise(r=>setTimeout(r,20));}
          assert.equal(waiting,true);
          if(change==='downgrade') await owner.query("UPDATE user_profiles SET membership_tier='free' WHERE user_id=$1",[admin]);
          else await owner.query('UPDATE book_clubs SET is_archived=true WHERE id=$1',[club]);
        } finally { await blocker.query('ROLLBACK'); }
        try { await failure; assert.equal((await owner.query('SELECT venue_id FROM club_venues WHERE is_primary')).rows[0].venue_id,v2); }
        finally {
          await owner.query("UPDATE user_profiles SET membership_tier='pro' WHERE user_id=$1",[admin]);
          await owner.query('UPDATE book_clubs SET is_archived=false WHERE id=$1',[club]);
        }
      });
    }
  }
  await check('selection does not rewrite existing event; unlink preserves venue',async()=>{
    assert.equal((await owner.query('SELECT venue_id FROM club_events')).rows[0].venue_id,v1);
    await owner.query('UPDATE club_events SET venue_id=$1 WHERE id=$2',[v2,id(30)]);
    await actor.query('DELETE FROM club_venues WHERE venue_id=$1',[v2]);
    assert.equal((await owner.query('SELECT count(*)::int n FROM club_venues WHERE is_primary')).rows[0].n,0);
    assert.deepEqual((await owner.query('SELECT id,venue_id FROM club_events')).rows,[{id:id(30),venue_id:v2}]);
    assert.equal((await owner.query('SELECT id FROM venues WHERE id=$1',[v2])).rows[0].id,v2);
  });
  await check('zero-primary club can choose first primary',()=>call(actor,v1));
  await check('historical policy/RPC replay superseded without Exchange SQL',async()=>{
    await owner.query('DROP INDEX club_venues_one_primary_per_club');
    await owner.query(legacyPolicies);
    const historical=await readFile(join(root,'supabase/migrations/20260714000001_harden_club_primary_and_exchange_city.sql'),'utf8');
    await owner.query(historical.slice(historical.indexOf('CREATE OR REPLACE FUNCTION public.set_primary_club_venue'),historical.indexOf('CREATE OR REPLACE FUNCTION public.request_transaction')));
    await owner.query(migration);await call(actor,v1);
    const policyRows=(await owner.query("SELECT polname FROM pg_policy WHERE polrelid='public.club_venues'::regclass ORDER BY polname")).rows.map(r=>r.polname);
    assert.deepEqual(policyRows,['Admins can manage club venues','Members can view club venues']);
    const r=(await owner.query("SELECT prosecdef,has_function_privilege('service_role',oid,'EXECUTE') service FROM pg_proc WHERE oid='public.set_primary_club_venue(uuid,uuid)'::regprocedure")).rows[0];assert.equal(r.prosecdef,false);assert.equal(r.service,false);
  });
  if (process.argv.includes('--verify-authorization-proposal') || process.argv.includes('--verify-authorization-migration')) {
    const document = await readFile(join(root, 'docs/user/clubs/PRIMARY-VENUE-AUTHORIZATION-PROPOSAL.md'), 'utf8');
    let proposal = document.match(/```sql\r?\n([\s\S]*?)```/)?.[1];
    assert.ok(proposal, 'Expected reviewable SQL proposal');
    if (process.argv.includes('--verify-authorization-migration')) {
      const migrationDir = join(root, 'supabase/migrations');
      const files = (await readdir(migrationDir)).filter(file => /^\d{14}_clubs_primary_venue_write_authorization\.sql$/.test(file));
      assert.equal(files.length, 1, 'Expected exactly one authorization correction migration');
      const artifact = await readFile(join(migrationDir, files[0]), 'utf8');
      assert.equal(artifact.replace(/^(?:--[^\n]*\n)+/, '').trim(), proposal.trim(), 'Migration must match reviewed proposal SQL');
      proposal = artifact;
    }
    await asActor(actor, admin);
    await check('reproduce current direct UPDATE entitlement bypass locally', async () => {
      await owner.query("UPDATE user_profiles SET membership_tier='free' WHERE user_id=$1", [admin]);
      assert.equal((await actor.query('UPDATE club_venues SET is_primary=false WHERE club_id=$1 AND venue_id=$2', [club, v1])).rowCount, 1);
      await owner.query("UPDATE user_profiles SET membership_tier='pro' WHERE user_id=$1", [admin]);
      await call(actor, v1);
    });
    await check('proposal refuses additional permissive policy before changing authorization', async () => {
      await owner.query('CREATE POLICY unreviewed_write ON club_venues FOR UPDATE USING(true)');
      await rejects(owner.query(proposal), '55000');
      await owner.query('ROLLBACK; DROP POLICY unreviewed_write ON club_venues');
    });
    await check('proposal refuses disabled row security without replacing policies', async () => {
      await owner.query('ALTER TABLE club_venues DISABLE ROW LEVEL SECURITY');
      await rejects(owner.query(proposal), '55000');
      await owner.query('ROLLBACK');
      assert.equal((await owner.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.club_venues'::regclass")).rows[0].relrowsecurity, false);
      assert.deepEqual((await owner.query("SELECT polname FROM pg_policy WHERE polrelid='public.club_venues'::regclass ORDER BY polname")).rows.map(r => r.polname), ['Admins can manage club venues', 'Members can view club venues']);
      await owner.query('ALTER TABLE club_venues ENABLE ROW LEVEL SECURITY');
    });
    await owner.query(proposal);
    for (const condition of ['downgraded', 'access mismatch', 'archived']) {
      await check(`proposal denies ${condition} direct UPDATE and primary INSERT but preserves ordinary Add/Remove`, async () => {
        if (condition === 'downgraded') await owner.query("UPDATE user_profiles SET membership_tier='free' WHERE user_id=$1", [admin]);
        if (condition === 'access mismatch') await owner.query("UPDATE book_clubs SET access_level='pro_plus' WHERE id=$1", [club]);
        if (condition === 'archived') await owner.query('UPDATE book_clubs SET is_archived=true WHERE id=$1', [club]);
        try {
          assert.equal((await actor.query('UPDATE club_venues SET is_primary=false WHERE club_id=$1 AND venue_id=$2', [club, v1])).rowCount, 0);
          await rejects(actor.query('INSERT INTO club_venues VALUES($1,$2,true)', [club, missing]), '42501');
          assert.equal((await actor.query('INSERT INTO club_venues VALUES($1,$2,false) RETURNING *', [club, missing])).rowCount, 1);
          assert.equal((await actor.query('DELETE FROM club_venues WHERE club_id=$1 AND venue_id=$2', [club, missing])).rowCount, 1);
          assert.equal((await owner.query('SELECT is_primary FROM club_venues WHERE club_id=$1 AND venue_id=$2', [club, v1])).rows[0].is_primary, true);
        } finally {
          await owner.query("UPDATE user_profiles SET membership_tier='pro' WHERE user_id=$1", [admin]);
          await owner.query("UPDATE book_clubs SET access_level='all',is_archived=false WHERE id=$1", [club]);
        }
      });
    }
    await check('proposal preserves owner reads and RPC without a membership row', async () => {
      await owner.query('DELETE FROM club_members WHERE club_id=$1 AND user_id=$2', [club, admin]);
      try {
        assert.equal((await actor.query('SELECT * FROM club_venues WHERE club_id=$1', [club])).rowCount, 1);
        await call(actor, v1);
      } finally { await owner.query("INSERT INTO club_members VALUES($1,$2,'admin','active')", [club, admin]); }
    });
    await check('proposal preserves eligible direct updates and RPC switching with unique enforcement', async () => {
      await actor.query('UPDATE club_venues SET is_primary=false WHERE club_id=$1', [club]);
      await actor.query('INSERT INTO club_venues VALUES($1,$2,true)', [club, missing]);
      await call(actor, v1);
      await rejects(actor.query('UPDATE club_venues SET is_primary=true WHERE club_id=$1 AND venue_id=$2', [club, missing]), '23505');
      await actor.query('DELETE FROM club_venues WHERE club_id=$1 AND venue_id=$2', [club, missing]);
    });
    await check('proposal WITH CHECK prevents reassigning a link to another owner', async () => {
      await rejects(actor.query('UPDATE club_venues SET club_id=$1 WHERE club_id=$2 AND venue_id=$3', [other, club, v1]), '42501');
    });
    for (const identity of [member, moderator]) {
      await check(`proposal denies non-owner ${identity===member?'member':'moderator'} writes`, async () => {
        await asActor(actor, identity);
        assert.equal((await actor.query('UPDATE club_venues SET is_primary=false WHERE club_id=$1', [club])).rowCount, 0);
        await rejects(actor.query('INSERT INTO club_venues VALUES($1,$2,true)', [club, missing]), '42501');
      });
    }
    await asActor(actor, admin);
    await check('proposal preserves existing event venue after primary-link removal', async () => {
      await actor.query('DELETE FROM club_venues WHERE club_id=$1 AND venue_id=$2', [club, v1]);
      assert.deepEqual((await owner.query('SELECT id,venue_id FROM club_events')).rows, [{id:id(30),venue_id:v2}]);
    });
  }
  for (const [name, stop, verifyStopped] of [
    ['rejected stop',async()=>{throw new Error('injected stop failure');},async()=>true],
    ['pending stop',()=>new Promise(()=>{}),async()=>true],
    ['unconfirmed termination',async()=>{},async()=>false],
  ]) {
    await check(`cleanup preserves data on ${name}`,async()=>{
      let removed=false;
      await assert.rejects(cleanup({stop,verifyStopped,remove:async()=>{removed=true;},directory:dataDir,timeoutMs:20}),error=>error.message.includes(dataDir));
      assert.equal(removed,false); await access(dataDir);
    });
  }
  await check('cleanup rejects targets outside generated temp directories',async()=>{
    let touched=false;
    await assert.rejects(cleanup({stop:async()=>{touched=true;},verifyStopped:async()=>true,remove:async()=>{touched=true;},directory:root}),/Unsafe cleanup target/);
    assert.equal(touched,false);
  });
  await check('cleanup removes only after verified stop' ,async()=>{
    const calls=[];
    await cleanup({stop:async()=>calls.push('stop'),verifyStopped:async()=>{calls.push('verify');return true;},remove:async directory=>{assert.equal(directory,dataDir);calls.push('remove');},directory:dataDir});
    assert.deepEqual(calls,['stop','verify','remove']);
  });
  console.log(`${checks}/${checks} checks passed. Local fixture only; not a full Supabase migration replay.`);
} finally {
  await bounded(() => Promise.allSettled(clients.map(c=>c.end())), 10_000);
  const postgresProcess = server.process;
  await cleanup({
    stop:server.stop,
    verifyStopped:async()=>{
      // The inspected embedded runtime exposes its owned ChildProcess. Check
      // exit status as well as the endpoint before deleting the generated data.
      const exited=!postgresProcess || postgresProcess.exitCode!==null || postgresProcess.signalCode!==null;
      return exited && await portIsClosed();
    },
    remove:directory=>rm(directory,{recursive:true,force:true}),
    directory:dataDir,
  });
  console.log('CLEANUP_PASS: owned PostgreSQL exited, port closed, temporary directory removed');
}
