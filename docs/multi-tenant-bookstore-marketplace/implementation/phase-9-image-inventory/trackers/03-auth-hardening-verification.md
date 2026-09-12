# Auth Hardening Verification

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
