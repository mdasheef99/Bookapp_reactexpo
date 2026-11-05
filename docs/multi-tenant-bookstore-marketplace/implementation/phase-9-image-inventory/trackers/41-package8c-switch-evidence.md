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

## 2026-11-05: 8c follow-up after the flow-stage review (M97, M98, worker contact)

### Why

A review of slice 8 by flow stage (DeepSeek T1, Muse T2, Luna whole-8c)
found pilot-blocking defects, each verified against code. The Owner
approved fixing them ("ok pleae go ahead ... fix please", "Yes, add M98";
"use sol if you find anything complicated"; "dont make anything
complicated, just make bounded correct").

- A worker that crashes after begin but before any provider call left a job
  whose admission still held slots. The M96 sweep skipped it forever and it
  blocked the drain.
- A scanned card with no lookup whose job was dead-lettered stayed
  `pending` in the read model, so the picker never offered a search.
- During a pause (or smoke mode, for jobs outside the cohort), automatic
  requests were lost. The worker claims with the legacy
  `claim_phase9_metadata_jobs` (M15, no gate filter); on
  `P9_EXTERNAL_ADMISSION_PAUSED` it returned manual with no write, so each
  reclaim burned an attempt until the sweep dead-lettered the job. M93's
  `phase9_defer_metadata_admission_v1` had no caller, the worker cannot read
  the gate epoch (M91 closes it to service_role), and switching to the v2
  claim would break NULL-policy lookups (v2 creates admission markers).
- An unbounded `Retry-After` parked a job far in the future
  (`due:=greatest(due,p_not_before)`), with the card stuck pending.
- The protection policy's `contactId` was validated but never sent; both
  egress sites used the literal `BookConnect edition lookup`.

### Commits (local, not pushed, nothing applied or deployed)

- `65167b4` Unit A, M97
  `20261105000097_marketplace_phase9_8c_sweep_recovery.sql`.
  - The sweep now treats only admissions with `slots_remaining>0` as
    blocking, except the zero-call crash shape: in_progress, lease expired
    or absent, a queued/running run matching the admission's claim tuple,
    no provider calls for the job and no reserved reservation.
  - Each candidate closes in its own savepoint
    (`P9_SWEEP_CANDIDATE_SKIPPED`, SQLSTATE `P9S01`), so one changed row
    cannot abort the batch. The block detaches the stale lease, finalizes
    the crash run (`retry_allowed=false`, receipt digest), zeroes slots,
    wakes the store and dead-letters with the M75 fields.
  - `phase9_owner_ux_metadata_state` gains one `ambiguous` branch for a
    scanned card with no lookup whose metadata job is dead-lettered.
  - Picker recovery Jest test for that state. The M96 test S5 is
    deliberately superseded (it now expects the crash shape to close).
- `dacffae` Unit C, M98
  `20261105000098_marketplace_phase9_8c_pause_defer_and_retry_bound.sql`
  plus a worker change and an edit to scripts 02/03/05/06. Built by Sol
  from DeepSeek's plan plus Sol's plan check (four corrections).
  - New `marketplace_sec.phase9_defer_paused_metadata_admission_v1(jsonb)`
    (SECURITY DEFINER) and a `public` SECURITY INVOKER wrapper, EXECUTE
    service_role only. It reads the gate without a lock and raises
    `P9_STATE_CONFLICT` if the gate is open or missing; otherwise it
    delegates to the unchanged M93 defer, which locks the job, then the
    gate, and rechecks. A gate move in between gives a conflict, never a
    deferral under an open gate.
  - `claim_phase9_metadata_jobs`: M15 body plus one predicate that skips a
    job whose `phase9_job_admission_wait.blocked_epoch` equals the current
    gate epoch (the v2 rule, M93:328-353). After resume (05) bumps the
    epoch, the job is claimable again. Owner, ACL and search_path kept.
  - Four-argument `phase9_finish_automatic_provider_run_v1`: M93 body plus
    one bound. If `p_not_before` is later than now + `backoffMaxMs`, no
    retry is scheduled (the run finalizes with `retry_allowed=false`; the
    worker then completes the job through its normal path, and the card
    shows `temporarily_unavailable`, not `pending`). The floor is never
    capped and nothing retries before `Retry-After`. A replay returns the
    persisted state. The three-argument overload is unchanged.
  - Worker (`metadataAutomaticExecution.ts`): on a known
    `P9_EXTERNAL_ADMISSION_PAUSED` (SQLSTATE P0001 only) it always calls the
    defer RPC and lets SQL decide. `deferred` returns `retry_scheduled`
    with no write; `drain_required` takes the existing
    `terminal('policy_denied')` fallback; a conflict, uncertain error or
    malformed receipt returns manual with no write.
  - Scripts 02/03/05/06 (byte-identical edit): a job proven deferred in the
    current pause no longer blocks. It must be `retry_scheduled` with a
    NULL lease, a current-epoch wait row, no lookup, reservation, call or
    positive admission slots, and only a neutral queued run whose identity
    matches the persisted admission fence. Every other obligation still
    blocks.
- `4b29935` Unit B, worker contact (no migration). Built by Muse; one fix
  round.
  - Optional worker env `PHASE9_PROVIDER_CONTACTS`: a JSON map
    `{contactId: contact}`, validated at startup in every provider mode.
    Only own keys count (a null-prototype map; a `__proto__` key is
    rejected). The raw value must be printable ASCII (0x20-0x7E) before
    trimming and 1-200 characters after; an empty value is rejected. If the
    variable is absent, the map is `{}`.
  - Both egress sites send `BookConnect edition lookup (<contact>)` when the
    protection policy is non-NULL. With a NULL policy the literal is
    byte-identical to before.
  - Per-claim check right after the configuration read: if any non-NULL
    policy's `contactId` is unmapped, the claim takes the existing
    route-manual handling (no egress, admission, begin or lookup), never
    `stale_claim`. The check covers every provider row with a policy, not
    only the routed one.
  - The resolved contact travels as a transient field; it is never in the
    policy objects, logs, RPC data or results.

### Reviews and fix rounds

- M97: Sol reviewed the brief. Fix round 1 made test T16 able to detect a
  run update escaping the savepoint (mutation proven). Luna: no code
  defects.
- M98: Sol's plan check returned FIX FIRST. Accepted: no gate lock in the
  wrapper (lock order); a defer conflict returns manual instead of
  `stale_claim` (`failAutomaticClaim` would terminalize a live job); the
  script exemption was too wide; test gaps. Luna's build review: COMMIT, no
  implementation defects, one Low test gap (residual risks).
- Unit B: Luna returned FIX FIRST with five findings. All five fixed in
  fix round 1: inherited-key lookup; CR/LF hidden by trimming; privacy and
  wiring tests through the real worker; fixture mode skipping validation.
  Checked with a Haiku rerun and my diff read.

### Verification actually run

- M97: PGlite new suite 17 pass / 1 native-only skip; S5 file 18/1;
  NullSafe 19/19; OperatorSwitch 20/20; native group `8c-1b` 57/57; picker
  Jest suites 367 pass; guard 6/6.
- M98 (Sol): new SQL suite 73 pass / 1 skip; combined 8c SQL 128 pass /
  3 native-only skips; worker Jest 32/32; full metadata Jest 551 pass;
  worker build clean. Five mutations each turned a named test red.
- M98 (Haiku, outside the sandbox): native group `8c-1b` 131/131, including
  the two-session gate race (a conflict, no deadlock); PGlite five 8c
  files: 147 pass, 0 fail, 3 native-only skips.
- Unit B after fix round 1 (Haiku): full metadata Jest 38 suites, 570 pass,
  3 todo, 0 fail; pause-defer and bootstrap suites 12/12; worker build
  exit 0. The Unit B diff and new tests contain no real email address.
  Muse's mutation checks: 4 + 4, all red as intended.

### Database and deployment

- 2026-11-05 (Owner: "Push the four commits, apply M97 then M98 to dev"):
  pushed `main` and the branch from `85953a9` to `9faee42`. Render did not
  auto-deploy; the live worker is still `dep-dblielugekts738gov3g` (8b,
  `6e0df90`).
- Applied M97 (live `20261105161532`) then M98 (live `20261105161642`) to
  `ahntbtktjjmvfosgkmgn` via `apply_migration` after verifying the project
  and that the ledger ended at M96. Stored statements equal the committed
  files without their trailing newline (M97 `454ad659...8a787360`, M98
  `8ee0adc1...dbf7aefc`). A first M98 hash check failed because the working
  copy had CRLF on 29 lines copied from M15; the committed blob is LF
  (`.gitattributes`), so live equals the repo. Function owners, security
  mode, `search_path` and EXECUTE grants read back as designed.
- Safe with the old worker: the 8b worker never calls the defer RPC, the
  claim filter only matches jobs with a current-epoch wait row (none exist),
  and the Retry-After bound only applies with a non-NULL protection policy
  (both registry rows are still NULL).

### Remaining before the switch (after this follow-up)

1. Done 2026-11-05: pushed and applied (above). Still needs Owner
   approval: deploy the updated worker.
2. Before the switch, set `PHASE9_PROVIDER_CONTACTS` on the Render worker,
   in the form `{"bookconnect-dev":"<contact>"}`. Every `contactId` used by
   a non-NULL protection policy must be mapped, or every claim falls back
   to manual. The real address is confirmed with the Owner at switch time
   and is never written to a repo file or script.
3. Deploy the updated worker before the switch (runbook 02c-1). Pause and
   drain before tuning protection values. Confirm the Render worker runs as
   a single instance.

### Residual risks

- Pause coverage boundary (recorded, not fixed): NULL-policy automatic
  requests that already created lookup, reservation or attempt history get
  `drain_required` and end through the existing terminal fallback. Explicit
  edition-options requests during a pause still end as
  `provider_unavailable`. Not every paused request is queued.
- A defer conflict (the gate reopened mid-defer) keeps the lease and
  consumes the current attempt; at max attempts the sweep may close the
  job.
- M98 test gap (Luna, Low): the scripts' fence-identity checks (candidate
  version, captured request, generation) are not each covered by a
  one-field mismatch test; only the query identity is. The checks are
  present in all four scripts.
- The worker's per-claim contact check covers all provider rows with a
  policy, so an unmapped `contactId` on any provider sends every claim to
  manual (fails closed).
- The per-store fair queue is unused, because the worker keeps the legacy
  claim (accepted). Editing the policy while a job is mid-flight can break
  holds: pause and drain before tuning. `backoffMaxMs` is now used only as
  the Retry-After bound and the jitter cap.
- The deployed worker reads `phase9_provider_configuration_v1` on every
  claim (`index.ts` ~:319-329), so a policy change needs no restart. This
  answers the earlier open question.

### Residual risks (8c-1a / 8c-1b)

- Jobs that hold unknown spend (reserved reservation, unknown run or call)
  are never closed by the sweep; they block the drain until reconciled by an
  operator.
- Answered 2026-11-05: the worker reads the policy per claim (see the
  follow-up section), so no restart is needed.
- Native `8c-1b` group is intermittently red: `57014` statement timeouts in the shared `providerReplacementFixture.mjs` clean hook (TRUNCATE CASCADE). Fix round 1 removed one cause; another remains. Test infrastructure only; M96 assertions pass whenever the hook does.
- The 24 pre-existing failing tests (8a provider-gate group) are unchanged
  and untriaged.
