# Owner Edition Picker Task 8 Local Verification Evidence

## 2026-10-09 - Task 8 independent approval and M65-M70 applied

Phase 9 / completed Unit 6G baseline. Task 8's bounded LOCAL checkpoint is
independently APPROVED; all eight tasks have local implementation/verification
evidence. [Review provenance](33-owner-edition-picker-task8-local-verification.md)
preserves earlier approval provenance and the unavailable historical 152-path
audit baseline.

**Status:** `task8_independently_approved_m65_m70_applied_runtime_pending`.
The Owner authorized steps 1-3: approval documentation, live preflight and the
six unchanged migrations. All M65-M70 are now APPLIED / catalog-verified on
Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn. [Application ledger](34-owner-edition-picker-m65-m70-application.md)
records six live versions, exact source/archive hashes, function/ACL/RLS/index/
trigger readback, unchanged business counts, recovery and advisor deltas.

No Edge/worker/client deployment, registry/configuration change, provider call,
browser test, data deletion, staging, commit or push occurred. New alternatives
retention remains disabled/unverified; existing automatic provider flags remain
unchanged. Runtime/provider/browser/operational rollout gates stay pending.

Exact next action: Owner review/authorization for compatible development
Edge/worker/client rollout and provider-gated browser verification (step 4).
Earlier dated entries below retain their historical NOT_APPLIED status and
review provenance; this latest entry owns current application status.

## 2026-10-09 - Local verification review checkpoint

**Status:** `task8_locally_verified_pending_independent_review`.
Phase 9; Unit 6G baseline complete; Tasks 1-7 locally implemented.
Task 6 and Task 7's bounded corrections retain their recorded independent
APPROVED provenance. No independent Task 8 approval is claimed.
**Active work unit:** Task 8 LOCAL verification review checkpoint.
**Exact next authorized action:** independent read-only review of Task 8's
local test, harness and verification-documentation diff.

The Owner explicitly authorized local tests/harness/documentation, disposable
native PostgreSQL and recorded provider fixtures. Root:
`C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect`;
branch `codex/edition-picker`; HEAD
`ee3a8c79429ca401d468861f2861721082ba955e`.
Starting status: 73 modified, 79 untracked, zero staged.

Sources: [execution plan Task 8](../../../../superpowers/plans/2026-10-07-owner-edition-picker.md),
[picker SDD §§6-11/13.2 and §10](../work-units/owner-edition-picker-sdd.md#10-acceptance-and-verification-matrix),
[Master §§9-13 / MAS-03/05/06/12/15/17](../00-phase-9-master-sdd.md),
DOC-3 §§5.1-5.2/6, DOC-4 §§9-11 and DOC-8 §5.
No behavior or acceptance definition changes. EP-AC17 stays deferred.

## Exact session scope

Five test/harness files:

| File under repository root | Change and purpose |
| --- | --- |
| `supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1` | Extend the existing harness with opt-in `-IncludeEditionPicker`, unchanged prerequisites and M65-M70; strengthen teardown readback/failure visibility. Preserve default and existing switches. |
| `supabase/tests/phase9/phase9EditionPickerConcurrency.postgres.mjs` | New native command races and authorization checks; imports the six native acceptance cases. |
| `supabase/tests/phase9/editionPickerPostgresConnections.mjs` | New independent psql sessions, bounded transaction barriers and observed blocking-PID evidence. |
| `supabase/tests/phase9/editionPickerPostgresFixture.mjs` | New synthetic setup and existing SQL-builder reuse; real authenticated Save/selection/Add and service-role claim/completion. |
| `supabase/tests/phase9/phase9EditionPickerAcceptance.postgres.mjs` | New real selection/Save/resume/Add, per-card bulk persistence/cleanup, rollback/retry, expiry/denial, compatibility and authorization proof. |

Documentation changes (prefix below is
`docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/`):

- Marketplace root: `DOC-13-implementation-tracker.md`,
  `DOC-3-canonical-books-metadata-inventory.md`,
  `DOC-4-image-to-llm-inventory-workflow.md`, `DOC-8-store-owner-console.md`.
- Routing: `implementation/ACTIVE.md`.
- Phase: `00-phase-9-master-sdd.md`, `03-owner-review-inventory-commit-sdd.md`,
  `README.md`, `SESSION-START.md`, `TRACKER.md`.
- Supporting: `supporting/requirements-traceability.md`,
  `supporting/database-current-vs-target.md`.
- Evidence: `trackers/02-implementation-and-verification.md`,
  `trackers/32-owner-edition-picker-task7-ui-evidence.md`,
  this new `trackers/33-owner-edition-picker-task8-local-verification.md`.
- Owning SDD: `work-units/owner-edition-picker-sdd.md`.
- Plan: `docs/superpowers/plans/2026-10-07-owner-edition-picker.md`.

These updates satisfy SESSION-START §6's code/test completion, work-unit
handoff and verification/deviation matrix. Existing requirements and historical
review entries remain intact. Larger existing authorities retain their cohesive
chronological provenance; detailed new proof is routed into this independent
evidence responsibility rather than pruning or splitting authoritative content.
Production/client/worker code, prior test files, dependencies and migrations are
preserved. Only the existing harness plus these documentation paths may differ
from the captured 152-path dirty checkpoint.

## Native database and role boundary

Discovered installed native `initdb`, `pg_ctl`, `psql` under
`C:\Users\user\scoop\apps\postgresql\current\bin`; no software installation.
The existing harness creates an isolated cluster, bound to 127.0.0.1, and new
`bookconnect_u8b_<PID>` database. No shared database/Storage/provider/worker
service is contacted.

**Exact native stack:** existing Phase 6 baseline and pre-existing compatibility/
bootstrap fixtures; Phase 9 M01-M62 excluding M09 (the inherited harness omission),
then M65, M66, M67, M68, M69, M70, all unchanged. M57-M60 and representative-cover
M61/M62 are installed before the picker migrations. Other-checkout M63/M64 are
excluded. No new compatibility SQL or replacement selection/completion/commit/
locking functions. The sole added failure injection is a temporary test-only
CHECK constraint that makes cleanup fail inside the real commit transaction;
the test drops it in `finally`.

Owner operations run after `SET ROLE authenticated` with synthetic authenticated
JWT role/sub GUCs; worker operations run as `service_role` through the existing
claim/context/accounting/completion RPCs. Effective roles are asserted. Administrator
use is limited to synthetic setup, inspection, policy/expiry fixture changes and
the failure injection. This proves local SQL grants/authority, not deployed JWT
validation or live pooled/RLS configuration.

A holder connection executes the real command in BEGIN and emits its backend
PID/role plus a marker. A separately spawned contender begins its command while
the holder remains uncommitted. The test releases COMMIT only after
`pg_stat_activity.wait_event_type='Lock'` and `pg_blocking_pids(contender)`
contains the holder PID. PIDs differ in every overlap. The 10-second polling
barrier, 20-second statement/idle-transaction limits and 25-second process timeout
bound failures. Polling sleeps alone never establish concurrency.

Final run, port 5450, database `bookconnect_u8b_16032`:
**17/17 tests PASS**, zero failed/skipped/cancelled; 11 observed overlaps:

| Scenario | Holder PID → contender PID | Command roles | Authoritative outcome |
| --- | --- | --- | --- |
| `selections` | 16052 → 20580 | authenticated / authenticated | First choice wins; other same-version choice safely conflicts. |
| `selection-add` | 8548 → 17796 | authenticated / authenticated | Stale Add conflicts; fresh Save/Add materializes only the new choice. |
| `add-selection` | 24244 → 12784 | authenticated / authenticated | Add wins; conflicting selection cannot alter the committed choice. |
| `queued-lookup-add` | 11424 → 17976 | authenticated / authenticated | Add clears the queued set; no accepted context resurrects committed options. |
| `commit-first` | 20072 → 14180 | authenticated / service_role | Late completion is stale_rejected; held snapshot persists. |
| `completion-first` | 15236 → 10916 | service_role / authenticated | Add clears newly completed alternatives and keeps the held selection. |
| `lookup-replay` | 9852 → 6576 | authenticated / authenticated | Exact replay shares one logical operation. |
| `lookup-tap` | 7812 → 3800 | authenticated / authenticated | Separate repeated tap still uses that one request/job. |
| `select-replay` | 18756 → 20068 | authenticated / authenticated | One selection/version increment; slim recorded replay. |
| `completion-replay` | 5676 → 12112 | service_role / service_role | One persisted set/physical-call record; recovery replays durably. |
| `add-replay` | 8248 → 2144 | authenticated / authenticated | One inventory row, audit, event and session increment after lost response/replay. |

Every recorded wait was a `transactionid` Lock with the stated holder in
`blockers`. Raw output: `.phase9-dist/task8-postgres-final.log` (ignored local
log; the durable facts are transcribed here).
The six acceptance cases additionally exercise real Save/fresh detail and batch
reads, authoritative script and selling fields, two cards' per-card Save/Add
sequence, no-cover persistence, atomic rollback, expiry/refresh/denials,
disabled-provider compatibility, cross-candidate and closed-session denial.
The SQL bulk sequence exercises the commands used by Add all; the production
client coordinator is covered separately by mocked-service UI tests.

Final teardown assertions all PASS:

- `EP8_CONNECTION_TEARDOWN_PASS`: zero test sessions.
- `POSTGRES_TEARDOWN_CONNECTIONS_BEFORE_DROP=0`.
- DROP readback confirms `bookconnect_u8b_16032` absent.
- `pg_ctl status` exit 3 verifies the created cluster stopped.
- Resolved created temporary directory, without a reparse point,
  `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-16032`,
  was removed; existence readback is false.
- Cleanup errors propagate a nonzero harness exit. Custom non-temporary DataDir
  remains retained under the existing behavior; its created cluster is stopped.

The modified default harness was separately rerun on port 5451:
U8B through M49 PASS, exit 0, no edition opt-in; database
`bookconnect_u8b_8592` removed, zero sessions, cluster stopped, only created
`bookconnect-u8b-pg-8592` directory removed. Existing switches retain their
original migration/test dispatch logic; their unrelated race suites were not rerun.

## Fresh local acceptance matrix

Evidence keys below define **actual** boundaries/stacks, not deployed acceptance:

| Key | Suite / exercised boundary | Exact picker migrations | Fresh result |
| --- | --- | --- | --- |
| N70 | The two new native `phase9EditionPicker*.postgres.mjs` suites, role-bound real SQL and independent locks | Full native prerequisites described above + M65-M70 | 17 tests PASS |
| J7 | Exact Task 7 23 client/UI suites below; mounted React/query/coordinator with mocked services | No database; current DTO fixtures, not server persistence | 349 tests PASS |
| PW | 13 provider/worker/contract/gateway suites below; recorded provider fixtures, fake transport/RPC ports | No database; current contracts | 365 tests PASS |
| S67 | State, LocalMatch, Fences SQL suites | Fixture baseline + M65-M67 | 48 cases PASS |
| S68 | Completion, Corrections, WorkerSql SQL suites | Fixture baseline + M65-M68; WorkerSql consumes compiled production worker with recorded transport | 87 cases PASS (34 + 46 + 7) |
| S69 | Commit SQL suite | Existing representative-cover fixture prerequisites + M65-M69 | 32 cases PASS |
| S70 | Confirmation SQL suite | Same commit fixture prerequisites + M65-M70; includes real forward pre-M70 warm-reader check | 20 cases PASS |
| W68 | Structural metadata command; compiled worker against disposable PGlite SQL | Existing baseline + M65-M68 | Build + 14 cases PASS |

The inherited S67 baseline is Phase 6 fixture plus M01-M35 (excluding M09),
M37-M39, M47-M48, M52-M62; its pre-existing digest/event-schema/media-delegate
compatibility is unchanged (`databaseHarness.mjs`, `unit7aFixture.mjs`,
`editionPickerFixture.mjs`). S68 adds M68 after M65-M67; S69 adds M69 and
the existing dispatcher prefix from M36 with empty net/vault interfaces;
S70 adds M70 (including one deliberate pre-M70 forward-migration case).
W68 uses the same numbered baseline and M65-M68 with its existing event/
media-wrapper fixture scaffolding. These historical PGlite stacks are not
the native harness's complete M01-M62 prerequisite chain.


All 19 ACTIVE IDs are accounted for. Each PASS covers the stated local portions;
operational portions below remain pending. Picker §10 defines the acceptances
and EP-AC17 remains DEFERRED; no new acceptance or manual edition-number editing.

| ID / source | Concrete proof and boundary | Stack / fresh result | Remaining operational portion |
| --- | --- | --- | --- |
| EP-AC01 / §§4.2/9 | PW `phase9_metadata_edition_options_worker.test.ts` fifteen-job/three-active refill and single ten-row call; S68 `phase9EditionOptionsWorkerSql.integration.test.mjs` compiled worker persists one ten-row response/call. | PW no DB; S68 M65-M68: PASS. | Deployed throughput/provider call evidence. |
| EP-AC02 / §§4.1/13.2 | PW `phase9_google_books_edition_options{,_review}.test.ts` per-record identity/ISBN/language/volume/sparse eligibility; S68 Corrections validates normalized rows; J7 `EditionOptionList.test.tsx` preserves disabled/unavailable positions. | PW/J7 no DB; S68 M65-M68: PASS. | Configured provider payload/permission and browser rendering. |
| EP-AC03 / §§3/13.2 | J7 list, Mounted, FullReview, SheetStates cover first five/Show all ten, own covers, duplicates/positions, all authors/partial dates, links/attribution/query wording, current card and focus callbacks. N70 Save/resume/Add asserts coherent chosen cover. | J7 mocked services; N70 full M65-M70: PASS. | Browser/device keyboard, touch, screen reader, large text and actual focus behavior. |
| EP-AC04 / §§4.1/13.2 | PW Google options/review fixtures deny date-only tie certainty/fabricated fields; J7 list renders supplied date precision. | PW/J7 no DB: PASS. | Configured provider/display evidence. |
| EP-AC05 / §§4.1/6 | S67 LocalMatch checks unique coherent observed ISBN versus text ambiguity; S70 Confirmation checks actual current_suggestion confirmation before first review, legacy ISBN mode and real Save/Add; PW certainty gates and J7 confirmation controls. | S67 M65-M67; S70 M65-M70; PW/J7 no DB: PASS. | Deployed suggestion/confirmation flow with real provider. |
| EP-AC06 / §§4.3/5 | PW worker/recovery explicit local/cache/coalesced bypass; J7 Mounted/SheetStates preserve details on old cards and explicit search; N70 withOptions uses real ready older manual cards. | PW/J7 no DB; N70 full M65-M70: PASS. | Browser old/local/cache card and configured runtime lookup. |
| EP-AC07 / §§4.3/5/9 | N70 lookup-replay/tap and expiry/new request assert one logical job plus new-attempt uniqueness; S67 Fences covers automatic→explicit→expiry→fresh history; S68 WorkerSql/recovery and PW worker cover retry/billing/empty outcomes; J7 Queries/SheetStates no-loop behavior. | N70 full M65-M70; S67 M65-M67; S68 M65-M68; PW/J7 no DB: PASS. | Live quota/accounting and retry/resume behavior. |
| EP-AC08 / §§4.3/5 | PW worker/recovery and W68 winner-only/coalescing fixtures exclude alternatives; J7 Mounted/SheetStates opening/reopening/expiry dispatch no lookup; N70 second card owns its independent set. | PW/J7 no DB; W68 M65-M68; N70 full M65-M70: PASS. | Deployed automatic-to-explicit flow and no egress on opening. |
| EP-AC09 / §§5/7/9 | N70 queued lookup/Add and both in-flight completion/Add orders; S67 Fences and S68 Corrections reject identity edit/removal/stale claim; J7 Drafts keeps identity authority. | N70 full M65-M70; S67 M65-M67; S68 M65-M68; J7 no DB: PASS. | Browser removal/identity edit while actual deployed worker runs. |
| EP-AC10 / §§6/9 | N70 cross-candidate/options and selection replay; S70 confirmation/current-suggestion/legacy/newer-choice replay; PW strict contracts/gateway reject forged metadata; J7 Cache/Contracts/Queries prevent replay regression. | N70/S70 M65-M70; PW/J7 no DB: PASS. | Live authenticated routing/client response-loss exercise. |
| EP-AC11 / §§6-7 | N70 actual selection→Save→fresh readers→Add preserves authoritative script and saved selling values; J7 Drafts, FullReview, Mounted and Commit preserve unsaved selling values; S67 Fences invalidates edited identity. | N70 full M65-M70; J7 no DB; S67 M65-M67: PASS. | Real browser/device unsaved editing and Save boundary. |
| EP-AC12 / §§7/9-10 | N70 `selections`, `selection-add`, `add-selection`: distinct connections, observed blocking PIDs, safe conflict and one authoritative choice/inventory. | Full native M65-M70: PASS. | Required real-connection LOCAL proof met; live runtime acceptance remains separate. |
| EP-AC13 / §§7/11 | N70 fresh Save/resume, per-card bulk Add and add-replay; S69 Commit option/no-cover and unchanged legacy representative-cover checks; S70 actual current_suggestion/edition_option resumed Save/Add; J7 single/bulk coordinator. | N70/S70 M65-M70; S69 M65-M69; J7 mocked services: PASS. | Live single/Add all, signed cover and lost-response flow. |
| EP-AC14 / §7 | N70 test-only CHECK causes real cleanup transaction rollback (inventory, candidate and receipts), exact retry succeeds; two-card sequence and completion/Add prove atomic per-card cleanup; S69 rollback cases. | N70 full M65-M70; S69 M65-M69: PASS. | Live uncertain Edge/browser Add recovery. |
| EP-AC15 / §§5/8 | N70 expiry hides/rejects rows, refresh preserves held confirmation; S69 expiry/cleanup/replay cases and S70 durable choice/confirmation after expiry; PW retention headers and S68 timestamp validation. | N70/S70 M65-M70; S69 M65-M69; S68 M65-M68; PW no DB: PASS. | Live provider retention permission and deployed scheduled cleanup/failure retry. |
| EP-AC16 / §§5/7 | N70 two same-book/store/session cards independently select; first Add leaves second unexpired set byte-identical; PW/W68 winner-only paths do not copy alternatives. | N70 full M65-M70; PW no DB; W68 M65-M68: PASS. | Deployed same-book multi-card behavior. |
| EP-AC18 / §§8-9 | N70 authenticated/service roles, private table ACL, cross-Owner/candidate, inactive Owner, closed session, stale token/lease, permission=false and malformed normalized row denials; S68 policy validation; S69 public/private cover checks; PW gateway/contract guards. | N70 full M65-M70; S68 M65-M68; S69 M65-M69; PW no DB: PASS. | Live JWT/pool/RLS/signed links, current provider-policy and security readback. |
| EP-AC19 / §§6-7/11 | S69 coherent editionStatement/materialization plus legacy automatic selected; S70 manual/selected/current_suggestion compatibility; J7 review/create-only regressions; N70 provider disabled after saved choice retains resume/Save/Add and existing inventory. | S69 M65-M69; S70/N70 M65-M70; J7 no DB: PASS. | Operational lookup/UI kill-switch and compatible backend rollback; no new rollout flag. |
| EP-AC20 / §§7/9 | N70 overlapping completion replay/durable recovery, Add response loss and transaction-failure retry; S68 WorkerSql seven real compiled-worker/SQL recovery cases and PW Recovery; J7 command/coordinator retry guards. | N70 full M65-M70; S68 M65-M68; PW/J7 no DB: PASS. | Actual deployed worker termination/restart and browser response loss. |

## Exact verification commands and normal exits

All commands ran from the target worktree. Logs are ignored local
`.phase9-dist/task8-*.log` artifacts; no log is sent externally.

```powershell
npx.cmd --no-install tsc --noEmit --allowImportingTsExtensions
npm.cmd run test:phase9:structural-metadata
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect\supabase\tests\phase9\run-phase9-bookstore-first-postgres.ps1" -IncludeEditionPicker
powershell.exe -NoProfile -ExecutionPolicy Bypass -File supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1 -Port 5451
```

Results: types exit 0; metadata-worker build + 14/14 structural cases exit 0;
edition native 17/17 + inherited U8B SQL acceptance exit 0; modified default U8B
acceptance exit 0. Metadata worker was built before compiled-worker-consuming SQL.

Exact unchanged Task 7 gate:

```powershell
$task7Paths = @(
  'src/features/imageInventory/__tests__/EditionOptionList.test.tsx',
  'src/features/imageInventory/__tests__/ownerEditionPickerMounted.test.tsx',
  'src/features/imageInventory/__tests__/ownerEditionPickerFullReview.test.tsx',
  'src/features/imageInventory/__tests__/ownerEditionPickerSheetStates.test.tsx',
  'src/features/imageInventory/__tests__/ownerEditionPickerQueries.test.tsx',
  'src/features/imageInventory/__tests__/ownerEditionPickerDrafts.test.ts',
  'src/features/imageInventory/__tests__/ownerEditionPickerConfirmation.test.ts',
  'src/features/imageInventory/__tests__/ownerEditionPickerCommit.test.ts',
  'src/features/imageInventory/__tests__/batchReviewCard.test.tsx',
  'src/features/imageInventory/__tests__/CandidateReviewScreens.test.tsx',
  'src/features/imageInventory/__tests__/unit6gMountedRouteIntegration.test.tsx',
  'src/features/imageInventory/__tests__/unit6gMountedRouteComposition.test.tsx',
  'src/features/imageInventory/__tests__/postScanUiCorrections.test.tsx',
  'src/features/imageInventory/__tests__/useInventoryCommitCoordinator.test.tsx',
  'src/features/imageInventory/__tests__/inventoryCommitCoordinator.test.ts',
  'src/features/imageInventory/__tests__/ownerUxReviewQueries.test.tsx',
  'src/features/imageInventory/__tests__/inventoryCommitCache.test.ts',
  'src/features/imageInventory/__tests__/batchReviewQueriesCleanup.test.tsx',
  'src/features/imageInventory/__tests__/ownerEditionPickerCommands.test.ts',
  'src/features/imageInventory/__tests__/ownerEditionPickerCache.test.ts',
  'src/features/imageInventory/__tests__/ownerEditionPickerContracts.test.ts',
  'src/features/imageInventory/__tests__/ownerEditionPickerService.test.ts',
  'src/features/imageInventory/__tests__/reviewForm.test.ts'
)
npx.cmd --no-install jest --runInBand --runTestsByPath @task7Paths
```

Fresh final **23 suites / 349 tests PASS**, exit 0
(`task8-task7-regression-final.log`, 57.209 seconds).
Mounted Save assertions still capture outgoing mocked requests; they do not
prove deployed server persistence. The independent Task 7 correction verdict
is preserved separately in [Task 7 evidence](32-owner-edition-picker-task7-ui-evidence.md).

```powershell
$providerWorkerPaths = @(
  'supabase/functions/__tests__/phase9_edition_picker_contracts.test.ts',
  'supabase/functions/__tests__/phase9_edition_picker_gateway.test.ts',
  'supabase/functions/__tests__/phase9_google_books_edition_options.test.ts',
  'supabase/functions/__tests__/phase9_google_books_edition_options_review.test.ts',
  'supabase/functions/__tests__/phase9_google_books_adapter.test.ts',
  'supabase/functions/__tests__/phase9_metadata_provider_adapter.test.ts',
  'supabase/functions/__tests__/phase9_metadata_edition_options_worker.test.ts',
  'supabase/functions/__tests__/phase9_metadata_edition_options_recovery.test.ts',
  'supabase/functions/__tests__/phase9_metadata_edition_options_rpc.test.ts',
  'supabase/functions/__tests__/phase9_metadata_environment.test.ts',
  'supabase/functions/__tests__/phase9_metadata_worker.test.ts',
  'supabase/functions/__tests__/phase9_metadata_production_gateway.test.ts',
  'supabase/functions/__tests__/phase9_metadata_production_composition.test.ts'
)
npx.cmd --no-install jest --runInBand --runTestsByPath @providerWorkerPaths
$sqlPaths = @(
  'supabase/tests/phase9/phase9EditionPickerState.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionPickerLocalMatch.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionPickerFences.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionOptionsCompletion.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionOptionsCorrections.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionOptionsWorkerSql.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionPickerCommit.integration.test.mjs',
  'supabase/tests/phase9/phase9EditionPickerConfirmation.integration.test.mjs'
)
node --experimental-vm-modules --test --test-reporter=spec --test-concurrency=2 @sqlPaths
```

PW: **13 suites / 365 tests PASS**, exit 0.
Scoped SQL: **187/187 PASS**, exit 0; stacks remain S67/S68/S69/S70 above.
No PGlite result is represented as independent-connection concurrency proof.

Additional recorded strict type gates all exited 0. Shared options:
`--noEmit --strict --skipLibCheck --target ES2022 --lib ES2022,DOM,DOM.Iterable
--moduleResolution node --module commonjs --esModuleInterop --allowImportingTsExtensions`.

```powershell
$strictOptions = @('--noEmit','--strict','--skipLibCheck','--target','ES2022',
  '--lib','ES2022,DOM,DOM.Iterable','--moduleResolution','node','--module','commonjs',
  '--esModuleInterop','--allowImportingTsExtensions')
npx.cmd --no-install tsc @strictOptions --types node,jest supabase/functions/__tests__/phase9_metadata_edition_options_worker.test.ts supabase/functions/__tests__/phase9_metadata_edition_options_recovery.test.ts supabase/functions/__tests__/phase9_metadata_edition_options_rpc.test.ts
npx.cmd --no-install tsc @strictOptions --types node workers/phase9-metadata-worker/bootstrap.ts
npx.cmd --no-install tsc @strictOptions --types node,jest supabase/functions/__tests__/phase9_edition_picker_contracts.test.ts supabase/functions/__tests__/phase9_edition_picker_gateway.test.ts supabase/functions/__tests__/phase9_google_books_edition_options.test.ts supabase/functions/__tests__/phase9_google_books_edition_options_review.test.ts
```

`node --check` passed for all four new MJS files; PowerShell parser passed
for the modified harness. No Python tests were run.

## Failed attempts, correction scope and evidence limits

1. Sandbox process startup returned `helper_unknown_error: setup refresh had errors`
   before executing commands; permitted escalated local execution succeeded.
   This is an environment startup failure, not a test failure.
2. A pre-edit invocation supplied the then-unknown flag, which plain PowerShell
   silently ignored. It passed only inherited M49/U8B acceptance and is not edition
   evidence. The final new opt-in marker/17-test output and modified default rerun
   distinguish the two paths.
3. First new native run: 1/17 PASS, 16 failures (exit 1) because the new fixture
   asked the existing claim RPC for 15 while its limit is 10. Corrected only the
   new fixture to 10. This does not change the worker's 15-job invocation budget.
4. Second new native run: 16/17 PASS, one negative unreviewed-Add fixture failure
   (exit 1). Passing a null reviewVersion to the pre-existing builder chose an
   undefined fallback; corrected only the new helper to use a well-formed stale
   version for the expected real authority rejection. All 11 overlaps passed
   on that run. Both failed harness runs fully tore down their created clusters.
5. First exact Task 7 rerun: 348 PASS, one 30-second FullReview test timeout
   (exit 1) while several compiler/Jest/SQL gates competed locally. Repeating
   the entire unchanged 23-suite gate after competing compiler/Jest jobs finished
   passed 349/349; no assertion, timeout or production change. Local load is
   the supported explanation; an intermittent product defect was not reproduced.

6. Two bulk documentation/readback shell invocations exceeded Windows command-line
   length before process startup; smaller batches completed successfully.
   Neither failed invocation changed files or ran tests.


No product defect requiring a production/migration correction was found.
Provider normalization uses recorded data; synthetic provider policy in the
disposable database is not permission evidence for production.

## Migration preservation and disposable ledger

Hashes were captured before this session and must match the final readback.
No migration was created or edited. Shared-service status remains
CREATED_LOCAL / NOT_APPLIED; application below was only to harness/PGlite
disposable databases, which are not the shared Supabase project.
No fresh live project verification or schema audit was performed.

| Local file / shared status | Checkpoint SHA-256, before = after |
| --- | --- |
| 20261007000065_marketplace_phase9_edition_picker_state.sql / NOT_APPLIED | `798A2B2D5722D40044FAD5FB4011FCED1D56F558FE05C3E44F0AA5EAB21EB9A3` |
| 20261007000066_marketplace_phase9_edition_picker_commands.sql / NOT_APPLIED | `788662FA3BC60CD20F98BB350C13B5BA34F38DBC80F0C42AAE0678A71FA13BE7` |
| 20261007000067_marketplace_phase9_edition_picker_operation_fences.sql / NOT_APPLIED | `66654B8C9E35586BFB8A3BA4395DC9F2660F6CD36AB1104247196847849025AC` |
| 20261007000068_marketplace_phase9_edition_picker_worker_completion.sql / NOT_APPLIED | `C591686FA414B76635C55EADA59DC2172B0F885362606654C5886C5B11A85C5A` |
| 20261008000069_marketplace_phase9_edition_picker_commit_cleanup.sql / NOT_APPLIED | `008F9EBB8CDF3288053B10FFCF2A50DB36D96807A0B42787D89339EAE79E0CDE` |
| 20261008000070_marketplace_phase9_edition_picker_confirmation.sql / NOT_APPLIED | `CBC63A03BF92A7609B4997B80C7CA3BB36C70D0568613D4D56CA76EDE230AF3C` |

Final native M65-M70 installation succeeded in verified dependency order.
Native SQL role/security checks, 17 tests and DROP/stop/path readbacks passed.
There is no live migration version/application entry; existing shared ledger
and historical preflight evidence remain unchanged.

## Closeout and residual gates

Completed closeout commands, all normal exit 0:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\user\.codex\worktrees\edition-picker-research\Bookconnect\docs\multi-tenant-bookstore-marketplace\implementation\phase-9-image-inventory\scripts\validate-phase9-continuity.ps1"
git diff --check
```

Continuity: PASS; 195 requirement definitions, zero duplicates, zero missing
traces, 91 Markdown files / 62 required files checked; size-policy regression
and scoped/repository whitespace checks PASS. An additional line-by-line scan
of all 22 session paths, including the five new untracked files, found zero
trailing-whitespace problems. Final tracker was reread and names the exact review
checkpoint and next action.

Preservation readback: all 152 pre-existing dirty files remain present.
The only changed baseline hashes belong to the 16 documented handoff/evidence
paths; the other 136 hashes match exactly. Removing the new status overlay in
memory reproduces the original SHA-256 for all 15 overlay-only authorities;
the plan also contains the expressly recorded local-checklist/current-handoff
updates. No previous product/test/migration bytes were changed. New dirty paths
are exactly the previously clean tracked harness plus four new MJS files and
this new evidence document. M65-M70 hashes match the checkpoint table above.

Final root/branch/HEAD verified: the target edition-picker worktree,
`codex/edition-picker`, `ee3a8c79429ca401d468861f2861721082ba955e`.
**74 modified / 84 untracked / zero staged**, including the preserved prior
73 modified / 79 untracked checkpoint. Task 8 changes 22 paths:
five test/harness paths and 17 documentation paths.

All changes remain local and uncommitted; no staging, commit, push, deployment,
shared database/Storage mutation, live provider call or deployed worker
invocation occurred. Production provider retention remains disabled.

Remaining separately authorized gates: independent Task 8 review; verified
configured-provider successful payload/cache evidence and rights for alternatives
**and** chosen metadata; development M65-M70 application with exact Supabase
project verification/readback; compatible Edge/worker runtime; Codex in-app
browser/device keyboard/touch/focus/screen-reader/large-text proof; live
Save/Add/retry/resume/expiry/security/cleanup; operational lookup/UI disablement,
rollback and controlled rollout. No live/browser full-feature acceptance is claimed.

**One next action:** independent read-only review of this Task 8 LOCAL test,
harness and evidence checkpoint.
