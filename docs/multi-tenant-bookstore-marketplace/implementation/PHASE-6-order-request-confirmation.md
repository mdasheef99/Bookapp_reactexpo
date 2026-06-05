# PHASE-6: Order Request and Confirmation

**Status:** `not_started`
**Last updated:** 2026-05-22
**Phase goal:** Build the unpaid order request and store confirmation flow before payment.

---

## Required Reading

- [DOC-6: Cart, Order Request, and Payment](../DOC-6-cart-order-request-payment.md)
- [DOC-8: Store Owner Console](../DOC-8-store-owner-console.md)
- [DOC-10: Notifications, Events, and Realtime](../DOC-10-notifications-events-realtime.md)
- [DOC-14: Commerce State Machines](../DOC-14-commerce-state-machines.md)

---

## Scope

- Single-store cart.
- Cart replacement warning.
- Unpaid order request.
- Store confirmation.
- Partial availability.
- Open-hours confirmation SLA.
- Payment window state without live payment provider.
- Inventory holds after confirmation.
- Transition logs/events for request, item, and inventory hold states.
- Critical confirmation deadline and payment-window notifications.

---

## Implementation Units

| Unit | Status | Notes |
|---|---|---|
| Single-store cart model | `not_started` | One store only. |
| Cart replacement UX | `not_started` | Customer confirmation required. |
| Order request model | `not_started` | Unpaid request. |
| Store confirmation UI/API | `not_started` | Full, partial, unavailable. |
| Open-hours SLA engine | `not_started` | Policy-configurable. |
| Inventory holds | `not_started` | After store confirmation. |
| Payment window state | `not_started` | No live payment provider in this phase. |
| Request events/notifications | `not_started` | Required for confirmation deadline and payment-window behavior. |
| Commerce transition tests | `not_started` | Must match DOC-14 allowed actors/guards. |
| Tests | `not_started` | State transitions and no-payment-before-confirmation. |

---

## Verification Log

No verification run yet.

---

## Acceptance Criteria

- [ ] Checkout creates unpaid order request.
- [ ] Customer payment is not requested before store confirmation.
- [ ] Store can confirm full, partial, or unavailable.
- [ ] Store cannot increase item price during confirmation.
- [ ] Partial confirmation recalculates subtotal/delivery eligibility.
- [ ] Expired requests take no payment and release holds.
- [ ] Request and hold transitions emit events and preserve transition logs.
- [ ] Confirmation reminder and expiry behavior is server-driven.
- [ ] DOC-14 transition rules are satisfied for order request and hold states.
- [ ] `DOC-13` is updated.

---

## Blockers

- Phase 5 consumer discovery and Phase 4 owner console basics should exist.

---

## Decisions Made During Implementation

- None yet.

---

## Spec Deviations

- None yet.

---

## Handoff Notes

This is the most important trust phase. Do not skip to payment until this is reviewed.
