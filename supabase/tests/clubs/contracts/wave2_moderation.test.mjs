#!/usr/bin/env node
/**
 * CLUB-WU-L01-B · wave2_moderation.test.mjs (HIER-02 + HIER-03/P04)
 *
 * HIER-02: target must be active member of SAME club
 * HIER-03: self-moderation prohibited + admin protection
 * RED proofs neutralize respective guards.
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { actAs, ensureActor, createQualifyingClubs, ensureClubMember } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;

function assertLocality(url) {
  let p; try { p=new URL(url);} catch{ throw new Error('bad url');}
  if (!['127.0.0.1','localhost'].includes(p.hostname) || !p.pathname.startsWith('/clubs_l4_')) throw new Error('locality');
}
async function fetchDef(client, name) {
  // need to resolve overload: issue_club_member_action has 5 args
  const r = await client.query(`SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='issue_club_member_action'`);
  if (r.rows.length===0) throw new Error('function not found');
  // pick one with correct arg count (prefer 5 args). If multiple, take first.
  return r.rows[0].def;
}

async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL required');
  assertLocality(DATABASE_URL);
  const failures = []; const evidence = [];
  const check=(c,m)=>{ if(!c) failures.push(m); return c; };

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  let originalDef = null;
  try {
    originalDef = await fetchDef(client, 'issue_club_member_action');
  } catch(e){ console.error('fetch failed',e.message); process.exit(2); }

  try {
    // ── Setup clubs and actors ──────────────────────────────────────────
    const adminA = await ensureActor(client, { tier: 'pro' });
    await actAs(client, adminA.userId);
    const [clubAId] = await createQualifyingClubs(client, adminA.userId, 1, { namePrefix: 'L01B Mod Club A' });

    const adminB = await ensureActor(client, { tier: 'pro' });
    await actAs(client, adminB.userId);
    const [clubBId] = await createQualifyingClubs(client, adminB.userId, 1, { namePrefix: 'L01B Mod Club B' });

    // Ensure admin memberships already exist via create_club; ensure moderator and members
    const modA = await ensureActor(client, { tier: 'pro' });
    await ensureClubMember(client, clubAId, modA.userId, 'moderator', 'active');

    const memberA = await ensureActor(client, { tier: 'pro' });
    await ensureClubMember(client, clubAId, memberA.userId, 'member', 'active');

    const crossMember = await ensureActor(client, { tier: 'pro' });
    await ensureClubMember(client, clubBId, crossMember.userId, 'member', 'active');

    const outsider = await ensureActor(client, { tier: 'pro' });
    // outsider has no membership

    evidence.push(`setup: clubA ${clubAId} admin ${adminA.userId} mod ${modA.userId} memberA ${memberA.userId} ; clubB ${clubBId} cross ${crossMember.userId} outsider ${outsider.userId}`);

    // ── HIER02-A same-club active member (GREEN) ────────────────────────
    console.log('[wave2-moderation] HIER02-A same-club warned');
    await actAs(client, modA.userId);
    let hier02AResult = null;
    try {
      const r = await client.query(
        `SELECT public.issue_club_member_action($1::uuid, $2::uuid, 'warned'::text, 'test reason'::text, NULL::integer) AS rec`,
        [clubAId, memberA.userId]
      );
      hier02AResult = r.rows[0].rec;
      // The returned record is composite; verify via table query
      const actionRow = await client.query(`SELECT club_id, user_id, action_type, performed_by, reason FROM public.club_member_actions WHERE club_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1`, [clubAId, memberA.userId]);
      check(actionRow.rows.length===1, `HIER02-A: expected 1 action row, got ${actionRow.rows.length}`);
      if (actionRow.rows.length===1) {
        check(actionRow.rows[0].action_type==='warned', `HIER02-A action_type warned got ${actionRow.rows[0].action_type}`);
        check(actionRow.rows[0].performed_by===modA.userId, `HIER02-A performed_by should be mod ${modA.userId} got ${actionRow.rows[0].performed_by}`);
        check(actionRow.rows[0].reason==='test reason', `HIER02-A reason mismatch`);
        check(String(actionRow.rows[0].club_id)===String(clubAId), 'HIER02-A club_id mismatch');
        evidence.push(`HIER02-A: warned action created for memberA by modA`);
      }
      // Warned does NOT flip status per body: member remains active
      const memStatus = await client.query(`SELECT status FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubAId, memberA.userId]);
      check(memStatus.rows[0].status==='active', `HIER02-A: warned should NOT flip status, got ${memStatus.rows[0].status}`);
    } catch(e) {
      check(false, `HIER02-A should succeed, got ${e.code} ${e.message}`);
    }

    // ── HIER02-B cross-club target (GREEN NEGATIVE) ──────────────────────
    console.log('[wave2-moderation] HIER02-B cross-club');
    await actAs(client, modA.userId);
    let crossErr = null;
    const beforeCrossCount = (await client.query(`SELECT count(*)::int AS n FROM public.club_member_actions WHERE club_id=$1`, [clubAId])).rows[0].n;
    try {
      await client.query(`SELECT public.issue_club_member_action($1::uuid,$2::uuid,'warned','test reason',NULL)`, [clubAId, crossMember.userId]);
      check(false, 'HIER02-B cross-club should reject');
    } catch(e) {
      crossErr = e;
      check(e.code==='P0001', `HIER02-B expected P0001 got ${e.code}`);
      check(e.message==='Target user is not an active member of this club', `HIER02-B expected 'Target user is not an active member of this club' got '${e.message}'`);
      evidence.push(`HIER02-B: cross-club correctly rejected P0001 '${e.message}'`);
    }
    const afterCrossCount = (await client.query(`SELECT count(*)::int AS n FROM public.club_member_actions WHERE club_id=$1`, [clubAId])).rows[0].n;
    check(afterCrossCount===beforeCrossCount, `HIER02-B: zero action row created (before ${beforeCrossCount} after ${afterCrossCount})`);
    // target membership unchanged
    const crossMem = await client.query(`SELECT status FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubBId, crossMember.userId]);
    check(crossMem.rows[0].status==='active', 'HIER02-B cross member status unchanged');

    // ── HIER02-C outsider (if distinct) ──────────────────────────────────
    console.log('[wave2-moderation] HIER02-C outsider');
    await actAs(client, modA.userId);
    const beforeOutsiderCount = afterCrossCount;
    try {
      await client.query(`SELECT public.issue_club_member_action($1,$2,'warned','test reason',NULL)`, [clubAId, outsider.userId]);
      check(false, 'HIER02-C outsider should reject');
    } catch(e) {
      check(e.code==='P0001', `HIER02-C P0001 got ${e.code}`);
      check(e.message==='Target user is not an active member of this club', `HIER02-C msg got '${e.message}'`);
      evidence.push(`HIER02-C: outsider correctly rejected`);
    }
    const afterOutsiderCount = (await client.query(`SELECT count(*)::int AS n FROM public.club_member_actions WHERE club_id=$1`, [clubAId])).rows[0].n;
    check(afterOutsiderCount===beforeOutsiderCount, 'HIER02-C zero action row');

    // ── HIER02 RED PROOF ──────────────────────────────────────────────────
    console.log('[wave2-moderation] HIER02 RED proof: neutralize target-membership guard');
    // Mutate: remove the HIER-02 guard block
    let mutatedHier02 = originalDef;
    const hier02Pattern = /IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.club_members\s+cm\s+WHERE\s+cm\.club_id\s*=\s*p_club_id[^;]+?THEN\s+RAISE\s+EXCEPTION\s+'Target user is not an active member of this club'\s*;\s*END\s+IF\s*;/is;
    if (hier02Pattern.test(mutatedHier02)) {
      mutatedHier02 = mutatedHier02.replace(hier02Pattern, '-- MUTATION RED HIER02: guard neutralized\n');
    } else {
      // fallback: simple string replace of error literal guard
      mutatedHier02 = mutatedHier02.replace(`RAISE EXCEPTION 'Target user is not an active member of this club'`, `RAISE EXCEPTION 'HIER02_MUTED'`);
      if (mutatedHier02===originalDef) check(false,'HIER02 RED: could not locate guard to mutate');
      // better to just remove it if still present – try second pass
      mutatedHier02 = mutatedHier02.replace(/IF NOT EXISTS[\s\S]*?active'[\s\S]*?END IF;/, '-- HIER02 REMOVED');
    }
    await client.query(mutatedHier02);
    evidence.push('HIER02 RED: applied mutated overlay (target-membership guard neutralized)');
    await actAs(client, modA.userId);
    let hier02RedSucceeded = false;
    try {
      await client.query(`SELECT public.issue_club_member_action($1,$2,'warned','test reason',NULL)`, [clubAId, crossMember.userId]);
      hier02RedSucceeded = true;
    } catch(e) {
      failures.push(`HIER02 RED FAIL: cross-club still rejected under mutated guard: ${e.code} ${e.message}`);
    }
    if (hier02RedSucceeded) {
      const redAction = await client.query(`SELECT * FROM public.club_member_actions WHERE club_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1`, [clubAId, crossMember.userId]);
      check(redAction.rows.length===1, `HIER02 RED: mutated should create action row, got ${redAction.rows.length}`);
      if (redAction.rows.length===1) evidence.push('HIER02 RED PASS: cross-club became actionable under mutated guard');
      // clean up the mutated action to not pollute later tests
      await client.query(`DELETE FROM public.club_member_actions WHERE club_id=$1 AND user_id=$2`, [clubAId, crossMember.userId]);
    }
    // restore original
    await client.query(originalDef);
    evidence.push('HIER02 RED: restored original function');

    // ── HIER03-A self-target denial (GREEN NEGATIVE) ──────────────────────
    console.log('[wave2-moderation] HIER03-A self-target');
    await actAs(client, modA.userId);
    const beforeSelfCount = (await client.query(`SELECT count(*)::int AS n FROM public.club_member_actions WHERE club_id=$1`, [clubAId])).rows[0].n;
    try {
      await client.query(`SELECT public.issue_club_member_action($1,$2,'warned','test reason',NULL)`, [clubAId, modA.userId]);
      check(false, 'HIER03-A self should reject');
    } catch(e) {
      check(e.code==='P0001', `HIER03-A P0001 got ${e.code}`);
      check(e.message==='Self-moderation is not permitted', `HIER03-A msg got '${e.message}'`);
      evidence.push(`HIER03-A: self correctly rejected P0001 '${e.message}'`);
    }
    const afterSelfCount = (await client.query(`SELECT count(*)::int AS n FROM public.club_member_actions WHERE club_id=$1`, [clubAId])).rows[0].n;
    check(afterSelfCount===beforeSelfCount, 'HIER03-A zero action row');
    const selfMem = await client.query(`SELECT status FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubAId, modA.userId]);
    check(selfMem.rows[0].status==='active', 'HIER03-A self membership unchanged');

    // ── HIER03-B admin protection ─────────────────────────────────────────
    console.log('[wave2-moderation] HIER03-B admin protection');
    // modA attempts to moderate adminA
    await actAs(client, modA.userId);
    const beforeAdminCount = afterSelfCount;
    try {
      await client.query(`SELECT public.issue_club_member_action($1,$2,'warned','test reason',NULL)`, [clubAId, adminA.userId]);
      check(false, 'HIER03-B admin should reject');
    } catch(e) {
      check(e.code==='P0001', `HIER03-B P0001 got ${e.code}`);
      check(e.message==='Club admins cannot be moderated through this action', `HIER03-B msg got '${e.message}'`);
      evidence.push(`HIER03-B: admin correctly rejected`);
    }
    const afterAdminCount = (await client.query(`SELECT count(*)::int AS n FROM public.club_member_actions WHERE club_id=$1`, [clubAId])).rows[0].n;
    check(afterAdminCount===beforeAdminCount, 'HIER03-B zero action row');
    const adminMem = await client.query(`SELECT role, status FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubAId, adminA.userId]);
    // admin membership may be via book_clubs.admin_id but also club_members row? create_club inserts admin member row, so check
    if (adminMem.rows.length>0) {
      check(adminMem.rows[0].role==='admin', 'admin role unchanged');
    }

    // ── HIER03 RED PROOF ──────────────────────────────────────────────────
    console.log('[wave2-moderation] HIER03 RED proof: neutralize self-target guard');
    let mutatedHier03 = originalDef;
    const selfPattern = /IF\s+auth\.uid\(\)\s*=\s*p_user_id\s+THEN\s+RAISE\s+EXCEPTION\s+'Self-moderation is not permitted'\s*;\s*END\s+IF\s*;/i;
    if (selfPattern.test(mutatedHier03)) {
      mutatedHier03 = mutatedHier03.replace(selfPattern, '-- MUTATION RED HIER03: self guard neutralized\n');
    } else {
      mutatedHier03 = mutatedHier03.replace(`RAISE EXCEPTION 'Self-moderation is not permitted'`, `-- MUTED`);
    }
    await client.query(mutatedHier03);
    evidence.push('HIER03 RED: applied mutated overlay (self guard neutralized)');
    await actAs(client, modA.userId);
    let hier03RedSucceeded = false;
    try {
      await client.query(`SELECT public.issue_club_member_action($1,$2,'warned','test reason',NULL)`, [clubAId, modA.userId]);
      hier03RedSucceeded = true;
    } catch(e) {
      failures.push(`HIER03 RED FAIL: self still rejected under mutated guard: ${e.code} ${e.message}`);
    }
    if (hier03RedSucceeded) {
      const redSelfAction = await client.query(`SELECT * FROM public.club_member_actions WHERE club_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1`, [clubAId, modA.userId]);
      check(redSelfAction.rows.length===1, 'HIER03 RED: self moderation succeeded under mutated');
      if (redSelfAction.rows.length===1) evidence.push('HIER03 RED PASS: self-moderation works under mutated guard');
      await client.query(`DELETE FROM public.club_member_actions WHERE club_id=$1 AND user_id=$2`, [clubAId, modA.userId]);
    }
    await client.query(originalDef);
    evidence.push('HIER03 RED: restored original function');

  } finally {
    try { if (originalDef) await client.query(originalDef); } catch{}
    await client.end().catch(()=>{});
  }

  console.log('[wave2-moderation] evidence:');
  for (const l of evidence) console.log(`[wave2-moderation]   · ${l}`);
  if (failures.length>0) {
    console.error(`[wave2-moderation] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[wave2-moderation]   ✗ ${f}`);
    process.exit(1);
  } else {
    console.log('[wave2-moderation] PASS: HIER-02/HIER-03 contracts + RED proofs green');
  }
}

main().catch(e=>{ console.error('[wave2-moderation] infra',e); process.exit(2); });
