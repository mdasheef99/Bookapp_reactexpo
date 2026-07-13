# DOC-14: Commerce State Machines

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1, DOC-3, DOC-6, DOC-7, DOC-9, DOC-10
**Owns:** Order request, item confirmation, inventory hold, payment, paid order, cancellation, refund, dispute, and post-payment failure state machines.

---

## 1. Purpose

This document turns the marketplace commerce flow from guardrails into explicit state-machine requirements.

It exists because marketplace bugs usually appear at state boundaries:

- store confirms but customer has not paid
- customer pays but order conversion fails
- store later discovers an unavailable item
- delivery fails after payment
- refund is approved but provider refund fails
- duplicate webhooks arrive
- platform operator overrides a case

Implementation must not rely on loose status updates from client screens. Commerce transitions must be server-validated, idempotent, audited, and event-emitting.

---

## 2. Locked Decisions

| Area | Decision |
|---|---|
| Payment timing | Customer payment is requested only after store confirmation. |
| Partial availability | Store can confirm some requested items and reject others. |
| Store confirmation SLA | Counted during store open hours, target 6 open-hours, max 1 business day by default policy. |
| Inventory hold | Confirmed items receive a short-lived hold during the customer payment window. |
| Price changes | Store cannot increase price during confirmation. If price is wrong, mark unavailable or escalate through platform policy. |
| State authority | Server transition service is authoritative. Mobile clients request transitions; they do not write final commerce state directly. |
| Idempotency | Payment, refund, delivery, and operator transition handlers must use idempotency keys. |
| Events | Every state transition emits an append-only marketplace event. |
| Audit | Operator and store actions on commerce state are audited. |
| Post-payment unavailable | Customer receives explicit options and a platform-controlled refund/partial fulfillment path. |

---

## 3. Actors

| Actor | Allowed Scope |
|---|---|
| Customer | Create cart/request, cancel before payment, accept partial confirmation, pay, request cancellation/refund/dispute. |
| Store Owner | Confirm availability, mark unavailable before payment, prepare/pack order, report post-payment issue. |
| Platform Operator | Override stuck states, approve refunds, resolve disputes, handle post-payment unavailability, reconcile providers. |
| Payment Provider | Sends payment/refund/chargeback webhooks. |
| Delivery Provider | Sends pickup/delivery/exception webhooks. |
| System Job | Expires requests/holds/payment windows, creates reminders, retries reconciliation. |

---

## 4. Transition Rules

All transition handlers must evaluate:

- current state
- actor role and tenant scope
- target state
- allowed transition matrix
- required guards
- side effects
- idempotency key
- event emission
- audit log requirement

Conceptual transition service:

```text
transition(entity_type, entity_id, target_state, actor, reason, idempotency_key, metadata)
  -> load current state server-side
  -> validate actor and tenant
  -> validate transition matrix
  -> validate guards
  -> apply state change and side effects transactionally where possible
  -> emit marketplace_event
  -> write audit log if actor/store/platform action
  -> return canonical state
```

---

## 5. Order Request State Machine

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `draft_cart` | Customer | `request_submitted` | Single-store cart, valid listings, store active. | Snapshot cart, policies, prices, requested quantities. |
| `request_submitted` | Store Owner | `store_reviewing` | Store owner owns store. | Emit review-start event. |
| `request_submitted` | Customer | `customer_cancelled` | No store confirmation yet. | Release no holds; notify store if needed. |
| `request_submitted` | System Job | `expired` | Confirmation SLA elapsed during open hours. | Notify customer, update internal reliability metrics. |
| `store_reviewing` | Store Owner | `confirmed` | Every item confirmed fully. | Create soft inventory holds for confirmed quantities; start acceptance window if policy requires; otherwise start payment window and promote to firm holds. |
| `store_reviewing` | Store Owner | `partially_confirmed` | At least one item confirmed, at least one item rejected/partial. | Create soft inventory holds for confirmed quantities; start `acceptance_expires_at`; notify customer. |
| `store_reviewing` | Store Owner | `unavailable` | No item confirmed. | Notify customer, capture demand signal, no payment. |
| `store_reviewing` | Store Owner | `awaiting_clarification` | Any item enters `needs_clarification`. | Pause confirmation SLA clock; notify customer; start clarification timeout. |
| `awaiting_clarification` | Customer | `clarification_provided` | Customer responds before clarification timeout. | Resume SLA clock; return to `store_reviewing`. |
| `awaiting_clarification` | Customer | `unavailable` | Customer withdraws item or declines clarification. | Exclude item; resume SLA clock; return to `store_reviewing` or `unavailable`. |
| `awaiting_clarification` | System Job | `expired` | Clarification timeout elapsed. | Exclude item; resume SLA clock; notify customer/store. |
| `store_reviewing` | Customer | `customer_cancelled` | Payment not started. | Clear review task; release no holds or any provisional holds. |
| `store_reviewing` | System Job | `expired` | Confirmation SLA elapsed during counted open hours. | Clear review task, notify customer, update store reliability metrics. |
| `partially_confirmed` | System Job | `awaiting_customer_decision` | Confirmation done; customer must explicitly accept. | Start `acceptance_expires_at`; soft holds remain. |
| `partially_confirmed` | Customer | `awaiting_customer_decision` | Customer explicitly views partial result; acceptance window starts. | Start `acceptance_expires_at`; soft holds remain. |
| `awaiting_customer_decision` | Customer | `adjusted` | Customer reduces quantity or switches to pickup. | Recalculate subtotal/quote; soft holds adjust to new quantity. |
| `awaiting_customer_decision` | Customer | `payment_pending` | Customer explicitly accepts confirmed result; acceptance window not expired. | Promote soft holds to firm holds; start `payment_expires_at`; create provider payment order server-side. |
| `awaiting_customer_decision` | System Job | `expired` | Acceptance window elapsed. | Release soft holds; notify store/customer. |
| `adjusted` | Customer | `payment_pending` | Customer confirms adjusted result; quote valid. | Promote soft holds to firm holds; start `payment_expires_at`; create provider payment order server-side. |
| `confirmed` | Customer | `customer_cancelled` | Payment not started. | Release holds, notify store, close request. |
| `partially_confirmed` | Customer | `customer_cancelled` | Payment not started. | Release soft holds, notify store, close request. |
| `confirmed` | Customer | `payment_pending` | Payment window active, quote valid. | Create firm holds if not already present; create provider payment order server-side. |
| `partially_confirmed` | Customer | `payment_pending` | Customer explicitly accepts partial confirmation, payment window active, quote valid. | Promote soft holds to firm holds; create provider payment order server-side. |
| `confirmed` | System Job | `payment_expired` | Payment window elapsed. | Release firm holds, notify store/customer. |
| `partially_confirmed` | System Job | `payment_expired` | Payment window elapsed. | Release firm holds, notify store/customer. |
| `payment_pending` | Payment Webhook | `converted_to_order` | Payment success verified and amount matches canonical state. | Create paid order, finalize holds, ledger entries, notify store/customer. |
| `payment_pending` | Payment Webhook/System | `payment_failed` | Provider failure or timeout. | Keep or release holds based on retry policy; notify customer. |
| `payment_pending` | Payment Webhook/System | `reconciliation_required` | Amount/status mismatch, duplicate, missing order conversion. | Create platform ops case. |

Terminal request states:

- `customer_cancelled`
- `expired`
- `unavailable`
- `payment_expired`
- `converted_to_order`

Terminal means no further customer payment may be created from that request.

---

## 6. Order Request Item State Machine

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `requested` | Store Owner | `confirmed_full` | Available quantity >= requested quantity. | Include in confirmed subtotal. |
| `requested` | Store Owner | `confirmed_partial` | Available quantity > 0 and less than requested. | Include confirmed quantity only. |
| `requested` | Store Owner | `unavailable` | Reason selected. | Exclude from payable amount; may create demand signal. |
| `requested` | Store Owner | `needs_clarification` | Policy allows customer clarification before payment. | Notify customer; pause request SLA by policy; start clarification timeout. |
| `needs_clarification` | Customer | `clarification_provided` | Customer responds before clarification timeout. | Notify store, resume review path. |
| `needs_clarification` | Customer | `unavailable` | Customer withdraws the item or declines clarification. | Exclude from payable amount; update request summary. |
| `needs_clarification` | System Job | `unavailable` | Clarification timeout elapsed. | Exclude from payable amount, notify customer/store. |
| `clarification_provided` | Store Owner | `confirmed_full` | Clarification resolves item and full quantity is available. | Include in confirmed subtotal. |
| `clarification_provided` | Store Owner | `confirmed_partial` | Clarification resolves item but only partial quantity is available. | Include confirmed quantity only. |
| `clarification_provided` | Store Owner | `unavailable` | Clarification confirms item cannot be fulfilled. | Exclude from payable amount; may create demand signal. |
| `confirmed_full` | System | `soft_hold_created` | Confirmation done. | Create soft hold for requested quantity; decrement effective availability. |
| `confirmed_partial` | System | `soft_hold_created` | Confirmation done. | Create soft hold for confirmed quantity; decrement effective availability. |
| `soft_hold_created` | Customer/System | `firm_hold_created` | Customer accepts confirmed/adjusted result; payment window starts. | Promote soft hold to firm hold. |
| `firm_hold_created` | Payment Webhook | `sold` | Payment successful and paid order created. | Convert firm hold to sold/reserved. |
| `soft_hold_created` | System | `hold_released` | Customer rejects/cancels before acceptance, or acceptance window expires. | Release soft quantity. |
| `firm_hold_created` | System | `hold_released` | Payment expired/cancelled/failed final. | Release firm quantity. |

---

## 7. Inventory Hold State Machine

Hold semantics:

- `soft_hold`: created atomically at store confirmation in the same transaction as the item confirmation state change. It prevents oversell for used books while the customer is still deciding. It is released if the customer rejects, cancels, or the acceptance window expires.
- `firm_hold`: created when the customer explicitly accepts the confirmed result (or immediately for fully confirmed requests that skip the decision step). It is tied to `payment_expires_at` and is converted to a sale on payment success or released on payment expiry/cancellation.

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `soft_active` | Customer/System | `released` | Customer rejects/cancels before acceptance, or acceptance window expires. | Restore sellable quantity. |
| `soft_active` | Customer/System | `firm_active` | Customer explicitly accepts confirmed/adjusted result. | Hold type promoted to `firm`; `payment_expires_at` starts. |
| `firm_active` | Payment Webhook | `converted_to_sale` | Payment succeeded, order created. | Decrement sellable quantity or reserve to paid order. |
| `firm_active` | Customer/System | `released` | Customer cancelled or payment expired. | Restore sellable quantity. |
| `firm_active` | Platform Operator | `released` | Operator reason required. | Audit reason; notify if customer-impacting. |
| `converted_to_sale` | Platform Operator | `reversed` | Refund/cancellation policy allows stock restoration. | Restore or mark item unavailable depending condition. |

Hold availability guard:

```text
effective_available = available_quantity - sum(active soft and firm holds)
confirmation must fail if effective_available < requested_quantity
```

The guard and the hold creation must be evaluated under row-level locking on the inventory row to prevent race-condition oversell.

Hold expiry must be enforced by a backend job. Client timers are display only.

---

## 8. Payment State Machine

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `not_started` | Customer/System | `provider_order_created` | Confirmed request, quote valid, server-side amount calculated. | Create provider order/payment intent. |
| `provider_order_created` | Customer | `payment_pending` | Customer starts provider payment UI. | Record attempt. |
| `payment_pending` | Payment Webhook | `paid` | Signature valid, idempotency valid, amount/currency match. | Create paid order if not already created; ledger entries. |
| `payment_pending` | Payment Webhook | `failed` | Provider failure verified. | Notify customer; allow retry if policy permits. |
| `payment_pending` | System Job | `expired` | Payment window elapsed. | Release holds unless provider later confirms success; create reconciliation if late success. |
| `payment_pending` | Payment Webhook | `reconciliation_required` | Mismatch, duplicate, late success, missing order, or unexpected amount. | Create payment reconciliation case. |
| `paid` | Platform Operator | `refund_pending` | Refund case approved. | Create provider refund request. |
| `refund_pending` | Payment Webhook | `refunded` | Full refund success. | Ledger reversal, update order/refund case. |
| `refund_pending` | Payment Webhook | `partially_refunded` | Partial refund success. | Ledger partial reversal, update order/refund case. |
| `refund_pending` | Payment Webhook/System | `refund_failed` | Provider refund failed or timed out. | Create finance ops case. |
| `paid` | Payment Provider | `chargeback_opened` | Provider dispute/chargeback event. | Create platform ops case; freeze settlement if needed. |

Payment amount must always be derived from confirmed request state server-side.

---

## 9. Paid Order State Machine

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `paid` | Store Owner | `packing` | Store owns order; payment verified. | Notify customer if useful. |
| `paid` | Store Owner | `post_payment_issue_reported` | Store cannot fulfill after payment. | Freeze fulfillment, create ops case, notify platform. |
| `packing` | Store Owner | `ready_for_pickup` | Pickup order, item count verified. | Generate pickup code, notify customer. |
| `packing` | Store Owner | `ready_for_delivery` | Delivery order, package ready. | Trigger delivery booking path. |
| `ready_for_pickup` | Store Owner | `picked_up` | Pickup code verified. | Complete fulfillment, ledger eligibility. |
| `ready_for_delivery` | Delivery Provider/System | `shipment_booked` | Provider accepts shipment. | Save shipment ID, notify customer/store. |
| `shipment_booked` | Delivery Provider | `picked_up_by_courier` | Provider pickup event verified. | Update delivery state. |
| `picked_up_by_courier` | Delivery Provider | `delivered` | Provider delivery event verified. | Complete fulfillment, ledger eligibility. |
| Any non-terminal paid state | Platform Operator | `refund_pending` | Policy reason and refund path defined. | Pause fulfillment, create refund case, release/reconcile inventory as policy allows. |
| `refund_pending` | Payment Webhook/Finance Service | `refunded` | Full refund success verified. | Ledger reversal, close refund case, notify customer/store. |
| `refund_pending` | Payment Webhook/Finance Service | `partially_refunded_closed` | Partial refund or partial fulfillment resolution completed. | Ledger partial reversal, close refund/dispute case, notify customer/store. |
| `refund_pending` | Payment Webhook/System | `dispute_opened` | Refund failed, disputed, or needs manual decision. | Create finance/platform ops case; freeze settlement if needed. |
| Any non-terminal paid state | Platform Operator | `cancelled` | No refund, delivery, settlement, or customer action remains. | Close order with audit reason. |
| Any non-terminal paid state | Platform Operator | `dispute_opened` | Customer/store/platform dispute. | Create dispute case; may freeze settlement. |

Terminal paid order states:

- `picked_up`
- `delivered`
- `cancelled` only when no refund, settlement, or customer action remains
- `refunded`
- `partially_refunded_closed`

---

## 10. Confirmed Book Unavailable After Payment

This is a critical trust case.

If the store reports that a confirmed and paid item is unavailable:

1. Store must select a reason:
   - sold offline after confirmation
   - misplaced
   - damaged after confirmation
   - wrong edition/condition
   - inventory/metadata mistake
   - other platform-reviewed reason
2. Fulfillment is paused.
3. Platform ops case is created automatically.
4. Customer is notified with clear options:
   - full cancellation/refund
   - partial fulfillment for available items
   - substitute only if customer explicitly approves a substitute offer
5. Store fault event is logged.
6. Internal store reliability metrics are updated.
7. Repeated cases may trigger request throttling, listing review, quota restrictions, or suspension.

The system must not silently substitute a book, reduce quantity, or issue store credit without customer consent.

---

## 11. Refund and Dispute State Machine

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `none` | Customer/Store/System | `case_opened` | Paid order exists or customer-impacting provider issue exists. | Create dispute/refund case. |
| `case_opened` | Platform Operator | `under_review` | Operator assigned. | Request evidence if needed. |
| `under_review` | Platform Operator | `approved_full_refund` | Policy/evidence supports full refund. | Create refund request. |
| `under_review` | Platform Operator | `approved_partial_refund` | Policy/evidence supports partial refund. | Create partial refund request. |
| `under_review` | Platform Operator | `rejected` | Policy/evidence does not support refund. | Notify parties; audit reason. |
| `approved_full_refund` | Payment Webhook | `refund_completed` | Provider confirms refund. | Ledger reversal; settlement adjustment. |
| `approved_partial_refund` | Payment Webhook | `partial_refund_completed` | Provider confirms refund. | Partial ledger reversal; settlement adjustment. |
| `approved_full_refund` | Payment Webhook/System | `refund_failed` | Provider refund failed. | Finance ops case. |
| `approved_partial_refund` | Payment Webhook/System | `refund_failed` | Provider refund failed. | Finance ops case. |

Refund decisions must reference the policy snapshot shown before payment.

---

## 12. Idempotency and Concurrency Requirements

Required idempotency domains:

- cart-to-request creation
- store confirmation submission
- inventory hold creation
- payment provider order creation
- payment success webhook
- paid order creation
- refund request creation
- refund webhook
- delivery shipment booking
- delivery webhook
- settlement batch generation

Concurrency controls:

- inventory holds must be protected against oversell
- same payment webhook must not create duplicate paid orders
- late payment success after expiry must create reconciliation, not silent fulfillment
- store confirmation must fail if request already expired/cancelled
- platform override must include reason and current-state check

---

## 13. Required Events

State machines must emit events defined in DOC-10.

Minimum event requirements:

- `order_request.submitted`
- `order_request.confirmation_due_soon`
- `order_request.confirmed`
- `order_request.partially_confirmed`
- `order_request.unavailable`
- `order_request.expired`
- `order_request.payment_window_started`
- `order_request.payment_expired`
- `order.paid`
- `order.post_payment_issue_reported`
- `order.cancelled`
- `order.refunded`
- `order.partially_refunded`
- `payment.reconciliation_required`
- `dispute.opened`
- `dispute.resolved`

---

## 14. Data Model Additions

```text
commerce_transition_log
  id
  entity_type
  entity_id
  previous_state
  next_state
  actor_user_id nullable
  actor_role
  idempotency_key
  reason nullable
  metadata private
  created_at

order_post_payment_issues
  id
  store_order_id
  store_id
  reported_by
  issue_type
  affected_items
  status
  platform_case_id nullable
  customer_resolution nullable
  created_at
  resolved_at nullable

commerce_idempotency_keys
  id
  scope
  key
  request_hash
  response_snapshot private
  status
  created_at
  expires_at

marketplace_notifications
  id
  store_id nullable
  user_id nullable
  notification_type
  title
  body
  entity_type
  entity_id
  is_read
  severity
  created_at

  Note: `marketplace_notifications` is a column-safe projection populated from `marketplace_events` by server-side processes. It contains no raw `payload` jsonb, no payment/PII metadata, and is the only event-derived table clients subscribe to or read. Raw `marketplace_events` must not be client-readable.
```

Exact table names may change during implementation, but these concepts must exist.

---

## 15. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| STM-01 | Every commerce state transition has an allowed actor and allowed previous state. |
| STM-02 | Customer payment cannot start unless request is confirmed or partially confirmed and payment window is active. |
| STM-03 | Store confirmation cannot increase the confirmed unit price above the price bound at request submission. |
| STM-04 | Soft inventory holds are created atomically at store confirmation and promoted to firm holds on customer acceptance; both are released on expiry/cancellation. |
| STM-05 | Payment success webhook is idempotent and cannot create duplicate orders or ledger entries. |
| STM-06 | Late/mismatched payment events create reconciliation cases. |
| STM-07 | Post-payment unavailable items create platform ops cases and customer resolution options. |
| STM-08 | Refund and partial refund decisions reference checkout policy snapshots. |
| STM-09 | All transitions emit marketplace events and audit logs where appropriate. |
| STM-10 | Cross-tenant transition attempts are denied in tests. |

---

## 16. Related Documents

- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
