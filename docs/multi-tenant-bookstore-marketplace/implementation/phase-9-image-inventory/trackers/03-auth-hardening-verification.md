## 2026-10-11 - Compatible runtimes deployed; provider and operational gates pending

Current status: `feature_published_runtimes_deployed_provider_gate_pending`. Phase 9 / Unit 6G remains active; Tasks 1-8 retain their local approval boundaries. The Owner explicitly confirmed the exact two-service deployment after the earlier approval-review rejection. That rejection and earlier deployment holds below are historical; this entry owns the current handoff.

Render `phase9-metadata-worker` is LIVE at `f2d47cb1d015c8b93ded58baff35f125f99ad52c` (deployment `dep-db5b71ajnfac739scpag`). One cached deployment used the existing Free service, one instance, main, and autoDeploy off. GET /health and /ready returned HTTP 200; readiness is process-level evidence, not live provider/database proof. Executable source equals independently approved `47207b7385ee4ae37e01c48b7dba0738abb53389`; their differences are documentation only.

Supabase `phase9-owner-ingestion` is ACTIVE v15 on verified Bookconnect_reactexpo / `ahntbtktjjmvfosgkmgn`, with verify_jwt=true. Deployment followed worker commit/health verification. Prepared source had 38 files; all 35 returned runtime/configuration files match it exactly. Three type-only dependencies are absent from the deployed readback; the emitted runtime graph is complete. CORS OPTIONS passed and an unauthenticated POST was rejected with HTTP 401.

M65-M72 remain applied and byte-preserved; no migration was created or applied in this checkpoint. Read-only preservation counts remain books 45, candidates 173, inventory 21, edition states 0. The only service mutations were the two runtime deployments. Plan, instance count, automatic deployment, secrets, permissions, schedules, Auth, Storage and business data were not edited.

Provider-result retention remains disabled: production has no verified permission callback. Exact next action: investigate the configured Google Books retention permission read-only and establish acceptable evidence before any explicit edition request or result storage. Authenticated Search Books/selection, Save/resume/Add, expiry/cleanup/recovery, browser/device accessibility and controlled operational acceptance remain unverified. Deployment success does not complete those gates. No product tests were repeated for this documentation closeout; the approved source CI remains applicable. [Activation receipt](36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - Runtime activation blocked by deployment approval review

Phase 9 / Unit 6G remains locally implemented and published; current runtime activation status is feature_published_runtime_activation_approval_blocked. The Owner replied "ok please proceed it then" to the reviewed deployment sequence. Fresh readback confirmed both GitHub refs at f2d47cb1d015c8b93ded58baff35f125f99ad52c; its only differences from independently approved 47207b7 are twelve documents. Executable source and migrations are identical. The earlier successful source CI and independent review remain applicable; no product test was rerun in this checkpoint.

Immediate preflight verified Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn / ACTIVE_HEALTHY and M72 version 20261010200655, both expected functions, private service execution=true and public authenticated execution=false. Render target remains phase9-metadata-worker / srv-d9sqfdvqj5pc73dc66fg in workspace tea-d9j67irtqb8s739ritc0, one Free instance, main, autoDeploy off and the existing Dockerfile/health contract. No new migration or data mutation occurred.

One Render trigger_deploy attempt with clearCache=false was REJECTED by automatic approval review; it returned no deployment ID. Its stated reason was that the earlier instruction to stop before deployment requires exact-action confirmation despite the subsequent general proceed reply, and deployment may disrupt the live worker. Do not retry through another interface or bypass this rejection. No Render deployment began and no Owner Edge deployment was attempted. Browser inventory timed out and reset its kernel before any UI access or action.

The corrected Owner API manifest was freshly reverified: all 38 files / 182814 source bytes equal immutable 47207b7, manifest SHA-256 6baf912a93ee21adb2680a06a5ebcf7bc5d1c3d07264fd6cc4234e1fbf565aae, project/function/entrypoint/import-map exact and verify_jwt=true. Render MCP deploys the configured branch head rather than accepting a commit pin, so the proposed actual Render revision is f2d47cb with the same reviewed executable source. Runtime deployment order remains metadata worker, verified commit/health, then Owner API. Provider-result storage remains disabled without verified permission.

Exact next action: obtain the explicit confirmation required by automatic approval review for ONE existing Free Render metadata-worker deployment from main/f2d47cb, preserving cache, plan, instance count, configuration and secrets; after commit/health verification, deploy the verified Owner API to the exact development project with JWT enabled. No API deployment may precede the compatible worker. No provider request, job endpoint, inventory/Auth/Storage/billing/configuration mutation or Git publication occurred in this checkpoint. The authorization block is not a code defect or failed product test. Earlier dated deployment holds and preflight entries retain historical provenance.

[Deployment evidence](36-owner-edition-picker-publication-deployment.md).

## 2026-10-11 - M72 applied; backend activation preflight

Phase 9 / Unit 6G remains feature_published_runtime_pending. Under the Owner's current step-by-step backend authorization, M72 is APPLIED_VERIFIED on Bookconnect_reactexpo / ahntbtktjjmvfosgkmgn as live version 20261010200655. Its archived SQL equals the reviewed file and its original SHA-256 is preserved. M65-M71 source bytes and existing Phase 9 function definitions/ACLs are unchanged.

Rollout order is M72, compatible Render metadata worker, then the Owner Edge API. The old worker's claim RPC has no edition-operation filter and its decoder cannot handle edition_options contexts, so the new API must not enqueue those jobs until the new worker is healthy. No edition jobs exist at this checkpoint. Owner API remains ACTIVE v14; metadata runtime remains bb91428048ca9028c5592cbbc52c982bd6843946. The Owner's explicit stop before Render deployment remains in force.

A fresh ordinary Deno check exposed extensionless imports newly reached by the API. The bounded local correction adds seven .ts suffixes in contracts/metadata.ts and contracts/providerReuse.ts, naming the same existing targets without changing metadata, ranking, cover, authorization or retention behavior. Fresh verification passed Deno check --no-lock, two existing Jest suites / 49 tests, worker build plus 14 structural tests, and whole TypeScript. GPT-6 Luna/max independently APPROVED this bounded correction at 47207b7385ee4ae37e01c48b7dba0738abb53389 and reran the same relevant gates, including emitted CommonJS import checks. The atomic non-force push succeeded and both GitHub main/codex/edition-picker read back at that reviewed source commit. Fresh source CI run 38083807305 completed SUCCESS: full repository test, TypeScript and production web-export steps passed. Fresh CI counts were not independently recounted because log download returned HTTP 403; local 49/49 and structural 14/14 counts are separately verified.

Exact next action: obtain the Owner's final Render decision, then perform one controlled manual deployment of reviewed/published source 47207b7 to the existing Free metadata service; verify its commit and health before deploying the prepared Owner API bundle with verify_jwt=true. The explicit Render hold keeps both runtime deployments unperformed at this checkpoint. Provider-result retention remains disabled without verified permission; registry flags and cache headers are not authorization. No Edge or Render runtime deployment, provider request, inventory/Auth/Storage/configuration/billing change occurred. [Exact application, rollout, artifacts and verification evidence](36-owner-edition-picker-publication-deployment.md). Earlier dated records below are historical.

# Auth Hardening Verification

## 2026-10-11 - M72 bounded local superseded-job security matrix

| Boundary (picker §§4.3/5/9; MAS-17) | Fresh local evidence |
| --- | --- |
| Service-only terminalizer/wrapper | pg_proc privilege checks: service_role allowed; anon/authenticated denied |
| Reclaimed/wrong claim evidence | Old token, worker and attempt reject; only current claim terminalizes |
| Stable response-loss replay | Identical claim returns same terminal outcome without another effect |
| Current/missing request protection | Current and selling-only requests remain in progress; no unproved cancellation |
| Newer request/late response | New request stays pending; late finalized/completion results remain fenced |
| Normally returned stale worker result | Actual fifth claim closes once; one recorded provider request and no stale choices saved |

Eight disposable M72 cases pass; 104 total SQL checks include disclosed historical stacks. No live/native race proof is claimed for M72. M65–M71 hashes are unchanged and applied; M72 is byte-preserved CREATED_LOCAL / NOT_APPLIED. [Migration/worker evidence](36-owner-edition-picker-publication-deployment.md). GPT-6 Luna/max review of 905b1f9 required the returned-stale correction; the follow-up and aggregate at de97bed are independently APPROVED and published to main/codex/edition-picker. Render remains held. No shared grants, Auth, Storage, data or provider mutations.

## 2026-10-08 - Task 6 M70 bounded local confirmation verification

Scope: picker §§6-7/9, MAS-02/03/15/17 and EP-AC11/19 only. The M70 disposable
full-stack suite verifies three private postgres-owned SECURITY DEFINER helpers
with empty search_path and no PUBLIC/anon/authenticated/service_role execution.
Existing choices/select RPC signatures remain authenticated-only; another store
Owner cannot read/replay the card. Projection exposes only a boolean, not Owner
IDs or private attribution; both strict request schemas reject a forged flag.

A real pre-M70 choice and receipt survive forward installation with a warmed
reader; stored JSON remains untouched. Superseded old/new receipts cannot claim
current confirmation. No read creates a review, changes version counters or grants
Add eligibility. All 20 M70 cases PASS; 32 M69 cases retain their original harness.
[Detailed evidence](02-implementation-and-verification.md#2026-10-08---task-6-confirmation-correction-local-completion).
No live permissions/Storage/provider test, independent-connection race or migration
application is claimed. M65-M69 are unchanged; M65-M70 remain NOT_APPLIED.
Earlier unrelated verification checkpoints below retain their original scope.

> **Current local PostgreSQL verification checkpoint (2026-09-12; supersedes the prior correction-only gate):** F-01 remains retracted; F-02 and F-03 remain corrected locally. Focused Jest passed 4 suites/181 tests, including the 3 lifecycle tests, and the in-memory PGlite fixture passed 5/5. The Owner-authorized disposable PostgreSQL 18.4 harness then ran at `127.0.0.1:55461` with data directory `C:\Users\user\AppData\Local\Temp\bookconnect-u8b-pg-unit6h-verify-20260912` and PID-scoped database `bookconnect_u8b_22652`. It applied the disposable baseline and M01–M60, passed `UNIT6H_DUPLICATE_CONFIRMATION_REAL_POSTGRES_CONCURRENCY_PASS` using independent connections, and passed the existing `U8B_REAL_POSTGRES_ACCEPTANCE_PASS` regression. Teardown was verified: the database/cluster directory is absent, the port has no listener, and no matching postgres process remains. M52–M59 are unchanged; M60 remains local and was not remotely applied. No remote database/Storage or application data was touched; no deployment, dispatch change, development-data deletion, staging, commit, or push occurred. Connected Edge/Storage verification remains unrun. Prior screen act/open-handle warnings remain historical unresolved evidence and did not affect these database checks. Next: review this local PostgreSQL proof and separately authorize connected Edge/Storage verification. No product behavior or inventory duplicate policy changed.


**Status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Date:** 2026-08-29

## Unit 6G M54 lifecycle/grant verification — 2026-08-29

- Exact project: `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`, healthy
  PostgreSQL `17.6.1.063`; M54 live once as `20260829142337` after M53.
- New internal session predicate/lock/sanitizer functions are postgres-owned,
  fixed-empty-search-path, and not executable by `PUBLIC`, `anon`,
  `authenticated`, or `service_role`.
- Current final detail/Save/Add/Remove and batch-card definitions contain the
  expected lifecycle or read-only projection fence. Existing public grants are
  preserved exactly.
- Connected transaction-local Owner proof on one existing closed candidate:
  Save/Add/Remove each `P9_STATE_CONFLICT`; detail/batch mutation actions absent;
  zero candidate/session-count/inventory/audit/event/idempotency effects.
- Advisor rerun returned broad existing RLS/performance notices. M54 creates no
  table, RLS policy, index, or other advisor-target object. No advisor remediation
  was in this bounded function-only scope.
**Branch:** `codex/auth-hardening-core`
**Authority:** Work Units 1 and 2 only; no external mutation

## Phase 9 Unit 6H security correction checkpoint — 2026-09-12

The read-only security diff scan covered 25 changed/new Unit 6H
implementation, SQL, Edge, client, and test artifacts. The subsequent bounded
correction pass resolved its actionable findings:

- F-01 `[RETRACTED]`: M58's nested function catches the legacy constraint
  identity and returns the duplicate receipt consumed by M60. The strengthened
  fixture proves `confirmation_required`, job resolution at attempt 1, and exact
  replay without the retry/dead-letter path.
- F-02 `[CORRECTED LOCALLY]`: M60 now exposes only two minimal postgres-owned,
  empty-search-path, service-role-only public `SECURITY INVOKER` delegates to the
  private implementations. Authenticated SQL callers remain denied.
- F-03 `[CORRECTED LOCALLY]`: duplicate Proceed/Cancel now has local session and
  controller lifecycle fencing plus response-session validation. The focused
  lifecycle suite covers rerender/session change, unmount, and response mismatch.

The scan confirmed no additional authenticated-Owner authorization bypass,
tenant-isolation bypass, service-only RPC grant bypass, Storage replacement,
Close bypass, lock-order deadlock, retry/dead-letter bypass, or sensitive-field
projection issue in the reviewed diff. Coverage is **partial** because no
connected PostgreSQL/Edge runtime was available in this bounded review.

Correction verification passed focused Jest (4 suites/181 tests, including the
three duplicate-resolution lifecycle tests), the duplicate-confirmation fixture
(5/5), and TypeScript validation. M60 was not remotely applied; no deployment,
remote database/Storage or application-data mutation, dispatch, or development-
data deletion occurred. The subsequently authorized disposable PostgreSQL run passed its
independent-connection Unit 6H concurrency proof and existing regression
acceptance, then fully tore down. Connected Edge/Storage verification remains a
rollout gate and requires separate authorization.

## Scope and completion

- Centralized pure production-bypass policy and build validator; static exports no longer force bypass.
- Zustand canonical session/status with derived user selectors and the unchanged `useAuth` facade.
- Subscribe-before-restore root bootstrap with timeout, returned/rejected error, duplicate-call, auth-event version, and unmount guards.
- Application coordinator with serialized prior-user QueryClient/mutation/commerce cleanup before replacement-user exposure.
- One current-device logout controller with concurrent-call deduplication and a derived single-key Supabase SDK failure fallback.
- Root initialization-error retry while preserving login, authenticated routes, and the setup-profile exception.

Secure persistence, Android backup, broad profile routing, OTP UX, M09, Phase 9 runtime, and external mutations were excluded.

## Verification actually run

- WU1 focused: 4 suites/22 tests passed.
- Auth-focused complete set: 18 suites/98 tests passed.
- TypeScript passed; production-mode auth validation passed; bypass-disabled Expo web export passed.
- Unfiltered Jest executed 1,025 passing tests/144 passing suites but exited nonzero on three pre-existing fixture-only modules discovered as empty suites.
- Fixture/E2E-excluded full Jest passed 1,024/1,025 tests and 143/144 suites; one unrelated ClubManageScreen case exceeded five seconds. Its complete 41-test suite immediately passed in isolation, including that case in 1.193 seconds. No auth or commerce regression failed.
- The repository has no configured lint command.

## Logout and residual risk

Installed Supabase JS 2.89.0 source confirms `signOut({ scope: 'local' })` performs a network request. A non-401/403/404 error returns before SDK session removal. Explicit logout therefore removes only the derived `sb-<project-ref>-auth-token` key when the SDK returns or throws an error. Stored values are never logged.
If that targeted storage removal itself fails, privacy cleanup still completes but logout rejects with a sanitized error instead of reporting success.

Existing unencrypted MMKV persistence and the no-op auth lock remain unchanged. Native/offline testing, remote EAS environment verification, secure persistence, Android backup, authoritative profile completion, and OTP UX remain outstanding.

## External state and next gate

No database, Supabase, Storage, migration, provider, deployment, or other external mutation occurred. Supabase MCP was not required; SDK behavior was verified from the installed package source.

No next work unit is authorized. Separate authorization is required for M09, remaining auth/security work, or Phase 9 runtime.

## Core final-gate corrections

The independent final gate found and the authorized correction pass resolved two core issues:

- Logout now records a non-secret pending-deletion marker before SDK sign-out, retries the exact Supabase token-key deletion after a double failure, blocks restart restoration until deletion succeeds, and exposes sanitized retry handling at both profile logout surfaces and the root recovery screen.
- Identity replacement now fails closed when prior-user cleanup reports failure, retains the blocked replacement session for an explicit root retry, and never exposes the replacement identity before a successful cleanup pass.

Correction verification passed 11 focused suites/84 tests, isolated TypeScript, and `git diff --check`. A correction-only independent review ran 7 suites/52 tests and returned `APPROVED`. No secure-persistence, OTP, profile-routing, Phase 9 runtime, migration, database, Supabase, Storage, provider, or deployment work occurred.
