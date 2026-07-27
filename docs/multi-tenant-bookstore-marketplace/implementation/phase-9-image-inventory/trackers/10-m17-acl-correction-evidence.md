# Phase 9 M17 PostgreSQL 17 MAINTAIN ACL Correction Evidence

**Date:** 2026-07-28
**Project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`)
**PostgreSQL:** 17.6
**Correction commit:** `cbd98c7a128d8b3d0f7411e6e13dc61990d70ea1`
**Migration:** `20260728000017_marketplace_phase9_maintain_acl_correction.sql`
**Live record:** `20260727233457 marketplace_phase9_maintain_acl_correction`
**Status:** `live_verified`

## Scope and cause

Supabase public-schema default privileges originally gave `service_role` broad
direct DML on the M14/M15 sensitive tables. M16 revoked the six privileges
reviewed at that time, but PostgreSQL 17 introduced the separate `MAINTAIN`
table privilege. Exact-project readback therefore showed
`service_role=rm/postgres` after M16: SELECT plus MAINTAIN.

M17 is a forward-only ACL-only correction. It issues `REVOKE ALL PRIVILEGES`
from `service_role`, restores only `SELECT`, and explicitly keeps `PUBLIC`,
`anon`, and `authenticated` denied on exactly:

- `public.vision_provider_attempts`;
- `public.phase9_metadata_lookups`;
- `public.phase9_metadata_cache_entries`;
- `public.phase9_selected_metadata_snapshots`.

The M14 table is in scope because its approved mutation boundary is the same
hardened RPC-only boundary as the three M15 tables. M17 changes no data,
constraints, functions, RLS policies, ownership, defaults, or application
behavior.

## Red/green and focused verification

- M17 static migration contract:
  `npm.cmd test -- --runInBand supabase/migrations/__tests__/marketplacePhase9MaintainAclCorrection.test.ts`
  — 1 suite, 3/3 tests.
- M17 effective PostgreSQL privilege/RPC test:
  `node --test supabase/tests/phase9/phase9MaintainAclCorrection.integration.test.mjs`
  — 1 suite, 2/2 tests.
- Focused M14/M15 operational regression:
  `node --test supabase/tests/phase9/phase9VisionProviderAttempts.integration.test.mjs supabase/tests/phase9/phase9MetadataFoundation.integration.test.mjs`
  — 2 suites, 20/20 tests.
- The PGlite environment reports PostgreSQL 18.3, so its effective-privilege
  test is intentionally PostgreSQL-17-or-newer. The dedicated
  `scripts/verify-phase9-m17-postgres17.ps1` remains strict to server major 17.
- A transaction-scoped exact-project PostgreSQL 17.6 verification applied the
  M17 body, asserted the post-state, rolled back, and confirmed the M16
  pre-state was restored before live application.
- Independent read-only review returned `APPROVED` with no findings: the
  revocation covers MAINTAIN, the exact four-table scope is correct, clients
  remain denied, RPC execution remains available, and no unrelated privilege
  changes exist.

## Live application and readback

The reviewed correction commit was fast-forwarded to `main` and pushed. Only
M17 was then applied through the Supabase migration API. Migration history
shows M15 once as `20260727222159`, M16 once as `20260727231217`, and M17 once
as `20260727233457`; M09 remains absent.

Exact-project readback after application proves, for all four tables:

- raw ACL is `{postgres=arwdDxtm/postgres,service_role=r/postgres}`;
- `service_role` has SELECT;
- `service_role` has no INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER,
  or MAINTAIN;
- `anon` and `authenticated` have none of those privileges, including SELECT;
- RLS is enabled and owner remains `postgres`.

All 13 approved M14/M15 public RPC signatures remain present.
`service_role` retains EXECUTE, `anon` and `authenticated` remain denied, and
every RPC retains fixed `search_path=""`. The four corrected tables each
contained zero rows before and after M17.

No data, Storage, provider, credential, Gemini, Google Books, alias, inventory,
publication, Render, scheduling, or autoscaling mutation occurred. Historical
M14, M15, and M16 application records remain preserved.

## Handoff

Unit 5A's intended SELECT-only/RPC-mutation boundary is now live-verified.
Unit 5B and Unit 5C remain not started; neither is automatically authorized by
this migration closeout. The next gated action is a fresh, explicitly
authorized Unit 5B session.
