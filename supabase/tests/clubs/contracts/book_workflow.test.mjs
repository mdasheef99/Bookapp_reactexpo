#!/usr/bin/env node
/**
 * CLUB-WU-TC04 · contract/book_workflow.test.mjs
 *
 * BOOK-WORKFLOW WRITE-BOUNDARY + CONCURRENCY CONTRACT
 * (migration-boundary RED→GREEN design) against a disposable local
 * PostgreSQL 17 booted by clubsL4Runner.mjs.
 *
 * Subsystem under test:
 *   public.nominate_club_book (concurrency recovery)
 *   public.cast_club_book_vote / remove_club_book_vote (RPC-only votes)
 *   public.book_nominations / book_votes INSERT boundaries
 *   public.book_clubs.current_book_id column boundary
 *   public.finalize_club_book_nomination /
 *   public.set_club_current_book_from_nomination (legitimate writers)
 * (pre-fix chain + WU-TC04 forward fix migration).
 *
 * Confirmed defects (context-gate proven, reproduced here PRE-FIX):
 *   BWF-04 concurrent duplicate nomination → 23505
 *   BWF-01 direct vote INSERT bypass (selected/closed)
 *   BWF-02 direct nomination INSERT bypass (status='selected')
 *   BWF-03 direct book_clubs.current_book_id UPDATE bypass
 *
 * PHASES (chosen by CLUBS_L4_TC04_PHASE; runner sequences both on ONE DB):
 *   red   — PRE-FIX proofs with genuine races + real authenticated RLS:
 *           R1 concurrent nominate → 1× success + 1× 23505, 1 active, vote 0
 *           R2 RPC rejects selected/closed, direct vote INSERT succeeds
 *           R3 direct nomination INSERT status='selected' succeeds
 *           R4 direct current_book_id UPDATE succeeds
 *   green — POST-FIX proofs on SAME DB after forward migration:
 *           G1 normal concurrent duplicate (both succeed, same id, 1 active,
 *              vote 0, 1 notification, first-writer preserved)
 *           G1B disappearance edge (concurrent nominate + SELECTED
 *              transition → no 23505/NULL/dup, coherent legal ordering)
 *           G2 vote boundary (legit + idempotent, direct denied ×3,
 *              no row, count unchanged, remove-own preserved)
 *           G3 nomination boundary (RPC ok, sequential dup same,
 *              direct active/selected denied)
 *           G4 current_book boundary (both selection RPCs work, direct
 *              denied, pointer unchanged)
 *           G4B column-compat (ordinary admin updates succeed, mixed
 *              payload fails atomically)
 *           G0 function/ACL preservation + table/column ACL state
 *
 * Fixture authority: actors/clubs follow actors.mjs house style
 * (create_club RPC via actAs, ensureClubMember direct). Live-parity
 * table grants (GRANT … TO anon/authenticated/service_role on
 * book_clubs/nominations/votes/books) are applied once in RED setup to
 * mirror live Supabase defaults so PRE-FIX bypasses reproduce; the
 * forward migration revokes them (GREEN proves denial). Books are
 * superuser inserts. All ids deterministic per phase (RED b4*, GREEN
 * c4*) so RED rows never contaminate GREEN fixtures on the shared DB.
 *
 * Concurrency is deterministic transaction orchestration (B02 precedent):
 * A holds BEGIN + nominate uncommitted; B starts while A is open
 * (proved via bSettled==false polling) then A COMMITs. PRE-FIX B gets
 * 23505; POST-FIX B recovers via ON CONFLICT DO NOTHING + loop.
 *
 * Exit codes: 0 pass · 1 contract failure · infra failures throw (→2).
 */
import { Client } from 'pg';
import { actAs, actAsRole, resetRole, ensureActor, ensureClubMember } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;
const PHASE = process.env.CLUBS_L4_TC04_PHASE;

/** Locality guard: loopback disposable clubs_l4_* only. */
function assertLocality(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('CLUBS_L4_DATABASE_URL is not a valid URL');
  }
  const hostOk = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  const dbOk = parsed.pathname.startsWith('/clubs_l4_');
  if (!hostOk || !dbOk) {
    throw new Error(
      `Locality guard violated: expected loopback + clubs_l4_*, got ${parsed.hostname}${parsed.pathname}`,
    );
  }
}

if (PHASE !== 'red' && PHASE !== 'green') {
  throw new Error(`CLUBS_L4_TC04_PHASE must be 'red' or 'green', got '${PHASE ?? ''}'`);
}

const failures = [];
const evidence = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  return cond;
};

// ---------------------------------------------------------------------------
// Deterministic fixture identity (RED b4*, GREEN c4* — disjoint)
// ---------------------------------------------------------------------------
// RED actors
const RA = 'b4000000-0000-4000-8000-000000000001';
const RB = 'b4000000-0000-4000-8000-000000000002';
const RC = 'b4000000-0000-4000-8000-000000000003';
// GREEN actors
const GA = 'c4000000-0000-4000-8000-000000000001';
const GB = 'c4000000-0000-4000-8000-000000000002';
const GC = 'c4000000-0000-4000-8000-000000000003';
const GD = 'c4000000-0000-4000-8000-000000000004';

async function ensureFixedActor(client, userId, tier = 'pro') {
  await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  await client.query(
    `INSERT INTO user_profiles (user_id, display_name, city, email, membership_tier)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING`,
    [userId, `TC04 Actor ${userId.slice(-4)}`, 'Testville', `${userId}@clubs-l4.invalid`, tier],
  );
}

async function createNamedClub(client, adminId, name) {
  const res = await client.query(
    `SELECT (public.create_club($1::text, $2::text, NULL::text, 'public'::text, 'all'::text,
       NULL::text, $3::uuid, NULL::uuid, NULL::int, NULL::uuid)).id AS club_id`,
    [name, 'TC04 contract fixture club', adminId],
  );
  return res.rows[0].club_id;
}

async function createBook(client, googleId, title) {
  const res = await client.query(
    `INSERT INTO public.books (google_books_id, title, authors)
     VALUES ($1, $2, ARRAY['TC04 Author']) RETURNING id`,
    [googleId, title],
  );
  return res.rows[0].id;
}

async function clubIdByName(client, name) {
  const res = await client.query(`SELECT id FROM book_clubs WHERE name = $1 ORDER BY created_at LIMIT 1`, [name]);
  if (res.rows.length !== 1) throw new Error(`fixture lookup failed: club '${name}'`);
  return res.rows[0].id;
}

async function activeNominations(client, clubId, bookId) {
  const res = await client.query(
    `SELECT id, nominated_by, voting_ends_at, vote_count, status
       FROM public.book_nominations
      WHERE club_id = $1 AND book_id = $2 AND status = 'active'`,
    [clubId, bookId],
  );
  return res.rows;
}

async function nominationEvents(client, clubId) {
  const res = await client.query(
    `SELECT id FROM public.notification_events
      WHERE event_type = 'club.book_nominated'
        AND (payload->>'club_id') = $1`,
    [clubId],
  );
  return res.rows;
}

/** Live-parity substrate: mirror live Supabase table grants so PRE-FIX bypasses reproduce.
 *  RLS policy evaluation as authenticated references club_members/user_profiles,
 *  so those need SELECT (live Supabase grants them); without it, direct-write
 *  attempts fail with 42501 on club_members instead of exercising the targeted
 *  book-workflow policies. */
async function ensureLiveParityGrants(client) {
  await client.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE
       ON public.book_clubs, public.book_nominations, public.book_votes, public.books,
          public.club_members, public.user_profiles
       TO anon, authenticated, service_role`,
  );
}

/** Direct authenticated INSERT attempt (real RLS + privileges). Returns {ok, err}. */
async function tryDirectAsAuthenticated(client, userId, sql, params) {
  await actAsRole(client, 'authenticated', userId);
  let ok = false;
  let err = null;
  try {
    await client.query(sql, params);
    ok = true;
  } catch (e) {
    err = e;
  } finally {
    try {
      await client.query('ROLLBACK');
    } catch {}
    await resetRole(client);
  }
  return { ok, err };
}

// ---------------------------------------------------------------------------
// RED phase
// ---------------------------------------------------------------------------
async function redPhase(observer) {
  await ensureLiveParityGrants(observer);
  for (const u of [RA, RB, RC]) await ensureFixedActor(observer, u, 'pro');

  // ---------- RED-1 concurrent nomination (genuine race) ----------
  await actAs(observer, RA);
  const clubR1 = await createNamedClub(observer, RA, 'TC04 RED-1 race club');
  await ensureClubMember(observer, clubR1, RB, 'member', 'active');
  await ensureClubMember(observer, clubR1, RC, 'member', 'active');
  const bookR1 = await createBook(observer, 'tc04-red1-gbooks', 'TC04 RED-1 Book');
  {
    const pre = await activeNominations(observer, clubR1, bookR1);
    check(pre.length === 0, `RED-1 precondition: expected 0 active, got ${pre.length}`);
  }

  const connA = new Client({ connectionString: DATABASE_URL });
  const connB = new Client({ connectionString: DATABASE_URL });
  await Promise.all([connA.connect(), connB.connect()]);
  let resA = null;
  let errB = null;
  let resB = null;
  try {
    await connA.query('BEGIN');
    await actAs(connA, RB);
    resA = (await connA.query(`SELECT * FROM public.nominate_club_book($1::uuid, $2::uuid)`, [clubR1, bookR1])).rows[0];

    await connB.query('BEGIN');
    await actAs(connB, RC);
    let bSettled = false;
    const pB = connB
      .query(`SELECT * FROM public.nominate_club_book($1::uuid, $2::uuid)`, [clubR1, bookR1])
      .then(
        (r) => {
          bSettled = true;
          resB = r.rows[0];
        },
        (e) => {
          bSettled = true;
          errB = e;
        },
      );
    // Prove genuine race: B in-flight while A still uncommitted.
    await new Promise((r) => setTimeout(r, 800));
    check(bSettled === false, 'RED-1: B settled before A COMMIT (not a genuine race)');
    if (!bSettled) evidence.push('RED-1 race: B in-flight while A uncommitted (genuine concurrent window)');
    await connA.query('COMMIT');
    await pB;
    await connB.query('ROLLBACK').catch(() => {});
  } finally {
    await Promise.allSettled([connA.end(), connB.end()]);
  }

  check(resA?.id, 'RED-1: A did not return a nomination');
  check(resB === null || resB === undefined, 'RED-1: B unexpectedly succeeded PRE-FIX');
  check(errB !== null, 'RED-1: B expected 23505 but got no error');
  if (errB) {
    check(errB.code === '23505', `RED-1: expected SQLSTATE 23505, got '${errB.code}' (${errB.message})`);
    check(
      /book_nominations_club_id_book_id_status_key/.test(errB.message),
      `RED-1: expected constraint book_nominations_club_id_book_id_status_key, got '${errB.message}'`,
    );
    evidence.push(`RED-1: A success + B 23505 ${errB.message.split('\n')[0]}`);
  }
  {
    const rows = await activeNominations(observer, clubR1, bookR1);
    check(rows.length === 1, `RED-1: expected exactly 1 active, got ${rows.length}`);
    if (rows.length === 1) {
      check(rows[0].vote_count === 0, `RED-1: vote_count expected 0, got ${rows[0].vote_count}`);
      evidence.push(`RED-1 readback: 1 active (${rows[0].id}), vote_count=0, no duplicate`);
    }
  }

  // ---------- RED-2 vote RLS bypass (selected + closed) ----------
  await actAs(observer, RA);
  const clubR2 = await createNamedClub(observer, RA, 'TC04 RED-2 vote club');
  await ensureClubMember(observer, clubR2, RB, 'member', 'active');
  const bookR2a = await createBook(observer, 'tc04-red2a-gbooks', 'TC04 RED-2A Book');
  const bookR2b = await createBook(observer, 'tc04-red2b-gbooks', 'TC04 RED-2B Book');

  // Selected nomination
  await actAs(observer, RB);
  const nomSel = (
    await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid, $2::uuid)`, [clubR2, bookR2a])
  ).rows[0];
  await actAs(observer, RA);
  await observer.query(`SELECT * FROM public.set_club_current_book_from_nomination($1::uuid)`, [nomSel.id]);
  // RPC must reject selected
  await actAs(observer, RB);
  let rpcSelErr = null;
  try {
    await observer.query(`SELECT * FROM public.cast_club_book_vote($1::uuid)`, [nomSel.id]);
  } catch (e) {
    rpcSelErr = e;
  }
  check(rpcSelErr !== null, 'RED-2: vote RPC on selected unexpectedly succeeded');
  if (rpcSelErr) check(rpcSelErr.message === 'Only active nominations can be voted on', `RED-2: wrong RPC msg '${rpcSelErr.message}'`);
  // Direct INSERT succeeds PRE-FIX
  const dirSel = await tryDirectAsAuthenticated(
    observer,
    RB,
    `INSERT INTO public.book_votes (nomination_id, user_id) VALUES ($1, $2)`,
    [nomSel.id, RB],
  );
  check(dirSel.ok === true, `RED-2: direct vote INSERT on selected failed PRE-FIX (${dirSel.err?.code} ${dirSel.err?.message})`);
  {
    const v = await observer.query(`SELECT nomination_id, user_id FROM public.book_votes WHERE nomination_id=$1 AND user_id=$2`, [nomSel.id, RB]);
    check(v.rows.length === 1, 'RED-2: bypass vote row missing on selected');
    const n = await observer.query(`SELECT vote_count FROM public.book_nominations WHERE id=$1`, [nomSel.id]);
    check(n.rows[0]?.vote_count === 1, `RED-2: vote_count expected 1, got ${n.rows[0]?.vote_count}`);
    evidence.push('RED-2 selected: RPC rejected, direct INSERT succeeded, vote_count=1');
  }

  // Closed-window nomination
  await actAs(observer, RB);
  const nomClosed = (
    await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid, $2::uuid, NULL, NULL, NULL, NULL, now() - interval '1 hour')`, [clubR2, bookR2b])
  ).rows[0];
  let rpcClosedErr = null;
  try {
    await observer.query(`SELECT * FROM public.cast_club_book_vote($1::uuid)`, [nomClosed.id]);
  } catch (e) {
    rpcClosedErr = e;
  }
  check(rpcClosedErr !== null, 'RED-2: vote RPC on closed unexpectedly succeeded');
  if (rpcClosedErr) check(rpcClosedErr.message === 'Voting has already closed for this nomination', `RED-2: wrong closed msg '${rpcClosedErr.message}'`);
  const dirClosed = await tryDirectAsAuthenticated(
    observer,
    RB,
    `INSERT INTO public.book_votes (nomination_id, user_id) VALUES ($1, $2)`,
    [nomClosed.id, RB],
  );
  check(dirClosed.ok === true, `RED-2: direct vote INSERT on closed failed PRE-FIX (${dirClosed.err?.message})`);
  {
    const v = await observer.query(`SELECT 1 FROM public.book_votes WHERE nomination_id=$1 AND user_id=$2`, [nomClosed.id, RB]);
    check(v.rows.length === 1, 'RED-2: bypass vote row missing on closed');
    evidence.push('RED-2 closed: RPC rejected, direct INSERT succeeded');
  }

  // ---------- RED-3 nomination RLS bypass (status=selected) ----------
  await actAs(observer, RA);
  const clubR3 = await createNamedClub(observer, RA, 'TC04 RED-3 nomination club');
  await ensureClubMember(observer, clubR3, RB, 'member', 'active');
  const bookR3 = await createBook(observer, 'tc04-red3-gbooks', 'TC04 RED-3 Book');
  const dirNom = await tryDirectAsAuthenticated(
    observer,
    RB,
    `INSERT INTO public.book_nominations (club_id, book_id, nominated_by, status) VALUES ($1,$2,$3,'selected') RETURNING id, status`,
    [clubR3, bookR3, RB],
  );
  check(dirNom.ok === true, `RED-3: direct selected-nomination INSERT failed PRE-FIX (${dirNom.err?.message})`);
  {
    const r = await observer.query(`SELECT status FROM public.book_nominations WHERE club_id=$1 AND book_id=$2`, [clubR3, bookR3]);
    check(r.rows.some((x) => x.status === 'selected'), 'RED-3: selected row missing');
    const c = await observer.query(`SELECT current_book_id FROM public.book_clubs WHERE id=$1`, [clubR3]);
    check(c.rows[0]?.current_book_id === null, `RED-3: current_book_id moved (${c.rows[0]?.current_book_id})`);
    evidence.push('RED-3: direct status=selected INSERT succeeded, current_book_id unchanged');
  }

  // ---------- RED-4 current_book_id bypass ----------
  await actAs(observer, RA);
  const clubR4 = await createNamedClub(observer, RA, 'TC04 RED-4 current-book club');
  await ensureClubMember(observer, clubR4, RB, 'member', 'active');
  const bookR4 = await createBook(observer, 'tc04-red4-gbooks', 'TC04 RED-4 Book');
  const dirUpd = await tryDirectAsAuthenticated(
    observer,
    RA,
    `UPDATE public.book_clubs SET current_book_id = $2 WHERE id = $1`,
    [clubR4, bookR4],
  );
  check(dirUpd.ok === true, `RED-4: direct current_book_id UPDATE failed PRE-FIX (${dirUpd.err?.message})`);
  {
    const c = await observer.query(`SELECT current_book_id FROM public.book_clubs WHERE id=$1`, [clubR4]);
    check(String(c.rows[0]?.current_book_id) === String(bookR4), 'RED-4: pointer did not change');
    const s = await observer.query(`SELECT 1 FROM public.book_nominations WHERE club_id=$1 AND book_id=$2 AND status='selected'`, [clubR4, bookR4]);
    check(s.rows.length === 0, 'RED-4: unexpected selected nomination for bypass book');
    evidence.push('RED-4: direct current_book_id UPDATE succeeded, no selected nomination');
  }
}

// ---------------------------------------------------------------------------
// GREEN phase
// ---------------------------------------------------------------------------
async function greenPhase(observer, failConn) {
  // GA owns 6+ GREEN clubs on the shared RED→GREEN DB; pro_plus (cap 15)
  // avoids the B02 entitlement cap tripping the workflow contract.
  await ensureFixedActor(observer, GA, 'pro_plus');
  for (const u of [GB, GC, GD]) await ensureFixedActor(observer, u, 'pro');

  // ---------- G0 function/ACL preservation ----------
  {
    const sessionUser = (await observer.query('SELECT current_user AS u')).rows[0].u;
    const fn = (
      await observer.query(
        `SELECT proname, provolatile, prosecdef, proconfig,
                pg_get_userbyid(proowner) AS owner,
                pg_get_function_identity_arguments(oid) AS args,
                pg_get_function_result(oid) AS result_type
           FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='nominate_club_book'`,
      )
    ).rows[0];
    check(!!fn, 'G0: nominate_club_book missing');
    if (fn) {
      // pg_get_function_identity_arguments excludes DEFAULTs by definition;
      // defaults are proven preserved by successful defaulted calls (GREEN-1/3 use 2-arg form).
      check(fn.args === 'p_club_id uuid, p_book_id uuid, p_google_books_id text, p_title text, p_authors text[], p_cover_url text, p_voting_ends_at timestamp with time zone', `G0: identity args changed: '${fn.args}'`);
      const defRow = (await observer.query(`SELECT pg_get_function_arguments(oid) AS fullargs FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='nominate_club_book'`)).rows[0];
      check(/DEFAULT NULL/.test(defRow?.fullargs ?? ''), `G0: defaults changed: '${defRow?.fullargs}'`);
      check(fn.result_type === 'book_nominations', `G0: return type changed: '${fn.result_type}'`);
      check(fn.prosecdef === true, 'G0: not SECURITY DEFINER');
      check(fn.provolatile === 'v', `G0: volatility changed: '${fn.provolatile}'`);
      check(Array.isArray(fn.proconfig) && fn.proconfig.length === 1 && fn.proconfig[0] === 'search_path=public', `G0: search_path changed: ${JSON.stringify(fn.proconfig)}`);
      check(fn.owner === sessionUser, `G0: owner changed: '${fn.owner}' vs '${sessionUser}'`);
      const lang = (await observer.query(`SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.proname='nominate_club_book' AND p.pronamespace='public'::regnamespace`)).rows[0]?.lanname;
      check(lang === 'plpgsql', `G0: language changed: '${lang}'`);
    }
    const exec = async (role, fnSig, expect) => {
      const r = await observer.query(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS can`, [role, fnSig]);
      check(r.rows[0].can === expect, `G0: ${role} EXECUTE on ${fnSig} expected ${expect}, got ${r.rows[0].can}`);
    };
    const NOM = 'public.nominate_club_book(uuid, uuid, text, text, text[], text, timestamptz)';
    await exec('authenticated', NOM, true);
    await exec('service_role', NOM, true);
    await exec('anon', NOM, false);
    const aclRow = (await observer.query(`SELECT proacl FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='nominate_club_book'`)).rows[0];
    const aclStr = String(aclRow?.proacl ?? '');
    // PUBLIC entry in proacl is '=X/<owner>' (empty grantee); authenticated/service_role contain 'authenticated=X/', 'service_role=X/' and must not trip the check.
    check(/(^|[,{])=X\//.test(aclStr) === false, `G0: PUBLIC EXECUTE present in ACL '${aclStr}'`);
    // Table INSERT ACLs
    const ins = async (role, tbl, expect) => {
      const r = await observer.query(`SELECT has_table_privilege($1, $2, 'INSERT') AS can`, [role, tbl]);
      check(r.rows[0].can === expect, `G0: ${role} INSERT on ${tbl} expected ${expect}, got ${r.rows[0].can}`);
    };
    await ins('authenticated', 'public.book_votes', false);
    await ins('authenticated', 'public.book_nominations', false);
    await ins('service_role', 'public.book_votes', true);
    await ins('service_role', 'public.book_nominations', true);
    const selA = await observer.query(`SELECT has_table_privilege('authenticated','public.book_votes','SELECT') AS c`);
    check(selA.rows[0].c === true, 'G0: authenticated SELECT on book_votes lost');
    const delA = await observer.query(`SELECT has_table_privilege('authenticated','public.book_votes','DELETE') AS c`);
    check(delA.rows[0].c === true, 'G0: authenticated DELETE on book_votes lost');
    const selN = await observer.query(`SELECT has_table_privilege('authenticated','public.book_nominations','SELECT') AS c`);
    check(selN.rows[0].c === true, 'G0: authenticated SELECT on book_nominations lost');
    // Column UPDATE ACLs
    const colUpd = async (role, col, expect) => {
      const r = await observer.query(`SELECT has_column_privilege($1, $2, $3, 'UPDATE') AS can`, [role, 'public.book_clubs', col]);
      check(r.rows[0].can === expect, `G0: ${role} UPDATE(${col}) expected ${expect}, got ${r.rows[0].can}`);
    };
    await colUpd('authenticated', 'current_book_id', false);
    await colUpd('authenticated', 'description', true);
    await colUpd('authenticated', 'name', true);
    const tblUpd = await observer.query(`SELECT has_table_privilege('authenticated','public.book_clubs','UPDATE') AS c`);
    // Table-wide UPDATE must NOT be granted (column path only); has_table_privilege returns true if ANY column grant exists,
    // so assert the critical denial at column level (above) + mixed-payload atomicity in G4B instead of over-asserting here.
    evidence.push(`G0 ACL: nominate preserved (owner ${sessionUser}), votes/nominations INSERT revoked for authenticated, column current_book_id denied (table-wide UPDATE flag=${tblUpd.rows[0].c})`);
    // Policy state
    const pol = await observer.query(
      `SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('book_votes','book_nominations') ORDER BY 1,2`,
    );
    const names = pol.rows.map((r) => `${r.tablename}:${r.policyname}:${r.cmd}`);
    check(!names.some((n) => n.includes('Members can vote')), 'G0: vote INSERT policy still present');
    check(!names.some((n) => n.includes('Members can nominate books')), 'G0: nomination INSERT policy still present');
    check(names.some((n) => n.includes('Members can view votes')), 'G0: vote SELECT policy missing');
    check(names.some((n) => n.includes('Members can delete their vote')), 'G0: vote DELETE policy missing');
    check(names.some((n) => n.includes('Members can view nominations')), 'G0: nomination SELECT policy missing');
    const adminPol = await observer.query(`SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND tablename='book_clubs' AND policyname='Admins can update their clubs'`);
    check(adminPol.rows[0].n === 1, 'G0: Admins-can-update policy missing/changed');
    // Exact column ACL dump for report
    const cols = await observer.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='book_clubs' ORDER BY ordinal_position`,
    );
    evidence.push(`G0 book_clubs columns: ${cols.rows.map((r) => r.column_name).join(',')}`);
  }

  // ---------- GREEN-1 normal concurrent duplicate ----------
  await actAs(observer, GA);
  const clubG1 = await createNamedClub(observer, GA, 'TC04 GREEN-1 race club');
  await ensureClubMember(observer, clubG1, GB, 'member', 'active');
  await ensureClubMember(observer, clubG1, GC, 'member', 'active');
  const bookG1 = await createBook(observer, 'tc04-green1-gbooks', 'TC04 GREEN-1 Book');
  const endsA = new Date(Date.now() + 7 * 86400_000).toISOString();
  const endsB = new Date(Date.now() + 14 * 86400_000).toISOString();
  let g1A = null;
  let g1B = null;
  let g1Err = null;
  {
    const cA = new Client({ connectionString: DATABASE_URL });
    const cB = new Client({ connectionString: DATABASE_URL });
    await Promise.all([cA.connect(), cB.connect()]);
    try {
      await cA.query('BEGIN');
      await actAs(cA, GB);
      const pA = cA.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid,NULL,NULL,NULL,NULL,$3::timestamptz)`, [clubG1, bookG1, endsA]);
      // Small delay so A is in-flight first (winner), then B starts while A open.
      await new Promise((r) => setTimeout(r, 150));
      await cB.query('BEGIN');
      await actAs(cB, GC);
      let bSettled = false;
      const pB = cB
        .query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid,NULL,NULL,NULL,NULL,$3::timestamptz)`, [clubG1, bookG1, endsB])
        .then(
          (r) => {
            bSettled = true;
            return r;
          },
          (e) => {
            bSettled = true;
            throw e;
          },
        );
      await new Promise((r) => setTimeout(r, 600));
      // B should still be in-flight (blocked on A's uncommitted unique) for a genuine race;
      // if timing slipped to sequential, still valid but note it.
      if (!bSettled) evidence.push('GREEN-1 race: B in-flight while A uncommitted (genuine concurrent window)');
      else evidence.push('GREEN-1 note: B settled before A COMMIT (sequential duplicate path — still asserts same-id/no-23505)');
      const rA = (await pA).rows[0];
      await cA.query('COMMIT');
      const rB = (await pB).rows[0];
      g1A = rA;
      g1B = rB;
    } catch (e) {
      g1Err = e;
      try {
        await cA.query('ROLLBACK');
      } catch {}
      try {
        await cB.query('ROLLBACK');
      } catch {}
    } finally {
      await Promise.allSettled([cA.end(), cB.end()]);
    }
  }
  check(g1Err === null, `GREEN-1: unexpected error ${g1Err?.code} ${g1Err?.message}`);
  if (!g1Err) {
    check(g1A?.id && g1B?.id, 'GREEN-1: NULL return');
    check(String(g1A?.id) === String(g1B?.id), `GREEN-1: ids differ ${g1A?.id} vs ${g1B?.id}`);
    const rows = await activeNominations(observer, clubG1, bookG1);
    check(rows.length === 1, `GREEN-1: expected 1 active, got ${rows.length}`);
    if (rows.length === 1) {
      check(rows[0].vote_count === 0, `GREEN-1: vote_count ${rows[0].vote_count}`);
      check(String(rows[0].nominated_by) === String(GB), `GREEN-1: first-writer nominated_by ${rows[0].nominated_by} expected ${GB}`);
      const dbEnds = new Date(rows[0].voting_ends_at).getTime();
      check(Math.abs(dbEnds - new Date(endsA).getTime()) < 5000, 'GREEN-1: voting_ends_at overwritten by loser');
    }
    const evts = await nominationEvents(observer, clubG1);
    check(evts.length === 1, `GREEN-1: expected exactly 1 nomination notification, got ${evts.length}`);
    evidence.push(`GREEN-1: both succeed same id=${g1A?.id}, 1 active, vote 0, 1 notification, first-writer preserved`);
  }

  // ---------- GREEN-1B disappearance edge (concurrent + SELECTED transition) ----------
  await actAs(observer, GA);
  const clubG1B = await createNamedClub(observer, GA, 'TC04 GREEN-1B edge club');
  await ensureClubMember(observer, clubG1B, GB, 'member', 'active');
  await ensureClubMember(observer, clubG1B, GC, 'member', 'active');
  const bookG1B = await createBook(observer, 'tc04-green1b-gbooks', 'TC04 GREEN-1B Book');
  {
    const cA = new Client({ connectionString: DATABASE_URL });
    const cB = new Client({ connectionString: DATABASE_URL });
    await Promise.all([cA.connect(), cB.connect()]);
    let rA = null;
    let rB = null;
    let edgeErr = null;
    try {
      await cA.query('BEGIN');
      await actAs(cA, GB);
      const pA = cA.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubG1B, bookG1B]);
      await new Promise((r) => setTimeout(r, 150));
      await cB.query('BEGIN');
      await actAs(cB, GC);
      const pB = cB.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubG1B, bookG1B]).then((r) => r.rows[0]);
      await new Promise((r) => setTimeout(r, 400));
      rA = (await pA).rows[0];
      await cA.query('COMMIT');
      // Valid transition that can move ACTIVE→SELECTED while B recovers.
      await actAs(observer, GA);
      await observer.query(`SELECT * FROM public.set_club_current_book_from_nomination($1::uuid)`, [rA.id]);
      rB = await pB;
      await cB.query('COMMIT').catch(() => {});
    } catch (e) {
      edgeErr = e;
      try {
        await cA.query('ROLLBACK');
      } catch {}
      try {
        await cB.query('ROLLBACK');
      } catch {}
    } finally {
      await Promise.allSettled([cA.end(), cB.end()]);
    }
    check(edgeErr === null, `GREEN-1B: unexpected error ${edgeErr?.code} ${edgeErr?.message}`);
    if (!edgeErr) {
      check(rA?.id, 'GREEN-1B: A NULL return');
      check(rB?.id, 'GREEN-1B: B NULL return (disappearance mishandled)');
      check(!/23505/.test(String(edgeErr?.code)), 'GREEN-1B: 23505 escaped');
      const act = await observer.query(`SELECT id, status FROM public.book_nominations WHERE club_id=$1 AND book_id=$2`, [clubG1B, bookG1B]);
      const actives = act.rows.filter((r) => r.status === 'active');
      check(actives.length <= 1, `GREEN-1B: duplicate ACTIVE rows (${actives.length})`);
      // Coherent with some legal sequential ordering:
      // either both resolved to the first ACTIVE (now SELECTED) → 0 active + 1 selected,
      // or B re-inserted after transition → 1 active + 1 selected.
      const selected = act.rows.filter((r) => r.status === 'selected');
      const coherent =
        (act.rows.length === 1 && selected.length === 1 && actives.length === 0 && String(rA.id) === String(rB.id)) ||
        (act.rows.length === 2 && selected.length === 1 && actives.length === 1);
      check(coherent, `GREEN-1B: incoherent final state ${JSON.stringify(act.rows.map((r) => ({ id: r.id, status: r.status })))} A=${rA?.id} B=${rB?.id}`);
      evidence.push(`GREEN-1B: no 23505/NULL/dup; final rows=${act.rows.length} (sel=${selected.length}, act=${actives.length}) A=${rA?.id} B=${rB?.id}`);
    }
  }

  // ---------- GREEN-2 vote boundary ----------
  await actAs(observer, GA);
  const clubG2 = await createNamedClub(observer, GA, 'TC04 GREEN-2 vote club');
  await ensureClubMember(observer, clubG2, GB, 'member', 'active');
  await ensureClubMember(observer, clubG2, GC, 'member', 'active');
  const bookG2 = await createBook(observer, 'tc04-green2-gbooks', 'TC04 GREEN-2 Book');
  await actAs(observer, GB);
  const nomG2 = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubG2, bookG2])).rows[0];
  await actAs(observer, GC);
  const v1 = (await observer.query(`SELECT * FROM public.cast_club_book_vote($1::uuid)`, [nomG2.id])).rows[0];
  check(v1?.nomination_id === nomG2.id, 'GREEN-2: legit vote failed');
  const v2 = (await observer.query(`SELECT * FROM public.cast_club_book_vote($1::uuid)`, [nomG2.id])).rows[0];
  check(String(v2?.nomination_id) === String(nomG2.id) && String(v2?.user_id) === String(GC), 'GREEN-2: idempotent retry wrong');
  {
    const c = await observer.query(`SELECT count(*)::int n FROM public.book_votes WHERE nomination_id=$1`, [nomG2.id]);
    check(c.rows[0].n === 1, `GREEN-2: double count (${c.rows[0].n})`);
  }
  // Direct denied on open + selected + closed
  const dirOpen = await tryDirectAsAuthenticated(observer, GB, `INSERT INTO public.book_votes (nomination_id, user_id) VALUES ($1,$2)`, [nomG2.id, GB]);
  check(dirOpen.ok === false, 'GREEN-2: direct INSERT on open unexpectedly succeeded');
  if (!dirOpen.ok) check(dirOpen.err?.code === '42501', `GREEN-2: open denial expected 42501, got ${dirOpen.err?.code}`);
  // Selected
  await actAs(observer, GA);
  await observer.query(`SELECT * FROM public.set_club_current_book_from_nomination($1::uuid)`, [nomG2.id]);
  const dirSel = await tryDirectAsAuthenticated(observer, GB, `INSERT INTO public.book_votes (nomination_id, user_id) VALUES ($1,$2)`, [nomG2.id, GB]);
  check(dirSel.ok === false, 'GREEN-2: direct INSERT on selected unexpectedly succeeded');
  // Closed (fresh nomination with past window)
  const bookG2c = await createBook(observer, 'tc04-green2c-gbooks', 'TC04 GREEN-2C Book');
  await actAs(observer, GB);
  const nomClosed = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid,NULL,NULL,NULL,NULL, now() - interval '1 hour')`, [clubG2, bookG2c])).rows[0];
  const dirClosed = await tryDirectAsAuthenticated(observer, GB, `INSERT INTO public.book_votes (nomination_id, user_id) VALUES ($1,$2)`, [nomClosed.id, GB]);
  check(dirClosed.ok === false, 'GREEN-2: direct INSERT on closed unexpectedly succeeded');
  {
    const cOpen = await observer.query(`SELECT count(*)::int n FROM public.book_votes WHERE nomination_id=$1`, [nomG2.id]);
    // v1 (GC) + nothing else; GB's direct attempts denied. Note RED left no rows here (fresh club).
    check(cOpen.rows[0].n === 1, `GREEN-2: bypass row leaked (${cOpen.rows[0].n})`);
    const nc = await observer.query(`SELECT vote_count FROM public.book_nominations WHERE id=$1`, [nomG2.id]);
    check(nc.rows[0]?.vote_count === 1, `GREEN-2: vote_count drifted (${nc.rows[0]?.vote_count})`);
    evidence.push('GREEN-2: legit+idempotent ok; direct denied open/selected/closed; no bypass row; count stable');
  }
  // Preserve remove-own-vote
  await actAs(observer, GC);
  await observer.query(`SELECT * FROM public.remove_club_book_vote($1::uuid)`, [nomG2.id]);
  {
    const c = await observer.query(`SELECT count(*)::int n FROM public.book_votes WHERE nomination_id=$1`, [nomG2.id]);
    check(c.rows[0].n === 0, 'GREEN-2: remove-own-vote did not delete');
    evidence.push('GREEN-2: remove-own-vote preserved');
  }

  // ---------- GREEN-3 nomination boundary ----------
  await actAs(observer, GA);
  const clubG3 = await createNamedClub(observer, GA, 'TC04 GREEN-3 nomination club');
  await ensureClubMember(observer, clubG3, GB, 'member', 'active');
  const bookG3 = await createBook(observer, 'tc04-green3-gbooks', 'TC04 GREEN-3 Book');
  await actAs(observer, GB);
  const n1 = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubG3, bookG3])).rows[0];
  check(n1?.status === 'active', 'GREEN-3: RPC nomination failed');
  const n2 = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubG3, bookG3])).rows[0];
  check(String(n1?.id) === String(n2?.id), 'GREEN-3: sequential duplicate did not return same id');
  const dirAct = await tryDirectAsAuthenticated(observer, GB, `INSERT INTO public.book_nominations (club_id, book_id, nominated_by, status) VALUES ($1,$2,$3,'active')`, [clubG3, bookG3, GB]);
  check(dirAct.ok === false, 'GREEN-3: direct active INSERT unexpectedly succeeded');
  const dirSel2 = await tryDirectAsAuthenticated(observer, GB, `INSERT INTO public.book_nominations (club_id, book_id, nominated_by, status) VALUES ($1,$2,$3,'selected')`, [clubG3, bookG3, GB]);
  check(dirSel2.ok === false, 'GREEN-3: direct selected INSERT unexpectedly succeeded');
  {
    const r = await observer.query(`SELECT count(*)::int n FROM public.book_nominations WHERE club_id=$1 AND book_id=$2`, [clubG3, bookG3]);
    check(r.rows[0].n === 1, `GREEN-3: manufactured row leaked (${r.rows[0].n})`);
    evidence.push('GREEN-3: RPC + sequential-dup ok; direct active/selected denied; no manufactured row');
  }

  // ---------- GREEN-4 current_book boundary (both writers) ----------
  await actAs(observer, GA);
  const clubG4 = await createNamedClub(observer, GA, 'TC04 GREEN-4 current-book club');
  await ensureClubMember(observer, clubG4, GB, 'member', 'active');
  const bookG4a = await createBook(observer, 'tc04-green4a-gbooks', 'TC04 GREEN-4A Book');
  const bookG4b = await createBook(observer, 'tc04-green4b-gbooks', 'TC04 GREEN-4B Book');
  const bookG4x = await createBook(observer, 'tc04-green4x-gbooks', 'TC04 GREEN-4X Bypass Book');
  await actAs(observer, GB);
  const nomG4a = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid,NULL,NULL,NULL,NULL, now() - interval '1 hour')`, [clubG4, bookG4a])).rows[0];
  await actAs(observer, GB);
  const nomG4b = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubG4, bookG4b])).rows[0];
  // finalize (past window) as eligible manager (admin GA is pro/all → eligible)
  await actAs(observer, GA);
  const fin = (await observer.query(`SELECT * FROM public.finalize_club_book_nomination($1::uuid)`, [nomG4a.id])).rows[0];
  check(String(fin?.current_book_id) === String(bookG4a), 'GREEN-4: finalize did not set pointer');
  // early selection as admin
  const early = (await observer.query(`SELECT * FROM public.set_club_current_book_from_nomination($1::uuid)`, [nomG4b.id])).rows[0];
  check(String(early?.current_book_id) === String(bookG4b), 'GREEN-4: early selection did not set pointer');
  // direct denied
  const dirCur = await tryDirectAsAuthenticated(observer, GA, `UPDATE public.book_clubs SET current_book_id=$2 WHERE id=$1`, [clubG4, bookG4x]);
  check(dirCur.ok === false, 'GREEN-4: direct current_book_id UPDATE unexpectedly succeeded');
  if (!dirCur.ok) check(dirCur.err?.code === '42501', `GREEN-4: expected 42501, got ${dirCur.err?.code}`);
  {
    const c = await observer.query(`SELECT current_book_id FROM public.book_clubs WHERE id=$1`, [clubG4]);
    check(String(c.rows[0]?.current_book_id) === String(bookG4b), 'GREEN-4: pointer moved by denied UPDATE');
    evidence.push('GREEN-4: finalize + early-select work; direct current_book_id denied; pointer stable');
  }

  // ---------- GREEN-4B ordinary admin updates + atomicity ----------
  {
    const before = (await observer.query(`SELECT description, max_members, access_level, meeting_type, is_archived, updated_at FROM public.book_clubs WHERE id=$1`, [clubG4])).rows[0];
    // Representative legitimate updates as authenticated admin (real RLS + column grants)
    await actAsRole(failConn, 'authenticated', GA);
    try {
      await failConn.query(`UPDATE public.book_clubs SET description=$2 WHERE id=$1`, [clubG4, 'TC04 compat description']);
      await failConn.query(`UPDATE public.book_clubs SET max_members=$2 WHERE id=$1`, [clubG4, 42]);
      await failConn.query(`UPDATE public.book_clubs SET meeting_type=$2 WHERE id=$1`, [clubG4, 'hybrid']);
      await failConn.query(`UPDATE public.book_clubs SET is_archived=$2 WHERE id=$1`, [clubG4, false]);
      await failConn.query(`UPDATE public.book_clubs SET updated_at=now() WHERE id=$1`, [clubG4]);
    } finally {
      try {
        await failConn.query('ROLLBACK');
      } catch {}
      await resetRole(failConn);
    }
    // Re-apply for real (commit) via fresh authenticated session per field to prove persistence
    for (const [sql, params] of [
      [`UPDATE public.book_clubs SET description=$2 WHERE id=$1`, [clubG4, 'TC04 compat description']],
      [`UPDATE public.book_clubs SET max_members=$2 WHERE id=$1`, [clubG4, 42]],
      [`UPDATE public.book_clubs SET meeting_type=$2 WHERE id=$1`, [clubG4, 'hybrid']],
    ]) {
      await actAsRole(observer, 'authenticated', GA);
      try {
        await observer.query(sql, params);
      } finally {
        await resetRole(observer);
      }
    }
    const after = (await observer.query(`SELECT description, max_members, meeting_type FROM public.book_clubs WHERE id=$1`, [clubG4])).rows[0];
    check(after.description === 'TC04 compat description', 'GREEN-4B: description update failed');
    check(after.max_members === 42, 'GREEN-4B: max_members update failed');
    check(after.meeting_type === 'hybrid', 'GREEN-4B: meeting_type update failed');
    // Mixed payload must fail atomically (description NOT partially changed)
    const mixed = await tryDirectAsAuthenticated(observer, GA, `UPDATE public.book_clubs SET description=$2, current_book_id=$3 WHERE id=$1`, [clubG4, 'MIXED SHOULD NOT PERSIST', bookG4x]);
    check(mixed.ok === false, 'GREEN-4B: mixed payload unexpectedly succeeded');
    {
      const c = await observer.query(`SELECT description, current_book_id FROM public.book_clubs WHERE id=$1`, [clubG4]);
      check(c.rows[0]?.description === 'TC04 compat description', 'GREEN-4B: mixed payload partially changed description');
      check(String(c.rows[0]?.current_book_id) === String(bookG4b), 'GREEN-4B: mixed payload moved pointer');
    }
    evidence.push(`GREEN-4B: ordinary updates ok (desc/max/meeting/archived/updated_at); mixed denied atomically (before desc=${before.description})`);
  }

  // ---------- Regression anchors (bounded, TC04-scope) ----------
  {
    // Google Books upsert via RPC (no p_book_id)
    await actAs(observer, GB);
    const g = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid, NULL, 'tc04-upsert-gbooks-1', 'Upsert Title', ARRAY['A'], NULL, NULL)`, [clubG3])).rows[0];
    check(g?.id, 'REG: google-books upsert nomination failed');
    const g2 = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid, NULL, 'tc04-upsert-gbooks-1', 'Upsert Title v2', ARRAY['A'], NULL, NULL)`, [clubG3])).rows[0];
    check(String(g?.id) === String(g2?.id), 'REG: upsert sequential duplicate diverged');
    // Cross-club isolation: same book, different club → different nomination
    await actAs(observer, GA);
    const clubIso = await createNamedClub(observer, GA, 'TC04 GREEN isolation club');
    await ensureClubMember(observer, clubIso, GB, 'member', 'active');
    await actAs(observer, GB);
    const iso = (await observer.query(`SELECT * FROM public.nominate_club_book($1::uuid,$2::uuid)`, [clubIso, bookG3])).rows[0];
    check(String(iso?.id) !== String(n1?.id), 'REG: cross-club isolation violated');
    evidence.push('REG anchors: upsert + sequential-dup + cross-club isolation preserved');
  }
}

// ---------------------------------------------------------------------------
async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL is required');
  assertLocality(DATABASE_URL);

  const observer = new Client({ connectionString: DATABASE_URL });
  const failConn = new Client({ connectionString: DATABASE_URL });
  await Promise.all([observer.connect(), failConn.connect()]);

  try {
    if (PHASE === 'red') await redPhase(observer);
    else await greenPhase(observer, failConn);
  } finally {
    await Promise.allSettled([observer.end(), failConn.end()]);
  }

  console.log(`[TC04:${PHASE}] evidence:`);
  for (const line of evidence) console.log(`[TC04:${PHASE}]   · ${line}`);

  if (failures.length > 0) {
    console.error(`[TC04:${PHASE}] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[TC04:${PHASE}]   ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(
      PHASE === 'red'
        ? '[TC04:red] PASS: all four defects reproduced (23505 race, vote/nomination/current_book bypasses) with fresh readbacks.'
        : '[TC04:green] PASS: concurrency fixed (same-id, first-writer, 1 notification, disappearance-coherent), write boundaries enforced, writers preserved, column-compat atomic.',
    );
  }
}

main().catch((e) => {
  console.error('[TC04] infrastructure/bootstrap failure:', e);
  process.exit(2);
});
