# Aggregate Clubs publication review — 2026-10-08

## Reviewed snapshot and verdict

Subsequent local checkpoint: user authorized commits after receiving this verdict.
Navigation changes are checkpointed in 4e1aa35; primary corrections and the
already-applied migration/evidence in 542b90f. Review/process/continuity documents
are checkpointed separately. Findings and publication block remain open; no push.
This preserves reviewed work and does not clear the combined set.

Independent reviewer: GPT-6 Luna, max reasoning, publication_whole_luna.
Workspace: C:\Users\LEGION\Desktop\Bookconnect4_clubs_v2 / feat/clubs-v2.
HEAD: 7e561a15bca7ba0d64d0ea1b362393429b9e7a7f.
Fresh `git fetch origin main` succeeded; origin/main is
2f2f383b14b5818b62682ae5bdd7fa295550ba5b. Main is an ancestor; zero behind,
two commits ahead (382e50e and 7e561a1). Review includes that entire range plus
all tracked working-tree changes and new migration/process/proposal/handoff
files. The unrelated untracked Home screenshot is excluded and preserved.

Verdict: DO NOT PUBLISH AS-IS. Two P2 return-context integration defects remain.
No confirmed introduced migration/RPC authorization blocker was found by static
review. This is a candidate-publication review, not whole-app certification.
The reviewer made no edits, ran no tests and performed no live SQL or mutation.

## Confirmed findings

1. **P2: Club Home child screens discard the originating directory context.**
   Browser-reproduced My Clubs → Home → Manage → Back → Home Back ends at All
   Clubs. Home Manage push omits returnTo; Manage back returns the plain Home
   route. Home Discussion, Events, Applications and Invite also omit the context
   in source; their back fallbacks omit it. Those sibling paths were not each
   browser-tested in this review. Carry an allowlisted origin through children
   and their onward/back routes, preserving existing immediate destinations.
2. **P2: Settings children discard the Invitations origin.** Inbox opens Settings
   with returnTo=club-invitations, but Settings notification/preference pushes
   drop it. Preferences returns plain Settings; Notifications returns Profile.
   Direct Inbox → Settings → Back passed in-browser. Child-path loss is source-
   confirmed and requires live regression verification after correction.
3. **P3: Stale remote freshness in handoff.** Corrected locally to the freshly
   fetched base above. Do not reuse this snapshot as indefinitely fresh remote
   evidence; fetch again immediately before publication.

Relevant source: ClubDetailScreen.tsx (Home child pushes), ClubManageScreen.tsx
(header fallback), ClubDiscussionScreen.tsx, ClubEventsScreen.tsx,
ClubApplicationsScreen.tsx, ClubInviteScreen.tsx, profile/settings.tsx,
profile/notification-settings.tsx and profile/notifications.tsx.

## Checks actually run by primary

- Clubs feature + Clubs routes + Settings: 31 suites / 506 tests PASS.
- Profile routes + navigation helper: 9 suites / 29 tests PASS. Settings overlaps
  the first set; do not sum these as distinct totals.
- TypeScript --noEmit --incremental false PASS; one-worker web export PASS.
- Exact applied migration fixture: PostgreSQL 17.6, 61/61 PASS, verified process/
  port/tempdir teardown. This is not a complete Supabase migration replay.
- Diff hygiene PASS; Phase 9 continuity validation PASS at closeout (86 Markdown files checked).
- Browser: My Clubs direct Home/back preserves scope; Reading from Books preserves
  Books + My Clubs context; Manage nested context loss reproduced. Post-migration
  Venues read loads; desktop Cancel restores focus to Remove; mobile 390x844
  dialog/Escape/focus and horizontal bounds pass. No removal confirmation or
  primary submission. Direct Invitations/Settings/back passed. Temporary viewport
  restored. No business-data/Storage write, migration reapplication or deployment.
- These passing checks do not cover the missing chained routes and do not override
  the publication-blocking findings. No full repository suite or connected primary
  mutation proof is claimed. Existing Node/line-ending/document-size advisories.

## Next action and authority

Active work unit: aggregate navigation-context corrections before publication.
Exact next action: resolve both P2 context propagation findings, map downstream
returns for each affected child, add chain regressions, browser-check desktop and
mobile, rerun affected tests/TypeScript/export/docs, then obtain independent Luna
max rereview of the corrected combined set. No new page redesign is authorized.
No staging/commit/push in this review. Recheck staged contents and fresh main before
any separately user-authorized publication. Applied migration
20261008091939_clubs_primary_venue_write_authorization must not be reapplied.
Phase 9 Unit 6H/M62 rollout/proof pending status and history-repair freeze unchanged.
