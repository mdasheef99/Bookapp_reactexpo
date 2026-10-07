# Manage Club > Venues design and app review

## 2026-10-08 closeout

The user authorized primary venue management refinements and confirmation
before removing a linked venue. The UI retains the existing administrator
permission gate, hooks, RPCs, and unlink mutation. Cancel makes no request;
confirmation invokes the existing unlink flow. Removing a primary venue warns
that the club will have no primary until another is selected.

The dialog clears on club/account changes or target disappearance. The page
moves focus to a named, programmatically focusable region after identity changes.
If a confirmed or externally removed venue disappears, focus moves to Add only
when the user has not moved it to another surviving control. Independent review
used gpt-6-luna at max reasoning and found no blocker; its focus observations
were addressed.

Verification on the final code: Manage tests 75/75 and four focused suites
148/148 passed. TypeScript, web export, phase-9 continuity validation, and
git diff checks passed. A combined run once timed out one test while TypeScript
ran concurrently; isolated reruns passed. The browser confirmed desktop and
mobile dialog behavior, Cancel/Escape focus, keyboard containment, and mobile
sizing. No connected unlink confirmation or primary-selection mutation was
submitted. Identity and disappearing-target focus paths were checked with
automated tests. No schema, permissions, migration, or backend behavior changed
in this UI follow-up. No push or deployment occurred. Spoken screen-reader
verification was explicitly excluded by the user.

Reviewed: 2026-10-07. Scope: independent review of the three existing Stitch
states and page-local Manage Club > Venues implementation. The user authorized
self-critique and local implementation for this page. This review does not
extend to another page, app-wide venue relationships, database permissions, or
live writes.

### Final verification for this follow-up

- Four focused suites: 143/143 PASS before the final disappearance test;
  final Manage suite: 71/71 PASS including that test. TypeScript PASS.
- Independent Luna max rereview confirms target-disappearance fallback ordering.
  It identified a residual focus handoff gap if club/account changes in place
  while the dialog is open: the keyed remount closes it safely, but the old
  opener is removed. This does not permit an unconfirmed mutation. No actual
  assistive-technology or context-switch browser proof was obtained.
- Cancel/confirm and race cases use mocked services with real QueryClient where
  stated. They do not prove connected primary-selection success or failure.
- Final-source web export PASS; continuity validator PASS; git diff --check PASS.
  Existing dependency and document-size advisories remain. Local venue changes
  have now been committed; no push, deployment, migration or new live write occurred.


## Source behavior mapped

- `ClubManageScreen.tsx` exposes Venues only to administrators. Primary selection
  is guarded by `isAdmin` in the screen handler and uses the existing
  `useSetPrimaryClubVenue` hook and `clubsService.setPrimaryClubVenue`, which
  calls `set_primary_club_venue`.
- The existing RPC provides server-side eligibility and linked-venue checks.
  The current hook invalidates the club venue query after mutation.
- `getClubEventVenues` sorts primary first. A new event editor with no explicit
  venue selection uses the first linked venue; editing an existing event loads
  its saved `venue_id`. This page change does not modify event records or editor
  behavior.
- Add and Remove remain on their existing paths. Existing direct
  `club_venues` table permissions remain broader than the new RPC's eligible
  administrator checks. This page change does not remediate or represent those
  direct permissions as tightened.

## Independent Stitch review

The existing canvas contains Normal, Saving, and Error proposals. I inspected
the actual artboards against the current control and permission map. The normal
state includes Add, both Remove actions, one Primary badge, and Set as primary.
The saving state retains the prior primary and both Remove actions while
showing Saving on the chosen venue. The error state retains the old primary and
offers inline feedback and retry. The copy distinguishes the new-event default
from existing events' saved locations. No blocking visual issue was found; no
artboard or user draft was changed. Earlier frame inspection covered normal and
saving at 390×844 and checked error content in the accessibility tree.

## Implementation and correction

`ClubManageVenuesSection.tsx` now renders the mapped helper copy, primary badge,
selection action, Saving feedback, inline failure with Try again, and the
existing Add/Remove controls. Buttons have accessible names and touch areas of
at least 44 px. The screen uses the existing RPC hook and local page state; it
does not introduce a direct flag update.

An independent read-only code review found that success cleared Saving as soon
as the RPC resolved, although the venue query invalidation was still in flight.
That could leave the previous badge visible and re-enable selection before the
new primary was confirmed. The screen now awaits a fresh linked-venue read and
clears pending state only when that read confirms the selected venue as primary.
An RPC failure refetches and names the prior primary where possible. If the RPC
succeeds but refresh is stale, errors, or rejects, the screen retains the old
visible state and an explicit retry message instead of claiming confirmation.

The tests cover the deferred success/refetch sequence, verify the old badge
remains while Saving is shown, and verify the badge moves only after refreshed
data confirms it. Separate cases cover RPC failure with prior-primary recovery,
successful RPC with an unconfirmed list, and successful RPC with a rejected list
refresh.

## Verification and limits

- `ClubManageScreen.test.tsx`: 46/46 pass.
- `npx.cmd tsc --noEmit --incremental false`: pass after web export completed.
  An earlier overlapping invocation saw a transient missing file while `dist/`
  was being generated; the serialized rerun passed.
- `npx.cmd expo export --platform web --max-workers 1`: pass. Expo emitted
  existing Browserslist, Tailwind at-rule and Babel deprecation warnings.
- Phase 9 continuity validator: pass; 86 Markdown files checked, 62 required
  phase files present, no traceability gaps. Existing document-size advisories
  remain.
- `git diff --check`: pass after final documentation edits.
- Independent read-only review found the pending-state defect and verified the
  confirmation fix. It requested refresh-failure coverage; the final review
  confirmed that both the stale-list and rejected-refetch regressions cover the
  success-without-confirmation recovery paths. No new issue was found; the
  reviewer did not rerun tests.
- The temporary local browser preview reached the seeded
  `ZZ_TEST Manage Basics Club` under a member identity. The admin-only Manage
  screen was therefore not opened. The actual page has not had desktop or
  390×844 browser interaction testing. No live venue/event mutation was made.

The primary-venue migration was already applied in a prior authorized step as
`20261007144356 clubs_admin_primary_venue`; it was not applied or modified during
this UI work. No live database/Storage mutation, event change, permission
change, stage, commit, push, or deployment occurred here. The shared migration
history hold and pending July Clubs/Exchange migration remain separate from
this page review.

## Handoff

The initial review above is historical evidence, superseded by the bounded
correction record below. The exact next action is user visual review of the
corrected local Manage Venues result. Runtime
desktop/390×844 review needs an authorized admin-capable test identity. Any
permission remediation, another page, live data change, or Git publication
requires its own explicit request.

## Bounded UI correction (2026-10-07)

The user authorized local correction of three findings from the subsequent
independent review. That review disproved the initial unconditional claims that
Saving and inline recovery always remained visible and that selection state
was safe across club changes. The correction is limited to the Manage screen,
venue section, regression tests, and continuity records.

- Saving remains visible even when automatic invalidation or another cache
  update marks the target primary before the explicit confirmation read ends.
  The pending control exposes busy state and a polite live-region label.
- When the target row disappears or its venue details are null, section-level
  Saving/recovery remains visible. Missing-target recovery offers reselection
  or Add; it does not offer a write retry against the absent target. Existing
  Add/Remove paths stay available. A successful read must contain the matching
  club, venue ID, primary flag, and renderable venue before confirmation clears.
- Club/account changes remount the page's local state and query observers.
  Mounted guards prevent an old RPC response from starting a confirmation read
  or replacing new-context feedback, including responses after navigation away.
  This does not cancel or undo a write already submitted to the server.

Seven new regression cases failed against the original implementation before
the correction. Further cases cover empty/unreadable targets, wrong-club data,
resolved `isError` with cached primary data, and the actual venue hooks with a
real QueryClient. That integration case exercises mutation-driven invalidation,
explicit confirmation, early primary-badge cache updates, and repeated presses;
only service I/O is mocked. Context-switch cases use mocked hooks.

An independent read-only subagent inspected the corrected screen, section,
hooks, and tests and found no blocking issue. It did not rerun tests or verify
rendered desktop/mobile behavior. Final command results are recorded in the
verification closeout below; earlier 46/46 evidence remains historical.

No event-editor, service/hook, entitlement, SQL, migration, permission, Stitch
artboard, or live data change is included. Detached saved-event recovery stays
deferred: editor code can still switch to manual mode when links are empty and
send a null venue on a later save. The page's helper copy describes the effect
of primary selection, not a guarantee about that separate editor path.

Active work unit: bounded Manage Venues correction, locally complete. Next
authorized action: user visual review of the corrected admin page at desktop and
390×844 with an authorized admin-capable identity. No connected mutation or
Git publication is authorized by this correction.

### Correction verification closeout

- Focused Manage screen: 58/58 PASS (12 additional cases). Combined Manage,
  Event Editor, Venue Picker, and clubsService Jest: 4 suites / 131 tests PASS,
  normal exit. Existing Node `DEP0040` warning remains.
- Final-source `npx.cmd expo export --platform web --max-workers 1`: PASS.
  Output is the ignored local `dist` artifact; nothing was deployed.
- `npx.cmd tsc --noEmit --incremental false`: PASS, started only after final
  export finished. No overlapping export/TypeScript invocation.
- Phase 9 continuity validator: PASS; 86 Markdown files, 62 required phase
  files, zero missing traceability. Existing size advisories remain.
- `git diff --check`: PASS. Git emits the existing LF-to-CRLF notice for the
  Manage screen; no whitespace error is reported.
- No corrected-page desktop/390×844, assistive-technology, live catalog,
  connected primary-selection write, or database-fixture check was performed.
  Source/test review and local export are not substitutes for runtime proof.

Closeout Git state: `feat/clubs-v2`, HEAD
`382e50e4498400d7a99d6ed00268001b2ece1ee7`. This correction changed only
`ClubManageScreen.tsx`, `manage/ClubManageVenuesSection.tsx`, the Manage-screen
test file, this review, Clubs tracker/completion plan, and the Phase 9 tracker,
implementation verification tracker, and DOC-13 continuity notes. Existing
unrelated changes and untracked artifacts remain preserved. All changes remain
uncommitted and unstaged; no commit, push, deployment, Supabase/Storage access,
database mutation, migration action, or permission change occurred.

## Runtime follow-up (2026-10-08)

The local web page was reopened at the Manage route for `ZZ_TEST Manage Basics
Club` and checked at 1280×720 and 390×844. The Venues section rendered without
visible overlap. At 390×844 the management tabs wrap over three rows, the venue
name wraps, all venue actions remain visible, and measured document/body widths
stay at 390 px. Add opened the existing venue-linking route; browser Back
returned to Manage and no venue was submitted. The rendered section showed
both test venues before the Remove action. The temporary viewport override was
reset and the page returned to 1280×720.

During the check, Remove was unintentionally activated for `ZZ_TEST Chapter
House Cafe`. The existing handler immediately calls the unlink mutation, without
a confirmation step. The UI showed “Venue unlinked”; the page was reopened and
the Cafe remained absent. The user confirmed this was a test club and accepted
leaving it unlinked. A read-only query against verified project
`Bookconnect_reactexpo` independently showed only `ZZ_TEST Central Reading
Library` linked, with `is_primary = false`. No SQL write, restoration, primary
selection, venue Add, event mutation, permission change, or migration occurred.

This provides connected evidence for the Remove path only. The current browser
check does not verify primary-selection success/failure, account or club
switching, or assistive technology. The previous automated test, TypeScript,
export, and independent-review results remain historical and were not rerun.
The next action is to close the reviewer-listed real-QueryClient race-coverage
gaps: club/account switching across delayed success/failure/confirmation,
Remove invalidation during confirmation, and failed refresh after unmount. No
further connected writes are part of that test-only step. Whether immediate
Remove needs confirmation remains a separate product decision. All code and
documentation remain uncommitted and unstaged; nothing was pushed or deployed.
