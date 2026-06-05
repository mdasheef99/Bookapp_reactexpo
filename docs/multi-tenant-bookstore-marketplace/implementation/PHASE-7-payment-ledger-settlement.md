# PHASE-7: Payment, Ledger, and Settlement

**Status:** `not_started`
**Last updated:** 2026-05-22
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

No verification run yet.

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

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not enable production payments without platform ops refund/reconciliation readiness.
