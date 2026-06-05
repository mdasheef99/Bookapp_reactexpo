# DOC-13: Implementation Tracker

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Live implementation tracker
**Depends On:** DOC-12 and all phase trackers in `implementation/`
**Purpose:** Track live implementation progress, blockers, deviations, and handoff state without turning source specifications into status logs.

---

## 1. Tracking Rules

This file is the master status board. It should stay concise.

Detailed implementation notes belong in the relevant phase tracker under [`implementation/`](./implementation/).

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

If implementation changes product or architecture behavior, update the relevant source spec and record the reason in this tracker.

---

## 2. Current Status

| Field | Value |
|---|---|
| Current phase | Phase 1: Foundation Schema and Security Planning |
| Overall status | `needs_review` |
| Last updated | 2026-05-22 |
| Latest handoff | Phase 0 audit is recorded and Phase 1 foundation schema/security plan is drafted for review. No marketplace migrations or app code have started. |
| Current risk level | Medium-high until Phase 1 plan is reviewed and tenant/RLS/storage decisions are accepted. Existing Supabase security advisor issues must not be copied into marketplace work and should be remediated or explicitly isolated before launch. |
| Next recommended task | Review the Phase 1 foundation schema/security plan, answer its review questions, then implement approved migrations and RLS/security tests. |

---

## 3. Phase Summary

| Phase | Status | Tracker | Notes |
|---|---|---|---|
| Phase 0: Codebase and DB Audit | `needs_review` | [PHASE-0](./implementation/PHASE-0-codebase-db-audit.md) | Audit complete; review before Phase 1. |
| Phase 1: Foundation Schema and Security | `needs_review` | [PHASE-1](./implementation/PHASE-1-foundation-schema-security.md) | [Plan](./implementation/PHASE-1-foundation-schema-security-plan.md) drafted; review before migrations. |
| Phase 2: Store Onboarding and Verification | `not_started` | [PHASE-2](./implementation/PHASE-2-store-onboarding-verification.md) | Depends on Phase 1. |
| Phase 3: Inventory, Canonical Books, and Listings | `not_started` | [PHASE-3](./implementation/PHASE-3-inventory-canonical-listings.md) | Manual inventory before image-to-LLM. |
| Phase 4: Store Owner Console | `not_started` | [PHASE-4](./implementation/PHASE-4-store-owner-console.md) | Basic operating console only. |
| Phase 5: Consumer Discovery | `not_started` | [PHASE-5](./implementation/PHASE-5-consumer-discovery.md) | Marketplace search and public listing surface. |
| Phase 6: Order Request and Confirmation | `not_started` | [PHASE-6](./implementation/PHASE-6-order-request-confirmation.md) | Unpaid request before payment. |
| Phase 7: Payment, Ledger, and Settlement | `not_started` | [PHASE-7](./implementation/PHASE-7-payment-ledger-settlement.md) | Requires legal/accounting/payment review before production. |
| Phase 8: Pickup Fulfillment | `not_started` | [PHASE-8](./implementation/PHASE-8-pickup-fulfillment.md) | Pickup before third-party delivery. |
| Phase 9: Image-to-LLM Inventory | `not_started` | [PHASE-9](./implementation/PHASE-9-image-to-llm-inventory.md) | Depends on stable inventory/listing model. |
| Phase 10: Third-Party Delivery | `not_started` | [PHASE-10](./implementation/PHASE-10-third-party-delivery.md) | Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators. |
| Phase 11: Notifications and Realtime | `not_started` | [PHASE-11](./implementation/PHASE-11-notifications-realtime.md) | Events, push/in-app, selected realtime. |
| Phase 12: Demand, Bookclubs, and Places | `not_started` | [PHASE-12](./implementation/PHASE-12-demand-bookclubs-places.md) | Growth layer after commerce loop. |

---

## 4. Global Blockers

- Payment provider not selected.
- Delivery provider not selected.
- Legal/accounting review pending before production payments.
- India marketplace compliance review pending before production payments.
- Phase 1 foundation schema/security plan review pending before migrations.
- DOC-14 commerce state-machine review pending before feature coding beyond Phase 0/Phase 1 foundation.
- DOC-15 finance/tax/settlement review pending before payment work.
- DOC-16 Bangalore pilot/unit-economics review pending before pilot launch planning.
- Existing Supabase security advisor issues must be remediated separately or explicitly isolated before marketplace production launch.

---

## 5. Global Decisions Made During Implementation

None yet.

---

## 6. Source Spec Deviations

None yet.

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

Documentation milestones completed:

- Source specs `DOC-0` through `DOC-16` created.
- India marketplace, payment, delivery, compliance, and operations guardrails added.
- Tracking scaffolds created.
- Store Owner entry rule documented: Login / first-run auth for new users, Profile section for existing signed-in users, both routed through the Store Owner gate.
- Expert review findings incorporated: platform support/disputes are core ops, founding-store trial model added, Bangalore locality pilot added, seller-of-record decision added, post-payment unavailable flow clarified, minors/school users marked out of pilot scope.
- DOC-14 Commerce State Machines created.
- DOC-15 Finance, Tax, and Settlement Operating Model created.
- DOC-16 Pilot and Unit Economics created.

---

## 8. Next Recommended Task

Review the [Phase 1 foundation schema/security implementation plan](./implementation/PHASE-1-foundation-schema-security-plan.md), then convert the accepted plan into migrations and RLS/security tests.

Before migration work, decide:

- separate marketplace table names and tenant boundaries
- Store Owner gate and server-side ownership checks
- strict RLS and cross-store denial tests
- private seller-document storage and public asset storage without broad listing
- platform/admin primitives, policy config, and append-only audit/event foundations
- whether existing Supabase advisor issues are cleaned before launch or isolated from new marketplace code

Do not write Phase 1 migrations or app code until the Phase 1 plan is reviewed.
