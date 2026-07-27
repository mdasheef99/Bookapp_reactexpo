# Phase 9 M16 Sensitive-Table ACL Correction Evidence

**Date:** 2026-07-28
**Project:** `ahntbtktjjmvfosgkmgn`
**Branch:** `codex/phase9-m16-sensitive-table-acl-correction`
**Status:** `live_pg17_maintain_correction_required`
**Commit:** `f59d8ed7d847093d2b7638b7d7a6606e8847b722`

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
mutation before application.

## Live application and verification

Commit `f59d8ed` was fast-forwarded to `main` and pushed. Exact M16 (SHA-256
`dfd593c6d21908142700792853fc158778b5ff5450385462fafb7e58e9d7cf50`)
applied once to `ahntbtktjjmvfosgkmgn` as
`20260727231217 marketplace_phase9_sensitive_table_acl_correction`.

Live effective checks confirm service-role SELECT and denial of
INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on all four tables. RLS,
postgres ownership, anon/authenticated denial, and all 13 fixed-search-path
service-only public RPC grants remain intact. All four corrected tables plus
metadata attempts and usage reservations contain zero rows. Post-application
focused tests passed 5/5.

The stronger SELECT-only gate did not close. Supabase runs PostgreSQL 17.6, and
raw ACL is `{postgres=arwdDxtm/postgres,service_role=rm/postgres}` on every
table; explicit `has_table_privilege(...,'MAINTAIN')` is true for
`service_role` and false for both client roles. M16 did not revoke PostgreSQL
17 `MAINTAIN` because that privilege was absent from its reviewed list.

No unreviewed live grant change was made. M17 creation/application requires
separate authorization and must revoke MAINTAIN on the same four tables, add
PostgreSQL 17 effective coverage, receive independent review, and pass live
readback before Unit 5B. M09 remains absent; no data, Storage, provider,
inventory, publication, credential, or deployment activity occurred.
