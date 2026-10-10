#!/usr/bin/env node
/**
 * CLUB-WU-L01-A · contract/b02_creation_cap.test.mjs
 *
 * B02 REAL CONCURRENCY CONTRACT (deterministic transaction orchestration)
 * against a disposable local PostgreSQL 17 booted by clubsL4Runner.mjs.
 *
 * Invariant under test (migration
 * 20260822234500_clubs_b02_creation_cap_race_fix.sql, live-verified):
 *   Concurrent club creation by one admin must serialize on the
 *   per-admin transaction advisory lock taken inside
 *   public.enforce_book_club_entitlement BEFORE the cap count, so a
 *   Pro actor at 4 qualifying clubs gets exactly one success and one
 *   P0001 'Membership tier club creation limit reached' from two
 *   concurrent create attempts, ending at exactly 5 clubs.
 *
 * Why deterministic instead of Promise.all racing:
 *   Connection A holds its transaction OPEN after a successful
 *   create_club (5th club uncommitted). The test PROVES B has reached
 *   the competing operation and is blocked on A's advisory lock using
 *   server lock-state evidence (pg_stat_activity wait_event =
 *   'advisory' + matching ungranted pg_locks entry keyed identically
 *   to A's granted lock) from a third observer connection. Only then
 *   does A COMMIT, after which B must reject at the cap.
 *
 * If the advisory lock were removed, B would evaluate the cap while A
 * is uncommitted, see 4, succeed too, and the final count would be 6 —
 * this sequence fails in both the early-settle and final-count
 * assertions (RED-proofed via the runner's --mutation no-lock mode).
 *
 * Exit codes: 0 pass · 1 contract failure · (infrastructure failures
 * propagate as nonzero via thrown errors).
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { actAs, ensureActor, createQualifyingClubs, countQualifyingClubs } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;
const BLOCK_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 100;
const STABLE_POLLS_REQUIRED = 3;

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

async function advisoryLocksFor(observer, pids) {
  const res = await observer.query(
    `SELECT pid, objid, granted
       FROM pg_locks
      WHERE locktype = 'advisory'
        AND pid = ANY($1::int[])`,
    [pids],
  );
  return res.rows;
}

async function activityFor(observer, pid) {
  const res = await observer.query(
    `SELECT state, wait_event_type, wait_event
       FROM pg_stat_activity
      WHERE pid = $1`,
    [pid],
  );
  return res.rows[0] ?? null;
}

async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL is required');
  assertLocality(DATABASE_URL);

  const failures = [];
  const evidence = [];
  const check = (cond, msg) => {
    if (!cond) failures.push(msg);
    return cond;
  };

  const observer = new Client({ connectionString: DATABASE_URL });
  const connA = new Client({ connectionString: DATABASE_URL });
  const connB = new Client({ connectionString: DATABASE_URL });

  await Promise.all([observer.connect(), connA.connect(), connB.connect()]);

  let txAOpen = false;
  let txBOpen = false;

  try {
    // ---------- Preconditions: Pro actor at exactly 4 qualifying clubs ----------
    const actor = await ensureActor(observer, { tier: 'pro' });
    await actAs(observer, actor.userId);
    const seededIds = await createQualifyingClubs(observer, actor.userId, 4);

    const preCount = await countQualifyingClubs(observer, actor.userId);
    check(preCount === 4, `precondition: expected 4 qualifying clubs before race, found ${preCount}`);

    // ---------- CONNECTION A: create #5, DO NOT COMMIT ----------
    await connA.query('BEGIN');
    txAOpen = true;
    await actAs(connA, actor.userId);

    const attemptName = `L4 Race Attempt A ${randomUUID().slice(0, 8)}`;
    const resA = await connA.query(
      `SELECT (public.create_club($1::text, $2::text, NULL::text, 'public', 'all', NULL::text, $3::uuid,
                                 NULL::uuid, NULL::int, NULL::uuid)).id AS club_id`,
      [attemptName, 'B02 race attempt A', actor.userId],
    );
    const clubIdA = resA.rows[0].club_id;
    check(Boolean(clubIdA), 'connection A: create_club did not return a club row');

    const aPid = connA.processID;
    const aLocks = await advisoryLocksFor(observer, [aPid]);
    const aHeld = aLocks.filter((l) => l.granted);
    check(
      aHeld.length >= 1,
      `lock evidence: connection A (pid ${aPid}) holds no granted advisory lock while its transaction is open`,
    );
    if (aHeld.length >= 1) {
      evidence.push(`A pid=${aPid} holds advisory xact lock objid=${aHeld[0].objid} (granted) while uncommitted`);
    }

    // ---------- CONNECTION B: same actor, competing create ----------
    const bPid = (await connB.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await connB.query('BEGIN');
    txBOpen = true;
    await actAs(connB, actor.userId);

    let bSettled = false;
    let bError = null;
    let bResultRow = null;
    const attemptBPromise = connB
      .query(
        `SELECT public.create_club($1::text, $2::text, NULL::text, 'public', 'all', NULL::text, $3::uuid,
                                   NULL::uuid, NULL::int, NULL::uuid) AS club`,
        [`L4 Race Attempt B ${randomUUID().slice(0, 8)}`, 'B02 race attempt B', actor.userId],
      )
      .then(
        (r) => {
          bSettled = true;
          bResultRow = r.rows?.[0]?.club ?? null;
          return r;
        },
        (e) => {
          bSettled = true;
          bError = e;
          throw e;
        },
      );

    // ---------- Deterministic proof that B is BLOCKED on A's advisory lock ----------
    let stableHits = 0;
    let lastSnapshot = null;
    const deadline = Date.now() + BLOCK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (bSettled) break;
      const activity = await activityFor(observer, bPid);
      const locks = await advisoryLocksFor(observer, [aPid, bPid]);
      const aGrant = locks.find((l) => l.pid === aPid && l.granted);
      const bWait = locks.find((l) => l.pid === bPid && !l.granted);
      lastSnapshot = { activity, aGrant, bWait };
      const blockedOnSameAdvisoryKey =
        activity &&
        activity.state === 'active' &&
        activity.wait_event_type === 'Lock' &&
        activity.wait_event === 'advisory' &&
        Boolean(aGrant) &&
        Boolean(bWait) &&
        aGrant.objid === bWait.objid;
      stableHits = blockedOnSameAdvisoryKey ? stableHits + 1 : 0;
      if (stableHits >= STABLE_POLLS_REQUIRED) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (bSettled) {
      failures.push(
        'SERIALIZATION MISSING: connection B settled while A was still uncommitted ' +
          `(settled=${bSettled}, error=${bError ? `${bError.code ?? ''} ${bError.message}` : 'none'})`,
      );
    } else {
      const s = lastSnapshot ?? {};
      check(
        stableHits >= STABLE_POLLS_REQUIRED && s.activity && s.activity.wait_event_type === 'Lock',
        `B never observed blocked on the advisory lock (last snapshot: ${JSON.stringify(lastSnapshot)})`,
      );
      check(
        Boolean(s.aGrant && s.bWait && s.aGrant.objid === s.bWait.objid),
        `advisory key mismatch or missing wait entry (last snapshot: ${JSON.stringify(lastSnapshot)})`,
      );
      if (failures.length === 0) {
        evidence.push(
          `B pid=${bPid} observed blocked: state=active wait_event_type=Lock wait_event=${s.activity.wait_event}, ` +
            `ungranted advisory objid=${s.bWait.objid} identical to A's granted objid (${STABLE_POLLS_REQUIRED} stable polls)`,
        );
      }
    }

    // ---------- COMMIT A; B must resume and reject at the cap ----------
    if (!bSettled || failures.length === 0) {
      await connA.query('COMMIT');
      txAOpen = false;

      await Promise.allSettled([attemptBPromise]);

      check(
        bError !== null,
        'cap enforcement: connection B succeeded after A committed (expected P0001 cap rejection)',
      );
      check(
        bResultRow === null,
        'cap enforcement: connection B returned a club row (expected none)',
      );
      if (bError) {
        check(bError.code === 'P0001', `expected SQLSTATE P0001, got ${bError.code}`);
        check(
          bError.message === 'Membership tier club creation limit reached',
          `expected cap message 'Membership tier club creation limit reached', got '${bError.message}'`,
        );
        evidence.push(
          `after COMMIT A: B resumed and rejected with SQLSTATE=${bError.code} message='${bError.message}'`,
        );
      }
    } else {
      // Already failing on the blocking phase; still settle B safely.
      await Promise.allSettled([attemptBPromise]);
    }

    // ---------- Final assertions ----------
    const finalCount = await countQualifyingClubs(observer, actor.userId);
    check(finalCount === 5, `final count: expected exactly 5 qualifying clubs, found ${finalCount}`);

    const persisted = await observer.query(
      `SELECT id FROM public.book_clubs WHERE admin_id = $1 AND COALESCE(is_archived, FALSE) = FALSE`,
      [actor.userId],
    );
    const persistedIds = persisted.rows.map((r) => r.id);
    check(persistedIds.includes(clubIdA), 'persistence: A\u2019s attempted club is the one persisted');
    const unexpected = persistedIds.filter((id) => id !== clubIdA && !seededIds.includes(id));
    check(unexpected.length === 0, `persistence: unexpected extra club rows ${JSON.stringify(unexpected)}`);

    const memberRows = await observer.query(
      `SELECT cm.club_id, cm.user_id, cm.role
         FROM public.club_members cm
         JOIN public.book_clubs bc ON bc.id = cm.club_id
        WHERE bc.admin_id = $1`,
      [actor.userId],
    );
    check(memberRows.rows.length === 5, `orphans: expected 5 admin membership rows, found ${memberRows.rows.length}`);
    const foreignMembers = memberRows.rows.filter(
      (r) => r.user_id !== actor.userId || !persistedIds.includes(r.club_id),
    );
    check(foreignMembers.length === 0, `orphans: membership rows outside the 5 expected pairs: ${JSON.stringify(foreignMembers)}`);
    if (failures.length === 0) {
      evidence.push(`final state: 5 qualifying clubs, 5 admin membership rows, no orphans, no unexpected SQLSTATE`);
    }
  } finally {
    for (const [conn, openFlag] of [
      [connA, () => txAOpen],
      [connB, () => txBOpen],
    ]) {
      try {
        if (openFlag()) await conn.query('ROLLBACK');
      } catch { /* best effort */ }
    }
    await Promise.allSettled([observer.end(), connA.end(), connB.end()]);
  }

  console.log('[B02] deterministic race evidence:');
  for (const line of evidence) console.log(`[B02]   · ${line}`);

  if (failures.length > 0) {
    console.error(`[B02] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[B02]   ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log('[B02] PASS: one creation committed, one P0001 cap rejection, final count = 5, no orphans.');
  }
}

main().catch((e) => {
  console.error('[B02] infrastructure/bootstrap failure:', e);
  process.exit(2);
});
