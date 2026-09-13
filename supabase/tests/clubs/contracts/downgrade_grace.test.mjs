#!/usr/bin/env node
/**
 * CLUB-WU-TC01 · contract/downgrade_grace.test.mjs
 *
 * DOWNGRADE/GRACE LIFECYCLE CONTRACT (migration-boundary RED→GREEN design)
 * against a disposable local PostgreSQL 17 booted by clubsL4Runner.mjs.
 *
 * Subsystem under test: public.process_club_downgrade_grace_period
 * (migration 20260529170000_club_downgrade_grace_period.sql) and the
 * forward bug-fix migration
 * 20260830090435_clubs_fix_downgrade_grace_archived_club_ids_ambiguity.sql.
 *
 * Known defect (context-gate proven): the RETURNS TABLE OUT parameter
 * `archived_club_ids` collides with the target-table column
 * club_downgrade_grace_events.archived_club_ids in the existing-warning
 * grace-event UPDATE. With default plpgsql.variable_conflict=error EVERY
 * non-dry-run invocation that reaches that UPDATE fails with SQLSTATE
 * 42702 — both the benign repeat-before-deadline refresh AND
 * expired-deadline remediation. Because the whole invocation is one
 * transaction, the book_clubs archive UPDATE that runs first is rolled
 * back: NO partial remediation ever persists.
 *
 * PHASES (chosen by CLUBS_L4_DOWNGRADE_PHASE; the runner sequences both
 * against ONE disposable database):
 *   red   — applied on the PRE-FIX chain. Proves: compliant baseline,
 *           dry-run no-write, first-warning creation, then the two RED
 *           controls (repeat-before-deadline 42702, expired-remediation
 *           42702) WITH persisted-state rollback proofs, and the batch
 *           abort proof (p_user_id=NULL rolls back prior user writes).
 *   green — run by the runner AFTER applying the forward fix migration
 *           to the SAME database/state. Proves: repeat-before-deadline
 *           keeps the original deadline, dry-run over an existing warning
 *           row writes nothing, expired remediation archives exactly the
 *           deterministic oldest excess club, post-remediation idempotent
 *           compliant run, become-compliant-before-deadline transition,
 *           multi-excess (7→archive 2 oldest), id-DESC tie-breaker, and
 *           batch mode (cron parity: p_user_id=NULL processes every user,
 *           remediating the RED-phase-stuck warning).
 *
 * Fixture authority: actors/club creation follows actors.mjs house style
 * (create_club RPC through actAs); EXCESS clubs cannot exist through the
 * creation RPC because the B02 entitlement trigger blocks over-cap
 * creation by design — they are seeded by direct superuser INSERT with
 * session_replication_role=replica (platform-fixture authority, same
 * category as actors.mjs membership bypass), with fully deterministic
 * ids and created_at values so no assertion depends on insertion timing.
 * Backdating grace_deadline_at uses the same superuser fixture authority.
 *
 * Exit codes: 0 pass · 1 contract failure · infrastructure failures
 * propagate as nonzero via thrown errors.
 */
import { Client } from 'pg';
import { actAs, createQualifyingClubs, countQualifyingClubs } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;
const PHASE = process.env.CLUBS_L4_DOWNGRADE_PHASE;
const GRACE_DAYS = 14;

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
  throw new Error(`CLUBS_L4_DOWNGRADE_PHASE must be 'red' or 'green', got '${PHASE ?? ''}'`);
}

// ---------------------------------------------------------------------------
// Deterministic fixture identity (stable across RED and GREEN processes)
// ---------------------------------------------------------------------------
const U1 = 'd1000000-0000-4000-8000-000000000001'; // 6 clubs: RED warning/42702 victim, GREEN batch remediation
const U2 = 'd2000000-0000-4000-8000-000000000002'; // 6 clubs: GREEN repeat-before-deadline + remediation + idempotency
const U3 = 'd3000000-0000-4000-8000-000000000003'; // 6 clubs: GREEN become-compliant-before-deadline
const U4 = 'd4000000-0000-4000-8000-000000000004'; // 7 clubs: GREEN multi-excess (archive 2 oldest)
const U5 = 'd5000000-0000-4000-8000-000000000005'; // 6 clubs: GREEN tie-breaker (identical created_at pair)

const EX1 = 'e1000000-0000-4000-8000-000000000001'; // U1 excess (oldest)
const EX2 = 'e2000000-0000-4000-8000-000000000001'; // U2 excess (oldest)
const EX3 = 'e3000000-0000-4000-8000-000000000001'; // U3 excess (fixture-archived to become compliant)
const EX4A = 'e4000000-0000-4000-8000-000000000001'; // U4 excess oldest (-12d)
const EX4B = 'e4000000-0000-4000-8000-000000000002'; // U4 excess second (-11d)
const T5A = 'e5000000-0000-4000-8000-000000000001'; // U5 tie pair LOW id (expected archived)
const T5B = 'e5000000-0000-4000-8000-000000000002'; // U5 tie pair HIGH id (expected retained)

const ALLOWED = 5; // pro allowance

// ---------------------------------------------------------------------------
// Assertion scaffolding (house style: failures[] + evidence[])
// ---------------------------------------------------------------------------
const failures = [];
const evidence = [];
const check = (cond, msg) => {
  if (!cond) failures.push(msg);
  return cond;
};
const idSet = (arr) => [...arr].sort().join(',');
const asIdArray = (v) => (Array.isArray(v) ? v.map(String) : []);

// ---------------------------------------------------------------------------
// Fixture helpers (superuser fixture authority; scope-fenced)
// ---------------------------------------------------------------------------
async function ensureFixedActor(client, userId, tier = 'pro') {
  await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  await client.query(
    `INSERT INTO user_profiles (user_id, display_name, city, email, membership_tier)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, `TC01 Actor ${userId.slice(0, 8)}`, 'Testville', `${userId}@clubs-l4.invalid`, tier],
  );
}

/**
 * Seed one over-cap club DIRECTLY as superuser. The B02 entitlement trigger
 * intentionally blocks over-cap creation through create_club, so excess
 * clubs are platform-fixture inserts (session_replication_role bypasses
 * triggers), mirroring the real-world origin of excess clubs: a tier
 * downgrade with existing clubs. created_at is explicit and deterministic.
 */
async function seedExcessClub(client, { id, adminId, name, ageInterval }) {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(
      `INSERT INTO book_clubs (id, admin_id, name, club_type, created_at, updated_at)
       VALUES ($1, $2, $3, 'public', now() - $4::interval, now() - $4::interval)`,
      [id, adminId, name, ageInterval],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

/** Normalize RPC-created clubs to one deterministic created_at (retained-newest group). */
async function pinClubsCreatedAt(client, clubIds, ageInterval) {
  await client.query('BEGIN');
  try {
    await client.query(
      `UPDATE book_clubs SET created_at = now() - $1::interval, updated_at = now() - $1::interval
        WHERE id = ANY($2::uuid[])`,
      [ageInterval, clubIds],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

/** Fixture-authority archive (used by the become-compliant scenario). */
async function fixtureArchiveClub(client, clubId) {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL session_replication_role = replica');
    await client.query(
      `UPDATE book_clubs SET is_archived = true, archived_at = now(), updated_at = now() WHERE id = $1`,
      [clubId],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

/** Backdate an existing warning row's deadline (fixture authority). */
async function backdateDeadline(client, userId) {
  await client.query(
    `UPDATE club_downgrade_grace_events
        SET grace_deadline_at = now() - interval '1 day'
      WHERE user_id = $1 AND status = 'warning'`,
    [userId],
  );
}

// ---------------------------------------------------------------------------
// Invocation + readback helpers
// ---------------------------------------------------------------------------
async function invoke(observer, pUserId, dryRun) {
  const res = await observer.query(
    `SELECT * FROM public.process_club_downgrade_grace_period($1::uuid, $2::int, $3::boolean)`,
    [pUserId, GRACE_DAYS, dryRun],
  );
  return res.rows;
}

/** Expected-failure invocation on a dedicated connection (transaction aborts). */
async function invokeExpectFailure(client, pUserId, dryRun) {
  let err = null;
  try {
    await client.query(
      `SELECT * FROM public.process_club_downgrade_grace_period($1::uuid, $2::int, $3::boolean)`,
      [pUserId, GRACE_DAYS, dryRun],
    );
  } catch (e) {
    err = e;
  } finally {
    await client.query('ROLLBACK').catch(() => {});
  }
  return err;
}

async function graceRows(observer, userId) {
  const res = await observer.query(
    `SELECT id, user_id, status, current_count, max_allowed, first_detected_at, last_checked_at,
            grace_deadline_at, remediated_at, archived_club_ids, metadata
       FROM public.club_downgrade_grace_events
      WHERE ($1::uuid IS NULL OR user_id = $1::uuid)
      ORDER BY first_detected_at`,
    [userId],
  );
  return res.rows;
}

async function archivedClubs(observer, userId) {
  const res = await observer.query(
    `SELECT id, is_archived, archived_at FROM book_clubs
      WHERE admin_id = $1 AND coalesce(is_archived, false) = true`,
    [userId],
  );
  return res.rows;
}

async function activeClubs(observer, userId) {
  const res = await observer.query(
    `SELECT id, is_archived, archived_at FROM book_clubs
      WHERE admin_id = $1 AND coalesce(is_archived, false) = false`,
    [userId],
  );
  return res.rows;
}

async function totalArchived(observer) {
  const res = await observer.query(
    `SELECT count(*)::int AS n FROM book_clubs WHERE coalesce(is_archived, false) = true`,
  );
  return res.rows[0].n;
}

// ---------------------------------------------------------------------------
// Phase implementations
// ---------------------------------------------------------------------------
async function redPhase(observer, failConn) {
  // ---------- Fixtures ----------
  for (const u of [U1, U2, U3, U4, U5]) await ensureFixedActor(observer, u);

  // ---------- S1: COMPLIANT BASELINE (U1 before seeding: 0 clubs) ----------
  const beforeS1 = new Date();
  let rows = await invoke(observer, U1, false);
  const afterS1 = new Date();
  check(rows.length === 1, `S1: expected 1 returned row, got ${rows.length}`);
  if (rows.length === 1) {
    const r = rows[0];
    check(r.user_id === U1, 'S1: wrong user_id');
    check(r.status === 'compliant', `S1: expected status compliant, got '${r.status}'`);
    check(r.current_count === 0, `S1: expected current_count 0, got ${r.current_count}`);
    check(r.max_allowed === ALLOWED, `S1: expected max_allowed ${ALLOWED}, got ${r.max_allowed}`);
    check(
      r.grace_deadline_at.getTime() >= beforeS1.getTime() + GRACE_DAYS * 86400_000 - 5_000 &&
        r.grace_deadline_at.getTime() <= afterS1.getTime() + GRACE_DAYS * 86400_000 + 5_000,
      'S1: returned deadline not approximately now+14d',
    );
  }
  check((await graceRows(observer, U1)).length === 0, 'S1: compliant baseline must not persist grace rows');
  check((await totalArchived(observer)) === 0, 'S1: compliant baseline archived clubs');
  evidence.push('S1 compliant baseline: return row compliant 0/5, 0 persisted rows, 0 archived');

  // ---------- Seed U1: 5 RPC clubs + 1 direct excess ----------
  await actAs(observer, U1);
  const u1Retained = await createQualifyingClubs(observer, U1, 5);
  await pinClubsCreatedAt(observer, u1Retained, '1 day');
  await seedExcessClub(observer, { id: EX1, adminId: U1, name: 'TC01 U1 excess oldest', ageInterval: '10 days' });
  check((await countQualifyingClubs(observer, U1)) === 6, 'fixture: U1 expected 6 qualifying clubs');
  // Predetermined oldest by (created_at, id): EX1 is strictly oldest — verify from data, not assumption.
  const u1OldestRow = await observer.query(
    `SELECT id FROM book_clubs WHERE admin_id = $1 AND coalesce(is_archived,false)=false
      ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1`, [U1]);
  check(u1OldestRow.rows[0].id === EX1, `fixture: U1 oldest active club expected ${EX1}, got ${u1OldestRow.rows[0].id}`);
  evidence.push(`fixture U1: 6 clubs, predetermined oldest = ${EX1}`);

  // ---------- Seed U2/U3 (5+1), U4 (5+2), U5 (4+tie pair) ----------
  await actAs(observer, U2);
  const u2Retained = await createQualifyingClubs(observer, U2, 5);
  await pinClubsCreatedAt(observer, u2Retained, '1 day');
  await seedExcessClub(observer, { id: EX2, adminId: U2, name: 'TC01 U2 excess oldest', ageInterval: '10 days' });

  await actAs(observer, U3);
  const u3Retained = await createQualifyingClubs(observer, U3, 5);
  await pinClubsCreatedAt(observer, u3Retained, '1 day');
  await seedExcessClub(observer, { id: EX3, adminId: U3, name: 'TC01 U3 excess', ageInterval: '10 days' });

  await actAs(observer, U4);
  const u4Retained = await createQualifyingClubs(observer, U4, 5);
  await pinClubsCreatedAt(observer, u4Retained, '1 day');
  await seedExcessClub(observer, { id: EX4B, adminId: U4, name: 'TC01 U4 excess second', ageInterval: '11 days' });
  await seedExcessClub(observer, { id: EX4A, adminId: U4, name: 'TC01 U4 excess oldest', ageInterval: '12 days' });

  await actAs(observer, U5);
  const u5Retained = await createQualifyingClubs(observer, U5, 4);
  await pinClubsCreatedAt(observer, u5Retained, '1 day');
  await seedExcessClub(observer, { id: T5A, adminId: U5, name: 'TC01 U5 tie LOW id', ageInterval: '10 days' });
  await seedExcessClub(observer, { id: T5B, adminId: U5, name: 'TC01 U5 tie HIGH id', ageInterval: '10 days' });

  // ---------- S2: DRY-RUN (U1, 6 clubs) — no persistent state ----------
  rows = await invoke(observer, U1, true);
  check(rows.length === 1 && rows[0].status === 'warning', `S2: dry-run expected warning row, got ${JSON.stringify(rows)}`);
  if (rows.length === 1) {
    check(rows[0].current_count === 6, `S2: dry-run current_count expected 6, got ${rows[0].current_count}`);
    check(rows[0].max_allowed === ALLOWED, `S2: dry-run max_allowed expected ${ALLOWED}, got ${rows[0].max_allowed}`);
    check(asIdArray(rows[0].archived_club_ids).length === 0, 'S2: dry-run (deadline future) must return empty archived ids');
  }
  check((await graceRows(observer, null)).length === 0, 'S2: dry-run persisted a grace row');
  check((await totalArchived(observer)) === 0, 'S2: dry-run archived clubs');
  const u1ActiveAfterDry = await activeClubs(observer, U1);
  check(u1ActiveAfterDry.every((c) => c.archived_at === null), 'S2: dry-run set archived_at on an active club');
  evidence.push('S2 dry-run: warning returned 6/5, zero persisted rows, zero archived clubs, archived_at untouched');

  // ---------- S3: FIRST REAL WARNING ----------
  const beforeS3 = new Date();
  rows = await invoke(observer, U1, false);
  const afterS3 = new Date();
  check(rows.length === 1 && rows[0].status === 'warning', `S3: expected warning return, got ${JSON.stringify(rows)}`);
  const persisted = await graceRows(observer, U1);
  check(persisted.length === 1, `S3: expected exactly 1 warning row, got ${persisted.length}`);
  const warning = persisted[0] ?? null;
  if (warning) {
    check(warning.status === 'warning', `S3: persisted status expected warning, got '${warning.status}'`);
    check(warning.current_count === 6 && warning.max_allowed === ALLOWED, 'S3: wrong snapshot counts');
    check(asIdArray(warning.archived_club_ids).length === 0, 'S3: warning row archived_club_ids not empty');
    check(warning.remediated_at === null, 'S3: warning row remediated_at not null');
    check(
      warning.grace_deadline_at.getTime() >= beforeS3.getTime() + GRACE_DAYS * 86400_000 - 5_000 &&
        warning.grace_deadline_at.getTime() <= afterS3.getTime() + GRACE_DAYS * 86400_000 + 5_000,
      'S3: persisted deadline not approximately now+14d',
    );
  }
  check((await totalArchived(observer)) === 0, 'S3: first warning archived clubs');
  evidence.push(`S3 first real run: warning row persisted (${warning?.id}), deadline now+14d, no archives`);

  // ---------- S4: PRE-FIX RED — repeat BEFORE deadline ----------
  const err4 = await invokeExpectFailure(failConn, U1, false);
  check(err4 !== null, 'S4: expected the repeat invocation to FAIL pre-fix, but it succeeded');
  if (err4) {
    check(err4.code === '42702', `S4: expected SQLSTATE 42702, got '${err4.code ?? ''}'`);
    check(
      typeof err4.message === 'string' && err4.message.includes('column reference "archived_club_ids" is ambiguous'),
      `S4: unexpected error message: '${err4.message}'`,
    );
    evidence.push(`S4 RED repeat-before-deadline: SQLSTATE=${err4.code} message='${err4.message}'`);
  }
  // Rollback proof via fresh observer readback
  const after4 = await graceRows(observer, U1);
  check(after4.length === 1, `S4: warning row count changed after failed repeat (${after4.length})`);
  if (warning && after4.length === 1) {
    check(after4[0].grace_deadline_at.getTime() === warning.grace_deadline_at.getTime(), 'S4: deadline changed');
    check(after4[0].last_checked_at.getTime() === warning.last_checked_at.getTime(), 'S4: last_checked_at changed');
    check(after4[0].status === 'warning', `S4: status changed to '${after4[0].status}'`);
  }
  check((await totalArchived(observer)) === 0, 'S4: failed repeat archived clubs');
  evidence.push('S4 rollback proof: row untouched (deadline/last_checked_at/status byte-equal), 0 archived');

  // ---------- S5: PRE-FIX RED — expired remediation ----------
  await backdateDeadline(observer, U1);
  const backdated = (await graceRows(observer, U1))[0];
  const preS5 = {
    deadline: backdated.grace_deadline_at,
    lastChecked: backdated.last_checked_at,
  };
  const err5 = await invokeExpectFailure(failConn, U1, false);
  check(err5 !== null, 'S5: expected the expired-deadline invocation to FAIL pre-fix, but it succeeded');
  if (err5) {
    check(err5.code === '42702', `S5: expected SQLSTATE 42702, got '${err5.code ?? ''}'`);
    check(
      typeof err5.message === 'string' && err5.message.includes('column reference "archived_club_ids" is ambiguous'),
      `S5: unexpected error message: '${err5.message}'`,
    );
    evidence.push(`S5 RED expired remediation: SQLSTATE=${err5.code} message='${err5.message}'`);
  }
  // Rollback / no-partial-archive proof
  const after5 = await graceRows(observer, U1);
  check(after5.length === 1, `S5: warning row count changed after failed remediation (${after5.length})`);
  if (after5.length === 1) {
    check(after5[0].status === 'warning', `S5: status changed to '${after5[0].status}'`);
    check(after5[0].grace_deadline_at.getTime() === preS5.deadline.getTime(), 'S5: backdated deadline changed by failed run');
    check(after5[0].last_checked_at.getTime() === preS5.lastChecked.getTime(), 'S5: last_checked_at changed by failed run');
    check(asIdArray(after5[0].archived_club_ids).length === 0, 'S5: archived_club_ids changed by failed run');
    check(after5[0].remediated_at === null, 'S5: remediated_at set by failed run');
  }
  check((await archivedClubs(observer, U1)).length === 0, 'S5: failed remediation left archived clubs (partial archive persisted!)');
  check((await totalArchived(observer)) === 0, 'S5: partial archive persisted at database scope');
  const u1Active = await activeClubs(observer, U1);
  check(u1Active.every((c) => c.archived_at === null), 'S5: archived_at changed on an active club');
  evidence.push('S5 rollback proof: book_clubs archive UPDATE rolled back — no partial remediation persists');

  // ---------- S6: PRE-FIX RED — BATCH (cron parity) abort ----------
  const err6 = await invokeExpectFailure(failConn, null, false);
  check(err6 !== null, 'S6: expected the batch invocation to FAIL pre-fix, but it succeeded');
  if (err6) {
    check(err6.code === '42702', `S6: expected SQLSTATE 42702 in batch mode, got '${err6.code ?? ''}'`);
    evidence.push(`S6 RED batch: SQLSTATE=${err6.code}`);
  }
  const u2RowsAfterBatch = await graceRows(observer, U2);
  check(u2RowsAfterBatch.length === 0, `S6: batch rollback failed — U2 has ${u2RowsAfterBatch.length} grace row(s) after the failed batch`);
  check((await graceRows(observer, U1)).length === 1, 'S6: U1 warning row lost after failed batch');
  check((await totalArchived(observer)) === 0, 'S6: batch failure left archived clubs');
  evidence.push('S6 batch abort proof: one failing user aborts the whole invocation; prior user writes rolled back');

  return { warning };
}

async function greenPhase(observer, failConn) {
  // ---------- S7: POST-FIX repeat BEFORE deadline (U2, fresh warning) ----------
  let rows = await invoke(observer, U2, false);
  check(rows.length === 1 && rows[0].status === 'warning', `S7: expected warning, got ${JSON.stringify(rows)}`);
  let u2row = (await graceRows(observer, U2))[0];
  check(u2row && u2row.status === 'warning', 'S7: U2 warning row missing');
  const deadline1 = u2row.grace_deadline_at.getTime();

  rows = await invoke(observer, U2, false);
  check(rows.length === 1 && rows[0].status === 'warning', `S7: post-fix repeat should return warning, got ${JSON.stringify(rows)}`);
  u2row = (await graceRows(observer, U2))[0];
  check((await graceRows(observer, U2)).length === 1, 'S7: repeat created a second row');
  check(u2row.grace_deadline_at.getTime() === deadline1, 'S7: deadline was reset/extended by repeat — must stay fixed');
  check(u2row.current_count === 6 && u2row.max_allowed === ALLOWED, 'S7: repeat did not refresh counts');
  check((await totalArchived(observer)) === 0, 'S7: repeat archived clubs');
  evidence.push('S7 post-fix repeat-before-deadline: no 42702, same single row, deadline EXACTLY unchanged');

  // ---------- S7b: DRY-RUN over existing warning row — no writes ----------
  const preDry = u2row;
  rows = await invoke(observer, U2, true);
  check(rows.length === 1 && rows[0].status === 'warning', `S7b: dry-run expected warning, got ${JSON.stringify(rows)}`);
  const afterDry = (await graceRows(observer, U2))[0];
  check(afterDry.last_checked_at.getTime() === preDry.last_checked_at.getTime(), 'S7b: dry-run updated last_checked_at');
  check((await graceRows(observer, U2)).length === 1, 'S7b: dry-run wrote rows');
  check((await totalArchived(observer)) === 0, 'S7b: dry-run archived clubs');
  evidence.push('S7b dry-run over existing warning row: zero writes (fix-independent invariant holds)');

  // ---------- S8: POST-FIX REMEDIATION (U2, expired) ----------
  await backdateDeadline(observer, U2);
  rows = await invoke(observer, U2, false);
  check(rows.length === 1 && rows[0].status === 'remediated', `S8: expected remediated, got ${JSON.stringify(rows)}`);
  const u2Archived = await archivedClubs(observer, U2);
  check(u2Archived.length === 1, `S8: expected exactly 1 archived club for U2, got ${u2Archived.length}`);
  check(u2Archived[0]?.id === EX2, `S8: expected oldest ${EX2} archived, got ${u2Archived[0]?.id}`);
  check(u2Archived[0]?.archived_at !== null, 'S8: archived_at is NULL on remediated club');
  const u2After = (await graceRows(observer, U2))[0];
  check(u2After.status === 'remediated', `S8: row status expected remediated, got '${u2After.status}'`);
  check(idSet(asIdArray(u2After.archived_club_ids)) === idSet([EX2]), `S8: archived_club_ids mismatch: ${u2After.archived_club_ids}`);
  check(u2After.remediated_at !== null, 'S8: remediated_at is NULL');
  const u2RetainedRows = await activeClubs(observer, U2);
  check(u2RetainedRows.length === 5, `S8: expected 5 retained active clubs, got ${u2RetainedRows.length}`);
  check(u2RetainedRows.every((c) => c.archived_at === null), 'S8: retained club has archived_at set');
  evidence.push(`S8 post-fix remediation: exactly 1 archived (${EX2}, oldest), archived_at+remediated_at set, retained untouched`);

  // ---------- S9: IDEMPOTENT POST-REMEDIATION RUN ----------
  rows = await invoke(observer, U2, false);
  check(rows.length === 1 && rows[0].status === 'compliant', `S9: expected compliant, got ${JSON.stringify(rows)}`);
  if (rows.length === 1) {
    check(rows[0].current_count === 5 && rows[0].max_allowed === ALLOWED, `S9: expected 5/${ALLOWED}, got ${rows[0].current_count}/${rows[0].max_allowed}`);
  }
  check((await graceRows(observer, U2)).length === 1, 'S9: new grace row created after remediation');
  check((await archivedClubs(observer, U2)).length === 1, 'S9: additional club archived after remediation');
  evidence.push('S9 post-remediation idempotency: compliant 5/5, no new rows, no further archives');

  // ---------- S10: BECOME COMPLIANT BEFORE DEADLINE (U3) ----------
  rows = await invoke(observer, U3, false);
  check(rows.length === 1 && rows[0].status === 'warning', `S10: expected warning, got ${JSON.stringify(rows)}`);
  const u3Deadline = (await graceRows(observer, U3))[0].grace_deadline_at.getTime();
  await fixtureArchiveClub(observer, EX3); // user remediates manually (fixture authority)
  rows = await invoke(observer, U3, false);
  check(rows.length === 1 && rows[0].status === 'compliant', `S10: expected compliant, got ${JSON.stringify(rows)}`);
  const u3row = (await graceRows(observer, U3))[0];
  check(u3row.status === 'compliant', `S10: row status expected compliant, got '${u3row.status}'`);
  check(
    u3row.metadata && u3row.metadata.resolved_reason === 'count_within_limit',
    `S10: metadata.resolved_reason missing: ${JSON.stringify(u3row.metadata)}`,
  );
  check(u3row.grace_deadline_at.getTime() === u3Deadline, 'S10: deadline was reset on compliant transition');
  check((await archivedClubs(observer, U3)).length === 1, 'S10: function performed a downgrade archive (only the fixture archive may exist)');
  check((await activeClubs(observer, U3)).length === 5, 'S10: U3 active count expected 5');
  evidence.push('S10 become-compliant-before-deadline: warning→compliant, resolved_reason=count_within_limit, deadline preserved, no downgrade archive');

  // ---------- S11: MULTI-EXCESS (U4: 7 clubs → archive exactly 2 oldest) ----------
  rows = await invoke(observer, U4, false);
  check(rows.length === 1 && rows[0].status === 'warning', `S11: expected warning, got ${JSON.stringify(rows)}`);
  await backdateDeadline(observer, U4);
  rows = await invoke(observer, U4, false);
  check(rows.length === 1 && rows[0].status === 'remediated', `S11: expected remediated, got ${JSON.stringify(rows)}`);
  const u4Archived = await archivedClubs(observer, U4);
  check(u4Archived.length === 2, `S11: expected exactly 2 archived clubs for U4, got ${u4Archived.length}`);
  check(idSet(u4Archived.map((c) => c.id)) === idSet([EX4A, EX4B]), `S11: archived set mismatch: ${u4Archived.map((c) => c.id)}`);
  check(u4Archived.every((c) => c.archived_at !== null), 'S11: archived_at NULL on a remediated club');
  const u4row = (await graceRows(observer, U4))[0];
  check(u4row.status === 'remediated' && u4row.remediated_at !== null, 'S11: U4 row not remediated');
  check(idSet(asIdArray(u4row.archived_club_ids)) === idSet([EX4A, EX4B]), `S11: row archived_club_ids mismatch: ${u4row.archived_club_ids}`);
  check((await activeClubs(observer, U4)).length === 5, 'S11: U4 retained active count expected 5');
  evidence.push(`S11 multi-excess: 7→5, archived exactly the two oldest (${EX4A}, ${EX4B}) as a SET`);

  // ---------- S12: TIE-BREAKER (U5: identical created_at pair) ----------
  rows = await invoke(observer, U5, false);
  check(rows.length === 1 && rows[0].status === 'warning', `S12: expected warning, got ${JSON.stringify(rows)}`);
  await backdateDeadline(observer, U5);
  rows = await invoke(observer, U5, false);
  check(rows.length === 1 && rows[0].status === 'remediated', `S12: expected remediated, got ${JSON.stringify(rows)}`);
  const u5Archived = await archivedClubs(observer, U5);
  check(u5Archived.length === 1, `S12: expected exactly 1 archived club for U5, got ${u5Archived.length}`);
  check(u5Archived[0]?.id === T5A, `S12: id-DESC tie-break expected ${T5A} (lower id) archived, got ${u5Archived[0]?.id}`);
  evidence.push(`S12 tie-breaker: identical created_at pair resolved deterministically by id DESC (${T5A} archived, ${T5B} retained)`);

  // ---------- S13: BATCH MODE (cron parity, p_user_id=NULL) ----------
  // U1 still carries the RED-phase-stuck expired warning — the fix must unblock it.
  rows = await invoke(observer, null, false);
  check(rows.length === 5, `S13: batch expected 5 returned rows (one per profile), got ${rows.length}`);
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  for (const u of [U1, U2, U3, U4, U5]) {
    check(byUser.has(u), `S13: batch did not return a row for ${u}`);
  }
  check(byUser.get(U1)?.status === 'remediated', `S13: U1 expected remediated in batch, got '${byUser.get(U1)?.status}'`);
  check(idSet(asIdArray(byUser.get(U1)?.archived_club_ids ?? [])) === idSet([EX1]), `S13: U1 batch archived ids mismatch`);
  const u1Archived = await archivedClubs(observer, U1);
  check(u1Archived.length === 1 && u1Archived[0].id === EX1, 'S13: U1 oldest club not archived by batch');
  // Every user must end within allowance; no warning rows may remain anywhere.
  for (const u of [U1, U2, U3, U4, U5]) {
    const n = await countQualifyingClubs(observer, u);
    check(n === 5, `S13: ${u} final qualifying count expected 5, got ${n}`);
    const warns = (await graceRows(observer, u)).filter((r) => r.status === 'warning');
    check(warns.length === 0, `S13: ${u} still has ${warns.length} warning row(s) after batch`);
  }
  check(
    (await totalArchived(observer)) === 6,
    `S13: global archived total expected 6 (EX1,EX2,fixture EX3,EX4A,EX4B,T5A), got ${await totalArchived(observer)}`,
  );
  evidence.push('S13 batch mode: all 5 users processed in one invocation; RED-phase-stuck U1 remediated; everyone within allowance; zero warning rows remain');
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

  console.log(`[TC01:${PHASE}] evidence:`);
  for (const line of evidence) console.log(`[TC01:${PHASE}]   · ${line}`);

  if (failures.length > 0) {
    console.error(`[TC01:${PHASE}] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[TC01:${PHASE}]   ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(
      PHASE === 'red'
        ? '[TC01:red] PASS: 42702 reproduced on repeat + expired + batch paths; rollback/no-partial-archive proven; dry-run and warning creation correct.'
        : '[TC01:green] PASS: full post-fix lifecycle green — deadline stability, exact-oldest remediation, idempotency, compliant-early, multi-excess, tie-break, batch cron parity.',
    );
  }
}

main().catch((e) => {
  console.error('[TC01] infrastructure/bootstrap failure:', e);
  process.exit(2);
});
