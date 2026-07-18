# DOC-12: Build Strategy and Implementation Sequence

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** README, DOC-0 through DOC-16
**Owns:** Implementation strategy, phase order, coding-agent guardrails, explicit domain separation, risk gates, rollout plan, and what not to build first.

---

## 1. Purpose

This document tells a future coding session how to approach implementation.

It is not an implementation plan with file-by-file tasks. It is the strategic bridge between the marketplace specifications and a later implementation plan.

The central strategy is:

```text
Build a thin, safe, end-to-end marketplace spine first.
Then expand inventory automation, delivery, analytics, and growth loops.
```

The first usable milestone is:

```text
verified store
  -> manual inventory
  -> public listing
  -> consumer search
  -> single-store cart
  -> unpaid order request
  -> store confirmation
  -> payment
  -> pickup fulfillment
  -> ledger/settlement record
```

---

## 2. Required Reading for Coding Agents

Before touching code, a coding agent must read:

1. [README](./README.md)
2. [DOC-0: Product Architecture](./DOC-0-product-architecture.md)
3. [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
4. [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
5. [DOC-3: Canonical Books, Metadata, and Inventory](./DOC-3-canonical-books-metadata-inventory.md)
6. [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
7. [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
8. [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
9. [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
10. [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
11. This document.

Then read the domain-specific doc for the phase being implemented:

| Phase Area | Additional Docs |
|---|---|
| Image-to-LLM inventory | DOC-4 |
| Consumer discovery | DOC-5 |
| Store Owner console | DOC-8 |
| Platform operations | DOC-9 |
| Notifications/realtime | DOC-10 |
| Demand/bookclubs/places | DOC-11 |
| Commerce transitions | DOC-14 |
| Finance/tax/settlement | DOC-15 |
| Pilot strategy/unit economics | DOC-16 |

---

## 3. Non-Negotiable Separation Rules

The bookstore marketplace must remain separate from existing P2P exchange features.

Do not reuse:

- existing P2P `listings` as bookstore inventory
- existing P2P `transactions` as bookstore orders
- existing P2P transaction states for marketplace order requests
- existing borrower/lender assumptions
- existing public storage bucket patterns without review
- broad `SECURITY DEFINER` patterns from the current DB

Use separate:

- tables
- migrations
- RLS policies
- services
- route groups/navigation areas
- query keys
- state machines
- platform admin APIs
- Store Owner APIs
- consumer marketplace APIs
- tests

Controlled reuse is allowed only for generic primitives:

- authenticated consumer user identity
- customer delivery addresses where applicable
- base book metadata where safe
- PostGIS/location utilities
- future venue/bookclub association after explicit review

---

## 4. Build Principle

Do not start with the most impressive feature.

Image-to-LLM inventory, third-party delivery, and storefront marketing are important, but they should not be the first implementation slice. They depend on the marketplace spine.

Correct first spine:

```text
store identity
  -> inventory
  -> listing projection
  -> consumer discovery
  -> unpaid request
  -> store confirmation
  -> payment
  -> pickup
  -> ledger
```

Once this works, OCR/LLM and delivery have a stable place to attach.

---

## 5. Implementation Phases

### Phase 0: Codebase and DB Re-Audit

Goal: refresh facts before writing migrations or app code.

Required actions:

- use Augment/codebase retrieval to inspect current app architecture, auth, routing, services, tests, and naming conventions
- use Supabase MCP to inspect current schema, RLS, storage buckets, functions, policies, and advisors
- verify whether any marketplace-related tables were added since this spec
- confirm current app route grouping and consumer tab structure
- identify current Login / first-run auth and Profile section integration points for Store Owner entry
- write a short implementation note summarizing current constraints

Do not proceed until:

- P2P exchange boundaries are understood
- current auth/session patterns are understood
- current Supabase security issues are known
- migration strategy is agreed

### Phase 1: Marketplace Foundation Schema and Security

Goal: create separate marketplace domain foundation.

Build:

- `stores`
- `store_administrators`
- store onboarding state fields
- store status/verification status
- marketplace policy configuration foundation
- audit/event foundation
- minimal platform role gates and admin action log
- support/refund/reconciliation queue primitives
- RLS policies
- storage buckets/policies for private seller docs and public storefront assets

Do not build UI-heavy workflows yet.

Risk gate:

- Store Owner A cannot read Store Owner B data.
- Consumer cannot read private inventory or seller docs.
- Store applicant cannot sell before approval.
- Service role key is not present in client code.
- Event/audit records exist for sensitive foundation actions.
- Platform roles are separate from Store Owner roles.

### Phase 2: Store Onboarding, Verification, and Entitlements

Goal: allow a bookstore to apply, be reviewed, and become sellable.

Build:

- seller application flow
- Store Owner entry from Login / first-run auth
- Store Owner onboarding entry from Profile for signed-in users
- verification document upload
- platform review controls
- seller agreement acceptance
- prohibited/counterfeit/pirated-book policy acceptance
- payout/tax readiness fields
- basic subscription/entitlement status
- store setup checklist
- minimal store review queue and support case primitives

Risk gate:

- no selling before approval
- no selling before required setup
- suspended store cannot publish or accept new requests
- existing paid orders remain resolvable even under restrictions
- platform can review/suspend stores through controlled ops path

### Phase 3: Manual Inventory and Canonical Book Layer

Goal: prove the inventory model without LLM complexity.

Build:

- canonical work/edition model or minimum viable equivalent
- metadata source records
- manual inventory entry
- condition model: `new`, `like_new`, `good`, `fair`, `damaged`
- duplicate detection by ISBN/provider/title-author
- public listing projection
- listing moderation status
- private fields: shelf, acquisition cost, internal notes

Risk gate:

- consumer APIs read public listings, not raw inventory
- private inventory fields never appear in consumer responses
- same book across stores groups correctly
- blocked/suspended listings do not appear in search

### Phase 4: Minimal Store Owner Console

Goal: give stores basic operating tools.

Build:

- owner access gate
- Profile entry to Store Owner Console / onboarding surface
- dashboard
- inventory list
- publish/unpublish
- edit price/quantity/condition/location
- store profile, hours, return policy
- subscription/quota visibility
- basic compliance blockers

Risk gate:

- Store Owner console sees only one store's data
- owner can see own plan/limits but not platform-wide subscription management
- order/customer PII is absent until order workflows exist

### Phase 5: Consumer Marketplace Discovery

Goal: let consumers find bookstore listings.

Build:

- marketplace section in current consumer app
- book search by ISBN/title/author
- store availability cards
- public store pages
- policy disclosures
- pickup/delivery eligibility display
- single-store cart guardrail

Risk gate:

- customer sees confirmation-before-payment message
- customer sees return/refund/delivery policy before checkout
- adding from a different store prompts cart replacement
- unverified/suspended stores are hidden

### Phase 6: Unpaid Order Request and Store Confirmation

Goal: implement the core trust mechanism before payments.

Build:

- single-store cart
- unpaid order request
- store confirmation screen
- partial availability
- unavailable items
- confirmation SLA during open hours
- deterministic, versioned BookConnect delivery tariff for eligibility and exact customer-facing charges, with no provider call
- provisional tariff snapshot at submission and recalculation after partial/material confirmation
- provider-independent `payment_ready` state with no payment-provider object
- inventory holds after confirmation
- critical request/reminder/payment-ready notifications
- transition logs/events for request and hold states

Risk gate:

- no payment is taken at request submission
- store cannot increase price during confirmation
- partial confirmation recalculates subtotal, policy delivery eligibility, and the exact customer delivery charge; a material charge change requires explicit acceptance
- `payment_ready` snapshots immutable quantities, item subtotal, discounts, customer delivery charge, total, tariff version, and resolved policy
- Phase 6 does not call or depend on a delivery provider
- expired requests take no payment and release holds
- confirmation deadline notifications and expiry jobs are server-driven
- transition behavior matches DOC-14
- Phase 6 creates no provider payment object or paid `store_order`; Phase 7 creates the provider object and enters `payment_pending`

### Phase 7: Payment, Ledger, Refund Foundation, and Settlement (Deferred)

**Roadmap status (2026-07-18):** Deferred until separately resumed after payment-provider,
legal, accounting, and product review. Deferral does not relax the DOC-14 or DOC-15 gates.

Goal: enable money safely.

Build:

- server-side payment provider integration
- collection of the exact, unexpired Phase 6 `payment_ready` total
- verified/idempotent payment webhooks
- ledger entries
- invoice/tax/policy snapshots
- refund case foundation
- weekly settlement batch foundation
- payment reconciliation cases
- finance ops queues for refunds, reconciliation, and payout review

Risk gate:

- mobile client cannot set payable amount
- Phase 7 cannot replace the accepted customer delivery charge or total with a higher provider quote
- payment provider secrets are server-only
- duplicate webhook does not duplicate order/ledger state
- full and partial refunds are platform-controlled
- settlement reports reconcile to ledger entries
- legal/accounting review has approved payment/tax assumptions
- DOC-14 and DOC-15 acceptance criteria are satisfied before production payments

### Phase 8: Pickup Fulfillment (Deferred)

**Roadmap status (2026-07-18):** Deferred with Phase 7 because pickup requires a verified
paid order. Phase 8 must not be implemented against mocked or client-asserted payment state.

Goal: complete the simplest paid fulfillment loop before delivery complexity.

Build:

- paid pickup orders
- store packing/ready state
- pickup code generation
- pickup code verification
- pickup completion
- basic dispute evidence path

Risk gate:

- store cannot mark an order ready while customer/platform action is still pending
- pickup code is scoped to paid order/customer/store
- pickup completion creates auditable event

### Phase 9: Image-to-LLM Inventory Workflow

**Approved sequencing override (2026-07-18):** Phase 9 may proceed while Phases 7 and 8
remain deferred. This is a roadmap reorder, not a dependency waiver: Phase 9 must build on
the Phase 6 inventory quantity/hold boundary, preserve DOC-3 private/public separation, and
remain independent of provider payments, paid orders, pickup, ledger, and settlement.

Goal: add the unique inventory digitization advantage after inventory/listing is stable.

Build:

- image capture/upload session
- LLM extraction request
- provider metadata enrichment
- owner review
- duplicate resolution
- quota/cost tracking
- workflow recovery
- private raw payload retention policy

Risk gate:

- owner review required before inventory write/publish
- candidate caps enforced
- quota enforced by store
- manual entry still works when image quota is exhausted

### Phase 10: Third-Party Delivery Aggregator Integration

Goal: add provider-agnostic delivery using adapters.

Likely providers to evaluate:

- Shiprocket
- Shipmozo
- NimbusPost
- other India delivery aggregators selected later

Build:

- delivery provider adapter
- serviceability check
- provider operational serviceability and quote for assignment/fulfilment
- shipment booking after payment and store readiness
- provider webhook ingestion
- normalized shipment state
- NDR/RTO/failed pickup/weight dispute cases
- provider billing reconciliation hooks

Risk gate:

- delivery booking does not happen before payment and store readiness
- provider quote/cost is operational and does not silently change the customer amount accepted at `payment_ready`
- webhooks are verified and idempotent
- NDR/RTO/failed pickup/lost/damaged cases are visible to platform ops

### Phase 11: Notifications, Realtime, and Ops Queues

Goal: expand time-sensitive marketplace actions after the event foundation already exists.

Phase 11 is not where events begin. Append-only events start in Phase 1. Critical notifications must be added in the phases that introduce their flows, especially Phase 6 and Phase 7.

Build:

- marketplace events
- push/in-app notifications
- selected realtime subscriptions with RLS
- action tasks for ops queues
- notification preferences
- deep link auth/tenant checks

Risk gate:

- realtime is not the source of truth
- missed realtime events recover through refetch
- notifications do not leak PII/payment details
- ops queues exist for delivery/payment/refund/grievance exceptions

### Phase 12: Demand Signals, Alerts, Bookclubs, and Places

Goal: add growth loop after commerce works.

Build:

- unavailable search capture
- customer alerts
- store demand dashboard
- store-specific sourcing request
- request rate limits/dedupe/moderation
- store bookclub hosting interest
- lightweight book-friendly places surface

Risk gate:

- passive demand is aggregated before store display
- direct customer identity is shown only for explicit direct requests
- abusive request text is moderated/rate-limited
- full bookclub management remains separate

---

## 6. What Not To Build First

Do not build first:

- full image-to-LLM workflow before manual inventory works
- third-party delivery before pickup works
- payment before unpaid request and confirmation work
- payment before DOC-14 state machines and DOC-15 finance gates are accepted
- advanced storefront marketing before listings/search/order request work
- community showcase
- manager delegation
- multi-store cart
- customer-visible reliability score
- enterprise multi-branch tools
- advanced analytics/export center
- fully automated delivery provider optimization
- automated tax filing
- broad school/minor-focused workflows during pilot

These features are valuable later. Building them first increases risk without proving the marketplace loop.

---

## 7. Policy Engine Requirements

The following must be platform-configurable, not hardcoded in mobile clients:

- store confirmation SLA
- payment window expiry
- **acceptance_window** — the partial-acceptance decision window (separate from the payment window); starts when a request enters `awaiting_customer_decision` and expires at `acceptance_expires_at`. Default range and minimum/maximum values must be specified in `marketplace_policy_config`. The confirmation SLA clock is distinct from this window.
- delivery minimum value
- versioned customer delivery tariff: eligible fulfilment method, store/city/locality, supported zone or distance band, minimum subtotal, free-delivery threshold, fixed charge, and material-change rule
- delivery fee subsidy/free-delivery rules
- commission rate
- subscription limits
- image extraction quota
- active listing limit
- return windows
- cancellation windows
- suspension thresholds
- store reliability thresholds
- pilot locality/store allowlist (referenced via `marketplace_localities.is_pilot_enabled`)
- provider enablement flags

Policy values should be server-read and cached safely by clients only for display.

---

## 8. Feature Flags and Rollout Controls

Required flags:

- marketplace enabled
- store onboarding enabled
- public listings enabled
- consumer marketplace tab enabled
- cart/order request enabled
- payments enabled
- pickup enabled
- delivery enabled
- image extraction enabled
- demand alerts enabled
- bookclub/place association enabled
- provider-specific delivery flags
- city/locality rollout flags
- store allowlist

Flags are not a substitute for authorization. They are rollout controls.

---

## 9. Pilot Launch Strategy

Recommended launch sequence:

1. internal test store
2. one friendly local bookstore
3. 3 to 5 friendly local bookstores
4. one Bangalore locality pickup-first pilot
5. manual inventory pilot
6. image-to-LLM inventory pilot
7. payment pilot with limited stores
8. pickup fulfillment pilot
9. delivery aggregator pilot
10. broader locality rollout

Bangalore is the pilot city, but initial rollout must be locality-gated and store-allowlisted. Do not launch all of Bangalore until supply density, support readiness, confirmation speed, and unit economics are acceptable.

Pilot metrics:

- inventory items uploaded
- listing publish rate
- search-to-request conversion
- request confirmation time
- partial/unavailable rate
- payment success rate
- pickup completion rate
- refund/dispute rate
- seller support cases
- OCR cost per confirmed item
- support minutes per order
- gross margin per order after payment, delivery, refund, and support costs

---

## 10. Operational Metrics From Day One

Collect internally:

- store confirmation speed
- missed confirmation rate
- unavailable-after-upload rate
- seller cancellation after payment
- customer payment expiry rate
- payment failure/reconciliation rate
- refund rate
- dispute rate
- NDR/RTO rate
- failed pickup rate
- delivery lost/damaged rate
- weight/billing dispute rate
- settlement payout failure rate
- OCR cost per confirmed book
- demand-alert match rate

Customer-visible reliability scores are deferred. Internal metrics are not deferred.

---

## 11. India Marketplace Review Gates

Before production payments:

- legal review of marketplace disclosures, seller agreement, grievance path, and customer policies
- accounting review of GST/TCS/invoice/credit-note/settlement assumptions
- payment-provider review of aggregation, settlement, refund, and chargeback flows
- delivery-provider review of NDR/RTO/failed pickup/claims behavior
- DPDP/privacy review of data sharing and retention
- platform ops readiness review for disputes, refunds, moderation, and delivery exceptions
- DOC-14 commerce state-machine review
- DOC-15 finance/tax/settlement operating review
- DOC-16 Bangalore pilot and unit economics review

Engineering must preserve enough structured data to satisfy these reviews, even if final policy values change.

---

## 12. Coding Agent Instructions

For any future implementation session:

1. Read this suite before coding.
2. Use Augment/codebase retrieval before choosing files or architecture.
3. Use Supabase MCP before schema, RLS, storage, or migration changes.
4. Create a dedicated implementation plan before writing code.
5. Keep bookstore marketplace code separate from P2P exchange code.
6. Add tests for RLS, state transitions, and public/private data boundaries.
7. Prefer server-side transition functions or Edge Functions for privileged commerce actions.
8. **Every service-role Edge Function or private-schema RPC that performs a privileged commerce or store action must have a passing cross-tenant denial test (acceptance criterion SEC-16).** Each function requires tests proving: (a) `auth.uid()` is resolved server-side; (b) store relationship is independently verified against `store_administrators`; (c) a Store A actor targeting a Store B entity is denied; (d) platform-role actions require a `platform_user_roles` row.
9. Never expose service role keys, payment secrets, delivery provider secrets, or raw webhooks to mobile clients.
10. Build manual inventory and the Phase 6 inventory/hold boundary before image-to-LLM.
    Pickup remains required before third-party delivery, but the approved 2026-07-18 roadmap
    override allows Phase 9 while Phases 7 and 8 are deferred.
11. Stop and ask for review before enabling payment or delivery provider integration.

---

## 13. External Review References

Use current official sources during legal/accounting/payment review. At planning time, the relevant public references include:

- [Consumer Protection rules and e-commerce rules index](https://consumeraffairs.gov.in/pages/consumer-protection-acts)
- [Consumer Protection (E-Commerce) Rules, 2020 PDF](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf)
- [RBI Payment Aggregator and Payment Gateway Guidelines](https://www.rbi.org.in/scripts/RTGS_Notification.aspx?Id=11822)
- [MeitY Digital Personal Data Protection Act, 2023 PDF](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [MeitY Digital Personal Data Protection Rules, 2025 PDF](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [MeitY DPDP commencement notification, 2025 PDF](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
- [CBIC GST e-commerce FAQ](https://cbic-gst.gov.in/hindi/sectoral-faq.html)
- [DPIIT FDI policy document](https://www.dpiit.gov.in/static/uploads/2025/07/3ab2ec2a3bdb91c69653b7c34618c14a.pdf)
- [Shiprocket API documentation](https://apidocs.shiprocket.in/)

Provider choices such as Shiprocket, Shipmozo, NimbusPost, or another aggregator must be evaluated during implementation planning against DOC-7 requirements.

---

## 14. Final Build Strategy Summary

Build in this order:

```text
foundation/security
  -> onboarding/verification
  -> manual inventory/canonical listings
  -> minimal owner console
  -> consumer discovery
  -> unpaid request/store confirmation
  -> payment/ledger/settlement
  -> pickup fulfillment
  -> image-to-LLM inventory
  -> third-party delivery
  -> notifications/realtime
  -> demand/bookclub/place growth layer
```

The marketplace is ready for implementation planning only when the team accepts this sequence and the risk gates above. Feature coding beyond Phase 0 should not start until the commerce state-machine, finance/settlement, platform ops, and pilot-economics documents have been reviewed.
