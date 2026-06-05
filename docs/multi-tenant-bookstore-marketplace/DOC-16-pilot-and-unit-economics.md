# DOC-16: Pilot and Unit Economics

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-0, DOC-2, DOC-5, DOC-6, DOC-7, DOC-9, DOC-12, DOC-14, DOC-15
**Owns:** Bangalore pilot strategy, initial monetization, liquidity thresholds, launch gates, operating metrics, support assumptions, and unit economics tracking.

---

## 1. Purpose

This document defines the pilot operating strategy.

The marketplace should not launch city-wide before it has local inventory density, store reliability, support readiness, and payment/refund controls. Bangalore is the pilot city, but the first launch should be locality-gated and store-allowlisted.

---

## 2. Locked Pilot Decisions

| Area | Decision |
|---|---|
| Pilot city | Bangalore. |
| Initial geography | Start with one or two dense localities, not all of Bangalore. |
| Store rollout | Friendly/verified stores only, through allowlist. |
| Payments | Pilot may use live payments only after DOC-15 gates pass. |
| Fulfillment | Pickup-first, delivery later through provider adapter. |
| Support | BookConnect owns customer support and dispute resolution. |
| Monetization | Founding Store Program: trial/discounted subscription plus commission on completed orders. |
| Customer promise | Store confirmation before payment; post-payment unavailability gets refund/partial/substitute choice. |
| Minors/school users | Not targeted in pilot; revisit before broader consumer growth. |

---

## 3. Founding Store Program

Initial store monetization should reduce adoption friction.

Recommended pilot offer:

- free or discounted subscription for 3 to 6 months
- limited free image-to-LLM credits
- manual/concierge onboarding support for first stores
- commission on completed paid orders
- visible plan/quota status, but no hard paid subscription gate during earliest pilot unless business explicitly approves it
- upgrade path only after stores see demand and operational value

Rationale:

- small bookstores may resist paying before order volume is proven
- inventory upload is labor-intensive
- early liquidity matters more than early subscription revenue
- commission aligns BookConnect revenue with store success during pilot

The long-term model can remain hybrid subscription plus commission.

---

## 4. Pilot Sequence

Recommended sequence:

1. Internal test store with fake/internal inventory.
2. One friendly bookstore in Bangalore.
3. Three to five friendly bookstores in one locality cluster.
4. Manual inventory and public listing pilot.
5. Consumer search pilot with limited audience.
6. Unpaid order request and store confirmation pilot.
7. Pickup fulfillment pilot using unpaid or assisted orders.
8. Live payment pilot after finance/compliance gates pass and pickup fulfillment is implemented and tested.
9. Image-to-LLM inventory pilot.
10. Third-party delivery pilot.
11. Expansion to second Bangalore locality.

Do not treat all of Bangalore as the initial launch surface.

Live payment must not be enabled until there is a reliable completion path for paid orders. For the pilot, that means pickup fulfillment, pickup-code verification, support escalation, and refund handling are tested before accepting live customer payments.

---

## 5. Locality and Liquidity Thresholds

Before consumer launch in a locality, target:

- minimum active verified stores in locality: 3 to 5
- minimum active public listings: product decision, but enough to make common searches non-empty
- at least one store with strong used-book inventory
- store hours and pickup settings complete
- store confirmation workflow tested with each pilot store
- support path tested
- refund path tested if live payments are enabled

Before paid promotion or broader launch, measure:

- search-to-request conversion
- request-to-confirmation conversion
- confirmation time
- payment conversion after confirmation
- pickup completion rate
- refund/dispute rate
- customer support contacts per order
- store support contacts per order

---

## 6. Unit Economics Inputs

Track these from the first pilot order:

| Metric | Why It Matters |
|---|---|
| Average order value | Determines commission viability. |
| Gross merchandise value | Marketplace volume. |
| Platform commission | Revenue per completed order. |
| Subscription/trial value | Future store SaaS revenue. |
| Payment gateway fee | Direct cost. |
| Delivery fee charged | Customer-facing logistics revenue/cost pass-through. |
| Delivery provider cost | Actual delivery cost. |
| Delivery subsidy | Platform-funded growth cost. |
| Refund cost | Customer trust and financial impact. |
| Support minutes per order | Operational scalability. |
| Store onboarding time | Sales/onboarding cost. |
| Image extraction cost per confirmed listing | Core wedge unit cost. |
| Inventory listing publish rate | Supply creation efficiency. |
| Unavailable-after-upload rate | Inventory trust risk. |

Pilot dashboards can be manual at first, but the data must be captured structurally.

---

## 7. Support and Dispute Readiness

Because BookConnect owns support/dispute resolution, pilot must have:

- customer support intake path
- store support intake path
- order lookup for support
- refund/dispute case creation
- delivery exception case creation if delivery is enabled
- escalation path for platform operator
- customer-facing policy copy
- seller-facing policy copy
- support response SLA

Support readiness is a launch gate, not a later optimization.

---

## 8. Pilot Go / No-Go Gates

### 8.1 Go for Phase 0

Allowed immediately:

- codebase audit
- Supabase audit
- implementation planning
- doc refinement

### 8.2 Go for Store Pilot Without Payments

Requires:

- verified store onboarding
- manual inventory
- public listing projection
- consumer discovery
- unpaid order request
- store confirmation
- support path

### 8.3 Go for Live Payments

Requires:

- DOC-14 state machines implemented/tested
- DOC-15 payment/ledger/refund/settlement review gates satisfied
- platform ops refund/reconciliation tools available
- provider webhook idempotency tested
- customer seller/policy/payment disclosures approved

### 8.4 Go for Delivery

Requires:

- pickup flow proven
- provider adapter chosen
- delivery cost ownership matrix approved
- delivery exception ops tooling available
- customer quote shown before payment

---

## 9. Success Thresholds

Exact thresholds should be chosen before pilot launch, but the pilot must define measurable gates for:

- active stores
- active listings
- successful searches
- order request conversion
- store confirmation rate
- median confirmation time
- payment success rate
- pickup completion rate
- refund/dispute ceiling
- support burden ceiling
- store retention after trial
- gross margin per order after payment and support costs

If thresholds are missed, broaden supply/ops before broadening consumer demand.

---

## 10. Not Targeted in Pilot

The pilot does not target:

- minors/school users as a distinct product segment
- school procurement workflows
- children-specific consent flows
- parent/guardian account models
- restricted-content age gates beyond normal marketplace moderation
- multi-store cart
- COD
- customer-visible reliability scores
- broad city-wide launch

These should be revisited before broader consumer growth, especially if the product begins targeting school communities, minors, or children's book programs.

---

## 11. Open Questions Before Pilot Launch

- Which Bangalore locality starts first?
- How many listings are enough for the first consumer-visible pilot?
- What is the pilot commission rate?
- What free image extraction credit is granted to founding stores?
- What customer support SLA is promised?
- What refund promise applies if a store reports unavailable after payment?
- Which payment provider supports the chosen seller/marketplace model?
- Which delivery provider is tested first after pickup is proven?

---

## 12. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| PILOT-01 | Bangalore pilot starts with locality/store allowlist, not broad city rollout. |
| PILOT-02 | Founding Store Program terms are visible to pilot stores. |
| PILOT-03 | Pilot tracks unit economics from first live order. |
| PILOT-04 | Support/dispute path is operational before payments. |
| PILOT-05 | Live payment launch is blocked until DOC-15 gates pass. |
| PILOT-06 | Delivery launch is blocked until pickup flow is proven and delivery liability matrix is approved. |
| PILOT-07 | Minors/school users are marked not targeted in pilot and revisited before broader growth. |

---

## 13. Related Documents

- [DOC-0: Product Architecture](./DOC-0-product-architecture.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-12: Build Strategy and Implementation Sequence](./DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
