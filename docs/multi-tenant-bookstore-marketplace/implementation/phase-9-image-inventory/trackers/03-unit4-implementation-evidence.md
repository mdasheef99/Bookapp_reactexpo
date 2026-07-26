# Phase 9 Unit 4 Implementation Evidence

**Status:** `integrated_main_e9ba2d9`
**Date/session:** 2026-07-26
**Branch/baseline:** integrated on `main` at `e9ba2d9be93e54c43e6b55a86eb5a168fe30b5ed`

## Authorized scope

Implement the accepted fixture-backed multimodal vision-analysis work unit red-first, including one forward-only local M12. M11/M12 application, deployment, real vision/metadata APIs, Owner/mobile UI, inventory/publication mutation, and Git stage/commit/push/merge remained prohibited.

## Completed

- Replaced the v1 output contract with strict breaking `p9-vision-v2` request/result parsing, recursive unknown-key and active-content denial, coherent `0`, `1..15`, `16..100`, and quality outcomes, publisher clues, `und`, bounded provenance, closed warnings, and a 256 KiB ceiling.
- Added deterministic `FixtureSpineImageAnalyzer`, platform-owned count/language/repeated-position/null-title policy, and a dedicated authenticated vision worker using only four named M12 RPCs.
- Added forward M12 `20260726000012_marketplace_phase9_vision_analysis_runtime.sql`: immutable result/observation evidence, input/schema and job/schema uniqueness, candidate observation/job/schema/publisher lineage, vision claim/context/persist/fail RPCs, attempt/token fencing, exact replay fingerprint, rollback-safe persistence, immutable triggers, RLS, and service-only grants.
- Preserved repeated identical observations as separate candidates; retained mixed/unknown-language and identity-insufficient observations as bounded evidence; created candidates only for expected-language titled observations.
- Added no metadata/provider network boundary, inventory/listing/event DML, public DTO, Storage write, or fallback.

## Files/components

- Contracts/domain/runtime: `contracts/vision.ts`, `contracts/versions.ts`, `contracts/registers.ts`, `domain/visionPolicy.ts`, `analysis/fixtureSpineImageAnalyzer.ts`, `runtime/visionAnalysisWorker.ts`.
- Dedicated worker: `workers/phase9-vision-analysis-worker/{index.ts,bootstrap.ts,README.md}`.
- Database: M12 plus Phase 9 harness and vision-runtime PGlite cases.
- Tests/fixtures: v2 fixtures, contract/analyzer/policy/worker/privacy-boundary tests, and M12 static contracts.

## Verification actually run

- Red checkpoint: focused Jest failed 5/5 suites and 21/21 tests for the absent v2 modules/M12.
- Focused Unit 4/static migration Jest: 6 suites/34 tests passed.
- First-review correction checkpoint: focused Jest 6 suites/42 tests and focused vision-runtime PGlite 26/26 passed.
- Final focused correction Jest: 4 suites/50 tests passed.
- Final focused vision-runtime PGlite: 31/31 tests passed.
- All relevant Phase 9 Jest after final corrections: 16 suites/132 tests passed.
- Full Phase 9 PGlite database suite after final corrections: 57/57 passed.
- Repository `npx.cmd tsc --noEmit`: passed.
- Strict dedicated vision worker TypeScript with ES2022/DOM/Bundler settings: passed.
- Continuity validator and `git diff --check`: passed at correction closeout.

## Security, privacy, and transaction evidence

- Store A/Store B relationship mismatch rolls back; authenticated roles cannot execute vision RPCs or select evidence tables.
- Same-worker reclaim increments attempt and rotates the opaque token; stale context/persist/fail calls write nothing.
- Result, observations, candidates, input/session counters, and job completion commit in one transaction; a deliberate candidate uniqueness failure rolls back newly inserted evidence.
- Exact hash/attempt/worker/token replay returns the stored summary without duplicates; a changed hash or attempt cannot overwrite evidence.
- Evidence rejects update/delete; DTO/static scans reject private media/provider fields and real-provider/metadata imports.
- No inventory, listing, metadata-attempt, or marketplace-event count changes across completion.

## First independent-review corrections

- M12 validates the authoritative job row before any relationship lookup or job mutation: job ID/kind, `processing` state, attempt, worker, opaque lease-token hash, and unexpired lease must all match.
- Missing/invalid input, session, media, entity-type, or cross-store relationships reconcile only that current `vision_extract` job to existing terminal state `resolved`, persist only bounded code `P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED`, clear all claim/lease fields, and leave every related tenant row unchanged.
- Reconciliation stores a bounded completion fingerprint on the job. Exact replay returns the same bounded summary; stale token, stale attempt, same-worker reclaim, or conflicting replay has no effect.
- The database, not the caller, computes canonical UTF-8 byte length and SHA-256 from `p_result::text`; the persistence RPC no longer accepts a caller-supplied result hash.
- Recursive database validation independently enforces the `p9-vision-v2` closed shape, warnings, timestamps, observations, geometry, bounded text, and active-content/path/URL/credential exclusions.
- Worker transport maps exact safe database codes to typed bounded outcomes; rejected RPC promises become retryable `P9_VISION_DATABASE_RETRYABLE`, unknown resolved database/domain detail becomes `P9_VISION_INTERNAL_PERMANENT`, and no raw identifiers, paths, tokens, SQL detail, or relationship detail crosses the response boundary.

## Final bounded correction pass

- PostgreSQL now derives retryability from the closed safe-code catalogue; the fail RPC no longer accepts `p_retryable`. Schema, media, relationship, security, and internal-permanent outcomes resolve without retry, while only approved analyzer/database availability codes schedule retry or dead-letter at attempt five.
- Rejected claim/context/persist/fail promises map to bounded retryable transport outcomes. Unknown resolved database/domain errors map to bounded permanent internal failure; explicit stale alone maps to stale, and persistence conflicts remain permanent reconciliation-required outcomes.
- TypeScript and SQL reject POSIX absolute, UNC, drive-letter, and traversal path-shaped evidence while accepting ordinary slash prose.
- Executable PGlite coverage now spans omitted/NULL arguments, NULL/nonexistent job IDs, every authoritative RPC, directly expired unreclaimed leases, database-owned retry classification, and exact canonical sizes of 262,143 accepted bytes and 262,145 rejected bytes.
- Git integration status: completed on `main` at `e9ba2d9be93e54c43e6b55a86eb5a168fe30b5ed`; `origin/main` matched at the Unit 4A session baseline.

## External state and limitations

Supabase project `ahntbtktjjmvfosgkmgn` was used only for the accepted pre-implementation read-only evidence. This implementation performed no Supabase SQL/RPC/Storage mutation and no deployment or provider call. M11/M12 are unapplied; services are undeployed; tests use PGlite and recorded fixtures, not a live Postgres readback or real model.

## Decisions, deviations, and residual risk

No accepted product decision was reopened. M12 keeps existing job/input/candidate states and M11 fencing. The fixture registry is deterministic and provider-free; real provider selection/fallback, representative-camera sizing, migration application, and deployment remain later gates. Independent review may require correction-only changes before any staging or commit authorization.

## Next authorized action

Unit 4 is complete and integrated. Unit 4A deployment-runtime scaffolding is tracked separately and awaits independent review. Do not apply M11/M12, deploy, configure secrets, call real providers, mutate Supabase/Storage, or begin another work unit without separate authorization.
