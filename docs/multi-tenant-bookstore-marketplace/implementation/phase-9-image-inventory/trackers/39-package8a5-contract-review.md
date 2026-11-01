# Package 8a-5 contract review and correction evidence

## Scope and authority

Owner: reassess and correct the local M93 file; Terra/max independent review.
No application, deployment, provider call, stage, commit or push authority.
Original baseline: M93 SHA256
`0db0d7c9e0d06085b0bdf6d639a2b3ca7dc783078601d8b6e7dffac1eaf8ad9f`.
Original approved source is HEAD's 02c, 02c-1 and DECISIONS; the earlier
implementation-added interface paragraph is a claim being reviewed, not an
independent requirement. Master §§3/7/8 and DOC-1 §§6/7.4/13 and DOC-3 §5.2
own tenant/security/manual/compatibility constraints.

## Source-to-SQL findings

| Source | Requirement | Original M93 assessment |
|---|---|---|
| 02c §4.3 fair queue; AC8-6 | Locked stores cannot block other eligible stores; native overlap proof | Lazy INSERT/ON CONFLICT before SKIP LOCKED can wait on another claimant's insertion. Existing tests preseeded rows and missed it. |
| 02c §§4.3/8 | Exact query/request/version/claim fences, including replay | Finish's receipt read omits original capturedRequestId/requestGeneration and does not persist a complete fence digest. Altered-request replay reproduced by Terra. |
| 02c §4.3 outcomes | Kill/policy/auth/input/quota denial grants no retry | Finish schedules after provider disable; reproduced by Terra. |
| 02c §4.3 / D31 | Open breaker permits one durable next-claim cooldown recheck, then manual | No no-egress scheduling transition exists; finish calls it unknown. Observing breaker/pacing remains 8b, but its durable allowance is SQL-owned. |
| 02c §5.4 | Backoff respects a safe Retry-After | No input/persistence for the normalized header lower bound; SQL schedules solely from base/jitter. |
| 02c §4.3 / AC8-6 | Temporary capacity waits durably without new attempt/spend | A six-GET OL round starts with one remaining slot, then strands after search. Terra reproduced the failed edition grant and inability to resume safely. |
| 02c §§3.1/4.3/8 | A v2 claim requires run admission even before a run exists | Reclaiming an unknown legacy call through v2 could obtain a new call because the old trigger only inspected jobs already having a run. |
| 02c §§4.3/8 | Every new grant proves the original full request fence | Changed generation, candidate/session expiry or mutability were not rechecked from the admitted fence. |
| 02c §3.1 | Missing protection refuses new v2 egress, preserving legacy NULL-policy operation | Removing policy after begin skipped protection and allowed a new grant. |
| 02c §4.3 | A second truthful retryable failure completes manually and consumes the original reservation once | M92's claim-five exhaustion guards rejected completion on claim two. Generic fail left accounting/automatic effects incomplete. |
| 02c §§3.1/4.3 | Historical accepted versions validate lineage; they do not admit new runs | Begin admitted an accepted historical version although new registration later refused it. |

These findings invalidate the initial claim of package readiness despite prior
green tests. Each confirmed behavior was reproduced before its correction;
the dated verification below owns the current proof.

## Capacity design decision

The source required durable capacity admission but did not choose how to handle
a partially spent fan-out round. On 2026-11-01 the Owner chose **"Reserve whole
rounds (recommended)"**, now OD-2026-11-01-1. Option 1 is approved; option 2
is the declined alternative. This approves no operating numbers.

1. **Reserve the whole bounded round before starting (approved).** Reserve
   up to the installed protocol maximum (one single-call GET or six fan-out
   GETs) before lookup/attempt creation. All automatic and explicit new-worker
   work uses the same private store capacity accounting. Reservation is not a
   provider call or spend: each new physical grant consumes one reserved slot
   and increments gets_used; registration replay consumes neither again.
   Unused, ungranted slots release on completion/cancellation or fenced lease
   expiry. Already-granted calls are never refunded or assumed unsent. A full
   window without sufficient headroom durably queues work, without consuming
   a technical retry. A configured cap below the installed round maximum
   refuses configuration/manual fallback rather than queueing forever. This
   uses the private v2 admission relation in this same unapplied M93, not a
   shared pacing service or another migration.
2. **Persist and resume partially spent rounds.** Preserve the next fan-out
   stage/result across capacity waits, request uncertainty and lease changes.
   This requires a larger continuation/receipt contract beyond the existing
   per-claim stage sequence; simply starting stage 0 again is not acceptable.

No new quota, window, backoff or cooldown numbers are chosen. Actual global
pacing/breaker observation and header parsing remain 8b. The SQL scheduler must
persist the one allowance and validated not-before/cooldown decision so restart
does not reset it. Original 3-argument finish compatibility remains callable.

## Correction and review checkpoints

- Original SHA `0db0d7c9…af8ad9f`: the eleven findings above drove full-fence
  persistence, a v2 claim marker, owner-only legacy registration delegates with
  original function OIDs preserved, current policy checks, whole-round holds,
  a typed Retry-After floor and a durable known-unsent breaker transition.
  M93 narrowly forward-replaces the M92 terminal body for a proved no-retry
  technical outcome; actual failed receipts and claim counts stay truthful.
- Terra/max checkpoint `4affa57b…b61f26`: confirmed stale quota clocks after
  store-lock waits, conflicting provider policies on one store counter,
  capacity-blocked claim flooding, an OL stage-name dependency and a paused
  zero-obligation round that could not resume. Native/PGlite regressions drove
  post-lock scope checks, consistent active-route store fields, persisted
  `window_seconds`, store eligibility/wake, provider-neutral fan-out bounds,
  and neutral queued round-zero resume without consuming the retry allowance.
- **Retracted finding:** proposed backfill/trigger store-install race. The
  native QueueInstall test passed on the old artifact: FK DDL already holds
  `ShareRowExclusiveLock` on `public.stores` through commit. Terra explicitly
  retracted the finding. No SQL fix is attributed to it.
- Terra/max checkpoint `fb51409c…dd4e58`: regressions reproduced session expiry
  across a native lock wait, null automatic operation-version comparison,
  unassigned providers affecting capacity, empty-window false waits, grants
  waking a fully held store, and terminal success releasing without waking.
  Corrections use wall-clock session/lease/candidate checks, null-safe purpose,
  assigned active routes, safe empty-window adoption and common eligibility.
- Terra/max checkpoint `b51cd731…3ff1f51`: native terminal/store versus canonical
  lock cycle reproduced **40P01**. Wake now uses `FOR UPDATE SKIP LOCKED` and
  retains the existing durable due when another transaction owns the store;
  the automatic-only early store lock was removed. A BEFORE-terminal check
  rejects expired or mismatched service v2 claims, after any completion lock
  waits. Authenticated Owner operations and markerless legacy jobs retain
  their existing path. Uncontended release wakes the store; a busy-store wake
  is conservative and already-deferred individual jobs retain their due times.

Current corrected artifact: M93 SHA256
`f431df3d25052eab43b80ff5b213f7459e8dd3248228fc69358d34bc8a10c210`.
(Historical as of 2026-11-02: the whole-8a fixes changed M93 to 1,513 lines,
sha256 `80d496a173c9f6fe…`; see the whole-8a section above.)
The file is untracked/uncommitted, never applied, 1,499 lines.
The single migration remains one queue/protection responsibility, including
exact M91 registration delegates and the narrow M92 terminal forward override.
Its size is allowed by OD-2026-10-31-1; it is not split into extra migrations.
M89 is committed (`746e061`); M90/M91 were corrected in `1a834fb`; M92 was
added in `1a834fb`; `fbd74e1` restored verification checks. Latest applied
migration is still M88 (`20261029151325`); nothing was applied, pushed or
deployed in this work.

## 2026-11-01 — targeted 8a-5 review, correction, golden refresh and verification

This section is dated evidence for the facts recorded here; it follows the
Terra/max checkpoints above and supersedes their pending items where stated.

Fourteen targeted read-only reviews of M93 (seven units Q1..Q7; paid DeepSeek
5 runs, Muse 4, GLM free 5). Muse found nothing in four runs. Paid DeepSeek
and GLM produced nine distinct findings: Q3-1 begin wrote the v2 marker before
the NULL-policy return (Medium); Q3-2 queued zero-obligation round defer bound
to the old lease token (Medium); Q4-1 explicit round reserve ignored an unknown
call from an earlier claim (Medium); GLM Q4 finish run lookup did not bind the
stored fence (Medium); GLM Q1 legacy re-claim left a stale marker so legacy
terminal writes were rejected (Medium, needs-live-check); Q6-1 (found by two
reviewers) a scheduler-proved manual completion at attempt_count < max_attempts
was recorded as P9_METADATA_ATTEMPTS_EXHAUSTED (Low); Q2-1 decimal protection
numbers like 60.0 raised a cast error (Low); Q2-2 capacity-wait due time ignored
session/candidate expiry (Low); Q4-2 the 4-argument finish `p_not_before` has
only an isfinite check (Low, deliberately NOT changed: bounding it needs a
number the Owner has not set; it stays an Owner-gated question).

Paid DeepSeek (variant max for later rounds) confirmed and fixed eight of nine
(all reproduced before the fix), added regression tests, no assertion weakened.
A max-effort DeepSeek re-review rated seven fixes correct and found one
regression (R-1: the Q2-2 due-time fix included holds that
`phase9_reserved_store_slots_v1` does not count, pulling dueAt to now and
causing a hot loop); fixed with one shared helper
`marketplace_sec.phase9_reserved_store_holds_v1` used by the slot count, wake
and reserve due-time calculations.

Terra/max correction review of the changed hunks (read-only): F2..F8 fixed; F1
"not fixed" (a stale marker from an earlier v2 claim with no run blocked a
legacy re-claim's registration with P9_PROVIDER_RUN_NOT_ADMITTED on a
NULL-policy provider; and a configured-policy begin could write the marker
before capacity returned configuration_required); Low: the new helper was
absent from the function freeze; some tests were weaker than described. Fixed
by paid DeepSeek: the marker now counts only when its claim tuple
(claim_attempt_number, claim_worker, claim_lease_token_hash) equals the job's
CURRENT claim, at four sites (`phase9_assert_queue_grant_v1` legacy bypass,
`phase9_reserve_round_capacity_v1` marker write only after the
NULL-policy/mode/capacity/budget checks, `phase9_begin_automatic_provider_run_v1`
pre-capacity marker insert removed, `phase9_provider_run_grant_v1` hold_current);
the helper was added to the freeze selection and inventory, and regression
tests were added. A further max-effort DeepSeek re-review of the marker
semantics found no defect (S1..S4 correct).

Golden `provider-replacement-generic-8a5-sha256.json` was recomputed offline by
Haiku (method proven by reproducing the 98 unchanged hashes first) for the
changed M93 functions, the M93 file hash and the new helper (103 sql and 103
metadata entries); metadata for the helper was derived from its sibling and is
confirmed by the Synthetic integration test.

Verification actually run: PGlite after the golden refresh — guard + harness +
Synthetic, prefixes 8a-5 and 8a-4: 17 tests, 14 pass, 0 fail, 3 todo each. The
earlier full-suite PGlite counts (8a-5 278/0/28/19, 8a-4 273/0/33/19, 8a-3
239/8, 8a-2 235/8, 8a-1 219/17, m88 140/17) PREDATE the last marker change and
helper addition. Native Postgres (disposable cluster, port chosen by the
runner): `run-phase9-bookstore-first-postgres.ps1 -OnlyGroup provider-replacement
-ProviderPrefix 8a-5`: `NATIVE_GROUP provider-replacement PASS`, 317 tests, 286
pass, 0 fail, 12 skipped, 19 todo, 0 statement timeouts,
`POSTGRES_TEARDOWN_PASS`; ran and passed: round-capacity terminal-wake deadlock
check, advisory-lock wait past deadline (8a-2/8a-4), empty cleanup lock wait.
NOT proven: the five native fairness tests (AC8-6) were skipped because they
are GATED on OQ8-3 (operating numbers, not set); no explicit 40P01 assertion
appears in the log; the other 7 skips are gated policy items (OQ8-1, OQ8-2,
OQ8-3, OQ8-6, OQ8-7, OQ8-11). Fairness is therefore covered by PGlite and
review reading only, not natively.

Terra's earlier retracted finding (store-install race) and the inherited gap
stay as already written in this tracker (historical automatic job with NULL
operation_version can fail a nonlegacy OL v2 route; to be dispositioned in the
whole-8a review and the pre-apply drain/compatibility assessment). No M91 byte
change claimed.

Not authorised or done: no commit, push, deployment, shared-database
application, provider call, worker change. Remaining gates: whole-8a Terra
review; Haiku preflight (re-verify project ahntbtktjjmvfosgkmgn, read-only live
registry check, read-only checks for Open Library cache rows with the
`legacy-v1` normalizer and for stage pairs like (0, NULL), because new CHECKs
need live-row readback); ordered apply M89..M93 under the Owner's standing
permission (2026-10-31: "you have my permission to apply after the usual cycle
is complete"), each apply recorded in the migration ledger; then slice 8b
worker, 8c switch, 02d prefill. Owner items still open: contact email
(placeholder), OQ8-3 operating numbers (unset), Q4-2 retry-floor bound (needs a
Owner number), pre-launch checklist item to inventory and purge Google-sourced
data.

## 2026-11-02 — whole-8a review of M89..M93, fixes, preflight and final regression

This section records the whole-8a review and correction closeout and supersedes
the pending whole-8a and preflight gates above. Nothing was applied, committed,
pushed or deployed; M90 and M91 are untouched (committed, unapplied).

**Whole-8a read-only review of M89..M93 as one ordered apply ran:** Terra/max
(763 s), paid DeepSeek max angle A "APPLY-ORDER" (about 25 min), paid DeepSeek
max angle B "LEGACY-LIVE" (about 31 min), and a Muse inventory (319 s, clean:
every function sets `search_path`, new grants are service_role only, no
signature mismatches). Terra's verdict before the fixes below:
"ACCEPT M89..M93 for ordered apply: no".

**Findings and outcome:**

- **WHOLE-1:** a historical automatic job with NULL `operation_version` fails a
  non-legacy Open Library v2 route (M91:113/137/213/261). Latent until 8c
  activates OL v2. Needs a null-safe flag in a later slice plus a drain. Live
  count of such open jobs: 0.
- **WHOLE-2 / APPLY-ORDER-2:** the M90 replacement cache CHECK is possibly
  stricter than M84 for Google book URLs with whitespace or backslash.
  Reviewers disagreed. Live preflight found 0 offending rows; no edit.
- **APPLY-ORDER-1:** the M89 gate needs both registry rows kind `metadata` and
  adapter_version `1.0.0`. Live preflight: both pass (count 2).
- **APPLY-ORDER-3:** the M91 stage CHECK accepts half-null pairs (inherited
  from M78). Live: none — the 172 call rows are (NULL,NULL); left unchanged.
- **LEGACY-LIVE-1 and LEGACY-LIVE-2 (M93):** confirmed real and FIXED (below).
- **LEGACY-LIVE-3:** an existing public Google selected_snapshot cache row
  would raise on the old worker's cache read. Live count 0; add to the
  pre-launch Google data purge checklist item.

**Read-only live preflight (project `ahntbtktjjmvfosgkmgn`, latest migration
M88 `20261029151325`):** registry both `metadata`/`1.0.0`; 0 candidate or cache
rows failing live validators; 0 legacy-v1 rows; 0 stage-pair violations; 0 open
jobs with NULL `operation_version`; 0 non-finalized provider calls; 0 public
Google selected_snapshot rows; admission tables absent (expected); three stale
August reservations (two on dead_letter jobs, one vision reservation on a
cancelled job); one `metadata_enrich` candidate job `in_progress` with
attempt_count 5 and a lease that expired 2026-10-12 (operation_version
`p9-owner-edition-options-v1` — recorded as to-check before apply: its
max_attempts and whether it drains); no PUBLIC execute on any phase9 function;
anon execute is exactly the 12 known helpers; the live registry has no
`protection_policy` column (confirm which migration adds it before apply). No
database writes.

**M93 fixes and final state.** M93 is now 1,513 lines; full sha256
`80d496a173c9f6fe30f42d3714c0c787488ced2669024be18d2090c9bea34c5e`.
- **LEGACY-LIVE-1:** the legacy bypass in `phase9_assert_queue_grant_v1` and
  the run lookup in `phase9_provider_run_grant_v1` are scoped to the
  incoming/current claim tuple, so a run from an earlier claim no longer turns
  an 8a-4 re-claim into a v2 claim.
- **LEGACY-LIVE-2:** with `protection_policy` NOT NULL and no hold or running
  current-claim run, the grant trigger raises `P9_PROVIDER_RUN_NOT_ADMITTED`
  before capacity; NULL policy unchanged. A paid DeepSeek max changed-hunk
  review accepted both ("ACCEPT changed hunks: yes"). Two Low test-evidence
  notes remain open, not blockers: Capacity test 181-202 would not catch a
  reverted post-lock clock refresh; QueueReview test 143-152 passes for a
  different reason than its name.
- Tests added: Queue 252-284 (initially a test defect, fixed to register on the
  existing logical attempt; that file then ran 18 pass, 0 fail, 2 skipped),
  Capacity 58-81. Existing tests were aligned to the stricter contract: Queue
  285-299, Capacity 181-202 (native-only), QueueReview 143-146. Behaviour
  change: a policy-protected legacy caller that relied on unadmitted
  free-capacity calls now gets `P9_PROVIDER_RUN_NOT_ADMITTED`.

**Golden fixture.** `provider-replacement-generic-8a5-sha256.json` was
recomputed by Haiku after proving the 101 unchanged entries reproduce. Changed:
`phase9_assert_queue_grant_v1` (`83632e423e7f…` to `bc1826e21286…`),
`phase9_provider_run_grant_v1` (`7156ece4389d…` to `51bc2c7b5631…`), M93 file
hash (`f431df3d2505…` to `80d496a173c9…`). 103 of 103 match.

**Final regression (2026-11-02; M93 sha256 `80d496a173c9f6fe…`, 1,513 lines,
golden 103/103):** PGlite 8a-5 **283 pass, 0 fail**; PGlite 8a-4 **278 pass,
0 fail**; Capacity file PGlite **20 tests, 16 pass, 0 fail, 4 skipped**; native
Postgres 8a-5 (provider-replacement group): **319 tests, 288 pass, 0 fail,
12 skipped, 19 todo, teardown pass, NATIVE_GROUP provider-replacement PASS**.
The native-only Capacity test (round capacity, clock after the store lock) was
rewritten three times (routing, then a bind-parameter-count slip) and now
passes; it also now catches a reverted post-lock clock refresh (T1 addressed).
Native fairness AC8-6 not proven (gated on OQ8-3); no explicit 40P01 assertion.

**Unchanged / open:** M90 and M91 untouched (committed, unapplied). Nothing
applied, committed, pushed or deployed. Native fairness AC8-6 still not proven
(gated on OQ8-3). Owner items open: contact email placeholder, OQ8-3 operating
numbers, Q4-2 retry-floor bound, pre-launch checklist item to inventory and
purge Google-sourced data. Next authorized action: finish the regression run;
then, with the Owner's go-ahead to commit, ordered apply of M89..M93 under the
Owner's standing apply permission (see slice8-owner delegations in the
existing docs), recording each in the migration ledger; then 8b worker.

## Verification and remaining gates

Superseded where stated by the
[2026-11-02 whole-8a section](#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression):
the whole-8a review and its fixes, the live preflight and the final regression
are recorded there.

- PGlite after the golden refresh (guard + harness + Synthetic, prefixes 8a-5
  and 8a-4): **17 tests, 14 pass / 0 fail / 3 todo each**. Native Postgres
  provider-replacement prefix 8a-5: **317 tests, 286 pass / 0 fail / 12 skipped
  / 19 todo**, 0 statement timeouts, `POSTGRES_TEARDOWN_PASS`; round-capacity
  terminal-wake deadlock, advisory-lock wait past deadline and empty cleanup
  lock wait ran and passed. The five native fairness tests (AC8-6) were skipped
  as GATED on unset OQ8-3 operating numbers, so fairness rests on PGlite and
  review reading only. The earlier full-suite PGlite counts (8a-5 278/0/28/19,
  8a-4 273/0/33/19, 8a-3 239/8, 8a-2 235/8, 8a-1 219/17, m88 140/17) predate the
  last marker change and helper addition and are superseded for readiness by
  the dated evidence above.
- Offline provider harness/freeze guards: **11/11 pass**. Separate explicit
  `provider-replacement-generic-8a5-sha256.json` captures **103 sql and 103
  metadata entries** covering the changed M93 functions, the M93 file hash and
  the new `phase9_reserved_store_holds_v1` helper; M89–M92 remain
  byte-identical. Tests select the freeze by installed prefix
  and never refresh either artifact. Terra checked the changed-hunk coverage;
  final whole-8a correction review remains pending.
- **Inherited cross-package gap, not fixed here:** M91 derives a nullable
  explicit flag in structural lookup registration. A historical automatic job
  with NULL `operation_version` can still fail a nonlegacy OL v2 route. The
  M93 null-safe regression proves legacy Google admission only, not a full OL
  NULL-version path. Historical/live prevalence is unverified. Whole-8a review
  and pre-application drain/compatibility assessment must explicitly disposition
  this risk; no M91 byte change or end-to-end closure is claimed.
- Remaining gates: whole-8a Terra correction review of M89..M93; Haiku
  preflight (re-verify `ahntbtktjjmvfosgkmgn`, read-only live registry check,
  read-only checks for Open Library cache rows with the `legacy-v1` normalizer
  and for stage pairs like (0, NULL), because new CHECKs need live-row
  readback); ordered apply M89..M93 under the Owner's standing permission, each
  apply recorded in the migration ledger; then slice 8b worker, 8c switch, 02d
  prefill. Whole-8a acceptance, worker HTTP/pacing/header parsing, singleton
  rollout, operating numbers and ordered live application are separate gates.
  No shared mutation authority is granted. Final full native prefix and
  documentation validation completed in this checkpoint except the whole-8a
  review; no unrun test is claimed passed.

## 2026-11-02 — ordered apply of M89..M93, ledger note rows and post-apply verification

Ordered apply of M89..M93 to the dev project `ahntbtktjjmvfosgkmgn` under
the Owner's standing apply permission, after the review cycle (commit
`ebb613c`, M93 sha256
`80d496a173c9f6fe30f42d3714c0c787488ced2669024be18d2090c9bea34c5e`).

- M89 file `20261031000089_marketplace_phase9_provider_registry_policy.sql`
  (sha256 `fffe86d2...f746e59b`) applied through Supabase MCP
  `apply_migration`; live version `20261101224556`; stored text md5
  `d3b3f14524fd81916974f41d6fb719d3` equals the local file md5.
- M90 `20261031000090_marketplace_phase9_provider_validation.sql` (sha256
  `b9c3718d...6288e73`) applied via `apply_migration`; live version
  `20261101224911`; stored text equals the local file with the trailing
  newline removed (md5 `10573afe8c316332b3e89b753c008836`, 90,201 chars).
  Check after: 434 phase9 functions, 0 with PUBLIC execute.
- M91 `20261031000091_marketplace_phase9_provider_route_accounting.sql`
  (sha256 `dd498db9...3a44598`) applied via `apply_migration`; live version
  `20261101225107`; stored md5 `c522cd4714721cf29de6ff58c5291f11` equals the
  local file with the trailing newline removed. 439 phase9 functions,
  0 PUBLIC execute.
- M92 `20261031000092_marketplace_phase9_provider_automatic_transaction.sql`
  (136,148 bytes, 1,904 lines, sha256 `b256e00f...a56c230`) and M93
  `20261101000093_marketplace_phase9_provider_queue_protection.sql`
  (1,513 lines): applied by the Owner through the Supabase dashboard SQL
  editor (both returned "Success. No rows returned"; the dashboard warning
  about UPDATE/DELETE is a text-scan false alarm: all statements are inside
  function bodies with WHERE clauses). The inline `apply_migration` route
  could not be used for M92 (file too large to transcribe byte-exact; a
  safety classifier interrupted one attempt; nothing ran).
- Ledger note-only rows (gap closed, Owner-approved, inserted by Haiku):
  version `20261101230500` name
  `marketplace_phase9_provider_automatic_transaction` (M92) and version
  `20261101230501` name `marketplace_phase9_provider_queue_protection`
  (M93). Their `statements` hold a one-line note (applied through the
  dashboard, source file path and sha256), not the migration SQL;
  `created_by`, `idempotency_key`, `rollback` are NULL. The ledger now ends
  at `20261101230501` and lists M89..M93. Live versions of all five: M89
  `20261101224556`, M90 `20261101224911`, M91 `20261101225107`, M92
  `20261101230500`, M93 `20261101230501`. Do not describe the ledger gap as
  open; M92/M93 rows are note-only rows. Do not run `db push` (frozen).
- Read-only post-apply verification by Haiku (SELECTs only): 5
  `marketplace_sec` tables exist with RLS on and no
  anon/authenticated/service_role table privileges;
  `phase9_store_admission` rows 7 = `public.stores` 7, none missing;
  triggers `phase9_seed_store_admission_v1` (stores),
  `phase9_guard_terminal_admission_v1` and
  `phase9_release_closed_admission_v1` (`image_extraction_jobs`),
  `phase9_provider_run_grant_v1` (`phase9_metadata_provider_calls`) exist
  and are enabled; no PUBLIC/anon/authenticated execute on any M93
  function, service_role only on the public wrappers and the
  `marketplace_sec` entry points; all functions owner postgres with
  `search_path` set; both `phase9_finish_automatic_provider_run_v1`
  overloads present in public and `marketplace_sec`; anon execute exactly
  the 12 known helpers; PUBLIC execute 0; authenticated execute 84
  (baseline unchanged); live `phase9_provider_run_grant_v1` contains
  `P9_PROVIDER_RUN_NOT_ADMITTED`; registry `google_books` and
  `open_library` both enabled with `protection_policy` NULL (so M93
  `begin_automatic_provider_run` returns `configuration_required` for
  automatic runs until a policy is set, i.e. the legacy NULL-policy path is
  what the deployed worker uses); job
  `4ffe137d-5ff5-4ef6-9a24-27a2911c027c` still `in_progress` attempt 5/5,
  lease expired 2026-10-12 (to check/recover before 8b/8c). Several M93
  helper functions are SECURITY INVOKER (`prosecdef=false`) with no grants:
  observation only, not compared to the file's intent. A golden-hash
  comparison of the live definitions was not run.
- No push, deployment or data writes. Native fairness AC8-6 still unproven
  (OQ8-3). Next: 8b worker (adapter, validators, registry row), 8c switch
  (includes the WHOLE-1 null-safe flag plus drain), 02d prefill. Owner
  items open: contact email placeholder, OQ8-3 operating numbers, Q4-2
  retry-floor bound, pre-launch Google data purge checklist.
- Live smoke test PASSED (2026-11-02 ~23:34-23:36 UTC, dev project,
  store-owner Inventory > resume scan > Find or change edition for Bleak
  House > Search by ISBN 9780141439723): job
  `c01c8347-74c8-433f-b5ef-d5ae6dd442cb` (`operation_version`
  `p9-owner-edition-options-v1`) went open > in_progress (attempt 1, lease
  owner `phase9-metadata-render-0001`) > resolved; the free-plan Render
  worker `phase9-metadata-worker` woke on dispatch (`service_started`
  23:35:27Z, `invocation_accepted` 23:35:34Z) about 80 s after the job was
  created; 3 provider calls finalized, `claim_attempt_number` 1, stages
  search (seq 0), edition (1), author:OL24638A (2); 1 usage reservation;
  `marketplace_sec.phase9_metadata_admissions` and
  `phase9_automatic_provider_runs` stayed at 0 rows (legacy NULL-policy
  path); no `P9_` error; UI showed one selectable edition (Bleak House,
  Penguin Books, 2003, Open Library). "Select edition" was not clicked; no
  inventory data changed. The deployed worker is Render commit `3fdc0c44` on
  main (slice 7b-2 build, deployed 2026-10-29), not a slice 8 build. NOT
  covered: the fair queue/admission path (needs a protection policy, 8c)
  and an automatic Google lookup on the legacy path. This closes the "smoke
  test before 8c" item for the legacy explicit path; re-run once with the
  8b worker deployed and before 8c.
- Dev-server launch config `.claude/launch.json` (expo web on port 8081)
  was created for this test and is uncommitted.

## Read-only operational evidence

Supabase re-verified `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, latest M88
`20261029151325`, both old provider flags/versions unchanged and M93 tables absent.
Owner selected Render workspace `tea-d9j67irtqb8s739ritc0` for read-only access.
Metadata service `srv-d9sqfdvqj5pc73dc66fg` has one configured instance,
auto-deploy off, live deployment `dep-dbhmr07b9u1s73f8qjpg`, artifact
`3fdc0c44c72f5c182b3e3b22395ca652ca372783`. Connector readback exposes no pacing
environment values; those are not claimed verified. One configured instance
does not prove runtime singleton/GET-rate enforcement or an 8b rollout.
