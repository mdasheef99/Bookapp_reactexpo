# Clubs local pre-PR review

## Direct main publication and CI (2026-10-02; current)

The user explicitly authorized adding the missing automated checks and directly
pushing the reviewed Clubs history to remote `main`. This supersedes the earlier
PR-only sequencing and the historical no-push authorization wording below.
Normal fast-forward publication is authorized; force push, protection bypass,
database/Storage mutations, migrations and service deployment are not.

- The pre-publication remote main baseline was
  `7cab645667bd5cdf4756f42cab0248cf8c139ad5`, an ancestor of `6fa062f`, with
  0 remote-only and 9 local-only commits before this CI change.
  The GitHub API confirms push permission and an unprotected main branch. A normal
  push dry run passed without updating the remote. Stale local `main` and the
  unrelated untracked Home screenshot remain preserved.
- Added `.github/workflows/clubs-app-validation.yml`: main/feature pushes,
  pull requests targeting main, and manual runs. No path filters omit shared
  consumers. Ubuntu 24.04 with Node 22 installs the lockfile using `npm ci`, runs
  the full repository Jest suite, TypeScript and production Expo web export.
  Official checkout/setup-node v7 actions are pinned to exact verified tag SHAs;
  checkout does not persist credentials. Token permissions are read-only.
- The workflow uses dummy public Supabase configuration, disables auth bypass,
  local dotenv loading and Sentry upload, and uses offline Expo CLI mode.
  It contains no live database test, migration, provider call or deployment step.
  A successful main push starts validation afterward; the workflow does not
  establish a branch-protection requirement or block a direct main push.
- Independent subagent `review_clubs_ci` found no actionable blocker in the
  workflow or handoff. Linux dependency-test discovery was checked against Jest's
  HasteMap source; dependencies are excluded independently of the existing
  Windows-specific test-path ignore pattern. Review was read-only; the executing
  agent performed verification.
- Fresh local checks with the workflow environment: full Jest 315 suites /
  2,740 tests pass, with 1 suite / 4 tests skipped (316 / 2,744 total), normal
  exit 0 in 324.813 seconds; TypeScript and production web export pass, exit 0.
  Workflow YAML and trigger/permission/revision/command assertions, Phase 9
  continuity validator and whitespace checks pass. Existing warning/advisory
  output remains. Logs: `bookconnect-clubs-ci-local-{jest,tsc,export}.log` in
  the local temporary directory. These local checks use installed Windows
  dependencies; the distinct clean Linux result is recorded below.
- Normal push advanced remote main from `7cab645` to
  `a70dd7c8f21ee405111ae2ca5f5a100a73aa92f4`, publishing all 10 reviewed commits
  without rewriting their history. GitHub's branch API and local remote ref
  matched that exact SHA, with 0 behind / 0 ahead. CI commit `a70dd7c` contains
  only the new workflow and the two Clubs handoff files. No PR, force push,
  protection bypass, database/Storage operation, migration or manual service
  deployment was performed; local main and the screenshot remain preserved.
- [GitHub Actions run 37022023576](https://github.com/mdasheef99/Bookapp_reactexpo/actions/runs/37022023576)
  completed successfully for that exact main SHA. Clean Ubuntu 24.04 / Node
  22.23.3 `npm ci`, full Jest, TypeScript, web export and cleanup steps all pass.
  Downloaded job log confirms 315 suites / 2,740 tests pass, 1 suite / 4 tests
  skipped (316 / 2,744 total), 86.304 seconds, and `Exported: dist`.
  Local log: `bookconnect-clubs-ci-37022023576.log` in the temporary directory.
  This verifies the automated clean install and build; it does not close the
  native, accessibility or connected-role gaps below.
- Active work unit: reviewed Clubs source history published and CI verified.
  This subsequent closeout changes only these two Clubs documentation files.
  Exact next authorized action: independently review, commit and normally
  publish the documentation closeout, verify its remote SHA/CI, then return
  page selection to the user. Refresh remote main before further implementation.

## Required process for every subsequent commit

The user does not review PRs. The following local gate applies to each individual
Clubs commit and to the combined proposed PR. Commit, push, PR, merge, deployment,
and database mutation authorities remain separate.

1. Inspect the worktree, branch, status, parent diff, applicable instructions, and
   current behavior. Preserve unrelated files and sibling-feature work.
2. Map handlers, routes, drafts, validation, loading/error/pending states,
   permissions, service payloads, and affected shared consumers.
3. Obtain an independent subagent review of the proposed change. Resolve findings
   and obtain a follow-up verdict on the corrections.
4. Run relevant existing tests and meaningful regression tests for discovered
   defects. Record failures as well as successful reruns. Check the parent/base
   when attributing a failure; do not weaken production contracts to satisfy
   incomplete fixtures or implementation-detail spy expectations.
5. Run TypeScript and production web export for app changes. Check the running
   browser with the current bundle, navigation, representative controls, desktop
   and narrow widths, error logs, keyboard access, and layout. Record precisely
   which live mutations and platforms were exercised.
6. Check whitespace and the exact staged paths/diff. Update the Clubs tracker and
   this review record, then commit only authorized scope. Preserve the history;
   subsequent fixes may be separate reviewed commits.
7. Before publication, fetch current `origin/main`, integrate any new main-side
   changes locally, resolve conflicts, and review the combined diff for changes
   to shared navigation, marketplace, library, services, or permissions. Repeat
   affected tests and browser checks after integration. Run the full repository
   suite against the actual proposed final tree.
8. Audit residual risks and unverified acceptance criteria. Include device,
   screen-reader/enlarged-text, role/entitlement, connected failure/rollback,
   and non-Clubs smoke coverage when affected. Do not promise universal behavior
   from a desktop browser or mocked tests. Check CI after authorized publication;
   do not treat local validation as evidence of a remote CI result.
9. Refresh `origin/main` once more immediately before an authorized push/PR/merge if
   the baseline changed or the review became stale. Keep deployment/rollout and
   rollback gates explicit. Never assume that a successful commit deploys code.

## Review checkpoint: 2026-10-02

Worktree: `Bookconnect4_clubs_v2`; branch: `feat/clubs-v2`.
Refreshed `origin/main`: `7cab645667bd5cdf4756f42cab0248cf8c139ad5`.
It is an ancestor of the feature branch, including the final remote refresh.
At this checkpoint there are no main-side
commits to integrate and no divergence/conflicts. Local `main` is stale and was
not used as the integration baseline: `15243d8` is 53 commits behind and has one
separate library-documentation commit. It is preserved. A duplicate commit on
local `main` is unnecessary; the eventual authorized PR targets remote main.
No push or PR is authorized by this record.

Marketplace Phase 9 remains `M62_RUNTIME_ROLLOUT_AND_CONNECTED_PROOF_PENDING`.
The Clubs review changes no marketplace phase, rollout authority, migration,
schema, Storage, or permission policy.

### Individual commit audit

Independent reviewers: `review_directory_commits`, `review_discussion_commits`,
and `review_events_palette_commits`. Their reviews and correction reviews are
source reviews; the executing agent supplies test/browser evidence below.
Historical checks use tracked source archives at the stated revisions and the
installed dependencies; they are not clean dependency-install proofs.

| Commit | Scope | Independent review and historical focused tests |
| --- | --- | --- |
| `697c7ae` | Discover experience / shared navigation | Font rejection could leave Clubs blank. Correction reviewed. Exact revision: 2 suites / 15 tests pass (directory and tabs). |
| `1a30a59` | Your Clubs / Authors / Venues navigation | New icon-only Back controls lacked readable names and had 40 px targets. Correction reviewed. Exact revision: 4 suites / 34 tests pass. |
| `4d183d5` | Directory / Club Home | Member leave/transfer feedback was hidden by the nonmember-only rendering gate. Correction reviewed. Exact revision: 3 suites / 71 tests pass. |
| `893ad1a` | Discussion listing | No introduced blocker found. Exact revision: listing suite / 7 tests pass. |
| `6fe1f8c` | Thread interactions / vote optimism | Metadata contrast and three stale mutation tests need correction. Exact revision: 2 suites pass, 1 fails; 47 tests pass / 3 fail. Main baseline mutation suite passes 26/26. Corrected fixtures and semantic invalidation assertions pass 29/29 with the optimism suite; production hooks unchanged. Correction review passes. |
| `1337cd8` | Events listing | No introduced functional blocker found. Exact revision: 7/7 pass on rerun; first run exceeded the existing 5-second test timeout during concurrent checks. |
| `1b40459` | Create/Edit event styling | Placeholder contrast needs correction. Existing picker focus exception and omitted-capacity clearing were also found in the parent code. Bounded corrections reviewed without changing permissions/schema. Exact revision: 9/9 pass on rerun; first run exceeded the existing 5-second test timeout during concurrent checks. |
| `ea54406` | Manage palette | Independent review found no introduced functional blocker. Fresh Manage/Settings suites pass 2 suites / 47 tests. Exact staged scope inspected before commit. |
| Correction commit containing this record | Review findings / regressions / handoff | All three reviewers cleared their correction scopes. Full integrated verification below passes. Original historical commits were not rewritten; the three historical vote-test failures are corrected in this subsequent commit. |

### Corrections and regression evidence

- Font loading now displays an accessible pending indicator and renders Clubs
  after either success or rejection. The platform supplies the fallback when a
  requested custom font is unavailable; actual native fallback remains unverified.
- Authors/Venues Back controls keep their handlers and expose a button name and
  44 by 44 px target. Tests activate them by role and readable name.
- Club Home renders membership action feedback once outside the nonmember gate.
  Regression checks cover active successor acceptance/failure and active/muted
  leave failure without navigation.
- Thread metadata now uses darker neutral text. Editor placeholder text uses
  `#746860`. Review-calculated contrast: 5.34:1 thread metadata on ivory and
  5.01:1 editor placeholders on ivory.
- Web date/time focus tolerates the browser's `NotAllowedError` when user
  activation is absent. Missing APIs retain normal input behavior; unexpected
  failures still propagate. Tests cover those boundaries and the method receiver.
- Event updates omit `max_attendees` when optional capacity is omitted/undefined,
  avoiding an unintended overwrite. Explicit null clears it; a number updates it;
  creation retains its previous null default. Other payload fields, filters,
  validation and permission gates are unchanged. The live project
  `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`) was verified by Supabase MCP;
  nullable integer column, UPDATE policies, and authorization helper definitions
  were read-only inspected. A read-only aggregate found 3 admin memberships and
  0 whose user differs from `book_clubs.admin_id` at this checkpoint. No database,
  Storage, migration or live event write was performed in this review.
- Before correction, the newly strengthened regressions reproduced 10 failures
  across the five affected suites (98 passing). Follow-up source review cleared
  the scoped corrections. The first combined correction run exposed two more
  redundant vote invalidation spy assertions, which were then removed in favor
  of actual per-viewer invalidation/isolation checks. That run also had one
  unrelated Venues test exceed the default timeout during concurrent checks.
  Venues then passed its unchanged four tests on a focused rerun; no timeout
  increase or assertion relaxation was applied.

### Final integrated verification

- Full repository Jest: 315 suites and 2,740 tests pass; 1 suite and 4 tests skipped
  (316 suites / 2,744 tests total), normal exit code 0. This is a fresh final
  production-code run, not the earlier failing Manage re-verification. Existing
  dependency/React warnings remain; no failure was hidden or forced past.
- TypeScript `tsc --noEmit --incremental false`: pass, exit 0.
- Expo production web export `--platform web --max-workers 1` with offline CLI
  environment: pass, exit 0. No deployment was performed.
- Current app bundle at localhost:8081: directory/My Clubs and Authors/Venues
  navigation, both named Back controls measured 44 by 44 px, Authors keyboard
  Enter, Home leave confirmation/Cancel, discussion listing/Back routes, thread
  inline blank guard, draft/quote insertion and target switching, anchored topic
  reaction popup and Escape dismissal, Events routes, Create blank-title
  validation, Edit prefill, date/time draft retention across all format choices,
  and Back without saving were checked. The automation's generic date/time
  `fill()` did not retain values; accessibility setters retained date/time
  through format switching. No manual event/RSVP/vote/reaction/reply/leave/save
  mutation was submitted. The picker-focus error did not recur in the error log.
- All 10 available Manage tabs rendered their corresponding content on switching
  without saves. Narrow thread/Create/Manage and desktop Edit had no observed
  horizontal page overflow at measured 390 by 844 and 1280 by 720 viewports.
  Existing Manage metadata contains a replacement-character separator, unchanged
  from the palette parent; this is a pre-existing cosmetic cleanup opportunity.
- Marketplace home, empty cart, empty request list and browser Back/tab return
  rendered with the expected five primary tabs; no commerce action was submitted.
  No browser error log entries were observed during this checked session.
- Local app reload initially stalled; the known Clubs server was identity-checked
  and restarted on 8081 with one worker. The current bundle then rendered. Source
  archive copies used for historical tests were removed after checks; logs and
  archives remain ignored under `.wt/prepr-review`. Temporary drafts and viewport
  overrides were discarded/reset before the user closed the app tab.
- Evidence screenshots: `prepr-thread-390x844.jpg`,
  `prepr-event-create-390x844.jpg`, `prepr-event-edit-desktop.jpg`, and
  `prepr-manage-390x844.jpg` under
  `C:/Users/LEGION/.codex/visualizations/2026/09/30/01a0f41a-79cd-73b0-a323-1079b03f96ad/`.
- Test/export logs: `bookconnect-prepr-full-jest.log`,
  `bookconnect-prepr-tsc.log`, and `bookconnect-prepr-export.log` in the local
  temporary directory. Historical focused logs are under `.wt/prepr-review`.
- Phase 9 continuity validator and whitespace/staged-scope checks pass; existing
  document-size and LF/CRLF advisories remain. The staged set contains only the
  17 reviewed correction/test/Clubs-documentation files. No marketplace
  status/rollout gate changed.

### Remaining evidence gaps and scope limits

- No native Android/iOS device, screen reader, or enlarged-text verification was
  completed by these source reviewers. Browser mobile width does not establish
  native keyboard, status-bar or accessibility behavior.
- Conditional Applications/Invitations tabs and a full live role/entitlement
  matrix are not proven by the seeded public-club admin session. Existing mocked
  tests cover gates; connected RLS denial/rollback needs representative accounts.
- Existing event helper behavior accepts a membership `admin` role while live
  privileged-admin authorization is anchored to `book_clubs.admin_id`. This was
  present before the redesign. No permission policy was changed; role-drift
  behavior remains a separately documented backend/authorization investigation.
  The read-only aggregate found no current admin-id drift; that does not prove
  every connected role/tier denial and rollback case.
- Comment deletion remains deferred pending authorization/policy investigation.
  The old handoff's reply-collapse/expand claim is not supported by the reviewed
  parent/current thread source; this review neither adds nor claims that behavior.
- Marketplace runtime rollout, Storage and connected-proof gates remain owned by
  Phase 9. This frontend review does not discharge those gates.
- CI, deployment, rollback execution and future main compatibility cannot be
  verified before their respective authorized actions. Refresh and revalidate
  before opening/merging the eventual PR.
