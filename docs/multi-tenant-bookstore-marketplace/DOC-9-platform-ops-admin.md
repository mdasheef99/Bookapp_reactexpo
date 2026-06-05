# DOC-9: Platform Operations and Admin

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-1, DOC-2, DOC-6, DOC-7, DOC-8
**Owns:** Internal platform operations, store verification review, subscription administration, disputes, refunds, delivery intervention, settlements, moderation, compliance support, and operational audit trails.

---

## 1. Purpose

This document defines platform-only operations for the bookstore marketplace.

These capabilities are not part of the Store Owner console and are not exposed to consumers. They are used by BookConnect internal operators to keep the marketplace trustworthy, resolve exceptions, and enforce platform policy.

---

## 2. Platform Responsibilities

BookConnect acts as marketplace facilitator, so platform operations must be able to:

- verify seller applications
- approve, reject, suspend, or reactivate stores
- operate customer support and dispute resolution
- configure subscription plans and entitlements
- intervene in order, payment, and delivery exceptions
- approve refunds or partial refunds
- process settlement batches
- moderate listings and store profiles
- support data/privacy requests through platform channels
- audit sensitive actions

The Store Owner console can show a store's own status and plan, but platform-wide management belongs here.

BookConnect owns customer support, dispute intake, refund review, and platform escalation. This means platform operations are launch infrastructure, not a late-stage admin convenience.

---

## 2.1 Admin MVP Primitives

The following primitives must exist before live payments:

- internal platform roles and role gates
- store review queue
- store approve/reject/request-info/suspend actions
- append-only admin action log
- support case queue
- refund/dispute case queue
- payment reconciliation queue
- settlement review queue
- delivery exception queue if delivery is enabled
- moderation action path for listings/stores

The UI can be minimal, but these capabilities must exist in a controlled internal surface or operational tool before real customer money is at risk.

---

## 3. Admin Roles

Recommended internal roles:

| Role | Scope |
|---|---|
| `platform_admin` | Full operational access. |
| `store_reviewer` | Store application and verification review. |
| `support_agent` | Order, customer, and store support without financial override rights. |
| `finance_ops` | Settlements, refunds, invoices, commission adjustments. |
| `moderator` | Listing, profile, and content moderation. |
| `delivery_ops` | Delivery exceptions and provider escalation. |

Permissions must be explicit. Admin role names should not reuse Store Owner or Store Manager roles.

---

## 4. Store Verification Operations

Platform review queue must support:

- view submitted store applications
- inspect verification documents
- request more information
- approve application
- reject application with reason
- suspend active store
- reactivate store
- edit verification notes
- audit reviewer actions

Verification review must consider:

- store identity
- physical location
- seller contact details
- payout account readiness
- business documents available for the store type
- policy acceptance
- risk flags or duplicate applications

Small bookstores may not have every enterprise document. The review process should support local bookstore realities while still giving BookConnect enough evidence to safely allow selling.

---

## 5. Subscription and Entitlement Administration

Platform admins manage subscription products, not store owners.

Admin capabilities:

- define plans
- set listing limits
- set image extraction quotas
- set staff/seat limits for future use
- set commission rates
- grant trial extensions
- pause/restrict stores for billing issues
- override entitlements for support cases
- view billing status
- configure policy-driven grace/restriction behavior
- review tax/accounting fields required for settlement reports

Store Owner console only shows the store's own plan and upgrade path.

---

## 6. Order and Payment Intervention

Platform operations must handle exceptions that stores should not control directly.

Cases:

- store cancels after customer payment
- store cannot fulfill after confirmation
- customer disputes condition
- delivery provider fails
- payment succeeds but order conversion fails
- duplicate payment or gateway mismatch
- payment webhook missing or duplicated
- chargeback opened
- reconciliation mismatch between payment provider and ledger
- refund required
- partial refund required
- suspected fraud or abuse

Financial state changes must be server-side, audited, and restricted to authorized platform roles.

---

## 7. Delivery Operations

Delivery ops must be able to:

- view delivery shipment status
- inspect provider events
- reassign provider where supported
- cancel shipment
- trigger manual customer/store notification
- record provider escalation ID
- mark package returned to store after evidence
- flag lost/damaged case
- manage NDR cases
- manage RTO cases
- record failed pickup reason
- reconcile provider weight/billing disputes

Delivery intervention must not bypass payment/refund controls. If a delivery exception affects money, it must create or link to a refund/dispute case.

---

## 8. Refunds, Returns, and Disputes

Platform dispute tooling should support:

- customer complaint intake
- store response
- evidence upload
- delivery event review
- condition photo review
- refund decision
- partial refund decision
- return instructions
- resolution notes

Refund decisions should reference:

- store return policy snapshot from checkout
- item condition and public notes
- delivery state
- customer evidence
- store evidence
- platform policy

The system must preserve the checkout policy snapshot so disputes are judged against what the customer accepted before payment.

Support operating rules:

- BookConnect is first-line customer support for marketplace orders.
- Stores may respond to order-specific questions through controlled workflows, not raw personal contact leakage.
- Platform operators decide refunds, partial refunds, and dispute outcomes according to policy and evidence.
- Store fault events such as post-payment unavailability must be visible to support and may affect store restrictions.
- Support response SLA must be defined before pilot payments.

---

## 9. Settlements and Ledger

Finance operations require ledger-first settlement.

Settlement batch flow:

```text
Collect eligible paid/completed orders
  -> subtract commission and fees
  -> apply refunds/adjustments
  -> create settlement batch
  -> review batch
  -> mark payout initiated
  -> mark payout completed or failed
```

Settlement tooling must handle:

- weekly batch generation
- store net receivable
- commission
- payment gateway fees
- delivery adjustments
- refund reversals
- manual adjustments
- payout account issues
- tax/GST/TCS reporting fields after accounting review
- seller statement generation
- payment provider reconciliation
- delivery provider billing reconciliation
- export for accounting

Weekly settlement is the planning default, but the ledger must not assume only weekly cadence.

Settlement outputs for each store should include:

- orders included
- gross book sales
- delivery fees/adjustments
- platform commission
- payment gateway fees
- refunds/partial refunds
- manual adjustments
- net payout
- payout status/reference
- tax/TCS fields if applicable after accounting review

---

## 10. Listing and Store Moderation

Moderation must cover:

- prohibited books or restricted content
- pirated or counterfeit books
- misleading condition notes
- abusive store descriptions
- fake store profiles
- suspicious pricing or listing spam
- copyright/trademark complaints around images

Moderation actions:

- hide listing
- suspend listing
- request store correction
- suspend store
- restore listing
- record moderation note

Moderation must not delete records needed for order history, disputes, or audits.

---

## 11. Compliance and Data Requests

Platform operations, not Store Owners, handle formal data/privacy requests.

Admin tooling should route:

- data access requests
- correction requests
- erasure requests
- grievance/support escalation
- breach investigation tasks
- marketplace seller disclosure/support issues
- payment/refund complaints
- delivery complaints

Store Owners should be instructed to forward such requests to BookConnect support. Store Owner console must not include self-service customer erasure tooling.

Legal and compliance sign-off is required before implementing formal data-rights workflows.

---

## 12. Audit Requirements

Every sensitive platform action must produce an audit event.

Audited actions:

- approve/reject/suspend store
- view verification document
- change subscription entitlement
- issue refund
- create settlement batch
- mark payout complete
- override order state
- override delivery state
- moderate listing/store
- access customer PII outside normal support flow
- handle grievance or data-rights request
- resolve NDR/RTO/lost package case
- reconcile payment/settlement mismatch

Audit events must include:

- actor user ID
- actor role
- action type
- entity type
- entity ID
- before/after where appropriate
- reason
- timestamp

---

## 13. Data Model

```text
platform_admin_actions
  id
  actor_user_id
  actor_role
  action_type
  entity_type
  entity_id
  reason
  metadata private
  created_at

store_review_tasks
  id
  store_id
  verification_request_id
  status
  assigned_to nullable
  review_notes private
  decision
  decision_reason
  created_at
  updated_at

marketplace_disputes
  id
  store_order_id
  user_id
  store_id
  dispute_type
  status
  customer_message
  store_response nullable
  platform_decision nullable
  created_at
  updated_at

refund_cases
  id
  store_order_id
  payment_id
  dispute_id nullable
  requested_amount_inr
  approved_amount_inr nullable
  status
  reason
  decided_by nullable
  created_at
  updated_at

settlement_batches
  id
  store_id
  period_start
  period_end
  gross_amount_inr
  commission_amount_inr
  fee_amount_inr
  adjustment_amount_inr
  net_payout_inr
  status
  payout_reference nullable
  statement_url nullable
  created_at
  updated_at

payment_reconciliation_cases
  id
  payment_id
  provider
  case_type
  status
  amount_inr nullable
  notes private
  created_at
  updated_at

delivery_ops_cases
  id
  shipment_id
  store_order_id
  case_type
  provider_reference nullable
  status
  resolution nullable
  notes private
  created_at
  updated_at

moderation_cases
  id
  entity_type
  entity_id
  store_id nullable
  status
  reason
  action_taken
  decided_by nullable
  created_at
  updated_at
```

---

## 14. Security and Privacy

- Platform admin APIs must be separate from Store Owner APIs.
- Admin access must use explicit platform roles.
- Admin actions must never depend on user-controlled store IDs alone.
- Verification documents must be private.
- Refund and settlement controls must be server-only.
- Customer PII access must be logged.
- Broad security-definer database patterns should be avoided for new admin operations.
- Edge Functions or server-side services should enforce role checks before privileged writes.
- Finance, refund, settlement, and delivery exception operations must be role-gated separately from generic support access.

---

## 15. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| OPS-01 | Platform can review, approve, reject, suspend, and reactivate stores. |
| OPS-02 | Platform can manage subscription plans and store entitlements. |
| OPS-03 | Platform can view and intervene in order, payment, and delivery exceptions. |
| OPS-04 | Platform can issue full and partial refunds through controlled server-side flow. |
| OPS-05 | Weekly settlement batches can be generated from ledger entries. |
| OPS-06 | Moderation can hide or suspend listings without deleting order history. |
| OPS-07 | Sensitive admin actions create audit events. |
| OPS-08 | Store Owner console cannot access platform-wide admin routes or APIs. |
| OPS-09 | Platform can reconcile payment gateway, ledger, delivery provider billing, and settlement outputs. |
| OPS-10 | Platform can process NDR, RTO, failed pickup, weight dispute, and lost/damaged delivery cases. |
| OPS-11 | Platform can handle marketplace grievances and data-rights requests outside the Store Owner console. |
| OPS-12 | Platform has minimal support, refund, reconciliation, and settlement queues before live payments. |
| OPS-13 | Support agents can inspect order-specific context without exposing unrelated customer profile data. |

---

## 16. Related Documents

- [DOC-1: Identity, Security, and Compliance](./DOC-1-identity-security-compliance.md)
- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
