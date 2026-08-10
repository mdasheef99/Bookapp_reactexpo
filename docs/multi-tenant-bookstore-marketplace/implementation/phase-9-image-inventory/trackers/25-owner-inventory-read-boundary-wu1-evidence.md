# WU1 Owner-Inventory Read Boundary Evidence

**Date:** 2026-08-04
**Status:** `applied_readback_complete_runtime_deferred`
**Authorization:** User-authorized WU1 only, explicitly re-sequenced ahead of
the Phase 9 Unit 6F native gate.
**Environment:** Development-only application and shared remote Supabase
project `Bookconnect_reactexpo` (`ahntbtktjjmvfosgkmgn`). No production
deployment or external app-consumer compatibility requirement exists.

## Scope completed

- Added the [WU1 contract addendum](../work-units/owner-inventory-read-boundary-wu1-sdd.md).
- Preserved `public.phase9_owner_inventory(uuid)` unchanged and documented its
  stable eight-key detail response.
- Added separate `public.phase9_owner_inventory_page_v1(...)` contract design
  with server-derived store scope, exact list DTO, supported filters, 1–50
  page size, signed context-bound cursor, `updated_at DESC, id DESC` keyset
  ordering, `hasMore`, and `nextCursor` behavior.
- Created only the forward draft
  `supabase/migrations/20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`.
- Added static and local PGlite tests. No app route, screen, hook, service,
  Edge Function, dashboard, write command, or stale-code deletion was changed.

## Post-review correction pass

The independent review identified one SQL defect and four gate/contract
findings. The bounded local correction
keeps WU1 within its authorization and does not change any existing write path:

- Explicit `NULL` page sizes now fail with `P9_REQUEST_INVALID`; they cannot
  reach an unbounded SQL `LIMIT`.
- `asOf` is explicitly an ordering horizon, not a repeatable database snapshot.
  Existing quantity/publication writes are intentionally unchanged; full
  cross-page state consistency remains a separately scoped write-boundary
  decision.
- Unexpected SQL failures are mapped to `P9_INTERNAL_ERROR` without returning
  the underlying PostgreSQL message; registered `P9_*` errors are preserved.
- The continuity validator now requires the WU1 addendum/evidence artifacts and
  checks these boundary invariants.
- Cursor helper failures are no longer swallowed by the cursor-invalid mapping;
  only timestamp/UUID decoding failures are translated to `P9_CURSOR_INVALID`.
- The continuity validator now requires both WU1 test harnesses, checks the
  stable-detail/direct-table/policy boundaries, and reports WU1-scoped versus
  repository-wide diff hygiene separately.

## Boundary receipt

- `WU1_NO_LIVE_APPLICATION=TRUE`
- `WU1_NO_CLIENT_UI_SERVICE_OR_STALE_CODE_CHANGE=TRUE`
- `WU1_NO_WRITE_PATH_OR_DASHBOARD_CHANGE=TRUE`
- `WU1_REMOTE_JWT_RLS_RUNTIME=DEFERRED_UNTIL_AFTER_APPLICATION`

## Exact contract

```text
public.phase9_owner_inventory_page_v1(
  integer,text,text,text,text,text,text,text
) RETURNS jsonb
```

List DTO keys:
`id`, `store_id`, `title`, `authors`, `isbn_10`, `isbn_13`, `condition`,
`quantity_available`, `selling_price_minor`, `visibility_status`,
`listing_quality_status`, `public_notes`, `shelf_location`, `entry_method`,
`created_at`, `updated_at`, `version`.

The stable detail DTO remains:
`id`, `store_id`, `title`, `condition`, `quantity_total`,
`quantity_available`, `publication_status`, `version`.

## Verification actually run

1. Red-first Jest run before WU1 files existed: expected failure, 6 tests red
   because the addendum and migration draft were absent.
2. Focused Jest after the files were created:
   `marketplacePhase9OwnerInventoryReadBoundary.test.ts` — **10/10 passed**.
3. Local PGlite migration parse/readback and executable behavior tests through
   M30 plus the WU1 draft: **3/3 passed**, covering equal-timestamp keyset
   pagination, filters, empty results, page-size/cursor errors, owner scope,
   unauthenticated denial, and unexpected helper-failure normalization.
4. Live Supabase MCP read-only verification: project healthy, migration history
   still ends at M30, and the draft is not applied.

5. Correction red-first Jest run against the original draft: expected failure,
   covering cursor exception scope, validator/test-boundary coverage, and the
   `asOf`/`id` wording correction.
6. Corrected Phase 9 continuity validator passed with separate
   `WU1_DIFF_CHECK=PASS` and `REPOSITORY_DIFF_CHECK=PASS` signals;
   `PHASE9_CONTINUITY_CHECK=PASS`, `MARKDOWN_FILES_CHECKED=65`,
   `REQUIRED_PHASE_FILES=51`.
7. Final `git diff --check` passed; existing line-ending warnings remain
   non-fatal and are unrelated to WU1 semantics.

No live migration, table/index/function/grant/policy/data/Storage/deployment,
inventory, listing, publication, route, UI, or external-service mutation was
performed.

## Residual approval and next action

The exact migration was applied once after the independent SQL/security
self-review and exact-project preflight. Positive authenticated Owner,
cross-store, inactive-Owner, supported-filter, cursor-context, and direct
authenticated REST checks remain deferred because this session had no approved
Owner JWT and no active Owner browser session; no fixtures or users were
created. After that credentialed runtime gate, resume the representative
low-end Android Unit 6F evidence. Client cutover of legacy callers remains a
later, separately authorized work unit.

## Application and post-application receipt

- `WU1_LIVE_APPLICATION=TRUE`
- Application authority: the attached user request authorized WU1 application
  only after the bounded self-review and preflight, against development project
  `Bookconnect_reactexpo` / `ahntbtktjjmvfosgkmgn`.
- Exact migration: `20260803000031_marketplace_phase9_owner_inventory_read_boundary.sql`.
- Application result: **applied exactly once** through Supabase MCP; live version
  `20260803221216 marketplace_phase9_owner_inventory_read_boundary`.
- Post-application readback: the new RPC exists exactly once with the exact
  eight-argument signature and `jsonb` result, `STABLE SECURITY DEFINER`,
  postgres owner, empty `search_path`, and ACL `anon=false`,
  `authenticated=true`, `service_role=true`. The index exists exactly as
  `(store_id, updated_at DESC, id DESC)`.
- Stable detail preservation: `public.phase9_owner_inventory(uuid)` remains
  exactly once, with the preflight body/security/ACL shape and no overload.
  The post-readback definition hash is `e2df2aa453ff65005747e44999265c23`.
- Boundary preservation: `store_inventory` RLS, policies, existing indexes,
  columns/constraints, table ACL, and the inventory projection trigger/function
  were unchanged. Pre-existing anonymous table DML ACL entries remain
  isolated by the absence of anonymous RLS policies and were not modified.
- Runtime result: anonymous REST execution returned HTTP 401 with
  `permission denied for function phase9_owner_inventory_page_v1`.
- Deferred runtime cases: eligible Owner list, other-Owner cross-store denial,
  inactive-Owner denial, all supported positive filters, equal-timestamp live
  ordering, cursor context mismatch, exact DTO keys over live rows, and
  authenticated direct-table SELECT. ACL/readback covers the direct table
  privilege denial; the remaining cases require an approved Owner JWT or
  separately approved fixtures.
- Operational note: the migration used a regular index creation and completed
  successfully; no production project, inventory/listing/publication data,
  Storage object, user, or fixture was created or changed.
