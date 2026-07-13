# DOC-15: Finance, Tax, and Settlement Operating Model

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-06-19
**Status:** Planning draft; requires legal/accounting/payment-provider review before production payments
**Depends On:** DOC-0, DOC-1, DOC-2, DOC-6, DOC-9, DOC-14
**Owns:** Seller-of-record decision, payment-provider boundaries, ledger semantics, refunds, settlement, reserves, payout failures, tax/GST/TCS review, and finance operations.

---

## 1. Purpose

This document defines the operating model for money movement and finance records.

BookConnect will support live payments in the pilot, so the finance model must be designed before payment implementation. The system must not treat payment, refund, commission, and settlement as loose status fields. It needs a ledger-first model that can survive refunds, partial refunds, delivery adjustments, payout failures, disputes, chargebacks, and accounting review.

This document is not legal, tax, or accounting advice. It defines engineering and operational requirements so qualified reviewers can approve the payment launch.

---

## 2. Locked Decisions

| Area | Decision |
|---|---|
| Marketplace role | BookConnect is marketplace facilitator, not inventory owner. |
| Seller of record | The bookstore is the seller of record for books sold through the marketplace. |
| BookConnect role | BookConnect provides platform, payment orchestration, support, delivery orchestration, dispute handling, and settlement. |
| Payment launch | Pilot supports live payments after provider/legal/accounting review. |
| Payment provider | Use licensed PA/PG/provider flows; do not build a pooled-funds payment aggregator model casually. |
| Customer funds | Payment collection, refund, and transfer flows must conform to payment-provider and RBI requirements. |
| Settlement cadence | Weekly settlement is the default planning assumption. |
| Initial monetization | Founding Store Program uses trial/discounted subscription plus commission on completed orders. |
| Ledger model | Ledger-first, append-only normal path, reversal entries instead of destructive edits. |
| Tax treatment | GST/TCS/invoice/credit-note treatment requires accounting/legal review before production. |
| Settlement holdbacks | Platform may hold reserves for active disputes, chargebacks, delivery claims, or seller risk. |

---

## 3. Seller-of-Record Meaning

Seller-of-record answers: who is legally selling the book to the customer?

BookConnect planning position:

- bookstore is seller of record
- BookConnect is marketplace facilitator
- customer-facing checkout must show seller/store identity
- order/invoice/receipt fields must preserve seller snapshot
- BookConnect support handles marketplace support and dispute intake
- store remains responsible for item accuracy, availability confirmation, packing, and seller policy

This matters for marketplace-vs-inventory posture, tax review, FDI review if applicable, and customer disclosures.

If legal/accounting/payment-provider review requires a different structure, this doc and checkout copy must be updated before implementation.

---

## 4. Payment Provider Boundary

RBI guidance distinguishes entities that only provide technical routing from entities that handle/pool funds. The implementation must use licensed payment partners and must not store card credentials or payment secrets in client apps.

Payment rules:

- server calculates payable amount from confirmed request state
- provider order/payment intent is created server-side
- mobile client receives only safe provider checkout references
- provider webhooks are verified server-side
- payment success is not trusted from client callbacks alone
- refunds are initiated server-side by authorized platform roles or controlled system processes
- chargebacks/disputes create finance ops cases
- provider raw payloads remain private

Provider selection must be reviewed against:

- marketplace seller model support
- split settlement or marketplace settlement capabilities
- refund and partial refund support
- settlement reports
- webhook reliability
- chargeback/dispute workflows
- reconciliation exports
- data retention and audit requirements

---

## 5. Ledger Principles

The ledger should be accounting-grade even if not a full accounting system at MVP.

Rules:

- ledger entries are append-only in normal application code
- corrections use reversal/adjustment entries
- each entry references source entity and idempotency key
- all monetary amounts are stored as non-negative integer paise (magnitude only); direction/sign is expressed by a separate `direction` column (`debit`/`credit`), never by the magnitude itself; no floating-point currency is permitted
- the signed value of an entry is `CASE direction WHEN 'credit' THEN amount_minor ELSE -amount_minor END`
- the balancing invariant is net-zero per `transaction_group_id`, not per order `source_id`; every balanced group must sum to zero and must include explicit platform clearing/expense accounts when a loss is borne by the platform (e.g., non-refundable gateway fees)
- every paid order has balanced financial interpretation
- every refund has a corresponding reversal/adjustment
- settlement batches are generated from ledger entries, not from order status alone
- provider reconciliation compares provider report, payment table, and ledger entries
- rounding, if any, happens only at tax/commission computation and is recorded as explicit adjustment entries; reconciliation tolerance is zero paise for ledger sums

Suggested ledger entry types:

- `customer_payment_gross`
- `book_subtotal`
- `delivery_fee_collected`
- `platform_commission`
- `payment_gateway_fee`
- `gateway_fee_non_refundable_loss` (platform-borne loss on refund; paired with a platform clearing/expense account)
- `tax_collected_or_payable`
- `seller_receivable`
- `refund_principal`
- `commission_reversal`
- `delivery_fee_reversal`
- `manual_adjustment_credit`
- `manual_adjustment_debit`
- `settlement_payout`
- `settlement_holdback`
- `chargeback_hold`
- `provider_billing_adjustment`

---

## 6. Settlement Eligibility

An order should become settlement-eligible only after:

- payment is verified
- fulfillment reaches eligible completion state
- refund window/holdback policy allows inclusion
- no active dispute or chargeback hold blocks payout
- delivery provider exception does not require reserve
- seller account/payout status is ready

Settlement eligibility must also respect the order's return-window snapshot. If the settlement cadence (e.g., weekly) would pay out before the return window closes (`returns_within_3_days` or `returns_within_7_days` per the policy snapshot), the refundable amount must be included as a `settlement_holdback` ledger entry until the window closes. This prevents negative-balance churn from orders that settle before they can still be returned.

Weekly settlement is default, but eligibility should be policy-driven.

Settlement batch flow:

```text
select eligible ledger entries
  -> compute store gross, commission, fees, refunds, adjustments
  -> apply holds/reserves
  -> generate store statement
  -> finance review
  -> initiate payout through approved process/provider
  -> record payout success/failure
  -> reconcile payout report
```

---

## 7. Refunds, Reversals, and Negative Balances

Refunds must not be implemented as ad hoc payment status changes.

Refund model:

- refund case is opened
- platform policy/evidence is reviewed
- refund is approved or rejected
- provider refund is initiated
- provider webhook confirms/refutes refund
- ledger reversal/adjustment is written
- settlement eligibility is recalculated

If a store has already been settled and a later refund occurs:

- create negative balance against future settlement, or
- collect from store by manual process, or
- use platform reserve/holdback where policy permits

Negative balance handling must be explicit and visible to finance ops.

---

## 8. Reserves and Holdbacks

BookConnect should support reserve/holdback rules even if the pilot starts with minimal values.

Possible reserve triggers:

- new store under enhanced review
- repeated post-payment unavailable reports
- high refund/dispute rate
- active delivery lost/damaged claim
- active chargeback
- payout account pending verification
- policy/compliance hold

Reserve rules must be platform-configurable and audited.

---

## 9. Delivery Cost and Liability Ownership

Finance and delivery must share a cost ownership matrix.

Default planning assumptions:

| Case | Default Owner | Notes |
|---|---|---|
| Customer pays normal delivery fee | Customer | Fee shown before payment. |
| Delivery quote changes before payment | Customer chooses updated quote or pickup/cancel | Re-quote before payment. |
| Provider cost increases after payment without store/customer fault | Platform review | Platform may absorb, reassign, or cancel/refund. |
| Store not ready at pickup | Store fault unless platform/provider caused issue | May affect reliability and settlement adjustment. |
| Failed pickup due to provider issue | Provider/platform review | Provider claim or reattempt. |
| Customer unavailable delivery/NDR | Customer/policy | Reattempt/RTO cost by policy. |
| RTO due to customer non-response | Customer/policy | Refund may exclude delivery where policy allows. |
| Lost/damaged in transit | Provider/platform claim | Customer trust response comes first; provider claim follows. |
| Weight/billing discrepancy | Store/platform/provider review | Requires declared vs billed evidence. |

Exact commercial allocation must be approved before third-party delivery launch.

---

## 10. Tax, GST, TCS, and Invoice Review

This spec does not decide tax treatment.

Required review topics:

- whether books sold by specific stores are taxable/exempt/zero-rated in applicable cases
- whether used-book sale treatment differs by seller/store type
- GST registration needs for stores
- e-commerce operator TCS applicability if BookConnect collects consideration
- platform commission invoice treatment
- delivery fee tax treatment
- credit note/refund treatment
- customer invoice/receipt format
- seller statement and accounting exports
- PAN/GSTIN/payout data required during seller onboarding

Engineering must preserve structured fields so accounting/legal decisions can be applied without data migration pain. The following structural fields are reserved from the first settlement migration even though their values remain unset until legal/accounting review: `settlement_batches.tcs_deduction_minor`, `settlement_batches.gst_on_commission_minor`, `settlement_batches.tax_adjustments_minor`, and `settlement_batches.tax_treatment_version`. These fields are tied to `finance_ledger_entries` entries of type `tax_collected_or_payable` and `gateway_fee_non_refundable_loss`.

---

## 11. Data Model Additions

```text
finance_ledger_entries
  id
  store_id
  user_id nullable
  store_order_id nullable
  payment_id nullable
  refund_id nullable
  settlement_batch_id nullable
  transaction_group_id UUID NOT NULL
  entry_type
  amount_minor
  currency
  direction
  source_type
  source_id
  idempotency_key
  metadata private
  created_at

settlement_batches
  id
  store_id
  period_start
  period_end
  status
  gross_sales_minor
  commission_minor
  fees_minor
  refund_adjustments_minor
  holdback_minor
  net_payout_minor
  tcs_deduction_minor nullable
  gst_on_commission_minor nullable
  tax_adjustments_minor nullable
  tax_treatment_version nullable
  payout_reference nullable
  created_at
  reviewed_at nullable
  paid_at nullable

seller_statements
  id
  settlement_batch_id
  store_id
  statement_snapshot
  statement_url nullable
  created_at

seller_payout_accounts
  id
  store_id
  provider
  masked_account
  verification_status
  created_at
  updated_at

finance_reconciliation_cases
  id
  provider
  case_type
  status
  payment_id nullable
  settlement_batch_id nullable
  transaction_group_id nullable
  expected_amount_minor nullable
  observed_amount_minor nullable
  notes private
  created_at
  resolved_at nullable
```

---

## 12. Review Gates Before Production Payments

Do not enable production payments until:

- payment provider and flow are selected
- provider confirms the marketplace/seller model is supported
- legal/accounting review approves seller-of-record, invoice, refund, GST/TCS, and settlement assumptions
- ledger entries and reconciliation reports are tested
- refund and partial refund flows are tested
- payout failure and negative balance handling are documented
- platform ops can view and resolve payment/refund/reconciliation cases
- customer-facing seller/policy/support disclosures are approved

---

## 13. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| FIN-01 | Bookstore is represented as seller of record in order/payment snapshots unless legal review changes the model. |
| FIN-02 | Payment provider order creation is server-side and amount-authoritative. |
| FIN-03 | Payment webhooks are verified and idempotent. |
| FIN-04 | Every successful payment creates ledger entries. |
| FIN-05 | Refunds create reversal/adjustment ledger entries. |
| FIN-06 | Settlement batches are generated from ledger entries. |
| FIN-07 | Settlement supports holdbacks, payout failure, and negative balance handling. |
| FIN-08 | Finance ops can reconcile provider reports against payments and ledger. |
| FIN-09 | Tax/GST/TCS/invoice assumptions are reviewed before production payments. |
| FIN-10 | Customer/support/finance screens do not expose raw provider payloads. |

---

## 14. External References

Use current official sources during review:

- [RBI Payment Aggregator and Payment Gateway Guidelines](https://www.rbi.org.in/scripts/RTGS_Notification.aspx?Id=11822)
- [CBIC GST e-commerce FAQ](https://cbic-gst.gov.in/hindi/sectoral-faq.html)
- [Consumer Protection rules index](https://consumeraffairs.gov.in/pages/consumer-protection-acts)
- [DPIIT FDI policy document](https://www.dpiit.gov.in/static/uploads/2025/07/3ab2ec2a3bdb91c69653b7c34618c14a.pdf)

---

## 15. Related Documents

- [DOC-2: Store Onboarding, Verification, and Subscriptions](./DOC-2-store-onboarding-verification-subscriptions.md)
- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-16: Pilot and Unit Economics](./DOC-16-pilot-and-unit-economics.md)
