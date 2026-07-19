# DOC-13: Implementation Tracker

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
**Status:** Live implementation tracker
**Depends On:** DOC-12 and all phase trackers in `implementation/`
**Purpose:** Track live implementation progress, blockers, deviations, and handoff state without turning source specifications into status logs.

---

## 1. Tracking Rules

This file is the master status board. It should stay concise.

Detailed implementation notes belong in the relevant phase tracker under [`implementation/`](./implementation/).

Every new session must start from repository `AGENTS.md`, [`implementation/ACTIVE.md`](./implementation/ACTIVE.md), this tracker, and the active phase session-start/tracker. Chat history and old root kickstart documents are not status authority.

Every coding session must update tracking before ending if it changes any of the following:

- phase status
- current milestone
- blockers
- risk level
- completed migrations/services/screens/tests
- RLS/security verification
- source-spec deviations
- next recommended task
- handoff notes

Every material session must also leave one exact active work unit and next authorized action in the active phase tracker, record verification/external mutations in its detailed log, and run the active continuity validator. When the active phase changes, update DOC-13, `implementation/ACTIVE.md`, both README handoffs, the outgoing/incoming phase trackers, and the current pointer in repository `AGENTS.md` together.

If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.

---

## 2. Current Status

> 2026-06-30 refresh: Phase 1 foundation remains applied in live Supabase. Phase 2A Store Owner gate/auth/security hardening is implemented locally and its write-boundary hardening migration is applied live. Phase 2B has controlled store application/document writes through the `store-application` Edge Function, app service wrappers, onboarding UI, metadata persistence, pilot locality validation, sanitized DB errors, and private document upload tests. Phase 2C platform review/setup entitlements is implemented locally and deployed: review metadata migration is live, `store-review` is deployed with JWT verification enabled, and Store Owner setup/status screens exist. Phase 2B authenticated live smoke passed; Phase 2C unauthenticated live smoke returned `401`; authenticated platform-review smoke is pending platform-operator test credentials. Phase 3 manual inventory/canonical/listing projection migration is applied live through Supabase MCP and schema/RLS verified. A 2026-06-29 Supabase MCP smoke confirmed the inventory trigger projects a publishable row into `marketplace_book_listings`, then cleaned up the disposable smoke inventory/listing and restored the store fixture. Anonymous public-read smoke is still blocked by the public listing RLS policy calling `marketplace_sec` helper functions that `anon` cannot execute. Phase 4 Store Owner Console is locally complete: dashboard, owner inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, route tabs, and focused tests are implemented with TypeScript and web export passing.

> 2026-07-15 review refresh: Git is synchronized by content with the recently merged `origin/main`. Supabase MCP and `.env` both identify project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`). Phase 4 remediation adds the controlled `store-profile` function, approved-store setup completion, stricter checklist readiness, inventory workflow fixes, and migration `20260715000001_marketplace_phase4_security_hardening.sql`. Store tests pass 13 suites/118 tests; TypeScript and production web export pass. The migration is live as `20260715115929 marketplace_phase4_security_hardening`; grants verify `anon=false`, `authenticated=false`, `service_role=true`. `store-profile` version 1 is ACTIVE with `verify_jwt=true`; unauthenticated live smoke returned `401`. Positive authenticated owner-write smoke awaits an approved disposable credential.

> 2026-07-15 Phase 5 review refresh: Consumer discovery is locally complete after red-test remediation. Public-only services now include runtime validation, safe filter construction, explicit paging/retry, store-name discovery, and book availability detail. Migrations `20260715155047 marketplace_phase3_public_listing_policy_split` and `20260715155103 marketplace_phase5_discovery_hardening` are live and read-only verification confirms the anonymous/authenticated policy split, pilot-locality eligibility, private inventory/analytics boundary, constrained boolean demand RPC, rate limiting, and 90-day retention. Relevant Jest 8 suites/54 tests, TypeScript, production web export, and `git diff --check` pass. No fixture or RPC smoke write was performed; positive discovery smoke remains fixture-gated.

> 2026-07-15 Phase 5 acceptance refresh: The authorized positive smoke exposed private-`stores` RLS evaluation returning zero public rows. Red-first migration `20260715000003_marketplace_phase5_public_policy_projection_fix.sql` now evaluates public eligibility through `public_store_profiles` plus the pilot locality and is live as `20260715174111 marketplace_phase5_public_policy_projection_fix`. Anonymous/authenticated title, author, ISBN, store, profile, book-detail, canonical grouping, offer comparison, private-boundary, demand-RPC, disabled-locality, and cleanup checks all pass. Targeted Jest passed 8 suites/52 tests and TypeScript passed. Phase 5 is complete and accepted; Phase 6 was not started.

> 2026-07-16 Phase 6 monolith correction: the exact v0.1 pasted monolith is preserved in the implementation archive and the corrected v0.2 monolith is the sole normative Phase 6 SDD. The intentionally deleted three-document split must not be restored. The corrected design includes direct request creation plus separate cart transition evidence, entitled-Owner availability before submission, cross-table enforcement, safe projections, no substitutions, independent support-task versioning, exact pg_cron/Edge worker architecture, deterministic tariff, fixed ISO-date SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical commerce inbox behavior. Local implementation is authorized only after the Stage 4 documentation validation verdict; remote/live changes remain separately gated.

> 2026-07-17 Phase 6 checkpoint refresh: Phase 5 remains complete. Phase 6 Units 1-15 are source-complete, migrations M01-M39 were applied to the development Supabase project, and persisted command/authorization behavior was verified through provider-independent `payment_ready`. M34-M39 are forward-only corrective migrations added after the initial M01-M33 apply. The prior complete repository checkpoint passed 908/908 tests, TypeScript, and production web export. Initial browser authentication/navigation/Marketplace/cart-empty smoke passed without console errors and controlled `phase6_browser_*` development fixtures remain available. The development scheduler rollout is active: scheduler v5 uses custom-secret authentication, worker v2 keeps strict service-role authorization, and scheduler dispatch explicitly forwards its server-side service-role bearer token. Cron job 5 runs each minute; the first scheduled empty-queue run and tagged synthetic dispatch/retry/dead-letter paths passed, with focused regression 4/4. Comprehensive customer/Store Owner browser E2E, browser-created persisted-effect verification, full responsive/accessibility review, and real timed commerce-command verification remain deferred. This is not a production-readiness declaration; Phase 7 is not started.

> 2026-07-18 Phase 6 completion and roadmap decision: Supabase MCP readback reconfirmed the healthy `Bookconnect_reactexpo` development project, all M01-M39 Phase 6 migrations, RLS on authoritative Phase 6 tables, active scheduler v5/worker v3, and successful one-minute cron job 5 executions. Existing inventory has zero quantity-balance violations; the equality constraint remains `NOT VALID` and must be validated by a forward migration before production. Phase 6 is recorded as complete with comprehensive browser E2E, responsive/accessibility review, browser-created persisted-effect review, and real timed commerce-command E2E deliberately deferred. Phases 7 and 8 are deferred by product decision. Phase 9 planning is now the active milestone and must remain independent of payment, paid-order, pickup, ledger, refund, and settlement behavior.

> 2026-07-19 Phase 9 planning refresh: the complete Phase 9 planning set was drafted under `implementation/phase-9-image-inventory/` with a master SDD, six domain SDDs, data dictionary, live database/storage current-vs-target audit, requirements traceability, complexity register, and three-level local tracker split. Supabase was re-verified read-only as project `ahntbtktjjmvfosgkmgn` (`Bookconnect_reactexpo`); `store_id` is canonical (37 public-schema columns, zero `tenant_id`). Phase 9 begins with camera/gallery same-language spine stacks capped at 15, provider/model adapters, mandatory owner review, advisory duplicates without image comparison, multilingual search aliases, separate damage/media, bookstore-first discovery, and mandatory customer-requested current-copy photos. Repository `AGENTS.md`, `implementation/ACTIVE.md`, Phase 9 `SESSION-START.md`, tracker markers, update matrix, and a read-only continuity validator now provide deterministic new-session resume/closeout. The user approved this planning baseline on 2026-07-19 and authorized the Work Unit 0 plan only. No Phase 9 migration, code, function, bucket/policy, or data mutation occurred.

| Field | Value |
|---|---|
| Current phase | Phase 9: Image-to-LLM Inventory - **planning baseline approved; Work Unit 0 plan active; implementation not started** |
| Overall status | `in_progress` |
| Last updated | 2026-07-19 |
| Latest handoff | `PHASE 6 COMPLETE — COMPREHENSIVE BROWSER E2E DEFERRED`. M01-M39 are applied and database-verified in development; scheduler v5, worker v3, and cron job 5 are active. Phases 7 and 8 are deferred. |
| Current risk level | Medium - Phase 9 design now contains AI, tenant, media, retention, duplicate, multilingual, and marketplace risks; implementation evidence and vendor/legal selection remain pending. Phase 6 E2E stays a recorded deferred gate. |
| Next recommended task | Create and review the Work Unit 0 contracts/threat/migration-design plan. Do not create/apply migration files, start product implementation, or introduce Phase 7/8 behavior. |

---

## 3. Phase Summary

| Phase | Status | Tracker | Notes |
|---|---|---|---|
| Phase 0: Codebase and DB Audit | `needs_review` | [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md) | Audit complete; review before Phase 1. |
| Phase 1: Foundation Schema and Security | `needs_review` | [PHASE-1](./implementation/PHASE-1-foundation-schema-security.md) | Foundation migrations applied and post-deployment audit passed. Follow-up index fix applied. Ready for Phase 2 planning. |
| Phase 2: Store Onboarding and Verification | `needs_review` | [PHASE-2](./implementation/PHASE-2-store-onboarding-verification.md) | Phase 2A implemented locally and hardening migration applied live; Phase 2B service/UI/metadata slice is implemented, deployed, and authenticated-smoke-verified; Phase 2C review/setup entitlement slice is implemented and deployed. Authenticated platform-review smoke remains. |
| Phase 3: Inventory, Canonical Books, and Listings | `in_progress` | [PHASE-3](./implementation/PHASE-3-inventory-canonical-listings.md) | Manual inventory/projection slice implemented, tested, exported, and live-applied; trigger projection and anonymous/authenticated public-read smoke passed and cleaned up. Remaining phase status should be reconciled separately against its tracker. |
| Phase 4: Store Owner Console | `locally_complete` | [PHASE-4](./implementation/PHASE-4-store-owner-console.md) | Dashboard, inventory console, storefront/profile settings, subscription/quota view, compliance blockers, route tabs, tests, TypeScript, and web export complete locally. Security hardening and `store-profile` are deployed; positive authenticated owner-write smoke remains credential-gated. |
| Phase 5: Consumer Discovery | `complete` | [PHASE-5](./implementation/PHASE-5-consumer-discovery.md) | Implementation, live projection-based RLS correction, anonymous/authenticated discovery, canonical offer comparison, disabled-locality exclusion, private-access denials, constrained demand RPC, regression tests, TypeScript, and zero-residue cleanup all pass. Accepted 2026-07-15. |
| Phase 6: Order Request and Confirmation | `complete_e2e_deferred` | [PHASE-6 tracker](./implementation/PHASE-6-order-request-confirmation.md) · [verification/traceability](./implementation/PHASE-6-verification-and-traceability.md) · [corrected monolithic SDD](./implementation/PHASE-6-order-request-confirmation-SDD.md) · [immutable v0.1 archive](./implementation/archive/PHASE-6-order-request-confirmation-SDD-v0.1-original-monolith.md) | M01-M39 and persisted behavior through `payment_ready` are verified in development. Scheduler v5/worker v3 and cron job 5 are active. Comprehensive browser E2E and real timed commerce-command E2E are explicitly deferred, not silently passed. |
| Phase 7: Payment, Ledger, and Settlement | `deferred` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Deferred 2026-07-18; resume only through separate authorization and DOC-15/payment/legal/accounting gates. |
| Phase 8: Pickup Fulfillment | `deferred` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Deferred with Phase 7 because it requires verified paid-order creation. |
| Phase 9: Image-to-LLM Inventory | `planning_approved_wu0_active` | [Phase 9 handoff](./implementation/PHASE-9-image-to-llm-inventory.md) · [SDD/tracker set](./implementation/phase-9-image-inventory/README.md) | Planning baseline approved 2026-07-19; Work Unit 0 plan authorized. Implementation/migrations not started. |
| Phase 10: Third-Party Delivery | `not_started` | [PHASE-10](./implementation/PHASE-10-third-party-delivery.md) | Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators. |
| Phase 11: Notifications and Realtime | `not_started` | [PHASE-11](./implementation/PHASE-11-notifications-realtime.md) | Events, push/in-app, selected realtime. |
| Phase 12: Demand, Bookclubs, and Places | `not_started` | [PHASE-12](./implementation/PHASE-12-demand-bookclubs-places.md) | Growth layer after commerce loop. |

---

## 4. Global Blockers

- Payment provider not selected.
- Delivery provider not selected.
- Legal/accounting review pending before production payments.
- India marketplace compliance review pending before production payments.
- DOC-14 commerce state-machine review pending before feature coding beyond Phase 0/Phase 1 foundation.
- DOC-15 finance/tax/settlement review pending before payment work.
- DOC-16 Bangalore pilot/unit-economics review pending before pilot launch planning.
- Existing Supabase security advisor issues must be remediated separately or explicitly isolated before marketplace production launch.
- Phase 4 review remediation is deployed; positive authenticated profile/setup smoke remains pending an approved disposable Store Owner credential.

---

## 5. Global Decisions Made During Implementation

- 2026-07-18: Phase 6 is complete with comprehensive browser E2E explicitly deferred. Phases 7 and 8 are deferred by product decision, and Phase 9 planning is authorized next. This sequencing decision changes roadmap order only; DOC-14 payment/paid-order/pickup transition guards remain authoritative and no Phase 7/8 behavior may be folded into Phase 9.

- 2026-06-19: Architecture Remediation Plan executed (v0.2 sweep).
  - Money fields standardized to integer `_minor` (paise) across DOC-2, DOC-3, DOC-4, DOC-5, DOC-6, DOC-7, DOC-8, DOC-9, DOC-15, README, and PHASE-1 plan.
  - Canonical table names applied: `finance_ledger_entries`, `settlement_batches`, `seller_payout_accounts`, `marketplace_audit_logs`, `marketplace_localities`, `commerce_idempotency_keys`, `marketplace_notifications`.
  - DOC-4 and DOC-15 bumped to v0.2.
  - Commerce state machines refined with `awaiting_clarification`, `awaiting_customer_decision`, and two-tier soft/firm inventory holds.
  - `marketplace_localities` promoted to Phase 1; `stores.locality` converted to `locality_id` FK.
  - `commerce_idempotency_keys` promoted to Phase 1.
  - `settlement_batches` reserved TCS/GST tax fields (`tcs_deduction_minor`, `gst_on_commission_minor`, `tax_adjustments_minor`, `tax_treatment_version`).
  - `marketplace_notifications` projection added; raw `marketplace_events` client SELECT removed.
  - Security helper standardized on `marketplace_sec.is_store_admin(store_id)`; SEC-16 added to acceptance criteria.
  - DPDP section updated to name LLM vendor as data processor with image egress/residency rules.

- 2026-06-19: v0.2 sweep consistency gap-fill (DOC-12, DOC-16).
  - Post-push audit identified three remediation plan targets that were marked `[x]` but not yet edited: DOC-12 §7 (SM-02: `acceptance_window` policy), DOC-12 §12 (SEC-01: cross-tenant denial test requirement / SEC-16), and DOC-16 §2 + §5 (P1-02: `marketplace_localities.is_pilot_enabled` enforcement).
  - DOC-10 (SEC-02 target) confirmed to not exist as a standalone file; the `marketplace_events` raw-read removal was correctly applied to DOC-1 §7 and DOC-14 §13 instead. No action needed.
  - All three live edits applied; remediation plan task list now accurately reflects actual document coverage.

- 2026-06-19: Phase 1 foundation migrations applied to live Supabase project.
  - Four split migrations applied in order via Supabase MCP: schema (A), helpers (B), RLS (C), storage (D).
  - Post-deployment audit run across all 5 high-risk areas: financial column types, security helper definitions, trigger projection sync, CHECK constraints, and storage path isolation.
  - **Audit finding (SEC-04):** `marketplace_notifications` was missing FK indexes on `user_id` and `store_id` — columns evaluated in the `notifications select own` RLS USING clause. Fixed immediately via follow-up migration `marketplace_notifications_fk_indexes`.
  - All other checks passed: 27 tables present, all monetary columns `INTEGER`, all state machine CHECK constraints match v0.2 spec, all `marketplace_sec` functions are SECURITY DEFINER with blank `search_path`, trigger live-tested with full projection/retraction/locality-name cycle, all storage policies use `foldername[1]` path isolation with `store_administrators` join, `marketplace_events` has no client SELECT policy.

---

## 6. Source Spec Deviations

- 2026-07-18 sequencing deviation: DOC-12 originally placed Phase 7 payment and Phase 8 pickup before Phase 9 image inventory. Product direction defers Phases 7/8 and advances Phase 9 after the completed Phase 6 inventory/hold boundary. DOC-12 and the Phase 7/8/9 trackers were updated; DOC-14 requires no behavioral change.

When adding a deviation, include:

- date
- phase
- source spec affected
- original plan
- implemented behavior
- reason
- whether source spec was updated

---

## 7. Latest Completed Milestones

Implementation milestones completed:

- Phase 0 audit completed and recorded in [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md).
- Phase 1 foundation schema/security implementation plan created: [PHASE-1 plan](./implementation/PHASE-1-foundation-schema-security-plan.md).
- Current app routes/auth/Profile integration points audited for future Store Owner entry.
- Current P2P exchange boundary audited; P2P `listings`, `transactions`, credit tables, and transaction RPCs are confirmed as forbidden reuse for bookstore commerce.
- Live Supabase schema, RLS/policies, storage buckets, Edge Functions, realtime publication state, and advisor findings audited.
- Confirmed no marketplace/store/seller/inventory/order/payment/ledger/settlement/shipment schema exists yet.
- Phase 1 foundation migrations (split A–D + follow-up index fix) applied to live Supabase project and verified by comprehensive post-deployment audit (2026-06-19). All v0.2 standards confirmed in live DB.

Documentation milestones completed:

- Source specs `DOC-0` through `DOC-16` created.
- v0.2 architecture remediation sweep completed: `ARCHITECTURE-REMEDIATION-PLAN.md` tasks applied across DOC-1, DOC-2, DOC-4, DOC-6, DOC-12, DOC-14, DOC-15, DOC-16, README, and PHASE-1 plan; foundation migration aligned with remediation plan. Post-sweep consistency audit confirmed DOC-12 (SM-02 §7, SEC-01 §12) and DOC-16 (P1-02 §2/§5) gap-filled.
- India marketplace, payment, delivery, compliance, and operations guardrails added.
- Tracking scaffolds created.
- Store Owner entry rule implemented and documented: Login / first-run auth for new users, Profile section for existing signed-in users, both routed through the Store Owner gate.
- Phase 2B store application slice implemented, deployed, and authenticated-smoke-verified: controlled Edge Function actions, app service wrappers, onboarding UI, application metadata persistence, pilot locality validation, sanitized DB errors, private verification document upload tests, and cross-tenant denial.
- Phase 2C platform review/setup entitlement slice implemented and deployed: `store-review` Edge Function, `platform_user_roles` auth helper, review metadata migration, founding-trial subscription/entitlement assignment on approval, and Store Owner status/setup checklist screens. Approval moves stores to `approved_pending_setup`, sets verification approved, and keeps setup incomplete plus selling not allowed.
- Phase 4 Store Owner Console locally completed: dashboard, inventory management, storefront/profile settings, subscription/quota visibility, compliance blockers, Store Owner tab routes, and focused service/screen/route tests. Local verification passed `src/features/stores` Jest, Store Owner route Jest, TypeScript, and web export.
- Phase 4 security/workflow review remediation deployed (2026-07-15): controlled profile/setup boundary, approved-store setup workflow, inventory publish/filter/save corrections, trigger-helper EXECUTE hardening, and regression coverage. Function/JWT/grant/401 verification passed; positive owner-write smoke is credential-gated.
- Phase 5 discovery accepted (2026-07-15): projection-based public RLS correction deployed as `20260715174111`; anonymous/authenticated discovery, canonical offer comparison, private-boundary denials, constrained demand capture, locality disablement, and zero-residue cleanup passed.
- Phase 6 corrected monolith approved for local implementation (2026-07-16): the temporary split was intentionally deleted and superseded; the exact v0.1 monolith is archived immutably and the v0.2 monolith carries direct submitted request semantics, separate cart evidence, cross-table invariants, safe projections, entitled-owner gate, no substitutions, support-task versioning, exact scheduler, corrected SLA examples, append-only smoke evidence, lazy abandonment, named shutdown cancellation, and canonical notification fallback. No production or live changes occurred during documentation correction.
- Phase 6 Units 1-10 checkpoint and Units 11-12 source pass (2026-07-16): no P0/P1 contradiction was found; migrations 24-28 add canonical event/audit/inbox enforcement plus transport-independent notification delivery, bounded task claims/leases/retries/dead letters/manual replay, named reminder/expiry commands, and service-only scheduler/worker dispatch. Focused tests pass 182/182 and migration/security contracts 126/126; PostgreSQL execution and cron activation remain gated, and no Phase 7 behavior was added.
- Phase 6 Units 13-14 UI pass (2026-07-16): customer cart/request and Store Owner Orders routes, typed services/hooks, safe versioned projections, explicit replacement, clarification/decision/cancellation, review/outcome/support actions, deep-link refetch, and complete logout/cache cleanup are locally implemented. Focused Units 1-14 tests pass 250/250, migration/security contracts 134/134, TypeScript and production web export pass; migrations 1-30 remain local/unapplied and the PostgreSQL gate remains pending.
- Phase 6 Unit 15 and Unit 16 source gate (2026-07-16): forward migrations 31-33 add service-only reconciliation cases, deterministic stale-task cleanup, PII-safe structured observations, and operational metrics. Red-first Unit 15 passes 24/24; the complete source gate passes 274/274 and migration/security/reconciliation contracts 158/158. TypeScript, web export, Phase 5/notification compatibility, privacy/boundary scans, and diff hygiene pass. The [verification/traceability record](./implementation/PHASE-6-verification-and-traceability.md) gives the source-complete/database-pending matrix and rollout/rollback plan. No local Docker/PostgreSQL daemon exists, so Phase 6 is not locally database-verified.
- Unit 15 final static review caught and fixed invalid transition/task column references before handoff; regression contracts now assert derived request/cart store scope and valid lease-only cleanup columns.
- Phase 6 source/database checkpoint (2026-07-17): development Supabase has M01-M39, including forward-only corrective M34-M39; persisted command/authorization verification reaches `payment_ready`. Initial browser auth/navigation/Marketplace/cart-empty smoke passed with no console errors and controlled development fixtures remain. Scheduler v5/worker v2 and cron job 5 are active; comprehensive browser customer/Owner E2E, responsive/accessibility review, and real timed commerce-command checks remain deferred.
- Phase 6 completion/readback (2026-07-18): Supabase MCP reconfirmed M01-M39, authoritative-table RLS, active scheduler v5/worker v3, successful cron job 5 runs, and zero existing inventory quantity-balance violations. Comprehensive browser E2E remains explicitly deferred. Phases 7/8 are deferred and Phase 9 planning is authorized.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

**Phase 6 is complete through M39 and provider-independent `payment_ready`; comprehensive browser E2E remains explicitly deferred. Phases 7 and 8 are deferred, and Phase 9 planning is authorized.**

The Phase 1 foundation is applied, audited, and fully v0.2 compliant. The following tables are live and ready for feature implementation:

- `stores`, `store_administrators`, `store_status_history` — store creation and admin assignment
- `store_verification_requests`, `store_verification_documents` — verification submission and review
- `seller_payout_accounts` — payout account metadata collection
- `seller-verification-docs` bucket - document upload with path-scoped store isolation
- `marketplace_sec.is_store_admin()` — canonical RLS helper for all store-scoped policies

Next work:
1. Review the Phase 9 master/domain SDDs, data dictionary, live audit, traceability, complexity register, and local trackers.
2. If approved, plan Work Unit 0: recorded contracts/threat fixtures, migration order, rollback/forward-correction plan, and security tests.
3. Start implementation with same-language `spine_stack` (maximum 15) plus camera/gallery and mandatory Owner review; `single_cover` is not the first slice.
4. Preserve the Phase 6 quantity-bucket/hold and controlled-write boundary when creating or incrementing inventory.
5. Keep provider payments, `payment_pending`, paid orders, ledger, pickup, refunds, and settlement deferred with Phases 7/8.
6. Re-verify exact Supabase project/schema/storage/advisors before any migration creation/application and keep the existing `NOT VALID` quantity constraint as a separately reviewed production-readiness gate.
