# DOC-14: Commerce State Machines

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.3
**Date:** 2026-07-19
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
| Phase boundary | Phase 6 ends at provider-independent `payment_ready`; Phase 7 creates the provider object and enters `payment_pending`. |
| Partial availability | Store can confirm some requested items and reject others. |
| Full-request rejection | `store_rejected` is a distinct non-stock terminal outcome and event, not an alias for `unavailable`. |
| Store confirmation SLA | Counted during store open hours, target 6 open-hours, max 1 business day by default policy. |
| Inventory hold | Partial/materially changed confirmation creates a soft customer-decision hold; full unchanged confirmation or explicit acceptance creates/promotes a firm payment-ready hold. |
| Price changes | Store confirmation can never exceed the immutable server-established bound, even with customer acceptance. The store may honour/lower, mark unavailable, or request support; a higher-price correction path is not in Phase 6. |
| State authority | Server transition service is authoritative. Mobile clients request transitions; they do not write final commerce state directly. |
| Idempotency | Payment, refund, delivery, and operator transition handlers must use idempotency keys. |
| Events | Every state transition emits an append-only marketplace event. |
| Audit | Operator and store actions on commerce state are audited. |
| Post-payment unavailable | Customer receives explicit options and a platform-controlled refund/partial fulfillment path. |
| Requested current-copy photos | Item-level orthogonal state; store must provide before item confirmation and customer must accept before `payment_ready`. No proceed-without-photo outcome. |

---

## 3. Actors

| Actor | Allowed Scope |
|---|---|
| Customer | Create cart/request, cancel before payment, accept partial confirmation, pay, request cancellation/refund/dispute. |
| Store Owner | Under the Phase 6 owner-only MVP capability/entitlement: review, clarify, confirm availability, mark unavailable, reject for bounded non-stock reasons, or request platform support. Manager/staff delegation remains deferred. |
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

Request submission creates the request directly in `submitted`; there is no `draft_cart` or other prior order-request state. The same atomic HTTP command separately transitions the cart from `active` to `submitted`. Request creation and cart transition have distinct command/idempotency sub-scopes, evidence records, and events: `order_request.submitted` for request creation and `marketplace_cart.submitted` for the cart transition. Creation evidence does not invent a previous request state.

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `submitted` | Store Owner | `store_reviewing` | Active owner capability/entitlement for server-derived store; current version and eligibility. | Emit review-start event. |
| `submitted` | Store Owner | `store_rejected` | Bounded non-stock rejection reason; owner capability/version. | Mark unresolved items rejected; release eligible holds; notify/audit. |
| `submitted` | System Job | `expired` | Open-hours confirmation deadline elapsed. | Notify both; update internal metrics. |
| `store_reviewing` | Store Owner | `payment_ready` | Every item fully/materially unchanged; inventory locked; confirmed price at/below bound; live eligibility; no included requested-photo item needs customer acceptance. | Create firm holds directly; final INR total; start `payment_expires_at`; no provider object. |
| `store_reviewing` | Store Owner | `awaiting_customer_decision` | At least one confirmed quantity plus material change or provided current-copy photos requiring customer acceptance. | Create soft holds; start acceptance window; notify. |
| `store_reviewing` | Store Owner | `unavailable` | No item is fulfilable; bounded item stock reasons. | Release eligible holds; notify/audit. |
| `store_reviewing` | Store Owner | `store_rejected` | Bounded full-request non-stock reason. | Mark unresolved items rejected; release; notify/audit. |
| `store_reviewing` | Store Owner | `awaiting_clarification` | Any item needs bounded clarification. | Pause SLA; start clarification timeout; notify customer. |
| `awaiting_clarification` | Customer | `store_reviewing` | Customer responds before timeout. | Resume remaining open-hours SLA; notify store. |
| `awaiting_clarification` | Store Owner | `store_rejected` | Bounded non-stock reason. | Release eligible holds; notify/audit. |
| `awaiting_clarification` | System Job | `expired` | Clarification timeout elapsed. | Release eligible holds; notify both. |
| `awaiting_customer_decision` | Customer | `payment_ready` | Explicit acceptance, valid version/window/live eligibility; pickup selected if below delivery minimum; every included requested-photo item is accepted. | Record photo/result acceptance; promote soft to firm without moving buckets; final INR total; start payment expiry; no provider object. |
| `awaiting_customer_decision` | System Job | `expired` | Acceptance window elapsed. | Release soft holds; notify. |
| Any nonterminal Phase 6 request | Customer | `customer_cancelled` | `auth.uid()` owns request; current version; Phase 7 payment has not started. | Cancel tasks; release active soft/firm holds idempotently; notify store. |
| `payment_ready` | System Job | `payment_ready_expired` | Payment-ready deadline elapsed. | Release firm holds; notify. |
| Eligible review/decision states | System/Platform | `paused_for_emergency_closure` | Bounded emergency closure policy; pause quota/version. | Preserve source state/remaining timers; preserve eligible holds only through pause cap; create ops task. |
| `paused_for_emergency_closure` | System/Platform | saved prior state | Closure ended; eligibility/holds valid; cap not expired. | Restore remaining timers; notify/audit. |
| `paused_for_emergency_closure` | System Job | `expired` or `platform_cancelled` | Pause cap elapsed. | Release soft holds where present; notify/escalate. |
| Active non-payment-ready state | System/Platform | `platform_cancelled` | Suspension/prohibition/loss of selling eligibility. | Fail closed; release eligible soft holds; notify/audit/task. |

Terminal request states:

- `customer_cancelled`
- `platform_cancelled`
- `expired`
- `unavailable`
- `store_rejected`
- `payment_ready_expired`

Terminal means no Phase 7 payment may be created from that request. `payment_ready` is the Phase 6 handoff and is not terminal for the wider commerce lifecycle.

Non-transitioning Store Owner command: `request_platform_support` is allowed on any nonterminal request, including `payment_ready`. It creates a deduplicated operational task, internal `order_request.support_requested` event, and owner audit record without changing request status, price, quantity, holds, or deadlines. Only a separately authorized support command may later transition the request.

Owner-only commands are an explicit Phase 6 MVP capability/entitlement restriction. They must not be implemented by assuming every active `store_administrators` row is an owner; manager/staff delegation remains deferred.

---

## 6. Order Request Item State Machine

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `requested` | Store Owner | `confirmed_full` | Available quantity >= requested quantity; photo substate is `none` or `provided`. | Include in confirmed subtotal; provided-photo item requires customer decision. |
| `requested` | Store Owner | `confirmed_partial` | Available quantity > 0 and less than requested; photo substate is `none` or `provided`. | Include confirmed quantity only; provided-photo item requires customer decision. |
| `requested` | Store Owner | `unavailable` | Reason selected. | Exclude from payable amount; may create demand signal. |
| `requested` | Store Owner | `rejected` | Full request is rejected for a bounded non-stock reason. | Exclude from payable amount; request enters `store_rejected`. |
| `requested` | Store Owner | `needs_clarification` | Policy allows customer clarification before payment. | Notify customer; pause request SLA by policy; start clarification timeout. |
| `needs_clarification` | Customer | `requested` | Customer responds before clarification timeout. | Record immutable clarification evidence, notify store, resume review path. |
| `needs_clarification` | Customer | `unavailable` | Customer withdraws the item or declines clarification. | Exclude from payable amount; update request summary. |
| `needs_clarification` | System Job | `unavailable` | Clarification timeout elapsed. | Exclude from payable amount, notify customer/store. |

Hold lifecycle is not encoded as an item confirmation state. Fully confirmed unchanged items receive firm holds in the same transaction that enters `payment_ready`; partial/materially changed confirmed items receive soft holds in the same transaction that enters `awaiting_customer_decision`. Hold promotion/release is governed by §7.

---

### 6.1 Requested Current-Copy Photo Substate

Photo state is orthogonal to item confirmation:

`none -> requested -> uploading -> provided -> accepted`

Terminal alternatives are `declined`, `unfulfilled`, and `expired`.

- Store cannot transition a requested item to `confirmed_full`/`confirmed_partial` before 1-3 newly captured validated photos are `provided`.
- A provided-photo confirmation enters/uses `awaiting_customer_decision` even when quantity/price is otherwise unchanged.
- Customer acceptance records the photo/result decision and may enter `payment_ready` only when all other guards pass.
- Customer decline, store unfulfilled, or expiry excludes the item and releases/recalculates applicable holds/totals.
- Existing public/scan/other-request media cannot satisfy this state by path reuse.

---

## 7. Inventory Hold State Machine

Hold semantics use an orthogonal type and status:

- `hold_type='soft', status='active'`: created atomically at partial/material store confirmation. It prevents oversell while the customer decides and releases on cancellation/acceptance expiry.
- `hold_type='firm', status='active'`: created for full unchanged confirmation or promoted on explicit acceptance. It is tied to `payment_expires_at`; Phase 7 converts it to sale or Phase 6 releases it on expiry/cancellation.

| Current State | Actor | Allowed Next State | Required Guards | Side Effects |
|---|---|---|---|---|
| `soft` / `active` | Customer/System | `soft` / `released` | Customer cancels before acceptance, or acceptance window expires. | Restore sellable quantity. |
| `soft` / `active` | Customer/System | `firm` / `active` | Customer explicitly accepts the partial/materially changed result. | Promote type only; move no inventory bucket; start payment expiry and enter `payment_ready`. |
| `firm` / `active` | Phase 7 Payment Service | `firm` / `converted_to_sale` | Payment succeeded and paid order created. | Move reserved quantity to sold; create paid-order/ledger effects. |
| `firm` / `active` | Customer/System | `firm` / `released` | Customer cancelled or payment-ready expired. | Restore sellable quantity. |
| `firm` / `active` | Platform Operator | `firm` / `released` | Named authorized command and reason. | Audit reason; notify if customer-impacting. |
| `converted_to_sale` | Platform Operator | `reversed` | Refund/cancellation policy allows stock restoration. | Restore or mark item unavailable depending condition. |

Hold availability guard:

```text
sellable_available = quantity_available
quantity_reserved = sum(active soft and firm holds)
confirmation must fail if quantity_available < confirmed_quantity
```

The repository uses bucket-transfer accounting: creating a hold atomically decrements `quantity_available` and increments `quantity_reserved`; releasing reverses that transfer; promotion moves no bucket. Active holds explain the reserved aggregate and are never subtracted from `quantity_available` again. The guard, bucket transfer, and hold creation must be evaluated under row-level locking on the inventory row to prevent oversell and double subtraction.

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

- request creation and cart `active -> submitted` transition as separate derived identities
- store confirmation submission
- full-request rejection
- Store Owner support request/task creation
- customer acceptance/cancellation
- request/clarification/acceptance/payment-ready expiry
- inventory hold creation
- inventory hold promotion/release
- payment provider order creation (Phase 7)
- payment success webhook
- paid order creation
- refund request creation
- refund webhook
- delivery shipment booking
- delivery webhook
- settlement batch generation
- photo request creation, upload authorization, provision, acceptance/decline, unfulfilled, and expiry

Concurrency controls:

- inventory holds must be protected against oversell
- same payment webhook must not create duplicate paid orders
- late payment success after expiry must create reconciliation, not silent fulfillment
- store confirmation must fail if request already expired/cancelled
- store confirmation must fail above the server-established item price bound
- state progression must fail if server feature/locality/allowlist/store eligibility guards fail
- platform override must include reason and current-state check

---

## 13. Required Events

State machines must emit events defined in DOC-10.

Minimum event requirements:

- `order_request.submitted`
- `marketplace_cart.submitted`
- `order_request.confirmation_due_soon`
- `order_request.review_started`
- `order_request.clarification_requested`
- `order_request.clarification_provided`
- `order_request.confirmed`
- `order_request.partially_confirmed`
- `order_request.unavailable`
- `order_request.rejected`
- `order_request.changes_accepted`
- `order_request.support_requested`
- `order_request.cancelled`
- `order_request.emergency_closure_paused`
- `order_request.emergency_closure_resumed`
- `order_request.store_ineligible`
- `order_request.support_intervened`
- `order_request.expired`
- `order_request.payment_ready_expired`
- `order_request_item.photos_requested`
- `order_request_item.photos_provided`
- `order_request_item.photos_accepted`
- `order_request_item.photos_declined`
- `order_request_item.photos_unfulfilled`
- `order_request_item.photos_expired`
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

marketplace_events additions
  schema_version
  command_id
  correlation_id
  causation_event_id nullable
  privacy_classification

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
| STM-02 | Phase 6 enters provider-independent `payment_ready` only with final INR amount and firm holds; Phase 7 alone creates a provider object and `payment_pending`. |
| STM-03 | Store confirmation cannot increase the confirmed unit price above the server-established bound, even with customer acceptance. |
| STM-04 | Soft inventory holds are created atomically at store confirmation and promoted to firm holds on customer acceptance; both are released on expiry/cancellation. |
| STM-05 | Payment success webhook is idempotent and cannot create duplicate orders or ledger entries. |
| STM-06 | Late/mismatched payment events create reconciliation cases. |
| STM-07 | Post-payment unavailable items create platform ops cases and customer resolution options. |
| STM-08 | Refund and partial refund decisions reference checkout policy snapshots. |
| STM-09 | All transitions emit marketplace events and audit logs where appropriate. |
| STM-10 | Cross-tenant transition attempts are denied in tests. |
| STM-11 | Bucket-transfer accounting decrements available/increments reserved once; active holds are never subtracted from available again. |
| STM-12 | Full-request rejection uses `store_rejected`, bounded non-stock reasons, `order_request.rejected`, audit/notification, and idempotent hold release. |
| STM-13 | `request_platform_support` creates a deduplicated task/event/audit without changing commerce status. |
| STM-14 | Planned closure, bounded emergency pause, and compliance/selling suspension have distinct fail-safe behavior; valid payment-ready holds keep their original expiry unless audited cancellation occurs. |
| STM-15 | Store commands are owner-only through an explicit Phase 6 MVP capability/entitlement; manager/staff delegation remains deferred. |
| STM-16 | Requested-photo state is item-level and versioned; item confirmation requires provided photos and `payment_ready` inclusion requires customer acceptance. |
| STM-17 | Photo unfulfilled/declined/expired outcomes exclude the item and preserve existing hold/total/idempotency/event/audit invariants. |

---

## 16. Related Documents

- [DOC-6: Cart, Order Request, and Payment](./DOC-6-cart-order-request-payment.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
