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
   Done 2026-11-05 (Owner: "set the variable here"): set on
   `phase9-metadata-worker` through the dashboard with "Save only" (no
   deploy; latest deploy still `dep-dblielugekts738gov3g`). The value maps
   `bookconnect-dev` to the Owner-confirmed address, kept on Render only.
   The new worker reads it on its next deploy.
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

## 2026-11-07: 8c fix round (M99, worker admission + RPC logging, app)

### Context and Owner approval

The 8c live dev re-test (after M97/M98) found defects D1-D6. The Owner
approved a bounded three-unit fix round (commits below, all local; nothing
pushed, applied, or deployed):

- D1: the metadata worker did not reserve the M93 explicit round before
  registering explicit provider calls (live symptom:
  `P9_PROVIDER_RUN_NOT_ADMITTED`, job dead-lettered).
- D2: owner edition-choices read took locks (made lock-free).
- D3: dashboard inventory counts read `store_inventory` directly in the app
  (row-limited, wrong for large stores).
- D4: terminal failures left usage reservations `reserved` (terminal
  settlement added).
- D5: exhaustion label: `P9_METADATA_ATTEMPTS_EXHAUSTED` only when
  `attempt_count>=max_attempts`, else `P9_METADATA_TECHNICAL_FAILURE`.
- D6: the worker swallowed RPC errors without a safe log line (sanitized
  `metadata_rpc_failed` logging added).

### Unit 1 - migration M99 (D2, D3, D4, D5)

- File: `supabase/migrations/20261106000099_marketplace_phase9_8c_fix_round.sql`.
- Commit `56b676b`, then AMENDED in commit `0b00441` per Owner decision
  2026-11-07: the dashboard count RPC is store-scoped.
- Current file (commit `0b00441`): 538 lines, sha256
  `9a10dc3ae760b256757b5f57bdc2ab2688b7d748ca52bcda5d0e5eff4af9e80c`.
  The earlier `56b676b` sha256
  `bd43dc9d16ca3a7c74ca8f91d9eb46c1b819da46779982103135c9da4bc5a4fa`
  is superseded.
- NOT APPLIED to dev (`ahntbtktjjmvfosgkmgn`).
- Contents:
  - `marketplace_sec.phase9_settle_terminal_usage_v1` (terminal usage
    settlement: proven-unsent stays `released` 0; complete known cost is
    consumed; unknown cost stays reserved for reconciliation).
  - Lock-free `public.phase9_owner_candidate_edition_choices_v1`.
  - `public.phase9_owner_dashboard_inventory_counts_v1(p_store_id uuid)`
    (NULL store id fails first with `P9_REQUEST_INVALID`;
    ownership/eligibility via `marketplace_sec.phase9_owner_store`;
    returns total, published, draft, paused, lowStock, outOfStock;
    authenticated only).
  - D5 code in `phase9_fail_metadata_job_automatic` and
    `phase9_fail_candidate_edition_options_v1`.
  - Vision fail/mark changes (settlement only in the terminal branch;
    identical replay is a no-op).
- Tests: `supabase/tests/phase9/phase9FixRound8c.integration.test.mjs`
  (+ `fixRound8cFixture.mjs`, `fixRound8cMutations.mjs`): PGlite 125 tests
  (124 pass, 1 native-only skip); native group `8c-1b` 125/125 PASS; every
  named mutation fails its intended test (including the new
  dashboard-null-fallback and dashboard-first-store mutations); baseline
  with M99 skipped had 59 behavioural reds; migration-set and continuity
  validators PASS.
- Reviews: Luna (no blocker/major; 1 minor fixed). Qwen3.8 Flash
  (Unit 3 amendment): clean.

### Unit 2 - metadata worker (D1, D6), commit `c64c2fb`

- Both edition-options executors reserve the M93 explicit round
  (`phase9_reserve_metadata_provider_round_v1`) before any lookup, usage,
  attempt, provider-call, or provider-call lineage, for primary and
  secondary providers; release (`phase9_release_metadata_provider_round_v1`)
  before every lease-clearing transition.
- `capacity_wait`, `recovery_only`, `uncertain`, `configuration_required`
  and `drain_required` are no-egress outcomes. Legacy bypass only with a
  single NULL-policy registry row. Strict 1|6 slot receipts. One replay on
  lost transport only.
- D6: a per-claim observed RPC client logs `metadata_rpc_failed` (rpc,
  sqlstate, exact safe-code allowlist, jobId, attempt, stage, durationMs,
  uncertainty, submissionKind); never params, raw messages, tokens, or
  contacts.
- `metadataEditionOptions.ts` was split into
  `metadataDescriptorEditionOptions.ts`, `metadataExplicitDenials.ts`,
  `metadataExplicitTransport.ts`, `metadataExplicitLifecycle.ts`, and
  `metadataExplicitRound.ts`
  (`supabase/functions/_shared/imageInventory/runtime/`), plus
  `workers/phase9-runtime/metadataRpcLogging.ts`.
- Built by Sol (partial) then paid DeepSeek v4.1 flash (completion plan
  95%; 12 defects in the partial code fixed). Briefs were reviewed by
  Sonnet in place of Sol (Codex limit).
- Evidence: red-first on a HEAD build; the compiled worker against real
  M93..M99 SQL recorded `P9_PROVIDER_RUN_NOT_ADMITTED`, 0 admissions, job
  dead-letter. Green: new suite
  `supabase/tests/phase9/phase9ProviderExplicitWorkerRound8c.integration.test.mjs`
  14/14; native provider-replacement group PASS (336 TAP tests, 305 pass,
  0 fail); full phase9 Jest 3321 pass, only the 3 pre-existing CRLF
  migration byte checks fail (marketplacePhase9CacheReuse M83/M84 bytes;
  marketplacePhase9EditionChoiceFirstSave x2); worker and root tsc clean.
- Review: Qwen3.8 Flash (Codex/Luna out of usage until 2026-11-09 22:06
  IST) found 2 Minors, fixed in fix round 1 (configuration_required
  failure written once; three suites now assert the test fake's
  unknown-binding count is 0).
- Residual: about 20 older test suites use the admission fake without
  asserting `unknownBindingCount()===0` (list in
  `.claude/w2-review-qwen.md` Q7b); test-hardening follow-up, no production
  impact.
- Deployment: requires the single metadata worker Render deploy
  (`srv-d9sqfdvqj5pc73dc66fg`) AFTER the M99 apply; no vision worker deploy
  needed.

### Unit 3 - app, commit `0b00441`

- `src/features/stores/services/storeDashboardService.ts` reads counts via
  RPC `phase9_owner_dashboard_inventory_counts_v1` with `p_store_id` and a
  strict six-integer parser; no `store_inventory` read, no fallback.
- `StoreDashboardScreen` shows "Dashboard details are unavailable." plus
  Retry on error.
- `CandidateEditionPicker`: "Alternatives are missing or expired. Your
  current choice is kept." only when `choices.selection != null`,
  otherwise "Alternatives are missing or expired. Search Books to find
  editions."
- "This book changed" trace: on Search Books, `P9_STATE_CONFLICT` (raised
  for a stale/expired session, a non-editable candidate, an in-flight
  replay, review blockers) now shows the registered "The item state
  changed. Refresh and try again."; `P9_VERSION_CONFLICT`,
  `P9_CANDIDATE_VERSION_CONFLICT`, and
  `OWNER_CANDIDATE_AUTHORITY_CHANGED` keep "This book changed...".
  Residuals unchanged: authority-changed lookup copy, selection-path
  `P9_STATE_CONFLICT` copy, Add-path copy.
- Tests: stores 118 -> 132 pass, imageInventory 1076 -> 1080 pass, tsc
  clean. Review Qwen3.8 Flash: clean.
- Rollout order: apply M99 before this app code is used (it fails closed
  with the error card otherwise).

### Other state recorded 2026-11-07

- Unreviewed work from another Claude session ("App state machines
  documentation") was parked on local branch `wip/state-machines-audit`
  (commit `bc5a829`, parent `56b676b`): migrations
  `20261107000100_exchange_state_machine_integrity.sql` and
  `20261107000101_phase6_delivery_claim_crash_recovery.sql`, Edge Function
  changes, tests, `docs/STATE-MACHINES.md`. Unreviewed, not applied, not
  part of Phase 9; the Owner decides.
- Owner to-dos: Gemini billing (prepay, restore the key); rotate a
  free-tier Gemini key that was exposed in chat (never record the key);
  decide the 02d parking question; decide `wip/state-machines-audit`.
- Live dev state is unchanged by this round: the deployed metadata worker
  still runs the 8b build; M95-M98 applied; external admission gate open
  (epoch 6); stuck reserved usage holds from the earlier failures need a
  reviewed one-time cleanup after the M99 apply.

### Rollout order (each step needs its own Owner approval)

1. Apply the amended M99 to dev.
2. Push.
3. Single metadata worker Render deploy.
4. Dev re-test (explicit Search Books, drain checks 02/05).
5. Reviewed one-time cleanup of stuck reserved holds.

### 2026-11-08: M99 applied to dev

Owner approved ("Apply M99"). Project re-verified (`ahntbtktjjmvfosgkmgn`;
last live migration before apply `20261105161642` M98; no M99 function
present). Applied through Supabase MCP `apply_migration` as
`marketplace_phase9_8c_fix_round`, live version `20261107192440`. Readback:
stored statement md5 `e88843173596c4a28ca3840688ef4f9c`, 34,225 chars, equal
to the local file (sha256 `9a10dc3a...f4af9e80c`) without its trailing
newline. `public.phase9_owner_dashboard_inventory_counts_v1(p_store_id uuid)`
exists with no no-arg overload, EXECUTE for `authenticated` only;
`marketplace_sec.phase9_settle_terminal_usage_v1` has no grants; the two
metadata fail functions call settlement and carry the D5 label; the vision
fail function calls settlement; the vision mark function has the replay
no-op; the Owner choices read takes no lock; 0 phase9 functions executable
by PUBLIC. Live data: 6 usage reservations are still `reserved` on terminal
jobs (all 6 reserved rows) - these are the stuck holds for the reviewed
one-time cleanup; M99 settles only future terminal transitions. Worker not
redeployed; nothing pushed.

### 2026-11-08: pushed and metadata worker deployed

Owner approved ("Push and deploy"). Pushed the branch (`1b4cdfa..01ad338`)
and merged it into `main` without a checkout as `b1911a0`
(`5323e32..b1911a0`); that merge brought in the Store View v2 lane's commits
already on `main`. First Render deploy `dep-dboag1rrjlhs73as85e0` (commit
`b1911a0`) **failed at build**: Store View Slice 1b (`b2f599b`) added
`supabase/functions/_shared/imageInventory/contracts/__tests__/storeViewSummary.test.ts`,
and both worker tsconfigs include `contracts/**/*.ts`, so `tsc` compiled a
Jest file without Jest types (TS2304/TS2593). The 8b deploy stayed live.
Deviation: the merged tree was not built locally before that deploy; the
build-before-deploy check is now mandatory for this lane.

Fix (Owner: "Yes, fix both"): commits `2a1d970` (metadata worker) and
`56e6eb5` (vision worker) add an `exclude` for `imageInventory/**/__tests__/**`
and `**/*.test.ts`. Red: `origin/main` tree with the original tsconfig fails
with the same TS2304 errors. Green: the exact merge tree (`c146cdc5`) built
with `tsc` for both workers exit 0; branch builds
`build:phase9:metadata-worker` and `build:phase9:vision-worker` exit 0.
Merge `2584f98` pushed to `main` (`b1911a0..2584f98`); branch pushed
(`01ad338..56e6eb5`).

Deploy `dep-dbob845g1s2s73en12fg` (commit `2584f98`) **live** 2026-11-08
17:41:31 UTC; runtime log shows `service_started`, no errors (two
`invocation_denied` 404 `invalid_route` lines are root-path probes). Render
env unchanged. Rollback target: `dep-dblielugekts738gov3g` (`6e0df90`, 8b).
No vision worker deploy. No database, Storage or data change in this step.

Store View cross-check (read-only): the three Store View migrations on
`main` (live `20261102140933`, `20261103140304`, `20261103150536`) redefine
no function touched by M93-M99, and M93-M99 redefine none of the helpers
they call. Live migration `20261108143327` `store_view_slice2_page_v3`
(adds `public.phase9_store_view_page_v3` only) is applied to dev but is not
in any git ref yet; it belongs to the Store View lane and must be committed
from that tree.
