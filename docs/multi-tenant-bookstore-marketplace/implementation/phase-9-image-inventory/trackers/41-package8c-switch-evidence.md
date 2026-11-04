# Package 8c: null-safe routing, exhausted-job sweep and switch scripts

Owner: Phase 9 slice 8. Branch `phase9/slice8-providers`. Status and next
action live in [ACTIVE.md](../../ACTIVE.md); this file holds dated evidence.

## 2026-11-05: 8c-1a (M95) and 8c-1b (M96 + operator scripts) built locally

### Owner decisions (2026-11-04 / 2026-11-05)

- Unit 1 builder DeepSeek, Unit 2 builder Sol; Luna reviews (Muse added as a
  second reviewer for Unit 2).
- The sweep INCLUDES exhausted explicit edition-options jobs; they close with
  fields identical to the M75 exhausted close and start no new request.
- Open Library automatic rate: one instance (`single_instance`), 1 GET/s
  (`minIntervalMs` 1000), `halfOpenMax` 1, policy version `p9-protection-v1`.
- The remaining protection values were delegated to the orchestrator for a
  15-store pilot (conservative; changeable later by one approved registry
  update): `storeWindowSeconds` 3600, `storeMaxGets` 600,
  `backoffBaseMs` 2000, `backoffMaxMs` 300000, `breakerFailures` 5,
  `breakerWindowSeconds` 60, `breakerCooldownMs` 120000, `contactId`
  `bookconnect-dev`. Estimate: about 3,000 GETs/day for 15 stores (100
  books/store/day, about 2 GETs/book) against 86,400/day capacity. All
  values pass the M89 validator (`...000089...:119-126`).
- Contact email: the Owner's personal email for the pilot, replaced by a
  dedicated project address after the pilot. The exact address is confirmed
  with the Owner at switch time.
- Switch timing: the Open Library switch happens later, at the pilot.

### Commits (local, not pushed)

- `26c73bf` 8c-1a: M95
  `20261104000095_marketplace_phase9_8c_null_safe_and_pending_state.sql`.
  `coalesce(operation_version='p9-owner-edition-options-v1',false)` in six
  functions (structural lookup, structural attempt, metadata attempt,
  reserve metadata usage, and the M93 pre-queue metadata and edition-options
  physical-call functions), so a NULL `operation_version` is automatic.
  `phase9_owner_ux_metadata_state` gains one branch returning `ambiguous`
  for the stuck "Finding edition…" shape (candidate `ac712fe6`, Bleak
  House); a newer in-flight lookup keeps it `pending` (test B9,
  mutation-checked). Tests: `phase9NullSafeAndPendingState8c` (19).
- `2ce9615` 8c-1b: M96
  `20261104000096_marketplace_phase9_8c_final_attempt_sweep.sql` plus
  `scripts/8c/01..06`.
  - `marketplace_sec.phase9_sweep_exhausted_metadata_jobs_v1(integer)`
    (SECURITY DEFINER) and its `public` SECURITY INVOKER wrapper;
    EXECUTE service_role only; batch 1-100 (default 50), else
    `P9_REQUEST_INVALID`.
  - Closes `metadata_enrich` jobs in open/in_progress/retry_scheduled with
    `attempt_count>=max_attempts` (expired or absent lease when
    in_progress) using the exact M75:110-113 terminal fields. It skips any
    job holding a reserved reservation, a queued/running/unknown M93 run,
    admission slots, a matching in-progress admission, a
    registered/outcome_unknown call, or a fan-out call with NULL egress.
    No settlement or accounting. `FOR UPDATE OF j SKIP LOCKED` with every
    predicate repeated in the UPDATE.
  - `marketplace_sec.dispatch_phase9_worker_wakes()` (from M69:295-306)
    runs the sweep first in an isolated block that raises a WARNING on
    failure; the rest of the body and its JSON are unchanged.
  - Scripts (not migrations, never run against a live project): 01 pause,
    02 capture/drain check, 03 switch while paused (full before-manifest
    SHA-256 check), 04 smoke mode (cohort of up to 20), 05 resume,
    06 rollback to the OD-3 floor (Open Library automatic off, Google stays
    disabled, gate paused). Each is one transaction and raises
    `P9_8C_PLACEHOLDER_REQUIRED` while a placeholder remains, and
    `P9_8C_DRAIN_BLOCKED` with IDs when not clean. The drain check also
    captures old-epoch grant calls and unsent `stale_rejected` calls
    (runbook 02c-1 §2 steps 3/5).

### Review and fix rounds (8c-1b)

- Plan: Sol plan `.claude/8c1b-plan.md` (96 %), approved.
- Fix round 1 (Sol): the test footprint helper ran seven queries at once on
  one client, which caused intermittent native `57014` clean-hook timeouts;
  made sequential, regression test S12 added.
- Reviews: Luna (gpt-6-luna, max) and Muse 1.3 both returned CHANGES.
  Accepted: drain roots missing old-epoch/unsent calls, missing
  before-manifest hash, S3 full-footprint check, sweep warning, guard
  mutant run, citation and comment fixes. Rejected: `WHEN OTHERS` not
  catching `57014` (a cancelled statement must cancel dispatch; same as
  M69), and the "native not run" finding (already run, below).
- Fix round 2 (Sol, last round): all accepted items changed. The
  guard-removal mutant made O4/O5/O6/O11/O16 fail as intended.

### Verification actually run

- 8c-1a: new suite 19/19 (PGlite); build-time results in the build report
  (`.claude/8c1a-build-report.md`, local only).
- 8c-1b after fix round 1: native group `8c-1b` 37/37 twice (Haiku, no
  `57014`); dispatcher, edition-picker-commit and 7b publication-retry
  suites 71/71 (PGlite).
- 8c-1b after fix round 2: PGlite 38 pass / 1 native-only skip; mutant run
  5 expected failures; native group `8c-1b` 39/39 (Haiku).
- Full `test:phase9:db` after both commits: 1956 tests, 1759 pass, 25 fail, 153 skipped, 19 todo (Haiku, about 49 min). 24 failures are pre-existing (18 in the 8a provider-gate group, 6 others, all listed in the 8c-1a build report). The 25th, `phase9ProviderHarness.guard` "native provider group is selectable", was a regression from `2ce9615`: the runner line it pins was rewritten to add the `8c-1b` group. Fixed by restoring that line and adding a separate `8c-1b` line (docs commit); guard test and native group rerun: guard 6/6; native `8c-1b` 35/39, the 4 failures all `57014` statement timeouts in the shared `providerReplacementFixture.mjs:62` clean hook (S3 retry_scheduled, S4, S5, S7), not assertions. Earlier runs of the same code were 39/39 and 37/37 twice; the intermittent clean-hook timeout is open (residual risks).

### Database and data changes

- M95 and M96 applied 2026-11-05 (see "Remaining before the switch").
- Dev data (Owner: "quash them"): the three stale August `reserved`
  usage reservations `f20a5804`, `b03047ff`, `d43d737e` were set to
  `released` with `actual_cost_units` 0 on `ahntbtktjjmvfosgkmgn`.

### Remaining before the switch

1. Done 2026-11-05 (Owner: "Yes, push and apply"): pushed `main` and the
   branch to `e36e6e9`; applied M95 (live `20261104213313`) then M96 (live
   `20261104213343`); stored statement sha256 equals each file; function
   owner, `search_path` and EXECUTE grants read back as designed.
2. At pilot time: fill the script placeholders (the values above, the
   contact email, the reviewed manifest hash, the smoke cohort) and run the
   scripts in order 01-05; 06 is the rollback.

### Residual risks

- Jobs that hold unknown spend (reserved reservation, unknown run or call)
  are never closed by the sweep; they block the drain until reconciled by an
  operator.
- Whether the deployed worker picks up a changed `protection_policy` without
  a restart is unverified; check before tuning values during the pilot.
- Native `8c-1b` group is intermittently red: `57014` statement timeouts in the shared `providerReplacementFixture.mjs` clean hook (TRUNCATE CASCADE). Fix round 1 removed one cause; another remains. Test infrastructure only; M96 assertions pass whenever the hook does.
- The 24 pre-existing failing tests (8a provider-gate group) are unchanged
  and untriaged.
