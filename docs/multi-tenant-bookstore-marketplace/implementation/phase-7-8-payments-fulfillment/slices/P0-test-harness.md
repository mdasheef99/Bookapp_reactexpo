# Slice P0: Test Harness, Gate and Facts Script

**Status:** brief, revised 2026-11-13 after Codex Sol's brief review ("ready after fixes",
10 findings, all applied: §8). Waiting for the owner's two answers (§6) before P0-1 is sent.
**Flow:** light ([build process](../BUILD-PROCESS.md) §5), size L, four units. Light flow
has no plan run: **this reviewed brief is the plan** (build process §3 step 3). The
builder starts with the tests named for its unit.
**Authority:** [build process](../BUILD-PROCESS.md) §1, §1.1 and §2;
[pilot overview](../pilot-cut/00-pilot-cut-overview.md) §2 (never-cut list) and §7 (P0
row); D-116. AGENT-WORKFLOW.md (on `phase9/slice8-providers`; read with
`git show origin/phase9/slice8-providers:docs/multi-tenant-bookstore-marketplace/implementation/AGENT-WORKFLOW.md`)
gives the durable rules and brief skeleton. The sources win over this file.

P0 adds no product behaviour, no migration for the dev project and no Edge Function.
Everything it builds runs on the local machine only.

## 1. Facts checked on 2026-11-13

| Fact | Value | Source |
|---|---|---|
| Dev project Postgres | 17.6 | read-only `SELECT current_setting('server_version')` on `ahntbtktjjmvfosgkmgn` |
| Dev project migrations | 213 rows in `supabase_migrations.schema_migrations`, latest `20261108143327` | same read |
| Dev project size | 157 tables in `public`; 1,490 functions in `public` and `marketplace_sec` | same read |
| Local migration files | 228 in `supabase/migrations/` (plus `LIVE_MIGRATION_HISTORY_2026-03-06.md`). Local file names and live versions are **not** in one-to-one correspondence (live versions are apply times) | `ls`; Sol finding 1 |
| Local Postgres | 18.4 (scoop `postgresql`) and, since 2026-11-13, **17.12** (scoop `postgresql17`, `~/scoop/apps/postgresql17/current/bin`), each with `initdb`, `pg_ctl`, `psql`, `pg_dump` | `postgres --version` |
| Schema dump | Taken 2026-11-13 by the owner with local `pg_dump` 17.12 (`--schema-only -n public -n marketplace_sec -n auth -n storage -n extensions`, owners and ACLs kept) through the session pooler, port 5432. 3,024,878 bytes, 61,533 lines, sha256 `02b24c8eb7ef8ce95d5773d27e4010327d8dab6a114545159a20675f8811ede8`. Held outside the repo at `C:\Users\user\Desktop\Bookconnect_phase_7\p78-baseline\dev-schema-2026-11-13.sql` until P0-1 stores it. Counts: 208 tables (public 156, marketplace_sec 15, auth 27, storage 10), 780 functions, 238 policies, 126 triggers, 342 indexes, RLS enabled on 194 tables, 0 `CREATE EXTENSION` (the `-n` filter leaves extensions out; §2 item 3 creates them). No `COPY` or `setval`; the 3 `INSERT` lines are inside function bodies. The Supabase CLI route was dropped because Docker Desktop's engine would not start | Haiku scan and manual check of the flagged lines |
| Secret-scan calibration | Plain word hits in this dump are not secrets: `client_secret` and `encrypted_password` are `auth` column names; `secret` and `Bearer` appear in a Phase 9 dispatch function that reads `vault.decrypted_secrets` at run time; `service_role` appears 773 times in grants. No JWT (`eyJ`), Cashfree or `sk_` value. P0-1's scan (§2 item 7) must match **values** (string literals shaped like keys, JWTs or connection strings), not identifiers, or it stops on this clean dump | manual check of lines 8121–8133, 18248–18249, 36490–36815, 37137 |
| Deno / Node / Supabase CLI | 2.9.5 / 22.13.0 / 2.20.12 | `--version` |
| Phase 9 patterns | `scripts/verify-phase9.js` (gate, `KNOWN_FAILING`, seconds per step); `supabase/tests/phase9/run-phase9-bookstore-first-postgres.ps1` (`initdb -A trust --no-sync`, `pg_ctl` with `fsync=off`, `CREATE DATABASE ... TEMPLATE`); `supabase/tests/phase9/databaseHarness.mjs` (`setActor` / `resetActor`) | `origin/phase9/slice8-providers` |
| Not to copy from Phase 9 | `phase6_baseline.sql` (partial snapshot with stubs, build process §1.1 item 2); bare `'npm'` passed to `spawnSync` in `verify-phase9.js --full` (fails on Windows without a shell) | build process; Sol finding 10 |

## 2. Baseline recipe (owner-reviewed; P0-1 implements it)

The baseline is a restore of the dev project's schema plus the migrations not yet in it.

1. **Export.** The owner runs a schema-only dump of the dev project (§6 question 2), so the
   connection password never leaves the owner. Together with it, a read-only export of
   `supabase_migrations.schema_migrations` (`version`, `name`) is stored as
   `supabase/tests/phase78/baseline/live-migrations-<date>.json`.
2. **Schema allowlist.** Restore only: `public`, `marketplace_sec`, `extensions`, and from
   `auth` and `storage` only the objects the restored schema depends on (for example
   `auth.users`, `auth.uid()`, `auth.jwt()`, `auth.role()`). P0-1 computes the dependency
   closure from `pg_depend` and function bodies, writes it to `baseline/allowlist.json`,
   and the owner reviews that file once. Every other Supabase-internal schema is left out.
3. **Extensions.** Each extension the allowlisted schema uses must exist in local
   Postgres 17 or have an owner-reviewed stub in `baseline/stubs/<extension>.sql`. Any other
   extension stops the build with `P78_UNSUPPORTED_DEPENDENCY <name>`.
4. **Roles.** Created before the restore with Supabase's attributes: `anon` and
   `authenticated` (`NOLOGIN`), `service_role` (`NOLOGIN BYPASSRLS`), `authenticator`,
   `supabase_admin` and `postgres` as owners, plus the harness-only `p78_admin_script`
   (`NOLOGIN`; used by the pilot's admin scripts). No role gets a password.
5. **Ownership, ACLs and default privileges** are restored as dumped (no `--no-owner`, no
   `--no-privileges`), so permission tests see the live grants.
6. **Data.** None. Settings rows the code reads are seeded from
   `baseline/seed-settings.sql` (synthetic values, owner-reviewed); later slices add their
   own seeds.
7. **Secret scan.** Before the dump is committed, P0-1 scans the SQL for `PASSWORD`,
   `secret`, `key`, JWTs, `vault.` contents, connection strings and anything shaped like a
   Cashfree or Supabase key; any hit stops with `P78_BASELINE_SECRET <line>` and the file is
   not written.
8. **Migration reconciliation (replaces "newer than the cut").** `baseline/manifest.json`
   lists every file in `supabase/migrations/` with its SHA-256 and one disposition:
   - `in_baseline`: matched to a live row by name (and version where the file carries it);
   - `pending`: no live row; applied after the restore, in file-name order;
   - `excluded`: never applied here, with a written reason.

   Every live row must also match a file or carry a written disposition. Any file or live
   row without a disposition, or any changed hash, fails the build with
   `P78_MIGRATION_UNRECONCILED <name>`. The manifest is written by P0-1 and reviewed by the
   owner; later slices add their new files as `pending`.

## 3. Contract table

| Producer | Consumer | What crosses | Rule at the boundary |
|---|---|---|---|
| P0-1 cluster | P0-2, P0-3, P0-4, later slices | A Postgres 17 cluster on a free port; template database `pilot_template` (baseline + `pending` migrations + test clock + seeds); roles of §2 item 4 | The template is never changed after it is built; nothing is connected to it when it is copied; each suite gets `CREATE DATABASE p78_<suite> TEMPLATE pilot_template`, then database settings and grants are reapplied |
| P0-1 | P0-4 | `manifest.json` and its reconciliation result | No hand-typed migration list; unreconciled = build failure |
| P0-1 actors | every SQL test | `withActor(client, { role, userId? }, fn)` | Runs `fn` as `anon`, a customer, another customer, a store owner, another store's owner, `service_role` or `p78_admin_script`; in `finally` it always runs `RESET ROLE` and clears every `request.jwt.claim.*` setting, even when `fn` throws |
| P0-1 limits | P0-4 | `maxParallelSuites` | `min(cpus - 1, floor(freeMemMB / 400), floor((max_connections - 10) / 3))`, at least 1; the cluster's `max_connections` is set explicitly |
| P0-2 test clock | P1a onward | `marketplace_sec.commerce_now()` (§4) | Deployed SQL returns `clock_timestamp()` directly; the test override is installed only by the harness, only in databases it created |
| P0-2 races | P2 onward | `holdThenRace(options)` (§4) | B is proven blocked by A through `pg_blocking_pids` before A ends; never `pg_sleep` or timing |
| P0-2 claims | P1b onward | `claimRace(options)` (§4) | `SKIP LOCKED` claims never wait, are disjoint, and a stale token is refused |
| P0-2 deadlock | P1b onward | `forceDeadlock` and `expectWholeRetry` (§4) | A forced `40P01` is retried as a whole transaction with unchanged identities |
| P0-3 offline | P3 onward | Deno test runner; Cashfree fixture loader; failure injection (§4) | Any network access fails the test; fixtures carry no keys, tokens or personal data |
| P0-4 gate | every unit after P0 | `node scripts/verify-phase78.js [--full] [--slice <id>]`; `node scripts/phase78-sql-facts.js <fn>` | Exit code 0 only when every step passes; seconds per step; `KNOWN_FAILING` starts empty |
| P0-4 coverage | every unit after P0 | `supabase/tests/phase78/never-cut-coverage.json` checked against execution reports | A mapped test that is missing, skipped, todo or known-failing fails the gate once its rule is due (§5) |

## 4. Helper contracts

**Test clock.**
- Deployed (created by P1a's migration, not by P0): `marketplace_sec.commerce_now()
  RETURNS timestamptz LANGUAGE sql VOLATILE AS 'SELECT clock_timestamp()'`; owned by the
  migration owner; `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`.
- Test override (P0-2): same signature, `VOLATILE`. Its state lives in **non-transactional**
  storage (sequences in schema `p78_test`, set with `setval`), not in a table: a statement
  that is already running, or blocked, sees a change made by another session the next time
  it calls the function. Two modes: `live` (`clock_timestamp()` plus an offset) and
  `frozen` (an exact instant, so tests can hit before, at and after a deadline exactly).
- Installer guard: refuses unless the database name starts with `p78_` or is
  `pilot_template`, and the cluster setting `p78.harness = on` (set by P0-1 at `initdb`).
  No client role can execute the setters; schema `p78_test` exists only in harness
  databases.
- Required test: B blocks on A's lock; the observer moves the frozen clock; A commits; B's
  statement, reading `commerce_now()` after its lock, sees the new time.

**`holdThenRace({ a, b, observer, lockKey, timeoutMs, afterBlocked, aEnd, order })`.**
`a(client)` opens a transaction and takes the lock, `b(client)` runs the statement that
must wait. The observer polls until `pg_blocking_pids(bPid)` contains A's PID (and, when
`lockKey` is given, `pg_locks` shows that advisory key held by A), failing after
`timeoutMs`. Then `afterBlocked(observer)` runs (for example moving the clock), then A
commits or rolls back (`aEnd`). Returns `{ aResult, bResult, bError, blockedConfirmed }`.
`order: 'both'` runs the race once each way. A self-test where B does not block must fail.

**`claimRace({ claimers, claim, expectDisjoint })`.** Runs claimers at once; asserts no
claimer appears in `pg_blocking_pids`, the claimed sets are disjoint, and finishing with a
stale lease token is refused.

**`forceDeadlock(a, b)` and `expectWholeRetry({ run, identityOf })`.** Produces a real
`40P01` between two sessions; the retry helper records every attempt in a test-only log
and asserts the transaction ran again from its start with the same identities (command
ID, idempotency key), and that no partial effect of the failed attempt remains.

**Failure injection (P0-3).** Harness-side only, never a hook in product code:
`failOnce({ table, op })` installs a one-shot test-only trigger that raises; `killMidway(client)`
terminates a backend from the observer while its transaction is open; `expireLease(...)`
moves the frozen clock past a lease. The product assertions that use them belong to
P1b (task framework and lease takeover), P5b (webhook single transaction) and P5c (poll
replay after interruption).

**Not automated** (build process §1.1 item 11): the real-phone sandbox payment (P4b) and
the key-rotation rehearsal (P7). The gate prints them as manual gates; it never marks them
passed.

## 5. Gate scope (P0-4)

**Fast** (every local commit): incremental typecheck with its own `tsbuildinfo` cache; the
Edge Functions reached from any changed shared module (from `deno info --json` and the
diff); Phase 7/8 Jest; the SQL suites of the slice given by `--slice` (default: the slice
named in the tracker); every never-cut test; the migration reconciliation of §2 item 8; the
line-ending check on files whose bytes matter.

**Full** (slice merge, push, deploy): everything from clean builds, including every
native-Postgres suite of Phase 7/8, the Phase 6 suites the SDD 01 §15 rework touches, and
the Phase 9 suites present on the branch, plus a clean build of every Edge Function.

**Both:** independent steps run in parallel up to `maxParallelSuites`; a step that builds
files another step reads finishes first. Each step prints its seconds.
`supabase/tests/phase78/budgets.json` holds the cold and warm times P0 measures (aim: about
3 minutes fast, 15 minutes full); a step over budget prints `BUDGET_EXCEEDED`, which is a
finding to fix and never a reason to skip.

**Coverage check:** every test ID in `never-cut-coverage.json` is looked up in the
execution reports of this run (Jest JSON, `deno test` JSON reporter, the SQL runner's
TAP output). Each rule has a `due_slice`; when `--slice` is that slice or a later one, every
mapped test must have run and passed. Missing, skipped, todo or known-failing fails the
gate, before the slice merges.

**Windows:** launch Node tools through their JS entry points with `process.execPath`
(`node_modules/jest/bin/jest.js`, `typescript/bin/tsc`); launch `deno`, `psql`, `pg_ctl`
and `initdb` by absolute path; anything that must go through npm uses `cmd.exe /d /s /c`
with each argument quoted. A spawn error (`ENOENT`) is a failed step, not a crash.
PowerShell steps run with `-NoProfile -ExecutionPolicy Bypass` and their exit code is
passed on. Output is read as UTF-8. Cleanup deletes only folders under the harness temp
root that carry the harness marker file.

## 6. Owner answers needed before P0-1 is sent

1. **Postgres 17.** Answered 2026-11-13: yes; 17.12 installed with scoop (§1).
2. **The dump.** Answered 2026-11-13: the owner ran it with local `pg_dump` 17.12 (§1).
   P0-1 takes that file as its input, checks its sha256 against §1, scans it, and only
   then stores it under `supabase/tests/phase78/baseline/`. Still to do in P0-1: the
   read-only `schema_migrations` export (§2 item 1).

## 7. Units and briefs

| Unit | One hard rule | Tests first |
|---|---|---|
| P0-1 database boundary: cluster, baseline, template, actors, limits | Every suite starts from an identical, faithful, secret-free schema with the live grants, and the template is never written after it is built | (1) two copies have identical schema hashes; (2) writing to the template after build makes the next copy fail; (3) an unreconciled migration file or a changed hash fails the build; (4) a secret-shaped line in the dump stops the build; (5) `withActor` leaves no role or claim behind when `fn` throws; (6) a role that the live grants refuse is refused here; (7) the cluster stops and its folder is removed at the end, also on failure |
| P0-2 clock and concurrency | A concurrency test can only pass if the ordering it claims really happened | (1) a race where B is not blocked fails; (2) a blocked statement sees a clock moved during `afterBlocked`; (3) frozen clock hits before, at and after a deadline exactly; (4) the override installer refuses a database not created by the harness; (5) `claimRace` fails when a claimer waits or two claims overlap; (6) a forced `40P01` is retried whole with the same identities |
| P0-3 offline execution | No test can reach the network, and injected failures happen exactly where asked | (1) a Deno test that opens a socket fails; (2) a Node test that calls `fetch` to a real host fails; (3) a fixture containing a key-shaped string is refused by the loader; (4) `failOnce` raises exactly once; (5) `killMidway` leaves no committed effect |
| P0-4 gate, coverage, facts, Windows | One command decides, from real execution results, on Windows | (1) a mapped never-cut test that is skipped fails the gate when due; (2) a missing tool reports a failed step with exit code 1, not a crash; (3) a repository path containing a space works; (4) a PowerShell step's non-zero exit fails the gate; (5) `phase78-sql-facts.js` prints the signature from the newest migration that defines a function, not an older one |

Order: P0-1 first (it settles the baseline), then P0-2 and P0-3 (independent), then P0-4.

**Brief for P0-1** (P0-2 to P0-4 get the same shape when P0-1 is merged):

```text
BUILDER (build). Repo C:\Users\user\Desktop\Bookconnect_phase_7\Bookconnect-sdd03 on its
Phase 7/8 branch; touch no other folder.
Forbidden: any change outside supabase/tests/phase78/; git writes; any connection to a
Supabase project; network except existing npm and deno caches; deploys; reading .env
files; printing or storing any password or key.

Goal and why     A disposable Postgres 17 cluster with one template database that matches the
                 dev project's schema and grants, so every Phase 7/8 suite starts from the
                 same faithful state in seconds.
Authority        BUILD-PROCESS.md §1.1 items 1-3, 6 (permission roles), 9; this file §2,
                 §3 rows P0-1, §5 Windows. Sources win.
Facts            §1 of this file. Binaries by absolute path from -PgBin or PATH; the server
                 must report 17.x or the run stops with P78_REQUIRES_POSTGRES_17.
Input            The owner's dump and live-migrations export in
                 supabase/tests/phase78/baseline/ (§2 item 1). Without them, stop and say so.
The hard rule    Every suite starts from an identical, faithful, secret-free schema with the
                 live grants; the template is never written after it is built.
                 States: no cluster -> create; --keep with unchanged dump hash, manifest,
                 tool versions -> reuse; any change -> rebuild; template has a connection
                 -> copy refused and the test fails; unreconciled migration -> build fails.
Start here       git show origin/phase9/slice8-providers: run-phase9-bookstore-first-postgres.ps1,
                 databaseHarness.mjs. Do not copy phase6_baseline.sql.
Tests            The seven P0-1 tests in §7, written first and seen failing first.
When stuck       Write the question in the report; never invent a design.
Report           supabase/tests/phase78/P0-1-report.md: verdict line, test output, the
                 allowlist and manifest for owner review, what was not run.
```

## 8. Review record

**Brief review:** Codex Sol, 2026-11-13, "ready after fixes": 1 blocker, 8 major, 1 minor.
All applied:

| # | Finding | Where fixed |
|---|---|---|
| 1 | A live version is not a cutoff for local file names | §2 item 8 (manifest with dispositions; unreconciled fails) |
| 2 | "Schema-only" is not a recipe; secrets and internals unaddressed | §2 items 2 to 7 |
| 3 | Clock volatility, visibility, privileges and exact boundaries unspecified | §4 test clock (non-transactional state, frozen mode, guard, required test) |
| 4 | Helper contracts incomplete | §4 (`afterBlocked`, `withActor` `finally`, `expectWholeRetry`) |
| 5 | Resource limits, `SKIP LOCKED` checks and failure injection had no owner | §3 P0-1 limits, `claimRace`, §4 failure injection; manual gates listed |
| 6 | Gate scope missing | §5 |
| 7 | Coverage by file existence; due only after merge | §5 coverage check (execution reports; due before merge) |
| 8 | Two units mixed rules | §7: actors moved to P0-1, coverage to P0-4 |
| 9 | Plan run in a light-flow unit | Header: the reviewed brief is the plan |
| 10 | Windows safety without refusal tests | §5 Windows; §7 P0-4 tests (2) to (4) |
