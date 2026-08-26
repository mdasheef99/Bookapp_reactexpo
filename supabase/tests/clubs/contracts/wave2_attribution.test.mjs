#!/usr/bin/env node
/**
 * CLUB-WU-L01-B · wave2_attribution.test.mjs (B03 + B04)
 *
 * Contracts against disposable PostgreSQL 17:
 *   B03 - complaint resolution attribution (enforce_club_complaint_resolution_state)
 *   B04 - event cancellation attribution (pin_club_event_cancellation)
 *
 * Each contract proves:
 *   actual repository backend behavior
 *   + actual PostgreSQL trigger execution
 *   + actual persisted final state
 *
 * RED proofs are behavioral (spoof survives under mutated overlay), NOT trigger presence.
 * Mutation artifacts are OS-temp only, never committed, deleted in finally.
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { actAs, ensureActor, createQualifyingClubs } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;

function assertLocality(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('CLUBS_L4_DATABASE_URL is not a valid URL'); }
  const hostOk = ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  const dbOk = parsed.pathname.startsWith('/clubs_l4_');
  if (!hostOk || !dbOk) throw new Error(`Locality guard violated: ${parsed.hostname}${parsed.pathname}`);
}

async function fetchFunctionDef(client, funcName) {
  // funcName may include signature e.g. 'public.enforce_club_complaint_resolution_state()'
  const base = funcName.split('(')[0];
  const res = await client.query(`SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace LIMIT 1`, [base.split('.').pop()]);
  if (res.rows.length === 0) throw new Error(`function ${funcName} not found`);
  return res.rows[0].def;
}

async function main() {
  if (!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL is required');
  assertLocality(DATABASE_URL);

  const failures = [];
  const evidence = [];
  const check = (cond, msg) => { if (!cond) failures.push(msg); return cond; };

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Save original definitions for restoration in finally of RED proofs
  let originalB03Def = null;
  let originalB04Def = null;
  try {
    originalB03Def = await fetchFunctionDef(client, 'public.enforce_club_complaint_resolution_state()');
    originalB04Def = await fetchFunctionDef(client, 'public.pin_club_event_cancellation()');
  } catch (e) {
    console.error('[wave2-attribution] could not fetch original trigger defs:', e.message);
    process.exit(2);
  }

  try {
    // ── Common setup: admin/manager actor and club ────────────────────────
    const admin = await ensureActor(client, { tier: 'pro' });
    await actAs(client, admin.userId);
    const [clubId] = await createQualifyingClubs(client, admin.userId, 1, { namePrefix: 'L01B Attribution Club' });
    check(Boolean(clubId), 'precondition: club creation failed');

    const spoofId = randomUUID();
    // Ensure spoof auth user exists for FK validity (not required but clean)
    await client.query(`INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [spoofId]);

    // ── B03-A valid resolution (GREEN) ────────────────────────────────────
    console.log('[wave2-attribution] B03-A: valid resolution pin');
    const reporter = await ensureActor(client, { tier: 'free' });
    const reported = await ensureActor(client, { tier: 'free' });

    // Create open complaint via direct INSERT (bypass RLS, use superuser)
    // club_complaints status pending = open
    const complaintRes = await client.query(
      `INSERT INTO public.club_complaints (club_id, reporter_id, reported_user_id, reason, description, status)
       VALUES ($1, $2, $3, 'spam', 'B03 test complaint', 'pending')
       RETURNING id, status, resolved_by, resolved_at`,
      [clubId, reporter.userId, reported.userId]
    );
    const complaintId = complaintRes.rows[0].id;
    check(complaintRes.rows[0].status === 'pending', `B03 precondition: expected pending, got ${complaintRes.rows[0].status}`);
    check(complaintRes.rows[0].resolved_by === null, 'B03 precondition: resolved_by should be null initially');

    // As MANAGER (admin), attempt spoofed resolution
    await actAs(client, admin.userId);
    await client.query(
      `UPDATE public.club_complaints
       SET status = 'resolved', resolved_by = $2, resolved_at = '2020-01-01'::timestamptz
       WHERE id = $1`,
      [complaintId, spoofId]
    );
    const b03After = await client.query(`SELECT status, resolved_by, resolved_at FROM public.club_complaints WHERE id = $1`, [complaintId]);
    const b03Row = b03After.rows[0];
    check(b03Row.status === 'resolved', `B03-A: expected status resolved, got ${b03Row.status}`);
    check(b03Row.resolved_by === admin.userId, `B03-A: resolved_by should be MANAGER ${admin.userId}, got ${b03Row.resolved_by} (spoof ${spoofId})`);
    check(b03Row.resolved_by !== spoofId, `B03-A: resolved_by must NOT be spoof ${spoofId}`);
    check(b03Row.resolved_at !== null, `B03-A: resolved_at should be non-null (got ${b03Row.resolved_at})`);
    if (b03Row.resolved_by === admin.userId && b03Row.resolved_by !== spoofId) {
      evidence.push(`B03-A: resolved_by pinned to manager ${admin.userId}, spoof ${spoofId} rejected, resolved_at=${b03Row.resolved_at}`);
    }

    // ── B03-B reopen/reset behavior ───────────────────────────────────────
    console.log('[wave2-attribution] B03-B: reopen/reset');
    // Attempt to reopen to pending (if permitted by trigger/policy)
    await actAs(client, admin.userId);
    let reopenSucceeded = false;
    let b03ReopenRow = null;
    try {
      await client.query(`UPDATE public.club_complaints SET status = 'pending' WHERE id = $1`, [complaintId]);
      const r = await client.query(`SELECT status, resolved_by, resolved_at FROM public.club_complaints WHERE id = $1`, [complaintId]);
      b03ReopenRow = r.rows[0];
      reopenSucceeded = true;
    } catch (e) {
      evidence.push(`B03-B: reopen rejected with ${e.code ?? ''} ${e.message}`);
    }
    if (reopenSucceeded) {
      check(b03ReopenRow.status === 'pending', `B03-B: expected pending after reopen, got ${b03ReopenRow.status}`);
      check(b03ReopenRow.resolved_by === null, `B03-B: reopen should clear resolved_by, got ${b03ReopenRow.resolved_by}`);
      check(b03ReopenRow.resolved_at === null, `B03-B: reopen should clear resolved_at, got ${b03ReopenRow.resolved_at}`);
      if (b03ReopenRow.resolved_by === null && b03ReopenRow.resolved_at === null) {
        evidence.push(`B03-B: reopen cleared attribution (resolved_by=null, resolved_at=null)`);
      }
    } else {
      // If reopen not permitted, record actual semantics per spec (do not invent)
      evidence.push(`B03-B: reopen not permitted (actual backend semantics)`);
    }

    // ── B03 RED PROOF (behavioral) ───────────────────────────────────────
    console.log('[wave2-attribution] B03 RED proof: neutralize resolved_by pin');
    // Create a second complaint for RED test (so green state not polluted)
    const complaintRedRes = await client.query(
      `INSERT INTO public.club_complaints (club_id, reporter_id, reported_user_id, reason, description, status)
       VALUES ($1, $2, $3, 'harassment', 'B03 RED complaint', 'pending')
       RETURNING id`,
      [clubId, reporter.userId, reported.userId]
    );
    const complaintRedId = complaintRedRes.rows[0].id;

    // Build mutated overlay: preserve spoof instead of pinning
    const mutatedB03 = originalB03Def
      .replace(/NEW\.resolved_by\s*:=\s*auth\.uid\(\)\s*;/g, 'NEW.resolved_by := NEW.resolved_by; -- MUTATION B03 RED: pin neutralized')
      .replace(/NEW\.resolved_by\s*:=\s*auth\.uid\(\)/g, 'NEW.resolved_by := NEW.resolved_by -- MUTATION B03 RED');

    // Apply mutated function
    await client.query(mutatedB03);
    evidence.push('B03 RED: applied mutated overlay (resolved_by pin neutralized)');

    // Attempt same spoofed UPDATE against mutated trigger
    await actAs(client, admin.userId);
    await client.query(
      `UPDATE public.club_complaints SET status = 'resolved', resolved_by = $2, resolved_at = '2020-01-01' WHERE id = $1`,
      [complaintRedId, spoofId]
    );
    const b03RedAfter = await client.query(`SELECT status, resolved_by FROM public.club_complaints WHERE id = $1`, [complaintRedId]);
    const b03RedRow = b03RedAfter.rows[0];
    const b03RedSpoofSurvives = b03RedRow.resolved_by === spoofId;
    check(b03RedSpoofSurvives, `B03 RED: expected spoof ${spoofId} to survive under mutated trigger, got ${b03RedRow.resolved_by}`);
    if (b03RedSpoofSurvives) {
      evidence.push(`B03 RED PASS: spoof survived (${spoofId}) under mutated trigger — pin is load-bearing`);
    } else {
      failures.push(`B03 RED FAIL: spoof did not survive mutated trigger (got ${b03RedRow.resolved_by}, expected ${spoofId}) — harness insensitive`);
    }

    // Restore original B03 function
    await client.query(originalB03Def);
    evidence.push('B03 RED: restored original trigger function');

    // Clean up B03 test rows (optional)
    // Keep for evidence; not required to delete.

    // ── B04-A cancellation pin (GREEN) ────────────────────────────────────
    console.log('[wave2-attribution] B04-A: cancellation pin');
    // Create scheduled event (virtual with meeting_link to satisfy format check)
    const eventRes = await client.query(
      `INSERT INTO public.club_events (club_id, title, description, event_type, start_time, meeting_link, status, created_by)
       VALUES ($1, 'B04 Scheduled Event', 'Test', 'virtual', now() + interval '1 day', 'https://meet.example.com/b04', 'scheduled', $2)
       RETURNING id, status, cancelled_by, cancelled_at`,
      [clubId, admin.userId]
    );
    const eventId = eventRes.rows[0].id;
    check(eventRes.rows[0].status === 'scheduled', `B04 precondition: expected scheduled, got ${eventRes.rows[0].status}`);
    check(eventRes.rows[0].cancelled_by === null, 'B04 precondition: cancelled_by should be null');

    await actAs(client, admin.userId);
    await client.query(
      `UPDATE public.club_events SET status = 'cancelled', cancelled_by = $2, cancelled_at = '2020-01-01' WHERE id = $1`,
      [eventId, spoofId]
    );
    const b04After = await client.query(`SELECT status, cancelled_by, cancelled_at FROM public.club_events WHERE id = $1`, [eventId]);
    const b04Row = b04After.rows[0];
    check(b04Row.status === 'cancelled', `B04-A: expected cancelled, got ${b04Row.status}`);
    check(b04Row.cancelled_by === admin.userId, `B04-A: cancelled_by should be MANAGER ${admin.userId}, got ${b04Row.cancelled_by}`);
    check(b04Row.cancelled_by !== spoofId, `B04-A: cancelled_by must NOT be spoof`);
    if (b04Row.cancelled_by === admin.userId) {
      evidence.push(`B04-A: cancelled_by pinned to manager ${admin.userId}, spoof rejected`);
    }

    // ── B04-B unrelated update ────────────────────────────────────────────
    console.log('[wave2-attribution] B04-B: unrelated update');
    const event2Res = await client.query(
      `INSERT INTO public.club_events (club_id, title, description, event_type, start_time, meeting_link, status, created_by)
       VALUES ($1, 'B04 Unrelated', 'Test', 'virtual', now() + interval '2 days', 'https://meet.example.com/b04b', 'scheduled', $2)
       RETURNING id`,
      [clubId, admin.userId]
    );
    const event2Id = event2Res.rows[0].id;
    await actAs(client, admin.userId);
    await client.query(`UPDATE public.club_events SET title = 'B04 Renamed' WHERE id = $1`, [event2Id]);
    const b04BAfter = await client.query(`SELECT status, cancelled_by, cancelled_at FROM public.club_events WHERE id = $1`, [event2Id]);
    check(b04BAfter.rows[0].cancelled_by === null, `B04-B: unrelated update should NOT set cancelled_by, got ${b04BAfter.rows[0].cancelled_by}`);
    check(b04BAfter.rows[0].cancelled_at === null, `B04-B: unrelated update should NOT set cancelled_at`);
    if (b04BAfter.rows[0].cancelled_by === null) evidence.push('B04-B: unrelated update left cancelled_by null');

    // ── B04-C repeated cancelled update ──────────────────────────────────
    console.log('[wave2-attribution] B04-C: repeated cancelled update');
    const cancelledByBefore = b04Row.cancelled_by;
    const cancelledAtBefore = b04Row.cancelled_at;
    await actAs(client, admin.userId);
    await client.query(`UPDATE public.club_events SET status = 'cancelled' WHERE id = $1`, [eventId]);
    const b04CAfter = await client.query(`SELECT cancelled_by, cancelled_at FROM public.club_events WHERE id = $1`, [eventId]);
    check(b04CAfter.rows[0].cancelled_by === cancelledByBefore, `B04-C: repeated cancelled should NOT re-stamp cancelled_by (expected ${cancelledByBefore}, got ${b04CAfter.rows[0].cancelled_by})`);
    // cancelled_at also should remain unchanged due to IS DISTINCT FROM false
    const caEqual = String(b04CAfter.rows[0].cancelled_at) === String(cancelledAtBefore);
    check(caEqual, `B04-C: cancelled_at should remain unchanged (expected ${cancelledAtBefore}, got ${b04CAfter.rows[0].cancelled_at})`);
    if (b04CAfter.rows[0].cancelled_by === cancelledByBefore) evidence.push('B04-C: repeated cancelled left attribution unchanged (no re-stamp)');

    // ── B04 RED PROOF ─────────────────────────────────────────────────────
    console.log('[wave2-attribution] B04 RED proof: neutralize cancelled_by pin');
    const eventRedRes = await client.query(
      `INSERT INTO public.club_events (club_id, title, description, event_type, start_time, meeting_link, status, created_by)
       VALUES ($1, 'B04 RED Event', 'Test', 'virtual', now() + interval '3 days', 'https://meet.example.com/b04red', 'scheduled', $2)
       RETURNING id`,
      [clubId, admin.userId]
    );
    const eventRedId = eventRedRes.rows[0].id;

    const mutatedB04 = originalB04Def
      .replace(/NEW\.cancelled_by\s*:=\s*auth\.uid\(\)\s*;/g, 'NEW.cancelled_by := NEW.cancelled_by; -- MUTATION B04 RED: pin neutralized')
      .replace(/NEW\.cancelled_by\s*:=\s*auth\.uid\(\)/g, 'NEW.cancelled_by := NEW.cancelled_by -- MUTATION B04 RED');

    await client.query(mutatedB04);
    evidence.push('B04 RED: applied mutated overlay (cancelled_by pin neutralized)');

    await actAs(client, admin.userId);
    await client.query(`UPDATE public.club_events SET status = 'cancelled', cancelled_by = $2, cancelled_at = '2020-01-01' WHERE id = $1`, [eventRedId, spoofId]);
    const b04RedAfter = await client.query(`SELECT status, cancelled_by FROM public.club_events WHERE id = $1`, [eventRedId]);
    const b04RedSpoofSurvives = b04RedAfter.rows[0].cancelled_by === spoofId;
    check(b04RedSpoofSurvives, `B04 RED: expected spoof ${spoofId} to survive under mutated trigger, got ${b04RedAfter.rows[0].cancelled_by}`);
    if (b04RedSpoofSurvives) evidence.push(`B04 RED PASS: spoof survived under mutated trigger`);

    // Restore original B04
    await client.query(originalB04Def);
    evidence.push('B04 RED: restored original trigger function');

  } finally {
    // Ensure restoration even if RED proof threw
    try { if (originalB03Def) await client.query(originalB03Def); } catch {}
    try { if (originalB04Def) await client.query(originalB04Def); } catch {}
    await client.end().catch(() => {});
  }

  console.log('[wave2-attribution] evidence:');
  for (const line of evidence) console.log(`[wave2-attribution]   · ${line}`);

  if (failures.length > 0) {
    console.error(`[wave2-attribution] CONTRACT FAILED (${failures.length}):`);
    for (const f of failures) console.error(`[wave2-attribution]   ✗ ${f}`);
    process.exit(1);
  } else {
    console.log('[wave2-attribution] PASS: B03 + B04 attribution contracts + RED proofs green');
  }
}

main().catch((e) => {
  console.error('[wave2-attribution] infrastructure failure:', e);
  process.exit(2);
});
