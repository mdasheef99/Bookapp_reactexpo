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
- 2026-08-23 small-items batch COMPLETE (committed 3d671f9, pushed):
  TYPE-03 client follow-up — emoji union widened 5→11 matching DB CHECK,
  REACTION_OPTIONS typed directly (no cast) · CLUB-TYPE-04 —
  ReactionSummary.users now plain enumerable field (defineProperty trap
  removed; clubsService test asserts users content) · CLUB-TYPE-05 —
  replyId! assertions replaced with guarded casts · CLUB-CACHE-02 — new
  shared useViewerMembershipTier hook (React Query, staleTime 5min)
  replaces imperative getProfileSummary effects in ClubDetail/
  ClubEventEditor/ClubEvents screens; screen tests mock the hook.
  Verified: clubs Jest 18/18 suites 190/190 PASS, tsc --noEmit 0 errors.
- 2026-08-23 HIER-01 CORRECTION (user-challenged, Muse Spark re-check):
  club_members_role_check already existed live since ~March 2026 via
  untracked manual DDL — register finding was stale. Today's earlier
  club_members_role_canonical is a redundant duplicate (harmless;
  candidate to drop). BACKEND-06 also closed NO-ACTION: transfer_club_admin
  does not exist live and has zero references. Tooling note: OpenCode Go
  free quota exhausted mid-session ("Insufficient balance" on ox-alpha-free);
  DB work continued on opencode/muse-spark-1.2-contributor-free.
- 2026-08-26 CLUB-WU-L01-A IMPLEMENTED (B02 slice only; L01-B/C/D open).
  New disposable real-PostgreSQL-17 Docker harness `supabase/tests/clubs/`
  (`clubsL4Runner.mjs` orchestrator, `actors.mjs`, platform bootstrap +
  FLAGGED replay bridge fixtures, `contracts/b02_creation_cap.test.mjs`);
  pinned image `postgis/postgis:17-3.5`; npm scripts
  `test:clubs:l4{,:b02,:f04}`; `pg` added to devDependencies (8.23.0).
  B02 deterministic race GREEN across 5 whole-harness runs: A holds the
  transaction advisory lock while uncommitted (observer-verified via
  pg_locks/pg_stat_activity, identical objid, wait_event=advisory),
  COMMIT A ⇒ B resumes and rejects SQLSTATE P0001
  'Membership tier club creation limit reached', final count exactly 5,
  no orphan membership rows. RED-proof PASS: runtime temp overlay of the
  REAL B02 file minus only the advisory-lock statement (never written to
  repo, deleted after run) makes the contract fail 5 assertions incl.
  B settling before A commits. REPLAY GAPS FOUND AND FLAGGED (live-
  verified read-only against ahntbtktjjmvfosgkmgn, restored only as
  historical schema substrate in `fixtures/clubs_l4_replay_bridge.sql`,
  no behavior under test copied): book_clubs `lead_id→admin_id` rename +
  `meeting_type`/`author_id` columns + club_members role CHECK
  ('member','moderator','admin') exist live via untracked manual DDL but
  no tracked migration performs them (same class as HIER-01 above);
  repository migration chain cannot replay past 010 without them.
  F04 REGRESSION ANCHOR PARTIAL/BLOCKED: existing F04 files unchanged;
  through the new runner `f04_fixture.sql`, F04 migration
  `20260824100000`, and `f04_concurrency.mjs` all PASS, but
  `f04_contract_tests.sql` aborts at CASE 7 (bare
  `SELECT set_config(...)` inside DO block — invalid plpgsql in any PG
  version; WU-F04 doc lists this file under "Not run here", so it was
  never executed before). Per instruction F04 was NOT modified — owner
  decision required (one-line SELECT→PERFORM candidate fix).
   Verification: B02 suite exit 0 ×5; mutation demo detects removal;
   clubs Jest 19 suites / 198 tests PASS; `tsc --noEmit` 0 errors.
   Nothing applied to Supabase; nothing staged or committed.
- 2026-08-26 CLUB-WU-L01-A BOUNDED CLOSEOUT — **NOT CLOSED** (Owner
  Decisions 1 & 2 executed; stop condition hit).
  DECISION 1 (F04 harness repair): authorized minimal syntax fix applied
  to `supabase/tests/f04_contract_tests.sql` — TWO bare side-effect-only
  `SELECT set_config(...)` statements inside PL/pgSQL DO blocks changed
  to `PERFORM` (CASE 7 line 86 + CASE 13 line 146 pre-repair; CASE 13
  has the identical defect shape and would abort the script under
  ON_ERROR_STOP). No semantics/fixtures/assertions/indexes/RPC/SQLSTATEs/
  counts touched.
  REAL EXECUTION RESULT (first actual execution of this script ever):
  fixture PASS · F04 migration PASS · contract cases 1–13 execute clean ·
  script FAILS at CASE 14 — its seeded-duplicate INSERT violates
  `club_discussion_reactions_topic_user_unique`, the NON-deferrable
  partial unique index created by the same F04 migration Step 3; script
  and migration share commit e213977, so the suite was never executable
  end-to-end. STOP rule honored: no assertion rewritten; CASE 14 needs a
  new bounded owner decision (drop-and-reseed around the repair CTE vs
  delete the case are candidate shapes — NOT chosen here). F04
  concurrency A–D not reached (runner aborts before probe).
  RECORD CORRECTED: PRODUCT FIX remains CLOSED; TEST-HARNESS DEFECT =
  syntax portion fixed during L01-A + deeper CASE 14 design defect newly
  confirmed; AUTOMATED SQL CONTRACT = now actually executed, RED pending
  owner decision (see WU-F04-implementation.md assurance-record
  correction).
  B02 RECONFIRMED this session: deterministic lock-wait evidence intact
  (A holds granted advisory xact lock objid=3642800262 while uncommitted;
  B blocked on identical objid across 3 stable polls; COMMIT A ⇒ B
  resumes, rejects P0001 'Membership tier club creation limit reached';
  final qualifying clubs = 5, no orphan membership); RED sensitivity
  reconfirmed via temp --mutation no-lock overlay (contract failed 5
  assertions incl. B settling while A uncommitted); real B02 migration
  untouched. Combined `test:clubs:l4` exits 2 solely on the F04 CASE 14
  abort.
  DECISION 2 (replay gap) LOGGED: repository/live migration drift
  CONFIRMED as real finding — tracked chain lacks lead_id→admin_id
  rename, meeting_type + meeting_type_check, author_id, and club_members
  role CHECK ('member','moderator','admin') transitions that later
  migrations (004/010 onward) assume and live dev DB contains; bridge
  header now states TEMPORARY L01-A TEST SUBSTRATE / NOT TEST-07 CLOSURE
  / NOT AUTHORITATIVE MIGRATION HISTORY / TO BE RESOLVED BY L01-D /
  migration replay reconciliation. CLUB-TEST-07 remains OPEN; migration
  replay remains OPEN; L01-B/C/D remain OPEN; no production migration
  created or altered; zero live Supabase mutations (read-only evidence
  only).
   LOCKFILE: `pg@^8.23.0` consistent across package.json devDependencies,
   package-lock.json root deps (`node_modules/pg` 8.23.0); npm ls clean.
   Verification rerun this session: jest clubs 19 suites / 198 tests PASS;
   `tsc --noEmit` 0 errors. Nothing staged or committed (closure criteria
   #5 unmet ⇒ no commit per instruction).
- 2026-08-26 CLUB-WU-L01-A FINAL CLOSEOUT COMPLETE — **CLOSED** (Owner
  Decision F04 CASE 14 executed verbatim; every closure criterion green).
  CASE 14 RESTRUCTURED AT THE MIGRATION BOUNDARY (repair coverage NOT
  retired; repo F04 migration untouched): historical post-migration CASE 14
  removed from `supabase/tests/f04_contract_tests.sql` with an in-file
  pointer comment (number 14 retired, not reused; remaining post-migration
  contracts = CASE 1–13 unchanged) because its seeded-duplicate INSERT was
  correctly rejected by the same-migration non-deferrable unique index and
  its "proof" re-ran a COPY of the repair CTE instead of the migration.
  NEW ARCHITECTURE through the L01 runner: f04_fixture.sql →
  `f04_pre_migration_duplicate_seed.sql` (dedicated actor …3333/topic …0003;
  3 legal pre-F04 rows 👍❤️🔥, DISTINCT created_at, newest=❤️ id …ccc-0002;
  ordering mutually exclusive with id DESC so created_at DESC alone decides)
  → ACTUAL F04 migration 20260824100000 unchanged →
  `f04_migration_repair_contract.sql` (zero repair SQL duplicated; asserts
  exactly-1 survivor, winner id/emoji/created_at preserved, losers deleted
  by exact id, both partial UNIQUE indexes exist+enforcing, immediate
  duplicate INSERT rejected 23505) → existing CASE 1–13 → concurrency A–D.
  REAL EXECUTION (disposable PG17, exit 0 ×3 runs incl. combined): all seven
  required items PASS. RED PROOF (--mutation no-repair, temp copy of the
  REAL migration with only Step-1 loser filters → WHERE FALSE and Step-2
  fail-loudly guard → IF FALSE; indexes/RPC verbatim; never written to repo,
  deleted after run): mutated migration FAILED at CREATE UNIQUE INDEX
  club_discussion_reactions_topic_user_unique on the surviving duplicates —
  repair step proven load-bearing via owner-named outcome #1. First attempt
  bypassing Step 1 only was ruled out: Step-2 guard fired first, masking the
  specified index-creation outcome. B02 RECONFIRMED green (deterministic
  lock-wait evidence intact; P0001 cap rejection; final count 5, no orphans)
  + B02 RED sensitivity reconfirmed via --mutation no-lock (contract failed
  5 assertions incl. B settling while A uncommitted); real B02 migration
  untouched. Combined `npm run test:clubs:l4` exit 0. Clubs Jest 19 suites /
  198 tests PASS; `tsc --noEmit` 0 errors. NO new product/database behavioral
  discrepancy found; no assertion rewritten to pass. L01-D/REPLAY GAP NOT
  expanded into: bridge remains TEMPORARY L01-A TEST SUBSTRATE / owned by
  L01-D; CLUB-TEST-07 OPEN. Single bounded commit
  `test(clubs): establish L01-A backend contract harness` (L01-A-owned files
  only; unrelated dirty files excluded); nothing pushed; zero live Supabase
  mutations (local disposable Docker PostgreSQL only).

## Rules
- Existing 18 suites must stay green after every phase; new primitives get tests.
- Any phase may be shipped independently; order P1→P5 recommended.
