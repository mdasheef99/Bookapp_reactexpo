# Preserved history: ACTIVE.md (2026-10-30 to 2026-11-09)

Source file: `docs/multi-tenant-bookstore-marketplace/implementation/ACTIVE.md`

Source commit: `e9f431c`

Moved on 2026-11-10 at the slice 8 close (Owner: "ACTIVE.md rotation"). The
literal Markdown block below is the whole file as committed at `e9f431c`, in
original order. Link text inside the block is historical. This archive does
not grant current authority; current state is in [ACTIVE.md](../ACTIVE.md).

It covers slice 8 packages 8a, 8b and 8c: the M89..M99 apply records, both
live smokes, the dated Owner approvals, and the residual-risk notes as they
stood on 2026-11-09.

<a id="2026-11-09---slice-8-complete-on-dev"></a>

## 2026-11-09 - Slice 8 complete on dev (full file)

<!-- original-lines: 1-429 -->
`````markdown
# Marketplace current state

Recorded state: 2026-11-09. **Slice 8 is complete on dev** (8a, 8b, 8c):
post-deploy re-test passed, the 6 stuck holds were released, drain checks
01/02/05 passed (gate open, epoch 8) and a fresh Muse review of the fix
round is CLEAN; only the Owner-timed pilot switch remains outside the
slice. Slice 8 package 8c fix round (defects D1-D6
from the post-M97/M98 live dev re-test) is built and committed locally on
branch `phase9/slice8-providers` (HEAD `0b00441`): Unit 1 M99
`20261106000099_marketplace_phase9_8c_fix_round.sql` (commit `56b676b`,
amended in `0b00441` per Owner decision so the dashboard count RPC is
store-scoped; 538 lines, sha256
`9a10dc3ae760b256757b5f57bdc2ab2688b7d748ca52bcda5d0e5eff4af9e80c`;
APPLIED to dev `ahntbtktjjmvfosgkmgn` on 2026-11-08, live version `20261107192440`), Unit 2 metadata worker
(commit `c64c2fb`: M93 explicit-round admission + sanitized
`metadata_rpc_failed` logging), Unit 3 app (commit `0b00441`:
store-scoped RPC counts, error card with Retry, picker copy,
`P9_STATE_CONFLICT` lookup message). 2026-11-08: pushed (`main`
`2584f98`, branch `56e6eb5`, including worker tsconfig test excludes
`2a1d970`/`56e6eb5` after a failed first build) and the metadata worker is
deployed (`dep-dbob845g1s2s73en12fg`, live 17:41:31 UTC). Evidence in
[tracker 41](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-07-8c-fix-round-m99-worker-admission--rpc-logging-app).
M95-M98 stay applied (live `20261104213313`, `20261104213343`,
`20261105161532`, `20261105161642`); external admission gate open
(epoch 8); no reserved usage holds remain. This file is rewritten at
session close; dated evidence belongs in trackers.
Slice 8 package 8b is built (`db5434f..02a0f34`,
branch `phase9/slice8-providers`), pushed to `main` (`6e0df90`) and deployed to
Render (`dep-dblielugekts738gov3g`, live 12:41:25 UTC); 8b live smoke passed. Migration M94 was applied to the dev project on 2026-11-04
(live version `20261104121322`, Owner-approved). Earlier, slice 8
package 8a ordered apply of M89..M93 to
the dev project `ahntbtktjjmvfosgkmgn` is done under the Owner's standing
apply permission, after the review cycle (commit `ebb613c`, M93 sha256
`80d496a173c9f6fe30f42d3714c0c787488ced2669024be18d2090c9bea34c5e`). The
migration ledger now ends at `20261101230501` and lists M89..M93 (M92/M93
rows are Owner-approved note-only bookkeeping rows, not the migration SQL).
A legacy-explicit-path live smoke passed 2026-11-02 ~23:34-23:36 UTC. This file is rewritten at session close;
dated evidence belongs in trackers.

## Current work

- Active phase: **Phase 9: Image-to-LLM Inventory**.
- Active slice/work unit: **slice 8, package 8c fix round (D1-D6): Unit 1 M99
  (commits `56b676b`, amended `0b00441`), Unit 2 worker (`c64c2fb`),
  Unit 3 app (`0b00441`) — all committed locally on
  `phase9/slice8-providers`, pushed (`main` `2584f98`); M99 applied to dev 2026-11-08 (live `20261107192440`);
  worker deployed `dep-dbob845g1s2s73en12fg`; slice 8 closed on dev
  2026-11-09**.
  M95-M98 stay applied 2026-11-05; the 8c operator scripts and the Open
  Library switch still run at the pilot.
  Protection values decided (Owner delegation, 15-store pilot) and recorded
  in tracker 41; the Open Library switch itself runs later, at the pilot.
- Earlier work unit: package 8b built locally (U1-U4, U6, U5
  steps A/B1/B2); M94 applied, pushed, worker deployed and live-smoked 2026-11-04.
- M94 `20261104000094_marketplace_phase9_automatic_worker_prerequisites.sql`
  (231 lines, sha256 `a0b7de6288107a405852feda3cc392b718e988b7b557c1fd6b5a69d3153690e2`):
  **APPLIED 2026-11-04** to `ahntbtktjjmvfosgkmgn`, live version `20261104121322`; the live
  statement sha256 equals the file. It adds the fence reader
  `phase9_automatic_edition_fence_v1` and the atomic preparation RPC
  `phase9_prepare_automatic_metadata_v1`. The 8b worker calls the fence for
  every automatic claim with no fallback, so M94 had to be applied before the
  8b worker is deployed (release order now satisfied); without it the worker
  fails closed (`stale_claim`, no provider egress).
- Completed milestone: **slice 8 complete on dev (2026-11-09)**: 8c fix
  round deployed, re-tested, holds cleaned, drain checks passed, review
  clean (tracker 41).
- Earlier milestone: **8b built, pushed, deployed and live-smoked**
  (2026-11-04). Final whole-8b review done:
  Luna (two passes), plus DeepSeek and Muse targeted units; fix round 2 committed
  locally; final DeepSeek sweep clean apart from two fail-safe Lows (tracker 40). Record: [tracker 40](phase-9-image-inventory/trackers/40-package8b-worker-evidence.md);
  [implementation log](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-04---slice-8-package-8b-worker-built-locally-m94-local-file-not-applied);
  [ledger M94](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-11-04-slice-8-package-8b-built-locally-m94-local-file-not-applied).
- Earlier completed milestone: **8a ordered apply of M89..M93 is applied** (2026-11-02).
  Review cycle closed first (whole-8a review, LEGACY-LIVE-1/2 fixed in M93,
  final regression; [whole-8a record](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression)).
  Apply record: [tracker 39 apply section](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--ordered-apply-of-m89m93-ledger-note-rows-and-post-apply-verification)
  and [implementation log](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-11-02---ordered-apply-of-m89m93-post-apply-verification-and-legacy-smoke);
  [ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-11-02-slice-8-package-8a-applied-m89m93).
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
  live version `20261101230500` name
  `marketplace_phase9_provider_automatic_transaction` (M92) and live version
  `20261101230501` name `marketplace_phase9_provider_queue_protection`
  (M93). Their `statements` hold a one-line note (applied through the
  dashboard, source file path and sha256), not the migration SQL;
  `created_by`, `idempotency_key`, `rollback` are NULL. Live versions of all
  five: M89 `20261101224556`, M90 `20261101224911`, M91 `20261101225107`,
  M92 `20261101230500`, M93 `20261101230501`. Do not run `db push` (frozen).
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
- 8b live smoke PASSED (2026-11-04 ~12:51-12:53 UTC, dev project, 8b worker
  deploy `dep-dblielugekts738gov3g`): Inventory > scan `4ad4f6c0` > Find or
  change edition on "The Adventures of Robin Hood" > Search by ISBN
  9780141321028 > job `0e629ff9-47f9-4aad-b393-41a5a8462fcf` created 12:51:38,
  worker `invocation_accepted` 12:52:01 (claimed 1, outcome
  `edition_options_available`, 9 s), job resolved attempt 1 at 12:52:10; 3
  provider calls; admissions and automatic runs stayed 0 (NULL-policy legacy
  path); no `P9_` error. The ISBN was a tester error (it is The Wizard of Oz,
  Puffin Classics); the result was selected in the UI (selection
  `443a3dd5`, `edition_option`, 12:52:47) as allowed dev test data. Not
  covered: admission/fair-queue path (needs a policy, 8c), inventory commit.
- Dev-server launch config `.claude/launch.json` (expo web on port 8081)
  was created for this test and is uncommitted.
- 2026-11-08/09 post-deploy re-test (explicit Search Books) PASSED on dev
  after a Render free-instance outage (~18:00-20:03 UTC): 2 jobs
  `edition_options_available`, 6 finalized `open_library` calls, 2 holds
  reserved then consumed, no `P9_PROVIDER_RUN_NOT_ADMITTED`; cards clear.
  [Evidence](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-0809-post-deploy-dev-re-test-explicit-search-books).
- 2026-11-09 slice 8 closeout on dev: 6 stuck holds released (guarded
  update), scripts 01/02/05 passed (gate open epoch 8), Muse fix-round
  review CLEAN.
  [Evidence](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-09-stuck-hold-cleanup-and-drain-checks-0205-on-dev).
- Exact next authorized action: **Owner decision on the next work unit
  after slice 8 (the 02d parking question)**. Not authorized by this file.
  No `db push` (frozen).
- Other gated actions, each needing its own Owner approval (none authorized
  here): the pilot Open Library switch (8c operator scripts 01-05 with
  placeholders: reviewed manifest hash, smoke cohort; dev is already
  switched; `PHASE9_PROVIDER_CONTACTS` was set on Render 2026-11-05); 02d
  prefill.

## Mutation authority now

- 2026-11-04: the Owner authorized finishing 8b and committing it locally
  (code, the M94 migration file, docs and CODEBASE_MAP). No push, no
  deployment, no Supabase, Storage or Render writes, and M94 not applied. The M89..M93 application
  above was performed under the Owner's standing apply permission
  (M89..M91 via `apply_migration`, M92/M93 by the Owner via the dashboard,
  ledger note rows Owner-approved); this session itself performs no
  database, Storage, deployment or git mutation.
- 2026-11-04 (later): the Owner approved applying M94 ("ok apply the m94").
  Applied via Supabase MCP `apply_migration` after exact-project verification
  and a read-only Haiku preflight (verdict READY). Then, on a second Owner approval ("Yes, dead-letter it"), one guarded
  single-row `UPDATE` dead-lettered stuck job `4ffe137d` 2026-11-04 12:24:50 UTC
  (mirrors M75's exhausted-job close; record in tracker 40).
- 2026-11-05: the Owner authorized building 8c and committing it locally.
  Dev data only (Owner: "quash them"): the three stale August `reserved`
  usage reservations `f20a5804`, `b03047ff`, `d43d737e` were set to
  `released` (`actual_cost_units` 0). Then (Owner: "Yes, push and apply")
  pushed `main` and the branch to `e36e6e9` (no runtime code changed, no
  deploy) and applied M95 (`20261104213313`) then M96 (`20261104213343`)
  via `apply_migration`; stored statements equal the files.
- 2026-11-05 (later): the Owner approved fixing the flow-stage review
  defects and adding M98 ("Yes, add M98"). Local commits `65167b4`,
  `dacffae`, `4b29935`, `9faee42`. Then (Owner: "Push the four commits,
  apply M97 then M98 to dev") pushed `main` and the branch to `9faee42` and
  applied M97 (`20261105161532`) then M98 (`20261105161642`) via
  `apply_migration`; stored statements equal the committed files. Render
  did not auto-deploy (live deploy still `dep-dblielugekts738gov3g`). No
  Storage write, no data change.
- 2026-11-08: Owner approved "Apply M99" (applied, live `20261107192440`)
  and then "Push and deploy" plus "Yes, fix both" (worker tsconfig test
  excludes). Pushed `main` `2584f98` and the branch `56e6eb5`; metadata
  worker deployed `dep-dbob845g1s2s73en12fg` (first attempt
  `dep-dboag1rrjlhs73as85e0` failed at build, nothing changed live). No
  Storage or data change. Then "Run the re-test" (Owner Search Books test
  data only) and "Yes, restart it" (Render restart of the metadata worker,
  no build, 19:00:32 UTC).
- Shared database/migration application: **M94 plus the one-row
  `4ffe137d` dead-letter (2026-11-04)**;
  Storage: **none**; deployment: **8b worker `dep-dblielugekts738gov3g`
  (Owner: "Deploy, then test")**; pushed `main` and the branch to `6e0df90`;
  dev test-data writes during the smoke (Owner: dev data may be freely changed).
- Do not run `db push` (frozen). Any future ledger repair or migration work
  needs its own Owner approval.

## Last recorded live state

These are recorded development-project apply/smoke results, not a fresh
operational readback.

- Latest applied migration: **M89..M93**, live versions **`20261101224556`
  (M89), `20261101224911` (M90), `20261101225107` (M91), `20261101230500`
  (M92 note-only row), `20261101230501` (M93 note-only row)**, project
  **`ahntbtktjjmvfosgkmgn`** (2026-11-02 ordered apply; M93 sha256
  `80d496a173c9f6fe30f42d3714c0c787488ced2669024be18d2090c9bea34c5e`).
  M92/M93 ledger rows hold a one-line dashboard-apply note, not the
  migration SQL.
  [Ledger](phase-9-image-inventory/supporting/database-current-vs-target.md#2026-11-02-slice-8-package-8a-applied-m89m93).
- M94 (2026-11-04): live version `20261104121322`, name
  `marketplace_phase9_automatic_worker_prerequisites`, statement sha256
  `a0b7de62...3690e2` equals the file. Readback: both functions in
  `marketplace_sec` (SECURITY DEFINER) and `public` (SECURITY INVOKER
  wrappers), owner postgres, `search_path=''`, EXECUTE postgres and
  service_role only.
- Registry: `google_books` and `open_library` both enabled with
  `protection_policy` NULL (2026-11-02 post-apply readback); automatic runs
  return `configuration_required` until a policy is set (8c).
- Functions/grants (2026-11-02 post-apply readback): no PUBLIC execute on
  any phase9 function; anon execute exactly the 12 known helpers;
  authenticated execute 84 (baseline unchanged); service_role only on the
  public wrappers and the `marketplace_sec` entry points; all functions
  owner postgres with `search_path` set; both
  `phase9_finish_automatic_provider_run_v1` overloads present in public and
  `marketplace_sec`; live `phase9_provider_run_grant_v1` contains
  `P9_PROVIDER_RUN_NOT_ADMITTED`.
- Live smoke (2026-11-02 ~23:34-23:36 UTC): job `c01c8347-...` resolved on
  the legacy NULL-policy path with 3 finalized provider calls and 1 usage
  reservation; admissions/automatic runs stayed 0 rows; deployed worker is
  Render commit `3fdc0c44` (slice 7b-2 build, 2026-10-29), not slice 8.
- Deployed worker: `phase9-metadata-worker` deploy `dep-dbob845g1s2s73en12fg`
  (commit `2584f98`, 8c fix-round build, live 2026-11-08 17:41:31 UTC;
  Render env unchanged). Rollback target: `dep-dblielugekts738gov3g`
  (`6e0df90`, 8b).
- Store View lane: live migration `20261108143327` `store_view_slice2_page_v3`
  is applied to dev but not yet in git (Store View lane to commit it).
- Latest relevant recorded commit on `main`: closeout `0d240ef`;
  [publication evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#49-slice-7b-2-pushed-deployed-and-live-smoked-whole-slice-terra-review-test-infra-fixes-2026-10-29).

## Open items, blockers and residual risks

- Blockers: Owner decision on the next work unit (the one exact next
  action); Render free instances failed to start for ~2 h on 2026-11-08
  with no stated cause (watch); undocumented Render deploy
  `dep-dbmbe461egvs73btn1dg` (2026-11-05) to confirm with the Owner; fix
  round reviewed by Qwen3.8 Flash and Muse (Owner: Muse/DeepSeek instead
  of Luna); Gemini billing (prepay, restore the key; a free-tier key exposed
  in chat must be rotated, never recorded). Owner decisions pending: the
  02d parking question and `wip/state-machines-audit` (`bc5a829`,
  unreviewed, not Phase 9). 8c residual
  risks (pause coverage boundary for NULL-policy/explicit requests,
  defer-conflict attempt use, one Low M98 test gap, unmapped contactId sends
  every claim to manual, fair queue unused):
  [tracker 41](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#residual-risks).
  Fix-round residuals (admission-fake hardening in ~20 older suites,
  picker/lookup copy; stuck holds released 2026-11-09):
  [tracker 41 fix round](phase-9-image-inventory/trackers/41-package8c-switch-evidence.md#2026-11-07-8c-fix-round-m99-worker-admission--rpc-logging-app).
- FIXED in M95 (applied 2026-11-05): pre-8b read-model bug (found in the smoke, not 8b): candidate `ac712fe6`
  (Bleak House) shows "Finding edition…" forever. Its newest lookup is
  `accepted_metadata_match` but its selected snapshot is the older ambiguous
  one and the edition state's `source_lookup_id` is NULL (options expired), so
  `phase9_edition_legacy_metadata_state` falls to `pending`; the picker then
  disables search, so the owner cannot recover. Needs a bounded fix.
- 8b residual risks (detail in [tracker 40](phase-9-image-inventory/trackers/40-package8b-worker-evidence.md#residual-risks-and-follow-ups)):
  (1) terminal fallbacks use the legacy `phase9_fail_metadata_job`, which can
  leave an M93 run row `running` or `unknown`; (2) a breaker refusal on a run
  that already holds a lookup is terminal `policy_denied`, not retried;
  (3) uncertain prepare, finish or complete states return manual without a
  terminal write and may need operator recovery; (4) evidence without M94
  lineage terminalizes as `policy_denied` (Low; only legacy mid-flight jobs at
  deploy time); (5) the installed-automatic catch-all maps every escaping error
  to `stale_claim`, which hides programming errors.
- One scaffolding Jest test ("worker HTTP service rejects a second processing
  request") failed once under full-suite load and passed in isolation; reviewers
  judged it a 20 ms timing race unrelated to B2. It passed in the three later full
  Phase 9 Jest runs (two by the fix session, one by the orchestrator).
- M89..M93 are applied (live versions above); M92/M93 ledger rows are
  note-only bookkeeping rows, not the migration SQL. Stuck job `4ffe137d` is
  dead-lettered 2026-11-04 12:24:50 UTC on Owner approval. General gap (for 8c): a metadata job whose worker dies on its
  final attempt is never reclaimed or dead-lettered (claims need
  `attempt_count<max_attempts`, failure needs the lost lease token; only M75
  in an active session closes edition-options jobs); 8c should add a bounded
  sweep. The 02c-1 drain must handle the three stale August reservations.
- Native fairness AC8-6 remains NOT natively proven (gated on unset OQ8-3);
  no explicit 40P01 assertion. Two Low test-evidence notes stay open, not
  blockers: Capacity test 181-202 would not catch a reverted post-lock clock
  refresh; QueueReview test 143-152 passes for a different reason than its
  name ([tracker 39](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#2026-11-02--whole-8a-review-of-m89m93-fixes-preflight-and-final-regression)).
- WHOLE-1 stays open as a later-slice item: a NULL `operation_version`
  historical automatic job can fail a non-legacy OL v2 route (latent until 8c);
  needs a null-safe flag in a later slice plus a drain. LEGACY-LIVE-3 items:
  add to the pre-launch Google data purge checklist the inventory and purge of
  Google-sourced data (owner item below).
- The operating numbers stay unconfigured. Actual worker pacing/circuit state,
  cooldown recheck/HTTP recovery and one-instance rollout enforcement remain
  8b/rollout proof; SQL tests do not establish those behaviors. Shared-db pacing
  is deliberately unsupported and rejected by the new boundaries.
- The SDD does not explicitly assign a no-retention fan-out proof to 8a-4.
  Whether that future worker scenario needs support is a design question, not
  a confirmed 8a-4 requirement or gate. The current no-list guard remains;
  removing it without a source proof would reintroduce the unbound-selection defect.
- The original historical files `.claude/psr-slice6/db-evidence.md` and
  `.claude/psr-slice7a/preflight-1.md` are absent from this checkout. Dated
  tracked summaries are linked, but do not replace the originals or establish
  fresh live state. The continuity validator passes with this limitation noted.
- The M89..M93 ordered apply is done and recorded in the ledger; `db push`
  stays frozen. Pushing and deploying are not authorized.
- Reviews of M90: Muse (no issues); paid DeepSeek (1 Low, overlong Open Library
  id lost the 256-character bound, confirmed with a probe and fixed); Terra
  read-only (2 Medium, both resolved; detail in the tracker entry). Terra noted
  M90 is not repeatable if applied twice (plain CREATE FUNCTION); M84 and M89
  follow the same pattern, so no change.
- Terra 8a-3 review (read-only, Owner-requested, 754 s) found three Medium
  compatibility defects that Muse and paid DeepSeek had missed. Corrections
  were already present in the dirty M90/M91 files when this S1–S7 session
  started; their prior independent closure is not claimed here. (1) M90:525: the
  `phase9_catalogue_valid_cache_v1` replacement tightens an existing CHECK; an
  Open Library cache row valid under M85 with `normalizerVersion="legacy-v1"`
  would fail on a later UPDATE. (2) M90:390: the stricter row validator runs
  before the M86 completion-replay branch; replaying a previously accepted
  option whose book URL names a different valid Open Library edition raises
  `P9_EDITION_ROWS_INVALID`. (3) M91:31: the replacement stage CHECK rejects
  half-null pairs that M78 accepted through SQL UNKNOWN, e.g.
  `(edition_call_sequence, edition_call_stage) = (0, NULL)`; the whole-8a
  live preflight found none (all 172 call rows are (NULL,NULL)), so the
  constraint was left unchanged. Terra's live-data questions are now answered
  by the read-only whole-8a preflight (no legacy-v1 rows, no offending cache
  rows).
- M92's earlier S1–S7 native provider checks passed with verified cleanup. The
  follow-up P1/P2 defects were reproduced and corrected; the 71-definition SHA256
  fixture is refreshed as provisional and must not be treated as review approval.
  The full historical PGlite command was stopped
  during unrelated bookstore cases and is not claimed complete. The builder also edited
  `phase9ProviderSynthetic.integration.test.mjs` and
  `provider-replacement-synthetic-install.sql`; reviewers are checking that no
  assertion was weakened.
  [Exact proof and limits](phase-9-image-inventory/trackers/02-implementation-and-verification.md#2026-10-31---slice-8-package-8a-4-automatic-transaction-file-only)
  owns exact proof and limitations. Earlier named-model review and native
  status records are historical; this correction does not claim a completed
  Terra rerun. The historical CRLF byte-guard failure remains unchanged.
- Owner decisions 2026-10-31 and 2026-11-01: paid DeepSeek (with Muse) replaces
  Sol for review-driven fixes and corrections, to save Codex credits; Sol
  writes only the main migration of each package. Terra reviews stay for 8a-2,
  8a-3, 8a-4 and the whole 8a layer (whole-8a round completed 2026-11-02).
  Placeholders are allowed for the Open Library contact
  email and for quota/pacing numbers only where a package needs one; for oversized
  or unsafe input (OQ8-7) the orchestrator decides a simple truncation when that
  package is briefed.
- Owner-open items left: the contact email (placeholder), OQ8-3 operating
  numbers (unset), OQ8-7 input policy (orchestrator decides simple truncation
  at that package), Q4-2 retry-floor bound (needs a Owner number), and the
  pre-launch checklist item to inventory and purge Google-sourced data.
- Read-only Render readback found one configured metadata-worker instance.
  Runtime pacing/singleton enforcement and configuration values remain unverified;
  [evidence and limits](phase-9-image-inventory/trackers/39-package8a5-contract-review.md#read-only-operational-evidence).
- New 02c interface clarifications stand as pending review, not approved:
  the service-only read `public.phase9_provider_configuration_v1()`, 8a-2
  ownership of the resolver Google veto, and the paused-gate refusal
  `P9_EXTERNAL_ADMISSION_PAUSED`.
- Deferred, unproved package 1 TODOs with owners: real v2 cover mode (8b/8c),
  orphan or unknown-egress restart recovery (8b), retention/profile and synthetic
  proofs beyond the bounded S1–S7 cases (8a-2..4), prefill negatives (02d),
  provider-facts-only origin (OQ8-11). The updated P1/P2 hash fixture is
  provisional; correction review and full 8a acceptance remain separately gated.
- Pre-existing local issues, not slice 8: `core.autocrlf=true` CRLF checkout breaks
  raw-byte migration checks (Jest M84 hash, M86 guard); an LF `.gitattributes`
  rule for `supabase/migrations/*.sql` is authorized as one small separate commit. `phase9MetadataFoundation.integration.test.mjs` has 3
  stale failures from its August-stopped harness. The continuity validator now
  passes with the historical evidence limitation described above. `.phase9-dist`
  must be built before some phase9 suites run.
- Earlier accepted slice 7b-2 limits carry over: AC7-21(b) UNPROVEN, the
  provider-facts-only privacy case UNPROVEN, unproved in-flight/selected-option
  rollback and live Google/expiry/M88-guard cases; [closeout evidence](phase-9-image-inventory/trackers/38-post-scan-rework-evidence.md#47-slice-7b-2-closeout-whole-slice-review-m88-created-locally-test-hardening-2026-10-29).
- Representative low-end Android Unit 6F validation remains deferred, not PASS; [owning evidence](phase-9-image-inventory/trackers/24-unit6f-readiness-quality-gates-evidence.md).

## Ordered reading list

1. Read this file after [AGENTS.md](../../../AGENTS.md).
2. Read [SESSION-START.md](phase-9-image-inventory/SESSION-START.md) for protocol, rules and the update matrix.
3. Read [DOC-13](../DOC-13-implementation-tracker.md) for cross-phase status and global blockers.
4. Use [TRACKER.md](phase-9-image-inventory/TRACKER.md) to locate evidence relevant to the authorized task.
5. Read the [master SDD](phase-9-image-inventory/00-phase-9-master-sdd.md) and only the domain/supporting material routed by SESSION-START.
6. Read the [implementation/verification tracker](phase-9-image-inventory/trackers/02-implementation-and-verification.md) when implementation is authorized.

## Historical records

- [History index and source provenance](history/README.md).
- [Former ACTIVE handoffs](history/ACTIVE-history-to-2026-10-29.md).
- [Former DOC-13 Phase 9 narrative](history/DOC-13-phase9-history-to-2026-10-29.md).
- [Former session-start handoffs](history/phase9-SESSION-START-history-to-2026-10-29.md).
- [Former master-tracker status copies](history/phase9-TRACKER-history-to-2026-10-29.md).

Read archives only for historical decisions, approvals, discrepancies or evidence;
their dated next actions do not grant current authority.
`````
