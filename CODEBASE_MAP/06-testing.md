# 06 — Testing

**Last checked:** 2026-10-24, against the code and the documents it cites.

This file says how to test, not what passed. Results are recorded in the
relevant tracker.

## Tools

| Layer | Tool | Where |
| --- | --- | --- |
| App and Edge-function unit tests | Jest (`jest-expo` preset) + React Native Testing Library | Any `*.test.*` / `*.spec.*` JS or TS file (Jest `testMatch`), excluding `e2e/` and `.spec/` scratch copies |
| Phase 9 database tests (in-memory) | Node test runner + PGlite (Postgres in WASM) | `supabase/tests/phase9/*.integration.test.mjs` |
| Phase 9 database tests (real Postgres) | PowerShell runner with a disposable local Postgres; needs `initdb`, `pg_ctl` and `psql` on PATH | `supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1` |
| Phase 6 database tests | SQL integration scripts and PowerShell concurrency scripts | `supabase/tests/phase6_*` |
| Clubs database tests | Node runner that needs **Docker** (starts a disposable PostGIS 17 container) | `supabase/tests/clubs/` |
| Library organising database tests | Node test runner with an existing PostgreSQL runtime and Node `pg` module; creates a disposable loopback cluster | `supabase/tests/library/libraryOrganising.postgres.test.mjs` |
| Migration static tests | Jest | `supabase/migrations/__tests__/` |
| Web end-to-end | Playwright (default suite: web export served on `127.0.0.1:8084`; Library accessibility suite: Expo dev server) | `e2e/` |

## Jest setup

- Config is in `package.json` (`jest` key): `jest-expo` preset, `@/` alias,
  `e2e/`, `.spec/`, `.worktrees` and `.wt` ignored, legacy Deno URL imports stubbed through
  `supabase/functions/__tests__/support/edgeFunctionHttpStubs.ts`.
- `jest.setup.ts` mocks Reanimated, the URL polyfill and Sentry, and sets test
  env vars (Supabase test URL/key, `EXPO_PUBLIC_DEV_SKIP_AUTH=false`,
  `EXPO_PUBLIC_APP_ENV=development`), and pins the ambient font scale to 1.
- Module mocks: root `__mocks__/` (Expo modules, AsyncStorage, MMKV, router,
  gesture handler, safe area) and `src/lib/__mocks__/supabase.ts`.

## Commands

On Windows use `npm.cmd` / `npx.cmd` from PowerShell.

```powershell
npm.cmd test -- --runInBand                       # all Jest tests (slow)
npm.cmd test -- --runInBand <path-or-folder>      # focused
npx.cmd tsc --noEmit                              # type check (not Edge Function entry points; see below)
npm.cmd run export:web                            # production web export
npm.cmd run test:e2e:web                          # build web + Playwright
npm.cmd run e2e:library-a11y                      # separate Library accessibility suite
npm.cmd run validate:auth-config                  # bypass policy for preview/production
```

`tsconfig.json` excludes `supabase/functions/` from discovery and no script runs
`deno check`, so neither root `tsc` nor CI type-checks Edge Function entry points
(`supabase/functions/<name>/index.ts`); only manual `deno check` runs recorded in
trackers do. Rely on their Jest tests. Shared server code under
`_shared/imageInventory/` is still checked when `workers/` import it, and each
worker's own `tsconfig.json` includes the shared folders it uses.

`test:e2e:web` first runs `npm run e2e:build:web` (`scripts/e2e-build-web.js`),
which produces the `dist/` that Playwright serves.

`e2e:library-a11y` uses `playwright.library-a11y.config.ts` and only
`e2e/library-a11y.spec.ts` (excluded by the default config). It starts or reuses
an Expo web dev server on port 8083 (`LIBRARY_A11Y_PORT` overrides it); the
fixture host and placeholder-key prerequisites are in that config. The suite
includes labels/collections, modal focus, chip identity/scope, double tap and
doubled web text in 560/640 px windows. HTTP fixtures intercept external reads
and refuse writes; these checks do not replace native TalkBack/VoiceOver and
gesture acceptance. Native-scale layout simulations live in
`notes-swipe/__tests__/noteSwipeFix7Layout.test.tsx`.

**Route folders contain brackets** (`(store-owner)`, `[sessionId]`), which break
Jest's regex path matching. Use `--runTestsByPath`:

```powershell
npm.cmd test -- --runInBand --runTestsByPath "app/(store-owner)/__tests__/_layout.test.tsx"
```

Database and worker commands:

```powershell
npm.cmd run build:phase9:metadata-worker           # REQUIRED first: several DB suites import the gitignored .phase9-dist/ output
npm.cmd run test:phase9:db                        # PGlite Phase 9 DB suites (*.integration.test.mjs)
npm.cmd run test:phase9:u8b:postgres              # real Postgres runner (disposable DB)
npm.cmd run test:phase9:u8c:postgres              # same, adds -IncludeU8C
npm.cmd run test:phase9:structural-metadata       # builds metadata worker, runs its DB test
npm.cmd run test:phase9:unit7b-cross-layer
npm.cmd run test:clubs:l4                         # Clubs DB suites (also :b02, :f04, :wave2, :rls)
node supabase/tests/clubs/clubsL4Runner.mjs tc04  # Clubs book-workflow suite; NOT in the default run
```

Phase 6 database tests (`supabase/tests/phase6_*` SQL and PowerShell scripts)
have no npm wrapper; read each file's header for prerequisites and run them
only against a disposable database with explicit authorization.

**Phase 9 DB tests apply migrations from explicit lists, never the whole
migrations folder.** The shared PGlite list is `phase9MigrationNames` in
`supabase/tests/phase9/databaseHarness.mjs` (by default it stops at an early
migration unless a suite passes `throughMigration`), several fixtures and suites
apply further migrations themselves (for example `unit7aFixture.mjs`,
`phase9EditionExplicitMatching.integration.test.mjs`), and the PowerShell runner
has its own `$migrations` branches. A new Phase 9 migration must be added to the
lists of the suites that need it, or they silently run without it.

The real-Postgres runner accepts the switches `-IncludeU8C`,
`-IncludeUnit6gBaseline`, `-IncludeMediaCorrection`,
`-IncludeDuplicateConfirmation`, `-IncludeEditionPicker` and
`-IncludeOpenLibrary`; read the parameter block and migration branches before
use. `-IncludeOpenLibrary` implies `-IncludeEditionPicker`, whose migration list
also includes the Open Library and typed-ISBN lookup SQL files.

Library organising verification has no npm wrapper; run it directly with an
existing runtime configured:

```powershell
$env:LIBRARY_PG_BIN = '<existing PostgreSQL 17 bin directory>'
$env:LIBRARY_PG_TOOLS_NODE_MODULES = '<existing node_modules directory containing pg>'
node --test supabase/tests/library/libraryOrganising.postgres.test.mjs
```

The harness loads `supabase/tests/library/libraryOrganisingBaseline.sql` and
the book-label and note-collection migration files named in 03. Optional
`LIBRARY_LABELS_MIGRATION` and `LIBRARY_COLLECTIONS_MIGRATION` override those
SQL paths. It starts `initdb`/`postgres` on `127.0.0.1` at an ephemeral port,
then stops the cluster with `pg_ctl` and removes its temporary directory.
The baseline includes the existing `reading_notes_manage_revision` binding and
`library_manage_note_revision` function; the organising suite verifies that note
edits still advance the server version after both migrations.

`phase9CompactReviewScript.integration.test.mjs` loads the production compact
review validator and shared app fixtures directly from TypeScript, then checks
every non-null script against `phase9_owner_ux_language_script` in the disposable
PGlite database through the edition-picker migrations. It is included by
`test:phase9:db` and can run alone with `node --experimental-vm-modules --test
supabase/tests/phase9/phase9CompactReviewScript.integration.test.mjs`.

`supabase/tests/phase9/phase9OpenLibraryRequestSpacing.test.mjs` is not matched
by any npm script; run it directly with `node --test` after building the
metadata worker. It uses mocked HTTP and no database.

Phase 9 documentation validators (run after any Phase 9 doc change):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/scripts/validate-phase9-continuity.ps1
```

The continuity validator also runs `validate-phase9-migration-set.ps1`, passing
the paths and tracker contents it needs; do not run that helper on its own.

## Architecture guard tests

Some tests read the source text of a whole module and fail on forbidden
patterns. Read them before adding code to these modules:

- `src/features/imageInventory/__tests__/privacyArchitecture.test.ts` — in
  image-inventory runtime code: no AsyncStorage / MMKV / query persistence, no
  `supabase.from(`, no `console.log` / `console.warn` / `console.error`, no Sentry
  capture calls.
- `ownerCorrectionArchitecture.test.ts`, `ownerInventoryReadArchitecture.test.ts`,
  `unit6fArchitecture.test.ts` (same folder) and
  `src/features/storeView/__tests__/storeViewManagementArchitecture.test.ts`.
  The correction guard scans non-test, non-mock `src/` files for removed variant-client
  symbols and RPC names, and checks that their server functions remain in SQL.
- `src/features/marketplace/services/__tests__/consumerDiscoveryService.test.ts`
  asserts consumer discovery never reads `store_inventory`.

`npm.cmd run lint:library` uses `eslint.config.js` and
`eslint-rules/book-section/config.js`. The `STRICT_FILES` list includes note
search, the swipe route/deck components and hooks, and the On-this-day helper
and component. In strict files, `no-raw-style-values`,
`require-accessible-name` and `no-fabricated-ratings` are errors; other scoped
files receive warnings, with raw-style checks disabled for `RAW_VALUE_ALLOW_LIST`.
`eslint-rules/book-section/__tests__/config.test.js` checks the exact ordered
strict list, path existence and resolved rule severity.

## CI (GitHub Actions)

| Workflow | Runs on | Does |
| --- | --- | --- |
| `.github/workflows/clubs-app-validation.yml` | PRs to `main`, pushes to `main` and one long-lived feature branch, manual dispatch | `npm test -- --runInBand`, `npx tsc --noEmit`, web export |
| `.github/workflows/phase9-worker-container-smoke.yml` | PRs to `main` matching its path filter, manual dispatch; its push trigger is pinned to one old branch, and the filter omits `workers/phase9-publication-worker/` | `npm run smoke:phase9:worker-containers` |

Read the workflow file for exact triggers before relying on CI coverage.

## Where tests live

| Area | Tests |
| --- | --- |
| Root/navigation | `app/__tests__/_layout.test.tsx`, `app/(tabs)/__tests__/_layout.test.tsx`, `src/lib/__tests__/` |
| Auth, Library and Profile routes | `app/(auth)/__tests__/`, `app/(tabs)/library/__tests__/`, `app/(tabs)/profile/__tests__/` |
| Auth | `src/application/auth/__tests__/`, `src/features/auth/**/__tests__/` |
| Store Owner routes | `app/(store-owner)/__tests__/` |
| Stores | `src/features/stores/**/__tests__/` |
| Image inventory (client) | `src/features/imageInventory/__tests__/` |
| Image inventory (server/workers) | `supabase/functions/__tests__/phase9_*.test.ts`; DB suites in `supabase/tests/phase9/` |
| Other Edge Functions | `supabase/functions/__tests__/` (store application/profile/review, wishlist notify, Clubs membership limits and downgrade grace period, commerce task worker auth); OCR fallback in `supabase/functions/ocr-fallback/__tests__/` |
| Store View | `src/features/storeView/__tests__/`, `e2e/store-view-*.spec.ts` |
| Marketplace + commerce | `src/features/marketplace/*/__tests__/`, `supabase/functions/__tests__/commerce_task_worker_auth.test.ts` |
| Clubs | `src/features/clubs/**/__tests__/`, `app/(tabs)/clubs/__tests__/`, `supabase/tests/clubs/` |
| Library | `src/features/books/**/__tests__/` |
| Exchange | `src/features/exchange/**/__tests__/`, `app/(tabs)/exchange/__tests__/` |
| Scripts | `scripts/__tests__/` |

## Verification habits

- Run the narrowest relevant tests first, then TypeScript.
- Database, RLS or security changes need migration tests or DB suites **and** a
  read-only Supabase MCP check of the live project.
- Edge Functions using the service role need tests for auth source, store/platform
  role checks and that request bodies cannot choose the actor.
- AI/provider behaviour is tested with recorded fixtures and schema checks, never
  exact model text.
- Dev auth bypass is never evidence of authorization.
- Never report a test as passed unless it was run in that session.
