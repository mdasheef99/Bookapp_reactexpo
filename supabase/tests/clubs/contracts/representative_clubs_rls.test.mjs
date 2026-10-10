#!/usr/bin/env node
/**
 * CLUB-WU-L01-C · Representative non-Storage Clubs RLS contract
 *
 * SELECTED TABLE: public.club_messages
 * RATIONALE:
 *   - Ordinary Clubs data table (not Storage), genuinely RLS-enforced in production.
 *   - High-value: core club chat; status isolation is meaningful product semantics.
 *   - Policy uses real PostgreSQL RLS with auth.uid() + club_members status check,
 *     exercising same actor/RLS execution mode as B01 (SET ROLE + GUC).
 *   - LIVE policy (verified read-only):
 *       INSERT "Members can send messages"
 *         WITH CHECK (auth.uid() = user_id AND EXISTS (
 *           SELECT 1 FROM club_members WHERE club_id=club_messages.club_id
 *           AND user_id=auth.uid() AND status='active'))
 *     SELECT allows active+muted (so muted retains read, but loses write).
 *   - Exercises both club isolation (outsider/cross-club denied) and status
 *     isolation (active allowed vs muted denied) — satisfies candidate family A
 *     and B simultaneously with minimal fixture.
 *   - Alternate candidates considered: club_discussion_topics (can_participate),
 *     club_events, message_reactions — all valid but club_messages is simplest
 *     and most directly tied to user-visible membership status.
 *
 * Actors: ACTIVE MEMBER, MUTED MEMBER, OUTSIDER (cross-club check via same OUTSIDER),
 *         plus ANON not needed (SELECT policy is public-ish but club_messages
 *         SELECT is via club_members existence; write path is the enforced boundary).
 *         MUTED added via ensureMutedMember only because contract genuinely requires it.
 *
 * Matrix:
 *   POSITIVE: active member of Club A inserts message in Club A → succeeds, row persisted
 *   NEGATIVE STATUS: muted member of Club A inserts in Club A → RLS denied, no row
 *   NEGATIVE ISOLATION: outsider (no membership) inserts in Club A → denied
 *
 * RED proof: narrowly weaken status predicate (status='active' → status IN ('active','muted'))
 *            then muted insert succeeds → contract RED.
 */
import { Client } from 'pg';
import { ensureActor, createQualifyingClubs, ensureClubMember, ensureMutedMember } from '../actors.mjs';

const DATABASE_URL = process.env.CLUBS_L4_DATABASE_URL;

function assertLocality(url) {
  let p; try { p=new URL(url);} catch{ throw new Error('CLUBS_L4_DATABASE_URL invalid');}
  if (!['127.0.0.1','localhost'].includes(p.hostname) || !p.pathname.startsWith('/clubs_l4_')) throw new Error(`Locality guard ${p.hostname}${p.pathname}`);
}

async function queryAsRole(databaseUrl, role, userId, sql, params=[]) {
  const c = new Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    await c.query(`SET ROLE ${role}`);
    await c.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
    await c.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
    const res = await c.query(sql, params);
    return { ok:true, rows:res.rows, rowCount:res.rowCount };
  } catch(e){ return { ok:false, error:e, code:e.code, message:e.message }; }
  finally { try{await c.query('RESET ROLE');}catch{} await c.end().catch(()=>{}); }
}

async function insertClubMessageAs(databaseUrl, userId, clubId, content) {
  // RLS INSERT is TO public, so role authenticated works; policy checks auth.uid()=user_id
  return queryAsRole(
    databaseUrl, 'authenticated', userId,
    `INSERT INTO public.club_messages (club_id, user_id, content) VALUES ($1,$2,$3) RETURNING id, club_id, user_id`,
    [clubId, userId, content]
  );
}

async function main(){
  if(!DATABASE_URL) throw new Error('CLUBS_L4_DATABASE_URL required');
  assertLocality(DATABASE_URL);
  const failures=[]; const evidence=[];
  const check=(c,m)=>{ if(!c) failures.push(m); return c; };

  const superuser = new Client({ connectionString: DATABASE_URL });
  await superuser.connect();

  let originalPolicyWithCheck=null;
  try {
    // ── FIDELITY ────────────────────────────────────────────────────────
    const rls = await superuser.query(`SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='club_messages'`);
    check(rls.rows[0]?.relrowsecurity===true, `club_messages RLS not enabled`);
    evidence.push(`club_messages RLS enabled=${rls.rows[0]?.relrowsecurity}`);

    const pols = await superuser.query(`SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='club_messages' ORDER BY policyname`);
    const insertPol = pols.rows.find(r=>r.policyname==='Members can send messages' || r.policyname==='Active members can send messages' || r.policyname.includes('send messages'));
    // Live uses "Active members can send messages" or "Members can send messages" depending on migration history; accept either but must contain status='active'
    const candidatePols = pols.rows.filter(r=>r.cmd==='INSERT');
    check(candidatePols.length>=1, `no INSERT policy on club_messages (found ${pols.rows.map(r=>r.policyname)})`);
    // Find the one that checks status active
    const activeInsert = candidatePols.find(r=> r.with_check && r.with_check.includes("status = 'active'"));
    check(Boolean(activeInsert), `INSERT with_check missing status='active' predicate: ${candidatePols.map(r=>r.policyname+': '+r.with_check).join(' | ')}`);
    if(activeInsert) {
      originalPolicyWithCheck = activeInsert.with_check;
      evidence.push(`INSERT policy "${activeInsert.policyname}" with_check contains status='active'`);
      check(activeInsert.with_check.includes('auth.uid() = user_id') || activeInsert.with_check.includes('auth.uid()=user_id'), `with_check missing auth.uid()=user_id`);
    }
    const selectPol = pols.rows.find(r=>r.cmd==='SELECT');
    check(Boolean(selectPol), `missing SELECT policy on club_messages`);
    if(selectPol) evidence.push(`SELECT policy "${selectPol.policyname}" roles=${selectPol.roles}`);

    if(failures.length>0){ console.error('[REP-RLS] FIDELITY FAIL'); for(const f of failures) console.error(`[REP-RLS] ✗ ${f}`); process.exit(1); }

    // ── FIXTURE: club A with active + muted + outsider ─────────────────
    const admin = await ensureActor(superuser, { tier:'pro' });
    await superuser.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [admin.userId]);
    const clubRes = await superuser.query(`SELECT (public.create_club('L01C Rep Club','rep fixture',NULL,'public','all',NULL,$1::uuid,NULL,NULL,NULL)).id AS id`, [admin.userId]);
    const clubId = clubRes.rows[0].id;
    await superuser.query(`SELECT set_config('request.jwt.claim.sub','',false)`);

    const activeMember = await ensureActor(superuser, { tier:'free' });
    const mutedMember = await ensureActor(superuser, { tier:'free' });
    const outsider = await ensureActor(superuser, { tier:'free' });

    await ensureClubMember(superuser, clubId, activeMember.userId, 'member', 'active');
    await ensureMutedMember(superuser, clubId, mutedMember.userId, 'member');
    // outsider: no membership

    // Verify member states
    const memCheck = await superuser.query(`SELECT user_id, status FROM public.club_members WHERE club_id=$1 AND user_id = ANY($2)`, [clubId, [activeMember.userId, mutedMember.userId, outsider.userId]]);
    check(memCheck.rows.find(r=>r.user_id===activeMember.userId)?.status==='active', 'activeMember should be active');
    check(memCheck.rows.find(r=>r.user_id===mutedMember.userId)?.status==='muted', 'mutedMember should be muted');
    check(!memCheck.rows.find(r=>r.user_id===outsider.userId), 'outsider should have no membership');
    evidence.push(`club ${clubId.slice(0,8)} members: active=${activeMember.userId.slice(0,8)}, muted=${mutedMember.userId.slice(0,8)}, outsider=${outsider.userId.slice(0,8)}`);

    // Clean prior messages for idempotence
    await superuser.query(`DELETE FROM public.club_messages WHERE club_id=$1`, [clubId]);

    // ── GREEN POSITIVE: active member INSERT succeeds ───────────────────
    console.log('[REP-RLS] GREEN positive: active member insert');
    const msgContentA = `L01C active message ${Date.now()}`;
    const pos = await insertClubMessageAs(DATABASE_URL, activeMember.userId, clubId, msgContentA);
    check(pos.ok===true, `active INSERT should succeed, got ok=${pos.ok} code=${pos.code} msg=${pos.message}`);
    if(pos.ok) evidence.push(`active INSERT ok id=${pos.rows[0].id}`);
    const persistedPos = await superuser.query(`SELECT id, club_id, user_id, content FROM public.club_messages WHERE club_id=$1 AND user_id=$2 AND content=$3`, [clubId, activeMember.userId, msgContentA]);
    check(persistedPos.rows.length===1, `persisted active message should exist, found ${persistedPos.rows.length}`);
    check(persistedPos.rows[0]?.content===msgContentA, `persisted content mismatch`);

    // Also verify active can SELECT (read intact)
    const selActive = await queryAsRole(DATABASE_URL, 'authenticated', activeMember.userId, `SELECT id FROM public.club_messages WHERE club_id=$1`, [clubId]);
    check(selActive.ok===true && selActive.rows.length>=1, `active SELECT should see message`);

    // ── GREEN NEGATIVE STATUS: muted member INSERT denied ───────────────
    console.log('[REP-RLS] GREEN negative muted: muted insert denied');
    const msgMuted = `L01C muted attempt ${Date.now()}`;
    const mutedRes = await insertClubMessageAs(DATABASE_URL, mutedMember.userId, clubId, msgMuted);
    check(mutedRes.ok===false, `muted INSERT should be RLS denied, got ok=${mutedRes.ok}`);
    if(!mutedRes.ok) {
      check(mutedRes.code==='42501' || /policy|row-level security|permission denied/i.test(mutedRes.message), `muted error should be RLS 42501, got ${mutedRes.code} ${mutedRes.message}`);
      evidence.push(`muted DENIED code=${mutedRes.code}`);
    }
    const persistedMuted = await superuser.query(`SELECT id FROM public.club_messages WHERE club_id=$1 AND user_id=$2 AND content=$3`, [clubId, mutedMember.userId, msgMuted]);
    check(persistedMuted.rows.length===0, `muted row must NOT persist`);

    // Muted SELECT should still see club messages (read intact despite write denied)
    const selMuted = await queryAsRole(DATABASE_URL, 'authenticated', mutedMember.userId, `SELECT id FROM public.club_messages WHERE club_id=$1`, [clubId]);
    check(selMuted.ok===true && selMuted.rows.length>=1, `muted SELECT should still see messages (read intact)`);

    // ── GREEN NEGATIVE ISOLATION: outsider INSERT denied ───────────────
    console.log('[REP-RLS] GREEN negative outsider: outsider insert denied');
    const msgOut = `L01C outsider attempt ${Date.now()}`;
    const outRes = await insertClubMessageAs(DATABASE_URL, outsider.userId, clubId, msgOut);
    check(outRes.ok===false, `outsider INSERT should be denied`);
    if(!outRes.ok) evidence.push(`outsider DENIED code=${outRes.code}`);
    const persistedOut = await superuser.query(`SELECT id FROM public.club_messages WHERE club_id=$1 AND user_id=$2`, [clubId, outsider.userId]);
    check(persistedOut.rows.length===0, `outsider row must NOT persist`);

    // ── RED PROOF: weaken status predicate → muted succeeds ─────────────
    console.log('[REP-RLS] RED proof: weaken active-only predicate');
    // Capture exact policy name
    const polName = activeInsert.policyname;
    try {
      // Save original definition via pg_policies already captured; rebuild with muted allowed
      await superuser.query(`DROP POLICY IF EXISTS "${polName}" ON public.club_messages`);
      // Recreate with status IN ('active','muted') instead of = 'active'
      // Original is "status = 'active'::text" — naive replace would leave "::text" on boolean result.
      let mutatedCheck = originalPolicyWithCheck
        .replace(/status\s*=\s*'active'::text/, "status IN ('active'::text,'muted'::text)")
        .replace(/status\s*=\s*'active'/, "status IN ('active','muted')");
      if (mutatedCheck===originalPolicyWithCheck) {
        // Fallback: broader regex without quotes handling
        mutatedCheck = originalPolicyWithCheck.replace(/status\s*=\s*'active'.*?(::text)?/, "status IN ('active'::text,'muted'::text)");
      }
      await superuser.query(`CREATE POLICY "${polName}" ON public.club_messages FOR INSERT WITH CHECK (${mutatedCheck})`);
      evidence.push(`RED overlay: policy "${polName}" weakened to status IN ('active','muted')`);

      const redMutedContent = `L01C red muted ${Date.now()}`;
      const redMuted = await insertClubMessageAs(DATABASE_URL, mutedMember.userId, clubId, redMutedContent);
      check(redMuted.ok===true, `RED: muted INSERT should SUCCEED under weakened policy, got ok=${redMuted.ok} code=${redMuted.code} msg=${redMuted.message}`);
      if(redMuted.ok) {
        evidence.push(`RED PASS: muted insert succeeded id=${redMuted.rows[0]?.id} — contract would go RED`);
        const rc = await superuser.query(`SELECT id FROM public.club_messages WHERE content=$1`, [redMutedContent]);
        check(rc.rows.length===1, `RED persisted mutated row should exist`);
        // Clean red row
        await superuser.query(`DELETE FROM public.club_messages WHERE content=$1`, [redMutedContent]);
      } else {
        failures.push(`RED PROOF FAIL: muted still denied under weakened policy (code=${redMuted.code}) — harness not sensitive`);
      }
    } finally {
      await superuser.query(`DROP POLICY IF EXISTS "${polName}" ON public.club_messages`);
      await superuser.query(`CREATE POLICY "${polName}" ON public.club_messages FOR INSERT WITH CHECK (${originalPolicyWithCheck})`);
      evidence.push(`RED overlay restored: policy "${polName}" original`);
      // Verify restore denies again
      const verifyMuted = await insertClubMessageAs(DATABASE_URL, mutedMember.userId, clubId, `verify-restore-${Date.now()}`);
      check(verifyMuted.ok===false, `post-restore verify: muted should be DENIED again`);
      if(!verifyMuted.ok) evidence.push('restore verify: muted correctly DENIED again');
      else await superuser.query(`DELETE FROM public.club_messages WHERE user_id=$1 AND content LIKE 'verify-restore-%'`, [mutedMember.userId]);
    }

  } finally {
    await superuser.end().catch(()=>{});
  }

  console.log('[REP-RLS] evidence:');
  for(const l of evidence) console.log(`[REP-RLS]   · ${l}`);
  if(failures.length>0){
    console.error(`[REP-RLS] CONTRACT FAILED (${failures.length}):`);
    for(const f of failures) console.error(`[REP-RLS]   ✗ ${f}`);
    process.exit(1);
  } else {
    console.log('[REP-RLS] PASS: club_messages INSERT active vs muted/outsider + RED sensitivity proven');
    console.log('[REP-RLS] SELECTION RATIONALE: club_messages chosen as ordinary Clubs RLS with high-value status/isolation semantics, minimal fixture, same auth.uid mechanism as B01');
  }
}

main().catch(e=>{ console.error('[REP-RLS] infrastructure failure:', e); process.exit(2); });
