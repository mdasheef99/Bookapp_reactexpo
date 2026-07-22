# Auth Hardening Verification

**Status:** `auth_hardening_core_wu1_wu2_locally_complete`
**Date:** 2026-07-22
**Branch:** `codex/auth-hardening-core`
**Authority:** Work Units 1 and 2 only; no external mutation

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
