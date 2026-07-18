# Phase 6 Verification and Traceability

**Artifact type:** non-normative implementation verification record
**Authority:** corrected monolithic Phase 6 SDD remains the sole normative design
**Status:** `complete_browser_e2e_deferred`
**Date:** 2026-07-18

## 0. Superseding Checkpoint

Verdict: `PHASE 6 COMPLETE — COMPREHENSIVE BROWSER E2E DEFERRED`.

- Phase 5 is complete and Phase 6 Units 1-15 are source-complete.
- Development Supabase migrations M01-M33 were applied, followed only by forward corrective migrations M34-M39. Persisted command, authorization, hold/counter, task-contract, and transition behavior was verified through provider-independent `payment_ready`.
- The prior complete repository checkpoint passed 908/908 tests. TypeScript and production Expo web export also passed at the source-complete checkpoint.
- Initial browser smoke passed: preview launch, authentication, Marketplace rendering, Cart and Order Requests controls, and empty-cart routing showed no console errors. Controlled `phase6_browser_*` development fixtures remain available.
- The development rollout is active: `commerce-scheduler` v5 uses the configured custom scheduler secret; `commerce-task-worker` v2 retains strict service-role authorization. Scheduler internal dispatch explicitly forwards its server-side service-role bearer token. No secret, bearer value, or Vault content is recorded here.
- Cron job 5 runs the scheduler every minute. Its first scheduled empty-queue run succeeded, and clearly tagged synthetic dispatch, retry, and dead-letter paths passed. Focused scheduler/worker authorization regression passed 4/4.
- Comprehensive customer and Store Owner browser E2E, browser-created persisted-effect verification, full responsive/accessibility review, and real timed commerce-command reminder/expiry verification remain deferred. This development rollout is not a production-readiness declaration. Phases 7 and 8 are deferred and Phase 6 ends at `payment_ready`.

The original source-gate matrix below is retained as historical evidence of the state before the development database gate. Its `DB pending` entries are superseded by this checkpoint and must not be read as the current verdict.

### 2026-07-18 Supabase MCP readback

- Project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`) is `ACTIVE_HEALTHY`.
- All 39 Phase 6 migrations are present in the development migration history.
- Authoritative Phase 6 tables have RLS enabled; the two schema/type registries are service-role-only by grants despite the generic no-RLS advisor warning.
- Scheduler v5 and worker v3 are active. Cron job 5 is active every minute and its latest queried runs succeeded.
- All five current `store_inventory` rows satisfy quantity-bucket equality. The constraint remains `NOT VALID`; validate it with a forward migration before production readiness.
- This readback did not execute comprehensive browser E2E and does not declare production readiness.

## 1. Verification Baseline

| Gate | Result |
|---|---|
| Branch / revision | `codex/phase4-5-remediation`; `HEAD` and `origin/main` both `57d13ea4e8c68da043e565b2c5897c1ee4d0596d` before Unit 15 edits. |
| Unit 1–15 focused source gate | 274/274 across 26 Jest suites. |
| Migration/security/reconciliation contracts | 158/158 across 14 suites. |
| TypeScript / production web export / diff hygiene | Pass. |
| Isolated DB tooling | Supabase CLI 2.20.12 found; Docker engine, `psql`, and `pg_isready` unavailable. |
| Persisted migration/RLS/grant result | Not run; database verification required. |
| Real concurrency result | Not run; database verification required. |
| Remote/live state | Development migrations M01-M39 are applied. Scheduler v5 and worker v3 are active; cron job 5 runs each minute. First scheduled empty-queue run and tagged synthetic dispatch/retry/dead-letter checks passed; real timed commerce-command verification remains pending. |

Status terms below are `complete` only for deterministic source/UI work, and
`source-complete/database-pending` for behavior that requires PostgreSQL.

## 2. Invariant Traceability

| Item | SDD | Implementation / migration | Red test / DB gate | Result / status |
|---|---|---|---|---|
| INV-01 single-store active cart | §§2, 6, 8.1 | cart RPCs; M01, M06–08 | cart contracts; U9 race | Source green; DB pending |
| INV-02 server-derived customer | §§2, 3, 7 | `auth.uid()` command guards; M04, M06–10 | auth/command contracts; U8/U9 integration | Source green; DB pending |
| INV-03 Owner capability | §§2, 3, 5 | `has_phase6_owner_capability`; M04–05 | manager/staff denials; U8 integration | Source green; DB pending |
| INV-04 tenant isolation | §§2, 5, 14 | RLS + derived-store commands; M04–30 | safe-read/security contracts; U8–U12 gates | Source green; DB pending |
| INV-05 command-only writes | §§2, 7, 14 | revokes/named RPCs; M01–30 | direct-write and grant scans | Complete source; DB pending |
| INV-06 immutable snapshots | §§2, 6 | snapshot triggers/revokes; M02, M10 | foundation/submission contracts; U8 gate | Source green; DB pending |
| INV-07 price bound | §§2, 8 | submit/confirmation guards; M09–12, M17–18 | submission/owner/decision contracts; U9 races | Source green; DB pending |
| INV-08 unavailable vs rejection | §§2, 4, 8.5 | Owner outcome RPCs; M12 | vocabulary/outcome tests | Complete source; DB pending |
| INV-09 reserved equals active holds | §§2, 9 | bucket helpers + reconciliation; M11–12, M31–33 | owner/reconciliation contracts; U9/U15 SQL | Source green; DB pending |
| INV-10 atomic/idempotent holds | §§2, 9 | sorted locks/release helper; M11–12, M17–19 | hold contracts; quantity-one/release races | Source green; DB pending |
| INV-11 replay dedupe | §§2, 7 | idempotency/effect uniqueness; M02–27 | all command contracts; U8–U12 gates | Source green; DB pending |
| INV-12 transition + event | §§2, 11 | evidence/event constraints + reconciliation; M02, M24, M32 | event/reconciliation contracts; U15 SQL | Source green; DB pending |
| INV-13 support non-transition | §§2, 8.5, 12.2 | `request_platform_support`; M15 | clarification/support tests; U8 SQL | Source green; DB pending |
| INV-14 no PII in public evidence | §§2, 11, 13–14 | safe-payload triggers/scans; M24, M31–33 | privacy contracts/scans; U15 SQL | Source green; DB pending |
| INV-15 deep links reauthorize | §§2, 11, 13–14 | safe notification projections/UI refetch; M24–25, M29–30 | notification/UI tests | Complete source; DB pending |
| INV-16 integer paise / INR | §§2, 6, 8 | schema/calculators; M01, M09–18 | schema/command contracts | Source green; DB pending |
| INV-17 server clocks/jobs | §§2, 10, 12 | schedule/task commands; M20–28 | time engine/task tests; U10/U12 races | Source green; DB pending |
| INV-18 live gates | §§2, 5, 10 | eligibility resolver; M05, M17–23 | eligibility/closure tests | Source green; DB pending |
| INV-19 cleanup survives flags | §§2, 5, 10 | cancellation/expiry/service paths; M18–23, M27 | cleanup contracts; U9/U10 SQL | Source green; DB pending |
| INV-20 Phase 5 compatibility | §§2, 14–15 | Phase 5 policies unchanged | Phase 5 migration/service regression | Source green; live Phase 5 unchanged |
| INV-21 request/cart evidence split | §§2, 6, 8.2 | submission RPC; M09–10 | submission contracts; U8/U9 SQL | Source green; DB pending |
| INV-22 entitled Owner precondition | §§2, 5, 8.2 | eligibility/submission + reconciliation; M05, M10, M33 | zero-effect/missing-owner tests | Source green; DB pending |
| INV-23 deterministic tariff | §§2, 8, 10 | policy resolver/calculator; M05, M09–10, M17–18 | eligibility/submission/decision tests | Complete source; DB pending |

## 3. Command and Transition Traceability

All command rows are controlled by SDD §§4, 7–12 and Appendix A. UI calls are in
`customerCommerceService.ts` / `ownerCommerceService.ts`; worker dispatch is in
`commerce-task-worker/index.ts`.

| Command / transition | Function / migration | Red test | Integration / race | Status |
|---|---|---|---|---|
| `create_cart` / active cart | cart command RPCs; M06–07 | cart contracts | U9 duplicate-cart race | DB pending |
| `replace_cart_store` / replaced | replacement RPC; M08 | cart contracts | U9 replacement replay | DB pending |
| set/remove cart item | cart RPCs; M07 | cart contracts | U9 integration | DB pending |
| `submit_order_request` / request create + cart submitted | M09–10 | submission contracts | U8/U9 integration + duplicate submit | DB pending |
| `start_store_review` | Owner outcome RPC; M12 | owner contracts | U8 integration | DB pending |
| `request_clarification` | M14 | clarification contracts | U8 integration | DB pending |
| `provide_clarification` | M14 | clarification contracts | U8 integration | DB pending |
| `confirm_full` / `payment_ready` | M11–12, M17 | owner/payment-ready contracts | U9/U10 races | DB pending |
| `confirm_partial` / decision | M11–12, M17 | owner contracts | U9 quantity race | DB pending |
| `mark_items_unavailable` | M12 | owner contracts | U9 integration | DB pending |
| `reject_order_request` | M12 | owner contracts | U8/U9 integration | DB pending |
| `accept_confirmed_changes` | M17–18 | decision contracts | acceptance/expiry/cancel races | DB pending |
| `cancel_order_request` | M18 | decision contracts | acceptance/cancel race | DB pending |
| `request_platform_support` | M13, M15 | support contracts | U8 replay/non-transition | DB pending |
| four support intervention commands | M16 | support contracts | U8 role/version gate | DB pending |
| reminder / confirmation expiry | M27 | task contracts | U12 claim/execution gate | DB pending |
| clarification expiry | M22 | schedule/clarification tests | U10 integration | DB pending |
| decision/payment-ready expiry | M19 | decision tests | U9 races | DB pending |
| emergency pause/resume/cap expiry | M20–23 | closure tests | U10/U12 races | DB pending |
| store-ineligibility / rollout cancellation | M18, M23 | closure/decision tests | U10 race | DB pending |
| task claim/complete/dead-letter/replay | M26–28 | scheduler tests | U12 concurrency | DB pending |
| reconciliation / deterministic task cleanup | M31–33 | Unit 15 24/24 | U15 integration | Source green; DB pending |

## 4. Schema, Security, Privacy, Policy, SLA, and Operations

| Area / item | SDD | Implementation / migration | Test / result | Status |
|---|---|---|---|---|
| carts, requests, items, holds, schedules | §§6, 9–10; App. B | M01 | foundation contracts green | DB pending |
| snapshots, acceptance, creation/transition evidence | §§6, 11; App. B | M02 | foundation/submission green | DB pending |
| events, notifications, deliveries, tasks, policy/idempotency extensions | §§6, 10–12 | M03, M24–28 | event/task contracts green | DB pending |
| RLS, grants, safe customer/Owner/support reads | §14; App. C | M04, M29–30 | 5 denial classes + projection tests green | DB pending |
| command transaction functions | §§7–12 | M06–23, M27 | command contracts green | DB pending |
| reconciliation cases/runs/observations | §§12, 14–15 | M31–33 | Unit 15 24/24 | DB pending |
| customer PII/private snapshots | §§13–14 | restricted snapshot + safe RPCs | payload/privacy scans green | DB pending |
| logout/cache clearing | §13 | `useAuth`, commerce session/query client | session/UI tests green | Complete source |
| policy precedence/type/range/overlap/fallback | §10.1–10.2 | resolver M05 + scanner M33 | eligibility/reconciliation green | DB pending |
| all required numeric policy keys | §10.2 | M05/M33 catalog | missing/malformed tests green | DB pending |
| rollout/pickup/delivery/allowlist booleans | §§5, 10.2 | M05/M33 | eligibility/reconciliation green | DB pending |
| IANA timezone/weekly intervals/exceptions | §10.3 | M20–23 + scanner M33 | deterministic time tests green | DB pending |
| worked open-hours/overnight/holiday/DST vectors | §10.5 | `timeEngine.ts`, M20–21 | time engine tests green | Complete deterministic source |
| service leases/retry/dead letter/manual replay | §12.1 | M26–28, M31–33 | scheduler/reconciliation green | DB pending |
| structured observations and aggregate metrics | §14 | M31/M33 triggers + RPC | Unit 15 green | DB pending |

## 5. Event, Notification, Task, and UI Coverage

| Catalogue | SDD | Implementation | Test / status |
|---|---|---|---|
| All Appendix D cart/request events | §§4.3, 11; App. D | registry/validators M24; command migrations | Event contracts green; DB pending |
| Transition-only vs support/reminder/creation events | §§11–12 | registry `is_transition`; M24/M32 | non-transition false-positive test green |
| All Appendix D customer/store/ops notification types | §11.2; App. D | notification registry/fan-out M24–25 | notification 19/19; DB pending |
| Confirmation, clarification, decision, payment, closure, support tasks | §§10–12 | M10, M14–28 | scheduler contracts green; DB pending |
| Reconciliation task categories/cases | §12 | M31–33 | Unit 15 green; DB pending |
| Customer cart/list/detail/clarification/decision/cancel/payment-ready/deep link | §13 | customer routes/screens/hooks/services | UI tests green; complete source |
| Owner inbox/detail/review/outcomes/clarification/support/deep link | §13 | Owner routes/screens/hooks/services | UI tests green; complete source |
| Manager/staff denial and no Phase 7 payment action | §§3, 13–14 | capability gates + UI omission | scans/tests green |

## 6. Migration and Security Review

| Range | Purpose | Review result |
|---|---|---|
| M01–M05 | schema, evidence, extensions, RLS/safe reads, eligibility | Ordered/additive; fixed paths; client writes revoked; historical equality is `NOT VALID` and needs preflight audit. |
| M06–M10 | cart/replacement/submission | Transactional named RPCs; sorted locks; no holds at submission. |
| M11–M19 | holds/outcomes/support/decision/expiry | Bucket transfers and terminal cleanup; real row/race execution pending. |
| M20–M23 | schedules/deadlines/closures | No cron activation; persisted timezone/exception execution pending. |
| M24–M28 | evidence/notification/task scheduler | Append-only evidence, service claims, no `cron.schedule`; delivery/task execution pending. |
| M29–M30 | UI-safe projections | Customer/Owner authority and column allowlists; persisted grants/RLS pending. |
| M31–M33 | reconciliation/observability | Detection-first, service-only, PII-safe, idempotent; no inventory/request repair; DB execution pending. |

Security review found no source-level P0/P1: Phase 6 functions pin `search_path`, derive
authority server-side, revoke authoritative client writes, keep raw events/tasks/holds/private
snapshots unavailable, and expose no service credential or Phase 7 provider behavior. Persisted
grants/RLS and cross-session behavior remain a P2 verification gap until an isolated DB runs.

## 7. Rollout, Smoke, and Rollback Plan

1. In an isolated environment, record PostgreSQL/Supabase versions; reset and apply the full migration chain through M33.
2. Run preflight audits for inventory bucket equality, policy overlap/type/range, schedule/timezone validity, entitled Owners, existing event/notification payload keys, and `NOT VALID` constraints.
3. Seed required global policy fallbacks, disabled rollout flags, then store/locality allowlists and owner entitlements.
4. Development scheduler/worker rollout is complete: scheduler v5 uses custom-secret authentication, worker v3 requires service-role authorization, and cron job 5 runs each minute. Preserve those boundaries; production rollout remains separately gated.
5. Run Units 8–15 rollback-only SQL gates, then all multi-session race scripts with disposable, non-PII fixtures.
6. Verify persisted grants/RLS for anon/customer/Owner/manager/staff/support/service and Phase 5 anonymous discovery.
7. Enable only an internal store/locality, then perform customer and Owner smoke with a `smoke_run_id` and append-only non-PII evidence.
8. Stop on migration failure, tenant leakage, counter/hold mismatch, duplicate evidence/fan-out, dead letter, policy/schedule error, or any provider/payment write.
9. Before live data, rollback may remove new objects in reverse order after flags/cron are disabled. After live request data, use forward fixes only; retain history, cancellation, expiry, release, support, reconciliation, events, and snapshots.
10. Cleanup disposable mutable fixtures and report residue; retain tagged append-only evidence where policy requires it. Never promise zero append-only residue.

## 8. Release Gate

Current verdict: `PHASE 6 COMPLETE — COMPREHENSIVE BROWSER E2E DEFERRED`.

Development database and scheduler rollout gates are complete through provider-independent
`payment_ready`. Remaining acceptance work is comprehensive browser E2E, browser-created
persisted-effect verification, responsive/accessibility review, and real timed commerce-command
verification. No Phase 7 behavior is included in this checkpoint, and production rollout remains
a separate authorization.
