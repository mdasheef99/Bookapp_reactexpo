# Clubs UI Overhaul Tracker

**Branch:** `feat/clubs-ui-overhaul` from `origin/main` `c5e9714`
**Environment:** two-worktree split — this desk `C:\Users\LEGION\Desktop\Bookconnect4_expo` (clubs), sibling `C:\Users\LEGION\Desktop\Bookconnect4_library` @ `feat/library-shelf-motion` (library, live session). `stash@{0}` holds the library tracked-edit backup — leave it alone, do not pop or drop.
**SOT:** `ahntbtktjjmvfosgkmgn` `Bookconnect_reactexpo`
**Status:** `SDD-01-ui-overhaul` audit complete, docs only — no implementation yet
**Next:** Phase 1 shared-primitives implementation after user approval

## Scope
UI/UX aesthetic overhaul only. No service/API/schema behavior changes, no Supabase
mutations, no new dependencies. All existing contracts preserved.

## Baseline (2026-08-22, branch creation day)
- `npx jest --runInBand --testPathPattern "clubs"` → **18 suites / 190 tests PASS**
- Feature surface: 17 stack routes (`app/(tabs)/clubs/_layout.tsx`), ~6,900 LOC in
  `src/features/clubs/` (33 non-test files), thin route wrappers only.
- Test coverage holes: `ClubCard`, `ClubMemberList`, `ManageTabBar`, 12 of 13 manage
  sections, `clubEvents.shared.ts`, `manageUtils.ts`.

## Audit verdict (full evidence in SDD-01 §2)
1. Hardcoded semantic hexes bypassing `useTheme()` in 9+ screens (feedback banners,
   danger buttons, image placeholders) — breaks golden/midnight phases.
2. Copy-pasted StyleSheets instead of shared primitives; drift across screens.
3. Sub-44px touch targets: browse filter chips, ManageTabBar pills, discussion
   vote/reaction chips, bare-text moderation buttons.
4. Missing UX states: retry on error in authors/reading/venue-picker/manage,
   empty state in invite inbox, skeletons nowhere.
5. Dead code: unused styles, mojibake `�` at `ClubManageScreen.tsx:466`,
   `'Not going' : 'Not going'` ternary at `ClubEventsScreen.tsx:129`,
   triplicated label maps, duplicated nomination/application helpers.

## Phases (all pending authorization)
| Phase | Scope | Status |
|---|---|---|
| P1 | Shared primitives (`FeedbackBanner`, `ClubScreenHeader`, label maps, placeholder cover, state components); hex purge | docs only |
| P2 | Browse + `ClubCard`: GlassCard recipe, tinted tags, staggered motion, skeletons, 44px chips | docs only |
| P3 | Detail + member screens (events, reading, discussion, invite, applications, nominate, venues): primitives, retry/empty/pull-to-refresh | docs only |
| P4 | Manage console: tab bar targets, moderation buttons, mojibake/dead-style cleanup | docs only |
| P5 | Motion layer: staggered entrances, press-lift + haptics, all behind `useReducedMotion()` | docs only |

## Verification ledger
- 2026-08-22 baseline: clubs Jest 18/18 suites, 190/190 tests, branch created clean.
- 2026-08-22: P0 product decisions RESOLVED — all 7 blockers adopted per user sign-off,
  recorded in `docs/user/clubs/DECISIONS.md` (PRODUCT-05/10/11/12/14, TYPE-03-d,
  PRODUCT-HIER-P04). Remediation program unblocked for the P1 backend stream.
  Full register context: ChatGPT remediation thread, archived at
  `C:/Users/LEGION/Documents/BookConnect-records/chatgpt-clubs-remediation-full.txt`.
- 2026-08-22 Wave 1 COMPLETE (client-only, no DB): CACHE-01 fixed (`useUpdateClub`
  now invalidates `manageDetail`; TEST-03 test corrected to enforce it) · FUNC-02
  un-vote toggle (PRODUCT-11) · FUNC-03 un-react toggle (PRODUCT-12) · FUNC-01
  report overflow menu wired to existing hook (PRODUCT-10). New hooks:
  `useRemoveClubDiscussionVote`, `useRemoveClubDiscussionReaction`. Files:
  useClubs.ts (+2 hooks), ClubDiscussionThreadScreen.tsx (toggle handlers, ⋯
  report button, report reason sheet), useClubs.test.ts (CACHE-01 contract),
  ThreadScreen.test.tsx (mock surface only). Verification: clubs Jest
  18/18 suites 190/190 PASS post-change; global tsc --noEmit = 0 errors;
  no deps/migrations/deploy; nothing staged or committed.
- 2026-08-22 Wave 2 CONFIRMATION + migration DRAFTED (NOT applied):
  live evidence via Supabase MCP read-only (5/5 CONFIRMED-DEFECT):
  B03 resolved_by unpinned (no trigger/default on club_complaints) ·
  B04 cancelled_by client-suppliable via RLS UPDATE policy ·
  HIER-02 no target-membership check in issue_club_member_action ·
  HIER-03/P04 no self-target guard · BACKEND-05 club_invitations has NO
  expires_at column and accept_club_invitation never checks expiry.
  Draft migration: `supabase/migrations/20260822230000_clubs_wave2_attribution_guards_expiry.sql`
  (two BEFORE UPDATE pin triggers, issue_club_member_action rewrite with
  membership+self guards, expires_at column+backfill+default,
  accept_club_invitation synchronous expiry gate). Client side pre-staged:
  cancelClubEvent no longer sends cancelled_by. Awaiting user approval to
  apply; application checklist embedded in migration header.

- 2026-08-22 Wave 2 APPLIED TO LIVE (user-approved, project ahntbtktjjmvfosgkmgn):
  B03 resolved_by now server-pinned via trg_enforce_club_complaint_resolution ·
  B04 cancelled_by pinned via trg_pin_club_event_cancellation (+ client
  cancelClubEvent no longer sends cancelled_by) · HIER-02 target-membership
  guard + P04/HIER-03 self-moderation guard in issue_club_member_action ·
  BACKEND-05/PRODUCT-05 expires_at column added (default now()+14d, legacy
  pending backfilled — 1 row), accept_club_invitation synchronous expiry gate.
  Post-apply readback (all PASS): both triggers present on correct tables; all
  4 functions SECURITY DEFINER with search_path=public; expires_at timestamptz
  default confirmed; 1/1 pending invitation stamped; 0 closed complaints with
  null resolved_by; 0 cancelled events with null cancelled_by. Local migration
  file `20260822230000_clubs_wave2_attribution_guards_expiry.sql` matches live.
  Note: applied via MCP execute_sql per-statement rather than db push (fn body
  rewrites + backfill); ledger entry records this deviation. Verification:
  clubs Jest 18/18 suites 190/190 PASS; global tsc --noEmit = 0 errors;
  nothing staged or committed.
- 2026-08-22 B01 banner Storage lockdown APPLIED TO LIVE (user-approved,
  project ahntbtktjjmvfosgkmgn). Evidence: bucket had 7 policies incl. 3
  fully unconstrained ("Allow authenticated uploads/updates/select") —
  permissive-OR made any authed user able to write any object. Applied:
  all 7 old policies dropped; 4 club-scoped created (admin INSERT/UPDATE/
  DELETE gated by is_active_eligible_club_manager on {clubId} first path
  folder; public SELECT retained). Readback: exactly 4 club_banners_*
  policies, ZERO unconstrained policies remain, 2 existing objects under
  a club folder unaffected for reads. Client: ClubCreateScreen pre-creation
  upload removed per PRODUCT-14 (URL paste only, hint text added);
  ClubManageSettingsSection already uploads {club.id}/cover.ext — matches
  new policy model. Local migration file:
  `20260822230000_clubs_b01_banner_storage_lockdown.sql`. Verification:
  clubs Jest 190/190 PASS, tsc 0 errors post client changes. Nothing
  staged or committed. BACKEND-07 closed NO-ACTION (live-vs-replay RSVP
  policy drift audit returned zero drift — replay reproduces live exactly).
- 2026-08-22 BACKEND-02 creation-cap race fix APPLIED TO LIVE (user-approved).
  Evidence: cap check was non-locking COUNT(*) — concurrent same-admin
  inserts could both pass and exceed tier caps. Fix:
  pg_advisory_xact_lock(hashtextextended('club-cap:' || admin_id, 0))
  taken BEFORE the count inside enforce_book_club_entitlement; rest of
  function verbatim. Lock key namespaced 'club-cap:' after conflict audit
  found marketplace/phase9 functions share the advisory hash space
  (their keys are 'phase6-cart:...'/scope-composites — no structural
  collision, prefix eliminates theoretical hash collision; all existing
  usages xact-level, one key per tx). Readback PASS: prosecdef true,
  search_path=public, namespaced lock present in live prosrc (body_len
  1486), trigger attached, zero-arg identity preserved. Residual: true
  parallel-insert race test deferred to L01 harness as its first entry.
  Local migration file:
  `20260822234500_clubs_b02_creation_cap_race_fix.sql` (matches live,
  modulo lock-key prefix hardening applied during application).
- 2026-08-22 TYPE-03/TYPE-03-d emoji canonical set APPLIED TO LIVE
  (user-approved). Evidence: emoji column had only a non-blank CHECK;
  live data held 7 distinct values, 2 of them double-encoded mojibake
  (corrupted 👍/😂). Applied: (1) deleted the 2 mojibake rows by exact
  id after evidence showed each was a duplicate of an existing
  canonical row by the same user on the same reply (repair-by-update
  was blocked by unique constraint reply_user_emoji; deletion loses no
  reaction data); (2) added CHECK club_discussion_reactions_emoji_canonical
  enforcing exactly the 11 canonical emojis matching REACTION_OPTIONS in
  ClubDiscussionThreadScreen. Readback PASS: constraint present alongside
  emoji_present + target_check; DISTINCT emoji all canonical (❤️👍👏🔥😂);
  negative INSERT with 'x' rejected at CHECK layer (23514). Scope note:
  message_reactions (chat domain) intentionally untouched. Residual:
  TS union ClubDiscussionReactionEmoji still declares 5 — widening to
  the same 11 is client-side follow-up under T-stream. Local migration
  file: `20260822235000_clubs_t03_emoji_canonical_set.sql`.

## Rules
- Existing 18 suites must stay green after every phase; new primitives get tests.
- Any phase may be shipped independently; order P1→P5 recommended.
