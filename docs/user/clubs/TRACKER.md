# Clubs UI Overhaul Tracker

## Anchored reaction popover (2026-10-01)
- Replaced the emoji bottom sheet with a compact 272 px maximum-width popover measured from the clicked topic/reply reaction button. Placement chooses below/above and clamps within 12 px viewport margins; constrained heights scroll. Resize and account/route changes dismiss stale positioning, and stale measurement callbacks are ignored. Existing report/reaction-user sheets are preserved.
- Added option accessibility labels, 44 px targets, initial option focus, outside-tap/Escape/native-back dismissal and trigger-focus restoration. Selection uses the unchanged reaction mutation and closes after success; options are disabled while saving. Reaction emoji size and existing services/permissions remain unchanged.
- Verification: final thread suite passed 21/21, including selection payloads, outside dismissal, and left/right/bottom bounds. Initial picker tests failed because native mock measurement did not invoke its callback; a scoped measured-button helper corrected the test setup without adding production fallback behavior. Web export and diff check passed. Initial visual inspection revealed an unnecessary scrollbar and four-column wrapping from border sizing; corrected width/height calculations and confirmed a five-column grid. TypeScript closeout follows.
- Browser inspected normal and 390×844 widths: topic popover below, lower reply popover above, all options in bounds, Escape/outside dismissal, and focus restored. No votes/reactions/comments were submitted. Viewport reset. Evidence: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/reaction-popover-mobile.png` and `reaction-popover-above.png`.
- Final `tsc --noEmit --incremental false` passed. No service/backend/schema/migration changes, database writes, commit, push, or external deployment. Existing uncommitted changes preserved. Next action: user review of the anchored emoji picker; native device/status-bar placement remains outside browser verification.

## Compact thread and inline editor (2026-10-01)
- Implemented the approved density refinement: reply vertical padding 12→8 px, internal gaps 8→4 px, branch indentation capped at 28 px (14 px per level), tighter branch/heading/card spacing, and reaction badges within the reply action row when space allows. Read-only/muted and deleted-topic reaction visibility remains supported separately. Font sizes and 44 px touch targets are preserved.
- Editor now starts at 64 px, grows up to 180 px with scrolling for longer drafts, uses a one-line quote preview, and combines Quote, “To topic” (accessible label “Reply to topic instead”), and Post reply in a wrapping footer. No draft/posting/target/service contracts were changed.
- Edge-case investigation found a new web resize loop when clearing a long draft: scrollHeight follows assigned height but excludes borders, repeatedly shrinking until React's update-depth guard. Corrected with a stable callback, monotonic growth while nonempty, and explicit reset to 64 px when empty. Added a regression for capped growth, smaller measurements, clearing, and blank-submit disabled state; updated capped indentation assertion.
- Verification: final focused thread/optimistic-vote suites passed 22/22 tests, web export passed with one worker, and diff hygiene passed. Earlier pre-correction suites passed 21/21 but did not cover the resize defect; the browser check exposed it. First correction export hit filesystem EPERM; renewing the turn-scoped worktree write permission allowed the final passing export. TypeScript result recorded below.
- Browser checks at normal and 390×844 viewport: compact comments/editor/footer fit, long draft grows and scrolls, clearing resets without error, Cancel/reopen preserves draft, switching to topic preserves draft, empty submission remains disabled. Temporary test drafts were cleared; no votes/reactions/comments submitted. Viewport reset. Evidence: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-compact-mobile.png`.
- Final `tsc --noEmit --incremental false` passed. No backend/service/schema/migration changes or database writes; no staging, commit, push, or external deployment. Existing uncommitted work preserved. Next action: user review of compact thread layout. Native keyboard/device checks remain outside this browser verification.

## Optimistic voting and thread typography consistency (2026-10-01)
- Implemented user-approved immediate vote feedback for topic/reply set, switch, and remove through the existing hooks. Updates only the acting user's exact thread cache; cancels an in-flight thread read before projecting counts/selection, rolls back only the affected vote fields on failure, and reconciles discussion/thread caches on settlement. Removed overlapping viewer-key invalidation. Service payloads, server authentication, RLS, schema, and migrations remain unchanged. Screen voting is serialized with a ref guard, and remove-vote pending state now disables conflicting interactions.
- Further reduced selected emoji to 12/16 px and picker emoji to 18/24 px. Body/input/quoted preview are Inter 14/21; topic/reply metadata 13/19; composer controls, attribution, action labels/counts 12/18. Larger Newsreader headings retain the approved hierarchy. Minimum 44 px interaction targets remain.
- Verification: 3 focused Jest suites / 33 tests passed, including deferred-server optimistic topic vote, reply down-to-up switch with failure rollback, remove-vote feedback, account cache isolation, preservation of unrelated updates, existing hook contracts, and thread interactions. Final TypeScript, Expo web export (one worker), and diff checks passed. Initial TypeScript context inference error was corrected before the passing run; the first Jest launcher failed from shell quoting, then the direct Node launcher ran the suites successfully.
- Browser verification: reloaded the existing development thread; removed/restored its original topic upvote using the existing UI. Count changed while the mutation was visibly pending and remained correct after reconciliation. This made two authorized development vote mutations through unchanged services; final selection/count restored. No reaction/comment writes. Final typography screenshot: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-consistent-type.png`. Server request duration was not benchmarked; this change removes the network wait from displayed selection/count, not server completion time.
- No migrations, service changes, database permission changes, staging, commits, push, or external deployment. Existing user work preserved. Scope complete; next action is user review of the thread refinement. Astra consultation was optional and not performed for this bounded implementation.

## Selected emoji refinement and vote-delay investigation (2026-10-01)
- Reduced selected reaction emoji from 16 to 14 px (matching comment text), their visible pill minimum from 30 to 28 px, and picker emoji from 24 to 20 px inside 44 px options. Selected reaction touch targets remain at least 44 px.
- Read-only vote investigation: both vote hooks lack optimistic cache updates; service awaits `auth.getUser()` before vote write; success awaits broad discussion plus thread invalidations (including overlapping thread-root/viewer keys). Thread fetch reads topic, then replies, then votes/reactions/read state in parallel, then profile summaries. The displayed count/selection comes from this refreshed topic. This explains why visual feedback includes network/refetch latency, but individual request timing was not measured and no exact server-latency attribution is claimed.
- Git history: `cf31fbe` fixed reply-target cache invalidation by passing `parentTopicId`; it did not implement immediate optimistic vote feedback. No optimistic voting implementation was found in accessible history for the thread screen or discussion hooks. Vote behavior is unchanged in this step. Recommended next change: frontend optimistic vote selection/count with rollback and reconciliation, preserving server permissions and service contracts.
- Verification: Expo web export passed; browser reload showed smaller selected emoji, and reaction picker opened/dismissed correctly without submitting reactions/votes. Evidence: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-smaller-emoji.png`. No tests run, database mutations, migrations, commits, or external deployments.

## Discussion thread control proportions (2026-10-01)
- Refined the existing inline thread action styling: retained 14/21 px comment text, standardized action icons and reaction emoji at 16 px, and used 12/18 px medium action labels/counts. Removed the large outlined vote/utility surfaces; selected votes and reaction summaries use compact 30 px minimum visual surfaces inside targets of at least 44 px. Actions wrap and text remains scalable.
- Preserved vote/reaction/report/reply handlers, permissions, services, and backend contracts. Delete remains deferred. No database writes, migrations, staging, commit, push, or external deployment occurred.
- Verification: final Expo web export passed with one worker; diff whitespace check passed. Reloaded the existing localhost 8081 thread, visually inspected root/nested replies and reaction proportions, and opened/cancelled a nested inline reply without posting. Screenshot: `C:/Users/LEGION/Documents/Codex/2026-09-27/use-this-as-a-projectless-chat/inline-thread-evidence/thread-proportions-refined.png`. An initial intermediate export failed on a missing JSX closing tag; corrected before the passing export. No Jest tests were run for this styling-only step.
- TypeScript verification: `tsc --noEmit --incremental false` passed. Scope complete; next action is user review of the refined control proportions. Existing uncommitted inline-thread implementation and unrelated screenshot were preserved.

## Clubs V2 follow-up (2026-09-29)
- User-approved Club Home treatment: Discuss is a blush destination button below the current-book card; Readers remains a disclosure row; Events is a quieter matching button below Readers.
- Existing Discuss and Events routes are preserved. No backend, API, database, or schema behavior changed in this UI follow-up.
- Verification on `feat/clubs-v2`: full Jest passed (312 suites, 1 skipped; 2,700 tests, 4 skipped); `ClubDetailScreen.test.tsx` passed 44/44; `tsc --noEmit` passed; web export succeeded with one worker; Club Home was visually inspected in the browser at a mobile viewport.
- This is a scoped V2 UI follow-up and does not advance or replace the older overhaul phases recorded below.

## Clubs V2 Discussion screen follow-up (2026-09-29)
- Implemented the user-selected Stitch artboard “Clubs V2 — Discussion (browse first)” in the existing discussion route, with its inline composer-open companion state. The screen now uses the approved warm ivory/burgundy palette, white topic and composer surfaces, Newsreader titles, and Inter labels/body/metadata. The default view leads with recent topics; topic titles lead, body and attributed first reply previews remain visible, reply count and score are separated, and Open thread stays explicit. Author/time metadata omits the redundant “Started by” prefix so it stays on one line at 390 px.
- The existing title/body fields and posting mutation are reused. Start/Hide only expand or collapse the composer; local draft values survive collapse/reopen. Existing routes, access gates, loading/error/empty/retry states, feedback, and topic ordering remain unchanged. No service/API/schema code or migrations changed.
- Verification: the Clubs suite passed 23 suites / 334 tests before the final metadata shortening; after that change, the focused screen suite passed 7/7, `npx tsc --noEmit` passed, and web export passed with `--max-workers 1`. The running page was inspected at a measured 390×844 CSS viewport: two topic rows scan cleanly, the author/time line stays on one line, the lower reply preview and footer clear the fixed navigation, and the composer fields and Post topic action remain visible when expanded. The viewport override was reset after inspection.
- Astra’s independent screenshot review approved the implementation at both the captured desktop width and 390×844. It found no blocking page-local visual issue; it noted that keyboard, touch-target, screen-reader, enlarged-text, and posting/access behavior still require interaction checks. No external references were consulted.
- Browser data note: during visual interaction checking, a coordinate click intended for “Hide composer” activated the existing “Post topic” control instead. The app confirmed one development topic write through the existing create-topic service for “ZZ_TEST MANAGE BASICS CLUB” by “ZZ Test Playwright”: title “A thought about chapter four”, body “The ending changed how I read the opening.” No further discussion-data action was taken; cleanup awaits the user’s direction.
- No code was staged, committed, pushed, deployed, or migrated. The existing untracked `clubs-home-390x844-authenticated-dedup.png` was left untouched.

## Clubs V2 Discussion Thread inline reply implementation (2026-09-30)
- Implemented the approved Stitch “Discussion Thread (inline reply)” direction in `src/features/clubs/screens/ClubDiscussionThreadScreen.tsx` and the new `DiscussionReplyComposer.tsx`. A single editor appears within the selected topic or reply, shows the exact reply target and quoted preview, retains its draft across Cancel and target changes, keeps failed drafts available to retry, and prevents double submit or retargeting while posting. A plain text quote inserts into the draft. Topic switching, keyboard dismissal, native back, and web Escape are supported. Missing/deleted targets retain their parent ID, show an unavailable message, and block posting. Reply branches render in chronological order with a globally capped indentation; each parent attribution remains visible.
- Preserved service and hook contracts, mutation payloads, active/muted/deleted participation and reporting gates, vote/reaction/report/unread behavior, and existing routes. Fixed Back to discussion to return to the discussion list route. Vote controls now announce target, counts, and selected state. No service, hook, route configuration, database, migration, or backend code changed; no live writes were made during browser verification.
- Verification on `feat/clubs-v2`: Clubs Jest 23/23 suites and 347/347 tests PASS (focused thread suite 18/18); `tsc --noEmit --incremental false` and `git diff --check` PASS; Expo web export PASS with one worker. Live 8081 development page reloaded after implementation; opened an existing nested reply and confirmed its inline editor, preview, blank-submit disabled state, target switching, draft retention, and no browser errors. The submit action was not activated. Independent code review completed; the vote-label/accessibility issue and missing stale-account test were addressed. Native device keyboard presentation remains outside the browser check. Screenshot evidence is saved outside the repo in the task evidence folder.
- Nothing staged, committed, pushed, deployed, or migrated. Existing unrelated tracker edits and `clubs-home-390x844-authenticated-dedup.png` were preserved.

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
  `20260822233000_clubs_b01_banner_storage_lockdown.sql`. Verification:
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
- 2026-08-30 CLUB-WU-TC02 COMPLETE — Clubs Edge Function contract tests
  landed on top of the passed TC02 context gate (0 material unknowns; both
  live deployments ACTIVE with verify_jwt=true). NEW test-only files:
  `supabase/functions/__tests__/check_membership_limits_function.test.ts`
  (22 tests) and `supabase/functions/__tests__/
  club_downgrade_grace_period_function.test.ts` (26 tests) plus recording
  stub `supabase/functions/__tests__/support/edgeFunctionHttpStubs.ts`
  (Deno `serve` capture without a server, controlled `Deno.env` shim,
  scriptable record-only `createClient` exposing auth/table/rpc call
  instrumentation; support filename deliberately avoids the literal
  `clubs` substring so the `--testPathPattern "clubs"` sweep does not
  execute it as a suite). Tests import and execute the REAL Edge handler
  source (serve callback captured, real Request/Response objects, real
  handler decisions) — no handler logic duplicated in tests. package.json
  modified: ONLY two test-only `moduleNameMapper` entries for the exact
  `https://deno.land/std@0.168.0/http/server.ts` and
  `https://esm.sh/@supabase/supabase-js@2` URL imports; no dependency,
  package-lock, preset, script, or runtime changes. Coverage pinned for
  check-membership-limits: self-request 200 with full entitlement body;
  cross-user 403 with ZERO privileged DB calls and only the anon client
  constructed (self-check-before-service-read, load-bearing); missing
  Authorization 401 before any client construction; invalid/expired JWT
  401; invalid user_id / invalid action 400 with no DB access; missing
  action defaults to create_club; free 0/0 upgrade reason; pro 4/5 vs 5/5;
  pro_plus 14/15 vs 15/15 (`<` create boundary); unknown tier and missing
  profile row treated as free; check_downgrade `<=` boundary (5/5 allowed,
  6/5 denied); privileged query shape (user_profiles select membership_tier
  + eq user_id + maybeSingle; book_clubs select('*', count exact, head
  true) + eq admin_id + or is_archived.is.false,is_archived.is.null on the
  service-role key with persistSession false); profile/count DB errors →
  400 with error field and no allowed=true (raw text not frozen); missing
  env → 500 naming the variable; OPTIONS 200 ok with the four CORS allow
  headers (no Allow-Methods demanded); malformed JSON 400. Coverage pinned
  for handle-club-downgrade-grace-period: OPTIONS 200 ok including
  x-cron-secret; GET 405 before env/client work; missing SUPABASE_URL /
  SUPABASE_SERVICE_ROLE_KEY → 500 with zero RPC; configured-secret gate
  (missing header 403 / wrong header 403 — both with zero client and RPC
  calls — vs correct header proceeding to RPC, P0 safe invariant);
  default RPC args exactly process_club_downgrade_grace_period with
  p_user_id null / p_grace_days 14 / p_dry_run false; explicit user_id
  forwarded unchanged; grace_days classes 1→1, 90→90, 0→14, 91→14,
  'abc'→14, '14'→14; dry_run classes true/'true'→true, false/'false'/1/
  missing→false; success wrapping {processed, results} with rows passed
  through unchanged; empty data → 0/[]; RPC error → 400 without freezing
  raw message; unexpected rejection → 500 generic 'Internal server error';
  malformed JSON falls back to default args (tolerance pinned as current
  behavior, not endorsed). Secret-unset runs are fixture setup only —
  no test frames unset-secret access as desired authorization policy.
  DEF-1 (optional CLUB_DOWNGRADE_CRON_SECRET policy, MEDIUM) and DEF-2
  (raw DB error exposure, LOW-MEDIUM) remain OPEN for their separate
  reviews; TC02 is not a security review. Load-bearing evidence is
  reasoned counterfactual: removing the self-check, flipping `<`→`<=` on
  create, `<=`→`<` on downgrade, removing the secret comparison, or
  renaming the RPC/args each flips a directly asserted observable in a
  named test. Verification: targeted Edge run 2 suites / 48 tests PASS;
  combined `npx jest --runInBand --testPathPattern
  "clubs|check_membership_limits_function|club_downgrade_grace_period_function"`
  21 suites / 246 tests PASS (previous 19 suites / 198 tests still green);
  broad `supabase/functions/__tests__` sweep 678/678 tests PASS with 7
  zero-test pseudo-suites reported by jest's default `__tests__` testMatch
  (6 pre-existing phase9 fixtures/support files + the new stub, same
  established pattern as `phase9MetadataComposition.ts`); `npx tsc
  --noEmit` exit 0. PRODUCTION EDGE SOURCES UNCHANGED (SHA256 of both
  index.ts files identical pre/post); no Edge deploy, no migration, no
  live writes, no secret/verify_jwt/cron/config.toml changes. Nothing
  staged or committed; nothing pushed.

- 2026-08-30 WU-TC03 PAIRED FIX + DB CONTRACTS COMPLETE (migration drafted locally,
  applied live 2026-08-30 as ledger version 20260830153413 — see TC03 CLOSEOUT below): context gate proved `accept_club_admin_transfer_request`
  broken by construction (demote-before-admin_id-flip trips
  `enforce_single_club_admin_membership` on every invariant-satisfying club)
  plus missing accept-time revalidation, RLS-legal direct INSERT bypass, and
  self/archived/access request gaps. Fix design approved (minimum-safe scope;
  expired-status lifecycle, multi-pending index/lock, repo-only
  `transfer_club_admin`, notifications, app error mapping DEFERRED).
  Implemented locally: NEW forward migration
  `20260830153413_clubs_tc03_admin_transfer_accept_revalidation.sql`
  (repository filename renamed to live ledger version; SQL byte-stable;
  CREATE OR REPLACE both RPCs with approved guard set + required write order
  flip-admin_id-first; DROP direct-INSERT policy "Admins can create transfer
  requests"; grants re-stated; identity/return/SECURITY DEFINER/search_path
  preserved); NEW `supabase/tests/clubs/contracts/admin_transfer.test.mjs`
  (RED phase on pre-fix chain reproduces the invariant failure with full
  no-mutation readback; GREEN matrix: happy path, authorization, invalid
  successors incl. access-level, wrong acceptor, expiry, admin-changed,
  membership/tier/access drift, archived drift, RPC-only creation (42501),
  author-club semantics, cap-trigger rollback, function-contract
  preservation incl. ACL/EXECUTE matrix); MODIFY `clubsL4Runner.mjs` (tc03
  suite: B02 chain + 20260529154500 + documented TEMPORARY author_club CHECK
  live-parity step (REC-1 gap, L01-D/TEST-07 owns replay repair) + RED to
  GREEN sequencing on one disposable DB). Verification: targeted TC03 suite
  PASS (RED 3 evidence groups + GREEN 13 contract groups); FULL Clubs L4
  runner PASS (b02 + f04 + wave2 + rls + downgrade + tc03); clubs Jest
  17 suites / 190 tests PASS; `npx tsc --noEmit` exit 0. NO live migration
  applied, NO live RPC calls, NO app/Edge/config changes, historical
  migrations untouched. Nothing staged or committed; nothing pushed.
  TC03 CLOSEOUT 2026-09-13: migration live-applied (ledger 20260830153413;
  repository filename renamed to match; stored SQL semantically exact — sole
  delta vs draft is comment whitespace). Admin-flip-before-demotion invariant
  fix confirmed in the live `accept_club_admin_transfer_request` definition;
  structural verification passed read-only (both RPC identities, SECURITY
  DEFINER, search_path=public, plpgsql). CLOSED. (The 'NO live migration
  applied' note above describes the pre-deployment contract-verification
  session only.)
- 2026-09-13 WU-TC01 CLOSEOUT — downgrade/grace ambiguity fix (2026-08-30 work,
  now recorded): forward migration
  `20260830090435_clubs_fix_downgrade_grace_archived_club_ids_ambiguity.sql`
  (repository filename renamed to live ledger version; SQL byte-exact match to
  the stored ledger statement modulo trailing-newline convention). Original
  defect: the RETURNS TABLE OUT parameter `archived_club_ids` collided with
  `club_downgrade_grace_events.archived_club_ids`, failing every non-dry-run
  existing-warning UPDATE with 42702 and rolling back remediation. Fix qualifies
  the column reference; identity/return/SECURITY DEFINER/search_path/EXECUTE
  contract preserved (live structural check:
  `process_club_downgrade_grace_period(p_user_id uuid, p_grace_days integer,
  p_dry_run boolean)`, secdef, search_path=public, plpgsql). Live applied
  (ledger 20260830090435, 2026-08-30 09:04 UTC). Retrospective cron health
  verified read-only: job `club-downgrade-grace-period` (`0 2 * * *`, active);
  the 2026-08-30 02:00 UTC run was pre-deployment (NOT post-fix); first true
  scheduled post-fix run 2026-08-31 02:00 UTC succeeded; all retained post-fix
  runs healthy with zero 42702 recurrence (100/100 retained runs `succeeded`,
  zero failures). CLOSED.
- 2026-09-13 WU-TC04 CLOSEOUT — book-workflow concurrency/write-boundary fix:
  migration `20260912200746_clubs_tc04_book_workflow_write_boundary.sql`
  (renamed to live ledger version; SQL byte-exact). Nomination concurrency
  23505 repaired with bounded conflict-safe re-evaluation (targeted ON CONFLICT
  plus retry loop, first-writer-wins); direct nomination/vote INSERT bypasses
  closed (REVOKE plus policy drops); authenticated direct
  `book_clubs.current_book_id` UPDATE closed (column-level boundary, legitimate
  selection RPCs preserved); function/ACL preservation verified live
  (`nominate_club_book` 7-arg identity, SECURITY DEFINER, search_path=public).
  Independent adversarial review passed; live applied (ledger 20260912200746);
  structural verification passed. CLOSED. The migration body's historical
  'LOCAL ONLY — NOT APPLIED LIVE' comment is superseded by this entry; the SQL
  was left byte-stable as production provenance.
- 2026-09-13 WU-TC05 CLOSEOUT — useClubs mutation invalidation contracts
  (client-only, no backend/live operation, no DB migration): `eventRoot` key
  hierarchy fix (event invalidations now fan out to all users); `manageDetail`
  invalidation added after current-book selection
  (`useFinalizeClubBookNomination`, `useSetClubCurrentBookFromNomination`);
  `currentBookStatusRoot` invalidation added to member-status/member-action
  mutations; admin-transfer invalidation extended to status overview plus
  successor membership. NEW
  `src/features/clubs/hooks/__tests__/useClubs.mutations.test.tsx` with 21
  mutation tests (count verified). Broader Clubs result at
  implementation/review checkpoint: 20 suites / 219 tests; dual adversarial
  review passed. Cross-feature `user_books.reading_status` / Library cache
  coupling deferred separately. CLOSED.
- 2026-09-13 WU-TC06 CLOSEOUT — Clubs books/discussion service coverage
  (client-only, no backend/live operation, no DB migration): CONFIRMED
  PRODUCT DEFECT — `setClubDiscussionReaction()` sent incorrect PostgREST
  named RPC arguments (OLD/BROKEN: `p_topic_id`, `p_reply_id`, `p_emoji`;
  CORRECT live/applied contract: `in_topic_id`, `in_reply_id`, `in_emoji`).
  Production fix in `src/features/clubs/services/clubsDiscussionService.ts`
  (argument names only; RPC name `set_club_discussion_reaction` unchanged, no
  `user_id` argument, actor identity remains server-derived). NEW
  `src/features/clubs/services/__tests__/clubsBooksService.test.ts` (44 tests)
  and `src/features/clubs/services/__tests__/clubsDiscussionService.test.ts`
  (39 tests); `clubsDiscussionReactionRpc.test.ts` corrected to `in_*` with
  `p_*`/`user_id` regression guards. All 11 active Clubs book service exports
  and all 12 active Clubs discussion service exports covered materially; no
  dead exports found in scope. Verification: targeted TC06 3 suites / 91 tests
  PASS; all Clubs service tests 4 suites / 138 tests PASS; broad Clubs 20
  suites / 294 tests PASS; `npx tsc --noEmit` exit 0. Mutation sensitivity
  independently verified (each RED then GREEN): M1 reaction RPC named
  arguments, M2 current-book reading-status `p_status`, M3 reading-schedule
  `book_id` filter, M4 discussion vote target/onConflict, M5 discussion report
  club filter. Independent adversarial review PASS: 0 blockers, 0 majors,
  0 unresolved material unknowns. Scope: no DB migration, no live DB writes,
  no live mutating RPC invocation, no RLS change, no Edge change, no hook
  change, no screen change, no Library change, no `user_books` cache change.
  Non-blocking deferred items: optional Google `smallThumbnail` fallback test
  coverage; missing-target guard coverage asymmetry for remove discussion
  vote; current-book-overview defensive empty-result handling; known
  Library/Clubs `user_books.reading_status` cache coupling; other previously
  documented deferred Clubs hardening items. CLOSED.

- 2026-09-13 MIGRATION RECONCILIATION DEFERRED — migration-history
  reconciliation was audited on 2026-09-13 and intentionally deferred because
  the shared Supabase project has active parallel feature work. Authoritative
  details: `docs/deployment/MIGRATION-RECONCILIATION-2026-09.md`. Normal
  production migration deployment remains frozen until reconciliation is
  resumed and completed. This does NOT block Clubs commit/push/PR/merge
  because repository merge does not automatically deploy database migrations.
  Clubs implementation status unchanged by this entry.
- 2026-09-30 DISCUSSION THREAD UI REDESIGN — implemented the approved Stitch
  conversation-first direction in `src/features/clubs/screens/ClubDiscussionThreadScreen.tsx`:
  warm editorial palette and Newsreader/Inter typography; club context, topic
  kicker, serif title, avatar/byline and relative time; topic report menu beside
  the kicker; a prominent reply action with compact score/vote controls; and a
  grouped reply stream with parent attribution. Reply count, unread count and
  mark-read action now sit in the Replies heading; the reply sheet also uses
  the approved response label and preview hierarchy. Existing hooks, services,
  mutations, routes and backend schema were not changed. Added a focused
  structure assertion and retained the existing interaction-contract tests in
  `src/features/clubs/screens/__tests__/ClubDiscussionThreadScreen.test.tsx`.
  Verification: focused thread suite 6/6 PASS; `npx tsc --noEmit` exit 0;
  Expo Web bundled and served the running V2 checkout at localhost:8081. Opened
  the seeded thread in the browser and inspected the page plus the topic menu,
  reaction picker and reply sheet (opened/cancelled; no writes sent). No backend
  mutation, migration, or service change. Nothing staged or committed; nothing
  pushed.

## Rules
- Existing 18 suites must stay green after every phase; new primitives get tests.
- Any phase may be shipped independently; order P1→P5 recommended.
