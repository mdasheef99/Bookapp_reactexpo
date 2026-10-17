# Clubs main integration review — 2026-10-17

## Authority and exact candidate

The user authorized reviewing here and pushing the existing Clubs commits to
main, then explicitly approved including the existing navigation fixes/tests
and resolving the documentation conflicts. Application redesign, new
operational fixes, live data, migrations, permission changes and deployments
are outside this publication.

- Fresh main base: `76348f3076a641d1a2dd6d5cdd6ab439b46da8da`.
- Clubs parent: `07998254726f3d31a6dfb561657744562818fc88`.
- Preserved commits: `382e50e`, `7e561a1`, `4e1aa35`, `542b90f`, `0799825`.
  The first was already on the feature remote but absent from main.
- Integration branch: `codex/clubs-main-reviewed-20261017`.
- Integration checkout:
  `C:\Users\LEGION\.codex\worktrees\clubs-main-reviewed\Bookconnect4_clubs_v2`.
- Original checkout: `C:\Users\LEGION\Desktop\Bookconnect4_clubs_v2`,
  `feat/clubs-v2`, HEAD `0799825`; 52 tracked modifications and four untracked
  files remain there. Nothing in that original index is staged by this work.

Fresh main has 26 commits not in the Clubs branch. Its latest Phase 9 record is
Unit 6G / Open Library published, CI passed and Render held. The former M62
handoff is retained as dated evidence; it is not the current global gate.

## Included and excluded work

Included: the five existing commits, all 35 existing navigation source/test
files, their shared helper and regression, corrected Clubs documentation and
the 119-control preservation matrix. The primary-venue confirmation, pending/
lost-response reconciliation and actor/club isolation remain the existing
approved implementation. Navigation keeps directory origin separate from
editor/picker return destinations, preserves drafts and allows only known
origin values.

The four conflicting shared documents retain all newer main content:
DOC-13, the Phase 9 master tracker, current-vs-target audit and implementation
verification log. Older Clubs receipts are added as explicitly historical
evidence; the main Phase 9 status row wins over the stale Clubs M62 row.
Before integration notes, their diff from main contains additions only.

The original Home screenshot and uncommitted unrelated RLS-inventory advisory
are excluded. No dependency, lockfile, marketplace/Library runtime, workflow or
deployment configuration is changed. The existing SQL is historical import,
not a migration application.

## Fresh verification

The initial full run found a missing useLocalSearchParams export in the Authors
route test mock and a 5-second timeout in the first Manage pending/confirmation
test. The mock was corrected. The unchanged Manage test timed out once alone,
completed in a temporary diagnostic run, then passed uninstrumented with Authors
(2 suites / 88 tests). No timeout or assertion was weakened. The next full run
passed 341 suites / 3,448 tests, with one suite / four tests skipped. That run
precedes the two independent-review corrections below; final results follow.

The existing disposable PostgreSQL fixture passed 49/49 checks, followed by
CLEANUP_PASS: owned process exited, loopback port closed and temporary directory
removed. Two preliminary attempts failed to load incomplete old tooling before
database startup. Pinned tooling was installed in an ignored helper folder;
application dependencies/lockfile were unchanged. This is not a full Supabase
migration replay or live-role proof.

TypeScript, production web export and continuity validation passed before the
review corrections; corrected source receives fresh checks before publication.
Continuity validation checked 96 Markdown files; size advisories are
informational. No fresh browser/native checks were run for this integration.
Historical observations retain their dates and do not certify today's chain.

The read-only Supabase MCP project/catalog check on October 17 confirms both
Clubs migration ledger rows and the five expected venue policies. It does not
demonstrate live primary selection or any destructive action. Source SHA-256:
`CEB05DD30F00699933A6BC0BA55F729C529B830C9A675BE4F128186AC859B74C`
and
`73FC0C028256B30710E6A11CD1E5E25376C975C0D4408C4DE1C10B964A3A47BD`.

## Independent review

GPT-6 Luna/max reviewed immutable tree
`4d93a7d95da57cf67078e4c719124bdd31037049` against main. Historical Home-child
and Settings-child fixes were confirmed. Two further P2s were found: Reading
Progress omitted Archived from its fallback; the Invitations Settings detour
dropped the original directory origin. New Reading/Inbox regressions reproduced
both findings (three failures).

The bounded correction reuses clubHomeHref for Reading Progress and
withClubOrigin through Inbox, Settings, notification children and return routes.
Regressions cover Archived Reading fallback and My Clubs/Archived at each detour
boundary. Ordinary Profile Settings paths remain covered. Permissions and
operational behavior are unchanged.

The same independent GPT-6 Luna/max reviewer rereviewed corrected immutable tree
`f1a6142e714f003b3ad99d5e845212bdaa61b402`: both P2s resolved; no remaining
actionable correction finding; conditionally ready pending fresh checks. The
reviewer ran no tests or live operations. Aggregate review also covered venue
confirmation/recovery/isolation, SQL/fixture safety and documentation
reconciliation, with no additional blocker. Documentation-only closeout follows
the reviewed source/test tree.

## Remaining boundaries

- Existing Web Alert confirmations, URL/visible-selection mismatches and
  failure/recovery observations remain separate findings; no correction is
  silently included.
- Conditional roles, shared primary-selection writes, destructive outcomes,
  account-transition connected proof and native checks retain the matrix's
  recorded gaps.
- Manage's application layout is retained. The limited mobile Current Book
  proposal still has no complete fresh Astra critique or implementation
  approval.
- Existing grants/security advisories and the shared migration replay freeze
  are unchanged. No full clean migration replay or project security clearance
  is claimed.
- CI on main runs repository tests, TypeScript and production web export.
  The workflow has no migration or runtime deployment step.

## Final local verification and publication gate

Corrected candidate, October 17:

- Full repository Jest: 341 passed suites, one skipped; 3,457 passed tests,
  four skipped (342 suites / 3,461 tests total), exit 0, 341.085 seconds.
- TypeScript: `tsc --noEmit --incremental false`, exit 0.
- Production web export: installed Expo CLI, platform web, one worker, exit 0.
  The npm forwarding attempt treated the worker value as a project root and a
  guessed CLI path was absent; both failed before building. The verified
  `node_modules/expo/bin/cli` entry point completed the final build.
- Disposable PostgreSQL: 49/49, verified teardown, no shared database writes.
- Independent GPT-6 Luna/max aggregate review and bounded rereview: clear after
  the two P2 corrections; external runtime gaps remain as listed above.
- Original checkout preservation: all 56 dirty-file hashes and porcelain
  entries match the saved baseline; original index remains unstaged.
- Existing migration Git blobs equal their feature-parent blobs; main's other
  migration files have no diff. Working-file newline conversion is distinguished
  from Git blob identity. No migration was created or applied by this task.

Only documentation receipts differ from the reviewed corrected source/test
snapshot. Final continuity validation and diff hygiene must pass after staging
these receipts, then the user-authorized merge commit can be published normally
to refs/heads/main after a fresh remote check. Never force-push. No PR is needed.
Publication readback and CI status will be appended as a documentation receipt;
local gates do not imply remote CI success. No push had occurred at this gate.
