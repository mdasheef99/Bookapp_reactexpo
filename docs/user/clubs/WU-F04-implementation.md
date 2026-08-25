# WU-F04 Implementation Record — Reaction Replacement Remediation

**Work unit:** CLUB-WU-F04 (CLUB-FUNC-04 remediation)
**Contract:** PRODUCT-12 — one reaction per actor per discussion target; A→B replaces; A+B coexistence prohibited.
**Status:** `implementation_complete_needs_review`
**Date:** 2026-08-25
**Tree:** `feat/clubs-ui-overhaul` (clubs desk). Local only: no commits, no pushes, no live Supabase writes.

## Files changed / created

| File | Kind | Change |
| --- | --- | --- |
| `supabase/migrations/20260824100000_clubs_f04_reaction_single_reaction_invariant.sql` | migration (previous session) | Duplicate repair → post-repair assertion → partial unique indexes `(topic_id,user_id)` / `(reply_id,user_id)` → `set_club_discussion_reaction` RPC (SECURITY INVOKER, native partial-index arbiter upsert, actor via `auth.uid()`, `created_at` preserved on replace). Phase-4 drop of legacy emoji-inclusive constraints intentionally deferred. |
| `src/features/clubs/services/clubsDiscussionService.ts` | service (previous session) | `setClubDiscussionReaction` now calls `supabase.rpc('set_club_discussion_reaction', { p_topic_id, p_reply_id, p_emoji })` — no `user_id` argument; canonical row mapping (`id`, `topic_id`, `reply_id`, `user_id`, `emoji`, `created_at`). `removeClubDiscussionReaction` unchanged: retains emoji + actor + exactly-one-target filter. |
| `src/features/clubs/services/__tests__/clubsDiscussionReactionRpc.test.ts` | L3 test (previous session) | Freezes client write-path contract: RPC-only SET, server-derived actor, canonical mapping, error propagation, remove-path emoji filter. |
| `supabase/tests/f04_contract_tests.sql` + `supabase/tests/f04_fixture.sql` | L4 SQL (previous session) | Disposable-instance contract tests + minimal fixture mirroring live reaction model. |
| `supabase/tests/f04_concurrency.mjs` | new (this session) | Concurrency probe: node `pg` Pool with two independent clients; cases A–D; actor context via `SET LOCAL request.jwt.claim.sub`; deterministic cleanup of tracked ids; exit 1 on failure or any 23505 reaching a caller. 121 lines. Syntax-checked (`node --check`) only — execution requires a disposable Postgres and is listed under "remains manual". |
| `docs/user/clubs/WU-F04-implementation.md` | new (this session) | This record. |

No service or test file required modification in this session: all checks passed as delivered.

## Test evidence (run 2026-08-25, this tree)

1. `npx jest --runInBand --testPathPattern "clubsDiscussionReactionRpc"`
   → **1 suite passed, 8/8 tests passed**, 0 failures.
2. `npx jest --runInBand --testPathPattern "clubs"`
   → **19 suites passed / 19 total; 198 tests passed / 198 total**, 0 failures. No regressions from F04 changes.
3. `npx tsc --noEmit`
   → **0 errors.** The `rpc()` call produced no typing complaint; no localized type assertion was needed.

Not run here (requires environment not available/approved in this session):

- `f04_contract_tests.sql` against a replayed disposable instance (fixture documented in file header).
- `f04_concurrency.mjs` (needs a disposable Postgres 17 with fixture + F04 migration applied; see its header for exact commands).

## What remains manual

- **Live deployment:** applying `20260824100000_clubs_f04_reaction_single_reaction_invariant.sql` to Supabase project `ahntbtktjjmvfosgkmgn` requires explicit user approval. Per the workspace-split rule, the library tracker must be checked for migration conflicts before any application.
- **Post-deploy readback:** verify migration presence once in live history, spot-check one replacement through the RPC, and record it in the migration ledger.
- **Concurrency probe execution:** run `f04_concurrency.mjs` against a disposable instance (never the shared project) and record output.

## PERF-04 gate note

The SDD-PERF-04 responsiveness gate remains closed. Gate release requires **(a)** an independent review of this implementation (code + SQL), AND **(b)** live deployment plus live readback evidence. Neither condition is met by local test passes alone; code existence does not constitute gate clearance.

## Residual risk

- Legacy emoji-inclusive unique constraints still exist until the deferred Phase-4 migration; the repair step guarantees they are satisfied post-migration, but they must be dropped to complete the contract transition.
- Full-chain repo replay on a disposable instance is tracked as follow-up obligation for L01/WU-L04 harness work (see `f04_fixture.sql` header).

---

## Rev.2 — Independent review corrections applied (2026-08-25)

Independent second-pass review (real PostgreSQL 17 container, two-connection
concurrency execution) found one REQUIRED correction:

1. **RPC runtime bug fixed.** The original `RETURNS TABLE(id, topic_id, …)`
   signature made output columns act as PL/pgSQL variables: the
   `ON CONFLICT (topic_id,user_id) WHERE topic_id IS NOT NULL` predicate was
   ambiguous (42702), and naive pragma fixes corrupted VALUES binding
   (target_check 23514). Correction: RPC now uses
   `RETURNS SETOF club_discussion_reactions` + `RETURNING *`. supabase-js
   returns the identical row object — client contract unchanged.

2. **Concurrency harness fixed.** Pool max raised 2→4 (verification queries
   starved while both tx clients held open); actor context switched from
   interpolated `SET LOCAL` to parameterized
   `SELECT set_config('request.jwt.claim.sub', $1, true)`.

### Rev.2 re-verification evidence (disposable postgres:17 container)
- Reset to pre-F04 state → seeded 6 duplicate rows across 2 groups + control rows
- Applied rev.2 migration: repair deleted exactly the losers (newest-wins,
  id tie-break verified), post-repair assertion passed, both partial indexes +
  RPC created (SECURITY INVOKER, search_path=public)
- Post-migration RPC checks: reply none→A ✅, topic none→A ✅ (both branches)
- Concurrency harness A/B/C/D: **PASS, exit 0** — no 23505 reached any caller,
  exactly one row per actor/target in every race case
- L3 suite: 8/8 pass · tsc --noEmit: 0 errors

### Remaining before PASS
- Live deployment approval (migration deletes ~9 of 13 participating duplicate
  live rows, keeping newest per group) + live readback
- RLS behavioral security matrix on an RLS-enabled environment (fixture schema
  has no RLS; policies inspected but not behaviorally exercised)
- Fresh full-chain replay (001→F04) or explicit acceptance of the faithful
  post-018 environment execution as the standard

PERF-04 gate: remains gated until review + live deploy/readback.

---

## LIVE DEPLOYMENT and READBACK (2026-08-25) - USER AUTHORIZED

**Migration:** 20260824100000_clubs_f04_reaction_single_reaction_invariant.sql (rev.2, hash 6740c2c7) applied verbatim in one transaction via supabase_execute_sql at 2026-08-25T11:32:15Z. COMMIT succeeded.

**Repair effect:** preflight topic groups=2, reply groups=2, participating=13, expected deletions=9 | postflight: 0 groups both targets, total rows 15 to 6, actual deleted=9. Survivors verified newest-wins per group.

**Object readback:** both partial unique indexes exact predicates; RPC RETURNS SETOF club_discussion_reactions, prosecdef=false INVOKER, search_path=public, native partial-index arbiter; old emoji constraints + target_check + TYPE-03 retained; RLS policies unchanged (4 policies).

**Live behavioral smoke A-J: ALL PASS** none-to-A=1 row; replace=1 row old absent; idempotent created_at preserved; remove=0; reply smoke pass; invalid emoji 23514 canonical CHECK; shape errors 22023; unauth 42501; outsider can_participate=false confirmed (service-role harness bypasses RLS, rolled back; real clients DENIED by WITH CHECK); cleanup baseline=6.

**Ledger deviation:** applied via MCP execute_sql per repository practice for this project; NOT in supabase_migrations table (same as prior clubs waves); local file is ledger of record.

**Replay exception:** ACCEPTED TEMPORARILY BY PRODUCT OWNER - residual stays with CLUB-WU-L01 / CLUB-TEST-07.

**Status:** LIVE DEPLOYED + VERIFIED. PERF-04 gate conditions met pending client deployment decision.
