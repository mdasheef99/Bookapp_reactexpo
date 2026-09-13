#!/usr/bin/env node
/**
 * CLUB-WU-TC03 · contract/admin_transfer.test.mjs
 *
 * ADMIN-TRANSFER ACCEPTANCE CONTRACT (migration-boundary RED→GREEN design)
 * against a disposable local PostgreSQL 17 booted by clubsL4Runner.mjs.
 *
 * Subsystem under test:
 *   public.request_club_admin_transfer
 *   public.accept_club_admin_transfer_request
 *   public.club_admin_transfer_requests (+ RLS)
 * (migration 20260529154500_club_moderation_author_lifecycle_rpc.sql and the
 * WU-TC03 forward fix migration).
 *
 * Known defect (context-gate proven against live defs): the pre-fix accept
 * RPC demoted the owner's club_members row BEFORE flipping
 * book_clubs.admin_id, so enforce_single_club_admin_membership raised
 * 'Primary club owner membership must remain active admin' on every
 * invariant-satisfying club. RED phase reproduces exactly that with a
 * full no-mutation readback; the runner then applies the ACTUAL forward
 * fix migration to the SAME database/state and GREEN proves the repaired
 * contract.
 *
 * PHASES (chosen by CLUBS_L4_TC03_PHASE; the runner sequences both against
 * ONE disposable database):
 *   red   — valid request (works pre-fix), proposed-successor accept hits
 *           the invariant failure, persisted state provably untouched.
 *   green — the SAME pending request now succeeds (ownership flip first),
 *           then the bounded negative/security matrix: request
 *           authorization, invalid successors (non-member/banned/free/
 *           self/access/archived), wrong acceptor, expiry, admin-changed-
 *           since-request, eligibility drift (left/tier/access), archived
 *           drift, RPC-only creation (direct INSERT denied), author-club
 *           semantics, cap-trigger rollback, and function-contract
 *           preservation (identity/ACL/policy state).
 *
 * Fixture authority: actors/clubs follow actors.mjs house style; fixture
 * bypasses (session_replication_role=replica, direct superuser UPDATE) are
 * used only to construct states the product cannot reach through its own
 * RPCs (free member in a pro-access club, access-level raise stranding
 * members), mirroring downgrade_grace.test.mjs precedent.
 *
 * Exit codes: 0 pass · 1 contract failure · infrastructure failures
 * propagate as nonzero via thrown errors.
 */
import { Client } from 'pg';
import { actAs, actAsRole, resetRole, ensureActor, createQualifyingClubs, ensureClubMember } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;
const PHASE = process.env.CLUBS_L4_TC03_PHASE;

/** Locality/isolation guard: only loopback disposable clubs_l4_* databases. */
function assertLocality(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`CLUBS_L4_DATABASE_URL is not a valid URL`);
  }
  const hostOk = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  const dbOk = parsed.pathname.startsWith('/clubs_l4_');
  if (!hostOk || !dbOk) {
    throw new Error(
      `Locality guard violated: expected loopback host + clubs_l4_* database, got ${parsed.hostname}${parsed.pathname}`,
    );
  }
}

if (PHASE !== 'red' && PHASE !== 'green') {
  throw new Error(`CLUBS_L4_TC03_PHASE must be 'red' or 'green', got '${PHASE ?? ''}'`);
}

// ---------------------------------------------------------------------------
// Assertion scaffolding (house style: failures[] + evidence[])
// ---------------------------------------------------------------------------
const failures = [];
const evidence = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  return cond;
};

// ---------------------------------------------------------------------------
// Fixed fixture identity (stable across RED and GREEN processes)
// ---------------------------------------------------------------------------
const A = 'a3000000-0000-4000-8000-000000000001'; // admin of Club A
const B = 'a3000000-0000-4000-8000-000000000002'; // proposed successor (RED victim → GREEN winner)
const M = 'a3000000-0000-4000-8000-000000000003'; // plain member
const MOD = 'a3000000-0000-4000-8000-000000000004'; // moderator
const O = 'a3000000-0000-4000-8000-000000000005'; // admin of another club
const FR = 'a3000000-0000-4000-8000-000000000006'; // free-tier user
const BA = 'a3000000-0000-4000-8000-000000000007'; // banned member
const D = 'a3000000-0000-4000-8000-000000000008'; // admin of Club D
const D2 = 'a3000000-0000-4000-8000-000000000009'; // successor for D
const E = 'a3000000-0000-4000-8000-00000000000a'; // admin of Club E (pro access)
const E2 = 'a3000000-0000-4000-8000-00000000000b'; // successor for E (access drift)
const F = 'a3000000-0000-4000-8000-00000000000c'; // admin of Club F
const F2 = 'a3000000-0000-4000-8000-00000000000d'; // replacement admin (admin-changed)
const F3 = 'a3000000-0000-4000-8000-00000000000e'; // successor for F
const G = 'a3000000-0000-4000-8000-00000000000f'; // admin of Club G
const G2 = 'a3000000-0000-4000-8000-000000000010'; // successor for G (leaves)
const H = 'a3000000-0000-4000-8000-000000000011'; // admin of Clubs H and I
const H2 = 'a3000000-0000-4000-8000-000000000012'; // successor for H (tier drift)
const J = 'a3000000-0000-4000-8000-000000000013'; // admin of Club J
const J2 = 'a3000000-0000-4000-8000-000000000014'; // cap successor (owns 5 clubs)
const AU = 'a3000000-0000-4000-8000-000000000015'; // verified author / author-club admin
const AU2 = 'a3000000-0000-4000-8000-000000000016'; // author-club member (non-author)
const L = 'a3000000-0000-4000-8000-000000000017'; // admin of Club L
const P = 'a3000000-0000-4000-8000-000000000019'; // pro_plus admin of Club P (access-level case)

const CLUB_A_NAME = 'TC03 Club A';
const CLUB_OTHER_NAME = 'TC03 Club Other';
const CLUB_D_NAME = 'TC03 Club D';
const CLUB_E_NAME = 'TC03 Club E';
const CLUB_F_NAME = 'TC03 Club F';
const CLUB_G_NAME = 'TC03 Club G';
const CLUB_H_NAME = 'TC03 Club H';
const CLUB_I_NAME = 'TC03 Club I';
const CLUB_J_NAME = 'TC03 Club J';
const CLUB_AUTHOR_NAME = 'TC03 Author Club';
const CLUB_L_NAME = 'TC03 Club L';

// ---------------------------------------------------------------------------
// Fixture helpers (superuser fixture authority; scope-fenced)
// ---------------------------------------------------------------------------
async function ensureFixedActor(client, userId, tier = 'pro') {
  await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  await client.query(
    `INSERT INTO user_profiles (user_id, display_name, city, email, membership_tier)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, `TC03 Actor ${userId.slice(-4)}`, 'Testville', `${userId}@clubs-l4.invalid`, tier],
  );
}

async function createNamedClub(client, adminId, name, opts = {}) {
  const res = await client.query(
    `SELECT (public.create_club(
       $1::text, $2::text, NULL::text, 'public'::text, $3::text,
       NULL::text, $4::uuid, NULL::uuid, NULL::int, NULL::uuid
     )).id AS club_id`,
    [name, 'TC03 contract fixture club', opts.accessLevel ?? 'all', adminId],
  );
  return res.rows[0].club_id;
}

async function createAuthorClub(client, adminId, name) {
  const profile = await client.query(`SELECT id FROM user_profiles WHERE user_id = $1`, [adminId]);
  const res = await client.query(
    `SELECT (public.create_club(
       $1::text, $2::text, NULL::text, 'author_club'::text, 'all'::text,
       NULL::text, $3::uuid, NULL::uuid, NULL::int, $4::uuid
     )).id AS club_id`,
    [name, 'TC03 author fixture club', adminId, profile.rows[0].id],
  );
  return res.rows[0].club_id;
}

async function clubIdByName(client, name) {
  const res = await client.query(`SELECT id FROM book_clubs WHERE name = $1 ORDER BY created_at LIMIT 1`, [name]);
  if (res.rows.length !== 1) throw new Error(`fixture lookup failed: club '${name}' not found`);
  return res.rows[0].id;
}

/** Fixture-authority replication-role bypass (mirror downgrade_grace style). */
async function withReplicaBypass(client, fn) {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL session_replication_role = replica');
    await fn();
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Invocation + readback helpers
// ---------------------------------------------------------------------------
async function requestTransfer(client, userId, clubId, successorId) {
  await actAs(client, userId);
  const res = await client.query(
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`,
    [clubId, successorId],
  );
  return res.rows[0];
}

/** Expected-failure invocation on a dedicated connection (transaction aborts). */
async function expectRpcFailure(client, userId, sql, params, expectedMessage) {
  await actAs(client, userId);
  let err = null;
  try {
    await client.query(sql, params);
  } catch (e) {
    err = e;
  } finally {
    await client.query('ROLLBACK').catch(() => {});
  }
  check(err !== null, `expected RPC failure '${expectedMessage}' but it succeeded`);
  if (err) {
    check(err.code === 'P0001', `expected SQLSTATE P0001, got '${err.code}' (${err.message})`);
    check(
      err.message === expectedMessage,
      `expected failure message '${expectedMessage}', got '${err.message}'`,
    );
  }
  return err;
}

async function pendingRequests(client, clubId) {
  const res = await client.query(
    `SELECT id, club_id, requested_by, proposed_admin_user_id, status, responded_at, expires_at
       FROM public.club_admin_transfer_requests
      WHERE club_id = $1
      ORDER BY created_at DESC`,
    [clubId],
  );
  return res.rows;
}

async function clubAdminState(client, clubId) {
  const club = await client.query(`SELECT admin_id FROM book_clubs WHERE id = $1`, [clubId]);
  const admins = await client.query(
    `SELECT user_id, role, status FROM public.club_members WHERE club_id = $1 AND role = 'admin'`,
    [clubId],
  );
  return { adminId: club.rows[0]?.admin_id ?? null, adminRows: admins.rows };
}

async function memberRow(client, clubId, userId) {
  const res = await client.query(
    `SELECT role, status FROM public.club_members WHERE club_id = $1 AND user_id = $2`,
    [clubId, userId],
  );
  return res.rows[0] ?? null;
}

/** Full no-mutation readback for a failed acceptance attempt. */
async function assertUntouchedAfterFailedAccept(client, clubId, requestRow, expectedAdminId) {
  const state = await clubAdminState(client, clubId);
  check(state.adminId === expectedAdminId, `admin_id changed after failed accept: ${state.adminId}`);
  check(state.adminRows.length === 1, `expected exactly 1 admin-role row, got ${state.adminRows.length}`);
  check(
    state.adminRows[0]?.user_id === expectedAdminId,
    `admin-role row user mismatch: ${state.adminRows[0]?.user_id}`,
  );
  const after = (await pendingRequests(client, clubId)).find((r) => r.id === requestRow.id);
  check(!!after, 'request row vanished after failed accept');
  if (after) {
    check(after.status === 'pending', `request status expected pending, got '${after.status}'`);
    check(after.responded_at === null, 'responded_at set after failed accept');
  }
}

// ---------------------------------------------------------------------------
// Phase implementations
// ---------------------------------------------------------------------------
async function redPhase(observer, failConn) {
  // ---------- Fixtures ----------
  for (const [u, tier] of [
    [A, 'pro'], [B, 'pro'], [M, 'pro'], [MOD, 'pro'], [O, 'pro'], [FR, 'free'], [BA, 'pro'],
    [D, 'pro'], [D2, 'pro'], [E, 'pro'], [E2, 'pro'], [F, 'pro'], [F2, 'pro'], [F3, 'pro'],
    [G, 'pro'], [G2, 'pro'], [H, 'pro'], [H2, 'pro'], [J, 'pro'], [J2, 'pro'],
    [AU, 'pro'], [AU2, 'pro'], [L, 'pro'], [P, 'pro_plus'],
  ]) {
    await ensureFixedActor(observer, u, tier);
  }

  await actAs(observer, A);
  const clubA = await createNamedClub(observer, A, CLUB_A_NAME);
  await ensureClubMember(observer, clubA, B, 'member', 'active');
  await ensureClubMember(observer, clubA, M, 'member', 'active');
  await ensureClubMember(observer, clubA, MOD, 'moderator', 'active');

  await actAs(observer, O);
  await createNamedClub(observer, O, CLUB_OTHER_NAME);

  // ---------- R1: valid REQUEST works pre-fix ----------
  const req = await requestTransfer(observer, A, clubA, B);
  check(req.status === 'pending', `R1: expected pending request, got '${req.status}'`);
  check(req.requested_by === A && req.proposed_admin_user_id === B, 'R1: wrong request parties');
  const expiresInDays = (req.expires_at.getTime() - Date.now()) / 86400_000;
  check(expiresInDays > 6.9 && expiresInDays < 7.1, `R1: expiry expected ~7 days, got ${expiresInDays.toFixed(2)}`);
  evidence.push(`R1 valid request pre-fix: pending row created, expires_at ≈ now+7d (${req.id})`);

  // ---------- R2: PRE-FIX RED — accept hits the single-admin invariant ----------
  await expectRpcFailure(
    failConn,
    B,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`,
    [req.id],
    'Primary club owner membership must remain active admin',
  );
  evidence.push('R2 RED: proposed-successor accept raised the single-admin invariant (demote-before-flip defect)');

  // ---------- R3: persisted state provably untouched ----------
  await assertUntouchedAfterFailedAccept(observer, clubA, req, A);
  const bRow = await memberRow(observer, clubA, B);
  check(bRow?.role === 'member' && bRow?.status === 'active', `R3: successor row drifted: ${JSON.stringify(bRow)}`);
  evidence.push('R3 rollback proof: admin_id unchanged, old admin still admin, request still pending, exactly 1 admin row');
}

async function greenPhase(observer, failConn) {
  // ---------- Continuity from RED state ----------
  const clubA = await clubIdByName(observer, CLUB_A_NAME);
  const redRequest = (await pendingRequests(observer, clubA)).find((r) => r.status === 'pending');
  check(!!redRequest, 'G1 continuity: RED-phase pending request not found');
  const redState = await clubAdminState(observer, clubA);
  check(redState.adminId === A, `G1 continuity: club A admin expected ${A}, got ${redState.adminId}`);

  // ---------- G0: function-contract preservation ----------
  const contracts = await observer.query(
    `SELECT proname, provolatile, prosecdef, proconfig,
            pg_get_userbyid(proowner) AS owner,
            pg_get_function_identity_arguments(oid) AS args,
            pg_get_function_result(oid) AS result_type,
            proacl
       FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('request_club_admin_transfer','accept_club_admin_transfer_request')`,
  );
  const sessionUser = (await observer.query('SELECT current_user AS u')).rows[0].u;
  const byName = new Map(contracts.rows.map((r) => [r.proname, r]));
  const reqContract = byName.get('request_club_admin_transfer');
  const accContract = byName.get('accept_club_admin_transfer_request');
  for (const [label, c, args, resultType] of [
    ['request', reqContract, 'p_club_id uuid, p_new_admin_user_id uuid', 'club_admin_transfer_requests'],
    ['accept', accContract, 'p_request_id uuid', 'book_clubs'],
  ]) {
    check(!!c, `G0: ${label} function missing`);
    if (!c) continue;
    check(c.args === args, `G0: ${label} identity args changed: '${c.args}'`);
    check(c.result_type === resultType, `G0: ${label} return type changed: '${c.result_type}'`);
    check(c.prosecdef === true, `G0: ${label} not SECURITY DEFINER`);
    check(c.provolatile === 'v', `G0: ${label} volatility changed: '${c.provolatile}'`);
    check(
      Array.isArray(c.proconfig) && c.proconfig.length === 1 && c.proconfig[0] === 'search_path=public',
      `G0: ${label} search_path changed: ${JSON.stringify(c.proconfig)}`,
    );
    check(c.owner === sessionUser, `G0: ${label} owner changed: '${c.owner}'`);
    const expectedAcl = `{${sessionUser}=X/${sessionUser},authenticated=X/${sessionUser},service_role=X/${sessionUser}}`;
    check(c.proacl === expectedAcl, `G0: ${label} ACL changed: '${c.proacl}' expected '${expectedAcl}'`);
  }
  const anonExec = await observer.query(
    `SELECT has_function_privilege('anon', 'public.accept_club_admin_transfer_request(uuid)', 'EXECUTE') AS can`,
  );
  check(anonExec.rows[0].can === false, 'G0: anon gained EXECUTE on accept');
  const insertPolicies = await observer.query(
    `SELECT count(*)::int AS n FROM pg_policy
      WHERE polrelid = 'public.club_admin_transfer_requests'::regclass AND polcmd = 'a'`,
  );
  check(insertPolicies.rows[0].n === 0, 'G0: direct INSERT policy still present');
  const selectPolicies = await observer.query(
    `SELECT count(*)::int AS n FROM pg_policy
      WHERE polrelid = 'public.club_admin_transfer_requests'::regclass AND polcmd = 'r'`,
  );
  check(selectPolicies.rows[0].n === 1, 'G0: SELECT policy missing');
  evidence.push('G0 contract preservation: identity/return/SECURITY DEFINER/search_path/owner/ACL unchanged; INSERT policy dropped; SELECT policy intact');

  // ---------- G1: the RED-phase request now succeeds ----------
  await actAs(observer, B);
  const accepted = (await observer.query(
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`,
    [redRequest.id],
  )).rows[0];
  check(accepted.admin_id === B, `G1: returned club admin_id expected ${B}, got ${accepted.admin_id}`);
  const aAfter = await memberRow(observer, clubA, A);
  check(aAfter?.role === 'member', `G1: old admin role expected member, got '${aAfter?.role}'`);
  const bAfter = await memberRow(observer, clubA, B);
  check(bAfter?.role === 'admin' && bAfter?.status === 'active', `G1: successor row wrong: ${JSON.stringify(bAfter)}`);
  const reqAfter = (await pendingRequests(observer, clubA)).find((r) => r.id === redRequest.id);
  check(reqAfter?.status === 'accepted', `G1: request status expected accepted, got '${reqAfter?.status}'`);
  check(reqAfter?.responded_at !== null, 'G1: responded_at not set');
  const g1State = await clubAdminState(observer, clubA);
  check(g1State.adminRows.length === 1 && g1State.adminRows[0].user_id === B, 'G1: single-admin invariant violated');
  evidence.push(`G1 happy path: ownership ${A} → ${B}, old admin demoted to member, request accepted`);

  // ---------- G2: request authorization (club D) ----------
  await actAs(observer, D);
  const clubD = await createNamedClub(observer, D, CLUB_D_NAME);
  await ensureClubMember(observer, clubD, M, 'member', 'active');
  await ensureClubMember(observer, clubD, MOD, 'moderator', 'active');
  await ensureClubMember(observer, clubD, D2, 'member', 'active');

  for (const [actor, label] of [[M, 'member'], [MOD, 'moderator'], [O, 'other-club admin']]) {
    await expectRpcFailure(
      failConn,
      actor,
      `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`,
      [clubD, D2],
      'Only the current admin can request transfer',
    );
    check((await pendingRequests(observer, clubD)).length === 0, `G2: ${label} created a request row`);
  }
  evidence.push('G2 request authorization: member/moderator/other-club admin rejected, zero rows');

  // ---------- G3: invalid successors (club D + fixture clubs) ----------
  const nonMember = await ensureActor(observer, { tier: 'pro' });
  await expectRpcFailure(
    failConn, D,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubD, nonMember.userId],
    'New admin must be an active club member',
  );
  await ensureClubMember(observer, clubD, BA, 'member', 'banned');
  await expectRpcFailure(
    failConn, D,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubD, BA],
    'New admin must be an active club member',
  );
  await ensureClubMember(observer, clubD, FR, 'member', 'active');
  await expectRpcFailure(
    failConn, D,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubD, FR],
    'New admin must be a Pro or Pro+ member',
  );
  await expectRpcFailure(
    failConn, D,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubD, D],
    'Choose a different successor',
  );
  await actAs(observer, D);
  const clubK = await createNamedClub(observer, D, 'TC03 Club K');
  await ensureClubMember(observer, clubK, M, 'member', 'active');
  // NOTE: minimal TC03 chain has no archived_at column (REC-2 reconstruction
  // intentionally omitted); the transfer contract reads only is_archived.
  await observer.query(`UPDATE book_clubs SET is_archived = true WHERE id = $1`, [clubK]);
  await expectRpcFailure(
    failConn, D,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubK, M],
    'Archived clubs cannot transfer admin ownership',
  );
  check((await pendingRequests(observer, clubD)).length === 0, 'G3: invalid successor created a request row');
  evidence.push('G3 invalid successors: non-member/banned/free/self/archived rejected, zero rows');

  // Access-level-ineligible successor: pro member inside a pro_plus club
  // (unreachable via product paths → fixture authority). A free-tier
  // successor would trip the tier guard first (approved guard order:
  // tier before access), so pro-in-pro_plus isolates the access guard.
  await actAs(observer, P);
  const clubP = await createNamedClub(observer, P, 'TC03 Club P', { accessLevel: 'pro_plus' });
  const proInPlus = await ensureActor(observer, { tier: 'pro' });
  await withReplicaBypass(observer, async () => {
    await observer.query(
      `INSERT INTO public.club_members (club_id, user_id, role, status) VALUES ($1, $2, 'member', 'active')`,
      [clubP, proInPlus.userId],
    );
  });
  await expectRpcFailure(
    failConn, P,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubP, proInPlus.userId],
    'Successor membership tier must satisfy the club access level',
  );
  evidence.push('G3 access-level guard: sub-access successor rejected at request time');

  // ---------- G4 + G5: wrong acceptor + expired request ----------
  const g4req = await requestTransfer(observer, D, clubD, D2);
  await expectRpcFailure(
    failConn, M,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g4req.id],
    'Only the proposed admin can accept this transfer',
  );
  await assertUntouchedAfterFailedAccept(observer, clubD, g4req, D);
  evidence.push('G4 wrong acceptor: member rejected, zero mutation');

  await observer.query(
    `UPDATE public.club_admin_transfer_requests SET expires_at = now() - interval '1 hour' WHERE id = $1`,
    [g4req.id],
  );
  await expectRpcFailure(
    failConn, D2,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g4req.id],
    'Transfer request is not pending',
  );
  const g5row = (await pendingRequests(observer, clubD)).find((r) => r.id === g4req.id);
  check(g5row?.status === 'pending' && g5row?.responded_at === null, 'G5: expired request row mutated');
  evidence.push('G5 expired request: rejected read-time, stored status stays pending (deferred lifecycle untouched)');

  // ---------- G6: admin changed after request ----------
  await actAs(observer, F);
  const clubF = await createNamedClub(observer, F, CLUB_F_NAME);
  await ensureClubMember(observer, clubF, F3, 'member', 'active');
  const g6req = await requestTransfer(observer, F, clubF, F3);
  await observer.query(`UPDATE book_clubs SET admin_id = $1 WHERE id = $2`, [F2, clubF]);
  await expectRpcFailure(
    failConn, F3,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g6req.id],
    'Transfer request is no longer valid: club ownership changed',
  );
  // The fixture admin_id change intentionally leaves the old admin-role row
  // on F (membership rows are not migrated by a book_clubs.admin_id write);
  // the contract is that the STALE REQUEST cannot execute against it.
  const g6state = await clubAdminState(observer, clubF);
  check(g6state.adminId === F2, `G6: replacement admin_id expected ${F2}, got ${g6state.adminId}`);
  check(g6state.adminRows[0]?.user_id === F, `G6: fixture admin-role row expected on ${F}, got ${g6state.adminRows[0]?.user_id}`);
  check((await memberRow(observer, clubF, F3))?.role === 'member', 'G6: successor promoted despite stale request');
  const g6row = (await pendingRequests(observer, clubF)).find((r) => r.id === g6req.id);
  check(g6row?.status === 'pending', 'G6: stale request mutated');
  evidence.push('G6 admin-changed: stale request rejected, replacement ownership intact, zero acceptance mutation');

  // ---------- G7: successor eligibility drift ----------
  await actAs(observer, G);
  const clubG = await createNamedClub(observer, G, CLUB_G_NAME);
  await ensureClubMember(observer, clubG, G2, 'member', 'active');
  const g7a = await requestTransfer(observer, G, clubG, G2);
  await observer.query(`DELETE FROM public.club_members WHERE club_id = $1 AND user_id = $2`, [clubG, G2]);
  await expectRpcFailure(
    failConn, G2,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g7a.id],
    'Successor must be an active club member',
  );
  await assertUntouchedAfterFailedAccept(observer, clubG, g7a, G);
  evidence.push('G7a successor left club: accept-time membership revalidation rejected');

  await actAs(observer, H);
  const clubH = await createNamedClub(observer, H, CLUB_H_NAME);
  await ensureClubMember(observer, clubH, H2, 'member', 'active');
  const g7b = await requestTransfer(observer, H, clubH, H2);
  await observer.query(`UPDATE user_profiles SET membership_tier = 'free' WHERE user_id = $1`, [H2]);
  await expectRpcFailure(
    failConn, H2,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g7b.id],
    'Only Pro or Pro+ users can become club admin',
  );
  await assertUntouchedAfterFailedAccept(observer, clubH, g7b, H);
  evidence.push('G7b successor tier dropped: accept-time tier revalidation rejected');

  // Club E starts at 'pro' access with an eligible pro successor; the
  // access level is then raised past the successor's tier after the request.
  await actAs(observer, E);
  const clubE = await createNamedClub(observer, E, CLUB_E_NAME, { accessLevel: 'pro' });
  await ensureClubMember(observer, clubE, E2, 'member', 'active');
  const g7c = await requestTransfer(observer, E, clubE, E2);
  await withReplicaBypass(observer, async () => {
    await observer.query(`UPDATE book_clubs SET access_level = 'pro_plus' WHERE id = $1`, [clubE]);
  });
  await expectRpcFailure(
    failConn, E2,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g7c.id],
    'Successor membership tier must satisfy the club access level',
  );
  await assertUntouchedAfterFailedAccept(observer, clubE, g7c, E);
  evidence.push('G7c club access raised after request: accept-time access revalidation rejected');

  // ---------- G8: archived-after-request drift ----------
  await actAs(observer, H);
  const clubI = await createNamedClub(observer, H, CLUB_I_NAME);
  await ensureClubMember(observer, clubI, M, 'member', 'active');
  const g8req = await requestTransfer(observer, H, clubI, M);
  await observer.query(`UPDATE book_clubs SET is_archived = true WHERE id = $1`, [clubI]);
  await expectRpcFailure(
    failConn, M,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g8req.id],
    'Archived clubs cannot transfer admin ownership',
  );
  await assertUntouchedAfterFailedAccept(observer, clubI, g8req, H);
  evidence.push('G8 archived drift: acceptance rejected after archival, zero mutation');

  // ---------- G9: direct table INSERT blocked; RPC creation still works ----------
  await actAsRole(observer, 'authenticated', D);
  let rlsErr = null;
  try {
    await observer.query(
      `INSERT INTO public.club_admin_transfer_requests (club_id, requested_by, proposed_admin_user_id)
       VALUES ($1, $2, $3)`,
      [clubD, D, D2],
    );
  } catch (e) {
    rlsErr = e;
  } finally {
    await observer.query('ROLLBACK').catch(() => {});
    await resetRole(observer);
  }
  check(rlsErr !== null, 'G9: direct table INSERT unexpectedly succeeded');
  if (rlsErr) {
    check(rlsErr.code === '42501', `G9: expected RLS denial 42501, got '${rlsErr.code}'`);
  }
  const g9req = await requestTransfer(observer, D, clubD, D2);
  check(g9req?.status === 'pending', 'G9: request RPC no longer functional after policy drop');
  const dPendings = await pendingRequests(observer, clubD);
  check(dPendings.filter((r) => r.status === 'pending').length === 1, 'G9: expected exactly 1 pending request for club D');
  evidence.push('G9 RPC-only creation: direct INSERT denied (42501), request RPC still functional');

  // ---------- G10: author club semantics ----------
  await observer.query(`UPDATE user_profiles SET is_verified_author = TRUE WHERE user_id = $1`, [AU]);
  await actAs(observer, AU);
  const clubAu = await createAuthorClub(observer, AU, CLUB_AUTHOR_NAME);
  await ensureClubMember(observer, clubAu, AU2, 'member', 'active');
  await expectRpcFailure(
    failConn, AU,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubAu, AU2],
    'Author club transfers require the verified author profile owner',
  );
  // The verified author-profile owner of an author club is structurally the
  // current admin (enforce_author_club_owner_consistency), so the only
  // author-rule-matching successor is the admin himself — rejected by the
  // self guard (guard order per approved contract).
  await expectRpcFailure(
    failConn, AU,
    `SELECT * FROM public.request_club_admin_transfer($1::uuid, $2::uuid)`, [clubAu, AU],
    'Choose a different successor',
  );
  check((await pendingRequests(observer, clubAu)).length === 0, 'G10: author club created a request row');
  evidence.push('G10 author club: non-author successor rejected; author-owner successor is the admin (self-guard)');

  // ---------- G11: cap-trigger rollback (post-fix atomicity proof) ----------
  await actAs(observer, J2);
  await createQualifyingClubs(observer, J2, 5, { namePrefix: 'TC03 Cap Club' });
  await actAs(observer, J);
  const clubJ = await createNamedClub(observer, J, CLUB_J_NAME);
  await ensureClubMember(observer, clubJ, J2, 'member', 'active');
  const g11req = await requestTransfer(observer, J, clubJ, J2);
  await expectRpcFailure(
    failConn, J2,
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`, [g11req.id],
    'Membership tier club creation limit reached',
  );
  await assertUntouchedAfterFailedAccept(observer, clubJ, g11req, J);
  const j2Row = await memberRow(observer, clubJ, J2);
  check(j2Row?.role === 'member', `G11: successor role drifted: ${JSON.stringify(j2Row)}`);
  evidence.push('G11 cap rollback: enforce_book_club_entitlement rejected the first write; full state untouched (atomicity proof)');

  // ---------- G12: unarchived successor path still healthy (club L happy mini-path) ----------
  await actAs(observer, L);
  const clubL = await createNamedClub(observer, L, CLUB_L_NAME);
  await ensureClubMember(observer, clubL, B, 'member', 'active');
  const g12req = await requestTransfer(observer, L, clubL, B);
  await actAs(observer, B);
  const g12club = (await observer.query(
    `SELECT * FROM public.accept_club_admin_transfer_request($1::uuid)`,
    [g12req.id],
  )).rows[0];
  check(g12club.admin_id === B, 'G12: second transfer did not complete');
  const lState = await clubAdminState(observer, clubL);
  check(lState.adminRows.length === 1 && lState.adminRows[0].user_id === B, 'G12: invariant violated on club L');
  evidence.push('G12 repeat happy path on a fresh club: contract is reproducible, invariant holds');
}

// ---------------------------------------------------------------------------
async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL is required');
  assertLocality(DATABASE_URL);

  const observer = new Client({ connectionString: DATABASE_URL });
  const failConn = new Client({ connectionString: DATABASE_URL });
  await Promise.all([observer.connect(), failConn.connect()]);

  try {
    if (PHASE === 'red') {
      await redPhase(observer, failConn);
    } else {
      await greenPhase(observer, failConn);
    }
  } finally {
    await Promise.allSettled([observer.end(), failConn.end()]);
  }

  console.log(`[TC03:${PHASE}] evidence:`);
  for (const line of evidence) console.log(`[TC03:${PHASE}]   · ${line}`);

  if (failures.length > 0) {
    console.error(`[TC03:${PHASE}] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[TC03:${PHASE}]   ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(
      PHASE === 'red'
        ? '[TC03:red] PASS: pre-fix invariant failure reproduced on valid accept; persisted ownership/request state provably untouched.'
        : '[TC03:green] PASS: repaired accept contract green — happy path, authorization, eligibility revalidation, drift, expiry, stale-admin, archived, RPC-only creation, author semantics, cap rollback, invariant preserved.',
    );
  }
}

main().catch((e) => {
  console.error('[TC03] infrastructure/bootstrap failure:', e);
  process.exit(2);
});
