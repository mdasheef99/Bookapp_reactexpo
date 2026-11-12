# Phase 7/8 Build Process

**Adopted:** 2026-11-13, by the owner (decision D-125). Process only: no status, no product
behaviour and no authority. Those stay with ACTIVE.md, the SDDs, the pilot cut and the
owner.

**Builds on** `AGENT-WORKFLOW.md` (adopted 2026-11-10; today on branch
`phase9/slice8-providers`, not yet on `main`). Its nine durable rules, unit flow, plan
template and brief skeleton apply here unchanged, except where this file says otherwise.
This file adds what is specific to Phase 7/8: the verify and facts commands, two flows by
risk, the model roles, and which pilot slice uses which flow. Model roles are written down
here, not kept in one machine's notes, so every session follows the same ones; update this
file when the models change.

---

## 1. Commands

Built in pilot slice P0 ([overview §7](./pilot-cut/00-pilot-cut-overview.md)), modelled
on Phase 9's.

| Command | Does | When |
|---|---|---|
| `node scripts/verify-phase78.js` | Starts the disposable Postgres, applies the migrations, runs the Phase 7/8 SQL suites with the test clock, the Jest suites, `deno check` on the Edge Functions and the migration-set check | Must pass before every local commit |
| `node scripts/verify-phase78.js --full` | The above, plus the whole Phase 6 and Phase 9 suites the Phase 6 rework touches, and a clean build of every Edge Function | Before every slice merge, push or deploy |
| `node scripts/phase78-sql-facts.js <fn>` | Prints a function's signature, arguments and return shape from the latest migration that defines it | Every fact in a brief (rule 6) |

A model's "tests pass" is not evidence; the command's output is.

### 1.1 Test harness (built in P0)

Reviewed by Codex Sol on 2026-11-13 ("sound after changes"; all its changes are below).
Phase 9's harness is the starting point, with these differences:

1. **Native disposable Postgres is the main harness.** One cluster per verify run
   (`initdb`, `fsync` off, a free port), torn down and checked at the end; `--keep` reuses
   a warm cluster locally only after checking that the baseline, migrations and tool
   versions are unchanged. PGlite is used only for single-connection logic tests: it has
   one connection, so it cannot run the race and lock tests.
2. **A faithful baseline, then one migration chain.** Phase 9's `phase6_baseline.sql` is
   a partial snapshot with stubbed helpers, so it is not reused as is. P0 writes a
   commerce baseline that matches the live Phase 6 and Phase 9 schema the pilot touches,
   records which migrations it already contains, and applies every later migration from
   `supabase/migrations/` in name order. No hand-typed migration lists.
3. **Schema once, a copy per suite.** Roles are created once per cluster. The baseline and
   migrations go into a template database that is never changed afterwards. Each suite gets
   `CREATE DATABASE <suite> TEMPLATE pilot_template`, issued from a maintenance database
   while nothing is connected to the template; database settings and grants are reapplied
   to each copy; tests inside a suite reset their own state. Parallelism is limited by
   memory and connections, not only CPU count.
4. **Exact race barriers.** Every race uses two working connections and a third that only
   observes. Session A takes the lock and holds it; session B starts; the observer waits,
   with a time limit, until `pg_blocking_pids(B)` contains A's process ID (and, for advisory
   locks, the expected lock key); then A commits or rolls back. Never `pg_sleep` or timing.
   Each race runs in both orders (62 runs for the kept RX and RX2 races). Separately:
   `SKIP LOCKED` claims are tested for no waiting, disjoint claims and stale-token refusal;
   a deadlock (`40P01`) is forced on purpose to prove the whole transaction retries with
   the same identities.
5. **A clock shared by the database, in tests only.** The test time function reads an
   offset stored once per test database, so a blocked session sees time move. Deadline
   races: confirm B is blocked, move the clock, then release A, so a check that reads the
   time before its locks fails the test. Boundaries are tested before, at and after each
   deadline. In every deployed database the function returns `clock_timestamp()` and has
   no override any client can set.
6. **Tests that are not SQL.**
   - Edge Functions run offline under Deno (not only `deno check`).
   - The Cashfree adapter uses recorded responses and webhooks (mapping, retries,
     signatures, exact paise, redaction); any real network call fails the test.
   - Permissions are tested by calling as `anon`, a customer, another customer, a store
     owner, another store's owner, `service_role` and the admin-script role, resetting the
     role between calls.
   - Failures are injected for the webhook's single transaction, lease takeover and replay
     after interrupted work.
7. **Never-cut coverage list.** A checked-in list maps each never-cut rule (N-01 to N-13)
   to the tests that prove it, across SQL, Edge Function, adapter and permission tests.
   Both gates fail if a listed test is missing, skipped or marked known-failing.
8. **Fast and full gates.**
   - Fast (every local commit): incremental typecheck with its own cache, the Edge
     Functions reached from any changed shared module, Phase 7/8 Jest, the current slice's
     SQL suites, every never-cut test, and the migration-set check. Independent steps run in
     parallel; a step that builds files another step reads finishes first.
   - Full (slice merge, push or deploy): everything, from clean builds, including every
     native-Postgres suite. Phase 9's `--full` leaves its native-Postgres suites out; this
     gate does not.
9. **Windows.** Commands are launched in a Windows-safe way (`npm` through `cmd /c` or its
   `.cmd` shim), exit codes and errors from PowerShell are passed on, paths are quoted, and
   a line-ending check guards files whose bytes matter.
10. **Time.** Each step prints its seconds. P0 measures cold and warm runs and sets the
    budgets from them (aim: about 3 minutes fast, 15 minutes full). Going over budget is a
    finding to fix, never a reason to skip a test. The known-failing list starts empty.
11. **Gates that are not automated** are recorded separately: the real-phone sandbox
    payment (P4b) and the key-rotation rehearsal (P7).

## 2. Phase 7/8 additions to the durable rules

1. **Existing tests stay unchanged,** unless the slice's contract table names the test and
   the SDD rule that changes it (SDD 01 §15 rewrites Phase 6 behaviour on purpose). The
   reviewer checks each such change.
2. **A slice is one to four units.** The contract table is written once per slice. A slice
   merges only when all its units pass `verify --full`.
3. **The never-cut list** ([overview §2](./pilot-cut/00-pilot-cut-overview.md)) is tested
   in every unit it touches, whichever flow the unit uses.
4. **Every brief is reviewed,** in both flows, before it is sent.
5. **Independent session, not only a different model.** AGENT-WORKFLOW.md rule 7 asks for
   a different model than the builder. Here a reviewer may be the builder's model when it
   runs in a fresh, independent session that never saw the build, its plan or its
   reports. It gets only the brief, the diff and the review questions.
6. **At most two fix rounds.** If a finding above Minor is still open after two rounds,
   stop and bring it to the owner.

## 3. Two flows

**Heavy** is for money, locks, state and concurrency. **Light** is for everything else.

| Step | Heavy | Light |
|---|---|---|
| 1. Contract table | Once per slice, by the orchestrator | Same |
| 2. Brief | By the orchestrator; reviewed by Sol or Sonnet, whichever is available; corrections merged before sending | Same |
| 3. Plan run, read-only | In the build session; Sol also checks a design-heavy plan | Skipped: the reviewed brief is the plan |
| 4. Tests first | For the two or three hard rules; the orchestrator reads them; the red run matches the plan | For the unit's one hard rule, if it has one |
| 5. Build | Sol; or DeepSeek writes the plan and tests, Sol reviews the tests first and then builds | DeepSeek 4.1 Flash (or Muse 1.3) |
| 6. Test-fidelity check | Haiku: every planned test exists, calls the right function, has no conditional assertion | Same |
| 7. Review | Luna at max, plus GLM 5.3 Flash (free) and DeepSeek 4.1 Flash (paid) or Muse 1.3, each in an independent session (§2 rule 5) | Sol or Sonnet |
| 8. Commit | Orchestrator reads the full diff; local commit only | Same |

Small read-only jobs (lookups, readbacks, browser checks) skip steps 1, 3, 4 and the brief
review, as AGENT-WORKFLOW.md says.

## 4. Roles

| Role | Who |
|---|---|
| Orchestrator: contract tables, briefs, checks, decisions, local commits; writes the SDDs; no debugging or reruns | Claude (this lane's main session) |
| Builder, light | DeepSeek 4.1 Flash (`opencode-go/deepseek-v4.1-flash`, variant max) by default; Muse 1.3 (`opencode-go/muse-spark-1.3-contributor`) as an alternative |
| Builder, heavy | Codex Sol (`gpt-6.1-sol`, xhigh) |
| Brief reviewer | Sol or Sonnet, whichever is available |
| Reviewer, heavy | Codex Luna at max; GLM 5.3 Flash (`opencode/glm-5.3-flash-free`); DeepSeek 4.1 Flash (paid, variant max) or Muse 1.3, in an independent session |
| Reviewer, light | Sol or Sonnet |
| Test runs, mechanical checks, all browser work | Haiku |

Rules for reviewers: read-only; a reviewer that is also the builder's model runs only in
an independent session (§2 rule 5); a reviewer that takes far longer than the others is
stopped, and one that stalls twice is dropped. Not used: the paid "Pro" OpenCode models
without the owner's yes; LongCat 2.5 (stalls); MiMo v2.6 Flash (slow, on watch).

## 5. Pilot slices by flow

| Flow | Slices |
|---|---|
| Light | P0 harness; P1a schema; P2 reservation; P3 except the adapter's error and retry handling; P7 scans; every admin script; every switched-off screen |
| Heavy | P1b task framework and case path; P3's adapter error and retry handling; P4a conversion; P4b verification; P5a expiry and termination; P5b webhook; P5c poll; P6 including the switch-over |

## 6. After the local commit

Each needs the owner's own yes:

- applying a migration to the dev project (never `db push`);
- `verify --full` passing, then a push;
- each Edge Function deployment (pilot cut, overview §3 item 2);
- a live check by Haiku, with the owner signing in.

## 7. Economy

- Codex only for judgment, one job at a time.
- Resume a run that was cut off; never restart it.
- Stop a parallel review that runs far slower than the others.
- Keep it simple: bounded and correct beats complete.
