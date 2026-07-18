# PHASE-6: Order Request and Confirmation

**Status:** `complete_e2e_deferred`
**SDD status:** `approved_for_local_implementation`
**Last updated:** 2026-07-18
**Phase goal:** Build the unpaid order request and store confirmation flow before payment.

---

## Required Reading

- [Marketplace README](../README.md)
- [DOC-13: Master Implementation Tracker](../DOC-13-implementation-tracker.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-0: Product Architecture](../DOC-0-product-architecture.md)
- [DOC-1: Identity, Security, and Compliance](../DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](../DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-3: Canonical Books, Metadata, and Inventory](../DOC-3-canonical-books-metadata-inventory.md)
- [DOC-5: Consumer Marketplace and Discovery](../DOC-5-consumer-marketplace-discovery.md)
- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](../DOC-7-fulfillment-delivery.md)
- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
- [DOC-14: Commerce State Machines](../DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](../DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](../DOC-16-pilot-and-unit-economics.md)
- [Phase 5 Consumer Discovery tracker](./PHASE-5-consumer-discovery.md)
- [Architecture Remediation Plan](./ARCHITECTURE-REMEDIATION-PLAN.md)
- [Phase 6 corrected monolithic SDD](./PHASE-6-order-request-confirmation-SDD.md)
- [Immutable v0.1 original monolith](./archive/PHASE-6-order-request-confirmation-SDD-v0.1-original-monolith.md)

---

## Scope

- Single-store cart.
- Cart replacement warning.
- Unpaid order request.
- Store confirmation.
- Partial availability.
- Distinct full-request rejection.
- Store Owner platform-support request without direct state transition.
- Open-hours confirmation SLA.
- Planned closure, bounded emergency closure, and suspension behavior.
- Provider-independent `payment_ready` without a payment-provider object.
- Inventory holds after confirmation.
- Transition logs/events for request, item, and inventory hold states.
- Critical confirmation deadline and payment-ready notifications.
- Server-enforced flags, locality, store allowlist, owner capability, and tenant isolation.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Canonical vocabulary/runtime validation | `complete` | Shared typed constants and Zod schemas; focused Jest 15/15 and TypeScript pass. |
| Additive database foundation | `complete` | Phase 6 migrations M01-M39 are applied to the development Supabase project. |
| Authorization, RLS, grants, and safe reads | `complete` | Owner capability, deny-by-default authoritative tables, and safe RPC projections are deployed and database-verified. |
| Policy and eligibility resolver | `complete` | Deterministic application and private database resolvers are deployed and verified through `payment_ready`. |
| Transactional cart commands | `complete` | Versioned, idempotent cart commands and replacement flow are deployed and persisted behavior is verified. |
| Atomic request submission | `complete` | Atomic request, snapshots, evidence, events, notifications, tasks, and authority guards are deployed and verified. |
| Owner outcomes and inventory holds | `complete` | Source contracts and persisted development database behavior are verified; comprehensive browser E2E remains deferred. |
| Clarification and platform support | `complete` | Source contracts and persisted development database behavior are verified; comprehensive browser E2E remains deferred. |
| Customer decision, cancellation, and expiry | `complete` | Persisted progression through provider-independent `payment_ready` is verified; real timed browser E2E remains deferred. |
| Canonical events, audit, and notifications | `complete` | Registries, append-only evidence, safe inbox projections, and transport separation are deployed and database-verified. |
| Scheduler, task worker, retry, and dead letter | `complete` | Scheduler v5, worker v3, and one-minute cron job 5 are active in development; synthetic dispatch/retry/dead-letter gates passed. |
| Reconciliation and observability | `complete` | Development database reconciliation and observation structures are deployed and verified. |
| Full Phase 6 verification | `complete_e2e_deferred` | Source and development database gates are complete. Comprehensive browser E2E, responsive/accessibility review, and real timed commerce-command E2E remain explicitly deferred. See the [verification and traceability record](./PHASE-6-verification-and-traceability.md). |
| Customer UI | `complete_e2e_deferred` | Customer flows are implemented; comprehensive browser, responsive, and accessibility E2E are deferred. No provider payment command exists. |
| Store Owner UI | `complete_e2e_deferred` | Owner flows are implemented; comprehensive browser, responsive, and accessibility E2E are deferred. |
| Phase 6 normative monolithic SDD | `complete` | Corrected monolith remains the sole normative Phase 6 SDD; the exact v0.1 source remains archived immutably. |
| Single-store cart model | `complete` | One active cart/customer with server-derived store and versioned transactional mutation RPCs is deployed and verified. |
| Cart replacement UX | `complete_e2e_deferred` | Two-step replacement behavior is implemented and database-verified; comprehensive browser E2E is deferred. |
| Order request model | `complete` | Atomic unpaid submission and the customer request lifecycle are deployed and verified through `payment_ready`. |
| Store confirmation UI/API | `complete_e2e_deferred` | Persisted command/RLS behavior is verified; comprehensive customer/Owner browser E2E is deferred. |
| Open-hours SLA engine | `complete_e2e_deferred` | Schedule/deadline behavior is deployed; real timed browser commerce-command E2E is deferred. |
| Inventory holds | `complete` | Firm/soft bucket transfers and release behavior are deployed and database-verified. |
| Payment-ready state | `complete` | Exact immutable commercial fields and firm-hold guard are verified through provider-independent `payment_ready`; no Phase 7 object exists. |
| Request events/notifications | `complete` | Transactional evidence, canonical inbox, and transport retry boundaries are deployed and verified. |
| Commerce transition tests | `complete` | Source and persisted database gates cover DOC-14 Phase 6 actors, guards, versions, and evidence. |
| Tests | `complete_e2e_deferred` | Repository/source/database gates pass; comprehensive browser, responsive/accessibility, and real timed E2E remain deferred. |

---

## Verification Log

### 2026-07-17: Source and database checkpoint

- Phase 5 remains complete. Phase 6 Units 1-15 are source-complete and migrations M01-M39 are applied to the development Supabase project. M34-M39 are forward-only corrective migrations; no applied M01-M33 migration was replaced for correction.
- Persisted database command and authorization verification completed through provider-independent `payment_ready`, including corrective migration/security suites. The prior full repository checkpoint passed 908/908 tests; TypeScript and production web export passed at the source-complete checkpoint.
- Initial browser smoke passed for preview launch, authentication, Marketplace, Cart and Order Requests controls, and empty-cart routing, with no console errors. Controlled `phase6_browser_*` development fixtures remain available.
- The development scheduler rollout is active: scheduler v5 uses custom-secret authentication, worker v3 retains strict service-role authorization, and the scheduler explicitly forwards its server-side service-role bearer token to the worker. Cron job 5 runs every minute; its first scheduled empty-queue run and tagged synthetic dispatch, retry, and dead-letter paths passed. Focused authorization regression passed 4/4. No secret, bearer value, or Vault content is recorded.
- Comprehensive customer/Store Owner browser E2E, browser-created persisted-effect verification, full responsive/accessibility review, and real timed commerce-command reminder/expiry verification remain deferred. Verdict: `PHASE 6 COMPLETE — COMPREHENSIVE BROWSER E2E DEFERRED`. This development rollout is not a production-readiness declaration, Phases 7 and 8 are deferred, and Phase 6 ends at `payment_ready`.

### 2026-07-16: Stage 1 reconciliation and Stage 2 SDD

- Stage 1 architecture/decision report approved with founder corrections for sign-in-first routing, distinct rejection, support request, closure/suspension, worked SLA examples, owner-only MVP entitlement, private contact/address, delivery minimum, partial revision, paused listings, and `payment_ready`.
- A temporary three-document split was produced during design reconciliation, then intentionally deleted and superseded by the corrected monolith. It is not normative and must not be restored.
- The accepted substantive findings were carried into the corrected monolith: direct request creation plus separate cart transition; entitled-Owner availability before submission; cross-table invariant enforcement; safe column projections; no substitutions; independent support-task versioning; PostgreSQL/pg_cron/Edge scheduler architecture; corrected SLA examples; append-only live-smoke evidence; lazy cart abandonment; rollout kill-switch behavior; and canonical in-app notifications despite transport failure.
- Applied only approved terminology/state-machine corrections to DOC-6, DOC-10, DOC-12, and DOC-14.
- No production code, test, migration, Edge Function, RPC, route, screen, job, live Supabase operation, or Git-state mutation was performed.
- Documentation link/terminology validation is recorded at handoff; production verification remains not started.

### 2026-07-16: Monolith correction directive

- Archived the exact 1,066-line v0.1 pasted monolith and created the corrected v0.2 working monolith without recreating the deleted split.
- Incorporated direct request creation plus separate cart transition evidence, entitled-Owner precondition, deterministic tariff boundary, full canonical vocabulary/policy/eligibility/enforcement catalogues, exact worker contract, support interventions, safe projections, fixed ISO-date SLA examples, lazy cart abandonment, append-only smoke evidence, and invariant-level traceability.
- Reconciled only verified source contradictions. Local implementation is authorized after the Stage 4 documentation validation verdict; remote/live actions remain prohibited.

### 2026-07-16: Local implementation Unit 1

- Added the complete canonical Phase 6 vocabulary and Zod runtime schemas under `src/features/marketplace/commerce/`.
- Red-first focused Jest failed on the intentionally missing modules, then passed 15/15 after implementation; full TypeScript no-emit passed.
- Phase 6 implementation status changes to `in_progress`. No migration was applied and no remote system changed.

### 2026-07-16: Local implementation Unit 2

- Added three additive local migration files for cart/request/hold/schedule core, immutable snapshots/policy acceptance/evidence, and foundation infrastructure extensions.
- Red-first migration contract tests failed 5/5 on absent files, then passed 5/5. Files remain below 210 lines and `git diff --check` passes.
- No migration was applied locally or remotely. Real PostgreSQL execution, RLS, commands, and concurrency verification remain later gates.

### 2026-07-16: Local implementation Unit 3

- Added the active-Owner plus capability-entitlement helper, deny-by-default RLS/grants, recipient-own canonical notification policy, and distinct customer/Owner/support safe-read RPCs.
- Red-first security contracts failed 5/5 on the absent migration, then passed 5/5. Cross-tenant detail IDs return no row, manager/staff do not satisfy Owner capability, and private snapshots/raw events/holds/tasks/audit remain unavailable to clients.
- The migration is a local file only and has not been executed against PostgreSQL locally or remotely.

### 2026-07-16: Local implementation Unit 4

- Added deterministic operation-level eligibility logic and private SQL policy/eligibility resolvers with store-to-global policy precedence and fail-closed effective windows.
- Red-first tests failed on absent modules/migration, then passed 13/13 across store, latest subscription including grace period, entitlements, rollout, locality, listing/moderation/inventory, entitled Owner, fulfilment, and fixed/free BookConnect tariff behavior.
- Full TypeScript no-emit passes. SQL migrations remain unapplied; database execution and transactional integration begin with later command units.

### 2026-07-16: Local implementation Unit 5

- Added authenticated transactional get/create/add/update/remove cart RPCs, opaque cross-store replacement tokens and confirmation, and lazy expired-cart abandonment.
- Red-first command contracts failed 6/6 on absent migrations; a seventh regression then failed on missing listing revalidation during quantity updates. All 7/7 pass after implementation, with 45/45 focused Phase 6 tests green.
- Customer advisory locking, idempotency locking, cart/listing/inventory row order, expected-version checks, and the partial unique active-cart index form the concurrency boundary. Cart commands create no inventory holds. PostgreSQL race execution remains a later local-environment gate.

### 2026-07-16: Local implementation Unit 6

- Added one atomic authenticated submission RPC that locks and validates the whole cart, proves every item belongs to the derived store, verifies entitled Owner availability, calculates the lower immutable price bound and BookConnect tariff, and creates the request directly in `submitted`.
- The transaction writes immutable request/item/private/seller/policy snapshots, distinct request-creation and cart-transition evidence/events, canonical customer/Owner notifications, and reminder/expiry tasks. It creates no holds or Phase 7 objects.
- Red-first submission contracts failed 7/7 on absent migrations, then passed 7/7; 52/52 focused Phase 6 tests and TypeScript pass. The Unit 10 open-hours calendar replaces the bounded interim submission-window helper before release verification.

### 2026-07-16: Local implementation Unit 7 source pass

- Added Owner-only begin-review, full confirmation, partial confirmation, item-unavailable, and full-rejection RPCs plus private firm/soft hold creation and exactly-once release helpers.
- Commands derive the store from the locked request, require the active Owner capability, enforce expected version and source state, lock request/items/inventory/holds in order, validate every quantity and price before bucket movement, and write transition/event/audit/notification/task/idempotency effects atomically.
- The initial 6/6 absent-contract failures now pass; expanded replay/race/accounting contracts pass 8/8. The complete focused Phase 6 suite passes 60/60, authorization/safe-read contracts pass 5/5, TypeScript and `git diff --check` pass.
- Unit 7 is not marked database-verified: this machine has no runnable local PostgreSQL/Supabase daemon, so real hold-row/counter and multi-session race tests could not execute. No remote database was used.

### 2026-07-16: Local implementation Unit 8 source pass

- Added private clarification/support storage; Owner request and customer response RPCs; customer-own and Owner-capability clarification projections; non-transitioning, independently versioned Owner support requests; and only the four approved platform support interventions.
- The commands enforce server-derived request/store/customer authority, exact roles/source states/reasons, expected versions, idempotency, bounded private text, canonical event/audit/notification evidence, and documented hold/deadline effects. Same-state extensions and support requests create no fake transition evidence.
- Red-first Unit 8 contracts moved from 13/13 expected missing-contract failures to 15/15 passing after safe-read and complete support-category coverage were added. The full Units 1-8 focused suite passes 75/75 across 9 suites, including Unit 7 8/8 and authorization/safe-read 5/5; TypeScript and `git diff --check` pass.
- `supabase/tests/phase6_unit8_integration.sql` is a disposable rollback-only PostgreSQL gate for role denial, transitions, replay deduplication, privacy, support non-mutation, stale versions, and same-state evidence. It was not executed: transactional Units 5-8, persisted RLS/grants, and real concurrency remain pending because no runnable local PostgreSQL/Supabase daemon is available. No remote database was used.

### 2026-07-16: Local implementation Unit 9 source pass

- Added customer `accept_confirmed_changes` and `cancel_order_request`, platform-admin-only `cancel_for_rollout_shutdown`, and service-only `expire_customer_decision` and `expire_payment_ready` commands.
- Acceptance binds to the current request version and server-owned item proposal, revalidates progression eligibility, uses immutable request policy snapshots for the BookConnect tariff, supports the required delivery-minimum pickup choice, promotes every soft hold to firm without moving inventory buckets, and atomically enters provider-independent `payment_ready`.
- Payment-ready entry now has a shared trigger guard for Unit 7 full confirmation and Unit 9 acceptance: positive exact INR totals, active firm holds for every payable item, no soft/extra holds or open clarification, immutable payment-ready commercial fields, payment-ready timestamp, policy snapshot reference, and expiry deadline are mandatory.
- Customer/rollout cancellation and typed decision/payment expiry release active holds through the existing exactly-once reserved-to-available helper, close tasks, create one transition/event/audit/notification set, and are protected by request/version/idempotency locks. Terminal transitions have a shared no-active-hold guard.
- Red-first tests failed 24/24 on absent migrations and now pass 25/25 after integration/race-gate coverage was added. The full Units 1-9 suite passes 100/100 across 10 suites; Unit 7 remains 8/8, Unit 8 remains 15/15, authorization/safe reads remain 5/5, and migration contracts pass 76/76.
- `phase6_unit9_integration.sql` and `phase6_unit9_concurrency.ps1` cover rollback, bucket conservation/release, replay, acceptance-versus-cancellation, acceptance-versus-decision-expiry, and a future Phase 7 row-lock boundary. They were not executed because no isolated local PostgreSQL/Supabase daemon is available. No remote database was used.

### 2026-07-16: Local implementation Unit 10 source pass

- Added a deterministic interval-jump time engine and additive schedule schema for IANA store timezones, recurring and multiple daily intervals, overnight hours, closed days, holidays, special hours, full closures, bounded next-opening lookup, exact open-seconds accumulation, and stable invalid/unavailable errors. DST-forward, DST-backward, and Asia/Kolkata behavior are covered independently of command execution.
- Replaced the Unit 6 interim submission window and Unit 8 elapsed-seconds approximation with calendar-aware reminder, confirmation, clarification pause/resume, customer-decision, and payment-ready deadlines tied to immutable request policy snapshots. Deadline tasks now carry exact `due_at`, request-version and policy-snapshot provenance, supersede obsolete active tasks, and deduplicate by request/version/category.
- Added service-owned clarification expiry, bounded emergency pause/resume/expiry, and store-ineligibility cancellation. Emergency commands enforce exact source state/version/time, request-item-inventory-hold-task lock order, maximum duration/count, saved deadline remainder, soft-hold expiry preservation without bucket movement, firm/payment-ready exclusion, canonical evidence, and idempotency. Planned closures only affect schedule calculation; feature disablement alone does not mutate existing requests; compliance cancellation remains an explicit audited command.
- Red-first Unit 10 tests moved from 38/38 expected missing-contract failures to 39/39 passing after the executable database-gate contract was added. The full Units 1-10 focused suite passes 139/139 across 12 suites; Phase 6 migration contracts pass 102/102; Unit 7 remains 8/8, Unit 8 15/15, Unit 9 25/25, authorization/safe reads 5/5, TypeScript, PowerShell parsing, and `git diff --check` pass.
- The worked Asia/Kolkata vector uses Friday 2026-07-17 23:00 local: 10,800 open seconds accrue by Saturday 02:00, the next opening is Saturday 20:00, the sixth accumulated hour is Saturday 23:00, and the two-business-date closing boundary is Sunday 02:00.
- `phase6_unit10_integration.sql` and `phase6_unit10_concurrency.ps1` cover persisted timezone/deadline results, exception precedence, grants, pause/resume/task provenance, no silent feature cancellation, payment-ready hold preservation, pause-versus-acceptance, pause-versus-expiry, and inventory conservation. They were not executed because no isolated local PostgreSQL/Supabase daemon is available; migrations 1-23 remain local/unapplied and no remote/live action occurred.

### 2026-07-16: Units 1-10 checkpoint and Unit 11 source pass

- The corrected 1,237-line monolithic SDD was reread in full. Migration order 1-23 is continuous; canonical states and named commands, transaction boundaries, request/item/inventory/hold/task lock order, event/notification seams, test claims, tracker state, and the `payment_ready` Phase 6 boundary were checked without a broad architecture reopening. No P0/P1 contradiction was found.
- Non-blocking audit notes are retained for the final Phase 6 audit: DOC-13 had a stale Unit 10 next-step entry; the separately named Unit 7 PostgreSQL harness is represented by its source contracts and later integration/race gates rather than its own file; and all real PostgreSQL checks remain unavailable on this machine.
- Unit 11 adds migrations 24-25 for event schema/version and notification-type registries, one-command/one-transition evidence, append-only enforcement, structured audit lineage, recipient-safe canonical inbox reads, opaque deep-link data, transport delivery separation, and safe retry/dead-letter recording. Red-first contracts pass 10/10.
- The app now dual-reads canonical commerce inbox rows and legacy non-commerce deliveries, marks commerce rows read through the canonical RPC, treats realtime only as a refetch signal, and reconstructs navigation from safe route data. Canonical inbox state remains independent of push transport success or failure.

### 2026-07-16: Local implementation Unit 12 source pass

- Added migrations 26-28 for bounded `FOR UPDATE SKIP LOCKED` claims, five-minute lease recovery, attempt history, the exact 30-second/2-minute/10-minute/30-minute/2-hour retry sequence, five-attempt dead letter, bounded audited manual replay, named reminder/expiry commands, and the pg_cron cadence/lease/run contract.
- Added service-only scheduler and worker Edge Functions with one-minute scheduler intent, default batch 50/max 100, fanout 4, worker concurrency 10, a 240-second worker timeout, stable task-derived idempotency, and named-command dispatch only. The legacy push worker explicitly excludes Phase 6 canonical deliveries.
- Unit 12 source contracts pass 14/14; Units 1-12 focused tests pass 182/182 across 16 suites and migration/security contracts pass 126/126 across 11 suites. TypeScript, PowerShell parsing, and `git diff --check` pass. Integration SQL and concurrency gates are written but remain unexecuted because no isolated local PostgreSQL daemon is available.
- Migrations 1-28 remain local/unapplied. No remote migration, deployment, cron activation, fixture, smoke test, staging, commit, push, or Phase 7 provider/payment/ledger behavior occurred.

### 2026-07-16: Local implementation Units 13-14 UI

- Unit 13 adds authenticated customer cart and request routes, typed services/hooks, explicit cross-store replacement confirmation, safe server-projected cart values, named-command submission and mutations, clarification, pickup-or-cancel decision, cancellation, terminal/payment-ready presentation, and discovery add-to-cart/request navigation.
- Unit 14 adds the capability-gated Store Owner Orders tab, safe inbox/detail, expected-version review/full/partial/unavailable/rejection/clarification/support commands, bounded quantity/price controls, distinct emergency pause/payment-ready closure copy, and no manager/staff override surface.
- Additive migrations 29-30 extend customer and Owner safe projections with the versions, commercial totals, deadlines, and bounded item fields required by UI commands. They preserve caller ownership/Owner capability checks and expose no phone, address, global customer identity, private snapshot, raw event, audit, hold ID, or task ID.
- Logout cancels queries, clears pending mutations and all QueryClient caches, resets in-memory commerce replacement/clarification/deep-link state, and persists no commerce snapshot in AsyncStorage/MMKV.
- Focused Units 1-14 source tests pass 250/250 across 25 suites; migration/security contracts pass 134/134 across 13 suites; route checks pass 4/4; TypeScript, production web export, and `git diff --check` pass.
- Migrations 1-30 remain local/unapplied. Real PostgreSQL transactional/RLS/grant/counter/hold/task/concurrency verification remains pending. No remote/live migration, deployment, cron activation, staging, commit, push, PR, or Phase 7 provider/payment behavior occurred.

### 2026-07-16: Local implementation Unit 15 and Unit 16 source gate

- The Units 1-14 consistency checkpoint found no P0/P1 source contradiction. Command-only writes, deterministic lock order, evidence/fan-out seams, safe projections, Owner entitlement, Phase 5 compatibility, and the provider-free `payment_ready` boundary remain intact.
- Red-first Unit 15 contracts failed 24/24 while the reconciliation files were absent, then passed 24/24 after migrations 31-33 and the rollback-only PostgreSQL harness were added.
- Reconciliation detects inventory/hold mismatches, impossible request/hold/item states, evidence gaps/duplicates, stale/dead/duplicate tasks, delivery/recipient failures, policy/schedule/Owner/rollout errors, stale deadlines, orphans, and prohibited PII. It never changes request status or ambiguous inventory; only expired leases and stale/incompatible tasks receive deterministic idempotent cleanup.
- The final static SQL review found and fixed a Unit 15 P1 before handoff: reconciliation now derives transition store scope through the referenced request/cart/event instead of a nonexistent transition column, and stale-lease cleanup touches only task lease columns that exist. Regression assertions preserve both fixes.
- Structured service-only observations cover command outcomes, transitions, hold changes, task claim/execution/retry/dead letter, notification transport, reconciliation, manual replay, and policy/inventory discrepancies. Aggregate metrics expose backlog age, dead letters, active discrepancies, requests by status, hold mismatches, retries, and notification failures without client access.
- Full source verification passes 274/274 across 26 suites; migration/security/reconciliation contracts pass 158/158 across 14 suites; TypeScript, production web export, Phase 5/notification compatibility, privacy/direct-write/Phase 7 scans, and `git diff --check` pass.
- Supabase CLI 2.20.12 is present, but no Docker engine, `psql`, or `pg_isready` is available. Migrations 1-33 therefore remain local/unapplied and persisted RLS/grants, rollback SQL, counters/holds, task/delivery execution, and multi-session races remain unverified. The local verdict is `PHASE 6 SOURCE-COMPLETE — DATABASE VERIFICATION REQUIRED`.

---

## Acceptance Criteria

- [x] Checkout creates unpaid order request.
- [x] Customer payment is not requested before store confirmation.
- [x] Store can confirm full, partial, unavailable, or distinctly reject a full request.
- [x] Store confirmation cannot exceed the server-established price bound, even with customer acceptance.
- [x] Store Owner can request platform support without changing commerce status.
- [x] Partial confirmation recalculates subtotal/delivery eligibility.
- [x] Expired requests take no payment and release holds.
- [x] Request and hold transitions emit events and preserve transition logs.
- [x] Confirmation reminder and expiry behavior is server-driven.
- [x] Planned closure, bounded emergency closure, and compliance/selling suspension follow the approved differentiated rules.
- [x] Owner-only commands are enforced as an MVP capability/entitlement without collapsing manager/staff schema roles.
- [x] Phase 6 ends at `payment_ready` and creates no provider object or paid order.
- [x] DOC-14 transition rules are satisfied for order request and hold states.
- [x] The corrected monolithic SDD is the sole normative Phase 6 design and is approved for local implementation.
- [x] `DOC-13` links the corrected monolith and immutable archive; deleted split documents are not referenced.

---

## Deferred Follow-up

- Comprehensive customer/Store Owner browser E2E, browser-created persisted-effect review,
  responsive/accessibility review, and real timed commerce-command E2E are deferred.
- `store_inventory_quantity_balance` has zero current violations but remains `NOT VALID`;
  validate it with a forward migration before production readiness.
- Production rollout remains separately authorized.

---

## Decisions Made During Implementation

- Units 1-14 implement only the commands, invariants, transaction/lock boundaries, evidence seams, operational limits, and customer/Owner UI named by the corrected monolithic SDD; source contracts do not authorize remote activation.
- Approved business decisions are recorded in the primary SDD Sections 2-8; data/operations controls are in the data document; gates are in the implementation plan.

---

## Spec Deviations

- Approved source reconciliation: Phase 6 ends at `payment_ready`, not `payment_pending`.
- Approved source reconciliation: inventory holds use repository-compatible bucket transfer, not `available - active holds` double subtraction.
- Approved source reconciliation: full-request rejection is separate from stock unavailability.
- Approved source reconciliation: Store Owner support request is non-transitioning.

---

## Handoff Notes

The corrected monolithic SDD is the sole normative Phase 6 design. Phase 6 is complete through
forward migration M39 and provider-independent `payment_ready`. Scheduler v5 and worker v3 are
active only in development; cron job 5 runs every minute. Comprehensive browser and real timed
commerce-command E2E are deliberately deferred. Production rollout remains separate; Phases 7
and 8 are deferred, and Phase 9 planning is authorized without payment or pickup behavior.
