# PHASE-8: Pickup Fulfillment

**Status:** `deferred`
**Last updated:** 2026-07-18
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

No Phase 8 implementation or verification has started. Deferred by product decision on
2026-07-18 together with Phase 7.

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

- 2026-07-18: Phase 8 is deferred because its paid-order prerequisite is owned by deferred
  Phase 7. No pickup-ready state, pickup code, or completion event may be attached to an unpaid
  Phase 6 request or implemented inside Phase 9.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

Do not begin Phase 8 until Phase 7 is explicitly resumed and verified paid-order creation exists.
Pickup fulfillment remains the proof point before delivery aggregator integration.
