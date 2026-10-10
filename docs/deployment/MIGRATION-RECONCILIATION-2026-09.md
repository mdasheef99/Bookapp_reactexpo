# BookConnect Migration Reconciliation — September 2026

## Status

**STATUS: DEFERRED — KNOWN MIGRATION-HISTORY DRIFT**

**NORMAL PRODUCTION MIGRATION DEPLOYMENT: FROZEN**

**MIGRATION REPAIR EXECUTED: NO**

**REASON FOR DEFERRAL:** active parallel feature work — including the
multitenant-store workstream — is using the repository and the shared Supabase
project. The live migration ledger is shared state; performing 139
migration-history repair writes now would change the remote migration history
seen by all active branches linked to the same project. Since the
application/database schema is not currently broken by the timestamp aliases
themselves, the verified evidence is preserved, normal production migration
deployment is frozen, and the ledger will be reconciled later at a stable
cross-branch checkpoint.

This is an intentional engineering decision, not an unresolved investigation.

### Canonical current state

- AUDIT COMPLETE (2026-09-13)
- RECONCILIATION DEFERRED
- 139-VERSION REPAIR SET REVIEWED BUT NOT EXECUTED
- SHARED PROJECT / PARALLEL WORK MAKES NOW A POOR TIME TO NORMALIZE LEDGER
- NORMAL PRODUCTION DB PUSH FROZEN
- CLUBS GIT/PR WORK MAY PROCEED

### Read This First (future agent)

- The investigation is complete enough to understand the issue. Do NOT restart
  the forensic audit from zero unless new evidence demands it; start from the
  Resume Criteria + delta audit instead.
- The repair itself is deliberately postponed. Nobody should execute it now.
- Do NOT blindly run `supabase db push`.
- Do NOT blindly execute the proposed repair set. Before any future execution,
  first check what changed in local migrations and the live ledger after
  2026-09-13.
- The reviewed repair-as-applied set is **139 versions** (see below).
  **REVIEWED BUT NOT EXECUTED.** The earlier 140 figure is superseded.
- `20260527104248_transfer_club_admin_rpc.sql` is **EXCLUDED** from the repair
  set (obsolete/superseded; deferred disposition).
- `20260714000001_harden_club_primary_and_exchange_city.sql` is **genuinely
  unapplied** and must NOT be marked applied.
- Nothing below modifies migration files; the freeze blocks DB deployment, not
  Git work.

## Decision Record — 2026-09-13

The project owner made the following decision:

> Migration-history reconciliation is deliberately DEFERRED.

Reason: BookConnect currently has active parallel feature development in other
workstreams, including the multitenant-store feature. The live Supabase
migration ledger is shared state. Performing 139 migration-history repair
writes now would change the remote migration history seen by all active
branches linked to the same project.

Since the application/database schema is not currently broken by the timestamp
aliases themselves, we prefer to preserve the verified evidence, freeze normal
production migration deployment, and reconcile the ledger later at a stable
cross-branch checkpoint.

This is an intentional engineering decision, not an unresolved investigation.

## Why This Exists

Three views of migration history disagree:

1. **Repository migration files** (`supabase/migrations/`, 174 `.sql` files).
   The chain contains placeholder/tidy timestamps (e.g. `20260619000001`,
   `20260716000001..39`) plus five historical-reconstruction files
   (`20260213000000`, `20260213000001`, `20260522225430`, `20260529160000`,
   `20260822220000`) that were added so a *fresh* database replays cleanly.
2. **Live schema** (project `ahntbtktjjmvfosgkmgn`). Most effects exist live,
   including several applied manually / via MCP without a ledger row, and one
   genuinely absent forward migration (`20260714000001`).
3. **Live ledger** (`supabase_migrations.schema_migrations`, 167 rows). Only
   33 versions match local filenames exactly. The bulk of applied work is
   recorded under *different* timestamps than the current filenames carry
   (same migration name, applied-timestamp version vs tidy-timestamp
   filename), plus 10 ledger rows with no corresponding local file at all
   (library worktree, other branches).

Result: a normal `db push` today would first attempt
`20260213000000` (a replay-only reconstruction) and fail loudly on its first
statement, leaving everything — including the one genuinely pending forward
migration — unapplied. Selective/partial application would be worse (see
"Unsafe-to-Replay Notes"). This is a known, deferred operational issue: see
Status above and the Production Migration Deployment Freeze below.

## Authoritative Environment

- Repo: `C:\Users\LEGION\Desktop\Bookconnect4_expo`
  (GitHub `mdasheef99/Bookapp_reactexpo`)
- Live Supabase project: `ahntbtktjjmvfosgkmgn` (read-only access only)
- Reconciliation worktree: `C:\Users\LEGION\Desktop\Bookconnect4_migration_reconcile`
  branch `ops/migration-reconciliation-20260913` (local-only, never pushed)
- Audited refs (verified 2026-09-13 before worktree creation):
  `origin/main = 8340647f4d33c644732777bcc00a8b8db9236500`,
  `origin/feat/clubs-ui-overhaul = 229bf5ae323eb2e1fddd3a0fe953fda06c4b57a9`
- Audit date: 2026-09-13. No credentials, tokens, or secrets are recorded here.

## Evidence Rules

- Authority order: live ledger > live catalog/policy/grant state > actual
  migration SQL > git history > tracker prose > comments.
- **EFFECT EXISTS LIVE** and **VERSION RECORDED IN LEDGER** are different
  facts. A migration is only "satisfied" when its effect is proven live
  (or provably superseded); a ledger row alone is not effect proof.
- A file header claiming "NOT APPLIED LIVE" is prose. The ledger plus live
  catalog outranks it (observed once: `20260912200746`, see below).
- For superseded historical migrations, present-day objects are NOT required
  to be byte-identical to the old SQL — only that the transition is
  represented and re-execution would be wrong.

## Complete Mismatch Inventory

Counts (exact-version comparison): local files **174**, ledger rows **167**,
exact version+name intersection **33**.

- **LOCAL-NOT-REMOTE (141)** = 124 version-renamed-but-ledgered (Class D) +
  17 local-only versions (5 Class A + 10 Class B + 1 Class C + 1 Class D).
- **REMOTE-NOT-LOCAL (134)** = 124 rename counterparts (same names as local
  files, applied-timestamp versions) + 10 rows with no local file (see table).
- **Version/name anomalies (2)**: ledger versions `20260830090435` and
  `20260830153413` match local filenames exactly, but the ledger *names*
  embed older versions (`20260830000001_...`, `20260830120000_...`) — the
  files were renamed after application. No repair needed (versions ledgered).

Reconciliation of counts to the reviewed repair set:

- of LOCAL-NOT-REMOTE (141): **139 reviewed repair candidates** (124 aliases +
  5 Class A + 10 Class B) + 1 **excluded obsolete** migration
  (`20260527104248`) + 1 **genuinely pending** migration (`20260714000001`);
- of REMOTE-NOT-LOCAL (134): 124 alias counterparts + 10 rows with no local
  file (Library / Phase 9 / other live history).

### Local-only versions (the 17 material ones)

| Version | File suffix | Class |
|---|---|---|
| 20260213000000 | clubs_pre010_historical_reconciliation | A |
| 20260213000001 | clubs_pre010_lead_policy_reconciliation | A |
| 20260311183000 | 017_user_credit_balances_lockdown | B |
| 20260311190000 | 018_listings_city_visibility_policy | B |
| 20260312120000 | 019_book_public_reviews_contract | B |
| 20260507120000 | 016_set_current_book_from_nomination | B |
| 20260522225430 | exchange_rpc_prerequisite_reconciliation | A |
| 20260527104248 | transfer_club_admin_rpc | D (obsolete) |
| 20260529160000 | clubs_book_clubs_archived_at_reconstruction | A |
| 20260605175646 | add_exchange_pickup_venue | B |
| 20260714000001 | harden_club_primary_and_exchange_city | C |
| 20260822220000 | clubs_issue_member_action_default_removal_reconciliation | A |
| 20260822230000 | clubs_wave2_attribution_guards_expiry | B |
| 20260822233000 | clubs_b01_banner_storage_lockdown | B |
| 20260822234500 | clubs_b02_creation_cap_race_fix | B |
| 20260822235000 | clubs_t03_emoji_canonical_set | B |
| 20260824100000 | clubs_f04_reaction_single_reaction_invariant | B |

### Remote rows with no local file (10)

| Ledger version | Ledger name | Disposition |
|---|---|---|
| 20260605123630 | harden_clubs_maintenance_rpc_execute_grants | No local file; pre-dates repo tidy history. No action here. |
| 20260605123747 | schedule_expired_club_member_actions_cleanup | Same as above. No action here. |
| 20260606160722 | add_invitation_reminder_notifications | Same as above. No action here. |
| 20260820033938 | marketplace_wishlist_notify_unify | Applied from another branch/worktree. No action here. |
| 20260820034004 | reading_notes_fk_and_cleanup | Same as above. No action here. |
| 20260820064258 | library_user_book_pages_vault | Sibling library worktree (`feat/library-shelf-motion`). Do not touch. |
| 20260820071215 | library_word_limit_hardening | Same as above. Do not touch. |
| 20260912072815 | marketplace_phase9_duplicate_confirmation | Applied from another branch/worktree. No action here. |
| 20260913111342 | marketplace_phase9_representative_edition_cover | Same as above. No action here. |
| 20260913162154 | marketplace_phase9_representative_cover_detail_projection | Same as above. No action here. |

### High-attention verification table

| Version | Local | Ledger | Live effect | Re-run | Class | Proposed |
|---|---|---|---|---|---|---|
| 20260213000000 | YES | ABSENT | YES (admin_id, author_id, meeting_type, author_club checks, admin role check) | FAIL-LOUD | A | MARK APPLIED |
| 20260213000001 | YES | ABSENT | YES (obsolete lead policy absent) | FAIL-LOUD | A | MARK APPLIED |
| 20260522225430 | YES | ABSENT | YES (idempotency_key, credit RPCs, balance trigger; request_transaction since superseded to 6-arg) | FAIL-LOUD | A | MARK APPLIED |
| 20260529160000 | YES | ABSENT | YES (book_clubs.archived_at timestamptz nullable) | FAIL-LOUD | A | MARK APPLIED |
| 20260822220000 | YES | ABSENT | YES (live signature has no DEFAULT; Wave-2 body live) | DANGEROUS | A | MARK APPLIED |
| 20260822230000 | YES | ABSENT | YES (expiry guards in issue_club_member_action, expires_at default, both triggers) | FAIL-LOUD | B | MARK APPLIED |
| 20260822233000 | YES | ABSENT | YES (exactly the 4 club_banners policies) | FAIL-LOUD | B | MARK APPLIED |
| 20260822234500 | YES | ABSENT | YES (pg_advisory_xact_lock in enforce_book_club_entitlement) | SAFE | B | MARK APPLIED |
| 20260822235000 | YES | ABSENT | YES (11-emoji canonical CHECK) | FAIL-LOUD | B | MARK APPLIED |
| 20260824100000 | YES | ABSENT | YES (both partial unique indexes + set_club_discussion_reaction) | SAFE | B | MARK APPLIED |
| 20260830090435 | YES | PRESENT | YES (process_club_downgrade_grace_period live) | n/a (ledgered) | — | NONE |
| 20260830153413 | YES | PRESENT | YES (request/accept transfer RPCs live) | n/a (ledgered) | — | NONE |
| 20260912200746 | YES | PRESENT | YES (vote/nomination bypass policies gone) | n/a (ledgered) | — | NONE |
| 20260714000001 | YES | ABSENT | NO (no city_key columns, no set_primary_club_venue; live request_transaction is the pre-city_key 6-arg form) | SAFE | C | LEAVE PENDING |

Notes:

- `20260912200746` file header still says "LOCAL ONLY — NOT APPLIED LIVE",
  but ledger version `20260912200746` exists AND the TC04 policy removals are
  verified live. Ledger + catalog outrank the stale header (the Clubs tracker
  closeout entry already records the header as superseded). No action.
- `20260605175646` (pickup venue) is Class B, not pending: live
  `transactions.pickup_venue_id` exists and live `request_transaction` is the
  6-arg pre-city_key form byte-consistent with that file. The later
  city_key evolution belongs to the pending `20260714000001`.
- `20260527104248` (direct `transfer_club_admin`) is obsolete/superseded: the
  function is absent live and superseded by the request/accept model ledgered
  as `20260605123337`. It is EXCLUDED from the reviewed repair set and its
  disposition is deferred (dedicated section below). Executing it would
  resurrect a deprecated path.

## Classification

- **CLASS A — historical/replay-only (5):** `20260213000000`,
  `20260213000001`, `20260522225430`, `20260529160000`, `20260822220000`.
  Needed for fresh replay; must never execute against live.
- **CLASS B — manually/MCP-applied, effect live, unledgered (10):**
  `20260311183000`, `20260311190000`, `20260312120000`, `20260507120000`,
  `20260605175646`, `20260822230000`, `20260822233000`, `20260822234500`,
  `20260822235000`, `20260824100000`.
- **CLASS C — genuinely unapplied (1):** `20260714000001`. Stays pending.
- **CLASS D — reconstructed version/timestamp aliases (124):** same-name
  ledgered pairs (mapping below). Independent review found 110
  byte-equivalent + 11 code-equivalent + remaining small consolidation/storage
  cases traced to the same logical history. These are NOT broken migrations.
- **CLASS D-obsolete — design-superseded (1):** `20260527104248`
  (EXCLUDED from the repair set; deferred disposition below).
- **CLASS E — unknown (0).** No version was left unclassified; residual
  uncertainty is recorded per-entry as confidence, not as Class E.

## Version-Alias Finding — Independent Review (124 pairs)

The large local↔remote mismatch count does NOT mean 124 missing database
changes. An independent review compared the 124 local files against their
same-name ledger counterparts and found:

- **110 byte-equivalent executed SQL pairs** (statement bodies identical);
- **11 code-equivalent pairs** differing only in comments, encoding,
  whitespace, or similar non-semantic representation;
- the remaining small consolidation/storage cases were independently traced
  and found to represent the same logical history.

Conclusion: these 124 mismatches are primarily **RECONSTRUCTED
VERSION/TIMESTAMP ALIASES** — the same logical migration recorded in the live
ledger under production execution timestamps and in the repository under the
tidy/reconstructed timestamps used for clean replay ordering. They are NOT
"broken migrations" and must not be described as such.

Why the local files are not being renamed back to the ledger versions now:

- the reconstructed versions establish the current clean replay ordering;
- historical production execution timestamps differ from that reconstructed
  ordering in places;
- renaming 124 files would create broad repository churn and can alter replay
  ordering.

Why the old remote ledger rows are not being removed now:

- they represent truthful historical execution records;
- deleting/reverting them merely for cosmetic alignment would erase real
  history.

## 20260527104248_transfer_club_admin_rpc.sql — Obsolete / Superseded

**STATUS: OBSOLETE / SUPERSEDED LOCAL MIGRATION — DEFERRED DISPOSITION**

Facts:

- it was never represented in the live migration ledger;
- the RPC it creates (`transfer_club_admin`, direct-transfer model) is not
  live;
- the newer request/accept transfer model superseded it (ledgered as
  `20260605123337`);
- executing it could resurrect deprecated behavior;
- it must NOT be blindly deployed;
- it must NOT be marked applied merely to silence migration tooling;
- it is EXCLUDED from the 139-version repair set (it is NOT approved for
  migration repair);
- retirement/deletion or another explicit supersession mechanism is deferred to
  the future reconciliation work unit.

Do NOT delete or edit this migration in the current closeout. The file stays in
place, unchanged, until the future reconciliation work unit decides its
retirement mechanism.

## Genuinely Pending Migration — 20260714000001

**`20260714000001_harden_club_primary_and_exchange_city.sql`**

**STATUS: GENUINELY UNAPPLIED. Do NOT mark applied.**

Known absent live effects include:

- `set_primary_club_venue`;
- city-key normalization/support;
- related city-key schema behavior;
- later `request_transaction` city behavior.

It is absent from the ledger AND absent live. It is currently blocked behind
the history drift (it sorts after 139 unledgered-but-satisfied versions) and
requires its own bounded deployment review in the future. It must NOT be
applied, and must NOT be marked applied, as part of this reconciliation
documentation. Its guards (`IF NOT EXISTS`, `CREATE OR REPLACE`) make it safe
to execute when deliberately reviewed and deployed.

## Remote-Only / Parallel-Work Context

The audit found remote migration rows not represented in this feature branch's
local chain (10 with no local file at all; 124 more are alias counterparts of
local files). The 10 remote-only rows are associated with:

- parallel Library work (`20260820034004` reading-notes cleanup,
  `20260820064258`, `20260820071215`);
- Phase 9 / marketplace work (`20260820033938`, `20260912072815`,
  `20260913111342`, `20260913162154`);
- other live/manual history (`20260605123630`, `20260605123747`,
  `20260606160722`);
- consolidated historical behavior.

These rows are expected/documented historical or parallel-branch state. They
are NOT automatically pending local migrations.

This is a major reason NOT to mutate the shared migration ledger while parallel
feature branches are still active.

Operational principle:

> Migration-history reconciliation should be performed from a stable,
> cross-branch repository checkpoint, not while multiple active feature
> branches are independently producing or applying migrations against the same
> shared remote project.

## Replay-Only Migrations

The five Class A files stay in the repository permanently: without them a
fresh database cannot replay (proven by the clean-replay run below, and by
each file's header documenting the exact replay gap it closes). Marking them
applied in the *live* ledger does not remove them from the repo.

- `20260213000000` — pre-010 substrate (lead→admin rename, role check,
  author_club support). First `db push` statement would be its
  `RENAME COLUMN lead_id TO admin_id`, which fails live (SQLSTATE 42703).
- `20260213000001` — drops the obsolete 008-era lead policy (plain DROP,
  fails live where the policy is already gone).
- `20260522225430` — reconstructs the live-only credit/RPC substrate that
  `20260522225437` assumes (plain ADD COLUMN, fails live).
- `20260529160000` — adds `book_clubs.archived_at` (plain ADD COLUMN,
  fails live).
- `20260822220000` — plain DROP of the defaulted
  `issue_club_member_action` signature so Wave-2 can recreate it
  default-free. **Re-running would drop the live Wave-2 function.**

## Already-Live / Unledgered Migrations

Ten Class B versions (table above) have all material effects verified live
via catalog/policy/grant/function-body reads on 2026-09-13:

- grants on `user_credit_balances` (authenticated SELECT only) + absence of
  the dropped policy (`20260311183000`);
- listings city policy with city-correlated EXISTS clause (`20260311190000`);
- `get_public_book_reviews(uuid)` present (`20260312120000`);
- `set_club_current_book_from_nomination(uuid)` present (`20260507120000`);
- `transactions.pickup_venue_id` + pre-city_key 6-arg `request_transaction`
  (`20260605175646`);
- Wave-2 guards in `issue_club_member_action` body, `expires_at` default
  `now()+14d`, both attribution triggers (`20260822230000`);
- exactly the four `club_banners_*` storage policies (`20260822233000`);
- advisory-lock line in `enforce_book_club_entitlement` (`20260822234500`);
- emoji canonical CHECK + both F04 partial unique indexes +
  `set_club_discussion_reaction` (`20260822235000`, `20260824100000`).

Each effect's originating file is unique in the repo (no second migration
produces the same object), supporting the manual/MCP-application reading.

## Unsafe-to-Replay Notes

Do not execute, selectively apply, or "make pass" any of these against live:

- `20260822220000` — plain DROP FUNCTION matches the *live* Wave-2
  signature; running it deletes production moderation behavior.
- `20260527104248` — CREATE OR REPLACE would resurrect the deprecated
  direct-transfer RPC alongside the request/accept model.
- `20260822230000` — UPDATE backfill over `club_invitations` plus plain
  ADD COLUMN; fails and would touch user data on partial retry.
- `20260824100000` / `20260822235000` — DELETE/UPDATE data repairs that
  ran during manual application; re-running is at best churn, at worst
  destructive if combined with skips.
- `20260213000000` — UPDATE over `club_members` roles; harmless only
  inside its (failing) transaction — never run piecemeal.
- Never edit a historical migration to suppress an error. Never mark
  `20260714000001` as applied.

## Proposed / Reviewed Repair-As-Applied Set (139 versions) — REVIEWED BUT NOT EXECUTED

**REVIEWED BUT NOT EXECUTED. DEFERRED. Do NOT run. Requires a fresh delta
audit and explicit owner authorization (see Resume Criteria and Future Closure
Procedure).**

Count: **139 versions** = 5 historical/replay-only (Class A) + 10
already-live/unledgered (Class B) + 124 reconstructed version/timestamp
aliases (Class D).

The earlier 140-version figure is superseded:
`20260527104248_transfer_club_admin_rpc.sql` is **EXCLUDED** and is NOT
approved for migration repair.

Semantics per entry: `supabase migration repair --status applied <VERSION>`
records the version as satisfied WITHOUT executing its SQL. Justification
summaries:

- Class A (5): replay substrate already represented/superseded live;
  execution would fail or destroy (see Unsafe notes).
- Class B (10): full material effect verified live 2026-09-13; execution
  would fail or churn.
- Class D aliases (124): identical migration name already ledgered under
  the applied-timestamp version; the local file is the same logical migration
  under its tidy filename. Independent review: 110 byte-equivalent executed
  SQL pairs + 11 code-equivalent pairs (comments/encoding/whitespace) +
  remaining small consolidation/storage cases traced to the same logical
  history.
- Excluded from this set: `20260527104248` (obsolete/superseded — deferred
  disposition) and `20260714000001` (genuinely pending — must not be marked
  applied).

### A. Historical / replay-only — MARK APPLIED (5)

- `20260213000000` (clubs_pre010_historical_reconciliation) — HIGH
- `20260213000001` (clubs_pre010_lead_policy_reconciliation) — HIGH
- `20260522225430` (exchange_rpc_prerequisite_reconciliation) — HIGH
- `20260529160000` (clubs_book_clubs_archived_at_reconstruction) — HIGH
- `20260822220000` (clubs_issue_member_action_default_removal_reconciliation)
  — HIGH (dangerous to execute; transition represented by live default-free
  signature + Wave-2 body)

### B. Already-live / unledgered — MARK APPLIED (10)

- `20260311183000` (017_user_credit_balances_lockdown) — MEDIUM
- `20260311190000` (018_listings_city_visibility_policy) — MEDIUM
- `20260312120000` (019_book_public_reviews_contract) — MEDIUM
- `20260507120000` (016_set_current_book_from_nomination) — MEDIUM
- `20260605175646` (add_exchange_pickup_venue) — HIGH (live 6-arg form
  matches this file exactly, pre-city_key)
- `20260822230000` (clubs_wave2_attribution_guards_expiry) — HIGH
- `20260822233000` (clubs_b01_banner_storage_lockdown) — HIGH
- `20260822234500` (clubs_b02_creation_cap_race_fix) — HIGH
- `20260822235000` (clubs_t03_emoji_canonical_set) — HIGH
- `20260824100000` (clubs_f04_reaction_single_reaction_invariant) — HIGH

### D. Renamed-but-ledgered aliases — MARK APPLIED (124), local → ledger

Early clubs/exchange (13):

- `20260510174645` → `20260511005757` (submit_transaction_rating_rpc)
- `20260511005840` → `20260511005903` (restrict_submit_transaction_rating_execute)
- `20260511010600` → `20260511010847` (file_transaction_dispute_rpc)
- `20260522053238` → `20260522223158` (harden_exchange_schema)
- `20260523054932` → `20260523091023` (create_club_rpc)
- `20260523090700` → `20260523091641` (harden_club_public_details_view)
- `20260523091736` → `20260523091800` (restrict_club_public_details_view_grants)
- `20260523092143` → `20260523092232` (add_club_invitation_revoke_read_rpc)
- `20260529143000` → `20260605123242` (clubs_moderation_cleanup_and_policy_notes)
- `20260529154500` → `20260605123337` (club_moderation_author_lifecycle_rpc)
- `20260529170000` → `20260605123430` (club_downgrade_grace_period)
- `20260606142000` → `20260606155956` (complete_clubs_notifications_and_reminders)
- `20260606143000` → `20260606160224` (wishlist_notify_rpc)

Marketplace foundation → phase 6 (53):

- `20260619000001` → `20260619060411` (marketplace_foundation_schema)
- `20260619000002` → `20260619060437` (marketplace_foundation_helpers)
- `20260619000003` → `20260619060527` (marketplace_foundation_rls)
- `20260619000004` → `20260619060547` (marketplace_foundation_storage)
- `20260619000005` → `20260619065834` (marketplace_notifications_fk_indexes)
- `20260627000001` → `20260627181341` (marketplace_phase2_onboarding_hardening)
- `20260628000001` → `20260628090815` (marketplace_phase2b_application_metadata)
- `20260628000002` → `20260628102752` (marketplace_phase2c_review_metadata)
- `20260628000003` → `20260628181842` (marketplace_phase3_inventory_canonical_listings)
- `20260701000001` → `20260701062905` (marketplace_phase5_consumer_discovery_schema)
- `20260713000001` → `20260715155047` (marketplace_phase3_public_listing_policy_split)
- `20260715000001` → `20260715115929` (marketplace_phase4_security_hardening)
- `20260715000002` → `20260715155103` (marketplace_phase5_discovery_hardening)
- `20260715000003` → `20260715174111` (marketplace_phase5_public_policy_projection_fix)
- `20260716000001` → `20260716144007` (marketplace_phase6_order_request_core)
- `20260716000002` → `20260716144042` (marketplace_phase6_order_request_evidence)
- `20260716000003` → `20260716144055` (marketplace_phase6_infrastructure_extensions)
- `20260716000004` → `20260716144115` (marketplace_phase6_authorization_safe_reads)
- `20260716000005` → `20260716144129` (marketplace_phase6_eligibility_resolver)
- `20260716000006` → `20260716144220` (marketplace_phase6_cart_command_foundation)
- `20260716000007` → `20260716144241` (marketplace_phase6_cart_commands)
- `20260716000008` → `20260716144258` (marketplace_phase6_cart_replacement)
- `20260716000009` → `20260716144312` (marketplace_phase6_submission_helpers)
- `20260716000010` → `20260716144326` (marketplace_phase6_submit_order_request)
- `20260716000011` → `20260716144411` (marketplace_phase6_hold_helpers)
- `20260716000012` → `20260716144429` (marketplace_phase6_owner_review_outcomes)
- `20260716000013` → `20260716144445` (marketplace_phase6_clarification_support_schema)
- `20260716000014` → `20260716144504` (marketplace_phase6_clarification_commands)
- `20260716000015` → `20260716144521` (marketplace_phase6_owner_support_request)
- `20260716000016` → `20260716144535` (marketplace_phase6_support_interventions)
- `20260716000017` → `20260716144619` (marketplace_phase6_payment_ready_helpers)
- `20260716000018` → `20260716144638` (marketplace_phase6_customer_decision_commands)
- `20260716000019` → `20260716144655` (marketplace_phase6_terminal_expiry_commands)
- `20260716000020` → `20260716144710` (marketplace_phase6_schedule_engine)
- `20260716000021` → `20260716144725` (marketplace_phase6_deadline_integration)
- `20260716000022` → `20260716144742` (marketplace_phase6_clarification_timeout)
- `20260716000023` → `20260716144801` (marketplace_phase6_closure_commands)
- `20260716000024` → `20260716144903` (marketplace_phase6_event_notification_contract)
- `20260716000025` → `20260716144920` (marketplace_phase6_notification_transport)
- `20260716000026` → `20260716144938` (marketplace_phase6_task_claim_retry)
- `20260716000027` → `20260716145003` (marketplace_phase6_task_commands)
- `20260716000028` → `20260716145021` (marketplace_phase6_scheduler_contract)
- `20260716000029` → `20260716145132` (marketplace_phase6_ui_safe_projections)
- `20260716000030` → `20260716145159` (marketplace_phase6_owner_ui_safe_projections)
- `20260716000031` → `20260716145214` (marketplace_phase6_reconciliation_foundation)
- `20260716000032` → `20260716145234` (marketplace_phase6_reconciliation_scans)
- `20260716000033` → `20260716145253` (marketplace_phase6_observability)
- `20260716000034` → `20260716145821` (marketplace_phase6_support_task_provenance_fix)
- `20260716000035` → `20260716150214` (marketplace_phase6_support_event_source_fix)
- `20260716000036` → `20260716150557` (marketplace_phase6_support_deadline_task_fix)
- `20260716000037` → `20260716151037` (marketplace_phase6_listing_evidence_projection_fix)
- `20260716000038` → `20260716151452` (marketplace_phase6_emergency_pause_remainder_fix)
- `20260716000039` → `20260716151841` (marketplace_phase6_emergency_resume_zero_fix)

Phase 9 (58):

- `20260722000001` → `20260722090236` (marketplace_phase9_catalogue_metadata_expand)
- `20260722000002` → `20260722090256` (marketplace_phase9_extraction_persistence)
- `20260722000003` → `20260722090321` (marketplace_phase9_media_registry)
- `20260722000004` → `20260722090341` (marketplace_phase9_condition_damage_transition)
- `20260722000005` → `20260722090407` (marketplace_phase9_controlled_inventory_commands)
- `20260722000006` → `20260722095443` (marketplace_phase9_storage_boundaries)
- `20260722000007` → `20260722095545` (marketplace_phase9_public_projection_search)
- `20260722000008` → `20260722095729` (marketplace_phase9_request_photo_seam)
- `20260722000010` → `20260722125256` (marketplace_phase9_public_boundary_security_correction)
- `20260723000011` → `20260726182238` (marketplace_phase9_ingestion_runtime_foundation)
- `20260726000012` → `20260726182539` (marketplace_phase9_vision_analysis_runtime)
- `20260727000013` → `20260727025046` (marketplace_phase9_service_rpc_wrappers)
- `20260727000014` → `20260727183546` (marketplace_phase9_vision_provider_attempts)
- `20260728000015` → `20260727222159` (marketplace_phase9_metadata_foundation)
- `20260728000016` → `20260727231217` (marketplace_phase9_sensitive_table_acl_correction)
- `20260728000017` → `20260727233457` (marketplace_phase9_maintain_acl_correction)
- `20260729000018` → `20260729004216` (marketplace_phase9_search_variant_proposals)
- `20260729000019` → `20260729020008` (marketplace_phase9_search_variant_replay_fence)
- `20260729000020` → `20260729054842` (marketplace_phase9_variant_runtime_search)
- `20260729000021` → `20260729060238` (marketplace_phase9_defer_active_variant_search)
- `20260729000022` → `20260729075459` (marketplace_phase9_active_variant_search)
- `20260729000023` → `20260729082153` (marketplace_phase9_active_variant_search_correction)
- `20260729000024` → `20260730022442` (marketplace_phase9_owner_variant_decisions)
- `20260729000025` → `20260730022524` (marketplace_phase9_owner_variant_corrections)
- `20260729000026` → `20260730022559` (marketplace_phase9_variant_benchmark_rollout)
- `20260729000027` → `20260730022636` (marketplace_phase9_exact_rollout_activation)
- `20260729000028` → `20260730022713` (marketplace_phase9_variant_benchmark_evidence_read)
- `20260730000029` → `20260730162700` (marketplace_phase9_owner_safe_contracts)
- `20260801000030` → `20260801093048` (marketplace_phase9_unit6e_review_corrections)
- `20260803000031` → `20260803221216` (marketplace_phase9_owner_inventory_read_boundary)
- `20260807000032` → `20260808020404` (marketplace_phase9_structural_metadata_integration)
- `20260809000033` → `20260809023834` (marketplace_phase9_vision_reservation_correction)
- `20260809000034` → `20260809182407` (marketplace_phase9_vision_language_hint_correction)
- `20260810000035` → `20260809223135` (marketplace_phase9_single_image_removal)
- `20260810000036` → `20260810105448` (marketplace_phase9_worker_wake_dispatcher)
- `20260810000037` → `20260810105517` (marketplace_phase9_owner_discovery_scope_correction)
- `20260810000038` → `20260810130638` (marketplace_phase9_metadata_retry_correction)
- `20260812000039` → `20260812003419` (marketplace_phase9_create_only_inventory_commit)
- `20260812000040` → `20260813000040` (marketplace_phase9_safe_publication)
- `20260813000041` → `20260813070104` (marketplace_phase9_unit7a_quality_handoff)
- `20260814000042` → `20260814013536` (marketplace_phase9_generated_authors_projection)
- `20260814000043` → `20260816122822` (marketplace_phase9_unit7c_inventory_management)
- `20260814000044` → `20260816122901` (marketplace_phase9_store_view_filter_contract)
- `20260815000045` → `20260816122929` (marketplace_phase9_unit7c_media_history)
- `20260816000046` → `20260816150126` (marketplace_phase9_unit7c_private_save_revision_correction)
- `20260817000047` → `20260817073341` (marketplace_phase9_legacy_rpc_security_remediation)
- `20260817000048` → `20260817075825` (marketplace_phase9_legacy_rpc_service_role_compatibility)
- `20260818000049` → `20260821060156` (marketplace_phase9_bookstore_first_discovery)
- `20260820000050` → `20260821060742` (marketplace_phase9_storefront_detail)
- `20260821000051` → `20260821061213` (marketplace_phase9_public_media_order_invariant)
- `20260821000052` → `20260822025712` (marketplace_phase9_unit6g_contract_persistence_foundation)
- `20260827000053` → `20260828081324` (marketplace_phase9_unit6g_field_authority_correction)
- `20260829000054` → `20260829142337` (marketplace_phase9_unit6g_session_lifecycle_fence)
- `20260830000055` → `20260830084323` (marketplace_phase9_unit6g_metadata_add_authority_correction)
- `20260830000056` → `20260830175651` (marketplace_phase9_metadata_throughput)
- `20260906000057` → `20260908073203` (marketplace_phase9_media_output_intents)
- `20260906000058` → `20260908073308` (marketplace_phase9_media_completion_receipts)
- `20260906000059` → `20260908073425` (marketplace_phase9_media_output_cleanup)

### Explicitly NOT in the repair set

- `20260714000001` (Class C, genuinely pending) — must deploy normally after
  its own bounded review; must not be marked applied.
- `20260527104248` (obsolete/superseded) — deferred disposition; not approved
  for migration repair.
- The name-anomaly ledgered versions (`20260830090435`, `20260830153413`,
  `20260912200746`) — already ledgered, no action.
- All 10 remote-only rows — no local file, nothing to repair here.

## Expected Ledger Shape If Repair Is Ever Executed (simulation only — NOT executed)

The reviewed R1 approach would NOT produce identical local/remote version sets.
If it is eventually executed:

- 139 reconstructed/already-live versions would be recorded as applied;
- original historical ledger entries would remain;
- approximately 134 remote-only rows would still exist;
- those remote-only rows are expected/documented historical or
  parallel-branch state, not automatically pending migrations.

Therefore the desired invariant is NOT:

> "local migration versions == remote ledger versions"

The desired operational invariant is:

> Every local migration is either:
>
> 1. represented/satisfied by the live database and appropriately accounted
>    for, or
> 2. genuinely pending and safe to deploy deliberately.

Additional expected effects after the 139 repairs (each read back from the
ledger after application):

- `migration list` / dry-run should show exactly ONE pending forward
  migration: `20260714000001_harden_club_primary_and_exchange_city`
  (city_key columns + city-checked 6-arg `request_transaction` +
  `set_primary_club_venue`).
- No replay-only (Class A) file may appear deployable.
- No already-live Wave/B01/T03/F04/pickup file may appear deployable.
- `20260527104248` must not appear as applied (excluded; retirement is a
  separate future decision).
- Remote-only rows (library, wishlist-unify, representative covers, etc.)
  remain ledger-side facts; they do not block a push of local files.

Uncertainty note: with the independent alias review (110 byte-equivalent + 11
code-equivalent + remaining traced), the earlier concern that a Class D alias
body might materially differ is materially reduced. A future byte-level audit
against `pg_get_functiondef` for the RPC-heavy aliases remains recommended but
not blocking.

## Clean Replay Evidence — ADEQUATE (not STRONG)

**CLEAN REPLAY EVIDENCE: ADEQUATE. Not STRONG.**

Qualification:

- replay demonstrated internal migration-chain replayability;
- platform fixtures/shims were required;
- the `club-banners` storage bucket was fixture-provided rather than created
  by a migration;
- the exact runner/log was not preserved as a durable repository artifact;
- replay did NOT prove complete parity with all live remote-only migrations.

Do not overstate this result. Future closure should preserve a reproducible
replay harness/log as a durable artifact.

Details of the run performed (disposable local only):

- Target: ephemeral Docker container, image `postgis/postgis:17-3.5`
  (locally cached pinned image, no pull), container-private IP
  (e.g. 172.17.0.2), host port bound to **127.0.0.1 with an ephemeral
  port** (observed 127.0.0.1:59523 on the passing run), database
  `postgres`, generated password. Container env inspected: no live
  project reference, no URLs, no keys. Pre-replay ledger empty.
- Harness (no migration file modified): repo
  `clubs_l4_platform_bootstrap.sql` (roles/auth shim/postgis) + repo
  `clubs_l4_storage_substrate.sql` applied immediately before the storage
  migration (its documented position) + a temp-dir-only shim for platform
  services the disposable image cannot provide (`extensions` search_path
  mirror, `auth.role()` GUC-reader matching the repo shim convention,
  inert `cron` schedule stubs, empty `net`/`vault` schemas). Four
  migrations are already coded defensively for absent services
  (`20260529143000`, `20260529170000`, `20260606142000`); only
  `20260810000036` hard-requires the schemas at DDL time.
- Result: **MIGRATIONS REPLAYED 174/174, FIRST FAILURE none,
  CLEAN REPLAY PASS** (147 public tables). Container removed (`docker rm
  -f`), residue check empty.
- Live project `ahntbtktjjmvfosgkmgn` was never connected, never written.

## Current `db push` Failure Model (read-only analysis)

1. First attempted local version: `20260213000000`.
2. First statement executed: `ALTER TABLE public.book_clubs RENAME COLUMN
   lead_id TO admin_id`.
3. Outcome: FAIL — `lead_id` no longer exists live (SQLSTATE 42703).
4. The migration's transaction rolls back; nothing is partially applied.
5. All 139 later unledgered versions remain unattempted, including the one
   genuinely pending migration `20260714000001`.
6. Selective application would be destructive: `20260822220000` alone would
   drop the live Wave-2 `issue_club_member_action`; `20260527104248` alone
   would resurrect the deprecated direct-transfer RPC; UPDATE backfills in
   Wave-2/T03/F04 would run outside their verified one-time context.
7. Blocked genuine migration: `20260714000001`.

# PRODUCTION MIGRATION DEPLOYMENT FREEZE

Until reconciliation is intentionally resumed (see Resume Criteria below):

DO NOT run normal production:

```
supabase db push
```

DO NOT selectively execute historical/replay migrations.

DO NOT execute:

`20260527104248_transfer_club_admin_rpc.sql`

DO NOT automatically execute the 139 proposed repair commands.

DO NOT mark:

`20260714000001`

as applied.

Normal Git operations are NOT blocked:

- commits;
- feature pushes;
- PR creation;
- PR review;
- merge to main,

provided no workflow automatically applies database migrations.

The current repository evidence shows the Clubs PR does not automatically run
production migrations. Clubs commit/push/PR/merge may therefore proceed.

## Parallel Development Rule

While multiple workstations/feature branches are using the same live Supabase
project:

- only deliberate, coordinated migration deployment is allowed;
- do not attempt migration-history normalization from one branch without first
  inspecting the others;
- record every newly applied migration/version;
- avoid manual/MCP schema changes without corresponding migration provenance;
- before eventual reconciliation, collect the newest migration state from all
  active workstreams.

This is especially relevant to the active multitenant-store workstream.

## Resume Criteria

Revisit migration reconciliation when:

1. the multitenant-store / other active migration-producing branches reach a
   stable checkpoint;
2. latest `main` is known;
3. all active feature branches with database work are inventoried;
4. the current live migration ledger is snapshotted again;
5. no competing migration deployment is in progress.

Then perform a DELTA AUDIT from this 2026-09-13 baseline. Do NOT redo the
entire forensic investigation from zero unless evidence demands it.

The delta audit should answer:

- what local migrations were added/renamed since 2026-09-13;
- what remote ledger rows were added since 2026-09-13;
- whether any proposed 139 repair entries changed status;
- whether `20260527104248` has been retired;
- whether `20260714000001` remains genuinely pending;
- whether additional parallel-work migrations need reconciliation.

# Future Closure Procedure (PROPOSED — NOT AUTHORIZED)

Recorded as PROPOSED. None of these steps is authorized by this document; do
NOT execute any of them now.

1. stable cross-branch checkpoint;
2. refresh local ↔ live ledger inventory;
3. rerun/reproduce fresh migration replay;
4. independently review the final exact repair manifest;
5. explicit owner authorization;
6. perform approved migration-history repairs with readback;
7. resolve/retire obsolete local migrations such as `20260527104248`;
8. verify `supabase migration list`;
9. verify deployment plan / dry-run;
10. only genuinely unapplied migrations should remain deployable;
11. separately review/deploy genuinely pending migrations such as
    `20260714000001`;
12. update this runbook with actual completion evidence;
13. lift the migration deployment freeze.

Approval gate: any `supabase migration repair --status applied ...` (or
`reverted`) command against `ahntbtktjjmvfosgkmgn` requires explicit owner
approval AFTER independent review of the final exact version list. Apply
one-by-one (or in small reviewed batches), reading back `schema_migrations`
after each, and record timestamps/results in this runbook before closing.

## Explicit Prohibitions

While the freeze is in force:

- DO NOT run production `supabase db push`.
- DO NOT execute replay migrations against live.
- DO NOT execute `20260527104248_transfer_club_admin_rpc.sql`.
- DO NOT automatically execute the 139 proposed repair commands.
- DO NOT mark genuinely unapplied migrations (`20260714000001`) as applied.
- DO NOT edit, rename, delete, or "make pass" historical/replay migrations to
  suppress errors or for cosmetic ledger alignment.
- DO NOT rename the 124 alias files back, or delete their remote ledger rows,
  during this deferred period.
- DO NOT touch the sibling library worktree paths or its ledger-only
  migrations; DO NOT pop/drop `stash@{0}` (library backup) anywhere.

## Revision Note

- 2026-09-13 — Deferred closeout update: status changed from "audit complete,
  proposed repair set awaiting review" to DEFERRED (shared project, active
  parallel work). Repair set corrected from 140 to **139** (the transfer RPC
  is excluded, not approved). Independent version-alias review incorporated
  (110 byte-equivalent + 11 code-equivalent + remaining traced). Clean-replay
  evidence qualified to ADEQUATE. No migration repair or deployment was
  executed; no migration file was modified.
