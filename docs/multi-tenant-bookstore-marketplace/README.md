# Multi-Tenant Bookstore Marketplace Specification

**Product:** BookConnect
**Spec Suite Version:** 0.3
**Date:** 2026-07-19
**Status:** Planning draft
**Scope:** Multi-tenant bookstore marketplace, Store Owner product surface, consumer discovery, direct ordering, delivery orchestration, and bookstore subscriptions.

---

## New Agent Quick Start

If you are a new coding or review agent, start here and do not write code immediately.

1. Read repository [`AGENTS.md`](../../AGENTS.md) for the mandatory start/close and documentation-update contract.
2. Read the [active-phase router](./implementation/ACTIVE.md); do not infer the active phase from filenames or chat history.
3. Read this README to understand the locked marketplace decisions and domain separation rules.
4. Read [DOC-13: Implementation Tracker](./DOC-13-implementation-tracker.md) to confirm the current phase, latest handoff, blockers, and next authorized action.
5. Follow the active phase session-start file and tracker reading order.
6. Read [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md) before creating an implementation plan or touching product files.
7. Read the source specification docs routed for the active work unit. Do not rely on memory or older summaries.

Current handoff as of 2026-07-19:

- Phase 6 is `complete_e2e_deferred`; Phases 7 and 8 are deferred by product decision.
- Phase 9 Image-to-LLM Inventory is the active planning milestone; implementation has not started.
- The Phase 9 SDD/supporting/tracker set under [`implementation/phase-9-image-inventory/`](./implementation/phase-9-image-inventory/README.md) is the approved planning baseline; Work Unit 0 planning is authorized, but product implementation and migration creation/application are not.
- Phase 9 begins with same-language spine-stack images, maximum 15 books/image, camera/gallery input, mandatory owner review, and controlled per-candidate inventory commits.
- Exact Supabase project and all affected schema/storage state must be re-verified through Supabase MCP before migrations. No Phase 9 migration exists yet.
- Do not fold deferred payment, paid-order, pickup, refund, ledger, or settlement behavior into Phase 9.

When in doubt, [DOC-13](./DOC-13-implementation-tracker.md) owns global status, the [active router](./implementation/ACTIVE.md) owns routing, and the active phase tracker owns its local milestone/next action. This README owns stable product-suite reading guardrails.

---

## 1. Purpose

This folder contains the planning source of truth for the BookConnect multi-tenant bookstore marketplace.

The marketplace is separate from the current peer-to-peer exchange model. The existing app already contains consumer book, library, exchange, venue, and club concepts, but bookstore commerce requires its own domain model because bookstores are sellers, customers place direct orders, BookConnect facilitates delivery and payments, and store owners need a separate operating console.

The core marketplace loop is:

```text
Bookstore onboarding
  -> image-to-LLM/manual inventory digitization
  -> canonical marketplace listings
  -> consumer search and discovery
  -> order request and store confirmation
  -> customer payment
  -> pickup or third-party delivery
  -> store fulfillment
  -> weekly settlement and subscription value
```

---

## 2. Locked Product Decisions

| Area | Decision |
|---|---|
| Marketplace role | BookConnect is a marketplace facilitator, not the inventory owner. |
| Sellers | Bookstores are sellers and must be verified before selling. |
| Consumer surface | Book discovery and ordering lives inside the existing consumer app as a new marketplace section. |
| Store Owner surface | Store Owner flows are a separate product surface with separate access gates and onboarding states. New/unauthenticated users can enter from Login; existing signed-in users can enter from Profile. |
| Cart | MVP supports a single-store cart only. Adding an item from another store replaces the current cart after warning. |
| Availability | Partial availability is allowed. Store can confirm some items and reject others. |
| Payment timing | Store confirms availability before customer payment is requested. |
| Payment launch | Pilot may use live payments only after state-machine, ledger, refund, legal/accounting, and provider review gates pass. |
| Confirmation window | Confirmation is counted during store open hours; target window is 6 hours to 1 business day. |
| Seller of record | Bookstore is seller of record; BookConnect is marketplace facilitator. |
| Support and disputes | BookConnect owns customer support, dispute intake, refund review, and platform escalation. |
| Initial monetization | Founding Store Program: free/discounted subscription trial plus commission on completed orders; long-term model remains subscription plus commission. |
| Long-term monetization | Hybrid model: bookstore subscription for tools plus small commission on book sales. |
| Settlement | Weekly settlement to bookstores is the default planning assumption. |
| Returns | Store-specific return policy is shown before order confirmation. |
| Used-book condition | Base values: `new`, `like_new`, `very_good`, `good`, `acceptable`; damage is a separate disclosure with public evidence when sellable. |
| OCR terminology | The inventory workflow is image-to-LLM extraction plus metadata enrichment, not traditional OCR-only processing. |
| Delivery | Third-party delivery partners are integrated through a provider adapter layer. Pickup remains supported. |
| Deferred features | Community showcase and manager delegation are deferred from MVP. |
| India marketplace compliance | Seller disclosure, grievance handling, tax/payment review, and marketplace policy display are required before payment launch. |
| Finance architecture | Payments, refunds, commission, and weekly settlements must be ledger-first, not status-field-only. |
| Policy configuration | SLA windows, payment expiry, commissions, delivery minimums, quotas, and suspension thresholds must be platform-configurable. |
| Rollout | Use feature flags, store allowlists, locality gating, and pickup-first pilot rollout before broad launch. |
| Pilot city | Bangalore, starting with one or two dense localities rather than a city-wide launch. |
| Minors/school users | Not targeted in pilot; revisit before broader consumer growth or school/community programs. |

---

## 3. Live Database Audit Summary

Supabase MCP audit on 2026-05-22 found the pre-marketplace baseline:

- Live project: `Bookconnect_reactexpo`
- Project ref: `ahntbtktjjmvfosgkmgn`
- Region: `ap-southeast-2`
- Postgres: `17`
- Current schema was consumer/P2P/bookclub-oriented, not bookstore-marketplace-oriented.
- No marketplace/store/seller/inventory/order/payment/ledger/settlement/shipment schema existed yet.

Supabase MCP refresh on 2026-06-24 found:

- Phase 1 marketplace foundation migrations are applied live.
- Store onboarding foundation tables exist with RLS enabled, including `stores`, `store_administrators`, `store_status_history`, `store_verification_requests`, `store_verification_documents`, `seller_payout_accounts`, subscriptions, entitlements, platform roles, events, notifications, audit logs, and `commerce_idempotency_keys`.
- Storage bucket `seller-verification-docs` exists, is private, and is path-scoped by first folder segment store ID.
- The old bucket spelling `store_verification-docs` does not exist.

The detailed Phase 0 audit is recorded in [`implementation/PHASE-0-codebase-db-audit.md`](./implementation/PHASE-0-codebase-db-audit.md).

Existing pieces we may reuse:

- `books` for initial book metadata
- `user_addresses` for customer delivery addresses
- PostGIS location support
- `venues`, `book_clubs`, and `club_venues` for future place/bookclub association

Existing pieces we should not reuse directly:

- `listings` because it models P2P listings, not store inventory
- `transactions` because it models borrower/lender exchange, not seller/customer commerce
- current P2P transaction states and RPCs
- existing broad public storage bucket patterns

New marketplace domain required across all phases (v0.2):

- `stores`
- `store_administrators`
- `store_verification_requests`
- `store_subscriptions`
- `store_entitlements`
- `store_usage_counters`
- `marketplace_policy_config`
- `marketplace_localities`
- `store_inventory`
- `marketplace_book_listings`
- `marketplace_carts`
- `marketplace_cart_items`
- `store_order_requests`
- `store_order_request_items`
- `store_orders`
- `store_order_items`
- `inventory_holds`
- `payments`
- `delivery_shipments`
- `finance_ledger_entries`
- `settlement_batches`
- `seller_payout_accounts`
- `invoice_snapshots`
- `commerce_transition_log`
- `commerce_idempotency_keys`
- `marketplace_events`
- `marketplace_notifications`
- `marketplace_audit_logs`
- `image_extraction_sessions` (planned; not live)
- `image_extraction_inputs` (planned; not live)
- `image_extraction_candidates` (planned; not live)
- `metadata_enrichment_attempts` (planned; not live)

All monetary fields are integer minor units (paise). See the canonical table register in `implementation/ARCHITECTURE-REMEDIATION-PLAN.md` (DD-01) for authoritative names and rationale.

Security issues already present in the live DB, to avoid repeating in new work:

- `public.spatial_ref_sys` has RLS disabled.
- `public.club_public_details` is a security-definer view.
- Many `SECURITY DEFINER` functions are executable by broad roles.
- Public storage buckets allow broad object listing.

These are existing-system issues and should be handled separately from this planning suite, but new marketplace work must not copy those patterns.

---

## 4. Specification Index

| Document | Title | Purpose |
|---|---|---|
| [DOC-0](./DOC-0-product-architecture.md) | Product Architecture | Defines roles, product surfaces, marketplace loop, MVP boundaries, and domain separation. |
| [DOC-1](./DOC-1-identity-security-compliance.md) | Identity, Security, and Compliance | Defines auth gates, tenant boundaries, RLS model, privacy rules, and DPDP-sensitive constraints. |
| [DOC-2](./DOC-2-store-onboarding-verification-subscriptions.md) | Store Onboarding, Verification, and Subscriptions | Defines seller onboarding, verification, subscription plans, entitlements, and quotas. |
| [DOC-3](./DOC-3-canonical-books-metadata-inventory.md) | Canonical Books, Metadata, and Inventory | Defines book identity, metadata provider rules, store inventory, and public listing projection. |
| [DOC-4](./DOC-4-image-to-llm-inventory-workflow.md) | Image-to-LLM Inventory Workflow | Defines image capture, LLM extraction, enrichment, duplicate resolution, and owner review. |
| [DOC-5](./DOC-5-consumer-marketplace-discovery.md) | Consumer Marketplace and Discovery | Defines marketplace search, nearby stores, book availability, alerts, and public storefronts. |
| [DOC-6](./DOC-6-cart-order-request-payment.md) | Cart, Order Request, and Payment | Defines single-store cart, partial availability, store confirmation, payment timing, cancellations, and refunds. |
| [DOC-7](./DOC-7-fulfillment-delivery.md) | Fulfillment and Delivery | Defines pickup, third-party delivery, provider adapter, quote timing, exceptions, and delivery status. |
| [DOC-8](./DOC-8-store-owner-console.md) | Store Owner Console | Defines owner dashboard, inventory tools, storefront marketing, order management, and deferred modules. |
| [DOC-9](./DOC-9-platform-ops-admin.md) | Platform Operations and Admin | Defines internal tools for store approval, disputes, refunds, delivery intervention, moderation, and support. |
| [DOC-10](./DOC-10-notifications-events-realtime.md) | Notifications, Events, and Realtime | Defines event model, push notifications, webhooks, realtime requirements, and audit trails. |
| [DOC-11](./DOC-11-demand-signals-bookclubs-places.md) | Demand Signals, Bookclubs, and Places | Defines unavailable search capture, alerts, bookclub interest, and cafe/library/park association. |
| [DOC-12](./DOC-12-build-strategy-and-implementation-sequence.md) | Build Strategy and Implementation Sequence | Defines phased build order, coding-agent guardrails, risk gates, rollout sequence, and what not to build first. |
| [DOC-13](./DOC-13-implementation-tracker.md) | Implementation Tracker | Tracks live implementation status, blockers, phase progress, deviations, and next handoff. |
| [DOC-14](./DOC-14-commerce-state-machines.md) | Commerce State Machines | Defines actor-guarded state transitions for requests, payments, holds, paid orders, refunds, disputes, and post-payment failures. |
| [DOC-15](./DOC-15-finance-tax-settlement-operating-model.md) | Finance, Tax, and Settlement Operating Model | Defines seller-of-record, payment-provider boundaries, ledger semantics, refund/reversal handling, settlement, reserves, and review gates. |
| [DOC-16](./DOC-16-pilot-and-unit-economics.md) | Pilot and Unit Economics | Defines Bangalore pilot strategy, founding-store monetization, launch gates, support readiness, metrics, and unit economics. |

Implementation phase trackers live in [`implementation/`](./implementation/).

The current Phase 1 plan is [`implementation/PHASE-1-foundation-schema-security-plan.md`](./implementation/PHASE-1-foundation-schema-security-plan.md).

---

## 5. How To Read This Suite

For implementation work, read in this order:

1. This README for the product decisions, domain separation rules, and new-agent handoff.
2. [DOC-13: Implementation Tracker](./DOC-13-implementation-tracker.md) to understand the current implementation status.
3. The relevant phase tracker in [`implementation/`](./implementation/) for the active phase.
4. [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md) to understand the phase order, separation rules, and risk gates.
5. The domain source docs linked by the active phase tracker.
6. Any extra domain docs needed for the specific task.

For product or architecture review, start with this README, then read DOC-0 through DOC-16 as needed.

Do not skip DOC-13. It is the only document intended to answer "what should the next agent do now?"

---

## 6. Dependency Order

```text
DOC-0 Product Architecture
  -> DOC-1 Identity, Security, and Compliance
  -> DOC-2 Store Onboarding, Verification, and Subscriptions
  -> DOC-3 Canonical Books, Metadata, and Inventory
  -> DOC-4 Image-to-LLM Inventory Workflow
  -> DOC-5 Consumer Marketplace and Discovery
  -> DOC-6 Cart, Order Request, and Payment
  -> DOC-7 Fulfillment and Delivery
  -> DOC-8 Store Owner Console
  -> DOC-9 Platform Operations and Admin
  -> DOC-10 Notifications, Events, and Realtime
  -> DOC-11 Demand Signals, Bookclubs, and Places
  -> DOC-12 Build Strategy and Implementation Sequence
  -> DOC-13 Implementation Tracker
  -> DOC-14 Commerce State Machines
  -> DOC-15 Finance, Tax, and Settlement Operating Model
  -> DOC-16 Pilot and Unit Economics
```

Implementation planning must not start until DOC-0 through DOC-7 and DOC-14 through DOC-16 are reviewed, because those documents define the shared data, commerce, finance, and pilot backbone.

---

## 7. MVP Boundary

MVP includes:

- Store Owner onboarding and verification request flow
- store profile, location, hours, pickup/delivery settings
- subscription and entitlement foundation
- image-to-LLM inventory digitization
- manual inventory entry
- inventory management
- canonical book grouping and public listing projection
- consumer search across store inventory
- single-store cart
- store confirmation before payment
- partial availability handling
- pickup and delivery-ready order flow
- store order management
- weekly settlement ledger foundation
- configurable marketplace policy foundation
- minimal platform ops controls for verification, refunds, disputes, delivery exceptions, and settlement review
- append-only event foundation for commerce transitions and operational queues
- customer support and dispute intake path operated by BookConnect
- feature flags and pilot rollout controls

MVP defers:

- community showcase
- manager delegation
- advanced analytics
- data exports
- full bookclub management from the store owner surface
- multi-store cart
- COD
- automatic multi-provider delivery optimization
- customer-visible reliability scores
- minors/school-user-specific flows

---

## 8. India Marketplace Operational Guardrails

The marketplace must be built with India-specific operational review from the start.

Before enabling customer payments, the implementation plan must account for:

- marketplace seller disclosure and customer grievance paths
- seller verification, seller agreement, and prohibited/counterfeit/pirated-book policies
- GST/TCS/invoice/credit-note implications reviewed with accounting/legal counsel
- RBI/payment-aggregator boundaries and use of licensed payment partners
- ledger-first settlement and refund reconciliation
- seller-of-record, invoice, refund, credit-note, reserve, and payout-failure operating rules
- third-party delivery aggregator behavior including NDR, RTO, failed pickup, lost/damaged shipments, and weight/billing disputes
- delivery cost/liability ownership matrix
- data retention and evidence retention for orders, payments, delivery webhooks, condition photos, disputes, and seller documents
- DPDP Rules 2025 notice, consent, breach, grievance/data-rights, and child/minor implications before broader growth

These requirements are guardrails for implementation; they are not a substitute for legal, accounting, or payment-provider advice.

---

## 9. Implementation Tracking Rule

Every coding session must update implementation tracking before finishing.

Before starting implementation, a coding agent must read:

1. this README
2. [DOC-13: Implementation Tracker](./DOC-13-implementation-tracker.md)
3. the relevant `implementation/PHASE-*.md` tracker
4. [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md)
5. the source specification docs referenced by that phase tracker

After implementing any migration, RLS policy, service, screen, hook, event, test, or feature flag, the coding agent must update:

1. the relevant phase tracker in [`implementation/`](./implementation/)
2. [DOC-13](./DOC-13-implementation-tracker.md) if phase status, blockers, risks, latest milestone, next task, or handoff changed
3. the relevant source spec document only if implementation changed planned product or architecture behavior

Do not mark a phase complete unless:

- acceptance criteria are satisfied
- required tests are listed and passing
- RLS/security checks are documented
- known deviations are recorded
- next phase handoff notes are written

Recommended status values:

| Status | Meaning |
|---|---|
| `not_started` | No implementation work started. |
| `in_progress` | Work is actively underway. |
| `blocked` | Work cannot continue without a decision, dependency, or fix. |
| `needs_review` | Work is ready for review but not accepted. |
| `complete` | Acceptance criteria, tests, and handoff are documented. |
| `deferred` | Intentionally postponed. |

Use task markers consistently:

```text
[ ] not started
[/] in progress
[!] blocked
[x] complete
[-] deferred
```

---

## 10. Review Rules

Each document in this suite must include:

- locked decisions
- MVP behavior
- deferred behavior
- data model implications
- security/privacy notes
- open implementation risks
- related documents

No implementation should be started from this suite until a separate implementation plan is written and reviewed. Feature coding beyond Phase 0 should not begin until DOC-14, DOC-15, and DOC-16 have been reviewed against the implementation plan.
