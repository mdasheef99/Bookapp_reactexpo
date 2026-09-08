# Unit 6G local SQL correction implementation plan

Date: 2026-09-08. User approved baseline integration, forward migration
creation/local implementation, and later the ordered M57–M59 live application.
Application and exact-project readback are complete. Runtime deployment and
bounded connected proof are complete; historical dead-letter reset and live
collision-fixture proof remain outside this authorization.

Authority: [approved design](./unit6g-media-completion-correction.md) §4;
Master SDD §3 MAS-03/MAS-08/MAS-17 and §8; Pipeline SDD §4/§10;
Security SDD §6/§7/§12 MED-19.

## Global constraints and execution record

Use the isolated checkout
`codex/phase9-unit6g-media-correction-integrated`, created from verified
`origin/main` commit `573182267ddd79e08b0abfb348b5afd9fb0dc571`;
preserve the old dirty checkout and all existing migration bytes. No historical
dead-letter backfill or reset. Test databases must be disposable and local.
Review uncommitted files directly because commits are not authorized.

## Task 1: Verify the current baseline

Verify that M52–M56 are tracked by the current `origin/main` baseline and match
their repository objects. Do not restore or copy them from the old worktree.
Record live/source mapping in the migration ledger.
Exercise the full Phase 9 migration tail in a disposable database before adding
forward changes; report any baseline failure separately.

## Task 2: Database completion and output lifecycle

Write failing SQL tests for exact replay, changed claim/payload denial,
policy incompatibility, duplicate rejection, stale leases and cleanup fencing.
Create cohesive forward migrations after M56. Persist server-derived per-attempt
output intents before upload, canonical completion receipts and bounded cleanup
claims. Bind receipts to all completion arguments and hashed claim identity.
Both scan and public-copy completion paths must use the corrected contract.
Keep the unique store/hash/orchestration constraint and catch only its exact
name. Persist terminal duplicate rejection and cleanup eligibility atomically.
Explicit duplicate rejection resolves at attempt five; unrelated max-attempt
failure semantics remain unchanged. Preserve original input/session/Owner lineage.

Completion and cleanup must share a locking order and irreversible deletion
fence. Check references/holds before reserving deletion, prevent new references
after reservation, and handle unknown upload/removal outcomes. No accepted
object can become eligible merely because a response was lost.

## Task 3: Worker integration and cleanup consumer

Write failing worker tests before changes. Require the durable intent contract
before Storage writes. Add a service-only cleanup consumer that claims through
SQL, deletes only the returned object, records returned and thrown failures,
treats missing objects as success, and leaves uncertain acknowledgments for
bounded SQL recovery. Add explicit duplicate handling without remapping unrelated
authority failures. Keep Storage `info()` plus independent downloaded-byte checks.
Test scan/public-copy behavior, lost responses, stale claims and error results.

## Task 4: PostgreSQL concurrency and regression proof

Use distinct connections in a disposable PostgreSQL server to synchronize
duplicate completions, exact replay, cleanup/completion and hold races. Assert
single accepted linkage/reservation, no loser candidate/inventory changes,
store isolation and unchanged historical dead letters. Remove executing TODO
markers only when the corresponding SQL assertions pass. Run focused Jest,
worker TypeScript and relevant SQL/security regression suites.

## Task 5: Review and continuity

Obtain independent review of the uncommitted correction and resolve findings.
Update TRACKER, DOC-13, ACTIVE, implementation verification tracker, migration
ledger, data dictionary/current-vs-target and requirements traceability.
Run the continuity validator without weakening its migration-set checks.
Record exact verification, residual deployment gates and one next action.

## Progress

- Task 1: complete. M52–M56 were already tracked by verified `origin/main` at
  `573182267ddd79e08b0abfb348b5afd9fb0dc571`; none was restored or copied into
  this worktree. Read-only live history confirms M52–M56 are applied exactly
  once at their recorded live versions. Full M01–M56 real PostgreSQL replay and
  U8B/U8C acceptance pass. Initial RED was the abbreviated
  Phase 6 fixture missing the event-schema registry; restored only that verified
  prerequisite in disposable bootstrap, with no applied migration edit.
- Tasks 2–3: complete locally. M57–M59 persist output intents, canonical receipts,
  exact duplicate handling, permanent cleanup fences, bounded rechecks, and
  service-only cleanup/health RPCs; the worker requires the intent before upload
  and runs the cleanup consumer after validation.
- Task 4: complete locally. The focused SQL correction suites are 21/21 (14
  SQL-correction cases and 7 corrected-duplicate cases), and separate-connection
  PostgreSQL races cover duplicate completion, cleanup/completion and hold/reference
  ordering, cross-store isolation, and historical dead-letter immutability. The
  focused worker/Owner/runtime Jest suites are 262/262 on the updated baseline.
- Task 5: complete locally. Documentation reconciliation and continuity validation
  pass on the updated baseline. Focused Jest passes 262/262, focused SQL passes
  21/21, the real PostgreSQL concurrency harness passes, and the worker
  TypeScript check passes. The broad Phase 9 database invocation is 429/433:
  every M57–M59 test passes; three stale metadata-foundation fixtures fail and
  one structural-metadata-worker test lacks its prerequisite `.phase9-dist`
  build artifact. Independent review found no actionable findings and returned
  PASS for local review. Its extra Jest attempt was blocked before startup by
  sandbox `EPERM`, so no additional pass is claimed.
- Ordered application is complete: M57, M58, and M59 are live once as
  `20260908073203`, `20260908073308`, and `20260908073425`; exact-project
  readback passed. No business row, Storage object, job, deployment, stage,
  commit, or push changed.
- Runtime closeout is complete: commit `ffdb1fc85af625bc98dcfc3af93d5530278144a9`
  is on `origin/main`; Render deployment `dep-dafv4ogn74is73bq9lkg` for
  `phase9-media-sanitation` is live with health/readiness 200. The requested
  duplicate-input proof resolved at attempt 1 with a canonical receipt, and a
  unique connected image resolved media and vision at attempt 1, producing 10
  candidates and a linked sanitized WebP. Both sessions closed with zero
  committed inventory rows. Focused worker/runtime Jest is 62/62, related
  backend/Owner/UI Jest is 219/219, and the worker build passes; the broad
  database run is 429/433 with all M57–M59 cases passing and four unrelated
  metadata-foundation/structural-artifact failures.
- Owner review of this runtime closeout is next. Do not revive the historical
  dead-lettered job. A live duplicate-sanitized-hash collision proof requires a
  separately prepared distinct-source fixture and explicit authorization.
