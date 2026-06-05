# DOC-6: Cart, Order Request, and Payment

**Product:** BookConnect
**Spec Suite:** Multi-Tenant Bookstore Marketplace
**Version:** 0.2
**Date:** 2026-05-22
**Status:** Planning draft
**Depends On:** DOC-0, DOC-1, DOC-2, DOC-3, DOC-5, DOC-14, DOC-15
**Owns:** Single-store cart, order request creation, store confirmation, partial availability, payment timing, cancellation, refunds, commission accounting, and conversion from request to paid order.

---

## 1. Purpose

This document defines the customer order flow from cart through payment.

The core decision is that BookConnect should not take customer payment before the bookstore confirms availability. This is especially important for used books, where a copy may have been sold in-store, misplaced, damaged, or uploaded with stale quantity.

The flow is:

```text
Customer builds single-store cart
  -> customer submits order request
  -> store confirms full or partial availability during open hours
  -> customer reviews confirmed items, delivery/pickup quote, and return policy
  -> customer pays
  -> paid order is created
  -> fulfillment begins
```

---

## 2. Locked Decisions

| Area | Decision |
|---|---|
| Cart scope | MVP supports one store per cart. |
| Cross-store add | Adding from another store replaces the current cart after customer confirmation. |
| Payment timing | No customer payment is taken until the store confirms availability. |
| Partial availability | Store may confirm some items and reject others. |
| Confirmation timer | Counted during store open hours only. |
| Confirmation window | Target 6 open-hours; maximum 1 business day unless platform policy changes. |
| Delivery quote | Final delivery quote is shown before payment. |
| Pickup | Pickup remains a supported fulfillment option. |
| Returns | Store-specific return policy is shown before payment. |
| Settlement | Store payout settlement is weekly by default. |
| Monetization | Commission is charged on completed book sales, alongside store subscriptions. |
| Seller of record | The bookstore is seller of record; BookConnect is marketplace facilitator and support/dispute operator. |
| Payment aggregator | Customer payments must use a licensed payment aggregator/gateway; BookConnect must not store card data or provider secrets in client apps. |
| Tax/invoice snapshot | Order, invoice, tax, GST/TCS, and policy snapshots must be preserved for accounting/legal review. |
| Policy engine | Confirmation SLA, payment expiry, delivery minimum, refund windows, and commission rates must be platform-configurable. |
| State machine authority | DOC-14 is authoritative for commerce state transitions, allowed actors, guards, side effects, and idempotency. |
| Finance authority | DOC-15 is authoritative for ledger, refund reversal, settlement, reserve, and payout-failure behavior. |

---

## 3. Customer Flow

### 3.1 Add to Cart

Customer adds books from one store.

Cart item snapshot must include:

- listing ID
- store ID
- title
- author(s)
- condition
- displayed price
- quantity requested
- pickup/delivery eligibility at time of add
- return policy summary at time of checkout

The snapshot prevents silent changes from confusing the customer during checkout.

### 3.2 Submit Order Request

On checkout, customer submits an order request, not a paid order.

Customer must select:

- pickup or delivery
- delivery address if delivery
- contact phone number if required for delivery
- acceptance of store return policy

The app must show:

```text
The bookstore will confirm availability before payment.
```

### 3.3 Store Confirmation

The store receives the request and confirms line items:

- full quantity available
- partial quantity available
- unavailable
- needs customer clarification

The store cannot increase item price during confirmation. If price is wrong, the store must mark the item unavailable or request platform-supported correction. This avoids bait-and-switch behavior.

### 3.4 Customer Payment Review

After store confirmation, customer sees:

- confirmed items
- unavailable items
- updated subtotal
- delivery fee or pickup label
- platform fees if any
- taxes if applicable
- refund/return policy
- payment expiry timer

Customer options:

- pay for confirmed items
- cancel request
- adjust to confirmed quantities if partial availability exists

### 3.5 Payment

Payment is requested only after confirmation.

After successful payment:

- paid store order is created
- confirmed inventory is reserved or decremented according to inventory policy
- store fulfillment workflow starts
- commission liability is recorded
- settlement ledger entries are created

Payment provider selection is intentionally separate from this spec and requires payment, accounting, and legal review before implementation.

Payment integration rules:

- payment amount must be calculated server-side from confirmed request state
- provider order/payment creation must happen server-side
- payment callbacks/webhooks must be verified and idempotent
- card/payment credentials must never touch the mobile client beyond provider SDK/tokenized flows
- refunds must go through controlled server-side flows and preferably return to original payment method
- chargebacks, duplicate payments, and gateway mismatches must create platform ops cases

---

## 4. Partial Availability

Partial availability is allowed.

Example:

```text
Customer requests:
- Book A quantity 1
- Book B quantity 2
- Book C quantity 1

Store confirms:
- Book A quantity 1
- Book B quantity 1
- Book C unavailable

Customer may pay for Book A and 1 copy of Book B, or cancel.
```

Rules:

- customer must explicitly accept the partial result before payment
- unavailable items are not charged
- delivery quote must be recalculated after partial confirmation
- discounts, minimum delivery order value, and free-delivery thresholds must be recalculated

---

## 5. Confirmation SLA

The confirmation timer runs only during store open hours.

Recommended policy:

| Window | Behavior |
|---|---|
| 0 to 6 open-hours | Normal confirmation window. |
| After 6 open-hours | Reminder notification to store. |
| End of 1 business day | Request expires unless platform grants exception. |

If request expires:

- customer is notified
- no payment is taken
- request is marked expired
- store reliability metrics are updated internally

Customer-visible reliability scoring is deferred from MVP, but internal operational metrics should be collected from day one.

---

## 6. Inventory Reservation

Inventory handling has two stages.

### 6.1 Before Store Confirmation

Do not decrement inventory at request submission.

Reason: the store has not confirmed that the uploaded quantity is still real.

### 6.2 After Store Confirmation

Create a short-lived inventory hold for confirmed items.

Recommended payment window:

- default: 60 minutes
- configurable by platform: 30 to 120 minutes

If customer pays before expiry:

- convert hold into sold/reserved inventory

If customer does not pay:

- release hold
- mark request payment window expired

For very small stores, this protects against a confirmed book being sold elsewhere while the customer is paying.

---

## 7. Delivery Minimums and Quote Timing

Delivery eligibility is determined twice:

1. estimate before request submission
2. final quote after store confirmation

The final quote must account for:

- confirmed subtotal
- delivery address
- store location
- delivery provider availability
- minimum order value
- package size/weight if available
- store open hours and pickup readiness

If partial availability causes the order to fall below minimum delivery value:

- customer may switch to pickup
- customer may cancel
- platform may allow delivery with extra fee if business policy permits

---

## 8. Cancellation Rules

| Stage | Customer Cancellation | Payment Impact |
|---|---|---|
| Cart | Allowed. | No payment. |
| Request submitted before store confirmation | Allowed. | No payment. |
| Store confirmed before payment | Allowed. | No payment; inventory hold released. |
| Payment window expired | Automatic. | No payment; inventory hold released. |
| Paid before fulfillment starts | Policy-controlled cancellation. | Refund may apply. |
| Fulfillment in progress | Platform/store review required. | Refund depends on status and policy. |
| Delivered or picked up | Store return policy applies. | Refund depends on policy and dispute review. |

---

## 9. Refund and Return Rules

Return policy is store-specific, but must be visible before payment.

Minimum platform requirements:

- store must define whether returns are accepted
- policy must specify return window if accepted
- policy must specify whether used books are returnable
- `damaged` condition must have explicit condition notes
- customer must accept policy before payment

Refund triggers:

- store cancels after payment
- item cannot be fulfilled after payment
- delivery failure with customer not at fault
- platform-approved dispute
- return accepted under store policy

Refund handling requires payment-provider integration details and legal/accounting review before implementation.

If a confirmed item becomes unavailable after payment, the flow in DOC-14 applies. The customer must receive explicit options: full refund/cancel, partial fulfillment where applicable, or substitute only with explicit approval. The system must log a store fault event and create a platform ops case.

---

## 10. Commission and Settlement

Commission is recorded when payment succeeds.

Recommended ledger entries:

- customer gross payment
- book subtotal
- delivery fee
- platform commission
- payment gateway fee
- tax components if applicable
- refundable amount
- store net receivable
- settlement batch ID

Weekly settlement is the default planning assumption.

Settlement should not rely only on payment records. It needs a ledger that can handle refunds, partial refunds, delivery adjustments, commission reversals, and manual platform adjustments.

Tax/accounting snapshot fields must be preserved for each paid order:

- seller legal/display name snapshot
- seller GSTIN/PAN status where applicable
- buyer invoice details where required
- item subtotal
- delivery fee
- platform fees if charged to customer
- platform commission
- payment gateway fee
- tax/GST/TCS fields after legal/accounting review
- refund/credit-note basis
- return policy snapshot

This specification does not decide tax treatment. It requires the data model to be capable of supporting the decision after legal/accounting review.

---

## 11. State Model

This section is a summary. DOC-14 is the authoritative source for transition matrices, actors, guards, side effects, and idempotency requirements.

### 11.1 Order Request States

| State | Meaning |
|---|---|
| `submitted` | Customer submitted request; store not yet acting. |
| `store_reviewing` | Store opened or started reviewing request. |
| `confirmed` | Store confirmed all requested items. |
| `partially_confirmed` | Store confirmed only some requested quantity/items. |
| `unavailable` | Store rejected all items as unavailable. |
| `customer_cancelled` | Customer cancelled before payment. |
| `expired` | Store did not confirm within allowed window. |
| `payment_expired` | Store confirmed, but customer did not pay in time. |
| `converted_to_order` | Payment succeeded and paid order was created. |

### 11.2 Payment States

| State | Meaning |
|---|---|
| `not_started` | Payment not yet available or not requested. |
| `payment_pending` | Payment attempt started. |
| `paid` | Payment succeeded. |
| `failed` | Payment attempt failed. |
| `expired` | Payment window expired. |
| `refunded` | Full refund completed. |
| `partially_refunded` | Partial refund completed. |
| `chargeback_opened` | Gateway/customer dispute opened. |
| `reconciliation_required` | Payment/ledger/provider mismatch requires platform review. |

### 11.3 Paid Order States

Paid order fulfillment states are defined in DOC-7.

---

## 12. Data Model

```text
marketplace_carts
  id
  user_id
  store_id
  status
  created_at
  updated_at

marketplace_cart_items
  id
  cart_id
  listing_id
  store_id
  requested_quantity
  price_snapshot_inr
  condition_snapshot
  title_snapshot
  created_at
  updated_at

store_order_requests
  id
  user_id
  store_id
  cart_id nullable
  fulfillment_method
  delivery_address_id nullable
  status
  confirmation_due_at
  open_hours_due_at
  payment_expires_at nullable
  subtotal_requested_inr
  subtotal_confirmed_inr nullable
  delivery_quote_inr nullable
  return_policy_snapshot
  seller_policy_snapshot
  tax_snapshot nullable
  customer_note nullable
  created_at
  updated_at

store_order_request_items
  id
  order_request_id
  listing_id
  inventory_id
  requested_quantity
  confirmed_quantity
  unavailable_reason nullable
  price_snapshot_inr
  confirmation_status
  created_at
  updated_at

inventory_holds
  id
  store_id
  inventory_id
  order_request_id
  quantity
  status
  expires_at
  created_at
  released_at nullable

payments
  id
  order_request_id
  store_order_id nullable
  user_id
  store_id
  provider
  provider_payment_id nullable
  amount_inr
  status
  idempotency_key
  reconciliation_status
  created_at
  updated_at

settlement_ledger_entries
  id
  store_id
  store_order_id
  payment_id
  entry_type
  amount_inr
  currency
  settlement_batch_id nullable
  tax_component nullable
  reference_type
  reference_id
  created_at

invoice_snapshots
  id
  store_order_id
  payment_id
  store_id
  user_id
  seller_snapshot
  buyer_snapshot nullable
  line_items_snapshot
  tax_snapshot nullable
  policy_snapshot
  created_at
```

---

## 13. Security and Privacy

- Customers can read only their own carts, requests, payments, and orders.
- Stores can read only requests/orders for their store.
- Store confirmation writes must verify store ownership or authorized store operator status.
- Payment callbacks must be handled server-side, not from the mobile client.
- Amounts used for payment must be calculated server-side from confirmed request state.
- Customer address and phone must not be exposed beyond the fulfilling store and delivery provider need.
- Payment provider secrets must never be present in the mobile client.
- All order state transitions must be server-validated.
- Client apps must not decide tax, commission, settlement, or refund amounts.
- Payment webhook payloads must be private and visible only to authorized platform operations.

---

## 14. MVP Acceptance Criteria

| ID | Criterion |
|---|---|
| ORD-01 | Customer can maintain a cart for one store only. |
| ORD-02 | Adding a book from another store prompts cart replacement. |
| ORD-03 | Checkout creates an unpaid order request. |
| ORD-04 | Store can confirm full availability, partial availability, or unavailability. |
| ORD-05 | Customer pays only after store confirmation. |
| ORD-06 | Partial confirmation recalculates subtotal and delivery quote before payment. |
| ORD-07 | Payment expiry releases inventory holds. |
| ORD-08 | Store cannot increase item price during confirmation. |
| ORD-09 | Customer sees return policy before payment. |
| ORD-10 | Commission and settlement ledger entries are created after successful payment. |
| ORD-11 | Payment provider creation, callbacks, refunds, and reconciliation are server-side and idempotent. |
| ORD-12 | Paid orders preserve seller, policy, invoice, tax, and refund-basis snapshots for accounting/legal review. |

---

## 15. Deferred Items

- multi-store cart and split payments
- cash on delivery
- customer-visible store reliability score
- automatic payment authorization before store confirmation
- customer-to-store negotiation
- loyalty discounts and coupons
- automated tax filing logic

---

## 16. Related Documents

- [DOC-5: Consumer Marketplace and Discovery](./DOC-5-consumer-marketplace-discovery.md)
- [DOC-7: Fulfillment and Delivery](./DOC-7-fulfillment-delivery.md)
- [DOC-8: Store Owner Console](./DOC-8-store-owner-console.md)
- [DOC-9: Platform Operations and Admin](./DOC-9-platform-ops-admin.md)
- [DOC-10: Notifications, Events, and Realtime](./DOC-10-notifications-events-realtime.md)
- [DOC-14: Commerce State Machines](./DOC-14-commerce-state-machines.md)
- [DOC-15: Finance, Tax, and Settlement Operating Model](./DOC-15-finance-tax-settlement-operating-model.md)
