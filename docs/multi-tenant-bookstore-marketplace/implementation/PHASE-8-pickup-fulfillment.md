# PHASE-8: Pickup Fulfillment

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Complete paid order fulfillment through bookstore pickup before third-party delivery.

---

## Required Reading

- [DOC-7: Fulfillment and Delivery](../DOC-7-fulfillment-delivery.md)
- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)

---

## Scope

- Paid pickup order states.
- Store packing/readiness.
- Pickup instructions.
- Pickup code generation.
- Pickup code verification.
- Pickup completion audit event.
- Basic dispute evidence path.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Pickup fulfillment states | `not_started` | Paid order only. |
| Store packing/ready UI | `not_started` | Store cannot mark an order ready while customer/platform action is still pending. |
| Pickup code generation | `not_started` | Scoped to order/customer/store. |
| Pickup code verification | `not_started` | Store-side handoff. |
| Customer pickup instructions | `not_started` | Store hours and pickup policy. |
| Pickup events/notifications | `not_started` | Ready and completed. |
| Tests | `not_started` | Code scope, state transitions, audit event. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Store can mark paid pickup order packed and ready.
- [ ] Customer receives pickup instructions and code.
- [ ] Store verifies pickup code at handoff.
- [ ] Pickup completion creates auditable event.
- [ ] Store cannot complete pickup for unpaid or unrelated order.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 7 paid order creation must exist.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Pickup fulfillment is the proof point before delivery aggregator integration.
