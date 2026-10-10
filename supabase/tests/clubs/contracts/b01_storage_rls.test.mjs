#!/usr/bin/env node
/**
 * CLUB-WU-L01-C · B01 club-banners Storage RLS contract
 *
 * Verifies REAL PostgreSQL RLS evaluation via SET ROLE + request.jwt.claim.sub.
 * Uses actual repository migration 20260822233000_clubs_b01_banner_storage_lockdown.sql
 * applied by clubsL4Runner.mjs against disposable PG17, plus minimal
 * platform substrate (storage schema/objects/foldername).
 *
 * Matrix exercised:
 *  1. ADMIN OF CLUB A → may write Club A banner (WITH CHECK manager predicate)
 *  2. ADMIN OF CLUB B → must NOT write Club A banner (cross-club)
 *  3. OUTSIDER        → must NOT write Club A banner (no membership)
 *  4. ANONYMOUS/PUBLIC READ → exactly what live policy permits (public SELECT)
 *
 * For every case assert BOTH operation result AND persisted row existence.
 * Real RLS: SET ROLE authenticated/anon, service_role/BYPASSRLS never used for assertion.
 * RED proof: temporary narrow mutation removing only the ownership/manager predicate,
 * then unauthorized actor can INSERT → contract would go RED.
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { ensureActor, createQualifyingClubs } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;
const EXPECT_FIDELITY_MISMATCH = process.env.CLUBS_L4_RLS_EXPECT_MISMATCH === '1';

function assertLocality(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('CLUBS_L4_DATABASE_URL invalid'); }
  const hostOk = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  const dbOk = parsed.pathname.startsWith('/clubs_l4_');
  if (!hostOk || !dbOk) throw new Error(`Locality guard violated: ${parsed.hostname}${parsed.pathname}`);
}

async function queryAsRole(databaseUrl, role, userId, sql, params = []) {
  const c = new Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    await c.query(`SET ROLE ${role}`);
    if (userId) {
      await c.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
      await c.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
    } else {
      await c.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
      await c.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
    }
    const res = await c.query(sql, params);
    return { ok: true, rows: res.rows, rowCount: res.rowCount };
  } catch (e) {
    return { ok: false, error: e, code: e.code, message: e.message };
  } finally {
    try { await c.query('RESET ROLE'); } catch {}
    await c.end().catch(() => {});
  }
}

async function storageInsertAs(databaseUrl, role, userId, bucketId, objectName) {
  return queryAsRole(
    databaseUrl,
    role,
    userId,
    `INSERT INTO storage.objects (bucket_id, name, owner, owner_id) VALUES ($1, $2, $3, $3) RETURNING id, bucket_id, name`,
    [bucketId, objectName, userId]
  );
}

async function storageSelectAs(databaseUrl, role, userId, whereClause = `bucket_id='club-banners'`) {
  return queryAsRole(databaseUrl, role, userId, `SELECT id, bucket_id, name, owner FROM storage.objects WHERE ${whereClause}`);
}

async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL is required');
  assertLocality(DATABASE_URL);

  const failures = [];
  const evidence = [];
  const check = (cond, msg) => { if (!cond) failures.push(msg); return cond; };

  const superuser = new Client({ connectionString: DATABASE_URL });
  await superuser.connect();

  // Track original policy defs for RED restore
  let originalInsertDef = null;
  let originalUpdateDef = null;
  let originalDeleteDef = null;
  let originalSelectDef = null;

  try {
    // ── LIVE VS LOCAL FIDELITY PRE-CHECKS ──────────────────────────────
    const rlsState = await superuser.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname='objects'`
    );
    check(rlsState.rows[0]?.relrowsecurity === true, `storage.objects RLS not enabled (got ${JSON.stringify(rlsState.rows[0])})`);
    evidence.push(`storage.objects RLS enabled=${rlsState.rows[0]?.relrowsecurity} force=${rlsState.rows[0]?.relforcerowsecurity}`);

    const policies = await superuser.query(
      `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (policyname LIKE 'club_banners%') ORDER BY policyname`
    );
    const names = policies.rows.map(r => r.policyname).sort();
    check(names.includes('club_banners_admin_insert'), `missing club_banners_admin_insert (found ${names})`);
    check(names.includes('club_banners_admin_update'), `missing club_banners_admin_update`);
    check(names.includes('club_banners_admin_delete'), `missing club_banners_admin_delete`);
    check(names.includes('club_banners_public_read'), `missing club_banners_public_read`);
    // Exactly 4 club-banners policies expected; extra legacy permissive must not exist
    const expectedFour = ['club_banners_admin_delete','club_banners_admin_insert','club_banners_admin_update','club_banners_public_read'].sort();
    check(JSON.stringify(names)===JSON.stringify(expectedFour), `expected exactly 4 club_banners policies ${expectedFour}, got ${names}`);

    const insertPol = policies.rows.find(r=>r.policyname==='club_banners_admin_insert');
    const updatePol = policies.rows.find(r=>r.policyname==='club_banners_admin_update');
    const deletePol = policies.rows.find(r=>r.policyname==='club_banners_admin_delete');
    const selectPol = policies.rows.find(r=>r.policyname==='club_banners_public_read');

    check(insertPol?.with_check?.includes("bucket_id = 'club-banners'"), `insert with_check missing bucket scoping: ${insertPol?.with_check}`);
    check(insertPol?.with_check?.includes('is_active_eligible_club_manager'), `insert with_check missing manager predicate: ${insertPol?.with_check}`);
    check(insertPol?.with_check?.includes('storage.foldername'), `insert with_check missing foldername path logic: ${insertPol?.with_check}`);
    check(updatePol?.qual?.includes('is_active_eligible_club_manager'), `update USING missing manager: ${updatePol?.qual}`);
    check(updatePol?.with_check?.includes('is_active_eligible_club_manager'), `update WITH CHECK missing manager`);
    check(deletePol?.qual?.includes('is_active_eligible_club_manager'), `delete USING missing manager`);
    check(selectPol?.qual === "(bucket_id = 'club-banners'::text)" || selectPol?.qual?.includes("bucket_id = 'club-banners'"), `select USING unexpected: ${selectPol?.qual}`);
    check(selectPol?.roles?.includes('public'), `select role should be public, got ${selectPol?.roles}`);

    // Bucket scoping
    const bucket = await superuser.query(`SELECT id, public, file_size_limit FROM storage.buckets WHERE id='club-banners'`);
    check(bucket.rows[0]?.public === true, `club-banners bucket public should be true, got ${bucket.rows[0]?.public}`);
    evidence.push(`bucket club-banners public=${bucket.rows[0]?.public} file_size_limit=${bucket.rows[0]?.file_size_limit}`);

    // Helper function exists
    const fn = await superuser.query(`SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname='is_active_eligible_club_manager'`);
    check(fn.rows.length===1, `is_active_eligible_club_manager function missing`);
    check(fn.rows[0]?.def?.includes('can_user_hold_club_role'), `helper function body unexpected`);
    evidence.push('helper is_active_eligible_club_manager present');

    // storage.foldername exists
    const folderFn = await superuser.query(`SELECT proname FROM pg_proc WHERE proname='foldername' AND pronamespace='storage'::regnamespace`);
    check(folderFn.rows.length===1, 'storage.foldername function missing');

    if (failures.length>0 && !EXPECT_FIDELITY_MISMATCH) {
      console.error('[B01] FIDELITY PRE-CHECK FAILED');
      for (const f of failures) console.error(`[B01]   ✗ ${f}`);
      process.exit(1);
    } else if (failures.length>0) {
      console.log('[B01] fidelity mismatch expected (test harness)');
    }
    // Reset failures for contract phase if fidelity passed
    const fidelityFailures = [...failures];
    if (fidelityFailures.length===0) failures.length=0;

    // Save original policy SQL for RED restore (capture via pg_get_policydef if available, else reconstruct)
    const polDefRes = await superuser.query(
      `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'club_banners%'`
    );
    for (const r of polDefRes.rows) {
      if (r.policyname==='club_banners_admin_insert') originalInsertDef = r;
      if (r.policyname==='club_banners_admin_update') originalUpdateDef = r;
      if (r.policyname==='club_banners_admin_delete') originalDeleteDef = r;
      if (r.policyname==='club_banners_public_read') originalSelectDef = r;
    }

    // ── FIXTURE SETUP: two clubs, two admins, outsider ─────────────────
    const adminA = await ensureActor(superuser, { tier: 'pro' });
    const adminB = await ensureActor(superuser, { tier: 'pro' });
    const outsider = await ensureActor(superuser, { tier: 'pro' });

    // Create clubs via real RPC so entitlement path counted, then ensure membership rows
    // Create as respective admins
    await superuser.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [adminA.userId]);
    const clubARes = await superuser.query(
      `SELECT (public.create_club('L01C Club A','B01 fixture A',NULL,'public','all',NULL,$1::uuid,NULL,NULL,NULL)).id AS id`, [adminA.userId]);
    const clubA = clubARes.rows[0].id;
    await superuser.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [adminB.userId]);
    const clubBRes = await superuser.query(
      `SELECT (public.create_club('L01C Club B','B01 fixture B',NULL,'public','all',NULL,$1::uuid,NULL,NULL,NULL)).id AS id`, [adminB.userId]);
    const clubB = clubBRes.rows[0].id;
    // Clear GUC
    await superuser.query(`SELECT set_config('request.jwt.claim.sub','',false)`);
    await superuser.query(`SELECT set_config('request.jwt.claim.role','',false)`);

    check(Boolean(clubA) && Boolean(clubB) && clubA!==clubB, `club setup failed A=${clubA} B=${clubB}`);
    evidence.push(`clubs: A=${clubA.slice(0,8)} adminA=${adminA.userId.slice(0,8)} | B=${clubB.slice(0,8)} adminB=${adminB.userId.slice(0,8)} | outsider=${outsider.userId.slice(0,8)}`);

    // Ensure RLS helper considers them managers: admin_id already qualifies for is_active_eligible_club_manager
    // Verify via direct function call as superuser
    const mgrA = await superuser.query(`SELECT public.is_active_eligible_club_manager($1,$2) AS ok`, [adminA.userId, clubA]);
    const mgrBforA = await superuser.query(`SELECT public.is_active_eligible_club_manager($1,$2) AS ok`, [adminB.userId, clubA]);
    const mgrOut = await superuser.query(`SELECT public.is_active_eligible_club_manager($1,$2) AS ok`, [outsider.userId, clubA]);
    check(mgrA.rows[0].ok===true, `adminA should be manager of clubA (got ${mgrA.rows[0].ok})`);
    check(mgrBforA.rows[0].ok===false, `adminB should NOT be manager of clubA (got ${mgrBforA.rows[0].ok})`);
    check(mgrOut.rows[0].ok===false, `outsider should NOT be manager of clubA`);

    // Clean any leftover objects from prior runs for these clubs
    await superuser.query(`DELETE FROM storage.objects WHERE bucket_id='club-banners' AND (name LIKE $1 OR name LIKE $2)`, [`${clubA}/%`, `${clubB}/%`]);

    // ── GREEN: POSITIVE — adminA writes Club A banner ───────────────────
    console.log('[B01] GREEN positive: adminA → clubA banner');
    const pathA = `${clubA}/cover.jpg`;
    const pos = await storageInsertAs(DATABASE_URL, 'authenticated', adminA.userId, 'club-banners', pathA);
    check(pos.ok === true, `positive INSERT should succeed, got ok=${pos.ok} code=${pos.code} msg=${pos.message}`);
    if (pos.ok) {
      check(pos.rows[0]?.bucket_id==='club-banners' && pos.rows[0]?.name===pathA, `positive row shape unexpected ${JSON.stringify(pos.rows[0])}`);
      evidence.push(`positive INSERT ok id=${pos.rows[0].id} name=${pathA}`);
    }
    const persistedPos = await superuser.query(`SELECT id, bucket_id, name, owner FROM storage.objects WHERE bucket_id='club-banners' AND name=$1`, [pathA]);
    check(persistedPos.rows.length===1, `persisted state: expected 1 row for ${pathA}, found ${persistedPos.rows.length}`);
    check(persistedPos.rows[0]?.name===pathA, `persisted name mismatch`);

    // ── GREEN: NEGATIVE CROSS-CLUB — adminB writes Club A banner DENIED ──
    console.log('[B01] GREEN negative cross-club: adminB → clubA banner denied');
    const pathCross = `${clubA}/cover-cross.jpg`;
    const crossRes = await storageInsertAs(DATABASE_URL, 'authenticated', adminB.userId, 'club-banners', pathCross);
    check(crossRes.ok === false, `cross-club INSERT should be RLS denied, but succeeded`);
    if (!crossRes.ok) {
      check(crossRes.code==='42501' || /row-level security|policy|permission denied/i.test(crossRes.message), `cross-club error should be RLS 42501, got code=${crossRes.code} msg=${crossRes.message}`);
      evidence.push(`cross-club DENIED code=${crossRes.code}`);
    }
    const persistedCross = await superuser.query(`SELECT id FROM storage.objects WHERE bucket_id='club-banners' AND name=$1`, [pathCross]);
    check(persistedCross.rows.length===0, `persisted state: cross-club row must NOT exist, found ${persistedCross.rows.length}`);

    // ── GREEN: NEGATIVE OUTSIDER — outsider writes Club A banner DENIED ──
    console.log('[B01] GREEN negative outsider: outsider → clubA banner denied');
    const pathOutsider = `${clubA}/outsider-cover.png`;
    const outsiderRes = await storageInsertAs(DATABASE_URL, 'authenticated', outsider.userId, 'club-banners', pathOutsider);
    check(outsiderRes.ok===false, `outsider INSERT should be RLS denied`);
    if (!outsiderRes.ok) evidence.push(`outsider DENIED code=${outsiderRes.code}`);
    const persistedOutsider = await superuser.query(`SELECT id FROM storage.objects WHERE bucket_id='club-banners' AND name=$1`, [pathOutsider]);
    check(persistedOutsider.rows.length===0, `outsider row must NOT exist`);

    // Also outsider with wrong bucket should be denied (not part of matrix but extra)
    // ── READ: anonymous/public SELECT matches live semantics ──────────────
    console.log('[B01] READ: anonymous public read');
    // Positive read: anon can SELECT banner we inserted
    const anonRead = await storageSelectAs(DATABASE_URL, 'anon', null, `bucket_id='club-banners' AND name='${pathA}'`);
    check(anonRead.ok===true, `anon SELECT should succeed, got ok=${anonRead.ok} msg=${anonRead.message}`);
    check(anonRead.rows.length===1 && anonRead.rows[0].name===pathA, `anon SELECT should return banner, got ${JSON.stringify(anonRead.rows)}`);
    if (anonRead.ok) evidence.push(`anon READ ok rows=${anonRead.rows.length}`);

    // Authenticated read also works (public policy)
    const authRead = await storageSelectAs(DATABASE_URL, 'authenticated', outsider.userId, `bucket_id='club-banners' AND name='${pathA}'`);
    check(authRead.ok===true && authRead.rows.length===1, `authenticated public read should see banner`);

    // Anonymous INSERT must be denied (policy is TO authenticated only)
    const anonInsert = await storageInsertAs(DATABASE_URL, 'anon', null, 'club-banners', `${clubA}/anon-attempt.jpg`);
    check(anonInsert.ok===false, `anon INSERT should be denied (TO authenticated)`);
    if (!anonInsert.ok) evidence.push(`anon INSERT DENIED code=${anonInsert.code}`);

    // ── B01 RED SENSITIVITY: weaken manager predicate → unauthorized succeeds → RED ──
    console.log('[B01] RED proof: weaken ownership predicate');
    // Narrow mutation: replace admin_insert WITH CHECK manager → bucket_id only
    try {
      await superuser.query(`DROP POLICY IF EXISTS "club_banners_admin_insert" ON storage.objects`);
      await superuser.query(
        `CREATE POLICY "club_banners_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'club-banners')`
      );
      evidence.push('RED overlay: club_banners_admin_insert weakened to bucket-only');

      const redPath = `${clubA}/red-cross-${randomUUID().slice(0,6)}.jpg`;
      const redCross = await storageInsertAs(DATABASE_URL, 'authenticated', adminB.userId, 'club-banners', redPath);
      const redOutsiderPath = `${clubA}/red-outsider-${randomUUID().slice(0,6)}.jpg`;
      const redOutsider = await storageInsertAs(DATABASE_URL, 'authenticated', outsider.userId, 'club-banners', redOutsiderPath);

      const redDetected = redCross.ok===true && redOutsider.ok===true;
      check(redDetected, `RED MUTATION: expected unauthorized inserts to SUCCEED under weakened policy (cross ok=${redCross.ok}, outsider ok=${redOutsider.ok})`);
      if (redDetected) {
        evidence.push(`RED PASS: cross ok id=${redCross.rows[0]?.id}, outsider ok id=${redOutsider.rows[0]?.id} — contract would go RED`);
        // Verify persisted state for red as well
        const rc1 = await superuser.query(`SELECT id FROM storage.objects WHERE name=$1`, [redPath]);
        const rc2 = await superuser.query(`SELECT id FROM storage.objects WHERE name=$1`, [redOutsiderPath]);
        check(rc1.rows.length===1 && rc2.rows.length===1, `RED persisted state unexpected`);
        // Clean red rows before restore
        await superuser.query(`DELETE FROM storage.objects WHERE name IN ($1,$2)`, [redPath, redOutsiderPath]);
      } else {
        failures.push(`RED PROOF FAIL: weakened policy did not allow unauthorized writes — harness not sensitive to ownership predicate (cross code=${redCross.code} outsider code=${redOutsider.code})`);
      }
    } finally {
      // Restore original insert policy exactly
      await superuser.query(`DROP POLICY IF EXISTS "club_banners_admin_insert" ON storage.objects`);
      await superuser.query(
        `CREATE POLICY "club_banners_admin_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'club-banners' AND public.is_active_eligible_club_manager(auth.uid(), ((storage.foldername(name))[1])::uuid))`
      );
      evidence.push('RED overlay restored: club_banners_admin_insert original');
      // Verify restored policy denies again
      const verifyPath = `${clubA}/verify-restore-${randomUUID().slice(0,6)}.jpg`;
      const verify = await storageInsertAs(DATABASE_URL, 'authenticated', adminB.userId, 'club-banners', verifyPath);
      check(verify.ok===false, `post-restore verify: cross-club should be DENIED again, got ok=${verify.ok}`);
      if (!verify.ok) evidence.push('restore verify: cross-club correctly DENIED again');
      else await superuser.query(`DELETE FROM storage.objects WHERE name=$1`, [verifyPath]);
    }

  } finally {
    await superuser.end().catch(()=>{});
  }

  console.log('[B01] evidence:');
  for (const line of evidence) console.log(`[B01]   · ${line}`);

  if (failures.length>0) {
    console.error(`[B01] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[B01]   ✗ ${f}`);
    process.exit(1);
  } else {
    console.log('[B01] PASS: B01 banner Storage RLS + public read + RED sensitivity proven');
  }
}

main().catch(e=>{ console.error('[B01] infrastructure failure:', e); process.exit(2); });
