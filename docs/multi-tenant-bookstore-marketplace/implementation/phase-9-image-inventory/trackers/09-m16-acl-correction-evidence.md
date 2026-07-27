# Phase 9 M16 Sensitive-Table ACL Correction Evidence

**Date:** 2026-07-28
**Project:** `ahntbtktjjmvfosgkmgn`
**Branch:** `codex/phase9-m16-sensitive-table-acl-correction`
**Status:** `created_locally_verified_not_applied`
**Commit:** this single correction/documentation change set; exact SHA is reported at branch closeout because a commit cannot contain its own hash

## Cause and scope

Supabase public-schema default privileges caused new postgres-owned tables to
inherit `service_role=arwdDxtm/postgres`. A later `GRANT SELECT` is additive and
did not remove INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER.

M16 is `20260728000016_marketplace_phase9_sensitive_table_acl_correction.sql`.
It applies explicit per-table grants only; it does not change global default
privileges. The affected RPC-only mutation tables are:

- `public.vision_provider_attempts`;
- `public.phase9_metadata_lookups`;
- `public.phase9_metadata_cache_entries`;
- `public.phase9_selected_metadata_snapshots`.

M14 belongs in scope because attempt registration, egress validation,
finalization, result association, stale/failure marking, reservation linkage,
cost lineage, and claim fencing are enforced by its five hardened RPC contracts.
Direct DML would bypass that approved boundary.

## Effective privileges

Read-only exact-project inspection before M16 found SELECT and all six mutation
privileges effective for `service_role` on each table. Anon and authenticated
had none; RLS was enabled. M15 remains live exactly once as
`20260727222159 marketplace_phase9_metadata_foundation`; M09 and M16 are absent.

The PostgreSQL test recreates that broad grant before reapplying M16. After M16:

| Role | SELECT | INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER |
| --- | --- | --- |
| `service_role` | allowed | all denied |
| `anon` | denied | all denied |
| `authenticated` | denied | all denied |

RLS remains enabled and ownership remains `postgres`. All 13 approved public
M14/M15 RPCs retain service-role EXECUTE, deny anon/authenticated EXECUTE, and
retain `search_path=""`. Focused RPC mutation regressions pass after M16.

## Verification and review

- M16 static migration contract: 1 suite, 3/3 tests.
- M16 effective PostgreSQL privilege/RPC inspection: 1 suite, 2/2 tests.
- M15 focused migration regression: 1 suite, 7/7 tests.
- M14/M15 focused PGlite regressions: 2 suites, 20/20 tests.
- Independent reviewer: `APPROVED`; boundary correct, M14 in scope, RPCs
  preserved, and no unrelated privilege change.

The change contains no data, constraint, function, policy, Storage, provider,
inventory, quantity, publication, Google Books, alias, credential, or deployment
mutation. No live database mutation occurred. Unit 5B remains gated until M16 is
merged, separately authorized, applied, and live-verified on the exact project.
