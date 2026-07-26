# Phase 9 M11/M12 Live-Application Evidence

**Status:** `m11_m12_live_verified_services_undeployed`
**Date/session:** 2026-07-26
**Project:** `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`, `ACTIVE_HEALTHY`, `ap-southeast-2`, PostgreSQL 17.6.1)
**Repository baseline:** clean `main`/`origin/main` at `cc98901fc22a3d2727a8b6d72c74d56c48aa2028`
**Documentation closeout:** committed and fast-forwarded to `main`/`origin/main` as `4abeef89ecebdb7a74a8ece3a1bdc0d5cfe6c8c5`

## Authorized scope

Exact-project preflight, sequential M11 then M12 application, live readback, and tracker/ledger closeout only. Service deployment, secret configuration, Storage-object mutation, provider calls, and other work units remained prohibited.

## Baseline

- Migration history ended at M10 `20260722125256`; M09/M11/M12 were absent with no unexpected Phase 9 divergence.
- Phase 9 ingestion/media tables and both relevant private buckets contained zero rows/objects. Inventory/listings/events were 5/5/14 and quantity violations were zero.
- Both relevant buckets were private, limited to 10 MiB, and allowed only JPEG/PNG/WebP. No Phase 9 ingestion/vision Edge Function was deployed.
- Security advisors were 174 (`INFO 46/WARN 127/ERROR 1`); performance advisors were 349 (`INFO 198/WARN 151`).

## M11 application and verification

- `20260723000011_marketplace_phase9_ingestion_runtime_foundation.sql` applied once as `20260726182238 marketplace_phase9_ingestion_runtime_foundation`; committed migration SHA-256: `240D984EAFCC1960A09C40EBDE588C4625F36D5A8EC998F99EBA4345B36129E8`.
- Live readback verified all 20 expected columns, 11 named constraints, the unique capability index, and 12 privileged functions.
- Every privileged function is `postgres`-owned, `SECURITY DEFINER`, pins empty `search_path`, denies `anon`/`authenticated`, and grants the intended callable boundary to `service_role`.
- Authenticated execution of legacy path-taking `phase9_authorize_upload` and `phase9_accept_scan_input` is revoked.
- Counts, quantity balance, buckets, policies, and Storage objects were unchanged. Security improved to 172 (`INFO 46/WARN 125/ERROR 1`); performance remained 349.

## M12 application and verification

- The first MCP submission was truncated in transport and failed inside its transaction. Immediate history/schema/count readback proved atomic rollback: no M12 history row, table, column, or function existed; M11 remained intact; data and Storage counts were unchanged.
- The unchanged committed SQL was then transferred losslessly in bounded chunks and applied once as `20260726182539 marketplace_phase9_vision_analysis_runtime`; committed migration SHA-256: `DE25969995637ED2E03671E89DC2AC5F4105713CD364978B10E6ACFD3A0C87B0`.
- Both immutable evidence tables exist with RLS, zero client policies, no anon/authenticated DML or SELECT, and service-role SELECT only.
- All eight lineage/reconciliation columns, canonical limits, exact uniqueness, vision claim index, and UPDATE/DELETE immutable triggers exist and are validated.
- All four worker RPCs are `postgres`-owned, empty-`search_path`, token/attempt-fenced, service-only functions. All six private M12 helpers also deny anon/authenticated execution.
- The reconciliation constraint and helper enforce terminal `resolved`, exact `P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED`, and job-only mutation. The quantity CHECK remains `NOT VALID` with zero violations.
- Inventory/listings/events remained 5/5/14; all Phase 9 ingestion/evidence tables remained empty; both private buckets remained unchanged with zero objects.
- Security ended at 174 (`INFO 48/WARN 125/ERROR 1`): the only M12 delta is two expected `RLS enabled, no policy` INFO notices for deliberately service-only tables. Performance ended at 354 (`INFO 203/WARN 151`) from informational new-table FK/index notices.

## External state and next authority

Only M11/M12 DDL and migration-history state changed. No service or Edge Function was deployed, no secret configured, no Storage object touched, and no provider called. M09 remains absent.

On 2026-07-27, a documentation-only reconciliation refreshed the global/local handoffs, active routing, SDD implementation checkpoints, data dictionary, current-vs-target audit, traceability, and Unit 4/4A historical supersession notes. The Phase 9 continuity validator and `git diff --check` passed. It introduced no product, schema, runtime, deployment, secret, provider, Storage, or operational-data change.

The next work unit requires separate authorization for ordered Owner-ingestion, sanitation-worker, and fixture-vision-worker deployment, infrastructure/service secrets, and live fixture-path verification.
