#!/usr/bin/env node
/**
 * CLUB-WU-L01-B · wave2_invitation_expiry.test.mjs (B05)
 *
 * B05 invitation expiry enforcement:
 *   - valid invitation accepts (future expiry) -> membership created
 *   - expired invitation rejects (past expiry) -> P0001 exact error, no side effects
 *   - atomicity: expired acceptance leaves invitation pending, zero membership
 *   - RED proof: neutralized expiry guard allows expired acceptance
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { actAs, ensureActor } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;

function assertLocality(url) {
  let parsed; try { parsed = new URL(url); } catch { throw new Error('invalid url'); }
  if (!['127.0.0.1','localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/clubs_l4_')) throw new Error(`locality guard ${parsed.hostname}${parsed.pathname}`);
}

async function fetchFuncDef(client, name) {
  const base = name.split('(')[0].split('.').pop();
  const r = await client.query(`SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname=$1 AND pronamespace='public'::regnamespace LIMIT 1`, [base]);
  if (r.rows.length===0) throw new Error(`function ${name} not found`);
  return r.rows[0].def;
}

async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL required');
  assertLocality(DATABASE_URL);
  const failures = [];
  const evidence = [];
  const check = (c, m) => { if (!c) failures.push(m); return c; };

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  let originalAcceptDef = null;
  try { originalAcceptDef = await fetchFuncDef(client, 'public.accept_club_invitation(uuid)'); } catch(e){ console.error('fetch def failed',e.message); process.exit(2); }

  try {
    // ── Setup: admin + invitee, invite_only club ──────────────────────────
    const admin = await ensureActor(client, { tier: 'pro' });
    const invitee = await ensureActor(client, { tier: 'pro' });

    // Create invite_only club via RPC as admin
    await actAs(client, admin.userId);
    const clubRes = await client.query(
      `SELECT (public.create_club(
        $1::text, $2::text, NULL::text, 'invite_only', 'all', NULL::text, $3::uuid, NULL::uuid, NULL::int, NULL::uuid
      )).id AS club_id`,
      [`L01B Invite Club ${randomUUID().slice(0,4)}`, 'B05 fixture', admin.userId]
    );
    const clubId = clubRes.rows[0].club_id;
    check(Boolean(clubId), 'precondition: invite_only club creation failed');

    // Verify admin membership exists (create_club should also insert admin member, but check entitlement bypass)
    // Ensure via direct check; if not present, insert.
    const adminMember = await client.query(`SELECT 1 FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubId, admin.userId]);
    if (adminMember.rows.length === 0) {
      await client.query(`INSERT INTO public.club_members (club_id, user_id, role, status) VALUES ($1,$2,'admin','active')`, [clubId, admin.userId]);
    }

    // ── B05-A valid invitation accepts (GREEN) ────────────────────────────
    console.log('[wave2-invitation] B05-A valid invitation');
    const validInvId = randomUUID();
    await client.query(
      `INSERT INTO public.club_invitations (id, club_id, inviter_user_id, invitee_user_id, status, expires_at, created_at)
       VALUES ($1,$2,$3,$4,'pending', now() + interval '10 days', now())`,
      [validInvId, clubId, admin.userId, invitee.userId]
    );
    await actAs(client, invitee.userId);
    let validMembership = null;
    try {
      const r = await client.query(`SELECT public.accept_club_invitation($1::uuid) AS membership`, [validInvId]);
      validMembership = r.rows[0].membership;
      // membership is composite; check via unpacking
      // We can also query club_members directly
    } catch (e) {
      check(false, `B05-A: valid invitation should succeed, got ${e.code} ${e.message}`);
    }
    // Verify persisted state
    const invAfterValid = await client.query(`SELECT status FROM public.club_invitations WHERE id=$1`, [validInvId]);
    check(invAfterValid.rows[0].status === 'accepted', `B05-A: invitation status should be accepted, got ${invAfterValid.rows[0].status}`);
    const memAfterValid = await client.query(`SELECT club_id, user_id, role, status FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubId, invitee.userId]);
    check(memAfterValid.rows.length === 1, `B05-A: membership row should exist, got ${memAfterValid.rows.length}`);
    if (memAfterValid.rows.length === 1) {
      check(memAfterValid.rows[0].role === 'member', `B05-A: role expected member got ${memAfterValid.rows[0].role}`);
      check(memAfterValid.rows[0].status === 'active', `B05-A: status expected active got ${memAfterValid.rows[0].status}`);
      evidence.push(`B05-A: valid invitation accepted, membership created for ${invitee.userId}`);
    }
    // No duplicate membership: count should be 1 for this user/club
    const dupCount = await client.query(`SELECT count(*)::int AS n FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubId, invitee.userId]);
    check(dupCount.rows[0].n === 1, `B05-A: duplicate membership check failed count=${dupCount.rows[0].n}`);

    // Clean up valid case invitee membership for next tests? Use new invitee for expired case to avoid already-member conflict.
    // For B05-B we need fresh invitee without membership.

    // ── B05-B expired invitation rejects (GREEN/NEGATIVE) ─────────────────
    console.log('[wave2-invitation] B05-B expired rejects');
    const expiredInvitee = await ensureActor(client, { tier: 'pro' });
    const expiredInvId = randomUUID();
    await client.query(
      `INSERT INTO public.club_invitations (id, club_id, inviter_user_id, invitee_user_id, status, expires_at, created_at)
       VALUES ($1,$2,$3,$4,'pending', now() - interval '10 days', now() - interval '11 days')`,
      [expiredInvId, clubId, admin.userId, expiredInvitee.userId]
    );
    await actAs(client, expiredInvitee.userId);
    let expiredError = null;
    try {
      await client.query(`SELECT public.accept_club_invitation($1::uuid)`, [expiredInvId]);
      check(false, 'B05-B: expired invitation should have rejected');
    } catch (e) {
      expiredError = e;
      check(e.code === 'P0001', `B05-B: expected SQLSTATE P0001, got ${e.code}`);
      check(e.message === 'This invitation has expired', `B05-B: expected 'This invitation has expired', got '${e.message}'`);
      evidence.push(`B05-B: expired correctly rejected P0001 '${e.message}'`);
    }
    // Assert expired invitation remains pending
    const invAfterExpired = await client.query(`SELECT status FROM public.club_invitations WHERE id=$1`, [expiredInvId]);
    check(invAfterExpired.rows[0].status === 'pending', `B05-B: expired invitation should remain pending, got ${invAfterExpired.rows[0].status}`);
    // No membership created
    const memAfterExpired = await client.query(`SELECT * FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubId, expiredInvitee.userId]);
    check(memAfterExpired.rows.length === 0, `B05-B: no membership should be created for expired, found ${memAfterExpired.rows.length}`);
    if (memAfterExpired.rows.length===0) evidence.push('B05-B: no membership side effect');

    // ── B05-C atomicity explicit ──────────────────────────────────────────
    console.log('[wave2-invitation] B05-C atomicity');
    // Re-check same expired invitation still pending and zero membership after failed attempt (already proved)
    const atomicInv = await client.query(`SELECT status, responded_at FROM public.club_invitations WHERE id=$1`, [expiredInvId]);
    check(atomicInv.rows[0].status === 'pending', `B05-C atomicity: invitation status pending, got ${atomicInv.rows[0].status}`);
    // responded_at should remain null (accepted would set it)
    check(atomicInv.rows[0].responded_at === null, `B05-C: responded_at should remain null after failed accept, got ${atomicInv.rows[0].responded_at}`);
    // Ensure no partial side effects: also check club_member_actions etc not relevant
    const atomicMem = await client.query(`SELECT count(*)::int AS n FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubId, expiredInvitee.userId]);
    check(atomicMem.rows[0].n === 0, `B05-C: zero membership rows, got ${atomicMem.rows[0].n}`);
    if (atomicInv.rows[0].status==='pending' && atomicMem.rows[0].n===0) evidence.push('B05-C atomicity PASS: pending unchanged, zero membership');

    // ── B05 RED PROOF ─────────────────────────────────────────────────────
    console.log('[wave2-invitation] B05 RED proof: neutralize expiry guard');
    // Mutate accept_club_invitation to bypass expiry: replace guard with false
    // Original guard snippet: IF invitation_record.expires_at IS NOT NULL AND invitation_record.expires_at <= now() THEN RAISE EXCEPTION 'This invitation has expired'
    let mutatedAccept = originalAcceptDef;
    // Handle both possible formatting: with newline
    const guardPattern = /IF\s+invitation_record\.expires_at\s+IS\s+NOT\s+NULL\s+AND\s+invitation_record\.expires_at\s*<=\s*now\(\)\s+THEN\s+RAISE\s+EXCEPTION\s+'This invitation has expired'\s*;/i;
    if (guardPattern.test(mutatedAccept)) {
      mutatedAccept = mutatedAccept.replace(guardPattern, '-- MUTATION RED: expiry guard neutralized\n  IF FALSE THEN RAISE EXCEPTION \'This invitation has expired\';');
    } else {
      // Fallback: try simpler
      mutatedAccept = mutatedAccept.replace(/RAISE EXCEPTION 'This invitation has expired'/, `RAISE EXCEPTION 'This invitation has expired -- MUTED'`);
      // Ensure at least one change
      if (mutatedAccept === originalAcceptDef) {
        check(false, 'B05 RED: could not locate expiry guard to mutate');
      }
    }
    await client.query(mutatedAccept);
    evidence.push('B05 RED: applied mutated overlay (expiry guard neutralized)');

    // Seed another expired invitation for RED test
    const redInvitee = await ensureActor(client, { tier: 'pro' });
    const redInvId = randomUUID();
    await client.query(
      `INSERT INTO public.club_invitations (id, club_id, inviter_user_id, invitee_user_id, status, expires_at)
       VALUES ($1,$2,$3,$4,'pending', now() - interval '10 days')`,
      [redInvId, clubId, admin.userId, redInvitee.userId]
    );
    await actAs(client, redInvitee.userId);
    let redSucceeded = false;
    try {
      await client.query(`SELECT public.accept_club_invitation($1::uuid)`, [redInvId]);
      redSucceeded = true;
    } catch (e) {
      redSucceeded = false;
      failures.push(`B05 RED FAIL: expired invitation still rejected under mutated guard: ${e.code} ${e.message}`);
    }
    if (redSucceeded) {
      const redInvAfter = await client.query(`SELECT status FROM public.club_invitations WHERE id=$1`, [redInvId]);
      const redMemAfter = await client.query(`SELECT * FROM public.club_members WHERE club_id=$1 AND user_id=$2`, [clubId, redInvitee.userId]);
      check(redInvAfter.rows[0].status === 'accepted', `B05 RED: mutated should accept, got status ${redInvAfter.rows[0].status}`);
      check(redMemAfter.rows.length === 1, `B05 RED: mutated should create membership, got ${redMemAfter.rows.length}`);
      if (redInvAfter.rows[0].status==='accepted' && redMemAfter.rows.length===1) {
        evidence.push('B05 RED PASS: expired invitation accepted under mutated guard, membership created — guard is load-bearing');
      }
    }

    // Restore original
    await client.query(originalAcceptDef);
    evidence.push('B05 RED: restored original accept_club_invitation');

  } finally {
    try { if (originalAcceptDef) await client.query(originalAcceptDef); } catch {}
    await client.end().catch(()=>{});
  }

  console.log('[wave2-invitation] evidence:');
  for (const l of evidence) console.log(`[wave2-invitation]   · ${l}`);
  if (failures.length>0) {
    console.error(`[wave2-invitation] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[wave2-invitation]   ✗ ${f}`);
    process.exit(1);
  } else {
    console.log('[wave2-invitation] PASS: B05 expiry contracts + RED proof green');
  }
}

main().catch(e=>{ console.error('[wave2-invitation] infra',e); process.exit(2); });
