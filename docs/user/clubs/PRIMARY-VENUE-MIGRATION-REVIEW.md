# Primary venue migration review

## Current routing — 2026-10-10 documentation refresh

The recorded primary-venue migrations `20261007144356` and `20261008091939`
were applied under their earlier explicit authorizations. Their readbacks and
test counts below remain dated evidence; they were not rerun here. Earlier
pre-application approval/next-action wording is historical and must not cause
either artifact to be replayed.

Current layout, navigation disposition, unapproved design drafts and remaining
verification/authorization gaps are owned by the
[current Clubs handoff](./TRACKER.md#current-handoff--2026-10-10-documentation-refresh).
This documentation refresh authorizes no source, permission, data or rollout change.

## 2026-10-08 primary-venue authorization migration applied

The user explicitly approved creation and Supabase MCP application, then renewed
approval after the first MCP call was cancelled. Readback after that cancellation
showed no correction ledger row and the original two policies; no retry was made
until renewed approval. Supabase MCP reverified ACTIVE_HEALTHY
Bookconnect_reactexpo, ahntbtktjjmvfosgkmgn (PostgreSQL 17.6.1.063), before applying.
Both Clubs and sibling Library trackers were checked; no active Library DDL was
recorded. Exact policy/RLS read-only preflight passed and name collision was zero.

Applied once through MCP as `20261008091939 clubs_primary_venue_write_authorization`.
Local file: `supabase/migrations/20261008091939_clubs_primary_venue_write_authorization.sql`.
CLI 2.116.0 generated initial local version 20261008090403; only the filename was
aligned to the returned live version. SHA-256 remains
`73FC0C028256B30710E6A11CD1E5E25376C975C0D4408C4DE1C10B964A3A47BD`.
The earlier applied 20261007144356 migration remains byte-for-byte unchanged
(SHA-256 CEB05DD30F00699933A6BC0BA55F729C529B830C9A675BE4F128186AC859B74C).
Exact artifact fixture: 61/61 PASS on disposable PostgreSQL 17.6; owned process,
port and temp-directory teardown verified. Independent GPT-6 Luna max artifact
review found no actionable issue; it was static and did not rerun the fixture.

Post-apply catalog readback confirms RLS enabled, five expected policies, old
owner ALL policy absent, eligibility/archive checks on primary INSERT and both
UPDATE predicates, owner SELECT/ordinary Add/Remove and member SELECT retained.
RPC/helper definitions and ACLs, table grants, unique indexes and zero noninternal
triggers are unchanged. No duplicate-primary club exists. Before/after link data
count/digest match (1 / 09cafd2e2ad21b6cfd6032490294d615); event ID/location
count/digest match (4 / 510a4c68c9088e55c07aea9bba54d3f4). Ledger is now 169 rows.
No business-data DML, Storage mutation, runtime deployment or Git publication.

Security advisors were run: existing project-wide notices remain; no club_venues
or primary-RPC notice was returned. The existing eligibility helper has the
SECURITY DEFINER execute advisory; its definition/ACL are unchanged and not
remediated here. Advisor output is not a clean whole-project security verdict.
Eligible direct writes remain allowed without RPC advisory-lock coordination;
existing TRUNCATE grants remain a separate audit. Connected primary-selection
submission after this migration is not claimed. Phase 9 Unit 6H/M62 runtime
rollout and connected proof pending state is unchanged; normal db push/history
repair remains frozen.

Active work unit: Clubs aggregate-review closeout/handoff. Exact next action:
review the exact combined local diff and select scoped commit contents before
any user-authorized commit; preserve mixed tracker edits and unrelated screenshot.
Do not reapply this migration. No staging, commit or push occurred.


> **2026-10-08 artifact-status clarification:** Supabase MCP's live migration
> ledger was rechecked and includes `20261007144356 clubs_admin_primary_venue`.
> The applied SQL's first-line “NOT APPLIED” comment is its historical preparation
> checkpoint, superseded by the live-application record below. Preserve the
> applied artifact; that comment is not an instruction to apply it again. Fresh
> read-only policy/grant/function readback confirms the disclosed direct-write
> gap. See [the forward correction proposal](./PRIMARY-VENUE-AUTHORIZATION-PROPOSAL.md).

Prepared: 2026-10-07. Status: the corrected Clubs-only migration was applied to
the verified development project on 2026-10-07. The user authorized local
preparation and correction, then explicitly authorized this one migration's
application. App implementation was outside that migration-application
authorization and was later separately authorized for Manage Club > Venues only;
see [the page review](./PRIMARY-VENUE-APP-REVIEW.md). Shared migration-ledger
repair, permission remediation, and commit/push remain outside the respective
authorizations.

## Migration record

| Field | Evidence |
| --- | --- |
| Local migration | `supabase/migrations/20261007144356_clubs_admin_primary_venue.sql` |
| Live project | Bookconnect_reactexpo, ref `ahntbtktjjmvfosgkmgn`; reverified healthy on 2026-10-07; PostgreSQL 17.6.1.063 |
| Before-apply ledger | 167 entries; latest `20260913162154` / `marketplace_phase9_representative_cover_detail_projection` |
| Applied live version | `20261007144356` / `clubs_admin_primary_venue`; live ledger now has 168 entries; M62 remains `20260913162154` |
| Application state | Applied once through Supabase MCP after exact-project, schema, policy, duplicate-primary, entitlement-helper, grant, and active-DDL preflight. |
| Post-apply state | Unique partial index and `SECURITY INVOKER` RPC with empty search path are present; only `authenticated` can execute the RPC; zero duplicate-primary clubs; current link-policy predicates remain unchanged. |
| Local SQL verification | PostgreSQL 17.6 disposable cluster, 49/49 checks passed (2026-10-07). This fixture is not a full Supabase migration replay or live authorization proof. |
| Independent review | The first reviewer found a NULL-policy-predicate gap; GPT-6 Luna max reasoning found missing historical-policy definition checks and a mixed-era policy-family gap. The migration now rejects all three conditions with regression cases. Luna's earlier final review found no blocker without rerunning tests or accessing live DB. A subsequent independent review found four additional issues; the bounded local correction and new regression evidence are recorded below. |

## Intended database effect

- Enforce at most one `is_primary IS TRUE` venue link per club through a
  partial unique index. A club is not required to have a primary.
- Provide an authenticated-only, `SECURITY INVOKER` RPC for an eligible
  administrator to select an already linked venue. Switches are atomic and
  serialized per club. It rechecks admin eligibility after waiting for the
  advisory lock and again after both potentially blocking flag writes. It rejects
  archived clubs, unlinked venues, missing IDs, and non-admin callers.
- Recreate the two known link policies to the predicates just read from live:
  member-row venue reads and link management when `book_clubs.admin_id = auth.uid()`.
  Migration preflight accepts only the exact current or historical policy pair;
  it rejects missing/mixed families, unknown names, and catalog/predicate drift.
  Exact PostgreSQL 17 deparser comparisons preserve SQL literal case/whitespace;
  deparser or search-path differences fail closed and require re-audit.
  It fails on duplicate-primary rows instead of repairing data silently.
- Existing `club_events.venue_id` values are untouched when the primary changes
  or a link is removed. The primary preference is for future event creation.

## Boundaries and residual concerns

- Authorization concurrency guarantee: under READ COMMITTED, the final check
  rejects ownership, archive, or entitlement changes committed before that
  checkpoint, including changes during target/previous-primary row waits. A
  rejection rolls back the switch. Changes after that checkpoint, revocations
  inside an uncommitted transaction, and older REPEATABLE READ/SERIALIZABLE
  snapshots are not coordinated with eligibility writers. No claim of eligibility
  fencing through transaction commit is made. Direct-write lock conflicts and
  deadlocks remain possible; the advisory lock coordinates participating RPCs only.
- This does not tighten existing direct `club_venues` table permissions or
  change archived-club/entitlement enforcement on those direct writes. The
  verified live RLS write policy is owner/admin-id based and broader than the
  new primary RPC eligibility check. A separate authorization decision is
  required before claiming table-wide manager eligibility is enforced.
- It does not remove the verified `TRUNCATE` grants on `venues`, `club_venues`,
  or `club_events`; no destructive test was attempted. Grant remediation stays
  separate.
- It does not expose public-club associations or public events, add a venue
  relationship view, apply the pending July Clubs/Exchange migration, alter
  Exchange SQL, repair the shared ledger, or write application code.
- The live policy catalog was re-read immediately before application and matched
  the predicates above. A targeted migration was then applied under explicit
  user authorization; this was not a broad `db push`. The deployment authority
  [`MIGRATION-RECONCILIATION-2026-09.md`](../../deployment/MIGRATION-RECONCILIATION-2026-09.md)
  still freezes normal production `db push` and historical replay. The July
  migration remains unapplied; its Exchange changes were not deployed. The
  shared-ledger repair set remains untouched.

## Disposable PostgreSQL verification

Runner: `supabase/tests/clubs/primaryVenueMigration.local.mjs`. It starts a
temporary PostgreSQL 17.6 server under system temp, creates a minimal live-shaped
fixture plus the repository's entitlement helper definitions, executes the new
migration, then stops/removes the fixture cluster. The inspected runtime exposes
its owned ChildProcess; the fixture replaces its unchecked Windows taskkill path
with a checked command and an exit wait, memoized under a 10-second bound. Already
exited processes do not require a new exit event. Deletion requires both owned
process exit and a refused loopback-port connection. Rejection, timeout, or
unconfirmed termination preserves the directory and reports its path. It does
not read `DATABASE_URL` or connect to Supabase. Failure tests inject stop/verification
outcomes; they do not deliberately leave a real PostgreSQL process running.

Checks cover failure-before-change preflights (duplicate rows, unknown or
missing/mixed policy families, current and historical policy-definition drift),
invoker/empty search path/execute grants, an eligible
admin without a membership row, moderator/member/anonymous/service-role and
membership-admin denials, wrong club/missing/unlinked identifiers, ineligible
membership and archived club, unique-index protection against duplicate direct
writes, transactional rollback after an injected mid-switch error, independent
connection concurrency, entitlement change while queued, downgrade/archive during
both target and previous-primary row waits, zero-primary clubs, existing-event
venue preservation when its actual venue is unlinked, literal-case/whitespace
policy drift, injected stop rejection/pending/unconfirmed termination, unsafe
cleanup-target rejection, verified-stop removal ordering, and replacement of the local July RPC/policy
branch without executing its unrelated Exchange statements.

Run from the repo root after installing the pinned embedded runtime in TEMP:

```powershell
$venueRuntime = Join-Path $env:TEMP 'bookconnect-primary-venue-tools-20261007/node_modules/embedded-postgres'
node supabase/tests/clubs/primaryVenueMigration.local.mjs $venueRuntime
```

Result: 49/49 passed against local PostgreSQL 17.6. This covers database logic,
not the full Supabase migration replay, future live policy state, UI workflow,
or connected writes.

Luna's final source review was read-only; it did not rerun this fixture or query
the live database. Its remaining evidence limits are that there is no separate
case for a nonexistent but non-NULL club ID, the local fixture is not a complete
Supabase role/RLS replay, and raw live `pg_get_expr` output is not reproduced in
this record. Reverify the exact live catalog and project before any application.

## Bounded correction closeout (2026-10-07; pre-application checkpoint)

The user authorized correcting four confirmed review findings. Exact catalog
comparison closes the literal-normalization gap. The final authorization check
closes the reproduced row-wait revocation window and is tested for target and
previous-primary waits with both downgrade and archive. The unlink case now
checks the event ID, its removed-link venue ID, and the surviving venue record.
The earlier tracker statement that 38 checks covered failed-stop preservation
was incorrect; shutdown failure injection is newly added, not historical proof.

Verification: disposable PostgreSQL 17.6, 49/49 checks PASS; real teardown reports
owned process exit, closed port, and removed generated directory. Node syntax,
diff hygiene, trailing-whitespace scan, and Phase 9 continuity validation PASS.
An intermediate run failed closed on CRLF inside expected deparser strings; SQL
E-strings now encode LF explicitly, and the complete corrected run passes.
No app tests, TypeScript, web export, design edits, or connected writes ran in
that correction checkpoint. At that point no Supabase/Storage mutation,
migration application, ledger remediation, staging, commit, push, or deployment
had occurred.

Active work unit at that checkpoint: local primary-venue correction complete.
The subsequent live application is recorded below.

## Live application closeout (2026-10-07)

The user explicitly authorized applying the corrected Clubs-only migration to
`Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`). Exact-project readback confirmed
the project was healthy on PostgreSQL 17.6; no duplicate primary rows existed;
the expected live policy pair and predicates matched; the target RPC and index
were absent; and no active DDL was running. The migration was applied once with
Supabase MCP as `20261007144356 clubs_admin_primary_venue`. Because the MCP
endpoint generates the remote timestamp, the still-uncommitted local migration
was renamed to `20261007144356_clubs_admin_primary_venue.sql` to match the live
version. SHA-256: `CEB05DD30F00699933A6BC0BA55F729C529B830C9A675BE4F128186AC859B74C`.

Post-application readback confirms the partial unique index and
`SECURITY INVOKER` RPC with an empty search path. Only `authenticated` has RPC
EXECUTE; `PUBLIC`, `anon`, and `service_role` do not. The two link-policy
predicates are unchanged, duplicate-primary count remains zero, the July
`20260714000001` ledger row is absent, and neither Exchange `city_key` column
exists. No event venue IDs, business rows, Exchange objects, direct table
permissions, Storage, or app code changed. Live ledger is 168 rows and ends at
`20261007144356`; M62 remains recorded as `20260913162154`.

The shared migration-history reconciliation remains deferred. No normal
production `db push`, historical replay, repair set, staging, commit, push, or
deployment occurred. The July Clubs/Exchange migration remains pending. The
Manage Club > Venues UI was later implemented under separate page-specific
authorization; direct-permission remediation and public venue relationships
remain separate work.
