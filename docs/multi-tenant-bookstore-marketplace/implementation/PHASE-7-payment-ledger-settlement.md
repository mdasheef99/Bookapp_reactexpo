# PHASE-7: Payment, Ledger, and Settlement

**Status:** `deferred`
**Last updated:** 2026-07-18
**Phase goal:** Enable payment only after store confirmation, with ledger-first finance and reconciliation.

---

## Required Reading

- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)
- [DOC-14: Commerce State Machines](../DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](../DOC-15-finance-tax-settlement-operating-model.md)

---

## Scope

- Licensed payment provider integration.
- Server-side payable amount calculation.
- Payment webhooks.
- Ledger entries.
- Invoice/tax/policy snapshots.
- Refund case foundation.
- Settlement batch foundation.
- Payment reconciliation cases.
- Finance ops queues for refund, reconciliation, settlement review, payout failure, and chargeback handling.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Payment provider selection | `not_started` | Requires review. |
| Server-side payment creation | `not_started` | Client cannot set amount. |
| Webhook verification/idempotency | `not_started` | Required before production. |
| Ledger entries | `not_started` | Gross, commission, fees, refunds, settlement. |
| Invoice/tax/policy snapshots | `not_started` | Supports legal/accounting review. |
| Refund cases | `not_started` | Platform-controlled. |
| Settlement batches | `not_started` | Weekly default, ledger-based. |
| Reconciliation cases | `not_started` | Payment/ledger/provider mismatch. |
| Finance ops queues | `not_started` | Refund, reconciliation, settlement, chargeback, payout failure. |
| Tests | `not_started` | Webhook idempotency, amount authority, ledger consistency. |

---

## Verification Log

No Phase 7 implementation or verification has started. Deferred by product decision on
2026-07-18 while Phase 9 image inventory is prioritized.

---

## Acceptance Criteria

- [ ] Customer pays only after store confirmation.
- [ ] Client cannot set payable amount.
- [ ] Provider secrets are server-only.
- [ ] Duplicate webhooks do not duplicate order or ledger state.
- [ ] Ledger supports refunds, partial refunds, commission reversals, and manual adjustments.
- [ ] Paid orders preserve seller, policy, invoice, tax, and refund-basis snapshots.
- [ ] Legal/accounting/payment review requirements are documented before production.
- [ ] DOC-14 payment/refund transition rules are satisfied.
- [ ] DOC-15 review gates are satisfied before production payments.
- [ ] Finance ops can see refund, reconciliation, settlement, chargeback, and payout-failure cases.
- [ ] `DOC-13` is updated.

---

## Blockers

- Payment provider not selected.
- Legal/accounting review required before production payments.
- DOC-15 finance/tax/settlement review required before production payments.
- Phase 6 must be complete.

---

## Decisions Made During Implementation

- 2026-07-18: Phase 7 is deferred until separately resumed. The deferral does not authorize
  client-calculated amounts, provider work, paid orders, ledger writes, refunds, or settlement
  behavior elsewhere. DOC-14 and DOC-15 remain mandatory when work resumes.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

2026-10-16 research input (no status change, no implementation authority): the
[Cashfree, tax, and compliance research brief](./PHASE-7-research-cashfree-tax-compliance.md)
records web research on Cashfree Payment Gateway/Easy Split, GST, income-tax TDS on
e-commerce, RBI PA Directions 2025, and the E-Commerce Rules, plus questions for the CA and
Cashfree. It is input to the future Phase 7/8 documentation pass, not a source specification.

2026-11-04 research input (no status change, no implementation authority): the
[Phase 7/8 pre-build question bank](./PHASE-7-8-question-bank.md) merges the 132 open
planning questions with 30 questions drawn from published marketplace/payments patterns
(Stripe Connect, Razorpay Route, Modern Treasury, Airbnb, Shopify pickup, PCI SAQ A). No
question is classified or answered yet; that happens in the documentation pass.

2026-11-07 decision input (no status change, no implementation authority): the
[Phase 7/8 decision register](./PHASE-7-8-decision-register.md) (v2 draft at the time; see its header for the current version) consolidates the
owner's business decisions for Phases 7/8 and initial Bengaluru delivery, with proposals
P-1 to P-6 (current status in the register) and unverified Cashfree facts kept separate.

2026-11-07 handoff (no status change, no implementation authority): the
[Phase 7/8 handoff and session start](./PHASE-7-8-HANDOFF.md) is the entry point for the
Phase 7/8 lane. It holds the approvals needed before day 1, timeline, review process,
Cashfree/CA/lawyer questions, security baseline, stage-0 checks, and known documentation
conflicts (including this tracker's pre-BC-08 goal and acceptance text). See the register header for its current version and decision range.

Do not begin Phase 7 without separate authorization. Do not enable production payments without
platform ops refund/reconciliation readiness and the required provider/legal/accounting reviews.
