# PHASE-10: Third-Party Delivery

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Integrate third-party delivery through a provider-agnostic adapter.

---

## Required Reading

- [DOC-7: Fulfillment and Delivery](../DOC-7-fulfillment-delivery.md)
- [DOC-9: Platform Operations and Admin](../DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](../DOC-15-finance-tax-settlement-operating-model.md)
- [DOC-12: Build Strategy and Implementation Sequence](../DOC-12-build-strategy-and-implementation-sequence.md)

---

## Scope

- Provider adapter for Shiprocket/Shipmozo/NimbusPost-style aggregators.
- Serviceability check.
- Delivery quote.
- Booking after payment and store readiness.
- Webhooks.
- Normalized shipment states.
- NDR/RTO/failed pickup/weight dispute cases.
- Provider billing reconciliation hooks.
- Delivery liability/cost ownership matrix before launch.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Provider selection/evaluation | `not_started` | Record choice and tradeoffs. |
| Delivery adapter interface | `not_started` | Provider-agnostic. |
| Serviceability and quote | `not_started` | Quote before payment. |
| Shipment booking | `not_started` | After payment and store readiness. |
| Webhook verification/idempotency | `not_started` | Server-side only. |
| Normalized shipment states | `not_started` | Includes NDR/RTO/failed pickup. |
| Delivery exception cases | `not_started` | Platform ops visible. |
| Provider billing reconciliation | `not_started` | Weight/billing disputes. |
| Cost/liability matrix | `not_started` | Who pays for failed pickup, NDR, RTO, lost/damaged, quote changes, weight disputes. |
| Tests | `not_started` | State mapping, webhook idempotency, privacy. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Delivery booking happens only after payment and store readiness.
- [ ] Customer sees final delivery quote before payment.
- [ ] Provider secrets are server-only.
- [ ] Webhooks are verified and idempotent.
- [ ] NDR, RTO, failed pickup, lost/damaged, and weight dispute cases are first-class.
- [ ] Platform ops can review delivery exceptions.
- [ ] Delivery exception cases record customer handling, likely fault, and financial owner/reconciliation path.
- [ ] `DOC-13` is updated.

---

## Blockers

- Delivery provider not selected.
- Phase 8 pickup fulfillment should be proven first.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not hardcode provider-specific statuses into consumer or Store Owner UI.
